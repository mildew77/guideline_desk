# Guideline Desk

### Find the rule. See the source.

Guideline Desk is a mortgage-guideline research assistant that helps turn plain-English lending questions into concise answers with links to supporting Fannie Mae and Freddie Mac guidance.

**[Visit Guideline Desk →](https://guideline-desk.marshall.mortgage/)**

## Research with the source in view

Ask a question about a lending scenario, review the answer, and open the cited guide sections to read the requirements in context.

- **Ask naturally.** Research topics such as reserve requirements, self-employed income, gift funds, and accessory dwelling units.
- **Follow the citations.** Numbered references link to official source pages, with supporting excerpts displayed beside the answer.
- **Check the details.** Retrieved sources include section titles and effective dates when available.
- **Keep useful answers.** Copy an answer for reference during your research.

Answers depend on the content imported into the source library. The application instructs the model to use retrieved excerpts and acknowledge when those excerpts do not answer the question. AI-generated summaries can still contain errors; always verify the original guidance.

## How it works

Guideline Desk uses retrieval-augmented generation (RAG):

1. Official guide content is extracted, split into passages, and embedded into a Supabase database.
2. A question is embedded and matched against relevant passages using vector similarity.
3. OpenAI generates a response using the retrieved context, with numbered citations.
4. The interface presents the answer alongside links and excerpts for review.

The application uses **Next.js**, **React**, **OpenAI**, and **Supabase with pgvector**. AWS Amplify hosts the production application; Terraform configuration is included for infrastructure management.

## Run locally

### Prerequisites

- Node.js 22 or later and npm.
- An OpenAI API project with a valid API key and available API usage credit or billing.
- A Supabase project with the database migrations applied.

### 1. Install dependencies

```bash
git clone https://github.com/mildew77/guideline_desk.git
cd guideline_desk
npm ci
```

### 2. Configure the environment

Create `.env.local` in the project root:

```dotenv
OPENAI_API_KEY=your-openai-api-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-secret-key
```

These are placeholders. Keep real credentials out of Git and browser-side code. The OpenAI and Supabase secret keys are used by the server.

### 3. Prepare the database and sources

Run the SQL migrations in [`supabase/migrations`](supabase/migrations) in filename order using the Supabase SQL Editor.

Review the official source manifest at [`data/guidelines/sources.json`](data/guidelines/sources.json), then import its supported HTML sources:

```bash
npm run ingest:fannie
```

Ingestion calls the OpenAI API and incurs usage charges. Additional import scripts are listed in [`package.json`](package.json); PDF-based imports require additional local inputs and Python tooling. See the [source ingestion notes](data/guidelines/README.md) for the manifest format.

### 4. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To build and run a production version locally:

```bash
npm run build
npm start
```

## Deployment

The repository includes an Amplify build configuration in [`amplify.yml`](amplify.yml) and Terraform resources in [`infra`](infra).

The Amplify build reads `OPENAI_API_KEY` and `SUPABASE_SECRET_KEY` from AWS Systems Manager Parameter Store using the configured parameter names. It also requires `NEXT_PUBLIC_SUPABASE_URL`. Store production credentials as SecureString parameters and redeploy after updating them, because the build incorporates those values into the server environment.

See the [infrastructure guide](infra/README.md) for deployment details. Review database access policies and add appropriate authentication, rate limits, and usage controls before operating your own public instance.

## Troubleshooting

If a question returns “The research service could not complete this request,” inspect the server logs for `RAG request failed:`. The browser receives a generic error to avoid exposing server details.

- **OpenAI authentication error:** Verify that the deployed API key is valid. Replace an expired or revoked key in Parameter Store and redeploy.
- **Missing environment variable:** Check the local `.env.local` file or production build configuration.
- **Database or retrieval error:** Verify the Supabase URL, server secret key, and database migrations.
- **No supporting sources:** Confirm that source content has been imported. An empty library returns a no-content message rather than a researched answer.

## Research notice

Guideline Desk provides research support, not an underwriting decision. Confirm current agency guidance, effective dates, lender overlays, and applicable automated underwriting findings before making a lending decision. Source coverage depends on the imported library and its update schedule.

## Questions or support

Have a question or need help? Email **[support@laylon-marketing.com](mailto:support@laylon-marketing.com)**.

Try the live application at **[guideline-desk.marshall.mortgage](https://guideline-desk.marshall.mortgage/)**.
