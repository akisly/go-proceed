# Scope and boundaries

**Status:** Approved

**Applies to:** v0.0 and v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md)

## Release boundary

v0.0 makes the foundation safe and reproducible. v0.1 closes the online
contract-to-acceptance-and-risk loop:

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

No standalone feature belongs to v0.1 unless it is required to complete this
loop safely for a real pilot.

## v0.0 foundation

v0.0 includes:

- canonical product, domain, architecture, and delivery documentation;
- explicit dispositions for legacy sources;
- tenant isolation for the existing foundation;
- permission-aware own-party management;
- serialized first-owner bootstrap;
- append-only audit enforcement;
- bounded, expiring idempotency records;
- real outbox claim, retry, backoff, error, and dead-letter behavior;
- environment-safe development seeds;
- deny-by-default future database privileges;
- resolved dependency build-script policy;
- a reproducible local database and green baseline test command;
- verified migration and rollback paths for additive changes.

v0.0 does not claim that the v0.1 domain already exists.

## v0.1 included capabilities

### Workspace, parties, and access

- one workspace with several of its own legal entities;
- official legal profile and EDRPOU per own entity;
- projects that may contain contracts of different own entities;
- tenant-local counterparties and contacts;
- workspace governance roles;
- separate project access and composable responsibility assignments;
- audit warning when one person combines sensitive responsibilities.

### Contract baseline and import

- one own party and one customer party per contract;
- draft and immutable published contract versions;
- XLSX and CSV import of acceptance-relevant work rows;
- code, description, section, unit, quantity, unit price, amount, currency, tax
  basis, optional location, and external identifiers;
- file hash, parser version, mapping version, worksheet, source row, raw values,
  normalized preview, validation, and explicit publish confirmation;
- reimport as a new version with diff and work-item lineage;
- formula, macro, archive, file-size, worksheet, and row safety limits;
- export neutralization against spreadsheet formula injection.

### Execution and online mobile evidence

- work assignments with optional member assignee and due date;
- performer party, location, planned quantity, and requirement-template version;
- append-only performed-quantity entries and referenced corrections;
- a separate `apps/mobile` client built with Expo/React Native for iOS and
  Android;
- v0.1 pilot support floor of iOS 16.4+ and Android 10+, verified against the
  actual pilot-device inventory before M2 UX freeze;
- online-only camera capture and platform photo/file selection;
- EAS internal preview distribution and TestFlight/Google Play internal pilot
  distribution; public store listing is not required;
- local original retained until server receipt and integrity confirmation;
- pending original and whole-upload retry state survive an ordinary app restart;
- idempotent whole-upload retry and visible send states;
- immutable evidence hashes, provenance, recorder, performer, source party,
  custodian, claimed capture time, and server receipt time;
- originals, derivatives, corrections, and many-to-many requirement links.

### Requirements and internal review

- immutable requirement-template versions;
- concrete occurrences for assignment and quantity/location scope;
- append-only waiver, not-applicable, and accept-risk exceptions;
- append-only internal evidence/requirement decisions;
- derived readiness on acceptance-homogeneous scope;
- internal queues that do not become a second source of truth.

### Packages and external acceptance

- one package per contract/series/period container;
- immutable frozen package versions;
- deterministic PDF, XLSX, ZIP, and manifest artifacts from one snapshot;
- acceptance-homogeneous package lines;
- exact claim segments linked to progress sources;
- multiple parallel required approvers and observers;
- personal protected email link with no workspace account or separately entered
  code;
- fragment-to-POST token exchange and short revocable session;
- separate external quantity and evidence decisions;
- partial quantity decisions with reconciled segment partition;
- immutable decision batches, issues, and submission receipts;
- correction, resubmission, and references to unchanged prior acceptance.

### Acceptance and value at risk

- disjoint accepted, returned, submitted-pending, packaged-not-submitted,
  internal-review, evidence-blocked, and ready-not-packaged states;
- accepted, returned, and pending quantity;
- value derived from price, currency, tax basis, precision, and rounding;
- grouping by currency without hidden exchange conversion;
- distinct missing price, zero price, and over-contract exposure;
- drill-down from project summary to exact contract, package, line, and segment.

## Not included in v0.1

### Offline and device operation

- offline authorization;
- offline task browsing;
- background synchronization;
- multi-device conflict resolution;
- resumable chunk upload.

These belong to v0.3. v0.1 connection-loss protection is a safe retry of an
online capture, not an offline workflow. v0.3 extends the same `apps/mobile`
client rather than replacing it.

### Commercial and accounting contexts

- variations and change orders;
- receivables and invoices;
- retentions and deductions;
- payments and allocations;
- bank reconciliation;
- statutory and tax ledgers;
- posting periods and journals;
- official accounting documents.

Project Commercials begins no earlier than v0.4+ and consumes finalized
acceptance facts through a separate subledger/export boundary.

### Platform expansion

- SaaS subscription billing;
- custom entitlement packaging;
- customer support access or impersonation;
- public webhooks and third-party integrations;
- custom role builder;
- sequential enterprise approval routing;
- automated retention and legal-hold engine;
- regulated e-signature assurance.

### AI

v0.1 has no required AI runtime or unused AI tables. Later assistance may
suggest mappings, extraction, evidence-quality checks, links, summaries, or
remediation. Every suggestion requires human confirmation and retains run/model
provenance appropriate to that feature.

## Cross-cutting minimum before real pilot data

- privacy notice and versioned external confirmation text;
- documented retention periods and manual closure/deletion procedure;
- workspace export;
- restricted audit and security telemetry;
- backup and restore verification;
- documented external-link assurance limits;
- tenant-isolation tests for every module;
- malware/content-type and resource-exhaustion controls for uploads/imports;
- secrets and environment separation;
- monitored job and message failure paths.

## Scope decision test

A proposed v0.1 feature must answer yes to all of:

1. Does it close or protect the approved end-to-end outcome?
2. Is its authoritative fact and owning module clear?
3. Can tenant, contract, package-version, and decision boundaries be tested?
4. Is its pilot acceptance evidence defined?
5. Is it smaller and safer to implement now than to preserve an extension
   boundary?

If not, assign it to a named later version or research backlog. A detailed
legacy design is not sufficient reason to include it.
