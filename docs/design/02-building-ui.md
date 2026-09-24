# Building UI in GoProceed

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-09-24

**Related decisions:** [ADR-015](../decisions/ADR-015-stock-tailwind-under-the-tokens.md) (2026-09-24: stock Tailwind stays whole). The rulings this procedure enforces are D1–D7
in the [rewrite plan](./2026-08-19-design-system-rewrite-plan.md) §3, which need
an ADR before Phase 3.

**Surfaces:** `apps/landing`, `apps/app`, `packages/ui`, `packages/tokens`

**Type:** Procedure. Under `docs/README.md`'s precedence this ranks as target
design — it governs *how* a surface is built. It never overrides an ADR, the
applied database, or the product scope.

**Companions — one level deep, do not chain further:**
[`01-tokens.md`](./01-tokens.md) — the values, generated ·
[the rewrite plan](./2026-08-19-design-system-rewrite-plan.md) — the reasoning of 2026-08-19, Historical since 2026-09-14 (DEV-007); take no value from it.

---

## 0. Read this when

Any change under `apps/landing/**`, `apps/app/app/**`, `packages/ui/**` or
`packages/tokens/**`. Also when reviewing one.

Not for backend, migrations, or `apps/demo/**` (frozen until D5).

---

## 1. The model, in one paragraph

Three layers. **A component names a ROLE, never a value.** `bg-canvas`, not
`bg-neutral-25`, and never `bg-[#ECE9DF]`. Roles live in
`packages/tokens/src/tokens.json`, reach CSS through seven generators, and reach
Tailwind through `@theme inline`. Ramp steps are deliberately unreachable as
utilities — `bg-neutral-200` does not compile *[until 2026-09-24; it now compiles to stock Tailwind's cool neutral, not this system's warm one]* — and a raw `var(--gp-neutral-200)`
fails a test. Everything else in this document follows from that sentence.

