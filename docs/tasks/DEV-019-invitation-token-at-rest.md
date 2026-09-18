# DEV-019 — BL-104: the invitation token is no longer stored in the idempotency record

## Assignment

- **Objective and user-visible outcome:** `invitations.create` stops writing the raw invitation token into `public.idempotency_records.response_body`. The token is returned only by the execution that created it; a replay of the same key and body returns a token-free receipt marked `kind: "replayed"`. Rows already stored lose their `token` key through migration `0088`.
- **State:** done
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
| 5 | reviewing (`gp-reviewer`, `gp-security`, native) on `8c3772a` | **`gp-reviewer`: APPROVE** — no path stores or serves the token, no other consumer of the contract, `0088` safe; R1-01 to R1-03 minor, R1-04 to R1-06 nits. **`gp-security`: PASS** — the token reaches no record, audit row, outbox payload, log or header, and no replay can return it, including over pre-`0088` rows and across actors; spot-checked the architect's sweep on grants, revoke-reissue, both Telegram intents, `authorize-upload-intent` and the external plane. S1-01, S1-02 minor; S1-03 (= R1-06), S1-04, S1-05 informational | review reports | Stated fixes |
| 6 | rework (coordinator), stated fixes | **Route** (R1-06 / S1-03): the capture guard and the final parse run inside `withTenantTx`, so a fresh execution that cannot hand its token back rolls back instead of committing an invitation nobody can redeem; header wording names the Telegram shape. **Tests** (R1-01, R1-02): the fresh-create case asserts exactly one `invitations.create` record for the workspace whose body equals the receipt, and that the sweep finds the `invitationId` (a positive control); the demoted-admin case asserts its precondition (`issued`, 64 hex) and a status in `[201, 403]`, and on 201 the exact replayed receipt. **INV-102** (R1-03, S1-01): enforcement described route by route (strict receipt vs typed body; replay by named fields vs stored body), the missing generic guard named, and the Telegram, m5, upload-intent and evidence-read tests cited. **`0088` header** (S1-02): what it cannot reach (old row versions, WAL, replicas, statement logs) and the old-deployment caveat with the read-only re-check. **Backlog**: BL-103 dated note (R1-05); BL-108 (P3, the generic guard, S1-01) and BL-109 (P3, the planned `invite/{token}` path, S1-05). **STATUS** (R1-04): the DEV-019 change-log sentence and «Next action» item 1. S1-04 recorded, no change (below). «What is not true» filled (S1-02). Final runs are taken after this row is written | `7fa37d0`; `scratchpad/dev019-r2-*.txt` | `gp-qa` |
| 7 | implementing (coordinator): runs on `7fa37d0` | **Red again, with the route and contract reverted to `b3045df` and the tests at `7fa37d0`** (then restored with `git checkout HEAD --`): 4 failed, 5 passed — `:125` the stored record held three keys, `token` among them; `:149` the replay returned `token`; `:181` the pre-fix record served its token; `:190` the demoted-admin case now stops at its new precondition (`kind` is absent from the old response), so that case's defect proof remains the first red run (`:187`, row 2). `0088` re-applied over the two token rows the red run had written: `UPDATE 2`, then 0 with a token, rc 0. **Green on the clean tree:** `invitations.int.test.ts` alone, 9 passed (verbose); `@goproceed/contracts` 138 passed; `pnpm turbo run typecheck --force` 10/10; validators rc 0 | `scratchpad/dev019-r2-red-int.txt`, `dev019-r2-apply-0088.txt`, `dev019-r2-green-int.txt`, `dev019-r2-contracts.txt`, `dev019-r2-typecheck-all.txt`, `dev019-r2-canonical-docs.txt`, `dev019-r2-agents.txt` | `gp-qa` |
| 8 | verifying (`gp-qa`, native) on `26f9f95` | **Verified for the scoped criteria:** 1–7 PASS, 8 NOT RUN (not required). Its own runs: `invitations.int.test.ts` alone, 9 passed, none skipped; contracts 138; app and contracts typecheck, both validators rc 0; read-only queries: database at `0088`, no `invitations.create` row with a token, the `idempotency_records` policies and grants identical to the apply evidence. Two sensitivity mutations, each restored and the tree clean: the token put back into the stored body turned `:125` red; the replay spreading the stored body turned `:181` red. Every stated fix in place; S1-04's «not changed» justified. New: Q1-01 nit (INV-102 said the Telegram replays are built from named fields) | QA report; `scratchpad/qa-idem-sites.txt` | Q1-01; done |
| 9 | closing (coordinator) | Q1-01: INV-102 attributes the named-field replay to `invitations.create` only and says the Telegram replays spread into a strict schema that fails closed. Acceptance table and handoff filled from the QA matrix. Validator re-run after this row is written | `scratchpad/dev019-close-canonical-docs.txt` | Push, PR |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| Q1-01 | nit | INV-102 enforcement | Actual: the Telegram replays described as built from named fields; they spread the stored body into a strict schema | coordinator | Reworded (row 9) |
| R1-01 | minor | `invitations.int.test.ts`, fresh-create case | Actual: the absence checks pass on an empty table | coordinator | Exact-receipt record and a positive sweep control (row 6) |
| R1-02 | minor | `invitations.int.test.ts`, demoted-admin case | Actual: no precondition, no status check; `not.toContain(undefined)` could pass | coordinator | Precondition, `[201, 403]`, exact receipt on 201 (row 6) |
| R1-03 / S1-01 | minor | INV-102 | Actual: only invitation tests cited; «strict receipt» untrue for the grant routes; no generic enforcement stated | coordinator | Enforcement per route, four tests cited, BL-108 filed (row 6) |
| R1-04 | nit | `docs/STATUS.md` change log, «Next action» 1 | Actual: no DEV-019 sentence; item 1 named merged DEV-018 | coordinator | Sentence added; item 1 rewritten (row 6) |
| R1-05 | nit | BL-103 *Why* | Actual: says the replay can carry a secret | coordinator | Dated note (row 6) |
| R1-06 / S1-03 | nit / informational | route, after `withTenantTx` | Actual: a failing issued-arm parse or capture guard would 500 after commit | coordinator | Moved inside the transaction (row 6) |
| S1-02 | minor | `0088` header; «What is not true» | Actual: residuals beyond backups unstated; section blank | coordinator | Header and section filled (row 6) |
| S1-04 | informational | `request_hash` (`command.ts:76-77`) | `invitations.accept`: not a usable verifier (256-bit token, a record only on success). `invitations.create`: an unsalted hash of a low-entropy body that confirms a guessed email — no more than `invitations.email` already holds in clear | coordinator | **Not changed**: pre-existing and general to every command whose body holds personal data; recorded under «What is not true» for any future erasure design |
| S1-05 | informational | `system-overview.md:307` `invite/{token}` | Actual: the planned page would carry the token in the path; not built | coordinator | BL-109 (P3) (row 6) |

