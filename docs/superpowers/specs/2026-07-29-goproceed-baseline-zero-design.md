# GoProceed Baseline 0 — дизайн очистки, документации и версионирования

Дата: 2026-07-29  
Статус: approved design  
Владелец: founder  
Применяется к: Baseline 0 и продуктовым версиям `0.1.0`–`1.0.0`

## 1. Назначение

Baseline 0 приводит репозиторий к состоянию, в котором:

- фактический runtime, целевая модель, discovery и история больше не смешиваются;
- активная документация описывает реальный GoProceed, а не прежнюю полноту пакета v2.9;
- ценная незавершённая работа сохранена и интегрирована до удаления файлов и worktree;
- публичный бренд GoProceed отделён от временно сохраняемых технических идентификаторов `aktflow`;
- roadmap строится по закрываемым пользовательским результатам, а не по календарным обещаниям;
- проверки воспроизводимы, оставляют Git чистым и честно разделяют быстрые, database и demo-наборы;
- после Baseline 0 можно планировать `0.1.0` как сопровождаемый web + online-mobile пилот.

Baseline 0 не реализует новые пользовательские функции. Это внутренний gate качества проекта, а не публичный релиз.

## 2. Исходное состояние и причины пересмотра

### 2.1 Четыре разные поверхности

В текущем репозитории одновременно существуют:

- `apps/app` — production runtime skeleton;
- `apps/landing` — отдельный постоянный публичный сайт;
- `apps/demo` — временный discovery demo на синтетических данных;
- `prototype` — legacy-прототип, связанный с валидатором старого пакета.

Роли этих поверхностей недостаточно ясно отражены в корневой документации.

### 2.2 Target package не равен runtime

Старый пакет описывает крупную целевую систему: 126 таблиц, 157 API-операций и 96 backlog-задач. Фактический runtime содержит только первый foundation slice: шесть основных runtime-таблиц, два API-маршрута и минимальные web-страницы.

`README.md` и `docs/17-production-readiness-index.md` всё ещё утверждают, что runtime `NOT_STARTED`, а `technical/implementation-backlog.csv` помечает все задачи как `not_started`. Это противоречит коду и CI.

### 2.3 Документация смешивает разные уровни истины

Плоский набор `docs/00`–`docs/40` одновременно содержит:

- продуктовые решения;
- целевую архитектуру;
- release gates;
- детальные технические контракты;
- исторические аудиты;
- завершённые планы;
- amendments, которые отменяют другие разделы в том же файле;
- discovery-операции.

Особенно перегружен `docs/40-phase1-discovery-outreach.md`: актуальные решения, исторический план, engineering amendments и operational templates находятся в одном документе.

### 2.4 Git содержит несведённую ценную работу

До очистки необходимо сохранить:

- два удалённых коммита `main`, отсутствующие в локальной `main`;
- discovery-ветку с 21 уникальным коммитом и проходящими тестами;
- незакоммиченные P0-A review-материалы в отдельном worktree;
- приватные outreach-черновики, рассеянные по `.claude/` и `apps/`;
- текущие пользовательские изменения `.gitignore`, `AGENTS.md` и локальных настроек.

Ветка механического обновления всех GitHub Actions до `v7` не является готовой к слиянию и должна быть заменена точечным корректным обновлением.

### 2.5 Discovery уже идёт

Founder сообщил об отправке outreach 50 компаниям. Внешний campaign workbook содержит 50 компаний, но детальный журнал отправки охватывает 22 новых лида: 21 отмечен отправленным, один — без подтверждённого email. Поэтому Baseline 0 должен отделить:

- подтверждённый факт отправки founder;
- неполный локальный журнал;
- ответы, bounce и follow-up, которые ещё требуется свести в единый источник.

Персональные контакты и тексты индивидуальных писем не должны попадать в Git.

## 3. Утверждённые продуктовые решения

### 3.1 Публичный бренд

