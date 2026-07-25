# AktFlow — полный product package

Версия: 2.9  
Дата среза: 23 июля 2026  
Статус: production-oriented specification для узкого Pilot MVP и безопасного самостоятельного GA; внешние gates перечислены явно  
Рабочее имя: **AktFlow** — перед регистрацией бренда необходимы отдельные trademark/domain checks.

### Что закрыто в v2.9

- закрыты 28 групп разрывов независимого v2.8-аудита: core reads, occurrence strategies, безопасная offline chronology, canonical rule payload и staged offboarding;
- введена единая fail-closed матрица доступности команд по состояниям organization/subscription/project/contract и полный реестр invalidation для offline lease;
- BOQ re-import теперь работает по stable lineage: Pilot принимает только измеряемые строки с положительным количеством, а headings/unsupported commercial rows не становятся work items;
- package decision разделён на один финансовый outcome строки и множество типизированных correction issues; incomplete decision set не влияет на деньги/readiness;
- acceptance successor блокируется при downstream receivable/payment; review correction и waiver revoke создают append-only receipts, а повторное review — новый decision successor;
- authoritative reporting date отделена от недоверенной даты устройства; закрытый период, future/backdate и post-invalidation capture имеют явные guard/recovery;
- numbering series, versioned business calendar, period close cycles, payment source fingerprint и safe export cancellation получили полные lifecycle contracts;
- валидатор дополнен reachability, reversal-command, command-policy, read-closure и критическими OpenAPI↔SQL parity checks;

- закрыты semantic gaps между API, SQL, state machine, permissions, events, traceability, tests и backlog;
- organization-wide offboarding охватывает все проекты, assignments, reviews, corrections, approval/integration ownership, exact versions и offline-capture policy без silent truncation;
- server-issued offline authorization lease связывает membership, assignment, policy и bundle versions; часы устройства не считаются доказательством полномочий;
- стабильная numbering series отделена от версии договорных условий; acceptance имеет единственную current lineage head, same-package successor и state/amount invariants;
- активный договор блокирует завершение/архив проекта, а SaaS reversal возвращает типизированный settlement receipt;
- добавлены exact-preview + atomic commit для offboarding и subscription state change, assignment/review reassignment receipts и reference acknowledgement;
- формализованы contract/variation/share recovery transitions, append-only acceptance lineage, атомарная нумерация package и SaaS payment reversal;
- ужесточены quantity, payment-due, retention и evidence-rule invariants; каждое не-terminal состояние имеет recovery path;
- визуальная система прототипа переведена на Carbon `#171717`, Lime `#c6ff34`, Slate `#484c5e` и Paper `#fbfbfb`; добавлены умеренные glass-поверхности, тени, motion и reduced-motion fallback;
- Product Design direction `02 — Evidence Atlas` выбрана как единственная нормативная визуальная система; source board, синтетические blueprint/evidence/stamp assets, crop/motion/navigation rules и visual QA evidence сохранены в `design-references/evidence-atlas/` и применены ко всему прототипу;
- лендинг прямо фиксирует iOS/Android field app как Pilot core, объясняет offline-first capture и два receipt-состояния и ведёт в интерактивный `/field` flow без преждевременного App Store/Google Play claim;
- isolated `platformBillingAuth` + `aktflow_platform_billing`; tenant SaaS billing history is read-only;
- explicit `X-Organization-Id` on every authenticated tenant route except organization creation/invitation acceptance;
- `X-Request-Id` on every request/response, explicit `429/Retry-After`, exact `ETag` and 30d/400d idempotency contracts;
- terminal project archive with linked continuation instead of in-place restore; immutable evidence correction instead of unspecified soft delete;
- отдельная versioned `work_assignment` вместо assignee на договорной строке; детерминированные requirement occurrences и review SLA;
- versioned contract terms, controlled reference revisions, typed evidence, hold-point/concealment и post-line package decisions;
- append-only quantity correction semantics и feature-promise registry, запрещающий prose-only функции;
- exact occurrence evidence links, subject-bound capture/quantity lineage and occurrence-scoped waivers/requests;
- assignment lifecycle/preview/offline execution bundle and durable per-row batch identity;
- atomic package decision sets, non-overlapping versioned periods and double-claim prevention;
- persisted HTTP idempotency plus worker lease fencing and executable composite-FK validation;
- universal live-Pilot MFA wording, security-patched Next.js 16.2.11+ floor and honest 6–9 month Pilot / 12–18+ month GA solo range;
- independent Redocly lint and semantic regression checks for every invariant above.

