# GoProceed design tokens — reference

**GENERATED — do not edit.** Source: `packages/tokens/src/tokens.json`.
Regenerate: `node packages/tokens/scripts/generate-docs.mjs`.
`packages/testing/src/token-fidelity.test.ts` fails if this file drifts.

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-09-22

**Related decisions:** None yet. The rulings behind these values are D1–D7 in the [rewrite plan](./2026-08-19-design-system-rewrite-plan.md) §3, which need an ADR before Phase 3.

**Surfaces:** `apps/landing`, `apps/app`, `apps/mobile`, `packages/ui`

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
| `neutral-0` | `#FFFFFF` | 1, 0, 89.88 | 1.21 | 19.58 | Pure white. The working surface a register sits on: on the kit's paper a panel now reads as a sheet laid on the page (1.21:1), which it never did against the old, lighter canvas. |
| `neutral-25` | `#ECE9DF` | 0.9336, 0.0137, 92.99 | 1.00 | 16.12 | THE CANVAS — the brand kit's paper #ECE9DF (Autumn, 2026-09-22). Warm at hue 93, and a step darker than the Daylight paper it replaces, so white is a surface again. Every rung of this ramp is warm: the kit's own ladder runs from a warm black to white without a cool step, and the ink is no longer the paper's opposite in temperature but its far end. |
| `neutral-50` | `#E6E2D7` | 0.913, 0.015, 92 | 1.07 | 15.13 | Paper-2: the «was» card, sunken wells, the ground under an inset control. One rung under the canvas and still unmistakably paper. |
| `neutral-100` | `#E0DCD1` | 0.895, 0.015, 90 | 1.13 | 14.29 | Inactive segment, ghost-button hover on the canvas, idle status ground. |
| `neutral-150` | `#D9D6CD` | 0.876, 0.012, 88 | 1.20 | 13.47 | Hairline inside a surface, and copy on ink (13.47:1 against neutral-975). |
| `neutral-200` | `#D1CDC7` | 0.85, 0.01, 80 | 1.30 | 12.37 | The default border. 1.30:1 against the canvas — visible as structure, invisible as a line you read. |
| `neutral-300` | `#C7C3BD` | 0.818, 0.009, 70 | 1.44 | 11.16 | The strong border: table rules, selected outlines, the edge of a card on white (1.75:1). |
| `neutral-400` | `#A5A19E` | 0.7114, 0.0064, 59.61 | 2.11 | 7.64 | The kit's #A5A19E, taken unchanged. Non-text only on light: disabled fills, metadata on ink (7.64:1). Never body copy on the canvas. |
| `neutral-500` | `#7B736A` | 0.56, 0.0169, 70.74 | 3.84 | 4.20 | The kit's #7B736A, taken unchanged. Metadata floor: 3.84:1 on the canvas, so it clears the non-text and large-text threshold and nothing else. Never body text. |
| `neutral-600` | `#665F58` | 0.49, 0.014, 68 | 5.17 | 3.12 | The body-text floor, measured against the DARKEST ground it lands on: 5.17:1 on canvas, 6.28:1 on white, 4.85:1 on a subtle fill, 4.59:1 on a muted fill. |
| `neutral-700` | `#514B46` | 0.418, 0.012, 64 | 7.07 | 2.28 | Secondary copy, 7.07:1 on canvas; also the idle status foreground. Darker than the Daylight rung it replaces, because the canvas came down with the kit's paper and 7:1 had to be kept. |
| `neutral-800` | `#403C39` | 0.36, 0.0075, 59.46 | 8.99 | 1.79 | The kit's #44403D, one notch darker to hold the hairline on ink at 1.79:1 — the only border that reads on the inverse surface. |
| `neutral-900` | `#2A2524` | 0.2696, 0.0078, 31.12 | 12.45 | 1.29 | The kit's #2A2524. One step off ink, so a press is felt without the button changing identity. |
| `neutral-950` | `#1D1818` | 0.215, 0.008, 17.79 | 14.45 | 1.12 | The kit's #1D1818 — the inverse working surface, dark mode's panel, authored now and not shipped (D6). |
| `neutral-975` | `#0C0C0A` | 0.1535, 0.0042, 106.88 | 16.12 | 1.00 | INK — the brand kit's black #0C0C0A, exactly. Primary text and the primary action fill, 16.12:1 on the canvas. Warm like the paper, not its opposite: in this palette the temperature is carried by ember and pine, not by the distance between ink and paper. |

### `clay`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `clay-50` | `#F3EDE4` | 0.9483, 0.013636, 78.26 | 1.04 | 16.82 | The faintest warm wash — half a step off the paper, for a highlight that must not read as a panel. It is NOT the tint block: measured against the canvas it stands 7 of 255 in its strongest channel, which on a screen is nothing, and a whole revision of DEV-029 shipped washes nobody could see because this rung was doing that job. Carries ink at 16.82:1. |
| `clay-100` | `#E8DCCE` | 0.9003, 0.023012, 71.77 | 1.11 | 14.51 | THE WARM TINT BLOCK. 17 of 255 off the paper in its strongest channel — the smallest step that is honestly visible — and the ground the footer, the FAQ band and every warm wash stand on. Carries ink at 14.51:1 and secondary copy at 6.36:1; muted copy clears the body floor at 4.65:1 with little to spare, which is why dense copy on this ground takes the secondary rung instead. |
| `clay-200` | `#D8C6B0` | 0.8356, 0.036115, 72.83 | 1.37 | 11.77 | Two jobs, and they never meet on one surface. It is the warm hairline — 1.37:1 on the canvas, the same order as the neutral border ladder — and it is the warm index chip, which carries clay-800 at 6.90:1. The chip only ever sits on paper or on a white cell, never on the tint block whose edge this also draws. |
| `clay-300` | `#C8B8A0` | 0.7896, 0.037628, 78.06 | 1.60 | 10.09 | The reference's mid taupe. The warm index chip's mark in the dark theme, at 7.06:1 on clay-900. Its earlier ruling called it «the light end of the mocha gradient»; that gradient was removed with the landing's dark ground on 2026-09-22. |
| `clay-500` | `#A07858` | 0.6044, 0.067664, 59.69 | 3.25 | 4.96 | A mid warm brown, held for the dark theme and unreferenced by any role today. Its chroma is 0.0677 against ember's 0.2125 — under a third — and that ratio, not its hue, is what keeps a warm brown from being read as the mark; `palette-derivation.test.ts` holds it under 0.4. It was the mocha behind the product for one revision, until the owner removed the dark ground the mocha was mixed onto. |
| `clay-600` | `#8A6446` | 0.5351, 0.065694, 59.05 | 4.33 | 3.72 | A deep warm brown, held for the dark theme. No role names it today; it was the mocha gradient's own colour until that gradient was removed on 2026-09-22. |
| `clay-700` | `#705038` | 0.4596, 0.056352, 57.66 | 5.97 | 2.70 | The reference's deep mocha, sampled from its Insight shot. Held for the dark theme; no role names it today. |
| `clay-800` | `#4A3527` | 0.3489, 0.038115, 54.79 | 9.45 | 1.71 | The warm index chip's mark: 6.90:1 on clay-200. In the dark theme it is the warm hairline instead. |
| `clay-900` | `#3A2A20` | 0.3007, 0.029547, 53.29 | 11.28 | 1.43 | The warm tint's ground in the dark theme. Carries the dark theme's ink at 11.28:1. |

