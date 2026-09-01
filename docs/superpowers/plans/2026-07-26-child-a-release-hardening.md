# Child A Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every accepted release blocker and high-value pre-release fix from
`docs/reviews/child-a-final-hardening/07-consolidated-findings.md` so `apps/demo` can be shown to
real Ukrainian electrical subcontractors.

**Architecture:** Three kinds of change, deliberately separated. Pure logic (the single at-risk
definition) moves into `src/domain/` where vitest can test it. Presentation changes go to
`src/styles/demo.css` only — `src/styles.css` is frozen. Rendered behaviour, sizes and contrast
are asserted in `apps/demo/qa/verify.mjs`, because vitest runs `environment: "node"` with no
jsdom and cannot render a component.

**Tech Stack:** React 19, react-router-dom 7.18.1, Vite 8, TypeScript 5.9 (strict), vitest 3.2,
puppeteer 24.10 (dev), lucide-react 1.25. Plain CSS — no Tailwind, no component library.

## Global Constraints

Copied from the consolidated findings and the project's fixed constraints. Every task inherits these.

- **`apps/demo/src/styles.css` must never be modified.** A test asserts it stays byte-identical to `prototype/src/styles.css`. All CSS goes in `apps/demo/src/styles/demo.css`.
- **No literal hex absent from `prototype/src/styles.css`.** A test enforces this. Prefer `--ink`, `--paper`, `--signal`, `--signal-dark`, `--line`, `--muted`, `--amber`, `--red`.
- **Never modify `prototype/`, `technical/`, or `design-references/`.** Any of these is a Critical failure.
- **No new dependencies**, with two explicitly approved exceptions: **Tailwind CSS and shadcn/ui** may be introduced where they provide a clear benefit for an accepted finding. Their use is **not mandatory**, and the assessment below concludes they are not adopted in this plan. Everything else remains barred — no charting library, no jsdom, no axe-core.
- **Testing split is fixed** (verified: `vitest.config.ts` sets `environment: "node"` and jsdom is not installed):
  - **Semantic and behavioural assertions belong in Vitest** — pure functions, label conformance, formatters, domain predicates.
  - **Rendered layout, contrast and viewport assertions belong in `apps/demo/qa/verify.mjs`** — anything requiring a real DOM, computed styles, or a viewport. Vitest cannot render a component in this project.
  - Adding jsdom to move rendered assertions into Vitest is **not** an approved exception.
- **Evidence Atlas direction is fixed** (`docs/05-design-system.md`): Carbon `#171717`, Paper `#FBFBFB`, Lime `#C6FF34`, Slate, Amber, Red; Manrope Variable 700–800 display, Inter Variable 400–700 body; surface budget Paper/White 74–78%, Carbon 17–21%, **Lime ≤5%**.
- **Readiness labels come from `technical/state-catalog.csv` byte-for-byte** and may not be reworded. Use `READINESS_LABEL_UK`.
- **Route scope is fixed.** The ten shipped routes in `apps/demo/qa/routes.mjs` do not change. No new route, no route removed.
- **Child A scope:** no backend, Supabase, authentication, RLS, offline support, real billing, Child B, Phase 2.
- **Strict TS:** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. No `any`, no non-null assertions.
- **All UI text Ukrainian**, apostrophes U+2019 (’). Never introduce a real company name or a person's name into synthetic data; the dataset uses the «Приклад-*» convention.
- **After every task:** `pnpm --filter @aktflow/demo qa` exits 0 **and** `git status --porcelain` prints nothing. That regression guard is the whole point of the harness.
- **Do not add motion.** Report 04 found the motion system correctly restrained; findings L1–L4 are deferred and out of scope here.

## Specialized skills — where they apply, and where they do not

Assigned only where genuinely useful, per the instruction.

| Skill | Verdict | Reason |
|---|---|---|
| **Impeccable `adapt`** | **Use — Task 7** | Responsive and touch-target work (I5, I6) is exactly its scope. |
| **Impeccable `harden`** | **Use — Task 8** | The `mailto:`-only delivery path (I3) is an edge-case/failure-path hardening problem. |
| **shadcn/ui + Tailwind** | **Approved as an exception, assessed, and declined for this plan** | No accepted finding requires them, and adopting them would silently disable the palette guard. Full assessment in the next section — this is a reasoned decision against an available option, not an unavailable one. |
| **emil-design-eng** | **Do not use in this plan** | Its scope is interaction and motion craft. Every motion finding (L1–L4) is deferred Low and excluded here. Introducing motion work would contradict report 04's conclusion that the system is already correctly restrained. |

## Tailwind CSS and shadcn/ui — assessment and decision

Both are explicitly approved exceptions to the no-new-dependencies rule. They were assessed
against the six required criteria and **not adopted**. The decision is reversible; §"What would
change this decision" states exactly what would flip it.

### The finding-by-finding test: does any accepted finding need them?

This is the first question, because the approval is conditional on "a clear benefit for an
accepted finding."

| Finding | Nature of the fix | Needs Tailwind/shadcn? |
|---|---|---|
| B1 header contrast | two colour overrides in `demo.css` | No |
| B2 at-risk definition | pure TypeScript module + unit tests | No |
| B3 readiness arithmetic | derive over states in `App.tsx`, reuse existing `StatusChip` | No |
| A1/A2/A3 header region | JSX relocation + layout CSS | No |
| B-i/B-ii/B-iii money | `font-variant-numeric`, alignment, type scale | No |
| I1 desktop type floor | three selectors in `demo.css` | No |
| I2 `/pilot` reciprocity | Ukrainian copy | No |
| I3 mailto fallback | one button + a `role="status"` message | **Only candidate — see below** |
| I4 evidence scannability | markup restructure + CSS | No |
| I5/I6 touch + density | media-query CSS | No |
| I7 rules measure | one `max-width` rule | No |

