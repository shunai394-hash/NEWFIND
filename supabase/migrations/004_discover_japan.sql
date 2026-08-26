-- NEWFIND: Discover Japan metadata + Apple identity mapping
-- Additive only. Does not delete users, posts, or auth data.

alter table public.profiles
  add column if not exists apple_user_id text;

create unique index if not exists profiles_apple_user_id_uidx
  on public.profiles (apple_user_id)
  where apple_user_id is not null;

alter table public.posts
  add column if not exists japan_context text,
  add column if not exists visual_kind text,
  add column if not exists featured_person text,
  add column if not exists featured_credit text;

create table if not exists public.apple_identities (
  apple_user_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  is_private_email boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apple_identities_user_id_idx
  on public.apple_identities (user_id);

alter table public.apple_identities enable row level security;

-- Service role writes identities during Apple login. Authenticated users can
-- read only their own mapping; nobody else can insert from the client.
drop policy if exists apple_identities_read_own on public.apple_identities;
create policy apple_identities_read_own on public.apple_identities
  for select using (auth.uid() = user_id);

grant select on table public.apple_identities to authenticated;