### `ember`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `ember-50` | `#FFF2EA` | 0.97, 0.017392, 55 | 1.11 | 17.85 | Faintest ember wash — a whole row tinted without becoming a chip. |
| `ember-100` | `#FFE8DA` | 0.945, 0.031474, 52 | 1.03 | 16.60 | Ember at a tenth over white: the soft ground for the ONE accent action a screen may carry, and the wash behind a spark. It is not `bg-accent-soft` — the accent's own wash is pine-100 — and no role names it today. |
| `ember-200` | `#FFCFB7` | 0.89, 0.063473, 48 | 1.16 | 13.85 | The spark's soft edge, for a chip or a card that carries the signal action. Held, not named by a role: the accent's edge is `border-accent` on pine. |
| `ember-300` | `#FF9E74` | 0.79, 0.128767, 44 | 1.66 | 9.69 | The spark ON INK (9.69:1) — the rung a travelling light or a mark on the inverse surface would take if it needed to be brighter than the signal itself. |
| `ember-400` | `#FF824F` | 0.74, 0.165528, 42 | 2.02 | 7.98 | The bright spark on a dark ground: 7.98:1 on ink, and 2.02:1 on the canvas, which is non-text only. Held for a signal hover on the inverse surface. |
| `ember-500` | `#FF5B04` | 0.6826, 0.2125, 40.11 | 2.56 | 6.29 | THE SPARK — the kit's orange #FF5B04, exactly, and the brand's SECONDARY colour. 2.56:1 on the canvas, so it is never text and never a thin line that has to be seen; as a FILL it carries ink at 6.29:1, which is why the signal action is black on orange and not white on orange (3.11:1). Where the primary would disappear — a light travelling on a near-black pill, where pine-700 measures 2.56:1 — the spark is what reads. |
| `ember-600` | `#D84A00` | 0.6, 0.188437, 40 | 3.53 | 4.57 | The secondary where it has to survive a press or a small area: the signal action's hover (ink at 4.57:1) and a dense accent figure. 3.53:1 on canvas. |
| `ember-700` | `#AE390C` | 0.51, 0.16, 38 | 5.10 | 3.16 | Ember as TEXT, for the rare case a warm figure has to be read: 5.10:1 on canvas, 6.19:1 on white. Links are the primary's job, not this one. |
| `ember-800` | `#852A0F` | 0.42, 0.13, 36 | 7.40 | 2.18 | Densest ember text, for an accent figure inside a dense table. |
| `ember-900` | `#551A0D` | 0.31, 0.09, 34 | 11.23 | 1.44 | Ember ground in dark mode: a deep warm ground for a block that carries the signal, not the accent's wash — that is pine-900. |

### `pine`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `pine-50` | `#EFF7F4` | 0.97, 0.01, 167 | 1.12 | 17.98 | Faintest pine wash. |
| `pine-100` | `#E2F1EA` | 0.945, 0.018, 167 | 1.04 | 16.79 | Pine at a tenth over white: the brand wash behind a quiet block. |
| `pine-200` | `#CBE3D8` | 0.895, 0.03, 167 | 1.11 | 14.47 | The brand hairline. |
| `pine-300` | `#A0C4B4` | 0.79, 0.045, 167 | 1.56 | 10.30 | Pine as a foreground in dark mode (7.79:1 on pine-900). |
| `pine-500` | `#587E6E` | 0.56, 0.05, 167 | 3.74 | 4.31 | Mid pine: an icon or a rule that has to stay calm. Non-text on light. |
| `pine-700` | `#395A4D` | 0.4378, 0.0444, 167.6 | 6.30 | 2.56 | THE PRIMARY BRAND COLOUR — the kit's green #395A4D, exactly (owner, 2026-09-22: «сделай основным #395A4D, а секондари #FF5B04»). Unlike ember it is text-safe (6.30:1 on canvas, 7.65:1 on white) and it carries white at 7.65:1, so it can be what ember cannot: the brand as a word, a link, the focus ring, the accent phrase in a heading and the colour of every ornament on the landing. Its chroma is between a third and a quarter of the ready-green's (0.044 against 0.155): a desaturated deep green beside a saturated mid green is the distance that keeps the brand from reading as a state, and `palette-derivation.test.ts` holds the ratio under 0.4. |
| `pine-800` | `#274439` | 0.36, 0.04, 168 | 8.77 | 1.84 | Deep pine: the brand ground when a block has to sit under white copy without becoming black. |
| `pine-900` | `#152C24` | 0.27, 0.033, 169 | 12.19 | 1.32 | Pine ground in dark mode. |

