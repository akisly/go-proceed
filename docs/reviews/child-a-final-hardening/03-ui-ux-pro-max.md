# 03 — ui-ux-pro-max audit

**Scope:** `apps/demo` — dashboard density, operational data-visualization opportunities,
restrained B2B UI patterns.
**Date:** 2026-07-26
**Branch:** `feat/p0a-child-a-prototype`
**Status:** **Report only. No files were modified. No design system was generated or persisted.**
**Direction:** `docs/05-design-system.md` (Evidence Atlas) preserved as the governing brief.

**Stack detected:** React 19 + react-router-dom 7 + Vite (`apps/demo/package.json`).

**Method:** Queried the skill's rule database across the `ux`, `chart` and `product` domains,
then measured the built application in headless Chrome at 1440×900 to ground each finding.
`--design-system` and `--persist` were deliberately **not** run — the project already has an
approved design system and the instruction was not to write a competing one.

> This report is not an implementation instruction. See [README.md](README.md).

---

## Database recommendations rejected as inapplicable

Recorded for transparency, because a reader should know what was discarded and why.

The `product` domain matched "SaaS (General)", "Smart Home/IoT Dashboard" and "B2B Service",
and recommended **Glassmorphism + Flat Design**, **Dark Mode (OLED)**, **trust blue + accent
contrast**, and **professional blue + neutral grey**.

**All rejected.** These contradict doc 05's approved Evidence Atlas direction (Carbon `#171717`,
Paper `#FBFBFB`, Lime `#C6FF34`, Slate, Amber, Red; Manrope/Inter; Paper 74–78% / Carbon 17–21%
/ Lime ≤5%). The database is generic by construction; the brief governs. Only the database's
**structural, accessibility and chart** guidance was applied below.

---

## Strengths that must be preserved

1. **Mobile tables become cards, not horizontal scroll.** The `ux` domain flags "Table
   Handling — tables can overflow on mobile" (Medium) with "use horizontal scroll **or** card
   layout" as the remedy. `/app/work` already converts to cards below 768px, taking the
   stronger of the two options.
2. **Colour is never the sole carrier.** The `ux` domain's highest-severity item in this area
   ("Color Only", High) requires icons/text alongside colour. Every status chip already pairs
   icon + canonical label + tone.
3. **Active navigation state is present** — the `ux` domain flags absence of it (Medium). It
   exists here. (Its *colour choice* is a separate finding in report 02 · I1; not re-raised.)
4. **Type scale is modular, not arbitrary.** Measured `h1` 32px / `h2` 24px / body 16px against
   the database's "Font Size Scale" rule (Medium), which asks for a consistent modular scale.

---

## Important

### I1 — Operational routes spend half the first screen before showing any work

**Routes:** `/app`, `/app/work`
**Component / file:** `src/components/AppShell.tsx`, `src/pages/App.tsx`, `src/pages/Work.tsx`

**Evidence — measured at 1440×900:**

| Route | px before first data element | Data rows in first screen | Total screens |
|---|---|---|---|
| `/app` | **338px** | 5 | 1.65 |
| `/app/work` | **421px** | 9 | 1.46 |
| `/app/evidence` | — | 0 (section markup) | **2.44** |

On `/app/work` — a work register whose entire job is showing 14 rows — 421px of a 900px
viewport is consumed by disclosure strip, brand header, CTA band, page title, count line,
filter chips and search before the first row appears. That is 47% of the fold spent on chrome.

This is the density finding the audit was asked for. For an operational tool used by ПТО
engineers scanning for blockers, chrome-to-data ratio is the primary density metric, and it is
currently weighted toward chrome.

**Narrowest proposed correction:** compress the stacked header bands on `/app/**` — the page
title, count line and filter row can share horizontal space rather than stacking vertically at
desktop widths. No token, palette or type change; a layout change in `src/styles/demo.css`.

