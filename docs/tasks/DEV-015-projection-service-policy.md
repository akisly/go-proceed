# DEV-015 — BL-100: the service plane is confined to its declared workspace on the readiness projections

## Assignment

- **Objective and user-visible outcome:** `br_write_server` and `rp_write_server` (0045) stop admitting every workspace to the service plane: a service transaction reaches only the projection rows of the workspace it declared, and none when it declares nothing. BL-100 closes; BL-096's two `goproceed_service` rows become `covered`, so readiness gate 11 moves from 24 gap rows to 22.
- **State:** reviewing
- **Coordinator:** primary Claude Code session, 2026-09-17.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** an RLS policy change and a migration: `gp-architect` → failing test → migration `0086` → `gp-reviewer` + `gp-security` → `gp-qa` (`agents/COORDINATION.md`, «Schema, migration, RLS…»).
- **Triggered stages and why:** `gp-architect` (`supabase/migrations/**`, RLS); `gp-security` (RLS policy). `gp-ui-reviewer` and `gp-mobile` are not triggered.
- **Owning module and allowed edit paths:** `supabase/migrations/0086_the_projection_the_service_could_not_scope.sql` (new); `packages/testing/src/projection-rls.test.ts` (new); `packages/testing/src/m5-external-rls.test.ts` §2 (the case that pinned the two `true` policies; rewritten, row 5); `technical/database/rls-coverage.csv` (the two `goproceed_service` projection rows); `technical/data-access-surface.csv` (DA-178 to DA-181); `technical/database/invariant-catalog.csv` (INV-001 enforcement and evidence); `technical/test-catalog.csv` (T-RLS-003); `docs/BACKLOG.md` (BL-100, BL-096 closed; BL-101); dated notes in `docs/delivery/production-readiness.md` §11, runbook §5.11 and §5.14 row 4, `docs/architecture/tenancy-and-security.md`; `docs/STATUS.md`; this record and the index. No grant, table, constraint or application code changes.
- **Read context:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/BACKLOG.md` BL-100, BL-101, BL-096; [DEV-014](DEV-014-gate11-workspace-communication.md); `supabase/migrations/0045_the_refusal_and_the_facts_behind_it.sql`; `packages/testing/src/m3-closure-rls.test.ts`, `m3-closure-fixture.ts`, `communication-rls.test.ts`.
- **Linked spec, ADR or earlier task:** BL-100; [DEV-014](DEV-014-gate11-workspace-communication.md) (found it); [DEV-013](DEV-013-m0-gate11-coverage-checker.md) (the registry).
- **Baseline:** `3fcff71` (main after PR #95).
- **Dependencies / constraints / out of scope:** the local database is at `0085`; `0086` is applied locally by hand as `postgres` only with the owner's permission, never through `supabase db reset`, and never to a hosted project by this task; test files run only with the owner's permission, one at a time. Out of scope: BL-101 (an actor-bearing service transaction), the other gap modules.
- **Required acceptance criteria:**
  1. `projection-rls.test.ts` fails at `0085` for the defect (a service transaction declaring A reads B's rows; declaring B or nothing updates, deletes and inserts A's rows) and passes at `0086`; it seeds its own workspaces, rolls every write back, cleans up, never calls `resetDb`, and leaves no residue.
  2. `0086` changes only the two policies' expressions (name, role, command kept), carries a self-check, and applies cleanly to the local database at `0085`; afterwards no `public` policy has `qual` or `with_check` `true`.
  3. The existing suites that touch the two policies pass at `0086`: `m3-closure-rls.test.ts` unchanged, and `m5-external-rls.test.ts` with its §2 pin rewritten as «no public policy is unconditional».
  4. The two `goproceed_service` projection rows are `covered` (52 covered, 22 gap, 7 exempt); BL-100 and BL-096 closed → DEV-015; DA-178 to DA-181, INV-001, T-RLS-003, readiness §11, runbook, tenancy note and STATUS agree.
  5. `pnpm validate:canonical-docs`, `pnpm validate:agents` and `pnpm --filter @goproceed/testing typecheck` pass.
  6. `rls-coverage.test.ts` against `0086` (not required: the owner did not allow a re-run on 2026-09-17; the validator checks the registry without a database).
  7. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-ui-reviewer`, `gp-mobile`: not triggered.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-16 | The service-plane projection policies are a separate DEV task (`gp-architect`, a migration, `gp-security`), started with the failing test | chat, DEV-014, answer «Отдельная DEV-задача» |
