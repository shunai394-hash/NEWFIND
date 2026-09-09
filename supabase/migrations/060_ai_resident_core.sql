alter table public.ai_personas
  add column if not exists resident_role text not null default 'general_user';

alter table public.ai_personas
  add column if not exists goals text[] not null default '{}';

alter table public.ai_personas
  add column if not exists memory_summary text not null default '';

alter table public.ai_personas
  add column if not exists reputation_score integer not null default 0;

alter table public.ai_personas
  add column if not exists discovery_count integer not null default 0;

alter table public.ai_personas
  add column if not exists interaction_count integer not null default 0;

alter table public.ai_personas
  add column if not exists last_thought text not null default '';

alter table public.ai_personas
  add column if not exists last_action text not null default '';

alter table public.ai_personas
  add column if not exists last_observed_at timestamptz;

alter table public.ai_personas
  add column if not exists next_action_at timestamptz;

create index if not exists ai_personas_next_action_idx
  on public.ai_personas(next_action_at);

create table if not exists public.ai_resident_memories (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.ai_personas(id) on delete cascade,
  memory_type text not null default 'observation',
  subject_type text,
  subject_id text,
  content text not null,
  importance integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists ai_resident_memories_persona_idx
  on public.ai_resident_memories(persona_id, created_at desc);

create index if not exists ai_resident_memories_subject_idx
  on public.ai_resident_memories(subject_type, subject_id);

alter table public.ai_resident_memories enable row level security;

drop policy if exists ai_resident_memories_read_own on public.ai_resident_memories;

create policy ai_resident_memories_read_own
  on public.ai_resident_memories
  for select
  using (
    exists (
      select 1
      from public.ai_personas p
      where p.id = persona_id
        and p.profile_id = auth.uid()
    )

  );

grant select on public.ai_resident_memories to authenticated;
