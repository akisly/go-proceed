# Landing Daylight — Plan 1 of 3: foundation (contest, tokens, fonts, brand)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the design system to the Daylight palette, typeface and mark so that every app inherits them through the roles it already names, before a single landing block is written.

**Architecture:** `packages/tokens/src/tokens.json` is the only hand-edited source; seven generators emit CSS, Tailwind theme, native TS, DTCG, palette allowlist, docs and the tailwind-merge config. Ramps change as OKLCH triples; roles keep their names so no consumer is renamed. The brand mark is eight SVGs in `design-references/brand/` and one script rasterises every icon file from them.

**Tech Stack:** Node 24, pnpm 9.12, vitest 3.2.4, `sharp` 0.34 (already an allowed build dependency), `@fontsource-variable/onest` 5.3.1.

**Spec:** [`docs/superpowers/specs/2026-09-05-landing-daylight-design.md`](../specs/2026-09-05-landing-daylight-design.md) — §2 (decisions), §4 (design system), §5 (brand).

**Companion plans:** [`2026-09-05-landing-daylight-2-components.md`](2026-09-05-landing-daylight-2-components.md) (vocabulary and shared components), [`2026-09-05-landing-daylight-3-landing.md`](2026-09-05-landing-daylight-3-landing.md) (page, form, QA, documents). Execute in order; each plan's gate must be green before the next starts.

## Global Constraints

- Work on branch `claude/practical-chatterjee-c8d64a`; commit per task; never touch `supabase/**`, auth code, or `apps/app/app/(auth)/**`.
- Colours in `tokens.json` are OKLCH triples rounded to **six decimals** for chroma and four for lightness; the hex is output. Never type a hex into `hex` without running the generators; `palette-derivation.test.ts` recomputes every one.
- Every token carries a `ruling` of at least ten characters (`token-fidelity`).
- Never edit a file whose header says GENERATED. Regenerate with `pnpm --filter @goproceed/tokens generate`.
- Component classes name roles (`bg-canvas`), never ramp steps or hex; `primitive-leak.test.ts` and `component-contract.test.ts` enforce it.
- No `motion/react` import outside `packages/ui/src/motion` (`motion-audit`).
- Repo docs in English; public copy Ukrainian; talk to the owner in Russian.
- Third-party libraries: read the installed version and the current docs before use, cite version + URL in the commit (repo `CLAUDE.md`).
- The gate of `docs/design/02-building-ui.md` §5 runs at the end of every plan; the output is pasted, never paraphrased.

Run every command from the repo root: `/Users/akisliy/Downloads/GoProceed/.claude/worktrees/practical-chatterjee-c8d64a`.

---

### Task 1: Track the contest sources (decision D5)

**Files:**
- Create: `design-references/contest-2026-09/daylight/README.md` (copy of `design-contest/README.md`)
- Create: `design-references/contest-2026-09/daylight/index.html`, `api/pilot.js`, `vercel.json`, `.env.example` (copies)
- Create: `design-references/contest-2026-09/daylight/assets/photo-{blueprint,tray-card,tray-thumb,tray-wide}.jpg` (copies)
- Modify: `docs/superpowers/specs/2026-09-05-landing-daylight-design.md` §1 first paragraph (path)

**Interfaces:**
- Produces: the four JPEGs at a tracked path; Plan 3 Task 15 copies them into `apps/landing/public/images/`.

- [ ] **Step 1: Copy the files (the source lives in the main checkout, untracked)**

```bash
SRC=/Users/akisliy/Downloads/GoProceed/design-contest
DST=design-references/contest-2026-09/daylight
mkdir -p "$DST/api" "$DST/assets"
cp "$SRC/README.md" "$DST/README.md"
cp "$SRC/daylight/index.html" "$SRC/daylight/vercel.json" "$SRC/daylight/.env.example" "$DST/"
cp "$SRC/daylight/api/pilot.js" "$DST/api/"
cp "$SRC/daylight/assets/"*.jpg "$DST/assets/"
ls -la "$DST" "$DST/api" "$DST/assets"
```

Expected: nine files; no `index.backup*.html`, no `preview-*.png`.

- [ ] **Step 2: The validator must still pass (design-references is a role-record dir, so AktFlow-era wording is tolerated there, but links are checked)**

Run: `pnpm validate:canonical-docs`
Expected: `canonical documentation: OK`

- [ ] **Step 3: Point the spec at the tracked path**

In `docs/superpowers/specs/2026-09-05-landing-daylight-design.md`, §1 first paragraph, replace `design-contest/daylight/index.html` with `design-references/contest-2026-09/daylight/index.html` and `design-contest/daylight/api/pilot.js` with `design-references/contest-2026-09/daylight/api/pilot.js`.

- [ ] **Step 4: Commit**

