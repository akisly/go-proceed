# AktFlow v2.9 — исправления по независимому аудиту бизнес-логики (23.07.2026)

Все находки аудита (1 критичная, 12 значимых, ~17 групп мелких) закрыты; после каждого блока прогонялась проверка. Итоговая верификация: `make validate` полностью зелёный — eslint PASS, vite build PASS, Chromium QA-harness `ok:true` (17 flow families, 19 скриншотов, 13 v2.9-маркеров, 0 findings), контрактный валидатор PASS (75 артефактов, 126 таблиц, 261 состояние, **295 переходов**, 117 ошибок, 157 операций, 146 тестов, 32 CA-правила).

## 1. Критичное: путь офбординга без платёжного барьера (C1)

`technical/state-transitions.csv` (275 → 295 строк):

- `organization: trial→begin_closing`, `suspended→begin_closing` — закрытие workspace доступно owner-у из trial/active/suspended;
- `subscription: suspended→cancel`, `grace→cancel`, `trialing→cancel` — отмена подписки без предварительной оплаты;
- doc 18 §2: новый инвариант «offboarding without payment»; doc 18 §12 и doc 21 §6: cancel/close доступны в suspension, удаление данных — только через close/retention workflow;
- `command-availability.csv` CA-004 (payment_recovery, «restore or close service») расширен на `trial` (org) и `pilot|trialing` (subscription).

Проверка: co-reachability — из каждого нетерминального состояния каждого домена достижим терминал (теперь это постоянная проверка валидатора).

## 2. Машины состояний

- **Receivable**: `issued→allocate_payment` (ранний платёж), `part_paid→mark_overdue` (aging частично оплаченного акта), `part_paid→write_off`.
- **Acceptance**: удалён in-place `partially_accepted→accept`; `partially_accepted` терминален на уровне записи (state-catalog + doc 18 §11) — resolution только через superseding record, как и требовала append-only модель.
- **Invitation**: `queued/delivery_failed → revoke|expire` — приглашение можно отозвать/просрочить до доставки (соответствует openapi `revokeInvitation`).
- **Ownership transfer**: `successor_confirmed → cancel|expire` (гонка cancel/complete из T-OWNERSHIP-001 теперь выразима).
- **Jobs**: `import_job/job: running|retry_wait → cancel` (lease-fenced), `webhook_delivery: retry_wait→cancel`, `deletion_job: scheduled→cancel` (точка невозврата — старт execute, а не scheduling).
- **Capture**: `pending_review→quarantine` (угроза, обнаруженная после скана).
- **22 невыполнимых reversal-метки** исправлены: где команда осмысленна — добавлен переход; где необратимо — метка заменена на исполнимую (`enter_grace`, `credit`, `reopen`, `mark_evidence_ready`, `revoke`, `retry`) или `none`.
- **Waiver step-up**: guards `requirement.waive` и `requirement_waiver.revoke` получили `recent_auth_…`; канонический список recent-auth в doc 19 §7 дополнен waiver-командами (docs 25/36 теперь совпадают с doc 19 и guards).

## 3. SQL и evidence

- `schema.sql`: DEFAULT приведён к initial-состоянию каталога в 6 таблицах (`organizations` trial, `memberships` invited, `invitations` draft, `projects` draft, `contracts` draft, `work_assignments` planned) — INSERT без явного статуса больше не перепрыгивает guarded-этапы.
- `sql-parser-report.txt` перегенерирован той же тулчейн-цепочкой (pgsql-parser 18.1.1 / libpg-query WASM): PASS, 412 statements, новый SHA-256.

## 4. Валидатор усилен (4 новых класса проверок)

`scripts/validate_package.py`:

1. **Co-reachability**: каждое нетерминальное состояние обязано иметь путь к терминалу (ловит класс C1).
2. **Терминалы**: терминальное состояние не может иметь исходящих переходов.
3. **Исполнимость reversal**: recovery-команда обязана существовать из результирующего состояния, а не «где-то в домене».
4. **DEFAULT == initial**: SQL-дефолт state-колонки обязан совпадать с объявленным initial (маппинг расширен на organizations/memberships/invitations/projects/contracts).

## 5. Синхронизация доков с каноном v2.9

