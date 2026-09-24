# DEV-054 — BL-148: a grant or assignment window that ends before it starts is 422, not 500

## Assignment

- **Objective and user-visible outcome:** `project_access.grant` with a `validUntil` that is not in the future, and `project_responsibilities.assign` with a `validUntil` not later than its `validFrom` (or than now, without one), answer 422 `VALIDATION_FAILED` on `validUntil` and write nothing. Before, both reached the tables' CHECK `valid_until > valid_from` (`0010`) and answered 500 `INTERNAL_ERROR` — except a grant that would write nothing (a held view or a duplicate action), which answered 201 and is now 422 too. The schema compares `validUntil` with `validFrom` when both are sent; an end not after now is checked by the route inside `withIdempotency` against the transaction's `now()`, so an idempotent replay after the end has passed still returns the stored response.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a validation defect on two existing `/v1` commands, found by DEV-051's `gp-architect`: failing test → contract → `gp-reviewer` → `gp-qa`. The request shape and the error code are unchanged, so `gp-architect` is not re-run.
- **Triggered stages and why:** none beyond `gp-reviewer` and `gp-qa`. `gp-security`: not triggered (no RLS, grant, auth, secret or personal-data path; a request that failed with 500 now fails with 422 earlier). `gp-ui-reviewer`, `gp-mobile`, `gp-researcher`: not triggered (Zod 4's `superRefine` is the pattern already installed, `^4.4.3`).
- **Owning module and allowed edit paths:** `packages/contracts/src/project-access.ts` and its test; `apps/app/src/lib/grant-window.ts` (new); the grant and assign routes; `apps/app/tests/project-access-dates.int.test.ts` (new); `docs/BACKLOG.md` (BL-148); this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`; `supabase/migrations/0010_workspace_access_module.sql` (the two CHECKs); `apps/app/src/lib/command.ts` (the body parse and its `fieldErrors`); the grant and assign routes.
- **Linked spec, ADR or earlier task:** BL-148, found by [DEV-051](DEV-051-last-admin-records.md)'s `gp-architect`; cluster DEV-047 to DEV-054.
- **Baseline:** `18319158` (DEV-050); DEV-051's change touches none of these files.
- **Dependencies / constraints / out of scope:** a past `validFrom` on an assignment stays accepted, as before, and so does a window entirely in the past when both dates are sent (the CHECK compares only the two).
- **Required acceptance criteria:**
  1. `apps/app/tests/project-access-dates.int.test.ts` (truncates nothing; its own `de53…` workspace): a grant with a past `validUntil` is 422 on `validUntil` and writes nothing; a future one is 201; an assignment with a past `validUntil` and no `validFrom` is 422 and writes nothing; one whose `validUntil` equals or precedes `validFrom` is 422; a later one is 201; a repeat of a held grant with a past end is 422 and writes nothing (it answered 201 with nothing granted); a grant and an assignment replayed with their key after the database's clock has passed their end return the stored 201. Of the first four, three were red at the baseline (500 `INTERNAL_ERROR`); the future grant and the replay case are green there, and the repeat case is red at the baseline (201). All green after.
  2. `packages/contracts/src/project-access.test.ts`: the grant schema does not look at the clock; the assignment schema refuses a `validUntil` not later than `validFrom` on the path `validUntil`, accepts a past window when both are sent and a past end without `validFrom` (the route's check); a malformed date is reported once, on its own field.
  3. The suites that drive the grant and assign routes still pass (`project-access-grant`, `project-access-revoke`, `responsibility-end`, and the cluster's final run); `tsc` for `packages/contracts` and `apps/app` passes.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | The past-`validUntil` 500 joins the cluster | chat, answer «В кластер (Рекоменд.)» |

## Plan

1. Failing integration test for both routes.
2. One refinement shared by both request schemas.
3. BL-148 filed and scheduled.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | coordinator | Red: 3 failed with `500 INTERNAL_ERROR`, 1 passed (the future grant) | `scratchpad/dev053-red.txt` | contract |
| 2 | coordinator | Green: 4 passed; contract suite 8 passed; `tsc --noEmit` for `packages/contracts` and `apps/app` exit 0 | `scratchpad/dev053-green.txt` | review |
| 3 | gp-reviewer | R1 HOLD: R1-01 major (the clock in the schema turns a legitimate replay into 422), R1-02 minor (a malformed date also misfired the refinement), R1-03 minor (a no-op 201 is now 422, unrecorded) | reviewer report, 2026-09-24, on `scratchpad/dev053-r1.diff` | rework |
| 4 | coordinator | Rework: the schema keeps only `validUntil > validFrom` with a NaN guard; `refuseEndNotAfterNow` (new `src/lib/grant-window.ts`) runs first in both routes' idempotent body against the transaction's `now()` (the assign route only without `validFrom`); replay and no-op cases added. Dates suite 6 passed, contract suite 9 passed, `tsc` exit 0; grant 10, revoke 20, responsibility-end 7 passed | `scratchpad/dev053-green-r2.txt` | gp-reviewer round 2 |
| 5 | gp-reviewer | R2 PASS: R1-01 and R1-02 fixed correctly; R2-01..R2-03 minor, in the test and the record | reviewer report, 2026-09-24, on `scratchpad/dev053-r2.diff` | fixes, gp-qa |
| 6 | coordinator | R2 fixes applied; dates suite 6 passed. With the grant route's check removed, the repeat case fails (run alone it reaches the CHECK and answers 500, since the grant before it did not run; in file order it is the 201 no-op); the route restored byte for byte | `scratchpad/dev053-green-r3.txt` | gp-qa |
| 7 | gp-qa | PASS on criteria 1–3 (dates suite 6/6 twice, the replay waiting on the database clock both times); every finding's fix in place; the round-3 rework limited to R2-01..R2-03 | QA report, 2026-09-24, on `scratchpad/dev053-r3.diff` | commit |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | major | the schema's `Date.now()` branch; `command.ts` parses before the replay lookup | a replay after the end passed got 422 instead of the stored 201 | coordinator | fixed: the check moved into `withIdempotency`'s body (`grant-window.ts`), compared with the transaction's `now()`; the replay case in the dates suite |
| R1-02 | minor | `endsAfterStart` | a malformed date produced a second issue, and a malformed `validFrom` blamed `validUntil` | coordinator | fixed: NaN guard; contract case «a malformed date is reported once» |
| R1-03 | minor | the record; BL-148 | a past-end grant that wrote nothing answered 201 and is now 422 | coordinator | recorded in the objective and BL-148; the check runs first; pinned by the repeat case (R2-01) |
| R2-01 | minor | the R1-03 test | the view-only case was already 422 at the baseline (DEV-049's rule), so it could not tell the change | coordinator | fixed: replaced by a repeat of the held `contracts.edit` with a past end, which answered 201 at the baseline; asserts the row count unchanged |
| R2-02 | minor | the replay test | the host clock chose the end and the wait while the routes compare with the database's | coordinator | fixed: `until` from the database's `now()`; the wait polls the database until the end has passed |
| R2-03 | minor | criterion 1's wording | overstated which cases were red at the baseline | coordinator | fixed in criterion 1 |

Rework count and hypothesis changes: one rework after R1 (the clock check moved from the schema to the route); not a round.

## What is not true after this task

- No route maps a CHECK violation (23514) to 422; other CHECKs still answer 500 if a request reaches them.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | `b73b290b` + the working tree (`dev053-r3.diff`) | `npx vitest run tests/project-access-dates.int.test.ts` in `apps/app`: 6 passed, twice | PASS (`gp-qa`'s run) | the baseline red is on file for the first four cases; the repeat case's red is the coordinator's run with the check removed (its output not captured) |
| 2 | yes | same | `npx vitest run src/project-access.test.ts` in `packages/contracts`: 9 passed | PASS (`gp-qa`'s run) | — |
| 3 | yes | same | `project-access-grant` 10, `project-access-revoke` 20, `responsibility-end` 7 passed; `tsc --noEmit` for `packages/contracts` and `apps/app` exit 0; `validate:canonical-docs` OK | PASS (`gp-qa`'s run) | the cluster's final run is DEV-053's |

## Sources

- Zod 4 (`zod` `^4.4.3` in `packages/contracts/package.json`): `superRefine` and `ctx.addIssue({ code: "custom", path })`, the API the installed version's types accept (checked by `tsc`); `gp-reviewer` read the installed source for how format issues continue into refinements (`zod/v4/core/checks.js`, `util.js`).

## Completion / handoff

- Changed / inspected files: the two request schemas and their tests, `apps/app/src/lib/grant-window.ts`, the grant and assign routes, the new dates suite, BL-148, this record and the task index.
- Review independence: `gp-reviewer` (two rounds) and `gp-qa` ran as independent native subagents.
- Verified scope: criteria 1–3.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: the cluster's final run (DEV-053); push and merge are the owner's.
- Final state and reason: verifying until the cluster's final run.
