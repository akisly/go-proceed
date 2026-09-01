# 01 — frontend-design review

**Scope:** `apps/demo` — visual direction, typography, composition, first impression.
**Date:** 2026-07-26
**Branch:** `feat/p0a-child-a-prototype`
**Status:** **Report only. No files were modified.**
**Direction:** The approved AktFlow / Evidence Atlas direction was preserved as a fixed
constraint, not re-litigated. Where the brief pins a visual direction, the brief wins.

**Method:** Reviewed from rendered output rather than source. Pages were built, served from
`dist/`, and captured in headless Chrome at 1440×1100 (desktop) and 390×844 @2x (mobile).
Contrast figures are computed from measured `getComputedStyle` values, not estimated from
screenshots.

> This report is not an implementation instruction. See [README.md](README.md).

---

## Fixed constraints observed during this pass

- Evidence Atlas palette, type pairing and surface budget (Paper/White 74–78%,
  Carbon 17–21%, Lime ≤5%) treated as given.
- `apps/demo/src/styles.css` is frozen and byte-identical to `prototype/src/styles.css`.
  Any correction proposed below is scoped to `apps/demo/src/styles/demo.css`.
- Canonical Ukrainian labels from `technical/state-catalog.csv` may not be reworded.

---

## Strengths that must be preserved

These are load-bearing. Any correction must leave them intact.

1. **The hero thesis line.** «Виконані роботи мають ставати оплатою.» set in Manrope 800 at
   a tight-tracked display scale states the subject's actual problem in the subject's own
   words. It is a claim, not a feature list. This is the hardest element to get right and it
   is right.
2. **Lime discipline.** Lime appears as a background carrying Carbon text — eyebrow chip,
   CTA, active step marker — and never as text on white. Carbon-on-Lime measures 15.16:1.
3. **Status chips never depend on colour alone.** Every chip pairs icon + label + tone, with
   labels drawn verbatim from the catalog.
4. **Mobile work cards lead with the hryvnia figure and the state chip.** Correct priority
   for an audience whose job is money at risk.
5. **`/roadmap` resists the feature-grid template.** One annotated list, hairline rules, no
   icon-in-circle cards, no three-column symmetry.

---

## Critical

### C1 — The landing header is invisible

**Route:** `/`
**Component / file:** `src/pages/Landing.tsx:55–70` (`.site-header`); rules originate in
`src/styles.css:409–410`; correction belongs in `src/styles/demo.css`.

**Evidence — measured computed styles, not inferred:**

| Element | Colour | Contrast on white | Verdict |
|---|---|---|---|
| «Переглянути демо» (`.link-button`) | `rgb(255,255,255)` / `#ffffff` | **1.0 : 1** | Invisible |
| «Що входить», «Чесність» (`nav a`) | `rgb(185,189,185)` / `#b9bdb9` | **1.9 : 1** | Fails AA (needs 4.5) |
| Brand «AktFlow» | `rgb(23,23,23)` / `#171717` | **17.93 : 1** | Passes |

Three of the four header links are unusable, on the first screen any recipient sees.

**Root cause (verified, not assumed):** the rules are scoped to `.landing`:

- `src/styles.css:409` — `.landing .site-header nav a { color:#b9bdb9; }`
- `src/styles.css:410` — `.landing .site-header nav a:hover, .landing .site-header .link-button { color:#fff; }`

In the prototype that header sat on a **dark hero**, where light grey and white read
correctly. Task 11's claim scrub removed the dark hero treatment but kept the `.landing`
class, so both rules inverted into invisibility. This is a porting defect, not a styling
mistake.

**Why the WCAG pass missed it:** Task 15 targeted body copy and page content, not header
chrome.

**Narrowest proposed correction:** override the two header colour rules in
`src/styles/demo.css` for the light-header context. `src/styles.css` is frozen and correctly
stayed untouched. No token, type or layout change required.

### C2 — `/demo` reads unfinished, and it is the centrepiece

**Route:** `/demo`
**Component / file:** `src/pages/Demo.tsx`, `src/styles/demo.css`

Every unknown route redirects here via the catch-all, making it the most-viewed surface in
the product.

**Evidence — rendered at 1440×1000:**

- Roughly 500px of content sits above roughly 500px of empty grid background.
- Step 1 carries four short lines: code chip, title, location, status chip.
- The `Назад` / `Далі` control row is stranded at opposite edges of a container far wider
  than the content column, with a white band cutting horizontally across the layout. It
  reads as a rendering bug rather than a control bar.
- The five-step progress list wraps, orphaning «5 Пакет періоду» onto its own line.

The specification requirement "no step may render an empty panel" is satisfied literally.
Visually it is not.

**Narrowest proposed correction:** constrain the control row to the content column width so
it stops spanning the full container, and address the vertical dead space. Both are layout
corrections in `demo.css`; no content or copy change is implied by this finding.

---

## Important

### I1 — Mobile type scale is inflated

**Route:** `/app/work` and all app surfaces at 390pt
**Component / file:** `src/styles/demo.css` (Task 15's ≥16px body-text floor)

**Evidence:** the floor was applied broadly and pushed the whole scale up. A 390×844 viewport
shows approximately two work cards. Card metadata labels («Локація», «Заплановано») render at
bold ~17px and compete visually with the values they label.

**Narrowest proposed correction:** step metadata labels down in size and weight while keeping
the ≥16px floor on body text. Uses the existing type scale; no floor change.

### I2 — The `/pilot` CTA floats detached

**Route:** all `/app/**`
**Component / file:** `src/components/AppShell.tsx`

**Evidence:** the CTA sits right-aligned in its own band above the page `h1`, belonging to no
content group. Visible on `/app` and `/app/work` at both desktop and mobile.

**Narrowest proposed correction:** attach it to a content group or relocate it. Spec ER-7c
requires it to be reachable and not a sidebar item; both constraints survive a relocation.

### I3 — English kicker above a Ukrainian `h1`

**Route:** `/`
**Component / file:** `src/styles.css` `.hero__copy:before` (frozen)

**Evidence:** `.hero__copy:before` renders «EVIDENCE → PAYMENT» in English above the Ukrainian
`h1`, on a Ukrainian-only page for Ukrainian contractors.

**Status:** flagged, not corrected. This originates in the frozen approved stylesheet, so it
is a design-system decision. **Requires a human ruling** — overriding the approved direction
was explicitly out of scope for this pass.

### I4 — `/roadmap` annotation repetition

**Route:** `/roadmap`
**Component / file:** `src/pages/Roadmap.tsx`

**Evidence:** «Концептуально · не реалізовано» appears verbatim three times, once per entry.
Structurally honest; visually monotonous, and the triplication reads as templated.

**Narrowest proposed correction:** state the disclosure once above the list and let each entry
carry something specific. The required honesty sentence «Нижче — напрям, а не наявні функції.
Нічого з цього зараз не працює.» and the per-entry conceptual marking are both spec
requirements (A.4.20 honesty rules) — any correction must preserve the disclosure's force.

---

## Single highest-priority item

**C1, the landing header.** It is a measured accessibility failure, it is the first
impression, and unlike C2 it has a precise, contained cause and a one-rule correction.

---

## Findings requiring human or real-device review

- **I3** — the English kicker is a frozen design-system element; changing it is a human
  decision about the approved direction.
- **I1** — the mobile type judgement was made from a 390×844 emulated viewport. Confirming
  the density trade-off needs a real device in real conditions.
- Contrast figures in C1 were computed manually from measured colour values. No automated
  audit (`axe-core`) was run across all surfaces; other failures may exist outside the header.
