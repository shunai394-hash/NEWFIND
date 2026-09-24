create table if not exists public.external_post_outbox (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  event_id text not null unique,
  source text not null default 'newfind_ai',
  content_type text not null default 'discovery',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','sending','published','failed','dead')),
  attempts integer not null default 0,
  next_retry_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create unique index if not exists external_post_outbox_post_id_idx
  on public.external_post_outbox(post_id);

create index if not exists external_post_outbox_pending_idx
  on public.external_post_outbox(status, next_retry_at, created_at);

alter table public.external_post_outbox enable row level security;

revoke all on public.external_post_outbox from anon, authenticated;
grant all on public.external_post_outbox to service_role;