Rework count and hypothesis changes: none — no QA FAIL and no blocker.

## What is not true after this task

- **No hosted database was checked or cleaned.** `0088` is on the local database only; a hosted project cannot take it before `0059`–`0087` and the Q-9 push decision, so any invitation issued there by the old build in the last thirty days keeps its stored token until then. Before the hosted push the owner can count, read-only, the `invitations.create` rows whose `response_body ? 'token'` joined to pending, unexpired invitations.
- **`0088` does not reach every copy:** backups and point-in-time recovery, old row versions until VACUUM, the write-ahead log, replicas, and any Postgres or platform log that recorded the old INSERT's bind parameters (not checked in any environment).
- **Deploying the build first is not one moment**: an older deployment still reachable at its own URL after `0088` stores a token again; the self-check ran once. Re-run its count after old deployments are retired.
- **A replay by an admin who was demoted or removed still returns 201** — now without the token (BL-103, DEV-020).
- **A lost token cannot be recovered**: the address stays blocked until the invitation expires (BL-107, P2).
- **Any authenticated account can redeem a leaked token** — the invited email is not checked (BL-013).
- **INV-102 is held route by route**: nothing in `withIdempotency` refuses a secret (BL-108).
- **`request_hash` of `invitations.create` is an unsalted SHA-256 of a low-entropy body** that confirms a guessed email; it reveals no more than `invitations.email` holds in clear, and no erasure path covers either (S1-04, not changed).
- **Only `invitations.int.test.ts` ran against the database**; the other suites that create invitations (`vertical-m1`, `review-fixes`, the `packages/testing` invitation suites) did not run. Nothing ran in CI.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. The integration cases are red at `b3045df` for the defect and green after the fix | yes | `26f9f95` | `dev019-red-int.txt` (4 failed at `:122`, `:141`, `:173`, `:187`), `dev019-r2-red-int.txt` (4 failed at `:125`, `:149`, `:181`, `:190`), `dev019-r2-green-int.txt` (9 passed); `gp-qa`'s own run (9 passed) and two mutations (red at `:125` and `:181`) | PASS | assisted: local database only; the demoted-admin case's defect proof is the first red run, as the second stops at its new precondition |
| 2. The contract's issued arm requires the token and the replayed arm refuses one | yes | `26f9f95` | `dev019-r2-contracts.txt` (138 passed); `gp-qa`'s own run | PASS | the contract test's red only shows the schemas did not exist (a specification red) |
| 3. Strict token-free receipt, token captured outside, replay from named fields | yes | `26f9f95` | the route; `gp-qa`'s mutation (b) reddens the pre-fix-record case | PASS | the «nothing captured» guard is unreachable without a mutation; checked by reading |
| 4. `0088`: removes the key, self-check, applies at `0087`, no policy, grant or shape change | yes | `26f9f95` | `dev019-apply-0088.txt` (rc 0, `UPDATE 2`, policies and grants identical, re-apply `UPDATE 0`), `dev019-r2-apply-0088.txt`; `gp-qa`'s read-only queries | PASS | assisted: applied by hand to the local database; no hosted project |
| 5. Every `withIdempotency` caller checked for a stored secret | yes | `b3045df` / `26f9f95` | `gp-architect`'s sweep of 51 call sites (row 1); `gp-security` and `gp-qa` spot-checks | PASS | spot-checked by review and QA, read in full by the architect only |
| 6. INV-102; BL-104 closed; BL-107 (P2); validators | yes | `26f9f95` | `dev019-r2-canonical-docs.txt`, `dev019-r2-agents.txt`; `gp-qa`'s reading and runs | PASS | Q1-01 fixed after the QA run (wording only) |
| 7. Typechecks and contracts tests | yes | `26f9f95` | `dev019-r2-typecheck-all.txt` (10/10 `--force`), `dev019-r2-contracts.txt`; `gp-qa`'s app and contracts typecheck | PASS | — |
| 8. CI `verify` on the PR head | no | — | — | NOT RUN | environmental: GitHub Actions starts no jobs until October 2026; settled by CI `verify` on the PR head |

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

