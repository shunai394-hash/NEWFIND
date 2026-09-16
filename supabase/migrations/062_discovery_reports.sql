-- Additive discovery identity + report fields.
-- Safe to apply more than once. Does not rewrite existing rows.

alter table public.discovery_products
  add column if not exists gtin text;

alter table public.discovery_products
  add column if not exists model_number text;

alter table public.discovery_products
  add column if not exists launch_date text;

alter table public.discovery_products
  add column if not exists canonical_url text;

alter table public.discovery_products
  add column if not exists discovery_report jsonb;

create index if not exists discovery_products_gtin_idx
  on public.discovery_products (gtin)
  where gtin is not null and gtin <> '';

create index if not exists discovery_products_model_idx
  on public.discovery_products (normalized_brand, model_number)
  where model_number is not null and model_number <> '';
