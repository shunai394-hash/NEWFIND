-- ai_personas has RLS enabled with no policies (057_ai_personas.sql), and
-- ai_personas_public was defined with security_invoker = true
-- (059_ai_personas_public.sql / 20260910083000_ai_personas_public_world.sql).
-- With security_invoker, the view runs as the calling role, so RLS (and the
-- lack of any GRANT) on the base table blocks anon/authenticated entirely --
-- the public World/resident directory silently returns nothing for real
-- site visitors. Switch the view back to definer semantics so it exposes
-- only its own explicit column list, while the base table (system_prompt,
-- memory_summary, last_thought, etc.) stays fully inaccessible to anon and
-- authenticated.

create or replace view public.ai_personas_public
with (security_invoker = false)
as
select
  id,
  profile_id,
  persona_name,
  is_active,
  resident_role,
  country_code,
  region,
  expertise,
  interests
from public.ai_personas
where is_active = true;

grant select on public.ai_personas_public to anon, authenticated;
