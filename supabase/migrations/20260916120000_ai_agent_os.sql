-- Shared AI Agent / Research OS (NEWFIND first implementation).
-- Additive only. Does not replace Control Tower, AI personas, or Discovery.
-- Does not merge NEWFIND and PriceSense databases.
--
-- Shared layer: Agent, Mission, Research Run, Source, Finding, Handoff, Memory(history)
-- NEWFIND-specific destination: discovery_products, AI Resident persona
-- PriceSense-specific destination (not stored here): company, contact, lead, sales signal

-- ---------------------------------------------------------------------------
-- Agents (managed workers). Separate from AI Resident personas.
-- World Scouts may link to an existing persona; Growth Agent does not.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null unique,
  name text not null,
  type text not null
    check (type in ('world_scout', 'product_scout', 'trend_scout', 'growth_agent')),
  role text not null default '',
  region text not null default '',
  country_code text,
  beats text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'paused', 'stalled', 'error')),
  capabilities text[] not null default '{}',
  persona_id uuid references public.ai_personas(id) on delete set null,
  home_app text not null default 'newfind'
    check (home_app in ('newfind', 'pricesense')),
  last_run_at timestamptz,
  last_action_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_agents_type_idx
  on public.ai_agents (type);

create index if not exists ai_agents_status_idx
  on public.ai_agents (status);

create index if not exists ai_agents_persona_idx
  on public.ai_agents (persona_id)
  where persona_id is not null;

-- ---------------------------------------------------------------------------
-- Missions (editable later from Control Tower; seeded from code on first insert)
-- ---------------------------------------------------------------------------

create table if not exists public.ai_missions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  region text not null default '',
  country_code text,
  beats text[] not null default '{}',
  objective text not null default '',
  frequency text not null default 'daily',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_missions_agent_idx
  on public.ai_missions (agent_id, is_active);

-- ---------------------------------------------------------------------------
-- Research runs (one exploration). no_action is not failed.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_research_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  mission_id uuid references public.ai_missions(id) on delete set null,
  engine_run_id uuid references public.ai_engine_runs(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'no_action', 'failed')),
  queries_count integer not null default 0,
  sources_checked integer not null default 0,
  findings_count integer not null default 0,
  verified_count integer not null default 0,
  rejected_count integer not null default 0,
  duplicate_count integer not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_research_runs_agent_started_idx
  on public.ai_research_runs (agent_id, started_at desc);

create index if not exists ai_research_runs_started_idx
  on public.ai_research_runs (started_at desc);

create index if not exists ai_research_runs_engine_idx
  on public.ai_research_runs (engine_run_id)
  where engine_run_id is not null;

-- ---------------------------------------------------------------------------
-- Sources checked during a run. Same URL may be seen by multiple agents.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_research_sources (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.ai_research_runs(id) on delete set null,
  agent_id uuid references public.ai_agents(id) on delete set null,
  source_url text not null,
  source_name text,
  source_type text not null default 'other',
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  source_hash text not null,
  title text,
  snippet text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists ai_research_sources_run_hash_uidx
  on public.ai_research_sources (run_id, source_hash)
  where run_id is not null;

create index if not exists ai_research_sources_hash_idx
  on public.ai_research_sources (source_hash);

create index if not exists ai_research_sources_agent_idx
  on public.ai_research_sources (agent_id, discovered_at desc)
  where agent_id is not null;

-- ---------------------------------------------------------------------------
-- Findings: the shared bridge between NEWFIND Discovery and future PriceSense.
-- Unverified / subjective forecasts are not stored as verified facts.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.ai_research_runs(id) on delete set null,
  source_id uuid references public.ai_research_sources(id) on delete set null,
  agent_id uuid references public.ai_agents(id) on delete set null,
  entity_type text not null default 'product'
    check (entity_type in (
      'product', 'brand', 'company', 'person', 'place', 'trend', 'service', 'event'
    )),
  title text not null,
  description text not null default '',
  region text,
  category text,
  first_seen_at timestamptz not null default now(),
  confidence integer not null default 0,
  status text not null default 'needs_review'
    check (status in ('verified', 'rejected', 'duplicate', 'needs_review')),
  verification_status text not null default 'needs_review'
    check (verification_status in ('verified', 'rejected', 'duplicate', 'needs_review')),
  verified_at timestamptz,
  verification_sources text[] not null default '{}',
  verification_reason text,
  destination_app text
    check (destination_app is null or destination_app in ('newfind', 'pricesense')),
  destination_kind text,
  destination_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_findings_run_idx
  on public.ai_findings (run_id, created_at desc);

create index if not exists ai_findings_agent_idx
  on public.ai_findings (agent_id, created_at desc)
  where agent_id is not null;

create index if not exists ai_findings_status_idx
  on public.ai_findings (status);

create index if not exists ai_findings_destination_idx
  on public.ai_findings (destination_kind, destination_id)
  where destination_id is not null;

-- ---------------------------------------------------------------------------
-- Handoffs: Agent → Agent / Resident / future PriceSense
-- ---------------------------------------------------------------------------

create table if not exists public.ai_handoffs (
  id uuid primary key default gen_random_uuid(),
  from_agent_id uuid references public.ai_agents(id) on delete set null,
  to_agent_id uuid references public.ai_agents(id) on delete set null,
  to_persona_id uuid references public.ai_personas(id) on delete set null,
  finding_id uuid references public.ai_findings(id) on delete set null,
  reason text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_handoffs_from_idx
  on public.ai_handoffs (from_agent_id, created_at desc);

create index if not exists ai_handoffs_status_idx
  on public.ai_handoffs (status, created_at desc);

create index if not exists ai_handoffs_finding_idx
  on public.ai_handoffs (finding_id)
  where finding_id is not null;

alter table public.ai_agents enable row level security;
alter table public.ai_missions enable row level security;
alter table public.ai_research_runs enable row level security;
alter table public.ai_research_sources enable row level security;
alter table public.ai_findings enable row level security;
alter table public.ai_handoffs enable row level security;

grant select, insert, update, delete on table public.ai_agents to service_role;
grant select, insert, update, delete on table public.ai_missions to service_role;
grant select, insert, update, delete on table public.ai_research_runs to service_role;
grant select, insert, update, delete on table public.ai_research_sources to service_role;
grant select, insert, update, delete on table public.ai_findings to service_role;
grant select, insert, update, delete on table public.ai_handoffs to service_role;
