# DEV-017 — BL-102: the service plane's capture event is confined to the workspace it declares

## Assignment

- **Objective and user-visible outcome:** `ce_insert_server` stops admitting a server capture event on the strength of the caller's actor alone: a service transaction reaches only the workspace it declared, and the finalize path declares it. The last `gap` row of `technical/database/rls-coverage.csv` becomes `covered`, so the registry reaches zero gaps and readiness gate 11 becomes closable (the closing entry is a separate decision and needs the owner).
- **State:** done
- **Coordinator:** primary Claude Code session, 2026-09-18.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** an RLS policy change, a migration and the service-plane caller: `gp-architect` → failing test → migration `0087` + `finalize-upload-intent.ts` → `gp-reviewer` + `gp-security` → `gp-qa`, as DEV-015 (BL-100).
- **Triggered stages and why:** `gp-architect` (`supabase/migrations/**`, RLS); `gp-security` (RLS policy, evidence storage and uploads). `gp-ui-reviewer` and `gp-mobile` are not triggered.
- **Owning module and allowed edit paths:** `supabase/migrations/0087_the_server_fact_that_named_no_workspace.sql` (new); `apps/app/src/lib/evidence/finalize-upload-intent.ts`; `packages/testing/src/evidence-service-rls.test.ts` (new) and one comment in `packages/testing/src/evidence-rls.test.ts`; `technical/database/rls-coverage.csv` (the one row); `technical/data-access-surface.csv` (DA-182 to DA-184); `technical/database/invariant-catalog.csv` (INV-001); `technical/test-catalog.csv` (T-RLS-010); `docs/BACKLOG.md` (BL-102 closed); dated notes in `docs/delivery/production-readiness.md` §11, runbook §5.11 and §5.14 row 4, `docs/architecture/tenancy-and-security.md`; `docs/STATUS.md`; this record and the index. No grant, table, constraint or other policy changes.
- **Read context:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/BACKLOG.md` BL-102, BL-101; [DEV-015](DEV-015-projection-service-policy.md), [DEV-016](DEV-016-gate11-remaining-gaps.md), [DEV-013](DEV-013-m0-gate11-coverage-checker.md); `supabase/migrations/0035`, `0062`, `0083`, `0086`; `apps/app/src/lib/evidence/finalize-upload-intent.ts`; `packages/database/src/tx.ts`.
- **Linked spec, ADR or earlier task:** BL-102; DEV-016 (found it); DEV-015 (the precedent).
- **Baseline:** `2894c1a` (main after PR #97).
- **Dependencies / constraints / out of scope:** local database at `0086`; `0087` is applied locally by hand as `postgres` only with the owner's permission, never through `supabase db reset`, and never to a hosted project by this task; test files run only with the owner's permission, one at a time. Out of scope: BL-101, BL-103, BL-104, and the gate 11 closing entry itself (a separate owner decision).
- **Required acceptance criteria:**
  1. `evidence-service-rls.test.ts` is red at `0086` for the defect (an empty-actor transaction declaring A refused; one carrying an actor entitled to A admitted while declaring B) and green at `0087`; it seeds its own two workspaces, rolls every write back, cleans up, never calls `resetDb`, and leaves no residue.
  2. `0087` changes only `ce_insert_server` and adds `app.upload_intent_scope_matches` (SECURITY DEFINER, pinned `search_path`, executable by `goproceed_service` alone), carries a self-check, and applies cleanly at `0086`; `ce_insert`, `ce_select`, the `upload_intents` policies and every grant are unchanged.
  3. The finalize path declares the intent's workspace on all three service transactions, and that change is safe against the old policy (it ships in the same commit; a hosted push deploys the build first).
  4. The suites that touch these policies pass at `0087`: `m2-service-principal.test.ts`, `evidence-rls.test.ts`, `m5-external-rls.test.ts`.
  5. The registry reaches 74 `covered`, 0 `gap`, 7 `exempt_no_grant`; BL-102 closed → DEV-017; DA-182 to DA-184, INV-001, T-RLS-010, readiness §11, runbook, tenancy note and STATUS agree, and none of them claims gate 11 closed.
  6. `pnpm --filter @goproceed/app typecheck`, `pnpm --filter @goproceed/testing typecheck`, `pnpm validate:canonical-docs` and `pnpm validate:agents` pass; `it.skip` on the cited test turns the validator red.
  7. `apps/app` integration suites that exercise finalize (`field-capture.int.test.ts`, `finalize-vanishing-bytes.int.test.ts`) pass at `0087` — **required from 2026-09-18**, when the owner allowed them so criterion 3 could be settled by a run rather than by reading (they truncate tenant tables).
  8. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-ui-reviewer`, `gp-mobile`: not triggered.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-16 | RLS defects found go to separate DEV tasks with a migration, started with the failing test | chat, DEV-014 answer |
