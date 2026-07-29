# ADR-001: GoProceed v0.1 product boundary

**Status:** Approved

**Applies to:** v0.0 and v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-002](ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](ADR-004-roadmap-demo-and-documentation.md)

## Context

The prior package combined construction evidence, acceptance, accounting,
payments, SaaS billing, support, integrations, offline synchronization, and
later lifecycle operations in one early target. The implemented database is a
six-table tenant foundation, so that target could not safely serve as either a
migration baseline or a credible first product.

The first product must close one valuable operational outcome while preserving
clean extension boundaries for later commercial and accounting contexts.

## Decision

GoProceed v0.1 closes the online contract-to-acceptance-and-risk loop:

```text
contract baseline
→ assignment and performed quantity
→ requirements and evidence
→ internal review
→ immutable package version
→ protected external review
→ partial acceptance or return
→ derived acceptance value at risk
```

The source product records exact performed quantity, evidence, package contents,
external decisions, and their provenance. Current readiness, acceptance, and
value at risk are derived from those facts.

v0.0 is the prerequisite foundation release: canonical documentation, additive
security corrections, a safe migration path, and a reproducible green test
baseline.

## Included in v0.1

- multiple workspace-owned legal entities;
- projects and contracts with explicit own and customer parties;
- controlled XLSX and CSV contract-baseline import;
- versioned contract work items and source provenance;
- assignments and append-only performed-quantity entries;
- a separate online-only Expo/React Native field client for iOS and Android
  with safe whole-upload retry;
- requirements, exceptions, internal review, and readiness;
- immutable package versions and artifacts;
- protected external review by personal email link without a workspace account;
- parallel required approvers and observers;
- line- and claim-segment-level partial acceptance or return;
- separate quantity and evidence decisions;
- accepted, returned, pending, and blocked quantities and values;
- value at risk grouped by currency with explicit tax and rounding rules.

## Explicitly deferred

The following do not belong to the v0.1 runtime:

- full offline authorization, task browsing, synchronization, conflict
  resolution, and resumable upload;
- variations and change orders;
- receivables, invoices, retentions, deductions, payments, allocations, and
  reconciliation;
- statutory or tax accounting;
- SaaS billing and entitlement monetization;
- webhook integrations;
- support impersonation or support access;
- automated legal hold and retention jobs;
- qualified electronic signature;
- custom role builders;
- sequential enterprise approval routing;
- AI acting as a decision authority.

Project Commercials may begin in v0.4+ as a subledger and export layer over
finalized acceptance facts. Full accounting remains a separate bounded context.

## Financial boundary

v0.1 may calculate only acceptance-relevant exposure from canonical quantity,
price, currency, tax basis, precision, and rounding policy. It does not create
an accounting entry or payment obligation.

Values of different currencies are never silently combined. Missing price, zero
price, and over-contract performance remain distinct states.

## Consequences

- Early implementation is smaller than the legacy 126-table target.
- Later finance can consume stable acceptance facts without owning evidence or
  changing historical decisions.
- A feature is not added to v0.1 merely because a legacy table or screen exists.
- Product claims must not imply paying customers, proven ROI, full accounting,
  full offline operation, qualified signature, or production compliance unless
  separately verified.

## Replacement rule

Changing the v0.1 outcome boundary requires a superseding ADR that identifies
the user evidence, version impact, data ownership, security impact, and migration
cost. A backlog item alone cannot expand this boundary.
