# 05 — impeccable critique

**Scope:** `apps/demo` — full-artifact UX critique with heuristic scoring.
**Date:** 2026-07-26
**Branch:** `feat/p0a-child-a-prototype`
**Status:** **Report only. No files were modified.**
**Provenance:** **Dual sub-agent run — not degraded.** Assessment A (design review) and
Assessment B (detector + browser evidence) ran as two isolated, parallel sub-agents. Neither
saw the other's output. A completed before B's findings entered synthesis.
**Fixed constraints:** `docs/05-design-system.md` and the approved Evidence Atlas direction
were treated as given, not re-litigated.

**Parent vetting:** every finding below was re-confirmed by me at its `file:line` or by direct
measurement. Two sub-agent findings were **rejected**; they are recorded in full rather than
silently dropped.

> This report is not an implementation instruction. See [README.md](README.md).

---

## Rejected findings

### Rejected — "72/72 focusable elements have `outline: none`"

Assessment B reported that every focusable element on every route has computed
`outline-style: none` or `outline-width: 0px`, which would be a WCAG 2.4.7 failure across the
whole product.

**This is a false positive, and a methodological one.** B measured elements in their **resting**
state, where `outline: none` is correct — the indicator is applied on `:focus-visible`. I
pressed Tab and measured the actually-focused element:

```
outlineStyle: solid   outlineWidth: 2px   outlineColor: rgb(72,76,94)   (Slate)
boxShadow:    rgba(198,255,52,0.34) 0 0 0 5px   (Lime ring)
```

The focus indicator is real, visible, and uses the approved palette. Rejected.

### Rejected — `overused-font` ×8 (detector)

The detector flags `font-family: 'Inter'` at 8 sites. Inter Variable is the approved body face
in doc 05. The brief wins over a saturated-pattern warning. Rejected as intended by design.

---

## Design-specificity verdict

**Split, and the split is the story.** The *language* is unmistakably this product's — `ЕМ-04.02`,
«Секція Б · 2 поверх · осі 4-9», «ВВГнг-LS 3х2,5 у гофрі», «Конструкцію закрито … доказ уже не
відновити без розкриття». No other product could use those words.

The *composition* is largely category-interchangeable: full-bleed dark strip, centred copy-only
hero with an accent pill, dark left rail plus white content, stacked form. Replace the Cyrillic
with English SaaS copy and few layout decisions resist.

**One genuine exception:** `/app/evidence` (`src/pages/Evidence.tsx`). The per-row consequence
line attaching money-at-risk to the requirement that causes it, and the blocking/non-blocking
split, exist only because this domain exists. It is the one screen that could not be lifted.

---

## Nielsen heuristics — 23/40, "Acceptable"

All ten scored; the Operate mode makes the `n/a` rule inapplicable.

| # | Heuristic | Score | Evidence |
|---|---|---|---|
| 1 | Visibility of status | 2 | All nine routes share one `<title>` (`dist/index.html:9`). Autosave never announces while typing (`Pilot.tsx:149-153`). |
| 2 | Match real world | 3 | Domain vocabulary excellent; `/app/rules` is system-designer prose; voice flips я/ми (`ProofBoundary.tsx:14` vs `Pilot.tsx:257,260`). |
| 3 | User control | 3 | Back + arrow keys on `/demo` (`Demo.tsx:113-130`), real «Видалити чернетку» (`Pilot.tsx:349`); `/roadmap` has no `/pilot` exit. |
| 4 | Consistency | 2 | `MoneyCard` is a bordered card on `/demo` (`Demo.tsx:267`), bare 16px text on `/app` (`App.tsx:37`). Measure 672px on `/legal/privacy` vs 1182px on `/app/rules`. |
| 5 | Error prevention | 3 | Debounced draft, survives storage denial, `maxLength`, only 2 required fields (`pilot/draft.ts`). |
| 6 | Recognition | 3 | Status always icon+label+tone (`StatusChip.tsx`); 768–1239px collapses nav to icon-only. |
| 7 | Flexibility | 2 | Arrow-key stepping exists; reaching step 4 still needs three «Далі» clicks. |
| 8 | Aesthetic / minimalist | 1 | `.pilot-cta` floats above every `/app` h1 (measured y=121 vs h1 y=185, `demo.css:34-38`). |
| 9 | Error recovery | 2 | Banners exemplary — persistent, focus-managed, never clear input (`Pilot.tsx:316-354`) — but no fallback when `mailto:` does not open. |
| 10 | Help | 2 | One of three free-text questions has a hint (`Pilot.tsx:420`). No time estimate anywhere. |

