# 17. Production Readiness Index

Версия: 2.5  
Дата базовой ревизии: 23.07.2026  
Владелец до формирования команды: founder/product owner  
Статус: нормативная карта пакета; внешние подтверждения помечены `EXTERNAL GATE`.

## 1. Назначение

Этот документ определяет, когда спецификация AktFlow достаточно полна, чтобы:

1. построить узкий Pilot MVP без скрытых продуктовых решений внутри кода;
2. безопасно расширить его до самостоятельного GA-продукта;
3. явно отделить спроектированное поведение от фактов, которые можно подтвердить только клиентскими документами, юристом, бухгалтером, инженером ВТВ/ПТО или security review.

`Production-ready specification` не означает, что продукт уже прошёл аудит или соответствует неизвестному договору заказчика. Это означает, что неизвестность имеет owner, validation method, deadline, безопасный default и feature gate; система не выдаёт предположение за юридический факт.

## 2. Два целевых релиза

### Pilot MVP — доказательство готовности к подаче

Обязательный end-to-end outcome:

`workspace → project/contract import → evidence rules → scoped assignment → offline capture → server receipt → internal review/correction → deterministic readiness → period preflight → immutable evidence package → export/submission receipt → audit/export`.

Pilot MVP включает:

- один tenant может иметь несколько пользователей, но пилот активирует один customer legal entity и один live project;
- specialization pack `electrical MEP`;
- XLS/XLSX/CSV import с dry run, mapping и row errors;
- фиксированные role presets и project/location scopes;
- offline-first capture фото/документа/количества;
- internal review, return and correction;
- детерминированный readiness engine без AI approval;
- один versioned customer package adapter, включаемый только после artifact validation;
- generic evidence index/readiness export, доступный всегда;
- ручная фиксация подачи/решения; email отправляет человек вне AktFlow;
- bank invoice/manual reconciliation для подписки AktFlow;
- audit, organization export, backup restore evidence и support runbook.

Не входит в Pilot MVP runtime, но предусмотрено моделью:

- qualified electronic signature;
- automated sending to customer;
- self-service card subscription;
- bank API;
- custom roles;
- SSO/SCIM;
- public API for customer automation;
- multi-country packs;
- AI classification/approval;
- legally authoritative acceptance claim.

### Safe GA — повторяемый самостоятельный продукт

GA добавляет:

- variations/notices and acknowledgement;
- period close and package version comparison;
- secure external review with OTP and exact-version decisions;
- receivables, retention, deductions, disputes and partial payments;
- reusable templates and customer-specific adapters;
- approved external notification providers and escalation policies;
- plan lifecycle, usage snapshots, grace/suspension/export;
- webhooks and controlled integrations;
- platform support console with time-bound grants;
- tested incident, restore, migration and rollback procedures;
- legal/customer/security sign-offs required by release gates.

## 3. Нормативная иерархия документов

При конфликте требований применяется порядок:

1. signed customer contract/country pack после external validation;
2. security, privacy and legal invariants;
3. state machine transition catalog;
4. permission matrix;
5. API and data contracts;
6. screen/flow specification;
7. interactive prototype;
8. marketing copy.

Прототип никогда не является источником правил доступа, расчётов или юридической семантики.

## 4. Bounded contexts

| Context | System of record | Не смешивать с |
|---|---|---|
| Identity & Tenancy | organizations, legal entities, memberships, scopes | project counterparties |
| Construction Baseline | projects, counterparties, contracts, versions, work items | SaaS subscription |
| Evidence & Readiness | captures, evidence, requirements, evaluations, reviews | contractual acceptance |
| Variations | notices, versions, valuation, acknowledgements | base BOQ mutation |
| Period & Package | periods, snapshots, generated artifacts, submissions | mutable live totals |
| Project Commercials | acceptance, receivables, retention, deductions, payments | AktFlow invoices |
| SaaS Commercials | plan versions, entitlements, usage, SaaS invoices/payments | customer project money |
| Platform Operations | support grants, jobs, incidents, vendor operations | tenant membership |

## 5. Source-of-truth decisions

