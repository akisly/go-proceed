# 01. Product Requirements Document

## 1. Контекст проблемы

У специализированного субподрядчика информация о выполнении работ разрывается между несколькими системами:

- договор, смета и договорная цена — Excel/АВК/BAS;
- факт и фотографии — телефон, Telegram/Viber;
- исполнительные схемы и акты — Word/PDF/Drive;
- согласования дополнительных работ — звонки, email, мессенджер;
- АВР и статус оплаты — бухгалтерия/Excel;
- требования конкретного генподрядчика — письмо, приложение к договору или память сотрудника.

В результате к закрытию периода выясняется, что работа физически выполнена, но:

- отсутствует фото до закрытия;
- нет подписи/согласования;
- испытание не оформлено;
- фактический объём не связан с позицией;
- дополнительная работа выполнена без notice;
- файл существует, но неизвестно к чему относится;
- пакет не соответствует форме/правилам заказчика.

## 2. Product outcome

Полный AktFlow должен переводить каждый денежно значимый work item через явные состояния и объяснять блокировку:

Канонические слои состояний заданы `technical/state-catalog.csv` и не дублируются здесь другими именами:

- execution (`work_item`): `planned → assigned → in_progress → performed → completed`;
- readiness: `not_started → evidence_missing → review_pending → ready_internal | overridden_ready → packaged → submitted → accepted_external | returned_external`;
- деньги (GA Project Commercials, `receivable`): `draft → issued → due → part_paid → paid`.

Pilot заканчивает обязательный runtime path на `submitted` плюс ручной operational receipt решения. `accepted_external → issued → paid` — GA Project Commercials и не смешивается с оплатой подписки AktFlow.

Нельзя показывать единый «процент готовности» без расшифровки. Любой score обязан объяснять:

- какие requirement не выполнены;
- насколько requirement блокирующий;
- кто отвечает;
- когда возник;
- какая сумма затронута;
- какие действия доступны.

## 3. Product principles

1. **Money-first.** Сначала сумма и blocker, затем документы.
2. **Position-linked.** Evidence без связи с work item/location не считается готовым.
3. **Field-light.** Исполнитель не должен знать формы АВР.
4. **Explainable automation.** AI предлагает; человек подтверждает.
5. **Source preservation.** Оригинальный файл никогда не переписывается.
6. **Portable record.** Данные принадлежат субподрядчику и экспортируются полностью.
7. **Template versioning.** Изменение правил не переписывает прошлое.
8. **Integration-first.** AktFlow — слой между полем и финансовой системой.
9. **No hidden legal promise.** «Ready» означает внутреннюю комплектность по настроенным правилам, а не обязательство заказчика принять.
10. **Offline is core.** Потеря связи не должна останавливать работу.

## 4. Functional requirements

Release rule: FR-01–FR-08, базовый FR-10, Pilot-части FR-13–FR-15 входят в узкий Pilot. FR-09, FR-11 Project Commercials и FR-12 secure external review — GA. Поля GA могут присутствовать в canonical model/prototype, но Pilot entitlement и release flags не дают их вызвать.

### FR-01 Organization and identity

- Создать organization и legal entity profile.
- Пригласить пользователя email + application deep link. SMS остаётся GA/provider-gated.
- Поддержать roles и project-scoped membership.
- MFA обязательно для каждого пользователя с live Pilot data. Owner/Admin/Security and privileged export/close/waiver commands additionally require recent-auth step-up; support cannot bypass recovery controls.
- Revoke-all и recent-auth consequences обязательны; session/device inventory показывается только через поддерживаемую поверхность identity provider.
- Locale: `uk-UA`, `ru-UA`, позднее `pl-PL`, `en-GB`.
- Currency по контракту; UAH default.

### FR-02 Project setup

- Создать объект вручную или wizard.
- Поля: название, код, адрес без обязательного точного GPS, customer/GC, contract, dates, retention, payment cycle, sensitive-location flag.
- Импортировать структуру locations: корпус/секция/этаж/зона/помещение.
- Назначить PM, ПТО, foremen.
- Contract Terms Version хранит reporting calendar/cutoff, notice periods, payment due formula, retention, numbering policy, customer adapter, required package documents, timezone/calendar и effective date. Published version immutable; изменение создаёт новую version и не переписывает закрытые периоды.
- Package numbering uses a stable server-owned contract series. Terms select `seriesKey/prefix/padding` but never submit or reset `nextSequence`; terms changes, retries and voided numbers preserve monotonic continuity.
- Clone project setup без финансовых данных остаётся GA convenience capability; Pilot создаёт linked continuation только после terminal archive и копирует выбранные setup/rule references явным preview.

