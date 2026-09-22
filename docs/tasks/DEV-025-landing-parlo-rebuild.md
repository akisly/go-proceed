# DEV-025 — The landing rebuilt 1:1 against its reference, in our colours

## Assignment

- Objective and user-visible outcome: the four landing pages of DEV-024 take the visual treatment of https://parlo-black.vercel.app/ — page frame, full-viewport hero, section bands, two-tone headings, pill controls, sticky feature list, grid cards, fact band, FAQ split, radial closing block, and their animations — rendered in the Daylight colours (`DESIGN.md`) on paper, not on black. Closes BL-082.
- State: verifying
- Coordinator: primary Claude Code session (worktree `vigorous-elbakyan-0f49e5`, branch `claude/landing-page-structure-plan-705112`)
- Execution mode: independent subagents for the stages root `AGENTS.md` requires
- Selected route and why (`agents/COORDINATION.md`): UI change on the `docs/design/02-building-ui.md` route.
- Triggered stages (architect / security / ui-reviewer / mobile / researcher) and why: `gp-ui-reviewer` (`apps/landing`, `packages/ui`); `gp-reviewer` and `gp-qa` always. `gp-security` not triggered: `/api/pilot`, the form's submit path and every `.env*` stay untouched.
- Owning module and allowed edit paths: `apps/landing/**`; `packages/ui/src/motion/**`, `packages/ui/src/base.css` and `packages/ui/src/components/**` for what the reference needs and the vocabulary lacks; `packages/testing/qa/motion-audit.mjs` (the perpetual-loop allowlist); `DESIGN.md`; `docs/design/02-building-ui.md`, `docs/design/03-ui-references.md`; `docs/BACKLOG.md`, `docs/STATUS.md`; this record and the index.
- Read context and applicable local instructions: as DEV-024, plus `docs/design/02-building-ui.md` §7.3 (a new motion primitive is a decision).
- Linked spec (`docs/specs/…`), ADR or earlier task: DEV-024 (the four pages, the structure this task dresses); DEV-007 and BL-082 (the reference decision and its open questions).
- Baseline: the DEV-024 working tree, snapshot tree `0edd98ad8fb2602a155c2df2e9bb6e172dbecd9e` over commit `1f65fef` (DEV-024 is uncommitted; the snapshot is a `git write-tree` from a scratch index, the real index untouched).
- Dependencies / constraints / out of scope: the reference is reimplemented from observation — no code, CSS, asset, font or image of it is copied; its licence is unpublished. No customer, testimonial, logo, price other than free, or invented figure enters the copy (`PRODUCT.md`), so the reference's testimonial rail, logo row, pricing table and statistics are rebuilt as the same compositions over true content. The reference's typeface (Syne) has no Cyrillic; Onest stays, set at the reference's sizes and weights.
- Required acceptance criteria:
  1. Every page sits inside the reference's frame: fixed double guide lines at both edges, the fixed header inside them, dotted bands between sections.
  2. The home hero fills the viewport: pixel-rain field, perspective floor, orbiting arc text, 54px/400 heading, two pill actions, the primary one with a travelling light on its border.
  3. Each reference composition listed in «Mapping» as built is present on the page the mapping names, and DEV-024's acceptance criteria 1, 3, 4, 5 and 6 still hold (its criterion 2, the home page's block list, is replaced by this task's).
  4. Colours are token roles only; no raw value, no second accent.
  5. Every new perpetual animation is named in `PERPETUAL_ALLOWLIST`, stops under reduced motion, and reduced motion shows a complete composition.
  6. §5 gate, landing tests and the QA harness pass.
- Skipped stages and rationale: none planned.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-19 | «я же попросил что бы лендинг выглядел 1 в 1 как https://parlo-black.vercel.app/ с анимациями карточками переходами только что бы цвета сохранились наши: ну и подход к страницам тоже наш» | Owner, this session, after seeing DEV-024's home page |

