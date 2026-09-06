# GoProceed design tokens — reference

**GENERATED — do not edit.** Source: `packages/tokens/src/tokens.json`.
Regenerate: `node packages/tokens/scripts/generate-docs.mjs`.
`packages/testing/src/token-fidelity.test.ts` fails if this file drifts.

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-08-19

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
| `neutral-0` | `#FFFFFF` | 1, 0, 89.88 | 1.09 | 18.08 | Pure white. The working surface a register sits on; a panel reads as a sheet laid on the paper rather than as more paper. |
| `neutral-25` | `#F6F5F1` | 0.9698, 0.005408, 95.1 | 1.00 | 16.57 | The canvas. The prototype's paper #F6F5F1 — warm at hue 95, measurably paper. The ramp's light end is warm and its dark end is cool (hue ≈ 270), on purpose: paper is warm, ink is cool, and each step is its own triple. |
| `neutral-50` | `#EFEEE8` | 0.9482, 0.008055, 98.88 | 1.07 | 15.55 | Paper-2 #EFEEE8: the «was» card, sunken wells, the ground under an inset control. |
| `neutral-100` | `#E9E8E2` | 0.9301, 0.008093, 98.88 | 1.13 | 14.73 | Inactive segment, ghost-button hover on the canvas, idle status ground. |
| `neutral-150` | `#E2E1DE` | 0.9097, 0.004188, 91.45 | 1.20 | 13.82 | Hairline inside a surface, and copy on ink (13.82:1 against neutral-975). |
| `neutral-200` | `#D9D9D6` | 0.8845, 0.004061, 106.48 | 1.30 | 12.78 | The default border: ink at 9% over paper, composited. 1.30:1 against the canvas — visible as structure, invisible as a line you read. |
| `neutral-300` | `#CFCFCC` | 0.8537, 0.004097, 106.49 | 1.43 | 11.58 | The strong border: ink at 16% over paper, composited. Table rules, selected outlines, the edge of a card on white (1.56:1). |
| `neutral-400` | `#A9ACB3` | 0.7442, 0.010568, 267.33 | 2.08 | 7.95 | The prototype's ink-4 #A9ACB3. Non-text only on light: disabled fills, metadata on ink (7.95:1). Never body copy on the canvas. |
| `neutral-500` | `#7A7E87` | 0.5927, 0.014479, 266.63 | 3.73 | 4.44 | The prototype's ink-3 #7A7E87. Metadata floor: 3.73:1 on the canvas, so it clears the non-text and large-text threshold and nothing else. Never body text. |
| `neutral-600` | `#5E626B` | 0.4958, 0.01516, 266.59 | 5.60 | 2.96 | The body-text floor, measured against the DARKEST ground it lands on: 5.60:1 on canvas, 6.11:1 on white, 5.26:1 on a subtle fill, 4.98:1 on a muted fill. One step darker than the prototype's ink-3, which measures 3.73:1 on paper and cannot carry a caption. |
| `neutral-700` | `#4E5158` | 0.4347, 0.012129, 267.24 | 7.29 | 2.27 | The prototype's ink-2 #4E5158. Secondary copy, 7.29:1 on canvas; also the idle status foreground. |
| `neutral-800` | `#3A3D45` | 0.3603, 0.014381, 269.29 | 9.96 | 1.66 | Hairline on ink; the only border that reads on the inverse surface (1.66:1). |
| `neutral-900` | `#2A2C33` | 0.294, 0.013009, 272.93 | 12.78 | 1.30 | The prototype's button hover #2A2C33. One step off ink, so the press is felt without the button changing identity. |
| `neutral-950` | `#1E1F24` | 0.2404, 0.009628, 276.67 | 15.08 | 1.10 | The inverse working surface — dark mode's panel, authored now and not shipped (D6). |
| `neutral-975` | `#15161A` | 0.2009, 0.008119, 274.5 | 16.57 | 1.00 | Ink #15161A, the prototype's --ink. Primary text and the primary action fill. 16.57:1 on canvas. Cool where the paper is warm; that contrast is the identity. |

