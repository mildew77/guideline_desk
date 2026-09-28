-- A deliberately narrow RPC endpoint for the scheduled AWS Lambda health query.
-- It confirms that Postgres can read the library without exposing any guideline text.
create or replace function public.guideline_desk_keepalive()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
  perform count(*) from public.guideline_chunks;
  return now();
end;
$$;

revoke all on function public.guideline_desk_keepalive() from public;
grant execute on function public.guideline_desk_keepalive() to anon, authenticated;
