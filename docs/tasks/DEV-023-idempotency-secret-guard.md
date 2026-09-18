# DEV-023 — BL-108: `withIdempotency` refuses to store a body that carries a secret

## Assignment

- **Objective and user-visible outcome:** a command whose idempotent callback returns a body carrying a bearer secret — a key starting `csrf` or ending in `token`, `url`, `link`, `secret` or `password`, singular or plural, at any depth, case-insensitively (the `link` suffix and plurals added by the owner after review) — fails closed before anything is stored: the transaction rolls back and the command answers 500. INV-102 stops resting on each route remembering it.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-19.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** new behaviour inside existing boundaries (`agents/COORDINATION.md`): coordinator implements, failing test first → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-security` — the storage of bearer secrets (INV-102; BL-108 came from DEV-019's `gp-security`). `gp-architect` is not triggered: no migration, RLS, grant, `/v1` contract or catalog change — the guard sits inside the helper and changes no route's contract. `gp-ui-reviewer`, `gp-mobile`: not triggered.
- **Owning module and allowed edit paths:** `packages/database/src/idempotency.ts`; `packages/database/src/idempotency-secret-guard.test.ts` (new); `technical/database/invariant-catalog.csv` (INV-102's enforcement and evidence); `docs/BACKLOG.md` (BL-108 closed); `docs/STATUS.md`; this record and the index.
- **Read context:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/BACKLOG.md` BL-108; [DEV-019](DEV-019-invitation-token-at-rest.md) (INV-102, the capture pattern); [DEV-020](DEV-020-idempotent-replay-authorization.md) (the helper's `authorize` step and its fake-transaction test).
- **Linked spec, ADR or earlier task:** BL-108 (filed by DEV-019). No ADR.
- **Baseline:** `4181e14` (main after PR #103).
- **Dependencies / constraints / out of scope:** no migration; database test files run one at a time, chosen by the coordinator under the owner's delegation. Out of scope: records already stored (DEV-019's `0088` cleaned the one known case), the external plane (it stores no response body through the helper), an allowlist (none needed today; added only when a legitimate name appears).
- **Required acceptance criteria:**
  1. `packages/database/src/idempotency-secret-guard.test.ts` (no database) is red at `4181e14` and green after: a body with a denylisted key at the top level, nested in an object, or inside an array is refused before the insert, with an error naming the operation and the key path but not the value; exact names and suffixes match case-insensitively; a clean body is stored; a non-object body is stored; a replay is not affected.
  2. Every existing call site's stored body passes the guard: a static read of the contracts and the call sites, and the coordinator's regression set, each alone — `invitations`, `invitation-revoke`, `m5-external`, `telegram-bindings`, `upload-intents-create`, `project-communications`, `organizations`, `workspaces`, `m3-refusal`, `import-publish`, `progress-record`, `idempotency-authorization`.
  3. The helper's existing tests (`idempotency.test.ts`, `idempotency-authorize.test.ts`) and `idempotency-call-sites.test.ts` pass.
  4. INV-102, BL-108 and STATUS agree; `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  5. `pnpm turbo run typecheck` passes.
  6. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-architect` (no trigger, see above); `gp-ui-reviewer`, `gp-mobile`.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-19 | Start BL-108 (after #103 merged) | chat, «смержил, давай BL-108» |
| 2026-09-19 | Denylist: the names and the suffixes (`…Token`, `…Url`, `…Secret`, `…Password`), any depth, case-insensitive; a false positive is resolved by an explicit allowlist | chat, answer «Имена + суффиксы» |
| 2026-09-19 | A body with such a key is refused closed (error before the insert, rollback, 500), not stripped | chat, answer «Отказать закрыто» |
| 2026-09-19 | Which database runs: the coordinator chooses what is necessary | chat, answer «Выбери необходимые» |
| 2026-09-19 | After review: widen the list to the `…link` suffix and plurals (`reviewLink`, `tokens`, `accessTokens`, `urls`) | chat, answer «…Link и множ. число» |

## Plan

1. Red: the guard's unit test with a fake transaction, at `4181e14`.
2. The guard in `withIdempotency`, between the callback and the insert.
3. Static read of the stored bodies; the regression set; the helper's tests; typecheck.
4. INV-102, BL-108, STATUS.
5. `gp-reviewer` + `gp-security` → stated fixes → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoping (coordinator) on `4181e14` | Secret-shaped names in `packages/contracts/src`: `token`, `link`, `url` (external grants, invitations), `csrfToken` (external plane), `signedUrl`/`token` (upload grants), `telegramUrl`, `readUrl` (the evidence GET — a `queryRoute`, never stored). Each stored-body route keeps these outside the block since DEV-019; the 30 records in the local database carry no such key. So the guard can fail closed without refusing an existing route; the regression set confirms it | coordinator's grep and SQL | Red |
| 2 | implementing (coordinator): red and fix | `packages/database/src/idempotency-secret-guard.test.ts` (a fake transaction, as DEV-020's `idempotency-authorize.test.ts`). **At `4181e14`: 11 failed, 3 passed** — every secret-shaped body (top level, nested, in an array, upper-case, `csrf…`, the suffixes, the bare names) reached the insert; the near-miss, non-object and replay cases passed already. Fix in `packages/database/src/idempotency.ts`: `secretKeyPaths` walks the body (objects and arrays) and returns the paths of keys matching `^(token\|link\|url\|secret\|password\|csrf.*\|.*(token\|url\|secret\|password))$` (case-insensitive); between the callback and the insert a non-empty result throws `IdempotencySecretError`, naming the operation and the paths, never the values — the transaction rolls back and the command answers 500. The replay path is untouched. The guard test and `idempotency-authorize.test.ts` 18 passed. INV-102's enforcement and evidence, BL-108 closed, STATUS | `scratchpad/dev023-red-unit.txt`; the implementation commit | Runs |
| 3 | implementing (coordinator): runs on `7c2b91a` | Each alone, clean tree, local database `0089`: `pnpm turbo run typecheck --force` 10/10; validators rc 0; guard + authorize unit 18; `idempotency-call-sites` 4; `idempotency.test.ts` 2. **Regression, none skipped, no `IdempotencySecretError` in any log:** `idempotency-authorization` 12, `invitations` 9, `invitation-revoke` 13, `m5-external` 27, `telegram-bindings` 8, `upload-intents-create` 23, `project-communications` 9, `organizations` 7, `workspaces` 7, `m3-refusal` 29, `import-publish` 17, `progress-record` 10 — 171 passed; residue 0 | `scratchpad/dev023-*.txt` | `gp-reviewer`, `gp-security` |
| 4 | reviewing (`gp-reviewer`, `gp-security`, native) on `6698deb` | **`gp-reviewer`: APPROVE** — the regex matches the approved set, no current stored body trips it (contracts and every call site read), the walk and the ordering sound, the error value-free; R1-01 low (the refusal rows did not pin exact paths; `link`-exact untested), R1-02 low (plurals and synonyms pass, unstated), R1-03 low (the refusal is a retryable 500). **`gp-security`: PASS** — covers every caller, the service ones included; nothing leaks on failure; the rollback leaves nothing committed; S1-01 minor (keys ending `link` pass — «link» is this codebase's word for a bearer link; an owner decision), S1-02 low (the guard read the object, the table stores its JSON: a nested `toJSON` could smuggle a key; an `undefined` value was refused for nothing), S1-03 and S1-04 notes (retryable 500; stored records unchecked — a hosted query before Q-9) | review reports | Owner; stated fixes |
| 5 | rework (coordinator), stated fixes | **Owner (2026-09-19): widen to the `link` suffix and plurals** — the pattern is now `^(csrf.*\|.*(token\|url\|link\|secret\|password)s?)$` (case-insensitive); a grep of every key name in the contracts, the `/v1` routes and the evidence services finds no new match. **S1-02**: the guard checks `JSON.parse(JSON.stringify(body))` and the insert takes that same string. **R1-01**: each refusal asserts `IdempotencySecretError` and its exact `paths`; new cases `reviewLink`, `tokens`, `accessTokens`, `urls`, a nested `toJSON`, and `{ link: undefined }` stored. **R1-02, R1-03 / S1-03, S1-04**: «What is not true», with a hosted-check query verified locally (`gp-security`'s `lax` sketch fails on non-objects). **Runs on `0765e2b`**, each alone: typecheck 10/10; validators; guard + authorize unit 24; call sites 4; helper DB 2; the 12 regression suites again — 171 passed, none skipped, no guard error in any log; residue 0 | `scratchpad/dev023-r2-*.txt`, `dev023-hosted-check.sql` | `gp-reviewer` on the widened pattern; `gp-qa` |
| 6 | reviewing (`gp-reviewer` round 2, native) on `3e272e5` | **APPROVE** — the widened pattern is exactly the owner's set; no stored or plausible key falsely matches (`status`, `focus`, `results`, `playlist`, `linkedAt`, `tokenHash` pass; `hyperlink`, `hasToken` would fail closed, none stored); `JSON.parse(JSON.stringify(…))` stores the same text for every normal body. R2-01 low: the hosted check had no positive control and named no role. Fixed: total beside the flagged count, a root-level control, «run as a role that bypasses RLS»; output saved | round-2 report; `scratchpad/dev023-hosted-check-output.txt` | `gp-qa` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R2-01 | low | the hosted check | Actual: no positive control, no role | coordinator | Controls, total and role (row 6) |
| R1-01 | low | the guard test | Actual: paths not pinned exactly | coordinator | Exact `paths` asserted (row 5) |
| R1-02 / S1-01 | low / minor | the pattern | Actual: `…link` and plurals passed | owner, coordinator | Widened by the owner (row 5) |
| R1-03 / S1-03 | low / note | `http.ts` 500 mapping | Actual: advertised as retryable | coordinator | «What is not true» |
| S1-02 | low | object vs stored JSON | Actual: `toJSON` invisible; `undefined` refused | coordinator | The stored JSON checked (row 5) |
| S1-04 | note | stored records | Actual: unchecked | coordinator | «What is not true» with a verified query |

Rework count and hypothesis changes: none — no QA FAIL and no blocker.

## What is not true after this task

- **The guard reads key names, not values**: a secret stored under an innocent name (`value`, `data`, `code`, `key`, `uri`, `href`, `otp`, `jwt`, `apiKey`, `signature`) or inside a value (a string holding a URL) passes it; a legitimate key that matches (a public `url`, say) fails closed until an explicit allowlist names it.
- **A refusal is reported as a retryable 500**: it falls to the generic `INTERNAL_ERROR` (`retryable: true`, `retry_later`), although the same request is refused every time; the Telegram decision paths treat it as transient and retry up to their bound (S1-03, R1-03). Harmless while no legitimate body matches; a dedicated error code would be an error-catalog change.
- **Records stored before the guard are replayed unchecked** (S1-04). Before the Q-9 hosted push, run `scratchpad/dev023-hosted-check.sql`'s query **as a role that bypasses RLS** (`postgres` in the SQL editor — `idem_select` would otherwise filter by actor, and 0 would prove nothing): it returns the total next to the flagged count, with root-level, nested and near-miss controls. The filter is `jsonb_path_exists(response_body, 'strict $.** ? (@.type() == "object").keyvalue() ? (@.key like_regex "^(csrf.*\|.*(token\|url\|link\|secret\|password)s?)$" flag "i")')`. Locally (`scratchpad/dev023-hosted-check-output.txt`): the counts and all three controls as expected. `gp-security`'s `lax $.**.keyvalue()` sketch fails on non-objects. Not run on any hosted database.
- **The external plane and the Telegram service paths are not guarded here** beyond the calls that go through `withIdempotency`; the external plane stores no response body through it.
- **Only the files named in rows 2-3 ran against the database**, each alone, locally. Nothing ran in CI.

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

None: the change uses only the language and the repository's own helper.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
