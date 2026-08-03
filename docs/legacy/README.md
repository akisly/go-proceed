# Legacy documentation policy

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-08-03

**Related decisions:** [ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md)

## Non-normative status

This policy is approved governance. The AktFlow-era documents, prototypes,
target schema, generated catalogs, audits, and handoff notes governed by it are
preserved as Historical migration evidence. Those legacy contents are
non-normative:
they do not define the current database, approved GoProceed scope, public API,
or release contents.

The canonical source-of-truth precedence is defined in
[`docs/README.md`](../README.md).

## Permitted use

Legacy material may be used to:

- recover a user need, workflow example, test idea, or design rationale;
- compare the implemented runtime — 33 tables across 35 migrations — with prior
  intentions;
- identify contradictions, security gaps, or missing migration steps;
- preserve discovery and prototype evidence;
- trace why information was kept, rewritten, merged, deferred, or rejected.

It may not be used to:

- claim that an unapplied table, API route, role, or workflow exists;
- expand an approved release boundary without a new ADR;
- override canonical terminology or invariants;
- infer demand validation from lead or send counts;
- authorize destructive database or file cleanup.

## Disposition process

The completed per-source matrix lives at
[`migration/goproceed-canonical-v0.1/document-disposition.csv`](../../migration/goproceed-canonical-v0.1/document-disposition.csv)
(104 unique sources as of 2026-07-30). Four legacy files stay `keep` because
running code cites them directly: `docs/22-data-api-contract.md`,
`technical/schema.sql`, `technical/openapi.yaml`, `technical/error-catalog.csv`,
and `technical/data-access-surface.csv`; they may be archived only after v0.0
re-points those references. Every legacy source is mapped to one outcome:

- `keep` — remains active without semantic change;
- `rewrite` — useful information moves to a new canonical owner;
- `merge` — overlapping sources consolidate into one canonical owner;
- `defer` — valid idea assigned to a named later version or research question;
- `archive` — retained only as historical evidence;
- `delete_after_transfer` — eligible for deletion only after transfer or
  explicit rejection is verified and the user approves the exact path.

Until that review is complete, the old project tree remains read-only.

## Interpretation rule

If a legacy source conflicts with an approved ADR or canonical target document,
the canonical source wins. If a legacy source reveals a fact missing from the
canonical model, record the conflict and resolve it explicitly; do not silently
copy the old assumption forward.

## What is here, and what replaced it

Every numbered document in this directory carries an approved disposition recorded in
[`document-disposition.csv`](../../migration/goproceed-canonical-v0.1/document-disposition.csv).
The two right-hand columns are quoted from that file verbatim rather than summarised,
so this table and the disposition record cannot drift into disagreeing.

"Information rejected" is the column worth reading, and the table holds two different
kinds of row. Read the right-hand columns to tell them apart.

**Twenty-five rows record a verdict.** A document is not here because it was wrong
about everything — it is here because a named successor absorbed what survived review.
At least one right-hand column says something: twenty-four of the twenty-five record
both what moved and what was rejected, and one — `24-legal-regulatory-gates.md` —
records only what moved.

**Nine rows record a deferral, not a verdict.** Each carries disposition `defer`,
reads `none` in *both* right-hand columns, and points its Successor column back at
this policy — this page — because no successor document exists. Nothing was carried
forward and nothing was rejected, because **the decision about what to keep has not
been made yet.** These documents are non-normative by location, but their content is
unreviewed rather than superseded, and in some cases it is the only surviving record
of what it describes. Treat one of these rows as an open question addressed to
whoever writes the successor, not as a settled judgement. They are:
[`04-screen-specification.md`](./04-screen-specification.md),
[`05-design-system.md`](./05-design-system.md),
[`10-billing-pricing.md`](./10-billing-pricing.md),
[`11-analytics-events.md`](./11-analytics-events.md),
[`20-flow-catalog.md`](./20-flow-catalog.md),
[`21-plans-entitlements-billing.md`](./21-plans-entitlements-billing.md),
[`26-sre-operations.md`](./26-sre-operations.md),
[`32-customer-country-adapters.md`](./32-customer-country-adapters.md) and
[`33-support-admin-plane.md`](./33-support-admin-plane.md).