**Interaction with other reports:** part of that 421px is the detached `/pilot` CTA band
(report 01 · I2, report 02 · I2). Relocating it also reclaims fold space. These should be
reconciled together, not fixed independently.

### I2 — The readiness split has no proportional encoding

**Route:** `/app`
**Component / file:** `src/pages/App.tsx` («Розподіл готовності» section)

**Evidence — measured:** the section renders **3 status chips with bare counts**;
`hasProportionalBar: false`. The underlying data is a part-to-whole composition —
ready_internal 3, review_pending 2, evidence_missing 4, of 14 rows — presented as three
unrelated numbers. A reader must do the arithmetic to understand the proportion, and the
remaining 5 rows in other states are absent from the section entirely.

**Database guidance (`chart` domain):** the closest matches for a dashboard composition of this
kind are **Bullet Chart** (accessibility grade **AAA** — "all values always visible as text",
"color ranges are labeled with text thresholds not color alone") and **100% Stacked Bar** for
proportion. Both are explicitly compatible with doc 05's never-colour-alone rule.

**Why this is the strongest data-visualization opportunity in the product:** it needs no new
colours — the three existing status tones already carry the semantics — and no charting
dependency. A single horizontal 100%-stacked bar with counts printed as text would let someone
see "most of this period is blocked" in one glance, which is precisely the argument the demo
exists to make.

**Narrowest proposed correction:** one horizontal proportional bar segmented by the existing
status tones, with counts and labels rendered as visible text beside it, replacing or
supplementing the three chips. Values stay legible without the bar; the bar adds proportion.

**Explicit constraint:** this must not introduce a charting library, a new hue, or colour-only
encoding, and must not exceed the Lime ≤5% budget. It is an opportunity, not a mandate — the
restrained option (leave as chips) remains defensible for a B2B tool.

---

## Medium

### M1 — `/app/evidence` runs 2.44 screens with no overview

**Route:** `/app/evidence`
**Component / file:** `src/pages/Evidence.tsx`

**Evidence — measured:** document height 2192px against a 900px viewport = **2.44 screens**,
the longest operational route. The count line («Рядків із відкритими вимогами за фільтром
"Усі": 7») is the only summary; there is no at-a-glance total of money blocked or requirement
count before the reader begins scrolling.

**Narrowest proposed correction:** a compact summary line or strip above the sections carrying
the blocked total and requirement count. Reuses `formatUah` and existing type tokens.

**Note:** report 02 · I3 separately found that this page's per-row figures are embedded in
prose. The two findings compound — no overview, and the detail is hard to scan — and should be
reconciled together.

---

## Not applicable, with reasons

Recorded so a future reader does not mistake these for missed checks.

- **"Loading States" / "Loading Indicators" (severity High).** The database flags absence of
  loading feedback. `PROJECT` is a static bundled import; there is no asynchronous data fetch
  anywhere in `apps/demo`, so no loading state can occur. This was already ruled a deliberate
  deviation during implementation (Task 14) — building a skeleton that can never render would
  be dead code, and simulating latency in an honesty-first demo would be self-defeating.
- **"Empty States" (severity Medium).** Already implemented with named situations and
  onward actions on `/app/work` and `/app/evidence` (Task 14).
- **Charting libraries.** The `chart` domain recommends D3.js / ApexCharts / Recharts for its
  matched types. Adding any of them would violate the no-new-dependencies constraint. The I2
  recommendation is deliberately achievable in plain CSS.

---

## Findings requiring human or real-device review

- **I2 is a product decision, not a defect.** Adding proportional encoding changes what the
  dashboard emphasises. Whether the demo should visualise the readiness split or stay
  deliberately plain is a call about the product's argument, and belongs to the person who owns
  that argument.
- **I1's density correction interacts with the CTA placement** raised in reports 01 and 02.
  Reconciling all three together avoids three separate passes over the same header region.
- **Lime ≤5% surface budget.** Any change to the readiness section or header bands should be
  re-checked against doc 05's budget. No pixel-coverage audit was run in this pass.
