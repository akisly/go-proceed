# 06. Domain model, data ownership and permissions

## 1. Domain boundaries

AktFlow uses one transactional database initially, but code is separated into modules so data can later move without rewriting the product:

| Module | Owns |
|---|---|
| Identity | organizations, users, memberships, invitations and persisted invitation scopes/acceptance evidence |
| Commercial | customers, contracts, contract versions, BOQ/work items, rates |
| Execution | projects, locations, import previews, assignments, quantity ledger, saved personal views |
| Evidence | rules, occurrences, capture sessions, media/documents, exact evidence links and invalidations |
| Review | queues, decisions, overrides, external shares |
| Variation | change events, valuations, acknowledgements |
| Package | periods, snapshots, package versions, generated documents |
| Receivables | invoices/acts, due dates, payments, retention, disputes |
| Platform | audit, integrations, webhooks, sync operations, entitlements |

Cross-module access happens through services/events, not arbitrary UI queries.

## 2. Core entity relationships

`Organization → Project → Contract → ContractTermsVersion/ContractVersion → WorkItem`

`WorkItem → WorkAssignment → RequirementOccurrence ← EvidenceRuleVersion`

`ReferenceDocument → ReferenceDocumentVersion ↔ Assignment/Occurrence/TypedEvidenceRecord`

`CaptureSession → EvidenceObject/TypedEvidenceRecord ↔ Assignment/Occurrence → ReviewTask/ReviewDecision`

`ReportingPeriod → PackageVersion → PackageLine → PackageDecisionSet → PackageDecisionItem → WorkItem/Quantity/Evidence snapshot`

`PackageVersion → Submission → Acceptance → Invoice → PaymentAllocation`

`WorkItem/Location → Variation → VariationVersion → ContractVersion`

## 3. Identity and tenancy

- UUIDs are internal identifiers; human codes are org-scoped and mutable only under audit.
- Every tenant-owned table carries non-null `organization_id`; project-scoped tables also carry `project_id` for RLS and partition/index efficiency.
- Membership has org role plus optional project/location scopes.
- A person can belong to multiple organizations but no org context is inferred across requests.
- Access check order: authenticated user → active membership → org role → project/location scope → object state → entitlement.
- Cross-tenant IDs return not-found semantics where disclosure would be sensitive.

## 4. Work and quantity ledger

`work_item` represents one line in one contract version. It is not overwritten when the estimate changes. Supersession points to the next version.

`work_assignment` is the sole mutable execution aggregate: one work item + location + planned quantity + one Pilot assignee + window/priority/state. A batch is only transport; every row has its own client operation and transaction/receipt, so one rejection cannot erase committed siblings. Reassignment/lifecycle commands append history/audit and update the assignment version; generic work-item status patching is forbidden and historical capture never changes owner/subject.

Quantity is append-only:

- positive performed entry;
- correction entry referencing the original;
- transfer/reclassification entries referencing source and target;
- accepted/package snapshots freeze included entries.
- entry type/reason/source lineage is mandatory; transfer is an atomic out/in pair and is GA-gated.

Derived totals are projections and can be rebuilt. Money is stored in minor units plus ISO currency; quantity uses numeric precision and unit code. No floating-point for commercial values.

## 5. Evidence and readiness

An evidence object stores metadata and an object-storage key, never a public URL. Original binary is immutable; annotations/redactions are derivatives with lineage. Capture, upload, evidence, typed response and fulfillment links repeat and constrain the exact organization/project/work-item/assignment/location/occurrence tuple. A mismatch is rejected by database constraints, not repaired by application inference.

Invalidation is append-only state with actor, reason, expected version and audit/event. It preserves the binary/hash, prevents invalidated evidence from newly satisfying readiness and marks dependent evaluations/reviews/packages for explicit refresh or correction; submitted snapshots remain reproducible.

