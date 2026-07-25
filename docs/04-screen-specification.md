# 04. Screen-by-screen specification

Версия: 2.5  
Язык интерфейса v1: украинский; документы команды — русский.  
Платформы: responsive web для офиса и reviewer portal; Android/iOS field app для площадки.

## 1. Информационная архитектура

### Public

`Landing → Demo / Pilot request → Sign in → Password reset`

### Office web

`Home → Projects → Project workspace → Work → Evidence → Reviews → Variations → Packages → Payments → Reports`

На уровне организации: `Team → Rule library → Templates → Integrations → Billing → Audit → Settings`.

### Field app

`Today → Work item → Capture → Review draft → Submit → Sync queue`.

### External reviewer

`Secure link → Identity check → Package summary → Item/evidence review → Approve / Return → Receipt`.

## 2. Global shell

### Desktop navigation

- Sidebar 248 px, collapses to 72 px; org switcher top, project context below.
- Primary items: Огляд, Об’єкти, Роботи, Пакети, Оплати.
- Secondary: Команда, Шаблони, Інтеграції, Налаштування.
- Bottom: sync/status, help, profile.
- Global command search `⌘/Ctrl+K` в Pilot ищет только разрешённые метаданные project, work item, location, assignment/occurrence, controlled reference и package. Поиск по людям, свободному тексту и содержимому документов остаётся GA/deferred и не индексируется скрыто.
- Header contains page title, period/project filters, notifications and one contextual primary CTA.

### Global states

- Loading: skeleton shaped like final content; no centered spinner for full pages.
- Empty: reason + one primary next step + link to sample data.
- Error: plain explanation, retry, support correlation ID.
- Offline: persistent amber bar; writes go to outbox, unavailable server-only actions disabled with reason.
- Permission denied: name the required role and owner who can grant it.
- Archived/read-only: banner and no mutation controls.

## 3. Public and acquisition screens

### S01 — Landing `/`

**Goal:** make the owner or PTO head recognize the cost of incomplete evidence within 20 seconds.

**Above the fold:**

- slim trust line: «Для спеціалізованих підрядників в Україні»;
- navigation: Продукт, Як працює, Мобільний, Для кого, Безпека, Тарифи;
- headline: «Виконані роботи мають ставати оплатою.»;
- subhead: «AktFlow пов’язує кожну позицію кошторису з доказами, погодженнями та документами — ще до подання АВР.»;
- CTAs: `Запустити пілот` and `Переглянути демо`;
- interactive product tableau: work items flow from `Виконано` to `Готово до подання`, while a money rail updates. Motion must respect `prefers-reduced-motion`.

**Sections:**

1. pain strip with three numbers: performed, ready, at risk;
2. four-step story: import → field proof → review → payment;
3. mobile field app as Pilot core, not an add-on: iOS/Android positioning, offline-first capture, task context, local receipt and server receipt; CTA opens the interactive `/field` demo and must not imply public App Store availability before release;
4. role tabs for owner/PTO/foreman/billing;
5. proof packet example with redacted export;
6. competitive boundary: «не замінює кошторис / бухгалтерію / GC CDE»;
7. security and data portability;
8. plans;
9. pilot CTA and FAQ;
10. footer with legal/company/status contacts.

**Behavior:** demo opens populated read-only workspace; pilot CTA opens a 2-step qualification form, not a generic contact form. Preserve UTM. No fake customer logos or fabricated savings.

**Success event:** `pilot_form_submitted` or `demo_workspace_opened`.

### S02 — Pilot qualification `/pilot`

Step 1 asks company, specialization, active sites, employees. Step 2 asks current close process, primary bottleneck, last delayed-amount bucket, desired pilot site/outcome and contact. Show why each field matters. Required service/privacy acknowledgement is separate from optional marketing consent. Success returns an opaque receipt and schedules discovery or provides email fallback; it never reveals deduplication state and never creates a workspace automatically.

### S03 — Sign in `/login`

- email + password, `Увійти`;
- magic link as secondary; SSO shown only when configured;
- links: reset password, privacy, create pilot workspace;
- error copy distinguishes wrong credentials from expired invite without exposing whether an unrelated email exists;
- last-used org is never revealed before authentication.

### S04 — Invite acceptance `/invite/:token`

Shows verified organization and inviter after token validation. User confirms name, language, password or existing account. `Прийняти запрошення` maps to `A-008/acceptInvitation` only after server-observed identity, required MFA and versioned terms; the client never asserts MFA success. Expired/revoked state offers request-new-link. Terms acceptance and optional notifications are distinct.

