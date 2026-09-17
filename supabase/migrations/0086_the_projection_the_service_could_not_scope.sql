-- The projection the service could not scope (DEV-015, BL-100).
--
-- WHAT WAS WRONG. 0045 §10 wrote the service policies of the two readiness
-- projections as
--
--   create policy rp_write_server on public.readiness_projection
--     for all to <service role> using (true) with check (true);
--   create policy br_write_server on public.blocked_reasons  (the same)
--
-- and said (0045:1643-1648) that the service «reads through rp_select and this
-- policy adds only the write side». It does not. A policy FOR ALL applies to
-- the selection side of every command as well as the modification side, and
-- permissive policies combine with OR, so `using (true)` let a service
-- transaction declaring ANY workspace, or none, select, insert, update and
-- delete every tenant's projection rows. The service role holds insert, update
-- and delete directly (0045) and select through goproceed_app (0034). The
-- composite foreign key keeps a row's project inside its workspace; it does not
-- stop a cross-workspace read or rewrite.
--
-- WHAT THIS CHANGES. Both policies keep their names, role and command, and are
-- confined to the workspace the service transaction declared, exactly like the
-- Telegram service policies (0062, 0080):
--
--   using (workspace_id = app.service_workspace())
--   with check (workspace_id = app.service_workspace())
--
-- The declaration is not an authorization: the service code makes it itself
-- (0062, packages/database/src/tx.ts adoptServiceWorkspace). What it buys is the
-- fence against a defect in service code — a rebuild that forgets its scope now
-- reads and rewrites nothing, and its insert fails with 42501. A rebuild of a
-- declared workspace's own scope (delete, then insert) still works, with or
-- without an actor. A future rebuilder that must visit every workspace claims
-- its work through a SECURITY DEFINER function and declares each workspace in
-- its own transaction, as app.claim_telegram_evidence_retries (0083) does.
--
-- WHAT THIS DOES NOT CHANGE (BL-101). goproceed_service is a member of
-- goproceed_app and inherits rp_select and br_select, which are keyed on the
-- actor. A service transaction that carries an entitled actor still reads that
-- actor's other workspaces' projections through them. No code reads or writes
-- either table today (apps/app/src/lib/readiness.ts and blocked-value.ts name
-- them only in comments).
--
-- No grant, table, constraint or row changes. Re-running this file gives the
-- same end state.
--
-- Pinned by packages/testing/src/projection-rls.test.ts (red at 0085, green
-- here) and by the rewritten «no public policy is literally `true`» case in
-- packages/testing/src/m5-external-rls.test.ts §2. INV-001;
-- technical/data-access-surface.csv DA-178 to DA-181.
--
-- ROLLBACK (dev only): alter both policies back to `using (true) with check
-- (true)`. That reopens BL-100; roll forward instead.

alter policy rp_write_server on public.readiness_projection
  using (workspace_id = app.service_workspace())
  with check (workspace_id = app.service_workspace());

alter policy br_write_server on public.blocked_reasons
  using (workspace_id = app.service_workspace())
  with check (workspace_id = app.service_workspace());

comment on policy rp_write_server on public.readiness_projection is
  'Service plane, reads and writes: only the workspace the service transaction declared (app.service_workspace()). 0086 corrects 0045, which was using (true) and said it added only the write side.';

comment on policy br_write_server on public.blocked_reasons is
  'Service plane, reads and writes: only the workspace the service transaction declared (app.service_workspace()). 0086 corrects 0045, which was using (true) and said it added only the write side.';

-- Self-check. The expected expression is read from the 0080 policy rather than
-- typed here, so the check does not depend on how pg_policies renders it.
do $$
declare
  ref_qual text;
  ref_check text;
  n int;
begin
  select qual, with_check into ref_qual, ref_check
    from pg_policies
   where schemaname = 'public'
     and tablename = 'telegram_requirement_choice_sessions'
     and policyname = 'telegram_requirement_choice_sessions_service';
  if ref_qual is null or ref_check is null then
    raise exception '0086: the reference service policy (0080) was not found';
  end if;

  select count(*) into n
    from pg_policies
   where schemaname = 'public'
     and (tablename, policyname) in (('readiness_projection', 'rp_write_server'),
                                     ('blocked_reasons', 'br_write_server'))
     and cmd = 'ALL'
     and permissive = 'PERMISSIVE'
     and roles = array['goproceed_service']::name[]
     and qual = ref_qual
     and with_check = ref_check;
  if n <> 2 then
    raise exception '0086: the projection service policies are not confined to the declared workspace (% of 2)', n;
  end if;

  perform 1
    from pg_policies
   where schemaname = 'public'
     and tablename in ('readiness_projection', 'blocked_reasons')
     and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true');
  if found then
    raise exception '0086: an unconditional policy remains on a projection table';
  end if;
end $$;
