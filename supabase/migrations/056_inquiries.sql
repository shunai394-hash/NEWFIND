-- Support inquiries for NEWFIND.
-- Additive. Does not modify the existing reports system.

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  email text,
  category text not null default 'その他',
  subject text not null,
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists inquiries_created_idx
  on public.inquiries (created_at desc);

create index if not exists inquiries_status_created_idx
  on public.inquiries (status, created_at desc);

alter table public.inquiries enable row level security;

-- Client direct access is intentionally not granted.
-- Public submission and admin management are handled by server-side
-- API routes using the service-role client.