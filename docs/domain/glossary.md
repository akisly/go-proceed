# Canonical glossary

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md)

## Usage rule

These terms are canonical in product copy, schema, API, events, states, and
tests. A legacy synonym may appear only in a migration alias or localized UI
label. It does not create a second domain concept.

## Workspace and parties

| Term | Definition |
|---|---|
| Workspace | Tenant, governance, and default access boundary for one GoProceed customer environment. |
| Workspace display name | Product-facing label for a workspace; not an official legal identity. |
| Party | Tenant-local business participant such as an own company, customer, contractor, or technical-supervision organization. |
| Party legal profile | Official name, registration number such as EDRPOU, tax attributes, and legal address for one party. |
| Own legal entity | A party the workspace is authorized to act for, marked by an own legal entity profile with stricter completeness and edit permission. |
| Counterparty | A party that is not marked as the workspace's own legal entity; a contextual UI term, not a separate table identity. |
| Contact | A person associated with a party, including name, role/title, and communication coordinates. |
| Membership | A person's workspace governance relationship: owner, admin, member, or auditor. |
| Project access grant | Time-bounded permission for a workspace member to see or act within one project. |
| Project responsibility assignment | Time-bounded operational responsibility such as evidence recorder or package compiler; not an access grant. |

## Projects and contracts

| Term | Definition |
|---|---|
| Project | Construction object that groups relationships and contracts; it is not owned by one legal entity. |
| Project party | A party's business relationship to a project, such as customer, technical supervision, designer, or performer. |
| Contract | Stable agreement identity within a project, between one workspace-owned party and one customer party. |
| Contract version | Immutable published snapshot of parties, terms, currency, tax policy, approval policy, and acceptance-relevant work baseline. |
| Work item | One commercial row in a published contract version, with unit, contract quantity, price state, currency, tax basis, and source lineage. |
| Location | Tenant/project-scoped physical or logical work location used to make assignments and acceptance scope precise. |
| Import batch | One controlled attempt to parse, map, validate, and optionally publish source files into a contract version. |
| Import row result | Immutable lineage and validation result for one source worksheet row under one parser/mapping version. |

## Execution and evidence

| Term | Definition |
|---|---|
| Work assignment | Operational scope derived from a contract work item, optionally identifying location, performer, member, due date, planned quantity, and requirement-template version. |
| Progress entry | Append-only measurement or signed adjustment. Every adjustment references one root measurement; a mistaken adjustment is corrected by another compensating adjustment to the same root. |
| Performer | Party accountable for performing the work; not necessarily the member who records it. |
| Recorder | Authenticated member who records progress or evidence. |
| Evidence source party | Party from which an evidence object originated. |
| Evidence custodian | Party or member responsible for maintaining the authoritative original and correction chain. |
| Requirement template version | Immutable allowlisted definition of an evidence obligation, its multiplicity, timing, type, severity, conditions, and form schema. |
| Requirement occurrence | Concrete, independently reviewable obligation for an assignment and exact quantity/location scope. |
| Requirement exception | Append-only waiver, not-applicable, or accept-risk fact for one occurrence, with authority, reason, and supersession. |
| Capture event | Device/server fact describing an evidence-capture attempt and its local-to-server receipt progression. |
| Upload intent | Idempotent server contract for one whole evidence upload, content hash, expected size/type, and receipt result. |
| Evidence object | Immutable content identity and provenance record for an original or derivative evidence file/form. |
| Original evidence | First received content from capture or upload; its bytes, hash, and storage key are not overwritten. |
| Evidence derivative | Annotation, redaction, rendition, or other content derived from a named evidence object without replacing it. |
| Evidence correction | Successor evidence object that explicitly corrects an earlier object while preserving both. |
| Evidence link | Many-to-many relationship between an evidence object and a requirement occurrence. |
| Internal review decision | Append-only verifier decision about exact evidence/requirement facts; not an external acceptance. |
| Review target set | Immutable relational identity for the exact occurrence and normalized evidence/link items reviewed together by one internal decision. |
| Readiness | Derived explanation of whether exact quantity/location scope has the current requirements and internal decisions needed for packaging. |

## Packages and external review

| Term | Definition |
|---|---|
| Package | Stable container for one contract, package series, and reporting period. |
| Package version | Draft that can be frozen into an immutable snapshot of all material contract, progress, requirement, review, evidence, template, renderer, and approval facts. |
| Package line | Acceptance-homogeneous row for one contract work item, location/scope, unit price, currency, and tax basis. |
| Claim segment | Exact, non-overlapping quantity slice inside a package line, linked to exact progress sources and used as the quantity-decision grain. |
| Claim scope lineage | Contract-scoped identity for one exact progress-source allocation and homogeneous approval scope across package versions; unchanged prior acceptance references this identity. |
| Progress claim allocation | Immutable signed ledger movement that reserves, activates, partitions, releases, or preserves accepted quantity from an exact root progress measurement. |
| Decision coverage | Immutable relation showing which active partition descendants remain covered by an earlier quantity decision without copying that decision. |
| Package artifact | Immutable PDF, XLSX, ZIP, or manifest generated from one frozen package-version snapshot and renderer version. |
| Approval requirement | Business rule pinned to a package version that identifies required/observer role, decision type, and exact applicable scope. |
| Package submission | Append-only act of sending one frozen package version under a named approval policy. |
| External access grant | Revocable, expiring bearer-email-link permission for one recipient, package version, and scope; the server stores only its token hash. |
| External session | Short-lived server session exchanged from a valid access grant by deliberate POST. |
| Decision batch | Immutable receipt for one external submit action and its included decisions/issues. |
| Quantity decision | Terminal accept or return outcome for one approval requirement and exact claim segment at submission time; derived coverage follows later partition descendants. |
| Evidence decision | Accept or return outcome for one approval requirement and exact evidence/occurrence target. |
| Decision issue | Structured blocking or non-blocking reason recorded in a decision batch. |
| Prior acceptance reference | Reference from a new package version to an unchanged earlier accepted segment and its original decision; never a copied decision. |
| Approval scope hash | Deterministic hash of all facts material to a named approval, used to prove that referenced prior scope is unchanged. |

## Derived outcomes

| Term | Definition |
|---|---|
| Acceptance | Projection over exact quantity decisions and valid prior acceptance references. It is not a manually editable record. |
| Accepted quantity | Claim-segment quantity accepted by every required quantity approver whose scope covers it. |
| Returned quantity | Claim-segment quantity returned by at least one required quantity approver. |
| Pending quantity | In-scope performed quantity that is neither accepted nor returned and remains in a named workflow state. |
| Compliance exception | Evidence/requirement problem that remains after monetary acceptance and requires remediation without silently reversing quantity acceptance. |
| Acceptance exposure slice | Derived, acceptance-homogeneous portion of effective performed quantity used by the VaR projection; before packaging it comes from progress/readiness facts, and after packaging it maps to an active claim segment. |
| Value at risk (VaR) | Value of performed, acceptance-relevant, priced quantity that is not currently accepted, grouped by currency and workflow state. |
| Missing price | Price is unknown or absent; quantity is reported as unvalued and excluded from monetary VaR. |
| Zero price | Known contractual price of zero; quantity is valued at zero and is not treated as missing. |
| Over-contract exposure | Performed quantity above the approved contract baseline; reported separately and never silently valued at the contract rate. |

## Reserved later terms

Receivable, invoice, retention, deduction, payment, allocation,
reconciliation, journal, posting period, and statutory document belong to
Project Commercials or accounting contexts after v0.1. They are not synonyms
for a package, submission, acceptance, or value-at-risk projection.
