# HANDOFF — internal dashboard rewrite (Tailwind + shadcn)

**Branch:** `feat/p0a-child-a-prototype` (git worktree)
**Worktree:** `/Users/akisliy/Downloads/aktflow-product-package 2/.claude/worktrees/feat+p0a-child-a-prototype`
**State at handoff:** branch is **green and committed**. Nothing half-applied.
**Last commit:** `a495590` build(demo): Tailwind v4 theme layer scoped to the internal shell

Start a fresh session in that worktree and read this file first. Everything below
is verified, not assumed.

---

## 1. Task

Full rewrite of the **internal** dashboard presentation layer using Tailwind CSS +
shadcn/ui. Approved and in scope:

`/app`, every `/app/**` route, the app shell, desktop + mobile navigation, page
headers/toolbars, work registers, evidence/readiness/package views, filters,
statuses, monetary summaries, and loading/empty/error/disabled states.

**Out of scope — do not redesign:** the landing page, `/pilot`, `/roadmap`, other
public informational pages, and `/demo` *except* where it embeds the shared
register component (that compatibility change is explicitly approved).

**Not a logic rewrite.** Preserve exactly: routes and redirects, data structures,
monetary calculations, readiness arithmetic, evidence relationships,
`at risk = evidence_missing`, one-count-per-work-item, form/clipboard behaviour,
persistence and deletion, privacy behaviour, synthetic-data honesty, Ukrainian
terminology, and all existing tests.

---

## 2. Completed

### Step zero — colour-format-agnostic palette guard (`86c34a3`)

`apps/demo/qa/colour-audit.mjs` + `apps/demo/tests/palette.test.ts` (25 tests).

The previous guard compared hex literals only, so a shadcn theme in HSL or
`oklch()` would have entered completely unseen. The replacement parses hex
(3/4/6/8), `rgb()`/`rgba()` legacy + modern, `hsl()`/`hsla()`, `oklch()`,
`oklab()`, and reports `color-mix()` and `var()`-bearing functions as
**unresolved** rather than passing them.

- Approval is on the **RGB triplet**, not the literal. Alpha is free.
- Colour-bearing custom properties detected **by parsed value**, not by name.
- Covers authored CSS, Tailwind arbitrary values in JSX, and the **built bundle**.
- CSS comments are stripped before scanning.
- Mutation-verified in every format, on both the authored and bundle layers.

### Checkpoint 1 foundation — Tailwind theme layer (`a495590`)

`apps/demo/src/styles/theme.css`. Installed: `tailwindcss@4.3.3`,
`@tailwindcss/vite`, `class-variance-authority`, `clsx`, `tailwind-merge`, and 7
`@radix-ui/react-*` packages. **No shadcn components installed yet.**

- Preflight **not** imported — only `theme.css` and `utilities.css` layers.
- `--color-*: initial`, `--font-*: initial`, `--radius-*: initial` clear the stock
  namespace entirely.
- Semantic tokens for surfaces, four text levels, borders, accent, semantic
  states, readiness (4 tones), evidence, type scale (1.2 from 13px), radii, motion.
- Everything scoped under `.aktflow-app`.

---

## 3. Remaining

1. **Finish checkpoint 1** — `shadcn init` against the existing theme; install only
   the primitives that earn their place; build shared primitives + `AppShell`.
2. **Checkpoint 2** — `/app`, work register, filters, summaries, responsive
   table↔card system.
3. **Checkpoint 3** — evidence, readiness, package, detail routes.
4. **Checkpoint 4** — states, responsive refinement, accessibility, consistency.

**`.interface-design/system.md` has not been written.** Write it alongside the
first components so values are recorded as they are decided, not reconstructed
afterwards. It is meant to be the source of truth for all rewritten routes.

---

## 4. Hard constraints

**Never modify:** `prototype/`, `technical/`, `design-references/`,
`apps/demo/src/styles.css`. All four are test-enforced; `styles.css` must stay
byte-identical to `prototype/src/styles.css`.

**Colour:** every colour must already exist in `prototype/src/styles.css`. The
guard fails the build otherwise, in any format. Do not add a colour to make a
component look right — pick from the approved set or reconsider the component.

**Do not re-litigate** the Evidence Atlas direction: palette, Manrope/Inter
pairing, surface budget (Paper/White 74–78%, Carbon 17–21%, **Lime ≤5%**).

