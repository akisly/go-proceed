# AktFlow — закрытие архитектурного аудита (341 вопрос), 23–24.07.2026

Вход: `AktFlow_Architecture_Audit_220plus_Questions.md` (341 вопрос, 22 раздела + промпт Evidence Graph). Все вопросы отвечены по фактическому пакету (файл ответов `ARCHITECTURE-AUDIT-ANSWERS.md`), все spec-закрываемые разрывы починены. Итог: **315 Closed · 11 Deferred with gate (внешние V-гейты) · 6 Partially closed (runtime-исполнение: device/WCAG/CI/переводы) · 9 Not applicable (AI отсутствует в core) · 0 Open · 0 Contradiction**. Полный `make validate` зелёный: 76 артефактов, **40 документов**, 126 таблиц, 261 состояние, 295 переходов, **118 кодов ошибок (все с producer)**, 157 операций, 146 тестов, **21 alias**, 124 события.

## Новый нормативный документ

- **docs/39-evidence-graph.md** — реализация промпта аудита: канонические узлы (9 слоёв) и 16 рёбер с владельцами-фактами/кардинальностью/валидностью; слои immutable facts / mutable state / derived projections / AI hypotheses; инварианты G-1…G-7 (tenant closure, provenance, no double-claim, no double-proof, supersede-ацикличность, pinned explanation, projection consistency); tenant/permission enforcement на каждом hop; PostgreSQL-first (ADR-019) с числовым триггером перехода к graph DB; 5 канонических запросов (why blocked / money exposed / line proof / returns by rule / payment origin); AI-граница: только constrained semantic layer, факты — только человеческой командой. Интегрирован в валидатор (00..39 contiguous), README, счётчики.

## Машинные контракты

- **error-catalog.csv**: новая колонка `producer` — каждый из 118 кодов привязан к производителю (pipeline-стадия / guard / policy CA-xxx / transition-домены / operation); валидатор требует непустой producer. Новый код `CLIENT_VERSION_UNSUPPORTED` (426) для version handshake.
- **events.csv**: +5 fail-событий async-flows (`estimate_import_failed`, `package_generation_failed`, `organization_export_failed`, `notification_delivery_failed`, `webhook_delivery_failed`) с PII-safe свойствами; владение закреплено в traceability.
- **traceability.csv**: новая колонка `primary_actor` — каждый из 41 requirement привязан к JTBD-роли (правило doc 17 §6 теперь машинное).
- **entity-aliases.csv**: +`cost_code` (deferred → import_files); инвентарь валидатора обновлён (21).
- **state-transitions.csv**: guard архива проекта дополнен `no_open_receivable_or_pending_external_decision`.
- **command-availability.csv**: notes CA-009/CA-010 фиксируют — lease mismatch = только рестриктивные переходы родителей.
- **schema.sql**: `audit_events` + `object_version`/`reason_code`; `package_submissions` + `supersedes_submission_id`/`attachment_evidence_object_id` с композитными tenant-FK (+unique(org,id) на submissions и evidence_objects); `all_locations` default `false` в обеих scope-таблицах (explicit-grant). Parser evidence перегенерирован (pgsql-parser 18.1.1, 412 stmts, новый SHA).

## Нормативные тексты (ключевое)

- **Money/quantity**: единицы — capture только в контрактной единице, conversion только import/display (doc 22 §3); перевыполнение — hard block, «according to policy» удалено (PRD §6); индексация внутри версии не моделируется — только новая contract version (doc 38 §7); severity канонизирована до `blocking|warning` (PRD FR-04).
- **Temporal/audit**: нормативная as-of процедура реконструкции (doc 22 §4); контракт полей аудита расширен version/reason (doc 18 §1); ordering-гарантий нет — occurred_at+ID (doc 22 §10, doc 08 §9).
- **Клиенты/версии**: version handshake `X-Min-Client-Version` + 426 + safe mode с выгрузкой outbox (doc 22 §11, doc 23 §9); политика Deprecation/Sunset ≥90 дней.
- **Offline/evidence**: mock-location/accuracy → untrusted metadata warning (doc 23 §8); exact-SHA дубли → warning, pHash — GA (doc 23 §7); lease mismatch = рестриктивные переходы (doc 23 §6).
- **Организация работы**: ADR-018 (individual-only ownership), ADR-019 (relational lineage), сводная таблица revisit-триггеров всех 19 ADR (doc 31); границы полномочий и no-build решения зафиксированы (doc 19 §5, doc 37 +5 строк реестра); distributed inbox — норма Pilot (doc 04 §9); правило issue-операций append-only (doc 38 §7).
- **Ops**: per-component RPO/RTO таблица (doc 26 §5); 4 именованных runbook-а (doc 26 §7); числовые триггеры сплита + fail-first при 10× (doc 26 §9); provider-exit matrix (doc 07 §13); норма тестового покрытия (doc 27 §2).
- **Аналитика**: clock rules (пауза исключается), dedup по clientOperationId, canonical dimensions, primary-reason атрибуция без двойного счёта, versioned backfill (doc 11).
- **GTM/границы**: checkpoint-сетка 30/60/90 и правило opening balance (doc 14); ранжированный cut-list (doc 12 §6); signer authority boundary + append-only коррекция submission receipt (doc 24 §1); cost_code честно deferred (PRD FR-03).

## Осталось вне спецификации (по построению)

- **Deferred with gate (11)**: сроки retention (V-003), реальные BOQ-фикстуры и golden adapters (V-001), GPS-политика sensitive sites (V-004), КЕП/signer authority (V-005), FX/страны (V-008), AI-вендор (V-011), device risk acceptance (mobile GA gate) — закрываются внешними решениями, не текстом.
- **Partially closed (6)**: физические device/offline-прогоны, ручной WCAG-аудит, CI-прогоны isolation-тестов, эмпирика 30–60 сек, переводы PL/EN — исполнение, зафиксированное существующими PILOT-BLOCKER задачами.

## Проверка

```bash
make validate
```

Контракты: PASS (см. счётчики выше). Прототип в этом раунде не менялся; lint/build/qa остаются зелёными с прошлого прогона и перепроверены финальным полным `make validate`.