### `green`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `green-50` | `#F0F9F2` | 0.974, 0.014, 150 | 1.13 | 18.22 | Faintest ready wash. |
| `green-100` | `#E0F5E3` | 0.95, 0.032, 150 | 1.06 | 17.10 | Ready chip ground. |
| `green-200` | `#BEECC6` | 0.9, 0.07, 150 | 1.08 | 14.92 | Ready chip border. |
| `green-300` | `#8CD99C` | 0.82, 0.115, 150 | 1.38 | 11.67 | Ready foreground in dark mode (7.93:1 on green-900). |
| `green-500` | `#239C4D` | 0.61, 0.155, 150 | 2.91 | 5.53 | The ready mark: icons, dots and check marks. 3.54:1 on white — NOT text. Moved to hue 150 with the Autumn palette, and kept at a chroma the brand's pine never reaches, so «готово» cannot be mistaken for the brand. |
| `green-600` | `#1C8742` | 0.55, 0.14, 150 | 3.76 | 4.28 | Viz weight on white. |
| `green-700` | `#167337` | 0.49, 0.125, 150 | 4.88 | 3.30 | Ready as TEXT: 5.18:1 on green-100, 4.88:1 on canvas, 5.93:1 on white. |
| `green-800` | `#115629` | 0.4, 0.1, 150 | 7.24 | 2.23 | Ready chip border in dark mode. |
| `green-900` | `#0D371A` | 0.3, 0.07, 150 | 10.95 | 1.47 | Ready ground in dark mode. |

### `amber`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `amber-50` | `#FCF7EC` | 0.976, 0.015, 84 | 1.14 | 18.32 | Faintest attention wash. |
| `amber-100` | `#FBEFD8` | 0.955, 0.033, 82 | 1.07 | 17.19 | Attention chip ground. |
| `amber-200` | `#F7DAA5` | 0.9, 0.075, 82 | 1.11 | 14.48 | Attention chip border. |
| `amber-300` | `#EDC06B` | 0.83, 0.115, 82 | 1.40 | 11.52 | Attention foreground in dark mode (7.55:1 on amber-900). |
| `amber-500` | `#D19A12` | 0.72, 0.145, 82 | 2.07 | 7.78 | Icon and bar weight; never text. |
| `amber-600` | `#BA8400` | 0.65, 0.134697, 80 | 2.71 | 5.96 | The attention mark: the draft stamp, the rule box's border. 3.29:1 on white — icons and strokes, NOT text. Autumn moved this family from hue 50 to hue 80: at hue 50 «увага» was four degrees from the brand's own orange and read as the brand. |
| `amber-700` | `#875D00` | 0.51, 0.106423, 78 | 4.81 | 3.35 | Attention as TEXT: 5.13:1 on amber-100, 4.81:1 on canvas. |
| `amber-800` | `#6C4800` | 0.43, 0.090485, 76 | 6.74 | 2.39 | The evidence-pending foreground (6.74:1 on canvas). |
| `amber-900` | `#462D03` | 0.32, 0.065, 74 | 10.56 | 1.53 | Attention ground in dark mode. |

