-- Fix permissions for moderation tables used by server-side service_role operations.

do $$
begin
  if to_regclass('public.user_blocks') is not null then
    grant select, insert, update, delete on table public.user_blocks to service_role;
  end if;

  if to_regclass('public.notifications') is not null then
    grant select, insert, update, delete on table public.notifications to service_role;
  end if;

  if to_regclass('public.content_reports') is not null then
    grant select, insert, update, delete on table public.content_reports to service_role;
  end if;
end
$$;
