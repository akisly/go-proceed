# GoProceed design tokens — reference

**GENERATED — do not edit.** Source: `packages/tokens/src/tokens.json`.
Regenerate: `node packages/tokens/scripts/generate-docs.mjs`.
`packages/testing/src/token-fidelity.test.ts` fails if this file drifts.

**Status:** Generated from the approved source

**Applies to:** `apps/landing`, `apps/app`, `apps/mobile`, `packages/ui`

**Companion:** [design-system rewrite plan](./2026-08-19-design-system-rewrite-plan.md) — the reasoning; this file is the values.

---

## How to read this

Three layers. **A component names a role, never a ramp step.** `bg-canvas`,
`text-ink-muted`, `border-line` — not `neutral-25`. Tailwind enforces half of
that (no ramp step is in the `--color-*` namespace, so `bg-neutral-200` does
not compile) and `packages/testing/src/primitive-leak.test.ts` enforces the
other half (a raw `var(--gp-neutral-200)` fails the build).

Every colour is **derived, not picked**: each is the sRGB result of an OKLCH
triple, with chroma clamped to the gamut boundary.
`packages/testing/src/palette-derivation.test.ts` recomputes all of them.
No hex below was typed by a human.

Every contrast figure below is **measured at generation time**, not recorded
by hand. `packages/testing/src/contrast.test.ts` asserts the pairings the
product actually renders.

---

## 1. Primitive — colour ramps

Not reachable from a component. Present so the semantic layer has something
to point at, and so a chart or a generated asset can walk a scale.

### `neutral`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `neutral-0` | `#FFFFFF` | 1, 0, 95 | 1.04 | 19.01 | Pure white. The working surface a register sits on — the one place in the system with no warmth at all, so a panel reads as a sheet laid on the canvas rather than as more canvas. |
| `neutral-25` | `#FBFBF9` | 0.988, 0.0025, 95 | 1.00 | 18.35 | The canvas. Warm by 0.0025 chroma at hue 95 — measurably paper, nowhere near beige. Replaces the neutral #FBFBFB, which had no ramp behind it. |
| `neutral-50` | `#F6F6F3` | 0.972, 0.0035, 95 | 1.05 | 17.55 | Zebra rows, sunken wells, the ground under an inset control. |
| `neutral-100` | `#EFEEEB` | 0.95, 0.0045, 95 | 1.12 | 16.38 | Inactive segment, ghost-button hover on canvas, idle status ground. |
| `neutral-150` | `#E7E6E2` | 0.925, 0.005, 95 | 1.21 | 15.22 | Hairline inside a surface, and copy on ink (15.22:1 measured against neutral-975). |
| `neutral-200` | `#DDDCD8` | 0.895, 0.0055, 95 | 1.32 | 13.85 | The default border. Panel edge, input edge, divider. 1.32:1 against the canvas — visible as structure, invisible as a line you read. |
| `neutral-300` | `#CCCAC6` | 0.84, 0.006, 95 | 1.58 | 11.61 | The strong border: table rules and selected outlines, where the default border disappears against a dense grid. |
| `neutral-400` | `#B1AFAB` | 0.755, 0.0065, 95 | 2.11 | 8.68 | Non-text only on light: disabled fills, and metadata on ink (8.68:1). Never body copy on the canvas — it measures 2.11:1 there. |
| `neutral-500` | `#92918C` | 0.655, 0.0065, 95 | 3.05 | 6.02 | Metadata floor. 3.05:1 on canvas, so it clears the non-text and large-text threshold and nothing else. Never body text. |
| `neutral-600` | `#6D6C68` | 0.53, 0.006, 95 | 5.07 | 3.62 | The body-text floor, and the floor is measured against the DARKEST ground it can land on, not the lightest. At L 0.550 it cleared 4.5:1 on the canvas and on white and failed at 4.46:1 on a zebra row — which is exactly where a register puts its metadata. Measured here: 5.07:1 on canvas, 5.26:1 on surface, 4.85:1 on a subtle fill, 4.53:1 on a muted fill. Muted copy and placeholders stop at this step. |
| `neutral-700` | `#5C5B57` | 0.47, 0.0055, 95 | 6.56 | 2.80 | Secondary copy, 6.56:1 on canvas. Also the idle status foreground. |
| `neutral-800` | `#444441` | 0.385, 0.005, 95 | 9.43 | 1.95 | Hairline on ink; the only border that reads on the inverse surface. |
| `neutral-900` | `#2C2B29` | 0.29, 0.0045, 95 | 13.65 | 1.34 | Primary-action hover. One step off ink, so the press is felt without the button changing identity. |
| `neutral-950` | `#1A1917` | 0.215, 0.004, 95 | 16.96 | 1.08 | The inverse working surface — dark mode's panel, authored now and not shipped (D6). |
| `neutral-975` | `#11100F` | 0.175, 0.0035, 95 | 18.35 | 1.00 | Ink. Primary text and, under D1, the primary action fill. 18.35:1 on canvas. Replaces #171717, which was a hue-less grey; this one carries the same warmth as the paper it sits on. |