- **PRD** (doc 01): фантомная цепочка из 12 состояний заменена каноническими слоями work_item/readiness/receivable; видео исключено из Pilot (FR-05, NFR-06) и внесено в реестр обещаний doc 37 как GA-flag; **doc 00**: north-star через `packaged/submitted`, iOS/Android, kill-порог согласован со Stage-0 gate (≥3 компании).
- **Глоссарий** doc 05 §12 переписан каноническими `ui_uk`-лейблами с доменной привязкой; hex-токены обновлены под Evidence Atlas (Carbon/Lime/Slate/Paper).
- **Роли**: doc 06 §7 — все 14 канонических ролей (добавлены field_worker, internal_reviewer, estimator, integration_admin, security_admin); doc 03 — маппинг персон на permissions.csv.
- **Аналитика** doc 11: воронки переписаны на существующие события events.csv; шаги CRM помечены явно.
- **Счётчики/списки**: doc 27 «88»→146 тестов; doc 24 «87»→126 retention-записей; doc 22 «three»→four platform-billing команды (+`reverseSaasPayment`); doc 07 §2.1 + роль `aktflow_platform_billing`; README/doc 17 «275»→295 переходов.
- **Adapter lifecycle**: doc 34 §6 приведён к doc 32 (`draft→validating→approved→published`); в doc 32 зафиксировано, что registry — платформенный слой вне tenant state-catalog.
- **Entitlements**: метр `webhook_endpoint` добавлен в CSV (`block_new_endpoint`); warn-фазы для active_projects/office_seats; имена метров в doc 21 §4 = CSV (`storage`, `api_call`); границы Control (limited templates, optional API) синхронизированы в doc 21 §2 и doc 10.
- **Прочее**: doc 04 — packs S08 electrical-only (Pilot), S24 30–60 сек, touch targets 44 web/48 field; тайминги 30–60/90 сек согласованы в docs 02/14; doc 18 §13/14 — `downloaded` убран, job-стандарт уточнён; doc 20 — wire-токены occurrence (`date`/`batch`), work_assignment создаётся `planned`→atomically issued; doc 22 §2 — 31 отсутствовавшая таблица добавлена в инвентарь, дубль убран; doc 23 — «Підтверджено сервером»; doc 33 — support-план вне tenant-каталога; doc 35 §5 — грамматика 14 производных policy-меток.

## 6. Прототип и QA-достоверность

- **verify.mjs**: `businessLogicDelta` больше не захардкожен — все 13 v2.9-маркеров вычисляются из фактически выполненных ассертов (`assertMarker`); добавлены проверки: direct approve, подтверждение смены тарифа, возврат из rules-setup в onboarding шаг 5 и завершение в workspace, негативная проверка недоступности concealment до hold-решения, read-model sweep по core-реестрам, quarantine-копия в offline-очереди.
- **Field**: в очереди синхронизации добавлена карточка карантина («У карантині — авторизацію інвалідовано», решение Security Admin) — заявление docs/16/29/README о quarantine copy теперь истинно.
- **Мёртвые кнопки устранены**: Work — экспорт-receipt, рабочий быстрый фильтр, bulk «Призначити»/«Додати до пакета» с receipts; Team — «Експорт перевірки» receipt, «Керувати» открывает панель участника; Billing — download-receipt по счетам; Packages «Деталі» и Variations «Відкрити» — read-only деталь-диалоги immutable snapshot; Onboarding — выбор листа/колонок маппинга работает; PackageDetail — состав пакета переключает документ превью.
- **A11y**: общий `useDialogA11y` (initial focus, Tab-trap, Escape, restore) применён ко всем 7 диалогам/drawer — заявление docs/16 §4 о modal focus/escape/restore теперь верно для всех модалок.
- **Демо-данные согласованы**: RVW-2207-91 закреплён за Evidence (Occurrence → RVW-2207-93, Team → RVW-2207-95); история ASN-742/E-101 R6-stale-acknowledged согласована между Assignments и Occurrence; «Rules v5» → v1; хэш rules `9c5d…e41a` отделён от хэша terms `7f0a…39c1`.
- **docs/29**: противоречие §2/§6 по notification preferences устранено; описание marker-механизма соответствует реализации.

## Не менялось (осознанно)

- 30 error-кодов без производителя: правильная привязка кодов к переходам/операциям — отдельная содержательная итерация по error-модели; коды оставлены в каталоге (сценарии описаны в flows), задача зафиксирована ниже.
- Fail-события для async-flows (import/generation/export/notification/webhook) в events.csv — требует решения по PII-свойствам каждого события; рекомендация в отчёте аудита остаётся открытой.
- Расхождения actor-колонки переходов с permissions.csv (5 случаев) — требует продуктового решения, какой слой авторитетен для каждой команды.

## Как проверить

```bash
make validate
```

Прогоняет lint → build → Chromium smoke (перепишет qa-results.json и скриншоты локально) → контрактный валидатор с новыми проверками. В облачной среде аудита этот конвейер пройден полностью зелёным 23.07.2026.
