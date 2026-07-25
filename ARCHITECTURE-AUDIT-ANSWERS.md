# AktFlow — архитектурный аудит Pilot V1 · ОТВЕТЫ

Дата: 23–24.07.2026 · База: пакет v2.9 + исправления бизнес-аудита (CHANGELOG-AUDIT-FIX-20260723.md) + исправления этого аудита (CHANGELOG-ARCH-AUDIT-20260724.md)
Всего вопросов: 341 · Отвечено: 341

## Сводка статусов

| Статус | Кол-во | Что это значит |
|---|---:|---|
| Closed | 315 | пакет отвечает полностью; спорные места закрыты правками 23–24.07 (помечены «Обновление») |
| Partially closed | 6 | спецификация полна, но требуется runtime/полевое исполнение (device-тесты, ручной WCAG, CI-прогоны, переводы) |
| Deferred with gate | 11 | осознанно за внешними гейтами V-001/V-003/V-004/V-005/V-008/V-011 и GA-гейтами (юрист, бухгалтер, артефакты клиентов) |
| Not applicable | 9 | AI-механизмов в Pilot/GA-core нет; принципы зафиксированы (D-006, ADR-006), требования вводятся вместе с фичей через gate |
| Open | 0 | — |
| Contradiction | 0 | — |

Правки, закрывшие вопросы этого аудита, перечислены в `CHANGELOG-ARCH-AUDIT-20260724.md`; раздел 18 закрыт новым нормативным документом `docs/39-evidence-graph.md` (реализация промпта из конца файла аудита).


## 1. Product boundaries and pilot definition


1. Can the Pilot V1 promise be stated in one measurable sentence without mentioning features?
   - Ответ/решение: Да. Продукт одним предложением и MVP promise зафиксированы без перечисления фич: «За 30 дней на одном объекте AktFlow создаст единую картину готовности к закрытию и снизит количество позиций, обнаруженных без доказательств в конце периода»; измеримость дают north-star «Value of evidence-ready work submitted through AktFlow per month» (через канонические состояния `evidence_missing/review_pending → packaged → submitted` из state-catalog) и квантифицированные цели пилота (≥80% полевых фиксаций, ≥60% performed value evidence-ready, 0 unrecoverable before-concealment misses, 1 сверенный пакет).
   - Артефакт/ссылка: `docs/00-product-brief.md` («Продукт одним предложением», «North-star metric», «MVP promise»); `docs/14-gtm-pilot.md` §5; `technical/state-catalog.csv`
   - Статус и владелец: Closed · Product

2. Which exact user and company type is the primary buyer, and which roles are only secondary users?
   - Ответ/решение: ICP v1 — электромонтажный субподрядчик в Украине, 15–100 сотрудников, 2–10 активных объектов, поэтапная оплата/АВР/исполнительная документация; buyer — собственник/коммерческий директор, champion — руководитель ПТО/project manager. Вторичные пользователи: прораб/бригадир и field worker (capture-only), сметчик/биллинг; внешний reviewer генподрядчика — вообще не Pilot-пользователь (GA external actor). Явно исключены: генподрядчики, крошечные бригады, гос-мегапроекты, residential B2C.
   - Артефакт/ссылка: `docs/00-product-brief.md` (ICP v1, «Пользователи»); `docs/14-gtm-pilot.md` §1; `docs/03-personas-jtbd-workflows.md` §1–2
   - Статус и владелец: Closed · Product

3. What business process begins and ends inside AktFlow during the pilot?
   - Ответ/решение: Внутри AktFlow полностью проходит цикл «доказательства → готовность → пакет периода»: `workspace → project/contract import → evidence rules → scoped assignment → offline capture → server receipt → internal review/correction → deterministic readiness → period preflight → immutable evidence package → export/submission receipt → audit/export`. Pilot заканчивает обязательный runtime path на `submitted` плюс ручной operational receipt внешнего решения; `accepted_external → issued → paid` (деньги проекта) — GA Project Commercials и в пилоте вне продукта.
   - Артефакт/ссылка: `docs/17-production-readiness-index.md` §2 (Pilot MVP outcome); `docs/01-prd.md` §2, FR-11; `docs/20-flow-catalog.md` F03–F11
   - Статус и владелец: Closed · Product

4. Where does AktFlow deliberately stop and hand work back to AVK, BAS, Excel, email, or the customer’s system?
   - Ответ/решение: Смета и бухучёт остаются в АВК/BAS/Excel («Keep estimate/accounting», позиционирование «оставаться upstream: доказательства и readiness до готового АВР; file bridge first»); AktFlow формирует пакет и экспорт PDF/XLSX/ZIP, а отправку заказчику выполняет человек email/каналом вне AktFlow с ручной фиксацией подачи и построчного решения. AVK/accounting-коннекторы — только по платёжеспособному спросу и могут быть file-based; ЄДЕССБ — versioned adapter после верификации официальных форматов; двойной ввод с системой ГП закрыт safe default V-010 (export/manual bridge).
   - Артефакт/ссылка: `docs/14-gtm-pilot.md` §7; `docs/02-market-competition.md` (таблица позиционирования); `docs/17-production-readiness-index.md` §2; `docs/01-prd.md` FR-10, FR-12; `docs/08-api-integrations.md` §3–4; `docs/30-validation-evidence-register.md` V-010
   - Статус и владелец: Closed · Product

5. Which capabilities are mandatory for a company to run a real monthly closing cycle, rather than merely demo the product?
   - Ответ/решение: Обязательный Pilot MVP набор: multi-user tenant + один live project, XLS/XLSX/CSV импорт с dry-run/mapping/row errors, electrical MEP rule pack, scoped assignments, offline-first capture (фото/документ/количество), internal review/return/correction, детерминированный readiness без AI-approval, preflight и immutable package, generic evidence export, ручной submission/decision receipt, audit/export/backup/support. Отличие от демо закреплено гейтами: live-данные допускаются только после всех `PILOT-BLOCKER` в doc 34 (миграции, deny-default RLS, physical-device offline tests, adapter sign-off, legal pack, независимый role-based UAT) и pilot success contract (named sponsor, ≥100 строк или subset, baseline, weekly ritual).
   - Артефакт/ссылка: `docs/17-production-readiness-index.md` §2; `docs/34-production-gate-checklist.md` §1–3; `docs/14-gtm-pilot.md` §5; `docs/38-business-logic-closure.md` §14
   - Статус и владелец: Closed · Product

6. Which GA entities exist in the canonical model but must be impossible to invoke under Pilot entitlements?
   - Ответ/решение: В канонической модели существуют, но в Pilot невызываемы: variations (+versions/decisions), external shares/sessions/decisions, acceptance_records, receivables/adjustments/retention_releases, payments/allocations/reversals, reconciliation_imports, saas_invoice_adjustments, usage_snapshots, integration_connections/webhook_endpoints, support_access_grants, ownership_transfers, а также ledger-типы `transfer_out/transfer_in/accepted_adjustment` (Pilot capture endpoint их отвергает). Механизм тройной: entitlements.csv (variations=no + `hide_and_api_deny`, external_review=no, api_webhooks=no), 44 операции с `x-release: GA` в openapi.yaml (113 Pilot), правило «plan name cannot bypass release maturity» и §8 PRD «must not expose these GA commands merely because their tables and schemas exist».
   - Артефакт/ссылка: `technical/entitlements.csv`; `technical/openapi.yaml` (x-release); `docs/21-plans-entitlements-billing.md` §2; `docs/01-prd.md` §4 release rule, §8, FR-17; `docs/18-domain-state-machines.md` §5; `docs/22-data-api-contract.md` §5
   - Статус и владелец: Closed · Architecture

7. Can every Pilot screen and command be traced to a validated job-to-be-done?
   - Ответ/решение: Механическая трассировка «экран/команда → требование → flow → API → тесты» полная: `ui-actions.csv` (103 действия с screen_id/operation_id/test_ids) и `traceability.csv` (41 requirement), валидатор ловит orphan-мутации; персоны/JTBD описаны в doc 03 и смаппены на канонические роли permissions.csv. Две конкретные дыры: (а) в traceability.csv нет колонки actor/persona/JTBD, хотя doc 17 §6 требует actor/persona для каждого P0/P1 requirement — связь требование↔JTBD остаётся прозой; (б) сами JTBD ещё не «validated»: Stage-0 gate (15–20 интервью, ≥3 компании с артефактами) не пройден, интервью-эвиденс не приложен.
   - Артефакт/ссылка: `technical/traceability.csv`; `technical/ui-actions.csv`; `docs/03-personas-jtbd-workflows.md` §1–2; `docs/17-production-readiness-index.md` §6; `docs/12-roadmap-delivery.md` Stage 0; `docs/37-functional-closure-feature-register.md` §3
   - Обновление (закрыто фиксом 23.07.2026): traceability.csv получил колонку primary_actor (JTBD-роль на каждый requirement); валидация самих JTBD остаётся Stage-0 evidence-гейтом
   - Статус и владелец: Closed · Product

8. Which features would be removed first if they do not reduce time-to-submission or amount-under-risk?
   - Ответ/решение: Критерий отбора задан (north-star + guardrails «median time performed→ready», «% work value returned»; scoring-формула backlog doc 12 §6), и всё вне цепочки evidence→submission уже вырезано/отложено реестром doc 37 (Deferred: bulk approve, clone, QR/NFC, report builder; No-build: daily log, timecards, procurement/BIM/accounting); внутри Pilot contract явно назван один первый кандидат на отключение — saved personal filters («may be disabled without blocking close»). Дыра: явного ранжированного списка «режем первым» для остальных Pilot-удобств (bulk assignment, глобальный поиск и т.п.) нет.
   - Артефакт/ссылка: `docs/00-product-brief.md` (guardrails); `docs/12-roadmap-delivery.md` §6; `docs/37-functional-closure-feature-register.md` §2; `docs/38-business-logic-closure.md` §11
   - Обновление (закрыто фиксом 23.07.2026): в doc 12 §6 добавлен ранжированный cut-list Pilot-удобств
   - Статус и владелец: Closed · Product

9. What is the formal definition of a successful pilot after 30, 60, and 90 days?
   - Ответ/решение: Формальные критерии определены, но по другой сетке: пилот 45 дней (default), «first value in 7 days», midpoint evidence/readiness review, и финальные цели закрытия (≥80% relevant field captures, ≥60% performed value evidence-ready до close, 0 unrecoverable before-concealment misses, 1 reconciled package, weekly participation; commercial result contextual, not guaranteed) плюс продуктовые критерии doc 01 §7 (80% same-day capture, 95% checksum, ≥70% explainable readiness, −30% времени закрытия, renewal/оплата). Разбивки именно 30/60/90 дней в пакете нет; горизонт после пилота закрыт только GTM kill-сигналами (нет конверсии после трёх пилотов → пауза).
   - Артефакт/ссылка: `docs/14-gtm-pilot.md` §4–6, §10; `docs/01-prd.md` §7; `docs/21-plans-entitlements-billing.md` §2, §7; `docs/00-product-brief.md` (Kill criteria)
   - Обновление (закрыто фиксом 23.07.2026): в doc 14 §5 добавлена checkpoint-сетка 30/60/90 поверх 45-дневного пилота
   - Статус и владелец: Closed · Product

10. What minimum customer data must exist before the first useful dashboard can be shown?
   - Ответ/решение: Минимум зафиксирован в pilot success contract и Workflow A: один live project с ≥100 значимых строк работ (или согласованный subset), импортированная смета/SOV с подтверждённым mapping, структура locations, выбранный trade template с 5–10 критичными requirements, назначенные ПТО/PM/прораб и первая тестовая offline-фиксация; baseline последнего закрытия (часы, возвращённая сумма, дни, evidence misses) сохраняется обязательно. Activation-критерий собственника: видит свой реальный объект и минимум один денежный blocker в первый день.
   - Артефакт/ссылка: `docs/14-gtm-pilot.md` §5–6 (day 0 checklist); `docs/03-personas-jtbd-workflows.md` §1.1, §3 Workflow A; `docs/30-validation-evidence-register.md` §3
   - Статус и владелец: Closed · Product

11. Can the pilot work on one object with incomplete historical data, and what assumptions are then visible?
   - Ответ/решение: Частично. Один объект и «agreed subset» строк поддержаны явно; неполнота видима через explainable readiness (`not_started`/`evidence_missing`, `at_risk` только с классифицированными причинами, запрет единого «процента» без расшифровки) и через разделение claimed/authoritative даты (`quantity_entries.claimed_occurred_on` vs `occurred_on` + reporting-date confirmation). Дыра: нигде не описан onboarding довнедренческих объёмов (opening balance выполненных до пилота работ) — как их вносить (progress-записи с claimed date? пилот считает только текущий период?) и как такие допущения маркируются в dashboard; система молча покажет заниженный performed.
   - Артефакт/ссылка: `docs/14-gtm-pilot.md` §5; `docs/01-prd.md` §2, FR-10 (prior cumulative — только preflight-проверка); `docs/38-business-logic-closure.md` §7 (reporting date); `technical/schema.sql` (quantity_entries); `technical/terminology.csv` (at_risk)
   - Обновление (закрыто фиксом 23.07.2026): в doc 14 §6 зафиксировано правило opening balance: довнедренческий прогресс без доказательной цепочки, помечен, метрики только за текущий период
   - Статус и владелец: Closed · Product

12. Which customer process differences are configuration, and which require a custom adapter?
   - Ответ/решение: Конфигурация (versioned config без кода): customer package adapter binding, rule pack/applicability, review assurance policy, retention policy, capture policy (GPS/EXIF/gallery), country/localization pack, entitlement/offer; contract terms version хранит calendar/cutoff/notice/payment/retention/numbering. Кастомный versioned adapter (immutable, golden fixtures, отдельный ADAPTER-gate) нужен для формы/шаблонов документов, calculation/rounding, validation rules, submission channel и legal wording; executable tenant-код запрещён, шаблоны — allowlisted DSL. Ядро меняется только когда находка — shared invariant.
   - Артефакт/ссылка: `docs/30-validation-evidence-register.md` §5; `docs/32-customer-country-adapters.md` §2–5; `docs/17-production-readiness-index.md` §7 (Customer Adapter Gate); `docs/01-prd.md` FR-02
   - Статус и владелец: Closed · Architecture

13. What would make the system unsafe or misleading to use even if all software functions technically work?
   - Ответ/решение: Пакет явно перечисляет опасные интерпретации: считать internal readiness договорной приёмкой, click acknowledgement — КЕП, фото — доказательством качества/объёма, generic package — соответствующим форме заказчика, хранение в AktFlow — заменой архива, сумму dashboard — бухгалтерской дебиторкой; плюс запрет единого «процента готовности» без расшифровки и продуктовый принцип «No hidden legal promise». Машинная защита — колонка `never_means` в terminology.csv и V-002 (acceptance semantics) с safe default «internal ready and operational receipt only».
   - Артефакт/ссылка: `docs/24-legal-regulatory-gates.md` §1; `docs/01-prd.md` §2, §3 (принципы 4, 9); `technical/terminology.csv`; `docs/30-validation-evidence-register.md` V-002
   - Статус и владелец: Closed · Legal (external)

14. Which claims must never appear in UI or sales copy because the system cannot legally guarantee them?
   - Ответ/решение: Запрещённые обещания: гарантированная оплата, юридическая сила любого типа доказательства, автоматическое принятие заказчиком, замена сметчика/ПТО/юриста (doc 00 «Не обещаем»); шесть claims-границ doc 24 §1 (readiness ≠ приёмка, click ≠ КЕП и т.д.); маркетинг — «Never publish invented customer logos, metrics or regulatory guarantees», никакой fiscal-compliance claim у UI (`payment_request` не называется налоговым/первичным документом). Шкала из 5 assurance levels обязана показываться явно, и failure никогда не деградирует молча до click acceptance.
   - Артефакт/ссылка: `docs/00-product-brief.md` (MVP promise/не обещаем); `docs/24-legal-regulatory-gates.md` §1, §8; `docs/14-gtm-pilot.md` §8; `docs/21-plans-entitlements-billing.md` §8; `technical/terminology.csv`
   - Статус и владелец: Closed · Legal (external)

15. What is the smallest end-to-end path that proves performed work can become submission-ready work?
   - Ответ/решение: Минимальный путь — обязательный Pilot outcome doc 17 §2: import baseline → rule publication → одно scoped assignment → offline capture с server receipt → internal review approve → deterministic readiness `ready_internal` → period preflight → immutable package (`packaged`) → manual submission receipt (`submitted`). Он нарезан на releasable slices A–F (workspace → baseline → field proof → review → money visibility → package) и прогнан smoke-тестом T-PROTO-001 (17 flow families, 19 скриншотов, `ok:true`) и flows F03–F11.
   - Артефакт/ссылка: `docs/17-production-readiness-index.md` §2; `docs/12-roadmap-delivery.md` §2; `docs/20-flow-catalog.md` F03–F11; `technical/test-catalog.csv` (T-PROTO-001); `CHANGELOG-AUDIT-FIX-20260723.md`
   - Статус и владелец: Closed · Architecture

## 2. Domain model and entity ownership


16. Does every domain entity have a clear aggregate owner and authoritative source of truth?
   - Ответ/решение: Да: doc 06 §1 закрепляет ownership по 9 модулям (Identity, Commercial, Execution, Evidence, Review, Variation, Package, Receivables, Platform; cross-module — только services/events, не произвольные UI-запросы); doc 17 §4 — 8 bounded contexts с колонкой «не смешивать с», §5 — таблица authoritative source per datum (contract quantity = published version, performed = append-only ledger, evidence = immutable object+hash, package = immutable snapshot, entitlement = subscription+plan version+override). Aggregate-решения v2.9 нормативны: WorkItem immutable line, WorkAssignment — единственный mutable execution aggregate, PackageDecisionSet — atomic unit ответа.
   - Артефакт/ссылка: `docs/06-data-model-permissions.md` §1–2; `docs/17-production-readiness-index.md` §4–5; `docs/38-business-logic-closure.md` §2
   - Статус и владелец: Closed · Architecture

17. Can each entity be uniquely identified without relying on a mutable human-readable code?
   - Ответ/решение: Да: все PK в schema.sql — UUID (`gen_random_uuid()`), «UUIDs are internal identifiers; human codes are org-scoped and mutable only under audit»; каждая импортная строка получает stable internal ID, а source key хранится отдельно; `work_item.code` уникален только внутри immutable contract_version, версии связаны `lineage_root_id`; `document_number` выдаётся server-owned numbering series (уникален per organization, никогда не переиспользуется) и не является идентификатором записи. IDs объявлены портируемыми при экспорте.
   - Артефакт/ссылка: `docs/06-data-model-permissions.md` §3, §11; `docs/01-prd.md` FR-03; `technical/schema.sql` (work_items, numbering_series); `docs/38-business-logic-closure.md` §8
   - Статус и владелец: Closed · Architecture

18. Are organization, legal entity, project, contract, and customer boundaries unambiguous?
   - Ответ/решение: Да: `organization` = tenant/billing boundary, `legal_entity` = сторона договора и реквизиты, `branch` = operational grouping без отдельного tenant, `project` = construction access boundary; заказчик/ГП — `counterparties` семи типов через `project_counterparties`, без автоматического tenant-доступа (только отдельный grant/external share). Pilot: один tenant + одно legal entity (несколько legal entities/branches — GA по entitlement). Doc 17 §4 явно запрещает смешение Identity & Tenancy с project counterparties и Construction Baseline с SaaS subscription.
   - Артефакт/ссылка: `docs/19-organizations-roles-access.md` §1; `docs/17-production-readiness-index.md` §4; `technical/schema.sql` (legal_entities, branches, counterparties, project_counterparties); `docs/22-data-api-contract.md` §2
   - Статус и владелец: Closed · Architecture

19. Can one project contain multiple contracts, and can one contract span multiple projects?
   - Ответ/решение: Контракт принадлежит ровно одному проекту и не может охватывать несколько: `contracts.project_id uuid NOT NULL` + composite tenant FK + `unique (project_id, contract_number)`. Проект в канонической модели может иметь несколько контрактов, но Pilot нормативно ограничен: «Pilot has exactly one active contract per project. A second contract requires GA multi-contract support or a distinct linked project»; проект нельзя завершить/архивировать, пока контракт `active` (guarded complete/terminate first).
   - Артефакт/ссылка: `technical/schema.sql` (contracts, строка 195); `docs/38-business-logic-closure.md` §2 п.6; `docs/18-domain-state-machines.md` §3–4; `docs/37-functional-closure-feature-register.md` (Contract lifecycle commands)
   - Статус и владелец: Closed · Architecture

20. Can one work item belong to more than one contract line or location, and if not, how are composite works represented?
   - Ответ/решение: К >1 contract line — нет: work item сам является одной строкой одной immutable contract version (`contract_version_id NOT NULL`, `unique (contract_version_id, code)`); к нескольким локациям — да, через M:N `work_item_locations` с planned_quantity per location, при этом каждое assignment фиксирует ровно одну location. Композитные работы представляются иерархией `section_path` (заголовки — import metadata, не items) и разложением на measured-строки; lump-sum/provisional/rate-only/нулевые строки дают blocking row errors и в Pilot не импортируются.
   - Артефакт/ссылка: `technical/schema.sql` (work_items, work_item_locations, work_assignments); `docs/38-business-logic-closure.md` §7; `docs/01-prd.md` §8 (Pilot BOQ); `technical/openapi.yaml` (workItems: «section headings are import metadata»)
   - Статус и владелец: Closed · Architecture

21. How are parent-child work items modeled without double-counting quantity or value?
   - Ответ/решение: Двойной счёт исключён конструктивно: родители не являются work items — заголовки сметы формируют `section_path`, а таблица work_items допускает только `line_type='measured'` с `contract_quantity > 0` (SQL CHECK), поэтому количество/стоимость существуют только на листовых строках, агрегаты — производные. Версионное задвоение при re-import исключено lineage-правилом: availability/reservation/performed агрегируются по `lineage_root_id` с одним current acyclic head — «a superseding row cannot double-plan or double-perform the same baseline quantity».
   - Артефакт/ссылка: `technical/schema.sql` (work_items: line_type/lineage checks); `docs/38-business-logic-closure.md` §7; `docs/06-data-model-permissions.md` §13; `docs/01-prd.md` §8; тест `T-REIMPORT-LINEAGE-001` (`docs/38` §15)
   - Статус и владелец: Closed · Architecture

22. What is the exact relationship between work item, assignment, capture task, requirement occurrence, and evidence object?
   - Ответ/решение: `WorkItem` — immutable строка contract/SOV (статус — read-only проекция); `WorkAssignment` — единственный mutable execution aggregate (1 work item + 1 location + 1 assignee + planned qty/window), а «capture task» — лишь UX-алиас assignment (`capture_tasks → work_assignments` в entity-aliases.csv); публикация rule разворачивает `RequirementOccurrence` per assignment/location/date/batch/quantity trigger (минимальный scope satisfaction/waiver); `CaptureSession` — одна immutable попытка сдачи для одного exact assignment, порождающая `EvidenceObject`/`TypedEvidenceRecord`, которые связываются с occurrences через `evidence_requirement_links` в exact subject tuple (org+project+work item+location+assignment+capture client operation).
   - Артефакт/ссылка: `docs/06-data-model-permissions.md` §2, §4–5; `docs/38-business-logic-closure.md` §2–3; `technical/entity-aliases.csv` (capture_tasks, evidence_requirement_occurrences); `docs/01-prd.md` FR-04A
   - Статус и владелец: Closed · Architecture

23. Can evidence be linked to multiple occurrences, and how is reuse controlled to prevent accidental double proof?
   - Ответ/решение: Да, но только явно: «One evidence object may support several occurrences only through explicit `evidence_requirement_links` rows created in the exact assignment subject» (PK `evidence_object_id+occurrence_id+link_type`, строка повторяет полный subject tuple); reuse требует explicit scope preview и server validation (FR-05), связь редактируема только до local submit — после receipt только invalidate-and-recapture; invalidation пересчитывает все связанные occurrences и не удаляет оригинал. Против двойного денежного счёта: «Blocked value не суммировать дважды при нескольких blockers»; дубликаты файлов ловятся по hash + времени/item.
   - Артефакт/ссылка: `technical/schema.sql` (evidence_requirement_links); `docs/38-business-logic-closure.md` §3, §15 (`T-EVIDENCE-ASSOCIATION-001`); `docs/01-prd.md` FR-05, FR-07; `docs/06-data-model-permissions.md` §5
   - Статус и владелец: Closed · Architecture

24. Which entities are immutable versions, which are mutable operational records, and which are append-only ledgers?
   - Ответ/решение: Классификация явная: immutable versions — contract/contract-terms/rule/reference/variation/package versions, plan_versions, package snapshots, published = неизменяемо, исправление = новая версия; mutable operational — work_assignments (единственный mutable execution aggregate), review_tasks, memberships, subscriptions, notification preferences (все под optimistic `version`); append-only ledgers — quantity_entries, review_decisions + corrections receipts, acceptance_records (每 решение терминально, successor через supersedes), payment allocations/reversals, saas_invoice_adjustments, audit_events, transaction_outbox. Правило контракта: append-only ledgers и state-command records не получают generic edit-полей; для financial/audit объектов нет soft delete.
   - Артефакт/ссылка: `docs/06-data-model-permissions.md` §4–6; `docs/22-data-api-contract.md` §3–4; `docs/18-domain-state-machines.md` §5, §11; `docs/38-business-logic-closure.md` §2
   - Статус и владелец: Closed · Architecture

25. Does every money- or quantity-bearing record preserve currency, unit, precision, and source version?
   - Ответ/решение: Да: деньги — integer minor units + ISO currency (`unit_price_minor bigint` + `currency char(3)` на work_items/receivables/payments; float запрещён), количество — `numeric(20,6)` + `unit_code` + `unit_definition_version` + `unit_input_precision`, причём «quantity precision is frozen from the work-item unit-definition version»; source version — quantity entry привязана к work item (versioned lineage) и assignment, package version хранит exact contract/terms/rule/adapter/renderer/template identities и точные source entry links; FX в Pilot запрещён, GA требует rate/source/date.
   - Артефакт/ссылка: `docs/22-data-api-contract.md` §3; `docs/06-data-model-permissions.md` §4; `docs/38-business-logic-closure.md` §5, §8; `docs/18-domain-state-machines.md` §5, §11; `technical/schema.sql` (work_items, quantity_entries)
   - Статус и владелец: Closed · Architecture

26. How are deleted, voided, superseded, archived, and legally retained records distinguished?
   - Ответ/решение: Различия формализованы: «deleted» — generic delete отсутствует (evidence только append-only invalidation с lineage; drafts — 30-дневный recoverable tombstone; физическое удаление только через deletion_jobs `requested → cooling_off → … → verified → complete` с deletion certificate); «voided» — явное состояние `package_number_reservations` (`reserved/consumed/voided`, номер не переиспользуется); «superseded» — `supersedes_id`/lineage и отдельные states (contract/reference/package versions); «archived» — терминальный project archive/`archived_at` (restore нет, только linked continuation); «legally retained» — `legal_holds` + 126 retention-записей каталога, все `duration_external_gate` под V-003, hold проверяется до любого удаления.
   - Артефакт/ссылка: `docs/18-domain-state-machines.md` §13; `docs/06-data-model-permissions.md` §10; `docs/24-legal-regulatory-gates.md` §9; `technical/schema.sql` (package_number_reservations, legal_holds); `technical/data-retention-catalog.csv`; `docs/01-prd.md` §6, FR-14
   - Статус и владелец: Closed · Architecture

27. Can the entire state of a package be reconstructed from persisted domain records without reading audit text?
   - Ответ/решение: Да: package generation замораживает contract/work item versions, included quantity entry IDs, requirement evaluation results, evidence hashes, template/ruleset версии, hashes сгенерированных документов, автора и время; построчные источники — таблицы `package_line_quantity_sources`/`package_line_evidence_sources`; decision set финализируется в immutable line items с server-derived totals; `document_number + numbering_sequence` персистятся на пакете с reservation receipt. Audit — параллельный обязательный слой (NFR-08), но не источник восстановления: «any readiness total has a reproducible breakdown», rebuild обязан совпасть.
   - Артефакт/ссылка: `docs/06-data-model-permissions.md` §6, §12; `docs/38-business-logic-closure.md` §8; `technical/schema.sql` (package_versions, package_line_*_sources); `docs/18-domain-state-machines.md` §9
   - Статус и владелец: Closed · Architecture

28. Are aliases and terminology stable across UI, API, database, exports, and documentation?
   - Ответ/решение: Механизм сильный: `entity-aliases.csv` фиксирует 20 conceptual/legacy имён с canonical target и статусом alias/deferred/external (валидатор блокирует неизвестный target и alias, маскирующий существующую таблицу); `terminology.csv` даёт ui_uk + never_means; state-catalog — единственный источник состояний («новое состояние запрещено добавлять только в одном слое»), а расхождение enum между catalog/SQL/OpenAPI блокирует merge/release; глоссарий doc 05 §12 переписан каноническими ui_uk-лейблами (CHANGELOG §5). Конкретная дыра: каноническое поле маппинга `cost_code` из FR-03 не имеет цели ни в `work_items`, ни в OpenAPI import contract (единственное упоминание во всём пакете — docs/01:88), в отличие от section/parent, разрешённых в `section_path`.
   - Артефакт/ссылка: `technical/entity-aliases.csv`; `technical/terminology.csv`; `docs/17-production-readiness-index.md` §6; `docs/22-data-api-contract.md` §1–2; `docs/01-prd.md` FR-03 vs `technical/schema.sql` (work_items)
   - Обновление (закрыто фиксом 23.07.2026): cost_code внесён в entity-aliases.csv (deferred → import_files), PRD FR-03 уточнён
   - Статус и владелец: Closed · Architecture

29. Which relationships are enforced with database constraints rather than only application validation?
   - Ответ/решение: На уровне БД принудительно: tenant/project-целостность — массовый блок composite FK `(organization_id, project_id[, id])` (contracts→projects, contract_versions→contracts, locations parent, reference versions→upload intents с purpose/retention_class и т.д., ~50+ constraint-ов), уникальность `(organization_id, client_operation_id)` для команд, CHECK-инварианты quantity_entries (знаки/типы/`corrects_entry_id`/transfer pair/reporting-date state), lineage-checks work_items/review_decisions (deferred FK на lineage_root, one current head), `num_nonnulls`-полиморфизм review targets, DEFAULT=initial state (проверка валидатора), RLS forced + `NOBYPASSRLS`. Нормативное правило: «A service-layer check alone is insufficient for tenant identity, lineage uniqueness, money dedupe or immutable-current-head invariants».
   - Артефакт/ссылка: `technical/schema.sql` (блок constraints, строки ~2490+; quantity_entries; review_decisions); `docs/06-data-model-permissions.md` §5, §9, §13; `docs/22-data-api-contract.md` §3; `scripts/validate_package.py` (DEFAULT==initial); `CHANGELOG-AUDIT-FIX-20260723.md` §3–4
   - Статус и владелец: Closed · Architecture

30. Can cross-tenant or cross-project references be created accidentally through imported identifiers?
   - Ответ/решение: Нет: импортированные идентификаторы никогда не становятся ссылками — каждая строка получает stable internal ID, source key хранится отдельно (FR-03); цепочка upload_intent → import_job → import_row_results → work_items связана composite tenant FK `(organization_id, project_id, …)`, так что чужой UUID даёт FK violation, а API-инвариант №1 — «relationship cannot cross organization»; cross-tenant ID возвращает not-found semantics, cross-tenant dedupe по checksum не раскрывает существование/метаданные; `X-Organization-Id` проверяется на соответствие `(organization_id, project_id)`. Верифицируется T-RLS-001 (PILOT-BLOCKER, полный role/scope/state matrix) и NFR-12 (tenant isolation tests на каждый релиз).
   - Артефакт/ссылка: `docs/01-prd.md` FR-03, NFR-12; `docs/22-data-api-contract.md` §3–4, §6; `docs/06-data-model-permissions.md` §3; `docs/03-personas-jtbd-workflows.md` §4 (duplicate file); `technical/schema.sql` (import_jobs/import_row_results FK); `technical/test-catalog.csv` (T-RLS-001)
   - Статус и владелец: Closed · Architecture

## 3. Contract, SOV, quantities, and money


31. What is the authoritative quantity source for each work item at every stage?
   - Ответ/решение: Для каждой стадии задан один авторитетный источник: контрактный объём — immutable строка `work_items.contract_quantity` published contract version (lineage_root_id, одна текущая голова); плановый — `work_assignments.planned_quantity` (>0), сериализуется против доступного baseline по всей lineage; выполненный — append-only ledger `quantity_entries` (progress/correction/reversal, net); включённый в пакет — snapshot `package_lines` + точные source-записи `package_line_quantity_sources`; принятый/оплаченный (GA) — `acceptance_records.accepted_minor` (server-reconciled) → `receivables`/`payments`. `work_item.status` — только server-maintained проекция с фиксированным precedence; rebuild из immutable источников обязан совпасть.
   - Артефакт/ссылка: docs/38-business-logic-closure.md §2, §5; docs/18-domain-state-machines.md §4–5; technical/schema.sql (work_items:364, work_assignments:405, quantity_entries:824, package_line_quantity_sources:1231, acceptance_records:1297); docs/04 §Work (getWorkItemDetail).
   - Статус и владелец: Closed · Architecture

32. How are contracted, planned, performed, accepted, invoiced, and paid quantities kept mathematically reconcilable?
   - Ответ/решение: Цепочка машинных инвариантов: planned не превышает available baseline по lineage (serialized, doc 38 §4/§7); net performed ≤ contract limit (QUANTITY_LIMIT_EXCEEDED); `performed = ready + risk` — SQL CHECK в readiness_snapshots; `package amount = included_ready`; accepted сверяется к immutable package decision lines в валюте пакета и требует положительной server-reconciled суммы; receivable не превышает accepted amount/currency; allocations ≤ payment и ≤ receivable outstanding под SERIALIZABLE-алгоритмом. PRD §6 фиксирует сквозные неравенства (ready≤performed, submitted≤locked, accepted≤submitted+adjustments, paid≤invoiced), а QA требует пересборку проекций из ledger с точным совпадением.
   - Артефакт/ссылка: docs/38 §2, §8, §12; docs/18 §5, §11 (алгоритм allocation); technical/schema.sql (readiness_snapshots:2165 CHECK; acceptance_records CHECK; receivables); docs/01-prd.md §6; docs/13-qa-acceptance.md; technical/error-catalog.csv (QUANTITY_LIMIT_EXCEEDED, PAYMENT_ALLOCATION_EXCEEDS).
   - Статус и владелец: Closed · Architecture

33. Can negative quantities, reversals, corrections, and scope reductions be represented without destructive edits?
   - Ответ/решение: Да. `quantity_entries` append-only с CHECK-ами: progress строго >0 без источника; correction — знаковая ненулевая дельта с обязательными corrects_entry_id и reason; reversal строго <0, ссылается на источник и ограничен unreversed остатком (QUANTITY_CORRECTION_INVALID); zero отклоняется на уровне JSON-контракта. Сокращение скоупа — re-import: новая contract version + acyclic lineage с diff added/changed/removed и money delta, старые головы не удаляются; Pilot-импорт видимо блокирует негативные/zero строки; GA добавляет transfer_out/in (атомарная пара) и accepted_adjustment. Delete/update денежных и количественных фактов запрещены (correction/reversal only).
   - Артефакт/ссылка: technical/schema.sql (quantity_entries:824, CHECK-и 844–852); docs/38 §5, §7, §11; docs/01 FR-17; docs/18 §5, §11; docs/22 §4 (инвариант 3); T-QUANTITY-CORRECTION-001, T-REIMPORT-LINEAGE-001 (technical/test-catalog.csv).
   - Статус и владелец: Closed · Architecture

34. How is over-performance beyond the contracted quantity handled and surfaced?
   - Ответ/решение: Механизм: инвариант «сумма по work item/location не может превышать contract limit без authorized variation/override» (doc 18 §5); плановые объёмы сериализуются и не превышают baseline (doc 38 §4; F20 edge «over-plan»); нарушение возвращает 422 QUANTITY_LIMIT_EXCEEDED с safe limits и userAction `correct_quantity_or_request_override`; preflight FR-10 проверяет «out-of-baseline scope»; GA — variation basis, readiness отдельно показывает performed unapproved variation value (FR-09). Разрыв: PRD §6 обещает «warns/blocks according to policy», но носителя политики (поле в contract terms/entitlements) нет, и Pilot-команды/permission для «authorized override» не существует — фактически только hard block до GA-вариаций.
   - Артефакт/ссылка: docs/18 §5; docs/38 §4; docs/01 §6, FR-09, FR-10; docs/20 §22 (F20 edges); technical/error-catalog.csv:54; technical/openapi.yaml (ContractTermsDraft — поля политики отсутствуют).
   - Обновление (закрыто фиксом 23.07.2026): PRD §6: жёсткий hard block QUANTITY_LIMIT_EXCEEDED, изменение — только new contract version; «according to policy» удалено
   - Статус и владелец: Closed · Product

35. How are unit conversions handled when field capture and contract units differ?
   - Ответ/решение: По модели расхождение невозможно: quantity-записи не имеют собственной единицы и наследуют замороженную единицу строки (`work_items.unit_code` + `unit_definition_version`/`unit_input_precision`; «quantity precision is frozen from the work-item unit-definition version»), т.е. полевой ввод всегда в контрактной единице. `unit_definitions` содержит base_unit_code/conversion_factor numeric(20,10) и input/display precision («unit definition specifies input/display precision and conversions»); импорт блокирует unsupported units как row error. Разрыв: семантика применения конвертации (где применяется, правило округления результата, тесты) нигде не нормирована — заявлена только метаданными таблицы.
   - Артефакт/ссылка: technical/schema.sql (unit_definitions:1922; work_items:377–380; quantity_entries:824 — нет поля unit); docs/38 §5; docs/22 §3 (Quantity); docs/01 FR-03; docs/20 §5 (F04 edge «unsupported units»).
   - Обновление (закрыто фиксом 23.07.2026): doc 22 §3 «Units and conversion»: capture только в контрактной единице; conversion_factor — import/display; округление по precision единицы
   - Статус и владелец: Closed · Architecture

36. How are price changes, indexation, VAT, retention, discounts, and rounding represented?
   - Ответ/решение: Цены меняются только новой immutable contract version/lineage (re-import, GA variation incorporation) — пакет пиннит точную версию. VAT: `contracts.vat_mode` + `work_items.tax_mode` (exclusive/inclusive/none), налоги/удержания/вычеты — «explicit lines, not hidden JSON»; QA имеет фикстуры VAT-режимов. Retention: `RetentionRule` (percent/releaseTrigger/defectsPeriodDays) в contract terms + `retention_releases` + `receivable_adjustments` (kind retention/deduction/credit/debit/writeoff/reversal). Rounding: `rounding_mode` (half_up|half_even|down) + `quantity_scale` + minor units + adapter rounding declarations. Разрыв: индексация цены контракта не смоделирована вовсе (упоминается только как пункт SaaS order form в doc 10), скидки представимы лишь косвенно через deduction/credit adjustment.
   - Артефакт/ссылка: technical/schema.sql (contracts:195, work_items:383, contract_term_versions:249–283, receivable_adjustments:1325, retention_releases:1339); technical/openapi.yaml (RetentionRule:21617, ContractTermsDraft:21411); docs/22 §3; docs/32 §2; docs/27 §(VAT fixtures); docs/10 (indexation только в order form).
   - Обновление (закрыто фиксом 23.07.2026): doc 38 §7: индексация внутри версии не моделируется — только новая contract version; скидки — deduction/credit каналом
   - Статус и владелец: Closed · Product