### FR-03 Contract and SOV import

- XLSX/XLS/CSV в MVP; JSON adapter для ЄДЕССБ в следующем этапе.
- Сохранить original file, checksum и uploader.
- Preview sheet и выбор header row.
- Mapping source columns → canonical fields.
- Canonical fields: code, description, unit, contracted_qty, unit_price, total, section, parent_code, tax mode. `cost_code` принимается в файле и остаётся в сохранённом исходнике импорта для будущего accounting-маппинга (deferred, см. `technical/entity-aliases.csv`); доменной колонкой Pilot он не является.
- Detect: empty required cells, duplicates, formula cells, merged rows, total mismatch, invalid units.
- Не исправлять финансовый итог автоматически.
- Каждая строка получает stable internal ID; source key хранится отдельно.
- Reimport создаёт version и diff: added/removed/changed, требует approval.

### FR-04 Evidence rule library

- Rule template по trade/work type/customer/contract.
- Requirement types: photo, video, audio note, drawing, test protocol, certificate, quantity measurement, signature, date, geolocation optional, document; external approval type хранится только для GA-enabled pack.
- Severity: два канонических уровня — `blocking | warning` (как в `EvidenceRuleDraft`, `ReadinessBlocker` и `package_decision_issues`); отдельного уровня «informational» в модели нет — информационные подсказки не являются severity требования.
- Timing: before work, during, before concealment, after, before package.
- Multiplicity: one per item/location/date/batch/quantity threshold.
- Conditional logic: если `concealed=true`, требовать before-close photo; если material batch changed — новый certificate.
- Version, effective date, author, reviewer.
- Template changes не должны retroactively изменять locked periods без migration review.
- Rule config использует versioned allowlisted schema: applicability, severity, timing, occurrence strategy, multiplicity, trigger, required typed form, review policy и remediation. Неизвестный config key отклоняется.
- Публикация создаёт `requirement occurrence` для каждого exact assignment/location/date/batch/quantity trigger. Один rule может иметь много occurrences; occurrence key детерминирован и idempotent.

### FR-04A Work assignment and requirement occurrence

**Release: Pilot core.** `WorkItem` остаётся строкой contract/SOV и не используется как mutable task.

- Assignment связывает work item, location, одного assignee в Pilot, planned quantity, planned window, due time, priority, rule snapshot и source.
- Статусы: planned, assigned, accepted, in_progress, submitted, returned, completed, cancelled.
- Bulk assign использует preview; каждая строка имеет собственный idempotent result и понятную ошибку. Team/crew grouping остаётся GA-forward и не требуется Pilot.
- Requirement occurrence связывает assignment/work/location/rule version с occurrence key, timing, trigger facts, due time, quantity range/material batch и hold-point policy.
- Повторные date/batch/quantity occurrences не перезаписывают друг друга.
- Before-concealment occurrence проходит `required → ready_for_inspection → passed|passed_with_notes|failed → closed`; concealment/closure event append-only и не скрывает missing proof.

### FR-05 Field work capture