### `signal`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `signal-50` | `#F7FDEE` | 0.985, 0.020162, 125 | 1.00 | 18.32 | Faintest ready wash — a whole row tinted without becoming a chip. |
| `signal-100` | `#E9FECA` | 0.968, 0.070306, 125 | 1.04 | 17.64 | Ready chip ground. Lands within a rounding error of the legacy readiness-ready surface #EDF8D2, which is the continuity check this ramp had to pass. |
| `signal-200` | `#DDFEA5` | 0.953, 0.118258, 125 | 1.08 | 17.01 | Ready chip border. |
| `signal-300` | `#D6FE8C` | 0.944, 0.147876, 125 | 1.10 | 16.67 | Ready foreground in dark mode (8.63:1 on signal-900). |
| `signal-400` | `#CEFE6C` | 0.936, 0.180854, 125 | 1.12 | 16.31 | Signal hover. One step lighter than the mark, so hover reads as lift rather than as a different colour. |
| `signal-500` | `#C6FF34` | 0.9281, 0.219957, 125 | 1.14 | 16.07 | THE MARK. Reproduces the legacy Lime #C6FF34 exactly — and not by copying it: #C6FF34 sits precisely on the sRGB gamut boundary at OKLCH L 0.9281 H 125 (measured max chroma 0.2200, its own chroma 0.2198), so the maximum-chroma step of this ramp IS the brand colour. Brand equity survives a full palette revision because the maths landed on it. 16.07:1 against ink both ways: a ground for Carbon and a mark on Carbon. Budget: <=5% of any viewport. |
| `signal-600` | `#99C23D` | 0.76, 0.164318, 125 | 2.00 | 9.18 | Icon weight on white, where signal-500 is too light to see. |
| `signal-700` | `#6F8D30` | 0.6, 0.123731, 125 | 3.67 | 5.00 | Mid step. Not for text on white — measures 3.11:1. Kept so the ramp has an even rung, and flagged so nobody reaches for it. |
| `signal-800` | `#526628` | 0.48, 0.091798, 125 | 6.16 | 2.98 | Ready as TEXT: 6.38:1 on surface, 5.93:1 on signal-100, 6.16:1 on canvas. This step is why --color-accent-ink can be deleted: the old system needed a hand-picked #667F12 because Lime had no dark end. |
| `signal-900` | `#3B4821` | 0.38, 0.06319, 125 | 9.49 | 1.93 | Ready ground in dark mode. |

### `amber`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `amber-50` | `#FCF6ED` | 0.975, 0.013587, 80 | 1.04 | 17.69 | Faintest attention wash. |
| `amber-100` | `#FEEED4` | 0.955, 0.037836, 80 | 1.10 | 16.65 | Attention chip ground. Within a rounding error of the legacy warning surface #FFF0D3. |
| `amber-200` | `#FCDBA3` | 0.905, 0.080076, 80 | 1.28 | 14.30 | Attention chip border. |
| `amber-300` | `#F6C97D` | 0.86, 0.107432, 80 | 1.49 | 12.28 | Attention foreground in dark mode (7.89:1 on amber-900). |
| `amber-500` | `#F2B84B` | 0.8165, 0.1399, 80 | 1.73 | 10.62 | Reproduces the legacy Amber #F2B84B exactly from its own OKLCH triple (L 0.8165 C 0.1399 H 80). Icon and bar weight; never text. |
| `amber-600` | `#BF8F34` | 0.68, 0.119769, 80 | 2.82 | 6.51 | Icon on white. |
| `amber-700` | `#916E2D` | 0.56, 0.092865, 80 | 4.53 | 4.05 | Attention text on a white ground. |
| `amber-800` | `#6B5225` | 0.455, 0.069843, 80 | 7.09 | 2.59 | Attention text on amber-100 (6.43:1) and the evidence-pending foreground (7.09:1 on canvas). |
| `amber-900` | `#423319` | 0.33, 0.04529, 80 | 11.79 | 1.56 | Attention ground in dark mode. |

