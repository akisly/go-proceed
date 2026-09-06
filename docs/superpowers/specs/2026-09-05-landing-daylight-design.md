# Landing «Daylight» — porting the approved prototype into `apps/landing`

**Date:** 2026-09-05

**Status:** Approved by the owner on 2026-09-05 — all five decisions in §2
taken as recommended (D1 system-wide palette and typeface; D2 route handler in
`apps/landing`; D3 the mark everywhere; D4 no GSAP/Lenis, finite beam; D5
`design-contest` tracked under `design-references/contest-2026-09/`).

**Applies to:** `apps/landing`, `packages/ui`, `packages/tokens`,
`design-references/brand`, and the documents that describe them. Nothing under
`apps/app/app/**`, `apps/mobile/**`, `supabase/**` or any auth code is edited by
this slice except the two mechanical follow-throughs named in §4.6 and §5.3
(font import, icon files), and only if the owner takes the recommended answer.

**Supersedes:** the visual composition and page architecture of
[`2026-08-25-landing-redesign-design.md`](2026-08-25-landing-redesign-design.md)
(«Evidence Journey») and the landing half of the Evidence Atlas direction in
[`DESIGN.md`](../../../DESIGN.md). Their product-truth boundaries (§8 below)
remain binding. The motion vocabulary decision in
[`2026-08-30-landing-motion-vocabulary-design.md`](2026-08-30-landing-motion-vocabulary-design.md)
stands and is extended by one word (§6.2).

**Read with:** [`docs/design/02-building-ui.md`](../../design/02-building-ui.md)
(the procedure and the gate — it wins on every conflict of method),
[`PRODUCT.md`](../../../PRODUCT.md) (what may not be claimed),
[`docs/design/04-role-pain-map.md`](../../design/04-role-pain-map.md) (the role
copy's source), `design-references/contest-2026-09/daylight/README.md` (the nine iterations
and their reasons — tracked under D5; until that commit lands the same files
sit untracked at `design-contest/`).

---

## 1. Purpose and sources of truth

The owner ran a design contest (`design-contest/`, nine iterations, 2026-09-04
→ 2026-09-05) and approved the light «daylight» prototype:
`design-references/contest-2026-09/daylight/index.html` (one file: markup, CSS, GSAP/Lenis
animation, three endpoint helpers), `design-references/contest-2026-09/daylight/api/pilot.js` (a
Vercel serverless handler: Telegram/Resend delivery, honeypot, rate limit),
`vercel.json`, `.env.example`, and `assets/*.jpg` (crops of the approved
synthetic photographs from `design-references/evidence-atlas/assets`).

This slice moves that prototype into the real application — Next 16.3.1,
React 19.2.8, Tailwind 4.3.3, `@goproceed/ui`, `@goproceed/tokens` — and brings
the design system, the shared components, the brand mark and the documentation
into agreement with it. The prototype is the source of truth for **what the
page looks like and says**; the repository's rules are the source of truth for
**how it is built**. Where the two disagree, §7 lists every deviation and why.

### 1.1 Facts the owner decided that older documents do not carry

These override `PRODUCT.md` §Users, `docs/product/vision-and-positioning.md` and
the 2026-08-25 spec wherever they differ, and the content tests in §9 pin them:

| # | Fact |
|---|---|
| F1 | **The pilot is free**: two weeks on one work package, no contract, no prepayment. Continuation is a separate decision; nothing switches on automatically. |
| F2 | **The foreman's capture channels are the Telegram bot and the mobile app.** The phrase «польова вебпрограма» (field web app) is retired from public copy. |
| F3 | **The no-account link is for technical supervision only.** |
| F4 | **The web app is the office workplace** — ПТВ and the owner/manager. |
| F5 | **Audience is subcontractors with hidden works of any trade** — «від монолітчиків до інженерних мереж», not electrical only. Every «електромонтаж…» qualifier of the audience goes; `W-014 · Монтаж кабельних трас` stays as the *example* work. |
| F6 | **«Від автора» names no company.** First person, «Автор GoProceed · відповідаю протягом робочого дня». Name and photo arrive when the owner supplies them. |
| F7 | **Style:** minimal UI/UX after recognisable 21st.dev components — Announcement pill, Container Scroll product frame with Border Beam, Dot Pattern background, Grid Feature Cards, Bento, Cta-4 — plus Fora's sticky feature stack. No brutalism, no 3D, no tilt. [Corrected 2026-09-06: «no tilt» is withdrawn — pointer tilt ≤ 3° on the frame, the role cells and the channel cards, spec 2026-09-06 R2; «no brutalism, no 3D scene» stands.] |
| F8 | **Heading accent is colour, not underline**: the key phrase in every h1/h2/h3 is set in `#5568DE` text. |
| F9 | **Header**: permanent bottom hairline, links with an underline that slides in on hover and stays on the active section; four links in page order (Що зміниться · Для кого · Як працює · Питання) plus the ink button. Logo 28×28. |
| F10 | **Favicon** is the mark on a white tile. |

---

## 2. Decisions the owner took (2026-09-05)

Each was presented with a recommendation and an alternative; the owner took
the recommendation in every case. The reasoning is kept so the alternative
stays visible.

### D1 — The palette and the typeface: the whole system, or the landing only?

The prototype's palette (paper `#F6F5F1`, ink `#15161A`, cobalt `#2B4BFF`,
accent `#5568DE`, ok `#1E8F5A`, warn `#C8641F`) and typeface (Onest + JetBrains
Mono) differ from the shipped Evidence Atlas (paper `#FBFBF9`, carbon
`#11100F`, lime `#C6FF34`, Source Serif 4 + Inter). `packages/tokens/src/
tokens.json` is the **single** source for web and native: `apps/app` (25 files
import `@goproceed/ui`) and `apps/mobile` (six screens read the resolved native
tokens) name the same roles the landing does.

