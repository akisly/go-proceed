-- 0106: work assignments stop offering an UPDATE no command makes.
--
-- Append-only; withdraws one grant and drops its policy. No column, no row.
--
-- 0016 granted select, insert, update on public.work_assignments to the
-- application role (now goproceed_app), with the note that status and version
-- would change there, and gave it wa_update (assignments.manage). No route,
-- library, script or function updates an assignment, locks one or upserts
-- into one: the assignment route only inserts, and the one row lock that joins
-- an assignment locks the Telegram binding alone (`FOR UPDATE OF b`). Only
-- admin test fixtures update the table, as its owner (grep for UPDATE, FOR
-- UPDATE / SHARE, ON CONFLICT DO UPDATE and MERGE across apps/, packages/,
-- scripts/ and supabase/functions/, DEV-081). The closures route records that
-- a future assignments.update command owes its own lock.
--
-- DEV-081 (BL-168) found it while writing the cross-workspace write-denial
-- tests the DEV-076 minimum asks of every covered row that holds a write. The
-- minimum (docs/delivery/test-strategy.md §4) lets an unused write grant be
-- revoked instead of tested; the owner chose that on 2026-09-25 (DEV-081),
-- with the policy dropped too, as in 0105: the command that needs to change an
-- assignment adds its grant, its policy and its capability in one migration.
--
-- Rollback:
--   grant update on public.work_assignments to goproceed_app;
--   create policy wa_update on public.work_assignments for update to goproceed_app
--     using (app.has_project_capability(workspace_id, project_id, array['assignments.manage']))
--     with check (app.has_project_capability(workspace_id, project_id, array['assignments.manage']));
-- and, in the same change, the work_assignments row of
-- technical/database/rls-write-coverage.csv, DA-122, and the privilege-refusal
-- assertion of packages/testing/src/execution-write-rls.test.ts.

revoke update on public.work_assignments from goproceed_app;
drop policy wa_update on public.work_assignments;

do $$
declare
  role_name text;
begin
  for role_name in select rolname from pg_roles where rolname like 'goproceed\_%' loop
    if has_any_column_privilege(role_name, 'public.work_assignments', 'UPDATE') then
      raise exception '0106: % still holds UPDATE on work_assignments', role_name;
    end if;
  end loop;
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'work_assignments'
                and cmd in ('UPDATE', 'ALL')) then
    raise exception '0106: an UPDATE policy remains on work_assignments';
  end if;
  if not has_table_privilege('goproceed_app', 'public.work_assignments', 'INSERT')
     or not has_table_privilege('goproceed_app', 'public.work_assignments', 'SELECT') then
    raise exception '0106: a grant the product uses was withdrawn';
  end if;
end
$$;
