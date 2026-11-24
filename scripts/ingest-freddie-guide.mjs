import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);
const sourceFile = join(process.cwd(), 'data', 'guidelines', 'sources.json');
const pdfPath = process.env.FREDDIE_GUIDE_PDF;
const python = process.env.GUIDELINE_PYTHON || 'python3';

if (!pdfPath) throw new Error('Set FREDDIE_GUIDE_PDF to the official Freddie Mac Guide PDF before running this import.');

const { stdout } = await execFileAsync(python, ['scripts/extract-freddie-sections.py', pdfPath], {
  maxBuffer: 50 * 1024 * 1024
});
const extracted = JSON.parse(stdout);
const sources = JSON.parse(await readFile(sourceFile, 'utf8')).filter((source) => source.source_type === 'pdf');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY);

function chunks(text, size = 1800, overlap = 180) {
  const result = [];
  for (let start = 0; start < text.length; start += size - overlap) {
    const end = Math.min(text.length, start + size);
    const boundary = text.lastIndexOf('. ', end);
    const chunk = text.slice(start, boundary > start + 500 ? boundary + 1 : end).trim();
    if (chunk.length > 250) result.push(chunk);
    if (end === text.length) break;
  }
  return result;
}

function effectiveDate(text) {
  const match = text.match(/\((\d{2})\/(\d{2})\/(\d{2})\)/);
  return match ? `20${match[3]}-${match[1]}-${match[2]}` : null;
}

for (const source of sources) {
  const text = extracted[source.section_id]?.text;
  if (!text || text.length < 500) throw new Error(`No usable official PDF text found for ${source.section_id}.`);
  const sectionChunks = chunks(text);
  console.log(`${source.agency} ${source.section_id}: ${sectionChunks.length} chunks`);

  for (let index = 0; index < sectionChunks.length; index += 20) {
    const batch = sectionChunks.slice(index, index + 20);
    const embeddings = await openai.embeddings.create({ model: 'text-embedding-3-small', input: batch, dimensions: 1536 });
    const rows = batch.map((content, position) => {
      const { source_type, ...sourceRow } = source;
      return {
      ...sourceRow,
      section_id: `${source.section_id}#${index + position + 1}`,
      content,
      effective_date: effectiveDate(text),
      content_hash: createHash('sha256').update(`${source.agency}|${source.section_id}|${content}`).digest('hex'),
      embedding: embeddings.data[position].embedding
    };
    });
    const { error } = await supabase.from('guideline_chunks').upsert(rows, { onConflict: 'content_hash' });
    if (error) throw error;
  }
}

console.log('Official Freddie Mac Guide import complete.');
