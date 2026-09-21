-- NEWFIND living world: comment replies + correspondent investigations.
-- Additive only. Does not drop existing tables, roles, or policies.

-- ---------------------------------------------------------------------------
-- Comments: threaded replies
-- ---------------------------------------------------------------------------
alter table public.comments
  add column if not exists parent_comment_id uuid references public.comments (id) on delete set null;

create index if not exists comments_parent_comment_id_idx
  on public.comments (parent_comment_id, created_at);

-- ---------------------------------------------------------------------------
-- Correspondent investigations
-- DISCOVERY → INVESTIGATING → VERIFIED (or REJECTED / EXPIRED)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_investigations (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.ai_personas (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  status text not null default 'DISCOVERY'
    check (status in ('DISCOVERY', 'INVESTIGATING', 'VERIFIED', 'REJECTED', 'EXPIRED')),
  title text not null,
  summary text,
  beat text,
  city text,
  correspondent_title text,
  source_url text,
  source_title text,
  source_kind text,
  entity_key text,
  product_id uuid,
  post_id uuid,
  comment_id uuid,
  evidence_count integer not null default 0,
  confidence integer not null default 0,
  next_action text,
  metadata jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists ai_investigations_persona_updated_idx
  on public.ai_investigations (persona_id, updated_at desc);

create index if not exists ai_investigations_profile_status_idx
  on public.ai_investigations (profile_id, status, updated_at desc);

create unique index if not exists ai_investigations_open_entity_idx
  on public.ai_investigations (persona_id, entity_key)
  where entity_key is not null
    and status in ('DISCOVERY', 'INVESTIGATING');

alter table public.ai_investigations enable row level security;

drop policy if exists ai_investigations_read on public.ai_investigations;
create policy ai_investigations_read on public.ai_investigations
  for select using (true);

grant select on table public.ai_investigations to anon, authenticated;
grant all privileges on table public.ai_investigations to service_role;
