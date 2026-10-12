-- Cache for the gear-search edge function.
-- Row level security is on with no policies, so only the service role (the edge function) can read or write it.
create table if not exists public.gear_search_cache (
  key        text primary key,
  results    jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.gear_search_cache enable row level security;

create index if not exists gear_search_cache_created_at_idx on public.gear_search_cache (created_at);
