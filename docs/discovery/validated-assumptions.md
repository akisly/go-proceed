# Validated and unvalidated assumptions

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md)

## Validation rule

Public research, internal specification quality, lead counts, and send counts
are never converted into customer validation. An assumption moves only on
direct evidence from a named external person or organization. Each evidence
kind is tracked separately and in this order of strength:

1. **Reply** — a human response to outreach;
2. **Artifact access** — the prospect opened/used a shared artifact;
3. **Interview** — a recorded problem/workflow conversation;
4. **Named project** — a concrete project identified for the workflow;
5. **Pilot commitment** — an agreed pilot with success measures;
6. **Willingness to pay** — an explicit price conversation or commitment.

## Assumption ledger

| ID | Assumption | Reply | Artifact access | Interview | Named project | Pilot commitment | Willingness to pay | Status |
|---|---|---|---|---|---|---|---|---|
| A-1 | Specialist construction teams lose money because performed work is not made acceptance-ready in a traceable way | none | none | none | none | none | none | Unvalidated |
| A-2 | The contract-quantity → evidence → package → external decision loop matches how acceptance actually happens for the target teams | none | none | none | none | none | none | Unvalidated |
| A-3 | External customer/technical-supervision reviewers will decide inside a protected link without an account or OTP | none | none | none | none | none | none | Unvalidated |
| A-4 | Field crews will capture evidence through a mobile client at the moment of work | none | none | none | none | none | none | Unvalidated |
| A-5 | Acceptance value at risk is a number the commercial lead wants weekly | none | none | none | none | none | none | Unvalidated |
| A-6 | XLSX/CSV import covers the real contract-baseline formats of the target segment | none | none | none | none | none | none | Unvalidated |
| A-7 | Teams will pay for the closed acceptance loop (pricing unexplored) | none | none | none | none | none | none | Unvalidated |

As of 2026-07-30 there are zero replies, artifact accesses, interviews, named
projects, pilot commitments, or willingness-to-pay signals on record. The 21
evidenced sends (see [outreach-log.md](outreach-log.md)) are awaiting
response; nothing in this table may be upgraded on send activity alone.

## What existing work does and does not validate

- The approved specification and technical catalogs validate internal design
  coherence, not customer demand.
- Public research behind the 22 newly researched leads validates that the
  segment exists, not that it wants GoProceed.
- Roadmap milestone entry evidence (recorded walkthroughs per
  [version-0.1.md](../delivery/version-0.1.md)) is the mechanism that will
  move A-1..A-6; A-7 additionally needs explicit pricing conversations.

## Update rule

Every change to this table cites a dated evidence artifact (call note,
recording reference, signed pilot outline). Downgrades are recorded the same
way as upgrades; deleting a failed assumption is not allowed — mark it
`Invalidated` with the evidence.
