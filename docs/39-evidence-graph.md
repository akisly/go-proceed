# 39. Evidence Graph

Версия: 1.0 (введён по итогам архитектурного аудита 341 вопроса, 23.07.2026)  
Статус: нормативная архитектура связности доказательств; реализация — PostgreSQL-first (ADR-019)  
Назначение: для любой суммы и работы детерминированно ответить — что выполнено, чем подтверждено, какие правила действовали в тот момент, кто и когда решил, что блокирует закрытие, какая сумма под риском и как финансовый результат трассируется назад до исходного evidence.

Evidence Graph — не отдельная технология и не «knowledge graph ради технологии». Это нормативное имя для уже существующей связности доменной модели (FK и link-таблицы `technical/schema.sql`) плюс закрытый набор allowlisted путей обхода, инвариантов и запросов. Граф усиливает core loop `performed → evidence-complete → reviewed → package-ready → submitted → accepted/paid`, ничего не добавляя к нему.

## 1. Canonical node types

Узел = доменная запись; идентичность узла — `(organization_id, node_type, id)`, версия — собственные версионные поля записи. Node types и их системы записи:

| Layer | Node types (таблицы) |
|---|---|
| Tenancy | Organization, Project (`organizations`, `projects`) |
| Commercial baseline | Contract, ContractVersion, ContractTermsVersion, WorkItem-lineage (`contracts`, `contract_versions`, `contract_term_versions`, `work_items` c `lineage_root_id`/`lineage_version`) |
| Execution | WorkAssignment (+reassignment receipts), QuantityEntry (append-only ledger), RequirementOccurrence, OccurrenceTriggerEvent (`work_assignments`, `quantity_entries`, `requirement_occurrences`, `occurrence_trigger_events`) |
| Rules & references | EvidenceRuleVersion, RulePackVersion, ReferenceDocumentVersion (`evidence_rule_versions`, `rule_pack_versions`, `reference_document_versions`) |
| Evidence | CaptureSession, EvidenceObject (immutable original + hash), TypedEvidenceRecord, derivative objects (`capture_sessions`, `evidence_objects`, `typed_evidence_records`) |
| Decisions | ReviewTask, ReviewDecision (+corrections), HoldPointDecision, ConcealmentEvent, RequirementWaiver (+revocations) (`review_tasks`, `review_decisions`, `review_decision_corrections`, `hold_point_decisions`, `concealment_events`, `requirement_waivers`, `requirement_waiver_revocations`) |
| Close & submission | Period, PeriodCloseCycle, PackageVersion, PackageLine, PackageSubmission (`reporting_periods`, `period_close_cycles`, `package_versions`, `package_lines`, `package_submissions`) |
| External outcome | ExternalDecision, PackageDecisionSet/Item/Issue, AcceptanceRecord (`external_decisions`, `package_decision_sets`, `package_decision_items`, `package_decision_issues`, `acceptance_records`) |
| Money | Receivable (+adjustments), Payment, PaymentAllocation, PaymentReversal (`receivables`, `receivable_adjustments`, `payments`, `payment_allocations`, `payment_reversals`) |
| Actors | Actor = membership-контекст пользователя или external share session; платформенные акторы помечены `actor_type` |

SaaS-биллинг (doc 21) — отдельная плоскость и в Evidence Graph не входит: подписочные деньги не смешиваются с проектными.

## 2. Canonical edge types

Ребро — это строка факта: либо FK владеющей записи, либо выделенная link-таблица. Каждое ребро имеет владельца (таблицу-источник), направление, кардинальность и правило валидности.

