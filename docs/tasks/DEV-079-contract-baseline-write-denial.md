# DEV-079 — BL-166: the cross-workspace write minimum for the contract_baseline rows

## Assignment

- Objective and user-visible outcome:
  - No user-visible change.
  - The 10 `contract_baseline` rows of `technical/database/rls-write-coverage.csv` become `covered`. Each cites a test in `packages/testing/src/contract-baseline-write-rls.test.ts`. The test shows that an owner of one workspace cannot insert, update, delete or move rows into another, in the shape the DEV-076 minimum sets.
  - Migration `0105` withdraws the UPDATE grants on `locations` and `unit_definitions` and drops their two policies. No route used either.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-25.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): the change touches executed code under `packages/testing`, a migration that withdraws grants and drops RLS policies, catalogs the validator reads, and `technical/data-access-surface.csv`. The route is: `gp-architect` → owner decisions → implementation → mutations → `gp-reviewer` + `gp-security` → `gp-qa`.
- Triggered stages:
  - `gp-architect`: a migration, grants and RLS policies.
  - `gp-security`: grants and RLS.
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered.
- Owning module and allowed edit paths:
  - `supabase/migrations/0105_the_baseline_updates_no_route_makes.sql` (new);
  - `packages/testing/src/contract-baseline-write-rls.test.ts` (new);
  - `technical/database/rls-write-coverage.csv`;
  - `technical/data-access-surface.csv`: DA-011, DA-014, DA-018, DA-020, DA-070 and DA-071 corrected, DA-214 … DA-216 new;
  - `technical/database/invariant-catalog.csv` (INV-001, INV-060);
  - `scripts/validate-canonical-docs.mjs` (`RLS_WRITE_GAP_BASELINE` only);
  - `docs/BACKLOG.md` (BL-166; BL-178 and BL-179 new), `docs/STATUS.md` (migrations row), this record, and `docs/tasks/README.md`.
- Read context:
  - [DEV-076](DEV-076-write-denial-minimum.md), [DEV-077](DEV-077-workspace-access-write-denial.md) and [DEV-078](DEV-078-communication-write-denial.md): the minimum, the probe shape, and C1;
  - `packages/testing/src/contract-baseline-rls.test.ts` and `m1-rules-fixture.ts`;
  - `supabase/migrations/0013_*`, `0014_*`, `0041_*`, `0042_*`.
