-- 0039: the UPDATE grant on organizations stops claiming a path that is not there.
--
-- Additive. Withdraws one grant. No policy, no column, no row.
--
-- 0003 granted select, insert, update on public.organizations to aktflow_app.
-- 0004 enabled RLS on the table and created exactly two policies, org_select
-- and org_insert. With RLS on and no permissive UPDATE policy, every UPDATE by
-- aktflow_app matches zero rows and commits — silently, with no error and no
-- effect. The grant has therefore never been usable.
--
-- The tempting reading is that this is a bug blocking the quota (0026,
-- evidence_quota_bytes) and retention (0027, blocked_content_retention_days)
-- columns, and that the fix is an UPDATE policy. That inverts the remedy.
-- Both columns are external-gate values under technical/data-retention-
-- catalog.csv (V-003) — they are not this slice's to make tenant-settable.
-- And an UPDATE policy on the table would hand aktflow_app the whole row:
-- legal_name, edrpou and status included. Nothing in apps/ or packages/
-- updates organizations at all today; the only writers in the repository are
-- integration-test fixtures on the admin connection.
--
-- So the correct move is to remove the false affordance, not to build the
-- missing one. When a settings command is designed, it adds a column-scoped
-- UPDATE grant and an owner/admin policy together in one migration, and the
-- capability that gates it. Leaving an inert table-wide grant in place until
-- then invites exactly the mistake of adding the policy alone.
--
-- Rollback:
--   grant update on public.organizations to aktflow_app;
-- (which restores an equally inert privilege — the policy gap is unchanged.)

revoke update on public.organizations from aktflow_app;

comment on table public.organizations is
  'Workspace/tenant root. aktflow_app holds SELECT and INSERT only: 0039 '
  'withdrew a table-wide UPDATE grant that RLS had made inert since 0004 '
  '(no UPDATE policy exists). evidence_quota_bytes (0026) and '
  'blocked_content_retention_days (0027) are external-gate values (V-003) and '
  'are not tenant-settable. A future settings command must add a '
  'column-scoped UPDATE grant, an owner/admin policy and its capability in '
  'one migration — never the policy alone.';
