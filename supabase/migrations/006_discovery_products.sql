-- NEWFIND Phase 1 discovery products (additive).
-- Does not drop or alter existing users, posts, or auth rows.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create table if not exists public.discovery_products (
  id text primary key,
  brand text not null,
  product_name text not null,
  category text not null default 'other',
  subcategory text not null default '',
  country text,
  description text not null default '',
  product_image_url text,
  product_url text,
  official_url text,
  price numeric,
  currency text not null default 'JPY',
  sku text,
  trend_score integer not null default 0,
  confidence_score integer not null default 0,
  discovery_source text,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected')),
  normalized_brand text not null default '',
  normalized_product_name text not null default '',
  person_image_policy text not null default 'none'
    check (person_image_policy in ('none', 'licensed', 'official', 'system_avatar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discovery_products_status_idx
  on public.discovery_products (status);

create index if not exists discovery_products_trend_idx
  on public.discovery_products (trend_score desc);

create index if not exists discovery_products_normalized_idx
  on public.discovery_products (normalized_brand, normalized_product_name);

create unique index if not exists discovery_products_product_url_uidx
  on public.discovery_products (product_url)
  where product_url is not null and product_url <> '';

create unique index if not exists discovery_products_official_url_uidx
  on public.discovery_products (official_url)
  where official_url is not null and official_url <> '';

create table if not exists public.discovery_sources (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.discovery_products (id) on delete cascade,
  source_type text not null default 'other',
  source_url text not null,
  source_title text not null default '',
  source_domain text,
  published_at date,
  source_excerpt text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'rejected')),
  source_tier integer not null default 4 check (source_tier between 1 and 4),
  created_at timestamptz not null default now()
);

create index if not exists discovery_sources_product_id_idx
  on public.discovery_sources (product_id);

create table if not exists public.discovery_product_people (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.discovery_products (id) on delete cascade,
  person_name text not null,
  person_type text not null default 'other'
    check (person_type in (
      'celebrity', 'athlete', 'creator', 'influencer', 'artist', 'public_figure', 'other'
    )),
  person_url text,
  person_image_url text,
  relation text not null default 'unknown'
    check (relation in (
      'worn', 'used', 'recommended', 'mentioned', 'featured',
      'spotted_wearing', 'featured_in', 'owned', 'unknown'
    )),
  source_id uuid references public.discovery_sources (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists discovery_product_people_product_id_idx
  on public.discovery_product_people (product_id);

create table if not exists public.discovery_product_sales (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.discovery_products (id) on delete cascade,
  seller_name text not null,
  product_url text not null,
  price numeric,
  currency text,
  availability text not null default 'unknown'
    check (availability in ('in_stock', 'out_of_stock', 'unknown')),
  official_store boolean not null default false,
  seller_kind text not null default 'retailer'
    check (seller_kind in ('official', 'authorized', 'retailer', 'marketplace')),
  affiliate_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists discovery_product_sales_product_id_idx
  on public.discovery_product_sales (product_id);

create table if not exists public.discovery_product_tags (
  product_id text not null references public.discovery_products (id) on delete cascade,
  tag text not null,
  primary key (product_id, tag)
);

alter table public.posts
  add column if not exists discovery_product_id text
    references public.discovery_products (id) on delete set null;

create index if not exists posts_discovery_product_id_idx
  on public.posts (discovery_product_id);

create or replace function public.is_discovery_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

alter table public.discovery_products enable row level security;
alter table public.discovery_sources enable row level security;
alter table public.discovery_product_people enable row level security;
alter table public.discovery_product_sales enable row level security;
alter table public.discovery_product_tags enable row level security;

drop policy if exists discovery_products_read on public.discovery_products;
create policy discovery_products_read on public.discovery_products
  for select using (status = 'approved' or public.is_discovery_admin());

drop policy if exists discovery_sources_read on public.discovery_sources;
create policy discovery_sources_read on public.discovery_sources
  for select using (
    public.is_discovery_admin()
    or exists (
      select 1 from public.discovery_products p
      where p.id = product_id and p.status = 'approved'
    )
  );

drop policy if exists discovery_people_read on public.discovery_product_people;
create policy discovery_people_read on public.discovery_product_people
  for select using (
    public.is_discovery_admin()
    or exists (
      select 1 from public.discovery_products p
      where p.id = product_id and p.status = 'approved'
    )
  );

drop policy if exists discovery_sales_read on public.discovery_product_sales;
create policy discovery_sales_read on public.discovery_product_sales
  for select using (
    public.is_discovery_admin()
    or exists (
      select 1 from public.discovery_products p
      where p.id = product_id and p.status = 'approved'
    )
  );

drop policy if exists discovery_tags_read on public.discovery_product_tags;
create policy discovery_tags_read on public.discovery_product_tags
  for select using (
    public.is_discovery_admin()
    or exists (
      select 1 from public.discovery_products p
      where p.id = product_id and p.status = 'approved'
    )
  );

grant select on public.discovery_products to anon, authenticated;
grant select on public.discovery_sources to anon, authenticated;
grant select on public.discovery_product_people to anon, authenticated;
grant select on public.discovery_product_sales to anon, authenticated;
grant select on public.discovery_product_tags to anon, authenticated;
grant execute on function public.is_discovery_admin() to anon, authenticated;