**Catalog labels** come from `technical/state-catalog.csv` byte-for-byte via
`READINESS_LABEL_UK`. Never reword a state.

**Testing split** (vitest is `environment: "node"`, no jsdom, and adding jsdom is
not approved):
- Semantic/behavioural assertions → **vitest**.
- Rendered layout, contrast, viewport, touch targets → **`apps/demo/qa/verify.mjs`**.

---

## 5. Gotchas found the hard way — do not rediscover these

1. **Tailwind v4 scans the entire project and does not distinguish tests from UI.**
   It found unapproved fixtures in `tests/palette.test.ts` and emitted them as real
   CSS, then re-detected them from `dist/` on the next build. Fixed via `@source not`
   for `dist`/`qa-output`/`tests`/`qa`, and by assembling test fixtures at runtime.
   **Never write a literal Tailwind class string in a test.**

2. **`.work-row` is currently fourteen independent grids.** `.work-table__head` and
   `.work-row` each declare `display:grid`, so the `fr` tracks resolve per row
   against that row's own content — the money column had six different right edges.
   A semantic `<table>` with shared column geometry is the approved fix. Do not
   reintroduce per-row grids.

3. **The QA harness audits at a pinned 1440×900.** It previously inherited
   puppeteer's incidental 800×600 default — neither desktop nor mobile. A separate
   360×800 pass covers narrow. Keep both explicit.

4. **Specificity collisions are silent.** A bare `.work-row__label` rule was
   outranked by an existing `.work-row .work-row__label` and measured as a no-op.
   Always measure the **rendered element**, never assume the edit applied.

5. **`text-align` is inert on an inline box.** An assertion checking the property
   passed while the column was visibly ragged. Assert the *result* (shared right
   edges), not the declaration.

6. **`.money-card small` was pushed to 16px** by a ≥16px body-text floor that
   grouped a card eyebrow with body copy. Card labels are labels, not body text.

---

## 6. Verification — run after every checkpoint

```bash
pnpm --filter @aktflow/demo test
pnpm --filter @aktflow/demo typecheck
pnpm --filter @aktflow/demo lint
pnpm --filter @aktflow/demo build
pnpm --filter @aktflow/demo qa
git status --porcelain
git diff --exit-code -- prototype technical design-references apps/demo/src/styles.css
```

All must exit 0 and `git status --porcelain` must print nothing.

**`pnpm --filter @aktflow/demo preflight` must exit 1.** That is correct and
expected — `{{CONTACT_EMAIL}}` and `{{FORM_PROCESSOR}}` are unresolved launch
blockers. Do **not** invent values to make it pass.

**Baseline right now:** 126 tests pass; typecheck/lint/build/qa exit 0.

---

## 7. Current measured baseline (compare against these)

| Metric | Value |
|---|---|
| `/app/work` chrome before first row @1440 | 357px |
| `/app` chrome before first data @1440 | 274px |
| Rows visible in a 900px fold | 10 |
| Money column right edges | 1 (aligned) |
| Sub-12px elements on `/app/work` | 0 |
| Touch targets <44px @390 | 0 |
| Landing header contrast | 17.32 / 8.21 / 8.21 / 17.32 / 17.32 |
| `/app` readiness split | 7 states summing to 14 |
| At-risk figure, all surfaces | 612 300,00 ₴ |
| Cold transfer for `/` | ~227 KiB against a 1.5 MB budget |

---

## 8. Context

- Review evidence: `docs/reviews/child-a-final-hardening/` — reports 01–06 and the
  reconciled `07-consolidated-findings.md`.
- Prior plan: `docs/superpowers/plans/2026-07-26-child-a-release-hardening.md`
  (tasks 1–11 complete except Task 9's founder inputs, which were supplied and
  implemented).
- Design system: `docs/05-design-system.md`.

**Founder-confirmed values already implemented:** signature «Олександр»,
commitment «Відповім протягом 2 робочих днів.»

**Do not deploy. Do not merge.** Work only on this branch.

---

## 9. Still outstanding across the whole project

Not blockers for the rewrite, but do not let a green suite imply they are done:
no native-speaker Ukrainian review; no screen-reader pass; no engine other than
headless Chrome has ever rendered this app; no real device; Lighthouse never run;
no visual QA against `design-references/evidence-atlas/selected-direction.png`;
the two placeholder tokens unresolved.
