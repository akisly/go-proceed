# DEV-076 — BL-099: the cross-workspace write minimum, stage 1 (registry, checker, gaps)

## Assignment

- Objective and user-visible outcome:
  - No user-visible change.
  - A `covered` row of `technical/database/rls-coverage.csv` today proves an authorised same-workspace read and a cross-workspace read denial. From this task on, when its principal can also write, it needs a cross-workspace write-denial test too.
  - Stage 1 adds:
    - `technical/database/rls-write-coverage.csv`, one row per covered pair holding a write, with the write it holds;
    - its checks: `rls-coverage.test.ts` against the database, and `scripts/validate-canonical-docs.mjs` without one;
    - the 65 gaps it opens, filed as BL-164 … BL-173 by module;
    - the wording of the minimum wherever it is stated.
  - Later stages close the gaps module by module.
- State: reviewing
- Coordinator: Claude Code primary session, 2026-09-24.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): the task changes a machine catalog under `technical/` that tests and the validator read, the tenant-isolation test gate, and executed code under `packages/testing` and `scripts/`, so the route is `gp-architect` → owner decisions → failing test → implementation → `gp-reviewer` + `gp-security` → `gp-qa`.
- Triggered stages and why:
  - `gp-architect`: the task changes the RLS test minimum and INV-060's enforcement.
  - `gp-security`: RLS and grants are what the registry checks, and BL-099 is gp-security's own finding (DEV-013 S1-04).
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered.
- Owning module and allowed edit paths:
  - `technical/database/rls-write-coverage.csv` (new);
  - `packages/testing/src/rls-coverage.ts` and `rls-coverage.test.ts`;
  - `scripts/validate-canonical-docs.mjs`;
  - `technical/database/invariant-catalog.csv` (INV-060);
  - `docs/delivery/test-strategy.md`, `docs/architecture/tenancy-and-security.md`, `docs/delivery/production-readiness.md`, `docs/delivery/version-0.1.md` (a dated annotation) and `docs/delivery/pilot-execution-runbook.md`;
  - `docs/BACKLOG.md`, this record, and `docs/tasks/README.md`.
- Read context and applicable local instructions:
  - root `AGENTS.md`;
  - [DEV-013](DEV-013-m0-gate11-coverage-checker.md) (the registry, S1-04), DEV-014 … DEV-016 (the read gaps), and [DEV-018](DEV-018-gate11-closure.md) (gate 11 closed);
  - `supabase/migrations/0096_the_grant_that_could_be_rewritten.sql` (the column grant) and `0031` (`upload_intents`).
- Linked spec, ADR or earlier task: BL-099; INV-060; INV-001; readiness gate 11.
- Baseline: `origin/main` `0fa1aec6`.
- Dependencies / constraints / out of scope:
  - No migration, no policy change and no new write-denial test in this stage.
  - The external-session insert branches (`audit_insert_external`, `outbox_insert_external`) stay outside the minimum and stay named as they are now; this is the coordinator's reading of gp-architect's (d), not an owner ruling.
  - The service plane's actor-bearing path stays BL-101.
  - No local database is running in this container, so the database-backed tests run in CI.
- Required acceptance criteria:
  - AC-1: the write registry names every covered pair holding a write, with the privileges it holds (a column-only grant as `VERB(col col)`), and the database test compares both ways (`unclassified`, `stale`, `mismatched`, `notCovered`).
  - AC-2: a probe proves the comparison reports a column-level UPDATE grant on a covered table that holds no write.
  - AC-3: no principal holds TRUNCATE or TRIGGER on an in-scope relation, and a probe proves the query reports one.
  - AC-4: the validator accepts a write gap only for a key on the pinned DEV-076 baseline. It refuses:
    - a key that is not covered in the read registry, or a different module;
    - a malformed or misordered `privileges`;
    - a covered row without a valid citation.

    Its self-tests prove each refusal.
  - AC-5: BL-164 … BL-173 exist (P1), and every gap row names its module's entry.
  - AC-6: the minimum is restated where it is stated today. Gate 11 is not reopened; the widening is recorded as a dated tightening.
  - AC-7: full CI on the pull request (the database-backed tests run there).