**I3 is the only candidate, and it fails on the stated constraints.** The copy control would use
shadcn's `Button`; the confirmation would use its `Toast`/`Sonner`. Both are barred here:

- `.button--outline` already exists, is styled to the Evidence Atlas, and works. The instruction
  says **do not replace working components merely for consistency**.
- A toast contradicts this codebase's established status pattern — persistent inline banners with
  `role="alert"` / `role="status"` that remain until resolved and never clear input. Report 05
  called those banners "exemplary"; report 07 lists them among the strengths that must survive.
  Swapping in an auto-dismissing toast would be a regression, not an upgrade.

**Result: zero accepted findings benefit.** Fourteen of sixteen are CSS or copy; two are pure
TypeScript. Adopting a utility framework and a component library to fix them would add
infrastructure that no task uses.

### 1. Can they be introduced incrementally?

**Tailwind: technically yes.** Vite supports it via PostCSS, and `corePlugins: { preflight: false }`
would stop its base reset fighting the 2,110-line frozen stylesheet. Utilities would coexist with
existing class names.

**shadcn: not meaningfully.** Its components are authored against its own token contract
(`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, `--radius`). Those
tokens must exist before the first component renders correctly, so the "incremental" unit is the
whole theme layer, not one component.

### 2. Exact packages and configuration files required

- **Tailwind:** `tailwindcss`, `@tailwindcss/postcss` (v4) or `postcss` + `autoprefixer` (v3);
  `tailwind.config.js`, `postcss.config.js`; `@tailwind` directives added to a stylesheet.
- **shadcn:** additionally `class-variance-authority`, `clsx`, `tailwind-merge`,
  `tailwindcss-animate`, plus one `@radix-ui/react-*` package per interactive primitive;
  `components.json`; a `cn()` utility; a `components/ui/` directory.

Verified currently present: **none of these** (`grep -cE 'radix|class-variance|tailwind|clsx'` on
`package.json` → 0).

### 3. Impact on the existing CSS architecture

The app is 3,108 lines of plain CSS: 2,110 frozen (byte-identical to `prototype/src/styles.css`,
test-enforced) and 998 in `demo.css`. Tailwind would add a third styling layer with different
authoring rules, and every future contributor would face a per-element choice between a semantic
class and a utility string. The constraint forbids a broad migration, so the split would be
permanent rather than transitional.

### 4. Can doc 05 tokens map without creating a second design system?

**Tailwind alone: yes.** `theme.extend.colors` can point at the existing custom properties, and
Tailwind would emit no colours of its own.

**shadcn: no — and this is the decisive finding.** Its components consume *its* semantic token
names, so the project would carry two parallel vocabularies for the same palette: `--ink` and
`--foreground`, `--paper` and `--background`, `--signal` and `--primary`. That is the definition
of a second design system, which the instruction rules out.

**Worse, it would silently disable the guard that has protected the palette.** The palette check
at `apps/demo/tests/styles.test.ts:12` matches hex only:

```js
const hexes = (css) => new Set((css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map(h => h.toLowerCase()))
```

shadcn's theme is written as **HSL triplets** (`--primary: 84 100% 57%`). I verified that regex
against that format: it matches nothing. Every shadcn colour would enter the codebase invisible
to the single mechanism that has kept the Evidence Atlas palette intact across all 37 commits on
this branch. Restoring the guarantee would mean rewriting the palette test — expanding the
protected surface as a side effect of a dependency choice.

### 5. Would protected or frozen files need to change?

**No, and that is not the reassurance it appears to be.** `styles.css` would stay byte-identical
and `prototype/`, `technical/`, `design-references/` untouched. But Tailwind's cascade layer and
utility specificity would interact with 2,110 lines of frozen rules that cannot be adjusted in
response. Conflicts could only ever be resolved by piling more overrides into `demo.css` — the
frozen file's immutability turns from a safety property into a constraint that makes the
interaction harder to reason about.

### 6. Build, bundle and maintenance impact

- **Build:** adds a PostCSS pass to Vite. Current build is 331ms; the increase would be modest
  but the toolchain gains a step that can fail independently.
- **Bundle:** Tailwind's JIT emits only used utilities, so CSS growth would be small. Each Radix
  primitive adds roughly 30–50 KB before compression. Current cold transfer is **~227 KiB** against
  a 1.5 MB budget, so there is headroom — bundle size is not the objection.
- **Maintenance:** two styling systems, two token vocabularies, a weakened palette guard, and a
  `components/ui/` directory of vendored components to keep current. All to serve zero findings.

### Decision

**Keep the existing implementation approach.** Per the instruction: *"If Tailwind/shadcn cannot be
introduced without a broad CSS migration or protected-file changes, keep the existing
implementation approach instead."* No protected file would change, but the second-design-system
test (criterion 4) fails outright, and the finding-by-finding test shows nothing to gain.

### What would change this decision

Adopt them if any of these becomes true:

1. **An accepted finding requires a genuinely complex interactive primitive** — a combobox, a
   date picker, a modal with focus management. Hand-rolling those correctly is days of work and
   Radix ships them accessible. Nothing in the current sixteen findings needs one.
2. **The scope grows to include Child B or Phase 2 surfaces** that are new construction rather
   than corrections to existing screens. Greenfield surfaces carry no migration cost.
3. **The palette guard is first rewritten** to understand HSL and any other format a theme layer
   introduces, so criterion 4's failure is repaired *before* the dependency lands, not after.

If Tailwind is later wanted for authoring ergonomics alone, it can be introduced independently of
shadcn — it is the shadcn token contract, not Tailwind itself, that creates the second design
system.

## Blocked on a human decision — do not start these tasks until answered

- **Task 3 (B2)** needs the product owner to define "at risk". The task carries a stated default so it is not blocked indefinitely, but the default must be confirmed.
- **Task 9 (I2)** changes `/pilot` copy and adds a name. It cannot be written without knowing what name and what response commitment are true.

## File structure

| File | Responsibility | Tasks |
|---|---|---|
| `apps/demo/src/domain/risk.ts` | **New.** The single definition of "money at risk" and its bucket counts. Pure, testable. | 3 |
| `apps/demo/tests/risk.test.ts` | **New.** Unit tests for the above. | 3 |
| `apps/demo/src/styles/demo.css` | All presentation corrections. | 1, 4, 5, 6, 7, 10 |
| `apps/demo/src/pages/App.tsx` | Readiness split; consumes `risk.ts`. | 2, 3, 5 |
| `apps/demo/src/pages/Demo.tsx` | Step 5 package figures; consumes `risk.ts`. | 3 |
| `apps/demo/src/pages/Evidence.tsx` | Per-row risk; consumes `risk.ts`; scannable amounts. | 3, 10 |
| `apps/demo/src/pages/Work.tsx` | Money column alignment and weight. | 4 |
| `apps/demo/src/components/MoneyCard.tsx` | Card hierarchy; tabular figures. | 4 |
| `apps/demo/src/components/AppShell.tsx` | CTA relocation; active nav state. | 5 |
| `apps/demo/src/pilot/draft.ts` | Plaintext body for the copy fallback. | 8 |
| `apps/demo/src/pages/Pilot.tsx` | Copy-to-clipboard fallback; intro copy. | 8, 9 |
| `apps/demo/qa/verify.mjs` | Rendered assertions: contrast, sizes, touch targets, reconciliation. | 1, 2, 4, 6, 7 |

---

## Task 1: Landing header contrast (B1)

Highest-priority item in the review series. Three of four header links are unusable on the first
screen a recipient sees.

**Files:**
- Modify: `apps/demo/src/styles/demo.css`
- Modify: `apps/demo/qa/verify.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: a reusable `contrastRatio(fg, bg)` helper in `qa/verify.mjs` that Tasks 4 and 6 also use. Signature: `contrastRatio(rgbStringA: string, rgbStringB: string) => number`, accepting `"rgb(r, g, b)"` strings as returned by `getComputedStyle`.

- [ ] **Step 1: Add the failing assertion to the QA harness**

In `apps/demo/qa/verify.mjs`, add near the other helpers:

```js
/** WCAG relative luminance from a computed "rgb(r, g, b)" string. */
function luminance(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map(Number)
  const channel = c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2.x contrast ratio. Accepts computed "rgb(...)" strings. */
export function contrastRatio(fg, bg) {
  const a = luminance(fg)
  const b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
```

Then, in the per-route loop where `/` is visited, add:

```js
if (route === '/') {
  const header = await page.evaluate(() => {
    const bg = getComputedStyle(document.querySelector('.site-header')).backgroundColor
    const page = getComputedStyle(document.body).backgroundColor
    return [...document.querySelectorAll('.site-header a')].map(a => ({
      text: a.textContent.trim(),
      color: getComputedStyle(a).color,
      bg: bg === 'rgba(0, 0, 0, 0)' ? page : bg,
    }))
  })
  for (const link of header) {
    const ratio = contrastRatio(link.color, link.bg)
    if (ratio < 4.5) {
      findings.push(`/: header link "${link.text}" contrast ${ratio.toFixed(2)}:1 (needs 4.5:1)`)
    }
  }
}
```

- [ ] **Step 2: Run the harness and confirm it fails**

```bash
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
```

Expected: exit 1, with findings naming «Переглянути демо» at ≈1.00:1 and «Що входить» / «Чесність» at ≈1.90:1.

- [ ] **Step 3: Override the two frozen rules in `demo.css`**

Append to `apps/demo/src/styles/demo.css`:

```css
/*
 * Fix B1 (review 07). `styles.css:409-410` scope the landing header's link
 * colours to `.landing`, which in the prototype sat on a DARK hero. Task 11's
 * claim scrub removed that dark treatment but kept the class, so the rules
 * inverted: white-on-white (1.0:1) and #b9bdb9-on-white (1.9:1). styles.css is
 * frozen, so the correction lives here. --ink measures 17.93:1 on white and
 * --slate 7.0:1; both clear AA comfortably.
 */
.landing .site-header nav a {
  color: var(--slate);
}

.landing .site-header nav a:hover,
.landing .site-header nav a:focus-visible {
  color: var(--ink);
}

.landing .site-header .link-button {
  color: var(--ink);
}
```

If `--slate` is not defined in `styles.css`, use `#4c514d` — verified present in the source
stylesheet, measuring 7.24:1 on Paper. Confirm before writing:

```bash
grep -n -- '--slate' apps/demo/src/styles.css || grep -c '4c514d' apps/demo/src/styles.css
```

- [ ] **Step 4: Re-run and confirm it passes**

```bash
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
git status --porcelain
```

Expected: qa exits 0, `git status --porcelain` prints nothing.

- [ ] **Step 5: Confirm no new hex and the frozen sheet is untouched**

```bash
pnpm --filter @aktflow/demo test
git diff --exit-code -- apps/demo/src/styles.css prototype technical design-references
```

Expected: all pass, exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/src/styles/demo.css apps/demo/qa/verify.mjs
git commit -m "fix(demo): restore landing header link contrast (B1)"
```

---

## Task 2: Readiness split arithmetic (B3)

`/app` shows three chips summing to 9 beside a denominator reading «з 14 рядків». Five of fourteen
rows are unrepresented.

**Files:**
- Modify: `apps/demo/src/pages/App.tsx`
- Modify: `apps/demo/qa/verify.mjs`

**Interfaces:**
- Consumes: `READINESS_LABEL_UK`, `ReadinessState` from `src/domain/`; `PROJECT` from `src/data/project.ts`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the failing assertion**

In `apps/demo/qa/verify.mjs`, inside the `/app` route block:

```js
if (route === '/app') {
  const split = await page.evaluate(() => {
    const section = [...document.querySelectorAll('section')]
      .find(s => /Розподіл готовності/.test(s.textContent))
    if (!section) return null
    const counts = [...section.querySelectorAll('[data-readiness-count]')]
      .map(el => Number(el.textContent.trim()))
    const total = document.body.innerText.match(/з\s*(\d+)\s*рядк/u)
    return { sum: counts.reduce((a, c) => a + c, 0), denominator: total ? Number(total[1]) : null }
  })
  if (split && split.denominator !== null && split.sum !== split.denominator) {
    findings.push(`/app: readiness split sums to ${split.sum} but denominator says ${split.denominator}`)
  }
}
```

- [ ] **Step 2: Run and confirm it fails**

```bash
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
```

Expected: exit 1, `readiness split sums to 9 but denominator says 14`.

- [ ] **Step 3: Render every state present in the data**

In `apps/demo/src/pages/App.tsx`, replace the hard-coded three-state array with a derivation over
all states actually present, and tag each count for the harness:

```tsx
const READINESS_ORDER = [
  'not_started',
  'evidence_missing',
  'review_pending',
  'ready_internal',
  'overridden_ready',
  'packaged',
  'submitted',
] as const satisfies readonly ReadinessState[]

const readinessCounts = READINESS_ORDER
  .map(state => ({
    state,
    count: PROJECT.workItems.filter(item => item.readiness === state).length,
  }))
  .filter(entry => entry.count > 0)
```

Render it, keeping the existing chip component and canonical labels:

```tsx
<section aria-label="Розподіл готовності">
  <h2>Розподіл готовності</h2>
  {readinessCounts.map(({ state, count }) => (
    <p key={state}>
      <StatusChip state={state} />
      <span data-readiness-count>{count}</span>
    </p>
  ))}
</section>
```

Do **not** reword any label — `StatusChip` already renders `READINESS_LABEL_UK[state]` byte-for-byte.

- [ ] **Step 4: Run and confirm it passes**

```bash
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo typecheck && pnpm --filter @aktflow/demo lint
```

Expected: all exit 0; the split now sums to 14.

- [ ] **Step 5: Commit**

```bash
git add apps/demo/src/pages/App.tsx apps/demo/qa/verify.mjs
git commit -m "fix(demo): readiness split now accounts for all 14 rows (B3)"
```

---

## Task 3: One definition of "money at risk" (B2)

**⚠️ Blocked on a human decision.** `/app` and `/app/evidence` agree at 612 300,00 ₴
(`evidence_missing`). `/demo` step 5 reports 697 900,00 ₴ (amber tone = `evidence_missing` +
`review_pending`). Both are internally correct; neither is labelled.

**Default if unanswered — state it in the commit message and the report:** adopt
`evidence_missing` as "at risk", because it is what `/app` and `/app/evidence` already agree on
and it is the narrower, more defensible claim. `/demo` step 5 keeps its three-bucket breakdown but
stops calling the amber bucket "at risk".

**Files:**
- Create: `apps/demo/src/domain/risk.ts`
- Create: `apps/demo/tests/risk.test.ts`
- Modify: `apps/demo/src/pages/App.tsx`, `apps/demo/src/pages/Demo.tsx`, `apps/demo/src/pages/Evidence.tsx`

**Interfaces:**
- Consumes: `WorkItem`, `ReadinessState` from `src/domain/types`; `PROJECT` from `src/data/project`.
- Produces: `isAtRisk(item: WorkItem): boolean` and `atRiskTotalUah(items: readonly WorkItem[]): number`, imported by App, Demo and Evidence.

- [ ] **Step 1: Write the failing test**

Create `apps/demo/tests/risk.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PROJECT } from '../src/data/project'
import { atRiskTotalUah, isAtRisk } from '../src/domain/risk'

describe('one definition of at-risk money', () => {
  it('counts exactly the evidence_missing rows', () => {
    const rows = PROJECT.workItems.filter(isAtRisk)
    expect(rows).toHaveLength(4)
    expect(rows.every(item => item.readiness === 'evidence_missing')).toBe(true)
  })

  it('totals 612 300 UAH across the project', () => {
    expect(atRiskTotalUah(PROJECT.workItems)).toBe(612_300)
  })

  it('is the same number however it is derived', () => {
    const summed = PROJECT.workItems
      .filter(isAtRisk)
      .reduce((total, item) => total + item.valueUah, 0)
    expect(summed).toBe(atRiskTotalUah(PROJECT.workItems))
  })

  it('never counts work that has not started', () => {
    const notStarted = PROJECT.workItems.filter(item => item.readiness === 'not_started')
    expect(notStarted.length).toBeGreaterThan(0)
    expect(notStarted.some(isAtRisk)).toBe(false)
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

```bash
pnpm --filter @aktflow/demo test tests/risk.test.ts
```

Expected: FAIL — cannot resolve `../src/domain/risk`.

- [ ] **Step 3: Write the module**

Create `apps/demo/src/domain/risk.ts`:

```ts
import type { WorkItem } from './types'

/**
 * THE single definition of "money at risk" (review 07 · B2).
 *
 * Three surfaces previously disagreed: /app and /app/evidence counted
 * evidence_missing (612 300 ₴) while /demo step 5 called the amber tone bucket
 * "at risk" (697 900 ₴). Both were internally correct and neither was labelled,
 * so an estimator reconciling the two got no explanation.
 *
 * evidence_missing is the definition, because it is the narrower and more
 * defensible claim: work that is done but cannot be evidenced. Work that has not
 * started (not_started) has nothing at risk yet, and work awaiting internal
 * review (review_pending) has its evidence.
 *
 * Every surface that says «під ризиком» must call this. Do not re-derive it.
 */
export function isAtRisk(item: WorkItem): boolean {
  return item.readiness === 'evidence_missing'
}

export function atRiskTotalUah(items: readonly WorkItem[]): number {
  return items.filter(isAtRisk).reduce((total, item) => total + item.valueUah, 0)
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
pnpm --filter @aktflow/demo test tests/risk.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Route all three surfaces through it**

In `App.tsx`, replace the inline `.filter(item => item.readiness === 'evidence_missing')` with
`.filter(isAtRisk)` and the reduce with `atRiskTotalUah(PROJECT.workItems)`.

In `Evidence.tsx`, gate the «Під ризиком …» sentence on `isAtRisk(item)` so it renders only for
rows that genuinely carry risk.

In `Demo.tsx` step 5, keep the three-bucket breakdown — it is useful — but rename the amber
bucket's label away from risk language. Change «Потребує дій» to remain as-is only if it does not
say «під ризиком»; if any copy on that step says «під ризиком» for the amber figure, change it to
«Потребує дій» and add one clarifying line:

```tsx
<p className="page-intro">
  «Під ризиком» на сторінці «Огляд» — це лише рядки без доказів ({formatUah(atRiskTotalUah(PROJECT.workItems))}).
  Нижче — ширший розподіл за станом готовності.
</p>
```

- [ ] **Step 6: Verify all three surfaces reconcile**

```bash
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo typecheck && pnpm --filter @aktflow/demo lint
```

Expected: all exit 0. Manually confirm `/app` and `/app/evidence` both total 612 300,00 ₴ and that
no surface labels a different figure «під ризиком».

- [ ] **Step 7: Commit**

```bash
git add apps/demo/src/domain/risk.ts apps/demo/tests/risk.test.ts apps/demo/src/pages
git commit -m "fix(demo): single at-risk definition across /app, /demo and /app/evidence (B2)

evidence_missing is the definition. Previously /app and /app/evidence counted
612 300 UAH while /demo step 5 called 697 900 UAH at risk, with no label
explaining the difference."
```

---

## Task 4: Money rendering (Cluster B — B-i, B-ii, B-iii)

Three findings, one coherent pass.

**Files:**
- Modify: `apps/demo/src/components/MoneyCard.tsx`, `apps/demo/src/pages/Work.tsx`, `apps/demo/src/styles/demo.css`
- Modify: `apps/demo/qa/verify.mjs`

**Interfaces:**
- Consumes: `formatUah` from `MoneyCard.tsx` (unchanged signature `(value: number) => string`).
- Produces: nothing new.

- [ ] **Step 1: Add the failing assertions**

In `qa/verify.mjs`, inside the `/app/work` block:

```js
if (route === '/app/work') {
  const money = await page.evaluate(() =>
    [...document.querySelectorAll('[data-money]')].map(el => {
      const cs = getComputedStyle(el)
      return { fvn: cs.fontVariantNumeric, align: cs.textAlign, weight: cs.fontWeight }
    }))
  if (money.length === 0) findings.push('/app/work: no [data-money] elements found')
  for (const m of money) {
    if (!/tabular-nums/.test(m.fvn)) findings.push(`/app/work: money not tabular (${m.fvn})`)
    if (m.align !== 'right') findings.push(`/app/work: money not right-aligned (${m.align})`)
  }
}
```

- [ ] **Step 2: Run and confirm it fails**

```bash
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
```

Expected: exit 1 — either "no [data-money] elements" or "not tabular (normal)".

- [ ] **Step 3: Tag money elements**

In `Work.tsx`, add `data-money` to the element rendering `formatUah(item.valueUah)`. In
`MoneyCard.tsx`, add `data-money` to the `<b>` carrying the value.

- [ ] **Step 4: Add the CSS**

Append to `apps/demo/src/styles/demo.css`:

```css
/*
 * Fix Cluster B (review 07). Money had no tabular figures anywhere
 * (measured 11px column jitter between rows), sat left-aligned at body weight
 * in a currency column, and the focal card gave value and label the same 16px.
 */
[data-money] {
  font-variant-numeric: tabular-nums;
}

.work-table [data-money] {
  text-align: right;
  font-weight: 600;
}

.money-card small {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--muted);
  text-transform: uppercase;
}

.money-card b {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.15;
}
```

- [ ] **Step 5: Verify**

```bash
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo typecheck && pnpm --filter @aktflow/demo lint
git status --porcelain
```

Expected: all exit 0, tree clean.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/src/components/MoneyCard.tsx apps/demo/src/pages/Work.tsx apps/demo/src/styles/demo.css apps/demo/qa/verify.mjs
git commit -m "fix(demo): tabular, right-aligned money and a real card hierarchy (Cluster B)"
```

---

## Task 5: The header region, one pass (Cluster A — A1, A2, A3)

Reports 01, 02, 03 and 05 each independently implicate these bands. Fix once.

**Files:**
- Modify: `apps/demo/src/components/AppShell.tsx`, `apps/demo/src/styles/demo.css`

**Interfaces:**
- Consumes: `SIDEBAR_ITEMS` from `AppShell.tsx` (unchanged).
- Produces: nothing new.

**Constraint:** spec ER-7c requires `/pilot` to stay reachable and **not** be a sidebar nav item.
Both survive relocation.

- [ ] **Step 1: Move the CTA out of the header band**

In `AppShell.tsx`, remove the `<aside className="pilot-cta">` block from above the routed content
and place it at the end of the sidebar, after the nav:

```tsx
<aside className="sidebar">
  <nav className="sidebar__nav" aria-label="Основна навігація">
    {/* unchanged */}
  </nav>
  {/* ER-7c: /pilot must stay reachable and must not be a sidebar nav item.
      Sitting below the nav in the rail satisfies both, and stops it
      outranking the page title on every /app route (review 07 · A1). */}
  <div className="sidebar__cta">
    <NavLink to="/pilot" className="button button--signal" data-testid="pilot-cta">
      Розкажіть, як у вас
    </NavLink>
  </div>
</aside>
```

Keep `data-testid="pilot-cta"` — `qa/verify.mjs` asserts it.

- [ ] **Step 2: Give the active nav state a tonal treatment**

Append to `demo.css`:

```css
/*
 * Fix A3 (review 07). The active nav item was a solid full-width Lime block
 * while the primary action is also Lime, collapsing "you are here" and
 * "do this" into one signal — and a standing allocation against the
 * Lime <=5% surface budget. Tonal shift plus a Lime edge keeps the
 * wayfinding and returns Lime to actions.
 */
.sidebar__nav a.active {
  background: rgba(255, 255, 255, 0.06);
  border-left: 3px solid var(--signal);
  color: #fff;
}

.sidebar__cta {
  margin-top: auto;
  padding: 16px;
}

/* Fix A2: the page title, count line and filter row stacked vertically,
   consuming 421px of a 900px fold on /app/work before the first row. */
@media (min-width: 1024px) {
  .app-main > .page-intro {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 20px;
  }
}
```

- [ ] **Step 3: Measure the fold reclaim**

```bash
pnpm --filter @aktflow/demo build
```

Then measure with the harness's own browser (add a temporary log or use a scratch script outside
the repo). Record `px before first data row` on `/app/work` at 1440×900. Baseline was **421px**;
report the new number in the commit message. Do not commit the scratch script.

- [ ] **Step 4: Verify**

```bash
pnpm --filter @aktflow/demo qa
pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo typecheck && pnpm --filter @aktflow/demo lint
git status --porcelain
```

Expected: all exit 0. `pilot-cta` still found by the harness on `/app`.

- [ ] **Step 5: Commit**

```bash
git add apps/demo/src/components/AppShell.tsx apps/demo/src/styles/demo.css
git commit -m "fix(demo): relocate /pilot CTA, tonal active nav, compress header band (Cluster A)"
```

---

## Task 6: Desktop table type floor (I1)

56 elements render at 9px on `/app/work` at 1440px. At 390px there are zero — Task 15's ≥16px
floor reached the card view and never the table.

**Files:**
- Modify: `apps/demo/src/styles/demo.css`
- Modify: `apps/demo/qa/verify.mjs`

- [ ] **Step 1: Add the failing assertion**

In `qa/verify.mjs`, inside the `/app/work` block:

```js
const tiny = await page.evaluate(() =>
  [...document.querySelectorAll('*')]
    .filter(el => el.children.length === 0 && el.textContent.trim())
    .filter(el => parseFloat(getComputedStyle(el).fontSize) < 12).length)
if (tiny > 0) findings.push(`/app/work: ${tiny} elements render below 12px`)
```

- [ ] **Step 2: Run and confirm it fails**

```bash
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
```

Expected: exit 1, `56 elements render below 12px`.

- [ ] **Step 3: Raise the floor on the desktop table**

Append to `demo.css`:

```css
/* Fix I1 (review 07): the >=16px floor reached the mobile cards but never the
   desktop table, leaving 56 elements at 9px on the register an estimator scans. */
.work-row small,
.work-row__label,
.work-table__head span {
  font-size: 12px;
  line-height: 1.35;
}
```

- [ ] **Step 4: Re-check contrast at the new size**

Sizes changed, so re-verify the colours still clear AA. Reuse `contrastRatio` from Task 1 and
confirm each of the three selectors measures ≥ 4.5:1 against its background. The Task 15 fix round
set these to `#4c514d` (7.27:1), `#515652` (7.49:1) and `#8b560b` on `#fff0d3` (5.43:1) — all pass,
but confirm rather than assume.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo lint
git add apps/demo/src/styles/demo.css apps/demo/qa/verify.mjs
git commit -m "fix(demo): raise desktop work-table type off 9px (I1)"
```

---

## Task 7: Touch targets and mobile density (I5, I6) — **use Impeccable `adapt`**

**Load `adapt` first:** this is responsive and device-adaptation work, which is exactly its scope.
Follow its guidance for breakpoint and target-size decisions, within this plan's constraints.

**Files:**
- Modify: `apps/demo/src/styles/demo.css`
- Modify: `apps/demo/qa/verify.mjs`

- [ ] **Step 1: Add the failing assertion**

In `qa/verify.mjs`, in the 390px pass:

```js
const small = await page.evaluate(() =>
  [...document.querySelectorAll('a, button, input, select, textarea')]
    .map(el => ({ t: (el.textContent || el.type || el.tagName).trim().slice(0, 24), ...el.getBoundingClientRect().toJSON() }))
    .filter(r => r.height > 0 && (r.height < 44 || r.width < 44))
    .map(r => `${r.t} ${Math.round(r.width)}x${Math.round(r.height)}`))
for (const s of small) findings.push(`${route} @390: touch target below 44px — ${s}`)
```

- [ ] **Step 2: Run and confirm it fails**

Expected: exit 1, naming the search input at `348x22` on `/app/work` and «Конфіденційність» at
`134x20` on `/pilot`.

- [ ] **Step 3: Fix both targets and the metadata scale**

```css
/* Fix I5 (review 07): two controls fell below the 44px touch minimum at 390px. */
@media (max-width: 767px) {
  .search-box input {
    min-height: 44px;
  }

  .legal-links a,
  .app-footer a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }

  /* Fix I6: the >=16px floor was applied broadly and inflated metadata labels
     to bold ~17px, so a 390x844 screen shows only about two work cards.
     Values keep the floor; their labels step down. */
  .work-row__label {
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
  }
}
```

- [ ] **Step 4: Confirm no horizontal overflow was introduced**

The harness already asserts `scrollWidth === clientWidth`. Run it and confirm zero overflow
findings at 390px across all ten routes.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo lint
git add apps/demo/src/styles/demo.css apps/demo/qa/verify.mjs
git commit -m "fix(demo): 44px touch targets and mobile metadata scale (I5, I6)"
```

---

## Task 8: `mailto:` delivery fallback (I3) — **use Impeccable `harden`**

**Load `harden` first:** this is a failure-path and edge-case problem, which is its scope.

On a corporate machine with webmail only, «Відкрити лист» does nothing and the visitor's ten
minutes of answers die on the device. These answers are the entire point of the outreach.

**Files:**
- Modify: `apps/demo/src/pilot/draft.ts`, `apps/demo/src/pages/Pilot.tsx`
- Modify: `apps/demo/tests/draft.test.ts`

**Interfaces:**
- Consumes: `FIELDS`, `FIELD_LABEL`, `PilotDraft` from `src/pilot/draft.ts`.
- Produces: `draftAsPlainText(draft: PilotDraft): string` exported from `src/pilot/draft.ts`.

- [ ] **Step 1: Write the failing test**

Add to `apps/demo/tests/draft.test.ts`:

```ts
import { draftAsPlainText, FIELD_LABEL } from '../src/pilot/draft'

describe('draftAsPlainText', () => {
  const draft = {
    company: 'Приклад-Буд', email: 'a@b.ua', specialisation: 'Електромонтаж',
    siteCount: '3', capture: 'Фото у Viber', storage: 'Google Drive',
    returnReason: 'Немає фото', closingTime: '5 днів', willingToShare: 'Так',
  }

  it('labels every field so the recipient can read it', () => {
    const text = draftAsPlainText(draft)
    for (const label of Object.values(FIELD_LABEL)) {
      expect(text).toContain(label)
    }
  })

  it('contains every answer the visitor typed', () => {
    const text = draftAsPlainText(draft)
    for (const value of Object.values(draft)) {
      expect(text).toContain(value)
    }
  })

  it('uses real newlines, not encoded ones', () => {
    expect(draftAsPlainText(draft)).not.toContain('%0A')
    expect(draftAsPlainText(draft)).toContain('\n')
  })
})
```

- [ ] **Step 2: Run and confirm it fails**

```bash
pnpm --filter @aktflow/demo test tests/draft.test.ts
```

Expected: FAIL — `draftAsPlainText` is not exported.

- [ ] **Step 3: Implement it**

In `src/pilot/draft.ts`:

```ts
/**
 * The same body `buildMailto` encodes, as readable plain text.
 *
 * Fix I3 (review 07): `mailto:` was the only delivery path. On a machine with
 * webmail only, the link does nothing and the visitor's answers — the entire
 * output of this outreach — are lost. This lets them copy and paste instead.
 */
export function draftAsPlainText(draft: PilotDraft): string {
  return FIELDS.map(field => `${FIELD_LABEL[field]}:\n${draft[field]}`).join('\n\n')
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
pnpm --filter @aktflow/demo test tests/draft.test.ts
```

- [ ] **Step 5: Add the copy control beside the mailto link**

In `Pilot.tsx`, inside the banner that renders «Відкрити лист», add a sibling button using the
Clipboard API with a visible confirmation. Do not remove the mailto link — it is the primary path.

```tsx
const [copied, setCopied] = useState(false)

const copyAnswers = async () => {
  try {
    await navigator.clipboard.writeText(draftAsPlainText(draft))
    setCopied(true)
  } catch {
    setCopied(false)
  }
}
```

```tsx
<button type="button" className="button button--outline" onClick={copyAnswers}>
  Скопіювати відповіді
</button>
{copied ? <span role="status">Відповіді скопійовано в буфер обміну.</span> : null}
```

`navigator.clipboard` can reject on insecure origins — the `catch` leaves `copied` false rather
than throwing, so the mailto path stays usable.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo typecheck && pnpm --filter @aktflow/demo lint
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
git add apps/demo/src/pilot/draft.ts apps/demo/src/pages/Pilot.tsx apps/demo/tests/draft.test.ts
git commit -m "fix(demo): copy-to-clipboard fallback so answers survive a webmail-only machine (I3)"
```

---

## Task 9: `/pilot` reciprocity (I2)

**⚠️ Blocked on a human decision. Do not start until answered.** The task needs two facts nobody
has supplied: what first name signs the page, and what response commitment is actually true.

`/pilot` asks for ten minutes and offers nothing up front. The one reciprocity promise —
«Прочитаю це особисто і напишу у відповідь» — sits at `Pilot.tsx:260`, on the **success** screen,
visible only after the work is done.

**Files:**
- Modify: `apps/demo/src/pages/Pilot.tsx`

- [ ] **Step 1: Get the two answers**

Ask the product owner: (a) the first name to sign with, (b) a response commitment that is
honestly keepable. «Відповім особисто» is honest; «відповідь протягом 24 годин» is not unless it is.

- [ ] **Step 2: Move the promise into the intro**

Add to the `/pilot` intro paragraph, above the first field, a sentence carrying: a realistic time
estimate for filling the form, the reciprocity promise, and the name. Keep the existing honest
framing — do not add claims.

- [ ] **Step 3: Verify no forbidden claim was introduced**

```bash
pnpm --filter @aktflow/demo test tests/claims.test.ts
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
```

Expected: exit 0. The claims guard scans all of `src/`.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/src/pages/Pilot.tsx
git commit -m "fix(demo): state the reciprocity promise before the form, not after (I2)"
```

---

## Task 10: Evidence scannability and rules measure (I4, I7)

**Files:**
- Modify: `apps/demo/src/pages/Evidence.tsx`, `apps/demo/src/styles/demo.css`

- [ ] **Step 1: Promote the amount out of the sentence**

In `Evidence.tsx`, for each row where `isAtRisk(item)` is true (from Task 3), render the amount as
a discrete element rather than mid-sentence, and reduce the sentence to its qualifying clause:

```tsx
<p className="evidence-row__risk">
  <span data-money>{formatUah(item.valueUah)}</span>
  <span>під ризиком, доки нижченаведені вимоги не закрито.</span>
</p>
```

The `data-money` attribute picks up the tabular treatment from Task 4.

- [ ] **Step 2: Cap the reading measure on `/app/rules`**

```css
/* Fix I7 (review 07): /app/rules ran ~148 characters per line at 1182px,
   while /legal/privacy is correctly capped at 672px. */
.rules-page p,
.rules-page li {
  max-width: 68ch;
}
```

Confirm the class name matches what `Rules.tsx` actually renders before writing this:

```bash
grep -n 'className' apps/demo/src/pages/Rules.tsx | head -5
```

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter @aktflow/demo build && pnpm --filter @aktflow/demo qa
pnpm --filter @aktflow/demo test && pnpm --filter @aktflow/demo typecheck && pnpm --filter @aktflow/demo lint
git add apps/demo/src/pages/Evidence.tsx apps/demo/src/styles/demo.css
git commit -m "fix(demo): scannable evidence amounts and a capped rules measure (I4, I7)"
```

---

## Task 11: Full verification

**Files:** none modified.

- [ ] **Step 1: Run everything**

```bash
pnpm --filter @aktflow/demo test
pnpm --filter @aktflow/demo typecheck
pnpm --filter @aktflow/demo lint
pnpm --filter @aktflow/demo build
pnpm --filter @aktflow/demo qa
git status --porcelain
git diff --exit-code -- prototype technical design-references apps/demo/src/styles.css
pnpm turbo run build typecheck --concurrency=1
```

Expected: every command exits 0, `git status --porcelain` prints nothing.

- [ ] **Step 2: Confirm the preflight gate still reports the launch blockers**

```bash
pnpm --filter @aktflow/demo preflight
```

Expected: **exit 1**, naming `{{CONTACT_EMAIL}}` and `{{FORM_PROCESSOR}}`. This must still fail —
it is the gate that stops an unreplaced token reaching a live page. If it now passes, someone
substituted a value and that needs confirming, not celebrating.

- [ ] **Step 3: Re-measure the headline numbers and record them**

Record in the final report: header link contrast on `/`, px-before-first-row on `/app/work`
(baseline 421px), sub-12px element count on `/app/work` (baseline 56), touch targets below 44px at
390px (baseline 2), and the at-risk figure on each of `/app`, `/app/evidence`, `/demo` step 5
(they must now agree or be explicitly scoped).

- [ ] **Step 4: Commit any harness additions**

```bash
git add apps/demo/qa/verify.mjs
git commit -m "test(demo): assert contrast, type floor and touch targets in the QA harness"
```

---

## Out of scope for this plan

Excluded deliberately, per the instruction to omit rejected and optional post-pilot findings.

- **All Low findings L1–L9** — report 07 sequences these as "defer". Includes both easing curves
  in one transition, the reduced-motion colour scope, the 460ms `surface-enter`, `.icon-button`
  press feedback, the `max-width` transition, 15 raw hex bypassing the token layer, `/roadmap`
  annotation repetition, `/app/evidence` corner numerals, and the readiness proportional bar.
- **Every rejected finding** in report 07 §6 — the `outline: none` false positive, `overused-font`,
  `side-tab` as slop, the nine dormant animations, "no press feedback", missing loading states,
  `loading="lazy"`, Glassmorphism/OLED/trust-blue, and charting libraries.
- **Everything in report 07 §7** — settled decisions, including absent dark mode and the `1e-05s`
  reduced-motion value.
- **The English «EVIDENCE → PAYMENT» kicker** — needs a human ruling on the frozen design system
  before any task can be written.

## Human decisions this plan cannot resolve

1. **The at-risk definition** (Task 3). A default is stated; confirm it.
2. **The `/pilot` name and response commitment** (Task 9). Hard-blocked.
3. **The English kicker** — out of scope until ruled on.
4. Whether `ProofBoundary` belongs on `/demo` rather than `/`; whether the PDF download should sit
   beside the pilot CTA; whether the copy says «я» and signs a name. All raised in report 05 §9.

## Still not covered by any automated check

Unchanged by this plan, and worth restating so a green suite is not mistaken for readiness:
native-speaker Ukrainian review, screen-reader verification, real Android and iPhone over mobile
data, any engine other than headless Chrome, Lighthouse, visual QA against
`design-references/evidence-atlas/selected-direction.png`, and an incognito load of a live URL.
