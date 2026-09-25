# DEV-085 — BL-171 and BL-182: the cross-workspace write minimum for the external review rows

## Assignment

- Objective and user-visible outcome:
  - No user-visible change.
  - Five rows of `technical/database/rls-write-coverage.csv` become `covered`, each citing a test in `packages/testing/src/external-review-write-rls.test.ts` in the shape the DEV-076 minimum sets:
    - the 3 `external_review` rows (BL-171): `external_access_grants`, `external_decision_batches`, `external_sessions`;
    - `audit_events` and `transaction_outbox` (`goproceed_app`): 2 of BL-172's 3 rows, on both planes, by the owner's choice.
  - The external-session branches of `requirement_evidence_decisions` and `requirement_evidence_decision_heads` (BL-182) are tested in the same file.
  - Migration `0109`:
    - adds the session's workspace to the WITH CHECK of the five external write policies that did not read it (BL-182);
    - narrows the UPDATE grants on `external_sessions`, `external_access_grants` and `requirement_evidence_decision_heads` to the columns their writers set (F1; the heads' part of BL-183);
    - narrows the INSERT grants on the three external tables to the columns their writers write.
  - The external decision route reads and advances only its session's own head (DEV-080 S2).
- State: reviewing
- Coordinator: Claude Code primary session, 2026-09-25.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): the change touches executed code under `packages/testing` and `apps/app`, a migration that changes policies and narrows grants, catalogs the validator reads, and `technical/data-access-surface.csv`. The route is `gp-architect` → owner decisions → implementation → mutations → `gp-reviewer` + `gp-security` → `gp-qa`.
- Triggered stages:
  - `gp-architect`: RLS policies, grants, and a `/external` route.
  - `gp-security`: RLS and grants, and external capability links and sessions.
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered.
- Owning module and allowed edit paths:
  - `supabase/migrations/0109_the_external_writes_that_named_no_workspace.sql` (new);
  - `packages/testing/src/external-review-write-rls.test.ts` (new);
  - `packages/testing/src/requirements-write-rls.test.ts` (the heads move-outs);
  - `apps/app/app/external/occurrence-decisions/route.ts` (the head statements);
  - `apps/app/tests/m5-external.int.test.ts` (one case);
  - `technical/database/rls-write-coverage.csv`;
  - `technical/data-access-surface.csv`: DA-048, DA-050, DA-099, DA-223, DA-224; DA-235 and DA-236 new;
  - `technical/database/invariant-catalog.csv` (INV-001, INV-060);
  - `scripts/validate-canonical-docs.mjs` (`RLS_WRITE_GAP_BASELINE` only);
  - `docs/delivery/test-strategy.md` (§4 annotation);
  - `docs/BACKLOG.md` (BL-171, BL-172, BL-182, BL-183; BL-198, BL-199 and BL-200 new), `docs/STATUS.md` (migrations row), this record, and `docs/tasks/README.md`.
- Read context:
  - [DEV-076](DEV-076-write-denial-minimum.md) … [DEV-084](DEV-084-evidence-write-denial.md);
  - `packages/testing/src/external-review-rls.test.ts`, `m5-external-rls.test.ts`, `m5-external-schema.test.ts`, `requirements-write-rls.test.ts`;
  - `supabase/migrations/0045_*`, `0049_*` and the guard triggers on the external tables;
  - `apps/app/src/lib/external-session.ts`, `apps/app/app/external/occurrence-decisions/route.ts`, `apps/app/app/v1/grants/[grantId]/revoke-reissue/route.ts`, `apps/app/app/v1/occurrences/[occurrenceId]/grants/route.ts`.
