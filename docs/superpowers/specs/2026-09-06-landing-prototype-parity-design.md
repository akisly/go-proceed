# Landing «Daylight» — full parity with the approved prototype

**Date:** 2026-09-06

**Status:** Approved by the owner on 2026-09-06 in brainstorming (rulings R1–R9
in §2). Supersedes decision **D4** of
[`2026-09-05-landing-daylight-design.md`](2026-09-05-landing-daylight-design.md)
and the «no 3D, no tilt» half of its fact **F7**; every other decision of that
spec stands.

**Applies to:** `apps/landing/**`, `packages/ui/src/motion/**`,
`packages/ui/src/base.css`, `packages/ui/src/components/{Chip,Stepper,Button,
Accordion,FeatureGrid,Compare}.tsx`, `packages/tokens/src/tokens.json`,
`packages/testing/{qa/motion-audit.mjs,src/motion-audit.test.ts}`, and the
documents in §8. Nothing under `apps/app/**`, `apps/mobile/**`, `supabase/**`
or any auth code is edited.

**Read with:** [`docs/design/02-building-ui.md`](../../design/02-building-ui.md)
(procedure and gate — it wins on every conflict of method, as amended in §8),
the 2026-09-05 spec (§1.1 facts F1–F6, F8–F10, §8 content rules, §9 form —
all unchanged), `design-references/contest-2026-09/daylight/index.html` (THE
source of truth for what the page does; line numbers below refer to it),
`design-references/contest-2026-09/daylight/README.md` (the nine iterations).

---

## 1. Purpose

PR #71 ported the prototype's composition and copy and, by decision D4,
dropped its choreography where the motion rules forbade it. The owner reviewed
the result on 2026-09-06 and asked for the prototype «точь-в-точь»: every
animation and interaction that the final `index.html` actually performs,
built from the React components the prototype's README names as its sources
(21st.dev, Magic UI, Aceternity, Kokonut, motion-primitives).

This slice restores that choreography inside the repository's method: the
motion still lives in `@goproceed/ui/motion` (rule 5 stays a build failure),
every number still comes from a token, reduced motion is still a different
composition, and the rules that D4 rested on are **amended by dated
corrections**, not ignored.

### 1.1 What the final prototype actually does — verified against the file

The gap inventory this work started from was partly written from the README,
which describes nine iterations; the final file switches several of them off.
Checked on 2026-09-06 (`index.html`, 1179 lines; the untracked
`design-contest/daylight/index.html` is byte-identical to the tracked copy):

| Claimed in the inventory / README | In the final file | Consequence |
|---|---|---|
| Рис. 01 chat scrolls forever, a scan line catches the tray photo | `.chat-list` (l.188) has no animation and no script touches it; `.chat-scan` (l.200) is a static line. The messages are duplicated in markup but never move | **Not built.** The current static `fig-01.tsx` is parity |
| Grid + paper texture + page frame lines + glows + crosshair markers on `.sep` | `.paths{display:none}` (l.47), `.bg .glow{display:none}` (l.492), `.frame-lines{display:none}` (l.494), `.sep .wrap::before/after{display:none}` (l.495); only the dot pattern remains | **Nothing to restore** — background and `SectionRule` are already parity |
| Kokonut «Background Paths» floating curves in the hero | `#paths` is not in the markup; the script exits at `if(!box)return` (l.1128) | **Not built** (owner confirmed 2026-09-06 with the design approval) |
| Header gets a `stuck` state after 30px | `.nav` and `.nav.stuck` (l.88–89) declare the same background and border | **Nothing to restore** |
| «Джерела вимог» is a marquee | `.marq` is a static six-cell grid, `span:nth-child(n+7){display:none}` (l.57) | **Nothing to restore** — `sources.tsx` is parity |
| The manifesto arc «grows» | `.arc` is a `border-top` block; no script animates it | **Nothing to restore** |
| Pulse on the «на розгляді» dot | live: `.tag.rv::before` (l.112–113), 1.6s infinite, on **every** review-tone tag | restore, page-wide (R2) |
| Tilt on «cards» | live on every `[data-spot]` (l.1159), which is the **four role cells and the three channel cards**, plus the board via the hero pointer (l.1139) | restore on all three groups (R2) |

Everything else in the inventory is live in the file and is restored: §3.

---

## 2. Rulings taken in brainstorming (2026-09-06)

