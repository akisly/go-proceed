# GoProceed internal dashboard — design system

Source of truth for every rewritten `/app/**` route. Values here are decided,
not suggested: if this file names a number, use that number.

Scope is the **internal** application only. `/`, `/pilot`, `/roadmap`,
`/legal/*` and most of `/demo` render from the frozen `apps/demo/src/styles.css`
and are out of scope. Do not restyle them.

---

## 1. Who this is for, and what it must feel like

**The human.** A construction estimator or project engineer closing a reporting
period on a residential development. They read this in two postures, and both
are real:

- at a desk, reconciling a register against evidence, needing the whole period
  in one fold;
- on a phone on site — outdoors, one hand, often gloved — needing one row's
  money and state at arm's length.

**The task.** Find what is blocking the close, and how much money it is holding.
Everything else on screen is in service of that sentence.

**The feel.** A precise commercial instrument. Calm, legible, consequential. Not
a blue CRM, not a toy AI interface, not an accounting program (doc 05 §1).

**Consequence for the design.** Money and readiness lead. Chrome recedes and is
measured — every pixel of it is a row that did not fit in the fold.

---

## 2. Direction

The Evidence Atlas: Carbon, Paper, Lime, Slate. **Already approved — do not
re-litigate the palette, the Manrope/Inter pairing, or the surface budget.**

Surface budget (doc 05, binding): Paper/White 74–78%, Carbon 17–21%, **Lime ≤5%**.

That budget is why the rail is dark. A 240px rail at 1440px is a measured 16.7%
of width, full height — the rail *is* the Carbon allocation, not an extra
helping of it. Removing it would leave Carbon at ~2% and break the direction as
surely as adding a second dark region would.

Lime is the action colour and **nothing else**. It is never "you are here", never
decoration, never a second button on the same screen. There is exactly one Lime
fill in the product: the `/pilot` CTA at the foot of the rail.

---

## 3. Tokens

All in `apps/demo/src/styles/theme.css`. Every value already exists in
`prototype/src/styles.css` — verified, not assumed.

**Hard rule: no colour may be introduced.** `qa/colour-audit.mjs` fails the build
on any colour outside the frozen palette, in hex, `rgb()`, `hsl()`, `oklch()`,
`oklab()`, or a Tailwind arbitrary value. Do not add a colour to make a component
look right — pick from the approved set or reconsider the component.

The stock Tailwind `--color-*`, `--font-*`, `--radius-*`, `--text-*`,
`--breakpoint-*` and `--shadow-*` namespaces are cleared to `initial`. If a
utility resolves to nothing, that is the system working: there is no `text-sm`,
no `lg:`, no `shadow-md`, no `bg-blue-500`. `--spacing` is deliberately kept —
its 0.25rem base *is* doc 05's 4px grid.

### Text — four levels, never two

| Token | Use |
|---|---|
| `foreground` | values, titles — the thing being read |
| `foreground-secondary` | supporting copy |
| `foreground-muted` | metadata, labels |
| `foreground-subtle` | metadata only, **never body text** |

### The rail has its own five

`rail`, `rail-foreground`, `rail-muted`, `rail-hover`, `rail-line`. Separate from
the Carbon text tokens because the rail inverts the contrast relationship —
everything there is measured against Carbon, not Paper. Measured: foreground
12.44:1, muted 8.18:1.

### Type scale — 1.2 minor third from a 13px data base

`micro 11 · meta 12 · data 13 · body 15 · h3 18 · h2 22 · h1 26`

`micro` is **banned on `/app` and `/app/work`** — the QA harness fails any
element under 12px there, and a register read all day should not carry 11px.

### Density — decided once, in the base layer

`.goproceed-app` sets `font-size: 15px` below 768px and `13px` at and above it.
Anything that is just "text" **inherits**. Explicit `text-*` utilities are for
deliberate steps away from the body — a heading, an eyebrow, the focal figure —
**never** for restating the default at a second breakpoint. If you find yourself
writing `text-body md:text-data`, the base layer already did it.

### Spacing — 4px grid

Base unit 4px (`--spacing`). Common steps 8/12/16/24/32/48. No off-grid values.

### Radii

`control 6px` (buttons, inputs, chips) · `panel 10px` (cards, panels) ·
`pill 999px` (status chips, indicators). A register is not a set of cards —
these are small on purpose.

### Depth — borders, one strategy, committed

doc 05: *borders carry most structure; shadows are shallow.* So there is **no
elevation ladder**. Structure comes from a 1px border and a lightness shift
between `background` / `surface` / `surface-muted` / `surface-sunken`.