### `danger`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `danger-50` | `#FBF4F3` | 0.972, 0.00753, 26 | 1.05 | 17.50 | Faintest blocked wash. |
| `danger-100` | `#FCE9E6` | 0.948, 0.022039, 26 | 1.13 | 16.24 | Blocked chip ground. |
| `danger-200` | `#FBD5D1` | 0.905, 0.043269, 26 | 1.30 | 14.07 | Blocked chip border. |
| `danger-300` | `#F5BAB3` | 0.84, 0.070375, 26 | 1.61 | 11.37 | Blocked foreground in dark mode (8.00:1 on danger-900). |
| `danger-500` | `#E45C55` | 0.6484, 0.171, 26 | 3.40 | 5.40 | Reproduces the legacy Red #E45C55 exactly from its own OKLCH triple (L 0.6484 C 0.1710 H 26). Icon and bar weight. |
| `danger-600` | `#CE2F30` | 0.56, 0.195828, 26 | 4.98 | 3.69 | The one solid destructive fill: white on it measures 5.16:1. Nothing under /app/** deletes anything, so this exists for the field client and for refusal states, not for a destructive button variant. |
| `danger-700` | `#A02827` | 0.47, 0.156763, 26 | 7.17 | 2.56 | Blocked text: 6.34:1 on danger-100, 7.17:1 on canvas. Also the evidence-blocking foreground. |
| `danger-800` | `#792623` | 0.395, 0.115745, 26 | 9.59 | 1.91 | Densest blocked text, for a blocked figure inside a dense table. |
| `danger-900` | `#531E1B` | 0.315, 0.079589, 26 | 12.92 | 1.42 | Blocked ground in dark mode. |

### `blue`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `blue-50` | `#F5F7FB` | 0.975, 0.006436, 265 | 1.04 | 17.72 | Faintest review wash. |
| `blue-100` | `#E8EFFC` | 0.95, 0.018895, 265 | 1.11 | 16.46 | Review chip ground. Lands on #E8EFFC — the legacy info surface #E8EEFC to within one unit of green, which is the closest continuity in the whole palette. |
| `blue-200` | `#D4E0F9` | 0.905, 0.03653, 265 | 1.28 | 14.33 | Review chip border. |
| `blue-300` | `#BBCBEB` | 0.84, 0.048916, 265 | 1.58 | 11.64 | Link colour and review foreground in dark mode. |
| `blue-500` | `#5A7DCE` | 0.6, 0.129948, 265 | 3.85 | 4.76 | The focus ring. 3.99:1 on surface, clearing the 3:1 non-text threshold with headroom. Every focusable element inside the shell gets this one treatment. |
| `blue-600` | `#3E63BD` | 0.52, 0.147232, 265 | 5.44 | 3.37 | Links: 5.64:1 on surface. |
| `blue-700` | `#3756A1` | 0.4695, 0.1266, 265 | 6.74 | 2.72 | Reproduces the legacy informational/submitted #3756A1 exactly from its own OKLCH triple. Review text: 6.04:1 on blue-100. |
| `blue-800` | `#274181` | 0.39, 0.112526, 265 | 9.39 | 1.95 | Densest review text. |
| `blue-900` | `#1B2D5B` | 0.31, 0.085245, 265 | 12.89 | 1.42 | Review ground in dark mode. |

### `violet`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `violet-100` | `#F0EBFC` | 0.95, 0.022312, 300 | 1.13 | 16.29 | Data-visualisation only. Never a status: five statuses is the catalog, and a sixth colour reading as a state is how a legend stops being true. |
| `violet-200` | `#E4DAF9` | 0.905, 0.04319, 300 | 1.29 | 14.21 | Data-visualisation fill. |
| `violet-300` | `#D0C3EB` | 0.84, 0.057941, 300 | 1.60 | 11.48 | Data-visualisation on dark. |
| `violet-500` | `#916CCD` | 0.61, 0.145512, 300 | 3.88 | 4.73 | The fifth categorical series. |
| `violet-700` | `#60438D` | 0.45, 0.120193, 300 | 7.55 | 2.43 | Fifth series, dense variant. |
| `violet-900` | `#36284D` | 0.31, 0.066342, 300 | 12.93 | 1.42 | Fifth series ground in dark mode. |

---

## 2. Semantic — roles

This is the layer a component reads. `tw` is the name inside Tailwind's
shared colour namespace, which `bg-`, `text-`, `border-` and `ring-` all
draw from — so `bg-canvas`, `text-ink`, `border-line`.

The dark column is **authored and not shipped** (D6). Nothing sets
`data-theme` in v1; every dark pairing is nonetheless asserted today, so
turning it on is a decision rather than a project.

### Surfaces

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `bg-canvas` | `canvas` | `neutral-25` `#FBFBF9` | `neutral-975` `#11100F` | The page. Paper, not white — white is reserved for the surface a register sits on, and the two must differ or the panel stops reading as a sheet. |
| `bg-surface` | `surface` | `neutral-0` `#FFFFFF` | `neutral-950` `#1A1917` | The working surface. Panels, cards, table bodies. |
| `bg-subtle` | `subtle` | `neutral-50` `#F6F6F3` | `neutral-900` `#2C2B29` | Zebra rows, sunken wells, inset grounds. |
| `bg-muted` | `sunken` | `neutral-100` `#EFEEEB` | `neutral-800` `#444441` | Inactive segment, ghost hover, idle status ground. |
| `bg-inverse` | `inverse` | `neutral-975` `#11100F` | `neutral-0` `#FFFFFF` | Under D2 this is no longer the rail. It is the mobile field chrome and exactly one marketing band — the Carbon budget shrinks from 17-21% of the app to two named places. |
| `bg-signal` | `signal` | `signal-500` `#C6FF34` | `signal-500` `#C6FF34` | The mark. Identical in both modes: it is the one colour in the system that means the same thing on any ground. |
| `bg-overlay` | `overlay` | `neutral-975` @ 32% | `neutral-975` @ 56% | Scrim behind a dialog or the off-canvas rail. Alpha is held apart from the hex here for the same reason it is everywhere else: React Native composes it differently. |

### Text

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `text-primary` | `ink` | `neutral-975` `#11100F` | `neutral-25` `#FBFBF9` | Values, titles — the thing being read. 18.35:1 on canvas. |
| `text-secondary` | `ink-secondary` | `neutral-700` `#5C5B57` | `neutral-200` `#DDDCD8` | Supporting copy. 6.56:1 on canvas. |
| `text-muted` | `ink-muted` | `neutral-600` `#6D6C68` | `neutral-300` `#CCCAC6` | Metadata, labels, placeholders. 5.07:1 on canvas — the body-text floor. Four text levels, never two: two is too flat to build hierarchy from. The dark column is not a mirror of the light one: it sits a step lighter throughout, because a muted fill in dark mode is much closer to its own copy than a muted fill in light mode is to its. |
| `text-subtle` | `ink-subtle` | `neutral-500` `#92918C` | `neutral-400` `#B1AFAB` | Metadata ONLY, never body text. 3.05:1 clears the large-text and non-text threshold and nothing else. |
| `text-on-inverse` | `on-inverse` | `neutral-150` `#E7E6E2` | `neutral-900` `#2C2B29` | Copy on the inverse surface. 15.22:1. |
| `text-on-inverse-muted` | `on-inverse-muted` | `neutral-400` `#B1AFAB` | `neutral-700` `#5C5B57` | Metadata on the inverse surface. 8.68:1. |
| `text-on-signal` | `on-signal` | `neutral-975` `#11100F` | `neutral-975` `#11100F` | Copy on the mark. 16.07:1. Never white: signal-500 is a light colour and white on it measures 1.18:1, which is the defect that forced v1 to invent --color-accent-ink. |
| `text-link` | `link` | `blue-600` `#3E63BD` | `blue-300` `#BBCBEB` | Inline links. 5.64:1 on surface. |
| `text-brand` | `brand` | `signal-800` `#526628` | `signal-400` `#CEFE6C` | 'Ready' as text. 6.38:1 on surface. Replaces v1's --color-accent-ink, which existed only because the Lime had no dark end. |

### Structure

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `border-subtle` | `line-subtle` | `neutral-150` `#E7E6E2` | `neutral-900` `#2C2B29` | Hairline inside a surface, and the dashed blueprint guide on the landing. |
| `border-default` | `line` | `neutral-200` `#DDDCD8` | `neutral-800` `#444441` | The default. Panel edge, input edge, divider. Structure comes from this line plus a lightness shift between the four bg roles — there is no elevation ladder. |
| `border-strong` | `line-strong` | `neutral-300` `#CCCAC6` | `neutral-700` `#5C5B57` | Table rules and selected outlines. |
| `border-inverse` | `line-inverse` | `neutral-800` `#444441` | `neutral-300` `#CCCAC6` | Hairline on the inverse surface. The two themes do not mirror here and should not: in light the inverse surface is ink and the line lifts off it; in dark the inverse surface is white and the line has to sit down onto it, which is a step further from the ground. |
| `border-focus` | `focus` | `blue-500` `#5A7DCE` | `blue-300` `#BBCBEB` | One focus treatment for every focusable element in the product. 3.99:1 on surface. |

### Action

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `action-primary-bg` | `action` | `neutral-975` `#11100F` | `neutral-0` `#FFFFFF` | D1: ink is the action colour. Primary buttons are near-black, exactly as Folio and Linear. This is what removes the readable-accent problem from the system entirely rather than working around it. |
| `action-primary-fg` | `action-fg` | `neutral-0` `#FFFFFF` | `neutral-975` `#11100F` | The primary action's label. 19.01:1 — the highest-contrast pair in the system, which is what a control that commits money should carry. |
| `action-primary-hover` | `action-hover` | `neutral-900` `#2C2B29` | `neutral-150` `#E7E6E2` | One step off ink. |
| `action-signal-bg` | `action-signal` | `signal-500` `#C6FF34` | `signal-500` `#C6FF34` | The signal action. EXACTLY ONE per screen — v1 allowed one Lime fill in the whole product and that discipline is what kept the colour meaning something. |
| `action-signal-fg` | `action-signal-fg` | `neutral-975` `#11100F` | `neutral-975` `#11100F` | The signal action's label — ink in both themes. 16.07:1. Never white: signal-500 is a light colour and white on it measures 1.18:1, which is the defect that forced v1 to invent a second accent token. |
| `action-signal-hover` | `action-signal-hover` | `signal-400` `#CEFE6C` | `signal-400` `#CEFE6C` | Hover reads as lift, not as a different colour. |
| `action-ghost-hover` | `action-ghost-hover` | `neutral-100` `#EFEEEB` | `neutral-900` `#2C2B29` | Chrome hover. |

### Status

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `status-ready-surface` | `status-ready` | `signal-100` `#E9FECA` | `signal-900` `#3B4821` | Seven catalog readiness states collapse to five visual tones. The LABEL always carries the meaning — these only tint it, never replace it. |
| `status-ready-border` | `status-ready-line` | `signal-200` `#DDFEA5` | `signal-800` `#526628` | Chip edge. |
| `status-ready-fg` | `status-ready-fg` | `signal-800` `#526628` | `signal-300` `#D6FE8C` | 5.93:1 light, 8.63:1 dark. |
| `status-attention-surface` | `status-attention` | `amber-100` `#FEEED4` | `amber-900` `#423319` | At risk — evidence is expected and the window has not closed. Distinct from blocked, which is a refusal that has already happened. |
| `status-attention-border` | `status-attention-line` | `amber-200` `#FCDBA3` | `amber-800` `#6B5225` | Chip edge. |
| `status-attention-fg` | `status-attention-fg` | `amber-800` `#6B5225` | `amber-300` `#F6C97D` | 6.43:1 light, 7.89:1 dark. |
| `status-blocked-surface` | `status-blocked` | `danger-100` `#FCE9E6` | `danger-900` `#531E1B` | Blocked or refused. |
| `status-blocked-border` | `status-blocked-line` | `danger-200` `#FBD5D1` | `danger-800` `#792623` | Chip edge. |
| `status-blocked-fg` | `status-blocked-fg` | `danger-700` `#A02827` | `danger-300` `#F5BAB3` | 6.34:1 light, 8.00:1 dark. |
| `status-review-surface` | `status-review` | `blue-100` `#E8EFFC` | `blue-900` `#1B2D5B` | Submitted or in review. |
| `status-review-border` | `status-review-line` | `blue-200` `#D4E0F9` | `blue-800` `#274181` | Chip edge. |
| `status-review-fg` | `status-review-fg` | `blue-700` `#3756A1` | `blue-300` `#BBCBEB` | 6.04:1 light, 8.17:1 dark. |
| `status-idle-surface` | `status-idle` | `neutral-100` `#EFEEEB` | `neutral-900` `#2C2B29` | Nothing has happened yet. Deliberately colourless: an idle state that carries a hue reads as a state that means something. |
| `status-idle-border` | `status-idle-line` | `neutral-200` `#DDDCD8` | `neutral-800` `#444441` | Chip edge. |
| `status-idle-fg` | `status-idle-fg` | `neutral-700` `#5C5B57` | `neutral-300` `#CCCAC6` | 5.86:1 light, 8.64:1 dark. |

### Evidence

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `evidence-satisfied` | `evidence-satisfied` | `signal-800` `#526628` | `signal-300` `#D6FE8C` | Evidence obtained. 6.16:1 on canvas. |
| `evidence-pending` | `evidence-pending` | `amber-800` `#6B5225` | `amber-300` `#F6C97D` | Evidence expected, not yet obtained. 7.09:1 on canvas. |
| `evidence-blocking` | `evidence-blocking` | `danger-700` `#A02827` | `danger-300` `#F5BAB3` | Evidence missing and blocking a closure. 7.17:1 on canvas. |

### Data visualisation

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `viz-1` | `viz-1` | `signal-600` `#99C23D` | `signal-400` `#CEFE6C` | Categorical series 1. The five viz roles are ordered by how often a series appears, not by hue family, so a two-series chart never picks two colours that read as one status pair. |
| `viz-2` | `viz-2` | `blue-600` `#3E63BD` | `blue-300` `#BBCBEB` | Categorical series 2. |
| `viz-3` | `viz-3` | `amber-600` `#BF8F34` | `amber-300` `#F6C97D` | Categorical series 3. |
| `viz-4` | `viz-4` | `danger-600` `#CE2F30` | `danger-300` `#F5BAB3` | Categorical series 4. |
| `viz-5` | `viz-5` | `violet-500` `#916CCD` | `violet-300` `#D0C3EB` | Categorical series 5. Violet exists for this role and no other — it is never a status. |

---

## 3. Elevation

Four, and a panel gets none of them. Structure is a 1px border plus a
lightness shift between the surface roles; there is no elevation ladder.

| Token | Value | Ruling |
|---|---|---|
| `raised` | `0px 1px 2px 0px rgba(17, 16, 15, 0.04), 0px 2px 6px 0px rgba(17, 16, 15, 0.04)` | Hover lift on an interactive card. Structure is border-led: Folio ships 180 elements carrying a 1px border against 8 carrying a real shadow, and that ratio is the model. There is still no elevation ladder — a panel gets no shadow at all. |
| `overlay` | `0px 4px 12px 0px rgba(17, 16, 15, 0.06), 0px 12px 28px 0px rgba(17, 16, 15, 0.08)` | Popover-class chrome one step off its parent: tooltip, dropdown, command palette. v1's shadow-raised did this job with one layer; two layers is what makes a light overlay legible on a light canvas without darkening the whole edge. |
| `modal` | `0px 8px 24px 0px rgba(17, 16, 15, 0.08), 0px 24px 64px 0px rgba(17, 16, 15, 0.12)` | The only things that cover content: dialog and the off-canvas rail. Under D2 the rail is no longer dark, so this shadow now carries the whole 'this covers content' signal that colour used to carry with it. |
| `float` | `0px 12px 32px 0px rgba(17, 16, 15, 0.08), 0px 40px 80px 0px rgba(17, 16, 15, 0.1)` | MARKETING ONLY — the one product frame per viewport. Forbidden under /app/**, where nothing floats off the page. Folio's measured product-frame shadow is a comparable two-layer form (rgba(28,40,64,.08) at 10.85px and 21.7px). |

---

## 4. Scales

### `font`

| Token | Value | Ruling |
|---|---|---|
| `display` | `'Source Serif 4 Variable', 'Source Serif 4', Georgia, serif` | D3. Serif display, Cyrillic-complete, variable with an optical-size axis, OFL. Folio and Linear both pair a serif display (Tiempos Headline) with a sans UI; Tiempos is commercial, this is the closest open face with the Ukrainian coverage this product cannot ship without. Display only: never below mkt-display-3, never inside /app/**, never on a figure. |
| `sans` | `'Inter Variable', Inter, system-ui, sans-serif` | Unchanged from v1 and not re-litigated. Cyrillic-complete, tabular figures, and the cv01/ss03 features Linear also enables. Carries all UI, all body copy and every number. |
| `mono` | `'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace` | D4. Index labels, evidence IDs, figure captions and ledger keys. Linear's marketing site uses a mono for exactly this (FIG 0.2, 1.0 Intake) and it is the motif that makes an indexed document read as an instrument. Subset to digits, Latin caps and punctuation — the full face is not loaded. |
| `features` | `"cv01", "ss03"` | Inter's single-storey a and disambiguated l. Measured in use on linear.app; both reduce misreads in dense numeric rows. |

### `text`

| Token | Value | Ruling |
|---|---|---|
| `micro` | `11px` | v1 scale, kept. Banned on /app and /app/work — the QA harness fails any element under 12px there, and a register read all day should not carry 11px. |
| `meta` | `12px` | v1 scale, kept. Labels and metadata. |
| `data` | `13px` | v1 scale, kept. The desk-density base — a register is read, not browsed. |
| `body` | `15px` | v1 scale, kept. The phone base and desk body. Independently matches Linear's --font-size-regular (0.9375rem). |
| `h3` | `18px` | v1 scale, kept. |
| `h2` | `22px` | v1 scale, kept. |
| `h1` | `26px` | v1 scale, kept. |
| `display` | `32px` | v1 scale, kept. Reserved for the single focal figure on a screen — /app's money-at-risk total. The only 32px thing on any screen. |
| `mkt-caption` | `13px` | Marketing scale. Captions and legal lines. |
| `mkt-index` | `12px` | Marketing scale. Mono, uppercase, +0.08em tracking. The section index and evidence ID motif. |
| `mkt-body` | `16px` | Marketing scale. Long-form reading size — 15px is a density decision for a register and the wrong call for a landing paragraph. |
| `mkt-lead` | `clamp(17px, 1.4vw, 20px)` | Marketing scale. The sub-headline under a display heading. |
| `mkt-display-3` | `clamp(26px, 2.6vw, 32px)` | Marketing scale. The floor for the serif — below this the display face stops being a display face. |
| `mkt-display-2` | `clamp(32px, 4vw, 48px)` | Marketing scale. Section headings. Folio's measured h2 is 48px/48px at -1.2px tracking. |
| `mkt-display-1` | `clamp(40px, 5.6vw, 72px)` | Marketing scale. Hero and final CTA only, at most twice per page. Folio's measured h1 is 60px/60px. |

### `fontWeight`

| Token | Value | Ruling |
|---|---|---|
| `normal` | `400` | Variable-font axis value. |
| `medium` | `510` | Not 500. Inter's 500 renders muddy at 13px in a dense row; 510 does not. Measured on linear.app, which ships exactly this value. |
| `semibold` | `590` | Not 600, for the same reason as medium. Measured on linear.app. |
| `bold` | `680` | Not 700. Measured on linear.app. Display headings and the focal figure. |

### `leading`

| Token | Value | Ruling |
|---|---|---|
| `none` | `1` | Mono index labels, where the line box must not add height. |
| `tight` | `1.15` | Display headings at mkt-display-3. |
| `display` | `1.0` | mkt-display-1 and -2. Folio sets h1 60px/60px and h2 48px/48px — a display line box that is exactly its own size. |
| `snug` | `1.35` | Product headings. |
| `normal` | `1.5` | Product body and table cells. |
| `relaxed` | `1.6` | Marketing body and lead. Linear's measured --text-regular-line-height. |

### `tracking`

| Token | Value | Ruling |
|---|---|---|
| `tightest` | `-0.022em` | mkt-display-1. Folio's measured -1.2px at 48px is -0.025em; -0.022em holds at 72px without the counters closing. |
| `tighter` | `-0.020em` | mkt-display-2. |
| `tight` | `-0.014em` | mkt-display-3 and product h1/h2. |
| `normal` | `-0.011em` | Body and below. Linear's measured --text-regular-letter-spacing. Not 0: Inter at 13-16px sets slightly loose by default. |
| `wide` | `0.08em` | mkt-index only. Uppercase mono needs the extra space to stop reading as a word. |

### `radius`

| Token | Value | Ruling |
|---|---|---|
| `control` | `6px` | v1, kept. Buttons, inputs, chips inside /app/**. A register is not a set of cards. |
| `field` | `8px` | New. Folio's most frequent radius by a wide margin (301 elements at 8px against 89 at 6px). Marketing controls and evidence tiles. |
| `panel` | `10px` | v1, kept. Panels and cards inside /app/**. |
| `card` | `14px` | New, marketing only. A landing card is a card; a register panel is not. |
| `surface` | `20px` | New, marketing only. Product frames and large tinted surfaces. |
| `section` | `28px` | New, marketing only. The footer sheet that overlaps the CTA band, and full-width tinted sections. |
| `pill` | `999px` | v1, kept. Status chips, indicators, the floating nav, pill CTAs. |

### `space`

| Token | Value | Ruling |
|---|---|---|
| `base` | `0.25rem` | The 4px grid, expressed in rem so it scales with the user's root font size. Emitted as Tailwind's --spacing, so the whole dynamic p-*/gap-* scale inherits it — exactly as v1 did, and the reason --spacing was the one stock namespace v1 did not clear. |
| `section-sm` | `64px` | Marketing rhythm: mobile sections and the mobile band. |
| `section-md` | `96px` | Marketing rhythm: strips. Folio's measured logo-strip padding. |
| `section-lg` | `112px` | Marketing rhythm: the standard section step. Folio's measured value on every content section. |
| `section-xl` | `160px` | Marketing rhythm: hero only. |

