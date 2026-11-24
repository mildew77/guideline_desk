import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY);

const eligibilityUrl = 'https://singlefamily.fanniemae.com/media/document/pdf/eligibility-matrix-current';
const llpaUrl = 'https://singlefamily.fanniemae.com/media/document/pdf/llpa-matrix-pdf';
const ltvBands = '<30.00%, 30.01–60.00%, 60.01–70.00%, 70.01–75.00%, 75.01–80.00%, 80.01–85.00%, 85.01–90.00%, 90.01–95.00%, >95.00%';

const documents = [
  {
    section_id: 'ELIGIBILITY-MATRIX-CREDIT', section_title: 'Eligibility Matrix — Credit Score and Manual Underwriting',
    guide_name: 'Eligibility Matrix', guide_version: 'August 5, 2026', source_url: eligibilityUrl, effective_date: '2026-08-05',
    content: `Fannie Mae Eligibility Matrix, August 5, 2026. The matrix is incorporated by reference into the Selling Guide. It provides comprehensive LTV, CLTV and HCLTV requirements and also includes credit score, minimum reserve requirements in months, and maximum DTI requirements for manually underwritten loans. For standard manual underwriting, the matrix organizes eligibility by transaction type, number of units, maximum LTV/CLTV/HCLTV, Credit Score/LTV, minimum reserves, and maximum DTI alternatives of 36% or less and 45% or less. Exceptions apply; refer to the notes in the official matrix. For transactions with no borrower credit score and no borrower with at least one credit or installment account reported, refer to Selling Guide B3-5.4-01, Eligibility Requirements for Loans with Nontraditional Credit.`,
  },
  {
    section_id: 'ELIGIBILITY-MATRIX-DU', section_title: 'Eligibility Matrix — DU LTV and Credit Context',
    guide_name: 'Eligibility Matrix', guide_version: 'August 5, 2026', source_url: eligibilityUrl, effective_date: '2026-08-05',
    content: `Fannie Mae Eligibility Matrix, August 5, 2026. Standard Eligibility Requirements for Desktop Underwriter Version 12.1: for principal-residence purchase and limited cash-out refinance, one-unit fixed-rate mortgages have a 97% maximum LTV/CLTV/HCLTV and ARMs have 95%; two- to four-unit FRMs/ARMs have 95%. For cash-out refinance, one-unit FRMs/ARMs have 80% and two- to four-unit FRMs/ARMs have 75%. For second homes, purchase and limited cash-out refinance on a one-unit FRM/ARM have 90%; cash-out refinance has 75%. For investment properties, purchase maximums are 85% for one unit and 75% for two to four units; limited cash-out refinance is 75%; cash-out refinance is 75% for one unit and 70% for two to four units. The official matrix, including its exceptions and credit requirements, controls.`,
  },
  {
    section_id: 'LLPA-GRID-PURCHASE', section_title: 'LLPA Grid — Purchase Money Classic FICO Score and LTV',
    guide_name: 'Loan-Level Price Adjustment Matrix', guide_version: 'Effective September 9, 2026', source_url: llpaUrl, effective_date: '2026-09-09',
    content: `Fannie Mae LLPA Matrix effective September 9, 2026. Purchase Money Loans — LLPA by Classic FICO Score/LTV Ratio, applicable to loans with terms greater than 15 years. LTV columns in order: ${ltvBands}. FICO ≥780: 0.000, 0.000, 0.000, 0.000, 0.375, 0.375, 0.250, 0.250, 0.125. 760–779: 0.000, 0.000, 0.000, 0.250, 0.625, 0.625, 0.500, 0.500, 0.250. 740–759: 0.000, 0.000, 0.125, 0.375, 0.875, 1.000, 0.750, 0.625, 0.500. 720–739: 0.000, 0.000, 0.250, 0.750, 1.250, 1.250, 1.000, 0.875, 0.750. 700–719: 0.000, 0.000, 0.375, 0.875, 1.375, 1.500, 1.250, 1.125, 0.875. 680–699: 0.000, 0.000, 0.625, 1.125, 1.750, 1.875, 1.500, 1.375, 1.125. 660–679: 0.000, 0.000, 0.750, 1.375, 1.875, 2.125, 1.750, 1.625, 1.250. 640–659: 0.000, 0.000, 1.125, 1.500, 2.250, 2.500, 2.000, 1.875, 1.500. ≤639: 0.000, 0.125, 1.500, 2.125, 2.750, 2.875, 2.625, 2.250, 1.750. Values are LLPA percentages; refer to the official matrix for applicability and exclusions.`,
  },
  {
    section_id: 'LLPA-GRID-LIMITED-CASHOUT', section_title: 'LLPA Grid — Limited Cash-Out Refinance Classic FICO Score and LTV',
    guide_name: 'Loan-Level Price Adjustment Matrix', guide_version: 'Effective September 9, 2026', source_url: llpaUrl, effective_date: '2026-09-09',
    content: `Fannie Mae LLPA Matrix effective September 9, 2026. Limited Cash-out Refinance — LLPA by Classic FICO Score/LTV Ratio, applicable to loans with terms greater than 15 years. LTV columns in order: ${ltvBands}. FICO ≥780: 0.000, 0.000, 0.000, 0.125, 0.500, 0.625, 0.500, 0.375, 0.375. 760–779: 0.000, 0.000, 0.125, 0.375, 0.875, 1.000, 0.750, 0.625, 0.625. 740–759: 0.000, 0.000, 0.250, 0.750, 1.125, 1.375, 1.125, 1.000, 1.000. 720–739: 0.000, 0.000, 0.500, 1.000, 1.625, 1.750, 1.500, 1.250, 1.250. 700–719: 0.000, 0.000, 0.625, 1.250, 1.875, 2.125, 1.750, 1.625, 1.625. 680–699: 0.000, 0.000, 0.875, 1.625, 2.250, 2.500, 2.125, 1.750, 1.750. 660–679: 0.000, 0.125, 1.125, 1.875, 2.500, 3.000, 2.375, 2.125, 2.125. 640–659: 0.000, 0.250, 1.375, 2.125, 2.875, 3.375, 2.875, 2.500, 2.500. ≤639: 0.000, 0.375, 1.750, 2.500, 3.500, 3.875, 3.625, 2.500, 2.500. Values are LLPA percentages; refer to the official matrix for applicability and exclusions.`,
  },
  {
    section_id: 'LLPA-RULES-ATTRIBUTES', section_title: 'LLPA Rules, Attribute Adjustments, Waivers and Credits',
    guide_name: 'Loan-Level Price Adjustment Matrix', guide_version: 'Effective September 9, 2026', source_url: llpaUrl, effective_date: '2026-09-09',
    content: `Fannie Mae LLPA Matrix effective September 9, 2026. LLPAs apply to loans sold to Fannie Mae based on loan features including credit score, loan purpose, occupancy, units and product type. LLPAs are cumulative and generally use gross LTV; minimum mortgage insurance LLPAs use base/net LTV. Credit score uses the Selling Guide representative credit score. A loan with no credit score is charged under the lowest score range in the applicable tables. For purchase money and limited cash-out refinance, additional LLPAs include: ARM 0.250% at 90.01–95% and >95% LTV; condo 0.125% at 60.01–75%, then 0.750% at 75.01% and above; investment property and second home 1.125% below 60.01%, 1.625% at 60.01–70%, 2.125% at 70.01–75%, 3.375% at 75.01–80%, and 4.125% at 80.01% and above. All LLPAs are waived, except applicable minimum-MI-option LLPAs, for HomeReady loans; qualifying first-time homebuyers at applicable AMI limits; and qualifying Duty to Serve loans. Current credits include -$500 for HomeReady housing counseling, HomeStyle Energy, eligible RefiNow and HomePath loans; and -$2,500 for qualifying very-low-income HomeReady purchase borrowers who meet the stated first-time-homebuyer condition.`,
  },
];

const rows = documents.flatMap((document) => {
  const size = 1800;
  const text = document.content;
  const result = [];
  for (let start = 0, index = 1; start < text.length; start += size, index += 1) {
    const content = text.slice(start, start + size).trim();
    if (content.length > 250) result.push({ ...document, section_id: `${document.section_id}#${index}`, content, content_hash: createHash('sha256').update(`${document.section_id}|${content}`).digest('hex') });
  }
  return result;
});

console.log(`Embedding ${rows.length} Fannie Mae matrix chunks.`);
const embeddings = await openai.embeddings.create({ model: 'text-embedding-3-small', input: rows.map((row) => row.content), dimensions: 1536 });
const payload = rows.map((row, index) => ({ agency: 'Fannie Mae', ...row, embedding: embeddings.data[index].embedding }));
const { error } = await supabase.from('guideline_chunks').upsert(payload, { onConflict: 'content_hash' });
if (error) throw error;
console.log('Fannie Mae Eligibility Matrix and LLPA records imported.');
