create table if not exists public.ai_resident_slots (
  slot_number integer primary key
    check (slot_number > 0),
  persona_id uuid unique
    references public.ai_personas(id)
    on delete set null,
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ai_resident_slots_persona_id_idx
  on public.ai_resident_slots(persona_id);

alter table public.ai_resident_slots enable row level security;

drop policy if exists "AI resident slots admin only"
  on public.ai_resident_slots;

create policy "AI resident slots admin only"
  on public.ai_resident_slots
  for all
  to service_role
  using (true)
  with check (true);

insert into public.ai_resident_slots (
  slot_number,
  persona_id
)
select
  row_number() over (
    order by created_at, id
  )::integer as slot_number,
  id
from public.ai_personas
where is_active = true
on conflict (slot_number) do nothing;