`requirement_occurrence` is the exact repeatable obligation produced from a rule for an assignment/location/date/batch/quantity trigger. `typed_evidence_record` stores a schema-versioned validated response linked to immutable originals; it does not assert that a real-world statement is true.

`reference_document_version` is the controlled input revision. Supersession marks affected open links stale; submitted snapshots remain pinned.

Requirement evaluation output includes:

- rule and version;
- subject work/location/quantity range;
- state: missing, pending, met, waived, failed;
- evidence and reviewer references;
- evaluated at and engine version;
- human-readable reason and remediation.

`readiness` is a projection, not a user-editable boolean. A privileged override is a separate record with scope, reason, expiry and actor.

## 6. Package snapshots

Package generation freezes:

- contract/work item versions;
- included quantity entry IDs;
- requirement evaluation results;
- selected evidence hashes;
- template and ruleset version;
- generated document hashes;
- author and generation time.

Package periods for the same project cannot overlap, and one quantity entry may have only one current claim in a package source set. One active exact-version `package_decision_set` owns its source receipt and editable pending items. Bounded saves use per-item optimistic versions; incomplete allocation is `pending_reconciliation` and has no effect on package/readiness/correction work. The server derives aggregate totals, then an idempotent serializable final commit freezes items, stores a distinct reconciliation receipt and creates correction work. Corrections create a new package version. Submitted or accepted versions remain readable and comparable.

## 7. Roles

### Tenant roles and external capability actor

- `owner`: billing, ownership transfer, all org/project administration.
- `admin`: team, integrations, templates; no ownership transfer unless explicitly granted.
- `commercial_manager`: contracts, variations, packages, receivables and reports.
- `pto_manager`: work setup, rules, review, package preparation.
- `project_manager`: scoped project operations and internal approval.
- `foreman`: scoped assignments, quantity/evidence creation, returned-item correction.
- `field_worker`: minimal scoped capture on assigned work; no financial values or review authority.
- `internal_reviewer`: evidence review decisions (approve/return/waive per policy) within scoped projects.
- `estimator`: contract lines, quantities and package/export preparation within scoped projects.
- `accountant` (`Project Accountant` in UI): package/receivable/payment operation, no field evidence mutation; not the platform SaaS Billing Operator.
- `integration_admin`: integration connections, webhook endpoints and API credentials; no financial decisions.
- `security_admin`: security exceptions, capture-authorization recovery, organization-wide member revoke and offboarding execution together with Owner/Admin.
- `viewer/auditor`: read/export scope; export may be separately disabled.
- `external_reviewer`: token-scoped package review, not an org member by default.

Полный канонический перечень — 14 ролей в `technical/permissions.csv`; этот раздел не вводит ролей вне матрицы.

## 8. Permission principles

1. Deny by default; UI hiding is not authorization.
2. Organization, project and location scope all apply.
3. Create/update/read/delete/export are separate permissions.
4. Submitted evidence is corrected by new version, not overwritten.
5. Creator and approver can be separated per project.
6. Every live Pilot user has MFA; high-risk actions additionally require recent-auth step-up. SSO/SCIM remains a later enterprise option, not a substitute for the Pilot control.
7. Support impersonation is absent in MVP; support access uses time-bound audited grants when introduced.
8. Service role credentials never reach browser/mobile clients.

The complete Pilot+GA target matrix is in `technical/permissions.csv`; release flags and entitlements still apply after permission evaluation.

## 9. RLS model

PostgreSQL Row Level Security is enabled and forced on every tenant table. Policies call minimal membership/scope helpers in a non-exposed `private` schema. The helpers are security-definer only to avoid recursive membership-policy lookup, fix `search_path`, and resolve the actor from `auth.uid()` or trusted transaction-local BFF context. Target organization/project values always come from the row being checked; a request header never becomes an authorization fact. Runtime roles remain `NOBYPASSRLS`.

Important rules:

