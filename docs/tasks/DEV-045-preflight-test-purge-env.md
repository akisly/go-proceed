# DEV-045 — The deploy preflight test gives the purge pair a valid value, and covers its refusals

## Assignment

- **Objective and user-visible outcome:** `apps/app/scripts/deploy-preflight-keys.test.mjs` passes on `main` again. Its «complete, usable set» carries a valid `PURGE_DB_URL` and `CRON_SECRET`, and the preflight's DEV-036 rules for that pair have tests of their own. No executed code outside the test file changes.
- **State:** done
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires (`gp-reviewer`, `gp-qa`).
- **Selected route and why (`agents/COORDINATION.md`):** bounded bug with an understood cause: coordinator implements → `gp-reviewer` → `gp-qa`. The reproduction is the existing red test.
- **Triggered stages and why:** none beyond the required two. `gp-security`'s triggers are not met: the change is a test fixture with fake values; no environment variable, `.env*` file, secret or preflight rule changes. `gp-architect`, `gp-ui-reviewer`, `gp-mobile`, `gp-researcher`: no trigger (no schema, contract, UI or third-party API decision).
- **Owning module and allowed edit paths:** `apps/app/scripts/deploy-preflight-keys.test.mjs`; this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`, `apps/app/AGENTS.md`; `apps/app/scripts/deploy-preflight.mjs:140-170`; DEV-036's record.
- **Linked spec, ADR or earlier task:** DEV-036 (PR #112, `e58907cc`) made `PURGE_DB_URL` and `CRON_SECRET` required; DEV-010 and DEV-011 (`92bb8c08`) last shaped the test's base environment.
- **Baseline:** `origin/main` at `d07c9136`.
- **Dependencies / constraints / out of scope:** `deploy-preflight.mjs` stays as it is. Why CI did not catch the regression is the Actions billing block (no job starts until October 2026), not a test gap; nothing here changes CI.
- **Required acceptance criteria:**
  1. `npx vitest run scripts/deploy-preflight-keys.test.mjs` in `apps/app` passes every case, including «passes a complete, usable set» and the BL-085 Telegram case that failed on `d07c9136`.
  2. The base set's `PURGE_DB_URL` differs from `APP_DB_URL` and `SERVICE_DB_URL` and carries no local marker; its `CRON_SECRET` is at least 32 characters.
  3. The test proves the preflight refuses a deployment whose `PURGE_DB_URL` or `CRON_SECRET` is absent or empty, a `CRON_SECRET` under 32 characters (without printing it), and a `PURGE_DB_URL` equal to the app or service URL or carrying any one of the local markers (`purge_pw`, `127.0.0.1`, `localhost`).
  4. The new cases are not vacuous: with those preflight rules removed, they fail.
  5. `deploy-preflight.mjs` is unchanged.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | Fix the test's base environment, consider a missing-pair case, create a task record, run `gp-reviewer` and `gp-qa`, open a PR, do not merge | conversation |

## Plan

1. Reproduce: run the test on `d07c9136`; read the preflight's refusal (step 1 of Progress).
2. Add `PURGE_DB_URL` (the purge worker's own login, a pooler host) and a 32-character `CRON_SECRET` to the base set; add three cases for the pair's rules. Check: the file passes.
3. Mutation: remove the pair from the preflight's required list and disable the length, equality and local-value rules; the three new cases must fail. Restore the file.
4. `gp-reviewer` on the diff; `gp-qa` on the final revision.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | implementing (coordinator): reproduction | On `d07c9136`: 2 failed, 53 passed of 55. Run by hand with the test's base set, the preflight exits 1 with exactly two problems: `PURGE_DB_URL is unset — ABSENT…` and `CRON_SECRET is unset — ABSENT…`. `git log` on the two files: the preflight last changed in `e58907cc` (DEV-036), the test in `92bb8c08` (DEV-011) | session output | Fix |
| 2 | implementing (coordinator) | Base set gains `PURGE_DB_URL` (`goproceed_purge_worker_login.ref`, `Zq8fakeC`, pooler host) and `CRON_SECRET` of exactly 32 characters. Three cases added: absent and empty for each name (the message's ABSENT/EMPTY distinction); 31-character secret refused and not printed; purge URL equal to the app URL, equal to the service URL, or local `purge_pw@127.0.0.1` refused. File: 58 passed of 58 | vitest 3.2.4, node 24.18.0 | Mutation |
| 3 | implementing (coordinator): mutation | Preflight edited in place: pair commented out of `runtime`, `< 32` → `< 0`, the equality list emptied, `PURGE_DB_URL` dropped from the local-value loop. Result: exactly the three new cases fail (3 failed, 55 passed). `git checkout -- scripts/deploy-preflight.mjs` restored it; `git status` shows only the test modified | session output | `gp-reviewer` |
| 4 | reviewing (`gp-reviewer`, independent) | **APPROVE**, one nit (R1-01). Confirmed: Node omits `undefined` env values; every asserted string matches the preflight's message; each case asserts its own rule's message, so none passes on another problem; the base `CRON_SECRET` equals `MIN_SECRET_LENGTH = 32` in `app/internal/evidence/purge/route.ts:14`; `vitest.config.ts` has no `include`, so CI would run the file | reviewer report | Fix R1-01 |
| 5 | implementing (coordinator): R1-01 | The local-value case now tries one marker per value (`purge_pw`, `127.0.0.1`, `localhost`). Mutation per marker: removing any one of the three from the preflight's regex fails exactly that case (1 failed, 57 passed each time); file restored after each. Unmutated: 58 of 58 | session output | `gp-qa` |
| 6 | verifying (`gp-qa`, independent) | **PASS** on criteria 1–5; R1-01's fix confirmed; no new defect. Baseline copy of the `d07c9136` test: 2 failed, 53 passed, the two named cases. Nine single mutations of the preflight (each name out of `runtime`, `< 32`, the equality list, each local marker, `PURGE_DB_URL` out of the local loop, the secret concatenated into the message) each fail exactly one new case; the preflight restored after each | QA report | Commit, PR |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | nit | `deploy-preflight-keys.test.mjs`, the local-value case | Expected: each local marker guarded. Actual: one URL carried `purge_pw` and `127.0.0.1` together, so dropping either marker still passed; `localhost` was never tried | coordinator | Three URLs, one marker each; per-marker mutation fails the case each time (row 5) |

Rework count and hypothesis changes: none. R1-01 was fixed before QA, as the first review's stated fix; no round counted.

## What is not true after this task

- CI has not run this test: Actions jobs do not start until the billing block ends (October 2026). The evidence is the local run.
- No other suite was run. The rest of `apps/app`'s tests use the local database and were out of scope; nothing outside the test file changed.
- The preflight's other refusals (`NEXT_PUBLIC_*`, legacy JWT keys, `SUPABASE_*`) still have no script-level test; this task covers only the purge pair.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. The file passes, including the two cases red on `d07c9136` | yes | `d07c9136` + working tree | `cd apps/app && npx vitest run scripts/deploy-preflight-keys.test.mjs`: 58 passed of 58; the `d07c9136` copy: 2 failed, 53 passed (`gp-qa`) | PASS | Local run; CI is NOT RUN until the Actions billing block ends |
| 2. Base `PURGE_DB_URL` distinct and non-local; `CRON_SECRET` ≥ 32 | yes | same | Test lines 145–148; `CRON_SECRET` is 32 characters, `MIN_SECRET_LENGTH = 32` in `app/internal/evidence/purge/route.ts:14`; the complete set exits 0 (`gp-qa`) | PASS | |
| 3. Refusals covered: absent, empty, short secret not printed, reused URL, each local marker | yes | same | The three new cases; each asserts its own rule's message (`gp-reviewer`, `gp-qa`) | PASS | |
| 4. The new cases are not vacuous | yes | same | Nine single mutations of `deploy-preflight.mjs`, each failing exactly one new case (row 6) | PASS | |
| 5. `deploy-preflight.mjs` unchanged | yes | same | `git diff d07c9136 -- apps/app/scripts/deploy-preflight.mjs` is empty | PASS | |
| Docs and catalogs | yes | same | `pnpm validate:canonical-docs`: `canonical documentation: OK` | PASS | |

## Sources

No third-party documentation was needed: the change is a test fixture for the repository's own script. Node's `child_process` omitting `undefined` env values is relied on and proved by the «ABSENT» assertion passing.

## Completion / handoff

- Changed / inspected files: `apps/app/scripts/deploy-preflight-keys.test.mjs` (changed); `apps/app/scripts/deploy-preflight.mjs` (inspected, unchanged).
- Review independence: independent (`gp-reviewer`, `gp-qa`).
- Verified scope: the test file alone, locally; criteria 1–5.
- Remaining risks / blocked requirements: CI has not run the file (billing block). The preflight's other refusals still lack script-level tests.
- Next bounded action and owner: the owner reviews and merges the PR; merging is the owner's decision.
- Final state and reason: done — `gp-reviewer` approved, R1-01 fixed, `gp-qa` passed every required criterion on the final revision.