### `breakpoint`

| Token | Value | Ruling |
|---|---|---|
| `md` | `768px` | v1, kept. Below it the rail is an off-canvas drawer. There is no sm/lg/xl: a typo fails loudly instead of silently targeting a width this design never reasons about. |
| `wide` | `1240px` | v1, kept. At and above it the rail opens with labels. |

### `container`

| Token | Value | Ruling |
|---|---|---|
| `measure` | `680px` | Reading measure for a marketing paragraph. Beyond it a 16px line runs past the comfortable saccade. |
| `content` | `1240px` | The content cap, shared by the app and the landing so a product screenshot dropped into a landing block lines up with the shell it came from. |
| `nav` | `880px` | The floating pill nav. Folio's is narrower than its content column on purpose — a nav that spans the page stops reading as an object. |

### `duration`

| Token | Value | Ruling |
|---|---|---|
| `instant` | `100ms` | Colour-only transitions. Linear's measured value for the same job. |
| `fast` | `160ms` | Hover, press, state. Linear's dominant measured duration and the one curve+duration pair that appears on more of their elements than any other. |
| `base` | `240ms` | Accordion, tab, popover, chip. Folio measures 200ms on accordions and 250ms is Linear's --speed-regularTransition; 240ms sits between two measured values rather than beside one. |
| `slow` | `400ms` | Scroll reveal and section enter. Measured identically on Grovia (400ms) and Linear (staggerIn 400ms) — two independent sites converging on the same number is the strongest evidence available for a motion value. |
| `marquee` | `35s` | One full pass of the logo/proof ribbon. Folio's measured value on the same device (35s and 40.25s on two tracks). Long enough that it reads as ambient rather than as something demanding to be watched, and the only perpetual animation the system permits — it pauses on hover and freezes entirely under prefers-reduced-motion. |
| `deliberate` | `640ms` | Hero composition and sequence steps. Long enough to be read as choreography, short enough that a returning visitor is not waiting for it. |

