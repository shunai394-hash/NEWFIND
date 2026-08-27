-- Moderation: suspend users + allow admins to delete any post.
-- Additive. Does not drop users, posts, or existing policies.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

alter table public.profiles
  add column if not exists is_suspended boolean not null default false;

create or replace function public.is_discovery_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

drop policy if exists posts_delete_admin on public.posts;
create policy posts_delete_admin on public.posts
  for delete
  using (public.is_discovery_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update
  using (public.is_discovery_admin())
  with check (public.is_discovery_admin());

-- Prevent clients from flipping is_admin / is_suspended via profiles_update_own.
-- Service role (admin APIs) bypasses this.
create or replace function public.protect_profile_moderation_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if not public.is_discovery_admin() then
    new.is_admin := old.is_admin;
    new.is_suspended := old.is_suspended;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_moderation_fields on public.profiles;
create trigger protect_profile_moderation_fields
  before update on public.profiles
  for each row
  execute function public.protect_profile_moderation_fields();

create or replace function public.prevent_suspended_posts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles
    where id = new.author_id and is_suspended
  ) then
    raise exception 'account suspended';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_suspended_posts on public.posts;
create trigger prevent_suspended_posts
  before insert on public.posts
  for each row
  execute function public.prevent_suspended_posts();