Exactly two shadows exist, both for surfaces that genuinely leave the page:

- `shadow-raised` — popover-class chrome one step off its parent (tooltip)
- `shadow-drawer` — the off-canvas rail, the only thing that covers content

Do not add a third. Do not put a shadow on a panel.

### Motion

`--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1)`. Ease-out only, never
ease-in — ease-in stalls the first frame, which is the frame being watched.

- press feedback `active:scale-[0.98]`, instant
- colour transitions 150ms
- drawer 200ms, transform only
- tooltip/popover 150ms, `animate-chip-in` (opacity + `scale(0.96)` → none)

Never animate from `scale(0)`. Only `transform` and `opacity`. Never
`transition: all`. `prefers-reduced-motion` is honoured unlayered, so it beats
everything including the frozen sheet.

---

## 4. Layout

### Breakpoints — exactly two, because the shell has exactly three states

| | rail |
|---|---|
| `< md` (768px) | off-canvas drawer, `min(300px, 84vw)`, behind a ≥44px control |
| `md … wide` | collapsed to **68px**, icons only, labels in a tooltip |
| `≥ wide` (1240px) | **240px**, labels visible |

There is no `sm:`/`lg:`/`xl:`. A typo fails loudly instead of silently targeting
a width this design never reasons about.

### Proportion

240px rail against an otherwise unconstrained content column. That number states
the relationship: navigation **serves** the register, it is not its peer.

Content measure caps at **1240px** (doc 05). At the 1440px audit viewport the
column is 1200px, so the cap does not bite there — it only stops the register
stretching on a wide monitor.

### Chrome budget

There is no desktop top bar. The brand lives in the rail; a second 76px band
repeating it is 76px not spent on rows. The mobile bar (56px) exists only below
`md`, because that is the only width where the rail is hidden.

Measured at 1440×900:

| | before | after shell | after register |
|---|---:|---:|---:|
| `/app/work` chrome before first row | 357px | 271px | **237px** |
| rows visible in a 900px fold | 10 | 11 | **14 — all of them** |
| `/app` chrome before first data | 274px | 147px | **183px** |

`/app`'s figure went back up by 36px and that is the right trade: the total now
sits inside a real panel with its honesty qualifier beside it, instead of being
loose text on the page background. The register is the surface where every pixel
above the fold is a row; the dashboard is not.

---

## 5. Components

`src/components/ui/*` is shadcn-shaped and shadcn-sourced, restyled onto the
tokens above. `components.json` is real and the `@/` alias resolves, so
`npx shadcn add …` works — but **`shadcn init` was never run and must not be**:
it rewrites the theme block in oklch and imports Preflight, and both would be
caught by the colour guard only after doing damage.

**Install only what earns its place.** An unused variant is the first thing to
drift.

### Button — `src/components/ui/button.tsx`

Variants: `primary` (Carbon) · `signal` (Lime, one per screen) · `outline`
(the workhorse) · `ghost` (chrome) · `link` (inline).

No `destructive` variant: nothing under `/app/**` deletes anything, so it could
only ever be used by being reached for wrongly.

No focus ring in the variants: `theme.css` gives every focusable element inside
`.goproceed-app` one treatment (Slate outline + Lime halo), matching the public
routes so the two cannot disagree.

Sizes carry **two numbers**, and the small one is never below 44px:

| size | phone | desk |
|---|---|---|
| `default` | 44px h, 16px pad | 36px h |
| `sm` | 44px h, 12px pad | 32px h |
| `icon` | 44×44 | 36×36 |

WCAG 2.5.5's 44px is a floor, not a preference, and the phone audience is gloved
and outdoors. The variants only diverge at the desk.

### Rail nav item

`min-h-11 · rounded-control · px-3 · gap-3 · font-medium`, full width of the rail
content box at every breakpoint. Active = `bg-rail-hover` + `text-surface` + a
3px Lime bar, **absolutely positioned** so the label does not shift sideways as
you navigate.

> Measured trap: `items-center` on the rail collapsed every child to its content
> box, giving an 18×44 hit area at the 68px width. Children stay full width and
> centre their own content with `md:justify-center`.

### Tooltip — `src/components/ui/tooltip.tsx`

Earns its place in exactly one situation: the 768–1240px icon rail. Mounted only
in that range — a tooltip on a visible label is noise. The label stays in the DOM
at every width (`sr-only` in the icon range), so the accessible name never
depends on the tooltip.