---

## Cognitive load — 4 checklist failures = high

- **Single focus** ✗ `/app` — four sections plus a floating Lime CTA above the title.
- **Grouping** ✗ `/app` — four bare `<section>`s; only the table is a `.panel` (`App.tsx:29-66`).
- **Visual hierarchy** ✗ the KPI «612 300,00 ₴» renders 16px/700, *smaller* than the 24px h2 labelling it.
- **Minimal choices** ✗ `/demo` step 5 shows four buttons, three of them forward (`Demo.tsx:292-323`).

Chunking, one-thing-at-a-time, working memory and progressive disclosure all pass.
**>4 options:** `/pilot` presents nine fields at once with no sectioning (`Pilot.tsx:356-476`).

---

## Emotional journey

The **valley** is `/demo`'s middle — steps 1 and 4 leave the visitor alone with «Бракує доказів»
and ~500px of empty grid. The **peak** is the unrecoverable note: date, consequence, cost.

The **end is diluted**. At maximum willingness, step 5 offers four buttons, and «Завантажити
пакет (PDF)» competes with the pilot CTA on curiosity.

**At the high-stakes moment there is no reassurance at all.** Deciding to type ten minutes of
process detail, the visitor gets no time estimate, no name, no statement of what comes back. The
single reciprocity promise — «Прочитаю це особисто і напишу у відповідь» (`Pilot.tsx:260`) —
appears on the *success* screen, visible only after the work is done. The honesty framing itself
is not apologetic; `ProofBoundary` states the boundary flatly and moves on. But honesty without
reciprocity reads as a warning rather than an invitation.

---

## Priority issues

### P1 — The readiness arithmetic does not close *(verified by me)*

**Route:** `/app` · **File:** `src/pages/App.tsx:41-48`

Measured: «Розподіл готовності» renders three chips with counts **3, 2, 4 = 9**, on a page whose
adjacent denominator reads **«з 14 рядків»**. Five of fourteen rows are unaccounted for; the
dataset spans seven readiness states and the section shows three.

A ПТО lead adds columns for a living. On a product whose sole asset is honesty about numbers,
this is the first thing they will check.

**Narrowest correction:** show all states present in the data, or label the section as a subset
so the denominator and the parts describe the same set.

### P1 — Three surfaces give three different "money with a problem" totals *(verified by me)*

**Routes:** `/app`, `/demo` step 5, `/app/evidence`

| Surface | Figure | Definition |
|---|---|---|
| `/app` | «Під ризиком **612 300,00 ₴**» | 4 rows, `evidence_missing` |
| `/demo` step 5 | «Потребує дій **697 900,00 ₴**» | 6 rows, amber tone |
| `/app/evidence` | **748 900 ₴** implied (report 02 · C3) | 5 rows, pending blocking |

Each is internally correct under its own definition; none is reconciled to the others, and
nothing on screen explains why they differ. This extends report 02's C3 from two surfaces to
three and is the sharpest credibility risk in the review series.

**Narrowest correction:** adopt one definition of "at risk" across all three surfaces, or label
each figure with its scope.

### P1 — `/pilot` asks for ten minutes and pays nothing up front

**File:** `src/pages/Pilot.tsx:288-293`

**Narrowest correction:** move the reciprocity promise from line 260 into the intro, add a
realistic time estimate, and sign a first name.