- `SELECT` policy is required for update flows to work.
- `UPDATE` policies include both `USING` and `WITH CHECK`.
- storage object access validates org/project from server-maintained metadata/path.
- views exposed to APIs use `security_invoker = true` where supported.
- grants are explicit; RLS does not replace table/function privileges.
- only schemas/objects listed in `technical/data-access-surface.csv` may be exposed; `public` is not a client Data API schema.
- new Supabase tables receive neither implied exposure nor implied application grants; schema exposure, privileges and RLS are reviewed as three separate controls.

## 10. Retention and deletion

Illustrative policy inputs, not an enabled deletion schedule; exact values remain subject to V-003 validation:

- active commercial/evidence records: contract life + 5 years configurable;
- audit/security events: 24 months hot, longer archive by plan/policy;
- expired invites/share tokens: 90 days metadata, token secret never stored raw;
- deleted drafts: 30-day recoverable tombstone;
- customer export links: 72 hours.

Organization closure offers/produces export first, then enters a cancelable read/export/pay/support-safe cooling-off state and retention/legal-hold review. While V-003 is unvalidated, destructive scheduling is denied. A later validated tenant purge is a background, verified, multi-store operation with deletion certificate.

## 11. Data residency and portability

MVP selects an EU managed region and documents subprocessors. Organizations can export data as CSV/JSON plus original evidence/package files and manifest. Object keys and internal IDs are portable. A future dedicated deployment must preserve the same export contract.

## 12. Data quality invariants

- accepted/paid amount cannot be negative;
- allocations cannot exceed payment amount or target receivable outstanding without explicit credit workflow;
- package line cannot reference a quantity outside its snapshot;
- evidence cannot silently move to another tenant/project;
- every submitted mutation has idempotency key or unique client operation ID;
- timestamps store UTC; project timezone is presentation and reporting context;
- any readiness total has a reproducible breakdown.
- persisted impact previews are purpose-bound, expiring and hash-checked at publish/confirm; stale previews cannot authorize a mutation;
- idempotency records bind actor, route, tenant and request hash; a reused key with another payload is a conflict;
- leased jobs commit only with the current fencing token, so an expired worker cannot overwrite a newer attempt.

## 13. v2.9 cross-aggregate integrity

- `work_item.lineage_root_id` has one current acyclic head; reservations and remaining quantity are resolved across that lineage, not only one physical row.
- `impact_preview.canonical_input_snapshot` is immutable, purpose-bound and hash-matched; publish consumes that exact normalized value.
- an occurrence trigger stores strategy, canonical trigger key, authoritative source snapshot and rule/assignment versions before materializing an occurrence.
- offline lease identity is proven by composite organization/membership/user/assignment keys; capture and upload actor must equal the lease subject.
- capture stores claimed date, authoritative date and authorization disposition separately. Exception resolution and date confirmation are append-only records.
- one active occurrence waiver is serialized; expiry or revocation wins once and never edits the original waiver.
- review correction creates an immutable correction receipt, clears only the current projection and opens a new task; the later approve/return is the decision successor. It cannot rewrite reviewed evidence.
- every reporting-period close/reopen attempt receives an append-only numbered close cycle.
- package line decisions and package decision issues are separate: one outcome per financial line, many exact-target issues per source.
- an acceptance lineage has one current head. `createReceivable` locks/checks it; a successor is denied while any uncompensated downstream money fact exists.
- payment `source_fingerprint` is immutable and tenant-unique independently from HTTP idempotency.
- numbering-series configuration becomes immutable after first use; retirement does not reset or reuse numbers, and document number is organization-unique.
- member offboarding is a persisted organization-wide plan with paginated items and exact dependency versions; project scope removal is a distinct narrower command.
- export cancellation uses explicit `cancel_requested/cancelled` state and worker fencing; a ready artifact is not retroactively cancelled.

These rules are enforced at multiple layers: database constraints where representable, transactional domain guards, the command-availability evaluator, audit/outbox writes and negative contract tests. A service-layer check alone is insufficient for tenant identity, lineage uniqueness, money dedupe or immutable-current-head invariants.