- Foreman видит только assigned/today/near-deadline items.
- Быстрый выбор item и location через recent/favorite. QR/NFC task deep links отложены до field validation.
- Ввод quantity today и cumulative preview.
- Capture photo из камеры; импорт из gallery ограничивается policy. Video capture отложен до GA feature flag после field validation спроса (см. реестр обещаний, doc 37) и не входит в Pilot.
- Автоматические metadata: local captured_at, device time, server received_at, user, project, optional coarse location, file hash.
- Voice/audio note → сохранить immutable original и optional manual text note. Автоматическая transcription не входит в Pilot; GA включает её только после processor/privacy/quality gate, сохраняет source link и не заменяет original.
- Draft/offline save всегда доступен.
- Offline submit authority comes from an idempotently issued bounded server lease binding membership and assignment versions; upload/capture require its exact ID/hash, and device time never proves or extends authorization.
- Отправка не требует заполнения неблокирующих полей.
- Duplicate detection по hash и близости времени/item.
- Today строится только из assignment/return/review state; `assigned today`, due, priority и remaining quantity не выводятся из одной строки SOV.
- Typed evidence response поддерживает versioned form schema и offline validation. Pilot electrical pack включает certificate, measurement/test protocol, drawing/reference и generic document forms.
- Certificate fields: issuer, document number, material/product, batch/lot, issue/expiry dates and scope.
- Test fields: test type/system, measured values, units/limits, pass/fail, instrument/serial/calibration, performer, optional witness and immutable source attachment.
- Drawing/reference fields: document number, revision, sheet, issue date and exact reference document version.
- Evidence reuse across occurrences requires explicit scope preview and server validation; invalidation recomputes every linked occurrence.

### FR-06 Offline sync

- Локальная SQLite database и persistent outbox.
- Client-generated UUID для idempotency.
- Сначала синхронизируется metadata, затем files chunked/resumable.
- Статусы: local_only, queued, uploading, synced, conflict, failed_retryable, failed_terminal.
- Retry exponential backoff с jitter; ручной retry.
- Не удалять локальный файл до server acknowledgement + checksum validation.
- Conflict policy: append-only evidence не конфликтует; mutable fields — optimistic version check.
- Показывать размер очереди и последний успешный sync.

### FR-07 Readiness engine

- Рассчитать completeness на level work_item × location × period.
- Учитывать active rule version, approved waivers и rejected evidence.
- Денежная величина ready = approved performed quantity × unit price; Pilot ограничивает её published contract baseline, GA дополнительно учитывает approved variation.
- Blocked value не суммировать дважды при нескольких blockers.
- Explainability endpoint возвращает requirements, evidence, waiver, reason, owner.
- Recompute event-driven при quantity/evidence/rule/review change.
- Manual override только с reason, сроком и reviewer; попадает в audit.

### FR-08 Review and QA

- Review queue с фильтрами по project, trade, amount, blocker, owner, aging.
- Evidence preview без скачивания, side-by-side с requirement.
- Решения: approve, reject with reason, request more, waive.
- Pilot review выполняется по одному exact target. Bulk approve отложен до отдельной risk/artifact validation.
- Rejection taxonomy versioned; свободный комментарий вторичен.
- SLA/aging с напоминаниями.
- Review task stores queue policy version, optional assignee, opened/due timestamps, state and escalation owner. SLA is deterministic and pauses only for explicit terminal/quarantine/customer-wait states.

### FR-09 Variations / additional work

**Release: GA.** Pilot может только зафиксировать базовый evidence/work blocker и передать вопрос вне продукта; он не выдаёт notice и не создаёт external share.

- Создать variation из field item/voice/photo/email import.
- Поля: event date, notice deadline, scope, reason, requested amount, cost breakdown, attachments, initiator.
- Статусы: draft, notice_required, notice_sent, pricing, submitted, approved, rejected, disputed, withdrawn.
- Secure external link для acknowledge/approve; не называть КЕП без qualified integration.
- Approved variation создаёт/обновляет budget line через controlled action.
- Readiness отдельно показывает performed unapproved variation value.
- Variation version binds event date, calculated-and-confirmed notice deadline, source work/assignment/location, evidence IDs, reason, recipient and cost breakdown. Issued notice never relies on fields hidden only in a free-form snapshot.

### FR-10 Period package

**Release: Pilot core; GA adds variation-aware preflight, compare/resubmit automation and external capability delivery.**

- Создать billing/closing period.
- Snapshot contract and rule versions.
- Include/exclude candidate lines с reason.
- Preflight checks: quantities, prior cumulative, missing blockers, out-of-baseline scope, expired docs, document numbering; GA классифицирует out-of-baseline scope через variation lifecycle.
- Generate package manifest, cover sheet, evidence index, PDFs/XLSX/ZIP.
- Template per customer/contract.
- Lock package after submission; amendments are new versions.
- Хранить submit channel, recipient, timestamp, external reference.
- Package/customer return is stored at package-line/requirement/evidence scope with submitted/modified amount, reason, correction owner/due date and resolution state. Pilot records this manually; GA external reviewer writes the same canonical decision-item model.

