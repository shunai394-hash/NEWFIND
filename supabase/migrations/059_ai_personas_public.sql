create or replace view public.ai_personas_public
with (security_invoker = true)
as
select
  id,
  profile_id,
  persona_name,
  is_active
from public.ai_personas
where is_active = true;

grant select on public.ai_personas_public to anon, authenticated;
