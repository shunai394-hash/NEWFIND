-- Comments/replies currently only support text (001_init.sql: body text not
-- null, no media columns). Add optional image support, matching the same
-- shape posts already use (media_url + media_type), reusing the existing
-- "media" storage bucket and its already-authenticated-insert policy
-- (001_init.sql: media_auth_insert). body stays NOT NULL but the app may
-- store '' for an image-only comment -- empty string satisfies NOT NULL.

alter table public.comments
  add column if not exists media_url text,
  add column if not exists media_type text check (media_type in ('photo'));
