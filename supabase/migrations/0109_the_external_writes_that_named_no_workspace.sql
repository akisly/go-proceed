-- 0109: the external reviewer's writes name their session's workspace, and the
-- external and decision-head grants take only the columns their writers write.
--
-- Append-only; replaces the WITH CHECK of five policies and narrows six grants.
-- No row changes.
--
-- 1. The workspace. The external plane's write policies (0049) read the
--    session's occurrence, session and grant, but not its workspace: a row on
--    the session's own occurrence carrying another workspace's tenant key was
--    refused by a composite foreign key alone (BL-182, DEV-080 R2). Every
--    member-plane policy reads the tenant key through has_project_capability,
--    and audit_insert_external and outbox_insert_external (0049 §10) already
--    read app.external_session_workspace(). The five below now do too. The
--    route writes scope.workspaceId, and rotation copies the session's own, so
--    no legitimate write changes. redh_external_update gains it in WITH CHECK
--    only: in USING it would admit nothing the occurrence conjunct does not.
--
-- 2. The UPDATE grants. 0049 granted UPDATE on external_sessions and
--    external_access_grants whole, and 0045 on requirement_evidence_decision_heads.
--    Their writers set:
--      - external_sessions: status (revoke-reissue's revoke, the rotation's
--        retirement of its predecessor);
--      - external_access_grants: status, revocation_version, version
--        (revoke-reissue), with a FOR UPDATE that needs any one column;
--      - requirement_evidence_decision_heads: current_decision_id,
--        current_outcome, version, updated_at (both decision routes).
--    es_member_revoke's WITH CHECK is `status = 'revoked'` and
--    es_external_rotate_update's is `id = current session`: neither re-reads the
--    tenant, so with the guard trigger off a revoke or a rotation could move a
--    whole session into another workspace (DEV-085 F1). A column grant closes
--    it without rewriting the policies. The exchange and
--    resolve_external_session write as their owner, unaffected.
--
-- 3. The INSERT grants. The same three external tables take at INSERT only
--    the columns their writers write (occurrence grants and revoke-reissue;
--    session rotation; the external decision route), so a member-plane INSERT
--    cannot create a grant already consumed, revoked or backdated, a session
--    already revoked or seen, or a receipt with its own assurance label.
--
-- DEV-085 (BL-171, BL-182) found them while writing the cross-workspace write
-- tests the DEV-076 minimum asks. The owner chose all three on 2026-09-25
-- (DEV-085), with the heads' part of BL-183.
--
-- Rollback:
--   grant update, insert on public.external_sessions, public.external_access_grants,
--     public.external_decision_batches to goproceed_app (external_decision_batches
--     INSERT only), grant update on public.requirement_evidence_decision_heads to
--   goproceed_app, and alter the five policies back to 0049's WITH CHECK (the
--   same text without `workspace_id = app.external_session_workspace() and`);
-- and, in the same change, the external rows and the heads row of
-- technical/database/rls-write-coverage.csv, their DA rows, INV-001, the heads
-- move-outs of packages/testing/src/requirements-write-rls.test.ts, and the
-- workspace, column and privilege probes of
-- packages/testing/src/external-review-write-rls.test.ts.

set local lock_timeout = '5s';

alter policy red_external_insert on public.requirement_evidence_decisions
  with check (workspace_id = app.external_session_workspace()
              and requirement_occurrence_id = app.external_session_occurrence()
              and external_session_id = app.current_external_session()
              and decided_by_member_id is null
              and app.external_session_may_decide());
alter policy redh_external_insert on public.requirement_evidence_decision_heads
  with check (workspace_id = app.external_session_workspace()
              and requirement_occurrence_id = app.external_session_occurrence()
              and app.external_session_may_decide());
alter policy redh_external_update on public.requirement_evidence_decision_heads
  with check (workspace_id = app.external_session_workspace()
              and requirement_occurrence_id = app.external_session_occurrence()
              and app.external_session_may_decide());
alter policy edb_external_insert on public.external_decision_batches
  with check (workspace_id = app.external_session_workspace()
              and external_session_id = app.current_external_session()
              and requirement_occurrence_id = app.external_session_occurrence()
              and app.external_session_may_decide());
alter policy es_external_rotate_insert on public.external_sessions
  with check (workspace_id = app.external_session_workspace()
              and rotated_from_session_id = app.current_external_session()
              and requirement_occurrence_id = app.external_session_occurrence());

