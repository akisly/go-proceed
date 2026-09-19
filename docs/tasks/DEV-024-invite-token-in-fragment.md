# DEV-024 — BL-109: the invitation link carries its token in the fragment, never the path

## Assignment

- **Objective and user-visible outcome:** the approved field-client route table stops prescribing `invite/{token}` — a bearer token in a URL path, which reaches access logs, `Referer` headers and analytics and which a link prefetch could consume. The invitation link becomes `invite#<token>`: the token rides in the fragment, which no browser sends, and the page exchanges it by POST after sign-in, as the external review link does (INV-010). A static test keeps any route in `apps/app` from taking a secret-shaped name from its path or its query string. The redemption page itself is not built.
- **State:** done
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
| 4 | reviewing (`gp-reviewer`, `gp-security`, native) on `b85cbba` | **`gp-reviewer`: CHANGES REQUESTED** — R1-01 major: INV-104 and the rule, unscoped, are false: Telegram deep links (`?start=`), Storage signed URLs (`?token=`) and the Auth confirmation URL carry bearer secrets in their query by design, and INV-102 names them; R1-02 medium: the proxy redirects a signed-out `/invite` to `/login?next=%2Finvite`, the token is lost after sign-in, and the obvious repair puts it in `next`; R1-03 medium: the custom-scheme sentence committed a v0.3 design; R1-04 low: the query check missed `?.get`, `useSearchParams`, page-prop destructuring; R1-05 low: INV-104 cited the wrong file for the external link; R1-06 nits. **`gp-security`: HOLD** — S1-01 medium (= R1-02, with the carriage the page must use: strip first, never `next`/URL/cookie/durable storage, sign in on the page or `sessionStorage`), S1-02 medium (= R1-01, and the prefetch clause overstated), S1-03 low (a block list passes `[code]`, `?invite=`: use an allowlist), S1-04 low (no third-party script, no referrer), S1-05 info (the invitee needs an existing Auth user) | review reports | Stated fixes |
| 5 | rework (coordinator), stated fixes | **The rule and INV-104 scoped** to links this app mints for its own origin, the third-party ones named as outside it with reasons; the prefetch clause restated (this origin never receives the token; a GET consumes nothing); citations corrected (`tenancy-and-security.md`, `external-link.ts`). **A section «The invitation link»** in `system-overview.md` — the page's contract: strip the fragment with `history.replaceState` before any request; never into `next`, a URL, a cookie, `localStorage` or IndexedDB; excluded from the proxy's sign-in redirect and sign in on the page (the `sessionStorage` fallback later removed, S2-01); no third-party script, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`; an existing Auth user; its evidence when built. **The custom-scheme sentence removed**, left to v0.3 and `gp-mobile`. **The guard is an allowlist**: segments must be `…Id`/`…No`, query reads (`searchParams.get`, `?.get`, `useSearchParams`, `URLSearchParams`, destructured or named `await searchParams`) must be `assignee`, `limit`, `cursor`, `evidenceObjectId` or `next`; `isSecretKeyName` is no longer exported (`packages/` is untouched by the task). **Four mutations**, each red naming its site, restored: `invite/[token]`, `invite/[code]`, a page destructuring `{ token }` from `searchParams`, a `searchParams?.get("token")`. **BL-114** (build the page to the contract) and **BL-115** (a prefetching mail scanner and the OTP, unverified) filed; «What is not true» gains S1-05 and the third-party links. **Runs on `c26abe5`**: typecheck 10/10, validators, url-secrets + call sites 7, the database guard 21 | `scratchpad/dev024-r2-*.txt` | `gp-security` re-check; `gp-qa` |
| 6 | reviewing (`gp-security` re-check, native) on `3768149` | **PASS** — S1-01 and S1-02 CLOSED, S1-03 to S1-05 addressed; the contract's claims about `proxy.ts` and `safeNext` confirmed. New: S2-01 low (the `sessionStorage` fallback kept the token past an abandoned sign-in and on disk for session restore — remove it), S2-02 low (the guard missed `use(searchParams)`, `(await searchParams).x`, `getAll`/`has`, `Object.fromEntries`), S2-03 nit («before any network request» cannot be met literally; say why the proxy exclusion exists), S2-04 info (enforce «no third-party script» with a nonce CSP; exclude by a pathname check) | re-check report | Stated fixes |
| 7 | rework (coordinator), stated fixes | S2-01: the fallback removed — the token never leaves the page's memory, `sessionStorage` named as forbidden. S2-02: the guard reads `getAll`/`has`, `Object.fromEntries(searchParams)` (as «every name»), and the `use(searchParams)` and inline `(await …searchParams).x` forms; the fixture gains each; a page mutation using `use(searchParams)` turns it red naming `token`. S2-03: the strip «before its own code makes any request or renders any link»; the exclusion's reason (the fragment carried onto `/login` by the redirect) and «by a pathname check in the proxy's body». S2-04: in BL-114. Runs after this row is written | `scratchpad/dev024-r3-*.txt` | `gp-qa` |
| 8 | verifying (`gp-qa`, native) on `f38642a` | **Verified for the scoped criteria:** 1–4 PASS, 5 NOT RUN (not required). Its own runs: url-secrets + call sites 7; the database guard 21; turbo typecheck 10/10; validators; `git diff 33ee859 f38642a -- packages/` empty. Nine mutations each red naming its site (routes `[token]`, `[code]`, `[...inviteLinks]`; the page prop destructured, `use()`d and inline; `?.get`, `getAll`; `Object.fromEntries`); the guard's positive control finds exactly the five allowlisted reads. The contract's claims checked against `proxy.ts`, `safe-next.ts`, `externalSecurityHeaders`, `otp-form.tsx` and Next 16.3.1's CSP guide. Every stated fix in place. New: Q1-01 low (read forms the guard misses, unlisted), Q1-02 info (the PKCE verify link lands on this origin with `?code=`), Q1-03 to Q1-05 nits (INV-104 and BL-109 described the round-2 guard; STATUS omitted BL-114/115; «step 1» and §10.2.2), Q1-06 info (a raw NUL byte in `external-link.ts` since `54f1fe3` makes plain `grep` skip it — pre-existing) | QA report; `scratchpad/dev024-qa-*.txt` | Closing |
| 9 | closing (coordinator), documentation only | Q1-01: the missed forms in «What is not true». Q1-02: BL-115 names the PKCE landing. Q1-03: INV-104's enforcement and evidence and BL-109's text describe the final guard. Q1-04: STATUS item 3 lists BL-114 and BL-115. Q1-05: «as the review shell does»; §10.2.2 in Sources. Q1-06: recorded here; `grep -a` reads the file. No code changed after QA | `scratchpad/dev024-close-canonical-docs.txt` | Push, PR |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| Q1-01 | low | the guard | Actual: some read forms unlisted | coordinator | «What is not true» (row 9) |
| Q1-02 | info | BL-115 | Actual: the PKCE landing on this origin unstated | coordinator | BL-115 (row 9) |
| Q1-03 | nit | INV-104, BL-109 | Actual: described the round-2 guard | coordinator | Updated (row 9) |
| Q1-04 | nit | STATUS item 3 | Actual: BL-114, BL-115 missing | coordinator | Added (row 9) |
| Q1-05 | nit | «step 1»; Sources | Actual: no numbered step; §10.2.2 uncited | coordinator | Reworded; cited (row 9) |
| Q1-06 | info | `external-link.ts` | A raw NUL byte (pre-existing) | coordinator | Recorded; out of scope |
| S2-01 | low | the `sessionStorage` fallback | Actual: the token outlived an abandoned sign-in | coordinator | Removed (row 7) |
| S2-02 | low | the guard's read forms | Actual: `use()`, inline, `getAll`/`has`, `fromEntries` missed | coordinator | Read (row 7) |
| S2-03 | nit | the strip's wording; the exclusion's reason | Actual: unmeetable literally; reason unstated | coordinator | Reworded (row 7) |
| S2-04 | info | script enforcement | Actual: unenforced when built | coordinator | BL-114 |
| R1-01 / S1-02 | major / medium | INV-104, the rule | Actual: unscoped and false (third-party links carry query secrets) | coordinator | Scoped, exceptions named, prefetch clause restated (row 5) |
| R1-02 / S1-01 | medium | the invite row | Actual: silent on carrying the token across sign-in | coordinator | «The invitation link» contract (row 5) |
| R1-03 | medium | the custom-scheme sentence | Actual: committed a v0.3 design | coordinator | Removed; left to v0.3 and `gp-mobile` (row 5) |
| R1-04 / S1-03 | low | the guard | Actual: missed read forms; a block list passes innocent names | coordinator | Allowlist over every common read form (row 5) |
| R1-05 | low | INV-104 citation | Actual: wrong file for the external link | coordinator | Corrected (row 5) |
| R1-06 | nit | list spacing; test comment; legacy spec | Actual: loose list; `[[...x]]` unstated; legacy `/invite/:token` | coordinator | Spacing and comment fixed; the legacy spec left as a record |
| S1-04 | low | the page | Actual: script and referrer exposure unconstrained | coordinator | In the contract (row 5) |
| S1-05 | info | sign-in | Actual: the invitee needs an Auth user | coordinator | Contract and «What is not true» |

Rework count and hypothesis changes: none counted — no QA FAIL; the HOLD was resolved before QA.

## What is not true after this task

- **The invitation redemption page does not exist.** An invitation token today reaches the invitee only as the `token` field of the create response, which the admin passes on by hand; nothing builds an `invite#<token>` link yet.
- **The guard is a text reading**: a dynamic `searchParams.get(name)`, a path parsed by hand from `new URL(...).pathname`, a query read under an allowlisted name carrying a secret, and these forms pass it (Q1-01): `request.nextUrl.searchParams` or `useSearchParams()` held in a `let` or a renamed destructure, iteration (`for … of`, `.entries()`, `.forEach()`, `.toString()`), and `searchParams.then(…)`; a new query name or a non-id segment fails it until someone adds it to the allowlist deliberately.
- **The invitee must already have an Auth user** (S1-05): sign-in is OTP with `shouldCreateUser: false`; letting the invite page create one is an auth change for `gp-architect` and `gp-security`.
- **Third-party links still carry secrets in their query** by the vendor's design (the Telegram deep link, Storage signed URLs, the Auth confirmation URL — BL-115); INV-104 names them as outside it.
- **`apps/mobile` is not checked**; it routes no invitation link today.
- **The token is still not bound to the invited email** (BL-013).
- **No database test ran**: the change is a document and a static test. Nothing ran in CI.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. The route row, the scoped rule and «The invitation link» | yes | `f38642a` + row 9 | `gp-qa`'s reading against `proxy.ts`, `safe-next.ts`, `external-link.ts`, `otp-form.tsx`, the Telegram routes, `evidence-storage.ts`, `magic_link.html`, Next 16.3.1's CSP guide and RFC 9110 | PASS | the page is not built: a design reading, not runtime evidence (BL-114) |
| 2. The allowlist guard passes the tree and turns red on the mutations | yes | `f38642a` | `dev024-*mutation*.txt` (the coordinator's six) and `gp-qa`'s nine, each naming its site; `dev024-r3-url-secrets.txt` and `gp-qa`'s run (7) | PASS | a text reading: the forms in «What is not true» pass it |
| 3. INV-104, BL-109, STATUS; validators | yes | `f38642a` + row 9 | `gp-qa`'s reading and runs; `dev024-close-canonical-docs.txt` | PASS | Q1-03, Q1-04 fixed after QA (text only) |
| 4. `pnpm turbo run typecheck`; the tests | yes | `f38642a` | `dev024-r3-typecheck-all.txt`, `gp-qa`'s `--force` run (10/10); url-secrets 7; the database guard 21; `packages/` unchanged | PASS | — |
| 5. CI `verify` on the PR head | no | — | — | NOT RUN | environmental: GitHub Actions starts no jobs until October 2026; settled by CI `verify` on the PR head |

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

The Limitation column opens with at most one qualifier from this closed set, then its detail:

- **PASS:** `negative` (the command correctly produced nothing, and the absence is the evidence); `assisted:` what had to be arranged by hand first; `owner-reported` (the owner's report, not a session observation).
- **FAIL:** `known-red baseline:` the named set of pre-existing failures, with no case outside it failing.
- **NOT RUN:** `environmental:` the cause and the command that settles it; `not-provable-locally:` what would settle it; or, with no qualifier, the reason: why it was deliberately not attempted, or why a PASS was earned for the wrong reason (`agents/roles/gp-qa.md`).

Gate records written before 2026-09-13 keep their own tokens; `docs/delivery/pilot-execution-runbook.md` §7.4 maps them onto this set.

## Sources

Third-party documentation and primary sources checked for this task. Give each one its URL, the installed version it applies to, its publication date if known (never substitute today's date) and the access date.

- Next.js 16.3.1 dynamic route segments (`[x]`, `[...x]`, `[[...x]]`) — `apps/app/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`; accessed 2026-09-19.
- RFC 9110 (HTTP Semantics), §7.1 «The target URI excludes the reference's fragment component», §10.1.3 (a user agent MUST NOT include the fragment in `Referer`), §10.2.2 (a `Location` without a fragment inherits the original's — why a redirect carries it onto `/login`) and §17.11 — https://www.rfc-editor.org/rfc/rfc9110.txt; accessed 2026-09-19. The rule `apps/app/src/lib/external-link.ts` already relies on.

## Completion / handoff

- Changed / inspected files: see «Owning module and allowed edit paths», plus BL-114 and BL-115; commits `c429ace` (implementation), `c26abe5` (review round 1), `f38642a` (security re-check), the record commits and the closing commit.
- Review independence: independent — `gp-reviewer` (CHANGES REQUESTED, fixed), `gp-security` (HOLD, then PASS on re-check), `gp-qa` on `f38642a`, all native subagents. No rework round was counted.
- Verified scope: criteria 1–4 PASS; criterion 5 NOT RUN, not required.
- Remaining risks / blocked requirements: «What is not true» above; BL-114 (the page, built to the contract), BL-115, BL-013.
- Next bounded action and owner: owner — review and merge the PR.
- Final state and reason: done — every required criterion PASS; every finding fixed or recorded with its reason.