| Datum | Authoritative source | AktFlow behavior |
|---|---|---|
| Contract quantity/rate | published contract version/import confirmed by authorized user | versioned snapshot; never silently overwritten |
| Performed quantity | append-only quantity ledger | corrections are compensating entries |
| Evidence original | immutable storage object + hash | annotations/redactions are derivatives |
| Requirement result | versioned deterministic evaluation | explainable, recalculable, history retained |
| Internal readiness | AktFlow engine + authorized waivers | explicitly not customer acceptance |
| Package contents | immutable package snapshot | new change creates a new version |
| Customer decision | signed artifact, external exact-version decision or manual receipt | channel and assurance level displayed |
| Project payment | imported/manual bank fact confirmed by authorized user | allocations append audit history |
| SaaS entitlement | active subscription + immutable plan version + bounded override | enforced server-side |

## 6. Master traceability rule

Каждый P0/P1 requirement обязан иметь:

- stable requirement ID;
- actor/persona;
- flow ID and screen/state IDs;
- transition IDs;
- permissions and segregation constraints;
- API operation IDs;
- entities/fields and retention class;
- audit and analytics events;
- error/recovery cases;
- acceptance/security tests;
- release flag, rollout and rollback owner.

Machine-readable индекс находится в `technical/traceability.csv`.

Канонические значения состояний находятся в `technical/state-catalog.csv`, а продуктовые термины — в `technical/terminology.csv`. Markdown, SQL constraints, OpenAPI enums и UI labels являются производными. Новое состояние запрещено добавлять только в одном слое.

## 7. Release gates

### Specification Gate

- нет `TBD` без owner/default/deadline;
- все P0 flows имеют happy, alternate, error, recovery and cancellation paths;
- каждый money/quantity transition имеет invariant and reconciliation test;
- роль, plan and tenant checks присутствуют на UI, API and database layers;
- внешняя неизвестность оформлена validation gate, а не скрытым допущением.

### Pilot Gate

Прецедентность definition-of-Pilot-ready: `docs/34-production-gate-checklist.md` §3 — авторитетный **список допуска** (25 admission-гейтов, что должно быть готово); `docs/28-pilot-ga-delivery.md` §9 — **список успеха** (метрики результата пилота, другая ось); настоящий Pilot Gate — краткая сводка допуска. Допуск ≠ успех; при конфликте формулировок допуск определяется doc 34 §3.

- tenant isolation suite проходит полностью;
- offline capture не теряет и не дублирует quantity/evidence;
- readiness totals воспроизводятся из ledger;
- generic package генерируется детерминированно;
- backup restore подтверждён артефактом;
- минимум один representative artifact проверен пользователем ВТВ/ПТО;
- все юридические claims ограничены operational workflow wording.

### Customer Adapter Gate — EXTERNAL GATE

- клиент предоставил redacted accepted/returned documents;
- ответственный ВТВ/ПТО подтвердил обязательные поля и правила;
- versioned fixture и golden test добавлены;
- contract owner подтвердил, что export является черновиком/вложением или допустимым submission artifact;
- изменение формата не ломает generic evidence export.

### GA Gate

- украинский counsel проверил legal pack и claims;
- бухгалтер/налоговый консультант проверил SaaS invoicing/VAT setup;
- privacy assessment закрывает employee photos/location/device metadata;
- independent application security review и remediation завершены;
- restore, bad migration, provider outage and tenant-leak drills проведены;
- два разных customer configurations закрыли период без ручной правки данных в БД;
- SLA соответствует фактической support capacity.

## 8. Completeness status vocabulary

| Status | Значение |
|---|---|
| `SPECIFIED` | правило однозначно описано и связано с контрактами |
| `PROTOTYPED` | ключевое состояние интерактивно показано |
| `IMPLEMENTED` | код и migration существуют |
| `VERIFIED` | automated/manual evidence приложено |
| `EXTERNAL GATE` | требуется внешний факт/sign-off |
| `DEFERRED` | не входит в release, но migration path определён |

Нельзя повышать статус по визуальной готовности прототипа.

## 9. Что намеренно остаётся условным

До получения внешних материалов нельзя честно зафиксировать:

