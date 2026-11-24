import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);
const pdfPath = process.env.FREDDIE_GUIDE_PDF;
const python = process.env.GUIDELINE_PYTHON || 'python3';
const extractionFile = process.env.FREDDIE_EXTRACTION_FILE || '/private/tmp/guideline-desk-pdfs/freddie-full-guide.jsonl';
if (!pdfPath) throw new Error('Set FREDDIE_GUIDE_PDF to the official full Freddie Mac Guide PDF.');

if (!process.env.FREDDIE_EXTRACTION_FILE) {
  await execFileAsync(python, ['scripts/extract-full-freddie.py', pdfPath, extractionFile], { maxBuffer: 1024 * 1024 });
}
const pages = (await readFile(extractionFile, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
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

const rows = pages.flatMap((page) => {
  const date = page.section_title.match(/\((\d{2})\/(\d{2})\/(\d{2})\)/)?.slice(1);
  return chunks(page.content).map((content, index) => ({
    agency: 'Freddie Mac', guide_name: 'Single-Family Seller/Servicer Guide', guide_version: 'Full Guide PDF (May 6, 2026)',
    section_id: `${page.section_id}#p${page.page}-${index + 1}`, section_title: page.section_title,
    source_url: `https://guide.freddiemac.com/app/servicing/section/${page.section_id}`,
    effective_date: date ? `20${date[2]}-${date[0]}-${date[1]}` : null, content,
    content_hash: createHash('sha256').update(`Freddie Mac|${page.section_id}|${content}`).digest('hex')
  }));
});

const existingHashes = new Set();
async function readHashPage(start) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.from('guideline_chunks').select('content_hash').eq('agency', 'Freddie Mac').range(start, start + 199);
    if (!error) return data;
    if (attempt === 2) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}
for (let start = 0; ; start += 200) {
  const data = await readHashPage(start);
  data.forEach((row) => existingHashes.add(row.content_hash));
  if (data.length < 200) break;
}
const uniqueRows = [...new Map(rows.map((row) => [row.content_hash, row])).values()];
const pendingRows = uniqueRows.filter((row) => !existingHashes.has(row.content_hash));
console.log(`Embedding ${pendingRows.length} new Freddie Mac chunks (${existingHashes.size} already stored; ${rows.length - uniqueRows.length} duplicate chunks skipped).`);

async function upsertWithRetry(payload) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase.from('guideline_chunks').upsert(payload, { onConflict: 'content_hash' });
    if (!error) return;
    if (attempt === 2) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}

for (let start = 0; start < pendingRows.length; start += 40) {
  const batch = pendingRows.slice(start, start + 40);
  const embeddings = await openai.embeddings.create({ model: 'text-embedding-3-small', input: batch.map((row) => row.content), dimensions: 1536 });
  const payload = batch.map((row, index) => ({ ...row, embedding: embeddings.data[index].embedding }));
  await upsertWithRetry(payload);
  console.log(`Stored ${Math.min(start + batch.length, pendingRows.length)}/${pendingRows.length} new Freddie Mac chunks.`);
}

console.log('Full Freddie Mac Guide import complete.');