## 4. Onboarding

### S05 — Workspace setup `/onboarding/company`

Progress 1/5. Fields: legal/display name, EDRPOU optional in trial, timezone, language, base currency, role. Offer sample workspace. Autosave draft. Completion creates organization and owner membership atomically.

### S06 — First project `/onboarding/project`

Progress 2/5. Name, code, customer/GC, contract number, site address, start/end and VAT mode create the project/contract shell. Reporting period, cutoff, retainage, payment due formula, notice periods, numbering and adapter selection create a draft Contract Terms Version. Financial/legal defaults are never inferred; placeholders remain visibly unconfirmed and block dependent deadlines/package rules until published through S37.

### S07 — Estimate import `/onboarding/import`

Progress 3/5. Drop zone for XLS/XLSX/CSV, template download, clipboard paste. After upload:

- sheet/header selection;
- mapping table with source preview and target fields;
- live validation summary: valid, needs review, ignored, duplicates;
- unit and decimal normalization;
- row-level error drawer;
- save mapping preset by estimator/export source.

Never silently reinterpret money, quantity or decimal separators. Import is idempotent via file hash + user-confirmed version.

### S08 — Evidence rules `/app/rules` (`?setup=1` from onboarding)

Progress 4/5 hands off from onboarding to the project-scoped versioned rule editor. Start from specialization pack: electrical (the only Pilot pack); HVAC and plumbing packs unlock with GA gate G5 and stay hidden until enabled, other trades are out of scope until explicitly added to the roadmap. Rule rows define required photo moments, quantity confirmation, location, document, reviewer and before-concealment gate. Every edit invalidates the previous impact preview. Publish remains disabled until a fresh deterministic preview and explicit affected-value acknowledgement; the confirmation names preview ID, input hash and contract snapshot. Published version is immutable, queues reevaluation and cannot mutate historical package snapshots. Setup mode returns to onboarding step 5 only after the publish receipt and evaluation status are visible.

### S09 — Invite team `/onboarding/team`

Progress 5/5. Add emails/mobile, role and project scope. Explain role capabilities in-line. Bulk paste accepted. Invitations may be sent now or saved. Completion presents checklist: mobile install, first assignment, first evidence, first period.

## 5. Core office workspace

### S10 — Executive dashboard `/app`

**Question answered:** «Сколько выполнено, сколько можно подать, что блокирует деньги?»

**Header:** project multi-select, reporting period, `Оновлено …`, export.

**KPI row:**

- Виконано — value of confirmed progress;
- Готово до подання — all mandatory evidence/reviews complete;
- Під ризиком — performed but not ready;
- Прострочено до оплати — accepted/invoiced beyond due date.

Each KPI reveals formula and timestamp on hover/tap. No percent without denominator.

**Main canvas:** stacked financial rail from contract to paid; 12-week trend toggle by value/items; `Роботи під ризиком` ranked by value × urgency × irrecoverability.

**Attention rail:** due today, before-concealment blocks, reviewer SLA, sync conflicts. Each card has owner and action. Clicking any aggregate opens a pre-filtered list.

`Запросити доказ` maps to `A-027/createEvidenceRequest`, returns an exact request receipt and keeps the readiness blocker visibly active until approved matching evidence fulfills it.

### S11 — Projects `/app/projects`

Table/card toggle. Columns: project, customer, contract value, performed, package-ready, at-risk, overdue, period close, owner. Filters saved per user. `Створити об’єкт` launches a drawer; archive requires reason and is terminal/read-only. An archived project has no restore button. Owner/Admin may choose `Створити продовження`, which calls the ordinary create-project flow with `reactivatedFromProjectId`; the receipt states that only selected setup/rules are copied and historical evidence, ledgers, packages and audit remain in the source project.

### S12 — Project overview `/app/projects/:id`

Hero: commercial summary and current period state. Tabs: Огляд, Роботи, Докази, Варіації, Пакети, Оплати, Команда, Налаштування. Contains milestone timeline, top blockers, location progress, reviewer load and change log. Project health is composed of explicit signals, never one opaque score.

### S13 — Work register `/app/work`

Virtualized table with frozen identifier and money columns. Columns: code, description, location, unit, contract qty, performed qty/value, ready qty/value, evidence, review, package, owner, deadline. Server filters are exact and allowlisted: state, readiness, location, assignee, rule, missing type, amount range and period; cursor/sort/filter values are part of the saved-view hash. Unknown keys fail rather than being ignored. Bulk assign/rule/apply-to-package requires preview. Pilot views are saved only for the current user and tenant/project scope; shared views are deferred.

