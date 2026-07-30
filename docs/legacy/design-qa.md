# Evidence Atlas design QA

Date: 2026-07-23  
Scope: full AktFlow interactive prototype  
Selected source: `design-references/evidence-atlas/selected-direction.png`

## Build evidence

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run qa`: passed with no findings.
- Automated coverage: 17 business flow families, 19 deterministic screenshots.
- Viewports: 1487×1058, 1440×1100, 1440×1050, 1440×1024, 1200×850 and 390×844.
- Work-mode cloud browser did not open the local preview in this workspace. Visual inspection therefore used the repository’s fresh deterministic renders; this is a preview-surface limitation, not runtime certification.

## Same-input comparison

`design-qa/landing-first-viewport-comparison.png` contains the selected reference and the fresh implementation first viewport in one image. `design-qa/evidence-atlas-flow-contact-sheet.png` contains the selected board plus fresh landing, dashboard, onboarding, evidence-review and field renders.

Observed alignment:

- Paper-dominant first viewport, Carbon typography and Lime primary action match the selected direction.
- Hero object uses layered plan folios, a code-native financial dossier, evidence attachments and a generated audit stamp.
- The section rhythm matches: ledger → workflow → Carbon mobile stage → role dossier → security → plans → pilot CTA.
- Manrope/Inter hierarchy, low-radius folios, Slate rules and sparse Lime usage remain consistent across surfaces.

## Surface review

| Surface | Checks | Result |
|---|---|---|
| Landing | header, hero crop, money hierarchy, evidence assets, mobile section, pricing, footer routes | passed |
| Auth/recovery | form hierarchy, magic-link state, reset receipt, legal destinations | passed |
| Onboarding | progress, mapping density, validation counts, rules hand-off, responsive structure | passed |
| Desktop shell | grouped navigation, nested selected state, context switcher, notifications, route hand-off | passed |
| Dashboard/work | above-fold density, search/filter/export states, drawers and exact work context | passed |
| Rules/baseline | version proof, stale-preview guard, publish receipt and immutable copy | passed |
| Assignments/occurrence | exact version context, mixed row receipt, offline bundle, hold/concealment | passed |
| Evidence | real media crop, warning state, decision rail, original/R2 lineage and receipts | passed |
| Close/package | blocker persistence, override, snapshot, generation, submission and reconciliation | passed |
| External review | exact v2 boundary, section navigation, return/accept receipts, non-KEP copy | passed |
| Payments/billing | construction-commercial and SaaS planes remain visually and semantically separate | passed |
| Team/settings | scope preview, offboarding, mandatory-event lock and settings receipt | passed |
| Field | Today/Captures/Queue navigation, capture, local receipt, server receipt, 390×844 | passed |

## Asset review

The complete chosen asset set is preserved in `design-references/evidence-atlas/`:

- selected direction board;
- synthetic blueprint folio;
- synthetic construction evidence photo;
- synthetic audit stamp;
- asset/usage/crop/motion manifest.

Production copies are under `prototype/public/assets/evidence-atlas/`. No customer data, people, logos or readable customer documents are present.

## Interaction and routing review

- Public conversion routes lead to pilot, login, synthetic demo and field demo.
- Onboarding returns through the versioned rule flow.
- Authenticated navigation follows work → assignment → field → review → close → package → external review → project payment.
- Nested occurrence/package pages retain the correct parent navigation state.
- Notification and project-context menus open and contain real destinations.
- Field and external-review tabs change visible state.
- Password recovery, legal links, help contact and workspace settings are no longer dead affordances.
- Existing domain commands, receipts and state consequences remain unchanged; the visual revision did not weaken the v2.9 business-logic contracts.

## Non-prototype release gates

This pass does not certify backend authorization, RLS, object durability, native mobile security, legal effect, KEP, customer adapters, WCAG conformance or production infrastructure. Those remain governed by the production-readiness and validation registers.

final result: passed

---

# apps/demo design QA (Task 20 / A.3.8 item 16, doc 05 §13.4)

Date: 2026-07-26
Scope: `apps/demo` only — the public, unauthenticated Ukrainian-language discovery
deployment (distinct from the full authenticated prototype covered by the entry above).
Selected source: `design-references/evidence-atlas/selected-direction.png` (809×1945)

## What this entry is, and is not

This records the visual-QA decision required by doc 05 §13.4 for `apps/demo` using the
best method available in this environment, in the same spirit as this file's own
2026-07-23 entry ("Work-mode cloud browser did not open the local preview in this
workspace... this is a preview-surface limitation, not runtime certification"). No
deployed URL exists for `apps/demo` (Task 20 does not deploy anything — see
`apps/demo/README.md`), and this environment has no interactive browser preview. What
follows is a **screenshot-based review**: fresh, deterministic renders captured with
headless Chrome via `puppeteer` (the same engine `apps/demo/qa/verify.mjs` already uses)
against `apps/demo/dist` built from this commit, reviewed by direct visual inspection
against the selected-direction board.

**This is not the full doc 05 §13 / A.3.8 item 16 pass.** `task-20-report.md`'s
twenty-item gate record marks item 16 **NOT DONE** in the authoritative sense — the spec
contemplates comparing against a live, production-context render across real browsers,
and a full independent design review, neither of which happened here. Treat the findings
below as a real but partial check: a genuine visual regression would very likely have
been caught, but the absence of a finding here is not equivalent to a completed manual
design-QA pass.

## Renders captured

| Render | Route | Viewport |
|---|---|---|
| Landing desktop | `/` | 1440×900 |
| Guided journey step 1 desktop | `/demo` | 1440×900 |
| Dashboard desktop | `/app` | 1440×900 |
| Evidence/requirements desktop | `/app/evidence` | 1440×900 |
| Guided journey mobile | `/demo` | 390×844 |
| Dashboard mobile | `/app` | 390×844 |
| Focus state | `/` (2× Tab from load) | 1440×900 |
| Reduced-motion | `/demo` (`prefers-reduced-motion: reduce` emulated) | 1440×900 |

This covers doc 05 §13.1's minimum set as closely as `apps/demo`'s actual route set
allows: `apps/demo` has no distinct "field" page (the field/offline flow is
prototype-only — see A.6), so the 390×844 render uses `/demo` and `/app` instead;
"onboarding desktop" likewise has no `apps/demo` equivalent (`/onboarding` is a
never-written path that redirects to `/demo`).

## Findings against the doc 05 §13.3 checklist

- **Crop quality.** No clipped text, no overlapping elements, no broken image frames at
  any captured viewport. The two Evidence Atlas photographic assets
  (`blueprint-folio.webp`, `cable-tray-evidence.webp`) render only inside `.sidebar`
  (`/app`, `/app/work`, `/app/evidence`, `/app/rules`) per Task 17's own inventory of
  which selectors are actually reachable; none of the captured renders show a cropped or
  distorted instance of either.
- **Route/header context.** The Carbon disclosure strip (`Демонстраційний прототип ·
  синтетичні дані · без клієнтів`) renders identically at the top of every captured
  route, matching A.3.2/A.4.8's whole-surface requirement. Each page's own `<h1>` gives
  unambiguous route context immediately below it.
- **Money hierarchy.** `/app`'s "Гроші під ризиком" money card leads the page directly
  under the title, ahead of the readiness-distribution chips and the risk table — the
  same lead-with-the-number-at-risk pattern as the selected direction's hero money card.
  `/demo` step 5 and the unrecoverable rows on `/app` both format the exact ₴ figure
  (`formatUah`), not a rounded or compacted value, matching A.4.11's exact-figure
  requirement.
- **Evidence visibility.** `/app/evidence` lists every requirement per work item with an
  explicit blocking/non-blocking split and named evidence-kind labels (Фото, Обсяг,
  Протокол, Файл, Голосова нотатка) — nothing renders as an unlabeled placeholder.
- **Responsive overflow.** At 390×844, `/demo` and `/app` both reflow without horizontal
  scroll: the `/app` work table becomes a stacked card list (money value promoted to the
  card's first line), the sidebar collapses behind a menu control, and the step
  indicator on `/demo` wraps to two rows instead of clipping. No content was cut off in
  either mobile capture.
- **Focus states.** Tabbing from `/`'s load lands a visible rectangular focus ring on the
  first interactive nav element (captured); the ring has clear contrast against both the
  Paper background and the Carbon disclosure strip above it.
- **Reduced-motion fallback.** `apps/demo/src/styles.css` and
  `apps/demo/src/styles/demo.css` both carry paired `@media (prefers-reduced-motion:
  no-preference)` / `@media (prefers-reduced-motion: reduce)` blocks (5 and 3 occurrences
  respectively). The `/demo` capture with `prefers-reduced-motion: reduce` emulated
  renders identically to the normal capture — no stuck transform, no missing content, no
  layout shift. A screenshot cannot prove an animation never plays (it is a single
  frame), so this checks "the reduced-motion state is not visually broken," not "no
  motion occurs" — the latter needs the live/manual pass item 16 still requires.

## Surface-proportion — non-authoritative directional check only

A.3.8 item 20 requires Paper/White 74–78%, Carbon 17–21%, Lime ≤5%, and is listed as one
of the eight manual items in `task-20-report.md` that this task cannot authoritatively
perform (no live/production-context measurement, no design-review judgment call on
visual weight versus raw pixel area). As a directional sanity check only — nearest-color
pixel classification run against the four desktop captures above, downsampled, using the
token hex values in `apps/demo/src/styles.css` (`--paper:#fbfbfb`, `--ink:#171717`,
`--signal:#c6ff34`):

