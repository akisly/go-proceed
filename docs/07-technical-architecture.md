# 07. Technical architecture and scaling plan

## 1. Chosen stack

| Layer | MVP choice | Rationale |
|---|---|---|
| Office web | Next.js 16.2.11+ patched 16.2.x, React, TypeScript | SSR landing/auth, mature app routing, one web codebase; security-patched Active LTS floor |
| Field app | Expo SDK 57 / React Native, TypeScript | camera/files/offline, shared domain types, OTA strategy |
| UI | custom tokens + accessible primitives | distinct product character; avoid framework lock-in |
| API | Next.js BFF + domain service layer | fast solo delivery; no direct business mutations from client |
| Database/Auth/Storage | managed Supabase Postgres/Auth/Storage/Realtime | fast MVP with SQL/RLS and managed operations |
| Async worker | Node.js 24 LTS TypeScript service | PDF/XLSX generation, thumbnails, notifications, exports |
| Queue | Postgres-backed jobs first; managed queue later | few moving pieces, transactional enqueue |
| Cache/rate limit | provider edge + optional managed Redis | introduce only when real load/abuse requires it |
| Mobile local store | Expo SQLite + durable outbox | offline-first field workflow |
| Observability | OpenTelemetry + error tracking + structured logs | trace API/job/document pipeline |
| Product analytics | privacy-conscious event pipeline | activation/readiness/retention measurement |
| CI/CD | GitHub Actions, preview env, managed deploys | repeatable checks and rollback |

Version baseline at reconciliation date 2026-07-22: Next.js **16.2.11 or newer security-patched 16.2.x**, Expo SDK 57.0.9 and Node.js 24 LTS. Generic `16.2` is forbidden because the 20.07.2026 security release fixed four HIGH and five MEDIUM findings in 16.2.11. Pin exact patch versions and image digests in lockfiles/deployment evidence; Dependabot/Renovate-style alerts do not auto-deploy and every upgrade passes CI, staging and rollback rehearsal. Node 22 remains a maintenance fallback only while every selected dependency and hosting target supports it. Preview/canary features are excluded from Pilot.

## 2. Logical architecture

```text
Browser / Expo app / External reviewer
            │ HTTPS
        Edge + WAF
            │
      Next.js BFF/API ───── Auth
            │
      Domain services
       │      │       │
   Postgres  Storage  Transactional outbox
                         │
                     Worker fleet
                   PDF/XLSX/media/email
```

Browser/mobile may directly read only the reviewed `api.project_list` projection through the Supabase Data API. The `public` schema is not an exposed Data API schema. Every other query and every business mutation pass through BFF command/query handlers that validate role, project/location scope, object state, entitlement, idempotency/version and audit payload.

### 2.1 Database access topology

`technical/data-access-surface.csv` is the allowlist. Anything absent is denied.

- `authenticated`: Supabase Auth plus `SELECT` on reviewed `api` projections; never tenant-table mutation.
- `aktflow_app`: `NOLOGIN`, `NOBYPASSRLS` BFF group role with table/action grants generated from the allowlist.
- `aktflow_worker`: `NOLOGIN`, `NOBYPASSRLS`; tenant and resource are loaded from the persisted job, never trusted from an incoming payload.
- `aktflow_external`: exact-package capability role activated only after share/session/expiry/revocation verification.
- `aktflow_support`: no standing table grants; GA-only approved functions under an active time-bound support grant.
- `aktflow_platform_billing`: isolated platform-billing role for the `x-audience: platform_billing` SaaS invoice/payment commands; grants are limited to the platform billing allowlist, and tenant roles read SaaS billing history read-only.
- `service_role`: migrations and declared break-glass only; prohibited for normal BFF/worker requests.

For a BFF database transaction: verify the Supabase access token server-side; resolve the active membership; start the transaction; set transaction-local `app.actor_user_id`, organization, request and membership-version context; execute with the least-privilege group role; commit domain change, audit record and outbox intent atomically; reset occurs automatically at transaction end. A pooled connection must never carry session-level tenant context. Negative policy tests deliberately substitute organization, project, location and object IDs.

## 3. Repository shape

```text
apps/web
apps/mobile
apps/worker
packages/domain
packages/contracts
packages/ui-web
packages/ui-native
packages/design-tokens
packages/database
packages/testing
infra
```

Use a monorepo (pnpm + Turborepo). Shared code is limited to domain types, schemas, API client and tokens; do not force web UI into native wrappers.

## 4. API conventions

