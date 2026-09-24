# DEV-051 — BL-137: the records say what the last-administrator rule already covers

## Assignment

- **Objective and user-visible outcome:** no behaviour changes. The records stop claiming that a project can lose its last administrator through the product: INV-110, ADR-014 (a dated amendment), the tenancy paragraph and BL-137 say that the product keeps an active member with a live, undated `project.admin` on every project, and name what can still orphan one — SQL outside the product, a future suspend or end command (BL-014, which now carries the refusal as an acceptance criterion), and an only administrator who has left. BL-137 drops to P3. Two guard tests pin the grant's half.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** an invariant-catalog and ADR correction with guard tests: `gp-architect` → owner ruling → tests and records → `gp-reviewer` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (an invariant and a governance rule on project access). `gp-security`: not triggered — no RLS, grant, function, auth or secret changes, and no code outside a test. `gp-ui-reviewer`, `gp-mobile`, `gp-researcher`: not triggered.
- **Owning module and allowed edit paths:** `apps/app/tests/project-access-grant.int.test.ts`; `technical/database/invariant-catalog.csv` (INV-110); `docs/decisions/ADR-014-revoke-access-and-end-responsibility.md` and `docs/decisions/README.md`; `docs/architecture/tenancy-and-security.md`; `docs/BACKLOG.md` (BL-137, BL-014); this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`; ADR-014 decision 1; INV-110; `apps/app/app/v1/workspaces/[workspaceId]/projects/route.ts`; the grant and revoke routes; `supabase/migrations/0011` (`pag_insert`, `app.project_has_grants`).
- **Linked spec, ADR or earlier task:** BL-137, filed by [DEV-043](DEV-043-project-access-revoke.md); cluster DEV-047 to DEV-054.
- **Baseline:** `18319158` (DEV-050).
- **Dependencies / constraints / out of scope:** no route, migration or contract change. A workspace owner's recovery path and the suspend guard belong to BL-014. A future membership command must refuse orphaning a project (BL-014's new acceptance line).
- **Required acceptance criteria:**
  1. `apps/app/tests/project-access-grant.int.test.ts` gains two cases, both passing: a dated re-grant of `project.admin` to its undated holder is skipped and the grant stays undated; another member's dated admin grant, granted through the route and then lapsed, leaves the creator's undated grant, and the creator can still grant. They are guards of existing behaviour, green at the baseline by design. The file's other eight cases still pass.
  2. INV-110's «Not covered», ADR-014's amendment, the tenancy paragraph, BL-137 (P3) and BL-014 agree with the code paths `gp-architect` cited; `pnpm validate:canonical-docs` passes.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | BL-137 is in this session's cluster | chat, answer «Доступ к проекту (Рекоменд.)» (DEV-047's record) |
| 2026-09-24 | Correct the records, lower BL-137 to P3 and decide recovery with BL-014 | chat, answer «Зафиксировать + BL-014 (Рекоменд.)» |

## Plan

1. Guard tests in the grant suite.
2. INV-110, ADR-014 amendment, tenancy paragraph, BL-137, BL-014.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | Proof by induction: `projects.create` inserts an undated admin (`workspaces/[workspaceId]/projects/route.ts:35-40`); the revoke keeps a live undated admin of an active member (`revoke/route.ts`); the grant skips a held capability as a duplicate and replaces only `project.view` (`access-grants/route.ts`). No product path suspends or ends a membership (members route is `GET` only; no UPDATE policy on `memberships`). Options A, A+, B, C | architect report, 2026-09-24 | owner |
| 2 | owner | «Зафиксировать + BL-014» | chat, 2026-09-24 | tests and records |
| 3 | coordinator | Grant suite 10 passed (the two new cases are guards) | `scratchpad/dev050-run.txt` | review |
| 4 | coordinator | The lapse case re-dates a grant by SQL; DEV-052's write-once trigger (BL-138) will refuse that outside replica mode, so DEV-052 reworks it with the other fixture sites | this record | DEV-052 |
| 5 | gp-architect | Found on the way: a grant or assignment with a past `validUntil` hits the tables' CHECK and answers 500; the owner put it in the cluster as BL-149 / [DEV-054](DEV-054-window-ends-after-start.md) | architect report, 2026-09-24 | DEV-054 |
| 6 | gp-reviewer | R1 HOLD on R1-01 (records); the claim verified path by path in the code; R1-02 minor, R1-03 nit | reviewer report, 2026-09-24, on `scratchpad/dev050-r1.diff` | fixes |
| 7 | coordinator | Stated fixes applied; grant suite 10 passed; `validate:canonical-docs` OK | `scratchpad/dev050-run-r2.txt` | gp-qa |
| 8 | gp-qa | PASS on criteria 1–2; the three fixes in place; rework within them; revoke suite 20 passed alongside | QA report, 2026-09-24, on `scratchpad/dev050-r2.diff` | commit |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | minor | BL-137 title, Evidence, Depends on | the title still named the two unreachable paths | coordinator | fixed: retitled in the index and the heading; Evidence and Depends on rewritten with the superseded text noted |
| R1-02 | minor | ADR-014 «does NOT authorise»; amendment wording | no pointer from the old bullet; «overstates what the product allows»; «outside the product» without «today» | coordinator | fixed: inline `*[Amended …]*` pointer; both phrases corrected |
| R1-03 | nit | the lapse test | no positive control: it would pass if the dated grant were never written | coordinator | fixed: asserts the member's dated admin row, then 403 `SCOPE_PROJECT_DENIED` for the member after the lapse |

Rework count and hypothesis changes: none (first review HOLD on R1-01; fixes limited to the stated ones).

## What is not true after this task

- A project can still be orphaned by SQL, and by an only administrator who leaves while their membership stays active; nothing recovers it through the product (BL-137, BL-014).
- The hosted database has not been checked for a project that already has no live undated administrator.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | `18319158` + the working tree (`dev050-r2.diff`) | `npx vitest run tests/project-access-grant.int.test.ts` in `apps/app`: 10 passed; `project-access-revoke.int.test.ts`: 20 passed | PASS (`gp-qa`'s run) | guards, green at the baseline by design; the lapse is written by SQL |
| 2 | yes | same | the five records checked against the cited code paths; `pnpm validate:canonical-docs` OK | PASS (`gp-qa`'s check) | the hosted database was not checked for an orphaned project |

## Sources

- No third-party behaviour.

## Completion / handoff

- Changed / inspected files: the grant suite, INV-110, ADR-014 and its index row, the tenancy paragraph, BL-137 and BL-014, this record and the task index.
- Review independence: `gp-architect`, `gp-reviewer` and `gp-qa` ran as independent native subagents.
- Verified scope: criteria 1–2.
- Remaining risks / blocked requirements: «What is not true after this task»; the lapse test's SQL re-dating is reworked by DEV-052.
- Next bounded action and owner: the cluster's final run (DEV-053); push and merge are the owner's.
- Final state and reason: verifying until the cluster's final run.
