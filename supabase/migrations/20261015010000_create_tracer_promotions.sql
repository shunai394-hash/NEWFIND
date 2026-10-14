-- Idempotent ledger for inbound TRACER promotions and their NEWFIND feed posts.
create table if not exists public.tracer_promotions (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  tracer_listing_id text not null unique,
  tracer_product_id text,
  discovery_product_id text not null,
  ai_post_id text,
  product_url text not null,
  product_name text not null,
  image_url text,
  price numeric,
  currency text not null default 'JPY',
  sales_test_gate text not null default 'passed',
  tracer_published boolean not null default false,
  status text not null default 'promoted',
  metadata jsonb not null default '{}'::jsonb,
  withdrawn_at timestamptz,
  last_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tracer_promotions_status_idx
  on public.tracer_promotions (status);
create index if not exists tracer_promotions_discovery_product_idx
  on public.tracer_promotions (discovery_product_id);

alter table public.tracer_promotions enable row level security;
grant all on table public.tracer_promotions to service_role;

comment on table public.tracer_promotions is
  'Idempotency ledger for TRACER-to-NEWFIND product promotion and withdrawal events.';