| # | Question | Ruling |
|---|---|---|
| R1 | Motion library | **`motion/react` inside the vocabulary; no GSAP, no Lenis.** Smooth scroll stays `scroll-behavior: smooth`. Reasons: a second animation runtime means a second set of durations and curves outside tokens; Lenis replaces native scrolling and breaks anchors, touch and assistive tech for an effect visible only on a mouse wheel |
| R2 | Scope | **Everything the final `index.html` performs, except Lenis.** This overrides the finer-grained answers given earlier in the same session (scroll-linked budget, hero-only ambient, magnetic-only pointer motion): the file is the list |
| R3 | Rules | The motion rules and F7 are **amended by dated corrections** to match R2 (§8), not bypassed with an exclusion |
| R4 | Headings | Per-line mask reveal (SplitText `lines`) becomes a new primitive `LineReveal`; not `TextBlurIn`, not a whole-block `Reveal` |
| R5 | Route | Restore the sticky stack's scale + veil scrub, the UI panel parallax **and** the five tinted media grounds with their glow |
| R6 | Pulse | Page-wide, as the file does it (follows from R2) |
| R7 | Background Paths | Not built — absent from the final file (§1.1) |
| R8 | Approach | Extend the vocabulary (§4), not a landing-local `motion/react` escape hatch. The alternative would have made rule 5 an exception and the vocabulary a suggestion |
| R9 | Design | Approved as presented; this document is that design |

---

## 3. Block by block — prototype → today → decision → source

Sections in page order (the 2026-09-05 spec §3 table numbers them). «Today»
is `origin/main` at `db7ba8c`. Line numbers are `index.html`.

