-- NEWFIND: re-assert API grants + public read RLS + profile social links
-- Safe to re-run. Does not open write access beyond own-row policies.

-- ---------------------------------------------------------------------------
-- Social links on profiles (optional; null keeps existing rows intact)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists instagram_url text,
  add column if not exists x_url text,
  add column if not exists tiktok_url text,
  add column if not exists youtube_url text,
  add column if not exists website_url text;

-- ---------------------------------------------------------------------------
-- Table privileges for PostgREST (anon + authenticated)
-- Missing GRANTs surface as: permission denied for table ...
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on table
  public.profiles,
  public.posts,
  public.follows,
  public.likes,
  public.wants,
  public.saves,
  public.comments,
  public.shares
to anon, authenticated;

grant insert, update, delete on table
  public.profiles,
  public.posts,
  public.follows,
  public.likes,
  public.wants,
  public.saves,
  public.comments,
  public.shares
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- RLS enabled (idempotent)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.wants enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.shares enable row level security;

-- Profiles: public read; own insert/update
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_read on public.profiles for select using (true);
create policy profiles_insert_own on public.profiles for insert
  with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Posts: public read; own write
drop policy if exists posts_read on public.posts;
drop policy if exists posts_insert_own on public.posts;
drop policy if exists posts_update_own on public.posts;
drop policy if exists posts_delete_own on public.posts;
create policy posts_read on public.posts for select using (true);
create policy posts_insert_own on public.posts for insert
  with check (auth.uid() = author_id);
create policy posts_update_own on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
create policy posts_delete_own on public.posts for delete
  using (auth.uid() = author_id);

-- Follows
drop policy if exists follows_read on public.follows;
drop policy if exists follows_insert_own on public.follows;
drop policy if exists follows_delete_own on public.follows;
create policy follows_read on public.follows for select using (true);
create policy follows_insert_own on public.follows for insert
  with check (auth.uid() = follower_id);
create policy follows_delete_own on public.follows for delete
  using (auth.uid() = follower_id);

-- Likes / wants / saves
drop policy if exists likes_read on public.likes;
drop policy if exists likes_insert_own on public.likes;
drop policy if exists likes_delete_own on public.likes;
create policy likes_read on public.likes for select using (true);
create policy likes_insert_own on public.likes for insert
  with check (auth.uid() = user_id);
create policy likes_delete_own on public.likes for delete
  using (auth.uid() = user_id);

drop policy if exists wants_read on public.wants;
drop policy if exists wants_insert_own on public.wants;
drop policy if exists wants_delete_own on public.wants;
create policy wants_read on public.wants for select using (true);
create policy wants_insert_own on public.wants for insert
  with check (auth.uid() = user_id);
create policy wants_delete_own on public.wants for delete
  using (auth.uid() = user_id);

drop policy if exists saves_read on public.saves;
drop policy if exists saves_insert_own on public.saves;
drop policy if exists saves_delete_own on public.saves;
create policy saves_read on public.saves for select using (true);
create policy saves_insert_own on public.saves for insert
  with check (auth.uid() = user_id);
create policy saves_delete_own on public.saves for delete
  using (auth.uid() = user_id);

-- Comments
drop policy if exists comments_read on public.comments;
drop policy if exists comments_insert_own on public.comments;
drop policy if exists comments_delete_own on public.comments;
create policy comments_read on public.comments for select using (true);
create policy comments_insert_own on public.comments for insert
  with check (auth.uid() = user_id);
create policy comments_delete_own on public.comments for delete
  using (auth.uid() = user_id);

-- Shares
drop policy if exists shares_read on public.shares;
drop policy if exists shares_insert on public.shares;
create policy shares_read on public.shares for select using (true);
create policy shares_insert on public.shares for insert
  with check (user_id is null or auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: public media bucket + policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists media_public_read on storage.objects;
drop policy if exists media_auth_insert on storage.objects;
drop policy if exists media_auth_update on storage.objects;
drop policy if exists media_auth_delete on storage.objects;

create policy media_public_read on storage.objects for select
  using (bucket_id = 'media');

create policy media_auth_insert on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media');

create policy media_auth_update on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and owner = auth.uid());

create policy media_auth_delete on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and owner = auth.uid());
