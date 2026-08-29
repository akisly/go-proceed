# Child A — final hardening review series

Review reports for `apps/demo` on branch `feat/p0a-child-a-prototype`, captured after
the twenty implementation tasks completed and the whole-branch code review closed.

## Status of these documents

**Reports 01–06 are not implementation instructions.** They have now been reconciled into
[07-consolidated-findings.md](07-consolidated-findings.md), which supersedes them where they
conflict and is the actionable list. Reports 01–06 remain as evidence.

The original caveat, still true of 01–06 individually:

Each report is the unreconciled output of a single review pass. Findings have not been
triaged against the approved specification, against each other, or against Child A's
scope boundaries. Some may conflict; some may be out of scope; some may be wrong.

Findings become actionable only after they are reconciled through
`superpowers:receiving-code-review`. Until then, treat every report as evidence for a
decision that has not yet been made.

Do not implement directly from these documents.

## Fixed constraints that bind every pass

These are not open to revision by a review:

- The approved **Evidence Atlas** direction (`docs/05-design-system.md`) governs palette,
  typography and the surface budget: Paper/White 74–78%, Carbon 17–21%, Lime ≤5%;
  Manrope Variable 700–800 display, Inter Variable 400–700 body.
- `apps/demo/src/styles.css` is a **deletion-only copy** of the approved design system and
  is byte-identical to `prototype/src/styles.css`. A test enforces this. All demo-specific
  CSS belongs in `apps/demo/src/styles/demo.css`, introducing no literal hex absent from
  the source stylesheet.
- `technical/state-catalog.csv` is the authoritative product vocabulary. Readiness labels
  are matched byte-for-byte and may not be reworded per page.
- `prototype/`, `technical/` and `design-references/` must not be modified.
- Child A scope: no backend, Supabase, authentication, RLS, offline support, real billing,
  Child B or Phase 2.

## Planned review passes

| # | Pass | Status | Report |
|---|---|---|---|
| 01 | `frontend-design` — visual direction, typography, composition, first impression | Complete | [01-frontend-design.md](01-frontend-design.md) |
| 02 | `interface-design` — product interface, operational hierarchy, density, tables and money | Complete | [02-interface-design.md](02-interface-design.md) |
| 03 | `ui-ux-pro-max` — dashboard density, operational data visualization, restrained B2B patterns | Complete | [03-ui-ux-pro-max.md](03-ui-ux-pro-max.md) |
| 04 | `improve-animations` — hover, transition and motion system | Complete | [04-improve-animations.md](04-improve-animations.md) |
| 05 | `impeccable critique` — full-artifact UX critique, heuristic scoring | Complete | [05-impeccable-critique.md](05-impeccable-critique.md) |
| 06 | `impeccable audit` — technical: a11y, performance, theming, responsive, integrity | Complete | [06-impeccable-audit.md](06-impeccable-audit.md) |
| 07 | Reconciliation via `superpowers:receiving-code-review` | **Complete** | [07-consolidated-findings.md](07-consolidated-findings.md) |

Passes 01–04 were all run report-only, with no files modified. Pass 03 generated no design
system and persisted nothing — `docs/05-design-system.md` remains the only design system.
Pass 04 wrote no plan files; its findings live in the report only. Pass 05 ran as a dual
sub-agent critique (not degraded) and rejected two sub-agent findings on verification. Pass 06
separates automated findings from those needing a real device or a human (its section 8).

## What no pass has covered

Recorded so these gaps are not mistaken for clean results. Each requires a human, a real
device, or tooling not present in this environment:

- Native-speaker review of the Ukrainian copy. Three separate reviewers found real calques
  during implementation, which raises rather than lowers the estimate that more remain.
- Screen-reader verification (VoiceOver / NVDA).
- Real Android and real iPhone over mobile data. Headless Chrome at three viewports is
  related to this but is not a substitute.
- Automated colour-contrast audit across all surfaces. `axe-core` would be a new dependency;
  contrast findings in these reports were computed manually from measured values.
- Incognito load of a live public URL. The site is not deployed, deliberately.
- Visual QA against `design-references/evidence-atlas/selected-direction.png`.
- Lighthouse (gate item 15).

## Related records

- Execution ledger with every controller ruling and accepted deviation:
  `.superpowers/sdd/2026-07-26-p0a-child-a-discovery-prototype/progress.md` (git-ignored).
- Deferred repository debt and the recorded A.4.19 deviation: `docs/40-phase1-discovery-outreach.md` §A.6.
- Twenty-item verification gate and its 8 NOT DONE items: Task 20's report.
