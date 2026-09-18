# DEV-023 — BL-108: `withIdempotency` refuses to store a body that carries a secret

## Assignment

- **Objective and user-visible outcome:** a command whose idempotent callback returns a body carrying a bearer secret — a key named `token`, `link`, `url`, `secret`, `password`, `csrf…`, or ending in `…Token`, `…Url`, `…Secret`, `…Password`, at any depth, case-insensitively — fails closed before anything is stored: the transaction rolls back and the command answers 500. INV-102 stops resting on each route remembering it.
- **State:** scoped
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
