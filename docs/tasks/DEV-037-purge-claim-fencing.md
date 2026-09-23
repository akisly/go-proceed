# DEV-037 — BL-031: a purge claim can be finished only by its holder

## Assignment

- **Objective and user-visible outcome:** a purge worker whose claim was reclaimed while it stalled cannot mark the row purged, release the newer worker's claim or spend its retry budget. No user-visible change.
- **State:** done
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a table column and constraint, `SECURITY DEFINER` functions and grants for a worker: `gp-architect` (shared with DEV-036) → coordinator (tests first) → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` — a column, a constraint, definers, a worker. `gp-security` — deletion of personal data; definer grants. `gp-ui-reviewer`, `gp-mobile`: not triggered.
- **Owning module and allowed edit paths:** `supabase/migrations/0091_*`; `apps/app/src/lib/evidence-purge.ts`; `apps/app/app/internal/evidence/purge/route.ts` (the `superseded` count); `apps/app/tests/evidence-purge-fencing.int.test.ts` (new) and the purge suites' direct calls; `packages/testing/src/review-fixes-0036-0040.test.ts` (signatures); `technical/database/invariant-catalog.csv` (INV-106); `technical/data-access-surface.csv` (DA-186…188 notes); `docs/STATUS.md` (migration marker); `docs/BACKLOG.md` (BL-031); this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`; `apps/app/AGENTS.md`; `0021`, `0024`, `0027`, `0090`; DEV-036.
- **Linked spec, ADR or earlier task:** BL-031 (legacy cite `TODOS.md`); DEV-036 (the runner, whose Vercel Cron delivery can duplicate and overlap runs). No ADR.
- **Baseline:** `e58907c` (DEV-036) on `claude/storage-purge`.
- **Dependencies / constraints / out of scope:** BL-031 depended on BL-030 «so the fencing matches the chosen runner»: the runner is a stateless HTTP route that Vercel may call twice or concurrently, so the fence lives in the database, per row, not in a lock the route holds.
- **Required acceptance criteria:**
  1. Every claim and reclaim sets a fresh `purge_claim_token` and returns it; `app.complete_upload_purge(intent, token)` and `app.fail_upload_purge(intent, token, reason)` apply only for the current token, return whether they applied and clear it; a stale token and a null token change nothing — no purge, no released claim, no spent attempt; a token without a claim violates `upload_intents_purge_claim_token_needs_claim`; the one-argument signatures are gone — `evidence-purge-fencing.int.test.ts`, red first.
  2. The worker, taken over while it deletes the bytes, counts the row `superseded` (neither purged nor failed) and leaves the newer claim in place; uninterrupted, it purges as before; the route reports `superseded` — the same file and `evidence-purge-route.int.test.ts`.
  3. Grants stay the purge role's only (`evidence-purge-principal.int.test.ts`, the 0038 section of `packages/testing/src/review-fixes-0036-0040.test.ts`); the purge suites pass (`evidence-purge`, `vertical-m2a`).
  4. `pnpm turbo run typecheck --force`, `pnpm validate:canonical-docs`, `pnpm validate:agents` pass.
  5. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-23 | Cluster «Хранилище и purge», one PR, one record per entry (BL-031 included) | session brief |

## Plan