- GoProceed — новое публичное имя продукта.
- `AktFlow`/`aktflow` временно остаётся во внутренних package names, database roles, migrations, environment keys и GitHub repository.
- Публичный rename выполняется в Baseline 0.
- Полный технический rename выполняется позже отдельной миграцией с inventory, compatibility plan и rollback.
- Собственный домен не блокирует ранние версии; временно используются бесплатные Vercel hostnames.
- Публичные URL задаются через environment configuration и не хардкодятся в приложениях.
- Старый `aktflow-demo` URL нельзя немедленно отключать: он уже находится в отправленных письмах.

### 3.2 Роли приложений

| Поверхность | Постоянство | Назначение | Ограничения |
|---|---|---|---|
| `apps/landing` | постоянная | главный публичный сайт GoProceed | static-first; без Supabase server client и product API |
| `apps/app` | постоянная | authenticated web-продукт и будущий public `/demo` | единственная production web-поверхность |
| `apps/mobile` | с `0.1.0` | online field companion, позже offline | один Expo codebase; Android-first acceptance |
| `apps/demo` | временная | текущий discovery demo для outreach | только синтетические данные; сохраняется до parity нового `/demo` |
| `prototype` | временный reference | история v2.9 и визуальные свидетельства | не runtime; удаление возможно только после отделения валидатора |

### 3.3 Граница первой версии

`0.1.0` — сопровождаемый concierge pilot на одном объекте.

Web outcome:

1. настройка организации и объекта;
2. импорт сметы;
3. founder-assisted mapping и настройка требований;
4. привязка доказательств к работам;
5. расчёт readiness, blockers и value at risk;
6. внутренний review;
7. формирование воспроизводимого пакета;
8. аудит критичных изменений и полный экспорт.

Mobile outcome:

1. вход;
2. выбор объекта;
3. список назначенных работ;
4. просмотр требований;
5. фиксация фото, количества и комментария;
6. online-отправка;
7. серверное подтверждение;
8. просмотр возврата или замечания.

В `0.1.0` не входят:

- offline database;
- persistent outbox;
- background sync;
- resumable upload;
- offline authorization lease;
- conflict resolution;
- self-service setup;
- автоматизация billing;
- внешние интеграции.

При отсутствии сети mobile явно сообщает, что отправка требует подключения, и не показывает успешную синхронизацию до server acknowledgement.

### 3.4 Платформенный приоритет mobile

- один Expo codebase поддерживает Android и iOS;
- acceptance первой версии выполняется Android-first;
- полная offline-надежность становится результатом `0.3.0`, а не скрытым требованием `0.1.0`.

## 4. Будущая демонстрация внутри `apps/app`

### 4.1 Route boundary

Постоянная демонстрация продукта реализуется как отдельное публичное пространство:

```text
/demo/*    synthetic public demo
/app/*     authenticated product
/login     authentication
/v1/*      production API
```

`?demo=true` не используется для переключения режима. Query-параметры допустимы только внутри `/demo` для выбора сценария или шага, например:

```text
/demo?scenario=electrical
/demo?step=package
```

### 4.2 Общий UI, разные источники данных

Demo и production используют общие feature-компоненты:

```text
shared feature components
├── demo repository       → synthetic fixtures + session-only state
└── product repository    → authenticated API + Supabase-backed runtime
```

Demo boundary обязан обеспечивать:

- отсутствие импорта Supabase client в demo data layer;
- отсутствие mutation-вызовов production API;
- постоянную маркировку синтетических данных;
- reset сценария;
- `noindex`;
- отдельную analytics-метку `surface=demo`;
- автоматический тест network boundary;
- один целостный демонстрационный workflow вместо копии всего продукта.

### 4.3 Переход с текущего demo

1. `apps/demo` и старый Vercel URL сохраняются для уже отправленного outreach.
2. `apps/landing` использует настраиваемый `DEMO_URL`.
3. Сначала стабилизируется реальный flow `0.1.0` в `apps/app`.
4. Затем те же feature-компоненты подключаются к demo repository под `/demo`.
5. Landing переключается на `APP_URL/demo` только после parity-проверки.
6. Код `apps/demo` удаляется после завершения перехода; совместимость старой ссылки сохраняется на согласованный период.