revoke update, insert on public.external_sessions from goproceed_app;
grant insert (workspace_id, external_access_grant_id, requirement_occurrence_id,
              session_verifier, csrf_verifier, verifier_key_id, idle_expires_at,
              absolute_expires_at, rotated_from_session_id, grant_revocation_version)
  on public.external_sessions to goproceed_app;
grant update (status) on public.external_sessions to goproceed_app;

revoke update, insert on public.external_access_grants from goproceed_app;
grant insert (id, workspace_id, project_id, contract_id, scope_kind,
              requirement_occurrence_id, token_hmac, hmac_key_id, recipient_email,
              recipient_contact_id, recipient_role, permissions, expires_at,
              issued_by_member_id, replaced_grant_id, decide_role, decides_evidence)
  on public.external_access_grants to goproceed_app;
grant update (status, revocation_version, version)
  on public.external_access_grants to goproceed_app;

revoke insert on public.external_decision_batches from goproceed_app;
grant insert (id, workspace_id, project_id, requirement_occurrence_id,
              external_access_grant_id, external_session_id, reviewer_claims,
              confirmation_text_version, submitted_at, server_received_at,
              idempotency_key, request_hash, receipt_id, receipt_hash)
  on public.external_decision_batches to goproceed_app;

revoke update on public.requirement_evidence_decision_heads from goproceed_app;
grant update (current_decision_id, current_outcome, version, updated_at)
  on public.requirement_evidence_decision_heads to goproceed_app;

do $$
declare
  bad text;
  role_name text;
  t text;
begin
  select string_agg(tablename || '.' || policyname, ', ') into bad
    from pg_policies
   where schemaname = 'public'
     and policyname in ('red_external_insert', 'redh_external_insert', 'redh_external_update',
                        'edb_external_insert', 'es_external_rotate_insert')
     and strpos(with_check, 'app.external_session_workspace()') = 0;
  if bad is not null then
    raise exception '0109: % does not read the session''s workspace', bad;
  end if;
  for role_name in select rolname from pg_roles where rolname like 'goproceed\_%' loop
    foreach t in array array['public.external_sessions', 'public.external_access_grants',
                             'public.requirement_evidence_decision_heads'] loop
      if has_table_privilege(role_name, t, 'UPDATE') then
        raise exception '0109: % still holds a whole-table UPDATE on %', role_name, t;
      end if;
    end loop;
    foreach t in array array['public.external_sessions', 'public.external_access_grants',
                             'public.external_decision_batches'] loop
      if has_table_privilege(role_name, t, 'INSERT') then
        raise exception '0109: % still holds a whole-table INSERT on %', role_name, t;
      end if;
    end loop;
    if has_column_privilege(role_name, 'public.external_sessions', 'workspace_id', 'UPDATE')
       or has_column_privilege(role_name, 'public.external_access_grants', 'workspace_id', 'UPDATE')
       or has_column_privilege(role_name, 'public.requirement_evidence_decision_heads', 'workspace_id', 'UPDATE')
       or has_column_privilege(role_name, 'public.external_access_grants', 'exchange_consumed_at', 'INSERT')
       or has_column_privilege(role_name, 'public.external_sessions', 'status', 'INSERT')
       or has_column_privilege(role_name, 'public.external_decision_batches', 'assurance_label', 'INSERT') then
      raise exception '0109: % may still write a column no writer writes', role_name;
    end if;
  end loop;
  if not has_column_privilege('goproceed_app', 'public.external_sessions', 'status', 'UPDATE')
     or not has_column_privilege('goproceed_app', 'public.external_access_grants', 'revocation_version', 'UPDATE')
     or not has_column_privilege('goproceed_app', 'public.requirement_evidence_decision_heads', 'current_decision_id', 'UPDATE')
     or not has_column_privilege('goproceed_app', 'public.external_sessions', 'rotated_from_session_id', 'INSERT')
     or not has_column_privilege('goproceed_app', 'public.external_decision_batches', 'receipt_hash', 'INSERT')
     or not has_column_privilege('goproceed_app', 'public.external_access_grants', 'decides_evidence', 'INSERT') then
    raise exception '0109: a grant the product uses was withdrawn';
  end if;
end
$$;