1. Tests red: the token, stale and null finishes, the check, the signatures, a takeover during the byte deletion (a mocked `removeObject` seam that ages and reclaims the row).
2. `0091`; the worker passes the token and counts `superseded`; green.
3. `gp-reviewer` + `gp-security` on the cluster diff → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native; one report for the cluster, DEV-036 row 1) | A token column with `check (purge_claim_token is null or purge_claimed_at is not null)`; the claim sets `gen_random_uuid()`; complete and fail match on id, token and `purged_at is null`, return boolean, clear the token; the one-argument signatures dropped (nothing deployed calls them); the worker counts `applied = false` as superseded. A stale worker's byte deletion is harmless: keys are random and never reused, no transition returns a queued row to a live state, and removing an absent object succeeds | architect report | Tests |
| 2 | implementing (coordinator): red | fencing 8 of 8 red (the column and the token-taking functions absent; the check case first passed on «column does not exist» and was tightened to the constraint's name); purge 2 red, principal 2 red, route 1 red (new signatures, `superseded`) | `scratchpad/dev037-red-*.txt` | Green |
| 3 | implementing (coordinator): green | `0091` applied locally as `postgres` (version recorded). fencing 8, purge 24, principal 7, route 13, vertical-m2a 10; `packages/testing` 0038 section 2 (run alone); typecheck 10/10 | `scratchpad/dev037-green-*.txt`, `dev037-testing-0038.txt` | Commit; reviews |
| 4 | reviewing (`gp-reviewer`, `gp-security`, native) on `52d6b63` (the five commits plus a merge of `origin/main` 206abec: DEV-035, #110 and #111, landed first; one conflict in the task index) | **`gp-security`: PASS WITH FINDINGS** (S1-01, S1-02 minor; S1-03 to S1-06 info). **`gp-reviewer`: CHANGES REQUESTED** (R1-01 to R1-06 minor, R1-07 and R1-08 nits). No blocker, no major. Both confirmed: only the purge role can call the purge functions; the abandon path answers only for the creator; the purge cannot reach an available object's bytes | review reports; `scratchpad/review1.diff` | Stated fixes |
| 5 | rework (coordinator), stated fixes, tests first | **R1-06** a Progress line on BL-031. No finding against the fencing itself; `gp-reviewer` confirmed the CHECK holds for every existing row and that duplicate or overlapping runs are kept apart by `SKIP LOCKED` and the token. The purge worker's changes after review (R1-02) keep the token logic: fencing 10 | `scratchpad/r1-02-green-evidence-purge-fencing.txt` | Re-review; `gp-qa` |
| 6 | verifying (`gp-qa`, native) on `37b7f11` | **All criteria PASS; CI `verify` NOT RUN (not required).** Its own runs, one suite at a time, none skipped for credentials: purge 24, principal 8, route 13, fencing 10, storage 24, storage-read 7, evidence-read 6, finalize 36, create 23, get 9, vanishing-bytes 1, external-evidence 12, telegram-evidence 22, telegram-processing 17, vertical-m2a 10, concurrency 9; unit 515 (572 before the merge of DEV-035, which removed the PWA's tests); `packages/testing` 0038 section 2; typecheck, docs and agents validators; the live database's roles, grants, functions and constraint; everything its suites revoke, rename or lift restored. Every stated fix in place. New: Q1-01 info (the route's «run failed» line logged the raw error, whose database detail can quote a row), Q1-02 nit (no committed test of the route's request id) | QA report; `scratchpad/qa1-*.txt` | Closing |
| 7 | closing (coordinator) | QA's Q1-01 and Q1-02 belong to DEV-036 and were fixed there | DEV-036 | Push, PR |
| 8 | done (owner's merge) | Merged as #112 (`dc24922`, 2026-09-23 10:48 UTC; head `f1d25e9`). Post-merge: the production build of `dc24922` (`dpl_o6T5dbDdunNRivxEpmXj1r6iZba8`, 10:48 UTC) was refused by the deploy preflight — «REFUSING TO BUILD»: `PURGE_DB_URL` and `CRON_SECRET` absent from the production environment — as DEV-036 designed; production keeps serving #110's build (`3141a33`, `dpl_DvNmvCdmQfSPR2Br11juvdhqYD1e`, READY; #111's build was cancelled). Read through the Vercel API (deployment list and build log), 2026-09-23. Nothing of this cluster runs in production until the owner applies `0090`–`0094` to the hosted project, sets the purge login's password, `PURGE_DB_URL` and `CRON_SECRET` (Production only) and redeploys (`infra/README-staging.md` §3.3). The hosted database's migration head was not observed | Vercel API; `gh pr view 112` | The owner: README-staging §3.3 |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-06 | minor | `docs/BACKLOG.md` BL-031 | Actual: untouched | coordinator | Progress line; closure at done (row 5) |

Rework count and hypothesis changes: none counted — no QA FAIL and no blocker; two review rounds fixed minor findings and nits before QA.

## What is not true after this task

- **A stale worker still deletes the bytes it was deleting**; only its bookkeeping is fenced. That is safe for the reasons in row 1, and would stop being safe if a key were ever reused or a queued row could return to a live state.
- **Two runs can still overlap**; `FOR UPDATE SKIP LOCKED` keeps them on different rows, and the token keeps a late one from finishing a row it lost. No run-level lock exists, and none is needed for correctness.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. The token; stale and null finishes; the check; the signatures | yes | `37b7f11` | `gp-qa`: fencing 10 (`qa1-evidence-purge-fencing.txt`); `dev037-red-*.txt` red first | PASS | |
| 2. A takeover counted superseded; the route reports it | yes | `37b7f11` | `gp-qa`: the takeover cases; `superseded` in the route body (`qa1-probe-route-requestid.txt`) | PASS | |
| 3. Grants the purge role's only; the purge suites | yes | `37b7f11` | `gp-qa`: principal 8, `packages/testing` 0038 section 2, purge 24, vertical-m2a 10 | PASS | |
| 4. Typecheck, docs, agents | yes | `37b7f11` | `gp-qa` static checks | PASS | |
| 5. CI `verify` | no | — | — | NOT RUN | environmental: GitHub Actions starts no jobs until October 2026 (billing); settled by CI `verify` on the PR head |

## Sources

- Vercel, «Managing Cron Jobs», https://vercel.com/docs/cron-jobs/manage-cron-jobs (last updated 2026-08-11; accessed 2026-09-23): duplicate delivery and overlapping runs are possible; «use both locks … and idempotent reconciliation».

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: independent — `gp-architect`, `gp-reviewer` (two rounds), `gp-security` and `gp-qa`, native project agents; the coordinator implemented.
- Verified scope: the scoped criteria on the local stack; nothing hosted.
- Remaining risks / blocked requirements: see «What is not true».
- Next bounded action and owner: the owner — merge the PR; then apply `0090`–`0094` to the hosted project before the production deploy that carries this build, set the purge login's password and `PURGE_DB_URL` and `CRON_SECRET` (Production only), per `infra/README-staging.md` §3.3.
- Final state and reason: done, merged as #112 (`dc24922`) — every required criterion PASS on `37b7f11`; CI not required.
