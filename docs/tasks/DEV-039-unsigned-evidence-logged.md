# DEV-039 — BL-036: an evidence read that could not be signed is logged, not silent

## Assignment

- **Objective and user-visible outcome:** when the member-plane evidence read cannot sign some objects (a purged object, an unreachable or misconfigured store), the operator sees it: one server log line with the failed and total counts and the request id. The screen is unchanged — rows without `readUrl` render «недоступне» and the response stays 200.
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-23.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a bounded change with an understood cause: coordinator (tests first) → `gp-reviewer` + `gp-security` → `gp-qa`. `gp-architect` was asked as part of the cluster and chose the no-contract option.
- **Triggered stages and why:** `gp-security` — evidence storage and signed URLs (the log line must carry neither). `gp-architect` — consulted on the contract question (a `/v1` field was one option). `gp-ui-reviewer`: not triggered (no UI change).
- **Owning module and allowed edit paths:** `apps/app/app/v1/assignments/[assignmentId]/evidence/route.ts`; `apps/app/tests/evidence-read.int.test.ts`; `docs/BACKLOG.md` (BL-036); this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`; `apps/app/AGENTS.md`; `files-and-storage.md` §Downloads («Logs record the domain object and authorization result, never the signed URL or raw storage key»); `createSignedReadUrls`' comment on why «all failed» is not a throw; `http.ts:97`, the app's one other log line.
- **Linked spec, ADR or earlier task:** BL-036 (legacy cite `TODOS.md`); DEV-034 (errors without keys). No ADR.
- **Baseline:** `4a33805` (DEV-038) on `claude/storage-purge`.
- **Dependencies / constraints / out of scope:** BL-036 depended on «BL-035, or a partial-failure field in the contract». `gp-architect` chose neither: a `/v1` field would serve an operator problem the screen already renders; structured logging (BL-035) stays open, and this line uses the same `console.error` channel as `http.ts`.
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

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

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