| 2026-09-18 | Start BL-102 now (after PR #97 was merged) | chat, «смержил, давай BL-102» |
| 2026-09-18 | Fix shape: the SECURITY DEFINER function, not a service `SELECT` policy on `upload_intents` and not the workspace term alone | chat, answer «SECURITY DEFINER-функция» |
| 2026-09-18 | Allowed: run the new `evidence-service-rls.test.ts`; apply `0087` by hand; run the adjacent `packages/testing` suites. Not allowed: the `apps/app` integration suites (they truncate tenant tables) | chat, multi-select answer |
| 2026-09-18 | Closing readiness gate 11 (the unfiltered evidence run and the `version-0.1.md` entry) is a separate task, not this one | chat, answer «Отдельной задачей» |
| 2026-09-18 | After QA: the two `apps/app` finalize integration suites may run, so criterion 3 is settled rather than revised | chat, answer «Разрешить два int-теста» |

## Plan

1. `gp-architect` design: the fix shape, the caller, the test cases, the ordering. → the owner's ruling.
2. Red: cite the unwritten test in the registry (validator), write `packages/testing/src/evidence-service-rls.test.ts`, run it at `0086` and show the defect.
3. Migration `0087` and `finalize-upload-intent.ts`; apply `0087` by hand; the same test green; the adjacent suites green.
4. Registry, catalogs and documents; the `it.skip` mutation; typechecks.
5. `gp-reviewer` + `gp-security` → stated fixes → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native) on `2894c1a` | **Design returned, read-only; no ADR.** The workspace term alone is not enough: `ce_insert_server`'s `exists` over `upload_intents` runs under the inherited actor-bound `ui_select`, so an empty-actor transaction could never satisfy it and the row's minimum would have to be a non-standard actor-bearing shape. Recommended `app.upload_intent_scope_matches` (SECURITY DEFINER, `stable`, no `raise` so a refusal stays 42501, execute for `goproceed_service` only) plus `workspace_id = app.service_workspace()`; a service `SELECT` policy on `upload_intents` would open a tenant table to answer one boolean, and the restrictive form is BL-101's sweep. The workspace is already an input (the tenant read returns the intent), so the caller sets it on the context rather than adopting it mid-transaction; the code change is safe against the old policy and must land first in a hosted push. Also noted: `recordFailure` today fails with 42501 when a member's capability was revoked mid-upload, which the definer fixes. Tests: a new file, four cases, of which «empty actor declaring A» and «entitled actor declaring B» are the discriminating red ones | architect report | Owner decisions |
| 2 | implementing (coordinator): red | The registry row cited the not-yet-written file: validator rc 1, 2 problems. `evidence-service-rls.test.ts` written. **At `0086`, alone: 2 of 2 failed for the defect** — the empty-actor transaction declaring A was refused (`42501` where `1` was expected, line 107) and the transaction carrying an actor entitled to A was admitted while declaring B (`1` where `42501` was expected, line 115) | `scratchpad/dev017-red-validator.txt`, `dev017-red-db.txt` | Migration and caller |
| 3 | implementing (coordinator): `0087` and the caller | Migration written as designed; `finalize-upload-intent.ts` builds `serviceCtx` from `intent.workspace_id` for all three service transactions, and `recordFailure`'s context type no longer admits a null workspace (a null one is now a type error). `authorize-upload-intent.ts:180` needs no change: it writes a device-sourced row on the tenant connection. Applied by hand with `docker exec -i … psql -U postgres -v ON_ERROR_STOP=1 -1 -f -` (one transaction; `CREATE FUNCTION`, `COMMENT`, `REVOKE`, `GRANT`, `ALTER POLICY`, `COMMENT`, self-check `DO`, rc 0) and recorded in `supabase_migrations.schema_migrations` by a separate insert. Afterwards `ce_insert_server` reads `event_source = 'server' and workspace_id = app.service_workspace() and app.upload_intent_scope_matches(...)`, and `ce_insert`/`ce_select` are unchanged | `scratchpad/dev017-apply-0087.txt`, `dev017-policies-0087.txt` | Green |
| 4 | implementing (coordinator): green | `evidence-service-rls.test.ts` alone at `0087`: **2 passed**. Adjacent suites at `0087`, one at a time: `m2-service-principal` 11, `evidence-rls` 3, `m5-external-rls` 10 passed. No `de17…` workspace and no `capture_events` row left. `@goproceed/app` and `@goproceed/testing` typecheck rc 0 | `scratchpad/dev017-green-db.txt`, `dev017-db-*.txt`, `dev017-typecheck-*.txt` | Documents |
| 5 | implementing (coordinator): documents | Registry **74 covered, 0 gap, 7 exempt**; BL-102 `closed → DEV-017` with dated evidence; DA-182 to DA-184 (`capture_events` had no row on either plane, and the new definer); INV-001 names `0087` and the new test; T-RLS-010; dated notes in readiness §11, runbook §5.11, §5.14 row 4 and its Q-9 push-order sentence, the tenancy note; STATUS (marker `0087`, the migration row, the M0 row, next actions). Every one of them says the gate is **closable, not closed**. Validator rc 0; `it.skip` on the cited test turns it red, restored. Final runs are taken after this row is written | `scratchpad/dev017-validator-docs.txt`, `dev017-mutation-skip.txt`, `dev017-final-*.txt` | Commit; `gp-reviewer`, `gp-security` |
| 6 | reviewing (`gp-reviewer`, `gp-security`, native) on `e7e35aa` | **`gp-reviewer`: APPROVE** — the migration is correct (the workspace term is NULL-safe, the definer answers false for a null intent, `ce_insert`/`ce_select`/`upload_intents` untouched), the ordering claim independently confirmed (`app.organization_id` is read only by `app.service_workspace()` and 0081's erasure sweep; no restrictive policy anywhere; the three upload definers read neither), and the actor-bearing control is admitted by the intended policy because `ce_insert` forbids `event_source='server'`. R1-01 to R1-09 minor and nits. **`gp-security`: PASS** — no other write path (no UPDATE or DELETE policy on the table, no definer or trigger writes it, two application writers only), the definer is a safe surface, and setting the GUC can only widen; S1-01 to S1-06 minor and informational | review reports | Stated fixes |
| 7 | rework (coordinator), stated fixes | **The definer now validates its own contract** (S1-01, R1-05): `pg_catalog.pg_has_role(session_user, 'goproceed_service', 'member') and p_workspace = app.service_workspace()` precede the `exists`, so a direct call cannot become a cross-workspace existence oracle even if the grant were ever restored by a `create or replace`. The header states the owner-bypass assumption and why the self-check asserts the whole access list (R1-04), and the reverse-order outage (S1-02), which the runbook's Q-9 note repeats. **The cited test gained the binding case** (R1-03): declaring A with a project the intent does not belong to is refused — the one term the composite foreign key does not cover. **The registry's negative column now cites the actor-bearing test** (R1-02), where BL-102's defect lived, and T-RLS-010 names both cases. `recordAudit`/`enqueueOutbox` take `serviceCtx` (R1-09); the two dates corrected (S1-03, R1-08); BL-105 and BL-106 added for the informational findings (S1-04, S1-06). Criterion 3 is recorded NOT RUN (R1-06), and the record's empty sections are filled (R1-07). **After the rework:** `0087` re-applied (rc 0, self-check passed); `evidence-service-rls` 2, `m2-service-principal` 11, `evidence-rls` 3 passed at `0087`; no residue | `scratchpad/dev017-r1-apply.txt`, `dev017-r1-db-*.txt`, `dev017-r1-validator.txt` | `gp-qa` |
| 8 | verifying (`gp-qa`, native) on `4681b65` | **Verified for the scoped criteria:** 1, 2, 4, 5, 6 PASS on its own runs (the new test 2, `m2-service-principal` 11, `evidence-rls` 3, `m5-external-rls` 10 passed; typechecks, validator and agents rc 0; registry 74/0/7 counted CSV-aware; the deployed function is a definer with a pinned `search_path`, executable only by `goproceed_service`; `capture_events` still carries three policies and the stored `with_check` really conjoins its three terms). Criterion 3 NOT RUN (no test exercised the caller), 7 and 8 NOT RUN. New: Q1-01 minor (the acceptance table and handoff were empty), Q1-02 minor (the `it.skip` evidence predated the negative citation added in rework), Q1-03 and Q1-04 informational (BL-105 absent from «What is not true»; the `pg_has_role` conjunct couples the policy to the service login's role graph) | QA report | Owner decision on criterion 3; stated fixes |
| 9 | closing (coordinator) | Owner allowed the two finalize integration suites (2026-09-18), so **criterion 3 is settled by a run**: at `0087`, `field-capture.int.test.ts` 5 passed and `finalize-vanishing-bytes.int.test.ts` 1 passed — the whole finalize path, both the success and the failure branch, through the declaring `serviceCtx`. Q1-02: the `it.skip` mutation re-run on the actor-bearing citation turns the validator red naming the negative column, restored. Q1-03: BL-105 named in «What is not true». Q1-04: the migration header and the runbook Q-9 note state that the service connection must authenticate as a member of `goproceed_service` or every finalize fails closed. Q1-01: this table and the handoff filled | `scratchpad/dev017-int-field-capture.txt`, `dev017-int-finalize.txt`, `dev017-mutation-skip-negative.txt` | Push, PR |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| Q1-01 | minor | The record's acceptance table and handoff | Actual: empty at a revision whose documents already assert the results | coordinator | Filled (row 9) |
| Q1-02 | minor | `dev017-mutation-skip.txt` | Actual: predates the negative citation added in rework | coordinator | Re-run on the actor-bearing test, red on the negative column (row 9) |
| Q1-03 | informational | «What is not true» | Actual: BL-105 unstated | coordinator | Named (row 9) |
| Q1-04 | informational | The `pg_has_role` conjunct | Actual: a service login outside the role graph fails closed, unstated | coordinator | Stated in the `0087` header and the runbook Q-9 note (row 9) |
| S1-01 / R1-05 | minor | `0087` function body | Actual: the definer validated neither its caller nor the declared workspace | coordinator | Both conjuncts added, `pg_has_role` and `p_workspace = app.service_workspace()` (row 7) |
| S1-02 | minor | `0087` header; runbook Q-9 note | Actual: only the forward deploy order stated | coordinator | The reverse order (an application rollback past this commit) named in both (row 7) |
| R1-01 | minor | Runbook §5.14 row 4 | Actual: unbalanced `**` swallowed the emphasis | coordinator | Fixed (row 7) |
| R1-02 | minor | Registry row citations | Actual: both columns cited the empty-actor test only | coordinator | The negative column cites the actor-bearing test; T-RLS-010 names both (row 7) |
| R1-03 | minor | `evidence-service-rls.test.ts` | Actual: the project-binding half was untested | coordinator | A case with a project the intent does not belong to, refused 42501 (row 7) |
| R1-04 | minor | `0087` | Actual: the owner-bypass assumption and `create or replace` unstated | coordinator | Stated in the header; **not changed**: `create or replace` stays so the file can be re-applied (the policy depends on the function, so a drop needs the policy first), and the self-check asserts the whole access list |
| R1-06 | minor | Criterion 3 | Actual: no test exercises the finalize caller | coordinator | Recorded NOT RUN with the command that settles it |
| R1-07 | minor | The record's empty sections | Actual: Plan, findings, acceptance, sources, handoff blank | coordinator | Filled (rows 7 and the closing row) |
| R1-08 / S1-03 | nit | BL-102 evidence; STATUS migrations row | Actual: `0087` dated 2026-09-17; both applies dated 2026-09-18 | coordinator | Each apply keeps its own date (row 7) |
| R1-09 | nit | `finalize-upload-intent.ts:207,211` | Actual: a null-workspace context still passed inside a declaring transaction | coordinator | `serviceCtx` everywhere (row 7) |
| S1-04 | informational | `capture_events.work_assignment_id` | Actual: bound by nothing | coordinator | **BL-105** (P3), pre-existing |
| S1-05 | informational | `apps/app` finalize int suites | Actual: NOT RUN (owner did not allow) | coordinator | Recorded in the acceptance table and «What is not true» |
| S1-06 | informational | `app.service_workspace()` | Actual: no pinned `search_path` | coordinator | **BL-106** (P3), pre-existing |

Rework count and hypothesis changes: none — no QA FAIL and no blocker.

## What is not true after this task

- **Readiness gate 11 is not closed.** The registry has no gap left, but closing needs the unfiltered `pnpm --filter @goproceed/testing test` evidence run that `test-strategy.md` §4 names (it calls `resetDb`, so it resets the local database), a `rls-coverage.test.ts` run at `0087`, a dated entry in `docs/delivery/version-0.1.md` §M0 and the owner's agreement. The owner made that a separate task on 2026-09-18.
- **`0087` is on the local database only.** No hosted project has it, and a push must deploy the application build first, or every finalize fails with 42501 (runbook Q-9).
- **Two finalize integration suites ran and passed** (`field-capture.int.test.ts`, `finalize-vanishing-bytes.int.test.ts`, owner-allowed on 2026-09-18); the other credential-guarded `apps/app` suites did not run.
- **An actor-bearing service transaction is still not confined in general** (BL-101, BL-019): it can insert a device-sourced row through the inherited `ce_insert` into any workspace its actor is entitled to, and it still reads through `ce_select`.
- **`covered` is the v0.1 read minimum**, and for this row the insert-denial shape; BL-099, BL-103 and BL-104 stay open.
- **The capture event's work assignment is still bound by nothing** (BL-105): `0087` binds the workspace, the intent and the project, so a defective service transaction declaring A may still write a row of A naming another workspace's `work_assignment_id`.
- **Nothing ran in CI** (GitHub Actions billing until October 2026).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. The test is red at `0086` for the defect and green at `0087`; isolated, rolled back, clean | yes | `4681b65` + row 9 | `dev017-red-db.txt` (2 failed: the empty-actor positive and the actor-bearing case), `dev017-r1-db-evidence-service-rls.txt` (2 passed); `gp-qa`'s own run and residue check | PASS | assisted: local database only; the project-binding case added in rework has no red-at-`0086` proof (it was written after the migration was applied) |
| 2. `0087` changes only `ce_insert_server` and adds the definer; self-check; applies cleanly | yes | `4681b65` | `dev017-apply-0087.txt`, `dev017-r1-apply.txt` (rc 0 twice), `dev017-policies-0087.txt`; `gp-qa` read the deployed policy, the policy count and the function's ACL | PASS | assisted: the self-check asserts the three terms are present, not conjoined; `gp-qa` confirmed the stored policy conjoins them |
| 3. The finalize path declares the intent's workspace, and the change is safe against the old policy | yes | `4681b65` | `dev017-int-field-capture.txt` (5 passed), `dev017-int-finalize.txt` (1 passed) at `0087`; the ordering argument checked independently by `gp-reviewer` and `gp-security` | PASS | assisted: owner-allowed runs on 2026-09-18; they truncate tenant tables |
| 4. `m2-service-principal`, `evidence-rls`, `m5-external-rls` pass at `0087` | yes | `4681b65` | `dev017-r1-db-*.txt`, `dev017-db-m5-external-rls.txt`; `gp-qa`'s own runs (11, 3, 10 passed) | PASS | — |
| 5. Registry 74/0/7; BL-102 closed; catalogs and documents agree; nothing claims the gate closed | yes | `4681b65` | `gp-qa`'s CSV-aware count and reading; BL-102, BL-105, BL-106; DA-182 to DA-184; INV-001; T-RLS-010 | PASS | — |
| 6. Typechecks, validator, agent profiles; `it.skip` turns the validator red | yes | `4681b65` + row 9 | `dev017-r1-typecheck-app.txt`, `-testing.txt`, `dev017-r1-validator.txt`, `dev017-r1-agents.txt` (rc 0); `dev017-mutation-skip.txt` and `dev017-mutation-skip-negative.txt` (one per cited column) | PASS | — |
| 7. The two `apps/app` finalize integration suites pass at `0087` | yes (from 2026-09-18) | `4681b65` | `dev017-int-field-capture.txt`, `dev017-int-finalize.txt` | PASS | assisted: run with the local DB URLs; they truncate tenant tables |
| 8. CI `verify` on the PR head | no | — | — | NOT RUN | environmental: GitHub Actions starts no jobs until October 2026; settled by CI `verify` on the PR head |

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

The Limitation column opens with at most one qualifier from this closed set, then its detail:

- **PASS:** `negative` (the command correctly produced nothing, and the absence is the evidence); `assisted:` what had to be arranged by hand first; `owner-reported` (the owner's report, not a session observation).
- **FAIL:** `known-red baseline:` the named set of pre-existing failures, with no case outside it failing.
- **NOT RUN:** `environmental:` the cause and the command that settles it; `not-provable-locally:` what would settle it; or, with no qualifier, the reason: why it was deliberately not attempted, or why a PASS was earned for the wrong reason (`agents/roles/gp-qa.md`).

Gate records written before 2026-09-13 keep their own tokens; `docs/delivery/pilot-execution-runbook.md` §7.4 maps them onto this set.

## Sources

Third-party documentation and primary sources checked for this task. Give each one its URL, the installed version it applies to, its publication date if known (never substitute today's date) and the access date.

- PostgreSQL 17 `CREATE POLICY` — https://www.postgresql.org/docs/17/sql-createpolicy.html — server 17.6; accessed 2026-09-16 (DEV-014). `WITH CHECK` is enforced before other constraints, and permissive policies combine with `OR`.
- PostgreSQL 17 `CREATE FUNCTION` (`SECURITY DEFINER`, `search_path`) — https://www.postgresql.org/docs/17/sql-createfunction.html — server 17.6; accessed 2026-09-18. A definer runs with the owner's privileges, so the function's own `search_path` is pinned and its references are schema-qualified.

## Completion / handoff

- Changed / inspected files: see «Owning module and allowed edit paths»; commits `e7e35aa` (implementation), `4681b65` (review round 1), and the closing commit.
- Review independence: independent — `gp-architect` (design), `gp-reviewer` (APPROVE), `gp-security` (PASS), `gp-qa` on `4681b65`, all native subagents. No rework round was counted: no QA FAIL and no blocker.
- Verified scope: criteria 1–7 PASS; criterion 8 NOT RUN, not required.
- Remaining risks / blocked requirements: «What is not true» above; BL-101, BL-103, BL-104, BL-105, BL-106; `0087` is on the local database only, and a hosted push must deploy the application build first.
- Next bounded action and owner: owner — review and merge the PR. Then the readiness gate 11 closing task (the unfiltered `pnpm --filter @goproceed/testing test` evidence run, which resets the local database, a `rls-coverage.test.ts` run at `0087`, the `version-0.1.md` §M0 entry) and BL-104.
- Final state and reason: done — every required criterion PASS; every finding fixed, recorded or deliberately not changed with its reason.
