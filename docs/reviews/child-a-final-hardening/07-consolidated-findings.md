# 07 — consolidated findings

**Scope:** reconciliation of reports 01–06 in this directory.
**Date:** 2026-07-26
**Branch:** `feat/p0a-child-a-prototype`
**Status:** **Report only. No application code was edited.**

**Method:** every report was read **from disk**, not from conversation memory. Where reports
disagreed, contradicted themselves, or cited each other, I re-measured against the running
build rather than trusting either report. Two factual errors in the reports were found this way
and are corrected below.

**This document supersedes reports 01–06 where they conflict.** Those remain as evidence; this
is the actionable list.

---

## 0. Corrections to the reports themselves

Two errors survived into the reports. Both are corrected here rather than left to mislead.

### 0.1 — The "748 900 ₴" third money figure is **stale**. Withdraw it.

Report 05 · P1 claims three surfaces give three different at-risk totals, citing
«748 900 ₴ implied on `/app/evidence` (report 02 · C3)».

Two problems, both verified:

1. **The citation does not match.** Report 02's C3 is "The focal card has no hierarchy" — about
   `.money-card` sizing on `/app`. It says nothing about `/app/evidence` or 748,900. The figure
   originates in the pre-review whole-branch code review, not report 02.
2. **The figure no longer exists.** Commit `f71fc5b` ("at-risk consistency") corrected this
   *before* the review series began. Measured on the current build, `/app/evidence` renders three
   «Під ризиком» figures — 184 000,00 + 268 000,00 + 96 500,00 = **548 500**, plus a 63 800
   non-blocking note = **612 300**, which reconciles exactly with `/app`.

**Corrected finding:** there are **two** conflicting definitions, not three. `/app` and
`/app/evidence` agree at 612 300,00 ₴. `/demo` step 5 alone reports 697 900,00 ₴. See F2.

### 0.2 — The detector found **12** objects, not 11

Reports 05 and 06 both state "11 findings", while their itemised tables sum differently. I re-ran
it: `detect.mjs --json apps/demo/src` returns **12 top-level objects**. Assessment B's own note
flagged the ambiguity and it propagated uncorrected into both reports. The triage verdicts are
unaffected — only the count was wrong.

---

## 1. Blocking — must be fixed before this is shown to anyone

### B1 — Landing header links are invisible
**Route** `/` · **File** `src/styles.css:409-410` (frozen); correction in `src/styles/demo.css`
**Evidence** «Переглянути демо» **1.0:1**; «Що входить», «Чесність» **1.9:1**; brand 17.93:1.
**Cause** rules scoped to `.landing` assume the dark hero removed in Task 11.
**Correction** override the two colour rules in `demo.css` for the light-header context.
**Sources** 01 · C1, 06 · A1. *Highest-priority item in the entire series.*

### B2 — Two unreconciled definitions of "money at risk"
**Routes** `/app` + `/app/evidence` (612 300,00 ₴) vs `/demo` step 5 (697 900,00 ₴)
**Evidence** `/app` counts 4 `evidence_missing` rows; `/demo` step 5 counts 6 amber-tone rows
(`evidence_missing` + `review_pending`). Both internally correct; neither labelled.
**Correction** adopt one definition across all three surfaces, or label each figure with its scope.
**Sources** 05 · P1 (as corrected by §0.1).
**Owner: the product, not the UI.** What "at risk" means is a decision about the argument the
demo makes. Do not let whoever picks this up first define it by accident.

### B3 — The readiness arithmetic does not close
**Route** `/app` · **File** `src/pages/App.tsx:41-48`
**Evidence** «Розподіл готовності» shows 3 + 2 + 4 = **9**, beside a denominator reading
«з 14 рядків». Five of fourteen rows are unrepresented; the dataset spans seven states, the
section shows three.
**Correction** show every state present in the data, or label the section as a subset so parts
and denominator describe the same set.
**Sources** 05 · persona red flags.
**Why blocking:** the audience reconciles columns for a living, and the product's sole asset is
honesty about numbers.

---

## 2. Cluster A — the header region *(fix once, not four times)*

Reports 01, 02, 03 and 05 each independently implicate the same bands. Report 06 §6 names the
convergence. **These must be corrected in one pass.**

| ID | Finding | Evidence | Sources |
|---|---|---|---|
| A1 | `/pilot` CTA floats detached above every `/app` h1 | measured y=121 vs h1 y=185, `demo.css:34-38`; belongs to no content group; wins the focal contest on a triage screen | 01 · I2, 02 · I2, 05 · heuristic 8 (scored **1/4**) |
| A2 | Chrome consumes the fold on operational routes | `/app/work` **421px** before first row (47% of a 900px fold), 9 rows visible; `/app` **338px**, 5 rows | 03 · I1 |
| A3 | Lime carries two meanings | active sidebar item is a solid ~242px Lime block; the primary action is also Lime; standing allocation against the ≤5% budget | 02 · I1 |

