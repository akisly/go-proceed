# DEV-077 — BL-164: the cross-workspace write minimum for the 14 workspace_access rows

## Assignment

- Objective and user-visible outcome:
  - No user-visible change.
  - The 14 `workspace_access` rows of `technical/database/rls-write-coverage.csv` become `covered`. Each cites a test in `packages/testing/src/workspace-access-write-rls.test.ts` showing an owner of one workspace cannot insert, update or move rows into another, in the shape the DEV-076 minimum sets.
  - Migration `0103` withdraws the UPDATE grant on `public.memberships`, which no policy ever made usable.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-25.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): the change touches executed code under `packages/testing`, a migration that withdraws a grant, a catalog the validator reads, and `technical/data-access-surface.csv`. The route is: `gp-architect` → owner decisions → failing test → implementation → `gp-reviewer` + `gp-security` → `gp-qa`.
- Triggered stages:
  - `gp-architect`: a migration and a grant change.
  - `gp-security`: grants and RLS.
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered.
- Owning module and allowed edit paths:
  - `supabase/migrations/0103_the_membership_grant_with_no_policy.sql` (new);
  - `packages/testing/src/workspace-access-write-rls.test.ts` (new);
  - `technical/database/rls-write-coverage.csv`, `technical/data-access-surface.csv` (DA-002, DA-003, DA-005) and `technical/database/invariant-catalog.csv` (INV-060);
  - `scripts/validate-canonical-docs.mjs` (`RLS_WRITE_GAP_BASELINE` only);
  - `docs/delivery/test-strategy.md` §4, `docs/BACKLOG.md`, `docs/STATUS.md` (migrations row), this record, and `docs/tasks/README.md`.
- Read context:
  - [DEV-076](DEV-076-write-denial-minimum.md) (the minimum and its owner decisions);
  - `packages/testing/src/workspace-access-rls.test.ts` (the read tests);
  - `supabase/migrations/0039_*` (the grant-withdrawal precedent).
- Linked spec, ADR or earlier task: BL-164; BL-099; INV-060; INV-001.
- Baseline: `origin/main` `0bf11246`.
- Dependencies / constraints / out of scope:
  - The other nine modules' rows (BL-165 … BL-173) are out of scope.
  - Pushing `0103` to `goproceed-staging` needs the owner's separate word.
  - The local database is this session's own disposable stack, started in the container. It holds no owner data, and no suite that resets it was run.
- Required acceptance criteria:
  - AC-1: each of the 14 rows cites one test meeting the minimum for every privilege it holds, with its control succeeding.
  - AC-2: mutations of every write policy's `WITH CHECK` and every UPDATE policy's `USING` to `true` fail a test, except where a permissive clause opens no path (stated).
  - AC-3: `0103` withdraws the memberships UPDATE grant. The write registry, the baseline, DA-005 and INV-060 agree, and the database comparison in `rls-coverage.test.ts` passes.
  - AC-4: the validator and `typecheck` pass.
  - AC-5: CI green on the pull request.
- Skipped stages and rationale: see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | memberships: withdraw the UPDATE grant in `0103` rather than test it; pushing `0103` to staging stays a separate decision | Owner's answer in the session («Revoke in 0103») |
| 2026-09-25 | organizations: the policy admits any signed-in actor by design, so the probes are B's primary key (23505), `ON CONFLICT DO UPDATE` (42501, no UPDATE grant), a new workspace pointing its own-party at B's party (23503), and a fresh workspace as the control | Owner's answer in the session («Accept these probes») |
| 2026-09-24 | The DEV-076 rulings apply: the move-out is required where updatable; a trigger's refusal does not count; P1 | [DEV-076](DEV-076-write-denial-minimum.md) |

## Plan

