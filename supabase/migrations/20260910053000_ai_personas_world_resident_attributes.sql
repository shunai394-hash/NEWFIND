-- World resident attributes for NEWFIND AI personas.
-- Additive only: existing 10 residents keep their rows and values.
-- New columns use empty defaults so current data is not rewritten.

alter table public.ai_personas
  add column if not exists country_code text not null default '';

alter table public.ai_personas
  add column if not exists region text not null default '';

alter table public.ai_personas
  add column if not exists languages text[] not null default '{}'::text[];

alter table public.ai_personas
  add column if not exists expertise text[] not null default '{}'::text[];

alter table public.ai_personas
  add column if not exists "values" text[] not null default '{}'::text[];

alter table public.ai_personas
  add column if not exists culture text not null default '';
