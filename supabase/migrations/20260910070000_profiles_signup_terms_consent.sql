-- Signup-only terms consent (Apple App Review).
-- Additive columns. Existing login is not gated by these values.
-- Existing rows are marked terms_version = 'legacy' so they are never
-- treated as pending new-account consent.

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

alter table public.profiles
  add column if not exists terms_version text not null default '';

update public.profiles
set terms_version = 'legacy'
where terms_accepted_at is null
  and terms_version = '';
