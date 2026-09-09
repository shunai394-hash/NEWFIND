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