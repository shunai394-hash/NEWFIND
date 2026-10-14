-- TRACER promotion ledger.
-- The integration handler uses this table as its idempotency and withdrawal record.
create table if not exists public.tracer_promotions (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  tracer_listing_id text not null,
  tracer_product_id text,
  discovery_product_id uuid not null,
  product_url text not null,
  product_name text not null,
  image_url text,
  price numeric(12,2),
  currency text not null default 'JPY',
  sales_test_gate text not null check (sales_test_gate = 'passed'),
  tracer_published boolean not null default false check (tracer_published = true),
  status text not null default 'promoted' check (status in ('promoted','withdrawn')),
  ai_post_id uuid,
  withdrawn_at timestamptz,
  last_received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracer_promotions_event_id_key unique (event_id),
  constraint tracer_promotions_listing_id_key unique (tracer_listing_id)
);

create index if not exists tracer_promotions_status_idx
  on public.tracer_promotions (status, last_received_at desc);
create index if not exists tracer_promotions_product_url_idx
  on public.tracer_promotions (product_url);

alter table public.tracer_promotions enable row level security;
grant all on public.tracer_promotions to service_role;
