-- 0107: an act version's content stops offering edits no command makes, and a
-- version is born a draft.
--
-- Append-only; withdraws four grants, replaces three policies. No column, no row.
--
-- 1. The content tables. 0047 granted select, insert, update, delete on
--    public.statutory_act_version_quantities and ..._signatories to the
--    application role, with FOR ALL policies (savq_write, savs_write), on the
--    note that composing is iterative (0047 §8). No v0.1 command edits a draft:
--    compose inserts the version and its content in one transaction and
--    nothing else writes either table (grep for UPDATE, DELETE, ON CONFLICT,
--    FOR UPDATE / SHARE and MERGE across apps/, packages/, scripts/ and
--    supabase/functions/, DEV-083). Only admin test fixtures change them, as
--    the owner.
--
-- 2. The version. sav_insert asked only the capability, so a composer could
--    INSERT a version already `frozen` — past the guard's frozen_at and
--    registry-date checks and the deferred completeness check, which fire on
--    UPDATE only. (The render and the content hash are the freeze route's
--    alone: no database check binds them, on either path.) Compose inserts
--    `draft` alone. The policy now says so, as ws_insert opens a stage only
--    (0045).
--
-- DEV-083 (BL-169) found both while writing the cross-workspace write-denial
-- tests the DEV-076 minimum asks of every covered row that holds a write. The
-- minimum (docs/delivery/test-strategy.md §4) lets an unused write grant be
-- revoked instead of tested; the owner chose that, and the draft arm, on
-- 2026-09-25 (DEV-083). The command that needs to edit a draft adds its grant,
-- its policy and its capability in one migration. The content guards stay:
-- they are the last defence, not the only one.
--
-- Rollback:
--   drop policy sav_insert on public.statutory_act_versions;
--   create policy sav_insert on public.statutory_act_versions for insert to goproceed_app
--     with check (app.has_project_capability(workspace_id, project_id, array['statutory_acts.compose']));
--   drop policy savq_insert on public.statutory_act_version_quantities;
--   drop policy savs_insert on public.statutory_act_version_signatories;
--   grant update, delete on public.statutory_act_version_quantities,
--     public.statutory_act_version_signatories to goproceed_app;
--   and recreate savq_write and savs_write as 0047 wrote them (for all,
--   with the same capability in both clauses);
-- and, in the same change, the two content rows of
-- technical/database/rls-write-coverage.csv, their DA rows, and the full UPDATE
-- and DELETE minimum in packages/testing/src/statutory-write-rls.test.ts (the
-- gap baseline no longer carries them, so the registry check fails until it is
-- written).

revoke update, delete on public.statutory_act_version_quantities from goproceed_app;
revoke update, delete on public.statutory_act_version_signatories from goproceed_app;

drop policy savq_write on public.statutory_act_version_quantities;
create policy savq_insert on public.statutory_act_version_quantities
  for insert to goproceed_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['statutory_acts.compose']));

drop policy savs_write on public.statutory_act_version_signatories;
create policy savs_insert on public.statutory_act_version_signatories
  for insert to goproceed_app
  with check (app.has_project_capability(workspace_id, project_id,
              array['statutory_acts.compose']));

drop policy sav_insert on public.statutory_act_versions;
create policy sav_insert on public.statutory_act_versions
  for insert to goproceed_app
  with check (status = 'draft'
    and app.has_project_capability(workspace_id, project_id,
        array['statutory_acts.compose']));

do $$
declare
  role_name text;
  t text;
begin
  foreach t in array array['public.statutory_act_version_quantities',
                           'public.statutory_act_version_signatories'] loop
    for role_name in select rolname from pg_roles where rolname like 'goproceed\_%' loop
      if has_any_column_privilege(role_name, t, 'UPDATE')
         or has_table_privilege(role_name, t, 'DELETE') then
        raise exception '0107: % still holds UPDATE or DELETE on %', role_name, t;
      end if;
    end loop;
    if not has_table_privilege('goproceed_app', t, 'INSERT')
       or not has_table_privilege('goproceed_app', t, 'SELECT') then
      raise exception '0107: a grant the product uses was withdrawn on %', t;
    end if;
  end loop;
  if exists (select 1 from pg_policies
              where schemaname = 'public'
                and tablename in ('statutory_act_version_quantities',
                                  'statutory_act_version_signatories')
                and cmd in ('UPDATE', 'DELETE', 'ALL')) then
    raise exception '0107: an UPDATE, DELETE or ALL policy remains on the act content';
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'statutory_act_versions'
                    and policyname = 'sav_insert' and cmd = 'INSERT'
                    and with_check like '%status = ''draft''::text%') then
    raise exception '0107: sav_insert does not require a draft';
  end if;
end
$$;
