-- NEWFIND product catalog (additive).
-- Does not drop or alter existing users, posts, or auth tables.

create table if not exists public.products (
  id text primary key,
  name text not null,
  brand text not null,
  collections text[] not null default '{}',
  subcategory text not null default '',
  subcategory_label text not null default '',
  description text not null default '',
  scent_notes text,
  image_url text,
  accent text not null default '#f4f1ea',
  celebrity_name text,
  celebrity_relation text,
  source_url text not null,
  source_title text not null,
  source_kind text not null default 'brand_official',
  purchase_url text not null,
  purchase_label text not null default '販売サイトへ',
  seller text,
  price_text text,
  popularity_score integer not null default 0,
  published_at date,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_popularity_idx
  on public.products (popularity_score desc);

create index if not exists products_published_at_idx
  on public.products (published_at desc);

create table if not exists public.product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  url text not null,
  title text not null,
  kind text not null default 'magazine',
  created_at timestamptz not null default now()
);

create index if not exists product_sources_product_id_idx
  on public.product_sources (product_id);

create table if not exists public.product_links (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  url text not null,
  label text not null default '販売サイトへ',
  seller text,
  kind text not null default 'purchase',
  created_at timestamptz not null default now()
);

create index if not exists product_links_product_id_idx
  on public.product_links (product_id);

create table if not exists public.product_celebrities (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  celebrity_name text not null,
  relation text not null,
  created_at timestamptz not null default now()
);

create index if not exists product_celebrities_product_id_idx
  on public.product_celebrities (product_id);

create table if not exists public.product_categories (
  product_id text not null references public.products (id) on delete cascade,
  collection text not null,
  primary key (product_id, collection)
);

alter table public.products enable row level security;
alter table public.product_sources enable row level security;
alter table public.product_links enable row level security;
alter table public.product_celebrities enable row level security;
alter table public.product_categories enable row level security;

drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (true);

drop policy if exists product_sources_read on public.product_sources;
create policy product_sources_read on public.product_sources for select using (true);

drop policy if exists product_links_read on public.product_links;
create policy product_links_read on public.product_links for select using (true);

drop policy if exists product_celebrities_read on public.product_celebrities;
create policy product_celebrities_read on public.product_celebrities for select using (true);

drop policy if exists product_categories_read on public.product_categories;
create policy product_categories_read on public.product_categories for select using (true);

grant select on public.products to anon, authenticated;
grant select on public.product_sources to anon, authenticated;
grant select on public.product_links to anon, authenticated;
grant select on public.product_celebrities to anon, authenticated;
grant select on public.product_categories to anon, authenticated;
