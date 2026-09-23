# DEV-043 — BL-021: a project administrator can revoke a member's project access

## Assignment

- **Objective and user-visible outcome:** a project administrator can revoke a member's grants on a project by member and capability (`POST /v1/projects/{projectId}/access-grants/revoke`); revoking `project.view` removes the member from the project; the last live administrator grant cannot be revoked; a lapsed grant can be revoked, which frees its capability for a new grant; and the application role can change no grant column but `revoked_at` and `version`. Scope set by [ADR-014](../decisions/ADR-014-revoke-access-and-end-responsibility.md) decisions 1 and 4.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** a scope change (ADR), a new `/v1` command, a grant change and catalog rows: `gp-architect` → coordinator drafts ADR-014 → **owner rules** → failing tests → migration, contract, route, catalogs → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (`apps/app/app/v1/**`, `packages/contracts/**`, `supabase/migrations/**`, catalogs, the ADR); `gp-security` (a grant change on `project_access_grants`, and the authorization of a command that withdraws access). `gp-ui-reviewer` is not triggered: no UI; `apps/app/app` gains a route handler only. `gp-mobile` is not triggered.
- **Owning module and allowed edit paths:** `docs/decisions/ADR-014-revoke-access-and-end-responsibility.md` (new, shared with DEV-044) and `docs/decisions/README.md`; `supabase/migrations/0096_*.sql` (new); `apps/app/app/v1/projects/[projectId]/access-grants/revoke/route.ts` (new); `packages/contracts/src/project-access.ts` and its test; `apps/app/tests/project-access-revoke.int.test.ts` (new); `apps/app/tests/idempotency-authorization.int.test.ts`; `packages/testing/src/workspace-access-rls.test.ts`; `apps/app/qa/field.mjs` (comment only); `technical/openapi/scope-v0.1.csv`, `technical/permissions/capabilities.csv`, `technical/error-catalog.csv`, `technical/database/invariant-catalog.csv`, `entity-catalog.csv`, `rls-coverage.csv`, `technical/data-access-surface.csv`; `docs/architecture/tenancy-and-security.md`; `docs/delivery/version-0.1.md`; `docs/BACKLOG.md`, `docs/STATUS.md`, `docs/tasks/README.md`.
- **Read context:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/README.md` «ADR lifecycle and approval»; ADR-006 decision 1 and replacement rule 1; ADR-012 and [DEV-021](DEV-021-invitation-revoke.md) (the revoke precedent); [DEV-020](DEV-020-idempotent-replay-authorization.md) and [DEV-022](DEV-022-request-hash-target.md) (authorize before replay; the target in the hash); `docs/BACKLOG.md` BL-021, BL-014, BL-019.
- **Linked spec, ADR or earlier task:** ADR-014; BL-021; [DEV-044](DEV-044-responsibility-end.md) (the same cluster).
- **Baseline:** `a475725` (main after PR #114).
- **Dependencies / constraints / out of scope:** migration `0096` is applied to the local database by hand (`0095` belongs to the unmerged PR #115, `codex/mobile-native`, and the hosted project already carries it); the hosted project is not touched. Database test files run one at a time, chosen by the coordinator under the owner's standing delegation. Out of scope (ADR-014 «What this decision does NOT authorise»): a grant list route, dated revokes, cascades beyond the project's grants, lapse and suspension lockouts, a write-once trigger on `revoked_at`.
- **Required acceptance criteria:**
  1. `apps/app/tests/project-access-revoke.int.test.ts` (truncates nothing; seeds and removes its own `de43…` workspaces) fails at the baseline and passes after the change: revoke of an action capability keeps `project.view` and ends the capability's authority; revoking `project.view` revokes every grant of the member on the project and the project is 404 to them; the last live administrator grant (the actor's own included, and with a suspended second admin not counting) is 409 `PROJECT_FINAL_ADMIN` with nothing written; with a second active admin a self-revoke succeeds and a replay of its key is 403; a capability not held unrevoked is 409 `VERSION_CONFLICT` with `details.notHeld`; a lapsed grant is revocable and the capability can then be granted again; a future grant is revocable; a view-only member is 403; an outsider, another workspace's owner and a member without view get 404; a member id from another workspace is 422, a suspended member's grants are revocable; a malformed project id is 404; an unknown body key or an empty list is 422; concurrent revokes of the same grants with two keys give one 200 and one 409; a same-key retry replays with one audit row; responsibilities are untouched (INV-021); an audit row is written and no outbox row.
  2. The contract: the revoke request is strict (`memberId`, non-empty `capabilities`), the response strict; `packages/contracts/src/project-access.test.ts` proves it.
  3. Migration `0096` leaves `goproceed_app` with `UPDATE` on `revoked_at` and `version` only: `packages/testing/src/workspace-access-rls.test.ts` shows the column privileges, a refused `member_id` update (42501), an admin of workspace A revoking in A, and the owner of B declaring A and a view-only member each updating no row.
  4. `idempotency-authorization.int.test.ts`: a key reused on another project's revoke is 409 `IDEMPOTENCY_CONFLICT` and that project's grants are untouched.
  5. ADR-014 is `Approved` with the owner's dated ruling, and the ADR index agrees.
  6. `scope-v0.1.csv`, `capabilities.csv`, `error-catalog.csv` (`PROJECT_FINAL_ADMIN`), the invariant catalog (new rows for the last administrator and the `project.view` cascade), `entity-catalog.csv`, `rls-coverage.csv`, `data-access-surface.csv`, `version-0.1.md`, BL-021 and STATUS agree; `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  7. `pnpm turbo run typecheck --force` passes; `@goproceed/contracts` tests pass.
  8. The existing suites that drive the grant route pass — the coordinator's set under the owner's delegation: `projects.int.test.ts`, `vertical-m1.int.test.ts`, `idempotency-authorization.int.test.ts` (they truncate tenant tables), and `packages/testing`'s `workspace-access-rls.test.ts` and `error-catalog-fidelity.test.ts` if they touch the database.
  9. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-ui-reviewer`, `gp-mobile`: not triggered. `gp-researcher`: no library or hosted-service question beyond PostgreSQL behaviour, which the tests exercise on the local stack.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-23 | This session's cluster: «Отзыв и завершение» (BL-021 with BL-015) | chat, answer «Отзыв и завершение» |
| 2026-09-23 | ADR-014: `project_access.revoke` addressed by member and capabilities, no list route | chat, answer «memberId + capabilities» |
| 2026-09-23 | The last live `project.admin`, one's own included: refused with 409 and a new code `PROJECT_FINAL_ADMIN` | chat, answer «Отказ 409 PROJECT_FINAL_ADMIN» |
| 2026-09-23 | Revoking `project.view` while other capabilities remain cascades: the member is removed from the project | chat, answer «Каскад — убрать из проекта» |
| 2026-09-23 | Which database runs: the coordinator chooses the necessary suites, one by one; truncating tenant tables is allowed | the session's standing brief |
| 2026-09-23 | After review: only a surviving admin grant with no end date keeps a revoke of a live admin grant allowed (gp-security S1-02) | chat, answer «Считать только бессрочные» |

## Plan

1. ADR-014 and its index row; this record, DEV-044 and the task index; BL-021 `scheduled → DEV-043`.
2. Failing tests first: `project-access-revoke.int.test.ts`, the contract test, the `workspace-access-rls.test.ts` cases, the `idempotency-authorization.int.test.ts` case. Run them red at the baseline (the route and migration do not exist).
3. Migration `0096`: `revoke update` then `grant update (revoked_at, version)` on `project_access_grants` to `goproceed_app`. Apply by hand to the local database.
4. Contract `revokeProjectAccessRequest` / `revokeProjectAccessResponse`; the route after DEV-021's shape; the error code.
5. Catalogs and documents (criterion 6).
6. Green runs, one file at a time; `gp-reviewer` and `gp-security` over the diff; fixes; `gp-qa` on the final revision.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | `gp-architect` | Design: route, check order, one-statement revoke under RLS, last-admin and view-cascade rules, column grant instead of a trigger, catalog rows, tests, four owner questions | `scratchpad/dev043-044-architect-r0.md` | Owner questions |
| 2 | Owner | Ruled on the four questions (above) and on DEV-044's two follow-ups | chat, 2026-09-23 | ADR-014, tests |
| 3 | Coordinator (tests first) | Four test files red at `a02b513` for the right reasons: the route module missing, the column privileges absent | `scratchpad/dev043-red.txt` | Implement |
| 4 | Coordinator (implementing) | Migration `0096` hand-applied to the local database (as `postgres`, version recorded); contract, route, error code, catalogs; `76b531c`. The test's `contracts.edit` probe was itself wrong (a schema 422 on both sides: `taxMode` `exclusive` without a rate) and now asserts the unknown customer party, which only an authorized call reaches | `scratchpad/dev043-green.txt` at `76b531c` | Review |
| 5 | `gp-reviewer`, `gp-security` (independent, round 1) | No blocker, no major; minors R1-01…R1-06, S1-01, S1-02; nits R1-07, R1-08, S1-03, S1-04 | `scratchpad/dev043-044-reviewer-r1.md`, `scratchpad/dev043-044-security-r1.md`, diff `scratchpad/dev043-044-diff-r0.patch` (`a4757253..392a0d1`) | Rework |
| 6 | Owner | S1-02: count only an undated survivor | chat, 2026-09-23 | Rework |
| 7 | Coordinator (rework) | Every finding fixed or deferred (below); `d25ff3b`. The new race test failed 3 of 9 runs with the lock disabled by a temporary environment switch (since removed) and 0 of 8 with it | `scratchpad/dev043-race-without-lock.txt`; `scratchpad/dev043-044-green-r1.txt` at `2d37c9c` | `gp-qa` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | minor | `revoke/route.ts`, an upper-case `memberId` | 200 vs a false 409 `notHeld` | coordinator | Fixed in `d25ff3b`: the id is lower-cased once; test «an upper-case member id is the same member» |
| R1-02 | minor | the self-removal cascade in one UPDATE was untested | a test vs none | coordinator | Fixed in `d25ff3b`: test «an administrator removing themselves…» (200, `[project.admin, project.view]`, then a 404 replay) |
| R1-03 | minor | the actor loses admin after `authorize` | 403 vs a false 409 `notHeld` | coordinator | Fixed in `d25ff3b`: `authorize` returns the actor's member id; without their live admin row in the lock set the answer is 403. Not reproducible deterministically; covered by reasoning, as the reviewer allowed |
| R1-04 / S1-01 | minor | a grant racing a `project.view` cascade | INV-111 holds vs an action capability left without view | coordinator | Fixed in `d25ff3b`: `apps/app/src/lib/project-access-lock.ts`, a transaction advisory lock both routes take before reading the member's grants; race test (3/9 red without the lock, 0/8 with it) |
| S1-02 | minor | a dated admin survivor let an administrator orphan a project in two steps | refused vs allowed | owner | Fixed in `d25ff3b` on the owner's ruling: only an undated survivor counts; test «a surviving administrator grant with an end date…»; INV-110, ADR-014 and BL-137 amended |
| R1-05d | minor | `rls-coverage.csv`, the grants row cited only the read test | traceability to the UPDATE test | coordinator | Fixed in `d25ff3b`: the row's reason names the DEV-043 UPDATE test |
| R1-06 | minor | STATUS «v1 API» row counts | the branch's counts vs 75/66 | coordinator | Fixed in `d25ff3b`: a dated prefix with 78 rows (M1 38) and 69 route files; the route-per-row pass not repeated |
| R1-07 | nit | two assertions could pass for the wrong reason | pinned causes | coordinator | Fixed in `d25ff3b`: the refusals assert «permission denied for table project_access_grants»; the mutual-revoke loser's code is checked |
| R1-08 | nit | `PROJECT_FINAL_ADMIN`'s producer named a state machine that does not exist | `guard:project_last_admin` | coordinator | Fixed in `d25ff3b` |
| S1-04 | nit | `capabilities` unbounded | bounded | coordinator | Fixed in `d25ff3b`: `.max(projectCapability.options.length)` |
| S1-rec | note | Telegram group membership and issued external links survive a removal; the `0011` helpers' `search_path` | recorded | coordinator | Deferred: BL-142, BL-143 |

Rework count and hypothesis changes: one rework after the first review (not a round: no QA FAIL and no new blocker). The rework changed behaviour only by the stated fixes; the last-administrator rule's tightening is the owner's ruling on S1-02. `gp-security` had no blocker or major, so no re-check is owed.

## What is not true after this task

- A project whose administrator grants are all dated can still lapse, and a suspended only administrator (including a suspension committed while a revoke runs) still leaves a project that cannot be administered through the product; the last-administrator rule covers revokes only (BL-137).
- `packages/testing/src/rls-coverage.test.ts`'s «the exposed set equals the registry, both ways» did not pass locally: the shared local database carries `public.requirement_reference_image_versions`, which PR #115's `0095` creates and which another session applied without a migration record. Its output names no relation of this change.
- The product can still clear `revoked_at` through a defect: the column grant allows it and no trigger makes it write-once (BL-138).
- A removed member stays in the project's Telegram group, and external review links they issued stay live (BL-142).
- No route lists grants, and no screen shows who holds what.
- External review links a revoked member issued stay live until `external_grants.revoke_reissue` retires them.
- A command the revoked member started before the revoke committed can still finish.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | red `a02b513`+tests; green `2d37c9c` | `npx vitest run tests/project-access-revoke.int.test.ts` in `apps/app` (APP_DB_URL set): 12 red, then 16 passed | PASS (coordinator's run; `gp-qa` below) | — |
| 2 | yes | `2d37c9c` | `packages/contracts` all: 145 passed | PASS (coordinator's run) | — |
| 3 | yes | `2d37c9c` | `packages/testing` `workspace-access-rls.test.ts`: 19 passed (2 DEV-043 cases red before `0096`) | PASS (coordinator's run) | assisted: `0096` hand-applied to the local database |
| 4 | yes | `2d37c9c` | `idempotency-authorization.int.test.ts`: 13 passed | PASS (coordinator's run) | — |
| 5 | yes | `2d37c9c` | ADR-014 Approval section, index row; `pnpm validate:canonical-docs` OK | PASS (coordinator's run) | — |
| 6 | yes | `2d37c9c` | `pnpm validate:canonical-docs` OK; `pnpm validate:agents` OK | PASS (coordinator's run) | — |
| 7 | yes | `2d37c9c` | `pnpm turbo run typecheck --force`: 10 of 10 | PASS (coordinator's run) | — |
| 8 | yes | `2d37c9c` | `projects.int.test.ts` 8, `vertical-m1.int.test.ts` 9, `error-catalog-fidelity.test.ts` 1, `capability-vocabulary.test.ts` 2 passed; `rls-coverage.test.ts` 21 of 22 | PASS / FAIL | FAIL: known-red baseline: `rls-coverage` «exposed set equals the registry» names only PR #115's `requirement_reference_image_versions`, present in the shared local database without its migration record |
| 9 | no | — | GitHub Actions starts no jobs until October 2026 | NOT RUN | environmental: billing block; settles with CI `verify` on the PR head |

Evidence files (scratchpad of this session, each with its command output, exit status and `git rev-parse HEAD`): `dev043-red.txt`, `dev043-green.txt`, `dev043-race-without-lock.txt`, `dev043-044-green-r0.txt`, `dev043-044-green-r1.txt`.

## Sources

- PostgreSQL 17 documentation, «Function Volatility Categories»: `STABLE` functions «use a snapshot established as of the start of the calling query», so `app.has_project_capability` in `pag_update` sees the grants as they were when the revoke statement began: https://www.postgresql.org/docs/17/xfunc-volatility.html — applies to the local stack's server 17.6 (`show server_version`, 2026-09-23); accessed 2026-09-23.
- PostgreSQL 17 documentation, «REVOKE»: revoking a table privilege also revokes the corresponding column privileges, which is why `0096` revokes table `UPDATE` before granting it on two columns: https://www.postgresql.org/docs/17/sql-revoke.html — server 17.6; accessed 2026-09-23.

## Completion / handoff

- Changed / inspected files: the allowed edit paths above, plus `apps/app/src/lib/project-access-lock.ts` (new, the review fix) and the grant route (the lock).
- Review independence: independent — `gp-architect`, `gp-reviewer`, `gp-security` as native `gp-*` subagents; `gp-qa` below.
- Verified scope: see Acceptance evidence.
- Remaining risks / blocked requirements: BL-137, BL-138, BL-139, BL-140, BL-141, BL-142, BL-143; the hosted project is at `0095` and `0096` is not applied there (the owner's decision).
- Next bounded action and owner: `gp-qa` on the final revision; then the owner reviews and merges the PR and decides the hosted push of `0096`–`0097`.
- Final state and reason: verifying, until `gp-qa` reports.
