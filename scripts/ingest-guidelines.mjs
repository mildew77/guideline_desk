import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from 'cheerio';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const sourceFile = join(process.cwd(), 'data', 'guidelines', 'sources.json');
const sources = JSON.parse(await readFile(sourceFile, 'utf8'));
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY);

function cleanText(html) {
  const $ = load(html);
  $('script, style, noscript, svg, nav, footer, header, form').remove();
  const main = $('main, article, [role="main"]').first();
  return (main.length ? main : $('body')).text().replace(/\s+/g, ' ').trim();
}

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

for (const source of sources.filter((item) => item.source_type === 'html')) {
  const response = await fetch(source.source_url, { headers: { 'User-Agent': 'GuidelineDesk/1.0 (source-first mortgage research)' } });
  if (!response.ok) throw new Error(`${source.section_id}: ${response.status} ${response.statusText}`);
  const text = cleanText(await response.text());
  if (text.length < 500) throw new Error(`${source.section_id}: official page did not contain enough readable source text.`);
  const match = text.match(/Effective\s+(\d{2}\/\d{2}\/\d{4})|\((\d{2}\/\d{2}\/\d{4})\)/i);
  const effectiveDate = match ? (() => {
    const [month, day, year] = (match[1] || match[2]).split('/');
    return `${year}-${month}-${day}`;
  })() : null;
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
      effective_date: effectiveDate,
      content_hash: createHash('sha256').update(`${source.agency}|${source.section_id}|${content}`).digest('hex'),
      embedding: embeddings.data[position].embedding
    };
    });
    const { error } = await supabase.from('guideline_chunks').upsert(rows, { onConflict: 'content_hash' });
    if (error) throw error;
  }
}

console.log('Official source library import complete.');
