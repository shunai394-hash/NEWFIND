-- API roles need table grants in addition to RLS policies.
-- Without these, PostgREST returns "permission denied for table ...".

grant usage on schema public to anon, authenticated;

grant select on table public.profiles, public.posts, public.follows, public.likes, public.wants, public.saves, public.comments, public.shares
  to anon, authenticated;

grant insert, update, delete on table public.profiles, public.posts, public.follows, public.likes, public.wants, public.saves, public.comments, public.shares
  to authenticated;

grant usage, select on all sequences in schema public to authenticated;
