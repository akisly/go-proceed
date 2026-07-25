# 03. Персоны, JTBD и end-to-end workflow

## 1. Account buying committee

### 1.1 Олег — собственник/коммерческий директор

- Компания: электромонтаж, 45 сотрудников, 5 объектов.
- Решает: купить/не купить, назначить owner, выделить бюджет.
- Видит проблему как: зависшие деньги, кассовый разрыв, сюрпризы в конце месяца.
- Боится: ещё одной системы, сопротивления прорабов, утечки смет и контрактов.
- Требует: сумма под риском, доказанный ROI, read-only обзор, экспорт и безопасность.
- JTBD: «Когда я распределяю оборотные деньги между объектами, покажите, какую оплату реально можно ожидать и что мешает её предъявить».
- Activation: видит свой реальный объект и минимум один денежный blocker в первый день.

### 1.2 Ірина — руководитель ПТО

- Решает: пригодность workflow и templates.
- Боль: chase прорабов, версии файлов, возвраты, ручная сверка.
- Боится: ложной автоматизации и неправильных форм.
- Требует: прозрачные rules, review queue, versioning, source file, bulk actions с контролем.
- JTBD: «До дедлайна закрытия я хочу видеть недостающие документы по каждой позиции, чтобы не собирать пакет ночью».
- Activation: импортирует Excel и настраивает первый rule template менее чем за 60 минут с помощью onboarding.

### 1.3 Максим — project manager

- Боль: изменения и устные распоряжения теряются, GC поздно отвечает.
- Требует: fast variation notice, owner, deadline, external link, status/aging.
- JTBD: «Когда заказчик просит отступление от scope, я хочу зафиксировать notice и backup в тот же день, чтобы сохранить право на оплату».
- Pilot activation: назначает work/evidence request и доводит blocker до internal readiness. GA activation: создаёт variation из фото/голоса и отправляет scoped link без регистрации recipient.

### 1.4 Сергій — прораб

- Устройство: бюджетный Android, плохой интернет, перчатки, яркий свет.
- Мотивация: закончить работу, а не вести документооборот.
- Боится: контроль, сложные формы, двойной ввод.
- Требует: today list, recent location, камера, голос, offline, крупные кнопки.
- JTBD: «Перед тем как закрыть кабель/трубу, приложение должно за минуту сказать, что снять, и дать сразу вернуться к работе».
- Activation: первая offline фиксация без помощи офиса.

### 1.5 Наталія — сметчик/биллинг

- Боль: cumulative, перенос в формы, corrections, разный format каждого customer.
- Требует: locked period, line mapping, totals, exceptions, export.
- JTBD: «Когда формирую закрытие, я хочу включить только проверенные объёмы и получить пакет в форме заказчика без повторного ввода».

### 1.6 Reviewer генподрядчика — GA external actor

- Не является регулярным пользователем.
- Не хочет регистрироваться или осваивать продукт субподрядчика.
- Требует: secure link, понятный scope, файлы, одно решение, audit receipt.
- JTBD: «Когда субподрядчик прислал изменение/пакет, я хочу увидеть всё доказательство в одном месте и ответить без поиска писем».

## 2. Role hierarchy

Матрица ниже описывает целевой Pilot+GA продукт. `External viewer` и variation/project-commercial capabilities включаются только в GA; наличие роли в модели не является Pilot entitlement.

| Role | Scope | Основные возможности |
|---|---|---|
| Organization owner | Organization | Billing, security, all projects, export |
| Admin | Organization | Users, templates, integrations, projects |
| Commercial/finance | Organization/project | Amounts, packages, payments, reports |
| PTO lead | Organization/project | Rules, review, package QA |
| Project manager | Project | Work, variations, review, package draft |
| Estimator/billing | Project | Contract lines, quantities, package/export |
| Foreman | Assigned project/location | Capture, drafts, own corrections |
| Worker/capture-only | Assigned work | Minimal capture, no financial values optional |
| Internal reviewer | Project | Approve/reject/waive according to policy |
| External viewer | Explicit share | View/comment/acknowledge only shared data |
| Auditor | Organization/project | Read + audit/export, no mutation |
| Integration admin | Organization | Integrations, webhook endpoints, API credentials; no financial decisions |
| Security admin | Organization | Security exceptions, capture-authorization recovery, offboarding execution |

Persona-строки выше отображаются на канонические 14 ролей `technical/permissions.csv` (Commercial/finance → `commercial_manager`, PTO lead → `pto_manager`, Estimator/billing → `estimator`, Worker/capture-only → `field_worker`, External viewer → `external_reviewer`); матрица permissions.csv первична.

## 3. End-to-end lifecycle

### Workflow A — Company activation

1. Buyer requests pilot from landing.
2. Operator qualifies company: active project, pain, owner, documents.
3. Workspace created; admin receives magic link.
4. Admin enters legal/company profile and security preferences.
5. Invites 1 ПТО + 1 PM + 1 foreman.
6. Imports estimate/SOV.
7. Mapping preview flags exceptions; admin confirms.
8. Chooses trade template; adjusts 5–10 critical requirements.
9. Creates first project/location structure.
10. Foreman completes test capture offline.
11. Pilot baseline saved: current closing time, return count, amount under risk.

Failure recovery:

- abandon wizard → resume exact step;
- corrupt Excel → download error report and upload corrected version;
- mapping uncertain → book assisted setup without losing file;
- no mobile app → QR to store/deep link or limited PWA fallback.

### Workflow B — Planned work and capture

