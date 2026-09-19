# DEV-024 — BL-109: the invitation link carries its token in the fragment, never the path

## Assignment

- **Objective and user-visible outcome:** the approved field-client route table stops prescribing `invite/{token}` — a bearer token in a URL path, which reaches access logs, `Referer` headers and analytics and which a link prefetch could consume. The invitation link becomes `invite#<token>`: the token rides in the fragment, which no browser sends, and the page exchanges it by POST after sign-in, as the external review link does (INV-010). A static test keeps any route in `apps/app` from taking a secret-shaped name from its path or its query string. The redemption page itself is not built.
- **State:** scoped
- **Coordinator:** primary Claude Code session, 2026-09-19.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** a correction to an approved architecture document plus a static guard (executed test code, so a behavior change): coordinator → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-security` — the delivery of a bearer credential (BL-109 came from DEV-019's `gp-security`). `gp-architect` is not triggered: no migration, RLS, `/v1` contract or catalog of states changes; the route table is a design document and the owner ruled the shape. `gp-mobile` is not triggered: `apps/mobile` routes no invitation link (grep), and the custom scheme is v0.3. `gp-ui-reviewer`: no UI is built.
- **Owning module and allowed edit paths:** `docs/architecture/system-overview.md` (the route row and a binding rule); `packages/database/src/idempotency.ts` (export `isSecretKeyName`, the BL-108 pattern); `apps/app/src/lib/url-secrets.test.ts` (new); `technical/database/invariant-catalog.csv` (INV-104); `docs/BACKLOG.md` (BL-109 closed); `docs/STATUS.md`; this record and the index.
- **Read context:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/BACKLOG.md` BL-109; [DEV-019](DEV-019-invitation-token-at-rest.md) (S1-05); [DEV-023](DEV-023-idempotency-secret-guard.md) (the secret-name pattern); `apps/app/src/lib/external-link.ts` (`buildReviewLink`, INV-010).
- **Linked spec, ADR or earlier task:** BL-109; INV-010. No ADR: no scope change; the owner ruled the design correction.
- **Baseline:** `33ee859` (main after PR #104).
- **Dependencies / constraints / out of scope:** no database runs are needed (the test reads files). Out of scope: building the redemption page, BL-013 (the token is not bound to the email), the custom-scheme form of the link (v0.3).
- **Required acceptance criteria:**
  1. `docs/architecture/system-overview.md` no longer lists `invite/{token}`: the row is `invite#<token>`, with the fragment-and-POST contract, and a binding rule forbids a bearer secret in a path segment or a query string for every route in that table.
  2. `apps/app/src/lib/url-secrets.test.ts` refuses a dynamic route segment or a literal `searchParams.get(…)` whose name matches the BL-108 secret-name pattern, passes on the current tree, and turns red on a mutation that adds `invite/[token]` or a `searchParams.get("token")`.
  3. INV-104, BL-109 and STATUS agree; `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  4. `pnpm turbo run typecheck` passes; the new test and the database package's guard test pass.
  5. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-architect`, `gp-mobile`, `gp-ui-reviewer` (see above).

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-19 | Start BL-109 (after #104 merged) | chat, «смержил, давай BL-109» |
| 2026-09-19 | Close BL-109 by correcting the design and adding a guard; do not build the page | chat, answer «Исправить дизайн + guard» |

## Plan

1. The static test, and its red by mutation (no route violates the rule today).
2. The route row and the rule in `system-overview.md`; `isSecretKeyName` exported.
3. INV-104, BL-109, STATUS; typecheck; validators.
4. `gp-reviewer` + `gp-security` → stated fixes → `gp-qa`.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoping (coordinator) on `33ee859` | `invite/{token}` appears only in `system-overview.md:307` (the «Approved target» table of field-client link routes) and in BL-109; no page, no `apps/mobile` handler. Dynamic segments under `apps/app/app`: all ids (`[assignmentId]`, `[invitationId]`, …). Literal `searchParams.get` reads: `assignee`, `limit`, `cursor`, `evidenceObjectId`; the login page reads `next`. None is secret-shaped, so the guard passes today and its red is proven by mutation | coordinator's grep | Test |