### `cobalt`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `cobalt-50` | `#F4F6FF` | 0.9742, 0.012172, 276.1 | 1.01 | 16.76 | Faintest cobalt wash — a whole row tinted without becoming a chip. |
| `cobalt-100` | `#EAEDFF` | 0.9491, 0.024404, 278.37 | 1.07 | 15.54 | Cobalt at 10% over white, composited: the review chip ground, the selected card's ring, the paired-row wash. |
| `cobalt-200` | `#D5DBFF` | 0.8982, 0.049772, 277.88 | 1.25 | 13.26 | Review chip border; the selected card's soft edge. |
| `cobalt-300` | `#9AAAFF` | 0.7593, 0.123516, 274.95 | 2.01 | 8.24 | The prototype's #9AAAFF — the accent on ink (8.24:1), and every cobalt foreground in dark mode. |
| `cobalt-400` | `#5568DE` | 0.5662, 0.17981, 272.46 | 4.35 | 3.81 | THE ACCENT #5568DE: the highlighted phrase in a display heading. 4.35:1 on the canvas — large text only, never body copy. |
| `cobalt-500` | `#2B4BFF` | 0.5251, 0.264234, 267.09 | 5.42 | 3.06 | THE MARK #2B4BFF: the brand dot, the signal action, the focus ring, the review state. 5.42:1 on the canvas, 5.91:1 as a ground for white. |
| `cobalt-600` | `#2440D9` | 0.4677, 0.232104, 267.14 | 6.85 | 2.42 | Signal hover and link colour. 7.47:1 on white. |
| `cobalt-700` | `#1E36B8` | 0.4157, 0.203704, 267.26 | 8.46 | 1.96 | Review as TEXT: 7.94:1 on cobalt-100, 9.23:1 on white. Also the brand as text. |
| `cobalt-800` | `#172A8C` | 0.3465, 0.162363, 267.55 | 11.02 | 1.50 | Review chip border in dark mode. |
| `cobalt-900` | `#101D5E` | 0.2702, 0.116305, 268.31 | 14.16 | 1.17 | Review ground in dark mode; the accent-soft ground in dark mode. |

### `green`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `green-50` | `#F1F9F4` | 0.9747, 0.0107, 158.85 | 1.02 | 16.87 | Faintest ready wash. |
| `green-100` | `#E8F4EE` | 0.9565, 0.014961, 164.73 | 1.03 | 16.02 | Ready chip ground: ok at 10% over white, composited. |
| `green-200` | `#CFE9DC` | 0.9113, 0.032544, 164.17 | 1.18 | 14.07 | Ready chip border. |
| `green-300` | `#9FD4B8` | 0.8252, 0.067616, 161.41 | 1.53 | 10.83 | Ready foreground in dark mode (7.15:1 on green-900). |
| `green-500` | `#1E8F5A` | 0.5763, 0.127169, 157.1 | 3.75 | 4.42 | The prototype's ok #1E8F5A. Icons, dots and check marks. 4.1:1 on white — NOT text. |
| `green-600` | `#1B8050` | 0.532, 0.117054, 156.95 | 4.53 | 3.66 | Viz weight on white. |
| `green-700` | `#17754A` | 0.4989, 0.108739, 157.73 | 5.23 | 3.17 | Ready as TEXT: 5.06:1 on green-100, 5.23:1 on canvas, 5.71:1 on white. |
| `green-800` | `#125A39` | 0.4157, 0.08836, 158.16 | 7.56 | 2.19 | Ready chip border in dark mode. |
| `green-900` | `#0D3F28` | 0.3281, 0.066562, 158.87 | 10.95 | 1.51 | Ready ground in dark mode. |

