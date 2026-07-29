# GoProceed Canonical Product and Architecture Design

**Status:** Approved  
**Approved:** 2026-07-30  
**Applies to:** v0.0 foundation and v0.1 product boundary  
**Product name:** GoProceed  
**Supersedes:** AktFlow v2.9 target-package assumptions and the 2026-07-29 baseline-zero hypothesis

## 1. Purpose

This document is the approved source for rebuilding the GoProceed product package.
It separates:

- the six-table runtime foundation that already exists;
- the product required for v0.1;
- later capabilities that must not shape the early runtime prematurely;
- historical AktFlow material that remains useful only as reference.

The previous package described 126 target tables, 157 API operations, offline
capture, finance, SaaS billing, support, integrations, and later lifecycle
operations as if they formed one early product. That model is not the
implementation baseline.

## 2. Product boundary

GoProceed v0.1 closes this outcome:

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

The early runtime ends at externally accepted, returned, and pending quantities
and values. It does not create receivables, invoices, retentions, payments,
allocations, reconciliation entries, or statutory accounting documents.

## 3. Product surfaces

- `apps/landing` is a separate marketing product and deployment.
- `apps/app` is the GoProceed product.
- Online mobile work is part of v0.1.
- Full offline operation is deferred to v0.3.
- The durable product demo belongs to `apps/app` at `/demo`.
- A query parameter such as `?demo=true` must not switch a production tenant
  into demo mode.
- Initial deployments may use separate free Vercel domains.

## 4. Tenancy and legal parties

### 4.1 Workspace

A workspace is the tenant and access boundary. It stores product-level data such
as display name, branding, timezone, locale, status, and a default own legal
party reference.

Official company name, registration number, VAT data, and legal address do not
live as authoritative duplicated strings on the workspace.

### 4.2 Party model

Parties are tenant-local. There is no global cross-customer company registry.

- `parties` represents a business participant in a workspace.
- `party_legal_profiles` stores official legal attributes.
- `own_legal_entity_profiles` marks and governs the workspace's own legal
  entities.
- `party_contacts` stores people associated with a party.

Own legal entities require stricter completeness and edit permissions than
external counterparties. Published contract versions preserve immutable party
snapshots.

### 4.3 Projects and contracts

- A workspace may contain multiple own legal entities.
- A project represents a construction object and is not owned by one legal
  entity.
- One project may contain contracts of different own legal entities.
- Every contract identifies one own party and one customer party.
- Contract numbering is unique at least within own party plus normalized
  contract number, not merely inside a project.
- Technical supervision, general contractor, designer, and other participants
  are project relationships; the relationship itself does not grant access.
- One package belongs to exactly one contract.

All project and contract relations use tenant-safe constraints. A package
version, line, source, evidence link, grant, or decision cannot cross workspace,
project, or contract boundaries.

## 5. Access and responsibility

### 5.1 Workspace governance roles

- `owner`
- `admin`
- `member`
- `auditor`

These roles govern the workspace. They are not construction job titles.

### 5.2 Project responsibilities

Project responsibility assignments are separate, time-bounded facts:

- performer;
- progress recorder;
- evidence recorder;
- evidence custodian;
- requirement owner;
- package compiler;
- internal verifier;
- package submitter;
- acceptance liaison;
- commercial observer.

One person may hold multiple responsibilities in v0.1. The system records and
surfaces separation-of-duties exceptions without blocking the workflow.
Names such as foreman, PTO engineer, or estimator are UI presets, not core roles.

Project visibility and project responsibility are separate concepts.

## 6. Contract baseline and import

### 6.1 Versioning

- Contract drafts may change.
- Published contract versions and their work items are immutable.
- Reimport creates a new version.
- Work-item lineage identifies the preceding and superseded rows.
- Published versions pin party snapshots, currency, tax basis, terms, approval
  policy, and source provenance.

### 6.2 v0.1 import

v0.1 supports controlled XLSX and CSV import of the acceptance-relevant
contract baseline:

- source key and work code;
- description and section;
- unit;
- contract quantity;
- unit price and amount;
- currency and tax basis;
- optional location and external identifiers.

Full estimating-system resource calculations, labour, machinery, coefficients,
and statutory estimate logic are not required for v0.1.

The import contract preserves:

- source file hash;
- parser and mapping versions;
- worksheet and source row number;
- exact source values and normalized preview;
- localized number and unit interpretation;
- per-row validation results;
- explicit publish confirmation;
- diff and lineage on reimport.

