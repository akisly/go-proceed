# GoProceed — design system rewrite: plan and specification

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-08-19

**Related decisions:** None yet. The seven design rulings D1–D7 in §3 were
adopted as reversible defaults and still need an ADR before Phase 3; D5
(retiring the frozen prototype sheet) is unruled and nothing built so far
depends on it.

**Surfaces:** `apps/landing`, `apps/app`, `packages/tokens`, `packages/ui`

**Supersedes on acceptance:** `.interface-design/system.md` §2–§3 (direction,
tokens), `design-references/visual-directions/README.md` (recommendation),
`design-references/evidence-atlas/README.md` (canonical tokens)

**Does not supersede:** `.interface-design/system.md` §4 (layout), §5
(component rulings), §6 (traps), §8 (testing split). Those were measured
against real content and survive a palette change unaltered.

---

## 0. How to read this

Every number in §4–§8 is **decided, not suggested**. Where a value came from a
measurement it says where; where it came from a reference site it says which
one and what was measured there. Nothing in this document is "roughly" — the
existing system's strongest property is that its values carry rulings, and this
rewrite keeps that property.

Three things are **not** in scope and must not drift in during implementation:
product claims, route behaviour, and the copy contract. This is a visual and
motion system. `docs/product/vision-and-positioning.md` still owns what the
page is allowed to say.

---

## 1. Reference teardown — measured values

All four references were opened in a real browser and read out of
`getComputedStyle` / `computedStyleMap` / `getAnimations`. These are the
measured values, not impressions of them.

### 1.1 folio-topaz-delta.vercel.app — the chosen direction

| Property | Measured |
|---|---|
| Body | Geist, 16px / 24px, `#171717` on `#FFFFFF` |
| Display | **Tiempos Headline (serif)** — h1 60px/60px w600; h2 48px/48px w700 ls −1.2px |
| Sub-heads | Geist 18px/22.5px w600; card titles 16px/24px w600 |
| Neutrals | ink `#171717` · muted `#737373` · border `#E6E6E6` · fill `#F5F5F5` · faint `#FAFAFA` · surface `#FFFFFF` |
| Status tints | green `#EDFAF0`/border `#C7F4D3` · blue `#EEF3FF`/`#B8D0FF` · orange `#FFF4EB` · cyan `#E8F7FC` · yellow `#FFF8E0` |
| Radii (by frequency) | **8px ×301** · 6px ×89 · 12px ×45 · 16px ×22 · 4px ×10 |
| Borders | `1px #E6E6E6` ×180 — structure is border-led, not shadow-led |
| Shadows | 94 elements carry a *transparent* ring slot; only **8** carry a real shadow: `rgba(28,40,64,.08) 0 10.85px 21.7px −4.34px` (multi-layer) |
| Buttons | h32, r6, 14px/500; primary = ink fill on white text; secondary = white + 1px `#E6E6E6` |
| Section rhythm | **112px** vertical padding on content sections, 96px on the logo strip |
| Hero | 1264px tall; centred; eyebrow pill → serif display → muted 2-line sub → dual CTA → product frame over a photographic backdrop |
| Nav | floating pill, blurred, detached from the top edge |
| Footer | white rounded card overlapping a full-bleed photo section |

**Motion, measured:**

| Transition | Duration | Easing | Count |
|---|---|---|---|
| colour / background / border / outline | 150ms | `cubic-bezier(.4,0,.2,1)` | 103 |
| opacity | 150ms | `cubic-bezier(.4,0,.2,1)` | 82 |
| filter + transform (illustrations) | 400ms | `cubic-bezier(.34,1.56,.64,1)` — overshoot | 78 |
| box-shadow | 300ms | `cubic-bezier(.4,0,.2,1)` | 12 |
| transform | 200ms | `cubic-bezier(.4,0,.2,1)` | 10 |
| accordion open/close | 200ms | `ease-out` | 9 |
| logo marquee | 35s / 40.25s | `linear infinite` | 2 |

Structural pattern worth stealing outright: the **pinned product tour** — a
sticky four-tab strip whose active tab advances with scroll progress and whose
underline animates between tabs, with the product screenshot swapping beneath
it. It is the only scroll-jacked element on the page and it earns its place.

### 1.2 linear.app — craft reference (not the direction)

Linear publishes its entire token set to the DOM. The relevant part:

| Group | Values |
|---|---|
| Type scale | micro 11 · mini 12 · small 13 · **regular 15** · large 18 · title3 20 · title2 24 · title1 36 |
| Body metrics | 15px / **line-height 1.6** / **letter-spacing −0.011em** |
| Weights | light 300 · normal 400 · **medium 510** · **semibold 590** · **bold 680** (variable-font values, not 500/600/700) |
| Families | UI sans + `"Tiempos Headline"` serif display + `"Berkeley Mono"` |
| Font features | `cv01`, `ss03` |
| Radii | 4 · 6 · 8 · 12 · 16 · 24 · 32 · 9999 |
| Header | height 72px, bg `#0B0B0BCC`, backdrop-blur **20px**, border `#FFFFFF14` |
| Layout | `--homepage-max-width: calc(1344px + 46px*2)`, outer padding 46px, inset 32px, **12-column grid** |
| Shadow | one: `0 4px 24px #0003` |
| Focus | 1px `#5E69D1` |
| Transition speed | `--speed-regularTransition: .25s` |

**Motion, measured:**

| Behaviour | Duration | Easing |
|---|---|---|
| hover / press / state (dominant curve) | **160ms** | `cubic-bezier(.25,.46,.45,.94)` (ease-out-quad) |
| colour only | 100ms | `ease` |
| large surface background | 400ms | `ease-out` |
| section enter (`staggerIn`) | 400ms | `cubic-bezier(.165,.84,.44,1)` (ease-out-quart) |
| ambient grid dots | 3.2s | `steps(1) infinite` |

Two ideas GoProceed should take from Linear and nothing else:

1. **Monospace index labels** (`FIG 0.2`, `1.0 Intake →`). An engineering-ledger
   motif that maps exactly onto GoProceed's indexed sections and evidence IDs.
2. **The scroll text reveal** — a statement paragraph whose words move from
   tertiary grey to primary as it crosses the viewport.

Linear's type scale is, step for step, the scale already in
`.interface-design/system.md`. That is a strong independent confirmation that
the product scale is right and should not be re-litigated.

### 1.3 grovia.framer.ai — reveal timing