Row click opens S14 drawer without losing filters or scroll.

`Додати роботу` maps to `A-016/createWorkItem`: a short drawer requires published contract version, unique code, unit, quantity, rate/currency, location and source reason. It is not a second import path and cannot overwrite an imported line; success shows immutable source/version and audit receipt.

`Призначити` opens S38; no deadline or assignee is stored directly on the immutable SOV line.

### S14 — Work item detail drawer/page

`getWorkItemDetail` is the composite read contract. Its initial response returns at most 100 rows per section plus independent `nextCursors`; continuation passes `section + cursor + limit`, returns only that section page and leaves other arrays empty. Top: code/name, measured-line type, baseline lineage head, state chip, ready/at-risk amount, owner and actions. Sections:

1. quantity ledger with immutable entries and corrections;
2. evidence timeline grouped by capture session;
3. requirement checklist with pass/fail reason;
4. review history and comments;
5. contract/version lineage;
6. package/payment references;
7. audit timeline.

The blocker rail comes from `listReadinessBlockers` and always identifies exact subject/occurrence, owner, due date, affected quantity/value, evidence or waiver state and one supported remediation action. The UI never asks the client to infer blockers from totals.

Assignments are a separate section with exact location/planned quantity/assignee/due/state. Requirement checklist groups occurrences by assignment and occurrence key rather than collapsing repeated date/batch/quantity requirements.

`Позначити виконаним` is impossible without quantity. `Override ready` is a permissioned exception requiring reason and audit record.

### S15 — Evidence inbox `/app/evidence`

For PTO triage. Grid/list of new capture sessions with thumbnail, location, linked items, creator, claimed versus authoritative reporting date, sync quality, authorization disposition and requirements. Batch actions only for homogeneous decision. Duplicate/blur/time/location anomalies are warnings, not automatic accusations. Reject/return requires structured reason and optional marked-up image. Post-invalidation first receipts appear in a separate security quarantine and cannot be approved by ordinary review.

### S16 — Internal review queue `/app/reviews`

Three panes: filter queue, item preview, decision panel. Each row exposes review-task owner, deterministic priority/due time, SLA policy version and escalation state. Keyboard shortcuts for next/approve/return are shown. “Undo” invokes `correctReviewDecision`: inside the configured short window, after recent authentication and SoD, it appends a correction receipt, makes the current projection non-current, reopens the capture and creates one task only while no package claim, acceptance or successor capture exists. It does not preselect the replacement outcome; the next approve/return is the decision-lineage successor. Otherwise the UI links to the appropriate compensating package/receivable workflow. Decision panel displays downstream amount impact.

### S17 — Variations `/app/variations`

Register of out-of-scope work: draft, evidence-ready, sent, acknowledged, approved, rejected, incorporated. Each variation has narrative, cost basis, labor/material breakdown, evidence and communications log. `Convert to contract version` preserves lineage; never overwrite the original BOQ.

### S18 — Variation composer

Guided flow: scope → location/time → proof → valuation → reviewer → preview. A warning appears before work starts without written direction. Export/share link is versioned. Approval by click is labeled operational acknowledgement, not КЕП.

### S19 — Period close `/app/periods/:id`

Close cockpit:

- value performed / ready / held / excluded;
- blockers grouped by responsible person;
- previous-period carryover;
- include/exclude table with reason;
- contract and customer validation rules;
- `Згенерувати пакет` produces an immutable draft version.

Hard gates, warnings and manager overrides are visually distinct. The header shows `closeCycleNo`; every preflight/cancel/commit/reopen creates or advances an append-only cycle receipt.

An eligible closed-but-not-submitted period exposes `Повторно відкрити` (`A-031/reopenPeriod`) only to authorized roles after reason, recent authentication and exact version confirmation. Submission, external decision, acceptance, receivable or payment dependency blocks reopen; correction creates a new period/package version or downstream commercial compensation path instead.

### S20 — Package builder `/app/packages/:id`

Header always displays the immutable `documentNumber`, allocated sequence and package version separately. Number allocation happens once during snapshot creation; retry keeps the same number, and a voided/superseded number is never reused. Preflight shows the exact numbering rule/version before confirmation.

