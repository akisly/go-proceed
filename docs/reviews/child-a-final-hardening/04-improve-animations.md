# 04 — animation and motion audit

**Scope:** `apps/demo` — existing hover, transition and motion system.
**Date:** 2026-07-26
**Branch:** `feat/p0a-child-a-prototype`
**Status:** **Report only. No files were modified. No plan files were written.**
**Character constraint:** the serious operational B2B character is preserved. Restraint is the
correct answer for this product; findings below do not propose adding delight.

**Method:** Recon of the motion surface, then audit against the eight categories in the skill's
`AUDIT.md`, then vetting — every finding was re-confirmed at its `file:line`, and every animated
selector was checked against **live computed styles across all 9 shipped routes** before being
reported. Reduced-motion behaviour was measured by emulating the media feature, not inferred.

> This report is not an implementation instruction. See [README.md](README.md).

---

## Recon

| Fact | Value |
|---|---|
| Motion libraries | **None.** No Framer Motion, React Spring, GSAP, Lottie. Plain CSS only. |
| Where motion lives | `src/styles.css` (frozen, deletion-only): 12 transitions, 14 animation declarations, 12 `@keyframes`. `src/styles/demo.css`: 3 transitions, 0 animations, 0 keyframes. |
| `ease-in` occurrences | **0** in both files |
| `transition: all` occurrences | **0** in both files |
| `scale(0)` occurrences | **0** |
| `prefers-reduced-motion` blocks | 6 in `styles.css`, 3 in `demo.css` |
| Personality | Crisp operational dashboard, not consumer |
| Highest-frequency animated surface | `/demo` — the router catch-all target, so the most-visited route |

**Structural constraint:** `src/styles.css` is a deletion-only copy of the approved design
system and is byte-identical to `prototype/src/styles.css`. It **cannot be edited**. Any
correction to motion defined there must be an override in `src/styles/demo.css`.

---

## The headline result: this motion system is already restrained

Measured across all 9 shipped routes, **exactly one animation renders anywhere in the
application**:

```
surface-enter | 0.46s | iteration-count 1 | .onboarding-content  @ /demo
surface-enter | 0.46s | iteration-count 1 | .pilot-form          @ /pilot
```

Everything else is transitions on hover/focus/press. There is no ambient motion, no infinite
loop, no scroll-triggered choreography, no page-transition system. For an operational B2B tool
this is the right answer, and it should not be "improved" by adding motion.

---

## Vetted and rejected — reported here so they are not re-raised

The frozen stylesheet **defines** nine further animations, several of them infinite:

`pulse-risk` (2.7s infinite), `sync-pulse` (2.6s infinite), `receipt-float` (4s infinite),
`float-in` (0.8s), `rail-enter` (0.65s), `surface-enter`, `atlas-folio-enter`,
`atlas-card-enter` ×2, `atlas-stamp-enter`, `spin` (1s linear infinite), `drawer-in`,
`receipt-in`.

**None of them render on any shipped route.** I checked computed `animationName` on every
element across `/`, `/demo`, `/app`, `/app/work`, `/app/evidence`, `/app/rules`, `/pilot`,
`/roadmap`, `/legal/privacy` — only `surface-enter` appears.

They are residue from prototype pages this demo does not ship (`.financial-rail`,
`.field-receipt-stamp`, `.hero-atlas__*`, `.sync-ok`). Reporting a 4-second infinite float or a
2.7-second risk pulse as a motion defect would be reporting dead CSS as live behaviour. They
belong to the frozen file's expected residue, not to this audit.

**Also rejected:** "no press feedback on buttons" — nearly filed, then disproved.
`src/styles.css:605` defines `.button:active { transform: translateY(0) scale(.985); box-shadow: none; }`.
Press feedback exists and is within the subtle range the playbook asks for.

---

## Findings

| # | Severity | Category | Location | Finding |
|---|---|---|---|---|
| F1 | MEDIUM | Easing & cohesion | `src/styles.css:768` (live on `.button`, `.work-row`, `.panel`) | Two different curves inside one transition |
| F2 | LOW | Duration & frequency | `src/styles.css:817` (`surface-enter`) | 460ms entrance on the highest-traffic route |
| F3 | LOW | Accessibility | reduced-motion blocks, both files | Kill-switch removes colour feedback, not just movement |
| F4 | LOW | Physicality | `src/styles.css:605` scoping | `.icon-button` and nav links have no press state |

### F1 — MEDIUM — Two different easing curves inside a single transition

**Location:** defined around `src/styles.css:768`; measured live on `.button`, `.button--signal`,
`.button--outline`, `.work-row`, `.panel`, `.icon-button` across `/`, `/demo`, `/app`,
`/app/work`, `/app/evidence`, `/pilot`.

**Evidence — measured computed style:**

```
transition-property:        transform, box-shadow, border-color, background-color, color
transition-duration:        0.22s, 0.22s, 0.22s, 0.22s, 0.22s
transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1), ease, ease, ease, ease
```

