-- AI/admin server-side operations use the Supabase service_role client.
-- service_role is already a privileged server-side role; grant it full
-- DML access to application tables so local and hosted environments behave
-- consistently for admin-side AI operations.

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

alter default privileges in schema public
  grant all privileges on tables to service_role;

alter default privileges in schema public
  grant all privileges on sequences to service_role;
