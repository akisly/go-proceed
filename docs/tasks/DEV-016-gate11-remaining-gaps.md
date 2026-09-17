# DEV-016 — Readiness gate 11: tenant-isolation tests for the remaining gap rows

## Assignment

- **Objective and user-visible outcome:** the 22 remaining `gap` rows of `technical/database/rls-coverage.csv` — contract_baseline (BL-091, 8), evidence (BL-092, 4), execution (BL-093, 3), external_review (BL-094, 3), operational (BL-095, 3), requirements (BL-097, 1) — become `covered` in the v0.1 read minimum, or, where a policy cannot meet it, stay a gap with a new backlog entry for a separate migration task. If the registry reaches zero gaps and the owner agrees, readiness gate 11 gets its dated evidence entry.
- **State:** reviewing
- **Coordinator:** primary Claude Code session, 2026-09-17.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** new tests over RLS policies and a registry under `technical/database/`: `gp-architect` → coordinator implements (red first) → `gp-reviewer` + `gp-security` → `gp-qa`, as DEV-014.
- **Triggered stages and why:** `gp-architect` (`technical/database/**`, RLS verification); `gp-security` (tenant-isolation evidence). `gp-ui-reviewer` and `gp-mobile` are not triggered.
- **Owning module and allowed edit paths:** six new files `packages/testing/src/{contract-baseline,evidence,execution,external-review,operational,requirements}-rls.test.ts`; `technical/database/rls-coverage.csv` (the 22 rows); `technical/test-catalog.csv` (T-RLS-004 to T-RLS-009); `docs/BACKLOG.md` (BL-091 to BL-095 and BL-097 closed; BL-102, BL-103 new); dated notes in `docs/delivery/test-strategy.md` §4, `docs/delivery/production-readiness.md` §11, runbook §5.11 and §5.14 row 4, `docs/architecture/tenancy-and-security.md`; `docs/STATUS.md`; this record and the index. No existing test, migration, policy or grant changes.
- **Read context:** root `AGENTS.md`; `agents/COORDINATION.md`; [DEV-013](DEV-013-m0-gate11-coverage-checker.md), [DEV-014](DEV-014-gate11-workspace-communication.md), [DEV-015](DEV-015-projection-service-policy.md); `docs/delivery/test-strategy.md` §4; `docs/BACKLOG.md` BL-091 to BL-095, BL-097, BL-099, BL-101.
- **Linked spec, ADR or earlier task:** DEV-013, DEV-014, DEV-015; INV-060.
- **Baseline:** `191dd79` (main after PR #96).
- **Dependencies / constraints / out of scope:** local database at `0086`; test files run only with the owner's permission, one at a time; no `supabase db reset`; a policy defect goes to a separate DEV task (owner, 2026-09-16); BL-099 is not part of the gate.
- **Required acceptance criteria:**
  1. 21 of the 22 rows are `covered`, citing tests that meet the v0.1 read minimum for their policies (for the two INSERT-only tables: the other workspace's active member refused an insert into A beside its own permitted insert); `capture_events` for `goproceed_service` stays `gap` under BL-102 with the reason.
  2. Every new file seeds its own two workspaces, rolls back every operational write, cleans up, never calls `resetDb`, was run alone against the local database at `0086` and passed, and leaves no residue.
  3. Each negative is non-vacuous (the other owner reads or writes its own row in the same test) and sensitive: a mutation that makes the owner of B a member of A with `project.view` turns every membership- or capability-keyed test red, and one that gives B's actor A's record turns the idempotency test red.
  4. The validator passes; `it.skip` on a cited test turns it red.
  5. Registry 73 `covered`, 1 `gap`, 7 `exempt_no_grant`; BL-091 to BL-095 and BL-097 closed → DEV-016; BL-102 (P1) and BL-103 (P3) exist; the test catalog, test-strategy §4, readiness §11, runbook, tenancy note and STATUS agree, and gate 11 stays open.
  6. `pnpm --filter @goproceed/testing typecheck` and `pnpm validate:agents` pass.
  7. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-ui-reviewer`, `gp-mobile`: not triggered.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-16 | The gap work is split into 2–3 PRs; RLS defects go to separate DEV tasks with a migration; BL-099 is not part of gate 11 | chat, DEV-014 answers |
| 2026-09-17 | Start the second gap PR (after PR #96 was merged) | chat, «смержил, давай второй PR по gap» |
| 2026-09-17 | The six new test files may run against the local database, one at a time | chat, answer «Да, все шесть по одному» |
| 2026-09-17 | `capture_events` for the service role stays a gap under BL-102 (a separate task); BL-103 is recorded as P3 and `idempotency_records` is covered on the read minimum | chat, answer «Записать BL-103 как P3» |

## Plan

Numbered steps. For each step, name the files it touches and the check that proves it. A step that adds a contract, refusal or invariant starts with its failing test.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native) on `191dd79` | **Design returned, read-only; no ADR.** 21 of 22 rows meet the minimum with tests alone, in six files, one test per relation, both workspaces seeded identically (rules world; published-baseline assignment for evidence and execution; closure world for external review; a minimal world for operational and requirements). Member read shape as DEV-014, with `select distinct`. `audit_events` and `transaction_outbox` hold INSERT only, so every member read fails at the grant: the negative is B refused an insert into A beside its own, every write rolled back (a dated clarification in test-strategy §4). External-session policies stay with the m5 suites. **`capture_events` for `goproceed_service` cannot meet the minimum:** `ce_insert_server` has no `app.service_workspace()` term and its `exists` over `upload_intents` is actor-bound, and `finalize-upload-intent.ts:58` declares no workspace — BL-102, a migration task. BL-103 proposed (`idem_select` is actor-scoped, not membership-scoped). Collisions: random storage keys and verifier bytes; m5-external-rls counts capture_events and the execution tables globally (a killed run leaves m5 red); outbox and audit writes rolled back. Closing gate 11 needs zero gaps, the unfiltered evidence run (which resets the database) and the owner | architect report | Owner permissions |
| 2 | implementing (coordinator): red | 21 registry rows cited the six not-yet-written files, and the service row was re-pointed to BL-102: validator rc 1, 43 problems — 42 «does not exist» and «BL-102 is not an entry» | `scratchpad/dev016-red-validator.txt` | Files |
| 3 | implementing (coordinator): green | Six files written; BL-102 and BL-103 added; validator rc 0; typecheck rc 0. Each file alone at `0086`: requirements 1, operational 3, contract-baseline 8, evidence 3, execution 3, external-review 3 — **21 passed**; no `de16…` workspace remains | `scratchpad/dev016-validator-tests.txt`, `dev016-typecheck-1.txt`, `dev016-db-*-1.txt` | Mutations |
| 4 | implementing (coordinator): sensitivity | Each file with the owner of B made an active admin of A holding `project.view` on A's projects, one at a time, restored byte for byte: requirements 1/1, contract-baseline 8/8, evidence 3/3, execution 3/3, external-review 3/3 failed; operational 2/3 failed (audit and outbox) — `idempotency_records` stayed green, as its policy is actor-scoped (BL-103). A second operational mutation (A's record written under B's actor scope) turned it red. The validator with `it.skip` on the cited `external_sessions` test: rc 1, naming both columns; restored, rc 0. No residue: no `de16…` workspace, no `dev016.rls-probe` outbox or audit row | `scratchpad/dev016-mutation-*.txt` | Documents |
| 5 | implementing (coordinator): documents | Registry 73/1/7; BL-091 to BL-095 and BL-097 `closed → DEV-016` with dated evidence (BL-092 notes the service row's move); T-RLS-004 to T-RLS-009; dated notes in test-strategy §4, readiness §11, runbook §5.11 and §5.14 row 4, the tenancy note; STATUS (the `0086` merge, the M0 row, next actions, re-observation note). Validator rc 0. Final runs are taken after this row is written | `scratchpad/dev016-validator-docs.txt`, `dev016-final-*.txt` | Commit; `gp-reviewer`, `gp-security` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

- **Readiness gate 11 is not closed.** One gap remains (`capture_events` for `goproceed_service`, BL-102), and closing also needs the unfiltered `pnpm --filter @goproceed/testing test` evidence run (it resets the local database; the owner's call) and the owner's agreement.
- **`covered` is the v0.1 read minimum**, and for `audit_events` and `transaction_outbox` a refused insert; BL-099 stays review.
- **`idempotency_records` is fenced by the actor, not by membership** (BL-103).
- **The external-session policies on the three external-review tables** are exercised by the m5 suites, not by this task.
- **Only the six new files ran**, each alone, locally; no other suite ran, and nothing ran in CI.
- **`m5-external-rls.test.ts` counts `capture_events` and the three execution tables across all workspaces**, so a run of `evidence-rls` or `execution-rls` killed before its `afterAll` leaves m5 red until that file runs again.

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
