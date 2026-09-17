# DEV-014 — Readiness gate 11: tenant-isolation tests for workspace access and communication

## Assignment

- **Objective and user-visible outcome:** the 29 `gap` rows of `technical/database/rls-coverage.csv` in modules `workspace_access` (BL-098, 13 rows) and `communication` (BL-090, 16 rows) become `covered`: each gets a positive and a negative policy test in the v0.1 read minimum (`docs/delivery/test-strategy.md` §4), cited in the registry and checked by the validator. Readiness gate 11 moves from 53 gaps to 24; it is not closed by this task.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-16.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** new tests over RLS policies and a registry under `technical/database/`: `gp-architect` design → coordinator implements (each new test run red first where it can be) → `gp-reviewer` + `gp-security` → `gp-qa`. A real RLS or grant defect found by a test stops that row and takes the `gp-architect` + `gp-security` route with a migration, as a separate task.
- **Triggered stages and why:** `gp-architect` (`technical/database/**`, RLS verification); `gp-security` (the tests decide what counts as tenant-isolation evidence over RLS policies). `gp-ui-reviewer` and `gp-mobile` are not triggered.
- **Owning module and allowed edit paths:** new test files under `packages/testing/src/` (one per module); `technical/database/rls-coverage.csv` (the 29 rows only); `docs/BACKLOG.md` (BL-090, BL-098 closed; any new finding); `docs/delivery/production-readiness.md` §11, runbook §5.11 and §5.14 row 4, `docs/STATUS.md`, one dated note in `docs/architecture/tenancy-and-security.md` (gap counts, BL-100 and the evidence qualifier); two rows of `technical/test-catalog.csv`; this record and the index. No existing test assertion, migration, policy or grant changes.
- **Read context:** root `AGENTS.md`; `START_HERE.md`; `agents/COORDINATION.md`; [DEV-013](DEV-013-m0-gate11-coverage-checker.md); `docs/delivery/test-strategy.md` §4; `technical/database/rls-coverage.csv`; `docs/BACKLOG.md` BL-090, BL-098, BL-099; `packages/testing/src/pg.ts`, `telegram-rls.test.ts`, `telegram-erasure.test.ts`, `m1-rls-workspace.test.ts`, `m2-fixture.ts`, `m2-occurrences-fixture.ts`.
- **Linked spec, ADR or earlier task:** [DEV-013](DEV-013-m0-gate11-coverage-checker.md) (the checker and the registry); INV-060.
- **Baseline:** `35578e7` (main after PR #94).
- **Dependencies / constraints / out of scope:** GitHub Actions starts no jobs until October 2026; the local database is at `0085`; no `supabase db reset`, no `pnpm turbo run test` or package-wide test run; only the new files of this task run locally, one at a time. Out of scope: the other seven modules (a later task), BL-099 (write denial), and the service-plane projection policy defect (`blocked_reasons`, `readiness_projection`; a separate task).
- **Required acceptance criteria:**
  1. Each of the 29 rows is `covered`, citing a positive and a negative that meet the v0.1 read minimum: member plane — an authorised actor of workspace A reads a row of A, and an active member of another workspace reads none; service plane — a service transaction declaring A reaches the row, and one declaring another workspace or none is refused it by the policy; `api.me_context` — own context, and nothing for a non-member or a member of another workspace.
  2. Every new test file seeds its own two workspaces with unique ids, cleans up after itself, never calls `resetDb`, and was run alone against the local database at `0085` and passed; a run afterwards finds no residue of its workspaces.
  3. Each negative is non-vacuous: the same test (or the file's positive) shows the refused actor or transaction reaching its own workspace's row, so zero rows cannot come from an empty table.
  4. `pnpm validate:canonical-docs` passes with the new citations; a mutation (`it.skip` on one cited test) turns it red.
  5. `packages/testing/src/rls-coverage.test.ts` still passes (catalogs only, no `resetDb`).
  6. BL-090 and BL-098 are closed → DEV-014; the registry holds 50 `covered`, 24 `gap`, 7 `exempt_no_grant`; readiness §11, runbook §5.11 and STATUS state the new count and that gate 11 is still open.
  7. `pnpm --filter @goproceed/testing typecheck` and `pnpm validate:agents` pass.
  8. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-ui-reviewer`, `gp-mobile`: not triggered.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-16 | Split the gap work into 2–3 PRs by group: first workspace_access + communication, then the remaining modules; RLS defects found go to separate DEV tasks with a migration | chat, answer «2–3 PR по группам» |
| 2026-09-16 | BL-099 is not part of closing gate 11: the gate closes on the read minimum and BL-099 stays open | chat, answer «Нет, только read minimum» |
| 2026-09-16 | The new test files of this task may run against the local database, one at a time; existing suites do not run without a separate permission | chat, answer «Новые файлы этой задачи, по одному» |
| 2026-09-16 | The service-plane projection policies (`br_write_server`, `rp_write_server`, `for all … using (true)`) are a separate DEV task | chat, answer «Отдельная DEV-задача» |
| 2026-09-17 | `packages/testing/src/rls-coverage.test.ts` may run once against the local database | chat, answer «Да, запустить» |

## Plan

1. `gp-architect` design: file layout, fixtures, per-row assertions, expected defects.
2. Workspace-access test file: write, run alone (red where a row's assertion is new behaviour to prove, then green), cleanup check.
3. Communication test file: same.
4. Registry rows → `covered`; BL-090, BL-098 closed; counts in readiness §11, runbook §5.11, STATUS; validator, mutation, `rls-coverage.test.ts`, typecheck, agents.
5. `gp-reviewer` + `gp-security` over the diff; stated fixes; `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoped (coordinator) on `35578e7` | Policies, columns, constraints and triggers of the 23 relations dumped read-only from the local database at `0085`. While reading the service-plane rows of other modules: `br_write_server` and `rp_write_server` (0045:1649-1656) are `for all to goproceed_service using (true) with check (true)`; PostgreSQL 17 applies an `ALL` policy to the selection side as well, so a service transaction with any or no declared workspace would read and change every tenant's projections, although the migration's comment says the policy «adds only the write side». Not yet run; owner routed it to a separate task | `scratchpad/dev014-policies.txt`, `-columns.txt`, `-constraints.txt`, `-triggers.txt`; https://www.postgresql.org/docs/17/sql-createpolicy.html | `gp-architect` |
| 2 | designing (`gp-architect`, native) on `35578e7` | **Design returned, read-only; no ADR.** Two new files, `workspace-access-rls.test.ts` (13 rows) and `communication-rls.test.ts` (16 rows), not extensions: `m1-rls-workspace.test.ts` calls `resetDb()`, and changing `telegram-rls.test.ts`'s fixture would change tests cited elsewhere. One test per relation, cited as both positive and negative. Member plane: the owner of A reads A's row, the owner of B (same grants on its own project) declaring workspace A reads only B's row. Service plane: an **empty actor** — with the caller's actor the inherited `goproceed_app` policies would admit A's rows on the five dual tables whatever the declaration, so the test would not prove the service policy. Fixture from the rules and occurrence worlds; never `dropM2Workspaces` (it truncates shared tables). No row expected to fail the minimum. Observations O-1 (a service transaction keeping the caller's actor is not confined by its declaration) to O-4 (same-workspace or out of scope) | architect report | Red first |
| 3 | implementing (coordinator), workspace_access | **Red:** the 13 registry rows cited the not-yet-written file; validator rc 1, 26 problems, each «does not exist». **Green:** `workspace-access-rls.test.ts` written; validator rc 0; `@goproceed/testing` typecheck rc 0; the file alone against the local database at `0085`: **13 passed**; afterwards no row of its workspaces remains in any `public` table | `scratchpad/dev014-red-validator-wa.txt`, `dev014-validator-wa.txt`, `dev014-typecheck-wa.txt`, `dev014-db-wa-1.txt` | communication |
| 4 | implementing (coordinator), communication | **Red:** the 16 rows cited the not-yet-written file; validator rc 1, 32 problems. **Green:** `communication-rls.test.ts` written with both workspaces seeded identically (every table holds a row of each); validator rc 0; typecheck rc 0; the file alone at `0085`: **16 passed** | `scratchpad/dev014-red-validator-comm.txt`, `dev014-validator-comm.txt`, `dev014-typecheck-comm.txt`, `dev014-db-comm-1.txt` | Mutations |
| 5 | implementing (coordinator), sensitivity | Three mutations, one file run at a time, each restored byte for byte (sha256): **m1** the owner of B also an active admin of A with `project.view` on A's project — `workspace-access-rls.test.ts` 13 of 13 fail; **m2** the service helper always declares A — `communication-rls.test.ts` 11 service tests fail, 5 member tests pass; **m3** the same leak as m1 in the communication fixture — the 5 member tests fail, 11 service tests pass. `rls-coverage.test.ts` (owner allowed, 2026-09-17) alone: 22 passed. No residue of the four workspaces afterwards | `scratchpad/dev014-mutation-m1.txt`, `-m2.txt`, `-m3.txt`, `dev014-rls-coverage.txt` | Documents |
| 6 | implementing (coordinator), documents | Registry 50 `covered`, 24 `gap`, 7 `exempt_no_grant`. BL-090 and BL-098 `closed → DEV-014`; BL-100 (P1, the projection policies, owner-routed to its own task) and BL-101 (P3, O-1) added. Dated additions to readiness §11, runbook §5.11, §5.14 row 4, the tenancy note and STATUS; T-RLS-002 and T-TG-009 in the test catalog. Validator rc 0. **Mutation:** `it.skip` on the cited `telegram_member_links` service test turns the validator red naming both columns of that row (rc 1); restored byte for byte, rc 0 | `scratchpad/dev014-validator-docs.txt`, `dev014-mutation-skip.txt` | Commit; `gp-reviewer`, `gp-security` |
| 7 | reviewing (`gp-reviewer`, `gp-security`, native) on `095b3bf` | **`gp-reviewer`: APPROVE** — all 29 rows meet the minimum under their actual policies; fixtures isolated; R1-01 minor (m5-external-rls counts five communication tables across all workspaces), R1-02 to R1-04 nits. **`gp-security`: PASS** — the empty-actor service proof is right; no external-session policy on the 16 rows; BL-100 correct, P1, not blocking this PR; S1-01, S1-02, S1-05 minor, S1-03, S1-04, S1-06, S1-07 nits. No blocker, no major; no rework round counted | review reports | Stated fixes |
| 8 | rework (coordinator), stated fixes | BL-100 reworded (the role's pre-`0057` name in the migration, INSERT, the wrong migration comment, the threat model, the catalog rows owed, the scratch evidence file); BL-101 names the callers that keep the actor; 8 registry reasons say «project.view/project.admin holder», the responsibility row adds «and assignee»; the grants test comment softened (comment only); T-RLS-002 and T-TG-009 name the superuser connection and that the files never skip; the tenancy note and §11 carry the read-minimum and owed-evidence qualifiers; allowed paths widened; the m5 dependency, the owed evidence run and S1-04 recorded under «What is not true». Final runs are taken after this row is written | `scratchpad/dev014-bl100-policies.txt`, `dev014-final-*.txt` | `gp-qa` |
| 9 | implementing (coordinator): final local runs, taken after this row was written | Validator, agent profiles, `@goproceed/testing` typecheck; `workspace-access-rls.test.ts` then `communication-rls.test.ts`, each alone at `0085`; a residue check of the four workspaces. `rls-coverage.test.ts` is not re-run (the owner allowed one run; since it, only the registry's `reason` column changed, which it does not compare). Nothing is committed unless every run passes. The first validator run refused the pre-rename role name in BL-100 and in this row; both were reworded and the validator and agent checks re-run (documents only; the database runs stand) | `scratchpad/dev014-final-validate-docs.txt`, `-validate-agents.txt`, `-typecheck.txt`, `-db-wa.txt`, `-db-comm.txt`, `-residue.txt` | Commit; `gp-qa` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 / S1-05 | minor | `m5-external-rls.test.ts:578-597` counts five tables this suite seeds | Expected: no hidden coupling; actual: a killed run leaves m5 red | coordinator | Recorded under «What is not true»; no existing test changed (row 8) |
| R1-02 / S1-01 | minor | BL-100 | Actual: role name, missing INSERT, threat model, evidence file | coordinator | Reworded; `dev014-bl100-policies.txt` (row 8) |
| S1-02 | minor | BL-101 | Actual: callers called unknown | coordinator | Callers listed (row 8) |
| R1-03 / S1-03 | nit | Registry reasons; grants test comment | Actual: one policy branch named | coordinator | Reworded (row 8) |
| R1-04 | nit | Tenancy note vs allowed paths | Actual: two sentences, names BL-100 | coordinator | Allowed paths widened (row 8) |
| S1-04 | nit | `me_context` status filter | Actual: not asserted | coordinator | **Deferred** with its reason under «What is not true» |
| S1-06 | nit | T-RLS-002, T-TG-009 | Actual: environment incomplete | coordinator | Reworded (row 8) |
| S1-07 | nit | §11, tenancy note | Actual: qualifiers missing | coordinator | Added (row 8) |

Rework count and hypothesis changes: none — no QA FAIL and no blocker.

## What is not true after this task

- **Readiness gate 11 is not closed.** 24 gap rows remain (BL-091 to BL-097); BL-096's two service rows cannot close before BL-100.
- **`covered` is the v0.1 read minimum.** Write denial (BL-099, owner: not part of the gate) and the rest of the tenancy test list stay review.
- **The service-plane tests use an empty actor.** They prove the service policy; a service transaction that keeps the caller's actor is not confined by its declaration on the five dual tables (BL-101).
- **Only the two new files and `rls-coverage.test.ts` ran**, locally, against `0085`; no other suite ran, and nothing ran in CI (GitHub Actions billing until October 2026).
- **BL-100 is not fixed and not yet shown by a test.**
- **Another suite now depends on this one's cleanup.** `packages/testing/src/m5-external-rls.test.ts:578-597` expects zero rows, across all workspaces, in five communication tables that `communication-rls.test.ts` seeds. A run killed before its `afterAll` leaves m5 red until this file runs again (its `beforeAll` drops the rows). m5's comment «only telegram-rls.test.ts inserts one» is now stale; correcting it is a later change (this task changes no existing test).
- **The unfiltered evidence run is owed.** `test-strategy.md` §4 names `pnpm --filter @goproceed/testing test` as the evidence run; it resets the local database and needs the owner, and CI does not start jobs until October 2026.
- **`api.me_context`'s `status = 'active'` filter is not asserted** (S1-04, optional, not done: a suspended membership of B in A would also show through `m_select`, which has no status filter — O-2 — and make the memberships assertion fail for another reason).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

The Limitation column opens with at most one qualifier from this closed set, then its detail:

- **PASS:** `negative` (the command correctly produced nothing, and the absence is the evidence); `assisted:` what had to be arranged by hand first; `owner-reported` (the owner's report, not a session observation).
- **FAIL:** `known-red baseline:` the named set of pre-existing failures, with no case outside it failing.
- **NOT RUN:** `environmental:` the cause and the command that settles it; `not-provable-locally:` what would settle it; or, with no qualifier, the reason: why it was deliberately not attempted, or why a PASS was earned for the wrong reason (`agents/roles/gp-qa.md`).

## Sources

- Vitest 3.2.4 (installed): run a single file with `vitest run <file>`; the citation shape and its skip rules are DEV-013's research, unchanged.
- PostgreSQL 17 `CREATE POLICY` — https://www.postgresql.org/docs/17/sql-createpolicy.html — installed server 17.6; accessed 2026-09-16. `ALL` policies apply to the selection and the modification side; permissive policies combine with `OR`; `WITH CHECK` is enforced before other constraints.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
