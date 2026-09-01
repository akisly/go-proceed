# 02 — interface-design review

**Scope:** `apps/demo` — `/demo`, `/app/**`, evidence and readiness screens, navigation,
information density, operational hierarchy, desktop and mobile composition, tables, work
cards, statuses, monetary values, primary actions.
**Date:** 2026-07-26
**Branch:** `feat/p0a-child-a-prototype`
**Status:** **Report only. No files were modified.**
**Direction:** The approved Evidence Atlas direction, doc 05 tokens, typography and surface
budget were preserved as fixed constraints.

**Method:** Measured `getComputedStyle` and `getBoundingClientRect` values from the built app
served from `dist/` in headless Chrome at 1440×1000, plus rendered captures of `/app`,
`/app/evidence` and `/app/rules`. Findings are stated from measurements, not impressions.

**Relationship to pass 01:** the landing-header contrast failure and the `/demo` composition
problems were supplied as already-measured evidence and are **not** repeated here. This pass
looked for product-interface issues those findings did not cover.

> This report is not an implementation instruction. See [README.md](README.md).

---

## Strengths that must be preserved

1. **Status chips never rely on colour.** Icon + label + tone, with labels drawn verbatim
   from `technical/state-catalog.csv`. The byte-for-byte label test should keep guarding this.
2. **Shell proportion.** Sidebar measured **258px** against **1182px** of content — the
   proportion correctly states that navigation serves the work. Sidebar nav hit heights
   measure a clean **44px** each (Роботи, Докази, Правила, Що далі).
3. **Mobile work cards lead with the hryvnia figure and the state chip**, then demote code,
   title and quantities. That priority order is correct for this audience and must survive
   any desktop table change.
4. **`/app/evidence` groups by blocking versus non-blocking**, not by readiness. This is the
   operationally correct split — it answers "what stops the package" rather than "what state
   is this in."
5. **Carbon sidebar against Paper canvas** separated by a single hairline — the shell reads
   as one space, not two worlds.

---

## Critical

### C1 — Money is not tabular anywhere in the product

**Routes:** `/app/work`, `/app`, `/app/evidence`
**Component / file:** `src/components/MoneyCard.tsx`, `src/pages/Work.tsx`,
`src/styles/demo.css`

**Evidence — measured:**

- `font-variant-numeric: normal` on every hryvnia value inspected.
- `anyTabularNumsInDoc: false` — no element in the entire document declares tabular figures.
- Measurable symptom in the work register's value column: `118 000,00 ₴` begins at
  **x = 1065**, `184 000,00 ₴` begins at **x = 1054** — an **11px horizontal jitter**
  row-to-row within the same column.

This is the one product whose entire argument is money at risk, presented to estimators and
ПТО engineers whose job is reconciling columns of figures. Proportional digits make that
column unscannable.

**Narrowest proposed correction:** `font-variant-numeric: tabular-nums` on the money elements
in `src/styles/demo.css`. One declaration. No token, layout or type change.

### C2 — Money is left-aligned in a currency column, at body weight

**Route:** `/app/work`
**Component / file:** `src/pages/Work.tsx`

**Evidence — measured:** `text-align: start`, `font-size: 16px`, `font-weight: 400`. The row
title renders at weight 700. The money is therefore the least emphasised element on the row,
and magnitudes cannot be compared down the column.

**Narrowest proposed correction:** right-align the value column and lift it to weight 600.
Uses the existing weight scale; introduces no new token.

### C3 — The focal card has no hierarchy

**Route:** `/app`
**Component / file:** `src/components/MoneyCard.tsx`

**Evidence — measured:**

| Element | Size | Weight |
|---|---|---|
| `.money-card b` (the value) | **16px** | 700 |
| `.money-card small` (the label) | **16px** | 400 |

The value and its label are the same size. This is the «Гроші під ризиком / 612 300,00 ₴»
card — the single focal element of the operational dashboard — carrying its hierarchy on one
lever (weight) alone.

Surrounding scale for reference, measured: `.app-main h1` = 32px/700, `.app-main h2` = 24px/700.

**Narrowest proposed correction:** demote the label (11–12px, tracked, muted) and promote the
value (24–28px, weight 600, tabular). Three levers instead of one; both values already exist
in the type scale.

---

## Important

### I1 — Lime means two different things

**Routes:** all `/app/**`
**Component / file:** `src/components/AppShell.tsx`, `src/styles/demo.css`

**Evidence:** the active sidebar item renders as a solid full-width Lime block (~242px wide),
while the primary action button is also Lime. "You are here" and "do this" are now the same
signal. The block is a large standing Lime allocation on every app route, against doc 05's
Lime ≤5% surface budget.

**Narrowest proposed correction:** active state becomes a tonal Carbon shift plus a Lime edge
indicator; the Lime fill is reserved for actions. Preserves the palette and reduces Lime
coverage against the budget.

### I2 — The `/pilot` CTA outranks the work

**Routes:** all `/app/**`
**Component / file:** `src/components/AppShell.tsx`

**Evidence:** the Lime CTA sits above the `h1` in its own right-aligned band. On
`/app/evidence` it is the visually loudest element on a screen whose job is triage — the focal
point is a marketing ask, not the operational task.

**Note:** pass 01 recorded the same element as detached from any content group (01 · I2). This
pass adds the distinct operational finding that it *wins the focal contest* on a work screen.

**Narrowest proposed correction:** move it below the primary content or into the sidebar
footer, at secondary emphasis. Spec ER-7c requires it to remain reachable and not a sidebar
nav item; both constraints survive.

### I3 — Prose is doing table work on the evidence screen

**Route:** `/app/evidence`
**Component / file:** `src/pages/Evidence.tsx`

**Evidence:** the at-risk figure is embedded mid-sentence in body copy —
«Під ризиком 184 000,00 ₴ за цим рядком, доки нижченаведені вимоги не закрито.» — and
ЕМ-01.05 carries a two-line explanatory paragraph. For someone triaging seven rows, the
amount and the blocker count are the scannable facts, but both must be read out of sentences.

**Narrowest proposed correction:** promote the amount to a discrete right-aligned element on
the row and reduce the sentence to its qualifying clause.

### I4 — Corner numerals read as sequence, not count

**Route:** `/app/evidence`
**Component / file:** `src/pages/Evidence.tsx`

**Evidence:** circled `1`, `2`, `2` render top-right of each row, detached from the noun they
quantify, in the visual idiom of step markers. They are requirement counts on an unordered
list, so the numbering encodes order that does not exist.

**Narrowest proposed correction:** inline them with their noun («2 вимоги») adjacent to the
row title.

---

## Findings requiring human or real-device review

- None of the findings in this pass depend on a real device; all are measured from the built
  application.
- The Lime surface-budget claim in **I1** is a proportional judgement against doc 05's ≤5%
  ceiling. Confirming the actual measured Lime coverage across app routes would require a
  pixel-coverage audit that was not run.
- Ukrainian wording in **I3**'s proposed correction would need native-speaker review before
  any rewrite, consistent with the outstanding language gap recorded in the README.