## Что это за продукт

AktFlow — evidence-to-payment operating layer для специализированных строительных субподрядчиков. Он связывает позицию договора/сметы с фактически выполненным объёмом, обязательными доказательствами, согласованиями, исполнительными документами, пакетом АВР и оплатой.

Главный вопрос продукта:

> Какая сумма выполненных работ уже готова к предъявлению, а какая остаётся под риском — и почему?

AktFlow не заменяет АВК, BAS/1C, ERP, бухгалтерию, BIM или систему генподрядчика. Он формирует проверенный master-record субподрядчика и отдаёт наружу готовые данные и документы.

## Как пользоваться комплектом

1. Начать с [production-readiness index](docs/17-production-readiness-index.md): там релизные границы, нормативный приоритет документов и definition of ready.
2. Для product/UX читать [PRD](docs/01-prd.md), [screen specification](docs/04-screen-specification.md), [flow catalog](docs/20-flow-catalog.md) и [prototype coverage](docs/29-prototype-coverage.md).
3. Для реализации использовать [state machines](docs/18-domain-state-machines.md), [access model](docs/19-organizations-roles-access.md), [data/API contract](docs/22-data-api-contract.md) и машиночитаемые контракты в `technical/`.
4. Для Pilot/GA вести работу по [delivery plan](docs/28-pilot-ga-delivery.md) и закрывать [production gate checklist](docs/34-production-gate-checklist.md).
5. Перед каждым релизом применять [QA/traceability](docs/27-qa-traceability.md), [security threat model](docs/25-security-threat-model.md), [SRE runbook](docs/26-sre-operations.md) и [legal gates](docs/24-legal-regulatory-gates.md).
6. Все неизвестные клиентские, юридические и бухгалтерские факты хранить в [validation register](docs/30-validation-evidence-register.md), не заменяя evidence мнением founder.
7. Запустить [интерактивный прототип](prototype/README.md); его границы и подтверждённая fidelity зафиксированы отдельно.

Структурная проверка всего пакета и сборка прототипа запускаются одной командой:

```bash
make validate
```

## Состав комплекта