Это решение отменяет старую идею автоматически создавать ephemeral sandbox tenant для каждого demo-посетителя. Первая постоянная demo-версия должна быть client/session-local и не использовать production tenancy.

## 5. Целевая структура репозитория

```text
/
├── README.md
├── AGENTS.md
│
├── apps/
│   ├── landing/
│   ├── app/
│   ├── mobile/               # создаётся в 0.1.0, не в Baseline 0
│   └── demo/                 # временно
│
├── packages/
├── supabase/
├── infra/
├── scripts/
│
├── discovery/
│   ├── README.md
│   ├── src/
│   ├── methodology/
│   ├── public-corpus/
│   ├── reports/
│   └── private/              # gitignored
│
├── docs/
│   ├── README.md
│   ├── current/
│   │   ├── PRODUCT.md
│   │   ├── STATUS.md
│   │   ├── ROADMAP.md
│   │   ├── ARCHITECTURE.md
│   │   ├── DELIVERY.md
│   │   └── VALIDATION.md
│   ├── decisions/
│   ├── releases/
│   ├── reference/
│   └── archive/
│
├── spec/
│   └── features.yaml
│
└── reference/
    └── legacy-v2.9/
```

Физическое перемещение старых файлов выполняется поэтапно после обновления ссылок и валидатора. Целевая структура не разрешает big-bang move, который одновременно ломает CI, документацию и историю.

## 6. Новая иерархия документации

### 6.1 Активный слой

| Документ | Единственная ответственность |
|---|---|
| `docs/README.md` | карта документации и правила статусов |
| `docs/current/PRODUCT.md` | проблема, ICP, outcome, scope и non-goals |
| `docs/current/STATUS.md` | что фактически реализовано и проверено сейчас |
| `docs/current/ROADMAP.md` | версии, outcomes, gates и последовательность |
| `docs/current/ARCHITECTURE.md` | только фактическая архитектура и одобренные ближайшие границы |
| `docs/current/DELIVERY.md` | workflow, DoD, релизы, migration/rollback |
| `docs/current/VALIDATION.md` | тесты, внешние evidence gates и ограничения |

### 6.2 Decisions

Минимальный начальный набор ADR:

- GoProceed как публичный бренд при временном `aktflow` namespace;
- web-first concierge pilot с online mobile в `0.1.0`;
- offline как milestone `0.3.0`;
- постоянный demo через `/demo`, а не query mode;
- `apps/landing` как отдельная постоянная публичная поверхность.

### 6.3 Reference и archive

- `docs/reference/` содержит только проверенные подробные спецификации, необходимые для текущей или ближайшей версии.
- `docs/archive/` содержит завершённые планы, superseded decisions и исторические аудиты.
- `reference/legacy-v2.9/` — временная зона разбора старого package, а не альтернативный активный источник истины.
- После переноса полезного содержания полностью устаревшие материалы могут быть удалены: Git history остаётся механизмом восстановления.

## 7. Аудит старого пакета

### 7.1 Migration ledger

Для каждого документа или machine-readable artefact фиксируется:

```text
source
decision
destination
reason
evidence
owner
reviewed_at
```

Допустимые решения:

- `KEEP` — актуален без структурного изменения;
- `MERGE` — полезное содержание объединяется с другим источником;
- `REWRITE` — смысл сохраняется, документ строится заново;
- `HYPOTHESIS` — требует внешнего evidence gate;
- `ARCHIVE` — полезен только как история;
- `DELETE` — дубликат, generated output или полностью неактуален.

### 7.2 Тематические проходы

Пакет проверяется группами:

1. product, ICP, JTBD и workflows;
2. roadmap, delivery и release gates;
3. data model, permissions и API;
4. security, legal и tenancy;
5. QA, SRE и release evidence;
6. design, screens и prototype;
7. discovery, GTM и outreach.

Содержание переносится после проверки:

- соответствует ли оно согласованному продукту;
- реализовано ли оно фактически;
- подтверждено ли оно customer/public evidence;
- не противоречит ли другим решениям;
- к какой версии относится;
- необходимо ли оно для безопасности или миграционной совместимости.

