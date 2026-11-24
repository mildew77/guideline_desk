import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY);

function chunks(text, size = 1000, overlap = 100) {
  const result = [];
  for (let start = 0; start < text.length; start += size - overlap) {
    const end = Math.min(text.length, start + size);
    const boundary = text.lastIndexOf('. ', end);
    const chunk = text.slice(start, boundary > start + 250 ? boundary + 1 : end).trim();
    if (chunk.length > 250) result.push(chunk);
    if (end === text.length) break;
  }
  return result;
}

async function sourceRows(prefix) {
  const { data, error } = await supabase.from('guideline_chunks').select('section_id,section_title,content,source_url,effective_date,guide_name,guide_version,agency').like('section_id', `${prefix}%`);
  if (error) throw error;
  return data.sort((a, b) => a.section_id.localeCompare(b.section_id, undefined, { numeric: true }));
}

const focused = [
  { key: 'LTV-FNMA', title: 'Focused LTV Guidance — B2-1.2-01', prefix: 'B2-1.2-01' },
  { key: 'LTV-FHLMC', title: 'Focused LTV Guidance — 4203.1', prefix: '4203.1' }
];
const rows = [];
for (const item of focused) {
  const source = await sourceRows(item.prefix);
  if (!source.length) throw new Error(`No existing source content found for ${item.prefix}.`);
  const first = source[0];
  const text = source.map((row) => row.content).join('\n');
  chunks(text).forEach((content, index) => rows.push({
    agency: first.agency, guide_name: first.guide_name, guide_version: first.guide_version,
    section_id: `${item.key}#${index + 1}`, section_title: item.title,
    source_url: first.source_url, effective_date: first.effective_date, content,
    content_hash: createHash('sha256').update(`${item.key}|${content}`).digest('hex')
  }));
}

console.log(`Embedding ${rows.length} focused LTV chunks.`);
for (let start = 0; start < rows.length; start += 50) {
  const batch = rows.slice(start, start + 50);
  const embeddings = await openai.embeddings.create({ model: 'text-embedding-3-small', input: batch.map((row) => row.content), dimensions: 1536 });
  const payload = batch.map((row, index) => ({ ...row, embedding: embeddings.data[index].embedding }));
  const { error } = await supabase.from('guideline_chunks').upsert(payload, { onConflict: 'content_hash' });
  if (error) throw error;
}
console.log('Focused LTV guidance import complete.');
