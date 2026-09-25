# DEV-078 — BL-165: the cross-workspace write minimum for the communication rows

## Assignment

- Objective and user-visible outcome:
  - No user-visible change.
  - The `communication` rows of `technical/database/rls-write-coverage.csv` become `covered`. Each cites a test in `packages/testing/src/communication-write-rls.test.ts`. The test shows that the service plane cannot insert, update or move a row into a workspace other than the one it declared, nor write when it declares none, in the shape the DEV-076 minimum sets.
  - Migration `0104` withdraws the four service write grants that only `SECURITY DEFINER` functions use. After it, the registry holds 10 communication rows, not 11: `telegram_member_links` keeps no write.
- State: implementing
- Coordinator: Claude Code primary session, 2026-09-25.
- Execution mode: independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- Selected route and why (`agents/COORDINATION.md`): the change touches executed code under `packages/testing`, a migration that withdraws grants, catalogs the validator reads, and `technical/data-access-surface.csv`. The route is: `gp-architect` → owner decisions → implementation → mutations → `gp-reviewer` + `gp-security` → `gp-qa`.
- Triggered stages:
  - `gp-architect`: a migration and grant changes; the Telegram channel workflow.
  - `gp-security`: grants and RLS; the Telegram tables.
  - `gp-ui-reviewer`, `gp-mobile` and `gp-researcher` are not triggered.
- Owning module and allowed edit paths:
  - `supabase/migrations/0104_the_telegram_grants_only_definers_use.sql` (new);
  - `packages/testing/src/communication-write-rls.test.ts` (new);
  - `technical/database/rls-write-coverage.csv`, `technical/data-access-surface.csv` (DA-145 note; DA-203 … DA-213 new) and `technical/database/invariant-catalog.csv` (INV-001, INV-060, INV-092);
  - `scripts/validate-canonical-docs.mjs` (`RLS_WRITE_GAP_BASELINE` only);
  - `docs/BACKLOG.md`, `docs/STATUS.md` (migrations row), this record, and `docs/tasks/README.md`.
- Read context:
  - [DEV-076](DEV-076-write-denial-minimum.md), which sets the minimum;
  - [DEV-077](DEV-077-workspace-access-write-denial.md), which sets the probe shape and finding C1;
  - `packages/testing/src/communication-rls.test.ts`, the read tests and the service-plane contract;
  - `supabase/migrations/0062_*`, `0085_*`, `0100_*`.