### `amber`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `amber-50` | `#FCF5EF` | 0.9739, 0.010978, 63.36 | 1.01 | 16.74 | Faintest attention wash. |
| `amber-100` | `#FAEFE8` | 0.9588, 0.015167, 54.93 | 1.04 | 15.99 | Attention chip ground: warn at 10% over white, composited. |
| `amber-200` | `#F4D8C4` | 0.9002, 0.041211, 57.72 | 1.24 | 13.31 | Attention chip border. |
| `amber-300` | `#EDB48F` | 0.8134, 0.083056, 54.22 | 1.67 | 9.92 | Attention foreground in dark mode (6.90:1 on amber-900). |
| `amber-500` | `#E07A32` | 0.6823, 0.15117, 51.96 | 2.75 | 6.03 | Icon and bar weight; never text. |
| `amber-600` | `#C8641F` | 0.6123, 0.148425, 49.89 | 3.63 | 4.56 | The prototype's warn #C8641F: the draft stamp, the rule box's border. 3.96:1 on white — icons and strokes, NOT text. |
| `amber-700` | `#A6511A` | 0.5319, 0.129258, 48.79 | 5.05 | 3.28 | Attention as TEXT: 4.87:1 on amber-100. |
| `amber-800` | `#7E3E14` | 0.4389, 0.103138, 49.64 | 7.44 | 2.23 | The evidence-pending foreground (7.44:1 on canvas). |
| `amber-900` | `#4F2A10` | 0.328, 0.066775, 53 | 11.52 | 1.44 | Attention ground in dark mode. |