**Carbon means chrome.** The disclosure strip, the rail and the tooltip are the
three Carbon surfaces, and they are the same thing: the application talking about
itself. Content surfaces are Paper and White, without exception.

### Panel — `src/components/Panel.tsx`

The one content surface: White on Paper, 1px border, `rounded-panel`, **no
shadow**. `PanelHeader` gives it an `<h2>` and an optional count on one
baseline. Everything that reads as "above the page" is chrome, and chrome is
Carbon — content stays flat.

### WorkRegister — `src/components/WorkRegister.tsx`

Three renderings, matching the shell's three states:

| width | rendering |
|---|---|
| `≥ wide` | 6-column `<table>`, `table-fixed` — 28/21/10/10/15/16 |
| `md … wide` | same table, quantity columns dropped — 30/24/20/26 |
| `< md` | cards, each leading with the amount and the state |

**Not one DOM with CSS.** Changing `display` on table elements strips their
implicit ARIA roles, so the "responsive table" trick forces you to hand
`role="table"/"row"/"cell"` back and maintain an invisible second copy of the
semantics. And the card view is not a reflow — it is a different hierarchy
(RULING 6: the phone leads with money and state; the desk leads with identity).

**`table-fixed` is the fix for the fourteen-grids defect.** Column geometry is a
property of the element now, not something to maintain. Never reintroduce a
per-row grid.

**Numeric columns are right-aligned.** That is what makes a shortfall scannable:
620/620 and 180/150 differ in *shape* when their digits share a right edge.

Widths are measured against the real longest content — «Секція А · підвал ·
електрощитова ВРУ-1», «Внутрішньо готово», «620 м» — never guessed. The two
quantity columns are 10% because their *header* is the binding constraint, not
their figure; at 9% they collided into «ЗАПЛАНОВАНОЗАФІКСОВАНО».

Row: `px-3 py-2.5`, `border-b border-border-strong`, `hover:bg-surface-muted/60`.

### SegmentedFilter — `src/components/SegmentedFilter.tsx`

Chips, `h-11 md:h-8`, scrolling horizontally rather than wrapping.

Radix Select would be far more compact for eight options and is the **wrong**
control: this demo's claim is that it covers the state catalog honestly, and a
dropdown hides that catalog behind a click. The visible option set is content.

`aria-pressed` buttons, not `role="tab"` — these filter a list in place; there is
no `tabpanel` to promise.

### MoneySummary — `src/components/MoneySummary.tsx`

The only 32px thing on any screen. Three levers at once: label 12px uppercase
tracked muted, figure `text-display`/600/Carbon/tabular, denominator muted body.

**The qualifier is not decoration.** `src/domain/risk.ts` sets a wording rule for
every surface consuming this number — it is money whose evidence is currently
missing, not money that will certainly go unpaid, and the phrasing stays
conditional. The eyebrow is the `<h2>`; naming the panel with `aria-label` and
adding an `sr-only` heading says the same thing twice.

### ReadinessSplit — `src/components/ReadinessSplit.tsx`

A proportional bar over a fully labelled legend. Segments use `flex-grow: count`
rather than percentages, so they always consume exactly the track — the parts
cannot fail to equal the whole. The bar is `aria-hidden` and carries no
information of its own; every state is named in its canonical `ui_uk` label
below it, so this is never colour-as-sole-signal.

### Separator — `src/components/ui/separator.tsx`

Radix, so `decorative` is a decision at the call site rather than an accident. A
hand-rolled `h-px bg-border` is either always announced or never announced.

---

## 6. Traps that already cost a round

1. **Unlayered CSS beats every layer.** The frozen sheets used to be bare
   `import`s in `main.tsx`, which made `a { color: inherit }` beat every `text-*`
   utility and `button,input,select { font: inherit }` beat every font-size
   utility — silently. They are now imported by `theme.css` as `layer(legacy)`,
   and the order is `legacy, theme, base, components, utilities`. Keep it. Do not
   add a bare CSS import to `main.tsx`.

2. **`!important` inverts layer order** — the *lowest* layer wins. That is why
   the `prefers-reduced-motion` block is deliberately unlayered: in `base` it
   would lose to the frozen sheet's own `!important` rules.

3. **tailwind-merge has to be taught this theme.** `text-data` is not a t-shirt
   size, so stock tailwind-merge files it as a *colour*, decides it conflicts
   with `text-foreground`, and drops one of them. `src/lib/utils.ts` overrides
   the `font-size`, `font-family`, `rounded` and `shadow` groups. Extend it when
   the theme gains a namespace.

