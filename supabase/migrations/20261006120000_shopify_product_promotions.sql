create table if not exists public.shopify_product_promotions (
  id uuid primary key default gen_random_uuid(),
  shop_domain text not null,
  shopify_product_id text not null,
  title text not null,
  description text,
  handle text,
  vendor text,
  product_type text,
  tags text[] not null default '{}',
  image_url text,
  product_url text,
  price_min numeric(12, 2),
  price_max numeric(12, 2),
  source_updated_at timestamptz,
  source_status text not null default 'unknown',
  published_to_store boolean not null default false,
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review', 'approved', 'published', 'blocked', 'rejected')),
  block_reason text,
  last_webhook_topic text,
  last_webhook_at timestamptz not null default now(),
  payload_version integer not null default 1,
  editorial_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_domain, shopify_product_id),
  check (price_min is null or price_min >= 0),
  check (price_max is null or price_max >= 0),
  check (price_min is null or price_max is null or price_max >= price_min)
);

create index if not exists shopify_product_promotions_review_idx
  on public.shopify_product_promotions (review_status, last_webhook_at desc);
create index if not exists shopify_product_promotions_updated_idx
  on public.shopify_product_promotions (source_updated_at desc);

create or replace function public.set_shopify_product_promotions_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shopify_product_promotions_updated_at
  on public.shopify_product_promotions;
create trigger shopify_product_promotions_updated_at
  before update on public.shopify_product_promotions
  for each row execute function public.set_shopify_product_promotions_updated_at();

alter table public.shopify_product_promotions enable row level security;
revoke all on public.shopify_product_promotions from anon, authenticated;
grant all on public.shopify_product_promotions to service_role;

comment on table public.shopify_product_promotions is
  'Private Shopify product intake queue for NEWFIND editorial review. Webhooks never publish directly to public timelines.';