The transform and box-shadow ride a strong ease-out (`cubic-bezier(0.2, 0.8, 0.2, 1)` — correct,
and used consistently throughout the sheet). The three colour properties fall back to bare
`ease` (`cubic-bezier(0.25, 0.1, 0.25, 1)`), which carries a slow-start portion. On the same
element, at the same 220ms, the lift and the colour change are on different curves — the colour
lags the movement slightly.

The playbook's §2 explicitly hunts for bare `ease` on entrances.

**Narrowest proposed correction:** in `demo.css`, restate the colour properties on the same
`cubic-bezier(0.2, 0.8, 0.2, 1)` for the affected selectors. No duration, palette or token
change.

**Uncertainty, stated honestly:** at 220ms the perceptual difference between `ease` and a strong
ease-out on a colour change is small. I can confirm the incoherence from the computed values but
**cannot judge from code whether it is felt.** Any correction should carry a feel-check
(slow the transition to ~2s in devtools and watch whether colour and lift arrive together)
before being accepted as worthwhile.

### F2 — LOW — 460ms entrance on the highest-traffic route

**Location:** `src/styles.css:817` — `animation: surface-enter .46s cubic-bezier(.2,.8,.2,1) both;`
Live on `.onboarding-content` (`/demo`) and `.pilot-form` (`/pilot`).

**Evidence:** measured `animationDuration: 0.46s`, `iteration-count: 1`. The playbook's duration
budget puts UI animations under 300ms; 460ms sits above it. `/demo` is where the router's
catch-all sends every unknown path, making it the most-visited surface in the product.

The curve itself is correct (strong ease-out) and it is a one-shot, not a loop.

**Narrowest proposed correction:** override the duration to ~240–280ms in `demo.css` for the two
live selectors, keeping the existing curve.

**Feel-check required, and it may nullify this finding:** I could not determine from code whether
`surface-enter` **replays on every step change** in the five-step `/demo` journey. If the step
panel remounts, a 460ms entrance fires up to five times per visit and the finding is worth
acting on. If the element persists and only its children change, it fires once per page load and
460ms on a single page entrance is defensible. **Verify before acting.**

### F3 — LOW — The reduced-motion kill-switch also removes colour feedback

**Evidence — measured by emulating the media feature on `/demo`:**

| `prefers-reduced-motion` | `.onboarding-content` animation | `.button` transition-duration |
|---|---|---|
| `no-preference` | `surface-enter` / 0.46s | 0.22s |
| `reduce` | `none` / 1e-05s | **1e-05s** |

Reduced motion is genuinely wired and genuinely works — this is a pass, and a real one. The
narrow observation is that it collapses **everything** to effectively zero, including
`background-color` and `color` transitions. The playbook's §6 guidance is to drop movement while
keeping opacity and colour transitions, so a user on reduced motion still gets hover and focus
feedback rather than instant hard switches.

**Narrowest proposed correction:** exempt `color`, `background-color` and `border-color` from
the reduction, keeping `transform` and `box-shadow` suppressed.

**Note:** using `1e-05s` rather than `none` is the *correct* implementation choice — it preserves
`transitionend` events. That should not be changed.

### F4 — LOW — Press feedback is scoped to `.button` only

**Location:** `src/styles.css:605` — the sheet's only `:active` rule, scoped to `.button`.

**Evidence:** `.icon-button` (mobile menu toggle, sidebar close) and the sidebar nav anchors
carry `transform` in their transition list — measured live on `/app`, `/app/work`,
`/app/evidence` — but no `:active` state, so the transform never fires on press. They animate on
hover and focus but give no tactile confirmation when clicked.

On touch, where hover does not exist, these controls have no press response at all.

**Narrowest proposed correction:** extend a `scale(.985)` `:active` state to `.icon-button` and
sidebar nav links in `demo.css`, matching the existing `.button` value exactly.

---

## Missed opportunities

Deliberately short. The brief is to preserve serious operational character, and the playbook
treats "the motion here is already right" as a valid result.

1. **Filter changes on `/app/work` swap the row set instantly.** A 120–150ms opacity settle on
   the results region would soften the jump without decorating it. **Weakly held** — instant
   is defensible, arguably preferable, for a data tool where users filter repeatedly. Offered
   as an option, not a recommendation.
2. **Nothing else.** The banners, the draft-restored notice and the step transitions are all
   instant, and they should stay instant: the banners are `role="alert"`/`role="status"`, and
   delaying an error that carries the user's only route to saving their answers would be worse,
   not better.

**Explicitly not recommended:** page transitions, scroll-triggered reveals, staggered list
entrances, skeleton shimmer, or any ambient motion. Each would erode the operational character
this product depends on, and the skeleton case is additionally moot — there is no async data.

---

## Findings requiring a human or a real device

- **F1** — whether the mixed curve is *felt* cannot be judged from computed values. Needs a
  slow-motion feel-check.
- **F2** — needs confirmation of whether `surface-enter` replays per step in the `/demo`
  journey. This determines whether the finding is worth acting on at all.
- **Touch press feedback (F4)** — the absence is confirmed in code, but its impact is a
  real-device judgement on hardware, where there is no hover state to compensate.