4. **Radix portals escape `.goproceed-app`.** Portalled content gets none of the
   shell's base layer — no font, no reduced-motion block, no focus ring. Anything
   that portals must carry `font-sans` and `motion-reduce:` itself.

4b. **Never pass a function-valued `className` or `children` into a Radix
   `asChild`.** react-router's `NavLink` accepts both as functions of
   `{ isActive }`; Radix's `Slot` merges `className` by *string concatenation*,
   so it stringifies the function into the class attribute. React does not warn
   and TypeScript cannot see it — both prop types are individually valid.

   It shipped. And it half-worked, which is why it survived screenshots and a
   bounding-box probe: a class attribute is a token list, and most Tailwind
   names inside the stringified source are still valid tokens. Only the ones
   touching a quote or comma were dropped — including *both* branches of the
   active/inactive colour ternary, so the active nav item silently lost every
   colour cue while the layout still looked right.

   Resolve state yourself (`useResolvedPath` + `useMatch`, `end: false` matches
   NavLink's default) and pass plain strings. `qa/verify.mjs` now fails any
   route whose DOM carries a class attribute containing `=>`, `function`, `{`
   or `;`.

5. **Never write a literal Tailwind class string in a test.** Tailwind v4 scans
   the whole project and does not distinguish tests from UI; it will emit test
   fixtures as real CSS into the production bundle. Assemble fixtures at runtime.

6. **Measure the rendered element.** Specificity collisions are silent, and
   `text-align` is inert on an inline box — an assertion passed while the money
   column was visibly ragged. Assert the *result* (shared right edges), never the
   declaration.

7. **`items-center` on a flex column collapses children to their content box.**
   It cost the 68px rail an 18×44 hit area where 36×44 was intended. Keep
   children full width; centre their own content with `justify-center`.

8. **Ukrainian has three plural forms and the teens are the trap.** 11–14 take
   the genitive plural despite ending in 1–4. Use `pluralUk`/`rowsUk`
   (`src/domain/format.ts`), never `${n} рядків`. There has been no
   native-speaker review of this product's copy, so grammar rules get encoded
   and tested rather than eyeballed.

---

## 7. Who owns what CSS

| file | owns | may it be edited? |
|---|---|---|
| `src/styles.css` | the approved design system | **never** — byte-identical to `prototype/src/styles.css`, test-enforced |
| `src/styles/demo.css` | public routes only (`/`, `/pilot`, `/roadmap`, `/legal/*`, `/demo`) | yes, for public routes |
| `src/styles/theme.css` | tokens, layer order, the `.goproceed-app` base | yes |
| Tailwind utilities | everything under `/app/**` | — |

`/app/**` has **no** hand-written CSS. If an internal component needs a rule that
utilities cannot express, it belongs in `theme.css`'s `base` layer with a reason,
not in `demo.css`.

The checkpoint-4 pass removed 546 lines from `demo.css` — every rule describing
a DOM that no longer exists (`.work-row*`, `.work-table*`, `.sidebar*`,
`.app-frame`, `.app-header`, `.app-footer`, `.filter-bar`, `.segmented`,
`.search-box`, `.empty-state*`, `.evidence-risk*`, `.rules-page*`). Two systems
both claiming to own the touch-target floor or the type floor is how one of them
quietly stops being true.

Equivalence on the public routes was proven, not assumed: every computed
property of every element and pseudo-element on `/pilot` (240 rows) is identical
before and after, as is all geometry.

## 8. Testing split

Adding jsdom is not approved.

- Semantic/behavioural assertions → **vitest** (`environment: "node"`).
- Rendered layout, contrast, viewport, touch targets → **`apps/demo/qa/verify.mjs`**
  (puppeteer, pinned 1440×900 desktop and 360/390 narrow passes).

QA hooks are `data-*` attributes, never class names. A class rename during a
restyle used to turn a whole audit into a no-op. And an assertion must name the
**contract** ("the focus cycle closes"), not the current markup ("focus lands on
`.sidebar__close`") — an assertion that fires on a correct change teaches you to
edit the assertion.

**Every viewport in the contract needs a pass.** The harness pinned 1440
(shipped routes), 390 (touch targets) and 360 (focus trap) — and the 768–1240px
icon rail, a documented state of the shell, had none. That is precisely where a
defect shipped, because the tooltip that triggered it only mounts in that range.
`auditIconRail` closes it: rail width, exactly one `aria-current="page"`, labels
visually hidden, no source code in any class attribute, and — the assertion that
would actually have caught the bug — **at least two distinct link colours**, so
"you are here" cannot silently become invisible.