1. `gp-architect`: a plan per row, the dead grants and the fixture.
2. `0103`, applied to the local database.
3. The test file. Every write policy is mutated to prove the tests catch a permissive clause.
4. The catalogs, the baseline, the docs and the record.
5. `gp-reviewer` + `gp-security`, then `gp-qa`; CI on the pull request.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | A local Supabase stack started in this container: `dockerd` started by hand, the pinned CLI 2.115.0, and images from Docker Hub, because the egress proxy blocks ECR's CDN. All 102 migrations applied. `rls-coverage.test.ts` and `workspace-access-rls.test.ts`: 62 of 62 pass. Policies, triggers and UPDATE column grants of the 14 tables dumped | `scratchpad/dev077-policies.txt` | gp-architect |
| 2 | gp-architect | A plan per row (probes, masking triggers, constraint-valid targets). Dead grant: memberships UPDATE (granted at `0003:59`, never given a policy). Also:<br>• `plp_update` has a WITH CHECK (a correction to the brief);<br>• the read-back must run inside the probe's transaction, not through the committing `asActor`;<br>• a new test file with its own fixture;<br>• `DISABLE TRIGGER USER` inside the probe for the two guarded tables;<br>• DA-002 and DA-003 have already drifted (they list UPDATE, which is not held).<br>Two readings need the owner: memberships and organizations | Subagent report (session) | Owner |
| 3 | Coordinator | Grep of `apps/app/{app,src}`, `packages/*/src`, `scripts` and `supabase/functions` for UPDATE, row locks, `ON CONFLICT DO UPDATE` and MERGE on memberships: nothing outside tests. `0103` is free on every branch. Owner decisions recorded | Session output | Implement |
| 4 | Coordinator | `0103` written and applied by hand to the local database as `supabase_admin`, then recorded in `schema_migrations`. `goproceed_app` no longer holds UPDATE on memberships | Session output | Tests |
| 5 | Coordinator | The test file: 14 cases, every probe in a rolled-back transaction on the superuser connection, with statements under `SET LOCAL ROLE goproceed_app` inside savepoints. It passed first time, so it was mutated. `WITH CHECK (true)` on `parties_update` survived: a move-out written with a `WHERE` is refused by the SELECT policy applied to the new row, masking the policy under test (reproduced directly on 17.6). The move-outs now read no column. The parent-only probe on `party_legal_profiles` keeps one `WHERE`, because its purpose is the composite foreign key and a two-row move hits the unique key first (23505) | Session output | Mutations |
| 6 | Coordinator | Mutations, each committed and restored in turn:<br>• `WITH CHECK (true)` on all 13 INSERT policies, and on `plp_update` and the six other UPDATE policies: each fails its test.<br>• `USING (true)` on all 8 UPDATE policies: each fails its test.<br>• One survivor: `WITH CHECK (true)` on `pag_update`, whose grant covers only `(revoked_at, version)`. Neither column carries a key, so no move is possible, and the permissive clause opens no path.<br>• Restored: 14 of 14 | Session output | Catalogs |
| 7 | Coordinator | The write registry: 14 rows `covered`, and memberships `INSERT` only. The 14 keys left the baseline. DA-002, DA-003 and DA-005 are now `SELECT|INSERT`, observed with `has_table_privilege` on the local database. INV-060 cites the file. `test-strategy.md` §4 and BL-164 … BL-173 say the move-out also reads no column. `STATUS.md` has the migrations marker `0103` | `git diff` | Checks |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| C1 | major | Coordinator's mutation run; the DEV-076 minimum | A move-out with a `WHERE` passed under `WITH CHECK (true)`, because the SELECT policy refused the new row, so the stated minimum did not test the policy it names | Coordinator | Fixed: the move-out reads no column, stated in test-strategy §4 and BL-164 … BL-173; the mutation now fails |

Rework count and hypothesis changes: none.

## What is not true after this task

- `0103` is on the local database only, not on `goproceed-staging`. The owner decides the push.
- The other 51 write rows (BL-165 … BL-173) are still gaps.
- The external-session insert branches stay outside the minimum, as DEV-076 recorded.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- PostgreSQL 17 row security, observed on the local 17.6 stack, not read: an UPDATE whose `WHERE` reads columns applied the SELECT policy to the new row and raised «new row violates row-level security policy» under `WITH CHECK (true)`, while the same UPDATE without a `WHERE` succeeded. The `postgresql.org` pages stay blocked from this container, as recorded in DEV-076.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: rows 1–7.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-reviewer` and `gp-security`.
- Final state and reason: implementing.