37. Can one line have multiple price versions effective over different periods?
   - Ответ/решение: Не через date-effective прайс-листы — их нет by design: цена (`unit_price_minor`) заморожена в immutable версии work item; изменение цены создаёт новую contract version в lineage с одной текущей головой, а каждый пакет/период связывает точный `contract_version_id`/terms version. Поэтому разные периоды могут закрываться по разным версиям цены, но пересекающихся effective-интервалов не бывает, а future-effective публикация terms в Pilot отклоняется (CONTRACT_TERMS_FUTURE_EFFECTIVE_UNSUPPORTED). `valuation_basis` допускает contract_rate|approved_rate_override как GA-основание оценки.
   - Артефакт/ссылка: technical/schema.sql (work_items:364–394, package_versions:1149–1156, contract_term_versions:262); docs/38 §7; docs/18 §4; technical/error-catalog.csv:115.
   - Статус и владелец: Closed · Architecture

38. What happens when a contract amendment changes a line after evidence has already been captured?
   - Ответ/решение: Re-import создаёт successor в acyclic lineage; уже захваченные evidence/quantity/occurrences остаются привязаны к точному кортежу старой головы и никогда не перелинковываются («work item lineage superseded → hold; never relink server history»). Активация successor блокируется, пока открытые assignments старой головы не разрешены или не проведены через explicit migration plan — поэтому объём не планируется дважды; totals считаются поверх всей lineage. Diff показывает added/changed/removed, money delta и affected packages/rules; submitted packages остаются на прежнем immutable snapshot.
   - Артефакт/ссылка: docs/38 §7 (re-import lineage); docs/18 §4; docs/23 §6 (conflict table); docs/06 §13; T-REIMPORT-LINEAGE-001; technical/schema.sql (work_items lineage CHECK 390–393, import_diffs:1969).
   - Статус и владелец: Closed · Architecture

39. Can imported rows be re-mapped after use, and what downstream records become invalid or require migration?
   - Ответ/решение: Да, но только через новый импорт: mapping входит в идемпотентность job (unique organization+project+file_hash+mapping_hash+mode+requester), поэтому новое сопоставление — это новый dry-run/confirm, порождающий новую contract version и lineage-diff; mapping-пресеты версионируются (`import_mapping_presets.version`). Downstream ничего не инвалидируется молча: открытые assignments на старой голове блокируют активацию successor или требуют exact migration plan (linked replacement assignment), submitted packages/evidence остаются пиннуты на своих snapshot-ах.
   - Артефакт/ссылка: technical/schema.sql (import_jobs:331–350, import_mapping_presets:1956); docs/38 §7; docs/20 §5 (F04); docs/18 §4; T-REIMPORT-LINEAGE-001.
   - Статус и владелец: Closed · Architecture

40. How are duplicate SOV rows detected across repeated imports?
   - Ответ/решение: Внутри файла — детекция дубликатов кода обязательна (FR-03 «Detect: … duplicates»; `import_row_results.state` включает `duplicate`; unique(contract_version_id, code)). Между импортами: полностью идентичный импорт дедуплицируется constraint-ом file_hash+mapping_hash+mode (F04 edge «same hash»); повторный импорт строит diff added/changed/removed и присоединяет строки к одной acyclic lineage с одной текущей головой, а availability/performed агрегируются по lineage_root_id — двойного baseline не возникает.
   - Артефакт/ссылка: docs/01 FR-03; technical/schema.sql (import_jobs:348, import_row_results:357, work_items:388); docs/20 §5 (F04 edges); docs/38 §7; T-BOQ-LINE-TYPE-001, T-REIMPORT-LINEAGE-001.
   - Статус и владелец: Closed · Architecture

41. How does the system prevent the same performed quantity from being submitted in two periods?
   - Ответ/решение: Тройная защита: (1) package_line_quantity_sources фиксирует точные source-записи, а частичный unique-индекс `package_quantity_one_current_claim_uidx (quantity_entry_id) WHERE claim_state='current'` допускает ровно одну текущую claim на количественную запись во всех пакетах; (2) при snapshot источники reservation-checked: superseding версия того же пакета может переиспользовать источники предшественника, но другой период не может double-claim (doc 38 §5, §8); (3) периоды одного проекта не пересекаются (EXCLUDE gist по daterange).
   - Артефакт/ссылка: technical/schema.sql (package_line_quantity_sources:1231–1240, индекс 2486–2487, reporting_periods:1115); docs/38 §5, §8; docs/06 §6.
   - Статус и владелец: Closed · Architecture

42. What is the exact formula for amount under risk, and can every component be explained to a user?
   - Ответ/решение: Формула нормативно зафиксирована: `performed = ready_candidate + blocked_risk`; `ready_candidate = included_ready + excluded_ready`; `held` — помеченное подмножество blocked_risk (не дополнительная сумма); `package amount = included_ready`; в SQL — CHECK `performed_minor = ready_minor + risk_minor`, т.е. risk = performed − ready, где денежная ready = approved performed quantity × unit price в границах published baseline (FR-07). Каждый компонент объясним: PeriodPreflight возвращает performed/ready/risk/held/excluded + hardBlockers (code/count/remediation), listReadinessBlockers — reasonCodes, affectedQuantity/affectedValue, owner, remediation, engineVersion/inputHash; терминология фиксирует `at_risk` = «Performed value not currently ready_internal with explicit classified reasons».
   - Артефакт/ссылка: docs/38 §8; technical/schema.sql (readiness_snapshots:2188–2189); technical/openapi.yaml (PeriodPreflight:16387, ReadinessBlocker:24131); docs/01 FR-07, §2; technical/terminology.csv:4.
   - Статус и владелец: Closed · Architecture

43. How are ready-but-excluded amounts distinguished from blocked amounts?
   - Ответ/решение: Это разные слагаемые разных термов уравнения: `excluded_ready` — подмножество ready_candidate (строка готова, но исключена из пакета явным include/exclude с reason, FR-10), тогда как `blocked_risk` — не готова. PeriodPreflight несёт `excludedMinor` и `riskMinor` отдельными обязательными полями, и `package amount = included_ready` — исключённая готовая сумма никогда не попадает в риск и не теряется.
   - Артефакт/ссылка: docs/38 §8; technical/openapi.yaml (PeriodPreflight: readyMinor/riskMinor/heldMinor/excludedMinor); docs/01 FR-10.
   - Статус и владелец: Closed · Architecture

44. How are held amounts represented without double-counting blocked risk?
   - Ответ/решение: Нормативно: «`held` is a labelled subset of `blocked_risk`, never an additional amount» — heldMinor в preflight является меткой внутри riskMinor и не суммируется поверх; уравнение проверяется целиком (performed = ready + risk). Дополнительно FR-07 требует «Blocked value не суммировать дважды при нескольких blockers» — один рубль риска считается один раз независимо от числа блокеров.
   - Артефакт/ссылка: docs/38 §8; technical/openapi.yaml (PeriodPreflight:16387); docs/01 FR-07; technical/schema.sql (readiness_snapshots CHECK).
   - Статус и владелец: Closed · Architecture

45. Can package totals be independently recomputed from immutable source snapshots?
   - Ответ/решение: Да. package_versions замораживает contract/contract-terms/rule/adapter/renderer/template идентичности + snapshot_hash/rule_snapshot_hash; package_lines хранит quantity/amount_minor/readiness_snapshot; package_line_quantity_sources — included_quantity и source_snapshot_hash по каждой immutable ledger-записи; package_line_evidence_sources — sha256 доказательств. Инвариант doc 22 §4.5: «Package total equals line/adjustment totals under the snapshot calculation version»; QA-контракт требует пересборку проекции из ledger и сравнение (doc 13), generated files несут hash/manifest.
   - Артефакт/ссылка: technical/schema.sql (package_versions:1149–1189, package_lines:1218, package_line_quantity_sources:1231, package_line_evidence_sources:1242, package_artifacts:1251); docs/06 §6; docs/22 §4; docs/13 §(rebuild projection).
   - Статус и владелец: Closed · Architecture

46. What happens when currency exchange is required, and which rate source and date are used?
   - Ответ/решение: В Pilot FX запрещён: одна валюта на контракт (UAH default), allocation-алгоритм отклоняет cross-currency значения (doc 18 §11 шаг 5), receivable не может отклониться от валюты acceptance, cross-currency charge запрещён и в SaaS (doc 21). GA-контракт задан только формой: «cross-currency objects include rate/source/effective date only after feature activation» (doc 22 §3) и GA-gate «multi-project/currency/tax boundaries — no cross-currency aggregate without conversion policy» (doc 34 §5). Конкретный источник курса (НБУ/банк), дата-политика и поля в схеме не выбраны — grep exchange_rate/fx_rate/rate_source по пакету пуст.
   - Артефакт/ссылка: docs/18 §11; docs/22 §3, §6 (money `{amountMinor,currency}`); docs/21 §(billing limits); docs/34 §5; docs/32 §5 (country pack currency rules); grep-пустота по rate-полям в schema.sql/openapi.yaml.
   - Статус и владелец: Deferred with gate (GA-gate doc 34 §5 «multi-project/currency/tax»; для стран — V-008) · Architecture

## 4. Evidence rules and requirement occurrences


47. Can every evidence rule be expressed deterministically without AI?
   - Ответ/решение: Да. Rule config — allowlisted typed schema (EvidenceRuleDraft, additionalProperties:false; «unknown keys fail validation»), четыре дискриминированные occurrence-стратегии с константными политиками (start/end/late/out-of-order/crossing зашиты const-ами); оценка — versioned engine с immutable input snapshot/hash (requirement_evaluations unique(requirement_id, input_hash)), поэтому результат воспроизводим. AI исключён из принятия: waiver «никогда не создаётся AI», «Readiness never relies only on AI confidence», «AI предлагает; человек подтверждает»; T-RULE-001 подтверждает, что все процессные моменты электрики выразимы конфигурацией без customer-specific кода.
   - Артефакт/ссылка: technical/openapi.yaml (EvidenceRuleDraft:21207, OccurrenceStrategy:25212); docs/38 §7; docs/18 §7; docs/01 §3 (принцип 4), §6; technical/schema.sql (evidence_rule_versions:434 CHECK config?occurrenceStrategy; requirement_evaluations:524); T-RULE-001.
   - Статус и владелец: Closed · Architecture

48. What triggers occurrence creation: location, date, batch, quantity threshold, milestone, or manual action?
   - Ответ/решение: Канонический закрытый набор из четырёх стратегий: `once` — occurrence материализуется атомарно при commit строки assignment-батча; `date` — календарная каденция, триггеры принадлежат планировщику (calendar is scheduler-owned); `batch` — ручная декларация material batch полевым актором только для собственного активного assignment через declareOccurrenceTrigger (нормализация ключа до идемпотентности); `quantity_threshold` — эмитится авторитетной ledger-транзакцией при первом восходящем пересечении (сервер пересчитывает порог, не доверяя запросу). Локация не отдельный триггер, а часть неизменяемого subject-кортежа occurrence (assignment+work item+location); milestone-триггера в каноне осознанно нет.
   - Артефакт/ссылка: docs/38 §4, §7; docs/20 §6 (F05), §22 (F20); technical/openapi.yaml (declareOccurrenceTrigger:10051 + description); technical/permissions.csv (occurrence,declare_trigger); technical/schema.sql (occurrence_trigger_events:495–522 CHECK по стратегиям).
   - Статус и владелец: Closed · Architecture

49. Can a rule create zero, one, or many occurrences for the same work item?
   - Ответ/решение: Да, все три случая: ноль — когда applicability rule_assignments (project/location/work_item/work_item_location + effective_from/effective_to) не покрывает строку или календарное окно assignment пусто (calendar «starts at assignment start at/after its anchor and ends at the earlier of assignment due/completion»); ровно один — `once` на assignment (unique(assignment_id, rule_version_id, occurrence_key)); много — date/batch/threshold порождают occurrence на каждый канонический trigger key. FR-04: «Один rule может иметь много occurrences; occurrence key детерминирован и idempotent», повторные occurrences не перезаписывают друг друга (FR-04A).
   - Артефакт/ссылка: technical/schema.sql (rule_assignments:2142–2163, requirement_occurrences:490); docs/38 §7; docs/01 FR-04/FR-04A; technical/openapi.yaml (CalendarOccurrenceStrategy start/end policy).
   - Статус и владелец: Closed · Architecture

50. How are duplicate occurrences prevented when workers or jobs retry?
   - Ответ/решение: Три независимых слоя: unique(assignment_id, rule_version_id, occurrence_key) на requirement_occurrences; occurrence_trigger_events с unique(organization_id, client_operation_id) и unique(assignment_id, rule_version_id, trigger_key) при нормализации batch-ключей до идемпотентности («late, out-of-order or replayed inputs cannot create duplicates»); каждая строка assignment-батча имеет стабильный clientOperationId и replay возвращает тот же receipt даже после истечения HTTP idempotency TTL. Конфликты типизированы: OCCURRENCE_CONFLICT (409) и OCCURRENCE_TRIGGER_CONFLICT (409, retryable); закрыто тестом T-OCCURRENCE-STRATEGY-001 (race duplicates, replay).
   - Артефакт/ссылка: technical/schema.sql (requirement_occurrences:490, occurrence_trigger_events:513–515); docs/38 §4, §7; technical/error-catalog.csv:92,103; technical/test-catalog.csv (T-OCCURRENCE-STRATEGY-001, T-OCCURRENCE-001).
   - Статус и владелец: Closed · Architecture

51. What happens to existing occurrences when a rule template is revised?
   - Ответ/решение: Ничего разрушительного: существующие occurrences пиннят rule_version_id, а assignment — rule_snapshot_hash; «rule migration requires a separate preview without rewriting prior occurrences» и «correction/reversal never deletes a historically materialized obligation». Publish новой версии ставит re-evaluation job для requirement-слоя (side effect `requirements_re_evaluation_queued`), locked periods/существующие пакеты остаются на prior snapshot (FR-04; F05 edge «existing package remains on prior snapshot»). T-OCCURRENCE-001 прямо требует «captured occurrences retain frozen versions», T-RULE-002 — историческую изоляцию v1 при publish v2.
   - Артефакт/ссылка: docs/38 §7; technical/state-transitions.csv:61–62 (rule_version publish/retire); docs/01 FR-04; docs/20 §6; technical/test-catalog.csv (T-RULE-002, T-OCCURRENCE-001).
   - Статус и владелец: Closed · Architecture

52. Can a published rule be corrected, and how is the correction linked to the original version?
   - Ответ/решение: Published-версия immutable; исправление — новая запись evidence_rule_versions с тем же rule_key и инкрементным version_no (unique(organization_id, rule_key, version_no)); связь с оригиналом — общий rule_key плюс partial-unique «одна published на rule_key» (evidence_rules_one_published_uidx), т.е. публикация преемника вытесняет текущую версию по ключу. Publish возможен только через свежий single-use impact preview с канонич. payload/hash (RULE_PUBLISH_CONFLICT/RULE_IMPACT_STALE при дрейфе); откат — тоже новая версия («rollback via new version»).
   - Артефакт/ссылка: technical/schema.sql (evidence_rule_versions:434–450, индекс 2483–2485); docs/38 §7; docs/20 §6; technical/error-catalog.csv:80,87; T-RULE-PAYLOAD-001.
   - Статус и владелец: Closed · Architecture

53. Which requirement types are blocking, warning-only, or informational?
   - Ответ/решение: Канонический контракт двухуровневый: severity ∈ {blocking, warning} — в EvidenceRuleDraft (обязательное поле правила), в ReadinessBlocker (surfaced blockers) и в package_decision_issues (SQL CHECK); preflight разделяет hardBlockers и warnings, warning допускает продолжение после acknowledgement. Однако PRD FR-04 обещает три уровня: «Severity: blocker, warning, informational» — уровень informational не существует ни в одной схеме/CSV/SQL пакета (grep пуст, кроме цветового токена дизайна). Минимальный фикс: убрать «informational» из FR-04 (привести PRD к канону) либо добавить уровень в EvidenceRuleDraft/ReadinessBlocker/SQL с определённым влиянием на readiness.
   - Артефакт/ссылка: technical/openapi.yaml (EvidenceRuleDraft.severity:21253, ReadinessBlocker.severity:24197); technical/schema.sql:1551; docs/18 §9 (warning/hard blockers); противоречие: docs/01-prd.md FR-04 (строка 98).
   - Обновление (закрыто фиксом 23.07.2026): PRD FR-04 приведён к канону: два уровня blocking|warning
   - Статус и владелец: Closed · Product

54. Can blocking severity change after work is performed, and what requires explicit approval?
   - Ответ/решение: Да, но только новой версией правила через двухшаговый guarded-процесс: impact preview обязан посчитать affected/becameBlocked/becameReady и сохранить канонический payload; publish требует свежего previewId+impactInputHash и явного `acknowledgeBlockingImpact` (RulePublishRequest) под permission rule.publish (Owner/Admin/PTO; PM/estimator scoped) с guard `impact_preview_fresh_and_acknowledged`. Прошлые occurrences/locked periods не переписываются (миграция — отдельный preview); для уже выполненной работы, ставшей blocked, остаются только явные пути — correction capture или авторизованный expiring waiver. Edge «before-concealment rule activated after work» прямо каталогизирован в F05.
   - Артефакт/ссылка: technical/openapi.yaml (RuleImpactPreview:15226, RulePublishRequest:15285); technical/state-transitions.csv:61; technical/permissions.csv:30; docs/20 §6; docs/01 FR-04.
   - Статус и владелец: Closed · Architecture

55. How are before-concealment hold points enforced when the device is offline?
   - Ответ/решение: Полевой авторитет доказывается только server-issued bounded lease (accept/start онлайн до выдачи execution bundle; device time «is metadata only»), бандл кэширует rule/occurrence snapshot, и UI блокирует действие concealment до hold-решения (негативная проверка в verify.mjs, changelog §6). Сервер принимает concealment_events (source field_online|field_offline|supervised, client_operation_id, occurred_at, receipt_hash) только «after an eligible exact hold-point decision» с проверкой occurrence_version — офлайн-факт, синхронизированный без прошедшего hold point, отклоняется HOLD_POINT_BLOCKED и не закрывает occurrence; unique(occurrence_id) исключает дубли закрытия. Машина состояний допускает close только из passed/passed_with_notes/waived.
   - Артефакт/ссылка: technical/schema.sql (concealment_events:1004–1025, hold_point_decisions:987); technical/openapi.yaml (recordConcealmentEvent:7784 description); technical/state-transitions.csv:241–243; docs/20 §7 (F06), §23 (F21); docs/23 §4, §12; technical/error-catalog.csv:95; CHANGELOG-AUDIT-FIX §6; T-HOLD-001.
   - Статус и владелец: Closed · Security

56. What happens when a hold point was missed but the structure is already concealed?
   - Ответ/решение: Записать закрытие задним числом нельзя (HOLD_POINT_BLOCKED без eligible-решения; append-only concealment «не скрывает missing proof» — FR-04A), поэтому occurrence остаётся блокером required/failed/expired с денежным эффектом в readiness и эскалацией (`expire → escalation_and_risk_visible`). Явные пути разрешения: start_correction (failed → capture_pending новой capture-ревизией с сохранением всех прежних решений) либо авторизованный expiring waiver с суммой/причиной, обязательный к раскрытию в package manifest; при правиле, опубликованном после уже скрытых работ, — impact preview с acknowledgement (F05 edge). T-HOLD-001 прямо тестирует «conceal before pass» и «duplicate conceal».
   - Артефакт/ссылка: technical/state-transitions.csv:237–244; docs/38 §6; docs/01 FR-04A; docs/18 §7; docs/20 §6, §9 (F08); technical/error-catalog.csv:95; T-HOLD-001.
   - Статус и владелец: Closed · Architecture

57. Can a requirement be waived, by whom, for what reason, and with what re-authentication?
   - Ответ/решение: Да, но только per exact occurrence + version (минимальный scope waiver-а — doc 38 §2.3): актор authorized_manager (permissions `readiness,override`: Owner/Admin/Commercial/PTO, PM scoped; revoke дополнительно доступен Security Admin), обязательны reason_code, justification, expires_at и affected quantity либо value+currency (WaiverCreate anyOf; SQL NOT NULL); create и revoke входят в канонический recent-auth список (step-up ≤10 минут, doc 19 §7; guards `recent_auth_…` в state-transitions). Waiver никогда не создаётся AI или анонимным external reviewer; один активный waiver на occurrence сериализован, blanket/migration waiver — отдельная high-risk GA-команда.
   - Артефакт/ссылка: technical/openapi.yaml (createOccurrenceWaiver:2959, WaiverCreate:15456); technical/schema.sql (requirement_waivers:538–566, requirement_waiver_revocations:568–582); technical/permissions.csv (readiness,override; requirement_waiver,revoke); docs/19 §7 (строка 109); technical/state-transitions.csv:75,239,276–277; docs/18 §7; docs/38 §6.
   - Статус и владелец: Closed · Security

58. Does a waiver reduce readiness risk while preserving the original missing requirement?
   - Ответ/решение: Да: waiver «не меняет исходный requirement» (doc 18 §7), occurrence переходит в waived и может закрыться только как authorized-waived; readiness пересчитывается ровно один раз, и результат маркируется отдельно — состояние `overridden_ready` (не `ready_internal`), а в списке блокеров waived остаётся видимым (`waived_visible`); package manifest обязан раскрыть waiver. Expiry/revoke автоматически возвращает occurrence в required, сохраняет оригинальный waiver append-only и не меняет ранее сгенерированные манифесты (T-WAIVER-001: «requirement retained; readiness recomputes; manifest exposes waiver»; T-WAIVER-REVOKE-001).
   - Артефакт/ссылка: docs/18 §7; technical/state-transitions.csv:239–240,276–277; technical/openapi.yaml (ReadinessBlocker.state waived_visible; readiness states); docs/20 §9 (F08); docs/06 §13; technical/test-catalog.csv:79,135.
   - Статус и владелец: Closed · Architecture

59. Can one evidence object satisfy multiple rules only when explicitly permitted?
   - Ответ/решение: Да, это нормативный инвариант: satisfaction записывается per exact occurrence, и «one evidence object may support several occurrences only through explicit `evidence_requirement_links` rows created in the exact assignment subject» — связь несёт полный кортеж org/project/work item/assignment/location/occurrence и capture client operation. Reuse требует target preview и создаёт новый link, никогда не ретаргетя оригинал (F21; FR-05 «Evidence reuse across occurrences requires explicit scope preview and server validation»); upload intent сознательно не содержит occurrence, а invalidation пересчитывает все связанные occurrences без удаления оригинала.
   - Артефакт/ссылка: docs/38 §3; technical/schema.sql (evidence_requirement_links:808–822); docs/01 FR-05; docs/20 §23 (F21); docs/23 §4 (п.4), §6; T-EVIDENCE-ASSOCIATION-001 (docs/38 §15).
   - Статус и владелец: Closed · Architecture

60. How are date validity, calibration expiry, signer authority, and document revision checked?
   - Ответ/решение: Даты — `maximumAgeHours` в правиле, поля issue/expiry в certificate-форме, `due_at` occurrence и раздельные claimed/authoritative reporting dates с guarded confirm по business calendar; калибровка — typed test-форма (instrument/serial/calibration) с валидацией «expired certificate/calibration, out-of-range value» как каталогизированные edges (валидация — configured completeness check, не истина); ревизия документа — обязательная привязка exact reference_document_version + stale_unacknowledged/stale_acknowledged + REFERENCE_STALE, submitted snapshots пиннуты. Полномочия подписанта НЕ проверяются: есть только assurance levels (клик никогда не повышается до КЕП), а KEP provider и «signer authority» — прямо в V-005 (disabled, требует counsel + provider PoC); role/signature matrix лишь в чек-листе артефактов V-gate.
   - Артефакт/ссылка: technical/openapi.yaml (EvidenceRuleDraft.maximumAgeHours; TypedEvidenceRecord); docs/01 FR-05 (формы), FR-14 (reference register); docs/20 §23 (F21 edges); docs/23 §12; technical/schema.sql (typed_evidence_records:785, reference_status в work_assignments:423); technical/error-catalog.csv:93–94; docs/30 §2 (V-005), §3.
   - Обновление (закрыто фиксом 23.07.2026): doc 24 §1: явная граница — полномочия подписанта в Pilot не проверяются, только assurance label; проверка — за V-005
   - Статус и владелец: Closed · Legal (external)

61. How are customer-specific rule sets isolated from reusable company templates?
   - Ответ/решение: Три изолированных слоя: (1) переиспользуемые шаблоны — org-scoped rule_packs/rule_pack_versions с immutable config_snapshot/hash (draft→published→retired); (2) рабочие правила — evidence_rule_versions с project-scope (project_id; одна published на rule_key через partial unique nulls-not-distinct), публикация проектной версии не мутирует шаблон — pack выбирается и настраивается в проектный draft (F05); (3) customer/country adapters — платформенные immutable versioned packages вне tenant state-catalog, проект пиннит adapter_key/version через contract terms, upgrade требует авторизованного подтверждения и никогда не меняет submitted packages.
   - Артефакт/ссылка: technical/schema.sql (rule_packs:2116, rule_pack_versions:2127, evidence_rule_versions:434–450 + индекс 2483–2485, contract_term_versions.adapter_key:273); docs/32 §2–§3, §6; docs/20 §6 (F05); docs/06 §5.
   - Статус и владелец: Closed · Architecture

62. Can the system explain exactly why an item changed from ready to blocked after a rule update?
   - Ответ/решение: Да, реконструируемо по версиям: requirement_evaluations append-only с input_snapshot/input_hash/engine_version/reason_codes (unique(requirement_id, input_hash)); readiness input snapshot нормативно включает rule version, quantity cutoff, evidence/review hashes и waiver IDs (doc 18 §7), поэтому «до/после» различаются именно версией правила; сам rule update заранее фиксирует becameBlockedCount в impact preview и требует acknowledgement. Пользователю это отдают getRequirement (explainable state + reasonCodes + remediation + engineVersion) и listReadinessBlockers (inputHash/engineVersion per blocker) + listAuditEvents; историческая изоляция закрыта T-RULE-002.
   - Артефакт/ссылка: technical/schema.sql (requirement_evaluations:524–536, readiness_snapshots:2165); docs/18 §7; technical/openapi.yaml (getRequirement:2904, listReadinessBlockers:9692, RuleImpactPreview:15226, listAuditEvents:9942); docs/01 §2, FR-07; T-RULE-002.
   - Статус и владелец: Closed · Architecture

## 5. Evidence capture, media, and provenance


63. Does every evidence item preserve original bytes, checksum, capture source, actor, device, and server receipt time?
   - Ответ/решение: Да. Оригинал immutable: `evidence_objects` хранит storage_key, sha256 (regex-CHECK), byte_size, MIME, retention_class, created_by (актёр) и composite-привязку к lease/assignment/capture client operation; серверное время приёма — `upload_intents.sealed_at` и `capture_sessions.first_server_received_at`, клиентское `client_captured_at` хранится как недоверенное наблюдение. Источник (камера/галерея с видимым source label) и device-метаданные сохраняются как нормализованные trusted/untrusted metadata по policy (намеренно недоверенные, без отдельной «доказательной» device-колонки); это покрыто PILOT-BLOCKER-тестом T-CAPTURE-002 «original media hash and untrusted client metadata preserved».
   - Артефакт/ссылка: technical/schema.sql (`evidence_objects`, `upload_intents`, `capture_sessions`); docs/23-offline-media-protocol.md §7; docs/22-data-api-contract.md §3 (Files/Time); technical/test-catalog.csv T-CAPTURE-002.
   - Статус и владелец: Closed · Architecture

64. How are camera capture, gallery upload, file import, and external attachment distinguished?
   - Ответ/решение: Разделение типизировано на уровне upload intent: `purpose in ('evidence','estimate_import','location_import','reference_document')` с жёстким CHECK на subject-tuple и server-selected retention class (evidence_original vs contract_baseline); тип носителя — `evidence_objects.kind` (photo/video/audio/document/annotation). Камера vs галерея определяется policy каждой rule version и маркируется видимым source label (T-CAPTURE-002: «Allowed sources labeled; forbidden paths blocked»); внешние вложения подач/решений несут отдельный класс `package_artifact` и собственный provenance (source receipt в `package_decision_sets`).
   - Артефакт/ссылка: technical/schema.sql (`upload_intents.purpose` CHECK, `evidence_objects.kind`, `package_decision_sets`); docs/23 §8; docs/24 §9; docs/22 §5 (`uploadId` = upload_intents.id).
   - Статус и владелец: Closed · Architecture

65. Can users replace an original file, or must they create a new evidence version?
   - Ответ/решение: Замена запрещена: original object immutable, expired/cancelled/sealed intent нельзя переиспользовать, а retry/completion не могут изменить hash/size/type. Исправление — только новая capture revision (linked, проходит собственный lifecycle от server_received) либо invalidation + новая аудируемая связка; annotation/redaction создают derivative, не трогая оригинал.
   - Артефакт/ссылка: docs/18-domain-state-machines.md §6; docs/23 §7, §12; technical/schema.sql (`evidence_objects` CHECK original/derivative, lifecycle_state active/invalidated/superseded); docs/38 §15 (T-EVIDENCE-ASSOCIATION-001).
   - Статус и владелец: Closed · Architecture

66. How are edited, redacted, compressed, or annotated derivatives linked to the immutable original?
   - Ответ/решение: Derivative — отдельная строка `evidence_objects` с `parent_id` на оригинал, `retention_class='evidence_derivative'` и без upload_intent (schema-CHECK: ровно один из parent_id/upload_intent_id); annotation обязан иметь parent. Derivative привязан к original hash, lifecycle оригинала и derivative независимо enumerable, а package выбирает original/derivative по explicit policy.
   - Артефакт/ссылка: technical/schema.sql (`evidence_objects` CHECK parent/intent, kind='annotation'); docs/23 §7; docs/24 §4 (redaction derivative preserves original).
   - Статус и владелец: Closed · Architecture

67. How are EXIF time and GPS treated when they conflict with server or device metadata?
   - Ответ/решение: EXIF/device-время/GPS — недоверенные claims: сервер хранит их отдельно как normalized trusted/untrusted metadata, EXIF сохраняется только где privacy policy позволяет, а единственная проверяемая хронология — durable server receipt (doc 23 §12: «Device time, EXIF and possession of an old lease are not chronology proof»). Конфликты/аномалии часов и локации — warning, не обвинение и не auto-rejection; авторитетная reporting date назначается только отдельным authorized confirm-решением в open period (`capture_reporting_date_confirmations`).
   - Артефакт/ссылка: docs/23 §7, §12; docs/38 §4; docs/18 §6; docs/22 §3 (Time); technical/schema.sql (`capture_reporting_date_confirmations`, `client_captured_at`).
   - Статус и владелец: Closed · Security

68. What happens when GPS is unavailable, inaccurate, spoofed, or prohibited for a sensitive location?
   - Ответ/решение: Недоступен/небезопасен — location по выбранной иерархии (selected hierarchy) с записью причины: GPS optional и «никогда не блокирует safety-critical работу»; запрещён — sensitive-site policy отключает координаты/EXIF при сохранении protected metadata server-side; неточный/spoofed — location anomaly трактуется как warning, не auto-rejection. Однако сам механизм детекции spoofing/порога точности не специфицирован (нет warning-кода/события), а строгость политики остаётся за workshop-гейтом V-004.
   - Артефакт/ссылка: docs/23 §8, §11; docs/04 (S26); docs/24 §10; docs/03 (EXIF/coords strip on export); docs/18 §6; docs/30 V-004; docs/15 O-04.
   - Обновление (закрыто фиксом 23.07.2026): doc 23 §8: mock-location/accuracy-порог → untrusted metadata + anomaly warning; строгость для sensitive sites — V-004
   - Статус и владелец: Closed · Security

69. Are photo and video capture requirements configurable by work type and customer?
   - Ответ/решение: Да по модели: каждая rule version задаёт camera required/optional/gallery, min/max photo count, video/audio/document allowed с size/duration policy, location/timestamp behavior; привязка к типам работ — через rule_packs/evidence_rule_versions/rule_assignments, к заказчику — customer adapter/pack (Pilot: pack S08 electrical-only). Video capture исключён из Pilot и зарегистрирован в реестре обещаний как GA feature flag после доказанного спроса.
   - Артефакт/ссылка: docs/23 §8; technical/schema.sql (`rule_packs`, `rule_pack_versions`, `evidence_rule_versions`, `rule_assignments`); docs/37 («Field video capture — GA modelled»); docs/01 FR-05/NFR-06; docs/04 (S08).
   - Статус и владелец: Closed · Product

70. How are large videos, poor connectivity, resumable uploads, and storage quotas handled?
   - Ответ/решение: Загрузка — multipart с part-checksum/retry, immutable intent tuple (hash/size/type), экспоненциальный backoff с jitter и connectivity/lifecycle-хинтами; 413 предлагает compression/split только если policy позволяет и оригинал сохраняется; фон не гарантируется, resume явный. Квоты: метр `storage_bytes` warn_then_block_new_upload (existing data readable/exportable), low-storage предупреждение до камеры; NFR-06 — resumable, 20 MB photo configurable. Большие видео — post-MVP: лимиты фиксируются вместе с GA video flag (осознанная задокументированная граница Pilot).
   - Артефакт/ссылка: docs/23 §4–5, §9; docs/07 §6; technical/entitlements.csv (`storage_bytes`); docs/01 NFR-06; docs/37; technical/test-catalog.csv T-UPLOAD-002.
   - Статус и владелец: Closed · Architecture

71. Can an evidence object be quarantined after malware scanning, and what readiness state results?
   - Ответ/решение: Да: `scanning→quarantine` и (добавлено в v2.9) `pending_review→quarantine` при пост-скановой threat intelligence; на объекте — `scan_state='quarantined'`. Карантин блокирует review/package, сохраняя безопасную metadata record: requirement остаётся pending_scan/missing, occurrence — capture_pending, readiness не продвигается (evidence_missing/review_pending); выход — `rescan` (security_worker) или terminal_fail + новая ревизия, код SCAN_QUARANTINED; в мобильной очереди синхронизации есть карантинная карточка.
   - Артефакт/ссылка: technical/state-transitions.csv (capture_session quarantine/rescan строки); technical/schema.sql (`evidence_objects.scan_state`); docs/18 §6–7; technical/error-catalog.csv SCAN_QUARANTINED; CHANGELOG-AUDIT-FIX-20260723 §2, §6.
   - Статус и владелец: Closed · Security

72. How are duplicate photos detected without wrongly rejecting legitimate repeated views?
   - Ответ/решение: Точные дубликаты обнаружимы по SHA-256 (uniqueness по (organization_id, sha256, storage_key) + расчёт хэша локально и верификация server-side), повтор команды дедуплицируется по clientOperationId (double-tap в T-CAPTURE-001); политика явная: «duplicate/clock/location anomalies являются warning, не обвинением и не auto-rejection» — легитимные повторные ракурсы не отклоняются. Но перцептивный near-duplicate детектор не специфицирован, и отдельного warning-кода/аналитического события для дубликатов нет.
   - Артефакт/ссылка: docs/18 §6; docs/23 §7; technical/schema.sql (`evidence_objects` unique sha256); technical/test-catalog.csv T-CAPTURE-001; technical/error-catalog.csv / events.csv (кодов/событий duplicate-warning нет).
   - Обновление (закрыто фиксом 23.07.2026): doc 23 §7: exact SHA-256 дубль в пределах subject → warning (не reject); pHash — GA
   - Статус и владелец: Closed · Architecture

73. Can users capture evidence for the wrong location and later relink it without erasing history?
   - Ответ/решение: Relink возможен только пока capture — локальный несабмиченный черновик; после первого server receipt exact subject tuple (org+project+work item+location+assignment+capture operation) immutable, и ни UI, ни support не могут retarget. Ошибка исправляется через evidence invalidation + новую аудируемую capture/link: история, оригинал и receipts сохраняются, «subject tuple mismatch» отклоняется как terminal data-integrity error без вывода локации.
   - Артефакт/ссылка: docs/23 §6 (conflict table), §12; docs/04 (S27); docs/38 §3, §15 (T-EVIDENCE-ASSOCIATION-001); technical/schema.sql (composite FK по subject tuple).
   - Статус и владелец: Closed · Architecture

74. What happens if evidence is deleted after it was included in a submitted package?
   - Ответ/решение: Пользовательского delete нет: «evidence later invalidated → keep local/server receipt and original hash; create dependency refresh/correction, never delete or retarget», invalidation replay идемпотентен и «submitted package snapshots remain reproducible». Submitted package указывает на immutable artifacts/hashes и хранит evidence_sha256 источников; физическое удаление возможно только retention-workflow по классам с legal-hold check (длительности — V-003), package artifacts несут собственный класс, а unreferenced/unclassified объект квalifицируется как инцидент-карантин, не удаляется.
   - Артефакт/ссылка: docs/23 §6, §11; docs/22 §4 (инварианты 6, 10); docs/24 §9; technical/schema.sql (`package_line_evidence_sources.evidence_sha256`, `package_artifacts`); technical/data-retention-catalog.csv.
   - Статус и владелец: Closed · Architecture

75. Can the system prove which exact evidence version was rendered into a specific export?
   - Ответ/решение: Да: package version фиксирует exact contract/terms/rule/adapter/renderer/template и source snapshot identities; `package_line_evidence_sources` хранит evidence_sha256 точных источников, `package_artifacts` — hash/manifest каждого сгенерированного файла (unique по (package_version, kind, sha256)); readiness snapshot несёт evidence/review IDs and hashes + engine version. Провенанс покрыт тестом T-PACK-001 «Immutable package provenance snapshot».
   - Артефакт/ссылка: docs/18 §9; docs/38 §8; technical/schema.sql (`package_line_evidence_sources`, `package_artifacts`, `readiness_snapshots`); technical/test-catalog.csv T-PACK-001; docs/07 §7.
   - Статус и владелец: Closed · Architecture

76. How are voice notes transcribed, and is the original audio always retained?
   - Ответ/решение: В Pilot автоматической transcription нет вовсе («Pilot performs no external speech transcription»): voice/audio сохраняется как immutable original с optional manual text note. GA-транскрипция включается только после processor/privacy/quality gate, хранит source link и никогда не заменяет оригинал; в controller/processor-матрице transcription «separately gated». Оригинал аудио сохраняется всегда (kind='audio' в evidence_objects, evidence_original).
   - Артефакт/ссылка: docs/01 (FR, «Voice/audio note»); docs/09 (§ mobile/data); docs/04 (S26); docs/24 §3 (controller matrix); technical/schema.sql (`evidence_objects.kind`).
   - Статус и владелец: Closed · Product