```bash
git add design-references/contest-2026-09 docs/superpowers/specs/2026-09-05-landing-daylight-design.md
git commit -m "docs(design): track the daylight contest prototype as a design reference (D5)

The approved prototype, its handler, config and the four photo crops, at the
path the spec cites. Backups and preview PNGs stay out.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The palette — ramps and roles in `tokens.json`

**Files:**
- Modify: `packages/tokens/src/tokens.json` (`primitive.color`, `semantic.color`, `primitive.font`, `primitive.fontWeight`, `primitive.text`, `primitive.leading`, `primitive.tracking`, `primitive.radius`, `primitive.container`, `shadow`, `component`)
- Modify: `packages/testing/src/contrast.test.ts:30-60` (PAIRS/LINES rows)
- Modify: `packages/testing/src/palette-derivation.test.ts:70-110` (anchors, warmth test)
- Regenerate: `packages/ui/src/tokens.generated.css`, `packages/ui/src/theme.generated.css`, `packages/tokens/src/tokens.generated.ts`, `packages/tokens/src/tokens.dtcg.json`, `packages/testing/qa/palette.generated.mjs`, `docs/design/01-tokens.md`, `packages/ui/src/tw-merge.generated.ts`

**Interfaces:**
- Produces: primitives `neutral-0…975`, `cobalt-50…900`, `green-50…900`, `amber-50…900`, `danger-*` (unchanged), `violet-*` (unchanged); `signal-*` and `blue-*` are gone. New roles: `text-accent` (tw `accent`), `border-accent` (tw `line-accent`), `bg-accent-soft` (tw `accent-soft`). New scale entries: `container.marketing` = `1180px`, `component.control-height-marketing` = `42px`. Every other role name is unchanged.

- [ ] **Step 1: Write the failing contrast rows**

In `packages/testing/src/contrast.test.ts`, add to `PAIRS` (after the `border-focus` rows):

```ts
  ["the accent phrase in a display heading, on the canvas (large text)", "text-accent", "bg-canvas", 3.0],
  ["the accent phrase in a display heading, on a surface (large text)", "text-accent", "bg-surface", 3.0],
```

and to `LINES`:

```ts
  ["the accent edge of a selected card on a surface", "border-accent", "bg-surface", 3.0],
```

- [ ] **Step 2: Run the contrast suite to see it fail on the unknown roles**

Run: `pnpm --filter @goproceed/testing exec vitest run src/contrast.test.ts`
Expected: FAIL — `unknown semantic role "text-accent"` (and `border-accent`).

- [ ] **Step 3: Rewrite the ramps and roles with a one-off script**

Save as `retoken.tmp.mjs` at the repo root (the import below is relative to the file), run `node retoken.tmp.mjs`, then delete the file before committing. It rewrites the colour ramps, the roles that move, the type/radius/shadow scale entries, and adds the two new scale tokens. Every triple below was derived with `packages/tokens/scripts/lib/color.mjs` (`hexToOklch` → `clampChroma` → `oklchToHex` round-trips to the target hex).

```js
import { readFileSync, writeFileSync } from "node:fs";
import { oklchToHex } from "./packages/tokens/scripts/lib/color.mjs";

const path = "packages/tokens/src/tokens.json";
const src = JSON.parse(readFileSync(path, "utf8"));

const ramp = (rows) => Object.fromEntries(rows.map(([name, L, C, H, ruling]) =>
  [name, { oklch: [L, C, H], hex: oklchToHex(L, C, H), alpha: 1, ruling }]));

const neutral = ramp([
  ["neutral-0", 1, 0, 89.88, "Pure white. The working surface a register sits on; a panel reads as a sheet laid on the paper rather than as more paper."],
  ["neutral-25", 0.9698, 0.005408, 95.1, "The canvas. The prototype's paper #F6F5F1 — warm at hue 95, measurably paper. The ramp's light end is warm and its dark end is cool (hue ≈ 270), on purpose: paper is warm, ink is cool, and each step is its own triple."],
  ["neutral-50", 0.9482, 0.008055, 98.88, "Paper-2 #EFEEE8: the «was» card, sunken wells, the ground under an inset control."],
  ["neutral-100", 0.9301, 0.008093, 98.88, "Inactive segment, ghost-button hover on the canvas, idle status ground."],
  ["neutral-150", 0.9097, 0.004188, 91.45, "Hairline inside a surface, and copy on ink (13.82:1 against neutral-975)."],
  ["neutral-200", 0.8845, 0.004061, 106.48, "The default border: ink at 9% over paper, composited. 1.30:1 against the canvas — visible as structure, invisible as a line you read."],
  ["neutral-300", 0.8537, 0.004097, 106.49, "The strong border: ink at 16% over paper, composited. Table rules, selected outlines, the edge of a card on white (1.56:1)."],
  ["neutral-400", 0.7442, 0.010568, 267.33, "The prototype's ink-4 #A9ACB3. Non-text only on light: disabled fills, metadata on ink (7.95:1). Never body copy on the canvas."],
  ["neutral-500", 0.5927, 0.014479, 266.63, "The prototype's ink-3 #7A7E87. Metadata floor: 3.73:1 on the canvas, so it clears the non-text and large-text threshold and nothing else. Never body text."],
  ["neutral-600", 0.4958, 0.01516, 266.59, "The body-text floor, measured against the DARKEST ground it lands on: 5.60:1 on canvas, 6.11:1 on white, 5.26:1 on a subtle fill, 4.98:1 on a muted fill. One step darker than the prototype's ink-3, which measures 3.73:1 on paper and cannot carry a caption."],
  ["neutral-700", 0.4347, 0.012129, 267.24, "The prototype's ink-2 #4E5158. Secondary copy, 7.29:1 on canvas; also the idle status foreground."],
  ["neutral-800", 0.3603, 0.014381, 269.29, "Hairline on ink; the only border that reads on the inverse surface (1.66:1)."],
  ["neutral-900", 0.294, 0.013009, 272.93, "The prototype's button hover #2A2C33. One step off ink, so the press is felt without the button changing identity."],
  ["neutral-950", 0.2404, 0.009628, 276.67, "The inverse working surface — dark mode's panel, authored now and not shipped (D6)."],
  ["neutral-975", 0.2009, 0.008119, 274.5, "Ink #15161A, the prototype's --ink. Primary text and the primary action fill. 16.57:1 on canvas. Cool where the paper is warm; that contrast is the identity."],
]);

