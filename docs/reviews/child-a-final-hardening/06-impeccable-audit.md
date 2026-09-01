# 06 — impeccable audit (technical)

**Scope:** `apps/demo` — technical quality: accessibility, performance, theming, responsive,
implementation integrity.
**Date:** 2026-07-26
**Branch:** `feat/p0a-child-a-prototype`
**Status:** **Report only. No files were modified.**
**Fixed constraints:** `docs/05-design-system.md` and the approved Evidence Atlas direction.

This is a **code-level audit, not a design critique** — see report 05 for the UX critique.

Every number below is measured. **Section 8 separates what was verified automatically from what
still requires a real device or a human.**

> This report is not an implementation instruction. See [README.md](README.md).

---

## Audit health score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | **3** | Landing header links measure 1.0:1 and 1.9:1 — a blocking AA failure in one contained region |
| 2 | Performance | **3** | ~227 KiB cold transfer against a 1.5 MB budget; one layout-property animation |
| 3 | Theming | **3** | 23 tokens, 41 `var()` uses in `demo.css`, but 15 raw hex bypass the token layer |
| 4 | Responsive | **3** | Zero horizontal overflow at any tested viewport; two touch targets under 44px |
| 5 | Implementation integrity | **3** | Frozen-stylesheet contract holds across 37 commits; composition drift is the weak point |
| **Total** | | **15/20** | **Good — address weak dimensions** |

---

## Implementation integrity verdict — **PASS, with one qualification**

The implementation expresses a coherent, product-specific system, and unusually it is
**machine-enforced**:

- `src/styles.css` is byte-identical to `prototype/src/styles.css` — verified by md5 at every
  step across all 37 commits on this branch.
- `demo.css` introduces **no literal hex absent from the source stylesheet** — enforced by a
  test, verified repeatedly.
- Readiness labels are byte-matched against `technical/state-catalog.csv` — enforced by a test
  that I mutation-tested (a single Cyrillic-і→Latin-i swap fails it).

**The qualification:** integrity of *implementation* is not integrity of *composition*. Report 05
found the layout language largely category-interchangeable — dark strip, copy-only hero, dark
rail plus white content — with `/app/evidence` the one screen that could not belong to another
product. The tokens are disciplined; the compositions are conventional.

---

## 1. Accessibility — 3/4

### Verified present and working (automated)

| Check | Evidence |
|---|---|
| Landmarks | `<main>` ×16, `<header>` ×12, `<footer>` ×5, `<nav>` ×3 across `src/` |
| ARIA | `aria-label` ×30, `aria-hidden` ×26, `role=` ×13, `aria-live` ×4, `aria-current` ×3 |
| Form labels | 9 `htmlFor` for 9 form controls on `/pilot` — no placeholder-as-label |
| Focus indicator | Tabbed and measured: `outline: solid 2px rgb(72,76,94)` + `box-shadow: rgba(198,255,52,.34) 0 0 0 5px` |
| Focus trap | Drawer cycles both directions at 360px (verified during implementation) |
| Heading structure | Exactly one `<h1>` per route across all 9 routes; no skipped levels |
| Colour independence | Every status chip pairs icon + label + tone |
| Reduced motion | Wired and measured: animation → `none`, transitions → `1e-05s` |
| Console/network | Zero console messages, zero `pageerror`, all requests 200 OK across 6 routes |

### Gaps (automated)

**A1 — Landing header, blocking.** «Переглянути демо» measures **1.0:1** on white; «Що входить»
and «Чесність» measure **1.9:1**. Root cause `src/styles.css:409-410`, scoped to `.landing`
assuming the dark hero removed in Task 11. Full detail in report 01.

**A2 — The reduced-motion implementation is a global kill.** Measured: every transition collapses
to `1e-05s`, including `color`, `background-color` and `border-color`. The audit playbook
explicitly flags a global kill "that destroys useful feedback" — a user on reduced motion loses
hover and focus *colour* response, not just movement. Guidance is to drop movement and keep
opacity/colour. *(Using `1e-05s` rather than `none` is the correct choice and should stay — it
preserves `transitionend`.)*

**A3 — 56 elements at 9px, desktop only.** `/app/work` at 1440px: 14 `<b>` and 42
`.work-row__label` at 9px. At 390px: **zero**. Task 15's ≥16px floor reached the card view, never
the table.

**A4 — Two touch targets under 44px at 390px.** Search input `height: 22px` (`/app/work`);
footer link «Конфіденційність» `height: 20px` (`/pilot`). All other interactive elements across
`/`, `/demo`, `/app/work`, `/pilot` pass.

---

## 2. Performance — 3/4

| Metric | Measured |
|---|---|
| Cold transfer for `/` | **~227 KiB** gzip-equivalent against a 1.5 MB budget |
| `dist/` total | 1.2 MB (artifact size, not transfer) |
| JS + CSS raw | 460,856 bytes (304,444 JS + 156,412 CSS) |
| Fonts | 6 subsets, ~135 KB, cyrillic + cyrillic-ext + latin only |
| `will-change` | **0 uses** — no overuse, none left on at rest |
| Layout thrashing | None observed |
| Console errors | Zero across all routes |