### FR-11 Decision and payment tracking

**Release: GA Project Commercials.** Pilot хранит только manual submission/decision receipt, не создавая бухгалтерскую дебиторскую задолженность.

- Status: submitted, under_review, returned, partially_accepted, accepted, invoiced, due, paid, overdue, disputed.
- Return reason at package and line level.
- Record accepted amount separately from submitted.
- Payment: expected date, actual date, amount, retention, deduction, reference.
- GA поддерживает manual/CSV reconciliation preview и явное подтверждение; Pilot не импортирует project payments.
- Partial acceptance is allocated to exact package lines; an aggregate accepted amount without reconciled line allocation remains `pending_reconciliation` and cannot silently create a receivable.

### FR-12 External review

**Release: GA.** Prototype показывает interaction contract, но Pilot runtime использует отправку человеком вне AktFlow и ручной receipt.

- Tokenized link, expiry, optional OTP.
- Viewer sees only explicitly shared package/item.
- Actions configurable: view, comment, acknowledge, approve/reject.
- Download watermark optional.
- Full access log; revoke link immediately.
- External click/typed signature ≠ qualified electronic signature; label accordingly.

### FR-13 Notifications

**Release: Pilot in-app core; GA external channels/escalation.**

- Pilot: in-app list, own-recipient read receipts, versioned preferences, mandatory classes and retry-safe delivery.
- GA: product email/push, quiet hours, digest and escalation only after provider/privacy/security gates; Telegram/Viber/SMS отдельно gated.
- Triggers: missing before-concealment evidence, approaching notice deadline, rejected evidence, package returned, overdue payment, sync terminal failure.
- Deduplicate repeated alerts; escalation chain.

### FR-14 Search and export

- Global search by project, code, description, document number, external ref.
- Full organization export: JSON/CSV + original files + manifest/checksums.
- Project archive is immutable and terminal. There is no in-place restore: Owner/Admin may create a new draft project linked by `reactivatedFromProjectId` to the archived source; rules/setup may be copied explicitly, while historical evidence, ledgers, packages and audit remain only in the archived project.
- Data retention policy per organization.
- Controlled Reference Document Register stores type/number/revision/issue date/status/original hash and supersession lineage. Assignment, occurrence and typed evidence bind an exact reference version; supersession creates stale-reference warnings and never rewrites submitted history.
- Pilot global search is limited to project/work/assignment/reference/package identifiers and descriptions. Person/document-content indexing and cross-organization search are deferred.

### FR-16 Functional promise register

Every visible capability is classified in `docs/37-functional-closure-feature-register.md` as `Pilot implemented contract`, `GA modelled`, `deferred`, `integration-only` or `no-build`. A feature cannot appear in pricing, onboarding or primary navigation unless its screen/action/API/entity/test closure exists for that release.

### FR-17 Quantity correction semantics

- Canonical ledger entry types: progress, correction, reversal, transfer_out, transfer_in, accepted_adjustment. Narrow Pilot capture accepts only progress/correction/reversal; the remaining types require separate GA commands and flags.
- Every non-progress entry requires reason and exact source lineage; transfer is an atomic paired command with source/target work/location and equal absolute quantity.
- Correction/reversal cannot exceed the remaining unreversed source quantity. Package sources freeze exact net entries.
- Pilot permits progress/correction/reversal. Transfer and accepted adjustment are GA-gated even though the canonical ledger supports them.

### FR-15 Billing/entitlement

**Release: Pilot shared authority; GA self-service lifecycle and validated seller documents.**

- Plans and project limits controlled server-side.
- Immutable Pilot plan version, subscription state and bounded override with expiry/grace.
- Platform-issued payment request freezes plan/period/basis hash; exact one-invoice bank payment marking is idempotent.
- LiqPay recurring optional after pilot; no client card data in AktFlow.
- Suspend create actions after grace period, but preserve read/export access for defined window.

## 5. Non-functional requirements