Left: document outline; center: selected work, typed evidence summaries, exact reference revisions and attachments; right: validation. Outputs may include internal readiness report, evidence index, quantity register, variation attachments and customer-specific export. Every generation has template version, contract-terms version, adapter version, data snapshot hash and author. Before submission show redaction/PII preview and file size.

### S21 — Package register `/app/packages`

`listPackageVersions` drives the register and `listPackageVersionLines`/`getPackageDecisionSet` drive detail/resume. `listExternalShares` restores manageable link metadata after navigation without ever replaying the one-time URL/token, so an authorized sender can still revoke the exact capability. Columns: project, period, version, amount, readiness, generated, submitted, external decision, invoice, due date. Status changes require evidence (submission receipt, email reference, signed document). Opening a return/manual decision uses S42 and requires package-line decision items; a package-only free-text return cannot create correction tasks. One financial line may display many typed issues with severity, owner and due date; blocking open issues disable reconciliation. Compare versions highlights line, typed evidence, reference, waiver and decision-item changes.

### S22 — Payments `/app/payments`

Aging buckets plus invoice/act table. `listReceivables` returns exact version and server-derived adjustment, released-retention, paid, reversed and outstanding totals; `getReceivable` refreshes the selected aggregate. `listReceivableLedger` pages the immutable signed balance effects, while `listPayments/getPayment` reconstruct normalized business fingerprint, exact allocations and reversal total after response loss. Fields: accepted value, invoice/act reference, submitted/accepted/invoiced dates, due date, paid amount/date, retention, dispute. Partial payment supported. CSV import and manual reconciliation; later bank integrations. Automated reminder drafts require user approval before external sending.

GA actions are explicit contracts: acceptance (`A-049`), receivable create/transition/adjustment (`A-050`–`A-052`), retention release (`A-053`), payment/allocation/reversal (`A-054`–`A-055`) and CSV preview (`A-056`). CSV never commits money directly; user confirms a preview and all reversals/adjustments remain append-only.

### S23 — Reports `/app/reports`

Preset reports: readiness by project, recurring blocker, reviewer SLA, rejection cause, evidence completeness, variations, aging. Builder allows dimensions/measures approved by role. Export honors row-level access. Report definitions are versioned.

## 6. Field app

### S24 — Today

Offline-first home. Header shows project/location and connectivity. Sections: urgent before-concealment, assigned today, returned, drafts, recently submitted. Each card shows work, location, remaining qty, evidence checklist and estimated 30–60 second completion (the fixed field-capture budget; anything over 90 seconds is a kill-criterion signal). Foreman sees only scoped projects/locations.

### S25 — Work item field view

Large tap targets. Exact assignment, contract description, location, planned/remaining assignment qty, due/priority, current drawing/reference revision, occurrence checklist and recent accepted example. The first execution requires an online accept/start handshake followed by the exact lease-bearing bundle. `Почати фіксацію` then creates a local capture session bound to that assignment version and rule/reference snapshots. Avoid financial totals unless role permits.

### S26 — Evidence capture

Single-task camera flow:

- mandatory moment title and example;
- camera/gallery policy per rule;
- auto timestamp/device metadata and user-confirmed location;
- photo annotation, original voice/audio recording with optional manual note, document scan; automatic transcription is GA-gated and never replaces original;
- quantity/unit input with bounds;
- checklist progress.
- typed form step for certificate/test/measurement/drawing/document schema; show schema version, required units/limits and attached immutable original;
- explicit occurrence selection for repeated batch/date/quantity requirements; controlled reuse shows every target before confirmation.

Original media is retained; edited derivative is separate. Geolocation never blocks safety-critical work; user records reason.

### S27 — Draft review and submit

Shows linked work/location, thumbnails, qty and missing requirements. Association is editable only while this is a local unsubmitted draft. Submit freezes the exact subject tuple, writes once to the local outbox and immediately returns a durable local receipt. After first server receipt there is no relink action: an error requires invalidation and a new audited capture/link. If online, sync starts; if offline, status says `Збережено на пристрої`, never `Надіслано`.

### S28 — Sync queue

Items: queued, uploading, server-confirmed, failed, conflict, quarantined (authorization invalidated). User can retry safe operations and inspect error. Idempotency key prevents duplicate quantities/evidence. Conflict resolution compares local/server versions; destructive resolution requires explicit choice.

### S29 — Native interaction contract

Нормативно для нативной сборки (не прототипа):

