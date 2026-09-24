# DEV-049 — BL-140: a grant keeps the member's `project.view` covering their action capabilities

## Assignment

- **Objective and user-visible outcome:** `project_access.grant` never leaves a member holding an unexpired action capability on a project whose `project.view` ends sooner or has already lapsed. Under the per-member lock it keeps one unrevoked, live `project.view` that ends no earlier than the member's unexpired action capabilities there (including the ones it grants): a lapsed, not-yet-valid or shorter view is revoked and a covering one inserted. It refuses a `project.view` grant on its own that would end before them (422 on `validUntil`), and it never shortens a view. As a side effect, re-granting a lapsed `project.view` works again; before, it was skipped as a duplicate.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** an access rule on an existing `/v1` command, designed by `gp-architect` → failing test → route and invariant → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (a capability rule on `project_access.grant`); `gp-security` (the grant writes `revoked_at` on the member's view and widens nothing else; authorization of a command that grants access). `gp-ui-reviewer`, `gp-mobile`, `gp-researcher`: not triggered.
- **Owning module and allowed edit paths:** `apps/app/app/v1/projects/[projectId]/access-grants/route.ts`; `apps/app/tests/project-access-grant.int.test.ts` (new); `technical/database/invariant-catalog.csv` (INV-111); `docs/BACKLOG.md` (BL-140, BL-146); this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`, `apps/app/AGENTS.md`; ADR-014 decision 1; `supabase/migrations/0010`, `0011`, `0096`; INV-111; `apps/app/src/lib/project-access-lock.ts`.
- **Linked spec, ADR or earlier task:** BL-140, filed by [DEV-043](DEV-043-project-access-revoke.md); INV-111; cluster DEV-047 to DEV-053.
- **Baseline:** `31eaf36` (DEV-048) on `origin/main` `20f2b67`.
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
| 2026-09-24 | gp-security S1-01: disclose, not refuse — each granted row in the response names the end it was written with | chat, answer «Раскрывать (Рекоменд.)» |
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
| 5 | coordinator | The commit (`0d0968d`) was made before its review stages ran; `gp-reviewer` and `gp-security` ran late on `git show 0d0968d4`, 2026-09-24 | `scratchpad/dev048.diff` | reviews |
| 6 | gp-reviewer | R1 HOLD on R1-01 medium (a view not yet valid — a concurrent grant's — was revoked and could be replaced by a shorter one); R1-02, R1-03 low | reviewer report, 2026-09-24 | fixes |
| 7 | gp-security | S1 PASS: S1-01 low (a short action grant can silently give an undated view; owner's choice), S1-02 low (a skipped lapsed duplicate still widened the view), S1-03 low (the audit event lacked the view change); S1-04, S1-05 info | security report, 2026-09-24 | fixes, owner |
| 8 | coordinator | Fixes on the route: a current view always keeps the longer end; only inserted actions widen the view, and nothing is touched when there is nothing to cover and no view was asked for; an action is written from the request's string; the audit event carries `grantIds`, `validUntil` and `view` (`grantId`, `replacedValidUntil`). Tests: the not-yet-valid view, the skipped lapsed duplicate, the lapsed action's exact view end, the audit fields. Red with the route at `506ce05`: 3 failed, 9 passed; green 12. The cited `scratchpad/dev048-*.txt` files are not in this session's scratchpad (the earlier session's folder is empty), so the baseline red run cannot be re-inspected; the green half is re-evidenced by the cluster's final run at a later revision | `scratchpad/dev048-review-red.txt`, `dev048-review-green.txt` | gp-security re-check of R1-01, gp-qa |
| 9 | gp-reviewer | R2 PASS: R2-01 low (R1-03's string write left the view up to 1 ms short of the action), R2-02, R2-03 low (test gaps), R2-04, R2-05 info | reviewer report, 2026-09-24, on `scratchpad/dev048-rework.diff` | fixes |
| 10 | gp-security | S2 PASS: S2-01 low (= R2-01), S2-02 low (a future-dated view written outside the product is started early), S2-03 info (S1-01's state) | security report, 2026-09-24, same diff | fixes |
| 11 | coordinator | Round-2 fixes: the view is written with the request's string when its end is the request's own; the response names each granted row's `validUntil` (owner, S1-01); the audit's `view` gains `replacedValidFrom`; tests for the replaced future view, the `need = required` repair, the sub-millisecond end (red with the fix removed) and the disclosure; INV-111 reworded; the block moved above DEV-051's comment. Grant suite 15 passed | `scratchpad/dev048-review-green-r2.txt`, `dev048-r2-01-mutation.txt` | gp-qa |
| 12 | gp-qa | Late-review rework verified; baseline red rebuilt with the original test at a copy of `31eaf36`: 5 failed, 3 passed, as row 2; 13 further suites that drive the grant route pass. Residual (info): when the view's end comes from a stored row (a held action's end, or a not-yet-valid view's), it is read back as a millisecond `Date`, so the view can still end up to 1 ms short; needs a sub-millisecond `validUntil` and a concurrent grant. Deferred | QA report, 2026-09-24 | commit |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | medium | the `live` check and the view insert | a view not yet valid was revoked and could be replaced by a shorter one, against «never shortened» | coordinator | fixed: `current ? later(current.until, need) : need`; test «R1-01: a view not yet valid …» |
| R1-02 | low | the grant suite | the not-yet-valid case missing; the lapsed-action case did not check the view's end | coordinator | fixed: both |
| R1-03 | low | the action insert | a millisecond `Date` replaced the request's string | coordinator | fixed: the string is written |
| S1-01 | low | the window alignment | an action granted for a day can give the member an undated view if they hold an undated action, silently | owner | owner chose «Раскрывать»: each granted row in the response carries `validUntil`; test «each granted row names the end it was written with» |
| S1-02 | low | the window computation | a requested action skipped as a lapsed duplicate (BL-146) still widened the view | coordinator | fixed: only inserted actions and an explicit view request count; test |
| S1-03 | low | the audit event | no record of the view change or the window asked for | coordinator | fixed: `grantIds`, `validUntil`, `view` |
| S1-04 | info | INV-111; this record | rows written before DEV-049 can still be in the BL-140 state until the next grant to that member | coordinator | INV-111 «Not covered» and «What is not true» amended |
| S1-05 | info | time precision | a microsecond end can be covered by a view 1 ms short | coordinator | corrected: R1-03 created the new source (R2-01), which the round-2 fix removes; rows written before still carry it |
| R2-01 / S2-01 | low | the view insert | the view could end up to 1 ms before an action written from the request's string | coordinator | fixed: the request's string is written for the view when its end is the request's; test compares in SQL; red with the fix removed |
| R2-02 | low | the R1-01 test | did not prove the future view was replaced | coordinator | fixed: asserts it revoked and the survivor live |
| R2-03 | low | the grant suite | the `need = required` repair was untested | coordinator | fixed: test |
| R2-04 | info | INV-111; the route comment | «keeps one live view» read as every call | coordinator | fixed: conditioned on held or granted actions or a view request |
| R2-05 | info | the grant suite | the block sat under DEV-051's comment | coordinator | fixed |
| S2-02 | low | the view insert | a future-dated view written outside the product is started early | coordinator | the audit's `view` carries `replacedValidFrom`; INV-111 «Not covered» names it |
| S2-03 | info | this record | S1-01 read as both pending and decided | coordinator | fixed: the owner's decision recorded |

Rework count and hypothesis changes: none (first review, made late; fixes limited to the stated ones).

## What is not true after this task

- A view whose end comes from a stored row (a held action's, or a not-yet-valid view's) can still end up to 1 ms before it when that end has sub-millisecond digits; deferred (gp-qa, 2026-09-24).
- A replay of a grant response stored before this change carries no `validUntil`.
- Grant rows written before DEV-049 can still leave an action without a covering view until the next grant to that member; the Telegram resolver (0084) checks `evidence.record` alone (gp-security S1-04).
- A dated action grant can still widen a member's view to undated when they already hold an undated action; since the owner's ruling the response says so (`validUntil` per granted row).
- A future-dated view or action written outside the product is started early by the next grant (gp-security S2-02).
- Grant rows written outside the product (a superuser session, the fixtures) can still leave an action without a covering view.
- The Telegram evidence resolver still checks `evidence.record` alone (BL-024).
- Re-granting a lapsed action capability is still a silent no-op (BL-146).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | `506ce05` + the late-review rework | `project-access-grant.int.test.ts`: 15 passed; red rebuilt by `gp-qa`: 5 failed, 3 passed | PASS (`gp-qa`) | — |
| 2 | yes | same | `project-access-revoke` 20 and 13 further grant-driving suites | PASS (`gp-qa`) | CI blocked |
| 3 | yes | same | INV-111; `validate:canonical-docs` OK; `tsc` exit 0 | PASS | — |

## Sources

- No third-party behaviour beyond PostgreSQL row locks the local stack exercises (PostgreSQL 17.6).

## Completion / handoff

- Changed / inspected files: the grant route, its suite, the grant response type, INV-111, BL-140, BL-146, this record.
- Review independence: `gp-reviewer` (two rounds), `gp-security` (two rounds) and `gp-qa` ran late, as independent native subagents, after the commit; rows 5–12.
- Verified scope: criteria 1–3.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: merging is the owner's.
- Final state and reason: verifying until the owner's merge.
