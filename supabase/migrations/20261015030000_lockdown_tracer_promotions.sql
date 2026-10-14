-- Align the ledger schema regardless of which idempotent create migration ran first.
alter table public.tracer_promotions
  add column if not exists first_received_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.tracer_promotions enable row level security;

-- The ledger contains supplier identifiers and integration metadata. Only the
-- service-role integration may read/write it; public feed posts live in ai_posts.
drop policy if exists tracer_promotions_public_read on public.tracer_promotions;
revoke all on table public.tracer_promotions from anon, authenticated;
grant all on table public.tracer_promotions to service_role;

notify pgrst, 'reload schema';