| # | Block | Prototype (what moves, and how) | Today | Decision | Source (structure / values) |
|---|---|---|---|---|---|
| 0 | Header `nav.tsx` | active link toggles at 45 % (l.1064); underline slides in; `stuck` inert | IntersectionObserver, CSS underline | **parity — no change** | — |
| 1a | Hero copy `hero.tsx` | h1 lines from masks, `yPercent 110→0`, 1.2 s expo.out, stagger .09, at .1 s (l.1109–1110); pill/lead/CTA/facts `[data-up]` y18 .9 s (l.1105) | `TextBlurIn` on h1; `Reveal` | h1 → `LineReveal`; the rest `Reveal size="stately"` | Aceternity Text Generate Effect — structure only (per-word spans); the line grouping is ours |
| 1b | Product frame `product-frame.tsx` | stage y60 1.4 s at .35 s (l.1111); `rotateX 18→0, scale .94→1` scrubbed `top 90%→35%` (l.1115); receipt y40 x20 1.2 s at .7; pills y20 1 s stagger .1 at .9 (l.1112–1113) | `ScrollSettle`, `Reveal`, `Stagger` | keep; `Reveal` gains `x`; sizes → `grand` | Aceternity Container Scroll (`ui.aceternity.com/registry/container-scroll-animation.json`, `rotateX 20→0`, `scale 1.05→1`) |
| 1c | Depth layers | `[data-depth]`: receipt −0.3, CL pill .35, supervision pill .25; `y d·80 → d·−80` over the hero's traverse (l.1116) | none | new **`Depth`** on the three layers | same `useScroll`/`useTransform` pattern |
| 1d | Board | counters 1.6 s delay .8 power2.out (l.1136); cards y14 .8 s stagger .06 delay .7 (l.1137); beam 7 s linear **infinite** (l.514–516) | `CountUp`, `Stagger`, beam finite (2 passes) | beam → infinite, from load; counters/cards keep, durations → tokens | Magic UI Border Beam (`magicui.design/r/border-beam.json`, MIT) — ours stays the CSS conic ring |
| 1e | Idle drift | receipt `rotate ±1.2°` 4 s, CL pill ∓1° 5 s, supervision pill ±1° 6 s, yoyo, sine.inOut (l.1138) | none | CSS `gp-drift` keyframes, three phase utilities, `ease.soft` | — (CSS) |
| 1f | Board tilt | pointer over the whole hero: `rotateY ((x/vw)−.5)·4`, `rotateX −((y/vh)−.5)·3`, 1 s power3 (l.1139–1140) | none | new **`Tilt area="section"`** around the board | motion-primitives Tilt (`ibelick/motion-primitives`, MIT); Aceternity 3D Card (`/25` divisor) as the second reference |
| 1g | Pulse | `.tag.rv::before` 1.6 s infinite, opacity .3↔1, scale .8↔1.1 (l.112–113) | none | `Chip pulse` on every `.tag.rv`: the board's two review cards and the Фіксація «пілот» chip. Not the receipt's state row (text, no dot) and not the route window's «на розгляді» tag — that one is `.tg.rv` (l.583), which the prototype does not pulse | — (CSS) |
| 2 | Sources `sources.tsx` | static grid | static grid | **parity — no change** | — |
| 3a | Problem statement `problem.tsx` | words `opacity .14→1`, stagger .04, scrub `top 85%→bottom 60%` (l.1143–1144) | `ScrollTint` (colour subtle→primary) | `ScrollTint` switches to **opacity .14→1** | Magic UI Text Reveal (`/r/text-reveal.json`, MIT) — same per-word `useTransform`; ours is not sticky |
| 3b | Рис. 01 `fig-01.tsx` | static (§1.1) | static | **parity — no change** | — |
| 4 | Було / стало `compare.tsx`, `Compare.tsx` | was card x−20 .9 s; now card x+20 .9 s delay .1 at `top 88%` (l.1166–1167); now-card checks `scale 0→1` .5 s, 350 ms + i·140 ms after `top 75%` (l.1168, l.617); pairs highlight; now card cobalt shadow (l.607) | `Reveal y=0`; checks static; `:has()` pairs; neutral `shadow-float` | `Reveal x` on each card; checks via `Stagger step="loose"` + a `scale` `StaggerItem`; new **`shadow.float-accent`** token on `now` | — |
| 5 | Ролі `roles.tsx`, `FeatureGrid.tsx` | cells y20 .9 s stagger .06 at `top 92%` (l.1165); spotlight; **tilt** `rotateX −(py−.5)·5, rotateY (px−.5)·6`, .6 s (l.1159–1161) | `Reveal` whole grid; spotlight | `Stagger` per cell; `Tilt` inside `FeatureCell` | 21st.dev Grid Feature Cards (`21st.dev/@efferd/components/grid-feature-cards`, author sshahaider; licence field empty on the page — structure already ours, nothing copied); motion-primitives Tilt |
| 6 | Маршрут `route.tsx` | cards y40 1.1 s stagger .08 at `top 85%` (l.1148); card *i* `scale .955, y −14` as card *i+1* goes `top 90% → top 96px`; veil to .7 from `top 80%` (l.1150–1151); UI panel `y 14→−14, rotateX −3→2` over the card's traverse (l.1152); media grounds t1–t5 with `glowc` (l.247–253) | CSS sticky; `Reveal`; neutral `bg-subtle` | new **`ScrollStack` / `ScrollStackCard` / `ScrollStackMedia`**; CSS `media-tint-1…5` + `media-glow-*`; t1 keeps the blueprint photo | Aceternity Sticky Scroll Reveal (`/registry/sticky-scroll-reveal.json`) — structure; Fora — the pattern |
| 7 | Позиція `position.tsx` | quote words `opacity .14→1` stagger .035, scrub `#arc top 85% → top 45%` (l.1154–1155); the dim prefix `color: ink-3`; pills `[data-up]` | `Reveal`, static | `ScrollTint` (second use) with `dimUntil` for the prefix; pills `Stagger` | Magic UI Text Reveal |
| 8 | Фіксація `capture.tsx`, `SpotlightCard` | cards y50 1.2 s stagger .12 at `top 82%` (l.1158); spotlight; **tilt** as roles; converging dashed paths `stroke-dashoffset → −22` 1.6 s linear **infinite** (l.343–344); the chip's ok dot | `Stagger`; spotlight; static dashes | `Tilt` in `SpotlightCard`; CSS `gp-flow` on the three paths | — |
| 9 | Походження `provenance.tsx` | cells y30 1 s stagger .1 at `top 82%` (l.1164) | `Reveal` whole bento | `Stagger` per cell (`stately`) | Magic UI Bento Grid (`/r/bento-grid.json`, MIT) — structure already ours |
| 10 | Пілот `pilot.tsx`, `Stepper.tsx` | progress line height = progress·(h−24), dots `on` at `i/n + .02`, scrubbed `top 70% → bottom 60%` (l.1170–1171); needs/gets/terms `[data-up]` | `InViewProgress` (timed, 640 ms) | new **`ScrollProgress`**; `Stepper` reads it instead | Aceternity Timeline (`/registry/timeline.json`) — `useScroll` → line height |
| 11 | FAQ `faq.tsx`, `Accordion.tsx` | open/close `height auto` .6 s expo.out (l.1074); plus marker fills and rotates .5 s | `grid-template-rows` 240 ms ease-out | `duration-deliberate ease-emphatic` on the panel and the marker | — |
| 12 | CTA `cta.tsx` | h2 lines; `[data-up]` copy and buttons | `TextBlurIn` | `LineReveal`; `Reveal` | 21st.dev Cta-4 (`21st.dev/@shadcnblockscom/components/cta-4`, shadcnblocks — structure already ours) |
| 13 | Footer | static | static | **parity — no change** | — |
| all | Buttons `Button.tsx` | hover `translateY(−1px)`, `transform .3s cubic-bezier(.22,1,.36,1)` (l.526–528); **magnetic** `x (dx−w/2)·.18, y (dy−h/2)·.25`, .5 s power3, pointer:fine only (l.1172–1173) | `Press` only | CSS hover lift on `Button`; new **`Magnetic`** wrapping every `Button` and `Pill` link | motion-primitives Magnetic (MIT; `useSpring` 26.7/4.1/0.2 — we use `spring.magnetic`, §5.3) |
| all | Section headings `section-head.tsx` | every `h2.lines` from masks, 1.1 s stagger .08 at `top 86%` (l.1103–1104) | `Reveal` | `LineReveal` | as 1a |

