create extension if not exists vector;

create table if not exists public.guideline_chunks (
  id uuid primary key default gen_random_uuid(),
  agency text not null check (agency in ('Fannie Mae', 'Freddie Mac')),
  guide_name text not null,
  guide_version text,
  section_id text not null,
  section_title text not null,
  content text not null,
  source_url text not null,
  effective_date date,
  content_hash text unique not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists guideline_chunks_agency_idx on public.guideline_chunks (agency);

create or replace function public.match_guideline_chunks(
  query_embedding vector(1536), match_count integer default 6, agency_filter text default null
)
returns table (id uuid, agency text, guide_name text, guide_version text, section_id text, section_title text, content text, source_url text, effective_date date, similarity float)
language sql stable as $$
  select id, agency, guide_name, guide_version, section_id, section_title, content, source_url, effective_date, 1 - (embedding <=> query_embedding) as similarity
  from public.guideline_chunks
  where agency_filter is null or agency = agency_filter
  order by embedding <=> query_embedding
  limit match_count;
$$;