| 2026-09-17 | Start BL-100 now (after PR #95 was merged) | chat, «смержил, давай BL-100» |
| 2026-09-17 | Allowed: run the new `projection-rls.test.ts`; apply `0086` to the local database by hand; run `m5-external-rls.test.ts` and `m3-closure-rls.test.ts`. Not selected: a re-run of `rls-coverage.test.ts` | chat, multi-select answer |

## Plan

Numbered steps. For each step, name the files it touches and the check that proves it. A step that adds a contract, refusal or invariant starts with its failing test.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native) on `3fcff71` | **Design returned, read-only; no ADR.** `alter policy` in place on `rp_write_server` and `br_write_server`: `using/with check (workspace_id = app.service_workspace())`, names, role and command kept, like the Telegram service policies. Existing `m3-closure-rls` seeding (`asService(USER_A, WS_A)`, no `RETURNING`) still passes; a rebuild of the declared scope works with or without an actor; a foreign or missing declaration reads nothing, updates and deletes 0 rows, and inserts fail with 42501. BL-101 (inherited `rp_select`/`br_select`) left out; the clean fix is a restrictive service policy on every dual-plane table. Migration self-check compares against the 0080 policy's own expression. Test in DEV-014's shape with rolled-back writes. `m5-external-rls.test.ts` §2 pins exactly the two `true` policies and breaks at `0086`: rewrite it. Owed: DA-178 to DA-181, INV-001, BACKLOG, readiness, runbook, STATUS marker, tenancy note. Hosted staging holds `0045`'s policies (58/58, 2026-08-19); nothing is pushed by this task | architect report | Owner permissions; red first |
| 2 | implementing (coordinator): red | The two registry rows cited the not-yet-written file: validator rc 1, 4 problems. `projection-rls.test.ts` written; validator rc 0, typecheck rc 0. **At `0085`, alone: 4 of 4 failed for the defect** — declaring A read both workspaces' rows (`[A, B]`), and declaring B or nothing updated, deleted and inserted A's rows (`[1, 1, 1]` for `[0, 0, "42501"]`). No residue | `scratchpad/dev015-red-validator.txt`, `dev015-validator-test.txt`, `dev015-typecheck-1.txt`, `dev015-red-db.txt` | Migration |
| 3 | implementing (coordinator): `0086` | Written as designed; applied by hand as `postgres` in one transaction (`ALTER POLICY` ×2, `COMMENT` ×2, self-check `DO` passed) and recorded in `supabase_migrations.schema_migrations`. Afterwards both policies read `(workspace_id = app.service_workspace())` on both sides, and no policy in the database has `qual` or `with_check` `true` | `scratchpad/dev015-apply-0086.txt`, `dev015-policies-0086.txt` | Green |
| 4 | implementing (coordinator): green | `projection-rls.test.ts` alone at `0086`: **4 passed**; no residue | `scratchpad/dev015-green-db.txt` | Existing suites |
| 5 | implementing (coordinator): existing suites | `m5-external-rls.test.ts` §2 «the two service-role policies that use `true` are NOT granted to goproceed_app» rewritten as «no public policy is unconditional, for any role» (an empty list, guarded by a count of all `public` policies); no document cites the old title. Alone at `0086`: `m5-external-rls.test.ts` **10 passed**; `m3-closure-rls.test.ts` (unchanged) **28 passed**; no residue | `scratchpad/dev015-m5.txt`, `dev015-m3.txt` | Documents |
| 6 | implementing (coordinator): catalogs and documents | Registry 52/22/7; BL-100 and BL-096 `closed → DEV-015`; BL-101 names the projection tables and the restrictive-policy fix; DA-178 to DA-181 (the two tables had no row on either plane); INV-001 enforcement and evidence; T-RLS-003; dated notes in readiness §11, runbook §5.11 and §5.14 row 4, the tenancy note; STATUS marker `0086`, the migration row, the M0 row and next actions (with DEV-014's and DEV-015's re-observation notes). Validator rc 0. Final runs are taken after this row is written | `scratchpad/dev015-validator-docs.txt`, `dev015-final-*.txt` | Commit; `gp-reviewer`, `gp-security` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

- **`0086` is on the local database only.** No hosted project has it; staging's last recorded apply (58/58, 2026-08-19) predates even `0062`'s `app.service_workspace()`, so a push applies `0059`–`0086` in order (runbook Q-9).
- **An actor-bearing service transaction is still not confined** on the projections (BL-101): `rp_select` and `br_select` admit the actor's other workspaces.
- **Readiness gate 11 is not closed.** 22 gap rows remain (BL-091 to BL-095, BL-097).
- **Only four files ran**, each alone, locally: `projection-rls`, `m5-external-rls`, `m3-closure-rls` (and `projection-rls` red at `0085`). `rls-coverage.test.ts` was not re-run at `0086`, the unfiltered package run is owed, and nothing ran in CI.
- **Write denial is asserted here for the service plane only**, as part of the defect; BL-099 (member-plane write denial) stays review.
- **Other service-plane tables still have no `data-access-surface.csv` rows** (the communication and Telegram tables); DEV-015 added only the projections'.

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

- PostgreSQL 17 `CREATE POLICY` — https://www.postgresql.org/docs/17/sql-createpolicy.html — server 17.6; accessed 2026-09-16 (DEV-014). `ALL` policies apply to the selection and modification sides; permissive policies combine with `OR`; `WITH CHECK` is enforced before other constraints.
- PostgreSQL 17 `ALTER POLICY` — https://www.postgresql.org/docs/17/sql-alterpolicy.html — server 17.6; accessed 2026-09-17. `ALTER POLICY` changes only the roles and the `USING` and `WITH CHECK` expressions (and the name, by `RENAME TO`); the command and the permissive or restrictive type need drop and create, so the in-place form cannot change them by accident.

## Completion / handoff

- Changed / inspected files:
- Review independence: same-session / independent (name the actual stage roles)
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
