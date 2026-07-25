# 11. Product analytics and measurement

## 1. North-star and metric tree

**North-star:** value of evidence-ready work submitted through AktFlow per active organization per month.

It combines real commercial value, readiness and completed workflow. It is not total uploaded photos or logins.

Leading metrics:

- time to first project/estimate import;
- time to first field capture;
- share of performed value with complete evidence before period close;
- median evidence return loop;
- package generation and submission rate;
- active field/office collaboration.

Lagging outcomes:

- returned package/value rate;
- days performed → package-ready → submitted → accepted → paid;
- overdue receivable value;
- organization retention and expansion.

Clock rules: интервалы, когда проект находился в `paused`, исключаются из median time performed→ready и родственных длительностей — метрика сегментируется по границам pause/resume (границы берутся из переходов проекта, event-time). Пауза заказчика не ухудшает и не улучшает метрику.

## 2. Activation definition

An organization is activated only after, within 14 days:

1. a live/synthetic project and ≥20 work items are imported;
2. evidence rules are published;
3. at least two roles participate;
4. one field capture reaches internal approval;
5. dashboard displays reproducible ready/at-risk value.

This is stricter than “created workspace”.

## 3. Event conventions

Event names use past tense domain semantics: `estimate_import_confirmed`, not `button_clicked`. Standard properties: event/version, occurred_at, anonymous/session/user pseudonymous IDs, organization/project plan, role, platform/app version, source, result, latency bucket, request ID. Financial amount is bucketed for product analytics; exact values remain in operational DB.

Never send customer names, work descriptions, document contents, emails, phone, raw file names, precise location or share tokens to analytics.

Client-event dedup: мобильные/офлайн события (`capture_started`, `capture_saved_local`, `capture_sync_*`) дедуплицируются по `clientOperationId` + event_name; сервер отбрасывает повторную доставку той же пары. Ретраи транспорта не создают вторых событий.

## 4. Funnel definitions

Каждое звено воронки — событие из `technical/events.csv`; шаги, живущие вне продукта (CRM-квалификация), событиями не являются и помечены явно.

### Acquisition

`landing_viewed → demo_workspace_opened → pilot_form_started → pilot_form_submitted → subscription_state_changed (to pilot)`

Коммерческая квалификация между формой и стартом пилота фиксируется в CRM и не является продуктовым событием.

### Activation

`workspace_created → project_created → estimate_import_confirmed → rules_published → capture_submitted → review_approved → readiness_changed (first positive readiness value)`

### Period close

Pilot: `period_close_opened → evidence_request_created / evidence_request_resolved (blocker work) → package_generation_requested → package_generated → package_submitted → package_line_decisions_recorded`. GA may continue through exact-version `external_decision_recorded` / `package_accepted` and Project Commercials.

### Retention

Organization is weekly active only if a meaningful event occurs: evidence/review/package/payment/project configuration—not login alone.

## 5. Operational versus product telemetry

- Product analytics answers adoption/funnel/cohort.
- Audit log answers who changed business records.
- Observability answers system performance/errors.
- Security log answers auth/access/abuse.

Do not substitute one for another. Audit is complete and immutable; analytics is minimized and may respect opt-out.

## 6. Dashboards

Founder dashboard: qualified pipeline, activation, pilots, submitted value, weekly active orgs, support hours, MRR/churn. Product dashboard: activation stages, field sync success, review loop, package funnel, readiness by cohort. Reliability dashboard: API p95/errors, jobs, uploads, sync backlog, DB/storage, security rate limits.

Canonical dimensions: метрики режутся по project, contract (+version), rule pack version, period и work-item lineage root; «work type» выражается только через applicability-группы rule pack (отдельной таксономии нет). Location, team и customer/counterparty исключены из продуктовой аналитики политикой минимизации PII (§3) — они доступны только в операционных отчётах внутри tenant.

Returned-value attribution: одна строка пакета несёт одно финансовое решение и множество typed issues; в аналитике возвращённая стоимость строки атрибутируется одному primary reason code — коду issue с максимальной привязанной суммой (tie-break: blocking > warning, затем старший по created_at), полный набор issues сохраняется для drill-down. Сумма атрибуций по причинам всегда равна возвращённой сумме строки — без двойного счёта.

## 7. Experiment discipline

Every experiment defines hypothesis, segment, primary/guardrail metric, duration/sample caveat and decision. With low B2B sample, combine event data with recorded workflow interviews; do not claim statistical certainty from ten accounts.

Taxonomy changes and backfill: событийные имена/свойства версионируются (`version` в events.csv); смена таксономии выполняется пересчётом производных витрин из неизменного event log (replay по versioned mapping старое→новое), операционная история не переписывается. Отчёты помечают, по какой версии таксономии посчитаны.

## 8. Event catalog

Machine-readable Pilot+GA target catalog is in `technical/events.csv`. Event schema changes are versioned and tested; property dictionaries have owner and retention.