### `danger`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `danger-50` | `#FBF4F3` | 0.972, 0.00753, 26 | 1.00 | 16.65 | Faintest blocked wash. |
| `danger-100` | `#FCE9E6` | 0.948, 0.022039, 26 | 1.07 | 15.44 | Blocked chip ground. |
| `danger-200` | `#FBD5D1` | 0.905, 0.043269, 26 | 1.24 | 13.38 | Blocked chip border. |
| `danger-300` | `#F5BAB3` | 0.84, 0.070375, 26 | 1.53 | 10.81 | Blocked foreground in dark mode (8.00:1 on danger-900). |
| `danger-500` | `#E45C55` | 0.6484, 0.171, 26 | 3.23 | 5.13 | Reproduces the legacy Red #E45C55 exactly from its own OKLCH triple (L 0.6484 C 0.1710 H 26). Icon and bar weight. |
| `danger-600` | `#CE2F30` | 0.56, 0.195828, 26 | 4.73 | 3.51 | The one solid destructive fill: white on it measures 5.16:1. Nothing under /app/** deletes anything, so this exists for the field client and for refusal states, not for a destructive button variant. |
| `danger-700` | `#A02827` | 0.47, 0.156763, 26 | 6.81 | 2.43 | Blocked text: 6.34:1 on danger-100, 7.17:1 on canvas. Also the evidence-blocking foreground. |
| `danger-800` | `#792623` | 0.395, 0.115745, 26 | 9.10 | 1.82 | Densest blocked text, for a blocked figure inside a dense table. |
| `danger-900` | `#531E1B` | 0.315, 0.079589, 26 | 12.27 | 1.35 | Blocked ground in dark mode. |

### `violet`

| Token | Hex | OKLCH (L, C, H) | on canvas | on ink | Ruling |
|---|---|---|---:|---:|---|
| `violet-100` | `#F0EBFC` | 0.95, 0.022312, 300 | 1.07 | 15.49 | Data-visualisation only. Never a status: five statuses is the catalog, and a sixth colour reading as a state is how a legend stops being true. |
| `violet-200` | `#E4DAF9` | 0.905, 0.04319, 300 | 1.23 | 13.51 | Data-visualisation fill. |
| `violet-300` | `#D0C3EB` | 0.84, 0.057941, 300 | 1.52 | 10.92 | Data-visualisation on dark. |
| `violet-500` | `#916CCD` | 0.61, 0.145512, 300 | 3.68 | 4.50 | The fifth categorical series. |
| `violet-700` | `#60438D` | 0.45, 0.120193, 300 | 7.17 | 2.31 | Fifth series, dense variant. |
| `violet-900` | `#36284D` | 0.31, 0.066342, 300 | 12.28 | 1.35 | Fifth series ground in dark mode. |

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
| `bg-canvas` | `canvas` | `neutral-25` `#F6F5F1` | `neutral-975` `#15161A` | The page. Paper, not white — white is reserved for the surface a register sits on, and the two must differ or the panel stops reading as a sheet. |
| `bg-surface` | `surface` | `neutral-0` `#FFFFFF` | `neutral-950` `#1E1F24` | The working surface. Panels, cards, table bodies. |
| `bg-subtle` | `subtle` | `neutral-50` `#EFEEE8` | `neutral-900` `#2A2C33` | Zebra rows, sunken wells, inset grounds. |
| `bg-muted` | `sunken` | `neutral-100` `#E9E8E2` | `neutral-800` `#3A3D45` | Inactive segment, ghost hover, idle status ground. |
| `bg-inverse` | `inverse` | `neutral-975` `#15161A` | `neutral-0` `#FFFFFF` | Under D2 this is no longer the rail. It is the mobile field chrome and exactly one marketing band — the Carbon budget shrinks from 17-21% of the app to two named places. |
| `bg-signal` | `signal` | `cobalt-500` `#2B4BFF` | `cobalt-500` `#2B4BFF` | The mark as a ground. Cobalt replaced lime on 2026-09-05 with the Daylight direction; 5.91:1 under white. |
| `bg-overlay` | `overlay` | `neutral-975` @ 32% | `neutral-975` @ 56% | Scrim behind a dialog or the off-canvas rail. Alpha is held apart from the hex here for the same reason it is everywhere else: React Native composes it differently. |
| `bg-accent-soft` | `accent-soft` | `cobalt-100` `#EAEDFF` | `cobalt-900` `#101D5E` | The selected card's ring, the paired-row wash, the review tag ground. Cobalt at 10%, composited. |

### Text

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `text-primary` | `ink` | `neutral-975` `#15161A` | `neutral-25` `#F6F5F1` | Values, titles — the thing being read. 18.35:1 on canvas. |
| `text-secondary` | `ink-secondary` | `neutral-700` `#4E5158` | `neutral-200` `#D9D9D6` | Supporting copy. 6.56:1 on canvas. |
| `text-muted` | `ink-muted` | `neutral-600` `#5E626B` | `neutral-300` `#CFCFCC` | Metadata, labels, placeholders. 5.07:1 on canvas — the body-text floor. Four text levels, never two: two is too flat to build hierarchy from. The dark column is not a mirror of the light one: it sits a step lighter throughout, because a muted fill in dark mode is much closer to its own copy than a muted fill in light mode is to its. |
| `text-subtle` | `ink-subtle` | `neutral-500` `#7A7E87` | `neutral-400` `#A9ACB3` | Metadata ONLY, never body text. 3.05:1 clears the large-text and non-text threshold and nothing else. |
| `text-on-inverse` | `on-inverse` | `neutral-150` `#E2E1DE` | `neutral-900` `#2A2C33` | Copy on the inverse surface. 15.22:1. |
| `text-on-inverse-muted` | `on-inverse-muted` | `neutral-400` `#A9ACB3` | `neutral-700` `#4E5158` | Metadata on the inverse surface. 8.68:1. |
| `text-on-signal` | `on-signal` | `neutral-0` `#FFFFFF` | `neutral-0` `#FFFFFF` | White on the mark, 5.91:1 both themes. |
| `text-link` | `link` | `cobalt-600` `#2440D9` | `cobalt-300` `#9AAAFF` | Links. 7.47:1 on a surface. |
| `text-brand` | `brand` | `cobalt-700` `#1E36B8` | `cobalt-300` `#9AAAFF` | The brand as text, and «ready» named in cobalt where a chip would be too loud. 9.23:1 on a surface. |
| `text-accent` | `accent` | `cobalt-400` `#5568DE` | `cobalt-300` `#9AAAFF` | The highlighted phrase in a display heading — the one accent the prototype uses (F8). LARGE TEXT ONLY: 4.35:1 on the canvas clears 3:1 and not 4.5:1, so it never carries body copy. |

### Structure

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `border-subtle` | `line-subtle` | `neutral-150` `#E2E1DE` | `neutral-900` `#2A2C33` | Hairline inside a surface, and the dashed blueprint guide on the landing. |
| `border-default` | `line` | `neutral-200` `#D9D9D6` | `neutral-800` `#3A3D45` | The default. Panel edge, input edge, divider. Structure comes from this line plus a lightness shift between the four bg roles — there is no elevation ladder. |
| `border-strong` | `line-strong` | `neutral-300` `#CFCFCC` | `neutral-700` `#4E5158` | Table rules and selected outlines. |
| `border-inverse` | `line-inverse` | `neutral-800` `#3A3D45` | `neutral-300` `#CFCFCC` | Hairline on the inverse surface. The two themes do not mirror here and should not: in light the inverse surface is ink and the line lifts off it; in dark the inverse surface is white and the line has to sit down onto it, which is a step further from the ground. |
| `border-focus` | `focus` | `cobalt-500` `#2B4BFF` | `cobalt-300` `#9AAAFF` | One focus treatment for every focusable element. 5.91:1 on a surface. |
| `border-accent` | `line-accent` | `cobalt-500` `#2B4BFF` | `cobalt-300` `#9AAAFF` | The selected card's edge and the «now» card's tint. 5.91:1 on a surface. |

### Action

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `action-primary-bg` | `action` | `neutral-975` `#15161A` | `neutral-0` `#FFFFFF` | D1: ink is the action colour. Primary buttons are near-black, exactly as Folio and Linear. This is what removes the readable-accent problem from the system entirely rather than working around it. |
| `action-primary-fg` | `action-fg` | `neutral-0` `#FFFFFF` | `neutral-975` `#15161A` | The primary action's label. 19.01:1 — the highest-contrast pair in the system, which is what a control that commits money should carry. |
| `action-primary-hover` | `action-hover` | `neutral-900` `#2A2C33` | `neutral-150` `#E2E1DE` | One step off ink. |
| `action-signal-bg` | `action-signal` | `cobalt-500` `#2B4BFF` | `cobalt-500` `#2B4BFF` | The one accent action, when a screen has one. AT MOST one per screen (rule 10, corrected 2026-09-05) — the landing has none, its primary is ink. |
| `action-signal-fg` | `action-signal-fg` | `neutral-0` `#FFFFFF` | `neutral-0` `#FFFFFF` | White on cobalt, 5.91:1. |
| `action-signal-hover` | `action-signal-hover` | `cobalt-600` `#2440D9` | `cobalt-600` `#2440D9` | One step darker, 7.47:1 under white. |
| `action-ghost-hover` | `action-ghost-hover` | `neutral-100` `#E9E8E2` | `neutral-900` `#2A2C33` | Chrome hover. |

### Status

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `status-ready-surface` | `status-ready` | `green-100` `#E8F4EE` | `green-900` `#0D3F28` | Ready chip ground. |
| `status-ready-border` | `status-ready-line` | `green-200` `#CFE9DC` | `green-800` `#125A39` | Ready chip edge. |
| `status-ready-fg` | `status-ready-fg` | `green-700` `#17754A` | `green-300` `#9FD4B8` | Ready as text: 5.06:1 on its ground. |
| `status-attention-surface` | `status-attention` | `amber-100` `#FAEFE8` | `amber-900` `#4F2A10` | Attention chip ground. |
| `status-attention-border` | `status-attention-line` | `amber-200` `#F4D8C4` | `amber-800` `#7E3E14` | Attention chip edge. |
| `status-attention-fg` | `status-attention-fg` | `amber-700` `#A6511A` | `amber-300` `#EDB48F` | Attention as text: 4.87:1 on its ground. |
| `status-blocked-surface` | `status-blocked` | `danger-100` `#FCE9E6` | `danger-900` `#531E1B` | Blocked or refused. |
| `status-blocked-border` | `status-blocked-line` | `danger-200` `#FBD5D1` | `danger-800` `#792623` | Chip edge. |
| `status-blocked-fg` | `status-blocked-fg` | `danger-700` `#A02827` | `danger-300` `#F5BAB3` | 6.34:1 light, 8.00:1 dark. |
| `status-review-surface` | `status-review` | `cobalt-100` `#EAEDFF` | `cobalt-900` `#101D5E` | Submitted or in review — «на розгляді» is cobalt on this product. |
| `status-review-border` | `status-review-line` | `cobalt-200` `#D5DBFF` | `cobalt-800` `#172A8C` | Review chip edge. |
| `status-review-fg` | `status-review-fg` | `cobalt-700` `#1E36B8` | `cobalt-300` `#9AAAFF` | Review as text: 7.94:1 on its ground. |
| `status-idle-surface` | `status-idle` | `neutral-100` `#E9E8E2` | `neutral-900` `#2A2C33` | Nothing has happened yet. Deliberately colourless: an idle state that carries a hue reads as a state that means something. |
| `status-idle-border` | `status-idle-line` | `neutral-200` `#D9D9D6` | `neutral-800` `#3A3D45` | Chip edge. |
| `status-idle-fg` | `status-idle-fg` | `neutral-700` `#4E5158` | `neutral-300` `#CFCFCC` | 5.86:1 light, 8.64:1 dark. |

### Evidence

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `evidence-satisfied` | `evidence-satisfied` | `green-700` `#17754A` | `green-300` `#9FD4B8` | A satisfied requirement, as text on the canvas: 5.23:1. |
| `evidence-pending` | `evidence-pending` | `amber-800` `#7E3E14` | `amber-300` `#EDB48F` | Evidence expected, not yet obtained. 7.09:1 on canvas. |
| `evidence-blocking` | `evidence-blocking` | `danger-700` `#A02827` | `danger-300` `#F5BAB3` | Evidence missing and blocking a closure. 7.17:1 on canvas. |

### Data visualisation

| Role | Utility | Light | Dark | Ruling |
|---|---|---|---|---|
| `viz-1` | `viz-1` | `cobalt-600` `#2440D9` | `cobalt-300` `#9AAAFF` | First categorical series. |
| `viz-2` | `viz-2` | `green-600` `#1B8050` | `green-300` `#9FD4B8` | Second categorical series. |
| `viz-3` | `viz-3` | `amber-600` `#C8641F` | `amber-300` `#EDB48F` | Third categorical series. |
| `viz-4` | `viz-4` | `danger-600` `#CE2F30` | `danger-300` `#F5BAB3` | Categorical series 4. |
| `viz-5` | `viz-5` | `violet-500` `#916CCD` | `violet-300` `#D0C3EB` | Categorical series 5. Violet exists for this role and no other — it is never a status. |

---

## 3. Elevation

Four, and a panel gets none of them. Structure is a 1px border plus a
lightness shift between the surface roles; there is no elevation ladder.

| Token | Value | Ruling |
|---|---|---|
| `raised` | `0px 1px 2px 0px rgba(21, 22, 26, 0.04)` | The role grid cell at rest. Structure is border-led; a panel gets no shadow at all. |
| `overlay` | `0px 12px 30px -16px rgba(21, 22, 26, 0.35)` | The floating pills over the product frame, compact callouts, a popover. |
| `modal` | `0px 8px 24px 0px rgba(21, 22, 26, 0.08), 0px 24px 64px 0px rgba(21, 22, 26, 0.12)` | The only things that cover content: dialog and the off-canvas rail. Under D2 the rail is no longer dark, so this shadow now carries the whole 'this covers content' signal that colour used to carry with it. |
| `float` | `0px 20px 50px -30px rgba(21, 22, 26, 0.22), 0px 1px 2px 0px rgba(21, 22, 26, 0.05)` | The prototype's --sh: the board, the receipt, the form, the route cards and the «now» card. Marketing only. |
| `float-accent` | `0px 30px 70px -40px rgba(43, 75, 255, 0.35), 0px 1px 2px 0px rgba(21, 22, 26, 0.05)` | The «З GoProceed» compare card only (prototype .cmp-card.now, index.html l.607): the one coloured shadow in the system, and it is the mark colour under the one card that is the product promise. Marketing only. |

---

## 4. Scales

### `font`

| Token | Value | Ruling |
|---|---|---|
| `display` | `'Onest Variable', Onest, system-ui, sans-serif` | Daylight, 2026-09-05: the prototype sets every heading in Onest, so the display face is the sans. The `.display` class keeps its job (opt-in marketing headings, never inside /app/**) and no longer names a serif. |
| `sans` | `'Onest Variable', Onest, system-ui, sans-serif` | Onest carries all UI, body and figures. Verified on @fontsource-variable/onest 5.3.1: wght 100–900, `tnum` in the latin subset (every digit), Іі Її Єє Ґґ in the cyrillic subset — the two facts the Inter ruling rested on. |
| `mono` | `'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace` | D4. Index labels, evidence IDs, figure captions and ledger keys. Linear's marketing site uses a mono for exactly this (FIG 0.2, 1.0 Intake) and it is the motif that makes an indexed document read as an instrument. Subset to digits, Latin caps and punctuation — the full face is not loaded. |
| `features` | `"calt"` | Onest has no cv01/ss03; contextual alternates only. Tabular figures come from the `tabular` utility, as before. |

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
| `medium` | `500` | Onest's medium. The 510 ruling was measured on Inter and does not travel. |
| `semibold` | `600` | Onest's semibold — the prototype's heading weight. |
| `bold` | `700` | Onest's bold; the quote marks in the position block. |

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
| `card` | `12px` | Marketing only: the prototype's --r 12px — the figure, the form, the needs cells. |
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
| `marquee` | `35s` | One full pass of the logo/proof ribbon. Folio's measured value on the same device (35s and 40.25s on two tracks). Long enough that it reads as ambient rather than as something demanding to be watched, and the only perpetual animation the system permits — it pauses on hover and freezes entirely under prefers-reduced-motion. |
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
| primary copy on the canvas | 16.57:1 | 16.57:1 |
| secondary copy on the canvas | 7.29:1 | 12.78:1 |
| muted copy on the canvas | 5.60:1 | 11.58:1 |
| muted copy on a subtle fill | 5.26:1 | 8.93:1 |
| muted copy on a muted fill | 4.98:1 | 6.96:1 |
| metadata on the canvas | 3.73:1 | 7.95:1 |
| copy on the inverse surface | 13.82:1 | 13.94:1 |
| metadata on the inverse surface | 7.95:1 | 7.95:1 |
| copy on the mark | 5.91:1 | 5.91:1 |
| a link on a surface | 7.47:1 | 7.49:1 |
| 'ready' as text on a surface | 9.23:1 | 7.49:1 |
| the primary action's label | 18.08:1 | 18.08:1 |
| the signal action's label | 5.91:1 | 5.91:1 |
| ready chip | 5.06:1 | 7.15:1 |
| attention chip | 4.87:1 | 6.90:1 |
| blocked chip | 6.34:1 | 8.00:1 |
| review chip | 7.94:1 | 7.04:1 |
| idle chip | 6.47:1 | 8.93:1 |
| the focus ring against a surface | 5.91:1 | 7.49:1 |