Macros and formulas are not executed. File, worksheet, row, uncompressed-size,
and archive limits protect against malicious or accidental resource exhaustion.
Exports neutralize formula injection.

PDF extraction may later produce a reviewable draft but is never an
authoritative silent import.

## 7. Execution, requirements, and evidence

### 7.1 Work and progress

A contract work item is a commercial baseline row. A work assignment is an
operational scope and may identify a location, performer party, member assignee,
planned quantity, due date, and pinned requirement-template version.

Individual assignee and due date are optional in v0.1.

Performed quantities are append-only progress entries. Corrections reference
the original entry; history is not overwritten.

### 7.2 Requirements

Published requirement-template versions are immutable allowlisted
configurations. They may describe multiplicity, timing, evidence type, form
schema, severity, and conditions.

A requirement occurrence is a concrete, independently reviewable obligation
created for an assignment and quantity/location scope.

Waiver, not-applicable, and accept-risk are append-only requirement exceptions,
not mutable readiness flags.

### 7.3 Online mobile boundary

v0.1 does not require offline authorization, offline task browsing, background
sync, conflict resolution, or resumable upload.

It must still survive a connection failure during an online capture:

- the local original remains until server receipt is confirmed;
- whole-upload retry is idempotent;
- UI distinguishes not sent, sending, server-confirmed, and failed;
- local data is not removed before receipt and integrity verification.

### 7.4 Evidence

Evidence records preserve:

- recorder and performer;
- source party and custodian;
- claimed capture time and server receipt time;
- immutable content hash;
- original or derivative relationship;
- origin method and storage provenance;
- exact links to requirement occurrences.

One evidence object may support multiple requirements and one requirement may
have multiple evidence objects.

Original content, hash, and provenance are immutable. Correction creates a
successor; annotation or redaction creates a derivative. Storage keys are not
overwritten.

### 7.5 Internal review and readiness

Internal review decisions are append-only and target exact evidence/requirement
facts. A correction supersedes a prior decision.

Review queues and current readiness are derived projections. Readiness is
calculated on an acceptance-homogeneous quantity/location slice, not the entire
contract row.

## 8. Package model

### 8.1 Stable package and immutable versions

A package is the stable container for one contract, series, and period. Frozen
package versions are immutable.

A frozen version pins:

- contract and contract version;
- party snapshots;
- work-item versions;
- progress-entry sources;
- requirement and review facts;
- evidence hashes;
- package-template and renderer versions;
- approval requirements;
- author and timestamps.

Generated PDF, XLSX, ZIP, and manifest artifacts are immutable products of the
same snapshot.

### 8.2 Package lines and claim segments

A package line is acceptance-homogeneous:

- one contract work item;
- one location or equivalent acceptance scope;
- one unit price;
- one currency;
- one tax basis.

`package_line_claim_segments` provide the canonical decision grain. Every
segment is tied to exact progress sources.

When a partial quantity decision is made, the server atomically partitions the
pending segment into non-overlapping child segments whose quantities reconcile
to the parent. Decisions address exact segment identifiers rather than an
unidentified aggregate portion.

One progress source cannot be claimed beyond its available quantity across
active package lineage.

## 9. Protected external review

### 9.1 Approval requirements

`package_approval_requirements` describes the business rule pinned to a package
version. Each requirement defines:

- required or observer;
- recipient role;
- decision scope: quantity, evidence, or quantity and evidence;
- applicable package/line/segment scope.

An observer cannot submit a decision.

### 9.2 Access grant and session

An external reviewer is not a workspace member.

`external_access_grants` stores a high-entropy token hash, recipient, exact
package version, permissions, expiry, state, revocation version, and credential
type.

`external_sessions` stores short-lived sessions issued from a valid grant.

Protocol requirements:

- ordinary `GET` never consumes or activates the bearer token;
- a deliberate `POST` exchanges the token for a session;
- the URL is cleaned after exchange;
- cookie is `HttpOnly`, `Secure`, `SameSite`, and short-lived;
- the page uses strict CSP and `Referrer-Policy: no-referrer`;
- third-party resources cannot receive the token URL;
- reissue revokes the old grant and its sessions;
- final decision submission rechecks grant, expiry, package version, revocation,
  idempotency, and CSRF.

The assurance label is `bearer_email_link`. It proves possession of the link,
not verified identity or qualified signature. Name, company, and title are
self-declared. IP address is security telemetry, not identity proof.

### 9.3 Partial decisions

