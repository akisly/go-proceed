# 22. Production Data and API Contract

## 1. Contract status

Этот документ является нормативным target design. `technical/schema.sql` остаётся executable reference для Pilot, а production implementation оформляется последовательными reviewed migrations. API-first contract хранится в `technical/openapi.yaml`; endpoint не считается готовым только потому, что экран его симулирует.

State values импортируются из `technical/state-catalog.csv`; локализованные labels и юридически чувствительные термины — из `technical/terminology.csv`. Расхождение enum между этими файлами, SQL и OpenAPI блокирует merge/release.

## 2. Schema domains

### Identity & tenancy

- `organizations`, `organization_settings`, `legal_entities`, `branches`;
- `memberships`, `membership_project_scopes`, `membership_location_scopes`, `membership_permission_overrides`;
- `invitations`, `invitation_project_scopes`, `invitation_location_scopes`, `ownership_transfers`, `access_reviews`;
- `support_access_grants`, `support_access_grant_projects`, `security_events`.

### Project baseline

- `counterparties`, `counterparty_contacts`, `project_counterparties`, `unit_definitions`;
- `projects`, `locations`, `saved_views`, `impact_previews`;
- `contracts`, `contract_versions`, `contract_term_versions`, `work_items`, `work_item_locations`;
- `upload_intents`, `import_jobs`, `import_files`, `import_mapping_presets`, `import_row_results`, `import_diffs`;
- `reference_documents`, `reference_document_versions`, `numbering_series`, `package_number_reservations`.

### Execution & field authority

- `work_assignments`, `assignment_reassignment_receipts`, `assignment_reference_acknowledgements`;
- `requirement_occurrences`, `occurrence_trigger_events`, `typed_evidence_records`;
- `hold_point_decisions`, `concealment_events`;
- `review_tasks`, `review_decision_corrections`, `review_task_reassignment_receipts`;
- `offline_authorization_leases`, `capture_authorization_resolutions`, `capture_reporting_date_confirmations`;
- `requirement_waiver_revocations`, `variation_subjects`.

### Evidence/readiness

- `rule_packs`, `rule_pack_versions`, `evidence_rule_versions`, `rule_assignments`;
- `work_item_requirements`, `requirement_evaluations`, `requirement_waivers`, `evidence_requests`;
- `capture_sessions`, `evidence_objects`, `evidence_requirement_links`, `concealment_event_evidence`;
- `quantity_entries`, `review_decisions`, `sync_operations`, `readiness_snapshots`.

### Variation/close/commercials

- `variations`, `variation_versions`, `variation_decisions`;
- `reporting_periods`, `package_versions`, `package_lines`, `package_line_quantity_sources`, `package_line_evidence_sources`, `package_artifacts`, `package_submissions`;
- `external_shares`, `external_sessions`, `external_decisions`, `package_decision_sets`, `package_decision_items`;
- `acceptance_records`, `receivables`, `receivable_adjustments`, `retention_releases`;
- `payments`, `payment_allocations`, `payment_reversals`, `reconciliation_imports`.

### SaaS/operations

- `plan_versions`, `subscriptions`, `entitlement_overrides`, `usage_snapshots`;
- `saas_invoices`, `saas_payments`, `saas_invoice_adjustments`;
- `jobs`, `job_attempts`, `idempotency_records`, `transaction_outbox`, `dead_letters`;
- `notification_preferences`, `notifications`, `notification_deliveries`;
- `integration_connections`, `webhook_endpoints`, `webhook_deliveries`;
- `subscription_state_previews`, `saas_payment_reversals`;
- `period_close_cycles`, `package_decision_issues`;
- `member_offboarding_plans`, `member_offboarding_plan_items`, `member_offboarding_previews`, `member_offboarding_preview_items`, `membership_project_scope_removal_receipts`;
- `export_jobs`, `export_cancellation_receipts`, `deletion_jobs`, `legal_holds`, `audit_events`.

Этот inventory использует только реальные reference tables. Conceptual/legacy names (`profiles`, `project_memberships`, `variation_lines`, `credits` и другие) не являются разрешением создать параллельную модель: их canonical target, release и `alias/deferred/external` статус зафиксированы в `technical/entity-aliases.csv`. Валидатор блокирует неизвестный target и alias, который маскирует уже существующую таблицу.

Каждая SQL-таблица обязана иметь ровно одну запись в `technical/data-retention-catalog.csv`: release, fixed/row-owned class source, допустимые классы, personal-data flag, legal-hold behavior, deletion strategy и V-003. Таблица без retention mapping или mapping на несуществующую таблицу блокирует спецификацию.

