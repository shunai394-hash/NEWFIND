-- NEWFIND MVP schema
-- Discovery SNS: posts can optionally point to an external product URL.
-- No product master, inventory, checkout, or revenue split.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  bio text not null default '',
  avatar_url text,
  account_type text not null default 'personal'
    check (account_type in ('personal', 'business')),
  company_name text,
  company_website text,
  company_description text,
  created_at timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (username);

-- ---------------------------------------------------------------------------
-- Posts
-- product_url: optional outbound link to an external EC / official page
-- source=brandbridge: official post that references a BrandBridge listing
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  media_type text not null check (media_type in ('photo', 'video')),
  media_url text not null,
  thumbnail_url text,
  caption text not null default '',
  category text not null default 'other',
  product_url text,
  product_label text,
  is_sponsored boolean not null default false,
  source text not null default 'user' check (source in ('user', 'brandbridge')),
  source_ref text,
  source_url text,
  created_at timestamptz not null default now()
);

create index posts_author_id_idx on public.posts (author_id);
create index posts_created_at_idx on public.posts (created_at desc);
create index posts_category_idx on public.posts (category);

-- ---------------------------------------------------------------------------
-- Social graph & reactions
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_id_idx on public.follows (followee_id);

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.wants (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index comments_post_id_idx on public.comments (post_id, created_at);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- New user -> profile
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  uname text;
  i int := 0;
begin
  base := lower(split_part(new.email, '@', 1));
  base := regexp_replace(base, '[^a-z0-9._]', '', 'g');
  if base = '' then
    base := 'user';
  end if;
  base := left(base, 16);
  uname := base;

  while exists (select 1 from public.profiles where username = uname) loop
    i := i + 1;
    uname := base || i::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    uname,
    coalesce(new.raw_user_meta_data ->> 'display_name', uname)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.wants enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.shares enable row level security;

create policy profiles_read on public.profiles for select using (true);
create policy profiles_insert_own on public.profiles for insert
  with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update
  using (auth.uid() = id);

create policy posts_read on public.posts for select using (true);
create policy posts_insert_own on public.posts for insert
  with check (auth.uid() = author_id);
create policy posts_update_own on public.posts for update
  using (auth.uid() = author_id);
create policy posts_delete_own on public.posts for delete
  using (auth.uid() = author_id);

create policy follows_read on public.follows for select using (true);
create policy follows_insert_own on public.follows for insert
  with check (auth.uid() = follower_id);
create policy follows_delete_own on public.follows for delete
  using (auth.uid() = follower_id);

create policy likes_read on public.likes for select using (true);
create policy likes_insert_own on public.likes for insert
  with check (auth.uid() = user_id);
create policy likes_delete_own on public.likes for delete
  using (auth.uid() = user_id);

create policy wants_read on public.wants for select using (true);
create policy wants_insert_own on public.wants for insert
  with check (auth.uid() = user_id);
create policy wants_delete_own on public.wants for delete
  using (auth.uid() = user_id);

create policy saves_read on public.saves for select using (true);
create policy saves_insert_own on public.saves for insert
  with check (auth.uid() = user_id);
create policy saves_delete_own on public.saves for delete
  using (auth.uid() = user_id);

create policy comments_read on public.comments for select using (true);
create policy comments_insert_own on public.comments for insert
  with check (auth.uid() = user_id);
create policy comments_delete_own on public.comments for delete
  using (auth.uid() = user_id);

create policy shares_read on public.shares for select using (true);
create policy shares_insert on public.shares for insert
  with check (user_id is null or auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: public media bucket for photos / videos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

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

-- Table privileges (RLS is not enough; PostgREST needs GRANTs)
grant usage on schema public to anon, authenticated;

grant select on table public.profiles, public.posts, public.follows, public.likes, public.wants, public.saves, public.comments, public.shares
  to anon, authenticated;

grant insert, update, delete on table public.profiles, public.posts, public.follows, public.likes, public.wants, public.saves, public.comments, public.shares
  to authenticated;

grant usage, select on all sequences in schema public to authenticated;