- **Жесты**: pull-to-refresh на Today/Sync только запрашивает статус (не отправляет команды); swipe-left на карточке задания — быстрый «Почати фіксацію»; long-press на доказательстве — просмотр метаданных/оригинала; pinch-zoom в evidence viewer; haptic-подтверждение на сохранении локального receipt и на server-confirmed. Деструктивных swipe-действий нет.
- **Разрешения ОС**: камера и микрофон — priming-экран с объяснением до системного запроса; при отказе — экран «Дозвольте доступ до камери, щоб фіксувати роботу» с кнопкой в системные настройки; фиксация без камеры невозможна и это явно сказано. Геолокация — по политике doc 23 §8 не блокирует фиксацию; при отказе пишется reason, а не блок. Уведомления в Pilot не запрашиваются (pull-only).
- **Deep links**: схема `aktflow://` + universal/app links (`aktflow.app/...`), покрытые AASA (iOS) и assetlinks.json (Android). Целевые маршруты: `assignment/{id}`, `occurrence/{id}`, `capture/{assignmentId}`, `invite/{token}`. Открытие ссылки на объект вне scope пользователя ведёт на экран «нет доступа», не на пустой объект. Filter-context сохраняется в диплинке.
- **Push**: в Pilot поле работает pull-only, push намеренно GA-gated (реестр doc 37). Контракт на GA: payload несёт только `type` + object ID + tenant, без содержимого; тап открывает соответствующий deep link после проверки доступа; регистрация токена APNs/FCM привязана к membership и инвалидируется при revoke.
- **Устойчивость приложения**: kill/restart во время загрузки возобновляет resumable upload с последней части; обновление приложения не теряет несинхронизированный outbox; устаревшая версия уходит в safe mode по `X-Min-Client-Version` (doc 23 §9).

## 7. External reviewer

### S29 — Secure link entry

Branded but neutral page. Token validation, optional OTP, name/company confirmation, privacy notice, link expiry. No account required for configured low-risk review. Rate limits and device/session records are disclosed.

### S30 — Review package

Summary amount/scope/period, evidence index and item navigator. Reviewer may attach line-scoped comments, then records one exact-version package response: comment, return or full operational acceptance. Return creates a pending decision set for an authorized tenant user to allocate in S42; the external reviewer cannot silently rewrite commercial lines. Full operational acceptance may atomically materialize all-accepted line items. Download is permissioned and watermarked if configured. UI clearly states whether the response is workflow acknowledgement or qualified electronic signature.

### S31 — Review receipt

Decision, actor, time, package hash/version and downloadable receipt. Expired link cannot reveal package metadata.

## 8. Organization administration

### S32 — Team & access

Member list with org role and nested project scope (`allLocations` or explicit location IDs). `listInvitations` restores pending/failed/expired invitation IDs and scopes after navigation without exposing any token; invite/resend/revoke map to `A-007/A-009/A-010`, and resend invalidates the prior capability rather than extending it. Role/scope edit maps to `A-006/updateMembership`; suspend/reinstate/revoke maps to `A-082/transitionMembership` and never a generic status patch. `listOwnershipTransfers` lets only the current owner, named successor or authorized security actor resume/poll the two-party flow; changing owner maps to `A-011/A-012`, requires re-authentication and second confirmation. Show last active, not hidden surveillance metrics. Access review export available.

Offboard first suspends access. Owner/Admin/Security Admin creates `A-098/createMemberOffboardingPlan`, pages the organization-wide dependency inventory, saves typed resolutions in bounded `A-099` batches and only then calls `A-083/previewMemberOffboarding`. On return to the screen, `listMemberOffboardingPlanItems` pages the persisted rows, saved choices, exact versions and stale markers—never a reconstructed browser copy. Every assignment row requires replacement plus first-seen-offline policy; reviewer and escalation responsibilities are distinct; evidence requests, package issues, approvals, integration operational owner, live leases and project scopes are explicit types. `block_revoke` is a valid deliberate safe stop and disables preview/consume until replaced with an eligible resolution. There is no 500-row correctness limit. Stale versions or unresolved blockers disable consume. Project/PTO managers see only `A-100/removeMembershipProjectScope` for an administered project and can never revoke the organization membership.

### S33 — Rule library

`listProjectRuleVersions` renders versioned rules and packs. Each rule shows usage count, immutable canonical config hash and occurrence strategy (`once`, calendar, material batch or quantity threshold). Editing published rule creates a new version; project chooses migration. Test mode stores the exact canonical draft input and impact hash; publish consumes that snapshot once and cannot substitute another payload.

