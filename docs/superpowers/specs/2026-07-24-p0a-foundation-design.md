# P0-A Foundation & Safe Tenancy — Design (prototype → real app, slice 1)

Дата: 2026-07-24
Статус: approved design, готов к writing-plans
Источник scope: `docs/28-pilot-ga-delivery.md` (P0-A), `docs/07-technical-architecture.md`, `technical/schema.sql`, `technical/data-access-surface.csv`

## 1. Цель и границы

Первый **реальный** (не прототипный) слой AktFlow. Прототип в `prototype/` — visual/interaction specification на synthetic React state; production строится с нуля по фиксированной архитектуре doc 07 и не копирует demo-state как прикладную модель.

Слайс = **P0-A "Foundation and safe tenancy"** целиком (Approach A): один связный дизайн-документ на весь фундамент, реализация — 4 последовательных плана, каждый независимо shippable и тестируемый против реальной инфраструктуры.

Вне scope P0-A (идёт позже): commercial baseline (P0-B), rules/readiness (P0-C), offline field (P0-D), review (P0-E), package (P0-F), operate (P0-G), а также **demo/sandbox** и `apps/mobile`/`apps/worker`.

## 2. Инфраструктура (greenfield)

| Concern | Выбор | Обоснование |
|---|---|---|
| Repo | GitHub, один monorepo (pnpm + Turborepo) | doc 07 §3 |
| Web + BFF | Vercel, `apps/app` (Next.js 16.2.11+ patched 16.2.x) | native Next.js 16 host, preview envs, edge/WAF |
| Landing | Vercel, `apps/landing` (Next.js), домен `aktflow.com` | публичный SEO/marketing/mobile-preview; static-first; **без BFF** |
| App домен | `app.aktflow.com` | authenticated-поверхность разведена с публичной на уровне деплоя |
| DB/Auth/Storage | Supabase — проекты `dev` + `staging` | RLS/SQL, managed ops; prod — на GA gate |
| Worker | **нет отдельного сервиса**; outbox drain = Supabase `pg_cron` + Edge Function `outbox-drain` | у outbox в P0-A нет тяжёлой нагрузки; полноценный Node-worker вводим, когда появится реальная работа |
| CI | GitHub Actions | lint, typecheck, unit, migration apply + RLS negative tests на ephemeral Postgres, build |
| Secrets | Vercel + Supabase env stores; `.env.local` gitignored | никаких секретов в repo |

Среды: `dev` (локально + dev Supabase) → `staging` (задеплоено, цель exit-критериев) → `prod` (отложено до GA gate, doc 28). Prod в P0-A отсутствует.

Version baseline (doc 07): Next.js 16.2.11+ (generic `16.2` запрещён), pin точных patch-версий и image digests.

## 3. Структура репозитория

```text
apps/
  landing/     Next.js — публичный лендинг, SEO-страницы, mobile preview. Static-first, без BFF.
  app/         Next.js — приложение + BFF (/v1/*), за логином. Sandbox/demo — отложено.
supabase/
  migrations/          SQL миграции (schema, roles, RLS, grants, pg_cron)
  functions/
    outbox-drain/      Edge Function, вызывается pg_cron
packages/
  domain/              чистый TS: entities, инварианты, без I/O (org, membership, scope)
  contracts/           zod-схемы + generated types = единый источник API I/O + валидации
  database/            типизированный query-слой, транзакционный паттерн, migration runner, seed fixtures
  ui/                  общие design tokens + web-примитивы (landing + app)
  testing/             shared test helpers (tenant fixtures, negative-policy harness)
infra/                 GitHub Actions workflows, env templates
```

Границы (isolation):
- `packages/domain` — бизнес-правила, без I/O, тестируется изолированно.
- `packages/contracts` — единственное место, где живут request/response shapes; runtime-валидация = эти zod-схемы (doc 07 §4).
- `apps/app` BFF handlers — тонкие: validate (contracts) → tenant-scoped tx → domain → атомарный commit domain+audit+outbox. Никакой бизнес-логики в route-файлах.
- `packages/database` — владеет транзакционным паттерном (set `app.actor_user_id`/org/request context, least-priv `aktflow_app`), чтобы каждый handler переиспользовал один audited путь.

## 4. Sub-slice 1 — Skeleton + tenancy core (первый план)

Цель: один authenticated tenant-scoped vertical насквозь, задеплоенный на staging, закладывающий переиспользуемый транзакционный паттерн.

### 4.1 Data model (из существующей `technical/schema.sql`, без изменений)
`organizations`, `legal_entities`, `memberships`, плюс `audit_events`, `transaction_outbox`, `idempotency_records`. Новых колонок не добавляем (demo-hook `kind`/`expires_at` отложен целиком).

### 4.2 Vertical