| Edge | From → To | Cardinality | Owner (факт) | Validity |
|---|---|---|---|---|
| belongs_to | любой tenant-узел → Organization/Project | N:1 | композитные FK самой записи | всегда; кросс-tenant ребро невозможно на уровне БД |
| baseline_of | WorkItem → ContractVersion | N:1 | `work_items` | pinned; новая версия договора создаёт новые lineage-версии строк |
| assigned_scope | WorkAssignment → WorkItem(+Location) | N:1 | `work_assignments` | версия assignment пиннит exact terms/rules/reference версии |
| performed_by | QuantityEntry → WorkAssignment/Actor | N:1 | `quantity_entries` | append-only; коррекция = компенсирующая запись со ссылкой |
| requires | RequirementOccurrence → WorkAssignment + EvidenceRuleVersion | N:1+pin | `requirement_occurrences` | детерминированный trigger key; повторный триггер не создаёт дубль |
| proves | EvidenceObject → RequirementOccurrence | N:M | `evidence_requirement_links` | явная связь; переиспользование доказательства — только явным линком (double-proof запрещён инвариантом G-4) |
| decided_by | ReviewDecision/HoldPointDecision/Waiver → subject (CaptureSession/Occurrence) | N:1 | таблицы решений | append-only; коррекция решения — новый successor-факт |
| claims | PackageLine → QuantityEntry | N:M exclusive | `package_line_quantity_sources` | одна quantity-запись может быть claimed максимум одним открытым package (инвариант G-3) |
| evidences | PackageLine → EvidenceObject | N:M | `package_line_evidence_sources` | pinned на exact evidence version в snapshot пакета |
| snapshot_of | PackageVersion → Period + input hashes | N:1 | `package_versions` | immutable; новая правка = новая версия |
| submitted_as | PackageSubmission → PackageVersion | N:1 | `package_submissions` | append-only receipt; коррекция — supersedes-ссылка |
| judged_by | PackageDecisionItem → PackageLine; Issue → Item | N:1 | decision-таблицы | exact package version; суммы выводит сервер |
| accepted_as | AcceptanceRecord → PackageVersion | N:1, single current head | `acceptance_records` | lineage: successor supersedes prior record |
| owed_from | Receivable → AcceptanceRecord basis | N:1 | `receivables` | append-only adjustments |
| paid_by | PaymentAllocation → Receivable + Payment | N:M | `payment_allocations` | сумма аллокаций ≤ суммы платежа и остатка receivable |
| supersedes | версия → предыдущая версия (rules/terms/references/acceptance/submission/corrections) | N:1 | соответствующие таблицы | ацикличность (инвариант G-5); история никогда не теряется |

Каждое ребро возникает только из команды, импорта, детерминированной оценки правила или человеческого решения — у каждого есть audit event с actor/command/correlation (doc 18 §1). Рёбер «из ниоткуда» не существует.

## 3. Fact layers

- **Immutable facts** — версии (contract/terms/rules/references/plan), originals+hash, append-only ledgers (quantity, allocations, adjustments), receipts (submission, reassignment, waiver revocation, offboarding), decisions. Никогда не мутируют; исправление = новый факт со ссылкой.
- **Mutable operational state** — открытые review tasks, issue open/resolved, package decision set до финализации, lease validity. Управляются state machine (`technical/state-transitions.csv`), каждый переход аудируем.
- **Derived projections** — `work_items` projected status, `readiness_snapshots`, суммы под риском, blocker-реестры. Не источники истины: пересчитываются из фактов, несут `projection_updated_at`, drift детектится сверкой (§6).
- **AI hypotheses** — в Pilot отсутствуют (doc 37: AI — no-build в core). Контракт на будущее: гипотезы (предложение маппинга/классификации/причины) живут вне доменной БД в analytics-плоскости, ссылаются на exact node IDs/versions, имеют статус proposed/confirmed/rejected и НИКОГДА не становятся рёбрами графа сами: подтверждение человеком — обычная доменная команда, и только она рождает факт. Введение хранимого AI-слоя требует полного контракта (schema+retention+access+events) через gate doc 12 §8 — это условие самого gate.

## 4. Graph invariants

- **G-1 Tenant closure**: каждое ребро внутри одной организации — обеспечено композитными FK (`organization_id` в каждом FK) и RLS; кросс-tenant ребро отклоняется БД, а не приложением.
- **G-2 Provenance**: у каждого ребра есть производящий audit event (actor, command, version, correlation ID).
- **G-3 No double-claim**: quantity-запись состоит максимум в одном не-superseded package claim; сумма claims по строке ≤ performed − corrections. Деньги считаются только через claims — двойной учёт исключён конструкцией.
- **G-4 No accidental double-proof**: evidence считается доказательством только через явный `evidence_requirement_links`; один объект на несколько occurrences — только явными линками, каждый виден в manifest.
- **G-5 Supersede acyclicity + single current head**: цепочки supersedes ацикличны, у lineage ровно одна текущая голова (acceptance, submission, versions).
- **G-6 Pinned explanation**: каждое решение ссылается на exact версии входов (terms/rules/reference/preview hash) — «почему» реконструируется as-of (doc 22 §4 Temporal reconstruction).
- **G-7 Projection consistency**: derived-слой пересчитываем из фактов; nightly consistency job сверяет (a) orphan edges, (b) double-claim скан, (c) supersede-циклы, (d) расхождение projections с ledger — расхождение = алерт doc 26 §4, не тихий ремонт.

## 5. Tenant and permission enforcement in traversal

