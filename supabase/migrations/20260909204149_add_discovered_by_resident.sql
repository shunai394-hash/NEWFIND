-- NEWFIND: preserve which AI resident discovered a Discovery product.
-- Existing products remain valid with NULL.

alter table public.discovery_products
  add column if not exists discovered_by_resident_id uuid;

create index if not exists discovery_products_discovered_by_resident_idx
  on public.discovery_products (discovered_by_resident_id);
