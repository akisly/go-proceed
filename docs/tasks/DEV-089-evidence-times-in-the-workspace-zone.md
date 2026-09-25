# DEV-089 — BL-034: the evidence screen formats times in the workspace's own zone

## Assignment

- **Objective and user-visible outcome.** On `/assignments/{assignmentId}`, a photo's «Отримано сервером» time and a review link's «Діє до» deadline are shown in the assignment's workspace's zone (`organizations.timezone`), with the zone's label. Until now both were formatted in a hard-coded `Europe/Kyiv`: right while every workspace is in Kyiv, silently wrong the day one is not. For today's workspaces, all `Europe/Kyiv`, the screen shows the same text as before.
- **State:** reviewing
- **Coordinator:** Claude Code primary session, 2026-09-25.
- **Execution mode:** independent subagents for the stages root `AGENTS.md` requires, as native `gp-*` agent types.
- **Selected route and why** (`agents/COORDINATION.md`): a `/v1` response contract gains a field, so `gp-architect` → implementation → `gp-reviewer`, `gp-ui-reviewer` (the change touches `apps/app/app` and `apps/app/src/components`), `gp-security` (a short scoped pass: the route mints signed read URLs) → `gp-qa`.
- **Triggered stages:**
  - `gp-architect`: a `/v1` contract field.
  - `gp-reviewer` and `gp-qa`: always.
  - `gp-ui-reviewer`: `apps/app/app/(dash)/…/page.tsx` and `apps/app/src/components/evidence/`.
  - `gp-security`: on `gp-architect`'s recommendation, scoped to confirming the signing block and `cache-control: no-store` are unchanged. No RLS, grant, auth or storage-logic change.
  - `gp-mobile` and `gp-researcher`: not triggered. `apps/mobile` does not read this route; `Intl` behaviour is checked on the installed Node and Chromium.
- **Owning module and allowed edit paths:**
  - `packages/contracts/src/evidence.ts` (`assignmentEvidenceResponse.workspaceTimezone`);
  - `apps/app/app/v1/assignments/[assignmentId]/evidence/route.ts`;
  - `apps/app/app/(dash)/assignments/[assignmentId]/page.tsx`;
  - `apps/app/src/lib/workspace-time.ts` and its test (new);
  - `apps/app/src/components/evidence/{evidence-card,issue-review-link,evidence-by-occurrence}.tsx` and their tests; `issue-review-link.issued.test.tsx` (new);
  - `apps/app/tests/evidence-read.int.test.ts`;
  - `docs/BACKLOG.md` (BL-034, BL-206), this record, and `docs/tasks/README.md`.