1. PM creates/bulk-previews assignments from work items with exact location, planned quantity, assignee, due window and a stable operation ID per row.
2. A bounded commit returns a row-level receipt: accepted rows persist independently, rejected rows retain exact errors for correction/replay, and retries cannot duplicate accepted assignments.
3. Rule engine expands immutable requirement occurrences for each accepted assignment/location/timing/date/batch/quantity trigger.
4. Foreman opens Today from a versioned scoped assignment cache.
5. Selects assignment; app shows exact work, location, remaining assignment quantity, current references and required occurrences.
6. Enters quantity, confirms location, captures photos/voice against the exact occurrence.
7. Local validator warns about missing blocker before save.
8. User can save offline anyway; item remains incomplete.
9. Outbox syncs metadata/files with the exact subject tuple.
10. Server verifies checksum and calculates readiness.
11. ПТО receives review task only when minimum evidence is present.

### Workflow C — Before concealment

1. Requirement occurrence has timing `before_concealment`, due trigger and hold-point policy.
2. Assignment receives prominent but non-alarming reminder.
3. Foreman captures required angles/marking/typed measurement against exact occurrence and reference revision.
4. Reviewer records pass, pass-with-notes or fail; optional remote witness identity/assurance is explicit.
5. Authorized actor records append-only closure/concealment event against exact occurrence.
6. If proof missing, dashboard shows full affected amount as blocked; system never pretends evidence can be recreated later.

### Workflow D — Variation (GA)

1. Foreman/PM records unexpected scope via photo + voice.
2. System creates draft variation and links original work/location.
3. Contract policy computes notice deadline; user verifies.
4. PM adds scope/amount/rates and selects recipient.
5. Notice sent via secure link/email; delivery event recorded.
6. Recipient views and acknowledges/comments/approves according to permission.
7. PM converts approved change into contract line/version.
8. Performed-but-unapproved amount remains separate risk bucket.

### Workflow E — Internal review

1. Evidence enters queue ordered by amount × urgency.
2. Reviewer sees source, metadata, requirement and related quantity.
3. Reviewer approves/rejects/requests more/waives.
4. Reject requires taxonomy reason and optional annotation.
5. Field user receives concrete correction task, not generic «отклонено».
6. Readiness updates; owner sees change in risk value.

### Workflow F — Period close/package

1. Billing user creates July 2026 period with cutoff.
2. System snapshots contract/rule versions.
3. Candidate lines calculated from approved performed quantities.
4. Preflight separates ready, warning and blocked; GA дополнительно выделяет unapproved variation.
5. User resolves or excludes blockers with reason.
6. Preview shows current/prior/cumulative/remaining values.
7. Generate customer-specific package.
8. Internal approval chain signs off.
9. Package locks and is submitted by selected channel.
10. Submission receipt/external reference stored.

### Workflow G — Return and resubmission

Pilot вручную фиксирует return reason и формирует новую immutable package version. Автоматический exact-version external review и богатый delta compare включаются в GA.

1. User records package returned, amount and reason.
2. Decision items map reasons and modified amount to exact package lines/requirements/evidence.
3. Correction tasks assigned.
4. Package v2 references immutable v1; GA compare service produces a structured delta summary.
5. Resubmit; aging continues but distinguishes cycles.
6. Template owner receives rule improvement suggestion after close.

### Workflow I — Reference revision change

1. PTO uploads a reference document and publishes number/revision/status.
2. Assignments and typed evidence bind the exact revision.
3. PTO publishes a superseding revision with impact preview.
4. Open assignments/occurrences become `reference_stale` warnings; submitted packages stay bound to the old revision.
5. Authorized user acknowledges migration per affected assignment or records that the old revision remains contractually applicable.

### Workflow J — Typed test/certificate evidence

1. Rule occurrence opens the approved typed form schema offline.
2. Field user enters structured values and attaches immutable source.
3. Client validates required fields/limits but does not claim truth.
4. Server validates schema version, assignment, occurrence and reference scope.
5. Reviewer compares structured values, instrument/certificate metadata and original; decision fulfills or returns the occurrence.

### Workflow H — Accepted to paid (GA Project Commercials)

1. Record accepted/partial amount.
2. Generate invoice record or import reference.
3. Due date from contract, manually confirmed.
4. Dashboard moves value into expected/overdue.
5. Record payments/retention/deductions.
6. Period closes; audit/export remains available.

## 4. Exception workflows

### Wrong work item selected

- Before review: move evidence with explicit reason; preserve original relation in audit.
- After package lock: cannot move; create amendment/reference.

### Device clock incorrect

- Store device time + server receive time + offset.
- Flag suspicious drift; do not silently rewrite capture time.

### No exact location permission

- GPS optional per organization/project.
- Use project/location selection and device-level permission status.
- Sensitive sites can disable coordinates and strip EXIF on export while preserving protected metadata server-side.

### User leaves company

- Deactivate membership, revoke sessions, keep authorship.
- Reassign open tasks; never reassign historical audit identity.

### Contract reimport changes total

- Create diff and block activation until finance/PTO approval.
- Never update locked package values.

### Duplicate file

- Same checksum + same org: warn and allow link existing object.
- Cross-tenant dedupe must not reveal existence or metadata.

## 5. Interview guide

Ask about the last real close, not opinions:

1. Покажите последний пакет, который вернули.
2. Какие позиции и на какую сумму задержались?
3. Когда впервые стало ясно, что доказательства отсутствуют?
4. Где были фото, документы и согласование?
5. Кто тратил время на исправление и сколько?
6. Что невозможно было восстановить после закрытия конструкции?
7. Кто имеет право решить «подаём несмотря на риск»?
8. Какие формы/правила различаются по заказчикам?
9. Что генподрядчик требует делать в своей системе?
10. За какую конкретную часть процесса компания заплатила бы сегодня?

Не спрашивать «нужна ли вам такая программа?».