- Linked spec, ADR or earlier task: BL-171; BL-182; BL-172; BL-183; BL-099; INV-001; INV-060.
- Baseline: `origin/main` `b0c5b1ab` (after #165).
- Dependencies / constraints / out of scope:
  - BL-172's third row (`idempotency_records`) and BL-173 are out of scope.
  - The exchange (`app.exchange_external_link`) and `app.resolve_external_session` write as their owner and are unaffected by the grants.
  - Pushing `0103` … `0109` to `goproceed-staging` needs the owner's separate word.
  - The local database is this session's own disposable stack, started in the container. It holds no owner data, and no suite that resets it was run.
- Required acceptance criteria:
  - AC-1: each of the 5 rows cites one test meeting the minimum for every privilege it names, with its control succeeding, on both planes where the row has one. The external branches of the decision and head rows are tested the same way.
  - AC-2: each of these mutations fails a test, except where the mutant cannot be observed across workspaces or changes nothing, which is stated:
    - `WITH CHECK (true)` on every write policy of the seven tables, and `USING (true)` on every UPDATE policy;
    - each conjunct of those policies dropped;
    - `eag_insert`'s and `eag_update`'s capability inverted.
  - AC-3: `0109` changes the five policies and narrows the six grants. The write registry, the baseline, the DA rows, INV-001 and INV-060 agree with the database, and the database comparison in `rls-coverage.test.ts` passes.
  - AC-4: the route's three head statements filter by the session's workspace and occurrence. The route test runs in CI and passes.
  - AC-5: the validator and `typecheck` pass.
  - AC-6: CI green on the pull request, with the new suite and `m5-external.int.test.ts` shown running in the log.
- Skipped stages and rationale: see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | BL-182: add the session's workspace to the five external write policies in `0109`, rather than accept key-only protection in writing (Q1) | Owner's answer in the session («Add the check in 0109») |
| 2026-09-25 | Narrow the `external_sessions` UPDATE to `status` and the `external_access_grants` UPDATE to its three columns (Q2, Q3) | Owner's answer in the session («Narrow both») |
| 2026-09-25 | F2 (a decision's or rotated session's grant is not pinned to the session's own) filed as P3, BL-198 (Q4) | Owner's answer in the session («File as P3») |
| 2026-09-25 | Also: narrow the decision-heads UPDATE now (Q5, the heads' part of BL-183); cover the member plane of audit and outbox here (Q6); narrow the three external INSERT grants (Q7) | Owner's answer in the session (extras: «Narrow decision-heads UPDATE», «Member-plane audit & outbox», «Narrow external INSERT cols») |
| 2026-09-25 | F3 (a rotation bounds its own absolute expiry only in the route) filed as P3, BL-199; the stale DA rows DA-047, DA-049 and DA-091 filed as BL-200 | Coordinator, under the owner's standing order to close each stage and take the next |
| 2026-09-24 | The DEV-076 rulings apply; P1 | [DEV-076](DEV-076-write-denial-minimum.md) |

Q8 (pushing `0109` to `goproceed-staging`) is the owner's and stays open with `0103` … `0108`.

## Plan

1. `gp-architect`: a plan per row and plane.
2. `0109`, applied to the local database.
3. The route fix and its test; the heads move-outs of `requirements-write-rls.test.ts`.
4. The test file. Every write policy of the seven tables is mutated clause by clause.
5. The catalogs, the baseline, the docs and the record.
6. `gp-reviewer` + `gp-security`, then `gp-qa`; CI on the pull request.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | The plan:<br>• **F1:** `es_member_revoke`'s WITH CHECK is `status = 'revoked'` and `es_external_rotate_update`'s is `id = current session`. Neither re-reads the tenant, so with the guard trigger off an owner of A, or A's session on itself, could move a whole session into B. Every composite key resolves while nothing points at the session, which is the normal state before a submit. Fix: UPDATE on `status` only;<br>• **BL-182:** the external plane is the only one whose write policies do not read the tenant key; audit and outbox already use `app.external_session_workspace()`. Add it to five policies;<br>• the grants UPDATE narrowed to the revoke route's three columns;<br>• the route's head statements (DEV-080 S2), with a CI-only regression test that passes with or without the fix, since the policies already confine them;<br>• **F2**, **F3**, and the stale DA-047, DA-048, DA-049, DA-050 and DA-091;<br>• Q1–Q8 for the owner; no ADR, since nothing widens | Subagent report (session) | Owner |
| 2 | Coordinator | Owner decisions recorded. `0109` written and applied by hand as `postgres` with `-1`, then recorded in `schema_migrations`. Its self-check passes. The writers were read against the new grants: the two grant INSERTs, the session rotation, the batch INSERT, the grant and session revokes, and both head advances write only granted columns; no other `apps/app` path writes these tables | Session output | Route |
| 3 | Coordinator | The route's three head statements (the replay's read, the submit's read and the advance) now filter by `workspace_id = $1 and requirement_occurrence_id = $2 and approver_role = $3`, with `scope.workspaceId` and `scope.occurrenceId`. A case in `m5-external.int.test.ts` opens a head, advances it, reads it back as admin (`version 2`, `accepted`) and replays the advance (200, head version 2). CI only. `requirements-write-rls.test.ts`: the heads move-outs now expect a privilege refusal for the columns `0109` withdrew | `git diff` | Tests |
| 4 | Coordinator | The test file: 7 cases on a superuser connection under `SET LOCAL ROLE goproceed_app`, with the actor and external-session settings set per plane, each statement in a savepoint of a rolled-back transaction. `app.external_session_scope()` is a definer with no `session_user` check, so one harness serves both planes. `beforeAll` asserts no RETURNING in a probed statement, no INSERT trigger on the seven tables, and the session-scope premise. Local run: 7 of 7. The neighbouring suites also pass against `0109`:<br>• `rls-coverage` 31;<br>• `external-review-rls` 3;<br>• `m5-external-rls` 10;<br>• `m5-external-schema` 42;<br>• `requirements-write-rls` 9;<br>• `requirements-rls` 1;<br>• `outbox` 4;<br>• `privileges` 3. | Session output | Mutations |
| 5 | Coordinator | 54 mutations, each applied to one policy and restored from its stored text. The md5 of the policies was identical before and after (`6432fc4d…`).<br>**47 of 54 killed.** The 7 survivors were predicted before the run:<br>• `eag_update` WITH CHECK `true`: the grant's three columns cannot move the row, so WITH CHECK re-reads the capability USING has just admitted;<br>• `redh_external_update` WITH CHECK `true`, without its workspace, without its occurrence: neither column is granted for UPDATE, and USING already reads the occurrence;<br>• `redh_external_update` without `may_decide`: the same session-level function USING reads;<br>• `outbox_insert` and `outbox_insert_external` without `organization_id is not null`: the equality beside it is already false for a null.<br>One mutant expected to survive was killed: `es_external_rotate_update` WITH CHECK `true`. Permissive WITH CHECKs are OR'd across a command's policies, so the member plane's `status = 'expired'` update, which `es_member_revoke` refuses, passed through the external policy's `true` | `scratchpad/dev085-mutate.out` | Catalogs |
| 6 | Coordinator | Catalogs and docs:<br>• the write registry: 5 rows `covered`; the external rows and the heads row carry column-grant privileges in `WRITE_PRIVILEGES_SQL`'s format;<br>• the 5 keys removed from the baseline;<br>• DA-048 corrected; DA-050, DA-099, DA-223 and DA-224 updated; DA-235 (grants) and DA-236 (batches) added;<br>• INV-001 and INV-060 cite the file;<br>• `test-strategy.md` annotated;<br>• the `STATUS.md` migrations marker is `0109`;<br>• BL-171 and BL-182 scheduled; BL-172 and BL-183 annotated; BL-198, BL-199 and BL-200 (P3) filed.<br>The validator and `typecheck` pass | `git diff` | Reviews |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| F1 | major | `es_member_revoke`, `es_external_rotate_update`, whole-table UPDATE (0049) | A session could be moved into another workspace with the guard trigger off | Coordinator | Fixed in `0109`: UPDATE on `status` only; probed on both planes |
| F2 | low | Decision and rotation grant pins | A decision's or rotated session's grant is not tied to the session's own | Owner | Deferred to BL-198 (P3) |
| F3 | low | Rotation's absolute expiry | Bounded by the route alone; the grant's expiry still bounds it | Owner | Deferred to BL-199 (P3) |
| F4 | info | DA-047, DA-048, DA-049, DA-050, DA-091 | Stale rows | Coordinator | DA-048 and DA-050 fixed here; the rest filed as BL-200 |

Rework count and hypothesis changes: none.

## What is not true after this task

- `0103` … `0109` are on the local database only, not on `goproceed-staging`. The owner decides the push.
- BL-172's `idempotency_records` row and BL-173 are still gaps.
- The requirement UPDATE grants other than the heads' (the rest of BL-183) are still whole-table.
- BL-198, BL-199 and BL-200 (P3) stay open.
- The route test cannot fail on the pre-fix route, because the policies already confine those statements; it guards the route's own filters against a future policy change.
- A rollback of `0109` owes the registry, the DA rows, INV-001, the heads move-outs of `requirements-write-rls.test.ts` and the test's workspace, column and privilege probes too; the gap baseline no longer carries these rows.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 each row cites one test meeting the minimum, on both planes | Yes | | | | |
| AC-2 every listed mutation fails a test, or is stated | Yes | | | | |
| AC-3 `0109`, the registry, the baseline, the DA rows, INV-001, INV-060 | Yes | | | | |
| AC-4 the route's head statements and their test | Yes | | | | |
| AC-5 validator and typecheck | Yes | | | | |
| AC-6 CI green, the new suites in the log | Yes | | | | |

## Sources

- PostgreSQL 17 row security, observed on the local 17.6 stack, not read (DEV-076). A privilege refusal answers before any trigger or policy. The policy answers before CHECK, unique and foreign-key checks. Permissive policies' WITH CHECK expressions are OR'd per command (row 5).

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: `gp-architect` ran as an independent native subagent; the reviews follow.
- Verified scope: rows 1–6.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-reviewer` and `gp-security`.
- Final state and reason: reviewing.
