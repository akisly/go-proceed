# 08. API and integration specification

## 1. Integration principles

- Import/export before deep integration: customers get value without waiting for vendors.
- External systems remain systems of record for accounting/GC CDE where contract requires it.
- Every sync shows direction, source, last success, rejected records and reconciliation path.
- Webhooks are signed, retried and idempotent.
- Integration mapping is versioned per organization/project.

Connection scope: интеграционные подключения (`integration_connections`, webhook/export sink) — организационного уровня; per-project multi-account подключения (несколько BAS/AVK/storage/mail аккаунтов на проект) сознательно не моделируются в Pilot/GA-core и вводятся только future-моделью по подтверждённому спросу через реестр doc 37.

## 2. Domain API surface v1

Detailed allowlist is in `technical/openapi.yaml`; every operation carries `x-release` and `x-flow-id`. Pilot clients use this BFF contract, but a general customer automation API is not promised until GA API/security/support gates. The resource families below cover the Pilot+GA target; operation release markers are authoritative:

- public privacy-minimized `/pilot-leads` intake (not a customer automation API);
- `/organizations`, `/memberships`;
- `/projects`, `/locations`, `/contracts`, `/work-items`;
- `/capture-sessions`, `/evidence`, `/quantity-entries`;
- `/reviews` (Pilot), `/variations` (GA);
- `/periods`, `/packages`, `/submissions`;
- `/receivables`, `/payments` (GA Project Commercials; never SaaS billing);
- `/exports`, `/webhooks`.

No unlisted internal endpoint may introduce different business semantics. Supabase Auth endpoints and the single reviewed `api.project_list` Data API view are separate infrastructure surfaces documented in `docs/35-data-access-tenancy.md`.

## 3. Estimate/contract imports

### MVP formats

- XLSX/XLS/CSV with user mapping;
- standard AktFlow XLSX template;
- JSON internal package for migrations;
- read-only PDF attachment, not auto-parsed as authoritative data.

Import phases: upload → malware/type check → sheet/header detect → mapping → normalize → validate → dry-run diff → confirm version → audit report.

Required canonical fields: item code, description, unit, quantity, unit price, currency/tax mode. Optional: section, location, resource code, customer code, evidence pack. Ambiguous decimals and formulas require confirmation.

### Later connectors

AVK/estimate products and accounting packages are driven by paying customer demand and documented legal export capability. First connector can still be file-based if reliable.

## 4. ЄДЕССБ/public construction formats

Treat 2026 construction price database and act formats as versioned adapters. Support official machine-readable formats only after schema, access rules and production endpoints are verified. Maintain fixtures and conformance tests per published version. Never scrape a UI as a critical integration.

## 5. Accounting integration

Pilot exports package/submission data and does not import construction-payment facts. GA Project Commercials adds manual/CSV payment-reconciliation preview with explicit confirmation. Later accounting adapter responsibilities:

- customer/vendor reference mapping;
- invoice/act create or export;
- tax/VAT fields;
- payment/status import;
- currency and partial payment;
- reconciliation report.

AktFlow does not post journal entries in v1 and does not become the accounting ledger.

External-ID lineage (обязательное условие первого accounting/CDE адаптера): каждый внешний идентификатор хранится как versioned mapping (external system, external id, mapping version, effective период); merge/recreate на стороне источника порождает новую mapping-версию с `supersedes` ссылкой, старая остаётся для чтения исторических записей. Адаптер без этой семантики не проходит acceptance checklist §10.

## 6. Storage and CDE integrations

First targets: generic S3-compatible archive, Google Drive/SharePoint export when commercial demand is proven, and downloadable manifest. Push packages to GC systems only with customer authorization. A copied external file retains source URL/reference and hash; deletion policy is explicit.

## 7. Qualified electronic signatures

A future КЕП adapter must:

- use an authorized trust service/provider;
- identify exact package/version hash being signed;
- validate certificate chain, status and timestamp;
- preserve signature container plus validation report;
- support multiple required signers/order;
- distinguish declined, expired, invalid and revoked;
- revalidate and archive for the required retention period.

Simple email/link approval remains an operational workflow decision and is labeled accordingly.

## 8. Notifications

Pilot sends only required identity/team/security transactional mail outside the product-notification preference system. It does not automatically send a customer package; the user sends outside AktFlow and records the receipt. In-app notifications are canonical and support own-recipient read receipts plus versioned preferences; unavailable external channels cannot be enabled. GA product email/push requires template/privacy/delivery evidence; Telegram/Viber/SMS follow only after consent and provider reliability. No consequential approval by chat reaction.

Notification events include assignment, before-concealment deadline, returned evidence, package ready/submitted/returned/accepted, payment due/overdue and security events. Digests suppress repetitive noise.

Escalation halt invariant: любая цепочка reminder/digest/escalation привязана к состоянию первопричины и останавливается в той же транзакции, где blocker/issue/review переходит в terminal или waived состояние; «висячих» эскалаций по уже решённым объектам быть не может (GA-цепочки наследуют инвариант без исключений).

## 9. Webhooks

Proposed events:

- `work_item.readiness_changed`;
- `capture_session.submitted`;
- `review.decision_created`;
- `package.generated|submitted|accepted|returned`;
- `receivable.due|overdue`;
- `payment.recorded`.

Envelope includes event ID, API version, org ID, occurred time, type and minimal payload. HMAC signature with timestamp; reject stale requests. Delivery uses exponential retry, dead-letter and replay UI. Never include binary evidence or unnecessary PII.

Delivery ordering: порядок доставки webhook-ов не гарантируется; получатель обязан быть идемпотентным и восстанавливать порядок по `occurred_at` + event ID (см. doc 22 §10).

## 10. Integration acceptance checklist

- least-privilege credentials;
- explicit direction and source-of-truth matrix;
- initial/full sync plus incremental sync;
- idempotency and duplicate tests;
- partial failure and rate-limit handling;
- mapping/dry-run/reconciliation, включая обязательный reconciliation report по шаблону missing/duplicate/rejected/transformed records с source references;
- versioned external-ID mapping с supersede-семантикой (см. §5);
- disconnect and credential rotation;
- audit and observability;
- data deletion/retention contract;
- sandbox fixtures and vendor outage behavior.

## 11. v2.9 read and command closure

Primary-office reads are first-class API operations: composite work detail, paginated readiness blockers, project rule versions, package versions/lines, resumable decision set and audit events. Every list applies tenant/project scope before filtering, ordering and cursor creation; a cursor never leaks whether an out-of-scope row exists.

State change uses typed commands with expected version and durable idempotency rather than generic PATCH. Commands that cross aggregate boundaries—rule publish, assignment materialization, offboarding consume, package reconciliation, acceptance/receivable and export cancellation—return a receipt naming every changed aggregate/version and write one transactional outbox boundary.

Occurrence triggers accept only the discriminator-specific payload. Unknown fields or incompatible source combinations are rejected. Package decisions enforce conditional reason/owner/due requirements server-side even if the client schema was bypassed. Every critical request field is either stored in the reference schema or marked as explicitly derived and covered by `T-API-SQL-PARITY-001`.

External integrations cannot bypass these commands by direct table writes. Imports produce a parse/preview artifact; confirmation consumes its exact hash and then calls the same domain transaction used by the first-party UI.