const cobalt = ramp([
  ["cobalt-50", 0.9742, 0.012172, 276.1, "Faintest cobalt wash — a whole row tinted without becoming a chip."],
  ["cobalt-100", 0.9491, 0.024404, 278.37, "Cobalt at 10% over white, composited: the review chip ground, the selected card's ring, the paired-row wash."],
  ["cobalt-200", 0.8982, 0.049772, 277.88, "Review chip border; the selected card's soft edge."],
  ["cobalt-300", 0.7593, 0.123516, 274.95, "The prototype's #9AAAFF — the accent on ink (8.24:1), and every cobalt foreground in dark mode."],
  ["cobalt-400", 0.5662, 0.17981, 272.46, "THE ACCENT #5568DE: the highlighted phrase in a display heading. 4.35:1 on the canvas — large text only, never body copy."],
  ["cobalt-500", 0.5251, 0.264234, 267.09, "THE MARK #2B4BFF: the brand dot, the signal action, the focus ring, the review state. 5.42:1 on the canvas, 5.91:1 as a ground for white."],
  ["cobalt-600", 0.4677, 0.232104, 267.14, "Signal hover and link colour. 7.47:1 on white."],
  ["cobalt-700", 0.4157, 0.203704, 267.26, "Review as TEXT: 7.94:1 on cobalt-100, 9.23:1 on white. Also the brand as text."],
  ["cobalt-800", 0.3465, 0.162363, 267.55, "Review chip border in dark mode."],
  ["cobalt-900", 0.2702, 0.116305, 268.31, "Review ground in dark mode; the accent-soft ground in dark mode."],
]);

const green = ramp([
  ["green-50", 0.9747, 0.0107, 158.85, "Faintest ready wash."],
  ["green-100", 0.9565, 0.014961, 164.73, "Ready chip ground: ok at 10% over white, composited."],
  ["green-200", 0.9113, 0.032544, 164.17, "Ready chip border."],
  ["green-300", 0.8252, 0.067616, 161.41, "Ready foreground in dark mode (7.15:1 on green-900)."],
  ["green-500", 0.5763, 0.127169, 157.1, "The prototype's ok #1E8F5A. Icons, dots and check marks. 4.1:1 on white — NOT text."],
  ["green-600", 0.532, 0.117054, 156.95, "Viz weight on white."],
  ["green-700", 0.4989, 0.108739, 157.73, "Ready as TEXT: 5.06:1 on green-100, 5.23:1 on canvas, 5.71:1 on white."],
  ["green-800", 0.4157, 0.08836, 158.16, "Ready chip border in dark mode."],
  ["green-900", 0.3281, 0.066562, 158.87, "Ready ground in dark mode."],
]);

const amber = ramp([
  ["amber-50", 0.9739, 0.010978, 63.36, "Faintest attention wash."],
  ["amber-100", 0.9588, 0.015167, 54.93, "Attention chip ground: warn at 10% over white, composited."],
  ["amber-200", 0.9002, 0.041211, 57.72, "Attention chip border."],
  ["amber-300", 0.8134, 0.083056, 54.22, "Attention foreground in dark mode (6.90:1 on amber-900)."],
  ["amber-500", 0.6823, 0.15117, 51.96, "Icon and bar weight; never text."],
  ["amber-600", 0.6123, 0.148425, 49.89, "The prototype's warn #C8641F: the draft stamp, the rule box's border. 3.9:1 on white — icons and strokes, NOT text."],
  ["amber-700", 0.5319, 0.129258, 48.79, "Attention as TEXT: 4.87:1 on amber-100."],
  ["amber-800", 0.4389, 0.103138, 49.64, "The evidence-pending foreground (7.44:1 on canvas)."],
  ["amber-900", 0.328, 0.066775, 53, "Attention ground in dark mode."],
]);

const keep = (prefix) => Object.fromEntries(
  Object.entries(src.primitive.color).filter(([n]) => n.startsWith(prefix)));
src.primitive.color = { ...neutral, ...cobalt, ...green, ...amber, ...keep("danger-"), ...keep("violet-") };