## 3. Required columns and conventions

Tenant-owned tables include `organization_id`; project-owned tables additionally include `project_id`. Cross-tenant references are prevented by composite keys/foreign keys such as `(organization_id, project_id)`.

Command-mutable aggregates exposed through optimistic updates include, where applicable:

- `version bigint` for optimistic concurrency, or an explicit expected parent/entity version in a guarded command;
- `created_at`, `created_by` when an end-user creates the record;
- `updated_at`, `updated_by` for editable records; append-only ledgers and state-command records do not receive generic in-place edit fields;
- `archived_at/archived_by` when archive is allowed;
- no generic soft delete for financial/audit/ledger objects.

The exact reference schema remains authoritative: this convention is not permission to add meaningless mutable columns to immutable facts.

Money:

- integer minor units + ISO currency;
- tax/retention/deduction are explicit lines, not hidden JSON;
- cross-currency objects include rate/source/effective date only after feature activation.

Quantity:

- `numeric(20,6)` canonical;
- unit definition specifies input/display precision and conversions;
- ledger entry immutable and signed by operation/user/source metadata.

Time:

- canonical timestamps `timestamptz` UTC;
- business date and project timezone explicit;
- client timestamp retained as untrusted observation with clock anomaly.

Files:

- private storage key, hash, byte size, MIME detected/declared, scan state, retention class;
- every client upload first persists one immutable purpose/project/subject/key/type/size/hash/expiry/retention-class intent; the server selects the class from purpose and policy version, never from client input;
- verified evidence/import rows must inherit that class through the same composite upload-intent FK; generated manifests/artifacts and temporary exports carry their own explicit class plus hash, byte size and MIME, including nullable all-or-none storage tuples;
- evidence uses scoped work item + stable capture client operation rather than a not-yet-created server session; completion can only finalize the persisted tuple — in v0.1 it verifies and inspects synchronously inside the finalization command and enqueues no verification job;
- original and derivative relationships;
- no public permanent URLs.

### Units and conversion

Pilot-контракт единиц: полевая фиксация всегда вводится в контрактной единице строки (`quantity_entries` не несёт собственной единицы; precision заморожен единицей строки). `unit_definitions.conversion_factor` применяется только на import (нормализация исходного файла к контрактной единице) и на display; хранение и математика ведутся исключительно в контрактной единице с округлением по её precision. Смена единицы строки возможна только новой contract version.

## 4. Data invariants

1. A project, location, contract, work item, evidence, package and payment relationship cannot cross organization.
2. Published contract/rule/package versions are immutable.
3. Quantity/payment corrections are ledger entries, never in-place rewrite.
4. Payment allocations cannot exceed payment available or receivable outstanding.
5. Package total equals line/adjustment totals under the snapshot calculation version.
6. Submitted package points to immutable artifacts/hashes.
7. External decision targets exactly one resource version.
8. Revoked membership/share cannot create new commands even with stale token.
9. Audit/outbox are insert-only for application roles.
10. Retention/deletion cannot bypass legal hold.

### Temporal reconstruction

Каждое money/readiness/approval-решение обязано быть реконструируемым «as of» произвольного прошлого момента только из доменных записей: versioned inputs (contract terms/rules/reference/plan versions с `effective_at`/`published_at`), pinned snapshot hashes на решениях и append-only receipts. Процедура: по timestamp выбираются версии со «effective ≤ t, superseded > t», затем решение сверяется с его pinned hash; чтение audit text для восстановления состояния не требуется и не допускается как источник истины.

## 5. API surface by domain

`technical/openapi/scope-v0.1.csv` is the exact v0.1 allowlist: 51 operations. `technical/openapi.yaml` v2.9 is the wider target surface — 157 operations, 113 Pilot and 44 GA-forward at this revision — and is not authorization to implement anything in v0.1. An endpoint name in prose is not authorization to implement it either. Supabase owns sign-in/session primitives; therefore `/me` and raw session/token operations are intentionally absent from the AktFlow domain API.

### Public acquisition

`POST /pilot-leads` is the only anonymous acquisition operation. It requires a public-purpose idempotency key, schema limits, WAF/bot/rate controls and versioned service/privacy consent. It returns a uniform `202` receipt without disclosing whether contact/company already exists. External-review session/decision operations also declare `security: []`, but they are capability-authenticated by an exact hashed link token plus optional OTP/session and are not anonymous tenant operations. PII is routed to the operational lead store; analytics receive buckets only and never company, contact or exact delayed amount.

### Identity and organization

