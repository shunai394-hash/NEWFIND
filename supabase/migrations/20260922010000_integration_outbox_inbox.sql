-- TRACER ↔ NEWFIND integration outbox / inbox / failure log.
-- Additive only. Does not alter auth, posts, AI residents, or discovery core tables.
-- RLS stays enabled; clients get no write access.

create table if not exists public.integration_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  destination text not null default 'tracer',
  event_type text not null,
  event_version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'delivered', 'failed', 'dead')),
  attempts integer not null default 0,
  next_retry_at timestamptz,
  last_error text,
  causation_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  unique (destination, event_id)
);

create index if not exists integration_outbox_drain_idx
  on public.integration_outbox (status, next_retry_at nulls first, created_at)
  where status in ('pending', 'failed');

create index if not exists integration_outbox_type_idx
  on public.integration_outbox (event_type, created_at desc);

create table if not exists public.integration_inbox (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_id text not null,
  event_type text not null,
  event_version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received', 'processing', 'processed', 'rejected', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  unique (source, event_id)
);

create index if not exists integration_inbox_status_idx
  on public.integration_inbox (status, received_at desc);

create index if not exists integration_inbox_type_idx
  on public.integration_inbox (event_type, received_at desc);

create table if not exists public.integration_failures (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  source text,
  destination text,
  event_type text not null,
  attempt integer not null default 1,
  http_status integer,
  error_code text,
  error_message text,
  response_body text,
  created_at timestamptz not null default now()
);

create index if not exists integration_failures_event_idx
  on public.integration_failures (event_id, created_at desc);

create index if not exists integration_failures_created_idx
  on public.integration_failures (created_at desc);

alter table public.integration_outbox enable row level security;
alter table public.integration_inbox enable row level security;
alter table public.integration_failures enable row level security;

drop policy if exists integration_outbox_select on public.integration_outbox;
create policy integration_outbox_select on public.integration_outbox
  for select to authenticated using (true);

drop policy if exists integration_inbox_select on public.integration_inbox;
create policy integration_inbox_select on public.integration_inbox
  for select to authenticated using (true);

drop policy if exists integration_failures_select on public.integration_failures;
create policy integration_failures_select on public.integration_failures
  for select to authenticated using (true);

grant select on table public.integration_outbox to authenticated;
grant select on table public.integration_inbox to authenticated;
grant select on table public.integration_failures to authenticated;

grant all privileges on table public.integration_outbox to service_role;
grant all privileges on table public.integration_inbox to service_role;
grant all privileges on table public.integration_failures to service_role;