- **Read context:** `supabase/migrations/0001_core_tenancy.sql` (`timezone text not null default 'Europe/Kyiv'`), `0004` (`org_select`), `0039` (no UPDATE); `packages/contracts/src/{workspaces,organizations,me-context}.ts`; `apps/app/src/lib/authz.ts`; `technical/copy-catalog.csv` row `dash.evidence.link_expiry`; `technical/openapi/scope-v0.1.csv:44`.
- **Linked spec, ADR or earlier task:** BL-034; Plan D slice D1 task 6 (the screen, and its fix round 1 that named the zone).
- **Baseline:** `f3a0660a`, which is `origin/main` `2c33404d` plus the DEV-088 closure (#173).
- **Dependencies, constraints and out of scope:**
  - The zone is returned verbatim and not validated; creation accepts any string, and correcting it is BL-206.
  - No visible notice when the stored zone is unknown to the runtime: the fallback's label shows the offset actually used (`gp-architect`; no copy-catalog row).
  - No migration, RLS, grant or catalog change: DA-002 already grants the BFF SELECT on `organizations`.
- **Required acceptance criteria** (`gp-architect`'s, numbered as it gave them):
  - AC-1: the contract carries a required `workspaceTimezone: z.string().min(1)`, and `.strict()` is kept.
  - AC-2: the route returns the stored value verbatim, read in the same tenant transaction after the capability check; zero rows answers 403 `MEMBERSHIP_INACTIVE`; signing and `cache-control: no-store` are unchanged.
  - AC-3: one formatter module; no `WORKSPACE_TIMEZONE_DEFAULT` left in the components; the client component imports nothing server-only.
  - AC-4: the fallback chain never throws, and the zone label is always shown.
  - AC-5: the unit and component tests pass, with `typecheck` and the app unit suite.
  - AC-6: the integration assertions — the stored default, a non-default and an unknown zone verbatim, a refusal with no zone — pass on CI, shown in the `verify` log.
  - AC-7: `pnpm validate:canonical-docs` passes; BL-034 closes on merge; BL-206 filed.
  - AC-8: the §5 gate and a §6 look.
- **Skipped stages and rationale:** see «Triggered stages».

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-25 | Take the next backlog item after DEV-088: BL-034, a P2 with no owner dependency | Coordinator, under the owner's standing order («мержи и давай дальше») |
| 2026-09-25 | No visible fallback notice (`gp-architect`'s recommendation; a reversible presentation default) | Coordinator; open to the owner |

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | gp-architect | The design holds with amendments: the field named `workspaceTimezone` (`technical/openapi.yaml` already describes a project `timezone` the schema lacks); no IANA refine (one bad stored value must not fail every photo's read); the zone read on its own after authorization, not joined into the assignment query, and zero rows is 403 `MEMBERSHIP_INACTIVE`, never a default; the fallback chain stored → `Europe/Kyiv` → `UTC`, since a browser with pre-2022b tzdata throws on `Europe/Kyiv`; `me-context` is the wrong home (actor-scoped, and the URL names no workspace). No ADR, migration, INV, error-catalog, OpenAPI or copy-catalog change; BL-206 filed | Subagent report (session) | Implement |
| 2 | Coordinator | **Implemented.** The contract field; the route's read and 403; `src/lib/workspace-time.ts` (no directive, no imports) with `formatWorkspaceTime(iso, zone)` and `workspaceTimeFormat(candidates)`; both components take a `timeZone` prop threaded from the page through `EvidenceByOccurrence`; both hard-coded constants and their «stand-in» comments are gone. Tests: 5 formatter cases; each component renders the zone it is handed (Warsaw); a jsdom test presses the review-link button, alone and through `EvidenceByOccurrence`, and reads the deadline in Warsaw; three integration assertions (row 1's AC-6). Evidence and formatter tests 33 of 33; app unit suite 542 passed, 1 skipped (the credential-gated `evidence-service.test.ts` case); `typecheck` 10/10 | Session output | Sweep |
| 3 | Coordinator | **Mutation sweep**, each restored by sha256: the formatter ignores the zone (6 failed); the chain ends at the stored zone instead of `UTC` (1 failed); the cards get Kyiv, not the zone (1 failed); the link's expiry uses Kyiv (2 failed); the screen hands the link Kyiv (1 failed) | Session output | Gate |
| 4 | Coordinator | **§5 gate** on the working tree at `f3a0660a`: step 1 skipped (`tokens.json` unchanged); step 2 `motion-audit: clean`; step 3 the fourteen DB-free `packages/testing` files 209/209 (the rest call the database, NOT RUN locally, CI runs them); step 4 `pnpm turbo run typecheck` 10/10; step 5 `pnpm --filter @goproceed/landing build` exit 0. Also `apps/app` `pnpm build` exit 0 | `scratchpad/dev089-gate.log` | §6 |
| 5 | Coordinator | **§6 on a fixture**: `EvidenceByOccurrence` rendered with `renderToStaticMarkup` (two photos on an occurrence, one unbound; 22 Aug 09:30Z, 15 Jan 09:30Z, 25 Oct 00:30Z — the EU fall-back day) in Warsaw, Kyiv and `Not/AZone`, inside the built app's CSS, measured with puppeteer at 1920, 1440, 1240, 768 (fine pointer), 390 and 360 (touch). Warsaw: «11:30 GMT+2», «10:30 GMT+1», «02:30 GMT+2»; Kyiv: «12:30 GMT+3», «11:30 GMT+2», «03:30 GMT+3»; the unknown zone renders Kyiv's, labelled. 12px `tabular-nums`; no horizontal scroll and no clipped time at any width; at 360 the time wraps inside its cell. The fixture test file was deleted after the run | `scratchpad/dev089/measure.txt`, `warsaw-1440.png`, `warsaw-360.png` | Reviews |
| 6 | gp-ui-reviewer | PASS, no blocker or major. No class, token, layout or copy change; `workspace-time.ts` has no directive and no imports, so the client bundle gains nothing; copy row `dash.evidence.link_expiry` («rendered in the workspace timezone with the zone shown») is now literally true. U1–U3 (below) | Subagent report (session) | U1 |
| 7 | gp-security | PASS (scoped). The signing block, storage IO outside the transaction and `cache-control: no-store` are unchanged; the zone read follows authorization and `org_select` admits only the actor's own workspace; the zero-row 403 is byte-for-byte `requireActiveMembership`'s; a hostile stored zone reaches only `Intl.DateTimeFormat` inside a try/catch, never the screen as text, and cannot fail the read. S1 (below) | Subagent report (session) | — |
| 8 | Coordinator | U1: the issued block captured. `EvidenceByOccurrence` rendered in jsdom, the button pressed with the service mocked, and the resulting markup measured in the built CSS at the six widths. Warsaw «Діє до 2 жовт. 2026 р., 23:30 GMT+2.», Kyiv «Діє до 3 жовт. 2026 р., 00:30 GMT+3.» — the same instant on a different date; 12px, 680px (`max-w-measure`) at the desk, 308/278px at 390/360; no horizontal scroll or overflowing element at any width. The fixture test file was deleted after the run. U2 added to «What is not true»; S1 added to BL-206 | `scratchpad/dev089/measure-issued.txt`, `issued-warsaw-1440.png`, `issued-warsaw-360.png` | gp-reviewer |
| 9 | gp-reviewer | PASS WITH FINDINGS, no blocker or major. Tenant isolation holds (the read follows authorization; `org_select` is `requireActiveMembership`'s predicate, so zero rows is a revoke); one producer and one runtime consumer of the contract, none in `apps/mobile`, `packages/*` or `qa/field.mjs`; no catalog drift; the integration assertions should pass as written (the admin `q()` UPDATE of organizations already runs in four suites; no trigger on the table; `beforeEach` truncates). R1–R7 (below) | Subagent report (session) | Fixes |
| 10 | Coordinator | R1: a malformed instant is returned as given. R2: `Europe/Kiev` follows the default before UTC (`WORKSPACE_TIMEZONE_FALLBACKS`). R3: the test comment names the creation default. R6: `membershipInactive(requestId)` exported from `authz.ts` and used by `requireActiveMembership` and the route. Mutations: the NaN guard dropped (1 failed), the old name dropped (1 failed); restored. `src/lib` + evidence tests 479 passed, 1 skipped; `typecheck` 10/10 | Session output | gp-qa |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| U1 | minor | The issued block's deadline | Not seen at any width: `renderToStaticMarkup` cannot reach the issued state | Coordinator | Fixed: captured and measured (row 8) |
| U2 | minor | `workspace-time.ts` | An unknown zone reads as a real Kyiv workspace; a zone Node knows and an old browser does not puts the cards and the deadline in different zones, both labelled | — | Recorded in «What is not true» |
| U3 | optional | `evidence-card.tsx`, the receipt time at 360 | The zone label can wrap apart from the time, as it did with Kyiv strings | — | Not taken: pre-existing, out of scope |
| R1 | nit | `workspace-time.ts` | A malformed date throws where `toLocaleString` printed «Invalid Date» | Coordinator | Fixed: returned as given; a test |
| R2 | nit | the fallback chain | A pre-2022b browser shows a Kyiv workspace's deadline in UTC | Coordinator | Fixed: `Europe/Kiev` before UTC; a test |
| R3 | nit | `evidence-read.int.test.ts` | «the column default» | Coordinator | Fixed: «the creation default» |
| R4 | info | the refusal's no-zone assertion | Vacuous: the 404 precedes the zone read | — | Recorded; the zero-row 403 stays untested («What is not true») |
| R5 | info | `workspaceTimezone.min(1)` | `''` would fail the read | — | Same as S1: BL-206 |
| R6 | nit | `route.ts`, the zero-row 403 | The problem body duplicated from `authz.ts` | Coordinator | Fixed: `membershipInactive()` |
| R7 | nit | one formatter per card | Negligible at pilot volume | — | No action |
| S1 | low | `organizations.timezone` = `''` | An empty stored zone would fail `min(1)` and the whole read; unreachable through the product (both creation paths refuse it, `0039`) | — | Recorded in BL-206 |

Rework count and hypothesis changes: none.

## What is not true after this task

- A workspace whose stored zone the runtime does not know is shown in Kyiv (or UTC), labelled — not in its own zone. Creation accepts any string and nothing corrects it: BL-206.
- The zero-row 403 (a membership revoked between the authorization and the zone read) is argued from `org_select` and READ COMMITTED, not driven by a test: a deterministic interleaving needs two connections.
- An assignment with no evidence renders the empty state and no times, so its zone is returned but not shown; the route reads it unconditionally.
- An unknown stored zone reads, labelled «GMT+3», exactly as a real Kyiv workspace does: the reader cannot tell it is not their zone (gp-ui-reviewer U2; the owner may later want it visible, a copy-catalog row on the `gp-architect` route). The receipt times format on the server (Node's ICU) and the deadline in the viewer's browser (its tzdata): a zone one knows and the other does not would put them in different zones on one screen, each labelled.
- Only this screen follows the workspace's zone. Other office and field surfaces that format a time are not audited here.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| AC-1 the contract field | Yes | | | | |
| AC-2 the route's read, 403, signing unchanged | Yes | | | | |
| AC-3 one formatter module | Yes | | | | |
| AC-4 the fallback never throws, the label shown | Yes | | | | |
| AC-5 unit, component, typecheck | Yes | | | | |
| AC-6 the integration assertions on CI | Yes | | | | |
| AC-7 docs valid, BL-034, BL-206 | Yes | | | | |
| AC-8 §5 gate and §6 | Yes | | | | |

## Sources

- Node 22.22.2 (`node --version`) and the bundled Chromium: `Intl.DateTimeFormat` with `timeZone` and `timeZoneName: "short"`, observed in the tests and the §6 fixture.
- `apps/app/node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md:50` (a string prop crosses the client boundary), cited by `gp-architect`.
- ECMA-402's requirement that every implementation accept "UTC" is from `gp-architect`'s knowledge of the spec, not fetched; the formatter test observes it on the installed Node.

## Completion / handoff

- **Changed / inspected files:** see «Owning module».
- **Review independence:** every stage runs as an independent native subagent.
- **Verified scope:** rows 1–10.
- **Remaining risks / blocked requirements:** «What is not true after this task».
- **Next bounded action and owner:** `gp-qa`.
- **Final state and reason:** reviewing.
