# Vision and positioning

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md)

## Product vision

GoProceed helps specialist construction teams make performed work ready for
acceptance through a traceable flow of quantity, requirements, evidence,
packages, and external decisions.

The product turns a recurring coordination problem into a shared,
evidence-backed process:

```text
what the contract permits
→ what was performed
→ what proves it
→ what was packaged
→ what each required reviewer decided
→ what value is accepted, returned, or still at risk
```

GoProceed is not an accounting system. Its early job is to produce trustworthy
acceptance facts that a later commercial or accounting process can consume.

## Initial customer hypothesis

The initial target is a specialist contractor or subcontractor that:

- performs measurable construction work under one or more contracts;
- must collect photos, forms, acts, measurements, or other evidence;
- coordinates site staff, engineering staff, and package preparation;
- sends completed-work packages to a customer or technical-supervision party;
- loses time or commercial clarity when quantity and evidence are spread across
  spreadsheets, messengers, folders, and email.

The most useful first pilot has repeated work packages, identifiable quantities,
at least one external reviewer, and a real return/correction loop. This is a
product hypothesis until interviews and pilot commitments provide stronger
evidence.

## Category boundary and wedge

The current market already has broad products for mobile field capture,
checklists, drawings, document versions, and approval workflows. Examples
include [Autodesk Forma field and approval workflows](https://construction.autodesk.com/resources/autodesk-build/onboarding-to-autodesk-build/),
[PlanRadar document approvals](https://help.planradar.com/hc/en-gb/articles/31373315559837-Approvals),
[Dalux Field quality control](https://www.dalux.com/products/dalux-field/), and
[Fieldwire mobile inspections](https://help.fieldwire.com/hc/en-us/articles/360004919952-Introduction-to-Inspection-Request-Forms).

GoProceed should not begin as another broad field-management suite. Its wedge is
the acceptance boundary for specialist contractors: exact contract quantity,
evidence, immutable package versions, protected external decisions, and
explainable value at risk in one lineage. This is a strategy inference from the
landscape, not proof that the wedge has market demand.

## User value

### For the contractor team

- one contract baseline links performed quantity to evidence and package lines;
- an iOS/Android field client keeps capture focused on assigned work;
- missing or returned scope is visible before and after submission;
- package contents and versions remain reproducible;
- responsibility is explicit without forcing construction job titles into
  access roles;
- accepted, returned, and pending value is explainable down to claim segments.

### For the customer or technical supervisor

- a personal protected link opens the exact package version;
- no workspace account or separately entered code is required;
- quantity and evidence can be accepted or returned independently;
- partial decisions do not force an all-or-nothing package result;
- every submitted decision has a stable receipt and target.

### For management

- value at risk is derived from traceable operational facts;
- currencies, missing prices, and over-contract work are not silently blended;
- the system shows where acceptance is blocked rather than inventing a single
  opaque package status.

## Positioning statement

For specialist construction teams that need to turn performed work into
accepted work, GoProceed is a contract-to-acceptance evidence workflow that
connects quantity, proof, immutable packages, and reviewer decisions. Unlike a
generic file room or spreadsheet register, it preserves the exact relationship
between the contract baseline, performed scope, evidence, and each partial
acceptance outcome.

## Product principles

1. **Facts before dashboards.** Current status is derived from immutable or
   append-only source facts.
2. **Exact scope before aggregate status.** Quantity decisions address stable
   claim segments, not unidentified portions.
3. **Evidence and money remain connected but distinct.** Returning evidence
   cannot silently change accepted value.
4. **External review must be simpler than onboarding.** A protected email link
   opens a narrow review surface without a workspace account.
5. **Version history is not rewritten.** Contract, package, and decision history
   remains attributable to the exact version reviewed.
6. **No hidden financial assumptions.** Currency, tax basis, price state, and
   rounding are explicit.
7. **AI proposes; people decide.** Any later AI assistance remains reviewable
   and cannot become a contract or acceptance authority.

## Evidence and claim discipline

The product is currently in documented design and pre-pilot development.
Outreach volume is not market validation. The canonical discovery record must
separate lead mapping, evidenced sends, founder-reported sends, replies,
interviews, artifact access, named pilot projects, and commitments.

Marketing, demo, and sales material may not claim proven commercial impact,
regulated identity assurance, comprehensive offline operation, statutory
accounting, or verified operational compliance until corresponding evidence and
release gates exist.

## North-star outcome

The primary v0.1 outcome is:

> A real package can be built from a versioned contract baseline and performed
> quantity, reviewed internally, sent through a protected link, decided
> partially by every required external reviewer, and explained as accepted,
> returned, pending, or blocked value without losing provenance.

Usage counts are supporting signals, not substitutes for that outcome.
