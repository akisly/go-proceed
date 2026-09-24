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
- State: verifying
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
  - AC-3: no principal holds TRUNCATE, TRIGGER, REFERENCES or MAINTAIN on an in-scope relation, and a probe proves the query reports each (widened by S4).
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
| 5 | gp-reviewer | PASS WITH FINDINGS: R1 major (the ratchet pins keys, not writes), R2–R4 minor, R5–R6 nit (below). It verified the extracted helper, the SQL, the probes, the counts (65 rows; UPDATE 35, DELETE 5, one column-only), the catalogs and the docs | Subagent report (session) | Fixes |
| 6 | gp-security | PASS WITH FINDINGS: S1 and S2 major, S3–S5 minor, S6 nit (below). It confirmed the four PostgreSQL statements from knowledge, without re-fetching the pages. It found that ON CONFLICT, MERGE, RETURNING and COPY FROM add no write path beyond the verbs, and that the extracted helper behaves as before | Subagent report (session) | Fixes |
| 7 | Coordinator | Read-only on `goproceed-staging`: no principal holds TRUNCATE, TRIGGER, REFERENCES (table or column) or MAINTAIN on any in-scope relation. Fixes applied as stated below; the validator and its self-tests pass. Three mutations, each killed by the new self-tests: dropping the within-baseline check, dropping the every-key-is-a-gap check, and dropping the refusal of the read row's own test. `typecheck` 10/10; fixture cases 11 passed | Connector result; session output | Re-check, gp-qa |
| 8 | gp-security (re-check) | S1–S6 PASS at `1082304a`. New: N1 minor (a failing no-`WHERE` statement passes as a denial), N2 minor (a write gap on a read-gap pair skipped the baseline) — both fixed as stated below | Subagent report (session) | gp-qa |
| 9 | gp-qa | At `83bcb322`: AC-1 (static and fixture half), AC-4, AC-5 and AC-6 PASS. AC-1 (DB half), AC-2, AC-3 and AC-7 NOT RUN: no local database; CI settles them. Mutations killed: 5 in `compareWriteCoverage`, 9 validator rules and 3 data mutations. Every stated fix is in place. Q1 (nit): the acceptance table was empty; filled here | Subagent report (session) | Pull request, CI |
| 10 | Coordinator | PR #148 CI on `5e4c0397` (run 36073170834): `verify` and `app-qa` green. In `verify`, against CI's database built from the migrations, `src/rls-coverage.test.ts` ran 31 tests, none skipped, with the write comparison, both probes and the table-wide assertion among them; `packages/testing` 58 files passed | CI log of job 107878491123 | owner's merge |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1 | major | gp-security; test-strategy §4, BL-164 … BL-173 | An UPDATE or DELETE probe written with a `WHERE` is answered by the read policy alone, so a permissive UPDATE or DELETE `USING` passes | Coordinator | Fixed: the probe reads no column — no `WHERE`, a constant `SET`, no `RETURNING` — runs in a rolled-back transaction, and reads back the other workspace's rows as admin. Stated in both places |
| S2 / R1 / R2 | major | gp-security, gp-reviewer; `RLS_WRITE_GAP_BASELINE`, `writes()` | The baseline pinned keys, not writes; it covered only covered read pairs; and a key a stage covered or revoked could return as a gap | Coordinator | Fixed: the baseline is `key → privileges`, and a gap's writes must lie within it (a verb, a whole-table verb over a column one, a new column: each refused). Every baseline key must still be a gap row. The database query also runs over read-gap pairs, whose writes are accepted only as gaps on the read row's backlog id. Nine new self-tests |
| S3 | minor | gp-security; the INSERT probe | The other workspace's tenant key alone is refused by the tenant-key policy, so the probe does not find a missing composite FK | Coordinator | Fixed in the wording: an INSERT carrying the own tenant key with the other workspace's parent id, refused by the policy (42501) or the composite FK (23503); `DISABLE TRIGGER USER`, not `ALL` and not `replica` |
| S4 | minor | gp-security; `TRUNCATE_OR_TRIGGER_SQL` | REFERENCES and MAINTAIN were not asserted | Coordinator | Fixed: `TABLE_WIDE_PRIVILEGES_SQL` covers TRUNCATE, TRIGGER, REFERENCES (table and column) and MAINTAIN. The probe grants each one in turn. None is held on staging (row 7) |
| S5 / R4 | minor | gp-security, gp-reviewer; `rlsWriteCoverageErrors` | A write row could cite the read row's own test | Coordinator | Fixed: refused, with self-tests for the positive and the negative. BL-172 notes the consequence for `audit_events` and `transaction_outbox` |
| S6 | nit | gp-security; the query's comment | TRIGGER's risk was described backwards | Coordinator | Fixed: a trigger runs inside other principals' writes, as the session that fires it |
| R3 | minor | gp-reviewer; the TRUNCATE probe | The probe exercised only one branch of the query | Coordinator | Fixed by S4's per-privilege probe |
| R5 | nit | gp-reviewer; `WRITE_PRIVILEGES_SQL` | The DELETE guard relied on evaluation order | Coordinator | Fixed: `case when v.verb = 'DELETE' then null else … end` |
| R6 | nit | gp-reviewer; the test file and Sources | `writes()` shadowed `covered()`, and a Sources sentence was garbled | Coordinator | Fixed: the local is `read`, and the sentence is rewritten |
| N1 | minor | gp-security re-check; the UPDATE/DELETE probe | A no-`WHERE` statement that fails on the principal's own rows (a unique key, a WITH CHECK, a restricting FK) rolls back and leaves the other workspace unchanged, passing without testing the policy | Coordinator | Fixed in the wording: the statement must succeed, with a row count equal to the own-workspace rows it may change (at least one) |
| N2 | minor | gp-security re-check; `rlsWriteCoverageErrors` | A write gap on a read-gap pair returned before the baseline check, so a new grant on an old relation could arrive as a read gap and a write gap | Coordinator | Fixed: a write gap on a read-gap pair must also be within the baseline (none today); self-tests for both sides, and test-strategy §4 says so |