| Property | Measured |
|---|---|
| Neutral ramp | `#FFF · #FAFAFA · #F4F4F4 · #EEE · #E6E6E6 · #DADADA · #CCC · #BDBDBD · #AEAEAE · #999` |
| Reveal | `opacity .001 → 1`, **400ms**, `cubic-bezier(.44,0,.56,1)`, `fill: both` |
| Stagger | **0 / 100 / 200ms** per sibling |
| Signature blocks | numbered feature cards (`01/02/03`) with the image bleeding past the card edge; pill CTA with a circular arrow badge; plus-sign grid crosses as decoration; large rounded section containers |

### 1.4 flexfollio.framer.website — the one animation worth copying

| Behaviour | Measured |
|---|---|
| Hero headline | per-unit `filter: blur() → 0` **plus** `opacity 0 → 1`, spring-driven (~3.25s settle), **40ms stagger per unit** |
| Secondary reveals | opacity, spring, delays 400ms / 750ms |
| About paragraph | **scroll-linked word-by-word colour reveal** — grey → ink as the section crosses the viewport |
| Counters | roll-up from 0 on enter |
| Page frame | dashed blueprint guide lines with corner dots running the full page height |
| Chips | rotated pill labels with soft gradient fills, floating beside the copy |

The dashed blueprint frame is the single most transferable idea on that page:
for a construction-evidence product it stops being decoration and becomes the
drawing sheet the whole product is about.

### 1.5 What carries over

| Take | From | Where it lands |
|---|---|---|
| Border-led structure, shadow used ≤8 times per page | Folio | §7 |
| Serif display + sans UI pairing | Folio, Linear | §5 |
| 112px section rhythm, 8px default radius | Folio | §6, §7 |
| 160ms ease-out-quad as *the* interaction curve | Linear | §8 |
| 400ms / 100ms-stagger as *the* reveal | Grovia | §8 |
| Blur-in text reveal, 40ms stagger | Flexfolio | §8, block B02 |
| Scroll-linked text reveal | Linear, Flexfolio | §8, block B05 |
| Pinned scroll tabs | Folio | block B07 |
| Mono index labels | Linear | §5, all blocks |
| Dashed blueprint guides | Flexfolio | §6 |
| Numbered feature cards, image bleed | Grovia | block B06 |

**Explicitly not taken:** Grovia's warm beige canvas (fights Paper), Flexfolio's
pastel gradient chips (fights the status palette), Linear's dark canvas (the
owner ruled light), Folio's stock photography (the product has no photographic
brand and synthetic construction imagery already exists in
`design-references/evidence-atlas/assets/`).

---

## 2. What the current system gets right, and what a palette revision breaks

### 2.1 Keep — these were measured against real content and still hold

- The **product type scale** (11/12/13/15/18/22/26/32). Independently matches
  Linear's. `micro` stays banned on `/app` and `/app/work`.
- The **two-breakpoint shell** (768 / 1240) and its three rail states.
- **44px touch floor on phone, 36px at the desk.** The audience is gloved and
  outdoors; WCAG 2.5.5 is a floor.
- **`table-fixed` on the register**, right-aligned numeric columns, widths
  measured against real longest content.
- **Cards on phone / table at the desk as two DOM renderings**, not one DOM
  reflowed with CSS.
- **Status is never colour alone.** Every readiness state carries its `ui_uk`
  label.
- Every §6 trap. Unlayered CSS, `!important` layer inversion, tailwind-merge
  needing to be taught the theme, Radix portal escape, function-valued
  `className` into `asChild`, literal Tailwind strings in tests, measuring the
  rendered element, `items-center` collapsing flex children, Ukrainian plurals.
  **These cost real rounds and none of them is a palette question.**

### 2.2 Breaks under a palette revision — must be rebuilt, not patched

| What | Why it breaks |
|---|---|
| `qa/colour-audit.mjs` | Hand-listed allowlist of the frozen palette. Must be **derived from `packages/tokens/src/tokens.json`** so the source and the guard cannot disagree. |
| `packages/testing/src/token-fidelity.test.ts` | Asserts the generated CSS matches the old 13 tokens. Rewrites with the source. |
| `apps/demo/src/styles.css` (156 KB, test-frozen byte-identical to `prototype/src/styles.css`) | Contains the old palette in ~2,100 lines and is imported into `layer(legacy)`. It cannot be edited (a test enforces byte identity) and it cannot survive. **Decision D5.** |
| `apps/demo/src/styles/theme.css` | Hand-maintains 40+ semantic names that this plan re-derives. Becomes generated. |
| `--color-accent-ink: #667f12` | Exists only because Lime is unreadable as text (1.18:1 on white). The new signal ramp gives a real 500/700/800 so this hack disappears. |
| `packages/tokens` shadow token | One shadow, sized for React Native. The new system needs four, and the RN generator must emit all four. |
| Manrope | Display duty moves to a serif. **Retire it** — three families is one too many. |

### 2.3 The one thing that is genuinely wrong today

`apps/landing/app/page.tsx` is 30 lines of inline styles. There is no landing.
Everything public renders from a 156 KB frozen prototype sheet inside
`apps/demo`. **This plan treats `apps/landing` as greenfield** — which is why
the landing half can move fast while the app half moves carefully.

---

## 3. Decisions this plan needs — ruling required before Phase 1

> **Status 2026-08-19.** Phase 1 was built against the **recommended** column of
> every row below, because a token layer has to pick something to be buildable
> at all. Each is a one-line change in `tokens.json` and nothing downstream
> hard-codes it — that is what the semantic layer is for. D5 (retiring the
> frozen 156 KB sheet) is untouched and still needs its own ruling; nothing in
> Phase 1 depends on it.