The Limitation column opens with at most one qualifier from this closed set, then its detail:

- **PASS:** `negative` (the command correctly produced nothing, and the absence is the evidence); `assisted:` what had to be arranged by hand first; `owner-reported` (the owner's report, not a session observation).
- **FAIL:** `known-red baseline:` the named set of pre-existing failures, with no case outside it failing.
- **NOT RUN:** `environmental:` the cause and the command that settles it; `not-provable-locally:` what would settle it; or, with no qualifier, the reason: why it was deliberately not attempted, or why a PASS was earned for the wrong reason (`agents/roles/gp-qa.md`).

Gate records written before 2026-09-13 keep their own tokens; `docs/delivery/pilot-execution-runbook.md` §7.4 maps them onto this set.

## Sources

Third-party documentation and primary sources checked for this task. Give each one its URL, the installed version it applies to, its publication date if known (never substitute today's date) and the access date.

- PostgreSQL 17 JSON functions and operators (`?`, `jsonb - text`, `jsonb_typeof`) — https://www.postgresql.org/docs/17/functions-json.html — server 17.6 (DEV-017); accessed 2026-09-18. `jsonb - text` deletes a key from an object; applied to a scalar it raises, hence the `jsonb_typeof(...) = 'object'` guard.
- Zod 4 (`discriminatedUnion`, `.strict()`, issue `input` omitted by default) — installed 4.4.3, read from `node_modules/zod/v4/core/util.js` by `gp-security`; accessed 2026-09-18.

## Completion / handoff

- Changed / inspected files: see «Owning module and allowed edit paths», plus BL-108, BL-109 and the BL-103 note; commits `8c3772a` (implementation), `7fa37d0` (review round 1), `26f9f95` (runs before QA) and the closing commit.
- Review independence: independent — `gp-architect` (design), `gp-reviewer` (APPROVE), `gp-security` (PASS), `gp-qa` on `26f9f95`, all native subagents. No rework round was counted: no QA FAIL and no blocker.
- Verified scope: criteria 1–7 PASS; criterion 8 NOT RUN, not required.
- Remaining risks / blocked requirements: «What is not true» above; BL-103 (DEV-020), BL-107, BL-108, BL-109, BL-013; `0088` is on the local database only, and a hosted push applies it after the application build.
- Next bounded action and owner: owner — review and merge the PR. Then DEV-020 (BL-103) from `main`, with its scope decision.
- Final state and reason: done — every required criterion PASS; every finding fixed or recorded with its reason.
