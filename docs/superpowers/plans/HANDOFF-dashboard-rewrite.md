# HANDOFF — internal dashboard rewrite (Tailwind + shadcn)

**Branch:** `claude/dashboard-rewrite-handoff-5b2789` (git worktree)
**State:** **green and committed**. Nothing half-applied.
**Last commit:** checkpoint 4 — legacy CSS retired

Start a fresh session in that worktree and read this file first, then
`.interface-design/system.md`, which is the source of truth for every design
value. Everything below is verified, not assumed.

**All four checkpoints are complete.** What remains is listed in §3 and is
smaller than what was done; §9 lists the project-wide gaps that a green suite
does not close.

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

### Checkpoint 1 — primitives and the shell (`665b8d4`)

`components.json`, `src/lib/utils.ts`, `src/components/ui/{button,tooltip,separator}.tsx`,
rewritten `AppShell`. **`shadcn init` was NOT run and must not be** — it rewrites
the theme block in oklch and imports Preflight, both of which the colour guard
would only catch after the damage. The config was written by hand and the `@/`
alias resolves, so `npx shadcn add …` works.

The finding that mattered: the frozen sheets were **unlayered**, and an
unlayered author declaration beats a layered one at any specificity. `a { color:
inherit }` beat every `text-*` utility; `button,input,select { font: inherit }`
beat every font-size utility. Silently. `theme.css` now owns the layer order —
`legacy, theme, base, components, utilities` — and imports both frozen sheets as
`layer(legacy)`.

### Checkpoint 2 — register, filters, `/app` (`76765ca`)

Semantic `<table>` with `table-fixed`, three renderings (6 columns / 4 columns /
cards). Money summary with the risk qualifier `domain/risk.ts` requires.
Readiness bar. Ukrainian plural helper + 8 tests.

### Checkpoint 3 — evidence and rules (`280036c`)

Caught and guarded a **false consequence**: every card in the blocking section
was captioned «Ця конкретна вимога подання пакета не блокує». Counts were correct
and the suite was green while the page said the opposite of the truth. The base
type size was also inverted (15px prose base, register steps down to 13px).

### Checkpoint 4 — legacy CSS retired

546 lines removed from `demo.css` — every rule describing a DOM that no longer
exists. Public-route equivalence proven by diffing all 240 computed-property rows
on `/pilot`, not by eye.

---

## 3. Remaining

Not blockers, and none of it is required for the rewrite to be coherent.

1. **`/demo` still renders the legacy components.** `MoneyCard`, `StatusChip`
   and `UnrecoverableNote` were deliberately left alone because `/demo` is out of
   scope; `MoneySummary`, `ReadinessBadge` and `UnrecoverableCallout` are their
   internal replacements. Both sets read the same `READINESS_LABEL_UK` and
   `readinessTone`, so the facts cannot diverge — only the presentation is
   duplicated. Retiring the legacy three needs `/demo` to come into scope.

2. **`readinessTone` collapses «Очікує перевірки» into the amber tone.** A review
   queue is not an evidence gap, the theme already defines the blue
   `readiness-review-*` tokens, and the frozen sheet even ships an unused
   `.status--review`. Splitting them is a one-line change to
   `src/domain/readiness.ts` — but that function is shared with `/demo`, so it is
   a scope decision, not a code decision.

3. **The bundle grew ~33 KiB gzip** (94 → 127) from Radix, cva and tailwind-merge.
   Cold transfer for `/` is ~260 KiB against a 1.5 MB budget, so this is
   headroom, not a problem. If it ever matters, `TooltipProvider` is only needed
   between 768 and 1240px and is the obvious first split.

4. **`qa` failed once in 13 runs** and did not reproduce in 12 subsequent runs.
   The failure output was not captured. If it recurs, capture it before assuming
   it is a flake.

**`.interface-design/system.md` is written** and is the source of truth. Read it
before changing any design value.

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

7. **Unlayered CSS beats every cascade layer**, at any specificity. This inverted
   the whole rewrite until `theme.css` took over the imports — see §2.

8. **`!important` reverses layer order**: the *lowest* layer wins. The
   `prefers-reduced-motion` block is deliberately unlayered for this reason.

9. **tailwind-merge has to be taught this theme.** `text-data` is not a t-shirt
   size, so stock tailwind-merge classifies it as a *colour*, decides it
   conflicts with `text-foreground`, and drops one of them silently.
   `src/lib/utils.ts` overrides the affected class groups.

10. **Radix portals escape `.aktflow-app`** — no font, no reduced-motion block,
    no focus ring. Anything that portals must carry its own.

11. **`items-center` on a flex column collapses children to their content box.**
    It gave the 68px rail an 18×44 hit area where 36×44 was intended.

12. **Ukrainian 11–14 take the genitive plural** despite ending in 1–4. Use
    `pluralUk`/`rowsUk` from `src/domain/format.ts`, never `${n} рядків`.

13. **An assertion must name the contract, not the markup.** The drawer-trap
    assertion named `.sidebar__close` and reported a FAILING trap when the
    drawer's DOM order changed while the trap worked perfectly. An assertion
    that fires on a correct change teaches you to edit the assertion.

14. **A component correct for one caller's filter is a bug waiting for the
    second.** `RequirementList` keyed on `blocksSubmission` alone, which was fine
    while only `/app/evidence` (pending-only) used it, and rendered
    already-satisfied records as blocking the moment `/app/rules` passed a full
    list.

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

**Baseline right now:** 134 tests pass; typecheck/lint/build/qa exit 0.

---

## 7. Current measured baseline (compare against these)

| Metric | Before rewrite | Now |
|---|---:|---:|
| `/app/work` chrome before first row @1440 | 357px | **237px** |
| `/app` chrome before first data @1440 | 274px | **183px** |
| Rows visible in a 900px fold | 10 | **14 — all of them** |
| Money column right edges | 1 (aligned) | 1 (aligned) |
| Sub-12px elements on `/app/work` | 0 | 0 |
| Touch targets <44px @390 | 0 | 0 |
| Rail share of width @1440 | — | 16.7% (doc 05 Carbon budget 17–21%) |
| `demo.css` | 1232 lines | **708 lines** |
| At-risk figure, all surfaces | 612 300,00 ₴ | 612 300,00 ₴ |
| `/app` readiness split | 7 states summing to 14 | 7 states summing to 14 |
| Cold transfer for `/` | ~227 KiB | ~260 KiB against a 1.5 MB budget |

`/app`'s figure rose 36px from the shell-only state deliberately: the total now
sits in a real panel with its honesty qualifier, rather than loose on the page.

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