**Recommended: system-wide.** Change the ramps and roles in `tokens.json` once;
`apps/app` and `apps/mobile` inherit the new values through the roles they
already name, with no edit to their screens. Reasons: (a) two palettes in one
token file is the drift class this repository spends its tests preventing, and
a landing-scoped override would need a second semantic map and a generator
change; (b) the brand mark itself moves from a lime dot to a cobalt dot (§5),
so an app still painted in lime would carry a mark that no longer matches; (c)
the contrast suite (`contrast.test.ts`) re-proves every role pairing in both
themes, so readability in the app is gated, not hoped. **Cost, stated:** the
dashboard and the field client re-colour without a visual pass in this slice.
That pass is filed in `TODOS.md` as a P2 with the six viewports, and this
slice's gate still runs the app's own test suite and build.

*Alternative:* a `data-palette="daylight"` scope on the landing's `<html>`,
with a second semantic map in `tokens.json` and a generator that emits it under
that selector. Keeps the app untouched; adds a second place a role can be
typed. Not recommended.

### D2 — Where the pilot form's server side lives

Two documents say `apps/landing` is «static-first, без BFF» and its
`next.config.ts` comment says it «must never grow API routes or a Supabase
server client» (2026-07-29 baseline spec; ADR-009 §Consequences). The
prototype's handler is a Vercel serverless function; the landing is deployed as
the Vercel project `goproceed-landing` (`infra/README-staging.md` §4.4).

**Recommended: one route handler in the landing, `apps/landing/app/api/pilot/
route.ts`**, and a dated correction to the two sentences: «no product API and
no Supabase client» is the invariant; a contact-forwarding handler that reads
two environment variables and calls two public HTTP APIs is neither. Reasons:
the form and its endpoint deploy together, the fallback path (copy + mailto)
stays inside one app, and `apps/app`'s proxy, CORS allowlist and auth gate are
not widened for an anonymous public POST.

*Alternatives:* (a) `apps/app/app/api/pilot/route.ts` behind the CORS
allowlist — keeps the landing static but couples a marketing form to the
system's deploy and to `FIELD_CLIENT_ORIGINS`; (b) the Cloudflare worker in
`apps/landing/worker/index.ts` — that worker exists for the `vinext`
`build:sites` path, which is not the production deploy. Neither recommended.

### D3 — How far the new mark travels in this slice

The prototype's mark (rounded square, chevron, cobalt dot) replaces the
lime-dot ring mark. Today that mark also lives in `apps/app/public/` (nine
icon files and `manifest.webmanifest`) and `apps/mobile/assets/` (icon,
adaptive foreground/monochrome, favicon, splash).

**Recommended: everywhere, in this slice.** Replace the eight SVGs in
`design-references/brand/`, regenerate the landing's three icon files and its
`og.png`, and regenerate `apps/app/public/*` and `apps/mobile/assets/*` from
the same SVG source with a script (`sharp` is already an allowed build
dependency). One mark, one source, one commit. The mobile store listing is not
touched — that is a release action, not a file. *Alternative:* landing only,
with the app and mobile icons filed as a follow-up. Two marks would then ship
side by side.

### D4 — GSAP, Lenis, and what is not carried over

The prototype animates with GSAP 3.15 (ScrollTrigger, SplitText) and Lenis
from a CDN. `docs/design/02-building-ui.md` §4.3 rule 4 makes any animation
outside `@goproceed/ui/motion` a build failure, and the vocabulary already
covers most of what the prototype does (§6).

**Recommended: add neither.** Re-express the prototype's motion in the fifteen
primitives plus one new word (`ScrollSettle`, §6.2), and drop what the rules
forbid or the owner already excluded: Lenis smooth scrolling (native
`scroll-behavior: smooth` stays), per-element parallax (`data-depth`),
pointer tilt on the board and cards (3D — excluded by F7), magnetic buttons,
the idle drift of the receipt and pills, the pulsing status dot, the animated
dashed «flow» lines, and the perpetual Border Beam (kept, but **finite**: two
passes after the frame settles, none under reduced motion — rule 4 permits
only the marquee to run forever). `TODOS.md` records each with its reason.

[Superseded 2026-09-06 by
docs/superpowers/specs/2026-09-06-landing-prototype-parity-design.md: every
item this decision dropped except Lenis is restored inside the vocabulary; the
rules it rested on are amended there, §8.]

### D5 — Should `design-contest/` be tracked?

It is untracked in the main checkout (not ignored — simply never added), and
this spec cites it as the source. **Recommended:** commit `README.md`,
`daylight/index.html`, `daylight/api/pilot.js`, `daylight/vercel.json` and
`daylight/.env.example` as `design-references/contest-2026-09/daylight/`; leave
the nine backups and the PNG previews out. A source the tests cannot reach is
a source that quietly changes.

---

## 3. What the page is

One page, `apps/landing/app/page.tsx`, in the prototype's order. Section ids
are the prototype's, so the header links and the footer links resolve
unchanged.

