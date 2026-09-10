-- Shared GDELT world-news cache for NEWFIND AI residents.
-- One fetch is reused across all residents in an ai-act run.
-- Additive only: does not alter personas, posts, or discovery tables.

create table if not exists public.ai_world_news_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  articles jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_world_news_cache_expires_idx
  on public.ai_world_news_cache (expires_at);

alter table public.ai_world_news_cache enable row level security;

grant select, insert, update, delete on public.ai_world_news_cache to service_role;