### `danger`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `danger-50` | `#FBF4F4` | 0.973, 0.008, 20 | 1.12 | 18.04 | Faintest blocked wash. |
| `danger-100` | `#FEE8E7` | 0.948, 0.025, 20 | 1.04 | 16.70 | Blocked chip ground. |
| `danger-200` | `#FED4D3` | 0.905, 0.048, 20 | 1.11 | 14.52 | Blocked chip border. |
| `danger-300` | `#FAB7B6` | 0.84, 0.078, 20 | 1.38 | 11.67 | Blocked foreground in dark mode (8.15:1 on danger-900). |
| `danger-500` | `#DE4451` | 0.61, 0.19, 20 | 3.42 | 4.71 | Icon and bar weight. Autumn moved the family from hue 26 to hue 20 — the legacy red sat fourteen degrees from the brand's orange, which is not a distance a colour-blind reader, or any reader, can be asked to judge. |
| `danger-600` | `#C71336` | 0.53, 0.205, 20 | 4.84 | 3.33 | The one solid destructive fill: white on it measures 5.87:1. It exists for refusal states, not for a destructive button variant — there is none (DEV-035, 2026-09-23: the field PWA it once also served was retired, and with it the variant's only call site). |
| `danger-700` | `#A3122C` | 0.46, 0.175, 20 | 6.45 | 2.50 | Blocked text: 6.68:1 on danger-100, 6.45:1 on canvas. Also the evidence-blocking foreground. |
| `danger-800` | `#7E1825` | 0.39, 0.135, 20 | 8.46 | 1.91 | Densest blocked text, for a blocked figure inside a dense table. |
| `danger-900` | `#55181D` | 0.31, 0.09, 20 | 11.26 | 1.43 | Blocked ground in dark mode. |

### `violet`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `violet-100` | `#F0EBFC` | 0.95, 0.022312, 300 | 1.04 | 16.78 | Data-visualisation only. Never a status: five statuses is the catalog, and a sixth colour reading as a state is how a legend stops being true. |
| `violet-200` | `#E4DAF9` | 0.905, 0.04319, 300 | 1.10 | 14.63 | Data-visualisation fill. |
| `violet-300` | `#D0C3EB` | 0.84, 0.057941, 300 | 1.36 | 11.83 | Data-visualisation on dark. |
| `violet-500` | `#916CCD` | 0.61, 0.145512, 300 | 3.31 | 4.88 | The fifth categorical series. |
| `violet-700` | `#60438D` | 0.45, 0.120193, 300 | 6.44 | 2.50 | Fifth series, dense variant. |
| `violet-900` | `#36284D` | 0.31, 0.066342, 300 | 11.03 | 1.46 | Fifth series ground in dark mode. |

### `cobalt`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `cobalt-50` | `#F4F6FF` | 0.9742, 0.012172, 276.1 | 1.13 | 18.15 | Faintest review wash — a whole row tinted without becoming a chip. |
| `cobalt-100` | `#EAEDFF` | 0.9491, 0.024404, 278.37 | 1.04 | 16.83 | Review chip ground. |
| `cobalt-200` | `#D5DBFF` | 0.8982, 0.049772, 277.88 | 1.12 | 14.36 | Review chip border. |
| `cobalt-300` | `#9AAAFF` | 0.7593, 0.123516, 274.95 | 1.81 | 8.92 | Review foreground in dark mode (7.04:1 on cobalt-900). |
| `cobalt-400` | `#5568DE` | 0.5662, 0.17981, 272.46 | 3.91 | 4.12 | Review at large-text weight on light. Held for the data-visualisation series and for the review state; it is no longer the accent. |
| `cobalt-500` | `#2B4BFF` | 0.5251, 0.264234, 267.09 | 4.87 | 3.31 | The review mark. Autumn demoted this family: it was the brand, and it is now the one hue in the system that belongs to no brand colour, which is exactly what «на перевірці» needs — a state that cannot be confused with ember (the mark), pine (the brand), green (ready) or amber (attention). |
| `cobalt-600` | `#2440D9` | 0.4677, 0.232104, 267.14 | 6.15 | 2.62 | Review hover and the first data-visualisation series. 7.47:1 on white. |
| `cobalt-700` | `#1E36B8` | 0.4157, 0.203704, 267.26 | 7.60 | 2.12 | Review as TEXT: 7.94:1 on cobalt-100, 9.23:1 on white. |
| `cobalt-800` | `#172A8C` | 0.3465, 0.162363, 267.55 | 9.90 | 1.63 | Review chip border in dark mode. |
| `cobalt-900` | `#101D5E` | 0.2702, 0.116305, 268.31 | 12.72 | 1.27 | Review ground in dark mode. |

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
| `bg-canvas` | `canvas` | `neutral-25` `#ECE9DF` | `neutral-975` `#0C0C0A` | The page. Paper, not white — white is reserved for the surface a register sits on, and the two must differ or the panel stops reading as a sheet. |
| `bg-surface` | `surface` | `neutral-0` `#FFFFFF` | `neutral-950` `#1D1818` | The working surface. Panels, cards, table bodies. |
| `bg-subtle` | `subtle` | `neutral-50` `#E6E2D7` | `neutral-900` `#2A2524` | Zebra rows, sunken wells, inset grounds. |
| `bg-muted` | `sunken` | `neutral-100` `#E0DCD1` | `neutral-800` `#403C39` | Inactive segment, ghost hover, idle status ground. |
| `bg-inverse` | `inverse` | `neutral-975` `#0C0C0A` | `neutral-0` `#FFFFFF` | Under D2 this is no longer the rail. It is the mobile field chrome and exactly one marketing band — the Carbon budget shrinks from 17-21% of the app to two named places. |
| `bg-signal` | `signal` | `ember-500` `#FF5B04` | `ember-500` `#FF5B04` | The signal ground, in both themes: the kit's orange, the brand's SECONDARY colour (owner, 2026-09-22). It is the spark of the system — the one accent action a screen may carry, and the light travelling on a dark pill — and it is scarce by contract. (The mark's dot was the third, until the owner made it the primary on 2026-09-22.) It carries INK, not white (6.29:1 against 3.11:1). |
| `bg-overlay` | `overlay` | `neutral-975` @ 32% | `neutral-975` @ 56% | Scrim behind a dialog or the off-canvas rail. Alpha is held apart from the hex here for the same reason it is everywhere else: React Native composes it differently. |
| `bg-accent-soft` | `accent-soft` | `pine-100` `#E2F1EA` | `pine-900` `#152C24` | The accent as a ground under copy: a wash at a tenth of the primary, never a fill behind body text at full strength. |
| `bg-tint-warm` | `tint-warm` | `clay-100` `#E8DCCE` | `clay-900` `#3A2A20` | The warm tint block. A section or a card ground that is neither the page nor a sheet — the reference's mocha panel, one honest step of warmth off the paper. It never replaces `bg-canvas` for a whole page; it marks ONE block, which is the whole point of it. It was clay-50 for one revision and that was the mistake: seven units off the paper is a tint that only exists in the stylesheet. |
| `bg-chip-clay` | `chip-clay` | `clay-200` `#D8C6B0` | `clay-900` `#3A2A20` | Decorative index tint, warm, and a step deeper than the warm GROUND so the two are never confused. The four chip tints tell an ENUMERATION apart — an 01/02/03/04, a role, a channel — and they are never a state: five statuses is the catalog, and a sixth colour reading as one is how a legend stops being true. A chip tint never shares a cell with a status chip. |
| `bg-chip-violet` | `chip-violet` | `violet-100` `#F0EBFC` | `violet-900` `#36284D` | Decorative index tint, cool. Violet is the safe counter-tint here because it is already data-visualisation only and never a status; cobalt is not available for this, it carries the review state. |
| `bg-chip-pine` | `chip-pine` | `pine-50` `#EFF7F4` | `pine-900` `#152C24` | Decorative index tint, green. The faintest pine wash, one rung lighter than `bg-accent-soft`, so a decorative chip is never mistaken for a selected state. |
| `bg-chip-stone` | `chip-stone` | `neutral-50` `#E6E2D7` | `neutral-900` `#2A2524` | Decorative index tint, neutral. The fourth of four: an enumeration longer than three needs a quiet member, and a fifth hue would be a colour nobody can name. |

### Text

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `text-primary` | `ink` | `neutral-975` `#0C0C0A` | `neutral-25` `#ECE9DF` | Values, titles — the thing being read. 16.12:1 on canvas. |
| `text-secondary` | `ink-secondary` | `neutral-700` `#514B46` | `neutral-200` `#D1CDC7` | Supporting copy. 7.07:1 on canvas. |
| `text-muted` | `ink-muted` | `neutral-600` `#665F58` | `neutral-300` `#C7C3BD` | Metadata, labels, placeholders. 5.17:1 on canvas — the body-text floor. Four text levels, never two: two is too flat to build hierarchy from. The dark column is not a mirror of the light one: it sits a step lighter throughout, because a muted fill in dark mode is much closer to its own copy than a muted fill in light mode is to its. |
| `text-subtle` | `ink-subtle` | `neutral-500` `#7B736A` | `neutral-400` `#A5A19E` | Metadata ONLY, never body text. 3.84:1 clears the large-text and non-text threshold and nothing else. |
| `text-on-inverse` | `on-inverse` | `neutral-150` `#D9D6CD` | `neutral-900` `#2A2524` | Copy on the inverse surface. 13.47:1. |
| `text-on-inverse-muted` | `on-inverse-muted` | `neutral-400` `#A5A19E` | `neutral-700` `#514B46` | Metadata on the inverse surface. 7.64:1. |
| `text-on-signal` | `on-signal` | `neutral-975` `#0C0C0A` | `neutral-975` `#0C0C0A` | Ink on the signal ground: 6.29:1. White on ember measures 3.11:1 and is not available at body size, so the signal action is black on orange — the pairing the brand sheet itself shows. |
| `text-link` | `link` | `pine-700` `#395A4D` | `pine-300` `#A0C4B4` | A link, in the primary: 6.30:1 on canvas, 7.65:1 on white, 10.30:1 in dark. |
| `text-brand` | `brand` | `pine-700` `#395A4D` | `pine-300` `#A0C4B4` | The brand as a word — the primary. Held for a word that has to read as the brand. The landing's own wordmark is ink, with the primary on the mark's dot beside it — the owner's arrangement of 2026-09-22. |
| `text-accent` | `accent` | `pine-700` `#395A4D` | `pine-300` `#A0C4B4` | THE ACCENT, and since 2026-09-22 the brand's PRIMARY colour: the kit's deep green. 6.30:1 on the canvas, so unlike the orange it replaced here it is safe at any size — the highlighted phrase in a display heading, and the colour a canvas ornament reads from its computed `color` on the landing. |
| `text-chip-clay` | `chip-clay-fg` | `clay-800` `#4A3527` | `clay-300` `#C8B8A0` | The warm index tint's mark. 6.90:1 on its own ground in light, 7.06:1 in dark. |
| `text-chip-violet` | `chip-violet-fg` | `violet-700` `#60438D` | `violet-300` `#D0C3EB` | The cool index tint's mark. 6.70:1 on its own ground in light, 8.09:1 in dark. |
| `text-chip-pine` | `chip-pine-fg` | `pine-700` `#395A4D` | `pine-300` `#A0C4B4` | The green index tint's mark. 7.03:1 on its own ground in light, 7.79:1 in dark. |
| `text-chip-stone` | `chip-stone-fg` | `neutral-700` `#514B46` | `neutral-400` `#A5A19E` | The neutral index tint's mark. 6.64:1 on its own ground in light, 5.90:1 in dark. |

### Structure

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `border-subtle` | `line-subtle` | `neutral-150` `#D9D6CD` | `neutral-900` `#2A2524` | Hairline inside a surface, and the dashed blueprint guide on the landing. |
| `border-default` | `line` | `neutral-200` `#D1CDC7` | `neutral-800` `#403C39` | The default. Panel edge, input edge, divider. Structure comes from this line plus a lightness shift between the four bg roles — there is no elevation ladder. |
| `border-strong` | `line-strong` | `neutral-300` `#C7C3BD` | `neutral-700` `#514B46` | Table rules and selected outlines. |
| `border-inverse` | `line-inverse` | `neutral-800` `#403C39` | `neutral-300` `#C7C3BD` | Hairline on the inverse surface. The two themes do not mirror here and should not: in light the inverse surface is ink and the line lifts off it; in dark the inverse surface is white and the line has to sit down onto it, which is a step further from the ground. |
| `border-focus` | `focus` | `pine-700` `#395A4D` | `pine-300` `#A0C4B4` | One focus treatment on every ordinary ground, in the primary: 6.30:1 on canvas and 7.65:1 on white, both far past the 3:1 a focus ring owes. On the INVERSE surface it measures 2.56:1 and must not be used — `border-focus-inverse` is the ring there, and `base.css` switches to it inside `bg-inverse`. |
| `border-focus-inverse` | `focus-inverse` | `pine-300` `#A0C4B4` | `pine-700` `#395A4D` | The focus ring inside an inverse surface — the field client's chrome, the phone frames, any marketing band on ink. The ordinary ring is the primary at 2.56:1 against that ground, which is under the 3:1 WCAG 2.1 §1.4.11 asks of a focus indicator; this rung measures 10.30:1. Both themes are the same idea and swap rungs, because «inverse» inverts with the theme. |
| `border-accent` | `line-accent` | `pine-700` `#395A4D` | `pine-300` `#A0C4B4` | The accent as an edge: 7.65:1 on white, 6.30:1 on canvas. |
| `border-warm` | `line-warm` | `clay-200` `#D8C6B0` | `clay-800` `#4A3527` | The warm tint block's own edge, so a tinted panel is not outlined in a cooler line than its fill. 1.37:1 on the canvas. |

### Action

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `action-primary-bg` | `action` | `neutral-975` `#0C0C0A` | `neutral-0` `#FFFFFF` | D1: ink is the action colour. Primary buttons are near-black, exactly as Folio and Linear. This is what removes the readable-accent problem from the system entirely rather than working around it. |
| `action-primary-fg` | `action-fg` | `neutral-0` `#FFFFFF` | `neutral-975` `#0C0C0A` | The primary action's label. 19.58:1 — the highest-contrast pair in the system, which is what a control that commits money should carry. |
| `action-primary-hover` | `action-hover` | `neutral-900` `#2A2524` | `neutral-150` `#D9D6CD` | One step off ink. |
| `action-signal-bg` | `action-signal` | `ember-500` `#FF5B04` | `ember-500` `#FF5B04` | The one accent action a screen may carry — the secondary as a fill. At most one per screen; the landing carries none. It carries ink, never white. (DEV-029: the landing carried one per page for one pass; the owner took it off.) |
| `action-signal-fg` | `action-signal-fg` | `neutral-975` `#0C0C0A` | `neutral-975` `#0C0C0A` | Ink on the accent action: 6.29:1. |
| `action-signal-hover` | `action-signal-hover` | `ember-600` `#D84A00` | `ember-600` `#D84A00` | The accent action pressed: one rung down, ink still at 4.57:1. |
| `action-brand-bg` | `action-brand` | `pine-700` `#395A4D` | `pine-300` `#A0C4B4` | The dashboard's primary action in the brand's primary (owner, 2026-09-23: «Зелёная, как в Autumn»). `apps/app` only — the landing's actions stay the ink pill. White on it measures 7.65:1. |
| `action-brand-fg` | `action-brand-fg` | `neutral-0` `#FFFFFF` | `neutral-975` `#0C0C0A` | The brand action's label: white on pine in light, ink on the light pine rung in dark. |
| `action-brand-hover` | `action-brand-hover` | `pine-800` `#274439` | `pine-200` `#CBE3D8` | The brand action pressed: one rung deeper, so the label only gains contrast. |
| `action-ghost-hover` | `action-ghost-hover` | `neutral-100` `#E0DCD1` | `neutral-900` `#2A2524` | Chrome hover. |

### Status

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `status-ready-surface` | `status-ready` | `green-100` `#E0F5E3` | `green-900` `#0D371A` | Ready chip ground. |
| `status-ready-border` | `status-ready-line` | `green-200` `#BEECC6` | `green-800` `#115629` | Ready chip edge. |
| `status-ready-fg` | `status-ready-fg` | `green-700` `#167337` | `green-300` `#8CD99C` | Ready as text: 5.18:1 on its ground. |
| `status-attention-surface` | `status-attention` | `amber-100` `#FBEFD8` | `amber-900` `#462D03` | Attention chip ground. |
| `status-attention-border` | `status-attention-line` | `amber-200` `#F7DAA5` | `amber-800` `#6C4800` | Attention chip edge. |
| `status-attention-fg` | `status-attention-fg` | `amber-700` `#875D00` | `amber-300` `#EDC06B` | Attention as text: 5.13:1 on its ground. |
| `status-blocked-surface` | `status-blocked` | `danger-100` `#FEE8E7` | `danger-900` `#55181D` | Blocked or refused. |
| `status-blocked-border` | `status-blocked-line` | `danger-200` `#FED4D3` | `danger-800` `#7E1825` | Chip edge. |
| `status-blocked-fg` | `status-blocked-fg` | `danger-700` `#A3122C` | `danger-300` `#FAB7B6` | 6.68:1 light, 8.15:1 dark. |
| `status-review-surface` | `status-review` | `cobalt-100` `#EAEDFF` | `cobalt-900` `#101D5E` | Submitted or in review — «на розгляді» is cobalt on this product. |
| `status-review-border` | `status-review-line` | `cobalt-200` `#D5DBFF` | `cobalt-800` `#172A8C` | Review chip edge. |
| `status-review-fg` | `status-review-fg` | `cobalt-700` `#1E36B8` | `cobalt-300` `#9AAAFF` | Review as text: 7.94:1 on its ground. |
| `status-idle-surface` | `status-idle` | `neutral-100` `#E0DCD1` | `neutral-900` `#2A2524` | Nothing has happened yet. Deliberately colourless: an idle state that carries a hue reads as a state that means something. |
| `status-idle-border` | `status-idle-line` | `neutral-200` `#D1CDC7` | `neutral-800` `#403C39` | Chip edge. |
| `status-idle-fg` | `status-idle-fg` | `neutral-700` `#514B46` | `neutral-300` `#C7C3BD` | 6.27:1 light, 8.62:1 dark. |

### Evidence

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `evidence-satisfied` | `evidence-satisfied` | `green-700` `#167337` | `green-300` `#8CD99C` | A satisfied requirement, as text on the canvas: 4.88:1. |
| `evidence-pending` | `evidence-pending` | `amber-800` `#6C4800` | `amber-300` `#EDC06B` | Evidence expected, not yet obtained. 6.74:1 on canvas. |
| `evidence-blocking` | `evidence-blocking` | `danger-700` `#A3122C` | `danger-300` `#FAB7B6` | Evidence missing and blocking a closure. 6.45:1 on canvas. |

### Data visualisation

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `viz-brand` | `viz-brand` | `pine-700` `#395A4D` | `pine-300` `#A0C4B4` | The dashboard's one-series data mark — a filled cell of a count, a tick of a bar — in the brand's primary (owner, 2026-09-23: «Зелёный + акцент»: data in pine, ember only for a highlighted cell). A mark, not a wash: nothing is read through it. 7.65:1 on white, so a single cell survives as a non-text mark. |
| `viz-empty` | `viz-empty` | `neutral-150` `#D9D6CD` | `neutral-800` `#403C39` | The empty cell beside `viz-brand`: the slot a count has not filled. Paler than any line so the filled cells carry the figure; the count is always also written in text. |
| `viz-1` | `viz-1` | `cobalt-600` `#2440D9` | `cobalt-300` `#9AAAFF` | First categorical series. |
| `viz-2` | `viz-2` | `green-600` `#1C8742` | `green-300` `#8CD99C` | Second categorical series. |
| `viz-3` | `viz-3` | `amber-600` `#BA8400` | `amber-300` `#EDC06B` | Third categorical series. |
| `viz-4` | `viz-4` | `danger-600` `#C71336` | `danger-300` `#FAB7B6` | Categorical series 4. |
| `viz-5` | `viz-5` | `violet-500` `#916CCD` | `violet-300` `#D0C3EB` | Categorical series 5. Violet exists for this role and no other — it is never a status. |

---

## 3. Elevation

Four, and a panel gets none of them. Structure is a 1px border plus a
lightness shift between the surface roles; there is no elevation ladder.

| Token | Value | Ruling |
|---|---|---|
| `raised` | `0px 1px 2px 0px rgba(12, 12, 10, 0.04)` | The role grid cell at rest, and since 2026-09-23 (DEV-035, owner: «Как в Autumn») the dashboard's work sheet, its panels, its KPI cards and the current navigation item in `apps/app`: the reference's cards lift by this much and no more. Structure is still border-led — the border draws the edge, this only seats it. |
| `overlay` | `0px 12px 30px -16px rgba(12, 12, 10, 0.35)` | The floating pills over the product frame, compact callouts, a popover. |
| `modal` | `0px 8px 24px 0px rgba(12, 12, 10, 0.08), 0px 24px 64px 0px rgba(12, 12, 10, 0.12)` | The only things that cover content: dialog and the off-canvas rail. Under D2 the rail is no longer dark, so this shadow now carries the whole 'this covers content' signal that colour used to carry with it. |
| `float` | `0px 20px 50px -30px rgba(12, 12, 10, 0.22), 0px 1px 2px 0px rgba(12, 12, 10, 0.05)` | The prototype's --sh: the board, the receipt, the form, the route cards and the «now» card. Marketing only. |
| `float-accent` | `0px 30px 70px -40px rgba(57, 90, 77, 0.35), 0px 1px 2px 0px rgba(12, 12, 10, 0.05)` | The «З GoProceed» compare card only (prototype .cmp-card.now, index.html l.607): the one coloured shadow in the system, and it is the ACCENT's colour — pine since the Autumn palette — under the one card that is the product promise; the spark is never spent on an area this large. Marketing only. |

---

## 4. Scales

### `font`

| Token | Value | Ruling |
|---|---|---|
| `display` | `'Hanken Grotesk Variable', 'Commissioner Variable', system-ui, sans-serif` | Autumn, 2026-09-22: one sans for everything, and the `.display` class keeps its job (opt-in marketing headings, never inside /app/**) without naming a second face. |
| `sans` | `'Hanken Grotesk Variable', 'Commissioner Variable', system-ui, sans-serif` | TWO FILES, ONE VOICE. The brand sheet sets the product in Hanken Grotesk, which has NO Cyrillic at all — verified on the family's own v12 file: of the 66 Ukrainian letters it carries none, and of the whole Cyrillic block only ₴. Public copy here is Ukrainian, so Hanken alone would render the site in a system fallback. Commissioner stands behind it for Cyrillic: full Ukrainian coverage including Іі Її Єє Ґґ, and the closest metric match to Hanken among the Cyrillic-capable faces measured (x-height/cap 0.701 against 0.707; stem-width 0.413 em against 0.409). Order matters and is load-bearing — Hanken first, so every Latin glyph, every digit and the wordmark are the brand's own face, and only Cyrillic falls through. Hanken's digits are tabular by construction (one 560/1000 advance for all ten), which is what the `tabular` utility needed `tnum` for under Onest; neither face declares `tnum`. |
| `mono` | `'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace` | D4. Index labels, evidence IDs, figure captions and ledger keys. Linear's marketing site uses a mono for exactly this (FIG 0.2, 1.0 Intake) and it is the motif that makes an indexed document read as an instrument. Subset to digits, Latin caps and punctuation — the full face is not loaded. |
| `features` | `"calt"` | Commissioner has `calt`; Hanken Grotesk has none of `calt`, `cv01` or `ss03` and ignores this setting. Tabular figures no longer come from a feature at all — Hanken's digits are one width (see `font.sans`). |

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
| `mkt-lead` | `clamp(16px, 1.25vw, 19px)` | The lead paragraph beside a section heading, measured from the prototype. |
| `mkt-display-3` | `clamp(24px, 2.6vw, 34px)` | The h3 inside a route card, measured from the prototype. |
| `mkt-display-2` | `clamp(28px, 3.3vw, 44px)` | Section h2, measured from the prototype. |
| `mkt-display-1` | `clamp(38px, 5.2vw, 66px)` | The hero h1, measured from the prototype. |

### `fontWeight`

| Token | Value | Ruling |
|---|---|---|
| `normal` | `400` | Variable-font axis value. |
| `medium` | `500` | Hanken Grotesk's medium. The 510 ruling was measured on Inter and does not travel; Commissioner matches this weight behind it. |
| `semibold` | `600` | Hanken Grotesk's semibold — the prototype's heading weight. |
| `bold` | `700` | Hanken Grotesk's bold; the quote marks in the position block. |

### `leading`

| Token | Value | Ruling |
|---|---|---|
| `none` | `1` | Mono index labels, where the line box must not add height. |
| `tight` | `1.15` | Display headings at mkt-display-3. |
| `display` | `1.05` | mkt-display-1 and -2: the prototype's heading line-height. |
| `snug` | `1.35` | Product headings. |
| `normal` | `1.5` | Product body and table cells. |
| `relaxed` | `1.6` | Marketing body and lead. Linear's measured --text-regular-line-height. |

### `tracking`

| Token | Value | Ruling |
|---|---|---|
| `tightest` | `-0.035em` | mkt-display-1: the prototype's h1 tracking. |
| `tighter` | `-0.03em` | mkt-display-2: the prototype's h2 tracking. |
| `tight` | `-0.025em` | mkt-display-3 and product h1/h2: the prototype's h3 tracking. |
| `normal` | `-0.011em` | Body and below. Linear's measured --text-regular-letter-spacing. Not 0: Inter at 13-16px sets slightly loose by default. |
| `wide` | `0.08em` | mkt-index only. Uppercase mono needs the extra space to stop reading as a word. |

### `radius`

| Token | Value | Ruling |
|---|---|---|
| `control` | `6px` | v1, kept. Buttons, inputs, chips inside /app/**. A register is not a set of cards. |
| `field` | `8px` | New. Folio's most frequent radius by a wide margin (301 elements at 8px against 89 at 6px). Marketing controls and evidence tiles. |
| `panel` | `10px` | v1, kept. Panels and cards inside /app/**. |
| `card` | `12px` | The prototype's --r 12px — the figure, the form, the needs cells — and since 2026-09-23 (DEV-035) the dashboard's work sheet, the one outer instrument of `apps/app`'s shell. |
| `surface` | `14px` | Marketing only: route cards, the role grid, bento cells, compare cards, channel cards, the board. |
| `section` | `16px` | Marketing only: the closing CTA card. |
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
| `marketing` | `1180px` | The landing column, the prototype's .wrap. `content` (1240) stays the app's cap so a product screenshot still lines up with the shell it came from. |

### `duration`

| Token | Value | Ruling |
|---|---|---|
| `instant` | `100ms` | Colour-only transitions. Linear's measured value for the same job. |
| `fast` | `160ms` | Hover, press, state. Linear's dominant measured duration and the one curve+duration pair that appears on more of their elements than any other. |
| `base` | `240ms` | Accordion, tab, popover, chip. Folio measures 200ms on accordions and 250ms is Linear's --speed-regularTransition; 240ms sits between two measured values rather than beside one. |
| `slow` | `400ms` | Scroll reveal and section enter. Measured identically on Grovia (400ms) and Linear (staggerIn 400ms) — two independent sites converging on the same number is the strongest evidence available for a motion value. |
| `marquee` | `35s` | One full pass of the logo/proof ribbon. Folio's measured value on the same device (35s and 40.25s on two tracks). Long enough that it reads as ambient rather than as something demanding to be watched, and the only perpetual animation the system permits — it pauses on hover and freezes entirely under prefers-reduced-motion. [2026-09-06: one of the five named perpetual loops now — marquee, beam, pulse, drift, flow; spec 2026-09-06 §5.1] |
| `deliberate` | `640ms` | Hero composition and sequence steps. Long enough to be read as choreography, short enough that a returning visitor is not waiting for it. |
| `stately` | `900ms` | The approved prototype (design-references/contest-2026-09/daylight/index.html) enters copy and cards over .9–1.0s: [data-up], the role cells, the compare cards, the bento cells, the hero pills, the board cards. One token for that family; spec 2026-09-06 §6 lists every rounding. |
| `grand` | `1200ms` | The prototype hero and heading choreography: SplitText line masks 1.1s, the h1 and the receipt 1.2s, the channel cards 1.2s, the stage 1.4s, the counters 1.6s. One token for the family; the 1.4 and 1.6 round down, recorded in spec 2026-09-06 §6. |

### `ease`

| Token | Value | Ruling |
|---|---|---|
| `out` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | ease-out-quad. THE interaction curve — measured as Linear's dominant transition timing function. Ease-out only, never ease-in: ease-in stalls the first frame, which is the frame being watched. |
| `enter` | `cubic-bezier(0.165, 0.84, 0.44, 1)` | ease-out-quart. Reveals and staggers. Linear's measured staggerIn curve. |
| `emphatic` | `cubic-bezier(0.19, 1, 0.22, 1)` | ease-out-expo. Hero composition and line draw. |
| `soft` | `cubic-bezier(0.44, 0, 0.56, 1)` | Symmetric. Cross-fades, where a directionless change should not imply a direction, and the landing ambient yoyo loops (drift, pulse), which have no direction either [2026-09-06]. Grovia measured reveal curve. |
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
| `tilt` | `stiffness 120, damping 20, mass 1` | Pointer tilt on the board, the role cells and the channel cards. Settles in roughly the prototype quickTo .6–1s on power3, no overshoot — a surface that leans must not wobble. |
| `magnetic` | `stiffness 150, damping 18, mass 0.5` | A control following the pointer catches up in about half a second, the prototype quickTo .5s. motion-primitives ships 26.7/4.1/0.2 which overshoots visibly; the prototype does not. |

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
| `header-height-marketing` | `58px` | The prototype's header bar. |
| `register-row-padding-y` | `10px` | v1, kept (py-2.5). Measured against real content at 1440x900: 14 rows in the fold on /app/work. |
| `register-row-padding-x` | `12px` | v1, kept (px-3). |
| `focus-ring-width` | `2px` | One treatment for every focusable element inside the shell, matching the public routes so the two cannot disagree. 2px rather than Linear's 1px because this ring must survive being rendered on a construction site in daylight. |
| `focus-ring-offset` | `2px` | Offset rather than inset, so the ring never eats the control's own border and change the element's apparent size. |
| `control-height-marketing` | `42px` | The prototype's buttons and inputs on the landing. Button size="lg" reads it; the touch floor still wins under pointer:coarse. |

---

## 6. Measured contrast

Computed from the source at generation time by the same function
`packages/testing/src/contrast.test.ts` asserts with. WCAG 2.1: 4.5:1 for
body text, 3:1 for large text and non-text contrast.

| Pairing | Light | Dark |
|---|---:|---:|
| primary copy on the canvas | 16.12:1 | 16.12:1 |
| secondary copy on the canvas | 7.07:1 | 12.37:1 |
| muted copy on the canvas | 5.17:1 | 11.16:1 |
| muted copy on a subtle fill | 4.85:1 | 8.62:1 |
| muted copy on a muted fill | 4.59:1 | 6.22:1 |
| metadata on the canvas | 3.84:1 | 7.64:1 |
| copy on the inverse surface | 13.47:1 | 15.12:1 |
| metadata on the inverse surface | 7.64:1 | 8.59:1 |
| copy on the mark | 6.29:1 | 6.29:1 |
| a link on a surface | 7.65:1 | 9.24:1 |
| 'ready' as text on a surface | 7.65:1 | 9.24:1 |
| the primary action's label | 19.58:1 | 19.58:1 |
| the signal action's label | 6.29:1 | 6.29:1 |
| ready chip | 5.18:1 | 7.93:1 |
| attention chip | 5.13:1 | 7.55:1 |
| blocked chip | 6.68:1 | 8.15:1 |
| review chip | 7.94:1 | 7.04:1 |
| idle chip | 6.27:1 | 8.62:1 |
| the focus ring against a surface | 7.65:1 | 9.24:1 |
