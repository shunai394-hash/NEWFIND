-- Additive source quality on the common research source table.
-- Reuses discovery source_tier values (1-4). No new enum.

alter table public.ai_research_sources
  add column if not exists source_quality integer
  check (source_quality is null or source_quality between 1 and 4);
