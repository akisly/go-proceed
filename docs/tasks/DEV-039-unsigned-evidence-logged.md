# DEV-039 — BL-036: an evidence read that could not be signed is logged, not silent

## Assignment

- **Objective and user-visible outcome:** when the member-plane evidence read cannot sign some objects (purged or missing — the per-object failures `createSignedReadUrls` reports in `failedKeys`), the operator sees it: one server log line with the failed and total counts and the request id. The screen is unchanged — rows without `readUrl` render «недоступне» and the response stays 200.
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a bounded change with an understood cause: coordinator (tests first) → `gp-reviewer` + `gp-security` → `gp-qa`. `gp-architect` was asked as part of the cluster and chose the no-contract option.
- **Triggered stages and why:** `gp-security` — evidence storage and signed URLs (the log line must carry neither). `gp-architect` — consulted on the contract question (a `/v1` field was one option). `gp-ui-reviewer`: not triggered (no UI change).
- **Owning module and allowed edit paths:** `apps/app/app/v1/assignments/[assignmentId]/evidence/route.ts`; `apps/app/tests/evidence-read.int.test.ts`; `docs/BACKLOG.md` (BL-036); this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`; `apps/app/AGENTS.md`; `files-and-storage.md` §Downloads («Logs record the domain object and authorization result, never the signed URL or raw storage key»); `createSignedReadUrls`' comment on why «all failed» is not a throw; `http.ts:97`, the app's one other log line.
- **Linked spec, ADR or earlier task:** BL-036 (legacy cite `TODOS.md`); DEV-034 (errors without keys). No ADR.
- **Baseline:** `4a33805` (DEV-038) on `claude/storage-purge`.
- **Dependencies / constraints / out of scope:** a store that does not answer at all was never a silent 200: `createSignedReadUrls` throws on a top-level SDK error (`readFailed`), and `http.ts` logs the 500 (`gp-reviewer` R1-03). BL-036 depended on «BL-035, or a partial-failure field in the contract». `gp-architect` chose neither: a `/v1` field would serve an operator problem the screen already renders; structured logging (BL-035) stays open, and this line uses the same `console.error` channel as `http.ts`.
- **Required acceptance criteria:**
  1. With one of three objects gone from Storage, the read answers 200, the missing object's row has no `readUrl`, and exactly one `console.error` line `[EVIDENCE_READ_UNSIGNED]` carries the response's request id and `{ failed: 1, total: 3 }`; nothing printed carries either half of the key, `token=` or a bucket path — red first.
  2. When every object signs, nothing is logged.
  3. The evidence-read, storage-read and evidence component suites pass.
  4. `pnpm turbo run typecheck --force`, `pnpm validate:canonical-docs`, `pnpm validate:agents` pass.
  5. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-23 | Cluster «Хранилище и purge», one PR, one record per entry (BL-036 included) | session brief |

## Plan

1. A test that removes one object's bytes and reads the assignment; red.
2. Count `failedKeys` across buckets; one log line when any failed; green.
3. `gp-reviewer` + `gp-security` on the cluster diff → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native; DEV-036 row 1) | Option (a): no contract change; `console.error("[EVIDENCE_READ_UNSIGNED]", requestId, { failed, total })` when any key failed; counts only, per DEV-034's rule; a test that captures `console.error` and finds no key and no `token=` | architect report | Test |
| 2 | implementing (coordinator): red, then green | **Red:** 1 of 6 (no line logged); the «nothing logged» case passes before and after. **Green:** evidence-read 6, storage-read 7, the evidence component unit tests 23 | `scratchpad/dev039-red.txt`, `dev039-green.txt`, `dev039-suite-evidence-storage-read.txt`, `dev039-unit-evidence.txt` | Commit; reviews |
| 3 | reviewing (`gp-reviewer`, `gp-security`, native) on `52d6b63` (the five commits plus a merge of `origin/main` 206abec: DEV-035, #110 and #111, landed first; one conflict in the task index) | **`gp-security`: PASS WITH FINDINGS** (S1-01, S1-02 minor; S1-03 to S1-06 info). **`gp-reviewer`: CHANGES REQUESTED** (R1-01 to R1-06 minor, R1-07 and R1-08 nits). No blocker, no major. Both confirmed: only the purge role can call the purge functions; the abandon path answers only for the creator; the purge cannot reach an available object's bytes | review reports; `scratchpad/review1.diff` | Stated fixes |
| 4 | rework (coordinator), stated fixes, tests first | **R1-03** the route comment and this record now say «purged or missing»; an unreachable store throws and is a logged 500; noted on BL-036. **R1-06** a Progress line on BL-036. No code change | the diff | Re-review; `gp-qa` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-03 | minor | route comment; the objective | Actual: claimed an unreachable store was a silent 200 | coordinator | Reworded (row 4) |
| R1-06 | minor | `docs/BACKLOG.md` BL-036 | Actual: untouched | coordinator | Progress line; closure at done (row 4) |

Rework count and hypothesis changes: none counted (no QA FAIL yet); the review fixes are the first rework, before QA.

## What is not true after this task

- **A log line is not an alert.** Nobody is paged; the line is in the Vercel runtime log for whoever looks. BL-035 (structured logging) stays open.
- **The line does not say which object failed**, by design: the request id and the assignment in the request path are how to find it.
- **Whether Vercel's own request log records the query strings of the signed URLs** is outside this change (BL-035's open question).

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- None beyond the repository: the behaviour of `createSignedUrls` for a missing object (per-entry error, path echoed) was measured on the local storage API v1.69.0 before this task and is pinned by `apps/app/tests/evidence-storage-read.int.test.ts`.

## Completion / handoff

- Changed / inspected files: see «Owning module».
- Review independence: pending.
- Verified scope: pending.
- Remaining risks / blocked requirements: see «What is not true».
- Next bounded action and owner: reviews (coordinator).
- Final state and reason: implementing.
