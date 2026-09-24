# DEV-055 — BL-150, BL-106: the helpers inlined into definers name their types

## Assignment

- **Objective and user-visible outcome:** no behaviour a user sees changes. `app.current_actor()`, `app.current_external_session()` and `app.service_workspace()` — invoker SQL helpers that PostgreSQL inlines into the workspace-access definers, the external-session scope and the service-plane policies — name `pg_catalog.uuid` and `pg_catalog.current_setting`. A temporary object named `uuid` in a session can no longer change what they resolve to under a caller's path.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** functions every policy rests on, in a migration: `gp-architect` → owner ruling → failing test → migration and catalogs → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (functions in `supabase/migrations` under RLS policies and definers); `gp-security` (the helpers every policy and definer resolves the actor, the external session and the service workspace through). `gp-ui-reviewer`, `gp-mobile`, `gp-researcher`: not triggered (PostgreSQL behaviour exercised by the local stack, 17.6).
- **Owning module and allowed edit paths:** `supabase/migrations/0100_the_actor_that_named_its_type.sql` (new); `packages/testing/src/workspace-access-rls.test.ts`; `technical/database/invariant-catalog.csv` (INV-114); `docs/BACKLOG.md` (BL-106, BL-146, BL-150, BL-152); `docs/STATUS.md` (the migration marker); this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`; `supabase/migrations/0003` (`current_actor`), `0049` (`current_external_session`), `0062` (`service_workspace`), `0011`, `0098`; PostgreSQL 17 «search_path» and the inlining rules for SQL functions.
- **Linked spec, ADR or earlier task:** BL-150, filed by [DEV-047](DEV-047-access-helpers-search-path.md)'s late reviews; BL-106 (DEV-017's `gp-security` S1-06); cluster «Доступ к проекту» DEV-047 to DEV-055.
- **Baseline:** `5ffc938d`; local database at `0099`.
- **Dependencies / constraints / out of scope:** unqualified types in definer bodies themselves (BL-152, filed here) and PUBLIC's TEMP on the database (a separate decision) are out of scope. No ADR: no scope, contract or rule changes.
- **Required acceptance criteria:**
  1. `workspace-access-rls.test.ts` gains «the inlined helpers name their types (DEV-055, BL-150)»: each of the three is an invoker `sql` STABLE function without a SET clause whose body names `::pg_catalog.uuid` and no bare `::uuid` or `current_setting(`; `app.current_actor()` is still inlined for the application role (its `explain verbose` shows `current_setting`, not `current_actor(`); with a temporary table named `uuid` on the application's connection, the owner of A still reads A's projects. The first and third are red at `0099`, green at `0100`.
  2. `0100` applies by hand as `postgres` on a database at `0099`; its assertion block passes; the three functions keep their OIDs and ACLs.
  3. The suites that exercise the member, external and service planes through these helpers pass one at a time.
  4. INV-114, BL-106, BL-150, BL-152 and the STATUS marker agree; `pnpm validate:canonical-docs` passes.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | Fix BL-150 in this cluster | chat, answer «Чинить сейчас (Рекоменд.)» |
| 2026-09-24 | Which database runs: the coordinator chooses the necessary suites, one by one; truncating tenant tables is allowed; never a reset | the session's standing brief (DEV-047's record) |

## Plan

1. Failing tests.
2. `0100`, applied locally and recorded.
3. INV-114; BL-106 and BL-150 scheduled; BL-146 annotated; BL-152 filed; STATUS.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | Re-create the three inlined helpers with qualified names, keeping invoker, `sql`, STABLE and no SET clause (a SET clause stops inlining — BL-106's proposed fix would have); CREATE OR REPLACE keeps OID, owner, ACL, comment; TEMP revoke kept out (Supabase roles' needs unverified); the wider class of bare casts in definer bodies filed as BL-152 | architect report, 2026-09-24 | tests |
| 2 | coordinator | Live attributes before: all three STABLE, parallel unsafe, invoker, no SET, owner `postgres`; `current_actor` with the default ACL (PUBLIC executes), `current_external_session` granted to `goproceed_app`, `service_workspace` to `goproceed_service` | `scratchpad/dev054-before.txt` | red |
| 3 | coordinator | Red at `0099`: 2 failed, 28 passed — the catalog case (`current_actor`'s body has `::uuid`) and the temporary-table case, which failed with «return type mismatch in function declared to return pg_catalog.uuid»: the shadowing reproduced. The inlining case passed (a guard) | `scratchpad/dev054-red.txt` | migration |
| 4 | coordinator | `0100` applied locally as `postgres` in one transaction; assertion block passed; version recorded; OIDs (18609, 21191, 21778) and ACLs unchanged | `scratchpad/dev054-after.txt` | green |
| 5 | coordinator | Green: workspace-access-rls 30 passed | `scratchpad/dev054-green.txt` | plane suites, review |
| 6 | coordinator | Plane suites one at a time, none skipped: all 50 `packages/testing` suites that do not call `resetDb` (member, external and service RLS, schema, privilege, telegram erasure among them); `apps/app` project-access-grant 15, -revoke 20, -dates 6, responsibility-end 8, idempotency-authorization 13, telegram-evidence 22, project-communications 9, telegram-delivery 10, telegram-bindings 8, project-channel 3, upload-intents-create 23, -get 9, -finalize 36, evidence-purge 24, vertical-m2a 10, m6-blocked-value 23, m5-external 27, m4-act 46, projects 8 | `scratchpad/dev054-testing-suites.txt`, `dev054-app-suites.txt` | review |
| 7 | gp-reviewer | R1 PASS: R1-01, R1-02 minor (BL-152's list of exposed types; the test's dependence on PUBLIC's TEMP), R1-03..R1-05 nit | reviewer report, 2026-09-24, on `scratchpad/dev054-r1.diff` | fixes |
| 8 | gp-security | S1 PASS: S1-01 medium, pre-existing (code with the owner's rights through a definer body, e.g. `accept_invitation`, still possible — BL-152), S1-02..S1-04 low, S1-05..S1-07 info | security report, 2026-09-24, same diff | fixes, owner (BL-152) |
| 9 | coordinator | Fixes: BL-152 and BL-146 wording; the test's TEMP coupling noted in BL-152 and the test; the regression case asserts only A's workspace; attributes captured after (owner `postgres`, parallel unsafe, not strict, cost 100, `service_workspace`'s comment kept); cast-target checks in either spelling; a service-plane case — red with `service_workspace`'s 0062 body restored in the database, green after re-applying `0100`'s body. workspace-access-rls 31 passed | `scratchpad/dev054-after.txt`, `dev054-s104-red.txt` | gp-qa |
| 10 | gp-qa | PASS on criteria 1–4 (workspace-access-rls 31; m5-external-schema 42, telegram-rls 15, m2-service-principal 11, m5-external 27, project-access-revoke 20); live bodies byte-equal to the file, OIDs, ACLs and attributes kept; `0100`'s DO block passes and, with the old body in a rolled-back transaction, raises. Gaps fixed: the service case renamed to what it pins, INV-114 lists it, S1-07 recorded | QA report, 2026-09-24, on `scratchpad/dev054-r2.diff` | commit |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 / S1-02 | minor / low | BL-152, BL-146 | SQL keyword types were listed as exposed; `%rowtype`, `record` and invoker helpers were missing | coordinator | fixed |
| R1-02 | minor | the temporary-table case | depends on PUBLIC holding TEMP | coordinator | recorded in BL-152's «Depends on» and the test's comment |
| R1-03 | nit | the temporary-table case | asserted only a non-zero count | coordinator | fixed: every row is A's |
| R1-04 | nit | evidence | owner, comment, parallel safety not captured | coordinator | captured after (`dev054-after.txt`); OIDs unchanged, so the comment is the one `0062` set |
| R1-05 | nit | `0100`'s assertion block | regexes miss `cast(… as uuid)`; the EXECUTE message says «no longer inlined» (it would fail) | coordinator | deferred: the test now checks cast targets in both spellings (S1-03); `0100` left as applied |
| S1-01 | medium (pre-existing) | definer bodies, e.g. `accept_invitation` | a temporary domain can still run code with the owner's rights through an unqualified type in a definer's own body | owner | recorded in BL-152 with the recommended fix (`public, pg_temp` / `pg_catalog, pg_temp` path pins); the owner is asked |
| S1-03 | low | the catalog case | only `::uuid` was forbidden | coordinator | fixed |
| S1-04 | low | coverage | the temporary `uuid` case covered the member plane only | coordinator | fixed for the service plane (red at the old body; the case pins the error, not the scoping — the table has no rows, per `gp-qa`); the external plane is covered by the catalog case |
| S1-05 | info | PUBLIC's EXECUTE on `current_actor` | harmless; narrowing needs explicit grants | coordinator | recorded, left |
| S1-06 | info | TEMP revoke | not now | coordinator | recorded in BL-152 |
| S1-07 | info | mechanics, paperwork, evidence | checked clean | — | none needed |

Rework count and hypothesis changes: none (first review; fixes limited to the stated ones).

## What is not true after this task

- Definer bodies still name some types unqualified, and through one a session with arbitrary SQL on an application connection can still run code with the definer owner's rights — `accept_invitation` is a concrete path (BL-152, gp-security S1-01, reasoned, not run).
- PUBLIC still holds TEMP on the database.
- `0100` is applied to the local database only; the hosted project needs the owner's push (after `0098` and `0099`).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | `5ffc938d` + this task | `workspace-access-rls.test.ts`: 31 passed; red at `0099` 2 failed (the shadowing reproduced) | PASS (`gp-qa`'s run) | the red run is the coordinator's |
| 2 | yes | same | `0100` recorded; bodies byte-equal; OIDs and ACLs unchanged; DO block passes and fails on the old body | PASS (`gp-qa`) | applied once, by the coordinator |
| 3 | yes | same | 50 `packages/testing` and 19 `apps/app` suites one at a time (coordinator); six re-run by `gp-qa` | PASS | the `resetDb` suites NOT RUN; CI blocked |
| 4 | yes | same | INV-114, BL-106, BL-150, BL-152, STATUS; `validate:canonical-docs` OK; `tsc` for `packages/testing` exit 0 | PASS (`gp-qa`) | — |

## Sources

- PostgreSQL 17 documentation, «search_path»: the temporary schema is searched first for relation and type names, never for functions or operators, https://www.postgresql.org/docs/17/runtime-config-client.html (checked by DEV-047, 2026-09-24); reproduced on the local stack (PostgreSQL 17.6) by the red run.
- PostgreSQL's inlining of SQL functions (a non-definer `language sql` function without SET clauses whose body is a single SELECT): observed with `explain (verbose)` on the local stack.

## Completion / handoff

- Changed / inspected files: `0100`, the DEV-055 test block, INV-114, BL-106, BL-146, BL-150, BL-152, STATUS, this record and the task index.
- Review independence: `gp-architect`, `gp-reviewer`, `gp-security` and `gp-qa` ran as independent native subagents before the commit.
- Verified scope: criteria 1–4.
- Remaining risks / blocked requirements: «What is not true after this task»; BL-152 (the owner's choice of fix).
- Next bounded action and owner: pushing `0098`–`0100` to the hosted project, and merging, are the owner's.
- Final state and reason: verifying until the owner's merge.