| Артефакт | Назначение |
|---|---|
| `docs/00-product-brief.md` | Одностраничная продуктовая рамка и решения |
| `docs/01-prd.md` | Полный PRD, scope, требования, KPI, NFR |
| `docs/02-market-competition.md` | Рынок, конкуренты, borrow/avoid/build |
| `docs/03-personas-jtbd-workflows.md` | ICP, роли, JTBD, end-to-end workflows |
| `docs/04-screen-specification.md` | Инвентарь и подробная спецификация экранов/состояний |
| `docs/05-design-system.md` | Бренд, tokens, компоненты, responsive, motion, a11y |
| `docs/06-data-model-permissions.md` | Доменная модель, статусы, RBAC/ABAC, audit |
| `docs/07-technical-architecture.md` | Stack, сервисы, offline sync, файлы, окружения |
| `docs/08-api-integrations.md` | API, интеграции, импорты/экспорты, webhooks |
| `docs/09-security-compliance.md` | Threat model, RLS, data residency, DR, КЕП |
| `docs/10-billing-pricing.md` | Планы, metering, invoicing, trials и entitlement |
| `docs/11-analytics-events.md` | North-star, funnel, события и свойства |
| `docs/12-roadmap-delivery.md` | Этапы от concierge pilot до CEE |
| `docs/13-qa-acceptance.md` | Тестовая стратегия и release gates |
| `docs/14-gtm-pilot.md` | Discovery, paid pilot, продажи и onboarding |
| `docs/15-risks-decisions.md` | Риски, ADR и открытые вопросы |
| `docs/16-fidelity-ledger.md` | Визуальная/интерактивная QA-сверка prototype с концептами |
| `docs/17-production-readiness-index.md` | Релизные уровни, bounded contexts, нормативная иерархия, gates |
| `docs/18-domain-state-machines.md` | Жизненные циклы и допустимые переходы доменных сущностей |
| `docs/19-organizations-roles-access.md` | Компании, участники, роли, scope, SoD, offboarding |
| `docs/20-flow-catalog.md` | End-to-end happy/alternate/error/recovery flows |
| `docs/21-plans-entitlements-billing.md` | Планы, лимиты, SaaS billing и безопасная деградация |
| `docs/22-data-api-contract.md` | Целевая модель данных, API semantics, idempotency, jobs/webhooks |
| `docs/23-offline-media-protocol.md` | Offline outbox, media lifecycle, конфликты и восстановление |
| `docs/24-legal-regulatory-gates.md` | Claims boundary, privacy, retention, КЕП и country gates |
| `docs/25-security-threat-model.md` | Trust boundaries, threats, controls и security release gates |
| `docs/26-sre-operations.md` | SLO, observability, DR, deploy/rollback и solo continuity |
| `docs/27-qa-traceability.md` | Requirements-to-tests traceability и release evidence |
| `docs/28-pilot-ga-delivery.md` | P0/GA epics, последовательность, rollout и kill criteria |
| `docs/29-prototype-coverage.md` | Какие основные flows интерактивны, какие состояния текстовые |
| `docs/30-validation-evidence-register.md` | Внешние допущения, safe defaults и evidence gates |
| `docs/31-architecture-decisions.md` | Зафиксированные ADR и триггеры пересмотра |
| `docs/32-customer-country-adapters.md` | Версионируемые customer/country adapters |
| `docs/33-support-admin-plane.md` | Изолированный support/admin plane и break-glass |
| `docs/34-production-gate-checklist.md` | Единая доска готовности Pilot и GA |
| `docs/35-data-access-tenancy.md` | Нормативный allowlist DB/Data API ролей, RLS и tenant integrity |
| `docs/36-security-verification-profile.md` | Зафиксированные ASVS/MASVS уровни, evidence и no-waiver controls |
| `docs/37-functional-closure-feature-register.md` | Promise register: Pilot/GA/deferred/integration/no-build и orphan-prevention |
| `docs/38-business-logic-closure.md` | Нормативные решения v2.9 по read closure, occurrence, offline safety, lifecycle recovery, offboarding и commercial compensation |
| `docs/39-evidence-graph.md` | Evidence Graph: канонические узлы/рёбра, слои фактов, инварианты, tenant-safe traversal, PostgreSQL-first реализация и AI-граница |
| `technical/schema.sql` | Целевая PostgreSQL reference schema; не исполняемая migration history |
| `technical/openapi.yaml` | Версионируемый target API contract |
| `technical/openapi-redocly-report.txt` | Независимый Redocly lint evidence для OpenAPI v2.9 |
| `technical/sql-parser-report.txt` | Независимый PostgreSQL parser evidence с SHA-256 привязкой к reference schema |
| `technical/command-availability.csv` | Приоритетная fail-closed матрица допустимости command classes и lease consequences |
| `technical/rate-limits.csv` | Per-endpoint/per-tenant/burst лимиты и anti-abuse окна публичных поверхностей |
| `technical/copy-catalog.csv` | Канонический источник UI-строк: статус-лейблы, per-screen состояния и ключевые действия |
| `technical/permissions.csv` | Матрица ролей и действий |
| `technical/events.csv` | Tracking plan в машиночитаемом виде |
| `technical/state-catalog.csv` | Канонические состояния, storage scope и terminal semantics |
| `technical/terminology.csv` | Канонические UI-термины и запрещённые трактовки |
| `technical/traceability.csv` | Сквозная связь requirement → contract → test → gate |
| `technical/state-transitions.csv` | Машиночитаемые переходы состояний |
| `technical/entitlements.csv` | Матрица планов, meter и limit consequence |
| `technical/error-catalog.csv` | Стабильные API error codes и recovery semantics |
| `technical/data-access-surface.csv` | Точный allowlist consumers/roles/grants/exposure для каждого объекта |
| `technical/data-retention-catalog.csv` | Полное table → retention class/deletion/legal-hold mapping для всех 126 таблиц |
| `technical/test-catalog.csv` | Исполнимые test contracts с preconditions, expected result и evidence |
| `technical/asvs-profile.csv` | Pilot/GA профиль OWASP ASVS 5.0.0 |
| `technical/mobile-security-profile.csv` | Mobile MASVS 2.1.0/MASTG 2.0 verification profile |
| `technical/implementation-backlog.csv` | Упорядоченный Pilot/GA backlog с зависимостями, DoD, tests и gates |
| `prototype/` | Интерактивный React/Vite prototype |
| `design-references/` | Исторические концепты и выбранная Evidence Atlas visual/asset specification |

