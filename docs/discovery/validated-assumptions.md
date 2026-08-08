# Validated and unvalidated assumptions

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-08-06

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md),
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](../decisions/ADR-007-pilot-field-client.md)

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
| A-8 | The incumbent GoProceed must displace in the field is a Telegram group, not a competing product | founder-reported | none | none | none | none | none | Unvalidated |

As of 2026-07-30 there were zero signals of any kind on record. The 21 evidenced
sends (see [outreach-log.md](outreach-log.md)) were awaiting response; nothing
in this table may be upgraded on send activity alone.

## Founder-reported signal, 2026-08-05 — recorded, not yet evidence

The owner reports that **several companies have confirmed the problem exists**,
and that those companies **currently photograph work through Telegram**.

This is the first market signal in the project's history and it is recorded
here so it is not lost. Under this document's own validation rule it does not
move any assumption, because an assumption moves only on direct evidence from a
**named** external person or organization, and this record currently has:

- no company names;
- no dates;
- no call notes or recordings;
- **no customer documents of any kind** — the owner states plainly that no
  example акт, кошторис, КБ-2в or виконавча документація has been obtained. The
  only document content the project holds is what was sourced from the
  standards themselves (see
  [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)).

### What this would change if it were validated

Recorded so the implication is not lost, and **not** acted on until A-8 leaves
`Unvalidated`:

1. **The incumbent may be Telegram rather than a competing product.** If that
   is confirmed by named companies with dates, the product's first job is to be
   easier for a foreman than sending a photo to a group chat, and its second is
   to produce something a group chat cannot: a document. Until then this is one
   unnamed, undated, document-free report, and it must not drive a capture-UX
   decision, a roadmap change, or a positioning sentence — including any claim
   that HoldPoint QA or CleverBud is not the competitor.
2. **A-6 is now the sharpest open risk, not A-1** — this one does not depend on
   the signal at all. It rests on the absence recorded above: zero customer
   documents of any kind. Contract-baseline import was
   specified against no real file. With zero customer documents, the import
   schema cannot be frozen against reality, and
   [roadmap.md](../product/roadmap.md) made a representative sanitized artifact
   an *entry* condition for the M1 that shipped without one. ADR-006 re-cut that
   milestone and froze import, so the condition no longer gates M1 — it now gates
   the point at which import is unfrozen.

### What would upgrade it

The minimum to move **A-8** — the assumption this signal is actually about —
from `Unvalidated`, which is also what A-1 needs:

- the companies named in [outreach-log.md](outreach-log.md) with dates;
- one recorded or noted conversation per company;
- for each: the last five payment delays and their stated cause, the number of
  segments returned last quarter and on what grounds, and how many акти на
  закриття прихованих робіт on the current site were signed **before** covering.

The minimum to move A-6: **one real sanitized кошторис or АВР file.** Until one
exists, any import work is built against an assumption.

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