- REST/JSON for commands and query resources; presigned multipart uploads for media.
- `/v1`; additive changes preferred; breaking behavior needs a new endpoint/version.
- Input/output runtime validation from shared schemas.
- `Idempotency-Key` required for every POST command; money and offline ledgers additionally persist a tenant-scoped `clientOperationId` where their durable replay window exceeds HTTP idempotency storage.
- Inbound strings follow the OpenAPI NFC/boundary-whitespace/control-character policy before authorization or persistence.
- `If-Match`/version number for conflicting edits.
- Cursor pagination and stable sort.
- One `application/problem+json` envelope with stable `code`, localized-safe `detail`, structured `fieldErrors`, `requestId`, `retryable` and `userAction`.
- API never returns bucket credentials or provider multipart IDs. Upload receipts may echo a random opaque logical `objectKey` from the persisted intent; it contains no tenant/path semantics and is not independently addressable.

## 5. Offline synchronization

### Local model

Mobile stores scoped assignments, rule definitions, small reference media, drafts and outbox operations in SQLite. Each local record has server ID when known, client ID, version, sync state and timestamps.

### Write protocol

1. User action commits local domain record and outbox operation in one SQLite transaction.
2. UI reports locally saved.
3. Sync engine sends operations in causal order with idempotency key.
4. Server transaction authorizes, validates base version, persists data and audit, returns canonical version.
5. Client marks server-confirmed and uploads remaining media chunks.

### Conflicts

- additive evidence normally merges;
- duplicate quantity operation is deduped;
- reassignment/rule/version conflict requires user choice;
- submitted/approved records cannot be overwritten by stale mobile state;
- clock is never used as sole winner.

Outbox is observable: age, attempts, last code and dead-letter state. Background sync is best-effort; opening the app always resumes explicitly.

## 6. Media pipeline

1. Client strips unsupported metadata according to policy but retains required provenance separately.
2. Server issues short-lived scoped multipart upload.
3. Object lands on a private, intent-bound staging key.
4. Finalization verifies the received size and SHA-256 against the authorized values and inspects the content — in v0.1 synchronously inside the finalization command (`apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts`), not as a separate worker. That inspection is a magic-byte check of the declared media type (`apps/app/src/lib/evidence-inspection.ts`, policy `m2a-magic-bytes-1`, whose own comment records that "v0.1 ships no anti-malware engine"). Malware scanning, dimension/page extraction and derivative generation are a later target, not current behaviour.
5. The same transaction marks the intent `available` and creates the evidence receipt, or marks it `scan_blocked` and creates none; a blocked object is retained for a bounded diagnosis window and the user sees remediation.
6. DB references storage key/hash; URL is generated short-lived on access.

Upload limits and formats are rule/plan controlled. Large video is post-MVP unless a paid pilot proves need.

## 7. Document generation

Package command creates snapshot and queues a deterministic job. Worker renders from versioned template plus locale/regulatory adapter, then validates file, stores hashes and produces manifest. Retries never create a second logical version. Generated PDF is accompanied by machine-readable JSON/XLSX when applicable.

Do not claim КЕП from a visual signature. A qualified trust-service integration, signature validation and long-term validation evidence form a separate bounded service.

### Secrets envelope contract

Интеграционные секреты (`webhook_endpoints.signing_secret_ciphertext`, `endpoint_url_ciphertext`, integration credentials) шифруются envelope-схемой, а не «просто bytea»:

- **KEK** — именованный master key в managed KMS (Supabase Vault / cloud KMS), никогда не покидает KMS; app получает только операции wrap/unwrap.
- **DEK** — per-secret data key: генерируется при записи, шифрует ciphertext, сам хранится обёрнутым KEK-ом рядом (`wrapped_dek bytea` + `key_id text`, ссылающийся на версию KEK).
- **Ротация**: `key_id` позволяет ротировать KEK независимо от значения секрета (`secret_version` ротирует сам секрет). Ротация KEK = re-wrap всех DEK без расшифровки ciphertext; плановая ≥ ежегодно и по инциденту.
- Расшифровка — только в worker-контексте под активной задачей; ключ и plaintext не логируются, не попадают в crash payload, не отдаются клиенту. Задача реализации — P0-G? (integration security), DoD включает `key_id`/`wrapped_dek` колонки и rotation-drill.

## 8. Security architecture

- short-lived sessions, rotating refresh tokens and MFA for every live Pilot user; privileged commands additionally require recent-auth step-up;
- server-side authorization plus database RLS;
- encryption in transit and managed at rest; application-level envelope encryption for integration/webhook secrets (см. контракт ниже);
- secrets in managed secret store, separated per environment;
- audit events append-only enforced by `REVOKE UPDATE/DELETE` from all runtime roles + INSERT-only security-definer function + hash-chain и off-box WORM sink (doc 25 §8); никакой runtime-кред и break-glass не может тихо изменить строку;
- CSRF protection for cookie mutations, strict origin policy and CSP;
- rate limit login, invite, share token, exports and expensive document jobs;
- presigned URL TTL minutes, not days;
- dependency/SAST/secret/container scans in CI;
- tested backup/PITR and restore runbook.