| Render | Paper/White | Carbon | Lime | Other (chips, muted text, etc.) |
|---|---|---|---|---|
| Landing desktop | 67.2% | 25.8% | 1.4% | 5.7% |
| `/demo` step 1 desktop | 93.0% | 3.9% | 0.2% | 2.9% |
| Dashboard desktop | 77.7% | 12.9% | 0.6% | 8.7% |
| Evidence desktop | 83.5% | 8.9% | 0.6% | 7.0% |

Lime is comfortably within budget on every sampled page. Paper and Carbon vary
per-route rather than landing inside the 74–78% / 17–21% band on every single page
(expected — the budget is very likely intended as an aggregate/typical-page target, not
a per-pixel identical ratio on every route, and confirming that reading is itself part of
the judgment call item 20 requires). **This table is evidence for a future manual pass,
not a substitute for it** — do not cite it as item 20 having passed.

## Decision

Screenshot-based review found no visual regression against the selected direction and no
new literal color values (see `apps/demo/tests/styles.test.ts` and
`git diff --exit-code -- apps/demo/src/styles.css`, both clean). The Carbon/Paper/Lime
system, Manrope/Inter type hierarchy and low-radius folio language read as consistent
with the selected board across every captured route and both breakpoints checked.

**This satisfies doc 05 §13.4's requirement that a decision be recorded here. It does
not satisfy A.3.8 item 16 in the authoritative sense** — see `task-20-report.md` for the
full twenty-item gate, where item 16 (together with items 15, 17, 18, 19, 20) is recorded
as NOT DONE pending a real device/production-context, human-led pass.

final result (this entry only): screenshot-based partial review — no regression found;
full manual pass still required before item 16 can be marked done.
