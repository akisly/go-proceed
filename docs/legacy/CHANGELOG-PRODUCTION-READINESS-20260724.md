# AktFlow — закрытие раунда production-готовности (P1–P5), 24.07.2026

Вход: `AktFlow-Production-Readiness-Assessment.md` (аудит 5 линз: backend-имплементируемость, frontend/UX, QA/delivery, бизнес-реализм, security-глубина). Все spec-закрываемые находки починены; каждая правка верифицирована, после каждого блока прогонялся валидатор. Полный `make validate` зелёный: lint/build PASS, Chromium QA `ok:true`, контракты PASS — **78 артефактов, 40 документов, 126 таблиц, 295 переходов, 118 ошибок, 149 тестов, 21 alias, 96 задач**.

Новые машиночитаемые артефакты (78 против 76): `technical/rate-limits.csv`, `technical/copy-catalog.csv`. Схема выросла на 4 индекса (416 SQL-statements против 412), error-catalog получил колонку `ui_surface`, backlog — колонки `size`/`subtasks`, doc 30 — колонки Owner/Target, ASVS-профиль вырос с 33 до 45 строк.

## P1 — build-blockers (доменное ядро + security-фундамент)

- **Readiness → money derivation** (единственный доменный build-blocker): в doc 38 §8 добавлен нормативный алгоритм occurrence→assignment→work item (lowest-wins), precedence-таблица readiness-состояний, money-split (included_ready/excluded_ready/blocked_risk без двойного счёта), дедуп `affectedValue` по assignment, определение `held`, триггеры пересчёта. doc 18 §7 ссылается на алгоритм и фиксирует lowest-wins.
- **Session/token контракт** (числа): doc 25 §4 — таблица TTL access 30m / refresh 14d / idle 72h / recent-auth 10m / max 10 сессий / device-binding нет + точные настройки Supabase Auth; ASVS-строки V7.
- **Envelope/KMS секретов**: doc 07 §7 — контракт KEK(managed KMS)→per-secret DEK→`key_id`/`wrapped_dek`, ротация ключа независимо от `secret_version`; schema: `webhook_endpoints` + `secret_wrapped_dek`/`secret_key_id`; ASVS V11; DoD G4-02.
- **Audit-неизменяемость против DBA**: doc 25 §8 / doc 09 §4 — `REVOKE UPDATE/DELETE` со всех runtime-ролей, INSERT-only security-definer, per-partition hash-chain + off-box WORM sink; schema: `audit_events` + `prev_row_hash`/`row_hash`; DoD P0-A07.

## P2 — build-enabling

- **rate-limits.csv** (16 правил): per-endpoint/tenant/burst + OTP max-attempts/cooldown + публичные intake caps; тест `T-RATE-LIMIT-001`.
- **ASVS-полнота**: добавлены главы V7 Session, V9 Tokens, V11 Crypto, V2 Business-Logic, V12 Comms, V13 Config, V15 Secure-Coding + явные N/A для V10 OAuth и V17 WebRTC.
- **Threat-model 3 поверхности**: doc 25 §3 — version handshake, platform-billing audience, offline lease (+ P5: spreadsheet-injection, export-link enumeration).
- **UI-поверхность**: doc 05 §3 — 5 компонентов (inline-edit cell, date DD.MM.YYYY, numeric UA, dropzone, confirm-dialog); doc 04 §11 — per-screen state matrix (норма + 3 worked examples); doc 04 §6 — S29 native interaction contract (жесты, разрешения ОС, deep links, push, устойчивость); `copy-catalog.csv` (273 строки: статус-лейблы + per-screen состояния + действия); error-catalog `ui_surface` для всех 118 кодов.
- **QA/delivery**: тест `T-DELETION-EXEC-001` (исполнение необратимого удаления); deploy-runbook doc 26 §7 + `T-DEPLOY-SMOKE-001`.

## P3 — согласованность и планируемость

- **Индексы doc 39 §7 ↔ schema**: добавлены 4 composite index на link-таблицы/проекции (`evidence_requirement_links`, `payment_allocations`, `package_line_quantity_sources`, `readiness_snapshots`) — reverse-traversal канонических запросов; doc 39 §7 обновлён.
- **Backlog size**: колонка `size` (7 XL / 10 L / 42 M / 37 S), 7 монстров декомпозированы в `subtasks`; doc 28 §7 — критический путь ≈22 задачи, 6–9 мес = верхняя граница; design/mobile-QA явно вынесены как fractional-capacity.
- **doc 27 §2** смягчён: E2E-lifecycle и структурный класс — валидные способы покрытия edge-команд.
- **Цена пилота** согласована во всех доках: paid pilot 15–30k UAH/site (0 только под design-partner exception); P&L пилота (25–40 часов concierge → CAC/loss-leader) в doc 10/14/21.

## P4 — бизнес-слой

- **Юнит-экономика** doc 10 §9: таблица COGS/тенант + формула breakeven + триггер 30% ACV (числа замеряются с первого счёта).
- **Военный рынок** doc 02 §3: КВЭД 43.21/43.22/43.29 + фильтры + сценарии Base/Pessimistic/Reconstruction; go/no-go против Base.
- **5 новых рисков** doc 15: концентрация design-партнёра, site-level military/photo-prohibition, external-gate slippage, UAH/FX, founder mobilization.
- **Owner/Target у V-гейтов** doc 30 §2: 12 гейтов получили колонки владельца и срока.

## P5 — мелкие

RLS predicate SQL-шаблоны (doc 35 §5); package manifest JSON-schema (doc 39 §6); audit-форензика через edge/WAF join по `request_id` (doc 25 §8); orphan-тесты помечены cross-cutting (doc 27); указатель «doc 34 §3 = допуск, doc 28 §9 = успех» (doc 17); 3 KPI-target помечены «manual baseline» (doc 14/01).

## Что осталось вне спецификации (по построению)

Deferred за внешними гейтами (V-001…V-012 с owner/target в doc 30) и Partially — runtime-исполнение (device/WCAG/CI-прогоны/переводы, эмпирика таймингов). Числа юнит-экономики и КВЭД-выгрузка заполняются реальными данными — спека даёт формулы и структуру, не выдумывает цифры. Прототип в этом раунде не менялся; qa-results остаётся зелёным.

## Проверка

```bash
make validate
```

Полный конвейер (lint → build → Chromium smoke → контракты) пройден зелёным 24.07.2026.
