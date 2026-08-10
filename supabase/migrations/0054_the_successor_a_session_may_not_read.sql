-- ===========================================================================
-- 0054 — A SESSION COULD MINT ITS SUCCESSOR AND NOT READ IT BACK
--
-- WHAT WAS WRONG. `es_external_rotate_insert` (0049 §10) lets an external
-- session create exactly one successor, and the successor is by definition a
-- DIFFERENT row: its id is fresh and its predecessor is the current session.
-- `es_external_select` is `using (id = app.current_external_session())` — the
-- current session and nothing else — so the successor is invisible to the
-- session that just created it.
--
-- That is not merely untidy, because PostgreSQL applies the SELECT policy to
-- RETURNING. `rotateExternalSession` (apps/app/src/lib/external-session.ts)
-- ends its INSERT with `returning id`, needing the successor's id to sign the
-- new cookie, and the statement therefore failed with 42501 «new row violates
-- row-level security policy». The WITH CHECK was satisfied the whole time: both
-- of its conjuncts evaluate true, and the same INSERT with the RETURNING clause
-- removed is accepted.
--
-- WHAT IT COST. Rotation is step 5 of `external.occurrence_decision_submit` and
-- 0049 §10 says «and NOTHING AFTER IT». So every external decision submitted by
-- a технагляд wrote its decision, its batch, its receipt and its audit — and
-- then rolled all of it back on the rotation, answering 500. Combined with the
-- 42702 that 0053 fixes, no part of the external reviewer flow worked: the link
-- could not be exchanged, and once it could, the decision could not be
-- submitted.
--
-- THE FIX. One more permissive SELECT policy, for the one row this adds: the
-- successor THIS session minted. It is added beside `es_external_select` rather
-- than folded into it so the two claims stay separately readable — «my own
-- session» and «the successor of my own session» — and so this one can be
-- dropped on its own if rotation ever stops needing to read back.
--
-- WHY IT DISCLOSES NOTHING NEW. The row is one the session created, from
-- material the session's own request supplied; `external_sessions_rotation_key`
-- makes a second successor of one predecessor unstorable, so this widens the
-- visible set by exactly one row and never by a sibling, a grant's other
-- session, or another workspace's anything. The stored verifiers are keyed
-- HMACs and not the secrets — those live only in the cookie the caller already
-- holds.
--
-- ROLLBACK (dev only): drop policy es_external_select_successor on
-- public.external_sessions;
-- ===========================================================================
create policy es_external_select_successor on public.external_sessions
  for select to aktflow_app
  using (rotated_from_session_id = app.current_external_session());

comment on policy es_external_select_successor on public.external_sessions is
  'Rotation reads back what it just wrote. es_external_rotate_insert lets a '
  'session mint exactly one successor; without this it could not SELECT that '
  'row, and RETURNING made the INSERT itself fail 42501.';
