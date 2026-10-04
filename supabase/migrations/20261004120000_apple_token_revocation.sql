-- Store Sign in with Apple refresh tokens server-side so account deletion can revoke them.
-- Provider tokens must not be readable by anon/authenticated clients.
create table if not exists public.apple_identities (
  apple_user_id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  is_private_email boolean not null default false,
  refresh_token text,
  client_id text,
  updated_at timestamptz not null default now()
);

alter table public.apple_identities
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists email text,
  add column if not exists is_private_email boolean not null default false,
  add column if not exists refresh_token text,
  add column if not exists client_id text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists apple_identities_apple_user_id_uidx
  on public.apple_identities (apple_user_id);

alter table public.apple_identities enable row level security;
revoke all on table public.apple_identities from anon, authenticated;
grant all on table public.apple_identities to service_role;

alter table public.profiles
  add column if not exists apple_user_id text;
