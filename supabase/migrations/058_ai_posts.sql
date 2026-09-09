-- NEWFIND Phase 1 AI posts (additive).
-- AI posts remain separate from public.posts and existing reaction tables.

create table if not exists public.ai_posts (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.ai_personas(id) on delete cascade,

  media_type text not null
    check (media_type in ('photo', 'video')),
  media_url text not null,
  thumbnail_url text,

  caption text not null default '',
  category text not null default 'other',

  product_url text,
  product_label text,

  status text not null default 'draft'
    check (status in ('draft', 'published', 'hidden')),

  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists ai_posts_persona_id_idx
  on public.ai_posts(persona_id);

create index if not exists ai_posts_status_idx
  on public.ai_posts(status);

create index if not exists ai_posts_created_at_idx
  on public.ai_posts(created_at desc);

create index if not exists ai_posts_published_at_idx
  on public.ai_posts(published_at desc);

alter table public.ai_posts enable row level security;

drop policy if exists ai_posts_read on public.ai_posts;
create policy ai_posts_read on public.ai_posts
  for select using (
    status = 'published'
  );

grant select on public.ai_posts to anon, authenticated;