77. How are typed evidence forms versioned when their schema changes?
   - Ответ/решение: `typed_evidence_records` несут schema_key + schema_version (+ form_kind, response_hash, ссылку на reference_document_version и immutable original); схемы allowlisted, unknown keys fail validation; уникальность (capture_session, occurrence, schema_key, schema_version). Изменение схемы — новая версия правила через отдельный single-use preview/publish без переписывания прежних occurrences и записей; старые ответы остаются на своей schema_version, состояние машины typed_evidence (received→valid|warning→invalidated) — append-only.
   - Артефакт/ссылка: technical/schema.sql (`typed_evidence_records`); docs/38 §7; technical/state-catalog.csv / state-transitions.csv (typed_evidence); docs/20 (F: typed forms edges).
   - Статус и владелец: Closed · Architecture

78. What is the retention and deletion policy for originals, derivatives, and exports?
   - Ответ/решение: Структура закрыта: классы `evidence_original`/`evidence_derivative`/`package_artifact`/`temporary_export` (+6 прочих), server-owned class при создании (клиент не может задать/override), per-row классы у файлов, temporary_export с обязательным expiry, двунаправленная инвентаризация DB↔storage и legal-hold перед удалением. Но все 126 записей data-retention-catalog остаются `duration_external_gate` со ссылкой на V-003 — длительности не подтверждены, и до внешнего решения деструктивное scheduling заблокировано by default.
   - Артефакт/ссылка: docs/24 §9; technical/data-retention-catalog.csv (126 записей, V-003); docs/18 §13 (unvalidated retention blocks destructive scheduling); docs/30 V-003.
   - Статус и владелец: Deferred with gate (V-003) · Legal (external)

## 6. Work lifecycle and state machines


79. Does every state transition have a named command, actor, preconditions, and resulting events?
   - Ответ/решение: Да для каталога: все 295 переходов в state-transitions.csv имеют непустые command/actor/guards/side_effects/reversal/error_code (проверено скриптом: 0 пустых полей; валидатор enforce-ит схему и исполнимость reversal), а doc 18 §1 гарантирует атомарные audit event + transaction-outbox event на каждый успешный переход. Открытым остаётся зафиксированный в changelog пункт: fail-события async-flows (import/generation/export/notification/webhook) отсутствуют в events.csv до решения по PII-свойствам каждого события.
   - Артефакт/ссылка: technical/state-transitions.csv (295 строк); docs/18 §1; scripts/validate_package.py; technical/events.csv; CHANGELOG-AUDIT-FIX-20260723 «Не менялось (осознанно)».
   - Обновление (закрыто фиксом 23.07.2026): в events.csv добавлены fail-события async-flows (import/generation/export/notification/webhook) с PII-safe свойствами и владением в traceability
   - Статус и владелец: Closed · Architecture

80. Are there any states reachable only through direct database changes or generic PATCH endpoints?
   - Ответ/решение: Нет. В openapi.yaml ровно 4 PATCH-операции (updateOrganization/updateMembership/updateProject/updateNotificationPreferences), их схемы не содержат state-полей (ProjectPatch: name/customerName/siteAddress/timezone; OrganizationPatch: displayName/timezone; MembershipPatch: role/scopes/reasonCode), а doc 38 §9 явно запрещает lifecycle через settings PATCH и реактивацию revoked membership generic-патчем. Валидатор доказывает достижимость каждого состояния из initial по командным переходам + co-reachability до терминала; системные/worker-состояния достигаются через job-машины; негативные тесты: T-ASSIGNMENT-LIFECYCLE-001 («Generic PATCH cannot mutate lifecycle») и T-STATE-001 («projection states not user-written»).
   - Артефакт/ссылка: technical/openapi.yaml (4 PATCH, 157 операций); docs/38 §9; scripts/validate_package.py (reachability/co-reachability); technical/test-catalog.csv T-ASSIGNMENT-LIFECYCLE-001, T-STATE-001.
   - Статус и владелец: Closed · Architecture

81. Can a work item move backward, and if so, through correction or reopen rather than silent mutation?
   - Ответ/решение: work_item — read-only проекция над immutable assignments/quantity ledger: «назад» она движется только детерминированным пересчётом источников, не мутацией (`WorkItem.status … never directly patched by a field workflow`). Возвраты выражены явными командами: assignment submit→return→reassign, occurrence failed→start_correction, review `correct_review_decision` (append-only correction receipt + reopened task), quantity correction/reversal — все со structured reason и exact version; тихая перезапись исключена append-only моделью.
   - Артефакт/ссылка: docs/18 §4; docs/38 §2, §6; technical/state-transitions.csv (work_assignment, requirement_occurrence, capture_session correct_review_decision); technical/state-catalog.csv (work_item storage_scope=projection).
   - Статус и владелец: Closed · Architecture

82. What happens when performed work is partially rejected but partially accepted?
   - Ответ/решение: Разделено по уровням. Коммерчески: package decision items дают ровно один финансовый исход на строку (returned|accepted|modified) плюс любое число typed issues; финализация атомарно замораживает полный набор с server-derived submitted/accepted/returned totals; acceptance record `partially_accepted` терминальна для записи — довершение только через superseding record той же lineage (`supersedes_acceptance_record_id`, одна current head). Операционно: occurrence-level fail → новая capture revision при сохранении всех прежних решений; corrected package version линкуется на разрешаемые decision items.
   - Артефакт/ссылка: docs/18 §9, §11; docs/38 §2 (PackageDecisionSet), §8; technical/schema.sql (`package_decision_sets` totals, `acceptance_records`); docs/20 (§ package decision flow); CHANGELOG §2 (Acceptance терминальность).
   - Статус и владелец: Closed · Architecture

83. Can readiness be computed independently for quantity slices of the same work item?
   - Ответ/решение: Да на уровне количеств/стоимости: readiness snapshot несёт SQL-CHECK `performed_minor = ready_minor + risk_minor`, preflight разделяет performed = ready_candidate + blocked_risk и included_ready/excluded_ready, а package lines связывают точные quantity entries (`package_line_quantity_sources`) с резервированием против double-claim; quantity-threshold occurrences дают независимые обязательства по срезам. Метка readiness-состояния агрегируется по субъекту work_item/project/period — срезы выражаются суммами, exact source links и drill-down инвариантом T-READY-002 («every amount maps to lines/reasons/input hash; rebuild matches»).
   - Артефакт/ссылка: technical/schema.sql (`readiness_snapshots` CHECK); docs/38 §8; docs/18 §7; technical/test-catalog.csv T-READY-001/T-READY-002.
   - Статус и владелец: Closed · Architecture

84. How are cancelled assignments separated from cancelled work scope?
   - Ответ/решение: Отмена assignment — lifecycle-команда с reason/guards из любого нетерминального состояния, сохраняющая evidence/quantity history и инвалидирующая lease в том же commit; отмена скоупа — контрактный уровень: re-import lineage (removed rows видимы, одна current head, `lineage_root_id`-агрегация) или variation/новая contract version; work item из submitted package не удаляется — связывается через lineage. Проекция work_item `cancelled` (все assignments отменены, нулевой net performed) нетерминальна: позднее авторизованное assignment меняет проекцию.
   - Артефакт/ссылка: technical/state-transitions.csv (work_assignment *→cancel); docs/18 §4; docs/38 §7 (re-import lineage); technical/state-catalog.csv (work_item.cancelled definition).
   - Статус и владелец: Closed · Architecture

85. Can a completed assignment be reopened, and what happens to its previous completion receipt?
   - Ответ/решение: Нет: `completed` терминален (state-catalog terminal=true, валидатор запрещает исходящие переходы), reversal-метка перехода submit→complete — `new_assignment`: продолжение работы оформляется новым linked assignment на том же work item. Прежний completion receipt и вся история остаются immutable (completion_receipt — side effect перехода; append-only receipts/audit никогда не переписываются).
   - Артефакт/ссылка: technical/state-catalog.csv (work_assignment.completed); technical/state-transitions.csv (submit→complete, reversal=new_assignment); docs/38 §13 (recovery-state rule); scripts/validate_package.py (terminal check).
   - Статус и владелец: Closed · Architecture

86. What transitions are forbidden after package submission?
   - Ответ/решение: Submitted version immutable: изменение line/evidence/template возможно только новой package version; period reopen denied при submission/external-decision/acceptance/receivable/payment dependency (CA-016 + doc 18 §15); review-исправление заблокировано guard-ом no_package_claim/no_acceptance (REVIEW_CORRECTION_DOWNSTREAM_LOCKED — «use package or receivable correction workflow»); quantity sources зарезервированы против включения другим периодом; `submitted→withdrawn` guarded и не удаляет submission receipt; acceptance successor блокируется активными downstream money-фактами.
   - Артефакт/ссылка: docs/18 §9, §15; docs/38 §5, §8; technical/command-availability.csv CA-016; technical/error-catalog.csv REVIEW_CORRECTION_DOWNSTREAM_LOCKED; technical/state-transitions.csv (capture_session correct_review_decision guards).
   - Статус и владелец: Closed · Architecture

87. Can archived projects receive late external decisions or payments?
   - Ответ/решение: По design — нет: archived даёт только read_scoped/export (CA-002/003) плюс обработку уже принятых объектов (CA-007/010), а класс commercial_correction (CA-014) включает active|paused|completed, но не archived — поздние решения/платежи после archive невозможны, archive терминален без un-archive. Однако guard archive (`no_active_contract_or_open_close_or_export_job`) не проверяет открытые receivable/pending external decision, поэтому проект можно заархивировать с незакрытыми коммерческими фактами и «запереть» их (останется только новый linked project без переноса ledger).
   - Артефакт/ссылка: technical/command-availability.csv CA-002/003/014/017; technical/state-transitions.csv (project completed→archive guard); docs/18 §3, §15; docs/38 §12 (acceptance/downstream).
   - Обновление (закрыто фиксом 23.07.2026): guard archive дополнен no_open_receivable_or_pending_external_decision; doc 18 §2 note
   - Статус и владелец: Closed · Architecture

88. How are terminal and nonterminal states represented consistently across domain modules?
   - Ответ/решение: Единый канон: state-catalog.csv объявляет для всех 42 доменов / 261 состояния terminal boolean, storage_scope (server/device/projection) и ui_uk label; валидатор enforce-ит: терминал не имеет исходящих переходов, нетерминал обязан иметь recovery/forward-путь и co-reachability до терминала домена, recovery-метка обязана быть реальной командой или явным new aggregate/version. Расхождение enum между каталогом, SQL и OpenAPI блокирует merge/release (T-STATE-001 SPEC-BLOCKER).
   - Артефакт/ссылка: technical/state-catalog.csv; scripts/validate_package.py (terminal/co-reachability/reversal checks); docs/18 §15; docs/38 §13; docs/22 §1; technical/test-catalog.csv T-STATE-001.
   - Статус и владелец: Closed · Architecture

89. Does each UI action map to exactly one valid transition for the current version?
   - Ответ/решение: Да: ui-actions.csv (103 действия) отображает каждое действие на operation_id, permission_resource, transition_domain, audit_event и state_consequence; валидатор требует биекцию: «one mutation operation must map to exactly one normative action» + двусторонний closure-check (missing/extra). Привязка к текущей версии — обязательный If-Match со строгим ETag / exact expected version в каждом мутационном command; прототип-мёртвые кнопки устранены в v2.9 (changelog §6).
   - Артефакт/ссылка: technical/ui-actions.csv; scripts/validate_package.py (строки биекции ui-actions↔mutations); docs/22 §6 (If-Match/ETag); technical/test-catalog.csv T-SPEC-SEMANTIC-001; CHANGELOG §6.
   - Статус и владелец: Closed · Architecture

90. How are concurrent commands on the same aggregate serialized or rejected?
   - Ответ/решение: Optimistic concurrency: `version bigint` + strong ETag/If-Match → VERSION_CONFLICT с текущим safe representation; команды с expected parent/entity version. Money/allocation — нормативный алгоритм: PostgreSQL SERIALIZABLE, `SELECT … FOR UPDATE` в возрастающем UUID-порядке, пересчёт из immutable rows внутри транзакции, bounded retry с jitter, никакого частичного эффекта; idempotency: same key+hash replay, different hash → IDEMPOTENCY_CONFLICT; плюс «одновременно один active close operation на project/period» и serialized planned quantities per work-item/location.
   - Артефакт/ссылка: docs/18 §1, §9, §11 (normative allocation algorithm); docs/22 §6, §8; docs/38 §4, §10; technical/error-catalog.csv (VERSION_CONFLICT, IDEMPOTENCY_CONFLICT).
   - Статус и владелец: Closed · Architecture

91. What happens when a command succeeds but the client loses the response?
   - Ответ/решение: Повтор с тем же Idempotency-Key и request hash возвращает сохранённый оригинальный status/body (receipts персистятся с actor/tenant/operation/hash/response, классы standard_30d / ledger_400d, `Idempotency-Replay-Until` в ответе). За пределами HTTP-TTL дубликат всё равно невозможен: durable tenant-scoped `clientOperationId` у money/quantity/capture-команд, а replay batch-row «always returns the same assignment receipt even after HTTP idempotency expiry»; package decision set — resumable aggregate, mobile outbox переспрашивает server receipt (duplicate quantity operation → replay receipt).
   - Артефакт/ссылка: docs/22 §6, §8; docs/38 §4, §10; docs/23 §6 (conflict table); technical/schema.sql (`idempotency_records`, unique (organization_id, client_operation_id)).
   - Статус и владелец: Closed · Architecture

92. Can all transition failures be expressed with stable error codes and actionable messages?
   - Ответ/решение: Каждый из 295 переходов несёт error_code; error-catalog содержит 117 стабильных кодов с http_status/retryable/user_action/log_policy, wire-формат — единый Problem Details с обязательными code/requestId/retryable/fieldErrors и allowlisted details. Но часть кодов пока не привязана к производителям (операциям/переходам) — по changelog ~30 кодов остаются в каталоге без machine-binding (сценарии описаны только в flows); это известный открытый пункт отдельной итерации по error-модели.
   - Артефакт/ссылка: technical/error-catalog.csv (117 кодов); technical/state-transitions.csv (error_code column); docs/22 §7; CHANGELOG-AUDIT-FIX-20260723 «Не менялось (осознанно)».
   - Обновление (закрыто фиксом 23.07.2026): error-catalog.csv получил колонку producer для всех 118 кодов (pipeline/guard/policy/transition/operation); валидатор требует непустой producer
   - Статус и владелец: Closed · Architecture

93. Are derived states recalculated from source records or persisted, and how is drift detected?
   - Ответ/решение: Персистятся как кэш поверх immutable источников: work_item.status — server-maintained cache с монотонным projection version и projectionUpdatedAt, «a rebuild from immutable sources must match exactly»; readiness — snapshot с input_snapshot/input_hash/engine_version; ledger-проекции детерминированы и сверяются с ledger total. Drift ловится тестами (T-READY-002 «rebuild projection from ledger … rebuild matches», T-STATE-001 «rebuild projections») и runtime-мониторами: package total/hash reconciliation, entitlement/billing reconciliation, invariant alerts (zero loss/duplicate — «invariant alert»).
   - Артефакт/ссылка: docs/18 §4–5; docs/38 §2; technical/schema.sql (`readiness_snapshots`); technical/test-catalog.csv T-READY-002, T-STATE-001; docs/26 §3–4, §9 (reconciliation monitors).
   - Статус и владелец: Closed · Architecture

94. Can support personnel repair an invalid state without bypassing audit and tenant approval?
   - Ответ/решение: Да, только через контролируемый контур: support grant flow с tenant Owner/Admin approval (recent auth), MFA, видимым баннером, полным аудитом всех reads/actions, TTL/manual revoke; роль `aktflow_support` без standing grants — только approved functions под активным grant; «No direct SQL mutation as normal support tool» — исключительная DB-акция требует reviewed script, backup/invariant plan, dual approval и post-check; break-glass — только SEV1/2 с двумя платформенными аппруверами и оценкой уведомления tenant-а; audit append-only и не стираем. Repair-операции (retry/cancel safe job, webhook replay после авторизации tenant-а и т.д.) перечислены явно; API-операции support grants — GA-forward.
   - Артефакт/ссылка: docs/33 §2–5; docs/07 §2.1 (`aktflow_support`); technical/schema.sql (`support_access_grants`); docs/22 §5 (GA-forward support grants); technical/state-catalog.csv (support_grant).
   - Статус и владелец: Closed · Security

## 7. Review, approval, and correction


95. What is the difference between automated completeness, human review, approval, and legal acceptance?
   - Ответ/решение: Четыре слоя разделены явно. (1) Автоматическая полнота: worker-валидация typed evidence (`typed_evidence: received→validate`, guard `allowlisted_schema_and_required_original`) и readiness engine (`requirement: mark_met` только actor `readiness_engine`) — «configured completeness check, never truth/legal acceptance» (F21). (2) Human review — review_task/immutable review_decision внутреннего reviewer-а (approve/return с SoD-guard). (3) Внутренний approve/`ready_internal`/`internally_approved` — внутренняя готовность, которая по doc 24 §1 не означает договорную приёмку. (4) Legal acceptance — внешний слой с явной лестницей assurance из 5 уровней (workflow comment → operational acknowledgement → authenticated acceptance record → electronic signature → КЕП), append-only acceptance_records; КЕП только через validated provider (V-005), точная семантика приёмки — внешний gate V-002.
   - Артефакт/ссылка: docs/18 §6–7, §11; docs/24 §1, §8; docs/20 §23 (F21); technical/state-transitions.csv (typed_evidence, requirement, review_task, acceptance); docs/30 V-002/V-005.
   - Статус и владелец: Closed · Architecture

96. Can the same person capture and approve evidence, and is segregation of duties configurable?
   - Ответ/решение: По умолчанию нет: guard `sod_requirements_version_match`/`sod_reason_version_match` на `capture_session: pending_review→approve/return`, permissions.csv `review,decide` = «segregation of duties and exact version», `hold_point,decide` = «reviewer cannot decide own capture»; doc 18 §6 — «self-approval запрещён, если project segregation enabled». SoD конфигурируем на уровне project policies (doc 19 §6: `review_own_capture: default deny` и др.); solo-pilot exception допускает совмещение ролей, но каждый high-risk переход показывает conflict banner и пишет `solo_exception` reason в audit.
   - Артефакт/ссылка: docs/19 §6; docs/18 §6; technical/state-transitions.csv (capture_session approve/return, requirement_occurrence pass/fail); technical/permissions.csv (review,decide; hold_point,decide; review,correct); test T-REVIEW-CORRECTION-001 (SoD violation case).
   - Статус и владелец: Closed · Security

97. Which approvals require recent authentication or MFA step-up?
   - Ответ/решение: MFA обязателен для каждого live Pilot пользователя; recent-auth (≤10 минут) — канонический список doc 19 §7: ownership transfer, bank details, export-all, organization close, requirement waiver create/revoke, integration secret, support grant. Guard-ы переходов расширяют его: `correct_review_decision` (`recent_auth_window_open_…`), `period/period_close_cycle: reopen` (`recent_auth_no_submission_…`), `receivable: write_off` (`recent_auth_reason_and_adjustment`), `contract: reopen`, `export_job: authorize/cancel`, `deletion_job` cancel, `ownership_transfer: confirm_successor` (`recent_auth_mfa_not_expired`), offboarding consume; waiver-команды добавлены в канон v2.9 (docs 25/36 синхронизированы с guard-ами).
   - Артефакт/ссылка: docs/19 §7; docs/25 §46; docs/36 §20; technical/state-transitions.csv (строки 75, 95, 136–138, 274–277, 280, 290–293); technical/permissions.csv (review,correct; member_offboarding_plan,manage); CHANGELOG §2 «Waiver step-up».
   - Статус и владелец: Closed · Security

98. Can approval be limited by project, location, amount, work type, or customer?
   - Ответ/решение: Project/location — да: effective access = пересечение membership ∩ role ∩ project membership ∩ location scope (doc 19 §5); `review,decide`/`package,generate` scoped, `package,submit` — только explicit project grant. Сумма — частично: только variation `approve_internal` имеет guard `sod_and_value_scope`, а `record_and_reconcile_same_payment` — maker-checker threshold; лимита полномочий по сумме для review-решений и package submit нет. Ограничение полномочий по work type и по customer/counterparty не смоделировано вовсе (Pilot — один заказчик на проект).
   - Артефакт/ссылка: docs/19 §5–6; technical/permissions.csv (review,decide; package,submit; payment,reconcile); technical/state-transitions.csv (variation approve_internal `sod_and_value_scope`); docs/01 FR-08 (фильтры по amount ≠ полномочия).
   - Обновление (закрыто фиксом 23.07.2026): doc 19 §5 «Authority dimensions»: границы = scope+state; сумма — только variation approve и payment maker-checker; work-type/counterparty — no-build (doc 37)
   - Статус и владелец: Closed · Product

99. What exactly is frozen when an item is approved internally?
   - Ответ/решение: Approve создаёт immutable review_decision, связанный с точной версией цели (`target_server_version`), assurance level, actor, structured reason и lineage (`lineage_root_id`/`supersedes_decision_id`, ровно одна `is_current`); hold-решения дополнительно хранят occurrence version и evidence snapshot hash. Сами evidence/quantity уже immutable (append-only ledger, original object immutable). Изменение после approve возможно только через append-only correction receipt в коротком окне (`correct_review_decision`), и оно блокируется при downstream package/acceptance claim (`REVIEW_CORRECTION_DOWNSTREAM_LOCKED`).
   - Артефакт/ссылка: technical/schema.sql (review_decisions, review_decision_corrections); docs/38 §6; docs/18 §5–6, §15; technical/state-transitions.csv (строки 274–275); error-catalog REVIEW_CORRECTION_DOWNSTREAM_LOCKED.
   - Статус и владелец: Closed · Architecture

100. What happens when underlying evidence changes after approval?
   - Ответ/решение: Evidence не меняется in-place: исправление — это linked revision, проходящая свой lifecycle с `server_received`, с новым review-циклом. Привилегированная инвалидация (`invalidateEvidenceObject`, `typed_evidence: invalidate`) сохраняет оригинал/hash, пишет reason/version/actor, пересчитывает все связанные occurrences (`all_linked_occurrences_recomputed`), помечает зависимые evaluations stale и создаёт новую review/correction работу — историю не удаляет. Угроза после скана: `pending_review→quarantine`. Ранее сгенерированные package manifests никогда не пересчитываются; для затронутого пакета — новая версия.
   - Артефакт/ссылка: docs/18 §6; docs/20 §9 (F08), §23 (F21); technical/state-transitions.csv (typed_evidence invalidate; capture_session quarantine); technical/permissions.csv (evidence,invalidate); openapi invalidateEvidenceObject; events evidence_invalidated.
   - Статус и владелец: Closed · Architecture

101. Can reviewers request corrections at package, line, occurrence, evidence, or field level?
   - Ответ/решение: Да, четыре уровня — первоклассные цели correction issue: `package_decision_issues.target_type ∈ {package, package_line, requirement_occurrence, evidence_object}` (SQL CHECK), с severity/owner/due/exact version; doc 38 §8 нормативно допускает много типизированных issue на один финансовый исход строки. Внутренний review дополнительно даёт возврат capture с reason и scoped `evidence_request` на occurrence. Field-уровень намеренно решён в evidence-слое: typed-evidence валидация возвращает field codes (`TYPED_EVIDENCE_INVALID`, «field errors have path/code»), исправление — новая typed response/revision, а не отдельная issue-сущность.
   - Артефакт/ссылка: technical/schema.sql (package_decision_issues target_type CHECK); docs/38 §8; docs/20 §24 (F22); technical/permissions.csv (package_decision,record — internal_reviewer scoped); error-catalog TYPED_EVIDENCE_INVALID; openapi PackageLineDecisionBatchCreate.items.issues.
   - Статус и владелец: Closed · Architecture

102. Can one external return produce multiple normalized issues without losing the source response?
   - Ответ/решение: Да. Исходный ответ фиксируется как immutable source receipt в `package_decision_sets` (source_reference/actor_label/decided_at/reason/comment + `source_receipt_hash`, для external — FK на append-only `external_decisions`), а нормализация порождает любое число типизированных issue (`missing_line|duplicate_line|invalid_amount|unmatched_reference|unsupported_decision|total_mismatch|correction_required`) на пакет/строку/occurrence/evidence. Норматив: «No unmatched/duplicate/invalid source line is silently dropped».
   - Артефакт/ссылка: technical/schema.sql (package_decision_sets, package_decision_issues); docs/38 §2 п.5, §8; docs/20 §24; test T-PACKAGE-ISSUE-001; events package_decision_set_started/package_decision_issue_changed.
   - Статус и владелец: Closed · Architecture

103. How are duplicate, conflicting, or ambiguous external decisions handled?
   - Ответ/решение: Дубликаты режутся уникальностью: `unique (organization_id, client_operation_id)`, частичные unique-индексы на review/external источник и «один живой decision set на package version» (partial unique где state in pending_reconciliation/reconciled); повтор строк нормализуется в `duplicate_line` issue. Конфликт версий даёт `EXTERNAL_VERSION_CONFLICT`/`PACKAGE_VERSION_CONFLICT`; более новый авторитетный ответ идёт через `package_decision_set: supersede` — старый receipt сохраняется, его открытые issues автоматически `cancel` с guard `decision_set_superseded`. Неоднозначные строки становятся `unmatched_reference`/`unsupported_decision` issues и блокируют reconciliation до явного решения.
   - Артефакт/ссылка: technical/schema.sql (индексы package_decision_sets_current/review_source/external_source_uidx); technical/state-transitions.csv (package_decision_set supersede; package_decision_issue cancel); docs/20 §24 edges (duplicate receipt, decision after expiry); test T-PACKAGE-ISSUE-001.
   - Статус и владелец: Closed · Architecture

104. Can a correction issue be reassigned, split, merged, or reprioritized while preserving history?
   - Ответ/решение: Частично. Review-задачи — да: `reassignReviewTask` из open/assigned/in_review с immutable `review_task_reassignment_receipts` и пересчётом SLA; pending decision items редактируемы с optimistic versions до finalize (owner/due можно менять). Но у `package_decision_issues` нет команд update/reassign/split/merge/reprioritize: жизненный цикл только `open → resolved | cancelled`, severity задаётся при создании (в batch-схеме клиент её даже не передаёт), а замена owner-а возможна только через member offboarding plan (resource_type `package_decision_issue`). Минимальный фикс: append-only команда `updatePackageDecisionIssue` (owner/due/severity + expected version + receipt) либо зафиксировать split/merge как non-goal.
   - Артефакт/ссылка: technical/openapi.yaml (reassignReviewTask; resolvePackageDecisionIssue — единственная мутация issue); technical/schema.sql (package_decision_issues, review_task_reassignment_receipts, member_offboarding_* resource_type); technical/state-transitions.csv (review_task reassign; package_decision_issue).
   - Обновление (закрыто фиксом 23.07.2026): doc 38 §7: reassign — через offboarding resolution; split/merge — supersede новыми issues; severity не редактируется (append-only)
   - Статус и владелец: Closed · Architecture

105. What is required to mark a blocking issue resolved?
   - Ответ/решение: Явная append-only команда `resolvePackageDecisionIssue` c `clientOperationId`, `expectedVersion` и обязательной `resolutionNote`; guard перехода — `explicit_resolution_note_and_reconciliation_still_pending`; SQL CHECK требует одновременных `resolved_by/resolved_at/resolution_note`. Право — commercial/PTO/internal_reviewer/estimator/accountant scoped; любой открытый blocking issue не даёт финализировать reconciliation (`PACKAGE_DECISION_ISSUES_OPEN`, doc 18 §15: «reconciliation can finalize only when… no blocking issue remains»).
   - Артефакт/ссылка: technical/openapi.yaml (resolvePackageDecisionIssue, PackageDecisionIssueResolutionCommand); technical/schema.sql (CHECK на resolved); technical/state-transitions.csv (package_decision_issue resolve); technical/permissions.csv (package_decision_issue,resolve); error-catalog PACKAGE_DECISION_ISSUES_OPEN.
   - Статус и владелец: Closed · Architecture

106. Can a correction close automatically when new evidence is uploaded, or must a human verify it?
   - Ответ/решение: Загрузка сама по себе ничего не закрывает. Единственное «автоматическое» закрытие — server-derived `evidence_request: fulfill` (actor system) с guard `approved_linked_evidence_matches_requirement`, т.е. только после того, как человек-reviewer одобрил связанное evidence точной occurrence; создание request «never marks the requirement met». Failed occurrence возвращается в `capture_pending` на новой revision и проходит повторный human review; package decision items резолвятся только явной командой с привязкой новой package version (`new_package_version_links_correction`), issues — явной командой с note.
   - Артефакт/ссылка: technical/state-transitions.csv (evidence_request fulfill; requirement_occurrence start_correction; package_decision_item resolve); docs/20 §8 (F07); docs/38 §6; docs/18 §7 (Evidence request).
   - Статус и владелец: Closed · Architecture

107. How are SLA, due date, aging, escalation, and overdue ownership calculated?
   - Ответ/решение: Review: каждая задача хранит `sla_policy_version`, `opened_at/due_at`, priority и `escalation_owner_id`; «SLA is deterministic and pauses only for explicit terminal/quarantine/customer-wait states» (FR-08); просрочка — системный переход `expire` по `due_elapsed` с side effect `escalation_visible`; reassignment пересчитывает SLA (`reassignment_receipt_and_sla_recomputed`); T-REVIEW-SLA-001 проверяет warning/breach/idempotency и «one active owner». Деньги: `become_due/mark_overdue` — системные по `due_date_passed_with_balance`, календарь — immutable business_calendar snapshot из contract terms; correction issues обязаны иметь `correction_owner_id + correction_due_at`; ownership при офбординге переносится типизированной заменой reviewer/escalation/issue owner.
   - Артефакт/ссылка: docs/01 FR-08; technical/schema.sql (review_tasks, package_decision_issues, contract_term_versions.business_calendar_*); technical/state-transitions.csv (review_task expire/reassign; receivable become_due/mark_overdue); test T-REVIEW-SLA-001; docs/19 §8 (offboarding).
   - Статус и владелец: Closed · Architecture

108. Can a returned package version be corrected without modifying the submitted snapshot?
   - Ответ/решение: Да, только так: `returned` терминален для этой immutable версии, «correction creates a linked new package version»; submitted версия и её артефакты/hashes неизменяемы (data invariant 6). Новая версия ссылается на разрешаемые decision items через `resolved_by_package_version_id` (item переходит `correction_open → resolve` с guard `new_package_version_links_correction`), superseding-версия может переиспользовать источники предыдущей; compare показывает line/quantity/evidence/waiver/document различия.
   - Артефакт/ссылка: docs/18 §9; docs/22 §4 инвариант 6; technical/schema.sql (package_decision_items.resolved_by_package_version_id, package_line_quantity_sources.claim_state); technical/state-transitions.csv (package reconcile_returned; package_decision_item resolve); tests T-PACKAGE-DECISION-001/002.
   - Статус и владелец: Closed · Architecture

109. How are repeated returns linked so the system can learn recurring causes?
   - Ответ/решение: Сцепка данных есть: обязательные reason codes с versioned rejection taxonomy (FR-08), decision item → package_line → work_item (стабильный через lineage_root), цепочка версий через `resolved_by_package_version_id`, аналитика `review_returned.loop_count_bucket` и `package_returned.reason_code`, preset-отчёты «recurring blocker»/«rejection cause» (S23). Но обещание doc 00 «Rule set обучается на причинах возвратов (изменения подтверждает администратор)» не имеет специфицированного механизма: в реестре обещаний doc 37 и в API/данных нет фичи агрегирования возвратов в rule-предложения. Минимальный фикс: внести learning loop в doc 37 (release/контракт данных) или понизить формулировку doc 00 до отчётности.
   - Артефакт/ссылка: docs/01 FR-08, FR-11; technical/schema.sql (resolved_by_package_version_id); technical/events.csv (review_returned, package_returned); docs/04 S23; docs/00 п.9 vs docs/37 (отсутствует).
   - Обновление (закрыто фиксом 23.07.2026): doc 00 п.9 переписан: recurring-cause отчёты по reason codes, авто-обучения нет; no-build зафиксирован в doc 37
   - Статус и владелец: Closed · Product

## 8. Packages, exports, numbering, and submission


110. What exact source snapshot is captured when a package version is created?
   - Ответ/решение: `package_versions` фиксирует точные identity: contract_version_id, contract_term_version_id, numbering_series_id, template_version, adapter_key+adapter_version, `rule_snapshot_hash`, `snapshot_hash`, amount/currency. По строкам: `package_lines` c `readiness_snapshot` jsonb, `package_line_quantity_sources` (точные quantity_entry_id + included_quantity + source_snapshot_hash) и `package_line_evidence_sources` (evidence_object_id + sha256); waivers входят в запрос генерации и manifest. Readiness input snapshot включает engine version, contract/work item version, rule version, ledger cutoff, evidence/review IDs+hashes, waiver IDs, timestamp.
   - Артефакт/ссылка: technical/schema.sql (package_versions, package_lines, package_line_*_sources); docs/38 §8; docs/18 §7 (input snapshot), §9; openapi PackageGenerateRequest/PackageVersion.
   - Статус и владелец: Closed · Architecture

111. Can package generation be retried idempotently without allocating a new document number?
   - Ответ/решение: Да. Номер выделяется один раз атомарно при создании snapshot (до async generation); retry — переход `generation_failed → retry_generation` с guard `same_snapshot_or_explicit_new_version`, «retries replay the same number», и пользователю явно показывается, переиспользован ли snapshot. HTTP-уровень: `generatePackageVersion` идемпотентен (Idempotency-Key, class standard_30d, 202 Job). T-PACKAGE-NUMBER-001: «replay returns the same number».
   - Артефакт/ссылка: docs/38 §8; docs/18 §9; technical/state-transitions.csv (package retry_generation); technical/openapi.yaml (generatePackageVersion x-idempotency-class); docs/04 S20; test T-PACKAGE-NUMBER-001.
   - Статус и владелец: Closed · Architecture

112. How is numbering monotonicity preserved across failures, voids, terms changes, and concurrent users?
   - Ответ/решение: Сиквенс принадлежит server-owned стабильной `numbering_series` (не версии terms): создание snapshot «atomically locks the stable numbering-series row, allocates the next sequence» и пишет reservation receipt; «terms publication, retry, void, generation failure or supersession never resets or reuses a number»; формат серии immutable после первой резервации, terms выбирают серию, но не могут задать nextSequence (readOnly). Конкуренция сериализуется блокировкой строки серии + unique (series, sequence_no), (series, document_number), (organization_id, document_number); конфликт — retryable `NUMBERING_SERIES_CONFLICT`.
   - Артефакт/ссылка: docs/38 §8, §12; technical/schema.sql (numbering_series.next_sequence; package_versions/package_number_reservations unique-констрейнты); openapi NumberingSeries.nextSequence readOnly; error-catalog NUMBERING_SERIES_CONFLICT; tests T-PACKAGE-NUMBER-001, T-NUMBERING-SERIES-001.
   - Статус и владелец: Closed · Architecture

113. Can a consumed or voided number ever be reused?
   - Ответ/решение: Нет, никогда: «A consumed or voided number is never reused; retries replay the same number» (doc 18 §9) и «every issued/voided sequence remains non-reusable» (doc 38 §12). Механика: `package_number_reservations` со state `reserved|consumed|voided` и unique (series, sequence_no)/(series, document_number); retire серии замораживает sequence (`retirement_receipt_and_sequence_frozen`) и допустим только без active terms reference/reservation (`NUMBERING_SERIES_IN_USE`); UI S20 явно декларирует правило.
   - Артефакт/ссылка: docs/18 §9; docs/38 §12; technical/schema.sql (package_number_reservations); technical/state-transitions.csv (numbering_series retire); technical/permissions.csv (numbering_series,retire); docs/04 S20; tests T-PACKAGE-NUMBER-001/T-NUMBERING-SERIES-001.
   - Статус и владелец: Closed · Architecture

114. How are package line identities kept stable across corrected versions?
   - Ответ/решение: Идентичность строки — стабильный бизнес-ключ `unique (package_version_id, work_item_id)`: одна строка на work item в версии, и та же строка адресуется в новой версии тем же work item. Идентичность work item устойчива к re-import через acyclic lineage (`lineage_root_id`, one current head; агрегаты считаются по всей lineage). Кросс-версионная связь коррекций явная: `package_decision_items` привязан к точной `package_line_id` возвращённой версии и к `resolved_by_package_version_id` исправляющей; compare (S21) показывает изменения line/evidence/waiver/decision-item.
   - Артефакт/ссылка: technical/schema.sql (package_lines unique; package_decision_items unique (decision_set_id, package_line_id)); docs/38 §7 (re-import lineage), §8; docs/04 S21; openapi listPackageVersionLines/comparePackageVersions.
   - Статус и владелец: Closed · Architecture

115. Can one work quantity source be reserved by only one open package or period?
   - Ответ/решение: Да: «package inclusion is locked per quantity source across current packages» — superseding-версия может переиспользовать источники предшественницы, но другой период не может double-claim их (doc 38 §5); включение reservation-checked (doc 38 §8). В данных — `package_line_quantity_sources.claim_state ∈ {current, superseded}`; T-PERIOD-CLAIM-001 доказывает «one current quantity claim exists globally; superseding transaction releases then replaces it exactly once» плюс непересекающиеся периоды.
   - Артефакт/ссылка: docs/38 §5, §8; technical/schema.sql (package_line_quantity_sources.claim_state); test T-PERIOD-CLAIM-001; docs/18 §5 (package line хранит точные source entry links).
   - Статус и владелец: Closed · Architecture

116. What happens if package rendering fails after the snapshot and number are committed?
   - Ответ/решение: Версия переходит `generating → generation_failed` (worker, `terminal_or_retry_exhausted`) с `error_receipt_and_recovery`; SQL допускает отсутствие manifest только до `generated`. Восстановление: `retry_generation` на том же snapshot и с тем же номером, либо явная новая версия (пользователю показывается выбор); номер остаётся consumed и не переиспользуется. При падении адаптера: job падает с adapter/version/error code, «no partial artifact is marked ready», доступен generic evidence export, исправленный adapter даёт новую версию. `PACKAGE_GENERATION_FAILED` — 500 retryable.
   - Артефакт/ссылка: technical/state-transitions.csv (package generation_fail/retry_generation); technical/schema.sql (CHECK manifest per state); docs/32 §7; docs/18 §9; error-catalog PACKAGE_GENERATION_FAILED; tests T-JOB-002, T-PACKAGE-NUMBER-001.
   - Статус и владелец: Closed · Architecture

117. Can the user preview a package without creating a legally meaningful version?
   - Ответ/решение: Да. До какой-либо версии preflight-кокпит показывает performed/ready/held/excluded, include/exclude с причинами, blockers и точное numbering rule/version (`getPeriodPreflight`, уравнения `package amount = included_ready`); сгенерированная версия — внутренний draft: каждый артефакт несёт `draft/operational` label, перед mark ready есть redaction/PII preview, а юридический смысл возникает только при явной submission-записи (doc 24 §1: internal readiness ≠ приёмка). Осознанный trade-off: rendered-версия уже потребляет номер (allocation при snapshot; номер не переиспользуется) — это раскрыто в S20.
   - Артефакт/ссылка: docs/04 S19/S20; docs/38 §8 (preflight equations); openapi getPeriodPreflight/PeriodPreflight; docs/34 §4 (draft/operational label); docs/24 §1; docs/20 §11 (F10).
   - Статус и владелец: Closed · Architecture