Pilot: organizations, membership list/update, invitation create/accept/reissue/revoke and export-first closure/cancellation during cooling-off. GA-forward: ownership transfer and time-bound support grants. Legal-entity subflows remain BFF-internal until their explicit OpenAPI operations are added.

### Project setup

Projects/locations, work list/assignment plus audited single-item create, private uploads, estimate-import dry-run/row results/confirm and safe async job status. Counterparty/contract persistence is reached through the confirmed import command in Pilot rather than exposed as generic CRUD.

`uploadId` always identifies `upload_intents.id`, never a provider multipart handle or an `import_files`/`evidence_objects` row. A successful finalization materializes the purpose-specific row with a same-tenant FK back to that intent — in v0.1 inside the finalization command itself, not a separate verification job; estimate import and capture submit continue with the original `uploadId`, so clients do not translate provider IDs.

### Execution

Work assignment update, evidence-request create/list/cancel, capture/correction submission, exact upload complete, capture timeline, review queue/decision, rule impact preview/publish, requirement explainability, readiness and expiring waivers. Evidence request creation never changes readiness; fulfillment is server-derived only from approved matching evidence.

### Close and money

Pilot: periods, preflight/close/guarded reopen, package generation/read/download, manual submission and operational decision receipt. GA-forward: compare, variations, secure external review, acceptance, full receivable transitions/adjustments/retention, payment allocation/reversal and reconciliation-import preview.

### SaaS/admin

Pilot: effective subscription, immutable plan/override resolution, platform-issued payment request with frozen plan/period/basis, one-invoice manual settlement, notification list/read receipts/versioned preferences/channel availability and scoped exports/closure. GA-forward: self-service plan/state changes, SaaS invoice corrections, approved external notification channels, integration dry-run/pause/resume/revoke/secret rotation/webhook replay and support grants. Audit and entitlement calculations remain domain side effects, not generic client CRUD.

## 6. API conventions

- URL version `/v1`; additive changes preferred.
- JSON uses camelCase; IDs UUID; money object `{amountMinor,currency}`.
- All inbound strings are NFC-normalized for comparison/storage. Boundary Unicode whitespace, whitespace-only required text and disallowed control characters are rejected, not silently trimmed; multiline controls are allowed only by an explicit schema. Identifier case stays significant unless a schema names a normalized field. The same policy runs at gateway/BFF validation and in contract fuzz tests.
- `X-Organization-Id` required for every authenticated tenant API, including project-addressed routes; server validates membership and `(organization_id, project_id)` correspondence. The only authenticated exceptions are `createOrganization` and `acceptInvitation`, which establish tenant context. It is forbidden on public/capability contracts and is never an identity substitute.
- Cursor pagination with stable `(sort,id)` cursor; maximum page size is 100. Every collection response is a `{data,nextCursor}` page, including contract-term versions, assignments, controlled references, review tasks and saved views; bare collection arrays are forbidden because a server cap would otherwise make older records unreachable. Command and aggregate arrays declare their own finite `maxItems`, with larger limits only for explicit import/upload/package batches.
- Filtering allowlist per endpoint; unknown filter is `VALIDATION_UNKNOWN_FILTER`.
- Creation/commands require `Idempotency-Key`; every POST declares `x-idempotency-class`. `standard_30d` retains request hash/status/body for 2,592,000 seconds; `ledger_400d` retains them for 34,560,000 seconds. Successful POST responses return `Idempotency-Replay-Until`. Same key plus same hash replays; a different hash returns `IDEMPOTENCY_CONFLICT`. After HTTP expiry, domain uniqueness and durable money-ledger `clientOperationId` still prevent duplicate financial effect.
- Money-ledger commands additionally persist a tenant-scoped `clientOperationId`; HTTP replay protection and durable ledger command identity are both required and neither substitutes for the other.
- Mutable update requires `If-Match` with the exact strong `ETag`. Single-resource GET/create/update responses return it as an `ETag` header; mutable objects inside collection responses also carry an exact `etag` field. The opaque value—not a client-invented conversion—is reused in `If-Match`. Conflict returns the current safe representation and its current tag when disclosure is authorized.
- Async command returns `202 Job`; every job exposes stable type/resource correlation, progress, attempt/backoff timing, safe error/retryability and status URL, so polling never depends on hidden worker logs.
- `X-Request-Id` is accepted on every operation after syntax/length validation and returned on every response, including Problem Details. If absent the gateway generates a new value; invalid caller values are rejected with a safe validation Problem rather than entering logs. It is never trusted as security identity. Every operation explicitly declares `429`; that response returns both `X-Request-Id` and `Retry-After`.