### `ease`

| Token | Value | Ruling |
|---|---|---|
| `out` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | ease-out-quad. THE interaction curve — measured as Linear's dominant transition timing function. Ease-out only, never ease-in: ease-in stalls the first frame, which is the frame being watched. |
| `enter` | `cubic-bezier(0.165, 0.84, 0.44, 1)` | ease-out-quart. Reveals and staggers. Linear's measured staggerIn curve. |
| `emphatic` | `cubic-bezier(0.19, 1, 0.22, 1)` | ease-out-expo. Hero composition and line draw. |
| `soft` | `cubic-bezier(0.44, 0, 0.56, 1)` | Symmetric. Cross-fades only, where a directionless change should not imply a direction. Grovia's measured reveal curve. |
| `overshoot` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | ILLUSTRATION ONLY. Folio uses it on 78 elements, every one of them an illustration transform. An overshoot on a control makes a button feel like a toy; on a diagram it makes a part feel like it seated. |

### `stagger`

| Token | Value | Ruling |
|---|---|---|
| `tight` | `40ms` | Per word or per character. Flexfolio's measured blur-in stagger. |
| `default` | `80ms` | Per sibling in a list or grid. |
| `loose` | `120ms` | Per section child, where each child is itself a composition. |

### `spring`

| Token | Value | Ruling |
|---|---|---|
| `reveal` | `stiffness 100, damping 20, mass 1` | The blur-in text reveal. Flexfolio's measured settle is ~3.25s on a spring with no overshoot, which is this shape. |
| `press` | `stiffness 400, damping 30, mass 1` | Control press feedback. Fast enough to feel instant, damped enough not to wobble. |