### S34 — Templates & integrations

Import/export templates, naming conventions, webhook keys, future ЄДЕССБ/accounting adapters. Connection cards show permissions, last sync, next action and disconnect. Creation, redacted mapping preview, pause/resume/revoke, rotation and replay map to `A-057`–`A-061`. No activation/delivery before a valid fresh preview. Secrets are returned once; rotation shows only the new version and bounded old-secret overlap.

### S35 — Billing `/app/billing`

Current plan, active project count, billing period, invoice status, legal details and history. v1 default is invoice/bank transfer. Pricing preview explains next charge and effective date before confirmation. Upgrade immediate/prorated only if provider supports it; downgrade applies next period and warns about entitlement impact without deleting data.

Tenant screen S35 shows subscription choices, invoice/payment history and suspension consequences. `listSaasPayments` is the scoped read-only settlement register and exposes payment ID, normalized fingerprint, recorder, aggregate reversals and net amount so history survives response loss; tenant tokens cannot use any settlement mutation. The screen never renders an action that marks an AktFlow invoice paid, cancelled or credited. Pilot platform payment-request issue maps to `A-065/issueSaasInvoice` and freezes subscription version, plan version, period and basis hash. Exact manual bank settlement maps to platform-only `A-038/recordSaasPayment` against one invoice and can restore entitlement only after reconciliation by the isolated platform billing plane. GA tenant plan/state changes use `A-039`–`A-041`; platform-only cancel/credit correction is `A-042` and never reuses construction-payment commands. A future tenant upload of payment proof is labelled `Очікує звірки` and has no entitlement side effect.

### S36 — Audit & data export

`listAuditEvents` searches by actor/action/object/date/IP class under scope/PII rules. Export signed CSV/JSON. `listExportJobs` restores every visible export's safe metadata, exact version, expiry and cancellation state after navigation without exposing an object-storage key. `A-101/cancelExport` cancels pre-start jobs immediately; collecting/packaging jobs enter `cancel_requested` until the fenced worker reaches a safe boundary and erases partial artifacts. A ready export remains immutable until expiry and still requires a short-lived download grant. Deletion/closure is a staged workflow with retention notice; no instant destructive button.

Closure maps to `A-004/requestOrganizationClosure`: export is offered first, organization enters read/export/pay/support-safe cooling-off, and destructive scheduling is blocked while retention is unvalidated or legal hold applies. `getOrganization.activeDeletionJobId` points to the current nonterminal closure aggregate, so status/cancel survives a lost response or new device. `A-005/cancelOrganizationClosure` is available only before execution and restores interactive access; completed deletion is not presented as self-service reversible.

## 9. Notification center

Events are grouped by work/package, not one row per technical event. Tabs: requires action, updates, system. `A-066/markNotificationsRead` records only own-recipient read timestamps and is safe to retry. `A-064/updateNotificationPreferences` uses ETag/version; mandatory classes cannot be disabled and email/push/SMS remain visibly unavailable until their GA/provider gates. Deep links preserve filter context.

Distributed inbox norm: единого кросс-объектного inbox в Pilot нет намеренно — actionable-работа распределена по четырём поверхностям с одинаковой семантикой владения/срока: notification center (S-этот раздел), attention rail S10, полевой Today S24 и review-очередь S16. Каждая поверхность показывает only-my-actionable фильтр; unified prioritized inbox — GA-кандидат в реестре doc 37 и вводится только по evidence спроса.

## 10. Accessibility and responsive acceptance

- WCAG 2.2 AA target; keyboard complete for web; visible focus.
- Touch targets at least 44×44 CSS px on web; at least 48×48 px in the field app (NFR-09).
- Text contrast ≥4.5:1; status is never conveyed by color alone.
- 200% zoom without loss of function; tables switch to priority cards under 768 px.
- Screen-reader names for charts, thumbnails and icon-only controls.
- Ukrainian pluralization, dates `DD.MM.YYYY`, currency with non-breaking spacing.
- User-entered terminology is preserved; app copy is translation-key based.

## 11. Screen definition-of-done

Every screen implementation must include: happy path, loading, empty, error, permission, archived/read-only, offline relevance, responsive behavior, analytics events, accessibility review, audit consequences and acceptance tests.

Per-screen state instancing is normative, not just the global pattern (§2): every screen authors its own concrete copy for the six global states, keyed in `technical/copy-catalog.csv` (`screen`+`state`→`ui_uk`). The global pattern defines behavior; the copy per screen differs and must exist before the screen is "done". Worked examples:

| Screen | Empty | Permission-denied | Error/stale |
|---|---|---|---|
| S10 Dashboard | «Ще немає виконаних робіт. Імпортуйте кошторис, щоб побачити готовність до оплати.» + CTA до імпорту | «Потрібна роль з доступом до цього об’єкта. Надати може: {owner_name}.» | «Дані готовності застаріли (оновлено {ts}). Оновити.» |
| S16 Review queue | «Черга перевірки порожня. Нові докази з’являться тут після польової фіксації.» | «Перевірку доказів виконує роль внутрішнього рецензента.» | «Не вдалося завантажити чергу. Спробувати ще раз · {correlation_id}.» |
| S19 Close cockpit | «Період без виконаних робіт для закриття.» | «Закриття періоду доступне ролі ПТО.» | «Preflight застарів після зміни правил — перерахувати.» |

Каждая ячейка выше — образец; полный набор (13 экранов × 6 состояний) ведётся в `copy-catalog.csv` и является частью screen DoD, а не отдельным дизайн-этапом.

## 12. Normative action closure

`technical/ui-actions.csv` is the exhaustive registry for primary and irreversible-looking user/platform actions in this revision. Every mutation operation must have an `A-xxx` row linking screen/surface, release, operation, permission resource, transition domain, audit event, tests and visible consequence. A new primary action is incomplete until the registry and corresponding screen copy are updated; the semantic validator rejects orphan mutations and cross-release drift.

## 13. Functional-closure screens

### S37 — Contract policy `/app/projects/:id/contract-policy`

Version list plus draft editor for reporting calendar/cutoff, notice periods, payment due formula, retention, numbering, customer adapter and required package documents. `listNumberingSeries` supplies the Pilot default and displays its read-only next sequence. GA `A-104/createNumberingSeries` creates a distinct stable key/format against an exact contract version and returns an immutable receipt; changing a format never edits an existing series. Numbering then selects a stable series key/prefix/padding, while a terms edit cannot reset it. `Preview` maps to `A-073/previewContractTermsVersion`, persists a bounded preview receipt/hash and explains affected open assignments/periods; `Publish` maps to `A-067/publishContractTermsVersion` and must present that exact unexpired preview. Published versions are immutable. Unconfirmed legal/accounting fields remain gated and visibly owner-assigned.

### S38 — Assignment planner `/app/projects/:id/assignments`

Work/location matrix with planned quantity, assignee, start/due, priority and rule/reference readiness. Single or bulk selection opens a preview showing quantity over-plan, missing location/reference and number of occurrences to create. `Create assignments` maps to `A-068/createWorkAssignments`; every committed row starts as `assigned`, creates occurrences and one notification. The receipt lists committed/rejected rows. No team/crew selector in Pilot.

An open row menu exposes `Reassign` (`A-084/reassignWorkAssignment`) with new assignee, exact version, reason and offline-capture policy. A stale reference banner exposes `Acknowledge exact revision` (`A-085/acknowledgeAssignmentReference`); `Migrate` instead creates a linked replacement assignment through the ordinary preview/batch path. Review queue exposes `Reassign reviewer` (`A-086/reassignReviewTask`) with target-version and separation-of-duties validation.

Opening field execution maps to `A-092/issueWorkAssignmentExecutionBundle`. The receipt displays assignment/membership versions and server lease expiry without exposing its hash. Expired, invalidated or stale leases require an online refresh; changing device time never extends the lease.

### S39 — Reference documents `/app/projects/:id/references`

Register by type/number/revision/status/issue date/source. Upload uses the normal purpose-bound pipeline. `Preview impact` maps to `A-074/previewReferenceDocumentVersion`; `Publish revision` maps to `A-069/publishReferenceDocumentVersion` and must present the exact preview ID/hash while showing affected open assignments/occurrences. Superseded versions remain readable. Migration/acknowledgement is explicit; no plan markup/BIM authoring.

### S40 — Hold point `/field/assignments/:id/hold/:occurrenceId`

Mobile/web exact occurrence summary: timing, due, required moments/typed form, current reference, capture receipt and reviewer/witness. Authorized decision maps to `A-070/decideHoldPoint`; closure maps to `A-071/recordConcealmentEvent`. Missing/failed evidence never disappears and affected amount remains visible to office roles.

### S41 — Typed evidence form `/field/assignments/:id/evidence/:occurrenceId`