const role = (name, light, dark, tw, ruling) => { src.semantic.color[name] = { light, dark, tw, ruling }; };
role("bg-signal", "cobalt-500", "cobalt-500", "signal", "The mark as a ground. Cobalt replaced lime on 2026-09-05 with the Daylight direction; 5.91:1 under white.");
role("text-on-signal", "neutral-0", "neutral-0", "on-signal", "White on the mark, 5.91:1 both themes.");
role("text-link", "cobalt-600", "cobalt-300", "link", "Links. 7.47:1 on a surface.");
role("text-brand", "cobalt-700", "cobalt-300", "brand", "The brand as text, and «ready» named in cobalt where a chip would be too loud. 9.23:1 on a surface.");
role("text-accent", "cobalt-400", "cobalt-300", "accent", "The highlighted phrase in a display heading — the one accent the prototype uses (F8). LARGE TEXT ONLY: 4.35:1 on the canvas clears 3:1 and not 4.5:1, so it never carries body copy.");
role("border-focus", "cobalt-500", "cobalt-300", "focus", "One focus treatment for every focusable element. 5.91:1 on a surface.");
role("border-accent", "cobalt-500", "cobalt-300", "line-accent", "The selected card's edge and the «now» card's tint. 5.91:1 on a surface.");
role("bg-accent-soft", "cobalt-100", "cobalt-900", "accent-soft", "The selected card's ring, the paired-row wash, the review tag ground. Cobalt at 10%, composited.");
role("action-signal-bg", "cobalt-500", "cobalt-500", "action-signal", "The one accent action, when a screen has one. AT MOST one per screen (rule 10, corrected 2026-09-05) — the landing has none, its primary is ink.");
role("action-signal-fg", "neutral-0", "neutral-0", "action-signal-fg", "White on cobalt, 5.91:1.");
role("action-signal-hover", "cobalt-600", "cobalt-600", "action-signal-hover", "One step darker, 7.47:1 under white.");
role("status-ready-surface", "green-100", "green-900", "status-ready", "Ready chip ground.");
role("status-ready-border", "green-200", "green-800", "status-ready-line", "Ready chip edge.");
role("status-ready-fg", "green-700", "green-300", "status-ready-fg", "Ready as text: 5.06:1 on its ground.");
role("status-attention-surface", "amber-100", "amber-900", "status-attention", "Attention chip ground.");
role("status-attention-border", "amber-200", "amber-800", "status-attention-line", "Attention chip edge.");
role("status-attention-fg", "amber-700", "amber-300", "status-attention-fg", "Attention as text: 4.87:1 on its ground.");
role("status-review-surface", "cobalt-100", "cobalt-900", "status-review", "Submitted or in review — «на розгляді» is cobalt on this product.");
role("status-review-border", "cobalt-200", "cobalt-800", "status-review-line", "Review chip edge.");
role("status-review-fg", "cobalt-700", "cobalt-300", "status-review-fg", "Review as text: 7.94:1 on its ground.");
role("evidence-satisfied", "green-700", "green-300", "evidence-satisfied", "A satisfied requirement, as text on the canvas: 5.23:1.");
role("viz-1", "cobalt-600", "cobalt-300", "viz-1", "First categorical series.");
role("viz-2", "green-600", "green-300", "viz-2", "Second categorical series.");
role("viz-3", "amber-600", "amber-300", "viz-3", "Third categorical series.");

// Ramps kept by name take the re-tuned values through the roles already written; nothing else in
// semantic.color changes. Now the scale entries the spec's §4.3–4.4 name.
const set = (block, name, value, ruling) => { src.primitive[block][name] = { value, ruling }; };
set("font", "display", "'Onest Variable', Onest, system-ui, sans-serif", "Daylight, 2026-09-05: the prototype sets every heading in Onest, so the display face is the sans. The `.display` class keeps its job (opt-in marketing headings, never inside /app/**) and no longer names a serif.");
set("font", "sans", "'Onest Variable', Onest, system-ui, sans-serif", "Onest carries all UI, body and figures. Verified on @fontsource-variable/onest 5.3.1: wght 100–900, `tnum` in the latin subset (every digit), Іі Її Єє Ґґ in the cyrillic subset — the two facts the Inter ruling rested on.");
set("font", "features", "\"calt\"", "Onest has no cv01/ss03; contextual alternates only. Tabular figures come from the `tabular` utility, as before.");
set("fontWeight", "medium", "500", "Onest's medium. The 510 ruling was measured on Inter and does not travel.");
set("fontWeight", "semibold", "600", "Onest's semibold — the prototype's heading weight.");
set("fontWeight", "bold", "700", "Onest's bold; the quote marks in the position block.");
set("text", "mkt-display-1", "clamp(38px, 5.2vw, 66px)", "The hero h1, measured from the prototype.");
set("text", "mkt-display-2", "clamp(28px, 3.3vw, 44px)", "Section h2, measured from the prototype.");
set("text", "mkt-display-3", "clamp(24px, 2.6vw, 34px)", "The h3 inside a route card, measured from the prototype.");
set("text", "mkt-lead", "clamp(16px, 1.25vw, 19px)", "The lead paragraph beside a section heading, measured from the prototype.");
set("leading", "display", "1.05", "mkt-display-1 and -2: the prototype's heading line-height.");
set("tracking", "tightest", "-0.035em", "mkt-display-1: the prototype's h1 tracking.");
set("tracking", "tighter", "-0.03em", "mkt-display-2: the prototype's h2 tracking.");
set("tracking", "tight", "-0.025em", "mkt-display-3 and product h1/h2: the prototype's h3 tracking.");
set("radius", "card", "12px", "Marketing only: the prototype's --r 12px — the figure, the form, the needs cells.");
set("radius", "surface", "14px", "Marketing only: route cards, the role grid, bento cells, compare cards, channel cards, the board.");
set("radius", "section", "16px", "Marketing only: the closing CTA card.");
set("container", "marketing", "1180px", "The landing column, the prototype's .wrap. `content` (1240) stays the app's cap so a product screenshot still lines up with the shell it came from.");
src.component["control-height-marketing"] = { value: "42px", ruling: "The prototype's buttons and inputs on the landing. Button size=\"lg\" reads it; the touch floor still wins under pointer:coarse." };
src.component["header-height-marketing"] = { value: "58px", ruling: "The prototype's header bar." };

const ink = "#15161A";
src.shadow.raised = { layers: [{ offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: { hex: ink, alpha: 0.04 } }],
  ruling: "The role grid cell at rest. Structure is border-led; a panel gets no shadow at all." };
src.shadow.overlay = { layers: [{ offsetX: 0, offsetY: 12, blurRadius: 30, spreadDistance: -16, color: { hex: ink, alpha: 0.35 } }],
  ruling: "The floating pills over the product frame, compact callouts, a popover." };
src.shadow.float = { layers: [
  { offsetX: 0, offsetY: 20, blurRadius: 50, spreadDistance: -30, color: { hex: ink, alpha: 0.22 } },
  { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: { hex: ink, alpha: 0.05 } }],
  ruling: "The prototype's --sh: the board, the receipt, the form, the route cards and the «now» card. Marketing only." };

