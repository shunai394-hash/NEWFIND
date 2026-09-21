-- Marketplace Discovery Layer (NEWFIND first implementation).
-- Additive only. Does not alter products, discovery_products, leads, or AI resident rows.
-- PriceSense can implement the same tables independently; databases stay separate.

create table if not exists public.marketplace_products (
  id uuid primary key default gen_random_uuid(),
  identity_key text not null unique,
  marketplace text not null,
  external_product_id text not null,
  title text not null,
  brand text,
  category text,
  url text not null,
  image_url text,
  gtin text,
  sku text,
  asin text,
  epid text,
  correspondent_id text,
  discovery_product_id text references public.discovery_products (id) on delete set null,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_products_marketplace_idx
  on public.marketplace_products (marketplace, last_seen_at desc);

create index if not exists marketplace_products_discovery_idx
  on public.marketplace_products (discovery_product_id)
  where discovery_product_id is not null;

create table if not exists public.marketplace_observations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products (id) on delete cascade,
  marketplace text not null,
  external_product_id text,
  title text,
  url text,
  image_url text,
  price numeric,
  currency text,
  seller_name text,
  seller_type text,
  availability text,
  source_type text,
  source_confidence integer,
  sold_count numeric,
  transaction_signal text,
  listing_count integer,
  review_count integer,
  rating numeric,
  popularity_rank integer,
  observed_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_observations_product_idx
  on public.marketplace_observations (product_id, observed_at desc);

create table if not exists public.product_evaluations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products (id) on delete cascade,
  correspondent_id text,
  decision text not null,
  product_score integer not null default 0,
  scores jsonb not null default '{}'::jsonb,
  discovery_reason text not null default '',
  demand_reason text not null default '',
  price_reason text not null default '',
  why_now text not null default '',
  recommended_action text not null default '',
  confidence integer not null default 0,
  facts jsonb not null default '[]'::jsonb,
  hypotheses jsonb not null default '[]'::jsonb,
  risk_flags text[] not null default '{}',
  drop_reason text,
  human_review text not null default 'pending_human',
  pricesense_qualification jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_evaluations_correspondent_idx
  on public.product_evaluations (correspondent_id, created_at desc);

create index if not exists product_evaluations_decision_idx
  on public.product_evaluations (decision);

create table if not exists public.supplier_research_runs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products (id) on delete cascade,
  identity_key text not null,
  reused boolean not null default false,
  valid_until timestamptz,
  comparison jsonb not null default '[]'::jsonb,
  margin jsonb,
  facts jsonb not null default '[]'::jsonb,
  hypotheses jsonb not null default '[]'::jsonb,
  recommended_action text not null default '',
  human_review text not null default 'pending_human',
  unavailable_reason text,
  created_at timestamptz not null default now()
);

create index if not exists supplier_research_runs_identity_idx
  on public.supplier_research_runs (identity_key, created_at desc);

create table if not exists public.supplier_candidates (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references public.supplier_research_runs (id) on delete cascade,
  product_id uuid not null references public.marketplace_products (id) on delete cascade,
  supplier_name text not null,
  official_url text,
  product_url text,
  supplier_type text not null,
  country text,
  brand text,
  product_name text,
  product_match_confidence integer not null default 0,
  unit_price numeric,
  currency text,
  price_min numeric,
  price_max numeric,
  price_breaks jsonb not null default '[]'::jsonb,
  reference_retail_price numeric,
  reference_retail_currency text,
  moq integer,
  wholesale_available boolean,
  bulk_discount boolean,
  sample_available boolean,
  stock_status text,
  supply_continuity text,
  lead_time text,
  restock_information text,
  ships_to_japan boolean,
  shipping_cost numeric,
  shipping_method text,
  estimated_delivery text,
  payment_methods text[],
  account_required boolean,
  wholesale_application_required boolean,
  contact_url text,
  contact_email text,
  authorized_status text,
  brand_authorization_evidence text,
  risk_flags text[] not null default '{}',
  source_url text,
  source_name text,
  evidence_text text,
  observed_at timestamptz,
  confidence integer not null default 0,
  valid_until timestamptz,
  facts jsonb not null default '[]'::jsonb,
  hypotheses jsonb not null default '[]'::jsonb,
  recommended_action text not null default '',
  marketplace_seller boolean not null default false,
  scores jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists supplier_candidates_product_idx
  on public.supplier_candidates (product_id, created_at desc);

create table if not exists public.supplier_inquiry_drafts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.marketplace_products (id) on delete cascade,
  research_run_id uuid references public.supplier_research_runs (id) on delete set null,
  supplier_name text not null,
  official_url text,
  contact_url text,
  product_name text,
  brand text,
  subject text not null,
  body text not null,
  send_status text not null default 'pending_human',
  created_at timestamptz not null default now()
);

create table if not exists public.correspondent_learning (
  id uuid primary key default gen_random_uuid(),
  correspondent_id text not null,
  query text,
  marketplace text,
  identity_key text,
  candidate_title text,
  decision text,
  confidence integer,
  human_feedback text,
  actual_result text,
  rejection_reason text,
  supplier_result text,
  eventual_sales_signal text,
  created_at timestamptz not null default now()
);

create index if not exists correspondent_learning_agent_idx
  on public.correspondent_learning (correspondent_id, created_at desc);

alter table public.marketplace_products enable row level security;
alter table public.marketplace_observations enable row level security;
alter table public.product_evaluations enable row level security;
alter table public.supplier_research_runs enable row level security;
alter table public.supplier_candidates enable row level security;
alter table public.supplier_inquiry_drafts enable row level security;
alter table public.correspondent_learning enable row level security;

grant select, insert, update, delete on table public.marketplace_products to service_role;
grant select, insert, update, delete on table public.marketplace_observations to service_role;
grant select, insert, update, delete on table public.product_evaluations to service_role;
grant select, insert, update, delete on table public.supplier_research_runs to service_role;
grant select, insert, update, delete on table public.supplier_candidates to service_role;
grant select, insert, update, delete on table public.supplier_inquiry_drafts to service_role;
grant select, insert, update, delete on table public.correspondent_learning to service_role;

-- Public read of marketplace facts for approved discovery products only.
drop policy if exists marketplace_products_read on public.marketplace_products;
create policy marketplace_products_read on public.marketplace_products
  for select using (
    discovery_product_id is not null
    and exists (
      select 1 from public.discovery_products p
      where p.id = discovery_product_id and p.status = 'approved'
    )
  );

drop policy if exists marketplace_observations_read on public.marketplace_observations;
create policy marketplace_observations_read on public.marketplace_observations
  for select using (
    exists (
      select 1 from public.marketplace_products mp
      join public.discovery_products p on p.id = mp.discovery_product_id
      where mp.id = product_id and p.status = 'approved'
    )
  );

drop policy if exists product_evaluations_read on public.product_evaluations;
create policy product_evaluations_read on public.product_evaluations
  for select using (
    exists (
      select 1 from public.marketplace_products mp
      join public.discovery_products p on p.id = mp.discovery_product_id
      where mp.id = product_id and p.status = 'approved'
    )
  );

drop policy if exists supplier_candidates_read on public.supplier_candidates;
create policy supplier_candidates_read on public.supplier_candidates
  for select using (
    exists (
      select 1 from public.marketplace_products mp
      join public.discovery_products p on p.id = mp.discovery_product_id
      where mp.id = product_id and p.status = 'approved'
    )
  );

grant select on public.marketplace_products to anon, authenticated;
grant select on public.marketplace_observations to anon, authenticated;
grant select on public.product_evaluations to anon, authenticated;
grant select on public.supplier_candidates to anon, authenticated;