| # | Section (id) | Block file | Source in the prototype |
|---|---|---|---|
| 0 | Header | `nav.tsx` | `.nav` — hairline, four links with sliding underline and active state, ink button |
| 1 | Hero | `hero.tsx` + `visuals/product-frame.tsx` (board, receipt, two pills, dimension line) | `.hero`, `.stage`, `.board`, `.receipt`, `.float`, `.dim` |
| 2 | Sources of requirements | `sources.tsx` | `.marq` — a static six-cell grid of ДБН/ПКМУ references (not a marquee) |
| 3 | `01 · Проблема` | `problem.tsx` + `visuals/fig-01.tsx` (chat + record) | `.intro`, `.fig` |
| 4 | `02 · Було і стало` (`#compare`) | `compare.tsx` | `.cmp` — two cards, five paired rows, outcomes |
| 5 | `03 · Ролі` (`#roles`) | `roles.tsx` | `.rgrid` — four feature cells with spotlight |
| 6 | `04 · Маршрут` (`#stages`) | `route.tsx` + five `visuals/ui-*.tsx` | `.stages`, `.fstack` — five sticky cards, sides alternating |
| 7 | Position | `position.tsx` | `.dome` — the quote and three pills |
| 8 | `05 · Фіксація` (`#capture`) | `capture.tsx` + three `visuals/channel-*.tsx` | `.chan` — Telegram bot, mobile app, web app; the converging chip |
| 9 | `06 · Походження` (`#trust`) | `provenance.tsx` + `visuals/access-matrix.tsx` | `.bento` — access matrix, immutability, limits of v0.1 |
| 10 | `07 · Пілот` (`#pilot`) | `pilot.tsx` + `pilot-form.tsx` (client) | `.pilot` — stepper, needs/gets/terms, author, form |
| 11 | `08 · Питання` (`#faq`) | `faq.tsx` | `.faq` — seven questions |
| 12 | CTA (`#cta-final`) | `cta.tsx` | `.cta` — light card, two actions (the second copies a link for ПТВ) |
| 13 | Footer | `footer.tsx` | four columns, disclaimer |

The numbered hairlines between sections are one shared component (§6.1
`SectionRule`). The Dot Pattern background is one fixed, `aria-hidden` layer
in `layout.tsx`, masked to the top of the page as in the prototype.

Everything in `apps/landing/components/blocks/` and `components/visuals/` that
belongs to the Evidence Journey page (`evidence-journey*`, `field-review*`,
`readiness-*`, `trust-boundary`, `live-dossier`, `journey-scene`,
`evidence-rail`, `marker-text`, `pilot-enquiry*`) is deleted, not kept
alongside. The three raster assets they used (`blueprint-folio.png`,
`cable-tray-evidence.png`, `verified-stamp*.png`, `hero-evidence.jpg`) leave
`apps/landing/public/images/`; the four prototype crops arrive as
`public/images/photo-{blueprint,tray-card,tray-thumb,tray-wide}.jpg` (31–159 KB,
served through `next/image`).

---

## 4. Design system

### 4.1 Colour — the ramps

All colours are OKLCH triples; the hex is output (`palette-derivation.test.ts`).
Every step keeps a ruling of at least ten characters (`token-fidelity`). Names
are chosen so that no consumer has to be renamed: `neutral-*`, `amber-*`,
`danger-*`, `blue-*`, `violet-*` keep their names; `signal-*` (lime) is
**deleted** and two ramps arrive.

| Ramp | Change | Anchor steps (hex is illustrative; the triple is the source) |
|---|---|---|
| `neutral` | re-tuned to the prototype: warm paper, cool ink. Steps are independent triples, so the light end sits at hue ≈ 95 and the dark end at hue ≈ 270 — the ruling on each step says so. | 0 `#FFFFFF` · 25 `#F6F5F1` paper · 50 `#EFEEE8` paper-2 · 100 `≈#E9E8E2` · 150 `≈#E2E1DE` · 200 `≈#D9D9D6` (line, ≈ ink at 9 % on paper) · 300 `≈#CFCFCC` (line-2, ≈ ink at 16 %) · 400 `#A9ACB3` ink-4 · 500 `#7A7E87` ink-3 · 600 `≈#5E626B` (body-text floor, see §7.3) · 700 `#4E5158` ink-2 · 800 `≈#3A3D45` · 900 `#2A2C33` (ink hover) · 950 `≈#1E1F24` · 975 `#15161A` ink |
| `cobalt` | **new — THE MARK.** Replaces `signal` as the accent and `blue` as the review/focus/link hue. | 50 `≈#F4F6FF` · 100 `≈#EAEDFF` (soft, = cobalt at 10 % on white) · 200 `≈#D5DBFF` · 300 `#9AAAFF` (the accent on ink; dark-mode fg) · 400 `#5568DE` **accent** (large text only, 4.4:1 on paper) · 500 `#2B4BFF` **mark** (5.4:1 on paper, 5.9:1 on white) · 600 `≈#2440D9` hover / link · 700 `≈#1E36B8` review text · 800 `≈#172A8C` · 900 `≈#101D5E` |
| `green` | **new** — «ok». The ready state stops being lime. | 50 · 100 `≈#E8F4EE` chip ground · 200 · 300 · 500 `#1E8F5A` ok (icons, dots — 4.1:1, **not** text on white) · 600 · 700 `≈#17754A` ready as text (≥4.5:1 on white and on green-100) · 800 · 900 |
| `amber` | re-hued to the prototype's warn orange | 500 `≈#E07A32` icon · 600 `#C8641F` warn (3.96:1 *[corrected 2026-09-05 from «3.9:1»; the ruling in tokens.json carries the measured figure]* — icons and stamps, **not** text) · 700 `≈#A6511A` attention text · 100 `≈#FAEFE8` chip ground (= warn at 10 %) |
| `danger` | unchanged | the app's blocked red |
| `blue` | **deleted** — every consumer moves to `cobalt` | |
| `violet` | unchanged (viz only) | |

Where the prototype paints a colour at partial alpha over paper (`--line`,
`--cobalt-soft`, `--ok-soft`, `--warn-soft`), the token is the **opaque
composite** on the ramp, not `{ ref, alpha }`: the contrast suite measures
composites, and a line that is only ever seen on paper does not need to be
translucent.