**Combined correction:** relocate the CTA out of the header band (A1), which also reclaims fold
space (A2); make the active nav state a tonal Carbon shift with a Lime edge indicator, reserving
the Lime fill for actions (A3).

**Constraint:** spec ER-7c requires `/pilot` to stay reachable and *not* be a sidebar nav item.
Both survive relocation.

---

## 3. Cluster B — money presentation *(one file, three findings)*

All in `MoneyCard.tsx` / `Work.tsx` / `demo.css`.

| ID | Finding | Evidence | Sources |
|---|---|---|---|
| B-i | No tabular numerals anywhere | `font-variant-numeric: normal` on every value; `anyTabularNumsInDoc: false`; **11px** column jitter (x=1065 vs x=1054) | 02 · C1 |
| B-ii | Money left-aligned at body weight in a currency column | `text-align: start`, 16px/400, against a row title at 700 | 02 · C2 |
| B-iii | The focal card has no hierarchy | `.money-card b` 16px/700 and `.money-card small` 16px/400 — value and label identical | 02 · C3, 05 · cognitive-load failure |

**Combined correction:** `tabular-nums` on money elements; right-align and lift the value column
to 600; demote the card label (11–12px, tracked, muted) and promote the value (24–28px, 600).
One coherent pass over money rendering.

---

## 4. Important — independent, no clustering needed

| ID | Route | Finding | Evidence | Sources |
|---|---|---|---|---|
| I1 | `/app/work` | 56 elements at 9px — **desktop only** | 1440px: 14 `<b>` + 42 `.work-row__label` at 9px. 390px: **zero**. Task 15's ≥16px floor reached the card view, never the table | 05 · P2, 06 · A3 |
| I2 | `/pilot` | Asks ten minutes, offers nothing up front | reciprocity promise «Прочитаю це особисто і напишу у відповідь» sits at `Pilot.tsx:260`, on the *success* screen — visible only after the work is done. No time estimate, no name | 05 · P1 |
| I3 | `/pilot` | `mailto:` is the only delivery path | `src/pilot/draft.ts:98-101`; on a webmail-only corporate machine «Відкрити лист» does nothing and the answers die on the device | 05 · P1 |
| I4 | `/app/evidence` | Prose does table work | «Під ризиком 184 000,00 ₴ за цим рядком, доки…» embedded mid-sentence; 2.44 screens with no overview | 02 · I3 + 03 · M1 (reports state these compound) |
| I5 | `/app/work`, `/pilot` | Two touch targets under 44px @390 | search input **22px**; footer link «Конфіденційність» **20px**. All others pass | 05 · P2, 06 · A4 |
| I6 | app surfaces @390 | Mobile type scale inflated | ~2 work cards per 390×844 screen; metadata labels bold ~17px compete with values | 01 · I1, 06 · R1 |
| I7 | `/app/rules` | ~148 characters per line | measured 1182px at 16px; `/legal/privacy` correctly capped at 672px | 05 · P2 |

---

## 5. Low — polish, safe to defer

| ID | Finding | Evidence | Sources |
|---|---|---|---|
| L1 | Two easing curves inside one transition | transform/box-shadow on `cubic-bezier(0.2,0.8,0.2,1)`, three colour props on bare `ease`, all 0.22s | 04 · F1 |
| L2 | Reduced motion also kills colour feedback | everything collapses to `1e-05s`, including `color`/`background-color` | 04 · F3, 06 · A2 |
| L3 | `surface-enter` runs 460ms | above the <300ms budget, on the catch-all route | 04 · F2 |
| L4 | No press feedback on `.icon-button` / nav links | the sole `:active` rule (`styles.css:605`) is scoped to `.button` | 04 · F4 |
| L5 | `max-width` transition animates a layout property | `demo.css:688` | 04 · F1 area, 05 + 06 detector `layout-transition` |
| L6 | 15 raw hex bypass the token layer | all palette-conformant (no-new-hex test guarantees it); token-layer drift only | 06 · T1 |
| L7 | `/roadmap` repeats one annotation ×3 | «Концептуально · не реалізовано» verbatim three times | 01 · I4 |
| L8 | `/app/evidence` corner numerals read as sequence | circled 1, 2, 2 in step-marker idiom on an unordered list | 02 · I4 |
| L9 | Readiness split has no proportional encoding | 3 chips, bare counts, `hasProportionalBar: false` | 03 · I2 — **opportunity, not a defect** |

**L2 caveat:** the `1e-05s` value itself is correct and must stay — it preserves `transitionend`
where `none` would not. Only the *scope* of the reduction is in question.

**L9 caveat:** report 03 is explicit that leaving this as chips is defensible for a B2B tool. It
must not introduce a charting library, a new hue, or colour-only encoding. Note it also overlaps
B3 — fixing the arithmetic may make the visual question moot.

---

## 6. Rejected — do not re-raise

