# 31. Architecture Decision Records

## ADR-001 Modular monolith

Decision: one deployable application/BFF and worker with explicit domain modules. Reason: solo operational simplicity. Split only on measured isolation/cost/scale need.

## ADR-002 Web office + native field

Decision: responsive web for office/external review, Expo native app for reliable camera/offline. PWA may demo but is not primary field promise.

## ADR-003 Server/BFF owns high-risk commands

Decision: direct client Data API access is limited in Pilot to `SELECT` on the reviewed `api.project_list` projection. All writes and all other reads use BFF query/command handlers. Reason: one authorization/audit/idempotency boundary; the allowlist may expand only with threat-model and negative-RLS tests.

## ADR-004 Postgres tenancy with defense in depth

Decision: shared Postgres initially, explicit organization/project context, composite tenant integrity, RLS/grants plus API checks. Dedicated tenant deployment is enterprise option, not initial architecture.

## ADR-005 Append-only ledgers and immutable versions

Decision: quantities, decisions, packages and payments corrected through new entries/versions. Reason: traceability and reconciliation.

## ADR-006 Deterministic readiness

Decision: versioned rules/human review; AI cannot approve money/evidence. AI later suggests mapping/quality/classification with confirmation.

## ADR-007 Transactional outbox

Decision: database commit and integration/job intent are atomic; workers provide at-least-once processing with deduplication.

## ADR-008 Private immutable media originals

Decision: private object storage, original hash, scan quarantine, derivatives for edit/redaction, short-lived access.

## ADR-009 Async documents/exports

Decision: snapshot first, queued renderer, manifest/hash, job lifecycle. No long document generation in request thread.

## ADR-010 Plans as entitlements

Decision: immutable plan versions and feature grants; no scattered plan-name conditionals. Project commercials are separate context.

## ADR-011 Generic package plus adapters

Decision: generic evidence/readiness export is core; customer/country forms are versioned adapters with fixture/gate. Prevents custom agency trap.

## ADR-012 Manual external sending in Pilot

Decision: user records submission/receipt; AktFlow does not autonomously email customer during Pilot. Reduces wrong-recipient/legal risk.

## ADR-013 Node/runtime support policy

Decision: Node 24 LTS baseline as of 2026-07-22, exact lockfile/container digest, monthly dependency/security review, upgrades through CI/staging rather than `latest` at runtime. Node 22 is a time-bounded compatibility fallback, not the target baseline.

## ADR-016 Supabase exposure and runtime roles

Decision: expose only the `api` schema to the Data API; keep tenant tables in unexposed `public`; treat schema exposure, SQL grants and RLS as independent mandatory controls. BFF/worker/external/support use separate `NOLOGIN`, `NOBYPASSRLS` group roles and transaction-local verified context. `service_role` is restricted to migrations and declared break-glass. Reason: current Supabase defaults do not make a complete access model, and a bypass-RLS runtime credential would nullify tenant defense in depth.

## ADR-014 No default support impersonation

Decision: metadata-only support plus tenant-approved time-bound grant; break-glass dual approval. Reason: insider/tenant trust.

## ADR-015 Country pack isolation

Decision: locale/currency/unit/document/signature/privacy differences are configuration/adapters with local validation. EU market access is not treated as process equivalence.

## ADR-017 OpenAPI 3.1 compatibility baseline

Decision: normative contract remains on OpenAPI 3.1.x while the selected lint, code-generation and gateway toolchain is verified end-to-end. OpenAPI 3.2 is monitored but is not adopted by version bump alone. Upgrade requires a compatibility matrix for Problem Details, JSON Schema dialect, generated clients, gateway validation and contract-diff tooling; additive 3.1-compatible API work continues meanwhile. Revisit on toolchain qualification or before public third-party API launch.

## ADR-018 Individual task ownership only

Decision: каждый actionable объект (review task, correction issue, blocker) имеет ровно одного владельца-человека (user FK) либо явное unassigned состояние; role/team/external ownership не моделируются в Pilot/GA-core. Reason: однозначная ответственность и простые SLA; групповое владение размывает overdue-подотчётность. Revisit: спрос ≥3 ICP на командные очереди.

## ADR-019 Relational evidence lineage (no graph database)

Decision: Evidence Graph (doc 39) реализуется в PostgreSQL: рёбра — существующие FK/link-таблицы, обходы — recursive CTE по allowlisted путям, tenant-фильтр на каждом шаге. Отдельная graph DB не вводится. Reason: один движок хранения, один RLS-контур, один backup/restore. Revisit trigger: p95 канонических multi-hop explainability-запросов (doc 39 §7) стабильно превышает бюджет UI (500 ms) на Stage C нагрузке после индексных/материализационных оптимизаций.

## Revisit triggers and owners

| ADR | Revisit trigger | Owner |
|---|---|---|
| 001 | числовые SLI-триггеры сплита (doc 26 §9) | Architecture |
| 002 | полевой PWA паритет камеры/офлайна, доказанный тестами | Product |
| 003 | запрос на расширение Data API allowlist → threat-model + negative-RLS тесты | Security |
| 004 | enterprise-контракт, финансирующий dedicated deployment | Architecture |
| 005 | нет (core invariant; пересмотр = новый мажорный контракт данных) | Architecture |
| 006 | введение любой AI-фичи через gate doc 12 §8 | Product |
| 007 | смена очереди/шины; missing-event drift выше алерта doc 26 §4 | SRE |
| 008 | требование клиентского KMS/BYOK | Security |
| 009 | render p95 из doc 26 §9 fail-first | SRE |
| 010 | биллинговый провайдер с несовместимой моделью entitlements | Product |
| 011 | ≥3 адаптера с дублирующейся логикой → пересмотр ядра шаблонов | Architecture |
| 012 | V-010 + подтверждённый спрос на автоматическую доставку | Legal (external) |
| 013 | новый Node LTS; monthly security review | SRE |
| 014 | нет (trust invariant) | Security |
| 015 | вход в новую страну (V-008) | Product |
| 016 | смена Supabase-модели exposure/ролей; provider-exit (doc 07 §13) | Security |
| 017 | toolchain qualification для OpenAPI 3.2 или публичный API | Architecture |
| 018 | спрос ≥3 ICP на командные очереди | Product |
| 019 | p95 multi-hop explainability-запросов выше бюджета на Stage C | Architecture |

Each ADR implementation PR must record status, owner, date, consequences and revisit trigger. New boundary/provider/security-sensitive feature requires a new ADR.
