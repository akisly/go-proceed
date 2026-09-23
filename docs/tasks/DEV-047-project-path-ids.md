# DEV-047 — BL-141: a malformed project path id is 404 on every project route, and the catalog's `retryable` is a default

## Assignment

- **Objective and user-visible outcome:** every route under `/v1/projects/{projectId}` answers a malformed project id — and the two nested routes a malformed message or contract-version id — with 404 `RESOURCE_NOT_FOUND`, before the Idempotency-Key, the body and any database call; before, nine answered 500 `INTERNAL_ERROR` and ten 422 (the body was parsed first). `docs/README.md` says what the error catalog's `retryable` means when a route sends the other value.
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-24.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why (`agents/COORDINATION.md`):** a bounded bug with an understood cause, widened by the owner to every project route: failing test → change in the shared route wrappers → `gp-reviewer` → `gp-qa`. `gp-architect` sized it in the cluster design.
- **Triggered stages and why:** `gp-architect` (cluster design; `/v1` error behaviour). `gp-security` is not triggered by its own list (no RLS, auth, session or secret change); its review of the cluster's diff covers this commit too. `gp-ui-reviewer`, `gp-mobile`, `gp-researcher`: not triggered (route handlers only; no library behaviour beyond the wrappers').
- **Owning module and allowed edit paths:** `apps/app/src/lib/command.ts` and `command.test.ts`; `apps/app/src/lib/request-hash.ts` (exports its UUID pattern); `apps/app/app/v1/projects/[projectId]/contract-versions/[versionId]/requirement-occurrences/dry-run/route.ts` and `communications/[messageId]/retry/route.ts` (declare their nested ids); `apps/app/tests/project-path-ids.test.ts` (new); `docs/README.md` (the catalog paragraph); `docs/BACKLOG.md` (BL-141); this record; `docs/tasks/README.md`.
- **Read context and applicable local instructions:** root `AGENTS.md`, `apps/app/AGENTS.md`; `apps/app/app/v1/projects/[projectId]/access-grants/revoke/route.ts` (the check it already had); `docs/README.md` «precedence» (the error catalog's exception).
- **Linked spec, ADR or earlier task:** BL-141, filed by [DEV-043](DEV-043-project-access-revoke.md); cluster DEV-046 to DEV-052.
- **Baseline:** `58a592e` (DEV-046) on `origin/main` `20f2b67`.
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

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes: none yet.

## What is not true after this task

- Routes outside the project tree with `*Id` path parameters were not swept; any of them may still answer a malformed id with 500.
- No test enforces the catalog's `retryable` against the routes; the scan is a dated observation.
- `apps/app` typechecks only the tests `src` or `app` imports (BL-069), so `tests/project-path-ids.test.ts` is compiled by vitest, not by `tsc`.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

## Sources

- Next.js route handlers receive `params` as a promise (the wrappers already await it); no API of Next.js is used beyond what the wrappers used before. Installed `next` per `apps/app/package.json`; no external document was needed for this change.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
