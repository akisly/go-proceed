# DEV-022 — BL-112: a command's request hash binds its target

## Assignment

- **Objective and user-visible outcome:** an `Idempotency-Key` reused for another target of the same command — another work item, template, requirement item, party — is refused with 409 `IDEMPOTENCY_CONFLICT` instead of replaying the first target's stored result while the second target stays untouched. `commandRoute` hashes the route's path parameters (UUIDs lower-cased) with the raw body, so every member-plane command gets the binding in one place.
- **State:** scoped
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
