-- AI Control Tower + World Scout: additive monitoring, activity log, and
-- discovery candidate fields. Does not drop existing tables or rewrite rows.

-- ---------------------------------------------------------------------------
-- Engine control (singleton) + run history + activity log
-- ---------------------------------------------------------------------------

create table if not exists public.ai_engine_control (
  id integer primary key default 1 check (id = 1),
  paused boolean not null default false,
  paused_at timestamptz,
  paused_reason text not null default '',
  running_since timestamptz,
  running_run_id uuid,
  last_error text,
  last_error_kind text,
  last_error_at timestamptz,
  consecutive_failures integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.ai_engine_control (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.ai_engine_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'ai_engine'
    check (run_type in ('ai_engine', 'world_scout', 'product_hunter', 'retry')),
  status text not null default 'running'
    check (status in ('running', 'success', 'failed', 'no_action', 'skipped')),
  triggered_by text not null default 'cron'
    check (triggered_by in ('cron', 'admin', 'retry')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text,
  error_kind text,
  result_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_engine_runs_started_idx
  on public.ai_engine_runs (started_at desc);

create index if not exists ai_engine_runs_type_started_idx
  on public.ai_engine_runs (run_type, started_at desc);

create index if not exists ai_engine_runs_triggered_idx
  on public.ai_engine_runs (triggered_by, started_at desc);

create table if not exists public.ai_activity_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  persona_id uuid references public.ai_personas(id) on delete set null,
  actor_name text not null default '',
  actor_role text not null default '',
  action text not null default 'note',
  detail text not null default '',
  related_product_id text,
  related_run_id uuid references public.ai_engine_runs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_activity_logs_occurred_idx
  on public.ai_activity_logs (occurred_at desc);

create index if not exists ai_activity_logs_persona_idx
  on public.ai_activity_logs (persona_id, occurred_at desc);

create index if not exists ai_activity_logs_action_idx
  on public.ai_activity_logs (action, occurred_at desc);

alter table public.ai_engine_control enable row level security;
alter table public.ai_engine_runs enable row level security;
alter table public.ai_activity_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Discovery: candidate / verification / scout source fields
-- Reuses discovery_products + discovery_sources instead of a new candidates table.
-- ---------------------------------------------------------------------------

alter table public.discovery_products
  add column if not exists duplicate_key text;

alter table public.discovery_products
  add column if not exists verification_score integer;

alter table public.discovery_products
  add column if not exists assigned_resident_id uuid
    references public.ai_personas(id) on delete set null;

alter table public.discovery_products
  add column if not exists scout_beat text;

alter table public.discovery_products
  add column if not exists source_count integer not null default 1;

alter table public.discovery_products
  add column if not exists signal_strength integer not null default 0;

alter table public.discovery_products
  add column if not exists trend_signal text;

alter table public.discovery_products
  add column if not exists recent_growth numeric;

alter table public.discovery_products
  add column if not exists first_seen_at timestamptz;

create unique index if not exists discovery_products_duplicate_key_uidx
  on public.discovery_products (duplicate_key)
  where duplicate_key is not null and duplicate_key <> '';

create index if not exists discovery_products_assigned_idx
  on public.discovery_products (assigned_resident_id)
  where assigned_resident_id is not null;

create index if not exists discovery_products_scout_beat_idx
  on public.discovery_products (scout_beat)
  where scout_beat is not null and scout_beat <> '';

alter table public.discovery_sources
  add column if not exists scout_id uuid
    references public.ai_personas(id) on delete set null;

alter table public.discovery_sources
  add column if not exists source_name text;

create index if not exists discovery_sources_scout_idx
  on public.discovery_sources (scout_id)
  where scout_id is not null;

create unique index if not exists discovery_sources_product_url_scout_uidx
  on public.discovery_sources (product_id, source_url, scout_id)
  where scout_id is not null;
