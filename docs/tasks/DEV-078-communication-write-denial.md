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
  - `docs/BACKLOG.md` (BL-165; BL-175 … BL-177 new), `docs/STATUS.md` (migrations row), this record, and `docs/tasks/README.md`.
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
| 7 | gp-security | PASS, no blocker or major. The review confirmed four things:<br>• `0104` closes real in-tenant surface: a binding or link could be written without its intent, or an intent un-consumed;<br>• it breaks no flow, because the definers are owned by `postgres`, their search path is fixed, and no FORCE RLS applies;<br>• the grants cannot return through `goproceed_app`;<br>• the probes prove the confinement.<br>Findings S1–S6 (below) | Subagent report (session), on `5f4759d3` | Fixes |
| 8 | gp-reviewer | No blocker or major. Every probe fails for the right reason; the minimum holds per privilege on all 10 rows; the catalogs agree; the mutation arithmetic is right. Findings R1–R9 (below) | Subagent report (session), on `5f4759d3` | Fixes |
| 9 | Coordinator | Fixes applied (see the findings table). The media-group upsert now also asserts «(USING expression)». Under `USING (true)` on media groups the file still fails, first at the UPDATE probe. The message-upsert probe (R3) asserts the product statement's silent zero rows with B unchanged. `0104` was re-applied by hand as `postgres` (R9); the self-check now also asserts the kept INSERT and SELECT. After the fixes: the new file 11 of 11; with `rls-coverage`, `communication-rls`, `telegram-rls`, `telegram-erasure`, `privileges` and `m5-external-rls`, 124 of 124; the validator passes | Session output | gp-qa, CI |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1 / R4 | low / minor | DA-203, DA-145; the bindings UPDATE grant | The notes said a binding changes through the definer; no product statement updates one, and the grant exists for row locks only. The full grant still admits an in-workspace chat re-point and `disconnected_at` | Coordinator; owner for the narrowing | Fixed: DA-203 (access path names the evidence read; `bff_worker`) and DA-145 reworded. Narrowing the grant deferred to BL-175 (P3; the owner kept the full grant) |
| S2 / R2 | low / minor | The media-group upsert probe | `reason: policy` did not show that the USING clause refused | Coordinator | Fixed: asserts «(USING expression)»; DA-207 and the comment reworded |
| S3 / R1 | medium (verification) / minor | AC-3 | The consuming definers were argued unaffected, not run: `telegram-bindings.int.test.ts` needs `APP_DB_URL` and `SERVICE_DB_URL` | gp-qa | Open: to be shown from the PR's CI log that the suite ran and passed |
| S4 / R3 | info / minor | The message and media-group arbiters without a tenant column | The product's message upsert answers 0 rows for B's (binding, message id), not 23503: an existence oracle the product cannot reach | Coordinator | Probe added (0 rows, B unchanged); the tenant column in both arbiters deferred to BL-176 (P3) |
| S5 / R5 / R6 | nit | `0104` header and self-check; DA-204, DA-205 | «Additive»; rollback without its catalog half; «writes these tables»; retention's delete unnamed; the kept grants unasserted | Coordinator | Fixed |
| S6 | info | `allowed_occurrence_ids`, `telegram_occurrence_snapshot` | Unchecked `uuid[]` references can name another workspace's occurrences; inert today; predates DEV-078 | Owner | Deferred to BL-177 (P3) |
| R7 / R8 | nit | Fixture comment; INV-092 wording | Inaccurate comment; ambiguous «creates them» | Coordinator | Fixed |
| R9 | nit | Record row 3 | Applied as `supabase_admin`, not `postgres` | Coordinator | Re-applied as `postgres` (row 9) |

Rework count and hypothesis changes: no round (review findings fixed before QA).

## What is not true after this task

- `0103` and `0104` are on the local database only, not on `goproceed-staging`. The owner decides the push.
- The other 40 write rows (BL-166 … BL-173) are still gaps.
- BL-175, BL-176 and BL-177 (P3) stay open.
- The service plane with a real actor (five routes run `withServiceTx` with the caller's actor) is not probed separately. `goproceed_app` has no write policy on these tables, so the actor opens no write path. BL-101 already records that such transactions are not confined in general.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- PostgreSQL 17 row security, observed on the local 17.6 stack, not read. An `ON CONFLICT DO UPDATE` whose conflicting row the UPDATE policy's `USING` excludes was refused with 42501 and a row-level security message (the media-group upsert probe). An INSERT with `ON CONFLICT DO NOTHING` was refused by `WITH CHECK` before arbitration (the choice probe). The `postgresql.org` pages stay blocked from this container, as recorded in DEV-076.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: `gp-architect`, `gp-security` and `gp-reviewer` ran as independent native subagents; `gp-qa` is pending.
- Verified scope: rows 1–9.
- Remaining risks / blocked requirements: «What is not true after this task».
- Next bounded action and owner: `gp-qa` on the final revision, with the CI log for S3 / R1.
- Final state and reason: implementing.
