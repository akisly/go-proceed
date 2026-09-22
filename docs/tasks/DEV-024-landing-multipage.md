# DEV-024 — The landing becomes a short home page and three sub-pages

## Assignment

- Objective and user-visible outcome: `apps/landing` stops being one long page. `/` answers «what is it» and «why buy» in six blocks; `/product`, `/roles` and `/pilot` each carry one job. The pilot form lives on `/pilot` only. Every header and footer link is a page link.
- State: verifying
- Coordinator: primary Claude Code session (worktree `vigorous-elbakyan-0f49e5`, branch `claude/landing-page-structure-plan-705112`)
- Execution mode: independent subagents for the stages root `AGENTS.md` requires
- Selected route and why (`agents/COORDINATION.md`): UI change on the `docs/design/02-building-ui.md` route — the change is confined to `apps/landing` and the design documents that describe it.
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: `gp-ui-reviewer` (`apps/landing`); `gp-reviewer` and `gp-qa` always. `gp-security` is not triggered: `/api/pilot`, the form's validation and delivery, and every `.env*` are untouched.
- Owning module and allowed edit paths: `apps/landing/**`; `packages/ui/src/components/FeatureGrid.tsx` and `Stepper.tsx` (added in rework for R-02: one optional `titleAs` prop each, default unchanged); `DESIGN.md` §Navigation; `docs/design/02-building-ui.md` (the «fourteen landing blocks» line); `docs/design/03-ui-references.md` (the reference's licence row); `docs/BACKLOG.md` (BL-082 note); `docs/STATUS.md` (Landing row); this record and `docs/tasks/README.md`.
- Read context and applicable local instructions: root `AGENTS.md`, `apps/landing/AGENTS.md`, `docs/design/02-building-ui.md`, `DESIGN.md`, `PRODUCT.md`, `docs/product/vision-and-positioning.md` §«Evidence and claim discipline», ADR-007 decision 6, ADR-011.
- Linked spec (`docs/specs/…`), ADR or earlier task: `docs/superpowers/specs/2026-09-05-landing-daylight-design.md` and its 2026-09-06 parity spec (frozen archive; §3 «One page» is superseded by this record's «Information architecture»); DEV-007 (the 2026-09-14 reference decision); BL-082.
- Baseline: `1f65fef`
- Dependencies / constraints / out of scope: no token change; no new motion primitive; no new `@goproceed/ui` component (rework R-02 added an optional `titleAs` prop to `FeatureCell` and `Step`; their default output is unchanged); the blocks keep their Daylight composition. BL-082's questions (a)–(e) — first-screen grid, ground, typography, closeness of match, replacement loops — stay open: this task takes from the reference only its block *types* (product-scene hero, alternating feature scenes, a bridge section, a closing offer), not its visual treatment.
- Required acceptance criteria:
  1. `/`, `/product`, `/roles`, `/pilot` build as static routes, each with exactly one `<h1>`, the skip link, the shared header and footer.
  2. `/` renders six blocks in this order: hero, sources, problem, scenes, position, offer — and no form.
  3. The pilot form renders on `/pilot` only, unchanged in fields, validation and submit path.
  4. Header and footer links resolve to the four pages; the current page is marked `aria-current="page"`; the phone strip is reachable by assistive technology.
  5. Each page has its own title, description and canonical; the sitemap lists the four URLs; FAQ structured data is emitted on `/pilot`, where the answers are visible.
  6. The forbidden-claim tests pass over all copy; no copy states a send queue or capture without a network (ADR-007 decision 6).
  7. §5 gate of `02-building-ui.md` and the landing's own tests pass; the QA harness passes over the four routes at seven widths and under reduced motion.
- Skipped stages and rationale: none. `gp-security` is not triggered (see above).

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-18 | The landing should not be long; split it into pages; the home page must be attractive and give the main idea — what this is and why buy it. | Owner's request in this session |
| 2026-09-18 | Four pages: home, «Як працює», «Для кого», «Пілот». | Owner's answer to the coordinator's question |
| 2026-09-18 | The home page speaks first to the owner / commercial director. | Same |
| 2026-09-18 | The pilot form lives on `/pilot` only. | Same |
| 2026-09-19 | The plan (site map, six home blocks, sub-page compositions, order of work) approved. | Plan approval in this session |

## Information architecture

| Route | Menu label | Job | Blocks, in order |
|---|---|---|---|
| `/` | (brand) | What it is, why buy, where to click | Hero → Sources → Problem (Рис. 01) → Scenes (three product scenes) → Position → Offer |
| `/product` | «Як працює» | The route is real | Route (h1, five-card stack) → Capture → Provenance `#trust` → Offer |
| `/roles` | «Для кого» | Each role sees its pain and what it gets | Roles (h1, owner first) + role facts → Compare → Offer |
| `/pilot` | «Пілот» | Remove the risk, take the request | Pilot (h1, stepper, boxes, form) → FAQ |

Slugs are English and short; labels are Ukrainian. The header's ink button «Обговорити пілот» links to `/pilot` on every page.

What sells, given that there are no customers, testimonials, logos or prices to show: the product itself as the hero, the regulatory sources in place of a logo strip, the stated limits of v0.1 as the trust argument, and a pilot that costs nothing.

## Plan

1. Documents first (BL-082): this record; `DESIGN.md` §Navigation; `02-building-ui.md` code map line; `03-ui-references.md` licence note. Check: `pnpm validate:canonical-docs`.
2. Content: `content/landing-content.ts` — page-path nav, `scenes`, `pages` (per-page title/description), offer copy, role order, the send-queue wording removed; `content/demo-records.ts` app channel row. Check: `tests/landing-content.test.ts`.
3. Shell and routes: `components/site-shell.tsx`; `app/page.tsx`, `app/product/page.tsx`, `app/roles/page.tsx`, `app/pilot/page.tsx`; heading level prop on `SectionHead`, `Roles`, `Route`, `Pilot`. Check: `tests/landing-render.test.tsx`.
4. Nav and footer as page links; `blocks/scenes.tsx`; `blocks/cta.tsx` as the offer. Check: render tests.
5. SEO: per-page metadata, four-URL sitemap, JSON-LD split by page. Check: `tests/metadata.test.ts`, `tests/seo-surface.test.ts`, `tests/structured-data.test.ts`.
6. QA harness over four routes. Check: `pnpm --filter @goproceed/landing qa`.
7. §5 gate, stages, acceptance evidence.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | coordinator | Flat content keys kept and two added (`scenes`, `pages`) rather than re-nesting the module by page: every block keeps its import and the diff stays reviewable. | `content/landing-content.ts` | — |
| 2 | coordinator | A shared `SiteShell` component rather than a route group layout: `/og` and `/kitchen-sink` need no shell, and the render tests keep rendering a whole page from one import. | `components/site-shell.tsx` | — |
| 3 | coordinator | The current page is passed to `Nav` as a prop by each page, so the header is a server component and needs no router hook. | `components/blocks/nav.tsx` | — |
| 4 | coordinator | The phone link strip stops being `aria-hidden`: the desktop row is `display: none` below `md`, so the strip was the only set of links a phone had and assistive technology was told it did not exist. It is now a second labelled `<nav>`; only one of the two is ever displayed. | `components/blocks/nav.tsx`; `tests/landing-render.test.tsx` «navigation reaches the pages on a phone» | — |
| 5 | coordinator | The send-queue wording («тримає чергу, поки немає мережі», «черга відправки», the mock's «очікує мережу») removed from the capture channel, the FAQ and the demo record. ADR-007 decision 6: the client «uploads immediately rather than presenting a durable local queue, and does not offer a queue affordance it cannot honour». A content test now refuses the stem «черг». | `content/landing-content.ts`, `content/demo-records.ts`, `tests/landing-content.test.ts` | — |
| 6 | coordinator | Section-rule numbers left the content module: each page numbers its own rules from 01, the copy keeps only the label. | `app/**/page.tsx` | — |
| 7 | coordinator | Sitemap content date is `2026-09-18`, the UTC date of the change: the test refuses a date ahead of the clock, and the local 19th was still the 18th in UTC. | `app/sitemap.ts` | — |
| 8 | coordinator | Worktree `node_modules` predated the `@goproceed/tokens` dependency (`apps/landing/node_modules/@goproceed/` held only `ui`), so `typecheck` failed on the untouched `layout.tsx`. `pnpm install --frozen-lockfile` fixed it; the lockfile is unchanged. | `git status` shows no lockfile change | — |
| 9 | coordinator | First QA harness run: all 36 page audits, the beam and parity ok; the new link check reported every link «not served» — the check's own defect (a repeated `page.goto` answers 304). Rewritten on `fetch`, verified by hand (8 hrefs, 0 broken), full harness re-run. | `qa/landing.mjs` `links()` | second run |
| 10 | gp-reviewer, gp-ui-reviewer | Started in parallel on the diff (base `1f65fef`), the pasted gate output and the harness screenshots. | — | findings |
| 11 | coordinator | Second harness run (link check on `fetch`): `landing qa: ok` — 36/36 page audits, links 8 checked / 0 broken, beam 742, parity ok. | `qa-output/report.json` of that run | — |
| 12 | gp-reviewer | No blocker; «can proceed to QA after the stated fixes». R-01 major, R-02–R-06 minor, R-07–R-08 notes. | «Findings and rework» | rework |
| 13 | gp-ui-reviewer | HOLD on U-01 (required); U-02 fix-or-defer; U-03–U-07 minor; U-08 note. Build-failure rules clean in the new code. | «Findings and rework» | rework |
| 14a | coordinator | Third harness run on the reworked tree: `landing qa: ok` — 36/36 audits, links 9 checked / 0 broken, beam 743, parity ok with `routeChange {scrolledBefore: 4854, scrollYAfter: 0}`. | `apps/landing/qa-output/report.json` (02:19) | — |
| 14b | gp-ui-reviewer (second pass) | PASS. U-01…U-07 and R-02 in place; no kitchen-sink entry needed for a tag-only prop with an unchanged default; U-09 and U-10 as non-blocking notes. | «What is not true»; BL-059 | — |
| 14c | gp-qa | No FAIL. Every finding's fix confirmed, R-01 with a counterfactual (attribute removed at runtime → `scrollYAfter120ms: 1724`). Criteria 1–6 PASS. Criterion 7: gate 3 NOT RUN (owner's database), harness coordinator-run and not QA-observed. One record contradiction (shared components) — corrected. | «Acceptance evidence» | owner's decision on gate 3 |
| 14 | coordinator | Rework limited to the stated fixes. Landing tests 22 files / 246; typecheck 10/10; motion-audit clean; eight static contract suites 143/143; third harness run for the re-shot screenshots. | this record's «Acceptance evidence» | gp-ui-reviewer re-check of U-01/U-02, then gp-qa |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| R-01 | major | `gp-reviewer` · `app/layout.tsx`, `app/globals.css` | A page change opens the next page at its top at once; with `scroll-behavior: smooth` and no `data-scroll-behavior` on `<html>`, Next 16 animates the viewport up through the new page. No check could see it: the harness only `goto`s. | coordinator | Fixed: `data-scroll-behavior="smooth"` on `<html>`. Confirmed against the installed docs (`version-16.md` §«Scroll Behavior Override»). Harness gains `routeChange`: foot of `/` → click a footer link → `scrollY === 0` 120 ms after the URL changes. |
| R-02 | minor | `gp-reviewer` · `route.tsx`, `FeatureGrid.tsx`, `Stepper.tsx`, `pilot-form.tsx` | Promoting a block's heading to `h1` left its cards, cells, steps and the form title at `h3`: h1 → h3 on all three sub-pages. | coordinator | Fixed: route cards derive their tag from `heading`; `FeatureCell`, `Step` and `PilotForm` take an optional `titleAs` (default `h3`). The scope line above is amended. `tests/landing-render.test.tsx` «the heading outline never skips a level», per page. |
| R-03 | minor | `gp-reviewer` · `content/landing-content.ts` `cta`, `share-link.tsx` | The copied sentence promised «і план пілота» before a link to `/roles#compare`; the failure text told the reader to copy the current page's address. No test read the copied URL. | coordinator | Fixed: both strings reworded; new `tests/share-link.test.tsx` asserts the clipboard receives `…/roles#compare` from another page. |
| R-04 | minor | `gp-reviewer` · `content/landing-jsonld.ts` | On sub-pages `WebPage.about` pointed at a node only the home page emitted, and the breadcrumb was an orphan. | coordinator | Fixed: sub-pages name the SoftwareApplication by the same `@id` (name and url only) and `WebPage.breadcrumb` references the list. `tests/structured-data.test.ts` resolves every `{"@id"}` inside its page's graph. |
| R-05 | minor | `gp-reviewer` · `tests/metadata.test.ts` | Only the factory was tested; a page asking for another page's key would pass. | coordinator | Fixed: the four page modules' `metadata` exports are asserted against `landingContent.pages[key]`. |
| R-06 | minor | `gp-reviewer` · this record | Two true limits were missing from «What is not true». | coordinator | Fixed: both added below. The hash-map redirect it offers as an alternative is not built (behaviour beyond a stated fix); it is left to the owner. |
| R-07 | note | `gp-reviewer` · `app/sitemap.ts` | `CONTENT_LAST_MODIFIED` reads `2026-09-18`; the plan was approved on the 19th local time. | coordinator | Not changed, with reason: `tests/seo-surface.test.ts` refuses a date ahead of the clock, and `date -u` during the work read 2026-09-18 (progress row 7). Whoever next edits the copy bumps it. |
| R-08 | note | `gp-reviewer` · `tests/landing-render.test.tsx` | The rewritten e-mail guard was more fragile than the one it replaced. | coordinator | Fixed: the original tag-only strip restored; the JSON-LD text stays inside the checked string. |
| U-01 | major (required) | `gp-ui-reviewer` · `scenes.tsx`; `home-390-04`, `home-768-03`, `reduced-home-390-04` | One `Reveal` around a whole scene row: below `wide` the row is ~1 000px tall and `Reveal` fires at 35 % in view, so the fold under the section head was blank paper — under reduced motion too. Confirmed by the coordinator on `home-390-04`. | coordinator | Fixed: two `Reveal`s per row (copy, media), the `wide:order-*` class on the `Reveal`. Render test «reveals the copy and the media of a scene separately». Re-shot by the third harness run. |
| U-02 | major | `gp-ui-reviewer` · `/pilot` below `wide`; `pilot-390-00…02` | The offer's «Заповнити запит на пілот» landed on the plan; on a phone the form is ~1 650px down. | coordinator | Fixed: `id="request"` on the form's wrapper, `cta.primaryHref = "/pilot#request"`. Block order unchanged. The harness link check resolves the fragment. |
| U-03 | minor | `gp-ui-reviewer` · `nav.tsx` on `/pilot` | The header's ink action linked to the page it was on. | coordinator | Fixed: on `/pilot` it links to `/pilot#request`. |
| U-04 | minor | `gp-ui-reviewer` · `scenes.tsx` title cap | Scene 3's title broke into five short lines at `18ch`. | coordinator | Fixed: `24ch`. |
| U-05 | minor (optional) | `gp-ui-reviewer` · `scenes.tsx` | Two accent phrases shared a fold with the section h2's. | coordinator | Fixed: scene titles are plain; `titleAccent` removed from the `Scene` type. |
| U-06 | minor (optional) | `gp-ui-reviewer` · `roles.tsx` facts strip | At `wide` the facts aligned with neither the cells' edge nor their text. | coordinator | Fixed: `wide:gap-x-0` and `wide:px-6`, the cells' own padding. |
| U-07 | minor (optional) | `gp-ui-reviewer` · `cta.tsx` | Green ticks on «безкоштовно …» used a status colour as ornament (Semantic Risk Rule). | coordinator | Fixed: the ink mark `position.tsx` already uses. |
| U-08 | note | `gp-ui-reviewer` · `nav.tsx` desktop links | ~36px tall between 768 and 1239 on a touch tablet; the classes pre-date this task. | — | Deferred: BL-059 (one line added). |

Rework count and hypothesis changes: 0 rounds (the first review does not count; no QA FAIL and no new blocker so far). No hypothesis changed.

## What is not true after this task

- **The block compositions this record describes were replaced the same day by [DEV-025](DEV-025-landing-parlo-rebuild.md).** Shown DEV-024's home page, the owner said the request had been the reference «1 в 1», not its block types. What stands from DEV-024: the four pages and their jobs, the form on `/pilot` only, page links and the phone strip, per-page metadata, sitemap and JSON-LD, the removed send-queue wording, review fixes R-01…R-08. What does not: the home page's block list (criterion 2), the `Scenes` rows, the light-card offer, `SectionRule` numbering.

- The landing is not rebuilt against `parlo-black.vercel.app`'s visual treatment. BL-082 stays open on its questions (a)–(e).
- No token or motion primitive changed, and no shared component was added. `FeatureCell` and `Step` in `packages/ui` gained an optional `titleAs` (rework R-02); their default output is unchanged.
- Nothing is deployed; the production alias is not verified to serve this tree.
- Every fragment URL the one-page site issued now opens the top of `/` with a dead fragment, and a fragment never reaches the server, so no redirect can cover it: `/#compare` (which «Скопіювати посилання для ПТВ» handed out), `/#pilot` (which the old JSON-LD `Offer.url` published), `/#roles`, `/#stages`, `/#capture`, `/#trust`, `/#faq`. A small client-side hash map on `/` would cover them; it is not built and is the owner's call (R-06).
- The harness performs exactly one client-side navigation (the `routeChange` check). No other link is followed by a click; the link check fetches them.
- The full `pnpm --filter @goproceed/testing test` was not run: it resets the owner's local database. Eight static UI contract suites from it were run instead.
- The new optional `titleAs` prop on `FeatureCell` and `Step` has no kitchen-sink rendering of its own; the default rendering there is unchanged.
- The FAQ answers are not in the prerendered `/pilot` HTML: a closed accordion panel renders empty until it is opened (`gp-qa`). `faq.tsx` and the `Accordion` are unchanged from the base, so this predates the task, but it qualifies criterion 5's «where the answers are visible»: visible after opening the item, and the `FAQPage` answers are in the JSON-LD either way.
- No assistive-technology pass was made on the phone link strip beyond the accessibility tree of headless Chromium.
- `gp-ui-reviewer`'s second pass left two non-blocking items unfixed so the verified revision would not move: U-09, the «ЧЕРНЕТКА» stamp overlapping the act title at 390px in `ui-act.tsx` (a visual this task did not touch, now also on the home page), and U-10, the scene note's mark centring between two wrapped lines. Both are filed under BL-059.
- The landing still says «iOS та Android» for the mobile client while `apps/mobile` ships only as a web export with no store build (`docs/STATUS.md`). This task did not touch that claim.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. Four static routes, one `<h1>`, skip link, shared header and footer | yes | working tree over `1f65fef` | `gp-qa`: `pnpm --filter @goproceed/landing build` exit 0 (`○ /`, `○ /pilot`, `○ /product`, `○ /roles`); `next start` + `curl`: 200, `h1=1`, one header, one `<main id="main-content">`, skip link, footer on all four | PASS | assisted: `gp-qa` built and served the app itself on port 3113 |
| 2. `/` renders six blocks in order, no form | yes | same | `gp-qa`: section ids in served `/` are `hero, sources, problem, scenes, position, cta-final`; `form=0`; test «keeps the home page to six blocks» | PASS | |
| 3. The form on `/pilot` only, unchanged | yes | same | `gp-qa`: `<form` count 0/0/0/1; `action="/api/pilot" method="post"`; the form's diff is `titleAs` only; unmodified `pilot-form` (13), `pilot-route` (17), `pilot-request` (7) tests pass | PASS | no real submission was sent — it would be an outbound message |
| 4. Links resolve; current page marked; phone strip reachable | yes | same | `gp-qa`: header links `/ /product /roles /pilot` on every page; `aria-current="page"` on the served page in both navs, also after a client-side navigation; no bare-hash href but `#main-content`; five fragment links resolve; at 390 the strip is displayed, not `aria-hidden`, 44px, in the accessibility snapshot | PASS | assisted: headless Chromium only, no screen reader |
| 5. Own title, description, canonical; four-URL sitemap; FAQ data on `/pilot` | yes | same | `gp-qa`: distinct `<title>`, description, canonical per page; `/sitemap.xml` four `<loc>`; `FAQPage` (7) only on `/pilot`; `SoftwareApplication` with `offers` only on `/`, `Offer.url` → `/pilot`; no dangling `@id` on any page | PASS | the answers are visible after opening an accordion item; the closed panel is empty in the prerendered HTML, as before this task |
| 6. Forbidden-claim tests pass; no send queue or no-network capture claim | yes | same | `gp-qa`: `tests/landing-content.test.ts` (28) incl. «states no send queue … (ADR-007 decision 6)»; grep of the four served pages: 0 hits for `черг`, `очіку* мереж`, `офлайн`, digit+`%`, `грн`, `клієнт`, bare `оплат` | PASS | negative — the same probe finds «мереж» where it is legitimate, so the zero is a real zero |
| 7a. §5 gate 1 `tokens generate` | no | same | `tokens.json` unchanged | NOT RUN | the gate runs it only if `tokens.json` changed |
| 7b. §5 gate 2 `motion-audit` | yes | same | `node packages/testing/qa/motion-audit.mjs` → `motion-audit: clean` (coordinator and `gp-qa`) | PASS | |
| 7c. §5 gate 3 `pnpm --filter @goproceed/testing test` | yes | same | not run; eight static suites by file instead: 8 files / 143 tests pass (coordinator and `gp-qa`) | NOT RUN | environmental: the suite runs `supabase db reset` against the owner's live local stack and the owner has not confirmed the data may go; `pnpm --filter @goproceed/testing test` after that confirmation, or CI, settles it. The eight files are a subset, not a pass of the suite |
| 7d. §5 gate 4 `typecheck` | yes | same | `gp-qa`: `pnpm turbo run typecheck --force` → 10 successful, 0 cached | PASS | |
| 7e. §5 gate 5 `landing build` | yes | same | as criterion 1 | PASS | |
| 7f. Landing tests | yes | same | `pnpm --filter @goproceed/landing test` → 22 files / 246 tests (coordinator and `gp-qa`) | PASS | |
| 7g. QA harness, four routes × seven widths + reduced motion | yes | same | coordinator's third run: `landing qa: ok`, 28 + 8 audits ok, links 9/0, beam 743, parity ok incl. `routeChange`; `report.json` newer than every source file (`gp-qa` checked the timestamps) | PASS | assisted: coordinator-run, not QA-observed. `gp-qa` reproduced a subset itself — h1 counts, links and fragments, the route change with its counterfactual, the phone strip, two screenshots — and did not re-run the harness so as not to rewrite the PNGs `gp-ui-reviewer` was reading |
| CI | no | — | — | NOT RUN | environmental: Actions jobs do not start (billing); not evidence either way |

## Sources

- Next.js 16.3.1 (installed), bundled docs `apps/landing/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` §«Merging» — metadata objects merge shallowly, so a page that sets `openGraph` replaces the layout's whole `openGraph`. Read 2026-09-19.
- https://parlo-black.vercel.app/ — the owner's reference; section inventory read 2026-09-19 (seventeen sections on one page, in-page anchors). No code, CSS or asset taken. Licence: none published on the page.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
