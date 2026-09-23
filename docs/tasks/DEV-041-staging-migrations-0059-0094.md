# DEV-041 — Migrations 0059–0094 applied to the hosted project; the purge build deployed

## Assignment

- **Objective and user-visible outcome:** the one hosted Supabase project (`goproceed-staging`, `asrvzhjaueyvrfozxpzo`) reaches the repository's migration head, `0094`, and the production build of `main` (`4434314`) deploys, so the evidence purge (DEV-036…DEV-040) can run and the routes the live build already called — which failed against a database at `0058` — work.
- **State:** done
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** an operation, not a code change: `gp-architect` planned it (read-only); the coordinator ran it with the owner's approval. No repository behaviour changed, so `gp-reviewer` and `gp-qa` have no diff to review; the evidence is the hosted state read back after each step.
- **Selected route and why (`agents/COORDINATION.md`):** a hosted migration push is Q-9 territory (runbook §10). `gp-architect` for the plan; the owner decides; the coordinator applies and verifies.
- **Triggered stages and why:** `gp-architect` — migrations, roles, grants, pg_cron and Storage DML on a hosted project. `gp-security`: no new code or grant beyond what DEV-036…DEV-040's reviews covered; the secrets were set by the owner, never seen by the session.
- **Owning module and allowed edit paths:** the hosted project (by `supabase db push`); Vercel project `goproceed-app` (a redeploy); this record, the index, `docs/STATUS.md`, `infra/README-staging.md` §Status.
- **Read context and applicable local instructions:** root `AGENTS.md` («Authority»: invoking a role grants no authority to apply migrations to a hosted project — the owner's approval below is that authority); runbook §10 Q-9 and :1478 («`supabase db push` and nothing else»); `infra/README-staging.md` §2, §3.3; DEV-036 (the deploy order).
- **Linked spec, ADR or earlier task:** DEV-036…DEV-040 (PR #112), their closure (PR #113). No ADR (`gp-architect`).
- **Baseline:** hosted head `0058` (58/58, last apply on record 2026-08-19); repository `4434314`.
- **Dependencies / constraints / out of scope:** Q-9's standing answer (who pushes after every merge, on what trigger) stays open; this record is one push. The Telegram channel stays off everywhere (ADR-011 decision 10): its migrations are applied, its variables are not set. BL-126's hosted Storage measurement stays open.
- **Required acceptance criteria:**
  1. The hosted history holds `0059`–`0094` as `00NN` versions (compatible with the next `supabase db push`), in order, with no failure.
  2. After each batch: every object in `public` and `app` is owned by `postgres`; the row counts of the 23 tables that had rows, `storage.objects` in `evidence` and `auth.users` are unchanged.
  3. After `0094`: the purge roles exist as designed (NOLOGIN / LOGIN NOINHERIT, no BYPASSRLS), the purge role can execute exactly the five `app` functions and no other role can, no `public` purge function remains, the expiry cron calls `app.expire_upload_intents()`, the `evidence` bucket carries the four types, only `goproceed_service` can call the abandon function, no SECURITY DEFINER function is PUBLIC-executable, and `app.upload_purge_health()` answers `0/0`.
  4. The production build of `4434314` passes the deploy preflight and is READY on `goproceed-app.vercel.app`; `/login` answers 200; the purge route refuses an unauthenticated call with 401 and logs no «CRON_SECRET is not configured».
  5. A scheduled or manually triggered cron run answers 200 with counts.
- **Skipped stages and rationale:** see «Execution mode».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-23 | Asked whether the session can do the four post-merge steps through the connectors; the password and the two secrets stay the owner's (the session does not enter credentials) | conversation |
| 2026-09-23 | «Сначала план» — a read-only plan before any apply | conversation (options) |
| 2026-09-23 | «Да, A–D подряд» — apply `0059`–`0094` in four batches, stop on the first error; then the owner's secrets and the session's redeploy. This is the owner's Q-9 answer for this push and waives the runbook's CLI-only wording where the plan differs (it did not: the push used the pinned CLI's `db push`) | conversation (options) |
| 2026-09-23 | The owner set `goproceed_purge_worker_login`'s password and added `PURGE_DB_URL` (session pooler, port 5432) and `CRON_SECRET` to Vercel, Production only | conversation («добавил») |

## Plan

1. Read the hosted state (head, rows, roles, cron, bucket) and have `gp-architect` plan the push.
2. Preflight queries Q1–Q13 (read-only).
3. `supabase db push --linked --dry-run`, then four batches — A `0059`–`0060`, B `0061`–`0086`, C `0087`–`0089`, D `0090`–`0094` — each from a working directory holding the migrations up to the batch's end, verified before the next.
4. The owner sets the purge login's password and the two variables; the session redeploys and verifies.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | researching (coordinator, read-only) | Hosted head `0058`, not `0089`: `0059`–`0089` were never applied, so the live build `3141a33` (PR #110) ran against a database missing its newer schema. Rows: test data from the §6 walk (1 user, 1 organization, 2 evidence objects, 2 upload intents, 6 grants, …). Roles `goproceed_app`/`_service`/`_worker` (+ two logins); pg_cron with `idempotency-purge` and `upload-intent-expiry`; bucket `evidence` without an allow-list. Vercel: `PURGE_DB_URL` and `CRON_SECRET` absent | Supabase MCP `list_migrations`, `execute_sql` (select only); Vercel API env names | Plan |
| 2 | designing (`gp-architect`, native, read-only) | Apply all 36 in four batches with checkpoints; nothing in the hosted rows can fail them, given the preflight answers; `0087`/`0088` need the builds of `1bf5cea`/`902c214`, which `3141a33` contains; `0090`–`0094` must precede the `4434314` build; forward fixes only; production is partly broken today (the rule-publish INSERT names `project_sourced_requirement_item_id` from `0059`; project-requirements and the field-channel routes need `0059`/`0061`+). Caveats: the MCP `apply_migration` records timestamp versions, so the CLI's `db push` is the right tool | architect report | Preflight |
| 3 | preflight (coordinator, read-only) | The connection runs as `postgres` (not superuser, CREATEROLE); every object in `public`/`app` owned by `postgres`; the three constraints `0059`/`0061` replace exist; capabilities a subset of the new list; outbox topics `evidence.available` only; policies `capture_events` 3, `idempotency_records` 2; no invitation token stored; cron jobs owned by `postgres`; `UPDATE storage.buckets` allowed (the `protect_bucket_control_*` triggers fire on lifecycle columns only); both intents `available` (the first purge run deletes nothing); `anon` has no usage on `app`. `3141a33` contains `1bf5cea` and `902c214` (`git merge-base --is-ancestor`). History columns: `version`, `statements`, `name` | `execute_sql` results in the session | Push |
| 4 | applying (coordinator; Supabase CLI 2.114.0, `supabase link`, login role through the access token, no database password) | Dry run: exactly `0059`–`0094`, no seeds, no roles. **A** (11:25 UTC) head `0060`; `project_sourced_requirement_items` owned by `postgres`; counts unchanged. **B** (12:18) head `0086`; 14 Telegram/communication tables; `communication-retention` cron owned by `postgres`; `app.retention_policy` 3 rows, all durations NULL (the job does nothing); owners `postgres`; counts unchanged. **C** (12:19) head `0089`; `app.upload_intent_scope_matches` present; `idem_select` requires an active membership; no invitation token; counts unchanged. **D** (12:19) head `0094`, 36 rows `0059`–`0094`; criterion 3 all as expected; counts unchanged (audit 4, capture 4, evidence 2, intents 2, grants 6, outbox 2, bucket objects 2, users 1). The first attempt at A failed before connecting (the copied working directory lacked `supabase/templates/`); nothing was applied | `scratchpad/dev041-dryrun.txt`, `dev041-push-{A,B,C,D}.txt`, `dev041-baseline-counts.txt`; the verification queries in the session | The owner's secrets |
| 5 | the owner | Password set; `PURGE_DB_URL` and `CRON_SECRET` added, Production only (Vercel API: both keys present, target `production`) | Vercel API env list (names and targets only) | Redeploy |
| 6 | deploying (coordinator) | Redeploy of `4434314` (`dpl_9LUw1aKx7GEw5w41Q4HkJzCbR8z7`): build log «deploy preflight (VERCEL_ENV=production): OK»; READY at 12:33 UTC, aliased to `goproceed-app.vercel.app`. `GET /login` 200; `GET /internal/evidence/purge` without a token → 401 `worker_unauthorized`, with a wrong 40-character token → 401; the runtime log for the deployment shows both 401s and no «CRON_SECRET is not configured» line, so the secret is set and at least 32 characters | Vercel API (deployment, build log, runtime logs); `curl` | A cron run |
| 7 | verifying (the owner, then the coordinator) | Settings → Cron Jobs lists four entries on `/internal/evidence/purge` (owner); the owner pressed «Run»: the runtime log shows `GET /internal/evidence/purge 200` at 12:51:20 UTC with no `[EVIDENCE_PURGE]` error line. The database after it: `app.upload_purge_health()` `0/0`, both intents `available` and unpurged, 2 objects in `evidence` — nothing was due, and nothing was deleted | owner's screenshot; Vercel runtime logs; `execute_sql` (select) | Done |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| O-01 | info | the live build `3141a33` against `0058` | Expected: the database at the build's migration head. Actual: `0059`–`0089` missing since their merges (2026-08-27 onward), so rule publishing, project requirements and the field-channel routes failed in production | owner (Q-9) | Resolved by this push; Q-9's standing answer (who pushes after a merge) stays open |

Rework count and hypothesis changes: none.

## What is not true after this task

- **The run purged nothing, because nothing was due**: both intents are `available`. A purge that actually deletes bytes in production has not been observed yet.
- **No real capture was made after `0087`**; finalize's path through the new policy is proven by the suites, not in production.
- **Q-9 is answered for this push only.** Nothing applies the next migration automatically.
- **The Telegram channel's schema is live but the channel is off**; enabling it still waits on ADR-011 decision 10 and BL-024.
- **No backup was taken before the push**; the data was the §6 test data, and the owner chose not to wait for a dump.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. `0059`–`0094` in the history, `00NN`, no failure | yes | hosted, 12:19 UTC | `dev041-push-*.txt`; `count 0059-0094` = 36, head `0094` | PASS | |
| 2. Owners and row counts after each batch | yes | hosted | the four verification queries (row 4) | PASS | |
| 3. The purge, bucket and abandon state after `0094` | yes | hosted | the batch-D query (row 4) | PASS | |
| 4. Preflight OK, READY, `/login` 200, route 401 without a «not configured» log | yes | `4434314`, `dpl_9LUw1aKx7GEw5w41Q4HkJzCbR8z7` | Vercel build and runtime logs; `curl` (row 6) | PASS | |
| 5. A cron run answers 200 | yes | `4434314`, `dpl_9LUw1aKx7GEw5w41Q4HkJzCbR8z7` | the owner's «Run» (12:51:20 UTC); the runtime log: `GET /internal/evidence/purge 200`, no `[EVIDENCE_PURGE]` error line; the database after it: health `0/0`, both intents `available` and unpurged, 2 objects in the bucket (row 7) | PASS | owner-reported: the four cron entries in Settings → Cron Jobs and the «Run» were the owner's; the 200 is read from the runtime log |

## Sources

- Supabase CLI 2.114.0 (`supabase --version`; the runbook pins 2.115.0): `supabase link`, `supabase db push --linked [--dry-run] --workdir … --yes`, which initialises a login role through the access token when no database password is given (observed: «Initialising login role…»).
- Vercel, «Managing Cron Jobs», https://vercel.com/docs/cron-jobs/manage-cron-jobs (last updated 2026-08-11; accessed 2026-09-23): crons run on production deployments; `CRON_SECRET` sent as the Bearer token.

## Completion / handoff

- Changed / inspected files: this record, `docs/tasks/README.md`, `docs/STATUS.md`, `infra/README-staging.md` §Status.
- Review independence: `gp-architect` (plan, native); no code diff.
- Verified scope: the hosted database and the production deployment, read back through the Supabase and Vercel APIs.
- Remaining risks / blocked requirements: Q-9's standing answer.
- Next bounded action and owner: none for this task; Q-9's standing answer is the owner's.
- Final state and reason: done — the push, the deploy and a cron run (200) are verified.