This answers BL-082's questions: (d) closeness — 1:1; (b) ground — our colours, so paper; (a) the perspective-grid first screen — in, as part of 1:1; (e) loops and scroll-linked compositions — the reference's. (c) typography: the owner named colours as the one thing kept; Syne has no Cyrillic glyphs and the copy is Ukrainian, so the coordinator keeps Onest at the reference's scale and records it here for the owner to overrule.

## Mapping — reference composition → our page and content

*[Rewritten 2026-09-19 after review (B-02 / R-04): the first version of this table promised four compositions that were not built. It now says what shipped; the unbuilt ones are listed under «What is not true after this task».]*

| Reference composition | Ours, as built | Page |
|---|---|---|
| Frame: double guide lines, fixed 60px header inside them, pill controls | same; rails 10px/16px below `md` | all |
| Hero: pixel rain, perspective floor, orbiting arc text, centred 54/400 h1, two pills | same, our hero copy; no announcement pill and no product frame | `/` |
| Split: animated menu card over marquee tag rows + two-tone h2, lead, pill | menu = the five facts of one work's draft act (`MiniMenu`); tags = the demo register's work titles; h2 = what GoProceed is | `/` |
| Four numbered columns 01–04 | the four roles, the payer first | `/` only |
| Three cards on a fading grid ground, floating widget, ink + muted caption | майстер / технагляд / офіс with the small `Mini*` widgets drawn from the demo records (not the large UI windows) | `/` |
| Fact band on a grid: two-tone h2, pill, four tiles | four true terms of the pilot; the requirement sources under it, where the reference sets customer logos | `/` |
| Sticky list left, label + two-tone lead + rows, large rounded card right | the five route steps and their large UI windows | `/product` |
| Large app view + four inline icon statements | the state board (`ProductFrame`) under its own heading; the three capture channels and the record they converge on. The reference's foot fade is NOT taken: a mask on the board would flatten the 3D chain its tilt depends on | `/product` |
| FAQ: label + two-tone h2 left, chevron accordion right | same, our seven questions, all closed | `/pilot` |
| Closing: radial lines, icon row round a breathing mark, 60px h2, two pills | radial lines, the five record codes as small tiles round our breathing mark, the 60px heading, the offer in three phrases, ONE pill and the copy-link button | all but `/pilot` |
| Footer: mark + columns | same | all |
| Testimonial rail; pricing table; particle globe | not built | — |

**Blocks the reference has no composition for keep their Daylight composition**, inside the frame, on the page ground, under a two-tone heading: `Roles` (feature grid) and `Compare` and `Problem`/Рис. 01 on `/roles`; `Capture`, `Provenance` (bento) and `Position` on `/product`; the pilot stepper, boxes and form on `/pilot`.

## Plan

