# 26. SRE, Operations and Business Continuity

## 1. Service model

Pilot support is business-hours, best effort with explicit critical escalation; no 24/7 SLA. GA SLA is offered only after monitoring, on-call coverage and restore evidence support it.

Environments: local → preview → staging → production. Separate auth/database/storage/secrets; no production data copied to lower environments. Production access named, MFA-protected and logged.

## 2. Initial topology

- web/BFF application;
- managed Postgres/Auth/Storage;
- async worker and durable queue/outbox;
- managed email; optional SMS for OTP after vendor gate;
- PDF/document renderer isolated from request path;
- monitoring/log/error service;
- secrets manager;
- CDN/WAF/status page.

Exact vendors/regions are recorded in deployment ADR and subprocessor register before live data.

## 3. SLO candidates

| Journey | Pilot target | GA design target |
|---|---:|---:|
| authenticated web read availability | 99.5% monthly | 99.9% monthly |
| capture command server receipt | 99% <10s when online | 99% <5s |
| mobile outbox no data loss/duplication | zero known loss/duplicate quantity | zero; invariant alert |
| package job small/normal | 95% <5 min | 95% <3 min |
| external review page | 99.5% | 99.9% |
| P1 support acknowledgement | business day policy | contract-based |

SLO excludes documented client offline time but includes server handling after connectivity. Error budget controls release pace; no availability claim without measured telemetry.

## 4. Observability

Metrics:

- request rate/error/latency by operation, not tenant name;
- DB connections/locks/slow queries/replication;
- RLS/auth denials and session failures;
- queue depth/oldest age/retry/dead letter;
- upload/scan/document job latency/failure;
- outbox confirmation latency/conflicts;
- package total/hash reconciliation;
- storage growth/egress and cost;
- notification delivery/bounce;
- entitlement/billing reconciliation;
- backup age/restore validation.

Every job/request has correlation ID; trace/log payload is allowlisted/redacted.

## 5. Backup and disaster recovery

GA design target:

- database PITR RPO ≤60 minutes, target ≤15 where plan/provider supports;
- service RTO ≤4 hours;
- object versioning/redundancy and inventory/hash manifest;
- configuration/secrets recovery procedure;
- quarterly restore drill into isolated environment;
- restored DB/object referential and hash checks;
- annual provider-region/founder-unavailable exercise.

Pilot may use provider baseline only if disclosed and restore tested before live critical evidence. Backup is not assumed until successful restore evidence exists.

Per-component recovery objectives (проверяются T-RESTORE-001):

| Component | RPO | RTO | Mechanism |
|---|---|---|---|
| PostgreSQL (данные, jobs/outbox/idempotency — та же БД) | ≤60 min (цель ≤15) | ≤4 h | PITR |
| Object storage (originals/derivatives/exports) | 0 для committed objects | ≤4 h | versioning + inventory/hash manifest; повторная деривация из originals |
| Queue/outbox | = БД (персистентен в Postgres) | ≤4 h | восстановление вместе с БД; воркеры идемпотентны |
| Identity provider (Auth) | provider SLA | ≤4 h деградация: read/export через recovery runbook | provider redundancy + документированная re-enrollment процедура (doc 07 §13) |

## 6. Deployment and migration

- trunk-based small changes, required CI;
- immutable artifact and dependency lock;
- feature flags with owner/expiry;
- canary/pilot tenant rollout where possible;
- expand/migrate/contract DB changes;
- pre-deploy backup/PITR check for risky migration;
- automated health/invariant checks;
- one-command app rollback plus migration forward-fix/compatibility plan;
- release notes include impact, metrics, flag and rollback threshold.

## 7. Runbook catalogue

Required before Pilot:

- authentication provider outage;
- database saturation/unavailable;
- storage/upload outage;
- queue backlog/dead letters;
- package generation corruption/failure;
- email/OTP outage;
- bad deployment/migration;
- lost operator credentials;
- customer export failure;
- mobile sync spike.

Required before GA:

- suspected tenant leak;
- compromised token/integration/support account;
- malicious file/renderer incident;
- data integrity mismatch;
- billing/entitlement mischarge;
- provider/region loss;
- legal hold/deletion failure;
- founder unavailable.

Pre-Pilot добавляются четыре именованных полевых runbook-а: **bad import** (откат неподтверждённого импорта, повторный dry-run, сверка diff), **wrong mapping** (новая версия mapping preset + re-import по stable lineage без потери downstream-записей), **lost device** (revoke-all + lease invalidation + судьба несинхронизированных доказательств по doc 23 §9), **package mismatch** (пересчёт totals из immutable snapshot, сверка manifest hashes, типизированные correction issues вместо правки пакета).