## 8. Roadmap и versioning

### 8.1 Product versions

Используется milestone-based SemVer:

- `0.x.0` — новый закрытый пользовательский outcome;
- `0.x.y` — совместимые исправления;
- `1.0.0` — самостоятельный стабильный продукт.

Дата является прогнозом и не определяет закрытие версии.

API, database и domain configuration версионируются отдельно:

- API остаётся `/v1` до breaking change;
- migrations имеют монотонный порядок;
- опубликованные rule/config versions неизменяемы;
- документация использует `applies_to` и `last_reviewed`, а не отдельный marketing version.

### 8.2 Discovery track

| Gate | Outcome |
|---|---|
| D0.1 | сведены 50 отправок, bounce, ответы и follow-up |
| D0.2 | получены problem interviews и обезличенные workflow/artifacts |
| D0.3 | одна компания, один объект, data terms и pilot criteria |
| D0.4 | paid или conditional-paid signal |

Baseline 0 и synthetic/public-corpus части `0.1.0` не ждут D0.3. Реальные клиентские данные не допускаются до закрытия нужных privacy и operational gates.

### 8.3 Product ladder

| Версия | Outcome |
|---|---|
| Baseline 0 | чистый, понятный, проверяемый проект |
| `0.1.0` | concierge web + online-mobile pilot на одном объекте |
| `0.2.0` | повторяемый web/mobile pilot с меньшим founder-assisted setup |
| `0.3.0` | durable offline field workflow, outbox, resumable upload и sync recovery |
| `0.4.0` | несколько платных клиентов, monitoring, backup/restore и controlled operations |
| `1.0.0` | самостоятельный основной lifecycle без обязательного founder сопровождения |

### 8.4 Feature registry

`spec/features.yaml` хранит продуктовые функции, а не технические subtasks:

```text
id
user_outcome
status
target_release
evidence
dependencies
feature_flag
data_api_impact
acceptance
decision
last_updated
```

Жизненный цикл:

```text
hypothesis
→ validated
→ planned
→ building
→ beta
→ stable
→ deprecated
→ removed
```

Дополнительные terminal/parking states: `deferred`, `rejected`.

`ROADMAP.md` хранит outcomes и gates. `features.yaml` хранит feature assignments. Version implementation plan хранит технические задачи. Эти уровни не дублируют друг друга.

### 8.5 Scope control

Новая функция попадает в активную версию, только если она:

- поддерживает основной workflow;
- подтверждена design partner;
- закрывает security/reliability requirement;
- заметно сокращает повторяемую ручную операцию;
- является необходимой зависимостью утверждённого outcome.

Расширение активной версии требует явного решения о trade-off. AI не добавляет соседние функции автоматически.

## 9. Definition of release closure

Версия закрывается только когда:

1. заявленный пользовательский outcome проходится целиком;
2. acceptance tests проходят;
3. изменённые tenant/security boundaries проверены;
4. migration и rollback описаны;
5. документация соответствует поведению;
6. ограничения и deferred scope записаны;
7. release evidence сохранён;
8. deployment проверен;
9. `STATUS.md`, `ROADMAP.md` и feature registry обновлены;
10. создан release note.

Процент готовности не является release gate.

## 10. Безопасная последовательность Baseline 0

### Шаг 1. Preservation

- снять точный Git inventory;
- создать рабочую cleanup-ветку только после сохранения локальных изменений;
- интегрировать актуальную remote `main`;
- сохранить discovery commits и P0-A untracked review;
- перенести private outreach drafts в gitignored location;
- не удалять branch/worktree до подтверждения сохранности.

### Шаг 2. Product boundaries и ADR

- записать утверждённые роли приложений;
- записать public-brand/technical-namespace boundary;
- записать `0.1.0` mobile scope и `0.3.0` offline scope;
- записать `/demo` architecture;
- ввести environment-owned public URLs.

### Шаг 3. Active documentation skeleton