### 4.2 Colour — the roles

Changed or added in `semantic.color`; every role keeps a light/dark pair and a
`tw` name, and every text role gains a row in `contrast.test.ts`'s `PAIRS`.

| Role (`tw`) | Light | Note |
|---|---|---|
| `bg-canvas` (`canvas`) | neutral-25 | paper |
| `bg-subtle` (`subtle`) | neutral-50 | paper-2: the «was» card, inset grounds |
| `bg-inverse` (`inverse`) | neutral-975 | ink |
| `bg-signal` (`signal`) | cobalt-500 | |
| `text-on-signal` (`on-signal`) | neutral-0 | white on cobalt — 5.9:1 |
| `text-accent` (`accent`) **new** | cobalt-400 / dark cobalt-300 | the highlighted phrase in a display heading (F8). **Large text only**: proven at 3.0:1, never body copy — the substitution table says so |
| `text-brand` (`brand`) | cobalt-700 | «ready»/brand as text |
| `text-link` (`link`) | cobalt-600 | |
| `border-focus` (`focus`) | cobalt-500 | the prototype's outline |
| `border-accent` (`line-accent`) **new** | cobalt-500 | the selected card's edge |
| `bg-accent-soft` (`accent-soft`) **new** | cobalt-100 | the selected card's ring ground, the paired-row wash, the review tag ground |
| `action-primary-*` (`action`, `action-fg`, `action-hover`) | neutral-975 / neutral-0 / neutral-900 | the ink button — unchanged as roles |
| `action-signal-*` (`action-signal`, `-fg`, `-hover`) | cobalt-500 / neutral-0 / cobalt-600 | the one accent action, when a screen has one. **The landing uses none** — its primary is ink (prototype). Rule 10 of §4.3 changes from «exactly one» to «at most one» with a dated correction |
| `status-ready-*` | green-100 / green-200 / green-700 | |
| `status-review-*` | cobalt-100 / cobalt-200 / cobalt-700 | «на розгляді» |
| `status-attention-*` | amber-100 / amber-200 / amber-700 | |
| `status-blocked-*` | unchanged (danger) | see §7.4 |
| `evidence-satisfied` / `-pending` | green-700 / amber-800 | |
| `viz-1…5` | cobalt-600, green-600, amber-600, danger-600, violet-500 | *[corrected 2026-09-05: the fourth was written `danger-500`; `tokens.json` has always had `danger-600`, and `viz-*` was untouched by this branch — the spec row was loose, not the token]* |

`text-primary`, `text-secondary`, `text-muted`, `text-subtle`, `border-*`,
`bg-surface`, `bg-muted`, `bg-overlay`, `text-on-inverse*` keep their step
names and take the re-tuned values.

### 4.3 Typography

| Token | Value | Why |
|---|---|---|
| `font.display` | `'Onest Variable', Onest, system-ui, sans-serif` | the prototype sets every heading in Onest; the `.display` class keeps its job (opt-in, marketing headings) but no longer names a serif |
| `font.sans` | the same Onest stack | body, UI, figures. Verified on `@fontsource-variable/onest` **5.3.1** (2026-09-05, `npm view`): `wght` axis 100–900, `tnum` in the latin subset (digits), and Іі Її Єє Ґґ in the cyrillic subset — the two things the Inter ruling was about |
| `font.mono` | unchanged (JetBrains Mono Variable) | |
| `font.features` | `"tnum"` is applied by the `tabular` utility as today; Onest has no `cv01`/`ss03`, so the value becomes `"calt"` and the ruling says why | |
| `fontWeight` | 400 / 500 / 600 / 700 | the 510/590/680 rulings were measured on Inter; the prototype sets Onest at 500/600/700 |
| `text.mkt-display-1` | `clamp(38px, 5.2vw, 66px)` | the hero h1 |
| `text.mkt-display-2` | `clamp(28px, 3.3vw, 44px)` | section h2 |
| `text.mkt-display-3` | `clamp(24px, 2.6vw, 34px)` | the h3 inside a route card |
| `text.mkt-lead` | `clamp(16px, 1.25vw, 19px)` | |
| `leading.display` | 1.05 | prototype h1/h2 |
| `tracking.tightest / tighter / tight` | −0.035em / −0.03em / −0.025em | prototype h1 / h2 / h3 |

Product scale (`micro`…`display`), `leading.*` other than `display`,
`tracking.normal/wide` are untouched.

Loading: `apps/landing/app/layout.tsx` imports `@fontsource-variable/onest`
and `@fontsource-variable/jetbrains-mono`; `@fontsource-variable/inter` and
`@fontsource-variable/source-serif-4` leave the landing's `package.json`.
Under D1 recommended, `apps/app/app/layout.tsx` swaps its Inter import for
Onest in the same commit (one line; its `globals.css` comment about
Manrope/Inter takes a dated correction). `apps/mobile` loads no web font today
and is unaffected.

### 4.4 Radius, shadow, container, control height

