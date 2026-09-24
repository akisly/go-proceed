# DEV-047 — BL-143: the workspace-access helpers pin an empty search path

## Assignment

- **Objective and user-visible outcome:** the three SECURITY DEFINER helpers every workspace-access policy rests on — `app.active_member_id`, `app.has_project_capability` and `app.project_has_grants` (`0011`) — run with `search_path = ''` instead of `public`, and `anon` and `authenticated` cannot execute them. No behaviour visible to a user changes.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a SECURITY DEFINER change in a migration: `gp-architect` (cluster design, 2026-09-24) → failing test → migration and catalogs → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (a `SECURITY DEFINER` function in `supabase/migrations`); `gp-security` (SECURITY DEFINER functions and the policies that rest on them). `gp-ui-reviewer`, `gp-mobile`, `gp-researcher`: not triggered (no UI, no field client, no library question beyond PostgreSQL behaviour the local stack exercises).
- **Owning module and allowed edit paths:** `supabase/migrations/0098_the_helpers_that_trusted_public.sql` (new); `packages/testing/src/workspace-access-rls.test.ts`; `technical/data-access-surface.csv`; `docs/BACKLOG.md` (BL-143, BL-146); `docs/STATUS.md` (the migration marker); this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`; `agents/COORDINATION.md`; `supabase/migrations/0011_workspace_access_security.sql`; `docs/BACKLOG.md` BL-143, BL-106, BL-110.
- **Linked spec, ADR or earlier task:** BL-143, filed by [DEV-043](DEV-043-project-access-revoke.md)'s `gp-security` review. The cluster «project access» is DEV-047 to DEV-053.
- **Baseline:** `origin/main` at `20f2b67` (after PR #119).
- **Dependencies / constraints / out of scope:** the migration is applied to the local database by hand as `postgres` and recorded in `supabase_migrations.schema_migrations`; the hosted project is not touched without the owner. The other definer functions in `app` that pin `public` (21 of them, observed below) are out of scope and filed as BL-146; BL-106 and BL-110 stay open.
- **Required acceptance criteria:**
  1. `packages/testing/src/workspace-access-rls.test.ts` (no `resetDb`; drops only its own `de14…` workspaces) fails at the baseline on the three helpers' `proconfig` and passes after `0098`: each is `SECURITY DEFINER` with exactly `{search_path=""}`, and neither `anon` nor `authenticated` can execute it.
  2. The file's existing isolation tests, which exercise `active_member_id` and `has_project_capability` through the policies, still pass after `0098`; `project_has_grants` (the bootstrap arm) is exercised by the route suites of criterion 4.
  3. `0098`'s own assertion block raises if any of the three is not a definer with exactly the empty path, or is executable by `anon` or `authenticated`.
  4. The suites that drive the policies through the routes still pass after `0098` (the cluster's final run; see DEV-053's evidence).
  5. `technical/data-access-surface.csv` carries rows for the three helpers; `pnpm validate:canonical-docs` passes.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | This session's cluster: «Доступ к проекту» (BL-137, BL-142) | chat, answer «Доступ к проекту (Рекоменд.)» |
| 2026-09-24 | The P3 companions BL-141, BL-143, BL-138, BL-140 and BL-144 join the cluster | chat, answer «BL-141 + BL-143, BL-138 write-once, BL-140 окно view, BL-144 тесты» |
| 2026-09-24 | Which database runs: the coordinator chooses the necessary suites, one by one; truncating tenant tables is allowed; never a reset | the session's standing brief |

## Plan

1. Failing test: the three helpers' `proconfig` and the `anon`/`authenticated` EXECUTE check in `workspace-access-rls.test.ts`.
2. `0098`: `alter function … set search_path = ''` for the three, `revoke execute … from anon, authenticated`, and an assertion block. Apply locally, record the version.
3. Green run of the file; DA rows; BL-143 closed, BL-146 filed; STATUS marker.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | Cluster design: `alter function … set search_path = ''` copies no body, keeps owner and grants; all three bodies qualify every name and `now()` resolves from `pg_catalog` | architect report, 2026-09-24 (this session) | failing test |
| 2 | coordinator | Red: 1 failed (`proconfig` is `{search_path=public}`), 20 passed | `scratchpad/dev046-red.txt` (HEAD `20f2b67` + the test) | migration |
| 3 | coordinator | `0098` applied locally as `postgres` in one transaction; version `0098` recorded. Green: 21 passed | `scratchpad/dev046-green.txt` | catalogs, review |
| 4 | coordinator | Local database observation: before `0098`, the local migration table's head was `0095` (95 rows); `0096`'s column grant and `0097`'s table were present but their versions unrecorded. Left as found; only `0098` was recorded | `select max(version), count(*) from supabase_migrations.schema_migrations` on 2026-09-24 | — |
| 5 | coordinator | 21 other SECURITY DEFINER functions in `app` pin `public` (10 as `public`, 11 as `public, pg_temp`), `org_has_members`, `accept_invitation`, `member_role`, the outbox and idempotency functions among them; filed as BL-146 rather than widening this migration | `select … from pg_proc … where prosecdef and proconfig is distinct from array['search_path=""']` on the local database, 2026-09-24 | — |
| 6 | coordinator | The commit (`58a592e`) was made before its review stages ran; `gp-reviewer` and `gp-security` ran late, on `git show 58a592e5`, on 2026-09-24 | `scratchpad/dev046.diff` | reviews |
| 7 | gp-reviewer | R1 PASS: R1-01 low (pre-existing: `app.current_actor()`'s unqualified `::uuid`), R1-02..R1-05 low (STATUS, DA-198, evidence, criterion 2), R1-06 nit (BL-146) | reviewer report, 2026-09-24 | fixes |
| 8 | gp-security | S1 PASS: S1-01 low (DA-198/199 name the wrong policies), S1-02..S1-05 info (EXECUTE positive test, `current_actor`'s type, the hosted owner check, a wrong migration in a comment) | security report, 2026-09-24 | fixes |
| 9 | coordinator | Fixes: DA-198/199; `0098`'s comments (0011, not 0009; the type exception); STATUS («hosted head is `0097`»; the local migration-table observations reconciled); BL-146's wording; BL-150 filed; a positive EXECUTE test (workspace-access-rls 27 passed). The cited `scratchpad/dev046-*.txt` files are not in this session's scratchpad (the earlier session's folder is empty), so the baseline red run cannot be re-inspected; the green half is re-evidenced by the cluster's final run at a later revision | `scratchpad/cluster-final-run.txt` and the rerun after these fixes | gp-qa |
| 10 | gp-qa | Late-review rework: every stated fix in place except DA-199, where the rework dropped `projects_update` (which calls `has_project_capability`, `0011`); fixed. `0098`'s assertion block probed in rolled-back transactions: passes as applied and raises for a `public` path, a non-definer, and EXECUTE for `anon` or `authenticated`. The baseline red run cannot be rebuilt without reverting `0098` | QA report, 2026-09-24 | commit |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 / S1-03 | low | `app.current_actor()` (`0003`) inlined into the helpers | its `::uuid` is an unqualified type a session's `pg_temp` can shadow; pre-existing | coordinator | filed BL-150 (P2); `0098`'s comment names the exception; the owner is asked whether to fix it now |
| R1-02 | low | `docs/STATUS.md` | «the hosted head equals the tree's» no longer true; the local migration-table note contradicted row 4 | coordinator | fixed |
| R1-03 / S1-01 | low | DA-198, DA-199 | the policy lists were wrong (0014 moved insert/update policies to `app.member_role`) and read as closed | coordinator | fixed; QA then found the rework had dropped `projects_update` from DA-199, restored |
| R1-04 | low | this record | the red/green files cannot be inspected | coordinator | recorded (row 9); the green half re-evidenced by the final run |
| R1-05 | low | criterion 2 | `project_has_grants` is not exercised by this file's isolation tests but by the route suites (`projects.create`'s first grant) | coordinator | criterion 2 reworded; the route suites are criterion 4's |
| R1-06 | nit | BL-146 | «the pattern PostgreSQL's documentation shows» overstated; `public.drain_outbox` outside the query | coordinator | fixed |
| S1-02 | info | the DEV-047 block | nothing asserted the policy roles keep EXECUTE | coordinator | fixed: `goproceed_app` and `goproceed_service` can execute the three |
| S1-04 | info | hosted push | `ALTER FUNCTION` needs ownership on the hosted project | coordinator | recorded in «What is not true»; the push is the owner's |
| S1-05 | info | `0098` comment | named `0009` for the EXECUTE revoke | coordinator | fixed: `0011` |

Rework count and hypothesis changes: none (first review, made late; fixes limited to the stated ones).

## What is not true after this task

- Before pushing `0098` to the hosted project, check that the role `supabase db push` runs as owns the three helpers (`select oid::regprocedure, proowner::regrole from pg_proc where …`); `ALTER FUNCTION` needs ownership (gp-security S1-04).
- `app.current_actor()`'s unqualified `::uuid` is still shadowable inside the helpers (BL-150).
- The other 21 definer functions in `app` still pin `public` (BL-146, with BL-106 and BL-110).
- `0098` is applied to the local database only; the hosted project needs the owner's push.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | `506ce05` + the late-review rework | `workspace-access-rls.test.ts`: 27 passed | PASS (green, `gp-qa`); red NOT RUN | the red run's file is lost and needs a database without `0098` |
| 2 | yes | same | 27 passed; `project_has_grants` through `idempotency-authorization`'s project create (13 passed) | PASS (`gp-qa`) | — |
| 3 | yes | same | `0098`'s DO block probed in rolled-back transactions against four broken states | PASS (`gp-qa`) | — |
| 4 | yes | same | the cluster's final run (`scratchpad/cluster-final-run-2.txt`) and QA's 24 further route suites | PASS | CI blocked |
| 5 | yes | same | DA-198..200; `validate:canonical-docs` OK | PASS (`gp-qa`, after the DA-199 fix) | — |

## Sources

- PostgreSQL 17 documentation, «CREATE FUNCTION», «Writing SECURITY DEFINER Functions Safely»: «search_path should be set to exclude any schemas writable by untrusted users», https://www.postgresql.org/docs/17/sql-createfunction.html. Applies to the local stack's PostgreSQL 17.6 (`select version()`). Accessed 2026-09-24 in the in-app browser.
- PostgreSQL 17 documentation, «Client Connection Defaults», `search_path`: an unlisted temporary schema is searched first for relation and data type names and never for functions or operators, https://www.postgresql.org/docs/17/runtime-config-client.html. Same version. Accessed 2026-09-24.

## Completion / handoff

- Changed / inspected files: `0098`, the DEV-047 test block, DA-198..200, BL-143, BL-146, BL-150, STATUS, this record.
- Review independence: `gp-reviewer`, `gp-security` and `gp-qa` ran late, as independent native subagents, after the commit; recorded in rows 6–10.
- Verified scope: criteria 1–5, criterion 1's red half excepted.
- Remaining risks / blocked requirements: «What is not true after this task»; BL-150 is DEV-055's.
- Next bounded action and owner: pushing `0098` to the hosted project is the owner's.
- Final state and reason: verifying until the owner's merge.
