-- 0105: locations and unit definitions stop offering an UPDATE no route makes.
--
-- Append-only; withdraws two grants and drops their two policies. No column,
-- no row.
--
-- 0013 granted select, insert, update on public.locations and
-- public.unit_definitions to the application role (now goproceed_app) and gave
-- each an UPDATE policy: locations_update (project.admin, 0013) and
-- units_update (owner or admin, replaced in 0014). No route, library, script or
-- function updates either table, locks a row of it or upserts into it with
-- DO UPDATE: the import publish route only inserts locations, and the
-- validate route and the manual baseline only insert unit definitions with
-- ON CONFLICT DO NOTHING (grep for UPDATE, FOR UPDATE / SHARE, ON CONFLICT DO
-- UPDATE and MERGE across apps/, packages/, scripts/ and supabase/functions/,
-- DEV-079). Managing units is a v0.2 capability
-- (technical/permissions/capabilities.csv).
--
-- DEV-079 (BL-166) found them while writing the cross-workspace write-denial
-- tests the DEV-076 minimum asks of every covered row that holds a write. The
-- minimum (docs/delivery/test-strategy.md §4) lets an unused write grant be
-- revoked instead of tested; the owner chose that for these two on 2026-09-25
-- (DEV-079), and chose to drop the two policies with them, so a later grant
-- cannot silently revive an UPDATE path nobody has reviewed. The 0103 rule
-- holds: a command that needs to change a location or a unit adds its grant,
-- its policy and its capability in one migration.
--
-- Rollback:
--   grant update on public.locations, public.unit_definitions to goproceed_app;
--   create policy locations_update on public.locations for update to goproceed_app
--     using (app.has_project_capability(workspace_id, project_id, array['project.admin']))
--     with check (app.has_project_capability(workspace_id, project_id, array['project.admin']));
--   create policy units_update on public.unit_definitions for update to goproceed_app
--     using (app.member_role(workspace_id) in ('owner','admin'))
--     with check (app.member_role(workspace_id) in ('owner','admin'));
-- and, in the same change, the two rows of technical/database/rls-write-coverage.csv,
-- DA-011 and DA-070, and the privilege-refusal assertions of
-- packages/testing/src/contract-baseline-write-rls.test.ts.

revoke update on public.locations, public.unit_definitions from goproceed_app;
drop policy locations_update on public.locations;
drop policy units_update on public.unit_definitions;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['goproceed_app', 'goproceed_service'] loop
    if has_any_column_privilege(role_name, 'public.locations', 'UPDATE')
       or has_any_column_privilege(role_name, 'public.unit_definitions', 'UPDATE') then
      raise exception '0105: % still holds UPDATE on locations or unit_definitions', role_name;
    end if;
  end loop;
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename in ('locations', 'unit_definitions')
                and cmd in ('UPDATE', 'ALL')) then
    raise exception '0105: an UPDATE policy remains on locations or unit_definitions';
  end if;
  if not has_table_privilege('goproceed_app', 'public.locations', 'INSERT')
     or not has_table_privilege('goproceed_app', 'public.unit_definitions', 'INSERT')
     or not has_table_privilege('goproceed_app', 'public.locations', 'SELECT')
     or not has_table_privilege('goproceed_app', 'public.unit_definitions', 'SELECT') then
    raise exception '0105: a grant the product uses was withdrawn';
  end if;
end
$$;
