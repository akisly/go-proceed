# DEV-019 — BL-104: the invitation token is no longer stored in the idempotency record

## Assignment

- **Objective and user-visible outcome:** `invitations.create` stops writing the raw invitation token into `public.idempotency_records.response_body`. The token is returned only by the execution that created it; a replay of the same key and body returns a token-free receipt marked `kind: "replayed"`. Rows already stored lose their `token` key through migration `0088`.
- **State:** reviewing
- **Coordinator:** primary Claude Code session, 2026-09-18.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** a `/v1` contract change and a data migration: `gp-architect` → failing tests → contract, route, migration → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (`apps/app/app/v1/**`, `packages/contracts/**`, `supabase/migrations/**`); `gp-security` (a bearer secret at rest, and the migration edits stored data). `gp-ui-reviewer` is not triggered: the only file under `apps/app/app` is a route handler, not UI. `gp-mobile` is not triggered.
- **Owning module and allowed edit paths:** `packages/contracts/src/invitations.ts`, `packages/contracts/src/invitations.test.ts` (new); `apps/app/app/v1/workspaces/[workspaceId]/invitations/route.ts`; `apps/app/tests/invitations.int.test.ts`; `supabase/migrations/0088_the_invitation_token_left_in_the_receipt.sql` (new); `technical/database/invariant-catalog.csv` (INV-102); `docs/BACKLOG.md` (BL-104 closed, BL-107 new); `docs/STATUS.md`; this record and the index.
- **Read context:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/BACKLOG.md` BL-104, BL-103, BL-013; [DEV-016](DEV-016-gate11-remaining-gaps.md) (S1-01); [DEV-017](DEV-017-capture-event-service-workspace.md); `packages/database/src/idempotency.ts`; the occurrence-grants and Telegram intent routes (the capture pattern); `docs/architecture/jobs-events-and-audit.md:127-139`.
- **Linked spec, ADR or earlier task:** BL-104; DEV-016 (found it). BL-103 is DEV-020, a separate PR after this one (owner, 2026-09-18).
- **Baseline:** `b3045df` (main after PR #99).
- **Dependencies / constraints / out of scope:** local database at `0087`, test fixtures only; `0088` is applied locally by hand as `postgres`, never through `supabase db reset` and never to a hosted project by this task; database test files run one at a time with the owner's permission. Out of scope: BL-103 (a replay by a demoted or removed admin still returns 201, now without the token), BL-013, an invitation revoke or reissue route (BL-107).
- **Required acceptance criteria:**
  1. `apps/app/tests/invitations.int.test.ts` gains cases that are red at `b3045df` for the defect and green after the fix: no `invitations.create` record's `response_body` carries a `token` key and no stored column carries the token string; a replay with the same key and body returns 201 `kind: "replayed"` with the same `invitationId` and `expiresAt` and no `token`; a replay over a record written before the fix returns no token and no 500; a fresh create still returns `kind: "issued"` and a token whose SHA-256 is `token_hash`.
  2. The contract `createInvitationResponse` is a discriminated union: the issued arm requires the token, the replayed arm refuses one; `packages/contracts/src/invitations.test.ts` proves both.
  3. The route returns a strict token-free receipt from the idempotent block, captures the token outside it, and builds the replay body from named fields, never by spreading the stored body.
  4. `0088` removes the `token` key from stored `invitations.create` bodies, carries a self-check, applies cleanly at `0087`, and changes no policy, grant or table shape.
  5. Every `withIdempotency` caller has been checked for a secret returned from inside its block; the result is recorded here.
  6. INV-102 exists; BL-104 is closed → DEV-019; BL-107 (P2) exists; `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  7. `pnpm --filter @goproceed/app typecheck`, `pnpm --filter @goproceed/contracts typecheck` and `pnpm --filter @goproceed/contracts test` pass.
  8. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-ui-reviewer`, `gp-mobile`: not triggered.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-18 | BL-104 and BL-103 are two PRs, one after the other: BL-104 first | chat, answer «Два PR, по очереди» |
| 2026-09-18 | A replay of `invitations.create` returns 201 without the token | chat, answer «(a) 201 без токена» |
| 2026-09-18 | Stored rows are cleaned by migration `0088` | chat, answer «Миграция 0088» |
| 2026-09-18 | A backlog entry for invitation revoke and reissue, at P2 | chat, answer «Да, P2» |
| 2026-09-18 | Which database tests run: the coordinator chooses the necessary ones. Chosen: `invitations.int.test.ts` (it truncates tenant tables) and the local hand-apply of `0088` | chat, answer «даже не знаю, выбери самые необходимые» |

## Plan

1. Red: `packages/contracts/src/invitations.test.ts` and the new cases in `apps/app/tests/invitations.int.test.ts`; run the integration file alone at `b3045df` and show which assertions fail.
2. Contract, route, `0088`; apply `0088` by hand; the same file green.
3. INV-102, BL-104 closed, BL-107, STATUS; validators and typechecks.
4. `gp-reviewer` + `gp-security` → stated fixes → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native) on `b3045df` | **Design returned, read-only; no ADR.** Option (a), the pattern of the occurrence-grants, revoke-reissue and Telegram intent routes: a strict token-free receipt inside the block, the token held outside and attached only when the block ran, a `kind: "issued" \| "replayed"` discriminator, and the replay body built from named fields so a row written before the fix cannot serve its token. **All 51 `withIdempotency` call sites in 50 files read: only `invitations.create` stores a secret**; grants, revoke-reissue and both Telegram intents capture outside, `authorize-upload-intent` mints its signed URL after the block, and the external plane does not use the helper. A cleanup migration is safe to ship after or without the code; the code is safe without it. New INV-102 (the invitation token is not covered by INV-044, which is the external-access HMAC invariant). Found in passing: DA-134 lists `UPDATE` on `idempotency_records`, which `0003:65` does not grant (left to DEV-020, which edits that row) | architect report | Owner decisions |
| 2 | implementing (coordinator): red | `packages/contracts/src/invitations.test.ts` written: 2 of 2 failed at `b3045df` (the schemas do not exist — a specification red, not a defect proof). Four cases added to `apps/app/tests/invitations.int.test.ts`; **the file alone at `b3045df`, local database `0087`: 4 failed, 5 passed**, each for the defect: `:122` a stored `invitations.create` record carried `token` (count 1 for 0); `:141` the same-key replay returned `token`; `:173` a replay over a pre-fix record served its token; `:187` the replay by an admin since demoted to `member` returned the token | `scratchpad/dev019-red-contracts.txt`, `dev019-red-int.txt` | Fix |
| 3 | implementing (coordinator): fix and `0088` | Contract: `createInvitationReceipt` (strict) and `createInvitationResponse` (discriminated on `kind`; the issued arm requires a 64-hex token, the replayed arm is strict). Route: the callback returns the parsed receipt, the token sits in a holder outside the block, a fresh execution that did not capture one throws, and the response is parsed from picked fields. `0088` written and applied by hand as `postgres` (`-v ON_ERROR_STOP=1 -1`, rc 0), recorded in `supabase_migrations.schema_migrations` by a separate insert: **`UPDATE 2`** — the two `invitations.create` rows the red run had written with the old code — then 0 with a token; the `idempotency_records` policies and grants read identically before and after; a second apply `UPDATE 0`, rc 0. Green: `invitations.int.test.ts` alone at `0088` **9 passed**; `@goproceed/contracts` 138 passed | `scratchpad/dev019-apply-0088.txt`, `dev019-green-int.txt`, `dev019-green-contracts.txt` | Documents |
| 4 | implementing (coordinator): documents and checks | INV-102 added (scope `operational`, beside INV-048); BL-104 `closed → DEV-019` with dated evidence and the corrected insert lines; BL-107 (P2, owner) added; STATUS migration row, marker `0088` and next actions. `pnpm validate:canonical-docs` and `pnpm validate:agents` rc 0; `@goproceed/app` and `@goproceed/contracts` typecheck rc 0; `pnpm turbo run typecheck` 10/10 rc 0 — its first run failed in `@goproceed/landing` because this worktree's `apps/landing/node_modules` lacked the `@goproceed/tokens` link, fixed by `pnpm install --frozen-lockfile` (no lockfile change) | `scratchpad/dev019-canonical-docs.txt`, `dev019-agents.txt`, `dev019-typecheck-*.txt` (the failed run kept as `dev019-typecheck-all-stale-install.txt`) | Commit; `gp-reviewer`, `gp-security` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

The Limitation column opens with at most one qualifier from this closed set, then its detail:

- **PASS:** `negative` (the command correctly produced nothing, and the absence is the evidence); `assisted:` what had to be arranged by hand first; `owner-reported` (the owner's report, not a session observation).
- **FAIL:** `known-red baseline:` the named set of pre-existing failures, with no case outside it failing.
- **NOT RUN:** `environmental:` the cause and the command that settles it; `not-provable-locally:` what would settle it; or, with no qualifier, the reason: why it was deliberately not attempted, or why a PASS was earned for the wrong reason (`agents/roles/gp-qa.md`).

Gate records written before 2026-09-13 keep their own tokens; `docs/delivery/pilot-execution-runbook.md` §7.4 maps them onto this set.

## Sources

Third-party documentation and primary sources checked for this task. Give each one its URL, the installed version it applies to, its publication date if known (never substitute today's date) and the access date.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
