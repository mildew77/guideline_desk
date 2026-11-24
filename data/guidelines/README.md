# Guideline ingestion input

`sources.json` is an official-source manifest. The importer fetches those canonical pages, extracts readable source text, chunks it, embeds it, and loads it into Supabase.

```json
[{"agency":"Fannie Mae","guide_name":"Selling Guide","section_id":"B3-4.1-01","section_title":"Minimum Reserve Requirements","source_url":"https://selling-guide.fanniemae.com/..."}]
```

Use only official Fannie Mae and Freddie Mac source URLs. Then run `node --env-file=.env.local scripts/ingest-guidelines.mjs`.