writeFileSync(path, JSON.stringify(src, null, 2) + "\n");
console.log("ramps:", Object.keys(src.primitive.color).length, "roles:", Object.keys(src.semantic.color).length);
```

Expected: one `ramps: N roles: M` line; then confirm the two ramps are gone and no role still names them:

```bash
grep -c '"signal-\|"blue-' packages/tokens/src/tokens.json   # → 0
```

If the count is not 0, a role still references a deleted step; the generator in Step 4 throws `semantic token references unknown primitive` naming it — add a `role(...)` line for it to the script and re-run.

- [ ] **Step 4: Check the `modal` shadow's colour and the dark hover, then regenerate**

The `modal` shadow still carries `#11100F`; leave its layers but update the hex to `#15161A` by hand in `tokens.json` (four occurrences at most — `grep -n '11100F' packages/tokens/src/tokens.json`). Then:

Run: `pnpm --filter @goproceed/tokens generate`
Expected: seven `wrote …` lines, no error.

- [ ] **Step 5: Update the palette-derivation anchors and the warmth test**

Replace the `ANCHORS` array and the `"signal-500 is the gamut maximum"` test in `packages/testing/src/palette-derivation.test.ts` with:

```ts
  const ANCHORS: Array<[token: string, legacy: string, was: string]> = [
    ["cobalt-500", "#2B4BFF", "Cobalt — the mark, the signal action, the review state (Daylight, 2026-09-05)"],
    ["cobalt-400", "#5568DE", "Accent — the highlighted phrase in a display heading"],
    ["green-500", "#1E8F5A", "Ok — icons and check marks"],
    ["amber-600", "#C8641F", "Warn — the draft stamp and the rule box"],
    ["danger-500", "#E45C55", "Red — blocked / destructive (unchanged from v1)"],
    ["neutral-25", "#F6F5F1", "Paper — the canvas"],
    ["neutral-975", "#15161A", "Ink — text and the primary action"],
  ];
```

and replace the body of `describe("the ink is warm, and measurably so", …)` with:

```ts
describe("paper is warm and ink is cool, and measurably so", () => {
  it("keeps the paper warm and the ink cool", () => {
    // Daylight, 2026-09-05: the prototype pairs a warm paper (#F6F5F1, hue ≈ 95)
    // with a cool ink (#15161A, hue ≈ 274). Both carry a small chroma on
    // purpose — neither is a hue-less grey — and asserting the hues keeps a
    // later tidy-up from flattening either back to grey without saying so.
    const paper = colors["neutral-25"]!.oklch;
    const ink = colors["neutral-975"]!.oklch;
    expect(paper[2]).toBeGreaterThan(60);
    expect(paper[2]).toBeLessThan(120);
    expect(ink[2]).toBeGreaterThan(240);
    expect(ink[2]).toBeLessThan(300);
    for (const [, c] of [paper, ink].map((t) => [t[0], t[1]] as const)) {
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThan(0.02);
    }
  });
});
```

If that `describe` had further `it` blocks asserting `neutral-975`'s hue equals `neutral-25`'s, delete them — they assert the Evidence Atlas ruling this task retires.

- [ ] **Step 6: Run the token suites**

Run: `pnpm --filter @goproceed/testing exec vitest run src/token-fidelity.test.ts src/palette-derivation.test.ts src/contrast.test.ts src/primitive-leak.test.ts src/tw-merge.test.ts src/motion-contract.test.ts`
Expected: all PASS. If `contrast` names a pair under its floor, the ramp value is wrong — fix the triple in the script and re-run steps 3–4; never loosen the floor.

- [ ] **Step 7: The apps must still typecheck against the renamed exports**

Run: `pnpm turbo run typecheck`
Expected: PASS. (`@goproceed/tokens` exports `PrimitiveName` as a union; nothing under `apps/**` names `signal-*` or `blue-*` — verified by `grep -rn '"signal-\|"blue-[0-9]' apps packages/ui/src --include='*.ts' --include='*.tsx' | grep -v node_modules` → empty.)

- [ ] **Step 8: Commit**

```bash
git add packages/tokens packages/ui/src/*.generated.* packages/testing docs/design/01-tokens.md
git commit -m "feat(tokens): the Daylight palette — cobalt mark, warm paper, cool ink, Onest

Lime and the blue ramp are gone; cobalt is the mark, green is ready, amber is
re-hued to the prototype's warn. Roles keep their names so nothing under
apps/** is renamed. Three roles arrive (text-accent, border-accent,
bg-accent-soft), the marketing column and control height become tokens, the
type scale takes the prototype's measurements. Every pairing re-proved by
contrast.test.ts; every hex regenerated from its triple.

Spec: docs/superpowers/specs/2026-09-05-landing-daylight-design.md §4.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Onest on the wire — landing and dashboard

**Files:**
- Modify: `apps/landing/package.json` (dependencies)
- Modify: `apps/landing/app/layout.tsx:6-14` (font imports and their comment)
- Modify: `apps/app/package.json` (dependencies)
- Modify: `apps/app/app/dash/layout.tsx:10` (add the font import)
- Modify: `apps/app/app/globals.css:26-31` (dated correction to the DECISION note)
- Test: `apps/landing/tests/design-contract.test.tsx`

**Interfaces:**
- Produces: `@fontsource-variable/onest` 5.3.1 loaded by the landing root layout and by the dashboard layout; Inter stays on the field-client pages of `apps/app` (they run on the legacy stylesheet, see the correction below).

- [ ] **Step 1: Write the failing test (the font contract is a source assertion, like `landing-craft` was)**

Append to `apps/landing/tests/design-contract.test.tsx`:

```tsx
import { readFileSync } from "node:fs";