**P1 — One layout-property animation.** `src/styles/demo.css:688` transitions `max-width`, a
layout property. Live code, minor jank risk. Independently flagged by the detector
(`layout-transition`) and by report 04.

**Not a finding:** zero `loading="lazy"` attributes. There are **zero `<img>` elements** in the
build — imagery ships as CSS `background-image`, so the attribute has nothing to apply to.

---

## 3. Theming — 3/4

| Check | Measured |
|---|---|
| Custom properties defined | 23 in `src/styles.css` |
| `var()` uses in `demo.css` | 41 |
| Raw hex in `demo.css` | **15** |
| New hex vs source stylesheet | **0** — enforced by test |

**T1 — 15 raw hex values bypass the token layer.** Every one is palette-conformant (the no-new-hex
test guarantees they already exist in the approved stylesheet), so this is not colour drift. It
is token-layer drift: values written literally where a `var()` exists.

**Not a finding — no dark mode.** Zero `prefers-color-scheme` blocks. The Evidence Atlas is a
light system by design (Paper/White 74–78% of surfaces per doc 05). Absent dark mode is a settled
decision, not a gap, and is not re-litigated here.

---

## 4. Responsive — 3/4

| Check | Measured |
|---|---|
| Horizontal overflow | **Zero** — `scrollWidth === clientWidth` on all 10 routes × 3 viewports (30 measurements), re-confirmed on 6 routes at 390/1440 |
| Table handling | Converts to cards below 768px, not horizontal scroll |
| Breakpoints | 768px and 1240px, consistently applied |
| Touch targets | 2 under 44px (see A4) |

**R1 — Mobile type scale is inflated.** The ≥16px floor was applied broadly; a 390×844 viewport
shows roughly two work cards. See report 01 · I1.

---

## 5. Implementation integrity — 3/4

Detector: `detect.mjs --json apps/demo/src` → exit 2, 11 findings. `index.html` → exit 0, clean.

| Rule | Count | Verdict |
|---|---|---|
| `overused-font` | 8 | **False positive** — Inter is the approved body face. The brief wins. |
| `side-tab` | 4 | **False positive on the slop framing** — approved Lime/Amber/Red status signalling. Genuine as an observation: the same border-left accent recurs in 4 independent places. |
| `layout-transition` | 1 | **True positive** — `demo.css:688` (see P1). |
| `codex-grid-background` | 1 | **True positive by the rule's letter, low value** — `styles.css:1121`, 40px cells at 2.5% opacity, a deliberate Evidence Atlas texture. |

---

## 6. Cross-cutting: the same header region appears in four reports

Reports 01 (contrast), 02 (CTA placement), 03 (chrome-to-data ratio) and 05 (aesthetic/minimalist
score) all implicate the `/app` and `/` header bands. Fixing them independently would mean four
passes over the same region. This belongs in reconciliation, not four separate corrections.

---

## 7. What the automated suite does **not** cover

Recorded so a green suite is not mistaken for assurance. 88 tests pass; none of them render a
component. Behavioural coverage lives entirely in `qa/verify.mjs` (routes, redirects, the `/demo`
journey, dataset counts, focus trap). Nothing anywhere verifies contrast, screen-reader output,
real-device behaviour, or Ukrainian fluency.

---

## 8. Automated vs human / real-device

### Verified automatically — no human needed to confirm

- All contrast ratios cited (computed from measured colour values).
- Landmark, ARIA, heading and label counts.
- Focus indicator presence, measured after a real Tab press.
- Zero horizontal overflow, 30 + 6 viewport measurements.
- Touch-target dimensions.
- Sub-12px element counts per viewport.
- Bundle size, transfer weight, font subsets, `will-change` count.
- Token counts, raw-hex counts, no-new-hex enforcement.
- Console, network and detector output.
- Reduced-motion behaviour, via media-feature emulation.

### Requires a real device

- **A4 touch targets** — the 22px and 20px measurements are certain; whether they cause real
  mis-taps is a hardware judgement on a phone in a work glove, which is the actual usage scene.
- **R1 mobile type scale** — density trade-offs need a real screen at arm's length outdoors.
- **Mobile Safari and Firefox** — all measurement used headless Chrome only. No other engine has
  been exercised at any point in this project.

### Requires a human

- **Screen-reader verification** — `aria-live`, `role="status"` and the focus trap are correct in
  code; nobody has heard them announced. No VoiceOver or NVDA pass exists.
- **Ukrainian fluency** — unreviewed by a native speaker. Three reviewers found real calques
  during implementation, which raises rather than lowers the estimate that more remain.
- **A2 reduced-motion trade-off** — whether keeping colour transitions under reduced motion is
  better for a motion-sensitive user is an accessibility judgement, not a measurement.
- **Visual QA against `design-references/evidence-atlas/selected-direction.png`** — never performed.
- **Lighthouse** — never run; would require a new dependency.
- **Incognito load of a live URL** — the site is not deployed, deliberately.
