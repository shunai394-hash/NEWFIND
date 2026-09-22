-- discovery_products.assigned_resident_id references ai_personas(id), but
-- discovered_by_resident_id (added earlier in 20260909204149) never got the
-- same FK, so a bad/stale persona id there is silently accepted. Bring it in
-- line. Any existing rows pointing at a since-deleted persona are cleared
-- rather than failing the migration.

update public.discovery_products
set discovered_by_resident_id = null
where discovered_by_resident_id is not null
  and not exists (
    select 1 from public.ai_personas
    where ai_personas.id = discovery_products.discovered_by_resident_id
  );

alter table public.discovery_products
  add constraint discovery_products_discovered_by_resident_id_fkey
  foreign key (discovered_by_resident_id)
  references public.ai_personas (id)
  on delete set null;