Two rows the inventory listed that are deliberately **not** in this table:
Lenis (R1) and the hero paths (R7).

---

## 4. The vocabulary — six new words, four changed ones

All in `packages/ui/src/motion/`, exported from `index.ts`, every number from
`./tokens`, every one branching on `useReduced()` into a *different*
composition. Sixteen words become **twenty-two**; `motion-audit.test.ts`'s
closed list grows by exactly these names.

### 4.1 `LineReveal` — a heading arriving line by line

```ts
LineReveal({ text, accent?, as?: "h1"|"h2"|"h3"|"p", className?, delay?, size?: "grand" })
```

Renders `text` once for assistive technology (`sr-only`) and once
`aria-hidden` as inline-block word spans. After layout, a `ResizeObserver`
groups the spans by `offsetTop` into lines and wraps each line in an
`overflow:hidden` mask (`padding-bottom .12em / margin-bottom −.12em`, the
prototype's `.lm`, l.645, so descenders survive). Each line animates
`yPercent 110→0` on `ease.emphatic` over `duration.grand`, stagger
`stagger.default` (80 ms; the prototype's .08/.09), once, when 14 % of the
element is in view (`top 86%`). `accent` is the phrase set in `text-accent`
(F8) and may span a line break. Fonts: the observer also re-runs on
`document.fonts.ready`, because line breaks move when Onest lands.

**Reduced:** a single opacity fade of the whole heading, `REDUCED.duration`.
**SSR:** the server renders the flat spans with no mask; the mask wrappers
are added after measurement, so hydration matches.

Why a new word and not `TextBlurIn`: the prototype's signature is the line
mask, and a blur-per-word is a different sentence. Why not `Reveal`: a
heading arriving as one block is what the owner called «упущено».

### 4.2 `Depth` — a layer that moves against the scroll

```ts
Depth({ depth: number, children, className? })   // −1 … 1
```

`y` from `depth·80px` to `depth·−80px` across the traverse of the nearest
`<section>` (`useScroll` target = `closest("section")`, offset `["start end",
"end start"]`), the prototype's `data-depth` (l.1116). Renders a
`motion.div` with `will-change: transform`. **Below `md` and under reduced
motion:** a plain `div`, no transform. Used on exactly three hero layers.

### 4.3 `Tilt` — a surface that leans toward the pointer

```ts
Tilt({ children, className?, maxX: number, maxY: number, area?: "self" | "section", duration?: "base" | "slow" })
```

Pointer position → `rotateX/rotateY` through `useSpring` (`spring.tilt`,
§5.3) on a `motion.div` with `transform-style: preserve-3d`; the parent
supplies `perspective` (the prototype's `.cards3{perspective:1600px}`,
`.stage{perspective:1500px}`). `area="self"` listens on the element
(roles, channels: `maxX 2.5, maxY 3`); `area="section"` listens on the
nearest section and normalises by the viewport (the board: `maxX 1.5,
maxY 2`). Resets to 0 on leave. **Only when `(pointer: fine)` matches and
not reduced and ≥ `md`;** otherwise a plain `div`. The prototype's `quickTo`
easing is approximated by the spring — recorded as a deviation (§10).

### 4.4 `Magnetic` — a control that follows the pointer

```ts
Magnetic({ children, className?, strengthX?: number, strengthY?: number })  // defaults .18 / .25
```

Offset from the element's centre × strength, through `useSpring`
(`spring.magnetic`); `0` on leave. Same gate as `Tilt`. Wraps a `Button` or
a `Pill` link (the prototype applies it to every `.btn`, l.1172). Not applied
to the header's button (the prototype excludes nothing, but a magnetic control
inside a `fixed` bar that also blurs its backdrop repaints the whole bar per
frame — the one place performance wins over parity, and §10 lists it).

### 4.5 `ScrollStack`, `ScrollStackCard`, `ScrollStackMedia` — Fora's stack

```ts
ScrollStack({ children, className? })                          // the container; owns the card refs
ScrollStackCard({ index, count, children, className? })        // sticky card; scale + veil
ScrollStackMedia({ children, className? })                     // the UI panel inside the media half
```

For card *i* (not the last), progress *p* of card *i+1*'s top from viewport
90 % to `96px` (`useScroll` on the next card, offset `["start 0.9", "start
96px"]`) drives `scale 1→.955` and `y 0→−14`; the veil (`bg-canvas`,
`inset-0`, `z-5`) goes `opacity 0→.7` over `["start 0.8", "start 96px"]`.
`ScrollStackMedia` reads its own card's traverse (`["start end", "end
start"]`) into `y 14→−14`, `rotateX −3→2` under `perspective: 1200px`
(`.fmedia`, l.245). **Below `wide` and under reduced motion:** plain
elements, no sticky, no veil — the same stacked composition the page has
today at those widths.

### 4.6 `ScrollProgress` — the sibling of `InViewProgress`, driven by scroll

```ts
ScrollProgress({ children, className?, offset?: [string, string] })   // default ["start 0.7", "end 0.6"]
```

Publishes `--gp-progress` (0→1, four decimals) on its wrapper from
`useScroll`, the same CSS-variable contract `InViewProgress` has, so
`Stepper`'s line (`scaleY(var(--gp-progress))`) and dot thresholds
(`clamp()` at `i/n + .02`) need no change. Deliberately a separate word
(«one word, two triggers» was rejected on 2026-08-30 for the same reason).
**Reduced:** publishes `1` immediately.

### 4.7 Changed words

- **`ScrollTint`** — per word `opacity .14→1` instead of colour (l.175,
  l.298); gains `offset?` (intro `["start 0.85", "end 0.6"]`, quote `["start
  0.85", "start 0.45"]`) and `dimUntil?: number` (the count of leading words
  set in `text-ink-muted`, the quote's prefix). Its header stops saying «the
  ONE place»; there are two, both named in §3.
- **`Reveal`** — gains `x?: number` (compare cards ±20) and `size?: "slow" |
  "stately" | "grand"` (default `slow`, unchanged for every existing caller).
- **`StaggerItem`** — gains `from?: "rise" | "scale"` (`scale 0→1` for the
  check marks, `ease.emphatic`); default `rise`, unchanged.
- **`Stagger`** — `step` keeps its three tokens; the prototype's .06/.1/.12
  map to `default`/`loose`/`loose` (§6).

`ScrollSettle`, `CountUp`, `Marquee`, `Press` and the rest are untouched.
`ScrollSettle` keeps `data-settled` (the QA harness and `board.tsx` read it),
but the beam no longer waits for it (§5.1).

---

## 5. CSS, tokens, components

### 5.1 The four ambient loops (`base.css`)

Rule 4 today permits one perpetual animation. After this slice it permits
**five, named**, and `motion-audit.mjs`'s `PERPETUAL_ALLOWLIST` lists them:

| Keyframes | Prototype | Where | Reduced |
|---|---|---|---|
| `gp-marquee` | — | existing | frozen |
| `gp-beam` | l.514–516: 7 s linear infinite, conic `transparent 0 72%, cobalt .85 86%, transparent` | `@utility beam`; runs from first paint, no `data-settled` gate | absent (unlayered block: one iteration, 0.01 ms) |
| `gp-pulse` | l.112–113: 1.6 s, `opacity .3↔1`, `scale .8↔1.1` | `Chip` dot when `pulse` | static dot |
| `gp-drift` | l.1138: `rotate` yoyo; utilities `drift-a` (±1.2°, 4 s), `drift-b` (∓1°, 5 s), `drift-c` (±1°, 6 s) | receipt, two pills | none |
| `gp-flow` | l.343–344: `stroke-dashoffset → −22`, 1.6 s linear | `capture.tsx`'s three paths | static dashes |

The yoyo loops use `var(--gp-ease-soft)` — the vocabulary's one symmetric
curve; its ruling («cross-fades only») gets the dated addition «and the
ambient yoyo loops, which have no direction either». The prototype's
`sine.inOut` is an ease-in-out, which rule 3 bans; `soft` is the permitted
symmetric curve and the visual difference over a 4–6 s cycle is nil.

### 5.2 Tinted media grounds (`base.css`)

`@utility media-tint-1 … media-tint-5` and `media-glow-cobalt | -sand |
-green` in roles: `t1` = `linear-gradient(160deg, accent-soft 92 %, canvas
90 %)` over `photo-blueprint.jpg` (already in `public/images`); `t2` =
`200deg, status-attention-surface → canvas 55 % → accent-soft`; `t3` =
`160deg, status-ready-surface → canvas 60 % → accent-soft`; `t4` = `200deg,
accent-soft → canvas 50 % → status-ready-surface`; `t5` = `160deg,
status-attention-surface → canvas 60 % → accent-soft`. The glow is a 70 %
circle, `blur(50px)`, `opacity .7`, positioned per card as l.253, in
`color-mix(in srgb, <role> 16 %, transparent)`. The prototype's sand
`#FBF3E6` maps to `status-attention-surface` (`#FAEFE8`) — the closest role;
no new colour role is added.

### 5.3 Tokens (`tokens.json`, then regenerate)

| Token | Value | Ruling |
|---|---|---|
| `duration.stately` | `900ms` | The prototype's entrance for copy and cards (`[data-up]`, roles, compare, bento, pills): measured .9–1.0 s on `design-references/contest-2026-09/daylight/index.html` |
| `duration.grand` | `1200ms` | The prototype's hero and heading choreography: line masks 1.1 s, h1 and receipt 1.2 s, stage 1.4 s, channels 1.2 s, counters 1.6 s. One token for the whole family; §6 lists each rounding |
| `spring.tilt` | `stiffness 120, damping 20, mass 1` | Pointer tilt settle ≈ .6–1 s without overshoot, the prototype's `quickTo` power3 |
| `spring.magnetic` | `stiffness 150, damping 18, mass .5` | Pointer follow that catches up in ≈ .5 s; motion-primitives ships 26.7/4.1/0.2 which overshoots visibly and the prototype does not |
| `shadow.float-accent` | `0 30px 70px −40px` cobalt-500 α .35, `0 1px 2px` ink α .05 | The «З GoProceed» card (l.607): the one coloured shadow, and it is the mark's colour |

`motion/tokens.ts` gains `DURATION.stately`, `DURATION.grand`, `SPRING.tilt`,
`SPRING.magnetic` — parsed, not typed; `motion-contract.test.ts` re-parses
them. `base.css` gains `duration-stately` / `duration-grand` utilities.

### 5.4 Components (`packages/ui/src/components`)

| Component | Change |
|---|---|
| `Chip` | `pulse?: boolean` — the dot gets `animate-pulse-dot` (only meaningful with `dot`); default off, so `apps/app` is unaffected (it does not use `Chip` today) |
| `Stepper` | composes `ScrollProgress` instead of `InViewProgress`; `Step` unchanged |
| `Button` | `hover:-translate-y-px transition-transform duration-base ease-emphatic` on every size but `link`; `Press` unchanged. `Magnetic` is applied by the caller (the landing), not inside `Button`, so the app's controls do not follow the pointer |
| `Accordion` | panel and marker on `duration-deliberate ease-emphatic` |
| `FeatureCell` | the `article` becomes a `Tilt area="self"` (`maxX 2.5, maxY 3`); `FeatureGrid` gets `perspective` |
| `ComparePair` / `CompareCard` | `now` carries `shadow-float-accent`; the check icon is a `StaggerItem from="scale"` when rendered inside the landing's `Stagger` (the component takes `animateChecks?: boolean`) |

`SpotlightCard` (landing visual) wraps its article in `Tilt` the same way.

---

## 6. Timing map — prototype → token

Every prototype value and where it lands. Where the rounding exceeds 25 % the
row says so; nothing is typed as a literal.

| Prototype | Token | Note |
|---|---|---|
| `.9 s`, `1.0 s` (data-up, roles, compare, bento, pills) | `duration.stately` 900 ms | pills/bento 1.0 → 900 (−10 %) |
| `.8 s` (board cards) | `duration.stately` | +12 % |
| `1.1 s`, `1.2 s`, `1.4 s`, `1.6 s` (lines, h1, receipt, channels, fcards, stage, counters) | `duration.grand` 1200 ms | stage 1.4 → 1.2 (−14 %); counters 1.6 → 1.2 (−25 %) |
| `.6 s` (FAQ), `.5 s` (check scale), `.5 s`/`.6 s`/`1 s` quickTo | `duration.deliberate` 640 ms; springs | |
| `.4 s` (spotlight opacity), `.3 s` (button transform) | `duration.slow` 400, `duration.base` 240 | |
| `.2 s`, `.25 s` (border/background, pair wash) | `duration.fast` 160 | |
| `expo.out` | `ease.emphatic` | identical curve |
| `power3.out` | `ease.enter` | quart for cubic; visually indistinguishable at these durations |
| `power2.out` | `ease.out` | identical |
| `cubic-bezier(.22,1,.36,1)` (buttons) | `ease.emphatic` | |
| `sine.inOut` (drift) | `ease.soft` | §5.1 |
| stagger `.04`/`.035` (words) | `stagger.tight` 40 ms | |
| stagger `.06`/`.08`/`.09` | `stagger.default` 80 ms | |
| stagger `.1`/`.12`/`.14` | `stagger.loose` 120 ms | checks .14 → .12 |
| delays `.1 .35 .7 .9 .8` (hero timeline) | `delay` props in seconds, as today | delays are choreography, not tokens — the 2026-09-05 spec already passes them |
| `top 86%`, `top 92%`, `top 82–88%` (once triggers) | `viewport.amount` .14 / .08 / .15 | expressed as the visible fraction; `Reveal` keeps its default .35 for callers outside the landing |

---

## 7. Sources — what was read, and its licence

Fetched 2026-09-06; the files are in the session scratchpad and cited here so
the plan can quote values without re-fetching. Nothing is installed from a
registry (03-ui-references rule); code is read for **structure and values**
and re-expressed inside the vocabulary in token roles.

| Source | Components read | Licence | Used for |
|---|---|---|---|
| Magic UI — `https://magicui.design/r/{border-beam,marquee,dot-pattern,number-ticker,bento-grid,magic-card,blur-fade,text-reveal}.json`, `github.com/magicuidesign/magicui/LICENSE.md` | as named | **MIT** | beam (values), text-reveal (per-word `useTransform`), bento (structure) |
| Aceternity — `https://ui.aceternity.com/registry/{container-scroll-animation,sticky-scroll-reveal,3d-card,text-generate-effect,timeline,background-lines}.json`; `https://ui.aceternity.com/licence` | as named | **Aceternity License** — end products permitted and distributable; redistribution of the source files or derived templates on marketplaces prohibited. **Not MIT.** | structure and numbers only; no file is copied |
| Kokonut UI — `https://kokonutui.com/r/background-paths.json`, `github.com/kokonut-labs/kokonutui/LICENSE` | Background Paths | **MIT** | read; **not used** (R7) |
| motion-primitives — `github.com/ibelick/motion-primitives/components/core/{magnetic,tilt,spotlight,in-view,scroll-progress,animated-number,infinite-slider,text-effect}.tsx` | as named | **MIT** (README; the LICENSE file is not at the repo root path the README links — recorded, not blocking, because the README's statement is the author's) | `Magnetic`, `Tilt` (structure; our springs) |
| 21st.dev — `https://21st.dev/haydenbleasel/announcement/default-with-tag` (kibo-ui Announcement, page metadata `license: mit`; code at `cdn.21st.dev/…/announcement/code.tsx`); `https://21st.dev/@efferd/components/grid-feature-cards` (sshahaider; licence field empty; `cdn.21st.dev/sshahaider/grid-feature-cards/code.1747156095288.tsx`); `https://21st.dev/@shadcnblockscom/components/cta-4` (shadcnblocks; licence field empty; `cdn.21st.dev/shadcnblockscom/cta-4/code.1747631648437.tsx`) | Announcement, Grid Feature Cards, Cta-4 | mit / unstated / unstated | already built as `Pill`, `FeatureGrid`, `cta.tsx` in PR #71; nothing further is taken. The two unstated licences are the reason nothing is copied from them |

The prototype's own choreography (`index.html` l.1049–1179) is the primary
source for every number; the libraries above are how the README says those
blocks were found.

---

## 8. Rules amended — dated corrections, 2026-09-06

Each is a correction block inside the existing file, in the house style
(«[Correction, 2026-09-06: …]»), never a silent rewrite.

| File | Amendment |
|---|---|
| `docs/design/02-building-ui.md` §4.3 rule 5 | «no perpetual animation but the marquee» → «no perpetual animation outside the five named in `motion-audit.mjs`'s allowlist: the marquee and the landing's four ambient loops (beam, pulse, drift, flow). A sixth is a §7.3 decision.» |
| same, rule 9 | «At most two scroll-linked elements per page, and never in one fold» → «Scroll-linked compositions are the ones the landing spec's block table names — one per section, each driven by one scroll source, none below `md` (`wide` for the stack) and none under reduced motion. Adding one is a spec change, not a prop.» |
| same, §4.2 | «the sixteen motion primitives» → twenty-two |
| same, §4.1 substitution table | a row: «`onPointerMove` + `style.transform` for a tilt or a pointer follow → `Tilt` / `Magnetic`» |
| `DESIGN.md` Key Characteristics + Don't | «exactly two scroll-linked elements» → per-section wording above; «Don't use 3D, tilt, or pointer-driven perspective» → «Pointer tilt is permitted at ≤ 3° on a spring, `pointer: fine` only, on the surfaces the landing spec names; the product frame both settles on scroll and leans toward the pointer»; «Don't run any animation forever except the marquee — the Border Beam is finite» → the five loops; «four shadows, none coloured» (§«Structure is a 1px line») → «five; `float-accent` is the mark's colour on the one card that is the product's promise» |
| `docs/superpowers/specs/2026-09-05-landing-daylight-design.md` | D4 and F7 get a correction pointing here; §6.2's dropped row and §7.1/7.2/7.5 likewise |
| `docs/design/03-ui-references.md` «Landing references» table | the «What we do not» column loses «the perpetual beam; pointer tilt», «3D hover», «the scale/veil scrub»; a «Source / licence» column is added from §7 |
| `docs/design/2026-08-19-design-system-rewrite-plan.md` §8.3 | «Update, 2026-09-06. Sixteen became twenty-two» block, one paragraph per word, the same shape as the 2026-08-30 block |
| `TODOS.md` «P3 — not carried from the prototype, by decision D4» | → «CLOSED 2026-09-06 — reopened and restored by `2026-09-06-landing-prototype-parity-design.md`; Lenis stays out (R1); the hero paths were never in the final file (§1.1)»; the stale «two scroll-linked» docstring P3 closes with it |
| `packages/ui/src/motion/index.ts`, `ScrollTint.tsx`, `Marquee.tsx` headers | counts and «the ONLY perpetual» / «the ONE place» sentences corrected |
| `packages/ui/src/motion/tokens.ts` / `tokens.json` `ease.soft` ruling | «Cross-fades only» → «… and the ambient yoyo loops» |

---

## 9. Tests, gate, QA

**Tests first** (`superpowers:test-driven-development`), red before green:

| File | Pins |
|---|---|
| `packages/testing/src/motion-audit.test.ts` | the closed list of twenty-two names; the allowlist names exactly five keyframes; rule 4 still flags a sixth `infinite` |
| `packages/testing/src/motion-contract.test.ts` | the two new durations and two springs parse; `0.12` stays the only literal |
| `packages/testing/src/token-fidelity.test.ts`, `palette-derivation`, `contrast` | rerun; `shadow.float-accent` carries a ruling ≥ 10 chars |
| `apps/landing/tests/ui-components.test.tsx` | `LineReveal` SSR: text once visible-hidden, once aria-hidden, no mask wrappers before measurement; `Depth`/`Tilt`/`Magnetic` SSR: a plain wrapper, no inline transform; `ScrollStack` SSR: one card shape regardless of width; `ScrollProgress` under reduced publishes `1`; `Chip pulse` adds the class only with `dot`; `Reveal x`; `StaggerItem from="scale"`; `Accordion` carries `duration-deliberate` |
| `apps/landing/tests/landing-render.test.tsx` | three `[data-depth]` layers in the hero; the beam element present without `data-settled` dependence; the h1 renders its text exactly twice (sr + visual); the five route cards inside one `ScrollStack`; review chips on the board carry the pulse attribute |
| `apps/landing/tests/design-contract.test.tsx` | contract id → `user-approved-daylight-parity-2026-09-06` and the FORM line names this spec |
| `apps/landing/qa/landing.mjs` | keeps the seven widths + reduced; the beam check no longer settles first (measures within the first 7 s); adds: `[data-depth]` transforms differ at two scroll positions on 1440 and are absent at 390; `[data-tilt]` present on 1440 only; no element wider than the viewport with tilt applied; `--gp-progress` on the stepper reaches 1 at the section's end; console clean |

**Gate** — the five commands of `02-building-ui.md` §5 in order, then `pnpm
--filter @goproceed/landing test`, `pnpm --filter @goproceed/landing qa`,
`pnpm validate:canonical-docs`; output pasted in the PR. The §6 visual pass
at the six widths plus reduced motion, with the QA PNGs (the desktop app's
Browser pane returns blank captures here — the harness's PNGs are the
evidence). Before-screenshots of `db7ba8c` were taken on 2026-09-06 (214
files) and go into the PR beside the after-set.

---

## 10. Deviations from the prototype, and why

| # | Prototype | Here | Reason |
|---|---|---|---|
| 10.1 | Lenis | native scroll, `scroll-behavior: smooth` | R1 |
| 10.2 | GSAP `quickTo` power3 easing on tilt and magnetic | springs (`spring.tilt`, `spring.magnetic`) | a follow that tracks a pointer is a spring by nature; no ease-in-out is admitted (rule 3) |
| 10.3 | `sine.inOut` drift | `ease.soft` | rule 3 |
| 10.4 | durations .8–1.6 s | two tokens (§6) | one place for every number |
| 10.5 | magnetic on the header button | not applied | a fixed, backdrop-blurred bar repainting per pointer frame |
| 10.6 | sand `#FBF3E6` in `t2`/`t5` | `status-attention-surface` | no new colour role for a background gradient |
| 10.7 | `[data-depth]` and tilt on every width above 900px | above `md` (768) | two breakpoints by ruling; the 768–900 band gets the desktop behaviour |
| 10.8 | stack scrub above 900px | above `wide` (1240) | the cards are single-column below `wide` already (2026-09-05 §10); a scrub on a single column reads as jitter |

Nothing else differs on purpose. Where the after-screenshots show a
difference not in this table, that is a defect of the slice.

---

## 11. Out of scope

Copy; the pilot form and its route; the brand; `apps/app` and `apps/mobile`;
a dark theme; the hero paths (R7); Lenis (R1); any content the prototype does
not have.
