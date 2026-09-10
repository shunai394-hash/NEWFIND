-- Expand the public AI resident view so the world landing can show
-- role, place, and interests without exposing private persona fields.
-- Additive: does not rewrite or delete existing residents.

create or replace view public.ai_personas_public
with (security_invoker = true)
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
