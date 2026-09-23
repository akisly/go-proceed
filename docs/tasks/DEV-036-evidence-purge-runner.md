# DEV-036 — BL-030: the evidence purge gets a runner and a principal of its own

## Assignment

- **Objective and user-visible outcome:** the bytes behind expired, orphaned and aged scan-blocked upload intents are deleted by a scheduled job, as INV-047 requires («purged within 24 hours», «repeated failure alerts»), instead of by tests only. No user-visible screen changes; a workspace's reserved quota is released as its orphans are purged.
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a worker, a database role, grants and `SECURITY DEFINER` functions: `gp-architect` → coordinator (tests first) → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` — a worker, a role, grants, definers, retention of personal data. `gp-security` — deletion of personal data, application environment variables (`PURGE_DB_URL`, `CRON_SECRET`), CI env. `gp-ui-reviewer`, `gp-mobile`: not triggered (no UI, no client).
- **Owning module and allowed edit paths:** `supabase/migrations/0090_*`; `apps/app/app/internal/evidence/purge/route.ts` (new); `apps/app/src/lib/evidence-purge.ts`; `apps/app/src/lib/worker-secret.ts` (new; `sameSecret` moved out of `telegram/ingress.ts`, which re-exports it); `apps/app/vercel.json`; `packages/database/src/{pool,tx}.ts`; `scripts/set-local-app-password.mjs`; `apps/app/scripts/deploy-preflight.mjs`; `apps/app/.env.example`; `turbo.json`; `.github/workflows/ci.yml` (env only); the purge tests and `packages/testing/src/review-fixes-0036-0040.test.ts` (0038 section); `technical/database/invariant-catalog.csv` (INV-047, INV-105); `technical/data-access-surface.csv` (DA-185…189); `docs/architecture/{tenancy-and-security,files-and-storage}.md`; `infra/{README-staging,secret-rotation}.md`; `docs/delivery/pilot-execution-runbook.md` (Q-12 rows); `docs/BACKLOG.md` (BL-030); after review, `agents/COMMON.md` («Workers») and the generated `.claude/agents/`, `.codex/agents/` (R1-05); this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`; `apps/app/AGENTS.md`; INV-047; `files-and-storage.md` §purge; `tenancy-and-security.md` §Workers; migrations `0008`, `0021`, `0024`, `0027`, `0034`, `0038`; runbook Q-12.
- **Linked spec, ADR or earlier task:** BL-030 (legacy cite `TODOS.md`). No ADR (`gp-architect`: the design implements the documented target — per-workload roles, definers outside the exposed schema).
- **Baseline:** `b16fc9b` (origin/main, 2026-09-23), branch `claude/storage-purge`.
- **Dependencies / constraints / out of scope:** Q-12's purge half (the owner, below). Claim fencing is DEV-037 (BL-031). Telegram delivery's scheduler and «monitored» stay open under Q-12. Applying `0090`, setting the password and the two variables on a hosted environment are the owner's (Q-9; `infra/README-staging.md` §3.3). Nothing hosted is touched by this task.
- **Required acceptance criteria:**
  1. `0090` creates `goproceed_purge_worker` (NOLOGIN, NOBYPASSRLS) and `goproceed_purge_worker_login` (LOGIN, NOINHERIT, NOBYPASSRLS, member of that role only); the four purge functions move to `app` with an empty `search_path` and the `public` ones are dropped; `app.upload_purge_health()` counts exhausted and overdue rows; the five are executable by the purge role only (not `anon`, `authenticated`, `goproceed_app`, `goproceed_service`, `service_role`, `goproceed_worker`), and the role holds no table privilege and no other function; the pg_cron expiry job calls `app.expire_upload_intents()` — `evidence-purge-principal.int.test.ts`, red first.
  2. The worker connects only through `PURGE_DB_URL` (no fallback) and refuses a login that is not the purge login, including one that can become the purge role; a mutant without the `session_user` check turns that case red — `evidence-purge.int.test.ts`, red first.
  3. `GET /internal/evidence/purge` refuses (401 `worker_unauthorized`, nothing touched) a missing, wrong, prefix or non-Bearer credential, and every caller while `CRON_SECRET` is unset or shorter than 32 characters (logging that it is unconfigured); with the secret it expires, drains and answers 200 with counts and `no-store`; it answers 500 `purge_attention_required` while a row failed in the run, has spent five attempts, or has been due for more than 24 hours; the log and body carry counts and a request id, never a key — `evidence-purge-route.int.test.ts`, red first.
  4. `apps/app/vercel.json` schedules the route with daily expressions only (Hobby) and no gap over six hours between runs — the same file's schedule cases.
  5. The existing purge behaviour is unchanged (idempotence, blocked-content retention, attempt accounting, no guessed bucket): `evidence-purge.int.test.ts`, `vertical-m2a.int.test.ts`; the telegram and unit suites pass with `sameSecret` moved.
  6. `pnpm turbo run typecheck --force`, `pnpm validate:canonical-docs`, `pnpm validate:agents` pass.
  7. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-23 | Cluster «Хранилище и purge»: BL-030, BL-031, BL-036, BL-032 and the allow-list half of BL-126, one PR, one record per entry | session brief |