1. Documents: this record, `DESIGN.md` (identity, Don't list, loops), `03-ui-references.md` row, `02-building-ui.md` rule 5 and code map.
2. System: `PixelRain` and `OrbitText` motion primitives; `gp-orbit`, `gp-breathe` loops in `base.css` and the allowlist; pill size and two-tone heading support.
3. Frame, header, band, footer.
4. Hero.
5. Home sections; then `/product`, `/roles`, `/pilot`.
6. Tests and harness re-pinned; §5 gate; stages.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 0 | coordinator | DEV-024 had taken only block *types* from the reference; the owner, shown its home page, said that was not the request (see «Owner decisions»). DEV-024's pages, metadata, form placement and tests are the base; its block compositions are replaced here. | DEV-024 record | — |
| 1 | coordinator | Reference observed with puppeteer at 1440 (16 folds) and 390 (6 folds), software WebGL — with `--disable-gpu` the page renders its own error boundary. Sections, type scale, fixed/sticky elements and running animations dumped from the live DOM. | session scratchpad `parlo/` (not committed: third-party screenshots) | — |

| 2 | coordinator | System: `PixelRain` (the one canvas and rAF loop in the vocabulary; still frame under reduced motion; colour = the element's computed `color`) and `OrbitText` (CSS loop `gp-orbit`); `gp-breathe`; both loops added to `PERPETUAL_ALLOWLIST`; vocabulary test re-pinned 22 → 24 and loops 5 → 7; both rendered in the motion kitchen sink, which the gated inventory test demanded. | `packages/ui/src/motion/{PixelRain,OrbitText,index}.ts*`, `base.css`, `packages/testing/qa/motion-audit.mjs`, `packages/testing/src/motion-audit.test.ts` | — |
| 3 | coordinator | Frame, header between the inner rails, raster band, perspective floor, grid grounds, radial ground — `apps/landing/app/globals.css`, all colours `color-mix` of roles. The page-wide dot field removed (the reference has none). Rails are 10px/16px below `md`, not 22px/30px: 30px a side leaves a 360px phone 300px for Ukrainian copy and the UI windows. | `globals.css`, `components/site-shell.tsx`, `components/blocks/nav.tsx` | — |
| 4 | coordinator | Home: hero (no announcement pill, no product frame — the reference's first screen is text over two grounds), `Intro` (menu card over two marquee rows + two-tone statement + 01–04 columns), `Scenes` as three grid cards with small widgets drawn from the demo records, `Facts` over the sources, radial `Cta`. Рис. 01 moved to /roles and the position statement to /product — the reference's home has no place for them. | `components/blocks/{hero,intro,scenes,facts,cta}.tsx`, `components/visuals/mini.tsx` | — |
| 5 | coordinator | /product: `Route` rebuilt as the reference's sticky list (IntersectionObserver, links, no motion library) beside label + two-tone lead + rows + large rounded card; `StateBoard` = the former hero `ProductFrame` as the large application view with four statements. `ScrollStack` is no longer used by the landing (it stays in the vocabulary and the kitchen sink). Every `SectionHead` is two-tone. FAQ in the reference's split with the chevron marker. | `components/blocks/{route,sticky-list,state-board,section-head,faq}.tsx` | — |
| 7 | coordinator | Harness runs 4–6. Run 4 found C-01 (phone overflow on `/product`); the coordinator's screenshots found C-02 (role cells stuck hidden); run 5 and run 6: `landing qa: ok`. | session scratchpad `qa-run4…6.log` | — |
| 8 | gp-reviewer | No blocker; four majors (R-01…R-04), minors and notes; «can proceed to QA after the stated fixes». | «Findings and rework» | rework |
| 9 | gp-ui-reviewer | HOLD on B-01 and B-02, with a ranked fidelity table against the reference's screenshots. | same | rework |
| 10 | gp-ui-reviewer (second pass) | HOLD on B2-01, a regression from the rework; every first-pass finding in place; B-03's refusal accepted; advice on the pills: keep ink primary. | same | round 1 |
| 11 | gp-qa | No FAIL. It found the tree had moved under it (the B2 fixes), re-ran every check and probe on the moved tree `afac019b`, and confirmed each finding's fix by measurement. Criteria 1–5 PASS; criterion 6 NOT RUN for the harness on that tree and for the full contract suite. | «Acceptance evidence» | harness on the final tree |
| 6 | coordinator | Tests re-pinned to the new composition without dropping a claim guard: forbidden copy, one h1, heading order, the one form, a11y of the matrix/sources/strip, the e-mail guard, per-page metadata and JSON-LD all unchanged. Harness: `ScrollSettle`, beam, depth and tilt checks moved to /product; `ScrollStack` checks replaced by the sticky list's; first-screen checks added (`rain`, `orbit`, still under reduced motion, hero ≥ viewport). | `apps/landing/tests/*`, `apps/landing/qa/landing.mjs` | harness run |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|
| C-01 | major | coordinator, harness run 4 · `/product` at 390/360 | 48px of sideways scroll. `<main>` lost `position: relative` when it stopped being `body`'s child, so the access matrix's `sr-only` labels took the frame as containing block and escaped `<main>`'s `overflow-x: clip`. | coordinator | Fixed: `<main>` is `relative` (`site-shell.tsx`, with the reason). All four pages at 390 and 360: `scrollWidth === innerWidth`. |
| C-02 | major | coordinator, screenshots · `/roles` first fold | The four role cells stayed at opacity 0 in 3 loads of 5: a `Stagger on="view"` already in view when the reduced-motion gate opens. | coordinator | Fixed at the call site: `FeatureGrid stagger="load"` on `/roles`. Harness gains `firstFold()` (3 loads a page). See R-03 for what is not fixed. |
| C-03 | minor | coordinator, gate · `subtle-body-copy.test.ts` | `text-ink-subtle` on 12–13px text in three places of the new code. | coordinator | Fixed: `text-ink-muted`. |
| R-01 | major | `gp-reviewer` · `two-tone.tsx` | The h1 of `/product`, `/roles`, `/pilot` sat in a `Reveal`: `opacity:0` in the HTML, waiting for hydration on a phone. | coordinator | Fixed: an `h1` `TwoTone` is not revealed. Test «the page's h1 paints with the HTML», per page; `hero-first-paint` no longer exempts the headline (R-10). |
| R-02 | major | `gp-reviewer` · `scenes.tsx` | One `Stagger` round three stacked cards: DEV-024's U-01 again, and its guard test had been deleted. | coordinator | Fixed: one `Reveal` per card; guard re-homed («reveals each card on its own»). |
| R-03 | major (inferred) | `gp-reviewer` · `Stagger.tsx` | The race may hold wherever a `Stagger` is in view at hydration — deep links, scroll restoration. | coordinator | Checked, not reproduced at 1440 on six deep links × four loads; `firstFold()` now covers them. Not fixed in `Stagger`; the 390 finding it surfaced is recorded under «What is not true» and BL-059. |
| R-04 / B-02 | major (record) | both reviewers · this record | The Mapping named compositions that were not built; «What is not true» was empty; BL-082 and STATUS untouched. | coordinator | Fixed: Mapping rewritten to what shipped, the section filled, BL-082 and STATUS amended. |
| R-05 | minor | `gp-reviewer` · `globals.css`, `og.png` | The rails drew on `/og` and the kitchen sinks, and into the social card. | coordinator | Fixed: `.landing-body:has(.landing-frame)`; `og.png` regenerated by the harness. |
| R-06 | minor | `gp-reviewer` · render test | A lookahead that could never fail. | coordinator | Fixed: the guard now matches a band that is NOT `aria-hidden`, and asserts bands exist. |
| R-07 | minor | `gp-reviewer` · `scenes.tsx` | The scene notes, the draft-act disclaimer among them, were `sr-only`. | coordinator | Fixed: visible closing line on each card; the test refuses a visually hidden disclaimer. |
| R-08 / B-01 | major (UI) | both · `state-board.tsx` | The same h2 twice in consecutive folds, the first over a board it does not describe. | coordinator | Fixed: `content.board`; test «no two section headings say the same thing», per page. |
| R-09 | minor | `gp-reviewer` · `position.tsx` | Its link pointed at the block directly above it. | coordinator | Fixed: «Як проходить пілот» → `/pilot`. |
| R-10 | minor | `gp-reviewer` · `hero-first-paint.test.tsx` | The headline was still exempt from the opacity rule. | coordinator | Fixed. |
| R-11 | minor | `gp-reviewer` · harness, unit tests | Criterion 5 asserted by label. | coordinator | Fixed: two `toDataURL()` reads 700ms apart (painted and changing; painted and unchanged under reduced motion); the sticky nav's measured top; `tests/first-screen-primitives.test.tsx`. |
| R-12 | minor | `gp-reviewer` · `PixelRain.tsx` | The loop idled off screen instead of stopping; the sizing contract was unstated. | coordinator | Fixed: cancelled on exit and on `visibilitychange`; the header states that the caller sizes the canvas. |
| R-13 | minor | `gp-reviewer` · title splits | Three unguarded `lastIndexOf` splits; no space between the two spans. | coordinator | Fixed: `splitTitle()`; a space for `textContent`; content test «ends every block title with its closing phrase». |
| R-14 / B-07 | minor | both · `scenes.tsx`, `route.tsx` | Headings wrapped whole paragraphs. | coordinator | Fixed: the heading is the title; the rest is an inline sibling paragraph. Test on the scene cards. |
| R-15 / B-05 | minor | both · `DESIGN.md`, `02-building-ui.md` | Counts and descriptions of the old composition. | coordinator | Fixed: dated notes; 24 primitives, 7 loops. |
| R-16 / B-09 | note | both | Unused content and assets. | coordinator | `cta.secondary*` removed; the rest listed under «What is not true». |
| R-17 | note | `gp-reviewer` | Width at 1920; double hairlines; beams per fold. | coordinator | The footer's `border-t` under the band removed. Width and beam count judged within the owner's ask by `gp-ui-reviewer`. |
| B-03 | minor | `gp-ui-reviewer` · `landing-fade-foot` on the board | The mask fell below the board. | coordinator | Not taken, with reason: masking the board flattens the 3D chain its tilt needs. Wrapper mask removed; recorded in the Mapping. |
| B-04 | minor | `gp-ui-reviewer` · `beam` under reduced motion | A static cobalt arc parked at 0deg on every ink pill and the board. | coordinator | Fixed: `.beam { display: none }` in the unlayered reduced-motion block; harness asserts none is shown. |
| B-06 | minor | `gp-ui-reviewer` | One inset written two ways in eleven places; an unused `TwoTone` size. | coordinator | Fixed: `.landing-inset`; `Cta` uses `TwoTone size="closing"`. |
| B-08 | note | `gp-ui-reviewer` · sticky list links | 31px on a wide touch device. | coordinator | Fixed: `touch:py-3`. |
| B-10 | note | `gp-ui-reviewer` · `product-frame.tsx` `on="load"` | The entrances play off screen now. | — | Not changed: the frame is complete by the time it scrolls in; no reader sees a defect. |
| B2-01 | major (blocked PASS) | `gp-ui-reviewer`, second pass · `cta.tsx`, `two-tone.tsx` | **A regression the rework introduced.** Fixing B-06 moved the closing heading's `max-w-[22ch]` from the `h2` onto its `Reveal` wrapper, where `ch` resolves at the body's 16px (~205px): the 60px heading broke into six one-word lines at every desktop width, on three pages. | coordinator | Fixed: the measure is in `TwoTone`'s `closing` scale, on the heading itself. Render test pins it to the `<h2>` and refuses it on a `<div>`; the harness asserts `closingHeadingLines <= 3`. `gp-qa` measured 2 lines at 1920/1440/768 and 3 at 390/360. |
| B2-02 | minor | same · `orbit-mask` | The arc's ends were cut by the window's foot: the fade's stops were percentages of an 880px window, the glyphs sink ±170px from the centre. | coordinator | Fixed: stops in px from the centre; window 3.75rem. |
| B2-03 | minor | same · `OrbitText` under reduced motion | The still arc showed the tail of one phrase and the head of the next. | coordinator | Fixed: the ring is turned back by half a phrase, so one whole phrase is centred — the first frame under full motion too. |
| B2-04 | minor | same · `state-board.tsx` | «EV-0248. один запис…» began lowercase after a full stop; three statements repeat `Capture`'s card titles ~600px below. | coordinator | Grammar fixed (name — text). The repetition is recorded under «What is not true». |
| B2-05 | note | same · `footer.tsx` | The footer kept the 1180px centred column while the sections took the frame's inset. | coordinator | Fixed: `landing-inset`. |
| B2-06 | note | same · `qa-output/` | Stale folds from earlier, longer compositions sat beside the new ones. | coordinator | Fixed: the harness empties the directory first. |
| B2-07 | note | same · comments | `PixelRain`'s docstring and the `.beam` rule's place in `base.css`. | coordinator | Fixed. |
| Q-01 | minor (record) | `gp-qa` · this record, `hero-first-paint.test.tsx` | The record lacked the B2 round and its evidence predated the final tree; the test's docblock and title still described the headline's exemption. | coordinator | Fixed: this round recorded, the harness re-run on the final tree, the docblock and title corrected. |
| Table A | — | `gp-ui-reviewer` fidelity | Floor too sparse and thick; rain a grey wash to 38 %; arc steep and small; phone h1 small; sticky cards filled; strip one column on phones; closing marks faint; `Capture` on a white band. | coordinator | Fixed: floor 60px pitch under a 900px perspective; rain to 24 % with brighter heads and a thinner field; ring 1000px, 15px medium ink; h1 floor 42px; cards on the page ground; strip 2×2 below `wide`; codes as tiles; `Capture` on the page ground. The pill inversion is left for the owner. |

Rework count and hypothesis changes: 1 round — the second `gp-ui-reviewer` pass ended in a new blocker (B2-01), a regression the first rework introduced; fixed and re-verified by `gp-qa` on the tree that carries the fix. The first review does not count. One hypothesis changed: the first mapping assumed every reference composition would be built; four were not, and the record now says so.

## What is not true after this task

- **«1 в 1» holds for the frame, the home page, the route, the application view, the FAQ and the closing block.** `Roles`, `Problem`, `Compare`, `Capture`, `Provenance`, `Position` and the pilot stepper and form keep their earlier compositions with a two-tone head: the reference has nothing to match them to. By scroll length that is most of `/roles` and `/pilot` and the second half of `/product`.
- **Four compositions the first mapping promised were not built:** a «було → стало» rail in the testimonial composition, the pilot's four steps in the pricing composition, three grid cards for access / immutability / limits on `/product`, and the 01–04 columns on `/roles`. They are the next slice if the owner wants the sub-pages closer.
- The reference's testimonial rail, pricing table and particle globe are not built; its logo row and statistics are rebuilt over true content (`PRODUCT.md`: no customer, price or outcome figure may be published).
- **The pills are inverted against the reference, on purpose and unconfirmed:** there the travelling light runs on the hollow ground-coloured pill and the filled one has none; here it runs on the ink pill, because `DESIGN.md` makes the landing's primary action ink. The owner has not ruled on this.
- Onest stays in place of Syne (no Cyrillic). The rails are 10px/16px below `md`. The h1 is not revealed word by word. The closing block's rays are straight where the reference's are arcs. None of this is owner-confirmed.
- No token changed: the 20 non-colour rulings in `tokens.json` that BL-082 counts still cite the 2026-09 prototype.
- `PixelRain` is invisible to `motion-audit` (it scans CSS and imports) — the harness measures its bitmap instead. No rule stops a second `requestAnimationFrame` loop being written elsewhere.
- Without JavaScript the rain canvas is blank and every `Reveal`/`Stagger` below the first heading stays hidden; each page's h1 and the home lead do paint.
- **The `Stagger on="view"` race is patched at its one call site (`/roles`), not in `Stagger`** (R-03). It did not reproduce on the site's deep links at 1440 (six URLs × four loads). What did reproduce, deterministically, at 390: `Capture` and `Provenance` keep a tall stacked `Stagger` below its 25 % threshold, so a fold under their headings is blank until more scrolls in. Both blocks and the behaviour predate DEV-024; filed under BL-059.
- `firstFold()` and the closing-heading line count are checked at 1440 only (pages and deep links); `gp-qa` measured the heading at 3 lines at 390 and 360 by hand.
- The fixed header is 59px tall (the token `header-height-marketing` is 58px plus its hairline), where the reference's is 60px.
- On `/product` three of the application view's four statements repeat the titles of the `Capture` cards that follow ~600px below (B2-04).
- The grid cards' captions are longer than the reference's two lines — an eyebrow, a title with its sentence, a hairline and a note — so the widget does not dominate the card as it does there; shortening them is a copy decision. The application view is a 1040px tilted board without the reference's foot fade (B-03).
- The full `pnpm --filter @goproceed/testing test` is NOT RUN (it resets the owner's local database). `motion-audit.test.ts`, which pins the vocabulary at 24 and the loops at 7, was run by file; it touches no database.
- The reference observations (screenshots, DOM dump) live in the session scratchpad, not in the repository: third-party imagery. They cannot be reproduced from the repository, only re-shot.
- Left unused by this task, not deleted: `ScrollStack`, `LineReveal`, `TextBlurIn`, `SectionRule`, `Pill` (no landing page uses them; the kitchen sinks do); `.landing-media-grid`, `media-tint-*`, `media-glow-*`; `public/images/photo-{site-trays,schematic,plan-stamped,tracing}.jpg` and `qa/grounds.mjs`; content keys `*.rule`, `scenes.{eyebrow,title,titleAccent,lead}`, `route.lead`, `route.steps[].titleAccent`, `cta.{lead,titleAccent}`, `hero.pill` (still read by `/og` and the JSON-LD).
- Nothing is deployed.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. Every page inside the reference's frame | yes | working tree `afac019b` (git tree id, over commit `1f65fef`) | `gp-qa`, all four pages at 1440 and 390: outer rails `fixed` at 22px (10px at 390), inner at 30px (16px), the header `fixed` between the inner rails, bands 50px | PASS | the header is 59px, the reference's 60px |
| 2. The home hero | yes | same | `gp-qa`: `heroH=900 vh=900` at 1920/1440/390; h1 `54px/400/center` (42px at 390); rain canvas present; floor `perspective 900px`; `gp-orbit` 48s; two pills radius 999px, `gp-beam` on the primary only | PASS | |
| 3. Mapped compositions present; DEV-024's criteria 1, 3, 4, 5, 6 hold | yes | same | `gp-qa`: the 111 render tests that assert the compositions; served HTML: one h1, skip link, header, main, footer per page; `<form` on `/pilot` only, `post /api/pilot`; `app/api/**`, `content/pilot-request.ts`, `site-origin.ts`, every `.env*` without diff in either task; `aria-current="page"` twice per sub-page, not under `aria-hidden`; four-URL sitemap; `FAQPage` on `/pilot` only, no dangling `@id`; forbidden copy absent | PASS | not-provable-locally: the production canonical — it resolves to `http://localhost:3100` without `NEXT_PUBLIC_SITE_URL`; `site-origin.ts` is unchanged |
| 4. Token roles only | yes | same | `gp-qa`: 1 565 added lines between the DEV-024 snapshot `0edd98ad` and `afac019b` — the only raw colour is `#000` in `mask-image`; no hex, `rgb(`, `oklch(`, `hsl(`, palette class, raw ramp or template-literal class; `primitive-leak` and `contrast` pass | PASS | negative — the `#000` mask lines do match the probe's pattern |
| 5. New loops named, stopped under reduced motion, compositions complete | yes | same | `gp-qa`: `PERPETUAL_ALLOWLIST` has `/gp-orbit/`, `/gp-breathe/`; `motion-audit: clean`; reduced motion on 8 page × width combinations: 0 running infinite animations, no dimmed text after a full scroll, 0 console errors; rain `painted:true changed:false` over 2s; rAF calls per 1.5s: 90 on screen, 0 off screen, 0 with `document.hidden` | PASS | `PixelRain` is outside the audit's reach — measured by bitmap and rAF count instead |
| 6a. Gate 1 `tokens generate` | no | — | `packages/tokens` has no diff | NOT RUN | the gate runs it only if `tokens.json` changed |
| 6b. Gate 2 `motion-audit` | yes | `afac019b` | `gp-qa` and coordinator: `motion-audit: clean` | PASS | |
| 6c. Gate 3 `pnpm --filter @goproceed/testing test` | yes | — | not run; nine static suites by file instead, incl. `motion-audit.test.ts` (24 primitives, 7 loops): 9 files / 158 tests (coordinator and `gp-qa`, who first confirmed none touches a database) | NOT RUN | environmental: the suite resets the owner's live local database and the owner has not confirmed; `pnpm --filter @goproceed/testing test` after that confirmation, or CI, settles it. The nine files are a subset, not a pass of the suite |
| 6d. Gate 4 `typecheck` | yes | `afac019b` | `gp-qa`: `pnpm turbo run typecheck --force` → 10 successful, 0 cached | PASS | |
| 6e. Gate 5 `landing build` | yes | `afac019b` | `gp-qa`: exit 0, `/`, `/product`, `/roles`, `/pilot` static | PASS | |
| 6f. Landing tests | yes | `27241f21` (the final tree: `afac019b` plus a test's docblock and title, and this record) | `pnpm --filter @goproceed/landing test` → 23 files / 259 tests (coordinator; `gp-qa` the same count on `afac019b`) | PASS | |
| 6g. QA harness | yes | code of `afac019b` | coordinator, run 7: `landing qa: ok` — 28 + 8 page audits, `first folds … ok stuck=[]` (four pages and four deep links, three loads each), links 9 checked / 0 broken, beam 767, parity ok incl. `closingHeadingLines: 2`, `rainFrames {painted, changed}`, `rainFramesReduced {painted, unchanged}`, `beamsShownReduced: 0`, `stickyTop: 96`, `routeChange scrollYAfter: 0`; `public/og.png` unchanged | PASS | assisted: coordinator-run, not QA-observed. `gp-qa` reproduced with its own probes: overflow, first folds, rain, reduced motion, beams, closing-heading lines; it did not reproduce links, beam pixels, tilt/depth/magnetic parity, sticky current, the stepper or the route-change reset, and did not run the harness because the harness now empties `qa-output`, which `gp-ui-reviewer` was reading |
| `gp-ui-reviewer` | yes | second pass on `f24870b3`; its one blocker (B2-01) fixed in `afac019b` and measured by `gp-qa` and the harness | first pass HOLD (B-01, B-02); second pass HOLD on B2-01 only, every first-pass finding in place | PASS on every finding but B2-01; B2-01's fix verified by measurement, not by a third UI pass | a third `gp-ui-reviewer` pass over re-shot screenshots was not run; the coordinator viewed the closing block at 1440 |
| CI | no | — | — | NOT RUN | environmental: Actions jobs do not start (billing) |

## Sources

- https://parlo-black.vercel.app/ — observed 2026-09-19 (desktop 1440, phone 390). Measured: body Syne; h1 54px/400/−0.88px; section h2 36px/500/−0.9px/40px, second line muted; closing h2 60px/600/−1.5px; h3 18px/500; fixed guide lines at 22px and 30px from each edge; fixed header 60px; perpetual animations `star-btn` 3s linear, `testimonial-scroll` 48s, `cta-model-marquee` 36s, `cta-center-breathe` 4s. No licence published. Nothing copied.
- Syne — `https://fonts.googleapis.com/css2?family=Syne:wght@400..800`, fetched 2026-09-19: the stylesheet serves three subsets, `greek`, `latin`, `latin-ext`, and no `cyrillic`.

## Completion / handoff

- Changed / inspected files:
- Review independence:
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