### `blur`

| Token | Value | Ruling |
|---|---|---|
| `chrome` | `20px` | The floating nav backdrop. Linear's measured --header-blur. |
| `reveal` | `6px` | The blur-in text reveal's starting blur. Enough to be a resolve, little enough not to be a smear. |

---

## 5. Component values

Only what is not derivable from a role.

| Token | Value | Ruling |
|---|---|---|
| `rail-width-wide` | `240px` | v1, kept and not re-litigated. 240px against an otherwise unconstrained content column states the relationship: navigation serves the register, it is not its peer. |
| `rail-width-collapsed` | `68px` | v1, kept. Icons only, labels in a tooltip, between md and wide. |
| `rail-width-drawer` | `min(300px, 84vw)` | v1, kept. Off-canvas below md, behind a >=44px control. |
| `control-height-touch` | `44px` | v1, kept. WCAG 2.5.5's 44px is a floor, not a preference, and the phone audience is gloved and outdoors. Applies below md and, now, under the pointer-coarse variant — Tailwind v4.1 gives a real capability query for the thing the breakpoint was standing in for. |
| `control-height-desk` | `36px` | v1, kept. Default control at the desk. |
| `control-height-desk-sm` | `32px` | v1, kept. Small control at the desk. Folio's measured button height is 32px at 14px/500. |
| `header-height-app` | `56px` | v1, kept. The mobile bar exists only below md, because that is the only width where the rail is hidden. There is no desktop top bar: a second 76px band repeating the brand is 76px not spent on rows. |
| `header-height-marketing` | `64px` | The floating pill nav. Linear's marketing header measures 72px flush to the edge; a detached pill needs less height because it already reads as an object. |
| `register-row-padding-y` | `10px` | v1, kept (py-2.5). Measured against real content at 1440x900: 14 rows in the fold on /app/work. |
| `register-row-padding-x` | `12px` | v1, kept (px-3). |
| `focus-ring-width` | `2px` | One treatment for every focusable element inside the shell, matching the public routes so the two cannot disagree. 2px rather than Linear's 1px because this ring must survive being rendered on a construction site in daylight. |
| `focus-ring-offset` | `2px` | Offset rather than inset, so the ring never eats the control's own border and change the element's apparent size. |

