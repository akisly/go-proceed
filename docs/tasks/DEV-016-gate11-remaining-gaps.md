# DEV-016 — Readiness gate 11: tenant-isolation tests for the remaining gap rows

## Assignment

- **Objective and user-visible outcome:** the 22 remaining `gap` rows of `technical/database/rls-coverage.csv` — contract_baseline (BL-091, 8), evidence (BL-092, 4), execution (BL-093, 3), external_review (BL-094, 3), operational (BL-095, 3), requirements (BL-097, 1) — become `covered` in the v0.1 read minimum, or, where a policy cannot meet it, stay a gap with a new backlog entry for a separate migration task. If the registry reaches zero gaps and the owner agrees, readiness gate 11 gets its dated evidence entry.
- **State:** done
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
  2. Every new file seeds its own two workspaces, rolls back every operational write, cleans up, never calls `resetDb`, was run alone against the local database at `0086` and passed, and leaves no tenant-table residue (twelve fixed-id `auth.users` rows outlive the cleanup, as in every other suite).
  3. Each negative is non-vacuous (the other owner reads or writes its own row in the same test) and sensitive: a mutation that makes the owner of B a member of A with `project.view` turns every membership- or capability-keyed test red, and one that gives B's actor A's record turns the idempotency test red.
  4. The validator passes; `it.skip` on a cited test turns it red.
  5. Registry 73 `covered`, 1 `gap`, 7 `exempt_no_grant`; BL-091 to BL-095 and BL-097 closed → DEV-016; BL-102 (P1), BL-103 (P2) and BL-104 (P1) exist (written as «BL-102 (P1) and BL-103 (P3)» when this criterion was set, before the owner's ruling of 2026-09-18); the test catalog, test-strategy §4, readiness §11, runbook, tenancy note and STATUS agree, and gate 11 stays open.
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
| 2026-09-18 | After `gp-security` corrected the facts: BL-103 is P2 and the stored invitation token is BL-104 at P1 | chat, «да, BL-103 P2, BL-104 P1, продолжай» |

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
| 6 | reviewing (`gp-reviewer`, `gp-security`, native) on `5c73b70` | **`gp-reviewer`: CHANGES REQUESTED** — the six files are sound and no defect found in them; R1-01 low (BL-103 cited a path that does not exist), R1-02 low (the idempotency mutation went red on the positive, not the negative), R1-03 low (registry and catalog prose claim capabilities the fixtures do not seed). **`gp-security`: HOLD** — the tests are real evidence for all 21 rows and BL-102 is confirmed at P1, but BL-103's «unverified» was wrong: `withIdempotency` replays a stored response BEFORE the routes check membership (S1-01 major, existing code), and `invitations.create` stores the raw invitation token in that response; S1-02 (BL-102's fix shape is incomplete), S1-03 (the external-session insert branches are untested), S1-04 (= R1-02), S1-05 (documents overstate) minor. Both findings verified by the coordinator in `packages/database/src/idempotency.ts:60-95` and the invitations route | review reports | Owner decision; stated fixes |
| 7 | rework (coordinator), stated fixes | Owner ruled BL-103 P2 and the token finding BL-104 P1 (2026-09-18). BL-103 rewritten with the replay order, the affected routes and the grants-route pattern; BL-104 added; BL-102 says the workspace term alone is not enough (an empty actor still matches nothing in `upload_intents`); 20 registry reasons name the branch that actually admits (capability holder, or active member for `unit_definitions` and `requirement_template_versions`), and the two write rows say the external-session branch is not exercised; T-RLS-009's precondition matches its fixture; test-strategy §4 and the tenancy note carry the same two qualifiers. **The idempotency mutation was re-run in the form the reviewers asked**: a second record of A written under B's actor scope, keeping A's own — red at the negative assertion (`operational-rls.test.ts:106`, `[WS_A, WS_B]` for `[WS_B]`), restored byte for byte. Final runs are taken after this row is written | `scratchpad/dev016-mutation-idem2.txt`, `dev016-final2-*.txt` | `gp-qa` |
| 8 | verifying (`gp-qa`, native) on `99e1382` | **Verified for the scoped criteria:** 1–6 PASS, 7 NOT RUN (not required). Its own runs: the six files one at a time, 21 passed; validator, agents, typecheck rc 0; read-only residue check — no `de16…` workspace, no `dev016.rls-probe` row, no `capture_events` row at all (m5's invariant restored), exactly twelve `auth.users` rows left. It read eight citations against the policy text, re-derived BL-102 from `0035:150` and `pg_auth_members`, and reproduced BL-103 and BL-104 in the source. Every stated fix in place. New: Q1-01 low (criterion 5 still named BL-103 as P3 and omitted BL-104), Q1-02 low (`covered` evidences workspace isolation, not capability enforcement) | QA report | Stated fixes; done |
| 9 | closing (coordinator) | Q1-01: criterion 5 names BL-102 (P1), BL-103 (P2) and BL-104 (P1), keeping the superseded wording visible. Q1-02: recorded under «What is not true». Acceptance evidence filled from the QA matrix. Validator and agent checks re-run after this row is written | `scratchpad/dev016-close-validate-*.txt` | Push, PR |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| Q1-01 | low | Criterion 5 | Actual: BL-103 named P3, BL-104 missing | coordinator | Criterion amended, superseded wording kept (row 9) |
| Q1-02 | low | «What is not true» | Actual: capability enforcement not evidenced | coordinator | Recorded (row 9) |
| R1-01 | low | BL-103 «Why» | Actual: `apps/app/src/lib/idempotency.ts` does not exist | coordinator | Path corrected to `packages/database/src/idempotency.ts`; entry rewritten (row 7) |
| R1-02 / S1-04 | low | `dev016-mutation-idem.txt` | Actual: the mutation reddened the positive assertion | coordinator | Re-run so only the negative can fail (row 7) |
| R1-03 / S1-05 | low | Registry reasons, T-RLS-009, tenancy note, criterion 2 | Actual: capabilities claimed where the fixture seeds membership only; «run alone» read as covering all 73 rows; `auth.users` residue unstated | coordinator | 20 reasons reworded; catalog precondition; note and criterion qualified (row 7) |
| S1-01 | major (existing code) | `packages/database/src/idempotency.ts:60-85`; the invitations route | Actual: a stored response is replayed before membership is checked, and it carries the raw invitation token | owner / coordinator | BL-103 corrected and raised to P2; BL-104 added at P1 (owner, 2026-09-18); neither is introduced by this diff |
| S1-02 | minor | BL-102 «smallest fix» | Actual: the workspace term alone still leaves an empty actor refused | coordinator | Entry says the service also needs a confined `upload_intents` read, or the row's minimum is the actor-bearing shape (owner's call) |
| S1-03 | minor | test-strategy §4 note; the two write rows | Actual: the external-session insert branches are unexercised and unstated | coordinator | Stated in both (row 7); no test added — out of this task's scope |

