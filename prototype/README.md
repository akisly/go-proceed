# AktFlow interactive prototype

Высокодетализированный, но не production-прототип ключевых потоков. Данные синтетические; backend, реальная авторизация, платежи и загрузка файлов симулируются локальным React state.

## Запуск

```bash
npm install
npm run dev
```

Открыть `http://localhost:5173`.

## Маршруты

| Route | Surface |
|---|---|
| `/` | многоэкранный landing с тарифами и role demo |
| `/pilot` | двухшаговая квалификация pilot + receipt |
| `/login` | вход и симулированная сессия |
| `/reset-password` | безопасный recovery request + demo receipt |
| `/legal/privacy`, `/legal/terms` | честные границы privacy/terms прототипа |
| `/invite/demo` | preview приглашения, MFA consequence и activation receipt |
| `/onboarding` | пятишаговый setup: import/mapping → handoff в versioned rules → team |
| `/app` | executive readiness dashboard и work drawer |
| `/app/work` | фильтры и bulk selection реестра работ |
| `/app/evidence` | review queue: approve/return + immutable receipt |
| `/app/rules` | versioned rule editor: impact/stale guard/acknowledgement/publish receipt |
| `/app/baseline` | persisted contract-terms/reference impact preview → exact publish receipts |
| `/app/assignments` | bounded exact-version preview → partial row commit/rejections → occurrence receipt |
| `/app/occurrences/demo` | exact-subject typed evidence → hold/concealment → append-only invalidation consequence |
| `/app/variations` | реестр и guided variation notice |
| `/app/close` | period close cockpit, blockers, waiver и snapshot |
| `/app/packages` | реестр версий пакетов/поданий |
| `/app/packages/current` | manifest, generation, submission и pending → reconciled exact decision-set receipt |
| `/review/demo` | external reviewer exact-version/OTP/decision flow |
| `/app/payments` | project receivables и partial payment allocation |
| `/app/team` | роли, scopes, security и invite flow |
| `/app/billing` | тарифы, изменение плана и счета |
| `/app/settings` | workspace defaults и notification preferences |
| `/field` | mobile/offline capture → local receipt → server confirmation |

## Выбранная визуальная система

Прототип использует единственное выбранное направление `Evidence Atlas`. Его source board, сгенерированные синтетические изображения, asset manifest, crop rules, motion и route contract сохранены в `../design-references/evidence-atlas/`.

В коде используются production-копии:

- `/assets/evidence-atlas/blueprint-folio.png`;
- `/assets/evidence-atlas/cable-tray-evidence.png`;
- `/assets/evidence-atlas/verified-stamp.png`.

Все изображения синтетические и не содержат клиентских данных.

## Проверка

```bash
npm run lint
npm run build
TMPDIR="$PWD/qa-runtime-tmp" npm run qa
```

QA-script самостоятельно поднимает сервер из `dist` и проходит 17 flow families из `docs/29`: acquisition/invite, onboarding/rules, work/review/correction, variation/close/package/submission, external review, project payment, team access, SaaS billing, offline field, contract/reference baseline, assignment occurrences, hold/concealment и package line decisions. Он пишет 19 PNG в `qa-screenshots/` и machine-readable результат в `qa-results.json`, проверяет console/page errors, receipts, zero-results state, mobile overflow и критическое focus-поведение publish dialog. Для sandbox используется упакованный headless Chromium; в обычном CI должен использоваться закреплённый Playwright/browser image. Скрипт — smoke прототипа, не security/E2E доказательство production-системы и не WCAG-аудит.

## Важная граница

Это visual/interaction specification. Production-реализация должна использовать архитектуру, права, RLS, audit, offline outbox и security gates из документов верхнего уровня — не копировать demo state как прикладную модель.