| Rejected | Reason | Source |
|---|---|---|
| "72/72 focusable elements have `outline: none`" | Methodological error — measured at rest. Tab-focused measurement shows `outline: solid 2px rgb(72,76,94)` + Lime ring | 05 |
| `overused-font` ×8 | Inter is the approved body face. The brief wins | 05, 06 |
| `side-tab` ×4 as "slop" | Approved Lime/Amber/Red status signalling | 05, 06 |
| Nine dormant animations (`pulse-risk` 2.7s, `sync-pulse` 2.6s, `receipt-float` 4s, …) | Verified not rendering on any of the 9 routes — residue from unshipped prototype pages | 04 |
| "No press feedback on buttons" | Disproved — `styles.css:605` `.button:active { …scale(.985) }` | 04 |
| Missing loading states | No async fetch exists; `PROJECT` is a static import. Ruled deliberate in Task 14 | 03 |
| Zero `loading="lazy"` | Zero `<img>` elements; imagery is CSS background | 06 |
| Glassmorphism / OLED dark / trust-blue | Contradict doc 05 | 03 |
| Charting libraries | Violate no-new-dependencies | 03 |

---

## 7. Settled — not open to this reconciliation

Evidence Atlas palette, typography and surface budget · `styles.css` deletion-only and
byte-identical · catalog labels byte-matched · `prototype/` `technical/` `design-references/`
untouchable · Child A scope exclusions · absent dark mode (light-by-design) · `1e-05s` reduced-motion
value · the A.4.19 deviation recorded in `docs/40` §A.6.

**One item is *not* settled despite originating in the frozen sheet:** the English kicker
«EVIDENCE → PAYMENT» above the Ukrainian `h1` (01 · I3). It needs a human ruling, not silence.

---

## 8. Cannot be closed by code — queue for a human or a device

**Human decisions (block B2, I2, L9, and the kicker):**
- What "at risk" means across surfaces (B2).
- Whether the demo should visualise the readiness split at all (L9).
- Whether the copy says «я» and signs a name, rather than «ми» except twice (05 · Q3).
- Whether `ProofBoundary` belongs on `/demo` rather than `/` (05 · Q1).
- Whether the PDF download should sit beside the pilot CTA at peak-end (05 · Q2).
- The English kicker.

**Requires a human, not a decision:**
- **Native-speaker Ukrainian review.** Three reviewers found real calques during implementation.
  Nothing verifies fluency, and this copy is what earns or loses the reply.
- **Screen-reader pass.** `aria-live`, `role="status"` and the focus trap are correct in code;
  nobody has heard them.

**Requires a real device:**
- Touch targets I5 — 22px/20px certain; mis-tap risk is a hardware judgement.
- Mobile type scale I6 — needs a real screen in real conditions.
- **No engine other than headless Chrome has ever rendered this app.** No mobile Safari, no
  Firefox, at any point in the project.
- Feel-checks for L1 and L3 — whether the mixed curve is *felt*, and whether `surface-enter`
  replays per step (which determines if L3 is worth acting on at all).

**Never performed:** Lighthouse · visual QA against `selected-direction.png` · incognito load of
a live URL · automated contrast audit across all surfaces.

---

## 9. What must survive any correction

1. **Status chips never depend on colour** — icon + label + tone, labels byte-matched to the
   catalog and guarded by a mutation-tested check.
2. **`/app/evidence`'s row composition** — money-at-risk attached to the requirement causing it.
   Three reports call this the one screen that could not belong to another product.
3. **`pilot/draft.ts` and its banners** — the draft survives storage denial, refresh and failed
   submit; banners are persistent, focus-managed, and never clear input.
4. **`UnrecoverableNote.tsx`** — the Red annotation sits beside the canonical chip and drops the
   cost sentence rather than assert a false «0,00 ₴».
5. **The frozen-stylesheet contract** — byte-identical across 37 commits, no-new-hex enforced.
6. **The restrained motion system** — exactly one animation renders in the entire app. Do not
   add page transitions, scroll reveals, stagger, or skeletons.
7. **Mobile work cards leading with money and state**, and mobile tables becoming cards rather
   than horizontal scroll.
8. **The hero thesis line** and Lime-as-background-only discipline (Carbon-on-Lime 15.16:1).

---

## 10. Recommended sequence

1. **B1** — one rule, contained, unblocks the first impression.
2. **B2 and B3** — decide the definition, then fix the arithmetic. Both are honesty defects on a
   product whose only asset is honesty about numbers. B2 needs a human first.
3. **Cluster A** — one pass over the header region, not four.
4. **Cluster B** — one pass over money rendering.
5. **I1–I7** — independent, any order.
6. **L1–L9** — defer; re-evaluate L3 and L9 after the feel-check and after B3.

**Do not begin any cluster before its human decision is made.** Cluster A's CTA relocation and
B2's definition are both product calls, and a code-first answer will be wrong in a way that is
expensive to reverse.