Rework count and hypothesis changes: none — no QA FAIL and no blocker; `gp-security`'s HOLD was a document correction plus an owner ruling.

## What is not true after this task

- **Readiness gate 11 is not closed.** One gap remains (`capture_events` for `goproceed_service`, BL-102), and closing also needs the unfiltered `pnpm --filter @goproceed/testing test` evidence run (it resets the local database; the owner's call) and the owner's agreement.
- **`covered` is the v0.1 read minimum**, and for `audit_events` and `transaction_outbox` a refused insert; BL-099 stays review.
- **`idempotency_records` is fenced by the actor, not by membership** (BL-103).
- **The external-session policies on the three external-review tables** are exercised by the m5 suites, not by this task.
- **Only the six new files ran**, each alone, locally; no other suite ran, and nothing ran in CI.
- **Twelve `auth.users` rows outlive the files** (fixed ids, inserted `on conflict do nothing`), as in every other suite; the residue check counts tenant tables only.
- **The external-session insert branches** (`audit_insert_external`, `outbox_insert_external`) are exercised by no test (S1-03).
- **`covered` evidences workspace isolation, not capability enforcement** (Q1-02): every negative here is an active member of another workspace, and no test in these files refuses a member of A who lacks `project.view`/`project.admin`. That case is adjacent to, not covered by, BL-099; `m1-rls-workspace.test.ts` holds one for `projects`.
- **Two defects in existing code were found, not fixed**: BL-103 (a stored idempotent response is replayed before membership is checked, P2) and BL-104 (that response carries the raw invitation token, P1).
- **`m5-external-rls.test.ts` counts `capture_events` and the three execution tables across all workspaces**, so a run of `evidence-rls` or `execution-rls` killed before its `afterAll` leaves m5 red until that file runs again.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. 21 rows covered in the v0.1 read minimum; the last row stays a gap under BL-102 | yes | `99e1382` | Registry 73/1/7; `gp-reviewer` read every row against the policy text, `gp-qa` eight citations and the gap row's reason; runs in rows 3 and 7 | PASS | assisted: local database at `0086`; a reason names an admitting branch, not the only one |
| 2. Own workspaces, rolled-back writes, cleanup, no `resetDb`, run alone, no tenant residue | yes | `99e1382` | `dev016-final2-db-*.txt` (1+3+8+3+3+3 = 21 passed); `dev016-final2-residue.txt` `0\|0\|0\|0`; `gp-qa`'s own six runs and its count of the twelve `auth.users` rows | PASS | assisted: twelve fixed-id `auth.users` rows outlive the files, as in every suite |
| 3. Non-vacuous and sensitive negatives | yes | `99e1382` | Membership-leak mutation reddens 20 of 21 tests; `dev016-mutation-idem2.txt` reddens the idempotency negative (HEAD line 106); `gp-qa` mapped the line offsets and checked every restore with `cmp` | PASS | — |
| 4. Validator passes; `it.skip` on a cited test turns it red | yes | `99e1382` | `dev016-red-validator.txt` (rc 1, 43 problems), `dev016-mutation-skip.txt`, `dev016-final2-validate-docs.txt` rc 0; `gp-qa`'s own run | PASS | — |
| 5. Registry, backlog, catalogs and documents agree; gate 11 stays open | yes | `99e1382` | `gp-qa`'s CSV-aware counts and reading; BL-091 to BL-095 and BL-097 closed; BL-102, BL-103, BL-104 | PASS | Q1-01 fixed after the QA run (criterion text only) |
| 6. `pnpm --filter @goproceed/testing typecheck`, `pnpm validate:agents` | yes | `99e1382` | `dev016-final2-typecheck.txt`, `dev016-final2-validate-agents.txt` rc 0; `gp-qa`'s own runs | PASS | — |
| 7. CI `verify` on the PR head | no | — | — | NOT RUN | environmental: GitHub Actions starts no jobs until October 2026; settled by CI `verify` on the PR head |

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

The Limitation column opens with at most one qualifier from this closed set, then its detail:

- **PASS:** `negative` (the command correctly produced nothing, and the absence is the evidence); `assisted:` what had to be arranged by hand first; `owner-reported` (the owner's report, not a session observation).
- **FAIL:** `known-red baseline:` the named set of pre-existing failures, with no case outside it failing.
- **NOT RUN:** `environmental:` the cause and the command that settles it; `not-provable-locally:` what would settle it; or, with no qualifier, the reason: why it was deliberately not attempted, or why a PASS was earned for the wrong reason (`agents/roles/gp-qa.md`).

Gate records written before 2026-09-13 keep their own tokens; `docs/delivery/pilot-execution-runbook.md` §7.4 maps them onto this set.

## Sources

Third-party documentation and primary sources checked for this task. Give each one its URL, the installed version it applies to, its publication date if known (never substitute today's date) and the access date.

## Completion / handoff

- Changed / inspected files: see «Owning module and allowed edit paths»; commits `5c73b70` (implementation), `99e1382` (review round 1), and the closing commit.
- Review independence: independent — `gp-architect` (design), `gp-reviewer` (CHANGES REQUESTED, fixes applied), `gp-security` (HOLD, resolved by the owner's ruling and the record corrections), `gp-qa` on `99e1382`, all native subagents. No rework round was counted: no QA FAIL and no blocker.
- Verified scope: criteria 1–6 PASS; criterion 7 NOT RUN, not required.
- Remaining risks / blocked requirements: «What is not true» above; BL-102 (the last gap row), BL-103, BL-104; the unfiltered evidence run that closing gate 11 needs.
- Next bounded action and owner: owner — review and merge the PR. Then BL-102 (a migration and the finalize caller) and BL-104; after BL-102, the gate 11 evidence run and closing entry, which need the owner's permission and agreement.
- Final state and reason: done — every required criterion PASS; every finding fixed, recorded or ruled on by the owner.
