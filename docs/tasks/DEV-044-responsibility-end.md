# DEV-044 — BL-015: a project administrator can end a responsibility assignment

## Assignment

- **Objective and user-visible outcome:** a project administrator can end a member's responsibility on a project (`POST /v1/projects/{projectId}/responsibilities/end`, body `{ memberId, responsibility }`): every assignment of that pair that is live or has not started yet is ended at the moment of the command by an append-only end fact, and a later assign no longer counts it in its separation-of-duties warnings. Scope set by [ADR-014](../decisions/ADR-014-revoke-access-and-end-responsibility.md) decisions 2 and 3.
- **State:** done
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** a scope change (ADR), a new table with RLS and grants, a new `/v1` command and catalog rows: `gp-architect` → coordinator drafts ADR-014 → **owner rules** → failing tests → migration, contract, route, catalogs → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (a new table, `supabase/migrations/**`, `apps/app/app/v1/**`, `packages/contracts/**`, catalogs); `gp-security` (a new table's RLS policies and grants). `gp-ui-reviewer` and `gp-mobile` are not triggered: no UI.
- **Owning module and allowed edit paths:** `supabase/migrations/0097_*.sql` (new); `apps/app/app/v1/projects/[projectId]/responsibilities/end/route.ts` (new) and `responsibilities/route.ts` (the warning query); `packages/contracts/src/project-access.ts` and its test; `apps/app/tests/responsibility-end.int.test.ts` (new); `apps/app/tests/projects.int.test.ts`; `packages/testing/src/workspace-access-rls.test.ts`, `m1-schema.test.ts` and whatever registry test lists the tables; `technical/openapi/scope-v0.1.csv`, `technical/permissions/capabilities.csv`, `technical/database/invariant-catalog.csv`, `entity-catalog.csv`, `relationship-catalog.csv`, `rls-coverage.csv`, `technical/data-access-surface.csv`, and the retention catalog if it lists every table; `docs/architecture/tenancy-and-security.md`; `docs/delivery/version-0.1.md`; `docs/BACKLOG.md`, `docs/STATUS.md`, `docs/tasks/README.md`.
- **Read context:** as DEV-043; migration `0045` (the one-successor key and composite pin this table copies); `0013` (`app.reject_mutation`).
- **Linked spec, ADR or earlier task:** ADR-014; BL-015; [DEV-043](DEV-043-project-access-revoke.md).
- **Baseline:** `a475725` (main after PR #114).
- **Dependencies / constraints / out of scope:** migration `0097` follows DEV-043's `0096` and is applied to the local database by hand. Out of scope: dated ends (past or future), a list route, any screen, re-evaluating warnings already recorded, cascading an end to access (INV-021).
- **Required acceptance criteria:**
  1. `apps/app/tests/responsibility-end.int.test.ts` (truncates nothing; seeds and removes its own `de44…` workspaces) fails at the baseline and passes after the change: an administrator ends a live assignment (200, one end row, `ended_at` the command's time) and a later assign of the conflicting responsibility no longer warns; a future assignment of the pair is cancelled in the same call; nothing live or future is 409 `VERSION_CONFLICT` with nothing written; a second end of the same pair is 409; two concurrent ends give one 200 and one 409, never 500; an ex-member's assignment can be ended; a member id from another workspace is 422; a view-only member is 403; an outsider and another workspace's owner get 404; a malformed project id is 404; an unknown body key is 422; a same-key retry replays with one end row; the member's grants are untouched (INV-021); audit rows are written and no outbox row.
  2. The contract: the end request is strict, the response strict; `packages/contracts/src/project-access.test.ts` proves it.
  3. Migration `0097` creates `project_responsibility_assignment_ends`: update and delete refused even for the table owner; an end pinned to an assignment of another project refused by the composite foreign key; a second end of one assignment refused by the unique key; RLS reads for the project's viewers and the assignment's holder, inserts for a project administrator only, with `ended_at` equal to the transaction time and `ended_by` the actor; a member of another workspace reads and inserts nothing. `packages/testing/src/workspace-access-rls.test.ts` proves it, and the RLS coverage registry carries the table as `covered`.
  4. The catalogs and documents agree (`scope-v0.1.csv`, `capabilities.csv`, the invariant, entity, relationship, RLS-coverage and data-access catalogs, `version-0.1.md`, BL-015, STATUS); `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  5. `pnpm turbo run typecheck --force` passes; `@goproceed/contracts` tests pass.
  6. The existing suites that drive the assign route or read the schema pass — the coordinator's set: `projects.int.test.ts`, and in `packages/testing` `rls-coverage.test.ts` and `workspace-access-rls.test.ts` (non-resetting files, run by path). *Revised after gp-reviewer R1-05: `m1-schema.test.ts`, first listed here as non-resetting, calls `resetDb()` and cannot run locally under the owner's rule; it is neither run nor edited, and adding the new table to its lists is deferred (NOT RUN, below).*
  7. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-ui-reviewer`, `gp-mobile`: not triggered.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-23 | BL-015: build it now, as an append-only table of ends (not deferred to v0.2, not by shortening `valid_until`) | chat, answer «Строить сейчас: append-only таблица завершений» |
| 2026-09-23 | The new table sits outside ADR-006 decision 4's list, like its parent; the list stays 26 | chat, answer «Вне списка, как её родитель» |
| 2026-09-23 | An end takes effect at the moment of the command only; no past or future date | chat, answer «Только «сейчас»» |

## Plan

1. Failing tests first: `responsibility-end.int.test.ts`, the contract test, the `workspace-access-rls.test.ts` cases for the new table. Run them red at DEV-043's head (the route and the table do not exist).
2. Migration `0097`: the table, its keys, the immutability trigger, grants (`select, insert` to `goproceed_app`), RLS. Apply by hand to the local database.
3. Contract, the end route, the assign route's warning query.
4. Catalogs and documents (criterion 4).
5. Green runs, one file at a time; review and QA together with DEV-043.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | `gp-architect` | Recommended deferring to v0.2; designed option (i), the append-only end table after `0045`'s one-successor key, and the route | `scratchpad/dev043-044-architect-r0.md` | Owner questions |
| 2 | Owner | Build now, outside the list, end at the command's time | chat, 2026-09-23 | Tests |
| 3 | Coordinator (tests first) | Three test files red at `76b531c` for the right reasons: the route module, the contract exports and the table missing | `scratchpad/dev044-red.txt` | Implement |
| 4 | Coordinator (implementing) | Migration `0097` hand-applied to the local database; contract, route, the warning query, catalogs, the design DDL (`schema-v0.1.sql`, which the validator requires for every catalogued entity); `392a0d1`. The RLS test's composite-pin case first used an assignment that already had an end, so the unique key answered first; it now pins a fresh one | `scratchpad/dev043-044-green-r0.txt` | Review |
| 5 | `gp-reviewer`, `gp-security` (independent, round 1) | No blocker, no major; for DEV-044: R1-05a–c, S1-03 | `scratchpad/dev043-044-reviewer-r1.md`, `scratchpad/dev043-044-security-r1.md` | Rework |
| 6 | Coordinator (rework) | Fixed or deferred (below); `2d37c9c` | `scratchpad/dev043-044-green-r1.txt` | `gp-qa` |
| 7 | `gp-qa` (independent, round 1) | PASS at `c11d175`: criteria 1–5 pass; criterion 6's `rls-coverage` failure a confirmed known-red baseline; the original `m1-schema.test.ts` NOT RUN (resets); every fix in place. Follow-ups filed as BL-144 (R1-05c; the member-id lower-casing untested) | `scratchpad/dev043-044-qa-r1-report.md`, `scratchpad/dev043-044-qa-r1.txt` | Done |
| 8 | `gp-qa` (independent, post-merge) | PASS at `2a9d111` after merging `main` (#115): the six conflicted files lose and duplicate nothing, counts and ids recount, DEV-044's behaviour unchanged; criterion 6 now PASS (`rls-coverage` 22 of 22 with a positive control) | `scratchpad/dev043-044-qa-r1b-report.md`, `scratchpad/dev043-044-qa-r1b.txt` | Done |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1-03 | nit | `end/route.ts`, the actor loses admin after `authorize` | 403 vs 500 (unmapped 42501) | coordinator | Fixed in `2d37c9c`: 42501 from the insert is 403 `SCOPE_PROJECT_DENIED`; not reproducible deterministically |
| R1-01 (applied here too) | minor | an upper-case `memberId` | one canonical id in the audit record | coordinator | Fixed in `2d37c9c`: lower-cased once |
| R1-05a | minor | `schema-v0.1.sql` said `valid_until` is ended by a command | the end is a separate fact | coordinator | Fixed in `2d37c9c` |
| R1-05b | minor | criterion 6 called `m1-schema.test.ts` non-resetting | it calls `resetDb()` | coordinator | Fixed in `2d37c9c`: criterion revised, file NOT RUN |
| R1-05c | minor | the new table is not in `m1-schema.test.ts`'s lists | added | coordinator | Deferred to BL-144: an edit that cannot be run locally under the owner's no-reset rule would be unverified; it waits for a CI run or an owner-approved reset |

Rework count and hypothesis changes: one rework after the first review (not a round). The rework changed behaviour only by the stated fixes.

## What is not true after this task

- Warnings already recorded in an assign's response and audit row are not revised when an assignment ends.
- No route lists assignments or their ends, and no screen shows them.
- An assignment whose `valid_until` has passed is not ended by this command; it has already lapsed.
- `m1-schema.test.ts` does not list the new table, and was not run (it resets the database).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | red `76b531c`+tests; green `2d37c9c` | `npx vitest run tests/responsibility-end.int.test.ts` in `apps/app`: 7 red, then 7 passed | PASS (coordinator's run; `gp-qa` re-ran it at `c11d175`) | — |
| 2 | yes | `2d37c9c` | `packages/contracts` all: 145 passed | PASS (coordinator's run; `gp-qa` at `c11d175`) | — |
| 3 | yes | `2d37c9c` | `workspace-access-rls.test.ts`: 19 passed (the four DEV-044 cases skipped red before `0097`); registry row present | PASS (coordinator's run; `gp-qa` at `c11d175`) | assisted: `0097` hand-applied to the local database |
| 4 | yes | `2d37c9c` | `pnpm validate:canonical-docs` OK; `pnpm validate:agents` OK | PASS (coordinator's run; `gp-qa` at `c11d175`) | — |
| 5 | yes | `2d37c9c` | typecheck 10 of 10; contracts 145 passed | PASS (coordinator's run; `gp-qa` at `c11d175`) | — |
| 6 | yes | `88fabb5` (after merging `main` with #115) | `projects.int.test.ts` 8, `workspace-access-rls.test.ts` 19, `rls-coverage.test.ts` 22 passed | PASS (coordinator's run; `gp-qa` post-merge) | — *(before the merge, a known-red baseline as DEV-043 criterion 8 records)* |
| 6 (original, `m1-schema.test.ts`) | no (revised) | — | calls `resetDb()` | NOT RUN | not-provable-locally: the owner forbids a local reset; settles in CI |
| 7 | no | — | GitHub Actions starts no jobs until October 2026 | NOT RUN | environmental: billing block |

## Sources

- PostgreSQL 17 documentation, «INSERT»: «`ON CONFLICT DO NOTHING` simply avoids inserting a row as its alternative action». The page does not describe how a concurrent conflicting insert waits, so criterion 1's concurrent case is the evidence for that behaviour on the local server 17.6: https://www.postgresql.org/docs/17/sql-insert.html — accessed 2026-09-23.

## Completion / handoff

- Changed / inspected files: the allowed edit paths above, plus `technical/database/schema-v0.1.sql` and `packages/testing/src/m2-fixture.ts` (the end table deleted before its assignments).
- Review independence: independent — `gp-architect`, `gp-reviewer`, `gp-security` and `gp-qa` as native `gp-*` subagents.
- Verified scope: see Acceptance evidence.
- Remaining risks / blocked requirements: `m1-schema.test.ts` (R1-05c); BL-139 (no list route); the hosted push of `0097` is the owner's.
- Next bounded action and owner: the owner merges and decides the hosted push of `0097`.
- Final state and reason: done — every required gate passes for the scoped criteria, after merging `main` (#115); the original `m1-schema.test.ts` check was revised out and deferred (BL-144).