118. Which exports are authoritative: PDF, XLSX, ZIP, JSON, or manifest?
   - Ответ/решение: Внутри системы authoritative — immutable snapshot + machine-readable manifest: все артефакты рендерятся из одного snapshot, каждый hash-bound (`sha256`, byte size, renderer_version, unique (package_version, kind, sha256)), manifest (application/json, собственный sha256, all-or-none tuple) связывает набор; «Generated PDF is accompanied by machine-readable JSON/XLSX when applicable». Юридический статус конкретного файла (draft / primary document / attachment / internal control) намеренно объявляется per customer adapter и подтверждается gate-ом V-001/doc 34 §6; каждый артефакт несёт adapter/rule/data version и draft/operational label.
   - Артефакт/ссылка: technical/schema.sql (package_versions.manifest_*, package_artifacts); docs/07 §122; docs/24 §7, §9 (package_artifact class); docs/34 §4, §6; docs/32 §2; test T-EXPORT-001 (manifest/hash labels reconstructible).
   - Статус и владелец: Closed · Architecture

119. Does every export include hashes and source/version references needed for later verification?
   - Ответ/решение: Да. Пакет: артефакты с sha256/byte_size/renderer_version, manifest c sha256, `snapshot_hash`/`rule_snapshot_hash`, adapter/template/terms/contract version IDs; источники строк запинены (`evidence_sha256`, `source_snapshot_hash`). Download grants возвращают sha256+byteSize и short-lived. Data-export: export job «captures query/filter/schema versions» (doc 22 §9), полный org export = JSON/CSV + original files + manifest/checksums (T-EXPORT-002: complete manifest and restoreability); норматив doc 34 §4 — каждый generated artifact несёт org/project/period, adapter/rule/data version, timestamp, hash/manifest.
   - Артефакт/ссылка: technical/schema.sql (package_artifacts, package_line_evidence_sources); openapi DownloadGrant/PackageVersion; docs/22 §9; docs/01 §228; docs/34 §4; tests T-EXPORT-001/002.
   - Статус и владелец: Closed · Architecture

120. How are customer-specific templates and country adapters versioned and tested?
   - Ответ/решение: Adapter — versioned immutable package (metadata, mappings, template DSL без executable code, calculation/rounding declarations, validation rules, submission metadata, retention/privacy policy, golden input/output fixtures с expected hashes/semantic values) c lifecycle `draft → validating → approved → published → deprecated → retired`; проект пинит версию, upgrade требует impact preview и подтверждения, submitted packages остаются на исходной версии. Тестирование: gate doc 34 §6 (golden fixtures, семантика полей/округлений, labels/claims с counsel/accountant, kill switch, prior-version reproducibility), T-ADAPTER-001 (ADAPTER-BLOCKER) и T-ADAPTER-002 (изоляция второго пака); unverified adapter — только sandbox с watермаркой «UNVERIFIED / NOT FOR SUBMISSION». Первый живой adapter — внешний gate V-001.
   - Артефакт/ссылка: docs/32 §2–§7; docs/34 §6; tests T-ADAPTER-001/002, T-PACK-002; docs/30 V-001.
   - Статус и владелец: Closed · Architecture

121. Can a historical package be re-rendered exactly after templates or fonts change?
   - Ответ/решение: История не перерендеривается — она хранится: артефакты immutable с sha256 под retention class `package_artifact`, поэтому точные байты доступны без рендера. Детерминизм гарантирован для идентичного кортежа snapshot/template/renderer (с embedded fonts): T-JOB-002 и T-PACK-002 требуют совпадения normalized hashes при retry; adapter gate п.7 требует протестированной «prior-version reproducibility» (T-ADAPTER-001: «prior package remains reproducible»). После изменения template/fonts исправленный adapter производит новую package version; auto-update «never silently changes… historical package».
   - Артефакт/ссылка: technical/schema.sql (package_artifacts immutable + retention_class); docs/32 §3, §6–7; docs/34 §6 п.7; docs/27 §60; tests T-JOB-002, T-PACK-002, T-ADAPTER-001; docs/13 §45 (fonts embedded).
   - Статус и владелец: Closed · Architecture

122. How is manual submission recorded without implying that AktFlow delivered the package?
   - Ответ/решение: `recordPackageSubmission` пишет только receipt факта, совершённого человеком: channel из enum `manual_email|customer_portal|paper|secure_link|other`, заявленный пользователем `submittedAt`, `recorded_by`, assurance по умолчанию `recorded_by_user`; «user remains final sender in Pilot; email auto-send deferred» (F11) и «Email auto-send… disabled by default» (doc 34 §4). T-SUBMIT-001 явно ассертит «no email sent by product; no legal acceptance claim»; границы заявлений — doc 24 §1.
   - Артефакт/ссылка: openapi recordPackageSubmission/SubmissionCreate; technical/schema.sql (package_submissions.assurance_level default 'recorded_by_user'); docs/20 §12; docs/34 §4; docs/24 §1; test T-SUBMIT-001.
   - Статус и владелец: Closed · Legal (external)

123. What evidence is required for a submission receipt, and can it be corrected?
   - Ответ/решение: Обязательны только channel + submittedAt + assuranceLevel; reference и recipientLabel опциональны, вложение-доказательство не требуется и не связывается, хотя retention class `package_artifact` прямо предусматривает «submission/decision attachment» (doc 24 §9) — в `package_submissions`/API связи нет. Исправить ошибочный receipt нельзя: единственная операция — recordPackageSubmission, у таблицы нет version/void/supersede, команды correction нет (doc 24 §5 требует «append context», механизм отсутствует). Плюс enum allowance `electronic_signature|qualified_signature` — пользовательская декларация без доказательства и без связи с V-005/КЕП gate. Минимальный фикс: attachment-link через upload intent, append-only void/correction receipt, ограничить уровни выше `recorded_by_user` до валидации V-005 или требовать proof reference.
   - Артефакт/ссылка: openapi SubmissionCreate/SubmissionReceipt; technical/schema.sql (package_submissions — нет CHECK на assurance, нет version); docs/24 §5, §8–9; docs/30 V-005; docs/04 S21 («status changes require evidence» — не форсируется контрактом).
   - Обновление (закрыто фиксом 23.07.2026): schema: package_submissions + supersedes_submission_id/attachment_evidence_object_id (композитные FK); doc 24 §1: append-only коррекция receipt
   - Статус и владелец: Closed · Architecture

124. Can submission be cancelled or voided after recording, and what remains immutable?
   - Ответ/решение: Да, отзыв возможен только как guarded `package: submitted → withdraw → withdrawn` (actor authorized_submitter, guard `withdrawal_allowed`) с side effect `receipt_preserved`: «withdraw не удаляет submission receipt». Неизменными остаются: submission receipt, сам submitted package version, его snapshot/артефакты/hash-и и потреблённый номер; период после submission нельзя reopen (`recent_auth…no_submission…` guard, `PERIOD_REOPEN_DENIED`) — исправление идёт только новой package version.
   - Артефакт/ссылка: technical/state-transitions.csv (package withdraw; period/period_close_cycle reopen guards); docs/18 §9; docs/04 S19 (reopen блокируется submission dependency); error-catalog PERIOD_REOPEN_DENIED; test T-PERIOD-REOPEN-001.
   - Статус и владелец: Closed · Architecture

125. How are partial external responses reconciled without silently accepting missing lines?
   - Ответ/решение: Частичные сохранения инертны: pending items с optimistic versions «have no package/readiness/correction effect», set остаётся `pending_reconciliation`. Финализация — одна и атомарная: guard `complete_balanced_line_decision_set` / `all_exact_lines_present_and_server_totals_balance` требует ровно одного результата на каждую включённую строку; отсутствующие строки становятся `missing_line` blocking issues и не дают reconcile (`PACKAGE_DECISION_ISSUES_OPEN`); totals только server-derived, SQL CHECK при reconciliation: `submitted_total = decided_total + returned_total`, иначе `PACKAGE_DECISION_UNBALANCED`. Пакет не может стать returned/accepted до полного покрытия (исключение — только exact authenticated external full acceptance, атомарно материализующий все accepted строки); return никогда не имеет package-only shortcut.
   - Артефакт/ссылка: docs/38 §2 п.5, §8; technical/state-transitions.csv (package_decision_set reconcile; package record_aggregate_response/reconcile_*); technical/schema.sql (CHECK totals в package_decision_sets); error-catalog PACKAGE_DECISION_UNBALANCED/PACKAGE_DECISION_ISSUES_OPEN; tests T-PACKAGE-DECISION-001/002, T-PACKAGE-ISSUE-001.
   - Статус и владелец: Closed · Architecture

## 9. Offline-first mobile behavior


126. Which field actions must work fully offline, and which are explicitly unavailable?
   - Ответ/решение: Полностью offline работают: локальный capture-сеанс по уже выданному bundle (фото/галерея по правилу, typed-формы, аннотация, выбор occurrence), ввод quantity (`progress`/`correction`/`reversal`), draft review/submit с атомарной записью в outbox и durable local receipt («Збережено на пристрої»), просмотр очереди/фиксаций/назначений из локального кэша. Явно недоступны offline: accept/start назначения (Pilot требует online accept→start handshake до выдачи bundle; «Offline accept/start chaining is not supported»), выдача нового lease/bundle, review-решения, relink subject-tuple после первого server receipt и все server-only действия — они «disabled with reason» под amber-баром. Новая field-авторизация вне валидного lease запрещена классом CA-909 (deny, lease_effect=`invalidate`).
   - Артефакт/ссылка: docs/23 §3–4, §9; docs/38 §4; docs/04 (строка «Offline: persistent amber bar…», S24–S28); openapi `issueWorkAssignmentExecutionBundle` (description); technical/command-availability.csv CA-009/CA-011/CA-909.
   - Статус и владелец: Closed · Architecture

127. What exact data is included in an offline execution bundle?
   - Ответ/решение: Схема `AssignmentExecutionBundle` (required, additionalProperties:false): `assignment`, `occurrences` (≤500), `formSchemas` (schemaKey/schemaVersion/formKind/jsonSchema, ≤100), `referenceMetadata` (≤500), `authorizationLease`, `bundleHash` (sha-256), `syncCursor`, `generatedAt`. Lease в свою очередь фиксирует organization/subscription/project/contract/membership/assignment versions, authorized_user_id, policy_version, authorization_context_hash, bundle_hash, lease_hash, issued_at, valid_until (schema.sql `offline_authorization_leases`). Выдача идемпотентна: replay возвращает тот же lease.
   - Артефакт/ссылка: technical/openapi.yaml `AssignmentExecutionBundle` (~20346) и `issueWorkAssignmentExecutionBundle` (~8325); technical/schema.sql `offline_authorization_leases` (606–632); docs/23 §4 п.2.
   - Статус и владелец: Closed · Architecture

128. How is a server-issued lease validated without trusting device time?
   - Ответ/решение: Авторитет — только server-issued bounded lease с server issue time/expiry и хэшами контекста; при первом server receipt проверяются точные версии всех родителей: CA-009 — «All signed parent versions and server validity must still match at first receipt». Доктрина хронологии (doc 23 §12): server-верифицируем только факт durable receipt до инвалидации; device time — untrusted input, «local timestamps cannot extend it». Тест-матрица включает clock ±24h и deliberate rollback/forward («authorization result must not change»), T-OFFLINE-AUTH-001 прямо требует «device time is never sufficient».
   - Артефакт/ссылка: docs/23 §4 п.2, §9, §11, §12; docs/38 §9; technical/command-availability.csv CA-009 (`lease_effect=retain`); test-catalog T-OFFLINE-AUTH-001.
   - Статус и владелец: Closed · Security

129. What events invalidate a lease, and how quickly does the device learn about invalidation?
   - Ответ/решение: Полный реестр инвалидации: assignment change/cancel/complete/reassign, membership suspend/revoke/scope change, project pause/complete/archive, contract complete/terminate, organization/subscription grace/suspension/cancellation/closure — всё «invalidate affected leases in the same transaction»; в CA-политике это lease_effect `invalidate` (CA-001/CA-017/CA-905/908/909/910/915), `invalidate_actor` (CA-006), `invalidate_if_auth_changes` (CA-005), `invalidate_if_parent_version_changes` (CA-012). Устройство узнаёт при следующем контакте с сетью (sync phase 1: «refresh auth and membership version when network exists»); push-гарантий нет и они не нужны для безопасности — enforcement-точка это server receipt, а SRE-алерт ловит «any parent change that leaves a matching active lease».
   - Артефакт/ссылка: docs/23 §4 п.1, §9; docs/38 §9; technical/command-availability.csv (колонка lease_effect); state-transitions (post-actions `…invalidate_leases`); docs/26 §(строка 144); T-LEASE-PARENT-001.
   - Статус и владелец: Closed · Security

130. What happens to already captured but not uploaded evidence after lease expiry or membership revocation?
   - Ответ/решение: Обычная загрузка отклоняется (revoked membership — терминальный исход retry c «support/export-of-own-draft path»); локальный draft сохраняется «for the defined recovery window» и не удаляется. Первый receipt после инвалидации по CA-010 получает decision=`quarantine`, lease_effect=`invalidate` («Server cannot infer that unseen bytes existed before invalidation»), disposition `first_seen_after_invalidation` жёстко связан CHECK-ом со state=`quarantined`; выход — только независимое решение Security Admin (`approve_authorization_recovery`→server_received/scan или `reject_authorization_recovery`→terminal_failed), без назначения accounting date. Конкретная длительность recovery window — в классах retention под внешним гейтом V-003.
   - Артефакт/ссылка: docs/23 §5, §6 («membership revoked»), §12; CA-010; schema.sql capture_sessions CHECK (660–663) + `capture_authorization_resolutions`; state-transitions 272–273; data-retention-catalog (capture_authorization_resolutions, V-003); T-OFFLINE-REVOKE-001.
   - Статус и владелец: Closed · Security

131. Can first-seen offline capture be accepted during organization suspension, and under what policy?
   - Ответ/решение: Нет — как нормальная фиксация не принимается. CA-009 (allow, `retain`) разрешает first_seen только при org `trial|active`, subscription `pilot|trialing|active|grace`, project/contract `active`, work_phase `lease_valid`; suspension организации/подписки транзакционно инвалидирует lease, поэтому первый receipt попадает в CA-010: decision=`quarantine`, lease_effect=`invalidate` — карантин под независимый Security-Admin recovery, а не тихий reject и не приём. Политика suspension подтверждена doc 21 §6: «capture/upload/new generation are blocked», при этом read/export/pay/cancel/close/support остаются.
   - Артефакт/ссылка: technical/command-availability.csv CA-009/CA-010/CA-908; docs/23 §6, §9, §12; docs/21 §6; state-transitions `organization active→suspend` (post: `…invalidate_leases`); T-OFFLINE-REVOKE-001, T-LEASE-PARENT-001.
   - Статус и владелец: Closed · Security

132. How are outbox commands ordered and replayed after reconnect?
   - Ответ/решение: Каждое действие пользователя коммитит доменную запись и outbox-операцию в одной SQLite-транзакции; «Sync engine sends operations in causal order with idempotency key», сервер валидирует base version и возвращает канонический receipt/версию. Фазы reconnect фиксированы (refresh auth/membership → идемпотентная выдача bundle → upload intents/parts → атомарный manifest submit тем же clientOperationId); replay дубликата возвращает прежний server receipt, «retry does not create new quantity entry». Outbox наблюдаем: age, attempts, last code, dead-letter state; фоновый sync best-effort, открытие приложения всегда явно возобновляет.
   - Артефакт/ссылка: docs/07 §5 (Write protocol п.1–5, Outbox observable); docs/23 §3, §4, §5; docs/38 §10.
   - Статус и владелец: Closed · Architecture

133. How are duplicate uploads and duplicate command submissions deduplicated?
   - Ответ/решение: Один стабильный `clientOperationId` на capture; в БД `unique (organization_id, client_operation_id)` на capture_sessions делает повторный submit идемпотентным replay-ом. Upload intent immutable: «neither multipart retry nor completion may change purpose, capture, object key, declared type, expected size, hash or retention class; an expired/cancelled/sealed intent cannot be reused»; completion атомарно `authorized → sealed`. HTTP-идемпотентность персистится (actor/tenant/operation/request hash/response), money/quantity-команды имеют durable domain operation IDs; «duplicate quantity operation → replay server receipt», тест-матрица требует «server replay proves one quantity/evidence manifest».
   - Артефакт/ссылка: docs/23 §3–§7, §11; schema.sql capture_sessions (657); docs/38 §10; docs/07 §5 (Conflicts).
   - Статус и владелец: Closed · Architecture

134. What happens when two devices complete or edit the same assignment offline?
   - Ответ/решение: Правило конфликтов doc 23 §6: «same draft edited on two devices → keep both local revisions; association may change only before either draft is submitted» — каждый submit создаёт отдельную immutable capture session со своим clientOperationId. Lifecycle-переходы назначения (accept/start/complete) — только online exact-version команды, поэтому второй девайс получает 409 explicit conflict object; «submitted/approved records cannot be overwritten by stale mobile state; clock is never used as sole winner», «server already decided → create correction/revision, never overwrite decision».
   - Артефакт/ссылка: docs/23 §5 (409), §6; docs/07 §5 (Conflicts); docs/38 §2 (CaptureSession — one immutable submission attempt), §4 (online accept→start).
   - Статус и владелец: Closed · Architecture

135. How are conflicts surfaced to the worker without requiring domain expertise?
   - Ответ/решение: Очередь S28 показывает простые статусы queued/uploading/server-confirmed/failed/conflict с безопасным retry и просмотром ошибки; разрешение сравнивает local/server версии, «destructive resolution requires explicit choice». Коды переводятся в действия: 422 «names field/rule correction», 413 предлагает compression/split, malware reject «explains safe recapture», rule-конфликт «show delta». Карантин показан карточкой на человеческом языке — «У карантині — авторизацію інвалідовано» с указанием, что решение за Security Admin (добавлено фиксом 23.07, реально присутствует в прототипе Field.jsx:100).
   - Артефакт/ссылка: docs/04 S28 (строка 267) и строка 43; docs/23 §5, §6; prototype/src/pages/Field.jsx:100; CHANGELOG-AUDIT-FIX §6; error-catalog.csv.
   - Статус и владелец: Closed · Design

136. Can the user safely log out or change account while unsynced work exists?
   - Ответ/решение: Да, но только осознанно: «logout with unsynced drafts warns and requires keep/sync/discard authorization» (doc 23 §9); смена/потеря идентичности покрыта требованием MOB-STORAGE «protected draft lifecycle and identity-change handling». При revoked membership остаётся support/export-of-own-draft путь, так что несинхронизированная работа не теряется молча.
   - Артефакт/ссылка: docs/23 §5, §9; technical/mobile-security-profile.csv MOB-STORAGE, MOB-AUTH; test-catalog T-OFFBOARD-001 (offline queue при revoke).
   - Статус и владелец: Closed · Security

137. How is device storage encryption and local data retention handled?
   - Ответ/решение: Решение зафиксировано, но шифрование сознательно отложено: Pilot полагается на OS app sandbox/file encryption «only after documented device risk acceptance», а «GA security gate evaluates encrypted SQLite/file vault»; app lock/biometric — опциональная политика, не замена server authorization; секреты только в OS secure storage, «no auth token or secrets in SQLite logs/analytics». Локальная retention: media компактится «only after retention/cache rule permits», low-storage cleanup только confirmed cached files, drafts живут recovery window; сами длительности классов — внешний гейт V-003. Документ device risk acceptance в пакете отсутствует, MOB-STORAGE имеет статус `specified_no_runtime_evidence` / PILOT-BLOCKER.
   - Артефакт/ссылка: docs/23 §2, §4 п.9, §9; technical/mobile-security-profile.csv MOB-STORAGE/MOB-CRYPTO; data-retention-catalog (V-003); docs/30 V-003, V-009.
   - Статус и владелец: Deferred with gate (GA security gate doc 23 §2; MOB-STORAGE PILOT-BLOCKER; сроки — V-003) · Security

138. What happens when an upload is partially complete and the app is killed or updated?
   - Ответ/решение: Upload — resumable multipart с checksum/retry; состояние upload персистится в SQLite, машина `mobile_capture` держит `uploading` до `confirm_server`/`terminal_fail`, а из `failed_terminal` есть явный retry (`local_record_intact_identity_authorized_and_retry_confirmed`). Immutable intent гарантирует, что докачка не может изменить key/hash/size; тест-матрица требует «app kill and device restart after every local/server boundary» и «multipart part corruption»; обновление приложения обязано сохранять «outbox compatibility for at least one supported prior version».
   - Артефакт/ссылка: docs/23 §4 п.5–6, §7, §9, §11; state-transitions mobile_capture (63–66, 213); MOB-NETWORK («retry never duplicates commands»).
   - Статус и владелец: Closed · Architecture

139. How are schema and rule-version changes handled by an outdated mobile app?
   - Ответ/решение: Локальная схема версионируется с миграциями, «failed migration enters safe recovery/export-support mode»; bundle пиннит rule snapshots/policy_version, конфликт «contract/rule version changed» разрешается «evaluate against captured snapshot and current rule; show delta», сценарий «contract/rule update while offline» в тест-матрице; outbox совместим минимум с одной предыдущей поддерживаемой версией. Пробел: в пакете нет server-side минимальной версии клиента/force-upgrade механизма (grep по openapi/docs не находит app-version guard) — «supported prior version» подразумевает политику поддержки, но её enforcement не специфицирован.
   - Артефакт/ссылка: docs/23 §2, §6, §9, §11; openapi `AssignmentExecutionBundle.formSchemas.schemaVersion`; отсутствие: openapi/docs (нет min-app-version/forced upgrade).
   - Обновление (закрыто фиксом 23.07.2026): doc 22 §11 + doc 23 §9: version handshake (X-Min-Client-Version, 426 CLIENT_VERSION_UNSUPPORTED, safe mode с выгрузкой outbox)
   - Статус и владелец: Closed · Architecture

140. Can remote wipe or revoke-all prevent future access while preserving unsynced evidence for review?
   - Ответ/решение: Да в серверной части и честно ограничено в клиентской: «remote revoke stops future sync but cannot erase offline device reliably; disclose limitation»; revoke-all sessions и session inventory входят в auth-контролы (с оговоркой doc 38 §11 — гарантируется в объёме возможностей identity-провайдера). Device-lost flow «revokes sessions and flags pending operation IDs»; несинхронизированные drafts сохраняются локально на recovery window, а их первый receipt после revoke идёт в карантин на независимый Security-Admin review (CA-010), т.е. evidence сохраняется для разбора, не получая авторитета.
   - Артефакт/ссылка: docs/23 §6, §9; docs/19 §7; docs/38 §11; CA-006 (`invalidate_actor`)/CA-010; docs/25 §3 (mobile loss → device-loss drill).
   - Статус и владелец: Closed · Security

141. What telemetry is available for sync failure, retry age, and permanently blocked outbox items?
   - Ответ/решение: Метрики без чувствительного payload: «outbox depth/age, upload retry count, receipt latency, conflict/error codes, app/version/device-class buckets»; события `capture_saved_local`, `capture_sync_failed` (error_code, attempt_bucket, outbox_age_bucket), `sync_conflict_detected`, `assignment_execution_bundle_issued`. Постоянно заблокированные элементы видимы через dead-letter state outbox-а и терминальные состояния (`failed_terminal`); SRE-профиль держит SLO «mobile outbox no data loss/duplication — zero; invariant alert» и дашборд «outbox confirmation latency/conflicts». Запрещено отправлять фото/имена файлов/точный GPS/описания работ/деньги в аналитику.
   - Артефакт/ссылка: docs/23 §10; technical/events.csv (30–33, 108); docs/07 §5 («Outbox is observable…»); docs/26 (SLO 28, 44).
   - Статус и владелец: Closed · SRE

## 10. Identity, roles, permissions, and tenancy


142. Is every read and write authorized by organization, project, location, role, entitlement, and lifecycle state?
   - Ответ/решение: Да, тремя одновременными барьерами (surface exposure, grants, RLS/command authorization): effective access = «active organization membership ∩ role permissions ∩ overrides ∩ project membership ∩ location scope ∩ field assignment ∩ entity state ∩ entitlement»; базовая RLS-семья `org_role_project_location_state` добавляет к row-предикату «permission action, object state, entitlement, deny override, SoD and optimistic version». Состояния родителей закрыты отдельной политикой: даже чтение проходит CA-002 — «Read remains permission and scope filtered; suspended and closing are not authorization bypasses». Runtime-доказательство (grant/policy report) — отдельный PILOT-BLOCKER (doc 35 §10), тест-контракт T-RLS-001 покрывает матрицу.
   - Артефакт/ссылка: docs/19 §5; docs/35 §1, §5, §10; docs/07 §2.1; technical/command-availability.csv CA-002; test-catalog T-RLS-001.
   - Статус и владелец: Closed · Security

143. Does an empty project scope always mean no access rather than all access?
   - Ответ/решение: Да: «empty project scope means `none`, except organization-wide roles explicitly marked `all_projects`» (doc 19 §5) и «Empty project scope means no project access» (doc 38 §9); `all_projects` — явный boolean в memberships/invitations (default false), а не вывод из пустого списка. Негативные тесты обязаны включать «correct organization/wrong project» (doc 35 §9).
   - Артефакт/ссылка: docs/19 §5, §8; docs/38 §9; schema.sql memberships/invitations (`all_projects boolean not null default false`); docs/35 §9; T-RLS-001.
   - Статус и владелец: Closed · Security

144. Are all current and future locations covered only when all_locations is explicitly true?
   - Ответ/решение: На уровне контракта — да: «`all_locations=true` means all current/future locations; otherwise explicit location rows are required»; API `ProjectAccessScope` требует `allLocations` как обязательное поле (allLocations=true ⇒ locationIds пуст; false ⇒ minItems 1), location-scope обязан принадлежать разрешённому проекту. Нюанс на DB-слое: `membership_project_scopes.all_locations boolean not null default true` — raw INSERT без колонки молча даёт самый широкий location-доступ, что расходится с духом «explicit boolean» (все записи идут через BFF, но это ослабляет defense-in-depth). Минимальный фикс: default false/без default.
   - Артефакт/ссылка: docs/38 §9; docs/19 §8; openapi `ProjectAccessScope` (~12882); schema.sql `membership_project_scopes` (default true).
   - Обновление (закрыто фиксом 23.07.2026): schema: all_locations default false в обеих scope-таблицах (explicit-grant defense-in-depth)
   - Статус и владелец: Closed · Security