| # | Decision | Recommendation | Consequence if the other way |
|---|---|---|---|
| **D1** | Accent model | **Ink is the action colour; Signal (lime) is the state colour.** Primary buttons are near-black, exactly as Folio and Linear. Lime marks *ready / verified / next step* and never carries text. | If lime stays the CTA fill, every primary button needs the `accent-ink` workaround again and the ≤5% budget collapses on any page with two CTAs. |
| **D2** | Rail polarity in `/app` | **Flip the rail to Paper.** The "Carbon 17–21%" surface budget was derived *from* the Evidence Atlas direction that D-choice has now replaced. Under a Folio-shaped light system, Carbon retreats to: primary buttons, the mobile field chrome, and one marketing band. | Keeping a dark rail inside an otherwise light Folio-shaped system reads as two design systems in one screen. |
| **D3** | Display family | **Source Serif 4** (variable, Cyrillic, optical sizes, OFL) as the display face; Inter keeps all UI. Optional brand-only alternative: **Kyiv\*Type Serif** (Ukrainian foundry, free) for the wordmark and hero only. | Staying all-sans is safe and forfeits the single strongest differentiator available: a document product that *looks* like a document. |
| **D4** | Mono family | **JetBrains Mono** for indices, evidence IDs, figure labels, and tabular ledger keys. Cyrillic-complete. | Without a mono, the index/ledger motif in §9 has to be faked with letter-spacing, which never reads right. |
| **D5** | The frozen 156 KB sheet | **Retire it in Phase 3**, one public route at a time, each with the existing computed-property equivalence proof the `/pilot` migration already used (240 rows, every property, every pseudo-element). | Keeping it means the new landing inherits `a { color: inherit }` and `button,input,select { font: inherit }` in the lowest layer forever. |
| **D6** | Dark mode | **Ship light only in v1.** Author every semantic token as a light/dark pair in the source so dark is a generator flag, not a refactor. Folio ships a theme toggle; we ship the ramps and hold the switch. | Building dark now doubles the QA surface before the light system is proven. |
| **D7** | Where the docs live | `docs/design/` becomes the source of truth; `.interface-design/system.md` is reduced to a pointer plus its §4–§6 rulings. | Two files claiming to own the touch-target floor is exactly how one of them quietly stops being true (the §7 lesson). |

---

## 4. Token architecture

