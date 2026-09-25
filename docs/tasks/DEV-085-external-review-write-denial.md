# DEV-085 — BL-171 and BL-182: the cross-workspace write minimum for the external review rows

## Assignment

- Objective and user-visible outcome:
  - No user-visible change.
  - Five rows of `technical/database/rls-write-coverage.csv` become `covered`, each citing a test in `packages/testing/src/external-review-write-rls.test.ts` in the shape the DEV-076 minimum sets:
    - the 3 `external_review` rows (BL-171): `external_access_grants`, `external_decision_batches`, `external_sessions`;
    - `audit_events` and `transaction_outbox` (`goproceed_app`): 2 of BL-172's 3 rows, on both planes, by the owner's choice.
  - The external-session branches of `requirement_evidence_decisions` and `requirement_evidence_decision_heads` (BL-182) are tested in the same file.
  - Migration `0109`:
    - adds the session's workspace to the WITH CHECK of the four external INSERT policies and `redh_external_update` (BL-182); the session rotation's UPDATE stays pinned by the current session's id, and the `status`-only grant keeps it from moving the row;
    - narrows the UPDATE grants on `external_sessions`, `external_access_grants` and `requirement_evidence_decision_heads` to the columns their writers set (F1; the heads' part of BL-183);
    - narrows the INSERT grants on the three external tables to the columns their writers write.
  - The external decision route reads and advances only its session's own head (DEV-080 S2).
- State: done
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
  - AC-2: each of these mutations fails a test in `external-review-write-rls.test.ts` or `requirements-write-rls.test.ts`, except where the mutant cannot be observed across workspaces or changes nothing, which is stated:
    - `WITH CHECK (true)` on each of the 16 write policies of the seven tables, and `USING (true)` on each of their 5 UPDATE policies;
    - each conjunct of those policies dropped, and a lone capability replaced by «an active member of the workspace»;
    - the capability inverted in `eag_insert`, `eag_update`, `red_insert`, `redh_insert` and `redh_update`.
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
4. The test file. Every write policy of the seven tables is mutated clause by clause (row 5; the member policies and the membership conjuncts were added after `gp-reviewer` R1).
5. The catalogs, the baseline, the docs and the record.
6. `gp-reviewer` + `gp-security`, then `gp-qa`; CI on the pull request.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | The plan:<br>• **F1:** `es_member_revoke`'s WITH CHECK is `status = 'revoked'` and `es_external_rotate_update`'s is `id = current session`. Neither re-reads the tenant, so with the guard trigger off an owner of A, or A's session on itself, could move a whole session into B. Every composite key resolves while nothing points at the session, which is the normal state before a submit. Fix: UPDATE on `status` only;<br>• **BL-182:** the external plane is the only one whose write policies do not read the tenant key; audit and outbox already use `app.external_session_workspace()`. Add it to five policies;<br>• the grants UPDATE narrowed to the revoke route's three columns;<br>• the route's head statements (DEV-080 S2), with a CI-only regression test that passes with or without the fix, since the policies already confine them;<br>• **F2**, **F3**, and the stale DA-047, DA-048, DA-049, DA-050 and DA-091;<br>• Q1–Q8 for the owner; no ADR, since nothing widens | Subagent report (session) | Owner |
| 2 | Coordinator | Owner decisions recorded. `0109` written and applied by hand as `postgres` with `-1`, then recorded in `schema_migrations`. Its self-check passes. The writers were read against the new grants: the two grant INSERTs, the session rotation, the batch INSERT, the grant and session revokes, and both head advances write only granted columns; no other `apps/app` path writes these tables | Session output | Route |
| 3 | Coordinator | The route's three head statements (the replay's read, the submit's read and the advance) now filter by `workspace_id = $1 and requirement_occurrence_id = $2 and approver_role = $3`, with `scope.workspaceId` and `scope.occurrenceId`. A case in `m5-external.int.test.ts` opens a head, advances it, reads it back as admin (`version 2`, `accepted`) and replays the advance (200, head version 2). CI only. `requirements-write-rls.test.ts`: the heads move-outs now expect a privilege refusal for the columns `0109` withdrew | `git diff` | Tests |
| 4 | Coordinator | The test file: 7 cases on a superuser connection under `SET LOCAL ROLE goproceed_app`, with the actor and external-session settings set per plane, each statement in a savepoint of a rolled-back transaction. `app.external_session_scope()` is a definer with no `session_user` check, so one harness serves both planes. `beforeAll` asserts no RETURNING in a probed statement, no INSERT trigger on the seven tables, and the session-scope premise. Local run: 7 of 7. The neighbouring suites also pass against `0109`:<br>• `rls-coverage` 31;<br>• `external-review-rls` 3;<br>• `m5-external-rls` 10;<br>• `m5-external-schema` 42;<br>• `requirements-write-rls` 9;<br>• `requirements-rls` 1;<br>• `outbox` 4;<br>• `privileges` 3. | Session output | Mutations |
| 5 | Coordinator | 54 mutations, each applied to one policy and restored from its stored text. The md5 of the policies was identical before and after (`6432fc4d…`).<br>**47 of 54 killed.** The 7 survivors were predicted before the run:<br>• `eag_update` WITH CHECK `true`: the grant's three columns cannot move the row, so WITH CHECK re-reads the capability USING has just admitted;<br>• `redh_external_update` WITH CHECK `true`, without its workspace, without its occurrence: neither column is granted for UPDATE, and USING already reads the occurrence;<br>• `redh_external_update` without `may_decide`: the same session-level function USING reads;<br>• `outbox_insert` and `outbox_insert_external` without `organization_id is not null`: the equality beside it is already false for a null.<br>One mutant expected to survive was killed: `es_external_rotate_update` WITH CHECK `true`. Permissive WITH CHECKs are OR'd across a command's policies, so the member plane's `status = 'expired'` update, which `es_member_revoke` refuses, passed through the external policy's `true`.<br>That sweep ran against this file alone and left out `red_insert`, `redh_insert`, `redh_update`, and `audit_insert`'s and `outbox_insert`'s actor and `active` conjuncts (`gp-reviewer` R1). They were swept after the review; see row 9 | `scratchpad/dev085-mutate.out` | Catalogs |
| 6 | Coordinator | Catalogs and docs:<br>• the write registry: 5 rows `covered`; the external rows and the heads row carry column-grant privileges in `WRITE_PRIVILEGES_SQL`'s format;<br>• the 5 keys removed from the baseline;<br>• DA-048 corrected; DA-050, DA-099, DA-223 and DA-224 updated; DA-235 (grants) and DA-236 (batches) added;<br>• INV-001 and INV-060 cite the file;<br>• `test-strategy.md` annotated;<br>• the `STATUS.md` migrations marker is `0109`;<br>• BL-171 and BL-182 scheduled; BL-172 and BL-183 annotated; BL-198, BL-199 and BL-200 (P3) filed.<br>The validator and `typecheck` pass | `git diff` | Reviews |
| 7 | gp-security | PASS, no blocker or major, on `1a0384f6`.<br>• Every writer fits the narrowed grants column for column: occurrence grant issue (16 of the 17), revoke-reissue (its `FOR UPDATE`, the grant and session revokes, the successor's 17), rotation (the 10; its retirement sets `status`), the batch's 14, and both head advances; the Telegram path goes through `recordEvidenceDecision`. The exchange and `resolve_external_session` run as their owner; `goproceed_service` inherits `goproceed_app` and is narrowed with it.<br>• No granted column moves or forges a row of B.<br>• The `SET LOCAL ROLE` harness is sound: no policy reads `session_user`.<br>• F2 and F3 are correctly P3: the routes cannot reach them.<br>• `0109` is safe to apply before or after the code.<br>Findings S1–S5 (below) | Subagent report (session) | Fixes |
| 8 | gp-reviewer | HOLD on R1 alone, on `1a0384f6`: the sweep was narrower than AC-2 claimed, and `0109` made DEV-080's `redh_update` WITH CHECK kill unobservable without saying so. The code, the migration and the tests are sound; every probe fails for the reason it asserts; the registry strings match `WRITE_PRIVILEGES_SQL`; the route's parameters bind in order. Findings R1–R9 (below) | Subagent report (session) | Fixes |
| 9 | Coordinator | Fixes:<br>• **S1:** three probes: an external session issuing a link (policy), an external session's confined UPDATE of links (0 rows, B unchanged), a member's batch (policy).<br>• **R1:** a second sweep of 15 mutants on the three member policies and the two membership conjuncts, against both suites: 8 killed. The fixture then gained a suspended membership of A's owner in B, and a rerun of the four membership mutants killed both `m.status = 'active'` drops. Survivors, each unobservable across workspaces:<br>&nbsp;&nbsp;– `redh_update` WITH CHECK `true`, and without its project: `0109` withdrew UPDATE on the project and the tenant key, so the new row's project is the one USING admitted. This supersedes that part of DEV-080's AC-2; the move is now closed by privilege;<br>&nbsp;&nbsp;– `redh_update` USING without its project: A's owner decides on every project of A, and holds nothing in B;<br>&nbsp;&nbsp;– `audit_insert` and `outbox_insert` without `m.user_id = app.current_actor()`: the EXISTS reads `memberships` under its own SELECT policies, which admit the actor's own rows and the rows of a workspace it is active in, so B's memberships stay invisible.<br>Across the sweeps, 69 mutants, 57 killed, and the 12 survivors are all stated. `eag_update`'s lone capability was not replaced by «an active member»: that mutant lies between the original and survivor #7 (WITH CHECK `true`), so it survives too (gp-qa Q3). The policies' md5 was the same before and after each sweep.<br>• **R2:** DA-050 reads `INSERT`, consumer `bff_external`. **R3:** INV-001, `0109`'s header and the objective name the five policies and the rotation's pin. **R4:** the decision and head registry rows name their external cases in `reason`. **R6:** DA-224, DA-235 and DA-048 worded. **R7:** `0109`'s rollback as separate grants; §3's planes. **R8** and **R5:** the file header. **R9:** the route's stale header annotated. **S4:** in BL-198's fix. **S5:** in DA-048.<br>7 of 7 pass; the validator and `typecheck` pass | `scratchpad/dev085-mutate-2.out`, `-3.out`; session output | gp-qa |
| 10 | gp-qa | AC-1 … AC-5 PASS on `180d4c74`; every finding fix confirmed.<br>• `external-review-write-rls` 7 of 7; the 16 citations to the two write suites, the two `reason` cells included, match their titles exactly.<br>• Its own sweep of all 69 mutants at HEAD against both suites: 57 killed, the same 12 survivors; every kill names an `it`, never `beforeAll`; md5 unchanged.<br>• `0109` in the database: the five WITH CHECKs, the column ACLs equal to the registry strings, and no whole-table UPDATE or INSERT on the narrowed tables for any `goproceed_%` role.<br>• The suspended membership changes no other case's meaning, and `afterAll` leaves nothing.<br>• The neighbouring suites pass: `requirements-write-rls`, `rls-coverage`, `external-review-rls`, `m5-external-rls`, `m5-external-schema`, `requirements-rls`, `outbox`, `privileges`.<br>• Q1–Q3 (below), wording only | Subagent report (session) | CI |
| 11 | Coordinator | PR #166 CI green on `180d4c74` (run 36164517143: `verify`, `app-qa`). The `verify` log shows, on CI's migrated database: `external-review-write-rls` 7 of 7, `requirements-write-rls` 9, `rls-coverage` 31, and `m5-external.int.test.ts` 28 of 28 with «reads and advances only the session's own head — insert, update and replay (DEV-085, BL-182 S2)». Merged in #166 (`f3f994b2`). Q1–Q3 fixed in the closure | CI job log | Done |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| F1 | major | `es_member_revoke`, `es_external_rotate_update`, whole-table UPDATE (0049) | A session could be moved into another workspace with the guard trigger off | Coordinator | Fixed in `0109`: UPDATE on `status` only; probed on both planes |
| F2 | low | Decision and rotation grant pins | A decision's or rotated session's grant is not tied to the session's own | Owner | Deferred to BL-198 (P3) |
| F3 | low | Rotation's absolute expiry | Bounded by the route alone; the grant's expiry still bounds it | Owner | Deferred to BL-199 (P3) |
| F4 | info | DA-047, DA-048, DA-049, DA-050, DA-091 | Stale rows | Coordinator | DA-048 and DA-050 fixed here; the rest filed as BL-200 |
| S1 | minor | The grants and batches cases | The planes with no write policy were not asserted | Coordinator | Fixed: three probes (row 9) |
| S2 | info | `0109`'s self-check | Pins 6 withdrawn columns, not all | — | No action: the registry and `rls-coverage` compare the full lists |
| S3 | info | `0109`'s `set local lock_timeout` | Only inside a transaction | — | No action: as `0095`, `0108` (DEV-084 N2); that the hosted apply runs the file in one transaction is to be confirmed at the owner's push |
| S4 | info | BL-198 | Keys would pin the grants structurally | Coordinator | Fixed: added to BL-198's fix |
| S5 | info | `es_member_revoke`, `es_external_rotate_update` | Their WITH CHECKs still do not read the tenant | Coordinator | Fixed: recorded in DA-048 |
| R1 | major | This record, AC-2, row 5 | The sweep was narrower than claimed; DEV-080's `redh_update` kill silently cancelled | Coordinator | Fixed: second sweep, a fixture membership, AC-2 restated, supersession recorded (row 9) |
| R2 | minor | DA-050 | `SELECT` listed beside a note saying it was revoked | Coordinator | Fixed |
| R3 | minor | INV-001, `0109`, the objective | «the external plane's write policies» overstated | Coordinator | Fixed |
| R4 | minor | The decision and head registry rows | The external cases cited by nothing checked | Coordinator | Fixed: named in `reason` |
| R5 | info | Mixed rows breaking two keys | The named key answers first | Coordinator | Fixed: stated in the file header |
| R6 | nit | DA-224, DA-235, DA-048 | Wording | Coordinator | Fixed |
| R7 | nit | `0109`'s header | The rollback's grant read as UPDATE on batches; §3's plane | Coordinator | Fixed |
| R8 | nit | The file header | The session guard is not disabled | Coordinator | Fixed |
| R9 | info | The route's header | «INV-007's replay is unreachable» stale since `0055` | Coordinator | Fixed: annotated |
| Q1 | nit | INV-060, the test file's header | R3's wording left in two places | Coordinator | Fixed in the closure |
| Q2 | info | DA-099 | Consumer `bff` beside an external writer | Coordinator | Fixed in the closure: `bff_external` |
| Q3 | info | AC-2, row 9; DEV-080 | `eag_update`'s lone-capability replacement not run; DEV-080's `redh_update` kills not annotated | Coordinator | Fixed in the closure: row 9 says why it survives; DEV-080's AC-2 annotated |

Rework count and hypothesis changes: none. The fixes are the findings' stated fixes, except that R1's also adds one fixture row (a suspended membership of A's owner in B), which only adds probes' reach and changes no product code; `gp-qa` checks it, and `gp-reviewer` does not rerun.

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
| AC-1 each row cites one test meeting the minimum, on both planes | Yes | `180d4c74` | gp-qa 7 of 7, citations exact; CI 7 of 7 (rows 10, 11) | PASS | |
| AC-2 every listed mutation fails a test, or is stated | Yes | `180d4c74` | 57 of 69 killed, reproduced in full by gp-qa; the 12 survivors stated (rows 5, 9, 10) | PASS | Local 17.6 stack |
| AC-3 `0109`, the registry, the baseline, the DA rows, INV-001, INV-060 | Yes | `180d4c74` | gp-qa's database checks; `rls-coverage` 31 locally and on CI (rows 10, 11) | PASS | |
| AC-4 the route's head statements and their test | Yes | `180d4c74` | gp-qa's reading of the bindings; the CI case passes (rows 10, 11) | PASS | The test cannot fail on the pre-fix route |
| AC-5 validator and typecheck | Yes | `180d4c74` | validator OK; both typechecks exit 0 | PASS | Node 22 locally |
| AC-6 CI green, the new suites in the log | Yes | `180d4c74` | run 36164517143: `verify` and `app-qa` success; both suites in the log | PASS | |

## Sources

- PostgreSQL 17 row security, observed on the local 17.6 stack, not read (DEV-076). A privilege refusal answers before any trigger or policy. The policy answers before CHECK, unique and foreign-key checks. Permissive policies' WITH CHECK expressions are OR'd per command (row 5).

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: `gp-architect`, `gp-security`, `gp-reviewer` and `gp-qa` ran as independent native subagents.
- Verified scope: rows 1–11.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: BL-172's `idempotency_records` row, then BL-173. Pushing `0103` … `0109` to staging is the owner's.
- Final state and reason: done — every required criterion PASS; #166 merged with CI green (row 11).
