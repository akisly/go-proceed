# DEV-048 — BL-140: a grant keeps the member's `project.view` covering their action capabilities

## Assignment

- **Objective and user-visible outcome:** `project_access.grant` never leaves a member holding an unexpired action capability on a project whose `project.view` ends sooner or has already lapsed. Under the per-member lock it keeps one unrevoked, live `project.view` that ends no earlier than the member's unexpired action capabilities there (including the ones it grants): a lapsed, not-yet-valid or shorter view is revoked and a covering one inserted. It refuses a `project.view` grant on its own that would end before them (422 on `validUntil`), and it never shortens a view. As a side effect, re-granting a lapsed `project.view` works again; before, it was skipped as a duplicate.
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** an access rule on an existing `/v1` command, designed by `gp-architect` → failing test → route and invariant → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (a capability rule on `project_access.grant`); `gp-security` (the grant writes `revoked_at` on the member's view and widens nothing else; authorization of a command that grants access). `gp-ui-reviewer`, `gp-mobile`, `gp-researcher`: not triggered.
- **Owning module and allowed edit paths:** `apps/app/app/v1/projects/[projectId]/access-grants/route.ts`; `apps/app/tests/project-access-grant.int.test.ts` (new); `technical/database/invariant-catalog.csv` (INV-111); `docs/BACKLOG.md` (BL-140, BL-146); this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`, `apps/app/AGENTS.md`; ADR-014 decision 1; `supabase/migrations/0010`, `0011`, `0096`; INV-111; `apps/app/src/lib/project-access-lock.ts`.
- **Linked spec, ADR or earlier task:** BL-140, filed by [DEV-043](DEV-043-project-access-revoke.md); INV-111; cluster DEV-046 to DEV-052.
- **Baseline:** `31eaf36` (DEV-047) on `origin/main` `20f2b67`.
- **Dependencies / constraints / out of scope:** no migration. The Telegram evidence resolver (`0084`) still checks `evidence.record` alone; with the grant rule, a product-written member can no longer hold it past their view, so the resolver is left to BL-024. Re-granting a lapsed *action* capability is still skipped as a duplicate (BL-146).
- **Required acceptance criteria:**
  1. `apps/app/tests/project-access-grant.int.test.ts` (truncates nothing; its own `de48…` workspace) fails at the baseline and passes after the change. The cases: a covering undated view is left alone; a view ending tomorrow is replaced by an undated one for an undated action, the old one is revoked, and the audit record names it; a view is extended to a dated action's end; the view covers the member's other unexpired actions too; a lapsed unrevoked view is re-granted; a view-only grant ending before the actions is 422 on `validUntil` and writes nothing; a lapsed action does not hold the view open; a covering view is never shortened.
  2. `project-access-revoke.int.test.ts` and the suites that drive the grant route still pass (the cluster's final run).
  3. INV-111 states the grant half; `pnpm validate:canonical-docs` passes; `tsc` for `apps/app` passes.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | BL-140 joins the cluster | chat, answer «… BL-140 окно view …» |
| 2026-09-24 | The grant aligns `project.view`'s window (the architect's recommendation), rather than the capability checks requiring `project.view` too; the coordinator chose it, told the owner, and the owner may reverse it | coordinator's report to the owner, 2026-09-24 |

## Plan

1. Failing test: the eight cases above.
2. The route: compute the member's required view end from unexpired actions and the ones requested; refuse a short view-only grant; insert actions as before; keep, or revoke and replace, `project.view`; name replaced ids in the audit record.
3. INV-111; BL-140 scheduled; BL-146 filed.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | Align the view's window under the existing member lock; a view-only grant ending before live actions is 422; no migration, no ADR (it strengthens «an action capability adds view» inside the existing operation) | architect report, 2026-09-24 | failing test |
| 2 | coordinator | Red: 5 failed, 3 passed (the three that pass are guards: a covering view left alone, a lapsed action, never shortened) | `scratchpad/dev048-red.txt` (HEAD `31eaf36` + the test) | route |
| 3 | coordinator | Green: 8 passed on three consecutive runs; the first run after the change timed out in `beforeAll` (10 s) with no lock waiter visible afterwards (only an autovacuum of `pg_class`), recorded, not explained. `tsc --noEmit -p apps/app` exit 0 | `scratchpad/dev048-green.txt` | catalogs, review |
| 4 | coordinator | Re-granting a lapsed, unrevoked *action* capability is still skipped as a duplicate, and a re-grant never extends an action's window; outside BL-140, filed as BL-146 | `apps/app/app/v1/projects/[projectId]/access-grants/route.ts` (the duplicate check) | — |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## What is not true after this task

- Grant rows written outside the product (a superuser session, the fixtures) can still leave an action without a covering view.
- The Telegram evidence resolver still checks `evidence.record` alone (BL-024).
- Re-granting a lapsed action capability is still a silent no-op (BL-146).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- No third-party behaviour beyond PostgreSQL row locks the local stack exercises (PostgreSQL 17.6).

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