*[2026-09-24, DEV-073, owner: «Tailwind работал нормально, а уже на нем накатывались наши токены». The theme no longer clears Tailwind's stock namespaces: stock utilities (`max-w-md`, `sm:`/`lg:`, `text-sm`, `shadow-md`, the stock palette) compile, and a role overrides a stock name it shares (`md`, `font-medium`, `leading-tight`, `ease-out`). This system's own ramp steps are still not utilities, but stock palettes share their names: `bg-neutral-200`, `bg-green-100` are Tailwind's colours now. The owner left stock utilities free, colours included («Полностью свободно»); preferring the role where one exists is a review rule (`gp-ui-reviewer`), and a stock utility is expected where no role names the dimension (container widths, spacing). The rows below marked «does not compile» / «resolves to nothing» now describe that review rule, not the build. `cx()` extends stock tailwind-merge instead of overriding it. Stock breakpoints and container sizes are restated in px beside the px roles, because Tailwind orders breakpoints by unit before value; stock `animate-spin|ping|pulse|bounce` are infinite loops, and `motion-audit` refuses them.]*

---

## 2. The loop

Copy this and track it. The gate is not optional and not last-minute — a claim
of "done" without §5 output is the failure mode this file exists to prevent.

```
- [ ] 1 ORIENT   read §3.1, know which surface and which layer you are touching
- [ ] 2 DECIDE   answer the three questions in §3.3 before the first line
- [ ] 3 BUILD    §4 — role names, file placement, the build-failure rules
- [ ] 4 GATE     §5 — run all five, paste the output
- [ ] 5 SEE      §6 — six viewports + reduced motion, with real Ukrainian strings
- [ ] 6 VERIFY   gp-reviewer + gp-ui-reviewer over the diff, §5 output and §6 screenshots,
                 then gp-qa on the final revision (root AGENTS.md); only then say done
```

---

## 3. Before you write code

### 3.1 Read order

1. **This file.** Then stop and check: does the thing you are about to build
   already exist in `packages/ui/src/components/index.ts` or
   `packages/ui/src/motion/index.ts`? Both indexes list what is deliberately
   absent and when it arrives. Building a second Button is the most expensive
   mistake available here.
2. **[`01-tokens.md`](./01-tokens.md)** — only the section you need. It is
   generated and it is long; do not read it end to end.
3. **The plan's §9** (landing blocks) or **§10** (app surfaces) — only if you
   are building one. *[2026-09-14 (DEV-007): the plan is Historical. For a landing block read `DESIGN.md` and `docs/superpowers/specs/2026-09-05-landing-daylight-design.md` with its 2026-09-06 parity spec; for an app surface, `03-ui-references.md`, `04-role-pain-map.md` and `docs/superpowers/specs/2026-09-05-app-daylight-migration-design.md`. A rebuild against the landing reference the owner set on 2026-09-14 follows BL-082.]*

**Do not read** `apps/demo/src/styles.css`. It is a frozen 156 KB prototype
sheet with the superseded palette, and reading it teaches you values that now
fail the colour audit.

### 3.2 Skills

**Use, and when:**

| Skill | When | Why this one |
|---|---|---|
| **Process** — root `AGENTS.md`, `agents/PLAYBOOKS.md` (UI change) | every block or component | Intent and owner decisions go into the task record before the first line — the question *what is this for* is the one that stops a component being built twice. Anything with a contract (a token, a variant set, an audit rule) gets its test first: every rule in this system is a test, so writing it first is the deliverable, not ceremony. A gate that fails without an obvious cause gets the bug-fix playbook. Review is `gp-reviewer` plus `gp-ui-reviewer`; done needs `gp-qa` over §5's evidence |
| `design-taste-frontend` | composing a **landing** block's visual arrangement | Anti-slop, contextual, and it says outright it is *not* for dashboards or data tables — so it never touches `/app` |
| `image-to-code` | a landing block whose composition you cannot picture | Image-first: generate the section reference, then implement it. Use for hero/CTA composition only |
| `redesign-existing-projects` | Phase 4, restyling `apps/app` | Audit-first, improves in place rather than rewriting — which is the constraint on `/app` *[2026-09-05: the field client migrated onto the roles (spec `2026-09-05-app-daylight-migration-design.md`); the skill's remaining use is a dashboard screen that reads wrong, never a stylesheet.]* |
| `claude-in-chrome` | the §6 visual pass | The only way to actually see the six viewports |
| `dataviz` | before the first line of any chart | The token source already carries `viz-1`…`viz-5`; read the skill, then use those roles |

**Do not use, and why:**

| Skill | Why not |
|---|---|
| `high-end-visual-design` | Its "Variance Mandate" is *never generate the same layout twice*. A design system's entire value is that the same decision produces the same result. Directly opposed |
| `minimalist-ui` | Bans a prescribed typeface. This product has one, chosen for Cyrillic and tabular figures. *[2026-09-22: the face is **Hanken Grotesk with Commissioner behind it for Cyrillic** — the owner's brand sheet, and a pair because Hanken has no Cyrillic at all.]* *[Correction, 2026-09-05: the face is **Onest**, not Inter — Daylight made it the one typeface on every token-driven surface (`01-tokens.md` §typography, §9 of this file). The field client's routes keep Inter until their migration. The refusal stands on the same ground: a skill that bans the system's chosen face is arguing with the system.]* |
| `brand-guidelines` | Applies *Anthropic's* brand |
| `web-artifacts-builder` | For claude.ai artifacts, not a Next app |
| `figma:*` | Figma is deferred (plan §3). The DTCG file generates and waits |

*[Changed 2026-09-13: the Process row replaced six rows naming a retired skill-driven workflow's skills; the method they carried now lives in the process documents it names — `docs/ai-workflow.md`.]*

`impeccable` is the judgement call: it overlaps this document heavily. Reach for
it only for a **critique pass on a finished block**, never to decide structure —
structure is decided here. `interface-design` may inform domain exploration inside `DESIGN.md`'s direction; adopt no palette, type or signature it proposes, and decline its offer to save a system file: its `.interface-design/system.md` outlived the design it described and was removed on 2026-09-14 (DEV-007).

### 3.3 Three questions, answered before the first line

1. **Which surface?** `apps/landing` is greenfield and may use the marketing
   scale, `radius-card`/`surface`/`section`, and `shadow-float`. `apps/app` may
   use none of those: it is dense, its type scale is the product scale, and
   nothing floats off the page.
   *[2026-09-23, DEV-035, owner, for the office dashboard after the Autumn CRM
   reference: «Как в Autumn».] Two exceptions, and only these: the shell's
   work sheet is `rounded-card`, and `shadow-raised` sits under the work
   sheet, a dashboard panel, a KPI card and the current navigation item. `shadow-float`, the marketing
   scale and `radius-surface`/`section` stay out of `apps/app`. The
   dashboard's primary action is `Button variant="brand"` (pine), not ink.*
2. **Does a role exist for what you mean?** If you want a colour that no role
   names, you have found a missing role, not a missing value. Add it to
   `tokens.json` (§7), do not reach past the layer.
3. **Does this move?** If yes, it comes from `@goproceed/ui/motion`. If the
   vocabulary has no primitive for it, see §7.3 — that is a decision, not an
   addition.

---

## 4. While you write

### 4.1 The substitution table

This is the highest-value part of this document. Left column compiles to
nothing, fails a test, or silently drops a class.

| Do not write | Write | What happens otherwise |
|---|---|---|
| `bg-[#ECE9DF]`, `bg-neutral-25` | `bg-canvas` | Does not compile; the ramp is not in the utility namespace |
| `var(--gp-neutral-600)` | `var(--gp-text-muted)` | `primitive-leak.test.ts` fails |
| `text-sm`, `text-lg` | `text-data`, `text-h3` | Stock namespace is cleared; resolves to nothing *[2026-09-24: compiles to the stock size now; use the role]* |
| `lg:`, `xl:`, `sm:` | `md:`, `wide:`, `rail-icons:` | A typo fails loudly instead of silently targeting a width this design never reasons about *[2026-09-24: stock breakpoints compile now; the design still reasons about `md` and `wide`]* |
| `h-11`, `h-9` on a control | `h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch)` | `component-contract.test.ts` fails; the literal stops tracking the token |
| `shadow-md`, a shadow on a panel | nothing — use `border border-line` (a dashboard panel gets `shadow-raised` from `Panel` itself since DEV-035) | Structure is border-led. Folio ships 180 borders to 8 shadows |
| a gradient, glow or glass written as a VALUE | a named `@utility` built from roles with `color-mix` | DEV-029. `media-tint-*`, `media-glow-*`, `.landing-stage`, `.landing-glass` are the pattern. A gradient in a component is a colour no role names, no test measures and no theme reaches |
| `bg-chip-*` beside a status chip | one or the other | DEV-029. The four index tints are bound to the ORDER of an enumeration; two coloured marks in one cell teach the reader that neither means anything |
| `transition-all` | `transition-colors`, `transition-transform`, `transition-opacity` | `motion-audit` rule 1 |
| `ease-in`, `ease-in-out` | `ease-out`, `ease-enter`, `ease-emphatic`, `ease-soft` | Rule 3. Ease-in stalls the first frame — the frame being watched |
| `duration-200` | `duration-fast`, `duration-base` | A number means nothing; a name changes everywhere at once |
| `import { motion } from "motion/react"` | `import { Reveal } from "@goproceed/ui/motion"` | Rule 5, build failure |
| `bg-${tone}` | a literal class string per branch | Tailwind scans source text. The scanner sees the template literal and emits **no CSS** |
| `style={{ color: … }}` | a utility | The one route a colour has past both the namespace and the colour audit |
| `error?: string` | `error?: string \| undefined` | `exactOptionalPropertyTypes`; the call site is forced into a conditional spread |
| a status shown only by colour | colour **plus** its `ui_uk` label | Printed, photographed in sunlight, or colour-blind — all real here |
| `text-ink-subtle` for body copy | `text-ink-muted` | Subtle clears only the large-text threshold |
| `text-micro` under `/app` | `text-meta` | The QA harness fails anything under 12px there |
| `<AnimatePresence custom={dir}>` | `SlideSwap` | Rule 5, build failure |
| a state-driven `motion.span` progress line | `TrackFill` | Rule 5; `LineDraw` is the scroll one |
| `useTransform` in a landing visual | `InViewProgress` + `calc(var(--gp-progress))` | Rule 5 |
| `onPointerMove` + `style.transform` for a lean or a pointer follow | `Tilt` / `Magnetic` | Rule 5; and the gates (pointer:fine, `md`, reduced) live in the word, not in the caller |
| a paragraph in `text-accent` | `text-accent` inside a display heading; `text-link` for a link | A discipline, not a contrast limit any more: pine measures 6.30:1 on the canvas, where cobalt measured 4.35:1 and was held to the 3:1 large-text bar. An accent phrase is still a phrase, not a paragraph |
| `h-11` on a marketing control | `size="lg"` on `Button`; `h-(--gp-control-height-marketing)` on an input | The literal stops tracking the token |
| a lime fill, `bg-signal` as decoration | `bg-action-signal` on at most one action, or ink | The spark is ember since 2026-09-22 (cobalt from 2026-09-05), it carries INK and never white, and the landing uses none (DEV-029 carried one per page for one pass; the owner took it off) |

### 4.2 Where code goes

```
packages/tokens/src/tokens.json      every value, the only hand-edited token file
packages/ui/src/base.css             the one hand-written stylesheet: variants, base, @utility
packages/ui/src/*.generated.*        NEVER EDIT — regenerate (§7.1)
packages/ui/src/motion/              the twenty-seven motion primitives, and nothing else (twenty-two until DEV-026, twenty-four until DEV-027)
packages/ui/src/components/          the thirty-one components, and nothing else (twenty-seven until DEV-035)
apps/landing/app/                    the four landing pages (/, /product, /roles, /pilot — DEV-025)
apps/landing/components/blocks/      the landing blocks the pages compose
apps/app/app/                        the product shell and its screens
packages/testing/src/*.test.ts       every contract test
packages/testing/qa/motion-audit.mjs the static motion audit
```

A component that could live in two apps lives in `packages/ui`. A component that
encodes one screen's domain — the work register, the evidence chain — lives in
its app.

### 4.3 Rules that are build failures

Terse on purpose; each is enforced by a named test.

1. No ramp step outside `tokens.json` → `primitive-leak`
2. No hand-edited generated file → `token-fidelity`
3. No hand-edited hex in `tokens.json`; edit the OKLCH triple → `palette-derivation`
4. No `motion/react` import outside `packages/ui/src/motion` → `motion-audit` 5
5. No `transition: all`, no layout-property transition, no `ease-in`, no
   perpetual animation outside the loops named in `motion-audit.mjs`'s
   `PERPETUAL_ALLOWLIST` → `motion-audit` 1–4
   [Correction, 2026-09-06: until this date the rule read «no perpetual
   animation but the marquee». The landing parity slice
   (`docs/superpowers/specs/2026-09-06-landing-prototype-parity-design.md` §5.1)
   restored the prototype's Border Beam, review-dot pulse, receipt/pill drift
   and dashed «flow» lines, so the allowlist names five loops and a test pins
   the list. A sixth is a §7.3 decision.]
   [2026-09-19 (DEV-026, owner: the landing «1 в 1» after its reference): the
   sixth and seventh are `gp-orbit` (the arc text — in the vocabulary and the
   kitchen sink; the landing stopped calling it on 2026-09-22) and `gp-breathe` (the
   closing block's mark). `PixelRain` is a canvas primitive in
   `@goproceed/ui/motion`, not a CSS loop; it draws one still frame under
   reduced motion.]
   [2026-09-19 (DEV-027, owner: the reference's behaviour, «Используй threejs
   или @react-three/fiber»): three more canvas words — `CellField`, `ArcField`
   (2D) and `ParticleSphere` (three.js, the landing's one WebGL scene). None is
   a CSS loop, so `PERPETUAL_ALLOWLIST` stays at seven. All four canvas words
   run on `motion/canvas-loop.ts`, which holds their rules: the loop is
   CANCELLED off screen and in a hidden tab; a scene with nothing left to draw
   rests with no frame pending; the colour is the element's computed `color`;
   a pointer is followed only under `pointer: fine`; reduced motion is one
   still frame. `requestAnimationFrame` outside `packages/ui/src/motion` is a
   review failure; `motion-audit.test.ts` catches the plain call form
   (`requestAnimationFrame(` in a `.ts`/`.tsx` file of `packages/ui/src` or the
   landing's `app` and `components`) anywhere but `canvas-loop.ts` — a net for
   the ordinary case, not a proof.]
6. No hard-coded control height, no inline-style colour, no raw hex, no
   per-component focus ring, no `destructive` button variant → `component-contract`
7. No literal Tailwind class string inside a test — assemble at runtime, or
   Tailwind emits your fixture as production CSS
8. Reduced motion is a **different** animation, never a faster one
9. Scroll-linked compositions are the ones the landing spec's block table
   names — one per section, each driven by one scroll source, none below `md`
   (`wide` for the sticky stack), none under reduced motion
   [Correction, 2026-09-06: was «At most two scroll-linked elements per page,
   and never in one fold». The parity spec §3 names them: the hero (settle +
   depth), the problem statement, the route stack, the position quote, the
   pilot stepper. Adding one is a spec change, not a prop.]
10. At most one `bg-action-signal` per screen *(corrected 2026-09-05: was «exactly one»; the Daylight landing's primary is ink and carries none. DEV-029 allowed one per page for one pass on 2026-09-22 and the owner withdrew it the same day)*

---

## 5. The gate

Run all five, in order, from the repo root. Do not paraphrase the output.

```bash
pnpm --filter @goproceed/tokens generate     # 1 — only if tokens.json changed
node packages/testing/qa/motion-audit.mjs    # 2 — must print "motion-audit: clean"
pnpm --filter @goproceed/testing test        # 3 — the contract suite
pnpm turbo run typecheck                     # 4
pnpm --filter @goproceed/landing build       # 5 — proves Tailwind compiled what you wrote
```

Step 1 is the one people skip. If `tokens.json` changed and you did not
regenerate, step 3 fails on `token-fidelity` and the message looks like a
mysterious diff rather than what it is.

Step 5 matters more than it looks: a class that does not compile produces **no
error at all**, only an unstyled element. The build is the only place that shows.

**Two known gaps — close them when you touch CI:**

- `motion-audit.mjs` is not yet a CI step. Add it beside
  `pnpm validate:canonical-docs` in `.github/workflows/ci.yml`. *[Changed 2026-09-14 (DEV-005): `packages/testing/src/motion-audit.test.ts` «finds nothing» already runs the audit inside `pnpm turbo run test`, which CI runs; only a separate step is absent.]*
- `turbo.json`'s `test` task lists token files under `inputs` but not
  `packages/ui/src/components/**`, `packages/ui/src/motion/**`,
  `packages/ui/src/tw-merge.generated.ts` or `packages/ui/src/theme.generated.css`.
  A component change can therefore replay a cached green test run. Add them.

---

## 6. Seeing it

The gate proves the rules. It does not prove the thing looks right. Use
`claude-in-chrome`, and look at all six — the shell has three states and the
harness pins these widths:

`1920 · 1440 · 1240 · 768 · 390 · 360`

At each, check: does anything overflow, does the fold still hold the number that
matters, does the touch target survive at 390.

Then **turn reduced motion on and reload**. Every primitive must change shape,
not speed: reveals stop moving, the blur resolve becomes a fade, the marquee
freezes, the counter starts final, the pinned tour unpins into stacked sections.

**Use real Ukrainian strings, never lorem.** «Внутрішньо готово», «Секція А ·
підвал · електрощитова ВРУ-1». Ukrainian runs materially longer than English and
has three plural forms whose teens are the trap — 11–14 take the genitive plural
despite ending in 1–4. `pluralUk`/`rowsUk` already encode this at
`apps/demo/src/domain/format.ts:44` — **port them, never re-derive them**, and
never write `${n} рядків`.

---

## 7. Changing the system itself

### 7.1 A colour, size, duration or radius

Edit `packages/tokens/src/tokens.json`, then regenerate. **Colours are OKLCH
triples and the hex is output** — round the triple to six decimals, never four,
and write a `ruling` of at least ten characters or the fidelity test rejects it.

```bash
pnpm --filter @goproceed/tokens generate
pnpm --filter @goproceed/testing test
```

A new colour role also needs a `tw` name that no other role claims, and at least
one pairing in `contrast.test.ts` — a foreground role nothing has proven
readable fails the suite.

### 7.2 A component

Add it to `packages/ui/src/components/`, export it from `index.ts`, render it in
`/kitchen-sink/components` beside the rule it carries. All three.

**Correction, 2026-08-29:** this paragraph used to end «All three, or
`component-contract.test.ts` fails on the orphan», and that was false for the
third obligation. That test asserts file↔`index.ts` parity in both directions
(«exports every component file» / «exports nothing that has no file»); it never
opens a kitchen sink and cannot see whether a component is rendered in one. The
first two obligations are gated; **the kitchen-sink rendering is enforced by
nothing.** The cost is not theoretical — slice A shipped `FieldSeparator` with
`bg-canvas` where the substitution table says `bg-surface`, a live class that
would have painted a band across a white panel, and it survived precisely
because no sink rendered it and no test looked. Adding the scan to
`component-contract.test.ts` is filed in `TODOS.md`; until it lands, treat the
third obligation as a rule you keep by hand. *[Changed 2026-09-14 (DEV-005):
the scan landed in `13157b9` (2026-08-30) as «renders every component module
in the kitchen sink» in `packages/testing/src/component-contract.test.ts`,
reading `apps/landing/app/kitchen-sink/components/page.tsx`. All three
obligations are now gated.]*

Take `className` last and merge with `cx()` — never string-concatenate. And
never pass a function-valued `className` or `children` into a Radix `asChild`:
Slot merges by string concatenation, so the function is stringified into the
class attribute. React does not warn and TypeScript cannot see it.

### 7.3 A new motion primitive

Not an addition — a decision. It means the vocabulary was missing something, so
the new primitive's own file header and `packages/ui/src/motion/index.ts`, whose header counts the vocabulary, say what and why in the same change *[2026-09-14 (DEV-007): this named the rewrite plan's §8.3, now Historical]*. The test that fails
is the prompt to write that down.

*[2026-09-19 (DEV-027)]* A canvas word — one that draws frames rather than
animating an element — is built on `motion/canvas-loop.ts` and keeps its
contract: the caller sizes the canvas in CSS and picks the colour with a text
role (`text-ink`); the word is `aria-hidden` and takes no pointer events unless
following the pointer is its purpose; it exposes its state as a `data-*`
attribute for the harness, which measures the bitmap because the static audit
cannot see a canvas. A heavy dependency (three.js) is imported dynamically
inside the word, after the element nears the viewport, and the word names its
fallback.

---

## 8. Traps that already cost a round

One line each. Every one of these shipped or nearly shipped.

- **Unlayered CSS beats every layer**, at any specificity. `prefers-reduced-motion`
  is deliberately unlayered so it beats even the frozen sheet's `!important`.
- **`!important` inverts layer order** — the *lowest* layer wins.
- **tailwind-merge silently deletes a class it does not understand.**
  `twMerge("text-data text-ink")` returns `"text-ink"`. Always import `cx` from
  `packages/ui/src/components/cn.ts`, never `twMerge` directly.
- **Radix portals escape the shell** — no font, no reduced-motion block, no focus
  ring. Portalled content carries `font-sans` and `motion-reduce:` itself.
- **`items-center` on a flex column collapses children to their content box.**
  It cost the 68px rail an 18×44 hit area. Keep children full width.
- **An audit or test that greps raw source flags its own documentation.** Strip
  comments first — every rule here is documented inside the file it governs.
- **A wrong value in `tokens.json` propagates perfectly.** Generation makes it
  consistent everywhere. Only the visual pass catches that class.
- **`text-align` is inert on an inline box.** Assert the rendered result — shared
  right edges — never the declaration.
- **Motion reads `initial` once, at mount — and `useReduced()` is true at
  mount.** A primitive that keeps one element across the post-hydration flip
  and only swaps its `initial` object stays on the reduced snapshot for ever:
  the entrance runs as a bare fade and its documented transform never
  happens, with nothing failing. Rest the element on `animate` (or a resting
  variant label) that mirrors the full hidden state, as `Reveal`, `Stagger`
  and `NodeLock` do since 2026-09-06; `motion-hydration-gate.test.tsx` guards
  it. A primitive that swaps its whole tree on the flip (`TextBlurIn`,
  `LineReveal`) is not affected, which is why the hero was fine and every
  card, cell and check beneath it was not.
- **An entrance that belongs to the page's timeline is `on="load"`, not a
  lower `amount`.** `whileInView` cannot fire for an element the fold only
  shows a sliver of; the hero's frame sat invisible until a scroll and then
  rose while `ScrollSettle` flattened it. `Reveal`, `Stagger` and `CountUp`
  rest until the preference resolves and then run their `delay` — the
  prototype's `.35 / .7 / .9 / .8 s` (2026-09-06).
- **A re-measure that unmounts and re-mounts across a frame paints the
  in-between.** `LineReveal`'s `fonts.ready` re-measure painted the bare
  headline for one frame before the lines rose. Both updates now go through
  `flushSync` inside the callback (2026-09-06).
- **A Motion wrapper on `display: contents` never intersects.** A
  `Stagger`/`Reveal`/`StaggerItem` given `className="contents"` has no box, so
  IntersectionObserver never fires and its `whileInView` never runs — the hero
  pills and the compare checks stayed hidden for a whole slice.
  `apps/landing/tests/motion-parity.test.tsx` («motion wrappers are boxes»)
  scans for it.
- **QA hooks are `data-*` attributes, never class names, and an assertion names the
  contract, not the markup.** A class rename during a restyle once turned a whole
  audit into a no-op, and an assertion that fires on a correct change teaches you
  to edit the assertion. *[Moved 2026-09-14 (DEV-007) from `.interface-design/system.md` §8.]* Class hooks older than the ruling remain: `apps/landing/qa/landing.mjs` queries `.beam`, `.pulse-dot` and `.flow-dash`, and `apps/app/qa/field.mjs` `[class*="bg-status-"]`; a new hook is a `data-*` attribute.

---

## 9. What "clean" means here

Not a mood. Six commitments, and they are what the references were measured for.

**Structure is a 1px line.** Folio carries 180 borders to 8 real shadows. If a
thing needs separating, separate it with `border-line` and a step between
`bg-canvas` and `bg-surface`. Reach for elevation only when something genuinely
covers content.

**One focal thing per fold.** One product frame, one signal action, one figure at
`text-display`. Two focal points is none.

**Density is a decision, not a default.** The register is read all day by someone
reconciling a period. Chrome that does not earn its height is a row that did not
fit — the shell already spends its budget down to 237px before the first row.

**Typography does the work.** One serif for display, Inter for everything else,
mono for indices. Four weights: 400 / 510 / 590 / 680. Every figure tabular and
right-aligned, because 620/620 and 180/150 must differ in *shape*.

*[Correction, 2026-09-05: Onest for display and everything else, JetBrains
Mono for indices; the serif is retired. Weights 400 / 500 / 600 / 700.]*

*[Correction, 2026-09-22 (DEV-028): Hanken Grotesk for display and everything
else, with Commissioner behind it for Cyrillic — Hanken carries none — and
JetBrains Mono for indices. The weights are unchanged. Figures are tabular
because Hanken's digits are one width, not because a feature is asked for.]*

*[Correction, 2026-09-05, later the same day: Onest on the field client too —
`apps/app` has one stylesheet, `app/globals.css` on `@goproceed/ui/base.css`;
the legacy sheet and its Inter are gone.]*

**The signal is rationed.** Lime is the next action or a verified state, never
decoration, never a second button on the same screen, never above 5% of a
viewport. It is the only colour in the product that means something specific.

*[Correction, 2026-09-05: the signal is cobalt, not lime — the same ration
applies.]*

*[Correction, 2026-09-22: the signal is ember (#FF5B04), the brand's secondary,
and it carries ink rather than white. The same ration applies, and the brand's
primary — pine — is not under it: pine is text-safe and carries the links, the
focus ring and the ornaments.]*

**Motion is a consequence, not an entrance.** Something moves because a state
became durable — evidence was accepted, a stage closed, a line connected. A
section that animates because it is a section is decoration, and decoration is
what this product's audience reads as a toy.

The one permitted ornament is the dashed blueprint guide, and only because on a
construction-evidence product a drawing sheet is not ornament.