| | Endpoint | Что доказывает |
|---|---|---|
| Bootstrap-команда | `POST /v1/organizations` — единственный authenticated route **без** `X-Organization-Id` | атомарно: `organization` + `legal_entity` + owner-`membership` + `audit_event` + `transaction_outbox` |
| Tenant-scoped чтение | `GET /v1/me/context` → memberships + orgs текущего пользователя | RLS: пользователь A физически не видит org пользователя B |

### 4.3 Транзакционный паттерн (`packages/database`, `withTenantTx(actor, orgId, requestId, fn)`)
1. верификация Supabase access token server-side;
2. резолв активного membership + version;
3. `begin`; transaction-local `app.actor_user_id` / `app.organization_id` / `app.request_id` / `app.membership_version`;
4. выполнение под least-priv `aktflow_app` (`NOLOGIN`, `NOBYPASSRLS`);
5. атомарный commit domain-change + `audit_event` + `transaction_outbox`;
6. reset контекста на конце транзакции. Pooled-соединение никогда не несёт session-level tenant context.

`Idempotency-Key` обязателен для `POST` → `idempotency_records`; повтор возвращает тот же результат, вторая org не создаётся.

### 4.4 Роли и доступ (`technical/data-access-surface.csv` = allowlist, всё остальное deny)
- `authenticated` — только `SELECT` на reviewed `api`-проекциях; никаких мутаций tenant-таблиц;
- `aktflow_app` — group-роль BFF, гранты из allowlist;
- `service_role` — только миграции/break-glass; запрещён для обычных запросов;
- RLS включён на `organizations`, `memberships` (и всех tenant-таблицах); политики через `app.organization_id` + membership.

### 4.5 Outbox drain (минимальный)
`pg_cron` каждые N секунд → Edge Function `outbox-drain` → unprocessed rows → `processed_at`. Реального consumer нет; слайс доказывает механизм (transactional enqueue → durable drain).

## 5. Error handling (doc 07 §4)

Единый `application/problem+json` envelope: `code`, `detail` (localized-safe), `fieldErrors` (из zod), `requestId`, `retryable`, `userAction`. `X-Request-Id` на каждом request/response, тот же id → `audit_events.request_id`. `If-Match`/`version` для конфликтов (envelope закладываем сейчас, реальные конфликты — со слайса 2). Ошибка commit (audit/outbox) откатывает всю транзакцию.

## 6. Testing (TDD, red→green; фундамент — высокая планка)

| Уровень | Покрытие |
|---|---|
| Unit (`packages/domain`) | инварианты создания org + owner-membership, без I/O |
| Contract (`packages/contracts`) | zod для `POST /v1/organizations` и `/v1/me/context`, happy + invalid |
| Integration (ephemeral Postgres в CI) | `withTenantTx`: org+legal_entity+membership+audit+outbox атомарно; rollback при инъекции ошибки |
| RLS negative-policy (headline) | A не читает org B; подмена `app.organization_id` не даёт доступа; `aktflow_app` не обходит RLS |
| Idempotency | повтор `POST` с тем же ключом → тот же результат |
| Outbox drain | enqueue → pg_cron/Edge Function → `processed_at` |

Negative-policy harness живёт в `packages/testing` и переиспользуется всеми будущими слайсами — самый ценный тестовый актив P0-A. Всё гоняется в GitHub Actions на ephemeral Postgres до деплоя на staging.

**Exit-критерий sub-slice 1:** на staging authenticated пользователь создаёт org и читает контекст; cross-tenant read падает в тестах; audit + outbox записаны; idempotent replay доказан; CI зелёный.

## 7. Последовательность планов P0-A

`Слайс 1 → 2 → 3 → 4`, каждый = отдельный spec→plan→implement цикл.

1. **Skeleton + tenancy core** (детально в §4) — monorepo, CI, dev+staging Supabase, деплой; `organization`/`legal_entity`/`membership`; Supabase Auth login; `withTenantTx`; `POST /v1/organizations` + `GET /v1/me/context`; audit+outbox; RLS.
2. **Membership & scopes** — exact scope copy (`membership_project_scopes`/`membership_location_scopes`), role/scope модель, инвариант no-owner-elevation, cross-tenant/location negative-suite (headline exit P0-A).
3. **Invitations** — `POST`/accept (атомарный bind identity/MFA/terms) / reissue / revoke-acts-immediately.
4. **Pilot subscription & override authority** — plan state, override, fail-closed command-availability gate (`technical/command-availability.csv`).

## 8. Отложено (форвард-решения зафиксированы, не строятся)
- **Demo/sandbox**: живёт в `apps/app`, переиспользует реальные code paths, реализация — ephemeral per-visitor sandbox tenant с TTL/GC. Строится поверх готового фундамента, после P0-A. Схема P0-A остаётся чистой (никаких `kind`/`expires_at`).
- `apps/mobile` (Expo), `apps/worker` (Node) — вводятся в P0-D и когда outbox получит реальную нагрузку.
