# DEV-017 — BL-102: the service plane's capture event is confined to the workspace it declares

## Assignment

- **Objective and user-visible outcome:** `ce_insert_server` stops admitting a server capture event on the strength of the caller's actor alone: a service transaction reaches only the workspace it declared, and the finalize path declares it. The last `gap` row of `technical/database/rls-coverage.csv` becomes `covered`, so the registry reaches zero gaps and readiness gate 11 becomes closable (the closing entry is a separate decision and needs the owner).
- **State:** reviewing
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
  7. `apps/app` integration suites that exercise finalize (`field-capture.int.test.ts`, `finalize-vanishing-bytes.int.test.ts`) — **not required**: the owner did not allow them (they truncate tenant tables).
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

## Plan

Numbered steps. For each step, name the files it touches and the check that proves it. A step that adds a contract, refusal or invariant starts with its failing test.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native) on `2894c1a` | **Design returned, read-only; no ADR.** The workspace term alone is not enough: `ce_insert_server`'s `exists` over `upload_intents` runs under the inherited actor-bound `ui_select`, so an empty-actor transaction could never satisfy it and the row's minimum would have to be a non-standard actor-bearing shape. Recommended `app.upload_intent_scope_matches` (SECURITY DEFINER, `stable`, no `raise` so a refusal stays 42501, execute for `goproceed_service` only) plus `workspace_id = app.service_workspace()`; a service `SELECT` policy on `upload_intents` would open a tenant table to answer one boolean, and the restrictive form is BL-101's sweep. The workspace is already an input (the tenant read returns the intent), so the caller sets it on the context rather than adopting it mid-transaction; the code change is safe against the old policy and must land first in a hosted push. Also noted: `recordFailure` today fails with 42501 when a member's capability was revoked mid-upload, which the definer fixes. Tests: a new file, four cases, of which «empty actor declaring A» and «entitled actor declaring B» are the discriminating red ones | architect report | Owner decisions |
| 2 | implementing (coordinator): red | The registry row cited the not-yet-written file: validator rc 1, 2 problems. `evidence-service-rls.test.ts` written. **At `0086`, alone: 2 of 2 failed for the defect** — the empty-actor transaction declaring A was refused (`42501` where `1` was expected, line 107) and the transaction carrying an actor entitled to A was admitted while declaring B (`1` where `42501` was expected, line 115) | `scratchpad/dev017-red-validator.txt`, `dev017-red-db.txt` | Migration and caller |
| 3 | implementing (coordinator): `0087` and the caller | Migration written as designed; `finalize-upload-intent.ts` builds `serviceCtx` from `intent.workspace_id` for all three service transactions, and `recordFailure`'s context type no longer admits a null workspace (a null one is now a type error). `authorize-upload-intent.ts:180` needs no change: it writes a device-sourced row on the tenant connection. Applied by hand with `docker exec -i … psql -U postgres -v ON_ERROR_STOP=1 -1 -f -` (one transaction; `CREATE FUNCTION`, `COMMENT`, `REVOKE`, `GRANT`, `ALTER POLICY`, `COMMENT`, self-check `DO`, rc 0) and recorded in `supabase_migrations.schema_migrations` by a separate insert. Afterwards `ce_insert_server` reads `event_source = 'server' and workspace_id = app.service_workspace() and app.upload_intent_scope_matches(...)`, and `ce_insert`/`ce_select` are unchanged | `scratchpad/dev017-apply-0087.txt`, `dev017-policies-0087.txt` | Green |
| 4 | implementing (coordinator): green | `evidence-service-rls.test.ts` alone at `0087`: **2 passed**. Adjacent suites at `0087`, one at a time: `m2-service-principal` 11, `evidence-rls` 3, `m5-external-rls` 10 passed. No `de17…` workspace and no `capture_events` row left. `@goproceed/app` and `@goproceed/testing` typecheck rc 0 | `scratchpad/dev017-green-db.txt`, `dev017-db-*.txt`, `dev017-typecheck-*.txt` | Documents |
| 5 | implementing (coordinator): documents | Registry **74 covered, 0 gap, 7 exempt**; BL-102 `closed → DEV-017` with dated evidence; DA-182 to DA-184 (`capture_events` had no row on either plane, and the new definer); INV-001 names `0087` and the new test; T-RLS-010; dated notes in readiness §11, runbook §5.11, §5.14 row 4 and its Q-9 push-order sentence, the tenancy note; STATUS (marker `0087`, the migration row, the M0 row, next actions). Every one of them says the gate is **closable, not closed**. Validator rc 0; `it.skip` on the cited test turns it red, restored. Final runs are taken after this row is written | `scratchpad/dev017-validator-docs.txt`, `dev017-mutation-skip.txt`, `dev017-final-*.txt` | Commit; `gp-reviewer`, `gp-security` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

- **Readiness gate 11 is not closed.** The registry has no gap left, but closing needs the unfiltered `pnpm --filter @goproceed/testing test` evidence run that `test-strategy.md` §4 names (it calls `resetDb`, so it resets the local database), a `rls-coverage.test.ts` run at `0087`, a dated entry in `docs/delivery/version-0.1.md` §M0 and the owner's agreement. The owner made that a separate task on 2026-09-18.
- **`0087` is on the local database only.** No hosted project has it, and a push must deploy the application build first, or every finalize fails with 42501 (runbook Q-9).
- **The `apps/app` integration suites that exercise finalize did not run** (`field-capture.int.test.ts`, `finalize-vanishing-bytes.int.test.ts`, and the credential-guarded ones): the owner did not allow them, because they truncate tenant tables. They are what would catch a wrong `serviceCtx` end to end.
- **An actor-bearing service transaction is still not confined in general** (BL-101, BL-019): it can insert a device-sourced row through the inherited `ce_insert` into any workspace its actor is entitled to, and it still reads through `ce_select`.
- **`covered` is the v0.1 read minimum**, and for this row the insert-denial shape; BL-099, BL-103 and BL-104 stay open.
- **Nothing ran in CI** (GitHub Actions billing until October 2026).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

The Limitation column opens with at most one qualifier from this closed set, then its detail:

- **PASS:** `negative` (the command correctly produced nothing, and the absence is the evidence); `assisted:` what had to be arranged by hand first; `owner-reported` (the owner's report, not a session observation).
- **FAIL:** `known-red baseline:` the named set of pre-existing failures, with no case outside it failing.
- **NOT RUN:** `environmental:` the cause and the command that settles it; `not-provable-locally:` what would settle it; or, with no qualifier, the reason: why it was deliberately not attempted, or why a PASS was earned for the wrong reason (`agents/roles/gp-qa.md`).

Gate records written before 2026-09-13 keep their own tokens; `docs/delivery/pilot-execution-runbook.md` §7.4 maps them onto this set.

## Sources

Third-party documentation and primary sources checked for this task. Give each one its URL, the installed version it applies to, its publication date if known (never substitute today's date) and the access date.

## Completion / handoff

- Changed / inspected files:
- Review independence: same-session / independent (name the actual stage roles)
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
