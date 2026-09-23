# DEV-046 — BL-143: the workspace-access helpers pin an empty search path

## Assignment

- **Objective and user-visible outcome:** the three SECURITY DEFINER helpers every workspace-access policy rests on — `app.active_member_id`, `app.has_project_capability` and `app.project_has_grants` (`0011`) — run with `search_path = ''` instead of `public`, and `anon` and `authenticated` cannot execute them. No behaviour visible to a user changes.
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a SECURITY DEFINER change in a migration: `gp-architect` (cluster design, 2026-09-24) → failing test → migration and catalogs → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (a `SECURITY DEFINER` function in `supabase/migrations`); `gp-security` (SECURITY DEFINER functions and the policies that rest on them). `gp-ui-reviewer`, `gp-mobile`, `gp-researcher`: not triggered (no UI, no field client, no library question beyond PostgreSQL behaviour the local stack exercises).
- **Owning module and allowed edit paths:** `supabase/migrations/0098_the_helpers_that_trusted_public.sql` (new); `packages/testing/src/workspace-access-rls.test.ts`; `technical/data-access-surface.csv`; `docs/BACKLOG.md` (BL-143, BL-145); `docs/STATUS.md` (the migration marker); this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`; `agents/COORDINATION.md`; `supabase/migrations/0011_workspace_access_security.sql`; `docs/BACKLOG.md` BL-143, BL-106, BL-110.
- **Linked spec, ADR or earlier task:** BL-143, filed by [DEV-043](DEV-043-project-access-revoke.md)'s `gp-security` review. The cluster «project access» is DEV-046 to DEV-052.
- **Baseline:** `origin/main` at `20f2b67` (after PR #119).
- **Dependencies / constraints / out of scope:** the migration is applied to the local database by hand as `postgres` and recorded in `supabase_migrations.schema_migrations`; the hosted project is not touched without the owner. The other definer functions in `app` that pin `public` (21 of them, observed below) are out of scope and filed as BL-145; BL-106 and BL-110 stay open.
- **Required acceptance criteria:**
  1. `packages/testing/src/workspace-access-rls.test.ts` (no `resetDb`; drops only its own `de14…` workspaces) fails at the baseline on the three helpers' `proconfig` and passes after `0098`: each is `SECURITY DEFINER` with exactly `{search_path=""}`, and neither `anon` nor `authenticated` can execute it.
  2. The file's existing isolation tests, which exercise every one of the three helpers through the policies, still pass after `0098`.
  3. `0098`'s own assertion block raises if any of the three is not a definer with exactly the empty path, or is executable by `anon` or `authenticated`.
  4. The suites that drive the policies through the routes still pass after `0098` (the cluster's final run; see DEV-052's evidence).
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
3. Green run of the file; DA rows; BL-143 closed, BL-145 filed; STATUS marker.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | Cluster design: `alter function … set search_path = ''` copies no body, keeps owner and grants; all three bodies qualify every name and `now()` resolves from `pg_catalog` | architect report, 2026-09-24 (this session) | failing test |
| 2 | coordinator | Red: 1 failed (`proconfig` is `{search_path=public}`), 20 passed | `scratchpad/dev046-red.txt` (HEAD `20f2b67` + the test) | migration |
| 3 | coordinator | `0098` applied locally as `postgres` in one transaction; version `0098` recorded. Green: 21 passed | `scratchpad/dev046-green.txt` | catalogs, review |
| 4 | coordinator | Local database observation: before `0098`, the local migration table's head was `0095` (95 rows); `0096`'s column grant and `0097`'s table were present but their versions unrecorded. Left as found; only `0098` was recorded | `select max(version), count(*) from supabase_migrations.schema_migrations` on 2026-09-24 | — |
| 5 | coordinator | 21 other SECURITY DEFINER functions in `app` pin `public` (10 as `public`, 11 as `public, pg_temp`), `org_has_members`, `accept_invitation`, `member_role`, the outbox and idempotency functions among them; filed as BL-145 rather than widening this migration | `select … from pg_proc … where prosecdef and proconfig is distinct from array['search_path=""']` on the local database, 2026-09-24 | — |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## What is not true after this task

- The other 21 definer functions in `app` still pin `public` (BL-145, with BL-106 and BL-110).
- `0098` is applied to the local database only; the hosted project needs the owner's push.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- PostgreSQL 17 documentation, «CREATE FUNCTION», «Writing SECURITY DEFINER Functions Safely»: «search_path should be set to exclude any schemas writable by untrusted users», https://www.postgresql.org/docs/17/sql-createfunction.html. Applies to the local stack's PostgreSQL 17.6 (`select version()`). Accessed 2026-09-24 in the in-app browser.
- PostgreSQL 17 documentation, «Client Connection Defaults», `search_path`: an unlisted temporary schema is searched first for relation and data type names and never for functions or operators, https://www.postgresql.org/docs/17/runtime-config-client.html. Same version. Accessed 2026-09-24.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