## Решения, которые считаются зафиксированными

- Первый рынок: Украина; первая вертикаль: электромонтажные MEP-субподрядчики.
- Первый buyer: собственник/коммерческий директор; champion: руководитель ПТО/PM.
- Field user не должен оформлять документы — он фиксирует факт за 30–60 секунд.
- Денежные итоги не изменяются AI или импортом без подтверждения человека.
- Каждый документ, файл и статус имеет source, version и audit trail.
- MVP продаётся как paid pilot на одном объекте, а не как free self-serve.
- Биллинг в Украине начинается с явно помеченного payment request и банковского платежа; юридически/налогово валидированные счёт/акт включаются только после V-006, recurring card — вторично.
- AI помогает извлекать, сопоставлять и черновить, но не принимает юридические/финансовые решения.

## Что означает текущая готовность

Готова внутренне согласованная спецификация продукта и reference implementation интерактивных ключевых flows. `make validate` выполняет prototype lint/build, Chromium smoke с machine-readable отчётом и затем fail-closed сверку 78 обязательных артефактов: 40 документов, 126 SQL-таблиц, 158 access surfaces, 126 retention mappings, 261 states, 295 transitions, 118 errors, 157 API operations (`113 Pilot + 44 GA`), 41 requirements, 149 test contracts, 96 backlog tasks, 103 нормативных UI actions и 21 explicit entity aliases. Отдельно проверяются 32 command-availability rules, PostgreSQL parser SHA, OpenAPI Redocly 2.40.0 lint и 12 внешних gates. Harness покрывает 17 flow families и 19 screenshots, включая v2.9 staged offboarding и offline authorization quarantine. Это не означает, что backend, native app, cloud infrastructure, legal pack или customer adapter уже реализованы и сертифицированы; runtime остаётся `NOT_STARTED`, а 12 external gates — явно `unvalidated`.

До первого Pilot обязательны как минимум реализованные P0-контроли, tenant-isolation/RLS tests, backup/restore drill, redacted UAT dataset, DPA/privacy/terms baseline и signed pilot scope. До GA обязательны все gates категории `GA-BLOCKER` из документа 34. Функции, зависящие от неизвестных документов или консультаций, остаются disabled/qualified и включаются только версионируемым adapter/feature flag после evidence.

## Не является юридической рекомендацией

Требования к актам, КЕП, договорной силе доказательств и строительным нормам должны быть проверены украинским юристом и инженером ПТО до production-релиза. Формы и требования должны быть versioned, поскольку в 2026 году цифровизация ценообразования и актов в ЄДЕССБ активно меняется.