> **Phase 1 is built.** The values that were tabulated here in the first draft
> now live in **[`docs/design/01-tokens.md`](./01-tokens.md)**, which is
> *generated from the source* — every hex, every ruling and every contrast
> figure in it is computed at generation time. A hand-written token table in a
> planning document is a second place a value can be typed, and the second
> place is always the one that goes stale. That is the exact failure this
> repository already recorded once (`muted`: documented #686E6A, shipped
> #666979, name identical, nothing failing). This section keeps the
> architecture and the reasoning; the numbers are one link away and cannot
> drift from what ships.

### 4.1 Three layers, one source

```
packages/tokens/src/tokens.json          ← the ONLY hand-edited file
        │
        ├── primitive.*    ramps, scales, motion curves — no meaning attached
        ├── semantic.*     roles, light + dark pair per token
        └── component.*    only values not derivable from a role
        │
        └─ scripts/ generate:
             packages/ui/src/tokens.generated.css      --gp-* custom properties
             packages/ui/src/theme.generated.css       Tailwind v4 @theme layer
             packages/tokens/src/tokens.generated.ts   typed, web + React Native
             packages/tokens/src/tokens.dtcg.json      W3C DTCG → Figma variables
             apps/demo/qa/palette.generated.mjs        colour-audit allowlist
             docs/design/01-tokens.md                  this system's reference
```

Rules that do not change:

- **No component may name a primitive.** Tailwind enforces half of it — no ramp
  step is in the `--color-*` namespace, so `bg-neutral-200` does not compile —
  and `primitive-leak.test.ts` enforces the other half, because a raw
  `var(--gp-neutral-200)` would work perfectly and silently.
- Colours never carry baked-in alpha in the source; hex and alpha are held
  apart so each generator composes its own platform's form.
- Every entry keeps its `ruling`. A value without a ruling is not a token, and
  `token-fidelity.test.ts` fails the build on one.

### 4.2 Colour is derived, not picked

Every colour in the source is an **OKLCH triple with the resulting sRGB hex
alongside**. The hex is output. `palette-derivation.test.ts` recomputes all 58
of them and fails naming both values if one was nudged by eye.

Two things fall out of doing it this way, and neither was available to a
hand-picked palette:

**Chroma is clamped to the sRGB gamut boundary, per step.** Above roughly
L 0.90 the gamut collapses fast at green-yellow hues, so a naive ramp emits two
"different" steps that round to the same clipped colour. The test asserts that
no two steps of a ramp share a value — which is the reason the light end of a
lime ramp is otherwise unbuildable.

**The brand survives the revision by landing on it, not by being kept.**
`#C6FF34` — v1's Lime — sits *precisely* on the sRGB gamut boundary at
OKLCH L 0.9281 H 125: its own chroma is 0.2198 and the measured maximum there is
0.2200. So the maximum-chroma step of a lime ramp at that lightness **is** the
brand colour. The same holds for the other three: `amber-500` is `#F2B84B`,
`danger-500` is `#E45C55`, `blue-700` is `#3756A1`, each reproduced from its own
triple rather than copied across. Four assertions in
`palette-derivation.test.ts` hold that true.

This is a full palette revision — a 15-step warm neutral spine replacing five
flat greys, five status ramps replacing five single values, a 51-role semantic
layer that did not exist, and D1 inverting the accent model — and it costs no
brand equity. That was not a compromise; it is what the arithmetic did.

### 4.3 What the layers contain

| Layer | Count | Shape |
|---|---:|---|
| `primitive.color` | 58 | six ramps: `neutral` (15 steps, warm — hue 95, chroma 0.0025–0.0065), `signal`, `amber`, `danger`, `blue`, `violet` |
| `primitive.*` scales | 14 blocks | type, weight, leading, tracking, radius, space, breakpoint, container, duration, ease, stagger, spring, blur, font |
| `shadow` | 4 | `raised` · `overlay` · `modal` · `float` (marketing only) |
| `semantic.color` | 51 | surfaces, text, structure, action, status, evidence, data-viz — each a light/dark pair |
| `component` | 12 | rail widths, control heights, register row padding, focus ring |

The one naming decision worth stating here, because it looks arbitrary and is
not: Tailwind's colour namespace is shared by `bg-`, `text-`, `border-` and
`ring-`, so `bg-muted` (a neutral-100 fill) and `text-muted` (neutral-600 copy)
would both want `--color-muted`. They are spelled `sunken` and `ink-muted`.
`token-fidelity.test.ts` fails on any two roles claiming the same utility name,
because the later declaration would simply win and one of them would silently
change meaning.

### 4.4 Contrast is a contract

v1 recorded its ratios in comments beside the values — «8.50:1 — Slate»,
«5.86:1» — which is exactly as durable as the next person editing the value and
not the comment. `contrast.test.ts` asserts **68 pairings across both themes**
instead, and a final test fails if a foreground role is added that no pairing
covers.

It has already earned its place twice. `neutral-600` at L 0.550 cleared 4.5:1
on the canvas and on white and failed at **4.46:1 on a zebra row** — which is
exactly where a register puts its metadata; the floor moved to L 0.530. And the
dark column turned out not to be a mirror of the light one: muted copy on a
muted fill failed in dark at the same step that passed in light, so dark's
foregrounds sit one step lighter throughout. Neither would have been found by
reading.

## 5. Typography

### 5.1 Families (D3, D4)

| Role | Family | Loaded | Notes |
|---|---|---|---|
| Display | **Source Serif 4 Variable** | landing only, `display=swap`, weights 400–700 | Cyrillic + Latin, optical size axis |
| UI / body / data | **Inter Variable** | everywhere | features `cv01`, `ss03`, `tnum` on all figures |
| Index / ID / figure label | **JetBrains Mono Variable** | subset — digits, latin caps, `·`, `→` | ~12 KB subset, not the full face |
| ~~Manrope~~ | — | **retired** | display duty moves to the serif |

Variable weight axis values follow Linear's practice, not the 100-step ladder:
**400 / 510 / 590 / 680**. Inter's 500 and 600 render muddy at 13px; 510 and
590 do not.

### 5.2 Product scale — unchanged

`micro 11 · meta 12 · data 13 · body 15 · h3 18 · h2 22 · h1 26 · display 32`

Density is decided once in the base layer: `.goproceed-app { font-size: 15px }`
below 768px, `13px` at and above it. Anything that is just text **inherits**.
`micro` stays banned on `/app` and `/app/work`.

Body metrics adopt Linear's measured values: **line-height 1.6, letter-spacing
−0.011em** on body and below; `−0.02em` from h2 upward.

### 5.3 Marketing scale — new

| Token | Size | Line | Tracking | Family / weight |
|---|---|---|---|---|
| `mkt-display-1` | `clamp(40px, 5.6vw, 72px)` | 0.96 | −0.022em | serif 600 |
| `mkt-display-2` | `clamp(32px, 4vw, 48px)` | 1.02 | −0.020em | serif 600 |
| `mkt-display-3` | `clamp(26px, 2.6vw, 32px)` | 1.15 | −0.014em | serif 600 |
| `mkt-lead` | `clamp(17px, 1.4vw, 20px)` | 1.55 | −0.011em | Inter 400, `text.muted` |
| `mkt-body` | 16px | 1.6 | −0.011em | Inter 400 |
| `mkt-caption` | 13px | 1.5 | 0 | Inter 400, `text.muted` |
| `mkt-index` | 12px | 1 | **+0.08em** | **mono 500, uppercase** |

`mkt-index` is the Linear motif adapted: `П. 03 · ДОКАЗИ`, `ETAP 02`,
`EV-2026-0184`. It appears on every section and on every evidence artefact.

### 5.4 Figures

Every number the product exists to surface — money, quantity, percentage,
count — is **Inter with `font-variant-numeric: tabular-nums`**, right-aligned in
any column. `620/620` and `180/150` must differ in *shape* when their digits
share a right edge. That is what makes a shortfall scannable, and it is why the
serif never touches a figure.

---

## 6. Layout and grid

### 6.1 Marketing

- Container `1240px`, gutters 24 / 32 / 48. (Folio ran ~1104 content inside
  1568; Linear runs 1344 + 46. 1240 keeps continuity with the app's existing
  content cap so a screenshot dropped into the landing lines up.)
- **12 columns**, 24px gutter at `wide`.
- Section rhythm: **160 / 112 / 96 / 64** — hero, standard section, strip,
  mobile. Folio's measured 112px is the standard step.
- **Blueprint guides:** a 1px dashed `border.subtle` vertical rule at the
  container edge, running the full page height, with a 3px corner dot at each
  section boundary. Purely structural, `aria-hidden`, and the one decorative
  element the system permits — because on this product it is a drawing sheet,
  not an ornament. Suppressed below `md`.

### 6.2 App — unchanged

Two breakpoints (`md` 768, `wide` 1240), three shell states, 240px rail,
1240px content cap, no desktop top bar, 56px mobile bar. `.interface-design/system.md`
§4 stands. The only change is D2: the rail's colour.

### 6.3 Spacing

4px base, unchanged. Steps in use: `2 4 6 8 12 16 20 24 32 40 48 64 80 96 112 160`.
No off-grid values. `--spacing: 0.25rem` stays so Tailwind's dynamic scale is
already correct.

---

## 7. Depth and structure

Borders carry structure; shadows are rare. Folio proves the model at scale:
**180 elements** carry a 1px border, **8** carry a real shadow.

| Token | Value | Permitted on |
|---|---|---|
| `elevation.flat` | none | every panel, card and register surface — **default** |
| `elevation.raised` | `0 1px 2px rgba(17,16,15,.04), 0 2px 6px rgba(17,16,15,.04)` | hover lift on an interactive folio/card |
| `elevation.overlay` | `0 4px 12px rgba(17,16,15,.06), 0 12px 28px rgba(17,16,15,.08)` | tooltip, popover, dropdown, command palette |
| `elevation.modal` | `0 8px 24px rgba(17,16,15,.08), 0 24px 64px rgba(17,16,15,.12)` | dialog, off-canvas rail |
| `elevation.float` | `0 12px 32px rgba(17,16,15,.08), 0 40px 80px rgba(17,16,15,.10)` | **marketing only** — the one product frame per viewport |

`elevation.float` is forbidden under `/app/**`. **Do not put a shadow on a
panel.** There is still no elevation ladder — structure is a 1px border plus a
lightness shift between `bg.canvas` / `bg.surface` / `bg.subtle` / `bg.muted`.

### Radii — two contexts

| Context | Tokens |
|---|---|
| App | `control 6` · `field 8` · `panel 10` · `pill 999` |
| Marketing | `control 8` · `card 14` · `surface 20` · `section 28` · `pill 999` |

A register is not a set of cards; a landing section is. Folio's own frequency
table (8px ×301, 6px ×89, 12px ×45) is exactly this two-context split.

---

## 8. Motion system

### 8.1 Tokens

```
duration.instant   100ms   colour only                      (Linear: 100ms)
duration.fast      160ms   hover, press, state              (Linear: 160ms)
duration.base      240ms   accordion, tab, popover, chip
duration.slow      400ms   scroll reveal, section enter     (Grovia + Linear: 400ms)
duration.deliberate 640ms  hero composition, sequence step

ease.out           cubic-bezier(.25,.46,.45,.94)   ease-out-quad — THE interaction curve
ease.enter         cubic-bezier(.165,.84,.44,1)    ease-out-quart — reveals
ease.emphatic      cubic-bezier(.19,1,.22,1)       ease-out-expo — hero, line draw
ease.soft          cubic-bezier(.44,0,.56,1)       symmetric — cross-fades      (Grovia)
ease.overshoot     cubic-bezier(.34,1.56,.64,1)    ILLUSTRATION ONLY            (Folio)

stagger.tight       40ms   per word / per character         (Flexfolio)
stagger.default     80ms   per sibling in a list
stagger.loose      120ms   per section child

spring.reveal      { stiffness: 100, damping: 20, mass: 1 }   blur-in text
spring.press       { stiffness: 400, damping: 30 }            control feedback
```

### 8.2 Non-negotiable rules

1. **`transform` and `opacity` only** — plus `filter: blur()` where §8.3
   names it. Never `width`, `height`, `top`, `margin`.
2. **Never `transition: all`.**
3. **Ease-out only, never ease-in.** Ease-in stalls the first frame, which is
   the frame being watched.
4. **Never animate from `scale(0)`.** Enter from `.96`, not from nothing.
5. **No perpetual motion** except the logo marquee, and that pauses on hover
   and on `prefers-reduced-motion`.
6. **Reveal fires once.** `viewport={{ once: true, amount: 0.35 }}`. A section
   that re-animates on the way back up is a defect.
7. **`prefers-reduced-motion` is honoured unlayered**, so it beats everything.
   Under it: opacity-only, ≤120ms, no transform, no blur, no scroll-linking,
   marquee frozen, counters snap to final.
8. **One primary frame per viewport.** No nested parallax, no second scroll-
   linked element competing in the same fold.
9. Parallax, where used at all, is clamped to **3–6px** and disabled on touch.

### 8.3 Motion primitives — `packages/ui/src/motion/` ✅ built

> **Built 2026-08-19.** Twelve primitives, `packages/testing/qa/motion-audit.mjs`,
> and a live `/kitchen-sink` route. The library is **`motion` v12** imported as
> `motion/react` — `framer-motion` was renamed and the old package name is the
> deprecated one. `packages/testing/src/motion-contract.test.ts` re-parses
> tokens.json and fails if the JS spelling of a duration or curve stops matching
> the CSS one; the bridge is allowed exactly one literal number (`0.12`, the
> reduced-motion ceiling) and the test names it so a second cannot appear
> unnoticed.

Every animated thing in either app comes from this list. A bespoke
`motion.div` in a feature file is not a review failure — it is a **build**
failure: rule 5 of the motion audit fails any file outside
`packages/ui/src/motion` that imports `motion/react`. That is deliberate. Every
rule in §8.2 holds because it lives inside these fifteen files; a hand-written
`motion.div` in a block is a rule that has to be remembered instead of one that
holds.

| Primitive | Spec | Used by |
|---|---|---|
| `<Reveal>` | `opacity 0→1`, `y 16→0`; `duration.slow`, `ease.enter`; `once`, `amount .35` | every section child |
| `<Stagger>` | container; `staggerChildren: .08`, `delayChildren: .04` | lists, card grids, ledger rows |
| `<TextBlurIn>` | per word: `filter blur(6px)→0` + `opacity 0→1`; `spring.reveal`; `stagger.tight` | B02 hero headline only |
| `<ScrollTint>` | `useScroll` + `useTransform`; per word `color: neutral-400 → neutral-975` across `["start .8","end .4"]` | B05 statement |
| `<LineDraw>` | SVG `pathLength 0→1` bound to scroll progress; `ease.emphatic` | B06 evidence chain |
| `<NodeLock>` | `scale .96→1` + `opacity`, `duration.base`, delay `stagger.default` after its segment draws | B06 nodes, verified stamp |
| `<CountUp>` | 0 → value on enter, `duration.deliberate`, `ease.emphatic`, tabular figures, no easing on the last 200ms | B04 figures |
| `<Marquee>` | duplicated track, `35s linear infinite`, `mask-image` edge fade 64px, pause on hover | B03 |
| `<PinnedTabs>` | sticky container; active index from scroll progress; underline `layoutId` transition `duration.base`/`ease.out` | B07 |
| `<Lift>` | hover `y -3`, `elevation.raised`, `duration.fast`, `ease.out` | folio cards, pricing |
| `<Press>` | `scale .98` on `:active`, `spring.press`, instant | every control |
| `<CrossFade>` | outgoing `opacity→0` + `x -12`, incoming `opacity→1` + `x 12→0`, `duration.base`, `ease.soft` | B09 role tabs |
| `<TrackFill>` | `scaleX 0→1` from `origin-left`, driven by state (`filled: boolean`), never scroll position; `duration.base`, `ease.enter`. Reduced: final state, no transition. | B06 evidence rail |
| `<SlideSwap>` | outgoing/incoming `opacity` + `x ±24px` keyed by `direction: 1 \| -1`; `duration.base`, `ease.enter`. Reduced: direction dropped, becomes a cross-fade. | B06 evidence-journey step |
| `<InViewProgress>` | renders no visual of its own; publishes `--gp-progress` 0→1 on its subtree via `useInView` + `animate`, `duration.deliberate`, `ease.out`, once. Reduced: publishes 1 immediately, never animates. | B06 readiness diagram |

Two implementation notes worth keeping, because both were found by the compiler
rather than by review:

- **`<Press>` forwards no `style` prop.** An inline style is the one route a
  colour has into the DOM that neither the Tailwind namespace nor
  `colour-audit.mjs`'s arbitrary-value scan can see. A control styles itself
  with utilities or it does not style itself. (`<Marquee>`'s edge mask moved out
  of an inline style into a `marquee-mask` utility for the same reason.)
- **`useReduced()` treats Motion's `null` as reduced.** `useReducedMotion()`
  returns `null` until the media query has been read; treating that as "no
  preference" shows one frame of exactly the motion the user opted out of.

> **Update, 2026-08-30.** Twelve became fifteen. The landing evidence journey
> needed three choreographies this vocabulary had no word for:
>
> - **`<SlideSwap>`** — a swap that has a direction, because the reader caused
>   it. Deliberately a separate word from `<CrossFade>`, whose header argues a
>   cross-fade has no direction — so giving it an arrival curve would say
>   something untrue. Reduced motion drops the direction entirely and becomes
>   a cross-fade.
> - **`<TrackFill>`** — a progress line driven by application state rather
>   than scroll position. The sibling of `<LineDraw>` and deliberately not a
>   variant of it: one word with two triggers would make every call site
>   ambiguous about what advances it. Reduced motion applies the final state
>   with no transition.
> - **`<InViewProgress>`** — the only word in the vocabulary that renders no
>   visual of its own; it publishes a 0→1 value into the CSS custom property
>   `--gp-progress` for its subtree. It exists because `readiness-workflow.tsx`
>   is a diagram of one product concept — moving that drawing into this
>   package would put a domain picture into a general vocabulary, while
>   leaving it alone kept `motion/react` in `apps/landing`, which rule 5
>   forbids. So the vocabulary supplies the number and the landing keeps the
>   picture. Reduced motion publishes 1 immediately and never animates.
>
> Each is a decision under §7.3, not merely an addition — this note is that
> decision, recorded in the same change that made it.

### 8.4 App motion — deliberately smaller

The internal product gets four behaviours and no more:

- colour/background transitions `duration.instant`–`duration.fast`
- press feedback `scale(.98)`, instant
- drawer `duration.base`, transform only
- tooltip/popover `duration.fast`, opacity + `scale(.96)`

**No scroll reveals under `/app/**`.** A register that fades in as you scroll is
a register you cannot read.

---

## 9. Landing block catalogue — `apps/landing`

Fourteen blocks. Each is a component in `apps/landing/components/blocks/`, each
takes a typed content prop, and **no block invents a product claim**: copy comes
from `docs/product/vision-and-positioning.md` and carries its version marker.

| # | Block | Layout | Motion |
|---|---|---|---|
| **B01** | `NavFloat` | Floating pill, max 880px, h64, `bg.surface/.82` + blur 20px, `border.subtle`, `radius.pill`. Logo · 4 links · UK/EN · «Увійти» ghost · «Пілот» ink pill. | Mounts at `y -8 → 0` over `duration.base`; gains `elevation.overlay` after 24px of scroll. |
| **B02** | `Hero` | Centred. Eyebrow pill link (`mkt-index` + `→`) → `mkt-display-1` serif, 2 lines → `mkt-lead` ≤620px → dual CTA (ink + outline) → **product frame**: app screenshot on `bg.subtle` with a blueprint guide grid, one evidence card overlapping its lower-left corner, `elevation.float`. | Headline `<TextBlurIn>`; everything below `<Stagger>` at `stagger.loose`; frame `opacity + y 24→0` at `duration.deliberate`/`ease.emphatic`; the overlapping evidence card lands 120ms after the frame. |
| **B03** | `ProofStrip` | 96px band. **Not fake logos.** Three specification facts in `mkt-index` mono, separated by hairlines: contract form, evidence classes, decision surface. If pilot sites exist and permit it, a `<Marquee>` of names replaces it. | `<Reveal>`; marquee 35s linear. |
| **B04** | `MoneyOutcome` | The one figure block. Three indexed ledger entries on `bg.canvas`, separated by 1px `border.strong` rules — **no cards**. Each: mono index `01` · label 12px uppercase tracked `text.muted` · figure `mkt-display-3` tabular `text.primary` · denominator `text.muted`. | `<CountUp>` per figure, `stagger.default` between entries. Qualifier text does **not** animate — it is a legal statement, not a reveal. |
| **B05** | `Statement` | Full-width single paragraph, `mkt-display-3`, max 900px. The positioning sentence, verbatim. | `<ScrollTint>` word-by-word `neutral-400 → neutral-975`. This is the only place the technique is used. |
| **B06** | `EvidenceChain` | The signature block. Five nodes on one horizontal axis: `Робота → Докази → Закриття → Акт → Оплата`. Each node: mono index, `radius.control` tile, `border.default`, label, one-line state. Connector is a single SVG path. | `<LineDraw>` bound to section scroll progress; each `<NodeLock>` fires as the path reaches it, `stagger.default`. Reduced motion: path renders complete, nodes fade. |
| **B07** | `ProductTour` | Folio's pinned tabs. Sticky 4-tab strip (`Реєстр робіт` · `Вимоги та докази` · `Закриття етапу` · `Акт і рішення`), animated underline, real app screenshot beneath, `elevation.float`. Section header above is two-column: serif `mkt-display-2` left, `mkt-lead` right. | `<PinnedTabs>`. Screenshot swaps with `<CrossFade>`. The only scroll-jacked element on the page. Below `md` it degrades to a horizontally scrolling tab row with no pinning. |
| **B08** | `FieldMobile` | The **one** `bg.inverse` band. Phone with the field capture screen, server receipt beside it, sync line between. `text.on-inverse`, `border.inverse` hairlines. | Receipt `y 14→0` + opacity, `duration.base`; sync line `<LineDraw>` 360ms. |
| **B09** | `RolesDossier` | Tabbed dossier, not a card grid. Left: role rail (`підрядник` / `виконроб` / `технагляд` / `замовник`). Right: one large surface showing what that role sees. | `<CrossFade>` on switch, `duration.base`. Rail selection uses a 3px `bg.signal` bar, **absolutely positioned** so the label does not shift. |
| **B10** | `Comparison` | Folio's "why teams prefer". Table: rows = capability, columns = `Excel + Viber` · `загальна CRM` · `GoProceed`. Ink header row, `border.strong` rules, `signal-100` wash on the GoProceed column only. | `<Stagger>` on rows, `stagger.default`. No row hover animation — it is a document. |
| **B11** | `EvidenceIntegrity` | Three open policy columns on `bg.canvas` with mono column indices and hairline rules. Archive statement above. No cards, no icons. | `<Reveal>` only. |
| **B12** | `Pricing` | Editorial comparison, three plans. The recommended plan is marked by `border.strong` + an ink CTA — **never a lime fill** (D1). Feature rows share a baseline grid across all three. | `<Lift>` on hover, `duration.fast`. |
| **B13** | `FAQ` | Folio's split: sticky category rail left, accordion right. `border.default` rule between items, chevron rotates 180°. | Accordion `duration.base`/`ease.out` on `grid-template-rows` (not `height`). Chevron `duration.fast`. |
| **B14** | `FinalCTA` + `Footer` | CTA: full-bleed `bg.inverse` or the blueprint-folio asset, `mkt-display-1`, one pill CTA. Footer: `bg.surface` card with `radius.section` on its top corners, overlapping the CTA band by 48px — Folio's move. Five columns + brand + legal + UK/EN. | CTA `<TextBlurIn>` (the second and last use). Footer static. |

### 9.1 Imagery

`design-references/evidence-atlas/assets/` already holds three synthetic,
customer-data-free assets: `blueprint-folio.png`, `cable-tray-evidence.png`,
`verified-stamp.png`. B02, B08 and B14 use them. **No stock photography and no
generated mockup ships as UI** — mockups are visual QA targets, per the existing
guardrail.

---

## 10. App surfaces — `apps/app`

### 10.1 Shell

The 240 / 68 / drawer geometry is unchanged. Under D2 the rail becomes
`bg.canvas` with `border.default` on its right edge, `text.secondary` labels,
`text.primary` on the active item, and the same **3px `bg.signal` active bar,
absolutely positioned**. The `rail-*` token family collapses into the standard
neutral scale — five tokens deleted, not renamed.

Consequence to accept openly: `elevation.modal` on the off-canvas drawer now
does more work, because a light drawer over a light canvas needs the shadow to
say "this covers content" that a dark drawer said with colour.

### 10.2 Register

Every ruling in `.interface-design/system.md` §5 survives. What changes:

- Row rule `border.strong` (`#CCCAC6`) instead of `#E9EBE7`.
- Hover `bg.subtle` at 60% instead of `surface-muted/60`.
- Status chips move to the five `status.*` triplets; labels unchanged.
- The money column keeps `tabular-nums` and its shared right edge.

### 10.3 Dashboard

`MoneySummary` remains the only 32px thing on any screen. The qualifier stays
conditional wording from `src/domain/risk.ts`. `ReadinessSplit` keeps
`flex-grow: count` so the parts cannot fail to equal the whole, and keeps its
fully labelled legend.

### 10.4 Component inventory — `packages/ui`

Shadcn-shaped, shadcn-sourced, restyled onto semantic tokens. **`shadcn init`
was never run and must not be** — it rewrites the theme block in oklch and
imports Preflight.

*Rebuild (exists, retokenise):* Button (primary / signal / outline / ghost /
link — still **no destructive**), Panel, WorkRegister, SegmentedFilter,
MoneySummary, ReadinessSplit, StatusChip, Separator, Tooltip, DisclosureStrip,
EmptyState, InlineBanner.

*New (each must earn its place):* Input, Select, Combobox, Checkbox, Radio,
Switch, Textarea, DatePicker, Dialog, Drawer, Popover, DropdownMenu, Tabs,
Accordion, Toast, Skeleton, Pagination, Breadcrumb, Avatar, ProgressBar,
Timeline, Stepper, FileDrop, EvidenceThumb, CommandPalette (⌘K).

*Marketing-only (`apps/landing`):* the fourteen blocks in §9 plus the fifteen
motion primitives in §8.3.

---

## 11. Enforcement — what makes this stick

The current system's real achievement is that its rules are executable. Every
rule added here gets a test, or it is not a rule.

| Gate | What it asserts | Where |
|---|---|---|
| `qa/colour-audit.mjs` | No colour outside the generated allowlist, in hex, `rgb()`, `hsl()`, `oklch()`, `oklab()` or a Tailwind arbitrary value. **Allowlist generated from `tokens.json`,** never hand-listed. | CI, build-blocking |
| `token-fidelity.test.ts` | All six generated artefacts match the source; every generator has a guarded row; every token carries a ruling; no two roles claim the same utility name; no ramp step is reachable as a utility. | vitest (node) — **built, 14 tests** |
| **`palette-derivation.test.ts`** | Recomputes all 58 hexes from their OKLCH triples; asserts every chroma is inside the sRGB gamut, that no two ramp steps collide, and that the four v1 brand anchors reproduce. | vitest (node) — **built, 10 tests** |
| `contrast.test.ts` | 68 pairings across light and dark; ≥4.5:1 body, ≥3:1 large and non-text. Failure names the pair, both resolved values and the measured ratio. A foreground role with no pairing fails too. | vitest (node) — **built, 68 tests** |
| `primitive-leak.test.ts` | No `var(--gp-<ramp>-<step>)` under `apps/**` or in `packages/ui/src/base.css`. The exclusion list must name files that still exist, so an exclusion cannot outlive its file. | vitest (node) — **built, 2 tests** |
| **`motion-audit.mjs`** *(new)* | No `transition: all`; no transition on a property outside `transform`/`opacity`/`filter`/`color`/`background-color`/`border-color`/`box-shadow`; every animated component has a `prefers-reduced-motion` branch; no `animation-iteration-count: infinite` outside the marquee allowlist. | CI |
| `qa/verify.mjs` (puppeteer) | Rendered layout, contrast, touch targets, focus cycle, **at 1920 / 1440 / 1240 / 768 / 390 / 360**. The 768–1240 icon rail keeps its dedicated pass. | CI |
| `motion-audit.mjs` | Five rules: no `transition: all`; no transition on a layout property; no ease-in; no perpetual animation outside the marquee; `motion/react` imported only by the fifteen primitives. Comments are stripped before scanning, so the audit does not flag its own documentation. | CI + vitest — **built, 13 tests, including a fixture tree that proves each rule still fires** |
| `tw-merge.test.ts` | The class merge is taught this theme: a size and a colour sharing the `text-` prefix both survive; two values from one namespace collapse; arbitrary values still work; the config names every size and radius in the source. | vitest (node) — **built, 7 tests** |
| `component-contract.test.ts` | No component hard-codes a control height, carries a colour in an inline style, names a raw hex, defines its own focus ring, or has a destructive variant; the five status tones agree across Chip, Banner and Meter; the meter divides by count not percentage; the money figure's qualifier is required; portalled content carries its own font. | vitest (node) — **built, 14 tests** |
| `motion-contract.test.ts` | The JS spelling of every duration, curve and spring matches tokens.json; no easing in the system starts slow (`y1 < x1`) except the one symmetric cross-fade curve; the reduced-motion ceiling is the same number in CSS and in JS. | vitest (node) — **built, 6 tests** |
| **visual snapshots** *(new)* | One deterministic screenshot per landing block at 1440 and 390, animations disabled via `prefers-reduced-motion`. | CI |
| `validate-canonical-docs.mjs` | Product name, and now: no doc names a token that the source does not define. | CI |

Unchanged testing rules: QA hooks are `data-*` attributes, never class names.
Assertions name the contract, not the markup. Never write a literal Tailwind
class string in a test — Tailwind v4 scans the whole project and will emit test
fixtures as production CSS. Measure the rendered element, not the declaration.

---

## 12. Delivery phases

| Phase | Work | Exit condition |
|---|---|---|
| **P0 — ruling** | Owner decides D1–D7. Font licences confirmed. Cyrillic proofed at 11/12/13px and at `mkt-display-1`. | Seven decisions recorded in an ADR. Nothing else starts. |
| **P1 — source** ✅ | Done 2026-08-19. `tokens.json` rewritten in three layers (58 primitives, 51 roles, 4 elevations, 14 scale blocks, 12 component values). Six generators. Four test files, **94 tests, all green**. Tailwind **v4.3.3** compiles the stack — namespace reset verified (no `bg-blue-500`, no `text-sm`, no `lg:` in the output). Outstanding: `pnpm install` for the two new font packages, and pushing the DTCG file into Figma. | Done except the Figma push, which needs the desktop app open. |
| **P2a — motion** ✅ | Done 2026-08-19. Twelve primitives on `motion` v12, the motion audit, the token bridge and its contract test, `/kitchen-sink` rendering every primitive with its rule. **113 tests green.** Typecheck clean under `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. | Done. Outstanding: `pnpm install` for `motion`, and the six-viewport QA pass, which needs the app running. |
| **P2b — components** ✅ | Done 2026-08-19. Fifteen components, one dependency (`radix-ui`), the generated tailwind-merge config, and `/kitchen-sink/components` rendering each next to the ruling it carries. **135 tests green.** The motion audit gained rule 2b — Tailwind's `transition-[…]` arbitrary utility, which rule 2 could not see and which an accordion drove straight through. | Done except the six-viewport QA pass, which needs the app running. |
| **P3 — landing** | Build B01–B14 in `apps/landing`. Retire the frozen public routes one at a time (D5), each with the computed-property equivalence proof. | Landing ships at all six viewports; Lighthouse ≥95 on performance and accessibility; the 156 KB sheet is gone. |
| **P4 — app** | Retokenise the shell (D2), then the register, then the dashboard. One PR per surface with before/after chrome measurements. | Rows-in-fold at 1440×900 is **not worse** than today's 14 on `/app/work`. Every §5 ruling still holds. |
| **P5 — mobile** | RN token parity from the same source; the four elevations reach `boxShadow`. | `apps/mobile` token proof screen matches web values. |
| **P6 — freeze** | `docs/design/*` becomes source of truth; `.interface-design/system.md` reduced to a pointer + its surviving rulings (D7). | `validate-canonical-docs.mjs` passes; no document names a token the source does not define. |

Landing and app are independent after P2. `apps/landing` is greenfield and can
ship while `apps/app` migrates carefully.

---

## 13. Risks, stated plainly

| Risk | Mitigation |
|---|---|
| The 156 KB frozen sheet is byte-identical by test and imported into `layer(legacy)`. Removing it is the highest-risk item in this plan. | One route at a time, each with the 240-row computed-property equivalence proof that the `/pilot` migration already used. If a route cannot be proven equivalent, it does not move. |
| A palette revision touches web, RN and the colour guard at once. | The guard's allowlist is generated from the same source in P1, before any surface changes. Source and guard cannot disagree. |
| Serif display with Cyrillic can look wrong at small sizes. | The serif is display-only, never below `mkt-display-3` (26px), never in the app, never on a figure. Proofed in P0 before anything is built. |
| Scroll-linked motion is the easiest way to make a page feel cheap and slow. | Exactly two scroll-linked elements exist (B05 `<ScrollTint>`, B06 `<LineDraw>`) plus one pinned section (B07). One primary frame per viewport. `motion-audit.mjs` fails anything else. |
| Flipping the rail to Paper (D2) removes the product's only dark region and could flatten the shell. | `elevation.modal` on the drawer and `border.default` on the rail edge take over the job. If the P4 measurement shows the shell reads flat, D2 reverts to a dark rail — the token layer makes that a one-line change, which is the point of building it this way. |
| Fourteen landing blocks is a lot of surface for a product whose v0.1 claims are narrow. | Every block's copy carries its version marker. B06, B07 and B09 must show v0.1 behaviour only; anything v0.2 is labelled or cut. A landing that demos a refusal the product does not perform is worse than no landing. |

---

## Appendix A — reference evidence log

| Source | Method | Date |
|---|---|---|
| folio-topaz-delta.vercel.app | live DOM: `getComputedStyle` over all elements (radii/shadow/border/background/colour frequency), section geometry, transition and animation inventory, 6 viewport captures | 2026-08-19 |
| linear.app/homepage | live DOM: `documentElement.computedStyleMap()` — 387 custom properties read directly; transition/animation inventory; 5 captures | 2026-08-19 |
| grovia.framer.ai | live DOM: `document.getAnimations()` during scroll — durations, delays, easings, keyframes; neutral ramp from the injected token block; 4 captures | 2026-08-19 |
| flexfollio.framer.website | live DOM: `document.getAnimations()` — spring detection via `linear()` easing, per-unit stagger measurement; 6 captures | 2026-08-19 |

## Appendix B — palette derivation

The derivation now lives in the repository:
`packages/tokens/scripts/lib/color.mjs` — dependency-free OKLCH↔sRGB, a
binary-searched gamut boundary, and WCAG 2.1 luminance. A ramp whose derivation
depends on an npm package is a ramp nobody can reproduce in three years.

Four candidate values failed on the way to the committed source and were moved
before anything shipped. Recorded because a palette that never failed anything
is a palette nobody checked:

| Value | Found by | Was | Now |
|---|---|---|---|
| `neutral-600` | `contrast.test.ts` | 4.46:1 on a zebra row — under the floor, in the one place a register puts metadata | L 0.530, 4.85:1 on subtle, 4.53:1 on a muted fill |
| dark `text-secondary` / `-muted` / `-subtle` | `contrast.test.ts` | mirrored the light ladder; muted copy on a muted fill failed in dark | one step lighter throughout |
| `signal-500` | `palette-derivation.test.ts` | chroma rounded to 4 decimals landed outside the gamut and clipped to `#C6FF33` | 6-decimal chroma, reproduces `#C6FF34` exactly |
| dark `border-inverse` | `contrast.test.ts` | `neutral-200` on white, 1.37:1 — a hairline nobody can see | `neutral-300`, 1.64:1 |

**No value in the shipped source is unverified**, and none of the four was
found by looking at it.