- точный обязательный состав первого customer-specific package;
- договорную силу конкретного external-review действия;
- сроки хранения по каждой категории строительного документа;
- обязательность GPS/gallery restrictions;
- перечень и порядок подписантов КЕП;
- точный VAT/fiscal flow продавца AktFlow;
- первую CEE country pack;
- финальную цену и willingness to pay;
- поддерживаемую physical-device/OS matrix для field capture;
- допустимость двойного ввода между AktFlow и системой генподрядчика;
- DPA/subprocessor/residency/security условия первого integration vendor;
- юридическое и workforce-основание для cross-tenant support content access.

Для каждого пункта документы 24 и 30 задают безопасный default и процедуру замены конфигурации без переписывания ядра.

## 10. Definition of ready-to-build

Feature допускается в implementation backlog только если:

1. requirement/flow/transition имеют ID;
2. actor and authorization определены;
3. data ownership and retention определены;
4. API success/error/idempotency определены;
5. UI показывает pending, failure and recovery;
6. audit/telemetry не содержит запрещённых данных;
7. test IDs и rollout flag указаны;
8. внешний факт либо подтверждён, либо feature выключена безопасным default.

## 11. Current readiness snapshot

На срезе 23.07.2026:

| Layer | Status | Evidence / honest boundary |
|---|---|---|
| internal specification consistency | `PASS` | deterministic validator checks 78 required artifacts: 40 docs, 126 SQL tables, 158 access surfaces, 126 table-level retention mappings, 261 states, 295 transitions, 118 errors, 157 API operations, 41 requirements, 149 tests, 96 backlog tasks, 103 UI actions, 21 entity aliases and 32 fail-closed command rules |
| OpenAPI and SQL package validation | `PASS` | local validator verifies refs, headers, idempotency, correlation, ETags, Problem Details, critical OpenAPI↔SQL fields and traceability; attached Redocly 2.40.0 and PostgreSQL parser reports are SHA-bound to the checked sources |
| critical interaction prototype | `LINT_BUILD_PASS / BROWSER_SMOKE` | 19 screenshots cover 17 flow families; v2.9 verifies staged offboarding, exact offline authorization and quarantine semantics. Target browser/assistive-tech/physical-device certification remains a Pilot gate |
| runtime implementation | `NOT_STARTED` | reference schema/API/prototype are not migrations, backend, native release or deployed controls |
| Pilot external evidence | `0/12 VALIDATED` | V-001–V-012 retain safe defaults; no customer document, counsel/accountant/process-owner or vendor/support sign-off has been supplied |
| live Pilot admission | `BLOCKED` | all applicable `PILOT-BLOCKER` evidence in document 34 remains required |
| standalone GA admission | `BLOCKED` | runtime, external and independent security/operations evidence remains required |

Thus the package is ready to start implementation without inventing core read models, occurrence triggers, offline chronology, rule payload ownership, staged offboarding, re-import lineage, review/waiver compensation, reporting dates, period cycles, package issues or downstream commercial locks in code. The semantic validator now additionally fails unreachable states, reversal labels without commands, incomplete command-class default-deny, critical OpenAPI↔SQL drift, stale package versions and missing v2.9 closure tests. It is still not ready for live customer data, production claims or GA launch because runtime and external evidence remain absent.

### 11.1 Honest completeness estimate

This is a specification score, not product launch readiness:

| Dimension | Ready | Remaining boundary |
|---|---:|---|
| functional product specification | 97% | all 28 known v2.8 audit groups have normative closure; customer-specific documents and real process exceptions can only arrive through Pilot discovery |
| machine-readable implementation contracts | 99% | current source contracts are closed and validator-backed; ordered runtime migrations, generated clients and executable service contract evidence do not exist yet |
| critical-flow prototype | 93% | primary flows are interactive and compile; ordinary errors/empty/loading and operator-only surfaces remain text-specified |
| safe build-start readiness | 99% | known semantic gaps are closed with fail-closed defaults; implementation must preserve dependency order and cannot bypass Pilot admission gates |
| live Pilot runtime | 0% | no backend/native release/cloud controls or representative customer UAT evidence has been built |
| external validation | 0/12 | V-001–V-012 remain deliberately unvalidated |

The weighted documentation/package estimate is **97% complete within the agreed no-customer-documents/no-consultants boundary**. This percentage is coverage of the specified boundary, not probability of a successful launch. The remaining gap is not safe to fabricate: first customer artifacts, counsel/accountant/process-owner decisions, physical-device evidence and independent security/UAT results must replace the documented defaults.
