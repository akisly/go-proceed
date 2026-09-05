# Building UI in GoProceed

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-08-19

**Related decisions:** None yet. The rulings this procedure enforces are D1–D7
in the [rewrite plan](./2026-08-19-design-system-rewrite-plan.md) §3, which need
an ADR before Phase 3.

**Surfaces:** `apps/landing`, `apps/app`, `packages/ui`, `packages/tokens`

**Type:** Procedure. Under `docs/README.md`'s precedence this ranks as target
design — it governs *how* a surface is built. It never overrides an ADR, the
applied database, or the product scope.

**Companions — one level deep, do not chain further:**
[`01-tokens.md`](./01-tokens.md) — the values, generated ·
[the rewrite plan](./2026-08-19-design-system-rewrite-plan.md) — the reasoning.

---

## 0. Read this when

Any change under `apps/landing/**`, `apps/app/app/**`, `packages/ui/**` or
`packages/tokens/**`. Also when reviewing one.

Not for backend, migrations, or `apps/demo/**` (frozen until D5).

---

## 1. The model, in one paragraph

Three layers. **A component names a ROLE, never a value.** `bg-canvas`, not
`bg-neutral-25`, and never `bg-[#FBFBF9]`. Roles live in
`packages/tokens/src/tokens.json`, reach CSS through seven generators, and reach
Tailwind through `@theme inline`. Ramp steps are deliberately unreachable as
utilities — `bg-neutral-200` does not compile — and a raw `var(--gp-neutral-200)`
fails a test. Everything else in this document follows from that sentence.

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
- [ ] 6 VERIFY   superpowers:verification-before-completion, then say done
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
   are building one.

**Do not read** `apps/demo/src/styles.css`. It is a frozen 156 KB prototype
sheet with the superseded palette, and reading it teaches you values that now
fail the colour audit.

### 3.2 Skills

**Use, and when:**

| Skill | When | Why this one |
|---|---|---|
| `superpowers:brainstorming` | before any new block or component | Repo `CLAUDE.md` already mandates it. The question it forces — *what is this for* — is the one that stops a component being built twice |
| `superpowers:writing-plans` | 3+ steps, or touching more than one package | |
| `superpowers:test-driven-development` | anything with a contract: a token, a variant set, an audit rule | Every rule in this system is a test. Writing the test first is not ceremony here, it is the deliverable |
| `superpowers:systematic-debugging` | a gate fails and the cause is not obvious in 60 seconds | |
| `superpowers:verification-before-completion` | **always, before saying done** | Evidence before assertions. §5 is the evidence |
| `superpowers:requesting-code-review` | before merging a block or a component | |
| `design-taste-frontend` | composing a **landing** block's visual arrangement | Anti-slop, contextual, and it says outright it is *not* for dashboards or data tables — so it never touches `/app` |
| `image-to-code` | a landing block whose composition you cannot picture | Image-first: generate the section reference, then implement it. Use for hero/CTA composition only |
| `redesign-existing-projects` | Phase 4, restyling `apps/app` | Audit-first, improves in place rather than rewriting — which is the constraint on `/app` |
| `claude-in-chrome` | the §6 visual pass | The only way to actually see the six viewports |
| `dataviz` | before the first line of any chart | The token source already carries `viz-1`…`viz-5`; read the skill, then use those roles |

**Do not use, and why:**

| Skill | Why not |
|---|---|
| `high-end-visual-design` | Its "Variance Mandate" is *never generate the same layout twice*. A design system's entire value is that the same decision produces the same result. Directly opposed |
| `minimalist-ui` | Bans Inter. This product's UI face **is** Inter, chosen for Cyrillic and tabular figures |
| `brand-guidelines` | Applies *Anthropic's* brand |
| `web-artifacts-builder` | For claude.ai artifacts, not a Next app |
| `figma:*` | Figma is deferred (plan §3). The DTCG file generates and waits |