| Token | Value | Prototype |
|---|---|---|
| `radius.control` | 6px (kept, app) | |
| `radius.field` | 8px | inputs, the UI-window inner cards |
| `radius.panel` | 10px | UI windows inside the route cards, the marketing `lg` button *[corrected 2026-09-05: this row said «buttons» unqualified and gave the prototype's `.btn` as 10px. The prototype's `.btn` is **9px** (`design-references/contest-2026-09/daylight/index.html`), mapped to the existing 10px `panel` token rather than adding a fifth radius; and only `Button`'s `lg` size carries it — the app sizes (`default`, `sm`, `icon`) keep `radius.control` 6px, which is what the row above always said. `Button.tsx` `SIZE.lg` and `apps/landing/tests/ui-components.test.tsx` hold the line.]* |
| `radius.card` | 12px | `--r: 12px` — the fig, form, pneed cells |
| `radius.surface` | 14px | route cards, role grid, bento cells, compare cards, channel cards, the board |
| `radius.section` | 16px | the CTA card |
| `shadow.raised` | `0 1px 2px` ink 4 % | kept |
| `shadow.overlay` | `0 12px 30px −16px` ink 35 % | the hero pills |
| `shadow.float` | `0 20px 50px −30px` ink 22 %, `0 1px 2px` ink 5 % | the prototype's `--sh`: board, receipt, form, route cards |
| `shadow.modal` | kept | |
| `container.marketing` **new** | 1180px | the prototype's `.wrap`; `container.content` (1240) stays the app's cap |
| `component.control-height-marketing` **new** | 42px | the prototype's buttons and inputs; `Button` gains `size="lg"` reading it |
| `component.header-height-marketing` | 58px | the prototype's bar |

Breakpoints stay `md` 768 and `wide` 1240 — no third one. The prototype's
800–960 collapses map to `md`, its 1180 adjustments to `wide`; the §6 visual
pass at 768 and 1024 decides per block whether a two-column layout holds at
`md` or waits for `wide` (the route cards wait for `wide`).

### 4.5 Documents

- `DESIGN.md` — rewritten for Daylight in the same frontmatter shape (name,
  colours, typography, rounded, spacing, components) with the Evidence Atlas
  prose replaced: overview, colours, typography, shapes, components, do/don't.
- `docs/design/01-tokens.md` — regenerated (`pnpm --filter @goproceed/tokens
  generate`), never hand-edited.
- `docs/design/02-building-ui.md` — dated corrections, not rewrites: the
  substitution table gains `text-accent` (large text only), `size="lg"`, «no
  lime anywhere — `bg-action-signal` is cobalt and the landing has none»; §4.3
  rule 10 becomes «at most one»; §9's «one serif for display… Inter» and «Lime
  is the next action» sentences get their correction; §8.3 of the rewrite
  plan records `ScrollSettle`.
- `docs/design/03-ui-references.md` — a new section «Landing references —
  21st.dev patterns»: which component each block is built after, that
  21st.dev entries are taken as **structure and restyled in roles** (no
  registry install, no pasted CSS variables), and the Fora sticky stack.
- `design-references/visual-directions/README.md` — Direction 04 «Daylight»
  appended; Direction 02 «Evidence Atlas» marked *superseded 2026-09-05 — the
  owner's design contest chose the light prototype; reasons in
  `design-contest/README.md`*.
- The rewrite plan's §9 landing catalogue gets a one-line pointer to §3 of
  this spec.

### 4.6 What D1 changes outside the landing (recommended answer)

`apps/app`: one import line in `app/layout.tsx`; every role re-colours by
itself. `apps/mobile`: nothing to edit; the native generator resolves the new
hex. The gate runs both apps' typecheck, tests and build. A `TODOS.md` P2 files
the six-viewport visual pass of the dashboard and the field client under the
new palette, and names the two screens most likely to need a hand: the
sign-out dialog and the OTP form, which use the `signal` button variant.

**Correction, found in Plan 1 Task 3 (2026-09-05):** `apps/app/app/globals.css`
is a legacy stylesheet with its own hard-coded theme; only the dashboard under
`/dash/**` (`dash-theme.css` → `@goproceed/ui/base.css`) and `apps/mobile` are
on the token system. The field-client pages of `apps/app` keep the Evidence
Atlas palette and Inter until the Phase 4 restyle; the P2 in TODOS names them.

---

## 5. Brand mark

### 5.1 The mark

The prototype's 24-unit mark: `rect x=2.5 y=2.5 w=19 h=19 rx=5` stroked 1.8 in
ink; path `M6.5 15.5 12 8l3.2 4.4` stroked 1.8 round; circle `16.8, 15.6 r 1.9`
filled cobalt. Scaled to the 1024 grid of the existing brand files.

### 5.2 Files (source of truth: `design-references/brand/`)

| File | Content |
|---|---|
| `goproceed-mark.svg` | mark on transparent, ink strokes, cobalt dot |
| `goproceed-landing-icon.svg` | the favicon: **white tile** `rx` ≈ 25 %, mark at 80 % (F10) |
| `goproceed-app-icon.svg` | ink tile, paper strokes, cobalt dot (the app icon) |
| `goproceed-maskable-icon.svg` | same at 78 % safe area |
| `goproceed-adaptive-foreground.svg` | paper strokes + cobalt dot at **60 %** *[corrected 2026-09-05: this said 78 %, the figure that is correct for the row above it. The PWA maskable icon has an 80 % safe area (radius 0.4 of the canvas); Android's adaptive icon draws a 108dp canvas, displays 72dp and guarantees only the central **66dp** — radius 0.306. At 78 % the mark's outermost corner measured 0.399 of the width on the rendered PNG, past both the safe circle and the 0.333 hard crop, so a circular launcher mask sliced the rounded square's corners off. At 60 % it measures 0.307. The monochrome twin carries the same scale; `goproceed-maskable-icon.svg` stays at 78 %.]* |
| `goproceed-adaptive-monochrome.svg` | white, dot ring masked out |
| `goproceed-mask.svg` | black on transparent (Safari pinned tab) |
| `goproceed-solid-background.svg` | ink |

The current eight files are replaced in place; git history keeps the lime mark.

### 5.3 Generated icons (`scripts/generate-brand-icons.mjs`, new)

One script, `sharp`, reads the SVGs above and writes: `apps/landing/app/
icon.png` (512), `apple-icon.png` (180), `favicon.ico` (a 64-px PNG-in-ICO as
today) — from the white-tile SVG; and, under D3 recommended, `apps/app/public/
{icon.svg, favicon-16/32.png, favicon.ico, icon-192/512.png,
maskable-icon-512.png, apple-touch-icon.png, safari-pinned-tab.svg}` and
`apps/mobile/assets/{icon, android-icon-foreground, android-icon-monochrome,
favicon, splash-icon}.png` at their current pixel sizes. `manifest.webmanifest`
and `app.json` are not edited — the file names and sizes are preserved.

`apps/landing/public/og.png` (1200×630) is regenerated by the QA script (§9.4)
from a `/og` route that renders the hero copy and the mark at that size. The
old picture shows the superseded design.

`BrandMark` in the landing renders the inline SVG (28×28 by default, F9), not
`icon.png` — the mark is three vector shapes and an image request for it is
waste.

---

## 6. Components and motion

### 6.1 `packages/ui/src/components` — what is added, and what is reused

The owner's list, mapped onto the inventory. Each new component: file,
`index.ts` export, and a `Case` in `/kitchen-sink/components` — all three, the
third now gated by `component-contract.test.ts`.

| Need | Decision |
|---|---|
| Announcement pill | **new `Pill`** — `badge`, children, trailing arrow; `asChild` for the link. `rounded-pill`, `border-line-strong`, `bg-surface`; hover darkens the border and nudges the arrow (transform, `duration-fast`) |
| Section separator with number | **new `SectionRule`** — `aria-hidden` hairline with the mono label sitting on it (`01 · Проблема`); takes `index` and `label` |
| Feature grid cell | **new `FeatureGrid` + `FeatureCell`** — 1px-gap grid on `bg-line-strong` with `rounded-surface` and `overflow-hidden`; cell: icon slot, title + sub, body, «get» list; **spotlight** on hover (a client leaf that writes `--gp-spot-x/y` on pointer move; the dot layer's opacity transitions) |
| Bento cell | **new `Bento` + `BentoCell`** — `span?: "rows-2"`; cell is `bg-surface border-line-strong rounded-surface` with the padding scale |
| Before / after cards | **new `ComparePair` + `CompareCard`** — `tone: "was" \| "now"`; header (mono eyebrow + title), rows `{ question, answer, ref? }`, outcome slot. «was» is dashed on `bg-subtle`; «now» is `border-accent`-tinted, lifted 12px, `shadow-float`. Paired-row highlight is **CSS `:has()`** on the pair container, no JS |
| Stepper | **new `Stepper` + `Step`** — vertical, `when` / title / body; the progress line and the dots are driven by `InViewProgress` (`--gp-progress`); reduced: complete from the first paint |
| FAQ accordion | **existing `Accordion`**, gains `marker?: "chevron" \| "plus"` — the prototype's circled plus that fills with ink and rotates |
| Status tag | **existing `Chip`**, gains `dot?: boolean` (the prototype's leading dot); `tone` unchanged |
| Form field | **existing** `Field*`, `Label`, `Input`, `Textarea`, `Select` (Radix); the marketing height comes from `size="lg"`/the new control token, not from a class literal |
| Buttons | **existing `Button`** — `primary` (ink) and `outline`; gains `size="lg"` |

Everything else is a landing block or visual (§3) and stays in `apps/landing`.
The board, the receipt, the five UI windows, the three channel devices, the
chat and the access matrix are one screen's domain picture each.

### 6.2 Motion — the prototype's choreography in the vocabulary

| Prototype | Becomes |
|---|---|
| SplitText line masks on every heading (`.lines`) | `Reveal` on the heading. Per-line masking has no primitive and a heading arriving as one block is the system's answer |
| `[data-up]` | `Reveal`; sibling groups `Stagger` / `StaggerItem` |
| Hero h1 | `TextBlurIn` (use 1 of 2) |
| Hero stage, receipt, pills, cards | `Reveal` (delayed), `Stagger step="loose"`, `CountUp` on the three column counts |
| **Container Scroll** — the frame tilted `rotateX(18deg) scale(.94)` flattening as it scrolls in | **new primitive `ScrollSettle`** (§7.3 decision): a wrapper with `perspective`, `useScroll` over the element's entry and `useTransform` to `rotateX 18→0`, `scale .94→1`. **Scroll-linked element 1 of 2.** Below `md`: flat, no perspective. Reduced: flat from the first paint. Recorded in the rewrite plan's §8.3 |
| Border Beam (`conic-gradient` + `@property --a`, infinite) | CSS in `base.css` as `@utility beam`: the same conic mask, `animation-iteration-count: 2` starting when the frame is in view (a `data-settled` attribute set by `ScrollSettle` at progress 1), `motion-reduce: none`. Rule 4 is satisfied by being finite; the marquee stays the only perpetual one |
| Intro statement, word-by-word tint on scroll | `ScrollTint` — its one permitted use. **Scroll-linked element 2 of 2** |
| The position quote, word-by-word | `Reveal`. The «dim» prefix is `text-muted` statically |
| Fora sticky stack — cards stick at `top: 90px`; the previous card scales and veils as the next arrives | `position: sticky` in CSS; the scale/veil scrub is **dropped** (it would be a third scroll-linked element per card). Cards `Stagger` on entry. Below `wide` and under reduced motion: static stack |
| Roles / channels / bento / compare entrances | `Stagger` |
| «now» card check marks appearing in turn | `StaggerItem` per row (opacity + y) |
| Pilot stepper progress on scroll | `InViewProgress` on the stepper: the line is `scaleY(var(--gp-progress))`, each dot's opacity a `calc(clamp())` against its threshold |
| Header active link | `IntersectionObserver` in the `Nav` client leaf; the underline is a CSS `scaleX` transition |
| FAQ open/close (GSAP height) | existing `Accordion` (`grid-template-rows`) |
| Buttons hover `translateY(-1px)` | `Press` inside `Button` as today; no lift |
| Lenis, parallax, tilt, magnetic, idle drift, pulsing dot, dashed flow | dropped (D4) [2026-09-06: all restored but Lenis — see the parity spec §3] |

The two scroll-linked elements are in different folds (hero; problem
statement) — rule 9 holds. [2026-09-06: rule 9 was rewritten by the parity slice — scroll-linked compositions are the ones the parity spec §3 names, one per section; see docs/superpowers/specs/2026-09-06-landing-prototype-parity-design.md §8]

### 6.3 Background

The Dot Pattern: `.landing-dot-grid` already exists in `apps/landing/app/
globals.css`; it gains the prototype's radial mask (70 % × 55 % at top centre)
and is placed once in `layout.tsx` as a fixed, `aria-hidden`, `pointer-events-
none` layer. `.landing-hero-field`, `.landing-marker-accent`,
`.landing-glass-nav`, `.landing-blueprint`, `.landing-paper-grid` and
`.readiness-workflow-endpoint-pulse` are deleted with the blocks that used them.
`.landing-marker-accent` is replaced by the `text-accent` role and a
`AccentText` helper that wraps the accent phrase (the old `MarkerText`,
renamed, with the marker CSS gone).

---

## 7. Deviations from the prototype, and why

| # | Prototype | Here | Reason |
|---|---|---|---|
| 7.1 | GSAP/Lenis choreography, tilt, magnetic, drift | see §6.2 and D4 | rules 4–5, F7 [withdrawn 2026-09-06, parity spec §3] |
| 7.2 | Beam runs forever | two passes on settle | rule 4 [withdrawn 2026-09-06, parity spec §3] |
| 7.3 | `--ink-3 #7A7E87` for captions and metadata (3.7:1 on paper) | `text-muted` is one step darker (`≈#5E626B`, ≥4.5:1 on every ground it lands on); `#7A7E87` is `text-subtle`, large/non-text only | `contrast.test.ts` — muted copy on canvas ≥ 4.5:1 |
| 7.4 | «Заблоковано» tags in warn orange | `status-blocked` stays the app's red; the two blocked cards on the board read in red | one role, one meaning across app and landing; orange is «attention» there |
| 7.5 | `.cmp-card.now` cobalt-tinted shadow | `shadow-float` (neutral) | four shadows, none coloured [withdrawn 2026-09-06, parity spec §3] |
| 7.6 | breakpoints at 560/640/800/860/900/960/1180 | `md` 768 and `wide` 1240 | two breakpoints, by ruling |
| 7.7 | 1180px column via `.wrap` | `container.marketing` 1180 | added as a token, not a literal |
| 7.8 | Google Fonts CDN | self-hosted `@fontsource-variable/onest` | no third-party request; the repo's pattern |
| 7.9 | native `<select>` | `@goproceed/ui` `Select` | «building a second control» rule |
| 7.10 | Per-instance rate limit in the handler | the same, and `TODOS.md` says it is per instance and resets on cold start | honest about serverless; pilot scale |

---

## 8. Content

`apps/landing/content/landing-content.ts` is replaced with the prototype's
copy, typed per section, `as const`. Section keys, in order: `nav`, `hero`,
`sources`, `problem`, `compare`, `roles`, `route`, `position`, `capture`,
`provenance`, `pilot`, `faq`, `cta`, `footer`. Every string the page shows
comes from this file or from a visual's demonstration record (the board,
Рис. 01, the five UI windows, the access matrix), which live beside their
visual in `content/demo-records.ts` and are labelled demonstration data in the
footer disclaimer exactly as the prototype does.

`landing-metadata.ts`: title `GoProceed — робота готова до приймання, коли
доказ на місці`, the prototype's description, `uk_UA`, the regenerated
`og.png`, and the three icon entries unchanged in shape.

`content/pilot-mail.ts` → `content/pilot-request.ts`: `PilotFields`,
`buildPilotMessage` (the prototype's seven lines), `buildPilotMailto`,
`validatePilotFields` (name and contact required; lengths 120/160/160/60/2000;
control characters stripped), `PILOT_EMAIL`.

**Forbidden in public copy** (pinned by `landing-content.test.ts` over every
string in both content files): `електромонтаж` in any audience phrase
(`Монтаж кабельних трас` as the example work is allowed and asserted
separately), `польова вебпрограма`, `оплат` as a word (the stem inside
«передоплати» in the free-pilot terms is the one allowed form), `КЕП`,
`офлайн`, `клієнти`/`клієнтів` (customers — «поштовий клієнт», the mail
client, is not a customer claim), `економія`, `%`, any price other than «безкоштовний», any company name in the
author block, and any testimonial. **Required:** «Чернетка акта не є
підписаним документом», «потребує з'єднання» (or «активного з'єднання»),
«пілот безкоштовний», «без договору і передоплати», «Telegram-бот»,
«мобільний застосунок», «без облікового запису» beside «технагляд».

---

## 9. The pilot form

### 9.1 Client (`components/blocks/pilot-form.tsx`, `"use client"`)

Fields: `website` (honeypot — visually hidden, `tabIndex={-1}`,
`autoComplete="off"`, `aria-hidden`), `name` (required), `company`, `role`
(Select, five options), `contact` (required — «Телефон або Telegram»),
`context` (textarea). Submit → `POST /api/pilot` JSON. States, announced
through one `aria-live="polite"` region:

- **sent** — «Заявку надіслано. Відповім протягом робочого дня на вказаний
  контакт.», form reset;
- **failed** (non-2xx, network, or `ok:false`) — the message text plus «Надіслати
  на: <address>» is copied to the clipboard where the API allows; the error
  card shows the address as a `mailto:` and the «Відкрити поштовий клієнт»
  button (`buildPilotMailto`);
- «Скопіювати текст заявки» is always available beside the submit button;
- required-field failure focuses the first empty required field, no request.

With JavaScript unavailable the form renders, the address is visible in the
copy under it, and nothing claims to have sent anything.

### 9.2 Server (`app/api/pilot/route.ts`, Node runtime)

`POST` only (`405` otherwise); `Cache-Control: no-store`; body parsed as JSON;
honeypot filled → `200 {ok:true}` and nothing delivered; `validatePilotFields`
→ `400 {ok:false,error:"required"}`; in-memory limit 5 requests / 10 min per
`x-forwarded-for` → `429`; delivery to whichever channels are configured —
Telegram `sendMessage` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) and Resend
`POST /emails` (`RESEND_API_KEY`, `PILOT_TO_EMAIL`, `PILOT_FROM_EMAIL`), both via
`fetch`, no SDK; none configured → `503 not-configured`; all fail → `502
delivery`; any succeed → `200 {ok:true, via:[…]}`. Stores nothing; logs only a
failure reason, never the fields.

The delivery step is a pure module (`app/api/pilot/deliver.ts`) taking `fetch`
and `env` as arguments so the tests inject both. Before writing it, the
current Telegram Bot API `sendMessage` and Resend `POST /emails` docs are read
and their URLs cited in the commit (CLAUDE.md third-party rule).

### 9.3 Configuration

`apps/landing/.env.example` with the five variables; `turbo.json` declares
them for the landing's `build`/`dev`/`test` tasks (strict env); the Vercel
project `goproceed-landing` gets them in the dashboard (owner action —
`infra/README-staging.md` §4.4 gains the list); `apps/landing/AGENTS.md`
gains a «Pilot form delivery» section below the generated Next block.

### 9.4 Tests

`apps/landing/tests/` is rewritten around the new page:

| File | Pins |
|---|---|
| `landing-content.test.ts` | section keys in order; the forbidden and required strings of §8; F1–F6 |
| `landing-render.test.tsx` | one `h1`; the fourteen section ids in order; four nav links in page order; the board's three columns and the selected card; the five route cards with their codes; the access matrix rows; seven FAQ entries; the form's fields, honeypot attributes, `aria-live`; the footer disclaimer; no `aria-disabled` |
| `metadata.test.ts` | title, description, OG image, icons |
| `design-contract.test.tsx` | the new contract id `user-approved-daylight-2026-09-05` [2026-09-06: now `user-approved-daylight-parity-2026-09-06`, and the FORM line names the parity spec] |
| `pilot-request.test.ts` | message, mailto, validation, control-character stripping |
| `pilot-route.test.ts` | 405 / 400 / honeypot-200-no-delivery / 429 / 503 / 502 / 200-via, with injected `fetch` and env |
| `pilot-form.test.tsx` | sent state; failed state shows the address, the mail button and copies the text; required focus; copy button |
| `use-reduced.test.ts` | kept |
| `qa/landing.mjs` (puppeteer 25.8.0, added to the landing's devDependencies at the version the workspace already carries) | builds and starts the app; at 1920 · 1440 · 1240 · 1024 · 768 · 390 · 360: screenshots every 80 % of the viewport into `qa-output/` (gitignored), `document.documentElement.scrollWidth === innerWidth`, no element's right edge past the viewport, zero console errors; a second pass with `prefers-reduced-motion: reduce`; writes `og.png` from `/og` |

`packages/testing` needs no new file: `token-fidelity`, `palette-derivation`,
`contrast` (with the new `PAIRS` rows), `primitive-leak`, `component-contract`
(kitchen-sink parity for the seven new components), `motion-contract` and
`motion-audit` all re-run over the change.

---

## 10. Responsive, accessibility, reduced motion

Checked at the seven widths in §9.4. The board hides its first column below
`md` (the prototype's choice) and the receipt drops under it; the pills
disappear below `md`; route cards go single-column below `wide` and unstick
below `md`; the compare pair stacks with the arrow rotated; the bento is one
column below `md`; the form loses `sticky` below `md`. Touch targets keep the
44px floor through the `touch` variant; the header's four links hide below
`md` and the ink button shortens to «Пілот». Every status carries its label
next to its colour. Reduced motion: no reveals move, the frame is flat, the
beam is absent, the tint is inked, the stepper is complete, the cards are a
plain stack — a different composition, never a faster one.

---

## 11. Gate and evidence

The five commands of `02-building-ui.md` §5, in order, output pasted into the
PR; `pnpm turbo run test`, `pnpm turbo run typecheck`, `pnpm --filter
@goproceed/app build` (D1); `pnpm validate:canonical-docs`; `qa/landing.mjs`
green with its screenshots attached; the §6 visual pass in the browser at the
six widths plus reduced motion, with real Ukrainian strings — which this page
has by construction.

Commits land by slice on this branch: tokens → brand → components → content →
blocks (hero; problem+compare; roles+route; position+capture+provenance;
pilot+faq+cta+footer) → form server side → tests and QA → documents. Each
slice is green on the gate before the next starts.

---

## 12. Out of scope

Copy changes beyond the prototype; a dark theme (D6 holds — the dark pairs are
authored and inert); the dashboard and field-client visual pass under the new
palette (filed); the mobile store listing; a custom domain; analytics; any
auth or database code.
