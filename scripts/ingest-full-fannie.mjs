import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const sitemapUrl = 'https://selling-guide.fanniemae.com/sitemap.xml';
const guideVersion = 'Selling Guide (September 2, 2026)';
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

function sourceText(html) {
  const $ = load(html);
  $('script, style, noscript, svg, nav, footer, header, form, aside').remove();
  const main = $('main, article, [role="main"]').first();
  const root = main.length ? main : $('body');
  return { title: root.find('h1').first().text().replace(/\s+/g, ' ').trim(), text: root.text().replace(/\s+/g, ' ').trim() };
}

async function pooled(items, limit, work) {
  const results = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      const value = await work(item);
      if (value) results.push(value);
    }
  }));
  return results;
}

const sitemap = await (await fetch(sitemapUrl, { headers: { 'User-Agent': 'GuidelineDesk/1.0 (source-first mortgage research)' } })).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).filter((url) => /\/sel\/[a-z]\d-/i.test(url));
console.log(`Found ${urls.length} official Fannie Mae Selling Guide sections.`);

const documents = await pooled(urls, 5, async (sourceUrl, index) => {
  const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'GuidelineDesk/1.0 (source-first mortgage research)' } });
  if (!response.ok) throw new Error(`${response.status} while reading ${sourceUrl}`);
  const { title, text } = sourceText(await response.text());
  const sectionId = sourceUrl.split('/sel/')[1].split('/')[0].toUpperCase();
  const dateMatch = text.match(/Effective\s+(\d{2})\/(\d{2})\/(\d{4})|\((\d{2})\/(\d{2})\/(\d{4})\)/i);
  const values = dateMatch ? (dateMatch[1] ? dateMatch.slice(1, 4) : dateMatch.slice(4, 7)) : null;
  const effectiveDate = values ? `${values[2]}-${values[0]}-${values[1]}` : null;
  if (index % 50 === 0) console.log(`Read ${index + 1}/${urls.length} Fannie Mae sections.`);
  return chunks(text).map((content, chunkIndex) => ({
    agency: 'Fannie Mae', guide_name: 'Selling Guide', guide_version: guideVersion,
    section_id: `${sectionId}#${chunkIndex + 1}`, section_title: title || sectionId,
    source_url: sourceUrl, effective_date: effectiveDate, content,
    content_hash: createHash('sha256').update(`Fannie Mae|${sectionId}|${content}`).digest('hex')
  }));
});

const rows = documents.flat();
console.log(`Embedding ${rows.length} Fannie Mae chunks.`);
for (let start = 0; start < rows.length; start += 80) {
  const batch = rows.slice(start, start + 80);
  const embeddings = await openai.embeddings.create({ model: 'text-embedding-3-small', input: batch.map((row) => row.content), dimensions: 1536 });
  const payload = batch.map((row, index) => ({ ...row, embedding: embeddings.data[index].embedding }));
  const { error } = await supabase.from('guideline_chunks').upsert(payload, { onConflict: 'content_hash' });
  if (error) throw error;
  console.log(`Stored ${Math.min(start + batch.length, rows.length)}/${rows.length} Fannie Mae chunks.`);
}

console.log('Full Fannie Mae Selling Guide import complete.');
