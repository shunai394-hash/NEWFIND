-- Allow caption-only status posts alongside existing photo/video posts.
-- Additive: existing rows keep their media_type and media_url values.

alter table public.posts
  alter column media_url drop not null;

alter table public.posts
  drop constraint if exists posts_media_type_check;

alter table public.posts
  add constraint posts_media_type_check
  check (media_type in ('photo', 'video', 'text'));