- Linked spec, ADR or earlier task: BL-166; BL-099; INV-001; INV-015; INV-060; INV-080.
- Baseline: `origin/main` `70f215c5` (after #153).
- Dependencies / constraints / out of scope:
  - The other seven modules' rows (BL-167 … BL-173) are out of scope.
  - Pushing `0103` … `0105` to `goproceed-staging` needs the owner's separate word.
  - The local database is this session's own disposable stack, started in the container. It holds no owner data, and no suite that resets it was run.
- Required acceptance criteria:
  - AC-1: each of the 10 rows cites one test meeting the minimum for every privilege it holds, with its control succeeding.
  - AC-2: each clause mutation fails a test:
    - `WITH CHECK (true)` on every INSERT and UPDATE policy;
    - `USING (true)` on every UPDATE and DELETE policy;
    - each capability arm made `true`;
    - the draft condition dropped;
    - each half of the batch-scoped `EXISTS` dropped.
  - AC-3: `0105` withdraws the two grants and drops the two policies. The write registry, the baseline, the DA rows and INV-060 agree with the database, and the database comparison in `rls-coverage.test.ts` passes.
  - AC-4: the validator and `typecheck` pass.
  - AC-5: CI green on the pull request.
- Skipped stages and rationale: see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | `locations` and `unit_definitions`: revoke the UPDATE grants in `0105` and drop `locations_update` and `units_update` with them, so a later grant cannot silently revive an unreviewed path. Pushing `0105` to staging stays a separate decision | Owner's answer in the session («Revoke + drop policies») |
| 2026-09-25 | `contracts` keeps its full UPDATE grant (used only for a row lock) and is tested; narrowing it is BL-178 | Owner's answer in the session («Keep full UPDATE, test it») |
| 2026-09-24 | The DEV-076 rulings apply: the move-out is required where updatable; a trigger's refusal does not count; P1 | [DEV-076](DEV-076-write-denial-minimum.md) |

## Plan

1. `gp-architect`: a plan per row, the dead grants and the fixture.
2. `0105`, applied to the local database.
3. The test file. Every write policy is mutated clause by clause.
4. The catalogs, the baseline, the docs and the record.
5. `gp-reviewer` + `gp-security`, then `gp-qa`; CI on the pull request.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | Dumped the 10 tables' policies, triggers, grants, column grants and constraints from the local stack at `0104` | `scratchpad/dev079-policies.txt` | gp-architect |
| 2 | gp-architect | Returned a plan:<br>• the member-plane probe;<br>• the capability each policy asks for, all six held by the rules world's owner;<br>• per-table parent chains and exact FK names;<br>• the three guard sets to disable: the binding guards on INSERT, and the version and line guards on UPDATE and DELETE;<br>• the batch-scoped policies, which read their parent, so a foreign batch is a policy refusal, and a «cross» probe (B's key, A's batch) for their tenant comparison;<br>• the unit upsert;<br>• two unused UPDATE grants (`locations`, `unit_definitions`);<br>• `contracts` UPDATE used only for a lock;<br>• data-access drift.<br>The coordinator's grep agrees: no UPDATE, lock or DO UPDATE on either table outside tests | Subagent report (session); session grep | Owner |
| 3 | Coordinator | The container had restarted: `dockerd` and the stack restarted, database at `0104` intact. Owner decisions recorded. `0105` written and applied by hand as `postgres`, then recorded in `schema_migrations`. Observed with `has_table_privilege`: `locations` and `unit_definitions` `SELECT|INSERT` | Session output | Tests |
| 4 | Coordinator | The test file has 10 cases. They share DEV-077's member-plane probe and DEV-078's exact outcome (`constraint`). The UPDATE and DELETE probes assert the row count, how many of A's rows changed, and B unchanged: one draft row for the version and line policies, one row for contracts and batches. The move-outs read no column. `locations` and `unit_definitions` assert the privilege refusal. Local run: 10 of 10 pass | Session output | Mutations |
| 5 | Coordinator | 32 mutations, each applied to one policy and restored from its `pg_policies` text; the policies' md5 was identical before and after. All 32 fail their own table's case:<br>• `WITH CHECK (true)` on the 10 INSERT and 4 UPDATE policies;<br>• `USING (true)` on the 4 UPDATE policies and `wi_delete`;<br>• each capability arm of `cv_insert` and `wi_insert` made `true`;<br>• the draft condition dropped from `cv_update`, `wi_update` and `wi_delete`;<br>• `b.id = …` and `b.workspace_id = …` each dropped from the three batch-scoped INSERT policies.<br>There are no survivors | `scratchpad/dev079-mutate.out` | Catalogs |
| 6 | Coordinator | Catalogs and docs:<br>• the write registry: 10 rows `covered`, with `locations` and `unit_definitions` now `INSERT`;<br>• the 10 keys removed from the baseline;<br>• DA-011 and DA-070 now `SELECT|INSERT` (0105);<br>• drift corrected: DA-018 `SELECT|INSERT`, DA-020 `SELECT|INSERT|UPDATE|DELETE` (it named columns that do not exist), DA-071 `SELECT|INSERT`;<br>• the DA-014 note updated;<br>• DA-214 … DA-216 added for three tables that had no row;<br>• INV-001 and INV-060 cite the file;<br>• the `STATUS.md` migrations marker is `0105`;<br>• BL-166 is scheduled; BL-178 (contracts UPDATE narrowing) and BL-179 (the `import_jobs` rows) filed.<br>The validator passes | `git diff` | Reviews |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none.

## What is not true after this task

- `0103` … `0105` are on the local database only, not on `goproceed-staging`. The owner decides the push.
- The other 30 write rows (BL-167 … BL-173) are still gaps.
- Capability scope within one workspace (a viewer holding none of the write capabilities) is outside the cross-workspace minimum. Widening a policy's capability array would not fail these tests.
- BL-178 and BL-179 (P3) stay open.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- PostgreSQL 17 row security, observed on the local 17.6 stack, not read. An INSERT with `ON CONFLICT DO NOTHING` naming another workspace was refused by `WITH CHECK` before arbitration (the unit upsert probe, as in DEV-078). A BEFORE trigger answers before the policy, so the guards are disabled for the assertion. The `postgresql.org` pages stay blocked from this container, as recorded in DEV-076.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: `gp-architect` ran as an independent native subagent; `gp-reviewer`, `gp-security` and `gp-qa` are pending.
- Verified scope: rows 1–6.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-reviewer` and `gp-security`.
- Final state and reason: implementing.
