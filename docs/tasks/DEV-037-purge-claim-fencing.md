# DEV-037 — BL-031: a purge claim can be finished only by its holder

## Assignment

- **Objective and user-visible outcome:** a purge worker whose claim was reclaimed while it stalled cannot mark the row purged, release the newer worker's claim or spend its retry budget. No user-visible change.
- **State:** implementing
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

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-06 | minor | `docs/BACKLOG.md` BL-031 | Actual: untouched | coordinator | Progress line; closure at done (row 5) |

Rework count and hypothesis changes: none counted (no QA FAIL yet); the review fixes are the first rework, before QA.

## What is not true after this task

- **A stale worker still deletes the bytes it was deleting**; only its bookkeeping is fenced. That is safe for the reasons in row 1, and would stop being safe if a key were ever reused or a queued row could return to a live state.
- **Two runs can still overlap**; `FOR UPDATE SKIP LOCKED` keeps them on different rows, and the token keeps a late one from finishing a row it lost. No run-level lock exists, and none is needed for correctness.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- Vercel, «Managing Cron Jobs», https://vercel.com/docs/cron-jobs/manage-cron-jobs (last updated 2026-08-11; accessed 2026-09-23): duplicate delivery and overlapping runs are possible; «use both locks … and idempotent reconciliation».

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: pending.
- Remaining risks / blocked requirements: see «What is not true».
- Next bounded action and owner: reviews (coordinator).
- Final state and reason: implementing.