145. Can a user hold different roles in different projects?
   - Ответ/решение: Нет — это осознанное решение модели: роль одна на membership организации (`memberships.role`, unique(organization_id, user_id)), таблицы project/location-scope не несут роли; дифференциация внутри организации достигается project/location scope и field assignment, а не сменой роли. Разные роли возможны только в разных tenants («Пользователь может состоять в нескольких tenants»); per-project role/team-агрегаты — GA-forward (`team/crew: GA-forward assignment grouping only»).
   - Артефакт/ссылка: schema.sql memberships (49–61), membership_project_scopes/membership_location_scopes; docs/19 §1, §2, §5; permissions.csv (роль-колонки без project-варианта).
   - Статус и владелец: Closed · Architecture

146. Can organization roles and project roles conflict, and which rule wins?
   - Ответ/решение: Конфликт «роль vs роль» невозможен по построению — роль одна; конфликт разрешается пересечением: эффективный доступ — intersection всех измерений, «deny overrides allow», org-wide действие требует явного `all_projects`, «archive/closed state removes mutations even when role allows», плюс SoD-политики (`review_own_capture` deny и т.д.) и membership permission overrides. То есть всегда побеждает более узкое/запрещающее правило.
   - Артефакт/ссылка: docs/19 §5, §6; docs/35 §5 (deny override в mutation additions); permissions.csv (scope_or_condition).
   - Статус и владелец: Closed · Security

147. How is owner transfer protected from accidental or unilateral execution?
   - Ответ/решение: Только двухпартийная машина `ownership_transfer`: successor подтверждает с guard `recent_auth_mfa_not_expired`, complete выполняет system с guard `owner_and_successor_versions_unchanged` (атомарный role swap + session refresh); из `requested` и `successor_confirmed` доступны `cancel` (current_owner_or_security, `recent_auth_and_not_confirmed` / `recent_auth_and_not_completed`) и `expire` (TTL) — гонка cancel/complete выразима (фикс 23.07). `owner` не назначается приглашением/патчем, `final_owner_remove: deny`, recent auth ≤10 мин для ownership; T-OWNERSHIP-001 требует «no support bypass».
   - Артефакт/ссылка: state-transitions 29–34; docs/19 §6, §7, §8; docs/38 §9 («Owner change uses only the two-party ownership-transfer command»); permissions.csv organization,transfer_ownership; test-catalog T-OWNERSHIP-001; CHANGELOG §2.
   - Статус и владелец: Closed · Security

148. Can ordinary invitations ever create an owner or privileged support user?
   - Ответ/решение: Нет. DB-контракт: `invitations.role` CHECK перечисляет 12 ролей без `owner`; нормативно «`owner` is never assignable through invitation or ordinary membership update», SoD `invite_role_higher_than_self: deny`. Платформенные/support роли — отдельная плоскость: «Platform staff roles do not become tenant memberships», support impersonation запрещена по умолчанию, `SaaS Billing Operator … never derives authority from tenant membership».
   - Артефакт/ссылка: schema.sql invitations (role CHECK); docs/19 §6, §8, §2, §4; docs/38 §9; docs/33 §1.
   - Статус и владелец: Closed · Security

149. What happens to assigned work, reviews, issues, leases, and integrations during member offboarding?
   - Ответ/решение: Немедленный suspend + revoke sessions/invites, затем один персистентный организационный план (Owner/Org Admin/Security Admin), cursor-scan перечисляет «assignments, review assignee and escalation ownership, evidence requests, package issues/corrections, approval responsibilities, integration operational owner, live offline leases and project scopes across every project»; типизированные exact-version резолюции (assignment replacement + post-invalidation policy, reviewer/escalation replacement, request/issue owner, integration transfer, lease invalidation, scope removal/block). Consume атомарен: transfers + membership-version + lease/session invalidation + notifications + audit; «preserve historical authorship and system-owned running jobs»; итог — access-change receipt в следующий access review.
   - Артефакт/ссылка: docs/19 §8 (шаги 1–9); docs/38 §9; state-transitions member_offboarding_plan (281–287) и membership 22–25 (post: `…invalidate_actor_leases`); CA-006 (`invalidate_actor`).
   - Статус и владелец: Closed · Security

150. Can offboarding process every dependency without truncation or an arbitrary row limit?
   - Ответ/решение: Да: план — resumable cursor scan с сохранением резолюций «in bounded batches», consume «without a 500-item correctness limit», нормативно «It does not truncate at 500»; preview замораживает dependency hash и инвалидируется дрейфом версий; `block_revoke` — представимый безопасный стоп. Тесты: T-OFFBOARD-SCALE-001 (>1000 mixed responsibilities, «No truncation or oversized request dependency»), T-OFFBOARD-MULTI-001 (scan 501 resources в bounded pages).
   - Артефакт/ссылка: docs/19 §8 п.4–7; docs/38 §9, §15 (offboarding authority/scale); test-catalog T-OFFBOARD-SCALE-001, T-OFFBOARD-MULTI-001; state-transitions 281–287 (guard `all_cursors_exhausted_and_dependency_hash_fixed`, `exact_plan_preview_hash_and_membership_version`).
   - Статус и владелец: Closed · Security

151. Can project managers remove only the scopes they administer without revoking organization membership?
   - Ответ/решение: Да, это отдельная least-privilege команда: «PTO/Project Manager receives a separate … command that removes one project scope they administer after its dependency plan passes; it cannot change the global role, other projects, `all_projects` membership or final owner»; org-wide suspend/revoke/scope-replacement «are never project-scoped powers» (только Owner/Org Admin/Security Admin). В permissions.csv `member_project_scope,remove`: pto_manager/project_manager = `scoped` («may remove only an explicitly scoped project after dependency preview»); в API — `removeMembershipProjectScope`; проверяется T-OFFBOARD-SCALE-001 («project manager cannot globally revoke and can remove only owned project scope»).
   - Артефакт/ссылка: docs/19 §8 (последний абзац); docs/38 §9; permissions.csv строка 75; openapi `removeMembershipProjectScope` (~10797); T-OFFBOARD-SCALE-001.
   - Статус и владелец: Closed · Security

152. Are support sessions metadata-only by default, with tenant-approved time-bound escalation?
   - Ответ/решение: Да: без grant support видит только safe metadata (org ID/статус, план, версии, счётчики job/error, correlation ID; «No evidence thumbnails, filenames, work descriptions, free text…»); эскалация — case → scope/actions/duration → одобрение tenant Owner/Admin с recent auth → MFA staff → видимый banner → полный audit → revoke/expiry (машина support_grant: approve guard `recent_auth_scope_ttl`, revoke/expire). SoD `support_grant_self_approve: deny`; DB-роль `aktflow_support` — «no table grants; approved functions under grant», GA-plane; для Pilot content access вообще disabled до валидации V-012.
   - Артефакт/ссылка: docs/33 §2, §3; docs/19 §4, §6; docs/35 §3, §5 (`active_time_bound_grant`); state-transitions support_grant (214–216); docs/30 V-012.
   - Статус и владелец: Closed · Security

153. How are break-glass actions approved, logged, notified, and reviewed?
   - Ответ/решение: Break-glass допустим только для SEV1/2 containment, когда tenant approval невозможен и contract/policy позволяет; требует «two platform approvers, narrow scope/TTL, security case, real-time alert, session recording where lawful/feasible, immediate review and tenant notification assessment. Cannot erase audit». Break-glass входит в перечень security events (append-only audit), SoD верификации: «The same person may not both approve a high-risk support break-glass event and close its retrospective review»; `service_role` — «migrations and declared break-glass only».
   - Артефакт/ссылка: docs/33 §4; docs/25 §3 (insider/support abuse), §8; docs/36 §5; docs/19 §4 (Break-glass Admin: dual approval); docs/07 §2.1.
   - Статус и владелец: Closed · Security

154. Do runtime database roles lack BYPASSRLS and use verified transaction-local context?
   - Ответ/решение: Да: все runtime-роли (`authenticated`, `aktflow_app`, `aktflow_worker`, `aktflow_external`, `aktflow_audit_writer`, `aktflow_platform_billing`, `aktflow_support`) — BYPASSRLS=no; группы «NOLOGIN/NOBYPASSRLS» (комментарий schema.sql:3349), `service_role` запрещён в normal runtime, «service/runtime use of a bypass-RLS credential» — non-waivable. Контекст — только транзакционный: server-side валидация bearer, `SET LOCAL ROLE aktflow_app`, actor/membership-version/org/request через «reviewed gateway helper»; «Session-level tenant variables are prohibited», пул не переносит контекст. CI падает при BYPASSRLS у runtime-роли; grants/role membership диффятся в release evidence.
   - Артефакт/ссылка: docs/35 §3, §4, §8; docs/07 §2.1; schema.sql:3349; docs/36 §4 (no-waiver); RLS-семья `request_actor_context` (docs/35 §5); T-SCHEMA-001.
   - Статус и владелец: Closed · Security

155. Is direct client Data API access limited to an explicit reviewed allowlist?
   - Ответ/решение: Да: канонический allowlist — data-access-surface.csv (159 строк; отсутствие = запрет); единственная client-exposed строка — DA-001 `api.project_list` (security_invoker view, RLS по организации и project scope), «`public`… не публикуются», `anon` без tenant grants. Новая таблица не публикуется автоматически; изменение exposed schemas — security-sensitive change с ADR и повторным IDOR/RLS suite; CI падает при exposed `public`/anon-привилегиях/не-security_invoker view.
   - Артефакт/ссылка: docs/35 §2, §8; technical/data-access-surface.csv DA-001 (единственный client_exposed=true); docs/07 §2 («public schema is not an exposed Data API schema»); docs/25 §2.
   - Статус и владелец: Closed · Security

156. Can any API response, export, log, job, or object-storage path leak another tenant's data?
   - Ответ/решение: По дизайну — нет, каждый канал закрыт отдельно: API — explicit org context, composite tenant FKs `(organization_id, project_id, id)`, not-found semantics; export — «export never broadens source row access» + обязательные integrity/expiry-метаданные; логи — structured allowlist/redaction, «no tokens/free text/media/URLs», telemetry без payload; jobs — worker «resolves tenant/resource from stored job, not payload-only client IDs» (`stored_job_tenant` family, lease fencing); storage — приватные bucket-ы, exact-object short-lived grants, negative suite подставляет «tenant/project/work/client-operation/intent and encoded path variants». Верификация — T-TENANT-001 «across every surface» (API/Data API/DB/storage/jobs/exports/search/signed links); это spec+тест-контракт, runtime-прогон — PILOT-BLOCKER.
   - Артефакт/ссылка: docs/35 §4–§7, §9; docs/19 §5; docs/25 §3, §5; docs/23 §10; test-catalog T-TENANT-001, T-STORAGE-001, T-RLS-001.
   - Статус и владелец: Closed · Security

157. Are negative authorization tests maintained for every high-risk command?
   - Ответ/решение: Да, как поддерживаемый контракт: doc 35 §9 предписывает для каждого object/action полный негативный набор (unauthenticated, revoked/suspended, wrong org/project/location/role, deny override, stale membership version, wrong state, entitlement disabled) через API и прямой DB policy harness; T-RLS-001 исполняет «each permissions.csv action … positive and all negative dimensions», плюс высокорисковые команды имеют выделенные P0-тесты (T-OWNERSHIP-001, T-OFFBOARD-SCALE/MULTI, T-OFFLINE-AUTH/REVOKE, T-LEASE-PARENT, T-STORAGE, T-TENANT; каталог: 130 P0 из 146). Guards в state-transitions включают step-up и для waiver-команд (`recent_auth_reason_expiry_scope`, `recent_auth_exact_version_reason_and_occurrence_not_closed` — фикс 23.07). Прогон на живой БД — отдельный PILOT-BLOCKER (deployment gate doc 35 §10).
   - Артефакт/ссылка: docs/35 §9; docs/19 §10; technical/test-catalog.csv (T-RLS-001 и P0-набор); state-transitions 75, 277; CHANGELOG §2 (waiver step-up); docs/34 §3.
   - Статус и владелец: Closed · QA

## 11. Versioning, audit, and temporal reconstruction


158. Can the system reconstruct what a user knew and what rules applied at any historical timestamp?
   - Ответ/решение: Реконструкция гарантируется на уровне каждого зафиксированного решения: assignment хранит snapshots terms/rules/references, readiness_snapshots хранит input_snapshot/input_hash/engine_version, package version пинит contract/terms/rule/adapter/template/source snapshot, stale acknowledgement связывает старый snapshot hash с точной опубликованной версией reference, lease пинит authorization_context_hash, а audit_events дают хронологию. Однако глобальной «as-of произвольный timestamp» процедуры/запроса и теста на неё в пакете нет — восстановление между зафиксированными точками требует ручной сборки по версионным таблицам (published_at/effective_on/occurred_at).
   - Артефакт/ссылка: docs/18-domain-state-machines.md §4, §7 (readiness input snapshot); docs/38-business-logic-closure.md §7–8; technical/schema.sql (readiness_snapshots, package_versions, offline_authorization_leases, audit_events); docs/22-data-api-contract.md §4.
   - Обновление (закрыто фиксом 23.07.2026): doc 22 §4 «Temporal reconstruction»: нормативная as-of процедура из versioned inputs + pinned hashes
   - Статус и владелец: Closed · Architecture

159. Does every published template, contract term, adapter, form, and policy become immutable?
   - Ответ/решение: Да: published contract version/terms version/rule version/reference revision immutable, исправление — только следующая версия (doc 18 §4, §7; doc 22 §4 инвариант 2); adapter version после publish immutable, шаблоны документов — часть adapter package, package_versions пинит template_version/adapter_key/adapter_version; типизированные формы фиксируются schema_key + schema_version + response_hash; plan_versions immutable, business calendar — immutable key/version/snapshot/hash, политики — версии (policy_version в лизах, configurable policy versions в retention).
   - Артефакт/ссылка: docs/18 §4, §7; docs/22 §4; docs/32-customer-country-adapters.md §2–3; docs/24-legal-regulatory-gates.md §9; technical/schema.sql (contract_term_versions, plan_versions, typed_evidence_records, package_versions).
   - Статус и владелец: Closed · Architecture

160. How are effective dates distinguished from creation and publication dates?
   - Ответ/решение: Раздельные колонки: contract_term_versions хранит created_at, published_at (обязателен для published/superseded по CHECK) и отдельный effective_on; plan_versions — created_at против effective_from/effective_to. Pilot дополнительно запрещает future-effective публикацию terms, поэтому расхождение effective/publication не может создать скрытую отложенную политику.
   - Артефакт/ссылка: technical/schema.sql (contract_term_versions: effective_on/published_at/created_at + CHECK; plan_versions); docs/38 §7; technical/error-catalog.csv CONTRACT_TERMS_FUTURE_EFFECTIVE_UNSUPPORTED.
   - Статус и владелец: Closed · Architecture

161. Can a future version be scheduled, cancelled, or superseded before it becomes effective?
   - Ответ/решение: В Pilot будущая effective-версия исключена by design: публикуются только terms «effective now» (ошибка CONTRACT_TERMS_FUTURE_EFFECTIVE_UNSUPPORTED, тест T-TERMS-EFFECTIVE-001); до публикации версия отменяется через draft/validating → rejected, после публикации вытесняется только новой публикацией (superseded). Отдельный механизм «запланировать и отменить будущую версию» отсутствует и не нужен, пока действует запрет; снятие запрета в GA потребует нового дизайна scheduling/cancel.
   - Артефакт/ссылка: docs/38 §7; docs/18 §4 (contract/terms/reference version машины); technical/error-catalog.csv; technical/test-catalog.csv T-TERMS-EFFECTIVE-001.
   - Статус и владелец: Closed · Architecture

162. What happens to in-progress work when a new version becomes effective?
   - Ответ/решение: Ничего не переписывается: существующие assignments и packages остаются привязаны к своей exact terms version; публикация reference revision переводит открытые assignments в stale_unacknowledged до явного acknowledgement (stale_acknowledged) или миграции через новый linked assignment; rule migration — отдельный preview без переписывания уже материализованных occurrences; published terms не могут изменить открытый assignment или закрытый период без явного migration preview.
   - Артефакт/ссылка: docs/38 §7 (reference/terms binding); docs/18 §4 (contract terms version); technical/events.csv assignment_reference_acknowledged; technical/schema.sql assignment_reference_acknowledgements.
   - Статус и владелец: Closed · Architecture

163. Does each audit event include actor, tenant, command, aggregate, version, timestamp, reason, and correlation ID?
   - Ответ/решение: Частично: audit_events гарантированно содержит tenant (organization_id, project_id), actor (actor_user_id + actor_type user/external/system/worker), команду (action), агрегат (object_type/object_id), timestamp (occurred_at) и correlation (request_id). Версия агрегата и reason не являются обязательными колонками — они могут попасть только в нетипизированный details jsonb, и ни один документ не требует их присутствия в каждом audit event (receipt-контракты с aggregate/version существуют лишь для команд, не для audit-строк).
   - Артефакт/ссылка: technical/schema.sql audit_events (строки 1583–1595); technical/openapi.yaml схема AuditEvent; docs/18 §1; docs/38 §12 (receipts, не audit).
   - Обновление (закрыто фиксом 23.07.2026): schema: audit_events + object_version/reason_code; doc 18 §1 контракт полей аудита расширен
   - Статус и владелец: Closed · Architecture

164. Are audit events append-only and protected from ordinary support or admin modification?
   - Ответ/решение: Да: doc 22 §4 инвариант 9 «Audit/outbox are insert-only for application roles», doc 09 §4 «audit events cannot be updated/deleted by normal app roles», schema.sql отзывает все клиентские гранты на tenant/audit таблицы; disposal — append_only_policy_worker; break-glass поддержки «cannot erase audit», прямой SQL не является нормальным support-инструментом. Проверяется T-AUDIT-001 (попытки app-role update/delete).
   - Артефакт/ссылка: docs/22 §4; docs/09-security-compliance.md §4; docs/33-support-admin-plane.md §4–5; technical/data-retention-catalog.csv (audit_events); technical/test-catalog.csv T-AUDIT-001.
   - Статус и владелец: Closed · Security

165. Can an audit trail be exported in a human-readable and machine-verifiable form?
   - Ответ/решение: Да: listAuditEvents (Pilot, cursor-paginated, allowlisted фильтры actor/action/object/project/date) — читаемый доступ; S36 «Audit & data export» экспортирует signed CSV/JSON; экспортный job хранит storage_sha256/byte_size/mime, полный org-export включает manifest/checksums (FR-14), и T-EXPORT-001 требует реконструируемых state/version/manifest/hash-меток.
   - Артефакт/ссылка: technical/openapi.yaml listAuditEvents; docs/04-screen-specification.md S36; docs/01-prd.md FR-14; technical/schema.sql export_jobs; technical/test-catalog.csv T-EXPORT-001.
   - Статус и владелец: Closed · Architecture

166. Are sensitive values redacted from audit payloads without removing required evidence?
   - Ответ/решение: Да: чтение audit — «Sensitive payloads and raw network identifiers never appear in the response»; permissions.csv audit.read — «no raw tokens/secrets/free text policy»; каждый error-код несёт явную log_policy (что можно логировать); trace/log payload allowlisted/redacted (doc 26 §4). При этом суммы для audit допустимы там, где нужны как evidence (например PAYMENT_ALLOCATION_EXCEEDS: «amounts_allowed_in_audit_not_analytics»).
   - Артефакт/ссылка: technical/openapi.yaml listAuditEvents description; technical/permissions.csv (audit,read); technical/error-catalog.csv (log_policy); docs/26-sre-operations.md §4.
   - Статус и владелец: Closed · Security

167. How are clock differences and event ordering handled across API, workers, mobile devices, and integrations?
   - Ответ/решение: Часовая политика закрыта: канонические timestamptz UTC на сервере, client timestamp — untrusted observation с clock anomaly, device time/EXIF/старый lease не являются доказательством хронологии, офлайн-протокол тестирует ±24h и rollback/forward; audit id — монотонный bigint, incident-время UTC + локальный дисплей. Однако явного контракта упорядочивания событий для внешних потребителей нет: webhook — at-least-once с event ID/occurred time, но гарантия порядка или руководство по out-of-order обработке не задокументированы.
   - Артефакт/ссылка: docs/22 §3 (Time); docs/38 §4; docs/23-offline-media-protocol.md (clock ±24h); docs/26 §8; docs/22 §10, docs/08 §9 (нет ordering-гарантии).
   - Обновление (закрыто фиксом 23.07.2026): doc 22 §10: ordering не гарантируется; occurred_at + event ID, идемпотентный потребитель
   - Статус и владелец: Closed · Architecture

168. Can a failed transaction leave an audit event that suggests a command succeeded?
   - Ответ/решение: Нет: успешный переход атомарно создаёт audit event + outbox + idempotency result в одной транзакции; неуспех не оставляет частично применённых переходов. T-AUDIT-001 явно проверяет success/denial/retry/rollback: «Required audit exists only for committed action».
   - Артефакт/ссылка: docs/18 §1; technical/test-catalog.csv T-AUDIT-001; docs/38 §10 (outbox после commit).
   - Статус и владелец: Closed · Architecture

169. How are administrative data repairs distinguished from normal business commands?
   - Ответ/решение: Платформенный admin plane — отдельный route/domain/auth audience, staff-роли не становятся tenant-membership; ремонтные действия ограничены явным списком (retry/cancel safe job, replay webhook после авторизации, rotate/revoke credential, signed entitlement adjustment и т.д.) под tenant-грантами, banner и полным audit; прямой SQL запрещён как обычный инструмент — исключение только через reviewed script, backup/invariant plan, dual approval и post-check. Бизнес-команды идут исключительно через typed domain commands.
   - Артефакт/ссылка: docs/33-support-admin-plane.md §1, §3–5; docs/22 §5 (SaaS/admin, x-audience: platform_billing); docs/08 §11 (интеграции не пишут в таблицы напрямую).
   - Статус и владелец: Closed · Security

170. Can every package, decision, waiver, and payment be traced to exact source versions?
   - Ответ/решение: Да: package_versions хранит contract_version_id, contract_term_version_id, adapter_key/version, template_version, rule_snapshot_hash, snapshot_hash; строки пакета — точные quantity/evidence source links с reservation-check; external decision таргетирует ровно одну resource version (frozen target_snapshot_hash); waiver/hold хранят occurrence version и evidence snapshot hash; receivable хранит exact acceptance record ID, allocations — точные receivables, реверсы — точные source entries.
   - Артефакт/ссылка: technical/schema.sql package_versions/external_shares; docs/38 §6, §8, §12; docs/22 §4 (инварианты 5–7); docs/18 §5, §11.
   - Статус и владелец: Closed · Architecture

171. Is there a strategy for detecting and repairing derived-data drift?
   - Ответ/решение: Да: каждая проекция обязана детерминированно пересобираться из immutable источников и совпадать точно (WorkItem.status rebuild-match, quantity projection сверяется с ledger total, readiness rebuild в T-READY-002); операционно — метрики package total/hash reconciliation и outbox conflicts, отдельные reconciliation-мониторы для close/numbering/package generation, alert на parent change с живым lease, и GA-runbook «data integrity mismatch».
   - Артефакт/ссылка: docs/38 §2; docs/18 §5; docs/26 §4, §7, §12; technical/test-catalog.csv T-READY-002.
   - Статус и владелец: Closed · SRE

172. How long must each audit class be retained, and can legal hold override deletion?
   - Ответ/решение: Механизм закрыт: каждая таблица имеет ровно одну запись retention-каталога, audit_events — класс security_audit с legal-hold behavior preserve_or_restrict и append_only disposal; legal hold блокирует deletion (инвариант «Retention/deletion cannot bypass legal hold», deletion job → blocked_by_hold), а невалидированная retention (V-003) блокирует destructive scheduling даже без hold. Но точные длительности не определены: все 126 записей — duration_external_gate, решение — внешний юридический/бухгалтерский гейт V-003.
   - Артефакт/ссылка: technical/data-retention-catalog.csv; docs/24 §9; docs/22 §2, §4; docs/18 §13; docs/30-validation-evidence-register.md V-003.
   - Статус и владелец: Deferred with gate (V-003) · Legal (external)

## 12. Notifications, tasks, and operational ownership


173. Does every actionable blocker have exactly one current owner or an explicit unassigned state?
   - Ответ/решение: Да: ReadinessBlocker обязан вернуть ownerUserId (nullable — явное «не назначено») и dueAt; package_decision_issues.correction_owner_id NOT NULL + correction_due_at NOT NULL; review task различает open (не назначен) и assigned (assigned_reviewer_id); evidence request имеет assigned_to_user_id и open-состояние; attention rail дашборда — «Each card has owner and action»; у assignment ровно один assignee.
   - Артефакт/ссылка: technical/openapi.yaml ReadinessBlocker (required ownerUserId/dueAt); technical/schema.sql package_decision_issues, review_tasks, evidence_requests; docs/04 S10; docs/38 §8.
   - Статус и владелец: Closed · Product

174. Can ownership be individual, role-based, team-based, or external?
   - Ответ/решение: Нет — владение всегда индивидуальное: все owner-поля являются user-FK (assigned_reviewer_id, escalation_owner_id, correction_owner_id, assigned_to_user_id, integration operational_owner_id). Ролевое, командное или внешнее (контрагентское) владение не смоделировано ни в схеме, ни в API, и явного архитектурного решения «только individual в Pilot/GA» в пакете не зафиксировано.
   - Артефакт/ссылка: technical/schema.sql (review_tasks, package_decision_issues, evidence_requests, integration_connections); docs/01-prd.md FR-07/FR-08; отсутствие team/role-owner конструкций подтверждено grep-ом.
   - Обновление (закрыто фиксом 23.07.2026): ADR-018: individual-only ownership с revisit-триггером
   - Статус и владелец: Closed · Product

175. How are reassignment and escalation recorded without losing the original responsibility?
   - Ответ/решение: Reassignment — отдельные exact-version команды с append-only рецептами: assignment_reassignment_receipts (старый/новый assignee, reason, offline policy), review_task_reassignment_receipts (immutable reviewer + exact target lineage); события work_assignment_reassigned/review_task_reassigned. Reviewer- и escalation-ответственность различаются как отдельные типы замен в offboarding-плане; история/авторство никогда не переписываются, escalation_owner_id хранится на самой задаче.
   - Артефакт/ссылка: docs/38 §4; docs/19-organizations-roles-access.md §7 (шаги 4–5); technical/schema.sql assignment_reassignment_receipts, review_task_reassignment_receipts, review_tasks.escalation_owner_id; technical/data-retention-catalog.csv (оба receipt-класса security_audit).
   - Статус и владелец: Closed · Architecture

176. Can notification preferences suppress a legally or operationally critical alert?
   - Ответ/решение: Нет: NotificationPreferences.mandatoryEventKeys — классы событий, чью обязательную in-app доставку нельзя отключить; permissions.csv: «mandatory security and billing classes cannot be disabled»; preference-патчи частичны, отклоняют stale catalog/unknown key и не могут включить нерекламируемый канал. Событие notification_preferences_changed трекает mandatory_preserved, T-NOTIFY-001 ассертит «mandatory notices remain enabled».
   - Артефакт/ссылка: technical/openapi.yaml NotificationPreferences/NotificationPreferencesPatch; technical/permissions.csv (notification,manage_preferences); docs/20-flow-catalog.md §16 (F15); technical/test-catalog.csv T-NOTIFY-001.
   - Статус и владелец: Closed · Security

177. What is the difference between notification delivered, read, acknowledged, and acted upon?
   - Ответ/решение: Delivered — состояние машины доставки notification_delivery (sent → delivered только по in-app commit или подтверждению approved-провайдера; bounced/failed/cancelled — отдельные исходы); read — собственный идемпотентный read receipt получателя (notifications.read_at через markNotificationsRead, событие notification_read); acknowledged — только явные доменные команды с собственными рецептами (reference acknowledgement, warning acknowledgement, operational acknowledgement = assurance-уровень 2 в doc 24 §8) и никогда не выводится из факта чтения; acted upon — только доменные переходы; «consequential approval by chat reaction» запрещён.
   - Артефакт/ссылка: technical/state-transitions.csv notification_delivery (строки 192–197); technical/schema.sql notifications/notification_deliveries; docs/08-api-integrations.md §8; docs/24 §8; technical/events.csv notification_delivered/notification_read.
   - Статус и владелец: Closed · Product

178. Are read receipts versioned when notification content changes?
   - Ответ/решение: Сценарий изменения контента непредставим в контракте: notifications — append-only строки без update-операции, updated_at и версии; safe_payload фиксируется при вставке, новое событие создаёт новую строку, read_at принадлежит точной строке, а каждая delivery ссылается на exact same-tenant tuple notification/recipient/channel — «retries cannot invent or cross-link content». Поэтому read receipt всегда относится к тому контенту, который был прочитан; отдельная explicit-формулировка об иммутабельности контента в прозе отсутствует, но закрыта конструкцией схемы/API.
   - Артефакт/ссылка: technical/schema.sql notifications (строки 2192–2204); technical/openapi.yaml (нет notification-update операции; markNotificationsRead idempotent); docs/20 §16 (F15); technical/test-catalog.csv T-NOTIFY-001.
   - Статус и владелец: Closed · Architecture

179. How are duplicate notifications prevented under at-least-once worker delivery?
   - Ответ/решение: Worker-потребители дедуплицируют по outbox event ID + destination (doc 22 §8); в notification_deliveries уникальный ключ (organization_id, notification_id, channel) — повторная попытка продвигает ту же запись (attempts advance in place), а не создаёт новую; T-NOTIFY-001 проверяет crash/retry доставки; продуктово FR-13 добавляет дедуп повторных алертов и digest-подавление шума.
   - Артефакт/ссылка: docs/22 §8; technical/schema.sql notification_deliveries (unique constraint); docs/20 §16; docs/01 FR-13; technical/test-catalog.csv T-NOTIFY-001.
   - Статус и владелец: Closed · Architecture

180. What happens when email, push, SMS, or messenger providers are unavailable?
   - Ответ/решение: In-app канал каноничен и от провайдеров не зависит; недоступный внешний канал нельзя включить (advertised availableChannels, провайдерские гейты); доставка — queued → failed → retry по retry budget, bounced для постоянного отказа получателя, NOTIFICATION_DELIVERY_FAILED (503, retryable); runbook «email/OTP outage» обязателен до Pilot, метрика notification delivery/bounce есть. Наблюдаемость неполна: в events.csv единственное fail-событие — capture_sync_failed; отказы notification/webhook/import/generation/export ненаблюдаемы в продуктовой аналитике (известный открытый пункт аудита).
   - Артефакт/ссылка: technical/state-transitions.csv notification_delivery; technical/error-catalog.csv NOTIFICATION_DELIVERY_FAILED; docs/08 §8; docs/26 §4, §7; CHANGELOG-AUDIT-FIX-20260723.md («Не менялось»).
   - Обновление (закрыто фиксом 23.07.2026): notification_delivery_failed добавлено в events.csv с владением
   - Статус и владелец: Closed · SRE

181. Can users see a single prioritized inbox across assignments, evidence requests, reviews, and package issues?
   - Ответ/решение: Единого кросс-объектного приоритизированного inbox-реестра нет: покрытие распределено между notification center (вкладки «requires action / updates / system», группировка по work/package, deep links), attention rail дашборда S10 (карточки с owner и action, ранжирование value × urgency × irrecoverability), полевым экраном S24 Today и review queue с детерминированным приоритетом/SLA. Каждый класс работы виден, но в разных поверхностях без общего ранжирования.
   - Артефакт/ссылка: docs/04-screen-specification.md §9 (Notification center), S10, S24, S16; technical/openapi.yaml listNotifications/listReviewTasks/listReadinessBlockers.
   - Обновление (закрыто фиксом 23.07.2026): doc 04 §9: distributed inbox — норма Pilot; unified inbox — Deferred в doc 37
   - Статус и владелец: Closed · Product

182. Are deadlines calculated in the contract timezone and working-day calendar?
   - Ответ/решение: Да: contract_term_versions хранит reporting_timezone и versioned business calendar (business_calendar_key/version/snapshot/hash, snapshot по умолчанию Пн–Пт без inferred праздников); business-day расчёты обязаны использовать immutable calendar key/version и stored snapshot; PaymentDueRule.from обязателен; существующие assignments/packages остаются на своей exact terms version. Покрыто T-BUSINESS-CALENDAR-001 и T-TERMS-EFFECTIVE-001.
   - Артефакт/ссылка: docs/38-business-logic-closure.md §7 и §15 («terms timing/calendar»); technical/schema.sql contract_term_versions (reporting_timezone, business_calendar_*); docs/38 §11 (PaymentDueRule.from).
   - Статус и владелец: Closed · Architecture

183. How are overdue amounts and aging recalculated after reassignment or correction?
   - Ответ/решение: Aging/overdue — server-derived проекции над immutable ledger: totals (adjustment, released-retention, paid, reversed, outstanding) пересчитываются внутри транзакции из immutable строк, «никогда из кэша или клиентской суммы»; переходы due→overdue и part_paid→overdue выполняются по guard due_date_passed_with_balance (добавлен в v2.9); любая коррекция — ledger entry, вызывающая projection refresh (doc 18 §1), UI-балансы не зависят от клиентской арифметики.
   - Артефакт/ссылка: docs/18 §11 (алгоритм, шаг 4); docs/38 §12; technical/state-transitions.csv (receivable mark_overdue, part_paid→mark_overdue); CHANGELOG §2; docs/04 S22.
   - Статус и владелец: Closed · Architecture

184. Can a notification link open an object the recipient is no longer authorized to access?
   - Ответ/решение: Ссылка может существовать, но доступ перепроверяется при каждом чтении: notification read ограничен «own recipient and effective project scope», а целевой объект открывается через обычный API с полной цепочкой authentication → membership → scope → permission; смена scope инвалидирует authorization cache/claims, revoked membership/share не создаёт команд по stale token (инвариант 8), отказ — uniform 404/403 без existence disclosure.
   - Артефакт/ссылка: technical/permissions.csv (notification,read); docs/18 §1, §3; docs/22 §4 (инвариант 8); technical/openapi.yaml markNotificationsRead description (uniform 404).
   - Статус и владелец: Closed · Security

185. Do escalations stop after the underlying issue is resolved or waived?
   - Ответ/решение: Частично: review-SLA детерминирован и «pauses only for explicit terminal/quarantine/customer-wait states», review task терминальна в completed/cancelled/expired, триггеры уведомлений событийны (resolved/waived состояние их больше не порождает), waiver вызывает re-evaluation. Но digest/escalation-цепочки — GA-функция «if configured» за provider/privacy гейтами, и явный контракт остановки эскалации при resolve/waive (включая уже поставленные в очередь напоминания) не задокументирован.
   - Артефакт/ссылка: docs/01 FR-08 (SLA), FR-13; docs/20 §16 (GA branch); docs/28-pilot-ga-delivery.md (advanced notification escalation — GA); docs/18 §7 (waiver re-evaluation).
   - Обновление (закрыто фиксом 23.07.2026): doc 08 §8: escalation halt invariant (остановка в транзакции terminal/waived)
   - Статус и владелец: Closed · Architecture

186. Can organization suspension still permit security, payment, export, and recovery notifications?
   - Ответ/решение: Да: command-availability сохраняет в suspended/closing scoped read (CA-002), export (CA-003), payment recovery (CA-004), support/security recovery (CA-005) и member-security команды (CA-006); doc 21: во время suspension остаются read/export/pay/cancel/close/support, а grace/suspension явно шлёт «Notifications to owner/billing contacts»; mandatory security/billing классы уведомлений неотключаемы, suspended tenant может аутентифицироваться и читать in-app уведомления.
   - Артефакт/ссылка: technical/command-availability.csv CA-002…CA-006; docs/21-plans-entitlements-billing.md §6 (строки 80, 125); docs/18 §2; technical/openapi.yaml NotificationPreferences.mandatoryEventKeys.
   - Статус и владелец: Closed · Architecture

## 13. Integrations and external systems


187. For each integration, is AktFlow the source, destination, or reconciliation layer?
   - Ответ/решение: Для всех существующих поверхностей направление определено: outbound webhook/export_sink — AktFlow источник (единственные типы integration_connections); estimate/location/payment import — внешний источник, AktFlow — слой сверки через preview/dry-run/confirm; бухгалтерия и GC CDE остаются системами записи там, где того требует контракт, AktFlow «does not post journal entries and does not become the accounting ledger»; в doc 37 введён класс «Integration-only». Для каждого будущего коннектора матрица direction/source-of-truth обязательна по acceptance checklist.
   - Артефакт/ссылка: docs/08-api-integrations.md §1, §5, §10; technical/schema.sql integration_connections (type check); docs/37-functional-closure-feature-register.md (Integration-only).
   - Статус и владелец: Closed · Architecture

188. Can all external writes be retried safely with idempotency and deduplication?
   - Ответ/решение: Да: webhook-доставка — at-least-once с exponential retry + jitter, dead-letter и уникальностью (organization_id, event_id, webhook_endpoint_id); получатель обязан дедуплицировать по event ID; worker-потребители дедуплицируют по outbox event ID + destination; replay — авторизованная операция по redacted dead-letter; внешние вызовы никогда не выполняются под row lock. Idempotency/duplicate tests — обязательный пункт acceptance checklist, покрыт T-WEBHOOK-001.
   - Артефакт/ссылка: docs/22 §8, §10; docs/08 §9–10; docs/38 §10; technical/schema.sql webhook_deliveries; technical/test-catalog.csv T-WEBHOOK-001.
   - Статус и владелец: Closed · Architecture

189. How are webhook authenticity, replay protection, ordering, and duplicate delivery handled?
   - Ответ/решение: Authenticity — HMAC-подпись включает timestamp и raw body, secret хранится шифротекстом и показывается один раз; replay — окно + event ID, stale-запросы отклоняются; duplicates — at-least-once с обязательной дедупликацией у потребителя; тест T-WEBHOOK-001 (signature vectors, duplicate receive, DLQ replay). Ordering не специфицирован: envelope несёт event ID/occurred time, но гарантия порядка или явное руководство по out-of-order обработке в контракте отсутствуют.
   - Артефакт/ссылка: docs/22 §10; docs/08 §9; technical/schema.sql webhook_endpoints/webhook_deliveries; technical/test-catalog.csv T-WEBHOOK-001.
   - Обновление (закрыто фиксом 23.07.2026): doc 08 §9 + doc 22 §10: out-of-order доставка нормирована
   - Статус и владелец: Closed · Architecture

190. What happens when an external system accepts a request but AktFlow times out?
   - Ответ/решение: Для outbound: delivered фиксируется только по accepted response; таймаут ведёт в retry_wait и повтор той же delivery, а дубль у получателя гасится тем же event ID (осознанный at-least-once дизайн); стейл-worker отсекается lease/fencing token, external calls не выполняются под row lock, outbox — строго после commit. Для inbound-денег симметрично: reconciliation import — preview + explicit confirmation + уникальный source_fingerprint, payment fingerprint даёт business-warning без автослияния.
   - Артефакт/ссылка: technical/state-transitions.csv webhook_delivery; docs/38 §10; docs/18 §11 (CSV preview); technical/schema.sql reconciliation_imports, saas_payments (source_fingerprint); docs/26 §12.
   - Статус и владелец: Closed · Architecture

191. Can an integration owner be offboarded without orphaning credentials or jobs?
   - Ответ/решение: Да: integration_connections.operational_owner_id NOT NULL, а member offboarding обязан пройти organization-level план, в котором «organization-level integration owner» — отдельный тип зависимости, требующий projectId=null и exact replacement до consume (block_revoke — безопасный стоп); revoke соединения инвалидирует секрет и отменяет queued deliveries. Покрыто T-OFFBOARD-SCALE-001.
   - Артефакт/ссылка: docs/38 §9; docs/19 §7 (шаги 4–5); technical/schema.sql integration_connections; technical/state-transitions.csv (integration revoke, webhook_delivery cancel); docs/04 S32.
   - Статус и владелец: Closed · Security

192. How are credentials encrypted, rotated, scoped, and revoked?
   - Ответ/решение: Endpoint URL и signing secret хранятся только шифротекстом (endpoint_url_ciphertext, signing_secret_ciphertext) с secret_version; rotation — версионированная команда с bounded overlap (0–86400 с), новый секрет возвращается ровно один раз (returnedOnce const true), событие integration_secret_rotated; scope — least-privilege allowed_event_keys; revoke выполняет integration_admin_or_security под recent_auth и атомарно инвалидирует секрет + отменяет очередь; секреты никогда не redisplayed/logged.
   - Артефакт/ссылка: technical/schema.sql webhook_endpoints; technical/openapi.yaml rotateIntegrationSecret/IntegrationSecretReceipt; technical/state-transitions.csv (integration revoke); technical/permissions.csv (integration,manage); docs/20 §17.
   - Статус и владелец: Closed · Security

193. Can one customer connect multiple BAS, AVK, storage, or mail accounts per project?
   - Ответ/решение: Нет: BAS/AVK/storage/mail коннекторов в контракте нет — они остаются file-based до подтверждённого платящего спроса (doc 08 §3, §6); integration_connections — организационного уровня (unique по name, типы только webhook|export_sink), метр webhook_endpoint ограничивает количество; per-project multi-account модель отсутствует, задекларирована лишь versioned mapping per organization/project как принцип.
   - Артефакт/ссылка: docs/08 §1, §3, §6; technical/schema.sql integration_connections; technical/entitlements.csv (webhook_endpoint); docs/30 V-010/V-011 (приоритет интеграций — внешняя валидация).
   - Обновление (закрыто фиксом 23.07.2026): doc 08 §1: подключения org-level; per-project multi-account — no-build (doc 37) до спроса ≥3 ICP
   - Статус и владелец: Closed · Product

194. How are external identifiers versioned when source records are merged or recreated?
   - Ответ/решение: Не определено: для внешних идентификаторов есть только «customer/vendor reference mapping» как обязанность будущего accounting-адаптера и принцип versioned mapping per organization/project; семантика merge/recreate внешних записей (перепривязка ID, lineage внешних ссылок, поведение при пересоздании в источнике) нигде не специфицирована. Внутренние lineage-механизмы (work_item lineage_root_id) на внешние ID не распространяются.
   - Артефакт/ссылка: docs/08 §1, §5; docs/32 §2 (source schema/import mappings — без merge-семантики); grep external_ref/external_id по schema.sql — соответствующих конструкций нет.
   - Обновление (закрыто фиксом 23.07.2026): doc 08 §5: versioned external-ID mapping с supersede — обязательное условие первого адаптера
   - Статус и владелец: Closed · Architecture

195. What reconciliation report shows missing, duplicate, rejected, and transformed records?
   - Ответ/решение: Для существующих поверхностей отчёты конкретны: estimate import — dry-run diff (added/changed/removed rows, money delta, affected packages/rules) + import_row_results с блокирующими row errors; package decisions — типизированный реестр issues (missing_line, duplicate_line, invalid_amount, unmatched_reference, total_mismatch), «no unmatched/duplicate/invalid source line is silently dropped»; payment reconciliation — reconciliation_imports preview c fingerprint; mapping preview валидирует трансформацию на redacted fixture. Единый reconciliation-отчёт для будущих внешних sync-коннекторов остаётся на уровне принципа/чеклиста («direction, source, last success, rejected records and reconciliation path»).
   - Артефакт/ссылка: docs/18 §4; docs/38 §8; technical/schema.sql package_decision_issues, reconciliation_imports, import_row_results/import_diffs (doc 22 §2); docs/08 §1, §10; technical/openapi.yaml previewIntegrationMapping.
   - Обновление (закрыто фиксом 23.07.2026): doc 08 §10: обязательный reconciliation report (missing/duplicate/rejected/transformed) в acceptance checklist
   - Статус и владелец: Closed · Architecture

196. Can a country or customer adapter be disabled without corrupting historical packages?
   - Ответ/решение: Да: adapter lifecycle включает deprecated/retired; проект пинит exact adapter version, submitted packages остаются привязаны к original version (adapter_key/adapter_version в package_versions), «auto-update never silently changes active project or historical package»; при отказе/устаревании адаптера core ledger/evidence остаются доступны, package job падает с adapter/version/error кодом, частичный артефакт не помечается ready, generic export доступен.
   - Артефакт/ссылка: docs/32-customer-country-adapters.md §3, §6, §7; technical/schema.sql package_versions (adapter_key/adapter_version NOT NULL); docs/38 §8.
   - Статус и владелец: Closed · Architecture

197. Are integration schemas contract-tested against fixtures and provider sandboxes?
   - Ответ/решение: Да по дизайну: adapter package обязан содержать golden input/output fixtures с expected hashes, официальные форматы (ЄДЕССБ) поддерживаются только после верификации схем/доступа/эндпоинтов с conformance-тестами per published version; «sandbox fixtures and vendor outage behavior» — пункт acceptance checklist; GA-блокеры T-WEBHOOK-001, T-INTEGRATION-LIFECYCLE-001, T-SSRF-001 исполняются на endpoint/integration sandbox. Вендорские подключения дополнительно за гейтом V-011 (DPA + security review + sandbox PoC).
   - Артефакт/ссылка: docs/32 §2, §4; docs/08 §4, §10; technical/test-catalog.csv T-WEBHOOK-001/T-INTEGRATION-LIFECYCLE-001/T-SSRF-001; technical/traceability.csv REQ-INT-01 (V-010|V-011).
   - Статус и владелец: Closed · QA

198. How are provider rate limits, outages, and breaking API changes surfaced operationally?
   - Ответ/решение: Операционно закрыто: метрики queue depth/oldest age/retry/dead letter и notification delivery/bounce, fail_terminal → «dead_letter_and_alert», redacted replay UI, обязательный runbook «queue backlog/dead letters», provider rate limit — явный edge F16 и пункт checklist; breaking changes — documented schema version + deprecation window, у адаптеров — change monitoring с owner, source/date/impact и новой версией. Продуктовая наблюдаемость неполна: в events.csv единственное fail-событие — capture_sync_failed; отказы import/generation/export/notification/webhook ненаблюдаемы в аналитике (известный открытый пункт).
   - Артефакт/ссылка: docs/26 §4, §7, §12; technical/state-transitions.csv webhook_delivery fail_terminal; docs/22 §10; docs/32 §6; docs/20 §17; CHANGELOG («Не менялось»).
   - Обновление (закрыто фиксом 23.07.2026): fail-события async-flows добавлены в events.csv; операционный surfacing уже был
   - Статус и владелец: Closed · SRE

199. Can the product operate fully enough for the pilot when every optional integration is disabled?
   - Ответ/решение: Да: Pilot спроектирован без обязательных интеграций — «Import/export before deep integration»; импорт смет file-based (XLSX/XLS/CSV), submission и внешнее решение — ручные с записью receipt, уведомления канонично in-app (внешняя почта — только транзакционная identity/security), все integration/webhook операции имеют x-release GA и находятся за гейтами V-010/V-011. Пакет генерируется внутренним renderer-ом без внешних систем.
   - Артефакт/ссылка: docs/38 §1; docs/08 §1, §3, §8; technical/openapi.yaml (все integration-операции GA); technical/traceability.csv REQ-INT-01.
   - Статус и владелец: Closed · Product

200. Which integration failures block readiness, package creation, submission, or only convenience functions?
   - Ответ/решение: Блокируют только внутренние обязательные зависимости: malware scan (scan state обязателен — quarantine/pending блокирует review/package), renderer/package job (generation_failed → retry, частичный артефакт никогда не ready) и устаревший/сломанный adapter — блокирует генерацию пакета, но не core ledger/evidence (generic export остаётся). Webhook/export sink — post-commit convenience: outbox после commit, отказ уходит в retry/dead-letter и не откатывает доменные переходы; submission в Pilot ручная, интеграции её не блокируют; сбой invitation email имеет recovery «retry_or_copy_link» и readiness не касается.
   - Артефакт/ссылка: docs/18 §1, §6, §14; docs/32 §7; technical/state-transitions.csv (webhook_delivery, notification_delivery, job); technical/error-catalog.csv (SCAN_*, PACKAGE_GENERATION_FAILED, WEBHOOK_*, INVITATION_DELIVERY_FAILED); docs/26 §4.
   - Статус и владелец: Closed · Architecture

## 14. Billing, entitlements, and organization lifecycle


201. Are product subscription payments completely separated from project receivables and customer payments?
   - Ответ/решение: Да, разделение нормативно: doc 21 §1 покрывает только деньги подписки AktFlow, проектные акты/receivables/оплаты заказчика живут в Project Commercials (`/app/payments`). Acceptance-критерий doc 21 §10 — «project-commercial money cannot activate SaaS subscription»; `recordSaasPayment` «project-payment records are never consulted». Четыре платформенные команды (`issueSaasInvoice`, `recordSaasPayment`, `transitionSaasInvoice`, `reverseSaasPayment`) требуют `x-audience: platform_billing` и роль `aktflow_platform_billing` — тенантские Owner/Admin/Accountant их не проходят; T-SAAS-PAYMENT-001 явно проверяет «without project-money effect».
   - Артефакт/ссылка: docs/21 §1, §5, §10; docs/22 §6 (platform_billing audience); technical/openapi.yaml (4× x-audience: platform_billing); technical/test-catalog.csv T-SAAS-PAYMENT-001.
   - Статус и владелец: Closed · Architecture

202. Does every capability check use immutable plan-version entitlements rather than plan-name conditionals?
   - Ответ/решение: Да: effective entitlement = `plan_version.entitlements + time-bound entitlement_overrides − suspension_restrictions`; `plan_versions` immutable (schema.sql:1610, `entitlements jsonb`, unique(plan_key, version_no)). Doc 21 §3 прямо запрещает «branch application logic on display name Control» — код спрашивает entitlement service и записывает decision reason/version; Guided Pilot — обычная immutable Pilot plan version, без второй authority. T-ENTITLEMENT-001 требует «same effective grants across UI/API/worker; no plan-name branching».
   - Артефакт/ссылка: docs/21 §2–3; docs/18 §12; technical/schema.sql (plan_versions, entitlement_overrides); technical/test-catalog.csv T-ENTITLEMENT-001.
   - Статус и владелец: Closed · Architecture

203. What happens when a plan changes while long-running jobs or offline leases are active?
   - Ответ/решение: Рестриктивные переходы (enter_grace/suspend/cancel/close, а также project/contract/membership) инвалидируют затронутые leases в той же транзакции (side_effects в state-transitions.csv, doc 38 §9, алерт doc 26 §12, T-LEASE-PARENT-001); уже полученные сервером объекты дообрабатываются классом CA-007; downgrade вступает со следующего цикла, hard limit блокирует только новое потребление. Однако lease пиннит `subscription_version` (schema.sql:618), а для нерестриктивного изменения подписки (upgrade/смена плана, инкремент version) не определено, считается ли это «parent mismatch» по CA-010 — риск ложного карантина легитимных офлайн-капчей после апгрейда.
   - Артефакт/ссылка: technical/state-transitions.csv (subscription side_effects); docs/38 §9; docs/18 §15; technical/command-availability.csv CA-007/CA-009/CA-010; technical/schema.sql (offline_authorization_leases.subscription_version).
   - Обновление (закрыто фиксом 23.07.2026): doc 23 §6 + CA-009/CA-010 notes: mismatch = только рестриктивные переходы; нерестриктивный bump → переиздание lease при sync
   - Статус и владелец: Closed · Architecture

204. Can an entitlement downgrade make existing records unreadable or unexportable?
   - Ответ/решение: Нет: колонка `existing_data_behavior` в entitlements.csv фиксирует для каждой фичи readable / readable_exportable / existing_artifacts_readable / existing_records_readable / existing_decisions_readable / existing_version_usable; downgrade — «данные не удаляются» (doc 18 §12), preview перечисляет over-limit объекты, «no automatic destructive choice» (doc 21 §6). `organization_export` = «never_block_for_billing / always_available_with_auth».
   - Артефакт/ссылка: technical/entitlements.csv (existing_data_behavior, organization_export); docs/21 §6, §10; docs/18 §12.
   - Статус и владелец: Closed · Product

205. Which actions remain available during grace, suspension, cancellation, and closure?
   - Ответ/решение: По CA-матрице в grace/suspended/cancelled/export_only и org closing остаются: CA-002 read_scoped, CA-003 export, CA-004 payment_recovery (settlement/коррекция «to restore or close service»), CA-005 support_security_recovery, CA-006 member_security_change, CA-007 достройка уже полученных объектов, CA-008 review существующей работы, CA-014 append-only commercial correction. Новое потребление запрещено: CA-011 new_field_execution и CA-012/013 требуют org trial|active + subscription pilot|trialing|active (grace уже исключён, enter_grace инвалидирует leases); org `closed` = CA-001 полный deny, остаются только заранее выданные офлайн-экспорт-артефакты.
   - Артефакт/ссылка: technical/command-availability.csv CA-001..CA-014, CA-9xx; docs/18 §2, §15; docs/21 §6.
   - Статус и владелец: Closed · Architecture

206. Can an organization always export its portable record before deletion?
   - Ответ/решение: Да: офбординг без платёжного барьера (C1-фикс) — `begin_closing` из trial/active/suspended, `cancel` подписки из pilot/trialing/active/grace/suspended; CA-003 разрешает экспорт вплоть до closing/export_only; guard `deletion_job.start_cooling_off` = «recent_auth_and_export_offered», guard org close = «export window passed»; `organization_export` = never_block_for_billing. T-EXPORT-002 проверяет полную портируемость в suspended; после `closed` интерактивного пути нет — только ранее скачанные артефакты (CA-001).
   - Артефакт/ссылка: CHANGELOG-AUDIT-FIX-20260723.md §1; docs/18 §2 (invariant offboarding without payment), §13; technical/command-availability.csv CA-003/CA-004; technical/state-transitions.csv (deletion_job, organization); technical/entitlements.csv; T-EXPORT-002.
   - Статус и владелец: Closed · Product

207. How are manual invoices and one-invoice payment reconciliation represented without pretending to be accounting?
   - Ответ/решение: Безопасный дефолт Украины: `payment_request` — коммерческий запрос на банковский перевод, «never labelled a validated tax/primary document», UI не заявляет фискальной комплаентности, PAN/CVV не входят в систему. Оплата Pilot матчится вручную ровно к одному запросу по уникальному bank-source fingerprint (`recordSaasPayment`, platform-only, не тенантский «mark paid»); поля tax invoice/service act — adapter/config, отключены до подтверждения бухгалтером; `validated_invoice` mode и cancel/credit — за V-006/GA (append-only `saas_invoice_adjustments`).
   - Артефакт/ссылка: docs/21 §3, §5, §8 (EXTERNAL GATE); docs/18 §12; docs/30 V-006; technical/state-transitions.csv (saas_invoice).
   - Статус и владелец: Closed · Product

208. Can payment retries create duplicate subscriptions, invoices, or entitlement grants?
   - Ответ/решение: Нет: `issueSaasInvoice` идемпотентен и замораживает plan version/period/basis hash до issue; дубликат fingerprint у `recordSaasPayment` реплеит тот же receipt; `subscriptions.organization_id UNIQUE` делает вторую подписку структурно невозможной. Acceptance doc 21 §10: «retries cannot create duplicate payment request/payment/allocation and cannot change a stored basis hash»; T-SAAS-PAYMENT-001 — «entitlements restore once»; плюс T-PAYMENT-FINGERPRINT-001 и T-BILLING-LEDGER-001 (гонки/stale versions/duplicate references).
   - Артефакт/ссылка: docs/21 §5, §10; technical/schema.sql (subscriptions unique org); technical/test-catalog.csv T-SAAS-PAYMENT-001, T-PAYMENT-FINGERPRINT-001, T-BILLING-LEDGER-001.
   - Статус и владелец: Closed · Architecture

209. How are pilot overrides approved, time-bounded, and audited?
   - Ответ/решение: `entitlement_overrides` в схеме требует reason_code, starts_at/expires_at NOT NULL с CHECK expires>starts и `approved_by`; doc 21 §3 — overrides «authorized, audited and time-bound», Pilot = immutable plan version + bounded override/order reference (второй authority нет); doc 21 §9 — каждый admin adjustment хранит before/after, reason code, ticket/order, actor и approver above threshold, provider payload редактируется в логах.
   - Артефакт/ссылка: technical/schema.sql (entitlement_overrides); docs/21 §3, §9; docs/18 §12.
   - Статус и владелец: Closed · Product

210. What happens when project or storage limits are exceeded?
   - Ответ/решение: По entitlements.csv: `active_projects` (pilot/start=1, control=3, portfolio=8+) — `warn_then_block_new_activation`, существующие данные readable; `office_seats` (8/5/15/custom) — warn затем блок следующего invite; `storage_bytes` (start 50GB, control 200GB) — `warn_then_block_new_upload`, данные readable_exportable, «block new uploads after grace, preserve reads» (doc 21 §4). API отвечает `ENTITLEMENT_LIMIT_REACHED` 409 с userAction archive_or_upgrade; удаления данных нет.
   - Артефакт/ссылка: technical/entitlements.csv; docs/21 §4, §6; technical/error-catalog.csv (ENTITLEMENT_LIMIT_REACHED).
   - Статус и владелец: Closed · Product

211. Can background jobs finish processing objects already received after suspension?
   - Ответ/решение: Да — выделенный класс CA-007 `process_already_received` разрешает во всех состояниях (вкл. suspended/closing, grace/cancelled/export_only) довести объект, durably полученный сервером до parent change, до auditable safe state (server_received|scanning|pending_review), с `do_not_issue_new` для новых leases; первый приём ПОСЛЕ инвалидции идёт по CA-010 в quarantine. Doc 18 §15: «already server-received scan/review may finish only through its dedicated safe-processing class».
   - Артефакт/ссылка: technical/command-availability.csv CA-007/CA-010; docs/18 §15; docs/09 §12; T-LEASE-PARENT-001, T-OFFLINE-REVOKE-001.
   - Статус и владелец: Closed · Architecture

212. How are subscription state and organization state combined in command availability?
   - Ответ/решение: command-availability.csv задаёт для каждого правила одновременно organization_states × subscription_states (+ project/contract/work_phase); применяется правило с наивысшим приоритетом, каждый класс команд заканчивается default deny (CA-901..915). Doc 18 §2 устраняет двойную истину: grace принадлежит подписке (org остаётся active), а suspend подписки атомарно переводит org в suspended либо применяет эквивалентную server-side restriction projection — «реализация выбирает один способ». Матрица консюмится API, sync, workers и UI одинаково (T-COMMAND-AVAILABILITY-001).
   - Артефакт/ссылка: technical/command-availability.csv (колонки organization_states/subscription_states, priority); docs/18 §2, §15; docs/38 §9; T-COMMAND-AVAILABILITY-001.
   - Статус и владелец: Closed · Architecture

213. Can closure be cancelled during cooling-off, and what exact job state controls it?
   - Ответ/решение: Да: `deletion_job` cooling_off→cancel (owner, guard recent_auth_before_execution) и — после v2.9-фикса — scheduled→cancel (guard recent_auth_before_execution_worker_not_started); точка невозврата — старт `execute` (executing), а не scheduling. На уровне организации closing→cancel_closing восстанавливает интерактивный доступ; org response всегда несёт `activeDeletionJobId`, так что статус cooling-off и право отмены не зависят от памяти браузера (операции requestOrganizationClosure/getOrganizationClosure/cancelOrganizationClosure).
   - Артефакт/ссылка: technical/state-transitions.csv (deletion_job, organization); CHANGELOG §2 (deletion_job scheduled→cancel); docs/18 §2, §13; docs/38 §9 (activeDeletionJobId); technical/openapi.yaml (closure ops).
   - Статус и владелец: Closed · Architecture

214. What data is deleted, anonymized, retained, or placed on legal hold after closure?
   - Ответ/решение: Механика полностью машинно специфицирована: 10 retention-классов (doc 24 §9), `data-retention-catalog.csv` покрывает все 126 таблиц с deletion_strategy (anonymize_or_retain_basis, object_inventory_worker, append_only_policy_worker, statutory_policy_worker, expire_then_object_delete…) и legal_hold_behavior (evaluate / preserve_or_restrict); deletion report содержит counts/failures/retained legal bases; unvalidated retention блокирует деструктивный scheduling по умолчанию; backup expiry — отдельное расписание, раскрытое в privacy notice. Но ВСЕ 126 записей остаются `duration_external_gate` со ссылкой на V-003 — длительности не подтверждены counsel/accountant.
   - Артефакт/ссылка: technical/data-retention-catalog.csv (126 записей, policy_status=duration_external_gate); docs/24 §9; docs/18 §13; docs/30 V-003; technical/state-transitions.csv (deletion_job blocked_by_hold).
   - Статус и владелец: Deferred with gate (V-003) · Legal (external)

## 15. Security, privacy, and legal boundaries


215. What are the highest-value assets and highest-impact abuse cases for AktFlow?
   - Ответ/решение: Активы зафиксированы целями doc 25 §1: кросс-тенантные commercial/evidence данные, целостность evidence/quantity/money записей, provenance (без претензии на real-world truth), least-privilege доступ customer/support/integration, восстановимость после компрометации. Abuse-кейсы — таблица §3 с control set и verification: cross-tenant IDOR, privilege escalation, stolen token/share, malicious upload, mobile loss, duplicate/lost command, document tampering, insider/support abuse, webhook/SSRF, supply-chain, log/analytics leak, backup compromise; дублируется в doc 09 §2 (вкл. public lead spam/enumeration).
   - Артефакт/ссылка: docs/25 §1, §3; docs/09 §1–2.
   - Статус и владелец: Closed · Security

216. Which commands require MFA and which additionally require recent-auth step-up?
   - Ответ/решение: MFA обязательна каждому live Pilot пользователю (т.е. любая команда исполняется MFA-аккаунтом); SaaS Billing Operator и все платформенные роли — отдельная платформенная identity с MFA и step-up. Канонический recent-auth список (≤10 минут, doc 19 §7): ownership transfer, bank details, export-all, organization close, requirement waiver create/revoke (добавлено v2.9 и синхронизировано с guards/docs 25/36), integration secret, support grant; guards в state-transitions это дублируют (begin_closing, deletion cancel, export authorize recent_auth_scope).
   - Артефакт/ссылка: docs/19 §7 (канонический список); docs/25 §4; docs/36 §2; CHANGELOG §2 (waiver step-up); technical/state-transitions.csv (recent_auth guards).
   - Статус и владелец: Closed · Security

217. How are session revocation, revoke-all, device inventory, and recovery handled?
   - Ответ/решение: Требования: refresh rotation, session inventory и revoke-all, reset инвалидирует прежние сессии, recovery codes защищены и не обходимы support-ом; революция membership закрывает активные сессии или включает membership-version check на каждом запросе (DB не полагается на stale JWT). Device-lost flow ревокает сессии и флажит pending operation IDs; ограничение честно раскрыто: remote revoke не может гарантированно стереть офлайн-устройство, а session/device inventory — capability identity-провайдера (Supabase Auth), AktFlow гарантирует revoke-all/recent-auth последствия при поддержке провайдера; pre-GA gate требует «MFA/recovery/session revoke works».
   - Артефакт/ссылка: docs/25 §4; docs/19 §7; docs/09 §3, §11; docs/38 §11; docs/23 §9; technical/mobile-security-profile.csv MOB-AUTH.
   - Статус и владелец: Closed · Security

218. Are media originals private by default with short-lived, scope-checked access URLs?
   - Ответ/решение: Да: приватные бакеты и короткие signed grants (doc 25 §6), «no public permanent URLs» (doc 22 §3), «originals private/quarantined until scan» (doc 23 §7), download — только short-lived signed authorization с аудитом; все signed URLs выдаются через BFF/command handlers (клиенту доступна лишь read-only проекция api.project_list). T-EXPORT-001 проверяет: storage key скрыт, ссылка short-lived и audited; download из export `ready` — отдельный logged access grant, не состояние job.
   - Артефакт/ссылка: docs/25 §2, §6; docs/22 §3; docs/23 §7; docs/18 §13; T-EXPORT-001, T-UPLOAD-002.
   - Статус и владелец: Closed · Security

219. Can object names, metadata, thumbnails, logs, or caches leak sensitive project information?
   - Ответ/решение: Каждый канал закрыт явной политикой: логи — structured allowlist/redaction, «no tokens/free text/media/URLs» + автоматические log-тесты (ASVS-LOG-01..03); ошибки — Problem Details запрещает filenames/storage URLs/secrets/raw content; аналитика — только buckets, «never send photo, filename, exact GPS, work description, free-text comment or exact money» (doc 23 §10); push скрывает чувствительный текст/суммы; мобильный кэш минимизирован и скоупирован (MOB-STORAGE, T-MOBILE-001); thumbnails/derivatives — приватные объекты с авторизованным открытием; support-план видит только safe metadata без thumbnails/filenames/free text.
   - Артефакт/ссылка: docs/25 §3, §8; docs/22 §7; docs/23 §10; docs/24 §4; docs/33 §2; technical/asvs-profile.csv ASVS-LOG-*; T-PRIVACY-001.
   - Статус и владелец: Closed · Security

220. How are malware, decompression bombs, unsafe file types, and malicious documents handled?
   - Ответ/решение: Приватный карантин до скана, серверная MIME/dimension detection (декларация клиента не доверяется), size/type limits, AV, strip active content из превью, изолированный sandboxed renderer с size/page/queue лимитами и таймаутами; quarantine блокирует review/package, сохраняя safe metadata record; v2.9 добавил pending_review→quarantine для угрозы, обнаруженной после скана; malware reject для клиента терминален с safe recapture. Фикстуры T-UPLOAD-001: EICAR, polyglot, wrong magic, zip bomb, symlink, pixel flood, huge/truncated/duplicate.
   - Артефакт/ссылка: docs/25 §3; docs/18 §6; docs/23 §7; docs/09 §2, §11; CHANGELOG §2 (capture quarantine); T-UPLOAD-001/002; technical/asvs-profile.csv ASVS-FILE-01..08.
   - Статус и владелец: Closed · Security

221. How are personal data minimization and sensitive-location policies enforced?
   - Ответ/решение: Privacy-дефолты doc 24 §4: GPS optional until justified, no continuous tracking, no face recognition/productivity scoring, device metadata minimized, push скрывает чувствительное, analytics — pseudonymous IDs/buckets, public links запрещены; каждая запись данных обязана иметь purpose/basis/retention class/visibility (§4 inventory). Sensitive sites/wartime (§10): политика заказчика/проекта ограничивает GPS, EXIF, фасады/оборудование, экспорт, external shares, регион хранения и support-персонал; high-sensitivity проект отключает external link/download. Механизм — политики на уровне rule version (camera/gallery/location, doc 23 §8) и конфиг проекта, а не UI-обещания.
   - Артефакт/ссылка: docs/24 §4, §10; docs/09 §6; docs/23 §8; technical/mobile-security-profile.csv MOB-PRIVACY; T-PRIVACY-001.
   - Статус и владелец: Closed · Security

222. Can exact GPS be disabled while still preserving sufficient provenance?
   - Ответ/решение: Да: location method задаётся rule version из трёх вариантов — selected hierarchy (выбор локации из иерархии), optional GPS, required GPS с safety fallback; безопасный дефолт — «GPS optional and never blocks safety-critical work». Provenance не зависит от GPS: серверный receipt/seal, SHA-256, actor/session, lease и immutable subject tuple; клиентские timestamp/metadata хранятся отдельно как untrusted observation; EXIF сохраняется только где разрешает политика. Строгие capture-политики валидируются внешне через V-004, но сам механизм отключения GPS готов.
   - Артефакт/ссылка: docs/23 §7–8, §12; docs/24 §4, §10; docs/09 §7; docs/30 V-004.
   - Статус и владелец: Closed · Security

223. What user consent or notice is required for photos, voice, signatures, and external reviewers?
   - Ответ/решение: Матрица doc 24 §3: фото/голос/локация field worker — customer controller, требуются lawful basis, workforce notice и minimization, транскрипция гейтится отдельно; external reviewer identity/session — privacy notice + contract; подписи — только через уровни assurance и КЕП-gate; cookie/analytics consent конфигурация и Privacy Notice входят в legal pack §2. `acceptInvitation` фиксирует exact versions terms/privacy; микрофонное разрешение запрашивается только при захвате; согласие на маркетинг отдельно и отзываемо. Финальные тексты — PILOT-BLOCKER «privacy notice, terms, subprocessors» (founder + counsel, иначе no pilot).
   - Артефакт/ссылка: docs/24 §2–4; docs/19 §8; docs/09 §5–6; docs/34 §3 (privacy pack gate).
   - Статус и владелец: Closed · Legal (external)

224. Which records may have evidentiary value, and how does UI avoid overstating legal force?
   - Ответ/решение: Doc 24 §1 — граница претензий: internal readiness ≠ договорная приёмка, click ≠ КЕП, фото само не доказывает объём/качество, сумма в dashboard ≠ бухгалтерская дебиторка; система доказывает только системные записи (hash, timestamp, actor/session, lineage), «hashes for integrity, not proof of truth». UI всегда показывает один из 5 explicit уровней assurance (§8) и никогда не повышает click до КЕП (doc 18 §10); юридически чувствительные термины — из terminology.csv; мобильный лейбл — «Підтверджено сервером», а не правовое заявление.
   - Артефакт/ссылка: docs/24 §1, §8; docs/09 §7; docs/18 §10; docs/25 §6; technical/terminology.csv; docs/23 §3.
   - Статус и владелец: Closed · Product

225. How are electronic signatures or seals treated across different customer and country adapters?
   - Ответ/решение: Единая лестница из 5 уровней (workflow comment → operational acknowledgement → authenticated acceptance record → electronic signature → qualified electronic signature) отображается явно; КЕП доступен только через validated provider flow (цепочка/qualified статус, OCSP/CRL, trusted timestamp, hash binding, signer authority, multi-signer order, LTV-архив) и отключён до V-005; отказ «never downgrades silently to click acceptance». Каждый customer adapter собирает required participants/signers и статус артефакта (draft/primary/attachment), каждая страна — versioned country pack с local counsel (doc 24 §7, §11); external decision всегда привязано к exact version и assurance level.
   - Артефакт/ссылка: docs/24 §7–8, §11; docs/30 V-005; docs/18 §10; docs/32; docs/09 §7.
   - Статус и владелец: Closed · Legal (external)

226. Can a user export or delete personal data without destroying legally retained business records?
   - Ответ/решение: Да: doc 24 §5 требует различать user-profile correction и immutable business ledger — «corrections append context rather than falsify records»; DSR workflow включает identity verification, tenant notification, legal-hold check, processor assistance и deadline tracking. Offboarding сохраняет авторство исторических объектов, убирая доступ (doc 18 §3); retention-классы разделяют identity_access от contract_baseline/evidence/package/project_commercial; retention/deletion не может обойти legal hold (data invariant №10).
   - Артефакт/ссылка: docs/24 §5, §9; docs/18 §3, §13; docs/22 §4 (invariant 10); technical/data-retention-catalog.csv (personal_data flag).
   - Статус и владелец: Closed · Data

227. How are secrets and personal data prevented from entering analytics and error tracking?
   - Ответ/решение: Многослойно: structured allowlist/redaction логов без tokens/free text/media/URLs с автоматическими log-тестами (ASVS-LOG-02/03 = v5.0.0-16.2.x/16.3.x); Problem Details запрещает secrets/stack/provider messages/filenames; продуктовая аналитика получает pseudonymous IDs и buckets — pilot-leads шлёт «buckets only and never company, contact or exact delayed amount», мобильные метрики никогда не содержат фото/filename/точного GPS/free text/money; секреты — в managed secret store, service-role не попадает в browser/bundle/логи/crash payloads; raw provider payload и bank details редактируются в billing-логах.
   - Артефакт/ссылка: docs/25 §3, §8; docs/22 §5, §7; docs/23 §2, §10; docs/09 §4, §6; docs/21 §9; technical/asvs-profile.csv ASVS-LOG-*; T-PRIVACY-001.
   - Статус и владелец: Closed · Security

228. Are all privileged support actions tenant-visible and reviewable?
   - Ответ/решение: Да по конструкции гранта: case → scope/duration → одобрение tenant Owner/Admin с recent auth → видимый tenant banner → все чтения/действия аудируются → manual revoke/auto-expiry; `listSupportGrants` восстанавливает requested/active/history для tenant approver. Без гранта support видит только safe metadata (без thumbnails/filenames/free text/commercial rows/credentials); break-glass — два платформенных аппрувера, узкий scope/TTL, real-time alert, immediate review, tenant notification assessment и «cannot erase audit»; прямой SQL не является инструментом поддержки; content access в Pilot вообще отключён до V-012.
   - Артефакт/ссылка: docs/33 §1–5, §7; docs/25 §3 (insider/support abuse), §8; docs/09 §2; docs/30 V-012; T-SUPPORT-001, T-BREAKGLASS-001.
   - Статус и владелец: Closed · Security

229. What security controls are required before live pilot data is allowed?
   - Ответ/решение: Doc 36 §2: все применимые ASVS 5.0.0 L1 + выбранный Pilot-набор L2 (multi-tenant isolation, field/property authorization, upload/download, MFA, identity assertion, data classification, security logging) и все применимые MASVS для включённых мобильных функций; «Live Pilot customer data is prohibited until the Pilot security profile has evidence»; MFA всем живым пользователям + recent-auth step-up. Плюс Pilot-admission гейты doc 34 §3, каждый с failure consequence «no pilot»: RLS deny-default отчёт, лизы офлайн-авторизации, quarantine/upload контроли, immutable ledgers, backup/restore drill, observability/alert delivery, privacy pack.
   - Артефакт/ссылка: docs/36 §2–4; docs/34 §3; docs/25 §4; technical/asvs-profile.csv (Pilot rows); technical/mobile-security-profile.csv (PILOT-BLOCKER).
   - Статус и владелец: Closed · Security

230. What incident-response evidence can be reconstructed after a breach or insider event?
   - Ответ/решение: Append-only audit_events (insert-only для app-ролей, partitioned/retained) + каталог security events: privileged login/MFA/reset, membership/role/scope change, owner transfer, export, external-share abuse, support grant, integration secret, bulk download, RLS-denied patterns, break-glass, retention/legal-hold change; каждый job/request несёт correlation ID; job_attempts/outbox/dead_letters и idempotency receipts дают таймлайн операций. Incident process — «preserve evidence» до восстановления, SEV1/2 стопают деплой; T-AUDIT-001 (immutable complete audit transaction) и support-abuse/lost-device drills — часть pre-GA gate.
   - Артефакт/ссылка: docs/25 §8–10; docs/26 §7–8; docs/24 §6; technical/schema.sql (audit insert-only, security_events); T-AUDIT-001, T-BREAKGLASS-001.
   - Статус и владелец: Closed · Security

## 16. Reliability, idempotency, and asynchronous processing


231. Which operations require HTTP idempotency receipts and which require durable domain operation IDs?
   - Ответ/решение: Каждый POST обязан нести `Idempotency-Key` и декларирует `x-idempotency-class`: в openapi.yaml 99 операций — 81 `standard_30d` (2 592 000 c) и 18 `ledger_400d` (34 560 000 c); успешный POST возвращает `Idempotency-Replay-Until`. Money-ledger команды ДОПОЛНИТЕЛЬНО персистят tenant-scoped `clientOperationId» — «neither substitutes for the other»; durable domain operation IDs обязательны для money/quantity/assignment/concealment (doc 38 §10) и мобильного capture; payment/import source fingerprint — business-слой поверх, не замена idempotency.
   - Артефакт/ссылка: docs/22 §6, §8; docs/38 §10; technical/openapi.yaml (99× x-idempotency-class); docs/18 §5 (client_operation_id).
   - Статус и владелец: Closed · Architecture

232. Can identical retries return the original response even after process or worker restarts?
   - Ответ/решение: Да: `idempotency_records` персистентна в Postgres — хранит actor_scope, operation_id, request_hash, response status/body/headers, состояние in_progress/completed/failed_replayable и expiry, поэтому реплей возвращает stored status/body после любого рестарта процесса. Воркеры используют lease owner/expiry + монотонный `fencing_token` — stale worker не может закоммитить после потери lease. Проверяется T-IDEMP-001 (before/during/after success/failure/TTL) и T-IDEMP-LEASE-001 (expire/steal lease, replay после TTL).
   - Артефакт/ссылка: technical/schema.sql (idempotency_records, jobs.fencing_token); docs/38 §10; docs/22 §8; T-IDEMP-001, T-IDEMP-LEASE-001.
   - Статус и владелец: Closed · Architecture

233. What request differences cause an idempotency-key conflict rather than a replay?
   - Ответ/решение: Same key + same canonical request hash = replay оригинального status/body; same key + другой hash = `IDEMPOTENCY_CONFLICT` 409 (лог — только request_hashes). Ключ скоупится уникальным индексом (organization_id, actor_scope, operation_id, idempotency_key) — другой актор/операция/организация образуют другой scope, а не конфликт; публичный lead-intake отдельно неймспейсится purpose+canonical hash и не может коллидировать с тенантскими командами. После HTTP-expiry дубликат финансового эффекта всё равно блокируют domain uniqueness и `clientOperationId`.
   - Артефакт/ссылка: docs/22 §6, §8; technical/schema.sql (unique nulls not distinct); technical/error-catalog.csv (IDEMPOTENCY_CONFLICT); T-IDEMP-001.
   - Статус и владелец: Closed · Architecture

234. Does the transactional outbox guarantee database state and job intent are committed atomically?
   - Ответ/решение: Да: doc 18 §1 — успешный переход атомарно создаёт version/ledger entry + audit event + transaction-outbox event + idempotency result (+ notification intent/projection refresh); `transaction_outbox` — таблица той же Postgres, так что commit один. Доставка/внешние эффекты — только после commit воркером с retry/dead-letter; «external calls never occur while a domain row lock is held» (doc 38 §10); неуспех не оставляет частично применённых money/quantity переходов.
   - Артефакт/ссылка: docs/18 §1; docs/38 §10; technical/schema.sql (transaction_outbox); docs/25 §3 (duplicate/lost command → chaos/replay tests).
   - Статус и владелец: Closed · Architecture

235. Are all workers safe under at-least-once execution?
   - Ответ/решение: Да как контракт: T-JOB-001 требует «at-least-once processing without duplicate outcome; fenced stale worker»; консюмеры дедуплицируют по outbox event ID + destination; jobs имеют unique(organization_id, type, idempotency_key) и fencing_token; renderer детерминирован — «one accepted artifact set; hashes/manifest deterministic» (T-JOB-002); экспорт финализирует cancel на fenced boundary; retention worker карантинит, а не удаляет unreferenced объекты; webhooks — at-least-once с обязательным consumer dedup (event ID, replay window).
   - Артефакт/ссылка: docs/22 §8, §10; docs/38 §10; docs/24 §9 (retention worker); technical/schema.sql (jobs); T-JOB-001/002, T-IDEMP-LEASE-001, T-EXPORT-CANCEL-001.
   - Статус и владелец: Closed · Architecture

236. How are poison jobs isolated, retried, escalated, and manually resolved?
   - Ответ/решение: Retry: `running→retry_wait` с exponential backoff/attempts и `next_attempt_at`; исчерпание/неретраябельная ошибка → `failed_terminal` c `JOB_RETRY_EXHAUSTED` и safe public error + допустимым retry/cancel действием у пользователя. Isolation: `dead_letters` (redacted_payload, error_code, unique(source_type,source_id), состояния open→replayed|discarded). Эскалация: метрики queue depth/oldest age/retry/dead letter c алертами и обязательный до Pilot runbook «queue backlog/dead letters». Ручное: support plane — retry/cancel safe job, webhook replay после tenant authorization; direct SQL запрещён как нормальный инструмент.
   - Артефакт/ссылка: technical/state-transitions.csv (job); technical/schema.sql (dead_letters); docs/18 §14; docs/26 §4, §7; docs/33 §5; docs/22 §10.
   - Статус и владелец: Closed · SRE

237. Can job cancellation leave partially generated exports or orphaned storage objects?
   - Ответ/решение: Нет по контракту: export cancel из collecting/packaging идёт через `cancel_requested`, воркер финализирует на fenced safe boundary — «partial archives are inventoried and erased before cancelled» с записью в `export_cancellation_receipts»; stale worker не может опубликовать ready link; ready ретроактивно не отменяется. T-EXPORT-CANCEL-001 гоняет отмену в каждом состоянии с инспекцией storage; для рендера T-JOB-002 требует определённый orphan cleanup; generic job cancel из running — lease-fenced.
   - Артефакт/ссылка: technical/state-transitions.csv (export_job); docs/26 §12; docs/18 §13, §15; docs/09 §12; docs/22 §2 (export_cancellation_receipts); T-EXPORT-CANCEL-001, T-JOB-002.
   - Статус и владелец: Closed · Architecture

238. How are long-running document renders tied to immutable source snapshots?
   - Ответ/решение: Snapshot создаётся ДО async generation (`draft_snapshot→generating`); retry использует тот же snapshot или создаёт явно новую версию, и это отображается пользователю; package version хранит exact contract/contract-terms/rule/adapter/renderer/template и source snapshot identities, файлы — hash + manifest; submitted версия immutable, изменение line/evidence/template после submission создаёт новую версию. T-JOB-002: отказ на каждой границе (fetch/render/upload/manifest/completion) при frozen snapshot даёт детерминированные hashes.
   - Артефакт/ссылка: docs/18 §9; docs/38 §8; technical/state-transitions.csv (package_version); T-JOB-002.
   - Статус и владелец: Closed · Architecture

239. What happens when a worker runs with outdated code against newer database state?
   - Ответ/решение: Сценарий нейтрализуется политикой совместимости: expand/migrate/contract и «no destructive schema step in same release that stops old code» гарантируют работоспособность старого кода в окне деплоя; артефакты immutable; command-availability policy и все её хендлеры деплоятся одним compatibility unit — «policy-version drift blocks rollout» (doc 26 §12); outbox/jobs несут `payload_version` для версионирования контрактов консюмеров; stale worker по устаревшему lease отсекается fencing_token независимо от версии кода.
   - Артефакт/ссылка: docs/22 §11; docs/26 §6, §12; technical/schema.sql (jobs.payload_version, transaction_outbox.payload_version, fencing_token); docs/38 §10.
   - Статус и владелец: Closed · SRE

240. Are migrations backward-compatible across web, worker, and mobile deployment windows?
   - Ответ/решение: Да как политика: expand/migrate/contract; backfill — resumable job с reconciliation; rollback восстанавливает совместимую версию приложения, необратимые преобразования требуют restore/forward-fix плана; каждая миграция тестируется на production-scale фикстуре; API — `/v1` с предпочтением additive изменений. Mobile: «app update maintains outbox compatibility for at least one supported prior version», локальная SQLite-схема версионируется с миграциями и safe recovery/export-support mode при сбое.
   - Артефакт/ссылка: docs/22 §6, §11; docs/26 §6; docs/23 §2, §9.
   - Статус и владелец: Closed · Architecture

241. How are database locks and optimistic versions used for high-contention records?
   - Ответ/решение: Optimistic: `version bigint`/expected parent version + обязательный `If-Match` с exact strong ETag (конфликт возвращает текущее безопасное представление и tag). Pessimistic/serializable: нормативный алгоритм doc 18 §11 — PostgreSQL SERIALIZABLE, `SELECT … FOR UPDATE` в возрастающем UUID-порядке, пересчёт сумм из immutable rows внутри транзакции, bounded retry с jitter без частичного эффекта; package numbering атомарно лочит строку numbering series; SaaS-инвойсы — expected version + serializable lock против гонок pay/credit/reversal (T-BILLING-LEDGER-001), acceptance successor — serializable проверка current head.
   - Артефакт/ссылка: docs/18 §11; docs/22 §3, §6; docs/38 §8, §12; T-BILLING-LEDGER-001, T-SAAS-REVERSAL-001.
   - Статус и владелец: Closed · Architecture

242. What are the recovery objectives for database, object storage, queues, and identity provider?
   - Ответ/решение: Числа заданы для БД и сервиса: database PITR RPO ≤60 минут (цель ≤15 при поддержке провайдера), service RTO ≤4 часа; object storage — versioning/redundancy + inventory/hash manifest (без числового RPO); квартальный restore drill, годовое provider-region/founder-unavailable упражнение; Pilot может жить на provider baseline только при раскрытии и протестированном restore. Очередь (outbox/jobs в той же Postgres) и identity provider (Supabase Auth) фактически покрываются DB PITR и runbook «authentication provider outage», но их отдельные RPO/RTO явно не зафиксированы — компоненты из вопроса покрыты неравномерно.
   - Артефакт/ссылка: docs/26 §5, §7; docs/09 §9; T-RESTORE-001 («Declared RPO/RTO measured»), T-DR-001.
   - Обновление (закрыто фиксом 23.07.2026): doc 26 §5: per-component RPO/RTO таблица (DB/object storage/queue/IdP), проверяется T-RESTORE-001
   - Статус и владелец: Closed · SRE

243. Can backups restore both database rows and the exact referenced media versions?
   - Ответ/решение: Да как верифицируемое требование: object versioning/redundancy + inventory/hash manifest; restore drill в изолированную среду обязан пройти «restored DB/object referential and hash checks»; T-RESTORE-001 — reconcile DB object keys/hashes/memberships/audit/outbox без unexplained missing/orphan/cross-tenant данных, с измерением заявленных RPO/RTO. Оригиналы immutable (версии объекта не мутируют), «Backup is not assumed until successful restore evidence exists» — restore evidence является PILOT-BLOCKER, невосстановимая потеря — no-waiver контроль.
   - Артефакт/ссылка: docs/26 §5; docs/09 §9; docs/34 §3 (backup/restore gate); docs/36 §4; T-RESTORE-001.
   - Статус и владелец: Closed · SRE

244. How are missing outbox events, duplicate events, and projection drift detected?
   - Ответ/решение: Пропуски/застревание: метрики «outbox confirmation latency/conflicts», queue depth/oldest age/dead letter, плюс v2.9 отдельные idempotency/reconciliation-мониторы для close cycles/numbering/package generation и алерт «parent change с оставшимся активным lease». Дубликаты: consumer dedup по outbox event ID + destination, dead_letters unique(source_type,source_id). Drift: проекции обязаны реплей-совпадать с immutable источниками (WorkItem.status rebuild «must match exactly», quantity projection сверяется с ledger total), package total/hash и entitlement/billing reconciliation — постоянные метрики; mobile outbox — zero loss/duplicate с invariant alert.
   - Артефакт/ссылка: docs/26 §3–4, §12; docs/18 §4–5; docs/38 §2; docs/22 §8; docs/25 §3 (ledger reconciliation).
   - Статус и владелец: Closed · SRE

245. What system behavior is allowed during partial outages of storage, queue, email, or renderer?
   - Ответ/решение: Каждая зависимость деградирует в свою durable async-машину без потери данных: storage — capture остаётся в device outbox (`local_queued`, SLO zero loss), upload ретраится с checksum/resume; queue/worker — интенты уже закоммичены в transaction_outbox (Postgres) и ждут; email — notification_delivery failed→retry/bounced с preference review; renderer изолирован от request path, package job уходит в retry_wait/failed_terminal с safe reason и retry/cancel action у пользователя (job-стандарт doc 18 §14). Runbooks по всем четырём сценариям обязательны до Pilot; SLO исключает документированный клиентский offline, но включает server handling после связи.
   - Артефакт/ссылка: docs/26 §2–3, §7; docs/18 §14; docs/23 §3–5; technical/state-transitions.csv (job, notification_delivery, webhook_delivery).
   - Статус и владелец: Closed · SRE

246. Which SLOs and alerts are required before onboarding the first paid pilot?
   - Ответ/решение: Pilot SLO (doc 26 §3): authenticated web read 99.5%/мес, capture receipt 99% <10s online, mobile outbox — zero known loss/duplicate quantity (invariant alert), package job 95% <5 мин, external review page 99.5%, P1 ack — business-day policy; error budget управляет темпом релизов, «no availability claim without measured telemetry». Алерты: метрики §4 (queue/outbox/RLS denials/backup age и др.) + go-live checklist «alerts tested with receiver», rate limits/quotas/cost alerts active; Pilot-admission gate — «observability and alert delivery: synthetic failure + received alert + runbook link», иначе no pilot.
   - Артефакт/ссылка: docs/26 §3–4, §11; docs/34 §3 (observability gate).
   - Статус и владелец: Closed · SRE

## 17. Analytics, readiness metrics, and explainability


247. Can the north-star metric be calculated from immutable event or ledger data?
   - Ответ/решение: Да. North-star формально определён через канонические состояния (`readiness: evidence_missing/review_pending → packaged` + вход строки в `package.submitted`), а источники — иммутабельные структуры: снапшот `package_versions/package_lines` с хешами/итогами, receipts `package_submissions`, append-only quantity ledger; проекция readiness пересобирается из ledger (T-READY-002 «rebuild matches»). Продуктовые события (`readiness_changed`, `package_submitted`) бакетируют суммы — точные значения считаются из операционной БД, что явно оговорено (doc 11 §3).
   - Артефакт/ссылка: docs/00 «North-star metric»; docs/11 §1, §3, §5; technical/state-catalog.csv; technical/events.csv (readiness_changed, package_submitted); test-catalog T-PACK-001, T-READY-002.
   - Статус и владелец: Closed · Data

248. Does performed-to-ready time exclude periods when the customer intentionally paused work?
   - Ответ/решение: Нет. Guardrail «median time from performed → ready» (doc 00) и leading-метрики doc 11 не определяют правило часов: состояние `project.paused` существует в state-catalog и инвалидирует lease, но нигде не сказано, что интервалы паузы исключаются из метрики или отражаются отдельно. SLO-исключение «documented client offline time» (doc 26 §3) относится к availability, а не к продуктовой метрике. Минимальный фикс: определить в doc 11 clock-rules метрики (исключать интервалы `project.paused` либо репортить сегментом).
   - Артефакт/ссылка: docs/00 Guardrails; docs/11 §1; technical/state-catalog.csv (project.paused); docs/26 §3.
   - Обновление (закрыто фиксом 23.07.2026): doc 11 §1 clock rules: интервалы paused исключаются сегментацией
   - Статус и владелец: Closed · Data

249. How is returned work value attributed when one package line has multiple causes?
   - Ответ/решение: Частично решено: одна финансовая строка пакета имеет ровно одно финансовое решение (accepted/returned/modified amount), а множественные причины представлены типизированными issues с severity/owner/due (S21: «One financial line may display many typed issues»; событие `package_decision_issue_changed`). Однако правило атрибуции ВОЗВРАЩЁННОЙ СТОИМОСТИ по нескольким причинам (primary cause vs split) не задано — метрика «% work value returned из-за недостающих доказательств» при мульти-причинной строке неоднозначна. Фикс: зафиксировать в doc 11/22 правило (например, primary reason_code на строку + issues как вторичная разбивка без денежного веса).
   - Артефакт/ссылка: docs/04 S21, S42; docs/20 F22; technical/events.csv (package_line_decisions_recorded decision_mix, package_decision_issue_changed, package_returned reason_code); test-catalog T-PACKAGE-ISSUE-001.
   - Обновление (закрыто фиксом 23.07.2026): doc 11 §6: primary reason = issue с максимальной суммой; полный набор — drill-down; сумма атрибуций = возвращённой сумме
   - Статус и владелец: Closed · Data

250. Can metrics be sliced by project, contract, work type, location, team, rule version, and customer?
   - Ответ/решение: Частично. В операционном слое срезы в основном есть: work-register фильтры state/readiness/location/assignee/rule/period (S13), отчёты «readiness by project, recurring blocker, reviewer SLA, rejection cause, aging» + builder с role-approved dimensions (S23), `engine_version` на `readiness_changed`, customer в колонках проектов (S11). Но единый каталог разрезов метрик не специфицирован: «work type» как измерение нигде не определён, срез по rule version есть только в событии, а в продуктовой аналитике location/team/customer сознательно исключены PII-политикой. Фикс: зафиксировать в doc 04 S23/doc 11 каталог dimensions (contract, work type, location, team, rule version, customer) для операционной отчётности.
   - Артефакт/ссылка: docs/04 S11/S13/S23; docs/11 §3 (запрет location/identity), §6; technical/events.csv (readiness_changed.engine_version, pii_policy).
   - Обновление (закрыто фиксом 23.07.2026): doc 11 §6 canonical dimensions; location/team/customer исключены PII-политикой
   - Статус и владелец: Closed · Data

251. Are money totals always labeled with currency and aggregation limitations?
   - Ответ/решение: Да. Полный формат денег с валютой (`2 650 000,00 ₴`), компактные значения с точным accessible-лейблом, «Never combine values from different currencies» и обязательная валюта/единицы на графиках (doc 05 §5–6); «dates/money/units carry locale and source timezone/currency» (doc 27 §7); GA-гейт прямо запрещает cross-currency агрегат без conversion policy (doc 34 §5). KPI показывают формулу и знаменатель («No percent without denominator», S10).
   - Артефакт/ссылка: docs/05 §5–6; docs/27 §7; docs/34 §5 «multi-project/currency/tax boundaries»; docs/04 S10.
   - Статус и владелец: Closed · Design

252. Can every readiness score be expanded into requirements, blockers, owner, age, and affected amount?
   - Ответ/решение: Да. Контракт `listReadinessBlockers` обязателен: каждый blocker называет exact subject/occurrence, owner, due date, affected quantity/value, evidence/waiver state и одно поддержанное действие; «UI never asks the client to infer blockers from totals» (S14). Close-кокпит группирует blockers по ответственным (S19), T-READY-002 требует, чтобы каждая сумма разворачивалась в lines/reasons/input hash с пересборкой из ledger; explainability — exit-критерий P0-C.
   - Артефакт/ссылка: docs/04 S14, S19; test-catalog T-READY-001/T-READY-002; docs/28 P0-C exit; docs/20 F08.
   - Статус и владелец: Closed · Product

253. How are manual overrides measured and reviewed for rule quality problems?
   - Ответ/решение: Измерение: события `readiness_override_created` (actor_role, reason_code, scope_type, expiry_bucket, value_bucket) и guardrail «доля ручных override» (doc 00); waiver имеет TTL/revoke и раскрывается в package manifest (T-WAIVER-001, T-WAIVER-REVOKE-001). Ревью: еженедельный «permission, support-hour and exception review» в pilot runtime controls (doc 34 §4), отчёты «recurring blocker / rejection cause» (S23) и петля «rule set обучается на причинах возвратов, изменения подтверждает администратор» (doc 00 core loop 9; Workflow G шаг 6).
   - Артефакт/ссылка: technical/events.csv (readiness_override_created); docs/00 Guardrails + core loop; docs/34 §4; docs/04 S23; docs/03 Workflow G; test-catalog T-WAIVER-001.
   - Статус и владелец: Closed · Product

254. Can sync completion rate distinguish user abandonment from technical failure?
   - Ответ/решение: Да, на уровне событийной грамматики: воронка `capture_started → capture_saved_local → capture_submitted` отделяет брошенный пользователем capture (started без saved_local) от технического сбоя — `capture_sync_failed` несёт error_code, attempt_bucket и outbox_age_bucket, а `sync_conflict_detected` — тип конфликта; терминальные vs транзиентные сбои разделены протоколом retry (doc 23 §5). Guardrails doc 00 также разводят «field capture completion rate» и «sync failure rate» как разные метрики.
   - Артефакт/ссылка: technical/events.csv (capture_started/saved_local/submitted/sync_failed, sync_conflict_detected); docs/23 §5, §10; docs/00 Guardrails.
   - Статус и владелец: Closed · Data

255. How are analytics events deduplicated across retries and offline synchronization?
   - Ответ/решение: Частично. Серверные события привязаны к committed-транзакциям («server confirms command», «…committed»), а команды идемпотентны через `clientOperationId`/Idempotency-Key — один commit порождает одно событие; request ID входит в стандартные свойства (doc 11 §3). Но явный dedup-ключ для чисто клиентских событий (capture_started, capture_saved_local при рестартах приложения) не задокументирован. Фикс: дописать в doc 11 §3 правило дедупликации клиентских событий (clientOperationId/session+операция).
   - Артефакт/ссылка: docs/11 §3; technical/events.csv (trigger-колонка); docs/23 §3–4; test-catalog T-IDEMP-001.
   - Обновление (закрыто фиксом 23.07.2026): doc 11 §3: dedup клиентских событий по clientOperationId + event_name
   - Статус и владелец: Closed · Data

256. Can analytics be recomputed after taxonomy changes without rewriting operational history?
   - Ответ/решение: Частично. Разделение слоёв закреплено (doc 11 §5: аналитика минимизирована и отделена от полного иммутабельного audit), схемы событий версионируются и тестируются, у property-словарей есть owner/retention (doc 11 §8, колонка version в events.csv); readiness пересчитывается по engine_version без изменения истории. Но процедура reprocessing/backfill аналитики при смене таксономии (например, remap reason_code) не описана. Фикс: короткий раздел в doc 11 §8 о версионированном пересчёте витрин из сырых событий.
   - Артефакт/ссылка: docs/11 §5, §8; technical/events.csv (version); test-catalog T-READY-001 (engine version).
   - Обновление (закрыто фиксом 23.07.2026): doc 11 §8: versioned recompute производных витрин без переписывания event log
   - Статус и владелец: Closed · Data

257. Which metrics are leading indicators of faster submission and which are vanity metrics?
   - Ответ/решение: Разделение задано явно: leading — time to first import/first capture, доля performed value с полным evidence до close, median return loop, package generation/submission rate, collaboration; lagging — returned value rate, days performed→paid, overdue, retention (doc 11 §1). Vanity прямо исключены: north-star «It is not total uploaded photos or logins», weekly-active организация требует значимого события, «не login alone» (doc 11 §4 Retention).
   - Артефакт/ссылка: docs/11 §1, §4; docs/00 North-star + Guardrails.
   - Статус и владелец: Closed · Product

258. How will the pilot prove causation or at least credible contribution rather than simple correlation?
   - Ответ/решение: Через baseline-vs-outcome и experiment discipline, без ложной статистики: pilot success contract фиксирует baseline последнего закрытия (hours, returned value, days, evidence misses) до старта и сравнимые success targets (doc 14 §5); каждый эксперимент обязан иметь гипотезу/segment/guardrail и запрет «statistical certainty from ten accounts» — событийные данные комбинируются с записанными workflow-интервью (doc 11 §7); Stage-0 включает concierge-аудит, доказывающий ценность до полного билда, а doc 28 §9 запрещает fabricated ROI.
   - Артефакт/ссылка: docs/14 §5; docs/11 §7; docs/12 Stage 0; docs/28 §9; docs/30 §4.
   - Статус и владелец: Closed · Product

259. Can a customer verify dashboard totals against exported source lines?
   - Ответ/решение: Да. Каждый график обязан иметь downloadable underlying data (doc 05 §6), каждый агрегат открывает pre-filtered список, KPI раскрывают формулу и timestamp (S10); T-READY-002 требует, чтобы каждая сумма мапилась на строки/причины и пересборка из ledger совпадала; отчёты экспортируются с row-level access (S23), audit — signed CSV/JSON (S36), package manifest сверяется line-by-line к фикстуре (doc 34 pilot gate «period preflight and versioned package export»).
   - Артефакт/ссылка: docs/05 §6; docs/04 S10/S23/S36; test-catalog T-READY-002, T-RECON-001; docs/13 §3.
   - Статус и владелец: Closed · Data

260. How are missing or low-confidence data areas displayed rather than silently estimated?
   - Ответ/решение: Правило «не выдумывать» проведено сквозь спецификацию: «No percent without denominator» и `Оновлено …` (S10); empty-состояния с причиной и следующим шагом (doc 04 §2); финансово-юридические поля никогда не инферятся — неподтверждённые placeholder'ы видимы и блокируют зависимые правила (S06); аномалии evidence — предупреждения, а не автоматические обвинения (S15); claimed vs authoritative reporting date показываются раздельно; «Збережено на пристрої» вместо ложного «Надіслано» (S27).
   - Артефакт/ссылка: docs/04 §2, S06, S10, S15, S27; docs/05 §5 Voice; docs/23 §12.
   - Статус и владелец: Closed · Design

261. What alerts identify impossible equations or metric drift?
   - Ответ/решение: Определены на уровне SLO/observability: «mobile outbox no data loss/duplication — zero; invariant alert» (doc 26 §3); метрики «package total/hash reconciliation» и «entitlement/billing reconciliation» (doc 26 §4); v2.9 добавил отдельные idempotency/reconciliation-мониторы для close cycles, numbering и package generation, alert на parent-change с живым lease и age/stuck-alerts по quarantine/offboarding/issue backlogs (doc 26 §12). Инвариант performed = ready + risk закреплён тестом T-READY-002; алерты проверяются драйвом T-ALERT-001 (synthetic failure → received alert → runbook link).
   - Артефакт/ссылка: docs/26 §3, §4, §12; test-catalog T-READY-002, T-ALERT-001; docs/13 §3.
   - Статус и владелец: Closed · SRE

## 18. Evidence Graph architecture


262. What are the canonical node types in the Evidence Graph?
   - Ответ/решение: Девять слоёв узлов, закреплённых за существующими таблицами: Tenancy (Organization/Project), Commercial baseline (Contract/Versions/Terms, WorkItem-lineage), Execution (WorkAssignment, QuantityEntry ledger, RequirementOccurrence, OccurrenceTriggerEvent), Rules & references (EvidenceRuleVersion, RulePackVersion, ReferenceDocumentVersion), Evidence (CaptureSession, EvidenceObject, TypedEvidenceRecord), Decisions (ReviewTask/Decision+corrections, HoldPointDecision, ConcealmentEvent, Waiver+revocations), Close & submission (Period, PeriodCloseCycle, PackageVersion/Line, PackageSubmission), External outcome (ExternalDecision, DecisionSet/Item/Issue, AcceptanceRecord), Money (Receivable+adjustments, Payment, PaymentAllocation, Reversal) + Actor-контекст. SaaS-биллинг из графа исключён намеренно. Идентичность узла — (organization_id, node_type, id).
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §1; `technical/schema.sql`
   - Статус и владелец: Closed · Architecture
263. What are the canonical edge types, direction, cardinality, and validity rules?
   - Ответ/решение: 16 канонических рёбер с владельцем-фактом, направлением, кардинальностью и правилом валидности: belongs_to, baseline_of, assigned_scope, performed_by, requires, proves (N:M через `evidence_requirement_links`), decided_by, claims (N:M exclusive через `package_line_quantity_sources`), evidences, snapshot_of, submitted_as, judged_by, accepted_as (single current head), owed_from, paid_by, supersedes (ацикличное). Каждое ребро — строка FK/link-таблицы, а не отдельный edge-store.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §2
   - Статус и владелец: Closed · Architecture
264. Which graph relationships are primary domain facts and which are derived projections?
   - Ответ/решение: Все рёбра §2 — первичные факты (immutable versions, append-only ledgers/receipts или mutable operational state под state machine). Derived-слой — только узловые проекции (work_item projected status, readiness_snapshots, суммы под риском): они не создают рёбер, пересчитываемы из фактов и несут projection_updated_at; AI-гипотезы — четвёртый слой вне доменной БД.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §3
   - Статус и владелец: Closed · Architecture
265. Can every graph edge be traced to a command, import, rule evaluation, or human decision?
   - Ответ/решение: Да — инвариант G-2: каждое ребро возникает только из команды/импорта/детерминированной оценки правила/человеческого решения и имеет производящий audit event с actor, command, aggregate+object_version, reason_code (для guarded), timestamp и correlation ID (контракт аудита doc 18 §1, расширен фиксом 23.07.2026).
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §2, §4 (G-2); `docs/18-domain-state-machines.md` §1
   - Статус и владелец: Closed · Architecture
266. How are node and edge versions represented without losing historical topology?
   - Ответ/решение: Версии узлов — собственные versioned-таблицы (contract/terms/rules/reference versions, lineage у work items); версии рёбер — pinned exact versions в самих фактах (assignment пиннит terms/rules/reference; package line пиннит evidence versions в snapshot) плюс supersedes-цепочки (G-5: ацикличность, single current head). Историческая топология не удаляется: superseded остаётся читаемым.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §2 (validity), §4 (G-5, G-6)
   - Статус и владелец: Closed · Architecture
267. Can the graph answer why a work item is blocked using only deterministic facts?
   - Ответ/решение: Да — канонический путь «why blocked»: WorkItem → missing/failed RequirementOccurrence → EvidenceRuleVersion + owner + age + affected amount; это уже материализовано read-моделью `listReadinessBlockers`/ReadinessBlocker и объяснимо без AI (детерминированный readiness — ADR-006).
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §6; `technical/openapi.yaml` (listReadinessBlockers)
   - Статус и владелец: Closed · Architecture
268. Can the graph answer which money is exposed by one missing evidence object without double-counting?
   - Ответ/решение: Да — путь EvidenceObject → links → Occurrences → Assignments → WorkItems → open PackageLines, где деньги считаются исключительно через exclusive claims (`package_line_quantity_sources`, инвариант G-3: одна quantity-запись — максимум один открытый claim), что исключает двойной счёт конструкцией. В Pilot поверхность — invalidation impact receipt; отдельная операция — GA-кандидат в реестре doc 37.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §4 (G-3), §6; `docs/37` (Evidence impact query)
   - Статус и владелец: Closed · Architecture
269. How are shared documents or evidence linked to multiple work items while preserving permitted scope?
   - Ответ/решение: Только явными линками `evidence_requirement_links` на каждый occurrence (G-4: случайного double-proof нет — каждый линк видим в manifest); доступ при обходе проверяется на каждом hop той же RLS/permission-моделью, что и прямое чтение (§5), поэтому шаринг доказательства не расширяет scope читателя.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §2 (proves), §4 (G-4), §5
   - Статус и владелец: Closed · Architecture
270. How are superseded and invalidated relationships represented?
   - Ответ/решение: Supersede — направленное ребро версия→предшественник в самих таблицах (acceptance/submission/versions/corrections) с G-5 (ацикличность, одна текущая голова); инвалидация evidence — append-only факт (EVI-receipt), который не удаляет исходные линки, а помечает зависимые оценки stale и порождает correction-работу; submitted snapshots не мутируют.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §2 (supersedes), §3; `docs/20` (invalidation), `docs/18` §11
   - Статус и владелец: Closed · Architecture
271. Can the graph traverse from payment back to package, work quantity, evidence, actor, and contract term?
   - Ответ/решение: Да — канонический путь «Payment → origin»: PaymentAllocation → Receivable → AcceptanceRecord → PackageVersion → Lines → QuantityEntries (+actors) + EvidenceObjects + ContractTermsVersion; все звенья — существующие FK/link-таблицы, каждая с pinned версиями.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §6 (Payment → origin)
   - Статус и владелец: Closed · Architecture
272. Can the graph traverse from a defect or return reason to every affected package and amount?
   - Ответ/решение: Да — путь «returns by rule/reason»: reason codes живут на typed issues (`package_decision_issues`) и decision items; от EvidenceRuleVersion или reason code — к строкам, пакетам и суммам (server-derived) с атрибуцией primary reason (правило doc 11 §6, фикc 23.07.2026: сумма атрибуций = возвращённой сумме).
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §6; `docs/11` §6
   - Статус и владелец: Closed · Architecture
273. What graph queries must be fast enough for interactive UI?
   - Ответ/решение: Пять канонических запросов §6 (why blocked, money exposed, line proof, returns by rule, payment origin) с бюджетом p95 ≤500 ms на Stage C; глубина путей ≤6, горячие агрегаты — материализованные проекции.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §6, §7
   - Статус и владелец: Closed · Architecture
274. Should the graph be implemented in relational Postgres first, and what would justify a graph database later?
   - Ответ/решение: Да — PostgreSQL-first закреплён ADR-019: рёбра = FK/link-таблицы, обходы = joins/recursive CTE, один контур RLS/backup. Переход к graph DB оправдан только измеренным триггером: p95 канонических multi-hop запросов стабильно выше бюджета на Stage C после индексных/материализационных оптимизаций.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §7; `docs/31` ADR-019
   - Статус и владелец: Closed · Architecture
275. How are tenant boundaries and permission filters enforced during graph traversal?
   - Ответ/решение: G-1: кросс-tenant рёбер не существует на уровне БД (композитные organization_id FK); обходы — только allowlisted параметризованные пути, на каждом hop действует RLS family + permission matrix, недоступные ветки сворачиваются в closed totals; external reviewer видит строго подграф exact package version через share session.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §4 (G-1), §5; `docs/35`
   - Статус и владелец: Closed · Security
276. Can AI query the graph only through a constrained, auditable semantic layer?
   - Ответ/решение: Да (нормативно; AI в Pilot нет): доступ будущего AI — только параметризованные запросы §6 без произвольного SQL/traversal, каждый вызов аудируем; введение AI-фичи проходит gate doc 12 §8, частью которого является этот контракт.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §8; `docs/12` §8
   - Статус и владелец: Closed · Architecture
277. How are AI-generated hypotheses separated from verified graph facts?
   - Ответ/решение: Четвёртый слой §3: гипотезы живут вне доменной БД (analytics-плоскость), ссылаются на exact node IDs/versions, имеют статус proposed/confirmed/rejected и никогда сами не становятся рёбрами: факт рождается только человеческой командой с обычными guard-ами (ADR-006/D-006). Хранимый AI-слой требует полного контракта schema+retention+access+events на gate.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §3, §8
   - Статус и владелец: Closed · Architecture
278. What explanations should the UI generate from graph paths, and how are they made human-readable?
   - Ответ/решение: Объяснения генерируются только из пройденного пути и цитируют node IDs + версии (blocker-карточки: правило+владелец+возраст+сумма; line proof: manifest доказательств с exact versions; invalidation receipt: затронутые оценки и correction). Терминология — канонические ui_uk лейблы state-catalog/terminology; объяснение без пути не возвращается.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §6, §8; `technical/terminology.csv`
   - Статус и владелец: Closed · Design
279. Can graph integrity be validated with invariants and scheduled consistency checks?
   - Ответ/решение: Да — G-1…G-7: строительные инварианты проверяет пакетный валидатор (композитные FK, reachability/co-reachability, claims, parity), runtime добавляет nightly consistency job (orphan edges, double-claim scan, supersede-циклы, projection drift) с алертами doc 26 §4; расхождение — алерт, не тихий ремонт.
   - Артефакт/ссылка: `docs/39-evidence-graph.md` §4, §9; `scripts/validate_package.py`; `docs/26` §4
   - Статус и владелец: Closed · SRE

## 19. AI and automation governance


280. Which AI use cases create suggestions only, and which may trigger reversible automation?
   - Ответ/решение: В Pilot AI use cases отсутствуют полностью: readiness engine детерминированный, P0-C03 требует «state and reasons recompute from versioned inputs with no AI decision», ai_*-событий в events.csv нет. Для будущего зафиксирован единственный допустимый класс — suggestion-only (extract/map/draft; подсказки photo quality/mapping/classification) с confidence + source + подтверждением человека; класса «обратимой автоматизации» не существует вовсе, автономные правки — явный анти-скоуп. Классификация конкретных AI use cases появится только при их введении через expansion gate doc 12 §8.
   - Артефакт/ссылка: docs/15-risks-decisions.md D-006; docs/31-architecture-decisions.md ADR-006; docs/01-prd.md §3 п.4; docs/02-market-competition.md §6 («AI | Extract/map/draft | Confidence + source + human approval | Autonomous financial edits»); docs/37-functional-closure-feature-register.md §2 (No-build); technical/implementation-backlog.csv P0-C03; technical/events.csv
   - Статус и владелец: Not applicable (Pilot core работает без AI; suggestion-only принцип зафиксирован) · Product

281. Can AI ever approve evidence, waive a requirement, change money, or record legal acceptance?
   - Ответ/решение: Нет, и это закрыто многослойно: ADR-006 «AI cannot approve money/evidence», D-006 «it cannot silently approve money», PRD-инвариант «Readiness never relies only on AI confidence», waiver «никогда не создаётся AI или anonymous external reviewer» (doc 18 §7), а «AI photo quality/acceptance decision» внесён в реестр обещаний как No-build («human/rules remain authoritative»). Юридическая приёмка фиксируется только через signed artifact / exact-version external decision / manual receipt (source-of-truth таблица doc 17 §5).
   - Артефакт/ссылка: docs/31-architecture-decisions.md ADR-006; docs/15-risks-decisions.md D-006; docs/01-prd.md §6 (инвариант); docs/18-domain-state-machines.md §7 (waiver); docs/37-functional-closure-feature-register.md §2, §5; docs/17-production-readiness-index.md §5
   - Статус и владелец: Closed · Architecture

282. What exact context is sent to an LLM, and how is tenant data isolated?
   - Ответ/решение: Сейчас — ничего: ни один runtime-путь Pilot/GA-модели не вызывает LLM, Pilot прямо «performs no external speech transcription» (doc 09 §6). Единственное будущее обещание — GA-transcription голосовых заметок, включаемая только после processor/privacy/quality gate; для любого будущего AI-процессора зафиксировано правило: отдельная фича, subprocessor review, customer instruction, opt-in/contract basis и «no model training on customer content by default». Точный состав контекста и tenant-изоляция определяются на этом gate, не раньше.
   - Артефакт/ссылка: docs/24-legal-regulatory-gates.md §3; docs/01-prd.md FR-05; docs/09-security-compliance.md §6; docs/30-validation-evidence-register.md V-011 (вендорские DPA/residency/security)
   - Статус и владелец: Deferred with gate (doc 24 §3 + FR-05 processor/privacy/quality gate; вендор — V-011) · Security

283. Are prompts, models, parameters, and output schemas versioned for reproducibility?
   - Ответ/решение: Версионировать нечего — prompts/моделей/AI-параметров в продукте нет. Общая дисциплина пакета (immutable versions для правил, шаблонов, адаптеров, планов; запрет «нового состояния в одном слое») задаёт обязательный паттерн, который должен быть распространён на AI-конфигурацию в спецификации фичи при её введении через gate doc 24 §3.
   - Артефакт/ссылка: technical/events.csv, technical/implementation-backlog.csv (нет AI-артефактов); docs/17-production-readiness-index.md §6; docs/24-legal-regulatory-gates.md §3
   - Статус и владелец: Not applicable (нет AI-компонентов; требование фиксируется вместе с фичей) · Data

284. How are hallucinations prevented from becoming domain facts?
   - Ответ/решение: Структурно: у AI нет пути записи в домен. Readiness пересчитывается детерминированно из versioned inputs «with no AI decision» (P0-C03); source-of-truth таблица признаёт фактами только authorized-команды, immutable ledger-записи и подтверждённые пользователем импорты; любая будущая AI-подсказка становится фактом только через обычную валидируемую человеческую команду (confidence + source + human approval). Галлюцинации архитектурно не имеют write-path.
   - Артефакт/ссылка: technical/implementation-backlog.csv P0-C03; docs/17-production-readiness-index.md §5; docs/01-prd.md §6; docs/31-architecture-decisions.md ADR-005/ADR-006; docs/02-market-competition.md §6
   - Статус и владелец: Closed · Architecture

285. Does every AI result include confidence, source references, model version, and reviewer decision?
   - Ответ/решение: AI-результатов в продукте нет — проверять нечего. Рамка для будущего зафиксирована частично: «Confidence + source + human approval» — обязательная граница любого AI (doc 02 §6, D-006); требование фиксировать model version не записано и должно войти в спецификацию AI-фичи при её введении через gate.
   - Артефакт/ссылка: docs/02-market-competition.md §6; docs/15-risks-decisions.md D-006; docs/24-legal-regulatory-gates.md §3
   - Статус и владелец: Not applicable (принцип confidence+source+approval зафиксирован; полная схема — при введении AI) · Product

286. Can users correct AI classifications, and are those corrections retained for evaluation?
   - Ответ/решение: AI-классификаций нет — корректировать нечего. Универсальная append-only модель коррекций (invalidation/correction lineage, review-decision correction) уже покрывает любые данные и станет носителем таких исправлений; отдельный retention корректировок как eval-датасета не специфицирован и появится вместе с AI-фичей (с учётом запрета обучения на данных клиентов по умолчанию, doc 24 §3).
   - Артефакт/ссылка: docs/01-prd.md §8 (append-only коррекции); docs/18-domain-state-machines.md §6–7; docs/24-legal-regulatory-gates.md §3
   - Статус и владелец: Not applicable · Product

287. How are prompts protected from malicious content inside uploaded documents?
   - Ответ/решение: Prompt-поверхности не существует — загруженные документы никуда в LLM не попадают. При этом все uploads уже трактуются как untrusted: quarantine bucket/prefix, type/malware scan, `pending_review→quarantine`, immutable original и derivatives (ADR-008, doc 07 §6) — это остаётся первым барьером и для будущего AI-инжеста; prompt-injection-контроли должны быть добавлены в спецификацию AI-фичи при её введении.
   - Артефакт/ссылка: docs/07-technical-architecture.md §6; docs/31-architecture-decisions.md ADR-008; CHANGELOG-AUDIT-FIX-20260723.md §2 (capture quarantine); docs/24-legal-regulatory-gates.md §3
   - Статус и владелец: Not applicable · Security

288. Can AI process redacted derivatives instead of sensitive originals?
   - Ответ/решение: AI-обработки нет, но механизм для этого уже существует и зафиксирован: redaction derivative создаётся при сохранении оригинала под контролируемым доступом (ADR-008; privacy default «redaction derivative preserves original under controlled access»). Будущий AI-процессор может получать redacted derivative без изменения модели данных; выбор входа станет частью processor gate doc 24 §3.
   - Артефакт/ссылка: docs/31-architecture-decisions.md ADR-008; docs/24-legal-regulatory-gates.md §3–4; docs/01-prd.md §3 п.5 (source preservation)
   - Статус и владелец: Not applicable (механизм derivatives готов; AI-использование — за gate) · Security

289. What happens when an AI provider is unavailable or changes behavior?
   - Ответ/решение: Ни один runtime-путь Pilot/GA-core не зависит от AI-провайдера, поэтому его недоступность/дрейф не влияет на evidence-to-submission loop — деградировать нечему. Для единственного будущего AI-смежного обещания (GA-transcription) принцип уже задан: immutable original сохраняется и не заменяется, ручная текстовая заметка всегда доступна (FR-05); будущий вендор проходит V-011 (DPA/security/residency) до включения.
   - Артефакт/ссылка: docs/01-prd.md FR-05; docs/09-security-compliance.md §6; docs/30-validation-evidence-register.md V-011; docs/15-risks-decisions.md D-006
   - Статус и владелец: Not applicable (нет AI-зависимости в runtime) · SRE

290. Can the product operate without AI while preserving the core evidence-to-submission flow?
   - Ответ/решение: Да — это базовое проектное решение, а не деградированный режим: весь обязательный Pilot end-to-end path (workspace → import → rules → assignment → offline capture → review → deterministic readiness → package → submission receipt → audit/export) работает полностью без AI; «детерминированный readiness engine без AI approval» входит в Pilot, «AI classification/approval» — явно вне Pilot runtime, а expansion gate разрешает добавлять AI только там, где измеренно падает correction time без потери доверия.
   - Артефакт/ссылка: docs/17-production-readiness-index.md §2 (Pilot включает/не включает); docs/15-risks-decisions.md D-006; technical/implementation-backlog.csv P0-C03; docs/12-roadmap-delivery.md §8
   - Статус и владелец: Closed · Product

291. Which evaluation dataset and acceptance thresholds are required before enabling each AI feature?
   - Ответ/решение: AI-фичи сами deferred, и критерий их включения зафиксирован только качественно: «Add AI only where measured correction time drops without weakening trust» (doc 12 §8), для transcription — processor/privacy/quality gate (FR-05), для процессора — subprocessor review/opt-in (doc 24 §3). Конкретные eval-датасеты и численные acceptance-пороги не определены — они должны стать обязательной частью gate каждой AI-фичи при её введении.
   - Артефакт/ссылка: docs/12-roadmap-delivery.md §8; docs/01-prd.md FR-05; docs/24-legal-regulatory-gates.md §3; docs/30-validation-evidence-register.md (V-011 для вендора)
   - Статус и владелец: Deferred with gate (doc 12 §8 / doc 24 §3 / FR-05; вендор — V-011) · QA

292. How are false-positive and false-negative costs measured for mapping, quality, and defect suggestions?
   - Ответ/решение: Таких suggestion-фич нет, и рамка измерения FP/FN-издержек не определена. Единственный зафиксированный измеримый критерий — снижение measured correction time без ослабления доверия (doc 12 §8) плюс guardrail «доля ручных override» в North-star метриках; методика FP/FN-стоимости должна войти в eval-gate соответствующей AI-фичи до её включения.
   - Артефакт/ссылка: docs/12-roadmap-delivery.md §8; docs/00-product-brief.md (guardrails); docs/15-risks-decisions.md D-006
   - Статус и владелец: Deferred with gate (doc 12 §8; методика — при введении фичи) · Data

293. Can AI explanations cite exact graph nodes and evidence versions rather than inventing rationale?
   - Ответ/решение: AI-объяснений нет — объяснимость реализована детерминированно и уже обязана ссылаться на точные сущности: explainability endpoint возвращает requirements/evidence/waiver/reason/owner, evaluation snapshots версионированы, «Explainability» — PILOT-BLOCKER-требование P0-C03. Это фиксирует паттерн «объяснение = точные версии requirement/evidence/rule», которому обязан следовать любой будущий AI-слой (suggestion с source references, doc 02 §6).
   - Артефакт/ссылка: docs/01-prd.md FR-07; technical/implementation-backlog.csv P0-C03; docs/28-pilot-ga-delivery.md P0-C; docs/02-market-competition.md §6
   - Статус и владелец: Not applicable (детерминированная explainability закрыта; AI-варианта нет) · Architecture

294. How is model cost bounded per organization, project, and plan?
   - Ответ/решение: Модельных затрат нет — AI не вызывается ни в одном тарифе. Каркас ограничения затрат уже существует и способен принять AI-метры при введении фичи: метры/entitlements per plan с warn/hard-поведением (doc 21 §4), per-tenant учёт storage/egress/CPU/support с alert до провайдерской квоты (doc 26 §9), abuse/capacity/cost controls — GA-BLOCKER (doc 34 §5).
   - Артефакт/ссылка: docs/21-plans-entitlements-billing.md §4; docs/26-sre-operations.md §9; docs/34-production-gate-checklist.md §5; technical/entitlements.csv
   - Статус и владелец: Not applicable (AI-затрат нет; metering-каркас готов) · Product

## 20. UX, accessibility, and field adoption


295. Can a field worker complete the common capture flow in 30–60 seconds with one hand?
   - Ответ/решение: Бюджет зафиксирован консистентно после фикса v2.9: 30–60 сек как расчёт на карточке S24, жёсткий потолок 90 сек = kill-criterion (docs 00/02/04/14 согласованы); дизайн под одну руку: thumb-reachable CTA, one requirement per screen, крупные цели 48 px, минимум ввода (doc 05 §7, S25–S27). Прототип проходит поток «2 тапа + количество → локальный receipt» в smoke, но эмпирическое подтверждение тайминга на реальных устройствах/пользователях — это V-009 (5+ physical device/user tests) и T-UAT-001, оба не начаты. Фикс: прогнать V-009 + UAT c замером времени задачи.
   - Артефакт/ссылка: docs/04 S24–S27; docs/05 §7; docs/00 kill criteria; docs/14 §7; docs/30 V-009; test-catalog T-UAT-001, T-DEVICE-001; prototype/qa-results.json (field-offline family).
   - Статус и владелец: Partially closed · Design

296. Can the worker understand what is missing without knowing contract or AVK terminology?
   - Ответ/решение: Да, по спецификации: голос продукта требует «Не вистачає 2 фото до закриття стелі» вместо «Помилка валідації» (doc 05 §5); capture-флоу показывает mandatory moment title + пример + recent accepted example (S25–S26); checklist требований объясняет «почему» и денежное влияние (doc 05 Requirement checklist); возврат создаёт «конкретный correction task, не generic „отклонено“» (Workflow E); контролируемый украинский глоссарий канонизирован по state-catalog (doc 05 §12, фикс v2.9).
   - Артефакт/ссылка: docs/05 §5 Voice, «Status vocabulary», Requirement checklist; docs/04 S24–S26; docs/03 Workflow E.
   - Статус и владелец: Closed · Design

297. Does every screen emphasize the next action rather than the internal data model?
   - Ответ/решение: Да. Header каждого экрана несёт ровно один контекстный primary CTA (doc 04 §2); empty-состояние = причина + один следующий шаг; blocker всегда с одним supported remediation action (S14); attention rail — каждая карточка с owner и action (S10); каждый workspace-маршрут показывает process chain и «one optional next logical hand-off» без принудительного визарда (doc 04 §14.2). Мёртвые кнопки устранены в v2.9 и негативно проверяются smoke («no inert primary CTA», doc 29 §5).
   - Артефакт/ссылка: docs/04 §2, §14.2, S10, S14; docs/29 §5; CHANGELOG §6; prototype/qa/verify.mjs.
   - Статус и владелец: Closed · Design

298. Are destructive, legal, financial, and irreversible actions visually distinct and confirmed?
   - Ответ/решение: Да. Destructive-кнопки красные и «называют последствие» (doc 05 Buttons); каждая мутация имеет строку в ui-actions.csv с явным `state_consequence`; необратимые шаги требуют exact version + recent auth + подтверждения (reopen периода, ownership transfer, waive/revoke, closure), publish-диалоги называют preview ID/input hash; удаление организации — staged workflow c cooling-off, «no instant destructive button» (S36); hard gates/warnings/overrides визуально различены (S19). Диалоги получили общий `useDialogA11y` (v2.9), фокус/Escape проверяются harness'ом.
   - Артефакт/ссылка: docs/05 §3; technical/ui-actions.csv (state_consequence); docs/04 S19, S36, S08, S37; docs/19 §7 recent-auth список; CHANGELOG §2 (waiver step-up), §6.
   - Статус и владелец: Closed · Design

299. Can users recover from interrupted import, capture, review, package, and reconciliation flows?
   - Ответ/решение: Да, для всех пяти: import — идемпотентный dry-run/confirm по hash, stale-preview конфликт, abandon/resume (F03/F04, T-IMPORT-002); capture — outbox с durable local receipt, восстановление после kill/restart (T-CAPTURE-001); review — correction/undo с receipt (correctReviewDecision); package — детерминированный retry job'а с тем же номером/hash (T-JOB-002, S20); reconciliation — resumable decision set `pending_reconciliation` без побочных эффектов (S42, T-PACKAGE-DECISION-002). Сквозной принцип v2.9 «read-model closure»: каждый регистр восстанавливает состояние после потери ответа без памяти браузера.
   - Артефакт/ссылка: docs/20 F03–F22, §20; docs/04 S07/S16/S20/S42; docs/23 §3–5; test-catalog T-IMPORT-002, T-CAPTURE-001, T-JOB-002, T-PACKAGE-DECISION-002, T-READ-CLOSURE-001.
   - Статус и владелец: Closed · Product

300. Is offline, syncing, failed, quarantined, and server-confirmed status always unambiguous?
   - Ответ/решение: Да. Три различимых состояния connectivity/local-save/server-receipt — норма дизайн-системы (doc 05 §7); канонические лейблы «Збережено на пристрої» / «Підтверджено сервером» привязаны к state-catalog (doc 23 §3, фикс v2.9); очередь S28 различает queued/uploading/server-confirmed/failed/conflict; карантин показан отдельной карточкой «У карантині — авторизацію інвалідовано» с указанием решения Security Admin (добавлено в v2.9 и проверяется реальным ассертом-маркером `post-invalidation-capture-quarantine`).
   - Артефакт/ссылка: docs/05 §7; docs/23 §3; docs/04 S27–S28, S15; CHANGELOG §6; prototype/qa/verify.mjs (assertMarker) + qa-results.json.
   - Статус и владелец: Closed · Design

301. Can color-blind and low-vision users understand readiness and blocker severity?
   - Ответ/решение: По спецификации да: контраст ≥4.5:1, «status is never conveyed by color alone», status chip = icon + label + tone, «Ready state always combines icon/label/color», 200% zoom, screen-reader имена для чартов/иконок (doc 04 §10, doc 05); автоматический a11y-baseline прототипа прошёл (skip link, aria-current, focus/escape/restore во всех диалогах после v2.9). Но ручной WCAG 2.2 AA аудит и screen-reader прогон остаются release-evidence (fidelity ledger прямо это оговаривает; гейт P0-G08/P0-D06 `not_started`). Фикс: выполнить T-A11Y-001 (manual) на критических флоу.
   - Артефакт/ссылка: docs/04 §10; docs/05 §2–3; docs/16 §2 (a11y row); docs/34 §2 (matrix gate not_started); test-catalog T-A11Y-001.
   - Статус и владелец: Partially closed · QA

302. Are mobile controls usable with gloves, poor lighting, noise, and low-end Android devices?
   - Ответ/решение: Правила заданы: цели 48×48 px в field app (NFR-09, согласовано в v2.9), body ≥16 px, «no precision sliders or tiny drag targets» для перчаток/влаги, юзабельность на ярком солнце, голосовой комментарий для шумной площадки (doc 05 §7, S26); матрица требует минимум одно физическое low/mid Android устройство, «camera/offline cannot be signed off using emulator only» (doc 27 §8). Физические прогоны не начаты (T-DEVICE-001 physical_manual; V-009 unvalidated). Фикс: выполнить device-матрицу T-DEVICE-001 + V-009.
   - Артефакт/ссылка: docs/05 §7; docs/04 §10, S24–S26; docs/27 §8; docs/30 V-009; test-catalog T-DEVICE-001, T-CAPTURE-002.
   - Статус и владелец: Partially closed · QA

303. Can Ukrainian, Russian, Polish, and English labels fit without breaking layouts?
   - Ответ/решение: Проверено grep'ом по docs: v1 интерфейс — только украинский (doc 04); PRD объявляет `uk-UA, ru-UA, позднее pl-PL, en-GB` (doc 01 §Locale); doc 27 §7 — «Ukrainian complete; Russian/English/country locales only when copy catalogue is translated/reviewed» + «pseudo-localization catches expansion and hardcoded strings»; копия — translation-key based (doc 04 §10), польский — только через country pack (doc 32 §, V-008). Механизм защиты от разрыва вёрстки специфицирован (pseudo-loc), но PL/EN каталогов и layout-доказательств нет и для Pilot они не нужны. Фикс: перед включением RU/EN/PL — перевод copy-каталога + pseudo-localization прогон.
   - Артефакт/ссылка: docs/01 (Locale, стр. 69); docs/04 «Версия/язык», §10; docs/27 §7; docs/32 §Country pack; docs/30 V-008.
   - Статус и владелец: Partially closed · Design

304. Are units, currencies, dates, times, and working calendars localized correctly?
   - Ответ/решение: Да, для украинского Pilot-скоупа: даты `DD.MM.YYYY`, валюта с неразрывным пробелом, украинская плюрализация (doc 04 §10); количества сохраняют импортированную точность с unit-aware правилами (doc 05 §5); «dates/money/units carry locale and source timezone/currency» (doc 27 §7); рабочий календарь — версионированный business calendar с выходными/праздниками/таймзонами/DST и детерминированными due-датами (T-BUSINESS-CALENDAR-001, T-REPORTING-DATE-001 — project timezone); другие страны — через country pack (locale/units/currency, doc 32).
   - Артефакт/ссылка: docs/04 §10; docs/05 §5; docs/27 §7; test-catalog T-BUSINESS-CALENDAR-001, T-REPORTING-DATE-001; docs/32.
   - Статус и владелец: Closed · Product

305. Can each dashboard number be opened to the exact underlying records?
   - Ответ/решение: Да. «Clicking any aggregate opens a pre-filtered list» и формула/timestamp на каждом KPI (S10); drill из drawer сохраняет контекст выбранной работы (проверено smoke: переход в /app/work с сохранённым фильтром EL-04.17); blocker rail даёт exact subject/owner/amount (S14); T-READY-002 требует drill каждой корзины до строк/причин. Deep links уведомлений сохраняют фильтры (doc 04 §9).
   - Артефакт/ссылка: docs/04 S10, S14, §9; test-catalog T-READY-002; prototype/qa/verify.mjs (work drawer context assert).
   - Статус и владелец: Closed · Product

306. Are empty, partial, stale, and permission-limited states explicitly explained?
   - Ответ/решение: Да. Глобальные состояния нормированы: empty = причина + шаг + sample data; permission denied называет требуемую роль и владельца, который может её выдать; archived/read-only баннер; offline-бар (doc 04 §2); каталог reusable-состояний F20 (`permission.denied`, `entitlement.soft/hard_limit`, `resource.archived`, `organization.suspended`, `external.expired/revoked/locked` и др.); staleness — явные механизмы: `Оновлено …`, claimed vs authoritative date, `reference_stale` баннер со stale-acknowledgement, stale-preview state `RULE_IMPACT_STALE` (проверен harness'ом).
   - Артефакт/ссылка: docs/04 §2; docs/20 §20; docs/29 §3; docs/04 S15/S38; prototype/qa-results.json.
   - Статус и владелец: Closed · Design

307. Can external reviewers use a secure link without learning a new product model?
   - Ответ/решение: Да, по дизайну: S29–S31 — токен/опциональный OTP без аккаунта, интерфейс — «exact package dossier» с документной навигацией (огляд/кількості/evidence index/waivers/версії), одним pinned decision rail и receipt'ом; явная маркировка «operational acknowledgement ≠ КЕП». Прототип проверяет version-boundary, return и acceptance receipts. Функция сознательно GA (за гейтами G1/V-002); в Pilot внешняя подача/решение фиксируются вручную — это заявленная граница, а не пробел.
   - Артефакт/ссылка: docs/04 S29–S31, §14.4; docs/05 §10; docs/29 §2 (GA-forward); docs/30 V-002; test-catalog T-EXT-001/002; prototype/qa-results.json (external-review family).
   - Статус и владелец: Closed · Design

308. Does the product prevent accidental use of stale browser tabs or old mobile bundles for risky commands?
   - Ответ/решение: Частично. Web закрыт сильно: каждая мутация — `If-Match` с точным strong ETag, stale = safe conflict (doc 22; T-CONCURRENCY-001), рискованные команды требуют exact version/preview hash, membership-version инвалидирует команды немедленно. Mobile: server-side lease с версиями родителей и expiry («changing device time never extends the lease»), «app update maintains outbox compatibility for at least one supported prior version» (doc 23 §9). Но политики минимальной поддерживаемой версии клиента/принудительного обновления для рискованных команд нет. Фикс: добавить min-client-version check в doc 22/23 (server отклоняет команды устаревших бандлов).
   - Артефакт/ссылка: docs/22 (ETag/If-Match); docs/23 §4, §9; docs/04 S38 (lease refresh); test-catalog T-CONCURRENCY-001, T-OFFLINE-AUTH-001, T-MOBILE-001.
   - Обновление (закрыто фиксом 23.07.2026): version handshake закрывает stale-клиентов: doc 22 §11/doc 23 §9 + 426
   - Статус и владелец: Closed · Architecture

309. What onboarding data and guided setup are truly required before the first field task?
   - Ответ/решение: Определено минимально и последовательно: S05–S09 (компания → проект+draft contract terms → импорт сметы → publish правил → команда), причём первая полевая задача технически требует опубликованных terms/rules, назначения (S38) и online accept/start + execution bundle; activation-определение фиксирует «project + ≥20 work items + published rules + 2 роли + 1 approved capture» за 14 дней (doc 11 §2); GTM-плейбук раскладывает это в day 0–3 (данные → mapping workshop → rule workshop → field training). Sample workspace и founder-assisted setup допустимы и логируются.
   - Артефакт/ссылка: docs/04 S05–S09, S38; docs/11 §2; docs/14 §6; docs/34 §4; docs/03 Workflow A.
   - Статус и владелец: Closed · Product

310. Can a customer administrator diagnose problems without contacting AktFlow support?
   - Ответ/решение: Да, для основных классов: каждая ошибка несёт correlation ID (doc 04 §2), очередь синка позволяет инспектировать причину и retry (S28), job'ы имеют честные progress/retry_wait/failed состояния с retryability (T-JOB-001), audit-поиск по actor/action/object/date с signed-экспортом (S36), integration-карточки показывают last sync/next action (S34), notification delivery history (doc 29 §3), диагностический экспорт без контента/секретов (T-SYNC-002), баннеры suspension/entitlement называют причину и действие. Границы: глубокая диагностика платформенных сбоев — через support c grant-моделью.
   - Артефакт/ссылка: docs/04 §2, S28, S34, S36; docs/20 §20; test-catalog T-JOB-001, T-SYNC-002; docs/33 §2–3.
   - Статус и владелец: Closed · Product

## 21. Testing, release gates, and pilot operations


311. Does every functional requirement map to at least one acceptance test and implementation item?
   - Ответ/решение: Да — проверено скриптом по факту: все 41 requirement из traceability.csv имеют непустые `test_ids`, каждый ID существует в test-catalog.csv (0 битых ссылок), и каждый requirement транзитивно покрыт ≥1 backlog-задачей через общие test ID (0 непокрытых; прямой колонки requirement→task нет — связь через тесты). `validate_package.py` (PASS: 41 requirements, 146 tests, 96 tasks) принудительно проверяет ссылки traceability→tests, backlog→tests, отсутствие orphan-тестов, полноту покрытия flows/operations/domains/events и ацикличность зависимостей backlog. Нюанс: 2 теста (T-BREAKGLASS-001, T-INVITE-SCOPE-001) не привязаны к отдельной backlog-задаче, но их requirements покрыты другими задачами.
   - Артефакт/ссылка: technical/traceability.csv; technical/test-catalog.csv; technical/implementation-backlog.csv; scripts/validate_package.py (§ Traceability/backlog) + прогон PASS 24.07.2026; docs/27 §1.
   - Статус и владелец: Closed · QA

312. Does every state transition have positive, negative, authorization, concurrency, and retry tests?
   - Ответ/решение: Частично. Позитив/негатив/авторизация покрыты системно для всех 295 переходов: каждая строка state-transitions.csv несёт actor/guards/error_code, T-STATE-001 требует «assert every transition endpoint/actor/guard/error; attempt illegal and terminal transitions», T-STATE-REACHABILITY-001 + co-reachability валидатора (новое в v2.9), T-RLS-001 — полная матрица ролей. Concurrency/retry закрыты классовыми контрактами (T-CONCURRENCY-001 — гонки assignment/review/close/package/membership/payment; T-IDEMP-001/T-IDEMP-LEASE-001) плюс lifecycle-тесты критичных доменов, но не буквально «на каждый переход». Фикс: зафиксировать в doc 27 норму матричного покрытия concurrency/retry либо расширить перечень доменов в T-CONCURRENCY-001.
   - Артефакт/ссылка: technical/state-transitions.csv; test-catalog T-STATE-001, T-STATE-REACHABILITY-001, T-CONCURRENCY-001, T-IDEMP-001/T-IDEMP-LEASE-001, T-RLS-001; CHANGELOG §4.
   - Обновление (закрыто фиксом 23.07.2026): doc 27 §2: нормативная модель покрытия (per-transition позитив/негатив/authz + классовые матрицы concurrency/retry)
   - Статус и владелец: Closed · QA

313. Are tenant-isolation tests run against API, direct data access, workers, exports, and storage URLs?
   - Ответ/решение: Контракты покрывают ровно эти поверхности: T-TENANT-001 — подстановка ID «via API Data API DB storage jobs exports search and signed links»; T-RLS-001 — DB policy harness в обход UI; T-STORAGE-001 — приватные объекты/lifecycle; T-EXPORT-001 — scoped download; RLS deny-default и cross-tenant report — PILOT-BLOCKER гейты. Но это спецификация: все backlog-задачи `not_started`, runtime-прогонов нет (валидатор сам печатает «NOT PROVEN»). Фикс: выполнить T-TENANT-001/T-RLS-001/T-STORAGE-001 в CI на реализации P0-A (условие допуска пилота).
   - Артефакт/ссылка: test-catalog T-TENANT-001, T-RLS-001, T-STORAGE-001, T-EXPORT-001; docs/34 §3 (RLS deny-default gate); docs/27 §4; implementation-backlog.csv (все not_started).
   - Статус и владелец: Partially closed · Security

314. Are offline tests performed under airplane mode, flaky networks, clock skew, app kill, and device restart?
   - Ответ/решение: Матрица определена полностью: doc 23 §11 (airplane до/во время/после каждой фазы, kill/restart после каждой границы, clock ±24h + умышленный rollback/forward, multipart corruption, low disk); T-DEVICE-001/T-CAPTURE-001/T-SYNC-001/002 — physical_manual+automated; T-REPORTING-DATE-001 — таймзоны/cutoff. Выполнение — не начато: гейт «field offline capture and media durability (physical-device results)» и полная device-матрица имеют статус not_started, V-009 unvalidated; последствие честно определено («office-only limited pilot or no pilot»). Фикс: физические прогоны на low/mid Android + iPhone до допуска полевого пилота.
   - Артефакт/ссылка: docs/23 §11; docs/13 §5; test-catalog T-DEVICE-001, T-CAPTURE-001, T-SYNC-001/002, T-REPORTING-DATE-001; docs/34 §2–3; docs/30 V-009.
   - Статус и владелец: Partially closed · QA

315. Are import tests based on real messy Ukrainian XLS/XLSX files rather than clean fixtures only?
   - Ответ/решение: Синтетические «грязные» украинские фикстуры специфицированы детально (украинские/английские заголовки, запятые/точки/пробелы, формулы, merged headers, кириллические кодировки, zip bomb/macro, дубли кодов — doc 13 §4; T-IMPORT-001, T-BOQ-LINE-TYPE-001 с ambiguous locale formats). Реальные файлы клиентов — сознательно за внешним гейтом: V-001 требует 3 accepted+returned redacted sets от design-партнёра, T-RECON-001/T-ADAPTER-001 строятся на customer-approved redacted BOQ, pilot-гейт «redacted BOQ and one package adapter»; пока V-001 unvalidated, реальных файлов в тестах нет by design.
   - Артефакт/ссылка: docs/13 §4; test-catalog T-IMPORT-001, T-BOQ-LINE-TYPE-001, T-RECON-001, T-ADAPTER-001; docs/30 V-001 + §3 checklist; docs/34 §3, §9 (шаг 7).
   - Статус и владелец: Deferred with gate (V-001) · QA

316. Can historical packages be reproduced in test after template and adapter upgrades?
   - Ответ/решение: Да, это инвариант с тестовыми контрактами: package snapshot хранит exact source IDs/hashes/versions/totals и «regeneration reproducible» (T-PACK-001); новая rule-версия не меняет старый пакет (T-RULE-002); adapter-гейт требует «prior-version reproducibility tested» и kill switch (doc 34 §6 п.7), T-ADAPTER-001 включает prior-version regression, T-ADAPTER-002 — «regenerate first-pack history» после rollback; superseded reference-ревизии остаются читаемыми, submitted пакеты привязаны к старой ревизии.
   - Артефакт/ссылка: test-catalog T-PACK-001, T-PACK-002, T-RULE-002, T-ADAPTER-001/002, T-REFERENCE-001; docs/34 §6; docs/13 §7.
   - Статус и владелец: Closed · QA

317. Are money and quantity invariants tested with rounding, corrections, partial acceptance, and concurrent packaging?
   - Ответ/решение: Да. Golden-фикстуры включают rounding boundaries, comma/dot, zero/negative correction, VAT-режимы, retention/partial acceptance/payment, timezone/DST (doc 27 §5); append-only корректировки количества — T-QUANTITY-CORRECTION-001; частичная приёмка — T-ACCEPTANCE-LINEAGE-001/T-PACKAGE-DECISION-001 (modified totals reconcile exactly); конкурентная упаковка — T-PERIOD-CLAIM-001 (гонки period creation и «one current quantity claim exists globally»), T-PREFLIGHT-001 (race close), T-PACKAGE-NUMBER-001; инвариант performed = ready + risk — T-READY-002.
   - Артефакт/ссылка: docs/27 §5; test-catalog T-QUANTITY-CORRECTION-001, T-PACKAGE-DECISION-001/002, T-PERIOD-CLAIM-001, T-PREFLIGHT-001, T-READY-002, T-PAY-001; docs/13 §3.
   - Статус и владелец: Closed · QA

318. Are destructive lifecycle actions tested with active jobs, leases, assignments, issues, and legal holds?
   - Ответ/решение: Да. T-PROJECT-LIFECYCLE-001 — completion/archive с open assignments/periods/exports и запрет restore; T-CONTRACT-LIFECYCLE-001 — project complete/archive с активным контрактом; T-LEASE-PARENT-001 — каждый parent-transition инвалидирует lease в том же коммите; T-OFFBOARD-MULTI/SCALE-001 — revoke участника с live leases/501+ зависимостями и block_revoke; T-CLOSURE-001 — закрытие организации с legal hold и невалидированной retention (deletion не планируется); T-EXPORT-CANCEL-001 — фенсинг отмены экспорта с partial artifacts.
   - Артефакт/ссылка: test-catalog T-PROJECT-LIFECYCLE-001, T-CONTRACT-LIFECYCLE-001, T-LEASE-PARENT-001, T-OFFBOARD-MULTI-001/T-OFFBOARD-SCALE-001, T-CLOSURE-001, T-EXPORT-CANCEL-001; docs/18 §лизы; docs/26 §12.
   - Статус и владелец: Closed · QA

319. Does each country/customer adapter have golden fixtures and human validation?
   - Ответ/решение: Механизм закрыт жёстко, но ни одного адаптера ещё нет. Адаптер может пройти `draft → validating → approved → published` только с source artifacts + authority, golden fixtures из expected/returned примеров, human sign-off process-owner'а (и counsel/accountant где применимо), kill switch и prior-version reproducibility (doc 34 §6); T-ADAPTER-001 — automated+external_review, ADAPTER-BLOCKER; невалидированный адаптер — только sandbox с watермаркой «UNVERIFIED / NOT FOR SUBMISSION». Первые артефакты для fixtures — гейт V-001 (unvalidated).
   - Артефакт/ссылка: docs/34 §6; docs/32; test-catalog T-ADAPTER-001/002; docs/30 V-001; docs/17 «Customer Adapter Gate — EXTERNAL GATE».
   - Статус и владелец: Deferred with gate (V-001) · Product

320. What automated checks block deployment when OpenAPI, schema, permissions, and UI actions drift?
   - Ответ/решение: `scripts/validate_package.py` (в `make validate`) — фактически прогнан, PASS: семантическое замыкание требует, чтобы каждая mutating-операция OpenAPI мапилась ровно один раз на screen/release/permission/transition domain/tests/events; ловит SQL/state enum drift, unmapped Data API таблицы, DEFAULT≠initial (новое в v2.9), нарушения reachability, orphan mutations и release drift; T-API-SQL-PARITY-001 — parity критичных полей; T-SPEC-SEMANTIC-001 mutation-тестирует сам валидатор (удаление маппинга обязано валить сборку); CI reject закреплён в doc 27 §1; Redocly lint 0 errors/0 warnings приложен.
   - Артефакт/ссылка: scripts/validate_package.py; Makefile (`make validate`); docs/27 §1; test-catalog T-SPEC-SEMANTIC-001, T-API-SQL-PARITY-001, T-STATE-001; technical/openapi-redocly-report.txt; docs/04 §12.
   - Статус и владелец: Closed · Architecture

321. Can a production migration be rolled forward safely if rollback would lose new writes?
   - Ответ/решение: Да, стратегия и тестовые контракты определены: expand/migrate/contract, pre-deploy backup/PITR для рискованных миграций, «one-command app rollback plus migration forward-fix/compatibility plan» (doc 26 §6); T-MIG-001 — interrupt/backfill/resume + совместимость old/new app в окне; T-ROLLBACK-001 — «abort; roll back app or forward-fix data» с измеренным recovery; T-BILLING/ledger append-only модели минимизируют потребность в обратных миграциях. Drill-исполнение — PILOT-BLOCKER (restore/rollback drills до пилота).
   - Артефакт/ссылка: docs/26 §6; test-catalog T-MIG-001, T-ROLLBACK-001, T-RESTORE-001; docs/34 §3 «backup/restore and rollback»; docs/27 §9.
   - Статус и владелец: Closed · SRE

322. What pilot support runbooks exist for failed sync, bad import, wrong mapping, lost device, and package mismatch?
   - Ответ/решение: Частично. Pre-Pilot каталог runbook'ов (doc 26 §7) покрывает mobile sync spike, queue backlog/dead letters, storage/upload outage, package generation corruption/failure, customer export failure, bad deployment/migration — каждый со структурой trigger/containment/diagnostics/prohibited/rollback. Но именованных runbook'ов «bad import», «wrong mapping», «lost device», «package mismatch» в pre-Pilot списке нет: они существуют как продуктовые флоу (device lost flow в doc 23 §9; re-import diff; MOB-AUTH «device-loss matrix») и support-scope «import troubleshooting / package job troubleshooting» (doc 33 §3), а «data integrity mismatch» runbook отнесён к GA. Фикс: добавить эти 4 runbook'а в doc 26 §7 pre-Pilot список.
   - Артефакт/ссылка: docs/26 §7; docs/23 §9; docs/33 §3; technical/mobile-security-profile.csv (MOB-AUTH); docs/14 §6 (issue log).
   - Обновление (закрыто фиксом 23.07.2026): doc 26 §7: четыре именованных runbook-а (bad import, wrong mapping, lost device, package mismatch)
   - Статус и владелец: Closed · SRE

323. Who is allowed to perform data repair, and how is customer approval obtained?
   - Ответ/решение: Определено строго: прямые SQL-правки запрещены как обычный инструмент («direct production DB edits are forbidden», doc 34 §4); операционные действия support ограничены безопасным списком (retry/cancel job, replay webhook после tenant authorization и т.п.); исключительное действие в БД — reviewed script + backup/invariant plan + dual approval + post-check (doc 33 §5); доступ к содержимому — только через support grant: tenant Owner/Admin approval c recent auth, scope/TTL, видимый баннер, полный аудит, revoke (doc 33 §3, T-SUPPORT-001); break-glass — dual control только SEV1/2 (T-BREAKGLASS-001); content-доступ вообще заблокирован до V-012. Операторы «never bypass the ledger with direct SQL» (doc 26 §12).
   - Артефакт/ссылка: docs/33 §3, §5; docs/34 §4; docs/26 §12; test-catalog T-SUPPORT-001, T-BREAKGLASS-001; docs/30 V-012.
   - Статус и владелец: Closed · Security

324. What production readiness gates are mandatory before first live data, first submission, and first paid renewal?
   - Ответ/решение: Три рубежа закрыты гейт-доской doc 34: первые живые данные — полная PILOT-BLOCKER таблица §3 (DPA/scope, RLS deny-default, offline lease, ledgers, backup/restore, alerts, legal pack, UAT — с последствием отказа на каждую строку); первая подача — ADAPTER-BLOCKER §6 + T-SUBMIT-001 (никаких legal acceptance claims) + V-001/V-002; платёж/продление — Pilot-гейт «SaaS issue/settlement and safe suspension» + GA-гейты entitlement/invoice lifecycle с одобрением бухгалтера + V-006/V-007. Правило §8: релиз только при `approved`/`waived_with_expiry`, waiver не может легализовать tenant-изоляцию или потерю данных; статусы без evidence запрещены (§1).
   - Артефакт/ссылка: docs/34 §1–§6, §8; docs/17 §7 (Specification/Pilot/Adapter/GA gates); docs/30 V-001/V-002/V-006/V-007; test-catalog T-PILOT-ADMISSION-001.
   - Статус и владелец: Closed · Product

325. What kill or rollback criteria stop a pilot if data integrity or customer closing is at risk?
   - Ответ/решение: Определены на трёх уровнях: продуктовые kill-criteria (doc 00, порог ≥3 компаний согласован со Stage-0 после фикса v2.9; >90 сек полевая фиксация); pilot kill/reshape-сигналы (doc 28 §8) и определение успеха с «no critical/high tenant/data-loss issue» (doc 28 §9); релизные стоп-правила — блок на critical/high tenant isolation/data loss/duplicate money/corrupt package, «flaky critical test is failure» (doc 27 §9, doc 13 §10); per-gate failure consequences («no pilot», «disable uploads», «office-only») и rollout abort threshold в release-бандле (doc 34 §3, §7); waiver не может скрыть failed restore или потерю данных (§8).
   - Артефакт/ссылка: docs/00 Kill criteria; docs/28 §8–9; docs/27 §9; docs/13 §10; docs/34 §3, §7–8; docs/12 §8.
   - Статус и владелец: Closed · Product

326. Can the team produce an incident timeline and affected-record list from telemetry and audit data?
   - Ответ/решение: Да, по спецификации: каждый запрос/job несёт correlation ID с allowlisted/redacted payload (doc 26 §4); audit — полный, иммутабельный, с поиском по actor/action/object/date/IP class и signed-экспортом (S36, T-AUDIT-001 «required audit exists only for committed action», корреляция request↔outbox); incident-процесс требует declare severity/commander/timeline → verify invariants → postmortem, все timestamps UTC (doc 26 §8); каждый runbook обязан описывать diagnostic queries и evidence; для DR восстановленные данные сверяются по inventory/hash (T-RESTORE-001).
   - Артефакт/ссылка: docs/26 §4, §7–8; docs/04 S36; test-catalog T-AUDIT-001, T-RESTORE-001; docs/09/25 (security events).
   - Статус и владелец: Closed · SRE

## 22. Business continuity and product evolution


327. Can a customer export a complete portable record without proprietary-only dependencies?
   - Ответ/решение: Да: FR-14 задаёт полный организационный экспорт «JSON/CSV + original files + manifest/checksums», generic evidence/readiness/quantity export доступен всегда — даже при сбое или отсутствии customer-адаптера (doc 32 §7, safe default V-001), форматы открытые (JSON/CSV/PDF/XLSX/ZIP). Экспорт сохраняется при suspension и не закрыт платёжным барьером (C1-фикс: cancel/close доступны из trial/grace/suspended, export-first closure), а гейт «export and offboarding» — PILOT-BLOCKER; «Portable record» — принцип PRD №6.
   - Артефакт/ссылка: docs/01-prd.md FR-14, §3 п.6; docs/32-customer-country-adapters.md §7; docs/21-plans-entitlements-billing.md §6; docs/22-data-api-contract.md §9; docs/20-flow-catalog.md F17; docs/28-pilot-ga-delivery.md P0-G; docs/34-production-gate-checklist.md §3; CHANGELOG-AUDIT-FIX-20260723.md §1
   - Статус и владелец: Closed · Product

328. Can the product survive a change of identity, storage, email, AI, or payment provider?
   - Ответ/решение: По каждому провайдеру риск ограничен архитектурно: identity-профиль живёт у Auth-провайдера, а authorization — только в tenant-membership (entity-aliases `profiles/external`); данные — стандартный Postgres+RLS за BFF-границей; media — object storage с hash/manifest inventory; email в Pilot — только транзакционный (пакеты клиенту отправляет человек, ADR-012); payment — ручной банковский invoice без карт (D-007); AI-провайдера нет вовсе. Runbooks покрывают outage каждого провайдера, provider-region loss drill обязателен к GA, но документированного exit/migration-плана per provider (особенно замены Supabase Auth: MFA/sessions/re-enrollment) нет — вендоры фиксируются лишь в будущем deployment ADR.
   - Артефакт/ссылка: docs/07-technical-architecture.md §1, §13; docs/26-sre-operations.md §2, §5, §7; docs/31-architecture-decisions.md ADR-012/ADR-016; docs/15-risks-decisions.md D-007; technical/entity-aliases.csv (profiles)
   - Обновление (закрыто фиксом 23.07.2026): doc 07 §13: provider-exit matrix (auth/storage/email/payments) с процедурами
   - Статус и владелец: Closed · Architecture

329. Which modules are designed as replaceable adapters and which are core invariants?
   - Ответ/решение: Ядро-инварианты (build, «моат»): readiness rules, evidence/quantity lineage, offline command model, package snapshotting, append-only ledgers, deterministic readiness и tenancy/RLS (doc 07 §13, ADR-004/005/006/007). Заменяемые слои: customer/country adapters (versioned immutable packages с pinning; registry — платформенный слой вне tenant state-catalog), провайдеры signature/КЕП, notification channels, currency/tax/unit/calendar/document adapters, покупные примитивы (auth, storage, email, error collection, managed DB). Граница зафиксирована ADR-011 («generic package plus adapters») и ADR-015 (country pack isolation).
   - Артефакт/ссылка: docs/07-technical-architecture.md §11, §13; docs/31-architecture-decisions.md ADR-004–007, ADR-011, ADR-015; docs/32-customer-country-adapters.md §2–3; CHANGELOG-AUDIT-FIX-20260723.md §5
   - Статус и владелец: Closed · Architecture

330. What measured threshold would justify splitting the modular monolith?
   - Ответ/решение: Триггеры заданы по типу измерения, но без чисел: split только при «measured isolation/cost/scale need» (ADR-001, D-004 «no microservices before measured scaling/organizational need»); worker/storage pipelines отделяются «only when queue isolation, cost or reliability data justifies it», решения принимаются по measured p95 и cost/customer, «not customer-count guesses» (doc 26 §9); карта стадий намечает кандидатов (Stage C 100–500 клиентов: отдельные document/evidence workers, партиционирование). Конкретные числовые SLI-пороги сознательно не выдуманы, но и не записаны как revisit trigger — вопрос закрыт лишь методологически.
   - Артефакт/ссылка: docs/31-architecture-decisions.md ADR-001; docs/15-risks-decisions.md D-004; docs/26-sre-operations.md §9; docs/07-technical-architecture.md §10
   - Обновление (закрыто фиксом 23.07.2026): doc 26 §9: числовые revisit-триггеры сплита (queue age p95, error-budget burn, cost/tenant)
   - Статус и владелец: Closed · Architecture

331. What measured threshold would justify introducing a graph database?
   - Ответ/решение: Нигде не задан: весь домен, включая evidence lineage и explainability-связи, реализуется в PostgreSQL (schema.sql, 126 таблиц; «canonical state graph» — это CSV-каталог состояний, не graph DB), scaling plan предусматривает read models и партиционирование, но ни один документ не фиксирует измеримый триггер, при котором переход к graph database был бы оправдан. Postgres-first — осознанный выбор, однако revisit-условие для него отсутствует.
   - Артефакт/ссылка: docs/07-technical-architecture.md §1, §10; technical/schema.sql; docs/18-domain-state-machines.md §15; docs/31-architecture-decisions.md (ADR о graph DB отсутствует)
   - Обновление (закрыто фиксом 23.07.2026): ADR-019: relational evidence lineage; graph DB только по p95-триггеру Stage C
   - Статус и владелец: Closed · Architecture

332. Can future general-contractor workflows be added without weakening the subcontractor-owned record?
   - Ответ/решение: Да, граница зафиксирована: record принадлежит tenant-субподрядчику (portable record, PRD-принцип №6; «универсальная система генподрядчика» — non-goal), внешние стороны получают только exact-package capability (`aktflow_external` активируется после share/session/expiry/revocation verification; viewer видит только явно расшаренное), «Full RFI/submittal/issue manager» — Integration-only с явной оговоркой «no parallel GC workflow», внешние решения пишутся в тот же canonical decision-item model, не заменяя record. Пересмотр D-001 (subcontractors first) допустим только после repeatable subcontractor adoption.
   - Артефакт/ссылка: docs/15-risks-decisions.md D-001, §1 (GC mandates another system → portable record); docs/00-product-brief.md (non-goals); docs/01-prd.md §3 п.6, FR-10/FR-12; docs/07-technical-architecture.md §2.1; docs/37-functional-closure-feature-register.md §2
   - Статус и владелец: Closed · Architecture

333. Can the product support Poland or another EU country without assuming Ukrainian process equivalence?
   - Ответ/решение: Архитектурно допущение эквивалентности прямо запрещено: «EU market access is not treated as process equivalence» (ADR-015), каждая страна — versioned country pack (язык, форматы, e-signature, документы, retention, residency/transfer assessment) с local counsel/accountant/industry валидацией и 2–3 локальными пилотами до GA; ядро jurisdiction-neutral без hardcoded украинских строк. Фактическая поддержка Польши отложена: Stage 4 «CEE discovery» не раньше 18-го месяца и только через gate V-008 (corridor, local counsel, 2 pilots).
   - Артефакт/ссылка: docs/31-architecture-decisions.md ADR-015; docs/24-legal-regulatory-gates.md §11; docs/32-customer-country-adapters.md §5; docs/07-technical-architecture.md §11; docs/12-roadmap-delivery.md Stage 4, §8; docs/30-validation-evidence-register.md V-008
   - Статус и владелец: Deferred with gate (V-008) · Product

334. How are schema and API deprecations communicated and migrated for mobile clients and integrations?
   - Ответ/решение: Механика миграции задана: API `/v1` additive-first, breaking-поведение — только новый endpoint/version (doc 22 §6); webhooks несут schema version и документируемое deprecation window (doc 22 §10); БД — expand/migrate/contract без деструктивного шага в том же релизе (doc 22 §11, doc 12 §4); мобильный outbox обязан сохранять совместимость минимум с одной предыдущей поддерживаемой версией приложения (doc 23 §9), release notes фиксируют impact/migration/flag/rollback. Не задано: процесс коммуникации deprecation интеграторам (сроки уведомления, канал, Sunset-заголовки) и политика минимально поддерживаемой версии мобильного клиента / принудительного обновления.
   - Артефакт/ссылка: docs/22-data-api-contract.md §6, §10, §11; docs/23-offline-media-protocol.md §9; docs/12-roadmap-delivery.md §4; docs/08-api-integrations.md §10–12
   - Обновление (закрыто фиксом 23.07.2026): doc 22 §11: Deprecation/Sunset + 90 дней + changelog; min client version; webhook window doc 08 §9
   - Статус и владелец: Closed · Architecture

335. Can experimental features be enabled per tenant without changing historical behavior?
   - Ответ/решение: Да: production feature flags — часть release-процесса, «feature flags per tenant» — явное Pilot-правило, флаги имеют owner/expiry (doc 26 §6), каждый slice выпускается за флагом. Историческое поведение защищено immutable versions: rule/contract-terms/plan versions, package snapshots, adapter pinning («submitted packages remain bound to original version»), принцип «изменение правил не переписывает прошлое» и запрет retroactive-изменений locked periods.
   - Артефакт/ссылка: docs/28-pilot-ga-delivery.md §3; docs/12-roadmap-delivery.md §2, §4; docs/26-sre-operations.md §6; docs/32-customer-country-adapters.md §3; docs/01-prd.md §3 п.7, FR-04
   - Статус и владелец: Closed · Architecture

336. What prevents one pilot customer’s custom request from becoming permanent core complexity?
   - Ответ/решение: Несколько зафиксированных барьеров: риск «becomes custom document agency» имеет митигацию versioned template/config boundary + reuse gate (doc 15 §1); scope guardrail пускает фичу в core только если она улучшает evidence-to-payment loop (doc 15 §5); backlog-правило паркует громкие запросы, пока три ICP не подтвердят их или контракт не оплатит reusable capability (doc 12 §6); ADR-011 держит customer-специфику в versioned adapters без tenant-кода (doc 32 §2), а doc 30 §5 разрешает менять core только для shared invariant; expansion rule doc 37 §4 требует artifact/owner/kill condition.
   - Артефакт/ссылка: docs/15-risks-decisions.md §1, §5; docs/12-roadmap-delivery.md §6; docs/31-architecture-decisions.md ADR-011; docs/32-customer-country-adapters.md §2; docs/30-validation-evidence-register.md §5; docs/37-functional-closure-feature-register.md §4
   - Статус и владелец: Closed · Product

337. Which architectural decisions have explicit revisit triggers and owners?
   - Ответ/решение: Частично: явные revisit-условия имеют ADR-001 (measured isolation/cost/scale), ADR-003 (расширение allowlist только с threat-model/negative-RLS tests), ADR-013 (monthly review), ADR-017 (toolchain qualification / public API launch), D-001/D-002 (после repeatable adoption/reusable rules), а решения V-gates и sign-offs обязаны хранить expiry/revisit trigger (doc 30 §6, doc 24 §12); правило «каждый ADR implementation PR записывает status, owner, date, consequences и revisit trigger» установлено. Но сводной таблицы trigger+owner на каждый ADR нет — у ADR-002/005/007–010/014–016 явного триггера не записано, владелец всех — общий «founder/product owner до формирования команды».
   - Артефакт/ссылка: docs/31-architecture-decisions.md (все ADR + финальное правило); docs/15-risks-decisions.md §2–3; docs/30-validation-evidence-register.md §2, §6; docs/24-legal-regulatory-gates.md §12; docs/17-production-readiness-index.md (владелец)
   - Обновление (закрыто фиксом 23.07.2026): doc 31: сводная таблица revisit trigger + owner для всех 19 ADR
   - Статус и владелец: Closed · Architecture

338. Can all hidden operational knowledge be moved from people into runbooks, constraints, and automated checks?
   - Ответ/решение: Да, это нормативное требование пакета: каталог из 10 pre-Pilot и 8 pre-GA runbooks с обязательной структурой (trigger/containment/diagnostics/prohibited actions/rollback/exit), solo-continuity контур (credential escrow, документированные deploy/rollback/restore, репетируемый contractor access, founder-unavailable exercise), Pilot-ограничения «shown in order/pilot agreement and UI; not hidden support knowledge», машинные контракты + семантический валидатор вместо устных договорённостей, и gate «operational independence» на GA. Отсутствие runbooks/restore-evidence блокирует pilot admission.
   - Артефакт/ссылка: docs/26-sre-operations.md §7, §10–11; docs/28-pilot-ga-delivery.md §3, P0-G; docs/34-production-gate-checklist.md §3, §5; docs/17-production-readiness-index.md §1, §11
   - Статус и владелец: Closed · SRE

339. What is the plan for data scale growth in media, audit events, occurrences, packages, and analytics projections?
   - Ответ/решение: План ступенчатый: целевой масштаб без redesign — 100 организаций / 2k users / 1M evidence objects (NFR-07); Stage B — read models/materialized summaries, storage lifecycle rules, dedicated analytics sink, tuning и per-tenant quotas; Stage C — партиционирование high-volume audit/evidence таблиц и отдельные document/evidence workers; media ограничены квотами/derivatives и storage-метром с warn/hard-поведением; per-tenant storage/egress/CPU cost tracking с alert до провайдерской квоты; disposal-стратегия для всех 126 таблиц — в data-retention-catalog.
   - Артефакт/ссылка: docs/01-prd.md NFR-07; docs/07-technical-architecture.md §10; docs/26-sre-operations.md §9; docs/21-plans-entitlements-billing.md §4; technical/data-retention-catalog.csv; docs/11-analytics-events.md
   - Статус и владелец: Closed · Architecture

340. What parts of the system would fail first at 10x customers, and how will that be observed?
   - Ответ/решение: Наблюдаемость первых отказов обеспечена: метрики queue depth/oldest age/dead letter, DB saturation/locks/slow queries, upload/scan/document job latency/failure, storage growth/cost, noisy-neighbor dashboards на Stage B и правило «alert before provider quota»; масштабные решения — по measured p95/cost per customer. Но явного анализа «что откажет первым при 10x» (наиболее вероятные кандидаты по топологии: Postgres-based job queue, единственный worker/document pipeline, storage/egress cost) в пакете нет — гипотезы fail-first не зафиксированы как отдельный раздел.
   - Артефакт/ссылка: docs/26-sre-operations.md §4, §9; docs/07-technical-architecture.md §1 (queue: Postgres-backed jobs first), §10; docs/15-risks-decisions.md §1 (file/document compute cost)
   - Обновление (закрыто фиксом 23.07.2026): doc 26 §9 fail-first: три точки отказа при 10x с SLI-порогами
   - Статус и владелец: Closed · SRE

341. What evidence is required before expanding from pilot to general availability?
   - Ответ/решение: Список evidence зафиксирован трёхслойно: Stage 2 gate — один клиент безопасно закрывает период без critical/high isolation/data-loss/duplicate-ledger findings, второй live tenant только после incident/restore review, «two differing configurations and a repeatable paid process are required before GA» (doc 12); GA Gate — counsel-проверка legal pack, accountant по VAT/invoicing, privacy assessment, independent security review, restore/bad-migration/provider-outage/tenant-leak drills, SLA по фактической capacity (doc 17 §7); полная таблица GA-BLOCKER evidence — doc 34 §5, Definition of GA success — doc 28 §10. Сейчас честно: GA admission `BLOCKED`, V-001–V-012 unvalidated.
   - Артефакт/ссылка: docs/12-roadmap-delivery.md Stage 2–3; docs/17-production-readiness-index.md §7, §11; docs/34-production-gate-checklist.md §5; docs/28-pilot-ga-delivery.md §10; docs/30-validation-evidence-register.md §7
   - Статус и владелец: Closed · Product