---

## 6. Measured contrast

Computed from the source at generation time by the same function
`packages/testing/src/contrast.test.ts` asserts with. WCAG 2.1: 4.5:1 for
body text, 3:1 for large text and non-text contrast.

| Pairing | Light | Dark |
|---|---:|---:|
| primary copy on the canvas | 18.35:1 | 18.35:1 |
| secondary copy on the canvas | 6.56:1 | 13.85:1 |
| muted copy on the canvas | 5.07:1 | 11.61:1 |
| muted copy on a subtle fill | 4.85:1 | 8.64:1 |
| muted copy on a muted fill | 4.53:1 | 5.97:1 |
| metadata on the canvas | 3.05:1 | 8.68:1 |
| copy on the inverse surface | 15.22:1 | 14.14:1 |
| metadata on the inverse surface | 8.68:1 | 6.80:1 |
| copy on the mark | 16.07:1 | 16.07:1 |
| a link on a surface | 5.64:1 | 10.75:1 |
| 'ready' as text on a surface | 6.38:1 | 15.07:1 |
| the primary action's label | 19.01:1 | 19.01:1 |
| the signal action's label | 16.07:1 | 16.07:1 |
| ready chip | 5.93:1 | 8.63:1 |
| attention chip | 6.43:1 | 7.89:1 |
| blocked chip | 6.34:1 | 8.00:1 |
| review chip | 6.04:1 | 8.17:1 |
| idle chip | 5.86:1 | 8.64:1 |
| the focus ring against a surface | 3.99:1 | 10.75:1 |
