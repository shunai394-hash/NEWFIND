alter table public.posts
  drop constraint if exists posts_source_check;

alter table public.posts
  add constraint posts_source_check
  check (source in ('user', 'brandbridge', 'ai'));
