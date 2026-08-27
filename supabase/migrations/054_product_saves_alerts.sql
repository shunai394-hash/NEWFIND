-- NEWFIND: product saves + alert/notification foundation.
-- Additive only. Does not repair, rewrite, rename, or delete migrations 009-053.

create table if not exists public.discovery_product_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists discovery_product_saves_user_idx
  on public.discovery_product_saves (user_id, created_at desc);

create index if not exists discovery_product_saves_product_idx
  on public.discovery_product_saves (product_id);

create table if not exists public.user_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  alert_type text not null check (alert_type in (
    'hot',
    'trending',
    'new_product',
    'price_change',
    'celebrity',
    'japan_gap'
  )),
  product_id text,
  brand text,
  person_name text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    product_id is not null
    or coalesce(brand, '') <> ''
    or coalesce(person_name, '') <> ''
  )
);

create unique index if not exists user_alerts_unique_scope
  on public.user_alerts (
    user_id,
    alert_type,
    coalesce(product_id, ''),
    coalesce(lower(brand), ''),
    coalesce(lower(person_name), '')
  );

create index if not exists user_alerts_user_idx
  on public.user_alerts (user_id, alert_type);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  product_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.discovery_product_saves enable row level security;
alter table public.user_alerts enable row level security;
alter table public.notifications enable row level security;

drop policy if exists discovery_product_saves_select_own on public.discovery_product_saves;
create policy discovery_product_saves_select_own on public.discovery_product_saves
  for select using (auth.uid() = user_id);

drop policy if exists discovery_product_saves_insert_own on public.discovery_product_saves;
create policy discovery_product_saves_insert_own on public.discovery_product_saves
  for insert with check (auth.uid() = user_id);

drop policy if exists discovery_product_saves_delete_own on public.discovery_product_saves;
create policy discovery_product_saves_delete_own on public.discovery_product_saves
  for delete using (auth.uid() = user_id);

drop policy if exists user_alerts_select_own on public.user_alerts;
create policy user_alerts_select_own on public.user_alerts
  for select using (auth.uid() = user_id);

drop policy if exists user_alerts_insert_own on public.user_alerts;
create policy user_alerts_insert_own on public.user_alerts
  for insert with check (auth.uid() = user_id);

drop policy if exists user_alerts_update_own on public.user_alerts;
create policy user_alerts_update_own on public.user_alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_alerts_delete_own on public.user_alerts;
create policy user_alerts_delete_own on public.user_alerts
  for delete using (auth.uid() = user_id);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.discovery_products to service_role;
grant select, insert, delete on public.discovery_product_saves to authenticated, service_role;
grant select, insert, update, delete on public.user_alerts to authenticated, service_role;
grant select, insert, update on public.notifications to authenticated, service_role;