| ID | Requirement | Pilot target |
|---|---|---|
| NFR-01 | Web availability | 99.5% monthly excluding planned maintenance |
| NFR-02 | API latency | p95 read < 500 ms; write metadata < 800 ms |
| NFR-03 | Dashboard freshness | readiness recompute < 60 sec p95 |
| NFR-04 | Field startup | usable cached screen < 2 sec on mid Android |
| NFR-05 | Capture durability | no acknowledged evidence loss |
| NFR-06 | Upload | resumable; 20 MB photo configurable; video limits фиксируются вместе с GA video capture flag |
| NFR-07 | Scale | 100 org, 2k users, 1M evidence objects without redesign |
| NFR-08 | Audit | append-only events for financial/status decisions |
| NFR-09 | Accessibility | WCAG 2.2 AA web; 48px field targets |
| NFR-10 | Localization | no hardcoded user-facing strings |
| NFR-11 | Recovery | RPO 24h MVP, RTO 8h; paid tiers improve later |
| NFR-12 | Security | tenant isolation tests on every release |

## 6. State invariants

- `ready_value <= performed_value`.
- `submitted_value <= package_locked_value`.
- GA Project Commercials: `accepted_value <= submitted_value + approved_adjustments`.
- GA Project Commercials: `paid_value <= invoiced_or_accepted_value` unless explicit advance/payment allocation.
- Pilot quantity beyond published contract baseline is hard-blocked (`QUANTITY_LIMIT_EXCEEDED`): перевыполнение фиксируется только после новой contract version (re-import/amendment); GA добавляет approved variation basis. Отдельного «policy»-носителя или Pilot-команды override не существует намеренно.
- Evidence has no generic delete action. A wrong or superseded item is invalidated through an audited correction/derivative lineage and excluded from readiness by that decision; the immutable original remains access-controlled under its retention/legal-hold policy.
- Locked package content is immutable; correction creates version.
- Readiness never relies only on AI confidence.

## 7. Success criteria for v1 pilot

- 80% assigned critical work items captured same day.
- 95% uploaded evidence arrives with valid checksum.
- At least 70% of period value has explainable readiness state.
- Closing preparation time reduced by at least 30% vs baseline diary (measured via manual pre-pilot baseline, not the event tree; see doc 14 §5).
- At least one missing-before-concealment issue caught before closure.
- Руководитель открывает dashboard минимум 2 раза в неделю.
- Customer renews project/starts second project or signs monthly plan.

## 8. v2.9 implementation boundary

The following are mandatory parts of the narrow Pilot contract, not optional implementation detail:

- primary screens read through bounded scoped contracts for work detail, readiness blockers, rule versions, package register/lines/decision set and audit history;
- rule publication consumes the immutable canonical payload stored by its fresh preview; `once`, `calendar`, `material_batch` and `quantity_threshold` each have typed configuration and deterministic trigger identity;
- an assignee accepts/starts online before receiving an offline execution bundle; every lease freezes membership, user, assignment and parent versions;
- a capture first seen after any authorization-affecting invalidation is quarantined or rejected and contributes neither evidence readiness nor authoritative quantity; device time cannot prove pre-revocation creation;
- Pilot BOQ creates work items only from measured positive-quantity rows; headings build hierarchy and unsupported lump/provisional/rate-only rows block confirmation visibly;
- re-import availability is calculated across the stable work-item lineage, so a superseding row cannot double-plan or double-perform the same baseline quantity;
- claimed field date and authoritative reporting date are separate; a closed-period assignment requires a guarded correction/reopen workflow;
- member organization revoke is staged and organization-authorized; a project-scoped manager can remove only a project scope;
- waiver revoke, review-decision correction, evidence-association correction, period reopen and export cancellation are append-only, versioned flows with explicit receipts;
- package reconciliation stores one financial line outcome plus any number of typed blocking/non-blocking issues; no unresolved source disappears silently.

GA-only commercial invariants are modelled but disabled in Pilot: acceptance cannot gain a successor while an active downstream receivable/payment depends on its current head; compensation must first cancel, credit, reverse or otherwise resolve that downstream ledger through its own command. The implementation must not expose these GA commands merely because their tables and schemas exist.

Any customer-specific form, legal meaning, tax document, KEP flow, provider channel or country behavior remains unavailable until its corresponding V-gate is evidenced and a versioned adapter/flag is enabled.
