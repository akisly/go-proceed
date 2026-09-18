# DEV-022 — BL-112: a command's request hash binds its target

## Assignment

- **Objective and user-visible outcome:** an `Idempotency-Key` reused for another target of the same command — another work item, template, requirement item, party — is refused with 409 `IDEMPOTENCY_CONFLICT` instead of replaying the first target's stored result while the second target stays untouched. `commandRoute` hashes the route's path parameters (UUIDs lower-cased) with the raw body, so every member-plane command gets the binding in one place.
- **State:** verifying
- **Coordinator:** primary Claude Code session, 2026-09-19.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** a change to every `/v1` command's idempotency contract: `gp-architect` → failing tests → `request-hash.ts`, `command.ts`, the revoke route, the conflict message → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-architect` (`apps/app/app/v1/**` behaviour); `gp-security` — not strictly triggered (no RLS, grant or auth change), run because it changes the identity every command is replayed by and S1-01 (DEV-021) was its finding. `gp-ui-reviewer`: not triggered (no UI; `technical/copy-catalog.csv` has no idempotency row). `gp-mobile`: not triggered (clients mint a new key per attempt).
- **Owning module and allowed edit paths:** `apps/app/src/lib/request-hash.ts` and its test (new); `apps/app/src/lib/command.ts` and `command.test.ts`; `apps/app/src/lib/http.ts` (the conflict detail) and `http.test.ts`; `apps/app/app/v1/invitations/[invitationId]/revoke/route.ts` (the local binding dropped); `packages/database/src/idempotency.ts` (comments and message); `apps/app/tests/idempotency-authorization.int.test.ts`; `apps/app/tests/invitations.int.test.ts` (its seeded pre-fix record); `technical/database/invariant-catalog.csv` (INV-048); `technical/test-catalog.csv` (T-IDEMP-001); dated notes in `docs/architecture/tenancy-and-security.md` and `docs/architecture/data-model.md`; `docs/BACKLOG.md` (BL-112 closed); `docs/STATUS.md`; this record and the index.
- **Read context:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/BACKLOG.md` BL-112; [DEV-021](DEV-021-invitation-revoke.md) (S1-01, S2-01, Q1-01, Q1-03); [DEV-020](DEV-020-idempotent-replay-authorization.md).
- **Linked spec, ADR or earlier task:** BL-112 (filed by DEV-021). No ADR: this enforces the existing rule «Reusing the key with a different request fails» and adds no scope.
- **Baseline:** `1f65fef` (main after PR #102).
- **Dependencies / constraints / out of scope:** no migration (the hash stays 64 lowercase hex); the local database stays at `0089`; database test files run one at a time, chosen by the coordinator under the owner's delegation. Out of scope: the external plane (keyed on its grant, no path params), the multipart `import_files.add` (binds its batch already), Telegram's service calls (their own keys).
- **Required acceptance criteria:**
  1. `apps/app/src/lib/request-hash.test.ts` and `command.test.ts` pin the envelope (params sorted, UUIDs lower-cased, other values as sent, raw-body digest byte-exact, 64 hex, a pinned vector) and are red at `1f65fef`; `command.test.ts` shows two targets with the same body getting different hashes.
  2. `apps/app/tests/idempotency-authorization.int.test.ts` gains cases red at `1f65fef` and green after: `requirement_templates.publish` and `project_requirements.archive` on two targets, and `parties.update` with an identical body on two parties — the second under the same key is 409 `IDEMPOTENCY_CONFLICT` and untouched; the same key on the same target replays (also with an upper-cased id); a demoted caller reusing the key gets 403, not 409; the same key in another workspace executes. The file truncates nothing.
  3. `invitations.revoke` uses the common hash; its reused-key and upper-case cases stay green.
  4. The conflict detail no longer says «different request body» only.
  5. INV-048, T-IDEMP-001, the tenancy and data-model notes, BL-112 and STATUS agree; `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  6. `pnpm turbo run typecheck` passes; the `apps/app` unit tests touched pass.
  7. The suites that seed or depend on a request hash pass — the coordinator's set under the owner's delegation: `invitations`, `invitation-revoke`, `telegram-bindings`, `upload-intents-create`, `organizations`, `workspaces`, `m3-refusal` (some truncate tenant tables).
  8. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-ui-reviewer`, `gp-mobile`: not triggered.

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-18 | Start BL-112 (after #102 merged) | chat, «смержил, давай BL-112» |
| 2026-09-19 | Transition: accept the one-time 409 for a retry spanning the deploy, with a deploy note | chat, answer «Принять 409 + deploy note» |
| 2026-09-19 | UUID path values are lower-cased in the hash | chat, answer «Нижний регистр» |
| 2026-09-19 | One formula for every command, routes without params included | chat, answer «Одна формула для всех» |
| 2026-09-19 | Which database runs: the coordinator chooses what is necessary | chat, answer «Выбери необходимые» |

The two remaining design questions were taken at the architect's recommendation and are recorded as the coordinator's, not the owner's: the local binding in `invitations.revoke` is dropped (one formula), and the conflict detail becomes «Той самий Idempotency-Key уже використано для іншого запиту: інший обʼєкт або інше тіло запиту.»

## Plan

1. Red: `request-hash.test.ts`, the `command.test.ts` case, the integration cases.
2. `request-hash.ts`, `command.ts`, the revoke route, the conflict detail, the helper's comments; `invitations.int.test.ts`'s seeded record.
3. Catalogs and documents; typecheck; the chosen suites.
4. `gp-reviewer` + `gp-security` → stated fixes → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native) on `1f65fef` | **Design returned, read-only; no ADR, no migration.** (a) `commandRoute` hashes `JSON.stringify(["goproceed-command-request/1", sorted [name, value] params with UUIDs lower-cased, sha256(raw body)])`; resolved params, not the concrete path (it varies by slash, encoding, rewrite) nor a template (unavailable); the operation id already scopes the record, one route per id; no query string (no command reads one). (b) per-route binding rejected (50 edits, forgettable — DEV-021 S1-01 was found in review); (c) a stored target column rejected (a migration for no gain). The `request_hash` 64-hex checks (`0002` and seven domain tables) rule out a version prefix. Dual-hash compatibility rejected: it keeps the defect alive on old records for 30/400 days. The external plane excluded (keyed on its grant, no path params). Kept as they are: `import_files.add`, `organizations.create`'s route-level hash inputs, Telegram and evidence service calls. Domain tables that store `a.requestHash` (exceptions, closures, statutory acts) will hold mixed formulas; nothing compares them | architect report | Owner |
| 2 | implementing (coordinator): red | Tests first, at `1f65fef`. `request-hash.test.ts`: the module missing (a specification red; its pinned vectors were computed independently in Python). `command.test.ts`: **the two targets got the same hash** — `44136fa3…`, the SHA-256 of `{}` — the defect in one assertion. `idempotency-authorization.int.test.ts` alone, local database `0089`: **3 failed, 9 passed** — `requirement_templates.publish` (`:325`), `project_requirements.archive` (`:361`) and `parties.update` with an identical body (`:386`) each answered the second target's reuse of the key with **200** (the first target's replay) where 409 was expected. The demoted-reuse case passed already (DEV-020's `authorize` runs first): a guard | `scratchpad/dev022-red-unit.txt`, `dev022-red-int.txt` | Fix |
| 3 | implementing (coordinator): fix and documents | `apps/app/src/lib/request-hash.ts` (the envelope, pure); `commandRoute` awaits the params before hashing and passes `commandRequestHash(params, raw)`; `invitations.revoke` passes `a.requestHash` (its local binding dropped); the conflict detail «Той самий Idempotency-Key уже використано для іншого запиту: інший обʼєкт або інше тіло запиту.»; the helper's comments and internal message; `invitations.int.test.ts` seeds its pre-fix record with the new hash. INV-048, T-IDEMP-001, the tenancy note (a dated update after DEV-020's), `data-model.md`, BL-112 closed, STATUS. No migration, no catalog of errors or copy changed | the implementation commit | Runs |
| 4 | implementing (coordinator): runs on `0489c97` | Each alone, clean tree, local database `0089`: `pnpm turbo run typecheck --force` 10/10; validators rc 0; unit (`request-hash`, `command`, `http`, `idempotency-call-sites`) 32; **`idempotency-authorization.int.test.ts` 12 passed**; regression, none skipped: `invitation-revoke` 13, `invitations` 9, `telegram-bindings` 8, `upload-intents-create` 23, `organizations` 7, `workspaces` 7, `m3-refusal` 29; `pnpm --filter @goproceed/app build` rc 0; no `de2…` workspace left | `scratchpad/dev022-*.txt` | `gp-reviewer`, `gp-security` |
| 5 | reviewing (`gp-reviewer`, `gp-security`, native) on `d298b50` | **`gp-reviewer`: APPROVE** — the envelope is unambiguous (JSON array, named params, sorted), the body digest is the same UTF-8 input as before, no stored hash is compared outside `withIdempotency`, the revoke binding holds; R1-01 to R1-03 low (the 400-day commands, the own-hash commands, the deploy note's home), R1-04 to R1-06 informational. **`gp-security`: PASS** — no collision, no unbound target among the 50 `commandRoute` routes, DEV-021's S1-01 stays closed, the 409 discloses nothing, rollback mirrors the deploy; S1-01 minor (nothing enforces the rule — a future own hash or a URL/header target would bring BL-112 back), S1-02 informational (the new-assignment form keeps one key per form: a lost response spanning the deploy shows «not created» and a reload creates a second assignment). Pre-existing: the advisory-lock key uses the workspace id as given | review reports | Stated fixes |
| 6 | rework (coordinator), stated fixes | **S1-01 / R1-06**: `idempotency-call-sites.test.ts` refuses a `withIdempotency` call whose `requestHash` is not `a.requestHash`, `args.requestHash` or a listed service's pass-through — allowlisting `organizations.create` (no target) and `import_files.add` (batch + content) with their reasons — and any `POST`/`PATCH`/`PUT`/`DELETE` `commandRoute` handler that reads `a.req.url`, `a.req.headers` or `searchParams`; 4 passed; **mutations**: `work_items.remove` hashing the body only, and `project_requirements.archive` reading its id from the query string, each turn it red naming the site; restored. **S1-02 / R1-03**: the deploy note in STATUS «Next action» item 4, with the refusal-not-failure caveat and the form; the record says the same. **R1-01**: the five `ledger_400d` commands named. **R1-02**: `organizations.create` and `import_files.add` (id as sent) named in the record and INV-048. **R1-04**: «exact over its decoded text». **R1-05**: the Python that computed the pinned vectors is in the test. The lock-key case recorded. **Runs on `4997669`**: typecheck 10/10, validators rc 0, unit 34, the int file 12 | `scratchpad/dev022-r2-*.txt` | `gp-qa` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| S1-01 / R1-06 | minor / info | the call-site audit | Actual: the target rule not enforced | coordinator | Hash and URL/header checks with mutation proofs (row 6) |
| S1-02 / R1-03 | info / low | the deploy note; the new-assignment form | Actual: no durable deploy note; the form's lost-response case unstated | coordinator | STATUS item 4 and the record (row 6) |
| R1-01 | low | «What is not true» | Actual: one 400-day command named | coordinator | Five named (row 6) |
| R1-02 | low | the record, INV-048 | Actual: the own-hash commands unnamed | coordinator | Named (row 6) |
| R1-04 | info | the test name | Actual: «byte-exact» | coordinator | Reworded (row 6) |
| R1-05 | info | the pinned vectors | Actual: the Python not shown | coordinator | In the test comment (row 6) |

Rework count and hypothesis changes: none — no QA FAIL and no blocker.

## What is not true after this task

- **A retry that spans the deploy is answered 409**, not with the stored response: stored hashes covered the body only (owner, 2026-09-19). A rollback has the mirror effect for records this build wrote. Records age out after 30 days, or 400 for the five `ledger_400d` commands: `contract_versions.publish`, `import_batches.publish`, `progress.record`, `progress.adjust`, `stage_closures.create`. Such a 409 is a refusal, not a failure of the first request: the new-assignment form keeps one key per form instance, so a submit whose response was lost before the deploy and retried after it shows «Доручення не створено» although the assignment exists, and a reload would create a second one (S1-02). Check the register before submitting again.
- **Domain tables that store a command's request hash** (exceptions, stage closures, statutory acts, evidence decisions, upload intents) hold the old formula before the deploy and the new one after; nothing compares them.
- **A command that reads its target from the query string or a header** would not be bound; none does today, and the rule is stated in `request-hash.ts`.
- **Two `/v1` commands and the external plane keep their own hashes**: `organizations.create` (no path parameters, so nothing to bind; it does not use `commandRoute`) and `import_files.add` (multipart; hashes its batch id with the content hash, the batch id **as sent**, so a retry that only changes the id's letter case is a false 409, which fails safe); the external plane is keyed on its grant and has no path parameters. The call-site test lists them and refuses any other own hash.
- **`withIdempotency`'s advisory-lock key uses the workspace id as given** (pre-existing): two concurrent same-key requests whose ids differ only in case take different locks; the unique constraint turns the loser into a 500 and a rollback, nothing is duplicated.
- **Only the files named in rows 2-4 ran**, each alone, locally. Nothing ran in CI.

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

- Next.js 16.3.1 route handlers, `params` is a Promise of the dynamic segments — `apps/app/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, read by `gp-architect`; accessed 2026-09-19.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