### P1 — `mailto:` is the only delivery path, with no fallback

**File:** `src/pilot/draft.ts:98-101`

On a corporate machine with webmail only, «Відкрити лист» does nothing and the discovery answers
die on the device. **Narrowest correction:** render the composed plaintext with a copy button
beside the link.

### P2 — 56 elements at 9px on the desktop work register *(verified by me)*

**Route:** `/app/work` · **File:** `src/styles/demo.css`

Measured sub-12px elements:

| Viewport | Count |
|---|---|
| 390px (mobile) | **0** — clean |
| 1440px (desktop) | **56** — 14 `<b>` and 42 `.work-row__label`, all 9px |

Task 15's ≥16px floor reached the mobile card view but never the desktop table. Prior passes
caught this text's *contrast*; its *size* is new. **Narrowest correction:** extend the floor to
the desktop table labels.

### P2 — Search input is 22px tall at 390px *(verified by me)*

**Route:** `/app/work` · Measured `height: 22px` against a 44px touch minimum — half target size
on the primary filter control, on the viewport where it matters most.

### P2 — `/app/rules` runs ~148 characters per line

Measured 1182px at 16px; `/legal/privacy` is correctly capped at 672px.

---

## Detector findings — triaged

`detect.mjs --json apps/demo/src` → exit 2, 11 findings. `apps/demo/index.html` → exit 0, clean.

| Rule | Count | Verdict |
|---|---|---|
| `overused-font` | 5+3 | **False positive** — Inter is the approved face (doc 05). |
| `side-tab` | 4 | **False positive on the slop framing** — `styles.css:322/1095/1821` and `demo.css:90` use the approved Lime/Amber/Red as status signalling. Worth noting as a recurring border-left accent pattern. |
| `layout-transition` | 1 | **True positive** — `demo.css:688` transitions `max-width`, a layout property. Live code, minor jank risk. Corroborates report 04's motion audit. |
| `codex-grid-background` | 1 | **True positive by the rule's letter, low value** — `styles.css:1121`, body grid at 40px cells, 2.5% opacity. Deliberate Evidence Atlas texture. |

**Browser evidence, clean:** zero console messages and zero `pageerror` events across six routes
at both viewports; every request 200 OK; no horizontal overflow at 390px or 1440px; exactly one
`<h1>` per route; no duplicate ids; no `<img>` without `alt` (imagery is CSS background, so the
check had no applicable elements).

---

## Strengths that must be preserved

1. **`/app/evidence`'s row composition** — money-at-risk attached to the requirement causing it.
   The one genuinely non-transferable screen in the product.
2. **`pilot/draft.ts` plus the inline banners** — the draft survives storage denial, refresh and
   failed submit, and the visitor is told so in plain Ukrainian. Persistent, focus-managed,
   never clears input.
3. **`UnrecoverableNote.tsx`** — the Red annotation sits beside the canonical chip rather than
   replacing it, and drops the cost sentence rather than assert a false «0,00 ₴».

---

## Questions for the product owner

1. `/demo` is the catch-all target and therefore the most-visited surface, yet the landing carries
   the entire honesty argument and `/demo` carries none of it. **Should `ProofBoundary` live on
   `/demo` instead of `/`?**
2. «Завантажити пакет (PDF)» sits beside the pilot CTA at the exact peak-end moment. **What does
   a downloaded PDF buy that a reply does not — and is it worth the conversion it costs?**
3. The artifact is written by one person testing a hypothesis but speaks as «ми» except twice.
   **What breaks if it says «я» everywhere and signs a name?** For this audience that is likely
   more credible, not less.

---

## Findings requiring human or real-device review

- The **я/ми voice inconsistency** and all Ukrainian copy quality remain unreviewed by a native
  speaker — the standing gap recorded in the README.
- The **22px search target** is confirmed in code; its severity is a real-device judgement.
- Whether the **three money definitions** should be unified or merely labelled is a product
  decision about what "at risk" means, not a UI defect to be fixed unilaterally.