Обходы — только по allowlisted путям (§6), реализованным как параметризованные join-цепочки; generic traversal API не существует. На каждом hop действует та же модель доступа, что и для прямого чтения таблицы: RLS families doc 35 + permission matrix. Пользователь без права на узел не увидит его и в качестве промежуточного hop (агрегаты по недоступным веткам возвращаются как closed totals без раскрытия узлов). External reviewer видит строго подграф одного exact package version через share session (doc 18 §10); платформенные роли — только через свои плоскости.

## 6. Canonical queries (allowlisted paths)

| Query | Path | Поверхность |
|---|---|---|
| Why is this work blocked? | WorkItem → RequirementOccurrence(missing/failed) → EvidenceRuleVersion + owner + age + affected amount | `listReadinessBlockers`, work drawer (S10/S12) |
| What money is exposed by this missing/invalidated evidence? | EvidenceObject → links → Occurrences → Assignments → WorkItems → open PackageLines (через claims; dedup гарантирован G-3) | evidence detail; invalidation impact receipt (doc 20 §187) |
| What proves this package line? | PackageLine → quantity claims → assignments/actors + evidence sources (exact versions) + review/hold receipts | package detail manifest; external review dossier |
| Which returns relate to this rule? | EvidenceRuleVersion → Occurrences → PackageLines → DecisionItems(returned)+Issues (reason codes) | recurring-cause отчёты S23 (doc 11 §6) |
| Payment → origin | PaymentAllocation → Receivable → AcceptanceRecord → PackageVersion → Lines → QuantityEntries + EvidenceObjects + ContractTermsVersion | audit/export; спор по оплате |

Every ответ цитирует node IDs и версии; текстовые объяснения генерируются только из пройденного пути (см. §8).

Package manifest (машиночитаемый JSON рядом с PDF/XLSX, доказывает точную версию каждого узла в экспорте): `{ package_version_id, document_number, numbering_sequence, snapshot_hash, contract_version_id, contract_terms_version_id, rule_pack_version_id, reference_versions[], renderer_version, template_version, adapter_key/version, lines[{ package_line_id, work_item_lineage_root, quantity_entry_ids[], evidence_object_ids_with_hash[], decision_item_id }], totals{ included_ready, held, submitted, accepted, returned }, generated_at, generator_version }`. Manifest сам хэшируется; повторная генерация из того же снапшота даёт тот же manifest-хэш (идемпотентность рендера, doc 38 §8).

## 7. PostgreSQL-first implementation

Первая (и пока единственная) реализация — реляционная (ADR-019):

- рёбра уже существуют как FK/link-таблицы; отдельного edge-store нет;
- канонические пути §6 имеют глубину ≤6 и реализуются прямыми join или `WITH RECURSIVE` (supersede-цепочки, lineage);
- индексная дисциплина: составные индексы, начинающиеся с `organization_id`, на все link-таблицы (`package_line_quantity_sources`, `evidence_requirement_links`, `payment_allocations`) и hot-проекции присутствуют в reference-schema (`*_occurrence_idx`, `*_receivable_idx`, `*_qentry_idx`, `readiness_snapshots_subject_idx`) — они покрывают reverse-traversal, который не индексируется ведущей колонкой PK;
- горячие агрегаты остаются материализованными проекциями (`work_items` projection, `readiness_snapshots`) с G-7 сверкой;
- бюджет интерактивности: p95 канонического запроса ≤500 ms на Stage C нагрузке.

Переход к выделенной graph DB оправдан только триггером ADR-019: p95 канонических multi-hop запросов стабильно выше бюджета на Stage C после индексных и материализационных оптимизаций. До этого вторая база — это второй контур backup/restore/RLS без выигрыша.

## 8. AI boundary on the graph

AI (когда будет введён через gate) получает доступ только к constrained semantic layer: параметризованные запросы §6, без произвольного SQL/обхода; ответы обязаны цитировать node ID + версию для каждого утверждения — объяснение без пути не возвращается (никакой «изобретённой» рационализации). AI never creates финансовые, юридические или approval-факты: его выход — hypothesis (§3), а факт рождается только человеческой командой с обычными guard-ами (permission ∩ transition ∩ CA-политика). Это прямое следствие ADR-006 и D-006.

## 9. Verification

Пакетный валидатор уже проверяет структурные основания графа: композитные tenant-FK, reachability/co-reachability машин, claims-инварианты, parity SQL↔catalog↔OpenAPI. Runtime-контур добавляет G-7 nightly job и алерты doc 26 §4. Запросы §6, не имеющие сегодня операции (`evidence impact`), зафиксированы в реестре doc 37 как GA-кандидаты и не считаются обещанными в Pilot UI.