Disposition alone does not identify them: a tenth row,
[`24-legal-regulatory-gates.md`](./24-legal-regulatory-gates.md), also carries `defer`
but names a real successor and real information that moved, so it belongs with the
twenty-five. **The `none | none` pair is the marker, not the word `defer`.**

The six documents archived on 2026-07-30 carry disposition `archive`: nothing was
carried forward from them, and they have no successor beyond this policy. That reads
like the nine above and is not the same thing — an `archive` document was reviewed and
nothing in it was worth keeping, which *is* a verdict. They are not listed below.

| Archived document | Disposition | Successor | Information moved | Information rejected |
|---|---|---|---|---|
| [`00-product-brief.md`](./00-product-brief.md) | `rewrite` | [`docs/product/vision-and-positioning.md`](../product/vision-and-positioning.md) | positioning problem statement and target segment | unverified ROI and market-size claims |
| [`01-prd.md`](./01-prd.md) | `rewrite` | [`docs/product/scope-and-boundaries.md`](../product/scope-and-boundaries.md) | v0.1 in/out boundary and deferred contexts | 126-table single-release framing |
| [`03-personas-jtbd-workflows.md`](./03-personas-jtbd-workflows.md) | `rewrite` | [`docs/product/personas-and-workflows.md`](../product/personas-and-workflows.md) | actor separation and end-to-end workflows | rigid job-title role model |
| [`04-screen-specification.md`](./04-screen-specification.md) | `defer` | [`docs/legacy/README.md`](README.md) | none | none |
| [`05-design-system.md`](./05-design-system.md) | `defer` | [`docs/legacy/README.md`](README.md) | none | none |
| [`06-data-model-permissions.md`](./06-data-model-permissions.md) | `rewrite` | [`docs/architecture/data-model.md`](../architecture/data-model.md) | identity chain and permission concepts | 126-table finance/support/offline schema |
| [`07-technical-architecture.md`](./07-technical-architecture.md) | `rewrite` | [`docs/architecture/system-overview.md`](../architecture/system-overview.md) | surface boundaries and trust model | integration-platform and support-plane runtime |
| [`08-api-integrations.md`](./08-api-integrations.md) | `rewrite` | [`technical/openapi/scope-v0.1.csv`](../../technical/openapi/scope-v0.1.csv) | BFF operation concepts | 157-operation surface and webhook platform |
| [`09-security-compliance.md`](./09-security-compliance.md) | `rewrite` | [`docs/architecture/tenancy-and-security.md`](../architecture/tenancy-and-security.md) | tenancy grants RLS and external-link security | qualified-signature and compliance claims |
| [`10-billing-pricing.md`](./10-billing-pricing.md) | `defer` | [`docs/legacy/README.md`](README.md) | none | none |
| [`11-analytics-events.md`](./11-analytics-events.md) | `defer` | [`docs/legacy/README.md`](README.md) | none | none |
| [`12-roadmap-delivery.md`](./12-roadmap-delivery.md) | `rewrite` | [`docs/product/roadmap.md`](../product/roadmap.md) | version gating idea | fixed dates and premature GA framing |
| [`13-qa-acceptance.md`](./13-qa-acceptance.md) | `rewrite` | [`docs/delivery/test-strategy.md`](../delivery/test-strategy.md) | test family concepts | claims of executed acceptance coverage |
| [`14-gtm-pilot.md`](./14-gtm-pilot.md) | `merge` | [`docs/discovery/validated-assumptions.md`](../discovery/validated-assumptions.md) | pilot gating and validation separation | lead counts framed as demand proof |
| [`15-risks-decisions.md`](./15-risks-decisions.md) | `merge` | [`migration/goproceed-canonical-v0.1/decision-register.md`](../../migration/goproceed-canonical-v0.1/decision-register.md) | decisions that survived review | superseded assumptions |
| [`17-production-readiness-index.md`](./17-production-readiness-index.md) | `rewrite` | [`docs/delivery/production-readiness.md`](../delivery/production-readiness.md) | pilot gate concepts | production-ready claims |
| [`18-domain-state-machines.md`](./18-domain-state-machines.md) | `rewrite` | [`technical/states/state-catalog.csv`](../../technical/states/state-catalog.csv) | lifecycle concepts | mutable-status state machines |
| [`19-organizations-roles-access.md`](./19-organizations-roles-access.md) | `rewrite` | [`docs/architecture/tenancy-and-security.md`](../architecture/tenancy-and-security.md) | governance versus operational responsibility split | thirteen rigid membership roles |
| [`20-flow-catalog.md`](./20-flow-catalog.md) | `defer` | [`docs/legacy/README.md`](README.md) | none | none |
| [`21-plans-entitlements-billing.md`](./21-plans-entitlements-billing.md) | `defer` | [`docs/legacy/README.md`](README.md) | none | none |
| [`23-offline-media-protocol.md`](./23-offline-media-protocol.md) | `rewrite` | [`docs/architecture/files-and-storage.md`](../architecture/files-and-storage.md) | upload intent and integrity concepts | v0.1 offline authorization and resumable chunks |
| [`24-legal-regulatory-gates.md`](./24-legal-regulatory-gates.md) | `defer` | [`docs/delivery/production-readiness.md`](../delivery/production-readiness.md) | gate concept referenced as external gates | none |
| [`25-security-threat-model.md`](./25-security-threat-model.md) | `merge` | [`docs/architecture/tenancy-and-security.md`](../architecture/tenancy-and-security.md) | threat families for auth storage and external links | threats for unshipped finance/support planes |
| [`26-sre-operations.md`](./26-sre-operations.md) | `defer` | [`docs/legacy/README.md`](README.md) | none | none |
| [`27-qa-traceability.md`](./27-qa-traceability.md) | `rewrite` | [`technical/database/invariant-catalog.csv`](../../technical/database/invariant-catalog.csv) | invariant-to-test traceability idea | coverage claims without executed tests |
| [`28-pilot-ga-delivery.md`](./28-pilot-ga-delivery.md) | `rewrite` | [`docs/delivery/version-0.1.md`](../delivery/version-0.1.md) | milestone slicing idea | GA commitments |
| [`30-validation-evidence-register.md`](./30-validation-evidence-register.md) | `rewrite` | [`docs/discovery/validated-assumptions.md`](../discovery/validated-assumptions.md) | evidence-kind separation | rows treating research as validation |
| [`31-architecture-decisions.md`](./31-architecture-decisions.md) | `merge` | [`docs/decisions/ADR-001-product-boundary.md`](../decisions/ADR-001-product-boundary.md) | decisions surviving review across ADR-001..004 | superseded decisions |
| [`32-customer-country-adapters.md`](./32-customer-country-adapters.md) | `defer` | [`docs/legacy/README.md`](README.md) | none | none |
| [`33-support-admin-plane.md`](./33-support-admin-plane.md) | `defer` | [`docs/legacy/README.md`](README.md) | none | none |
| [`34-production-gate-checklist.md`](./34-production-gate-checklist.md) | `rewrite` | [`docs/delivery/production-readiness.md`](../delivery/production-readiness.md) | checklist concept | claims of satisfied gates |
| [`35-data-access-tenancy.md`](./35-data-access-tenancy.md) | `rewrite` | [`docs/architecture/tenancy-and-security.md`](../architecture/tenancy-and-security.md) | grant/RLS layering | legacy role matrix |
| [`36-security-verification-profile.md`](./36-security-verification-profile.md) | `rewrite` | [`docs/delivery/test-strategy.md`](../delivery/test-strategy.md) | security test families | claimed verification results |
| [`40-phase1-discovery-outreach.md`](./40-phase1-discovery-outreach.md) | `merge` | [`docs/discovery/outreach-log.md`](../discovery/outreach-log.md) | workbook-evidenced outreach facts and deferred-debt records | send counts framed as validation |