Each submitted portion is an immutable `external_decision_batch`.

Quantity and evidence decisions are separate:

- `external_quantity_decisions` targets approval requirement plus claim segment;
- `external_evidence_decisions` targets approval requirement plus exact
  evidence/occurrence;
- `external_decision_issues` records blocking and non-blocking reasons.

Evidence outcomes never change money automatically. A monetary change requires
an explicit quantity decision.

A claim segment is accepted only when every required quantity approver whose
scope includes it has accepted it. Return by any required quantity approver
blocks the segment. Undecided scope remains pending.

## 10. Resubmission and prior acceptance

External decisions remain bound forever to the exact package version reviewed.
A decision on v1 is never copied or represented as a decision on v2.

When v2 follows a return:

- an unchanged previously accepted segment is not claimed again;
- v2 may carry a `prior_acceptance_reference` to the v1 decision;
- the earlier decision remains the source;
- repeated review is skipped only when stable segment identity and
  `approval_scope_hash` match.

The approval-scope hash contains all facts material to that approval:

- quantity;
- price, currency, and tax basis for monetary approval;
- relevant evidence for technical approval;
- contract terms;
- approval-policy version.

Material change requires a new decision.

An evidence return after monetary acceptance creates a compliance exception. It
does not silently reverse accepted value.

## 11. Acceptance and value at risk

Current acceptance and value at risk are projections, not editable source
tables.

Disjoint segment states include:

1. `accepted`
2. `returned`
3. `submitted_pending`
4. `packaged_not_submitted`
5. `internal_review`
6. `evidence_blocked`
7. `ready_not_packaged`

Each segment belongs to exactly one state according to the defined precedence.

Value is calculated from canonical quantity, price, currency, tax basis,
precision, and rounding rules. Rounded child parts reconcile to the line total.

Project summaries group values by currency. No hidden FX conversion is allowed
before the later financial context.

Zero price and missing price are different. Over-contract performance is shown
separately as unapproved or unvalued exposure and is not silently priced at the
contract rate.

## 12. v0.1 logical data modules

Table count is an outcome, not a constraint. The expected implementation is
approximately 50–53 tables after detailed field and invariant design.

### Workspace and access

- workspaces;
- memberships;
- invitations;
- parties;
- party_legal_profiles;
- own_legal_entity_profiles;
- party_contacts;
- projects;
- project_parties;
- project_access_grants;
- project_responsibility_assignments.

### Contracts and import

- contracts;
- contract_versions;
- work_items;
- locations;
- unit_definitions;
- import_batches;
- import_files;
- import_row_results.

### Execution, requirements, and evidence

- work_assignments;
- progress_entries;
- requirement_template_versions;
- requirement_occurrences;
- requirement_exceptions;
- capture_events;
- upload_intents;
- evidence_objects;
- evidence_requirement_links;
- review_decisions.

### Packages and external review

- package_template_versions;
- packages;
- package_versions;
- package_lines;
- package_line_claim_segments;
- package_line_progress_sources;
- package_evidence_sources;
- package_artifacts;
- package_approval_requirements;
- package_submissions;
- external_access_grants;
- external_sessions;
- external_decision_batches;
- external_quantity_decisions;
- external_evidence_decisions;
- external_decision_issues.

### Operational foundation

- audit_events;
- idempotency_records;
- transaction_outbox;
- jobs;
- job_attempts;
- dead_letters;
- message_deliveries;
- notifications.

Exact tables may merge or split only when field-level design proves a distinct
identity, lifecycle, constraint, query, or retention need.

## 13. Foundation security

The existing six-table foundation is retained and hardened additively before
domain expansion.

Required corrections include:

- tenant isolation for audit, idempotency, and outbox;
- tenant-safe foreign keys and tenant-leading indexes;
- permission-aware legal-party creation;
- serialized first-owner bootstrap;
- deny-by-default future privileges;
- append-only audit semantics;
- idempotency expiry and bounded keys;
- real outbox claim, retry, error, backoff, and dead-letter behaviour;
- environment-safe seed credentials;
- maintained timestamps and optimistic versions.

No destructive rename or field removal occurs before backfill, compatibility,
invariant verification, and rollback planning.

## 14. Deferred contexts

Not part of v0.1 runtime:

- full offline authorization, task access, sync, conflict resolution, and
  resumable upload;
- change orders and variations;
- receivables, invoices, retentions, deductions, payments, allocations, and
  reconciliation;
