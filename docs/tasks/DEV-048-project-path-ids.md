# DEV-048 — BL-141: a malformed project path id is 404 on every project route, and the catalog's `retryable` is a default

## Assignment

- **Objective and user-visible outcome:** every route under `/v1/projects/{projectId}` answers a malformed project id — and the two nested routes a malformed message or contract-version id — with 404 `RESOURCE_NOT_FOUND`, before the Idempotency-Key, the body and any database call; before, nine answered 500 `INTERNAL_ERROR` and ten 422 (the body was parsed first). `docs/README.md` says what the error catalog's `retryable` means when a route sends the other value.
- **State:** done
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a bounded bug with an understood cause, widened by the owner to every project route: failing test → change in the shared route wrappers → `gp-reviewer` → `gp-qa`. `gp-architect` sized it in the cluster design.
- **Triggered stages and why:** `gp-architect` (cluster design; `/v1` error behaviour). `gp-security` is not triggered by its own list (no RLS, auth, session or secret change); its review of the cluster's diff covers this commit too. `gp-ui-reviewer`, `gp-mobile`, `gp-researcher`: not triggered (route handlers only; no library behaviour beyond the wrappers').
- **Owning module and allowed edit paths:** `apps/app/src/lib/command.ts` and `command.test.ts`; `apps/app/src/lib/request-hash.ts` (exports its UUID pattern); `apps/app/app/v1/projects/[projectId]/contract-versions/[versionId]/requirement-occurrences/dry-run/route.ts` and `communications/[messageId]/retry/route.ts` (declare their nested ids); `apps/app/tests/project-path-ids.test.ts` (new); `docs/README.md` (the catalog paragraph); `docs/BACKLOG.md` (BL-141); this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`, `apps/app/AGENTS.md`; `apps/app/app/v1/projects/[projectId]/access-grants/revoke/route.ts` (the check it already had); `docs/README.md` «precedence» (the error catalog's exception).
- **Linked spec, ADR or earlier task:** BL-141, filed by [DEV-043](DEV-043-project-access-revoke.md); cluster DEV-047 to DEV-053.
- **Baseline:** `58a592e` (DEV-047) on `origin/main` `20f2b67`.
- **Dependencies / constraints / out of scope:** routes outside `/v1/projects/{projectId}` with other `*Id` path parameters keep their own handling; the wrapper checks `projectId` everywhere it appears (only this tree has it) and the ids a route declares. The catalog's `retryable` values are not changed.
- **Required acceptance criteria:**
  1. `apps/app/tests/project-path-ids.test.ts` walks the tree and fails at the baseline: for every exported method of every route file, a malformed `projectId` (four shapes) — and a malformed `versionId` or `messageId` on the nested routes — is not 404; it passes after the change, and needs no database then.
  2. `apps/app/src/lib/command.test.ts`: the check precedes the key and the body, never runs the handler, uses a declared nested id's own detail, leaves undeclared parameters alone, and lets an upper-case UUID through.
  3. `request-hash.test.ts` still passes (its pattern is now exported, unchanged).
  4. The suites that drive these routes with well-formed ids still pass (the cluster's final run).
  5. `docs/README.md` states that the catalog's `retryable` is the default and names the codes a route sent against it on 2026-09-24, from a scan saved as evidence.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-24 | BL-141 joins the cluster | chat, answer «BL-141 + BL-143, …» |
| 2026-09-24 | Scope: every project route through one shared helper and a test that walks them all; `retryable` as a clarification in the docs | chat, answer «Все project-маршруты (Рекоменд.)» |

## Plan

1. Failing test: the tree walk.
2. `commandRoute` and `queryRoute` resolve the params first and refuse a malformed `projectId`, or a declared nested id, with 404; the two nested routes declare theirs.
3. Unit tests of the wrapper; the `retryable` scan and the `docs/README.md` sentence.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | About ten more project routes than BL-141 named lack the check; `retryable` differs across routes, so flipping the catalog row would only move the mismatch | architect report, 2026-09-24 | owner |
| 2 | coordinator | Red: 19 failed, 3 passed. 500 `INTERNAL_ERROR` from the GET routes `assignments`, `blocked-reasons`, `blocked-value`, `communications`, `field-channel`, `readiness`, and POST `communications/{messageId}/retry`, `telegram/binding-intents`, `telegram/member-link-intents`, and the dry-run's malformed `versionId`; 422 `VALIDATION_FAILED` from the ten POST routes that parse the body first (`access-grants`, `access-grants/revoke`, `activate`, `communications`, `contracts`, `field-channel`, `parties`, `responsibilities`, `responsibilities/end`) | `scratchpad/dev047-red.txt` (HEAD `58a592e` + the test) | fix |
| 3 | coordinator | The check lives in the wrappers, keyed by parameter name: `projectId` always, nested ids by the route's `pathIds` option. A malformed `messageId` was already 404 at the baseline only because an unknown project answers first | `apps/app/src/lib/command.ts` | green |
| 4 | coordinator | Green: `project-path-ids.test.ts`, `command.test.ts`, `request-hash.test.ts` — 40 passed; `tsc --noEmit -p apps/app` exit 0 | `scratchpad/dev047-green.txt` | retryable |
| 5 | coordinator | Scan of 226 `problem(… retryable …)` emits in `apps/app`: five codes against their catalog default (`VERSION_CONFLICT` false in 16 files; `ASSIGNMENT_CONFLICT`, `IMPORT_JOB_CONFLICT`, `UPLOAD_GRANT_EXPIRED` false; `UPLOAD_INTENT_CONFLICT` true). The first draft's «stricter, never looser» was false for `UPLOAD_INTENT_CONFLICT`, so the sentence states the default rule and lists them. `INTERNAL_ERROR` is off-catalog by design (`apps/app/src/lib/http.ts`) | `scratchpad/dev047-retryable-scan.txt` | review |
| 6 | coordinator | The commit (`31eaf36`) was made before its review stage ran; `gp-reviewer` ran late on `git show 31eaf363`, 2026-09-24 | `scratchpad/dev047.diff` | review |
| 7 | gp-reviewer | R1 PASS: R1-01 minor (the walk's `messageId` case passed on the handler's project lookup, not the wrapper), R1-02 minor (routes outside the tree still 500), R1-03 nit (the count in `docs/README.md`) | reviewer report, 2026-09-24 | fixes |
| 8 | coordinator | Fixes: the walk mocks the transaction helpers to throw and asserts each param's own detail, and fails on an unregistered segment (23 passed; with the retry route's `pathIds` removed, the `messageId` case fails with 500); BL-151 filed; the README count. A non-canonical id spelling PostgreSQL accepts (32 hex digits, braces) that used to resolve is now 404; those spellings were already separate idempotency targets. The cited `scratchpad/dev047-*.txt` files are not in this session's scratchpad (the earlier session's folder is empty), so the baseline red run cannot be re-inspected; the green half is re-evidenced by the cluster's final run at a later revision; the 226-emit scan file is lost with them | `scratchpad/dev047-r1-mutation.txt` | gp-qa |
| 9 | gp-qa | Late-review rework verified; the lost evidence rebuilt on read-only copies of old commits: the walk against `58a592e` 21 failed, 2 passed (500 and 422); the retryable scan at `31eaf36` reproduced (226 emits, the same five codes; `scratchpad/qa-retry-scan.cjs`) | QA report, 2026-09-24 | commit |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R1-01 | minor | `project-path-ids.test.ts` | the `messageId` case passed through the handler's database lookup, so a missing `pathIds` would stay green in CI | coordinator | fixed: transaction helpers mocked to throw; per-param detail asserted; unknown segments fail; mutation red (`dev047-r1-mutation.txt`) |
| R1-02 | minor | routes outside the project tree | a malformed id is still 500 there, and nothing tracked it | coordinator | filed BL-151 (with the dry-run's string comparison of `project_id`) |
| R1-03 | nit | `docs/README.md` | «16 route files» | coordinator | fixed: 16 files, 14 routes and two shared modules at `31eaf36` |

Rework count and hypothesis changes: none (first review, made late; fixes limited to the stated ones).

## What is not true after this task

- A malformed id on a route outside `/v1/projects/{projectId}` still answers 500 (BL-151).
- The retryable scan saved as criterion 5's evidence is lost with the earlier session's scratchpad; `docs/README.md` keeps its result.
- Routes outside the project tree with `*Id` path parameters were not swept; any of them may still answer a malformed id with 500.
- No test enforces the catalog's `retryable` against the routes; the scan is a dated observation.
- `apps/app` typechecks only the tests `src` or `app` imports (BL-069), so `tests/project-path-ids.test.ts` is compiled by vitest, not by `tsc`.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1 | yes | `506ce05` + the late-review rework | `project-path-ids.test.ts`: 23 passed; red rebuilt by `gp-qa` at `58a592e`: 21 failed | PASS (`gp-qa`) | — |
| 2 | yes | same | `command.test.ts`: 16 passed | PASS | — |
| 3 | yes | same | `request-hash.test.ts`: 5 passed | PASS | — |
| 4 | yes | same | the cluster's final run and 24 further route suites run by `gp-qa` | PASS | CI blocked |
| 5 | yes | same | `docs/README.md`; the scan reproduced by `gp-qa` | PASS | the original scan file is lost |

## Sources

- Next.js route handlers receive `params` as a promise (the wrappers already await it); no API of Next.js is used beyond what the wrappers used before. Installed `next` per `apps/app/package.json`; no external document was needed for this change.

## Completion / handoff

- Changed / inspected files: `command.ts`, `request-hash.ts`, the two nested routes, the walk and `command.test.ts`, `docs/README.md`, BL-141, BL-151, this record.
- Review independence: `gp-reviewer` and `gp-qa` ran late, as independent native subagents, after the commit; rows 6–9.
- Verified scope: criteria 1–5.
- Remaining risks / blocked requirements: «What is not true after this task» (BL-151).
- Next bounded action and owner: merging is the owner's.
- Final state and reason: done — merged in #123 (`406f5efe`, 2026-09-24) with the cluster's final run passing; `0098`–`0100` on staging since 2026-09-24 12:03 UTC.
