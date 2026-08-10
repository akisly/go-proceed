-- ===========================================================================
-- 0055 — INV-007 DID NOT HOLD ACROSS A ROTATION
--
-- WHAT WAS WRONG. `external.occurrence_decision_submit` rotates the session as
-- its last write (0049 §10, «and NOTHING AFTER IT»), so after one submit the
-- caller's cookie names the SUCCESSOR session while the batch it just wrote
-- stores the PREDECESSOR in `external_session_id`.
--
-- The replay read is deliberately lineage-wide — it selects by
-- (workspace_id, external_access_grant_id, idempotency_key) and its own comment
-- says «on the same lineage: the answer is already written». RLS was narrower
-- than that intent: `edb_external_select` (0049:1081-1083) is
-- `using (external_session_id = app.current_external_session())`, the current
-- session and nothing else. So the successor could not see its predecessor's
-- batch, the replay found nothing, execution fell through to the write path,
-- and the second call answered 409 VERSION_CONFLICT.
--
-- INV-007 is «one receipt per (grant, idempotency key)», and the whole point of
-- an idempotency key is that the caller may safely repeat the call. A технагляд
-- whose connection dropped, or who pressed the button twice, was told their
-- decision conflicted instead of being handed back the receipt they had already
-- earned. The storage layer was right the entire time —
-- external_decision_batches_grant_key still permits exactly one — and only the
-- READ was too narrow to find it.
--
-- THE FIX. A session may read the batches of the sessions it DESCENDS FROM.
-- `app.external_session_lineage()` walks `rotated_from_session_id` up from the
-- current session; the chain is bounded and acyclic because a predecessor
-- always exists before its successor and `external_sessions_rotation_key`
-- admits one successor per predecessor. It is SECURITY DEFINER for the reason
-- `app.external_session_scope()` is (0049 §7): it is consulted from a policy on
-- a table it must read past, and would otherwise be filtered by the very
-- policies it exists to inform.
--
-- WHY IT DISCLOSES NOTHING NEW. The chain never leaves the grant — rotation
-- links are only ever created by `es_external_rotate_insert`, which pins the
-- successor's occurrence to the predecessor's — so this widens the visible set
-- to exactly «the receipts this bearer has already been given», and never to a
-- sibling session, another grant, or another workspace. A caller replaying a
-- key can already see the receipt for it; they simply could not, and that was
-- the bug.
--
-- ROLLBACK (dev only):
--   drop policy edb_external_select_lineage on public.external_decision_batches;
--   drop function app.external_session_lineage();
-- ===========================================================================
create or replace function app.external_session_lineage() returns setof uuid
language sql stable security definer set search_path = '' as $$
  with recursive chain as (
    select s.id, s.rotated_from_session_id
      from public.external_sessions s
     where s.id = app.current_external_session()
    union all
    select p.id, p.rotated_from_session_id
      from public.external_sessions p
      join chain c on p.id = c.rotated_from_session_id
  )
  select id from chain
$$;

-- 0009 sets `alter default privileges ... revoke all on functions from public,
-- anon, authenticated`, so a new function is executable by nobody until it is
-- granted. The policy below calls this one as aktflow_app; without the grant the
-- read fails «permission denied for function» and the route answers 500. Same
-- pair 0049:679-680 issues for app.external_session_scope().
revoke all on function app.external_session_lineage() from public, anon, authenticated;
grant execute on function app.external_session_lineage() to aktflow_app;

comment on function app.external_session_lineage() is
  'The current external session and every session it was rotated from. Bounded '
  'and acyclic: a predecessor exists before its successor and '
  'external_sessions_rotation_key admits one successor per predecessor.';

create policy edb_external_select_lineage on public.external_decision_batches
  for select to aktflow_app
  using (external_session_id in (select app.external_session_lineage()));

comment on policy edb_external_select_lineage on public.external_decision_batches is
  'INV-007 across a rotation. The submit rotates the session as its last write, '
  'so a replay arrives on the SUCCESSOR while the batch names the PREDECESSOR; '
  'without this the replay could not find the receipt it had already been given '
  'and answered 409 instead of 200.';