## 9. Reliability targets

MVP service targets (not contractual SLA):

- API availability 99.5% monthly, excluding announced maintenance;
- p95 interactive API <500 ms for normal filtered datasets;
- dashboard first useful content <2.5 s on typical broadband;
- local field actions <100 ms perceived;
- 95% ordinary package jobs <3 minutes;
- RPO ≤24 h during pilot, target ≤1 h paid production;
- RTO ≤8 h pilot, target ≤4 h paid production.

Every target gets a measured SLI and alert threshold. Never market an SLA before operations can support it.

## 10. Scaling stages

### Stage A — 0–20 customers

One managed project per environment, one worker, Postgres jobs, single EU region. Optimize learning, restore tests and tenant isolation. Avoid microservices.

### Stage B — 20–100 customers

Read models/materialized summaries for dashboards, worker autoscaling, managed Redis for limits/cache, table/index tuning, storage lifecycle rules, dedicated analytics sink. Introduce per-tenant quotas and noisy-neighbor dashboards.

### Stage C — 100–500 customers / CEE

Separate document/evidence workers, regional storage/data residency options, partition high-volume audit/evidence tables, asynchronous integration bus, dedicated enterprise projects if required. Regulatory/template adapters become independently versioned packages.

### Stage D — enterprise/dedicated

Dedicated database/storage or self-hosted deployment only when contract value funds operational complexity. Self-hosting requires explicit ownership of backups, patching, SMTP, logs, metrics, secrets, scaling and incident response; it is not a checkbox.

## 11. International expansion architecture

Core remains jurisdiction-neutral:

- currency/tax/unit/calendar adapters;
- localized status aliases;
- customer submission template packs;
- signature/provider adapter;
- document schema/export adapter;
- data residency policy;
- translation keys, no hardcoded Ukrainian copy.

New country launch requires a regulatory pack, local workflow discovery and pilot. Do not assume EU single market makes construction acceptance/document practices uniform.

## 12. Environments and delivery

- local dev with synthetic seed;
- ephemeral preview per PR, no production data;
- staging with production-like policies and fake integration endpoints;
- production with protected migrations and feature flags.

Migration flow: expand schema → deploy compatible code → backfill → switch reads → contract later. Every migration has lock/time estimate, verification and rollback/forward-fix plan.

## 13. Build versus buy

Buy auth primitives, storage, email delivery, error collection and managed database. Build readiness rules, evidence/quantity lineage, offline command model and package snapshotting—the product moat. Avoid building chat, generic task management, payroll, accounting or a document editor.

Provider-exit matrix (минимальный план замены; независимость — структурная: BFF-граница, RLS в Postgres, hash-манифесты, отсутствие AI в core):

| Provider | Exit strategy | Ключевой шаг |
|---|---|---|
| Auth (Supabase Auth) | identity хранится как stable internal user ID; membership не зависит от провайдера | экспорт identity→membership mapping; re-enrollment процедура (пароль/MFA re-setup) по runbook; sessions revoke-all |
| Object storage | приватный bucket + inventory/hash manifest | bulk copy по manifest, сверка SHA-256, переключение подписанных URL |
| Email/notification | provider-агностичный notification_delivery контракт | смена sink-конфигурации; недоставленное уходит в retry/dead-letter |
| Payments (SaaS) | Pilot = банковский платёж по payment request; карты вторичны | смена реквизитов/провайдера не трогает tenant-данные; reconciliation по fingerprint |

## 14. Policy and contract execution boundary

All API, worker, sync and UI command availability is evaluated from the same versioned, priority-ordered table in `technical/command-availability.csv`. The evaluator receives organization, subscription, project, contract, work/resource state and command class, selects the first matching rule and denies when no allow rule matches. API middleware must not duplicate a weaker hard-coded policy.

Authorization-affecting parent transitions invalidate matching offline leases inside the same database transaction and write an outbox event. Processing of already server-received objects is a different command class from first receipt of unseen offline bytes.

`technical/schema.sql` and `technical/openapi.yaml` are reference contracts, not deployable migrations or generated clients. Implementation converts them into ordered expand/backfill/contract migrations, generates server/client types, and runs semantic parity tests against the deployed schema. The SHA-bound parser/lint reports establish source syntax only; they do not establish runtime correctness.