Offline schema-rendered form. Certificate, test/measurement, drawing/reference and generic document variants share validation/provenance shell. Submit remains part of `A-025/submitCaptureSession`; schema/version/values are committed with upload IDs and occurrence links. Validation distinguishes missing, out-of-range warning and hard policy blocker. Original attachment is always separately visible.

### S42 — Package decision reconciliation `/app/packages/:id/decision`

Package lines with submitted amount, decision, modified amount, reason, linked requirement/evidence, correction owner/due and reconciliation difference. `A-035/recordManualPackageDecision` first creates the exact-version source receipt/`package_decision_set`; GA uses `A-048/createExternalDecision`. `A-072/recordPackageLineDecisions` then saves at most 500 selected rows per request with expected item versions. Partial work remains `pending_reconciliation`, is resumable and cannot change package/readiness or create correction actions. Finalize is disabled until every package line has exactly one decision, no foreign/version-stale line is present and server-derived accepted + returned equals submitted. Finalization freezes the items, creates exact correction actions and transitions the package atomically without mutating the submitted snapshot; replay returns the same reconciliation receipt.

## 14. Evidence Atlas navigation and route contract

The selected visual system is normative for every prototype surface, but it does not change the domain state machines or release boundary.

### 14.1 Public and setup routes

| Route | Purpose | Required exit |
|---|---|---|
| `/` | product narrative and bounded pilot proposition | `/pilot`, `/login`, `/app`, `/field` |
| `/pilot` | two-step qualification with separate service and marketing consent | opaque lead receipt; optional synthetic demo |
| `/login` | password or magic-link entry | `/app` or `/reset-password` |
| `/reset-password` | enumeration-safe recovery request | recovery receipt → `/login` |
| `/legal/privacy` | prototype privacy boundary | `/` |
| `/legal/terms` | prototype terms/legal-effect boundary | `/` |
| `/invite/demo` | exact invitation preview, terms gate and MFA consequence | activation receipt |
| `/onboarding` | company → project → import → rules → team | `/app/rules?setup=1` hand-off and return to step 5 |

### 14.2 Authenticated route groups

`AppShell` presents three stable groups:

1. **Від роботи до доказу:** `/app`, `/app/work`, `/app/assignments`, `/app/evidence`.
2. **Контроль і закриття:** `/app/rules`, `/app/baseline`, `/app/close`, `/app/packages`, `/app/payments`.
3. **Керування:** `/app/variations`, `/app/team`, `/app/billing`, `/app/settings`.

Nested routes keep the parent selected:

- `/app/occurrences/demo` belongs to assignments;
- `/app/packages/current` belongs to packages.

Each workspace route exposes:

- project breadcrumb;
- exact dossier/file label;
- current process chain;
- one optional next logical hand-off;
- actionable notifications with deep links;
- a bounded project-context switcher;
- support contact.

The hand-off rail is contextual guidance, not a forced wizard. Direct sidebar navigation remains available.

### 14.3 Core flow routing

```text
/ → /pilot
/login → /app
/onboarding → /app/rules?setup=1 → /onboarding?step=5 → /app
/app → /app/work → /app/assignments → /field → /app/evidence
/app/evidence → /app/close → /app/packages/current → /review/demo → /app/payments
/app/variations → /app/baseline
/app/team → /app/settings
```

The application must not imply that route adjacency authorizes a command. Every mutation still evaluates the exact permission, version, state, entitlement and organization/project scope from normative contracts.

### 14.4 Mobile and external navigation

Field bottom navigation is exactly:

- `Сьогодні`: assigned work and due context;
- `Фіксації`: recent capture/server-review receipts;
- `Черга`: local-only/outbox records.

External review navigation is exactly:

- package overview;
- quantities;
- evidence index;
- waivers;
- version history.

Changing a tab changes the visible document content. The exact-version decision rail remains present and does not inherit a different package/version from navigation.

### 14.5 Visual application by surface

- Landing: layered blueprint folio + live dossier product object.
- Auth/onboarding: controlled document form with visible progress and receipts.
- Desktop: Carbon dossier index + Paper ledger canvas.
- Evidence review: real synthetic evidence thumbnails and explicit original/correction lineage.
- Field: Carbon chrome + Paper task folios + evidence preview.
- External review: exact package dossier with version-pinned decision rail.
- Legal/recovery/settings: trust surfaces use the same tokens and document grammar without pretending to be production policy/backend.
