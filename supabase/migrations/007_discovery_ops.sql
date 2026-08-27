-- NEWFIND Phase 1: Discovery ops columns + admin write RLS
-- Does not drop users, posts, or existing discovery tables.

alter table public.discovery_products
  add column if not exists discovered_at timestamptz;

alter table public.discovery_products
  add column if not exists attention_reason text not null default '';

grant select, insert, update, delete on table
  public.discovery_products,
  public.discovery_sources,
  public.discovery_product_people,
  public.discovery_product_sales,
  public.discovery_product_tags
  to authenticated;

drop policy if exists discovery_products_admin_write on public.discovery_products;
create policy discovery_products_admin_write on public.discovery_products
  for all
  using (public.is_discovery_admin())
  with check (public.is_discovery_admin());

drop policy if exists discovery_sources_admin_write on public.discovery_sources;
create policy discovery_sources_admin_write on public.discovery_sources
  for all
  using (public.is_discovery_admin())
  with check (public.is_discovery_admin());

drop policy if exists discovery_people_admin_write on public.discovery_product_people;
create policy discovery_people_admin_write on public.discovery_product_people
  for all
  using (public.is_discovery_admin())
  with check (public.is_discovery_admin());

drop policy if exists discovery_sales_admin_write on public.discovery_product_sales;
create policy discovery_sales_admin_write on public.discovery_product_sales
  for all
  using (public.is_discovery_admin())
  with check (public.is_discovery_admin());

drop policy if exists discovery_tags_admin_write on public.discovery_product_tags;
create policy discovery_tags_admin_write on public.discovery_product_tags
  for all
  using (public.is_discovery_admin())
  with check (public.is_discovery_admin());
