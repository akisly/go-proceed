-- 0009_deny_by_default_privileges.sql
-- v0.0 gate: future objects are inaccessible until explicitly granted
-- (docs/architecture/tenancy-and-security.md "Grants and exposed schemas").
-- service_role is deliberately left with its defaults in v0.0: it is
-- server-side only, RLS-bypassing by design, and Supabase platform tooling
-- depends on it; narrowing it is a separate reviewed change.

revoke create on schema public from public;

-- Strip anon/authenticated (and PUBLIC execute on functions) from every
-- creator role that has a default ACL in schema public, plus the known
-- migration runner. Discovered from pg_default_acl, not assumed
-- (tenancy-and-security.md: copying an example without catalog verification
-- is not sufficient).
--
-- TWO POSTGRES GOTCHAS ENCODED HERE:
-- 1. A schema-scoped ALTER DEFAULT PRIVILEGES ... REVOKE can only subtract
--    privileges that the per-schema entry itself would add; it can NEVER
--    remove the built-in global default (PUBLIC execute on functions). The
--    function revoke therefore also runs GLOBALLY (no IN SCHEMA clause).
-- 2. The migration runner (`postgres`) is not a superuser on Supabase and
--    cannot alter supabase_admin's default ACL. supabase_admin's
--    public-schema entry (which grants anon/authenticated on objects
--    supabase_admin itself creates) is a PLATFORM residual: user migrations
--    never run as supabase_admin, and the catalog-snapshot procedure
--    (scripts/snapshot-db-catalog.mjs) is the control that watches it on
--    every environment.
do $$
declare owner_role text;
begin
  for owner_role in
    select distinct pg_get_userbyid(defaclrole)
      from pg_default_acl
     where defaclnamespace = 'public'::regnamespace
    union select 'postgres'
  loop
    begin
      execute format(
        'alter default privileges for role %I in schema public revoke all on tables from anon, authenticated',
        owner_role);
      execute format(
        'alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated',
        owner_role);
      execute format(
        'alter default privileges for role %I in schema public revoke all on functions from public, anon, authenticated',
        owner_role);
      -- global scope: the only way to drop built-in PUBLIC execute for this
      -- creator's future functions (see gotcha 1 above)
      execute format(
        'alter default privileges for role %I revoke execute on functions from public, anon, authenticated',
        owner_role);
      execute format(
        'alter default privileges for role %I revoke all on tables from anon, authenticated',
        owner_role);
      execute format(
        'alter default privileges for role %I revoke all on sequences from anon, authenticated',
        owner_role);
    exception when insufficient_privilege then
      raise notice 'skipping default-privilege revoke for % (insufficient privilege)', owner_role;
    end;
  end loop;
end $$;