**Release/deploy runbook** (упорядоченный, воспроизводимый вторым инженером):

1. cut: тег релиза `vMAJOR.MINOR.PATCH+build`, зафиксировать lockfile/container digest;
2. migrate: применить expand-миграции (backward-compatible, N-1 совместимость воркера/мобайла), проверить pre/post money/tenant инварианты;
3. staging deploy → `make validate` + автоматический `T-DEPLOY-SMOKE-001` (health, auth, один tenant-scoped read, один idempotent write-replay, RLS-deny проба);
4. promote: canary (1 инстанс/малый %), наблюдать error-budget burn и oldest-job-age 15 минут;
5. full rollout при зелёных SLI; иначе abort;
6. monitor 24h против алертов doc 26 §4;
7. rollback: восстановить предыдущую совместимую версию приложения; необратимые data-transformations идут по restore/forward-fix плану (doc 22 §11), не по откату схемы;
8. hotfix: тот же путь с ускоренным canary; запись в release log.

Версионная схема: SemVer + build; deprecation интеграций — по doc 22 §11 (Deprecation/Sunset ≥90 дней).

Each runbook: trigger, severity, immediate containment, diagnostic queries, prohibited actions, rollback/recovery, communication, evidence, exit criteria and follow-up.

## 8. Incident process

Declare severity/commander/channel/timeline → contain → communicate internally → customer/legal assessment → recover → verify invariants → resolve → postmortem/actions. Status page avoids leaking tenant/security detail. All timestamps UTC plus customer-local display.

## 9. Capacity and cost model

Per tenant track active projects/users, original/derivative storage, upload egress, package CPU/pages, API/webhook traffic, notification cost, support/setup hours. Alert before provider quota. Scale decisions use measured p95 and cost/customer, not customer-count guesses.

Stage A remains modular monolith. Split worker/storage pipelines only when queue isolation, cost or reliability data justifies it. Dedicated deployment only when contract funds its operational ownership.

Числовые revisit-триггеры сплита (ADR-001): oldest queued job age p95 > 10 min на протяжении недели при выполненных оптимизациях; API error-budget burn > 2× бюджета два месяца подряд из-за конкуренции worker/API; cost per active tenant > 30% ACV. Любой сработавший триггер открывает architecture review, а не автоматический сплит.

Fail-first при 10×: ожидаемые первые точки отказа — (1) Postgres-очередь jobs (конкуренция с OLTP; SLI: oldest job age, lock waits), (2) единый document/render pipeline (SLI: render p95, очередь генераций), (3) storage egress/деривативы (SLI: upload/download error rate, egress cost). Каждая точка уже наблюдаема метриками §4; порог = соответствующий revisit-триггер выше.

## 10. Solo-founder continuity

- emergency contact and encrypted credential escrow;
- domain/DNS/cloud/billing ownership not tied to one inaccessible device;
- documented deploy/rollback/restore;
- vendor/subprocessor inventory and renewal dates;
- customer communication template;
- contractor access is time-bound and rehearsed;
- no unsupported 24/7 promise;
- hire/contract trigger when support >20% for four weeks or security commitments exceed one-person coverage.

## 11. Go-live checklist

- production inventory/regions/subprocessors approved;
- DNS/TLS/email authentication/status/security contacts;
- backups and restore evidence current;
- alerts tested with receiver;
- rate limits/quotas/cost alerts active;
- migrations/feature flags/rollback reviewed;
- seed/demo separated from production;
- support and incident contacts visible;
- first tenant provisioning and close procedure rehearsed;
- no unresolved critical/high defect.

## 12. v2.9 operational safeguards

- Deploy the command-availability policy and every handler that consumes it as one compatibility unit; policy-version drift blocks rollout.
- Parent-state transitions and lease invalidation share one transaction/outbox. Alert on any parent change that leaves a matching active lease.
- Quarantine, offboarding plan and package-decision issue backlogs expose age, owner and stuck-state alerts without logging evidence content.
- Export cancellation is fenced: partial archives are inventoried and erased before `cancelled`; stale workers cannot publish a ready link.
- Period close cycles, numbering reservation and package generation have separate idempotency and reconciliation monitors.
- Payment fingerprint conflicts are business warnings, not automatic merge; operators never bypass the ledger with direct SQL.
- Parser/lint/semantic-validator success is build evidence only. Production admission separately requires migrations, RLS tests, physical-device offline traces, restore drill, monitoring delivery and role-based UAT.
