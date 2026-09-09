create table if not exists public.ai_personas (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  persona_name text not null unique,
  personality text not null default '',
  interests text[] not null default '{}',
  preferred_categories text[] not null default '{}',
  favorite_brands text[] not null default '{}',
  posting_style text not null default '',
  comment_style text not null default '',
  activity_level text not null default 'medium'
    check (activity_level in ('low', 'medium', 'high')),
  system_prompt text not null default '',
  is_active boolean not null default true,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_personas_active_idx
  on public.ai_personas(is_active);

create index if not exists ai_personas_last_active_idx
  on public.ai_personas(last_active_at);

alter table public.ai_personas enable row level security;
