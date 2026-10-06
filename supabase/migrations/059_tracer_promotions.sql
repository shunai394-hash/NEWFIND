-- Dedicated TRACER -> NEWFIND promotion ledger.
-- Keeps integration state separate from discovery_products so promotion,
-- deduplication, withdrawal, and AI-post linkage are auditable.

create table if not exists public.tracer_promotions (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  tracer_listing_id text not null,
  tracer_product_id text,
  discovery_product_id uuid references public.discovery_products(id) on delete set null,
  ai_post_id uuid references public.ai_posts(id) on delete set null,

  product_url text not null,
  product_name text not null,
  image_url text,
  price numeric,
  currency text not null default 'JPY',

  sales_test_gate text not null default 'passed'
    check (sales_test_gate = 'passed'),
  tracer_published boolean not null default true,
  status text not null default 'promoted'
    check (status in ('promoted', 'withdrawn', 'rejected')),

  first_received_at timestamptz not null default now(),
  last_received_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists tracer_promotions_event_id_uidx
  on public.tracer_promotions(event_id);

create unique index if not exists tracer_promotions_listing_id_uidx
  on public.tracer_promotions(tracer_listing_id);

create index if not exists tracer_promotions_status_idx
  on public.tracer_promotions(status);

create index if not exists tracer_promotions_discovery_product_idx
  on public.tracer_promotions(discovery_product_id);

create index if not exists tracer_promotions_ai_post_idx
  on public.tracer_promotions(ai_post_id);

alter table public.tracer_promotions enable row level security;

-- Public users never write this ledger. Service-role integration code owns it.
drop policy if exists tracer_promotions_public_read on public.tracer_promotions;
create policy tracer_promotions_public_read on public.tracer_promotions
  for select using (status = 'promoted');

grant select on public.tracer_promotions to anon, authenticated;