`impeccable` is the judgement call: it overlaps this document heavily. Reach for
it only for a **critique pass on a finished block**, never to decide structure —
structure is decided here.

### 3.3 Three questions, answered before the first line

1. **Which surface?** `apps/landing` is greenfield and may use the marketing
   scale, `radius-card`/`surface`/`section`, and `shadow-float`. `apps/app` may
   use none of those: it is dense, its type scale is the product scale, and
   nothing floats off the page.
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
| `bg-[#FBFBF9]`, `bg-neutral-25` | `bg-canvas` | Does not compile; the ramp is not in the utility namespace |
| `var(--gp-neutral-600)` | `var(--gp-text-muted)` | `primitive-leak.test.ts` fails |
| `text-sm`, `text-lg` | `text-data`, `text-h3` | Stock namespace is cleared; resolves to nothing |
| `lg:`, `xl:`, `sm:` | `md:`, `wide:`, `rail-icons:` | A typo fails loudly instead of silently targeting a width this design never reasons about |
| `h-11`, `h-9` on a control | `h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch)` | `component-contract.test.ts` fails; the literal stops tracking the token |
| `shadow-md`, a shadow on a panel | nothing — use `border border-line` | Structure is border-led. Folio ships 180 borders to 8 shadows |
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
| `text-accent` on body copy | `text-accent` only inside a display heading | It clears 3:1, not 4.5:1 — large text only |
| `h-11` on a marketing control | `size="lg"` on `Button`; `h-(--gp-control-height-marketing)` on an input | The literal stops tracking the token |
| a lime fill, `bg-signal` as decoration | `bg-action-signal` on at most one action, or ink | The mark is cobalt since 2026-09-05 and the landing uses none |

### 4.2 Where code goes

```
packages/tokens/src/tokens.json      every value, the only hand-edited token file
packages/ui/src/base.css             the one hand-written stylesheet: variants, base, @utility
packages/ui/src/*.generated.*        NEVER EDIT — regenerate (§7.1)
packages/ui/src/motion/              the sixteen motion primitives, and nothing else
packages/ui/src/components/          the twenty-one components, and nothing else
apps/landing/app/                    routes and the fourteen landing blocks
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
   perpetual animation but the marquee → `motion-audit` 1–4
6. No hard-coded control height, no inline-style colour, no raw hex, no
   per-component focus ring, no `destructive` button variant → `component-contract`
7. No literal Tailwind class string inside a test — assemble at runtime, or
   Tailwind emits your fixture as production CSS
8. Reduced motion is a **different** animation, never a faster one
9. At most two scroll-linked elements per page, and never in one fold
10. At most one `bg-action-signal` per screen *(corrected 2026-09-05: was «exactly one»; the Daylight landing's primary is ink and carries none)*

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
  `pnpm validate:canonical-docs` in `.github/workflows/ci.yml`.
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
third obligation as a rule you keep by hand.

Take `className` last and merge with `cx()` — never string-concatenate. And
never pass a function-valued `className` or `children` into a Radix `asChild`:
Slot merges by string concatenation, so the function is stringified into the
class attribute. React does not warn and TypeScript cannot see it.

### 7.3 A new motion primitive

Not an addition — a decision. It means the vocabulary was missing something, so
the plan's §8.3 has to say what and why in the same change. The test that fails
is the prompt to write that down.

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

**The signal is rationed.** Lime is the next action or a verified state, never
decoration, never a second button on the same screen, never above 5% of a
viewport. It is the only colour in the product that means something specific.

*[Correction, 2026-09-05: the signal is cobalt, not lime — the same ration
applies.]*

**Motion is a consequence, not an entrance.** Something moves because a state
became durable — evidence was accepted, a stage closed, a line connected. A
section that animates because it is a section is decoration, and decoration is
what this product's audience reads as a toy.

The one permitted ornament is the dashed blueprint guide, and only because on a
construction-evidence product a drawing sheet is not ornament.