- statutory and tax accounting;
- SaaS billing;
- webhook integrations;
- support access;
- automated retention jobs and legal hold;
- qualified signature;
- custom role builder;
- sequential enterprise approval routing.

## 15. AI extension boundary

AI may later:

- suggest import mappings;
- extract a reviewable PDF draft;
- normalize names and units;
- suggest requirement templates;
- flag poor or duplicate evidence;
- suggest evidence-to-requirement links;
- explain readiness gaps;
- summarize packages and returns;
- propose remediation.

AI never becomes the source of contract quantity, price, acceptance, legal
conclusion, package submission, or external decision without explicit human
confirmation.

No unused AI tables are created. Each approved AI feature adds separate proposal
and run provenance appropriate to that feature.

## 16. Privacy and retention before pilot

Before real customer data:

- publish a privacy notice;
- version the external decision confirmation text;
- define minimum retention periods;
- provide export;
- define a manual workspace closure/deletion procedure;
- restrict audit and security telemetry;
- verify backup and restore;
- document that link access and IP are not identity proof.

Automated retention and legal hold remain later capabilities.

## 17. Version roadmap

### v0.0

Canonical documentation, foundation security, safe migration path, and green
baseline.

### v0.1

The complete online contract-to-acceptance-and-risk outcome.

Internal milestones:

- M1: parties, contracts, versions, import;
- M2: assignments, progress, online evidence;
- M3: requirements, internal review, readiness;
- M4: immutable package generation;
- M5: protected external access and partial decisions;
- M6: value at risk and end-to-end pilot hardening.

Every milestone ends with tenant-isolation tests and a working vertical scenario.

### v0.2

Pilot hardening, additional adapters/templates, onboarding, product analytics,
isolated `/demo`, and the first optional AI-assist feature selected from observed
pilot work.

### v0.3

Full offline mobile.

### v0.4+

Project Commercials, initially as a subledger/export layer over finalized
acceptance facts.

### v1.0

Validated production workflow, security, restore, retention, monitoring,
support, and documented operating constraints.

Versions close by evidence and acceptance criteria, not fixed calendar promises.

## 18. Documentation hierarchy

The canonical package is built inside the `GoProceed` worktree:

```text
docs/
  README.md
  product/
  domain/
  architecture/
  delivery/
  discovery/
  decisions/
  legacy/
technical/
  database/
  openapi/
  permissions/
  states/
  events/
  templates/
migration/
  goproceed-canonical-v0.1/
```

Runtime migrations are the truth for the actual database. Approved canonical
design is the truth for the target version. OpenAPI is the public API truth.
Version scope is the release truth. ADRs record approved decisions. Legacy
material is never normative.

## 19. Discovery evidence

The attached 2026-07-28 workbook contains:

- 50 lead records;
- 28 legacy-source records;
- 22 newly researched records;
- 10 priority-A and 12 priority-B new leads;
- an outreach queue of 22, where 21 are marked sent on 2026-07-28 and one is
  marked unsent because email was not confirmed;
- all 22 queue records marked awaiting response at the time of the workbook.

The founder reports outreach to 50 companies. Until send evidence for the 28
legacy records and the one unsent queue record is reconciled, documentation
must distinguish:

- 50 companies in the lead map;
- 21 sends evidenced by this workbook;
- additional sends reported by the founder but not proven by this workbook.

Lead count or send count is not demand validation. Replies, artifact access,
interviews, named projects, and pilot commitment are validation evidence.

## 20. Required invariant tests

- no cross-workspace relationship;
- contract cannot use another workspace's own party;
- package cannot contain another contract's content;
- child claim segments reconcile to the parent;
- progress quantity cannot be overclaimed;
- multi-approver decisions aggregate unambiguously;
- decision submit is idempotent;
- prior acceptance never becomes a new-version decision;
- revoked, expired, or replaced grants cannot decide;
- email prefetch does not consume access;
- rounded parts reconcile to line totals;
- project currencies are not silently combined;
- upload failure does not delete the mobile original;
- published versions cannot be mutated or deleted;
- import does not execute formulas, macros, or dangerous archives.

## 21. Migration principle

The old project remains an immutable comparison source until the canonical
package is complete.

Every legacy document receives one disposition:

- keep;
- rewrite;
- merge;
- defer;
- archive;
- delete only after confirmed transfer or explicit rejection.

The existing runtime tables are migrated additively. Documentation-only target
tables are not treated as deployed data and do not require destructive database
deletion.