Rework count and hypothesis changes: none. Every change after the first review is a stated fix; no QA FAIL so far.

## What is not true after this task

- No cross-workspace write denial is proved by this stage: all 65 rows are gaps. BL-164 … BL-173 close them.
- The local database was not running here. The write registry was measured on `goproceed-staging`; the local stack or CI's database could differ, and the CI run is the first comparison against a migrated-from-scratch database.
- The validator trusts `privileges`; only the database test pins it. Whether a cited test's body exercises each verb stays a review judgement.
- A write held through a SECURITY DEFINER function, a storage path or a sequence is outside the registry, as before.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 registry and comparison (static and fixture half) | Yes | `83bcb322` | fixture cases 11 passed; CSV cross-check (65 rows, modules, baseline equal); 5 comparison mutations killed (row 9) | PASS | |
| AC-1 database comparison, both ways | Yes | `5e4c0397` | «the write-holding covered pairs equal the write registry, both ways», PR #148 CI run 36073170834 (row 10) | PASS | CI's database, not a local one |
| AC-2 column-UPDATE probe | Yes | `5e4c0397` | the `evidence_objects` `UPDATE(original_filename)` probe, same run | PASS | CI's database |
| AC-3 no table-wide privilege; per-privilege probe | Yes | `5e4c0397` | `TABLE_WIDE_PRIVILEGES_SQL` case and its per-privilege probe, same run; staging holds none (row 7) | PASS | CI's database |
| AC-4 validator refusals and self-tests | Yes | `83bcb322` | `pnpm validate:canonical-docs` OK; 9 rule mutations and 3 data mutations killed (rows 7, 9) | PASS | |
| AC-5 BL-164 … BL-173 | Yes | `83bcb322` | the ten P1 open entries match the CSV per module; BL-099 scheduled → DEV-076 | PASS | |
| AC-6 the minimum restated; gate 11 not reopened | Yes | `83bcb322` | dated annotations in the six places listed | PASS | |
| AC-7 full CI on the pull request | Yes | `5e4c0397` | PR #148 CI run 36073170834, `verify` and `app-qa` green | PASS | |

## Sources

- PostgreSQL 17, `CREATE POLICY` (https://www.postgresql.org/docs/17/sql-createpolicy.html) and «Row Security Policies» (https://www.postgresql.org/docs/17/ddl-rowsecurity.html). The hosted server runs 17.6.
  - DEV-014 read the first page on 2026-09-16: `ALL` policies apply to both the selection side and the modification side, and `WITH CHECK` is enforced before other constraints.
  - From this container on 2026-09-24 neither page could be read: the egress proxy blocks `www.postgresql.org` («EGRESS_BLOCKED»).
  - This task relies on four statements from those pages. They were confirmed by gp-security from its knowledge (row 6), **not re-fetched**:
    - a policy without `WITH CHECK` uses its `USING` expression for new rows (UPDATE and ALL policies; an INSERT policy takes only `WITH CHECK`);
    - row security does not apply to whole-table operations «such as TRUNCATE and REFERENCES»;
    - `WITH CHECK` is enforced after BEFORE triggers fire;
    - an UPDATE or DELETE that reads a column (in `WHERE` or `RETURNING`) also applies the SELECT policies to the existing row.
- PostgreSQL 17, «System Information Functions» (`has_table_privilege`, `has_column_privilege`). Their behaviour was observed on `goproceed-staging` rather than read: the column-only grant that `0096:31` makes reads as `UPDATE(revoked_at version)`.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: independent — `gp-architect`, `gp-reviewer`, `gp-security` (with a re-check) as native subagents; `gp-qa` (native subagents).
- Verified scope: rows 1–10.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: the owner's merge; then the closure (BL-099 closed → DEV-076) and stage 2 (BL-164, workspace_access).
- Final state and reason: verifying — every required criterion PASS (rows 9, 10); `done` after the owner merges.