describe("the landing loads Onest and nothing else for text", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  it("imports Onest and JetBrains Mono", () => {
    expect(layout).toContain('import "@fontsource-variable/onest"');
    expect(layout).toContain('import "@fontsource-variable/jetbrains-mono"');
  });
  it("no longer imports Inter or Source Serif", () => {
    expect(layout).not.toContain("@fontsource-variable/inter");
    expect(layout).not.toContain("@fontsource-variable/source-serif-4");
  });
});
```

(`import { readFileSync }` goes at the top of the file with the other imports.)

- [ ] **Step 2: Run it**

Run: `pnpm --filter @goproceed/landing exec vitest run tests/design-contract.test.tsx`
Expected: FAIL on both new cases.

- [ ] **Step 3: Install the font and swap the imports**

```bash
pnpm --filter @goproceed/landing add @fontsource-variable/onest@5.3.1
pnpm --filter @goproceed/landing remove @fontsource-variable/inter @fontsource-variable/source-serif-4
pnpm --filter @goproceed/app add @fontsource-variable/onest@5.3.1
```

In `apps/landing/app/layout.tsx` replace the three font imports and their comment with:

```tsx
// Two families, loaded as variable fonts and subset by @fontsource:
//   Onest          — every heading, all body copy, all UI, every figure
//   JetBrains Mono — index labels, evidence IDs, figure captions
// Daylight (2026-09-05): the serif display face and Inter are gone; the
// prototype sets everything in Onest. Verified on @fontsource-variable/onest
// 5.3.1: wght 100–900, `tnum`, Іі Її Єє Ґґ.
import "@fontsource-variable/onest";
import "@fontsource-variable/jetbrains-mono";
```

In `apps/app/app/dash/layout.tsx`, directly above `import "./dash-theme.css";`, add:

```tsx
// The dashboard runs on @goproceed/ui/base.css, whose --gp-font-sans is Onest
// since the Daylight tokens (2026-09-05); the face is loaded here, at the
// dashboard's own layout, so the field-client pages — still on the legacy
// stylesheet and Inter — do not pay for a second family.
import "@fontsource-variable/onest";
```

In `apps/app/app/globals.css`, after the paragraph that begins `DECISION, 2026-08-11, still standing`, add inside the same comment block:

```
 * [Correction, 2026-09-05: still standing for THIS stylesheet, which the
 * field-client pages use. The dashboard under /dash/** runs on
 * @goproceed/ui/base.css and loads Onest from its own layout; this sheet is
 * not on the token system and keeps Inter until the Phase 4 restyle.]
```

- [ ] **Step 4: Run the test, then the landing build**

Run: `pnpm --filter @goproceed/landing exec vitest run tests/design-contract.test.tsx && pnpm --filter @goproceed/landing build`
Expected: PASS; build succeeds (the `.display` class resolves to Onest through `--gp-font-display`).

- [ ] **Step 5: Commit**

```bash
git add apps/landing/package.json apps/landing/app/layout.tsx apps/landing/tests/design-contract.test.tsx apps/app/package.json apps/app/app/dash/layout.tsx apps/app/app/globals.css pnpm-lock.yaml
git commit -m "feat(fonts): Onest replaces Inter and Source Serif on the landing and the dashboard

@fontsource-variable/onest 5.3.1 (https://fontsource.org/fonts/onest, read
2026-09-05): wght 100–900, tnum, Ukrainian glyphs. The field-client pages of
apps/app stay on their legacy stylesheet and Inter; the correction says so.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The mark — eight SVGs and one icon script

**Files:**
- Replace: `design-references/brand/goproceed-{mark,landing-icon,app-icon,maskable-icon,adaptive-foreground,adaptive-monochrome,mask,solid-background}.svg`
- Create: `scripts/generate-brand-icons.mjs`
- Regenerate: `apps/landing/app/{icon.png,apple-icon.png,favicon.ico}`, `apps/app/public/{icon.svg,safari-pinned-tab.svg,favicon-16.png,favicon-32.png,favicon.ico,icon-192.png,icon-512.png,maskable-icon-512.png,apple-touch-icon.png}`, `apps/mobile/assets/{icon.png,android-icon-foreground.png,android-icon-monochrome.png,android-icon-background.png,favicon.png,splash-icon.png}`
- Modify: `apps/app/public/manifest.webmanifest` (`background_color`, `theme_color` → `#15161A`), `apps/mobile/app.json` (any `#191A1A` → `#15161A`)
- Modify: `apps/landing/components/brand-mark.tsx` (inline SVG)
- Test: `apps/landing/tests/brand-mark.test.tsx` (new), `apps/landing/tests/metadata.test.ts` (unchanged, must stay green)

**Interfaces:**
- Produces: `BrandMark({ className?: string })` rendering an inline `<svg data-brand-mark="true" viewBox="0 0 24 24">` sized by `className` (default `size-7`, 28px); no `priority` prop (there is no image request).

- [ ] **Step 1: Write the failing BrandMark test**

Create `apps/landing/tests/brand-mark.test.tsx`:

```tsx
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandMark } from "../components/brand-mark";

describe("the brand mark", () => {
  const html = renderToStaticMarkup(<BrandMark />);

  it("is an inline vector, not an image request", () => {
    expect(html).toContain("<svg");
    expect(html).toContain('data-brand-mark="true"');
    expect(html).not.toContain("<img");
  });

  it("draws the tile, the chevron and the cobalt dot in roles, never hex", () => {
    expect(html).toContain("<rect");
    expect(html).toContain("<path");
    expect(html).toContain("fill-signal");
    expect(html).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });

  it("is 28px by default and hidden from assistive tech", () => {
    expect(html).toContain("size-7");
    expect(html).toContain('aria-hidden="true"');
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @goproceed/landing exec vitest run tests/brand-mark.test.tsx`
Expected: FAIL (`<img` rendered, no `<svg`).

- [ ] **Step 3: Write the eight SVGs**

The prototype mark on a 24-unit grid, scaled ×42.6667 onto the 1024 grid the brand files use. `design-references/brand/goproceed-mark.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect x="106.67" y="106.67" width="810.67" height="810.67" rx="213.33" fill="none" stroke="#15161A" stroke-width="76.8"/>
  <path d="M277.33 661.33 512 341.33l136.53 187.73" fill="none" stroke="#15161A" stroke-width="76.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="716.8" cy="665.6" r="81.07" fill="#2B4BFF"/>
</svg>
```

`goproceed-landing-icon.svg` (the favicon: white tile, F10):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="256" fill="#FFFFFF"/>
  <g transform="translate(512 512) scale(.8) translate(-512 -512)">
    <rect x="106.67" y="106.67" width="810.67" height="810.67" rx="213.33" fill="none" stroke="#15161A" stroke-width="76.8"/>
    <path d="M277.33 661.33 512 341.33l136.53 187.73" fill="none" stroke="#15161A" stroke-width="76.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="716.8" cy="665.6" r="81.07" fill="#2B4BFF"/>
  </g>
</svg>
```

`goproceed-app-icon.svg` (ink tile, paper strokes):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#15161A"/>
  <g transform="translate(512 512) scale(.8) translate(-512 -512)">
    <rect x="106.67" y="106.67" width="810.67" height="810.67" rx="213.33" fill="none" stroke="#F6F5F1" stroke-width="76.8"/>
    <path d="M277.33 661.33 512 341.33l136.53 187.73" fill="none" stroke="#F6F5F1" stroke-width="76.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="716.8" cy="665.6" r="81.07" fill="#2B4BFF"/>
  </g>
</svg>
```

`goproceed-maskable-icon.svg`: identical to the app icon with `scale(.78)` instead of `scale(.8)`.

`goproceed-adaptive-foreground.svg` (transparent, 78 % safe area):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(.78) translate(-512 -512)">
    <rect x="106.67" y="106.67" width="810.67" height="810.67" rx="213.33" fill="none" stroke="#F6F5F1" stroke-width="76.8"/>
    <path d="M277.33 661.33 512 341.33l136.53 187.73" fill="none" stroke="#F6F5F1" stroke-width="76.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="716.8" cy="665.6" r="81.07" fill="#2B4BFF"/>
  </g>
</svg>
```

`goproceed-adaptive-monochrome.svg` (white, the dot as a hole):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <mask id="dot" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <rect width="1024" height="1024" fill="#fff"/>
      <circle cx="716.8" cy="665.6" r="110" fill="#000"/>
    </mask>
  </defs>
  <g transform="translate(512 512) scale(.78) translate(-512 -512)">
    <g mask="url(#dot)">
      <rect x="106.67" y="106.67" width="810.67" height="810.67" rx="213.33" fill="none" stroke="#FFFFFF" stroke-width="76.8"/>
      <path d="M277.33 661.33 512 341.33l136.53 187.73" fill="none" stroke="#FFFFFF" stroke-width="76.8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <circle cx="716.8" cy="665.6" r="81.07" fill="#FFFFFF"/>
  </g>
</svg>
```

`goproceed-mask.svg`: the monochrome file with every `#FFFFFF` replaced by `#000000` and no outer `transform` (full-bleed, for Safari's pinned tab). `goproceed-solid-background.svg`: `<rect width="1024" height="1024" fill="#15161A"/>`.

- [ ] **Step 4: Write the icon script**

Create `scripts/generate-brand-icons.mjs`:

```js
#!/usr/bin/env node
// Rasterises every icon file in the repository from design-references/brand/*.svg.
// One source, one script: a mark that lives in nine PNGs by hand is nine marks.
// Run: node scripts/generate-brand-icons.mjs
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = (f) => join(root, "design-references/brand", f);
const svg = (f) => readFileSync(brand(f));

async function png(source, size, out) {
  await sharp(svg(source), { density: 384 }).resize(size, size).png().toFile(join(root, out));
  console.log(`wrote ${out} (${size}px from ${source})`);
}

/** A single-image ICO wrapping one PNG — the shape the existing favicon.ico files already have. */
async function ico(source, size, out) {
  const image = await sharp(svg(source), { density: 384 }).resize(size, size).png().toBuffer();
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header.writeUInt8(size === 256 ? 0 : size, 6); header.writeUInt8(size === 256 ? 0 : size, 7);
  header.writeUInt8(0, 8); header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(image.length, 14); header.writeUInt32LE(22, 18);
  writeFileSync(join(root, out), Buffer.concat([header, image]));
  console.log(`wrote ${out} (${size}px ICO from ${source})`);
}

// apps/landing — the favicon is the mark on a WHITE tile (spec F10).
await png("goproceed-landing-icon.svg", 512, "apps/landing/app/icon.png");
await png("goproceed-landing-icon.svg", 180, "apps/landing/app/apple-icon.png");
await ico("goproceed-landing-icon.svg", 64, "apps/landing/app/favicon.ico");

// apps/app — the ink tile.
copyFileSync(brand("goproceed-app-icon.svg"), join(root, "apps/app/public/icon.svg"));
copyFileSync(brand("goproceed-mask.svg"), join(root, "apps/app/public/safari-pinned-tab.svg"));
await png("goproceed-app-icon.svg", 16, "apps/app/public/favicon-16.png");
await png("goproceed-app-icon.svg", 32, "apps/app/public/favicon-32.png");
await ico("goproceed-app-icon.svg", 32, "apps/app/public/favicon.ico");
await png("goproceed-app-icon.svg", 192, "apps/app/public/icon-192.png");
await png("goproceed-app-icon.svg", 512, "apps/app/public/icon-512.png");
await png("goproceed-maskable-icon.svg", 512, "apps/app/public/maskable-icon-512.png");
await png("goproceed-app-icon.svg", 180, "apps/app/public/apple-touch-icon.png");

// apps/mobile — Expo's icon set, at the sizes the current files have.
await png("goproceed-app-icon.svg", 1024, "apps/mobile/assets/icon.png");
await png("goproceed-adaptive-foreground.svg", 1024, "apps/mobile/assets/android-icon-foreground.png");
await png("goproceed-adaptive-monochrome.svg", 1024, "apps/mobile/assets/android-icon-monochrome.png");
await png("goproceed-solid-background.svg", 1024, "apps/mobile/assets/android-icon-background.png");
await png("goproceed-adaptive-foreground.svg", 1024, "apps/mobile/assets/splash-icon.png");
await png("goproceed-landing-icon.svg", 48, "apps/mobile/assets/favicon.png");
```

Run: `node scripts/generate-brand-icons.mjs`
Expected: eighteen `wrote …` lines. Then `file apps/landing/app/*.png apps/landing/app/favicon.ico apps/app/public/*.png apps/mobile/assets/*.png` shows the same dimensions as before the change (512/180/64 · 16/32/192/512/512/180 · 1024×5, 48). If `sharp` refuses to import because the pnpm build script was blocked, run `pnpm rebuild sharp` once (it is in `onlyBuiltDependencies`).

- [ ] **Step 5: Update the two colour fields**

`apps/app/public/manifest.webmanifest`: `"background_color": "#15161A"`, `"theme_color": "#15161A"`. `apps/mobile/app.json`: `grep -n "191A1A" apps/mobile/app.json` and replace each with `#15161A`.

- [ ] **Step 6: Rewrite `BrandMark`**

`apps/landing/components/brand-mark.tsx`:

```tsx
import { cx } from "@goproceed/ui/components";

/**
 * The mark, inline. Three shapes — a rounded tile, a chevron, a cobalt dot —
 * are cheaper as vector than as an image request, and inline they take the
 * ink and the mark from the roles, so a theme change reaches the logo too.
 * Decorative by default: the wordmark beside it carries the name.
 */
export function BrandMark({ className }: { className?: string | undefined }) {
  return (
    <svg
      data-brand-mark="true"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cx("size-7 shrink-0 text-ink", className)}
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 15.5 12 8l3.2 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.8" cy="15.6" r="1.9" className="fill-signal" />
    </svg>
  );
}
```

Every existing caller passes `className="size-8 …"` or `priority`; Plan 3 replaces those callers. Until then remove the `priority` argument from `apps/landing/components/blocks/nav-float.tsx:12` so the app still typechecks.

- [ ] **Step 7: Run the tests and typecheck**

Run: `pnpm --filter @goproceed/landing exec vitest run tests/brand-mark.test.tsx tests/metadata.test.ts && pnpm --filter @goproceed/landing typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add design-references/brand scripts/generate-brand-icons.mjs apps/landing/app/icon.png apps/landing/app/apple-icon.png apps/landing/app/favicon.ico apps/landing/components/brand-mark.tsx apps/landing/components/blocks/nav-float.tsx apps/landing/tests/brand-mark.test.tsx apps/app/public apps/mobile/assets apps/mobile/app.json
git commit -m "feat(brand): the Daylight mark — rounded tile, chevron, cobalt dot — everywhere (D3)

