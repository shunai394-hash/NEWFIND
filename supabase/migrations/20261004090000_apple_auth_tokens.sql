-- Sign in with Apple refresh tokens, kept so account deletion can revoke the
-- user's authorization (App Review Guideline 5.1.1(v), Apple TN3194).
--
-- Tokens are encrypted by the server (AES-256-GCM, lib/apple/token-store.ts)
-- before they are written here. Row level security is enabled with no
-- policies, so only the service role can read or write this table; clients
-- (anon / authenticated) have no access at all.
-- Additive: no existing table or row is changed.

create table if not exists public.apple_auth_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  apple_user_id text not null,
  -- The Sign in with Apple client the token was issued to: the iOS bundle id
  -- for native sign-in, the Services ID for the web flow. Revocation must use
  -- the same client_id.
  client_id text not null,
  refresh_token_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, apple_user_id, client_id)
);

alter table public.apple_auth_tokens enable row level security;

revoke all on table public.apple_auth_tokens from anon, authenticated;
grant select, insert, update, delete on table public.apple_auth_tokens to service_role;