The four commands `issueSaasInvoice`, `recordSaasPayment`, `transitionSaasInvoice` and `reverseSaasPayment` require `x-audience: platform_billing`. Tenant bearer tokens and tenant permissions never authorize these operations. Tenant subscription commands use `saas_subscription`; tenant invoice/history reads remain organization-scoped and read-only.
- No secret, token, raw evidence URL or internal stack is returned in error.

## 7. Error envelope

Єдиний wire format — `application/problem+json` (Problem Details with stable AktFlow extensions). Wrapper `{ "error": ... }` заборонений.

```json
{
  "type": "/problems/package-blocked",
  "title": "Пакет заблоковано",
  "status": 422,
  "detail": "Пакет має 3 обов’язкові блокери.",
  "code": "PACKAGE_BLOCKED",
  "requestId": "req_...",
  "retryable": false,
  "userAction": "resolve_listed_blockers",
  "fieldErrors": [],
  "details": {"blockerCount": 3}
}
```

Required fields: `type`, `title`, `status`, `code`, `requestId`, `retryable`, `fieldErrors`. `detail` is localized safe text, never a stack/provider message. Every field error has `path`, stable `code` and safe localized `message`. `details` is code-specific and allowlisted; tokens, raw content, filenames, storage/provider URLs and secrets are prohibited. API responses never alternate between JSON error shapes.

Stable families:

- `AUTH_*`, `MEMBERSHIP_*`, `SCOPE_*`;
- `VALIDATION_*`, `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`;
- `ENTITLEMENT_*`, `RESOURCE_*`;
- `IMPORT_*`, `UPLOAD_*`, `SCAN_*`, `SYNC_*`;
- `REVIEW_*`, `READINESS_*`, `PACKAGE_*`, `EXTERNAL_SHARE_*`;
- `PAYMENT_*`, `BILLING_*`, `JOB_*`, `RATE_LIMITED`.

Machine-readable catalogue: `technical/error-catalog.csv`.

## 8. Idempotency rules

- Same key + same authenticated actor/organization/operation/request hash replays original status/body. Public lead intake instead scopes the key to purpose plus canonical request hash and always preserves non-enumerating behavior.
- Same key + different hash returns `IDEMPOTENCY_CONFLICT`.
- Authenticated keys are scoped to operation and organization; the public intake key is separately namespaced and cannot collide with tenant commands.
- Client-generated capture/quantity IDs provide durable mobile deduplication beyond HTTP retry TTL.
- Worker consumers deduplicate by outbox event ID and destination.
- Payment/import source fingerprint adds business duplicate warning, but never replaces idempotency.

## 9. Search and export

Search index stores tenant ID and authorized resource IDs; result authorization is rechecked at read. No cross-tenant autocomplete. Export is async, uses same row-level scope and captures query/filter/schema versions. Full organization export has separate recent-auth permission.

## 10. Webhooks

- HTTPS only; encrypted secret; display once;
- HMAC signature includes timestamp and raw body;
- replay window and event ID;
- at-least-once delivery; consumer must deduplicate;
- exponential retry with jitter, then dead-letter;
- admin can inspect redacted metadata and replay;
- tenant revocation disables queued deliveries;
- schema version and deprecation window documented.

Ordering: доставка событий и webhook-ов не гарантирует порядок. Потребитель обязан быть идемпотентным и упорядочивать по `occurred_at` + event ID (tie-break по ID), а не по времени получения; пропуски детектируются по монотонному курсору выгрузки, а не по «тишине».

## 11. Migration policy

- expand/migrate/contract;
- no destructive schema step in same release that stops old code;
- backfill is resumable job with progress and reconciliation;
- money/tenant migrations have pre/post invariants;
- rollback restores compatible application version; irreversible data transformations need restore/forward-fix plan;
- every migration tested on anonymized/synthetic production-scale fixture.

### Client version handshake and deprecation notice

- Каждый ответ API несёт `X-Min-Client-Version` (per platform); клиент старше минимума получает `426` со стабильным кодом `CLIENT_VERSION_UNSUPPORTED` для рискованных команд, при этом read/export и безопасная выгрузка локального outbox остаются доступными (см. doc 23 §9 mobile-контракт).
- Deprecation интеграционных поверхностей коммуницируется заранее: `Deprecation`/`Sunset` заголовки + запись в changelog интеграций минимум за 90 дней до отключения; webhook-версии живут по deprecation window doc 08 §9. Тихое отключение поля/поверхности запрещено.