- создать `docs/current`, `docs/decisions`, `docs/releases`;
- переписать корневой `README.md` как короткий портал;
- создать честный `STATUS.md`;
- создать roadmap и compact feature registry;
- пометить старый пакет `legacy_under_review` без немедленного удаления.

### Шаг 4. Content audit

- провести семь тематических проходов;
- заполнить migration ledger;
- переносить подтверждённое содержание;
- создавать validation gates для hypotheses;
- разрешить противоречия через ADR или явный release scope.

### Шаг 5. Repository cleanup

- убрать completed handoffs и plans из active layer;
- удалить exact duplicate assets;
- перестать отслеживать generated QA screenshots;
- убрать лишние nested config;
- игнорировать `.agents`, local `.claude`, caches и QA output;
- исправить `.gitignore`, разрешив tracked `.env.example`;
- удалить obsolete branches/worktrees после preservation;
- решить судьбу prototype после decoupling validator.

### Шаг 6. Truthful verification

Целевая команда-модель:

```text
verify          fast deterministic checks; leaves Git clean
verify:db       Supabase/RLS integration; explicit prerequisites
verify:demo     current discovery demo checks
verify:all      complete CI sequence
```

Дополнительные требования:

- Node 24 закреплён локально и в CI;
- GitHub Actions обновляются точечно на реальные major versions;
- database tests выполняются в корректной последовательности;
- validator не перезаписывает tracked artefacts;
- legacy prototype перестаёт быть скрытым обязательным условием runtime validation;
- clean clone и local/CI flows документированы одинаково.

### Шаг 7. Baseline 0 closure

Baseline 0 закрыт, если:

- ценная работа интегрирована;
- private outreach data отсутствует в Git;
- active documentation является единственным текущим source of truth;
- legacy package классифицирован;
- роли landing/app/mobile/demo/prototype однозначны;
- GoProceed используется на публичных поверхностях;
- старые outbound links сохраняют совместимость;
- clean clone проходит `verify`;
- `verify` не изменяет working tree;
- `STATUS.md` честно отражает runtime;
- roadmap, feature registry и release rules согласованы.

## 11. Явные non-goals Baseline 0

- создание `apps/mobile`;
- реализация product features `0.1.0`;
- полный technical rename `aktflow → goproceed`;
- рефакторинг auth/RLS/grants;
- переписывание существующих migrations;
- создание `/demo` внутри `apps/app`;
- отключение старого demo URL;
- отправка новых outreach-писем;
- изменение внешних систем без отдельного решения.

## 12. Риски и mitigations

| Риск | Mitigation |
|---|---|
| Потеря незакоммиченной работы | preservation manifest и проверка каждого worktree до удаления |
| Документационный big bang | migration ledger и тематические проходы |
| Новый active layer дублирует старый | каждый active документ имеет одну ответственность |
| Brand rename ломает runtime | public rename сейчас, technical migration позже |
| Старые письма ведут в пустоту | old demo URL сохраняется до transition gate |
| Demo получает production access | отдельный `/demo` boundary и demo repository contract |
| Mobile `0.1.0` незаметно превращается в offline | явный online-only scope и offline milestone `0.3.0` |
| Validator продолжает пачкать Git | отдельные deterministic checks и запрет tracked generated output |
| Scope растёт из старого v2.9 package | feature registry + release outcome + explicit trade-off |
| Персональные данные попадают в commit | gitignored private discovery storage и aggregate-only reports |

## 13. Решения, которые эта спецификация supersedes

В части конфликтов эта спецификация имеет приоритет над:

- заявлениями `README.md` и doc 17 о полностью `NOT_STARTED` runtime;
- плоским roadmap docs 12/28/34;
- blanket `not_started` состоянием `technical/implementation-backlog.csv`;
- demo-идеей ephemeral tenant из старого P0-A design;
- переносом всего mobile/offline scope в один поздний P0-D slice;
- любыми указаниями удалять или объединять `apps/landing`;
- использованием AktFlow как текущего публичного бренда.

Security/data invariants из уже реализованного P0-A не отменяются. Их изменение не входит в Baseline 0 и требует отдельного approved design.