Eight SVGs replace the lime ring mark; scripts/generate-brand-icons.mjs
rasterises every icon file for the landing, the app and the mobile client from
them with sharp. The landing's favicon is the mark on a white tile; BrandMark
is inline vector in roles.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Plan 1 gate

- [ ] **Step 1: Run the five commands of `02-building-ui.md` §5 and the workspace suites**

```bash
pnpm --filter @goproceed/tokens generate
node packages/testing/qa/motion-audit.mjs
pnpm --filter @goproceed/testing test
pnpm turbo run typecheck
pnpm --filter @goproceed/landing build
pnpm turbo run test --concurrency=1
pnpm --filter @goproceed/app build
```

Expected: `motion-audit: clean`; the testing suite green; typecheck green; both builds green. The landing's own tests still assert the Evidence Journey page — that page still renders (only the palette moved), so they pass; Plan 3 replaces them.

- [ ] **Step 2: Look at the dashboard once**

Run the app dev server through the Browser pane (`preview_start` on the `apps/app` launch config if one exists in `.claude/launch.json`, otherwise `pnpm --filter @goproceed/app dev` via `preview_start` with a new config) and open `/dash` after signing in on the local stack — if the local Supabase stack is not up, skip and say so in the commit message of the next task; the visual pass of the dashboard is the P2 filed in Plan 3 Task 23, not this gate.

- [ ] **Step 3: Paste the gate output into the PR description draft**

Keep the terminal output in `docs/superpowers/plans/evidence/2026-09-05-landing-daylight-gate.md` under a heading `## Plan 1 — foundation (date, commit)`; Plans 2 and 3 append to the same file.

```bash
git add docs/superpowers/plans/evidence/2026-09-05-landing-daylight-gate.md
git commit -m "docs(evidence): Plan 1 gate — tokens, fonts, brand green

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
