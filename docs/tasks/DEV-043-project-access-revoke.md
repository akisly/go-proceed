# DEV-043 — BL-021: a project administrator can revoke a member's project access

## Assignment

- **Objective and user-visible outcome:** a project administrator can revoke a member's grants on a project by member and capability (`POST /v1/projects/{projectId}/access-grants/revoke`); revoking `project.view` removes the member from the project; the last live administrator grant cannot be revoked; a lapsed grant can be revoked, which frees its capability for a new grant; and the application role can change no grant column but `revoked_at` and `version`. Scope set by [ADR-014](../decisions/ADR-014-revoke-access-and-end-responsibility.md) decisions 1 and 4.
- **State:** implementing
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

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

- A project whose only administrator grant lapses through `valid_until`, or whose only administrator's membership is suspended, still cannot be administered through the product; the last-administrator rule covers revokes only.
- The product can still clear `revoked_at` through a defect: the column grant allows it and no trigger makes it write-once.
- No route lists grants, and no screen shows who holds what.
- External review links a revoked member issued stay live until `external_grants.revoke_reissue` retires them.
- A command the revoked member started before the revoke committed can still finish.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- PostgreSQL 17 documentation, «Function Volatility Categories»: `STABLE` functions «use a snapshot established as of the start of the calling query», so `app.has_project_capability` in `pag_update` sees the grants as they were when the revoke statement began: https://www.postgresql.org/docs/17/xfunc-volatility.html — applies to the local stack's server 17.6 (`show server_version`, 2026-09-23); accessed 2026-09-23.
- PostgreSQL 17 documentation, «REVOKE»: revoking a table privilege also revokes the corresponding column privileges, which is why `0096` revokes table `UPDATE` before granting it on two columns: https://www.postgresql.org/docs/17/sql-revoke.html — server 17.6; accessed 2026-09-23.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