- Skipped stages and rationale: `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | BL-099: widen the minimum now, in stages. The checker requires a write-denial test for every row that grants a write; the gaps become backlog items by module and close in several PRs, before real data | Owner's answer in the session («Widen now, in stages») |
| 2026-09-24 | Gate 11 is not reopened: the write minimum is a dated tightening, deadline «before real customer data enters an environment» | Owner's answer in the session |
| 2026-09-24 | Where the principal can UPDATE the tenant key or a parent column, the move-out test (own row moved into another workspace) is required | Owner's answer in the session |
| 2026-09-24 | A trigger's refusal does not count as the denial: the policy must deny | Owner's answer in the session |
| 2026-09-24 | The new per-module entries are P1 | Owner's answer in the session |

## Plan

1. `gp-architect` designs the registry shape, the minimum, the checks and the stages.
2. Measure the writes on `goproceed-staging` (read-only) with the SQL the test will use.
3. Failing first: the fixture tests of `compareWriteCoverage` and the database test «the write-holding covered pairs equal the write registry, both ways» (red without the CSV, in CI's shape); the validator's self-tests.
4. The CSV, the validator, the backlog entries and the documents.
5. `gp-reviewer` + `gp-security`, then `gp-qa`; CI on the pull request.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | Design:<br>• A separate registry file, `rls-write-coverage.csv`, with columns `schema,relation,principal,module,privileges,classification,negative_test,backlog_id,reason`, one row per covered pair holding a write.<br>• A write gap is ratcheted by a pinned baseline list.<br>• The minimum per privilege: INSERT with the other workspace's keys refused, with a control; UPDATE and DELETE of the other workspace's row affecting nothing, read back unchanged; move-out where the key is updatable. A trigger refusal does not count.<br>• Checks: the database side via `has_table_privilege` plus `has_column_privilege`; the static side trusts `privileges`, which the database test pins.<br>• Stages by module, BL-164 … BL-173.<br>• A TRUNCATE/TRIGGER assertion.<br>• Corrections to the coordinator's first count: `project_access_grants`' UPDATE is on `revoked_at, version` only (`0096:31`); `upload_intents` has no UPDATE (`0031:48`). The row count stays 65.<br>• Owner questions (a)–(e) → Owner decisions | Subagent report (session) | Measure |
| 2 | Coordinator | Read-only on `goproceed-staging` at `0102` as `postgres`, with the query `WRITE_PRIVILEGES_SQL` now holds, over the 76 covered pairs: 65 pairs hold a write — INSERT 65, UPDATE 35 (one column-only: `project_access_grants` `UPDATE(revoked_at version)`), DELETE 5. By module: workspace_access 14, communication 11, contract_baseline 10, requirements 9, execution 6, statutory 4, evidence 3, external_review 3, operational 3, projection 2. No principal holds TRUNCATE or TRIGGER on any in-scope relation | Connector results, 2026-09-24 | Implement |
| 3 | Coordinator | Implemented:<br>• `rls-coverage.ts`: `WRITE_COVERAGE_COLUMNS`, `parseWriteCoverageCsv`, `readWriteCoverageRegistry`, `WRITE_PRIVILEGES_SQL`, `TRUNCATE_OR_TRIGGER_SQL`, `compareWriteCoverage`.<br>• `rls-coverage.test.ts`: five fixture cases; database cases «the write-holding covered pairs equal the write registry, both ways» and «no principal holds TRUNCATE or TRIGGER», each with a rolled-back probe (a column UPDATE on `evidence_objects`; a TRUNCATE on a covered table).<br>• `rls-write-coverage.csv`: 65 gap rows.<br>• The validator: `rlsCitationErrors` extracted from `rlsCoverageErrors` unchanged in behaviour (its self-tests pass), `rlsWriteCoverageErrors` with a 65-key `RLS_WRITE_GAP_BASELINE`, and 21 self-tests.<br>• BL-164 … BL-173 (P1); BL-099 scheduled → DEV-076.<br>• The minimum restated in `test-strategy.md` §4, `tenancy-and-security.md`, `production-readiness.md` §11, `version-0.1.md` (a dated annotation to the gate 11 *Limits*), the runbook §5.11 and INV-060 | `git diff 0fa1aec6` | Checks |
| 4 | Coordinator | Checks:<br>• `pnpm turbo run typecheck` 10/10.<br>• The fixture cases of `rls-coverage.test.ts` 11 passed (the 20 database cases filtered out: no local database — Docker's daemon is not running in this container).<br>• `pnpm validate:canonical-docs` OK. Mutation: disabling the baseline check makes the validator fail «rls write coverage (gap outside the baseline)».<br>• The database comparison without a database: `WRITE_PRIVILEGES_SQL` rendered with the 76 covered pairs and run read-only on `goproceed-staging` returned the 65 rows, and `compareWriteCoverage` over them was empty against the CSV and 65 `unclassified` against an empty registry. The same test on CI's migrated database is the first run against a database built from the migrations | Session output; connector result | gp-reviewer, gp-security |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## What is not true after this task

- No cross-workspace write denial is proved by this stage: all 65 rows are gaps. BL-164 … BL-173 close them.
- The local database was not running here. The write registry was measured on `goproceed-staging`; the local stack or CI's database could differ, and the CI run is the first comparison against a migrated-from-scratch database.
- The validator trusts `privileges`; only the database test pins it. Whether a cited test's body exercises each verb stays a review judgement.
- A write held through a SECURITY DEFINER function, a storage path or a sequence is outside the registry, as before.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- PostgreSQL 17, `CREATE POLICY`, https://www.postgresql.org/docs/17/sql-createpolicy.html. The hosted server runs 17.6.
  - DEV-014 read this page on 2026-09-16 and recorded that `ALL` policies apply to both the selection side and the modification side, and that `WITH CHECK` is enforced before other constraints.
  - From this container on 2026-09-24 the page was **not re-read**: the egress proxy blocks `www.postgresql.org` («EGRESS_BLOCKED»).
  - This task relies on three further statements from the same pages, taken from gp-architect's reading and not re-read here:
    - a policy without `WITH CHECK` uses its `USING` expression for new rows;
    - row security does not apply to `TRUNCATE`;
    - BEFORE triggers run before `WITH CHECK`.

    Each is for gp-security to confirm or challenge. The TRUNCATE assertion stands whatever the page says, because it only requires that no principal holds the privilege.
- PostgreSQL 17, «System Information Functions» (`has_table_privilege`, `has_column_privilege`). Their behaviour was observed on `goproceed-staging` rather than read: the column-only grant `0096:31` makes before this change reads as `UPDATE(revoked_at version)`.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: rows 1–4.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-reviewer` and `gp-security`, then `gp-qa`.
- Final state and reason: reviewing.