| 2026-09-23 | Q-12 for the purge: **Vercel Cron, four entries in `apps/app/vercel.json` on one path, each once a day (00/06/12/18 UTC)**; the team is on the **Hobby** plan | asked in conversation (options), answered «Vercel Cron, 4×/сутки (Рекомендую)» and «Hobby» |

## Plan

1. `gp-architect` on the runner, principal, fencing, abandon path, route logging and bucket allow-list.
2. Tests red: the principal, the connection, the route, the schedule.
3. `0090`, `withPurgeWorkerTx`, the worker, the route, `vercel.json`, local credentials, preflight, turbo and CI env; green; a mutant on the `session_user` check.
4. Catalogs and documents.
5. `gp-reviewer` + `gp-security` on the cluster diff → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native) | Route accepted (GET, `maxDuration` explicit, auth first, 401 for an unset or short secret with a log line, a batch cap and a time budget, 500 with counts). **Objection:** no login on `goproceed_worker` (it holds the outbox functions, `0008:100-102`, and is the normative principal of ~20 DA rows; `tenancy-and-security.md` §Workers wants per-workload credentials) and not the service login (a member of `goproceed_app`); instead `goproceed_purge_worker` + `_login` on the `0034` pattern, `PURGE_DB_URL`, `withPurgeWorkerTx` asserting `session_user`. Alerting: a per-run failure count goes quiet once a row is exhausted, so `app.upload_purge_health()` (exhausted, overdue) and 500 while either is non-zero. Move the functions to `app`, drop the `public` ones (definers in an exposed schema with a `public` search_path; `service_role` could reach them through the Data API). Honest limit: the purge credential sits in the same Vercel project as `SERVICE_DB_URL`, so the separation does not survive code execution in the BFF; it stops SQL injected on the other connections and bounds a leaked credential. No ADR | architect report (this row) | Tests |
| 2 | implementing (coordinator): baseline | Nine evidence suites green on `b16fc9b` before any change: purge 17, evidence-read 4, finalize 25, storage 8, storage-read 7, vertical-m2a 10, telegram-evidence 22, create 23, vanishing-bytes 1 | `scratchpad/base-*.txt` | Red |
| 3 | implementing (coordinator): red | principal 7 of 7 red (roles and functions absent); route 12 of 13 red (the module absent; `app.expire_upload_intents` absent; `vercel.json` has no crons — the gap case passed vacuously on an empty list); purge 9 red (the `app.*` functions and `resetPurgePoolForTests` absent) | `scratchpad/dev036-red-*.txt` | Green |
| 4 | implementing (coordinator): green | `0090` applied locally as `postgres` (version recorded); `set-local-app-password.mjs` sets `purge_pw`. principal 7, route 13, purge 24, vertical-m2a 10; `packages/testing` 0038 section 2 (run alone with `-t 0038`: that file's other sections write rows); `apps/app` unit and `proxy-cors` 572. Two test corrections before green: the unset-URL case had to reset the cached pool first; local `postgres` is not a superuser (Supabase), so it is refused at `set local role` — a temporary login that is a member of the purge role now exercises the `session_user` check. **Mutant:** the check removed → that case red; restored. The preflight, run with `VERCEL=1`, names a short `CRON_SECRET` and a `PURGE_DB_URL` equal to another URL. Typecheck 10/10 | `scratchpad/dev036-green-*.txt`, `dev036-mutant-session-user.txt`, `dev036-testing-0038.txt`, `dev036-unit-src.txt` | Commit; reviews |
| 5 | reviewing (`gp-reviewer`, `gp-security`, native) on `52d6b63` (the five commits plus a merge of `origin/main` 206abec: DEV-035, #110 and #111, landed first; one conflict in the task index) | **`gp-security`: PASS WITH FINDINGS** (S1-01, S1-02 minor; S1-03 to S1-06 info). **`gp-reviewer`: CHANGES REQUESTED** (R1-01 to R1-06 minor, R1-07 and R1-08 nits). No blocker, no major. Both confirmed: only the purge role can call the purge functions; the abandon path answers only for the creator; the purge cannot reach an available object's bytes | review reports; `scratchpad/review1.diff` | Stated fixes |
| 6 | rework (coordinator), stated fixes, tests first | **R1-02** red first (2 of 2): the deadline is checked before every row and a row's finish that throws is logged and counted failed, the run going on; **R1-08** the route's request id reaches every transaction; **R1-05** `agents/COMMON.md` «Workers» row updated and the profiles regenerated; **R1-06** Progress lines on BL-030 to BL-036; **R1-01** the migration order and reverse rollback in README-staging §3.3 and the records; **R1-07/S1-03** INV-105 narrowed to «beyond what PUBLIC holds», and a new case: no `SECURITY DEFINER` function in `public` or `app` is PUBLIC-executable; **S1-04** the two variables Production only; **S1-05** `\password` advised in §3.3. Green: fencing 10, purge 24, route 13, principal 8 | `scratchpad/r1-02-red.txt`, `r1-02-green-*.txt`, `dev036-s1-03.txt` | Re-review; `gp-qa` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | minor | deploy order (with DEV-038) | Actual: no order stated for `0091`–`0094` | coordinator | README-staging §3.3 «Order»; this record; DEV-038 makes its call best-effort (row 6) |
| R1-02 | minor | `evidence-purge.ts` | Actual: budget checked between batches only; a finish that throws aborts the run | coordinator | Deadline per row; `finish()` logs and counts failed; two new cases (row 6) |
| R1-05 | minor | `agents/COMMON.md` «Workers» | Actual: «no worker workload has a credential» | coordinator | Row updated; `sync-agents.py --write`; `validate:agents` (row 6) |
| R1-06 | minor | `docs/BACKLOG.md` | Actual: BL-030…036 untouched | coordinator | Progress lines; closure at done (row 6) |
| R1-07 | nit | the principal test | Actual: the test proves less than INV-105 | coordinator | INV-105 narrowed; the PUBLIC-definer case (row 6) |
| R1-08 | nit | `evidence-purge.ts` `ctx()` | Actual: a fresh request id per transaction | coordinator | The run's id is passed through (row 6) |
| S1-03 | info | INV-105 | Actual: «holds nothing else» ignores PUBLIC | coordinator | As R1-07. The optional explicit revokes from `goproceed_app`/`goproceed_service`/`goproceed_worker` on the `0090`/`0091` functions: **deferred** — those roles hold no grant on them (tested), and the hosted default-privilege question is BL-126-class unmeasured hosted state |
| S1-04 | info | README-staging §4.3 | Actual: the purge variables set for Preview too | coordinator | Production only (row 6) |
| S1-05 | info | README-staging §3.3 | Actual: plain `alter role … password` | coordinator | `\password` advised in §3.3 with the reason; §3.1 and §3.2 noted, not rewritten |

Rework count and hypothesis changes: none counted (no QA FAIL yet); the review fixes are the first rework, before QA.

## What is not true after this task

- **The purge runs nowhere yet.** It runs once `0090` and `0091` are applied to a hosted project (before the deployment that carries this build; roll back in reverse, `0091` before `0090` — `infra/README-staging.md` §3.3, `gp-reviewer` R1-01), `goproceed_purge_worker_login` has a password, and `PURGE_DB_URL` and `CRON_SECRET` are set on the Vercel project (`infra/README-staging.md` §3.3) — all the owner's. Until the variables exist, the deploy preflight refuses the production build.
- **Crons run on production deployments only** (Vercel). This project builds production only, so its one environment is where it runs; a preview would not purge.
- **«Monitored» is a status code.** The alert is a 500 in the Vercel Cron log; nobody is paged. Q-12's monitoring half stays open, and BL-035 (no application logging) stays open.
- **Vercel may skip or double a run** (best-effort delivery). A skipped run widens that gap by six hours; the health count turns the route red once any due row waits past 24 hours.
- **The separation is of database credentials, not of processes.** `PURGE_DB_URL` lives in the same Vercel project as `SERVICE_DB_URL`; code execution in the BFF reaches both.
- **Claims are not fenced yet**: DEV-037.
- **`overdue` for an orphaned intent is measured from its expiry**, which is after the moment it was orphaned: it under-states that wait, never over-states it.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- Vercel, «Usage & Pricing for Cron Jobs», https://vercel.com/docs/cron-jobs/usage-and-pricing (last updated 2026-07-15; accessed 2026-09-23): Hobby — once per day per expression, per-hour precision (±59 min), a more frequent expression fails the deployment; 100 crons per project.
- Vercel, «Managing Cron Jobs», https://vercel.com/docs/cron-jobs/manage-cron-jobs (last updated 2026-08-11; accessed 2026-09-23): GET, `Authorization: Bearer $CRON_SECRET` when set, no retries, best-effort delivery that may skip or duplicate, overlapping runs possible.
- Vercel, «Configuring Maximum Duration for Vercel Functions», https://vercel.com/docs/functions/configuring-functions/duration (last updated 2026-08-24; accessed 2026-09-23): Hobby 300 s with Fluid compute; the 60 s Hobby ceiling without it from the linked changelog «Vercel Functions for Hobby can now run up to 60 seconds». Next.js 16.3.1's `maxDuration` and `dynamic` route segment config, `node_modules/next/dist/docs` (installed).
- The Vercel team's plan (Hobby) is the owner's answer; the Vercel API's team and project reads (2026-09-23) do not show it.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: pending.
- Remaining risks / blocked requirements: see «What is not true».
- Next bounded action and owner: reviews (coordinator).
- Final state and reason: implementing.
