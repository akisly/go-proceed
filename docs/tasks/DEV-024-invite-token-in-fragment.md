# DEV-024 — BL-109: the invitation link carries its token in the fragment, never the path

## Assignment

- **Objective and user-visible outcome:** the approved field-client route table stops prescribing `invite/{token}` — a bearer token in a URL path, which reaches access logs, `Referer` headers and analytics and which a link prefetch could consume. The invitation link becomes `invite#<token>`: the token rides in the fragment, which no browser sends, and the page exchanges it by POST after sign-in, as the external review link does (INV-010). A static test keeps any route in `apps/app` from taking a secret-shaped name from its path or its query string. The redemption page itself is not built.
- **State:** reviewing
- **Coordinator:** primary Claude Code session, 2026-09-19.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** a correction to an approved architecture document plus a static guard (executed test code, so a behavior change): coordinator → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:** `gp-security` — the delivery of a bearer credential (BL-109 came from DEV-019's `gp-security`). `gp-architect` is not triggered: no migration, RLS, `/v1` contract or catalog of states changes; the route table is a design document and the owner ruled the shape. `gp-mobile` is not triggered: `apps/mobile` routes no invitation link (grep), and the custom scheme is v0.3. `gp-ui-reviewer`: no UI is built.
- **Owning module and allowed edit paths:** `docs/architecture/system-overview.md` (the route row, a binding rule and «The invitation link»); `apps/app/src/lib/url-secrets.test.ts` (new); `technical/database/invariant-catalog.csv` (INV-104); `docs/BACKLOG.md` (BL-109 closed); `docs/STATUS.md`; this record and the index.
- **Read context:** root `AGENTS.md`; `agents/COORDINATION.md`; `docs/BACKLOG.md` BL-109; [DEV-019](DEV-019-invitation-token-at-rest.md) (S1-05); [DEV-023](DEV-023-idempotency-secret-guard.md) (the secret-name pattern); `apps/app/src/lib/external-link.ts` (`buildReviewLink`, INV-010).
- **Linked spec, ADR or earlier task:** BL-109; INV-010. No ADR: no scope change; the owner ruled the design correction.
- **Baseline:** `33ee859` (main after PR #104).
- **Dependencies / constraints / out of scope:** no database runs are needed (the test reads files). Out of scope: building the redemption page, BL-013 (the token is not bound to the email), the custom-scheme form of the link (v0.3).
- **Required acceptance criteria:**
  1. `docs/architecture/system-overview.md` no longer lists `invite/{token}`: the row is `invite#<token>`, a section «The invitation link» sets the page's contract, and a binding rule forbids a bearer secret in a path segment or a query string of any link this app mints for its own origin, naming the third-party links outside it (amended after review: R1-01, R1-02, S1-01, S1-02).
  2. `apps/app/src/lib/url-secrets.test.ts` holds every dynamic route segment to an id-shaped name and every query-string read to an allowlist, passes on the current tree, and turns red on mutations that add `invite/[token]`, `invite/[code]`, a page destructuring `{ token }` from `searchParams`, or a `searchParams?.get("token")` (amended after review: S1-03, R1-04; first written as a block list of secret-shaped names).
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
| 2 | implementing (coordinator): the guard, its red, the design | `apps/app/src/lib/url-secrets.test.ts` walks `apps/app/app` and `apps/app/src`: a dynamic segment (`[x]`, `[...x]`, `[[...x]]`) or a literal `searchParams.get("x")` whose name is secret-shaped by the BL-108 rule (`isSecretKeyName`, now exported from `@goproceed/database`) is refused. On the tree: 3 passed. **Red by mutation**, since nothing violates it today: an `app/invite/[token]/page.tsx` → red naming `app/invite/[token]`; a `searchParams.get("token")` in the communications route → red naming that read; both restored, tree clean. `system-overview.md`: the row is `invite#<token>` with the fragment-and-POST contract, and a new binding rule forbids a bearer secret in a path segment or a query string (and in the future custom-scheme form). INV-104; BL-109 closed; STATUS | `scratchpad/dev024-mutation-segment.txt`, `dev024-mutation-query.txt`; the implementation commit | Runs |
| 3 | implementing (coordinator): runs on `c429ace` | `pnpm turbo run typecheck --force` 10/10; validators rc 0; `url-secrets` + `idempotency-call-sites` 7; the database guard + authorize tests 25 (the export changes nothing else) | `scratchpad/dev024-*.txt` | `gp-reviewer`, `gp-security` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

- **The invitation redemption page does not exist.** An invitation token today reaches the invitee only as the `token` field of the create response, which the admin passes on by hand; nothing builds an `invite#<token>` link yet.
- **The guard is a text reading**: a dynamic `searchParams.get(name)`, a path parsed by hand from `new URL(...).pathname`, or a query read under an allowlisted name carrying a secret passes it; a new query name or a non-id segment fails it until someone adds it to the allowlist deliberately.
- **The invitee must already have an Auth user** (S1-05): sign-in is OTP with `shouldCreateUser: false`; letting the invite page create one is an auth change for `gp-architect` and `gp-security`.
- **Third-party links still carry secrets in their query** by the vendor's design (the Telegram deep link, Storage signed URLs, the Auth confirmation URL — BL-115); INV-104 names them as outside it.
- **`apps/mobile` is not checked**; it routes no invitation link today.
- **The token is still not bound to the invited email** (BL-013).
- **No database test ran**: the change is a document and a static test. Nothing ran in CI.

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

- Next.js 16.3.1 dynamic route segments (`[x]`, `[...x]`, `[[...x]]`) — `apps/app/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`; accessed 2026-09-19.
- RFC 9110 (HTTP Semantics), §7.1 «The target URI excludes the reference's fragment component» and §10.1.3 (a user agent MUST NOT include the fragment in `Referer`); §17.11 notes a fragment can be carried across a redirect on the client — https://www.rfc-editor.org/rfc/rfc9110.txt; accessed 2026-09-19. The rule `apps/app/src/lib/external-link.ts` already relies on.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