- Linked spec, ADR or earlier task: BL-165; BL-099; INV-001; INV-060; INV-092.
- Baseline: `origin/main` `ba10683d` (after #151).
- Dependencies / constraints / out of scope:
  - The other eight modules' rows (BL-166 … BL-173) are out of scope.
  - Pushing `0103` and `0104` to `goproceed-staging` needs the owner's separate word. On 2026-09-25 the owner said «not yet» for `0103`.
  - The local database is this session's own disposable stack, started in the container. It holds no owner data, and no suite that resets it was run.
- Required acceptance criteria:
  - AC-1: each communication row cites one test meeting the minimum for every privilege it holds, on the service plane (another declared workspace and none), with its control succeeding.
  - AC-2: each of the 10 service policies fails a test under each of three mutations: `WITH CHECK (true)`; `USING (true)`; and a "none-declared" mutant that coalesces the declared workspace to the row's own. The exception is where a clause guards no write the principal holds; that exception is stated, and the read tests kill it.
  - AC-3: `0104` withdraws the four grants; the definer paths still work. The write registry, the baseline, DA-203 … DA-213 and INV-092 agree with the database, and the database comparison in `rls-coverage.test.ts` passes.
  - AC-4: the validator and `typecheck` pass.
  - AC-5: CI green on the pull request.
- Skipped stages and rationale: see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | Revoke in `0104` the service write grants only definers use, rather than test them: UPDATE on `telegram_binding_intents` and `telegram_member_link_intents`, INSERT on `telegram_chat_bindings`, INSERT and UPDATE on `telegram_member_links`. Pushing `0104` to staging stays a separate decision | Owner's answer in the session («Revoke in 0104») |
| 2026-09-25 | `telegram_chat_bindings` keeps its full UPDATE grant, which three routes need for `FOR UPDATE OF b`. It is tested, with the move-out run with the guard trigger disabled | Owner's answer in the session («Keep full UPDATE, test it») |
| 2026-09-25 | `0103` is not pushed to staging yet | Owner's answer in the session («Not yet») |
| 2026-09-24 | The DEV-076 rulings apply: the move-out is required where updatable; a trigger's refusal does not count; P1 | [DEV-076](DEV-076-write-denial-minimum.md) |

## Plan

1. `gp-architect`: a plan per row, the dead grants and the fixture.
2. `0104`, applied to the local database.
3. The test file. Every service policy is mutated three ways to prove the tests catch it.
4. The catalogs, the baseline, the docs and the record.
5. `gp-reviewer` + `gp-security`, then `gp-qa`; CI on the pull request.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | Coordinator | Dumped the 11 tables' policies, triggers, grants, column grants and constraints from the local stack at `0103`. Every write policy is `<t>_service FOR ALL TO goproceed_service` with `workspace_id = app.service_workspace()` on both clauses. Guard or append-only triggers sit on six tables | `scratchpad/dev078-policies.txt` | gp-architect |
| 2 | gp-architect | Returned a plan:<br>• one file and a service-plane probe (empty actor; declared workspace A, or `''` for none);<br>• per-table parent chains and exact FK names;<br>• an INSERT-only fixture addition (a staged second attachment per side);<br>• the media-group upsert, whose arbiter carries no tenant column, as the one realistic path into B;<br>• the "none" mutant;<br>• five grants that only definers use, one of which (`telegram_chat_bindings` UPDATE) is in fact used for row locks.<br>The coordinator's own grep agrees: the BFF only inserts intents and never writes bindings or links, and every test fixture that writes those tables uses the admin role | Subagent report (session); session grep | Owner |
| 3 | Coordinator | Owner decisions recorded. `0104` written and applied by hand to the local database as `supabase_admin`, then recorded in `schema_migrations`. Observed with `has_table_privilege`: bindings `SELECT|UPDATE`, both intent tables `SELECT|INSERT`, and links `SELECT`. The definers are owned by `postgres`. `telegram-erasure.test.ts`, which calls the erasure definer as `goproceed_service`, passes 38 of 38 after `0104` | Session output | Tests |
| 4 | Coordinator | The test file has 11 cases: the 10 registry rows, plus `telegram_member_links`, which asserts that the withdrawn grants are refused. Every probe runs in a rolled-back transaction on the superuser connection, with statements under `SET LOCAL ROLE goproceed_service` inside savepoints. Each mixed INSERT asserts its exact FK constraint name and `reason: other`, not DEV-077's either-or. Each UPDATE is also run declaring none, where it changes no row on either side. The validator asked for the assertion in each test body, so the INSERT helper returns its outcomes. Local run: 11 of 11 pass. With `rls-coverage.test.ts`, `communication-rls.test.ts` and `telegram-rls.test.ts`: 73 of 73. `m5-external-rls.test.ts` and `privileges.test.ts`: 13 of 13 | Session output | Mutations |
| 5 | Coordinator | Mutations, each committed to one policy and restored in turn (policies' md5 identical before and after):<br>• `WITH CHECK (true)` on all 10: each fails its own table's case.<br>• `USING (true)` on the 5 policies whose table the service may UPDATE: each fails its case.<br>• The "none" mutant (`coalesce(app.service_workspace(), workspace_id)` in both clauses) on all 10: each fails its case.<br>• Five survivors: `USING (true)` on the five INSERT-only tables (attempts, events, both intents, choices). There the clause guards no write the service holds, since it has no UPDATE or DELETE. `communication-rls.test.ts` kills each of the five (1 failed of 16 each time).<br>• 30 mutations: 25 killed here, 5 killed by the read tests | Session output | Catalogs |
| 6 | Coordinator | Catalogs and docs:<br>• the write registry: 10 rows `covered`, `telegram_member_links` removed, bindings `UPDATE` and both intent tables `INSERT`;<br>• the 11 keys removed from the baseline;<br>• DA-203 … DA-213 added: until now the 11 service-plane table surfaces had no row (drift found by gp-architect);<br>• the DA-145 note updated;<br>• INV-001, INV-060 and INV-092 cite the file;<br>• the `STATUS.md` migrations marker is `0104`;<br>• BL-165 is scheduled.<br>The validator passes | `git diff` | Reviews |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none.

## What is not true after this task

- `0103` and `0104` are on the local database only, not on `goproceed-staging`. The owner decides the push.
- The other 40 write rows (BL-166 … BL-173) are still gaps.
- The service plane with a real actor (five routes run `withServiceTx` with the caller's actor) is not probed separately. `goproceed_app` has no write policy on these tables, so the actor opens no write path. BL-101 already records that such transactions are not confined in general.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- PostgreSQL 17 row security, observed on the local 17.6 stack, not read. An `ON CONFLICT DO UPDATE` whose conflicting row the UPDATE policy's `USING` excludes was refused with 42501 and a row-level security message (the media-group upsert probe). An INSERT with `ON CONFLICT DO NOTHING` was refused by `WITH CHECK` before arbitration (the choice probe). The `postgresql.org` pages stay blocked from this container, as recorded in DEV-076.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: `gp-architect` ran as an independent native subagent; `gp-reviewer`, `gp-security` and `gp-qa` are pending.
- Verified scope: rows 1–6.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-reviewer` and `gp-security`.
- Final state and reason: implementing.
