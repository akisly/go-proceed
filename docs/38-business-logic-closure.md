# 38. Business Logic Closure v2.9

## 1. Purpose

This document closes the business invariants found by the independent v2.8 semantic launch audit and defines the v2.9 contract. It is normative whenever older prose is ambiguous. The narrow Pilot remains one organization, one active project, one active contract, electrical MEP, internal review, manual external submission and manual external decision capture. GA capabilities remain disabled by release flags.

## 2. Authoritative aggregate decisions

1. `WorkItem` is an immutable contract/SOV line. Its operational status is a projection and is never directly patched by a field workflow.
2. `WorkAssignment` is the only mutable execution aggregate. Accept, start, return, complete and cancel use the lifecycle command. Reassignment is a separate exact-version command requiring a new assignee and explicit offline-capture policy. Reference acknowledgement is another separate command and never changes lifecycle state.
3. `RequirementOccurrence` is the minimum satisfaction and waiver scope. A base requirement is an aggregation over its occurrences and cannot silently waive future occurrences.
4. `CaptureSession` is one immutable submission attempt for one exact assignment. Correction creates a same-subject linked revision.
5. `PackageDecisionSet` is the resumable aggregate and final atomic unit of a customer/manual response. Its source receipt is immutable; pending line choices are optimistic-versioned and inert. Package state cannot become returned or accepted until finalization covers every included line (except exact external full acceptance, which atomically materializes all accepted items).
6. Pilot has exactly one active contract per project. A second contract requires GA multi-contract support or a distinct linked project.

`WorkItem.status` is a server-maintained cache, not mutable baseline data. Projection precedence is `completed` (contract quantity covered and every non-cancelled assignment completed) → `in_progress` (any in-progress or returned assignment) → `performed` (positive net performed quantity or submitted assignment) → `assigned` (any planned/assigned/accepted non-cancelled assignment) → `cancelled` (assignments exist, all cancelled, zero net performed) → `planned`. Every contributing assignment/quantity transaction updates the cache version and timestamp; a rebuild from immutable sources must match exactly.

## 3. Exact subject tuple

Every field-created object uses the immutable tuple:

`organization + project + work item + location + assignment + capture client operation`

Upload intent, capture session, evidence object, quantity entry, typed response, occurrence link and correction lineage must agree on this tuple through composite keys or one guarded transaction. Matching only organization/project is insufficient.

Evidence satisfaction is recorded per exact occurrence. One evidence object may support several occurrences only through explicit `evidence_requirement_links` rows created in the exact assignment subject. Invalidation recomputes every linked occurrence and never deletes the original.

## 4. Assignment batch semantics

Assignment planning is a two-step command:

1. server preview freezes baseline/rule/reference/member versions and returns `previewId`, `inputHash`, row results and expiry;
2. commit revalidates the preview and processes each row by stable `clientOperationId`.

Valid rows commit atomically with their occurrences; invalid rows have no side effects. The batch receipt contains committed and rejected rows. Replaying a row operation always returns the same assignment receipt even after HTTP idempotency expiry. Concurrent planned quantities are serialized per work-item/location and cannot exceed the available baseline.

Every valid batch row is created directly in `assigned`, creates exactly one assignee notification and becomes eligible for the mobile execution bundle. `planned` remains available only for a future server-owned planning/reservation workflow and is not a result of the Pilot batch command.

Reassignment changes only `assigned_user_id`, increments assignment version and appends a durable receipt containing old/new assignee, reason and offline policy. Existing occurrences remain bound to the assignment. A capture already durably received by the server before invalidation may finish its normal scan/review path. A draft first seen after invalidation is never treated as proven pre-revocation work: policy either routes it to `quarantined` for independent Security Admin recovery or rejects it. Security recovery stores a durable client operation, exact capture version, reason, minimized evidence summary, actor and receipt hash; release maps only to `recovery_approved + scanning`, while reject maps only to `recovery_rejected + terminal_failed`. It cannot assign an accounting date. Device time, EXIF and possession of an old lease are not chronology proof.

Pilot requires an online `accept → start` handshake before issuing an execution bundle. The lease is issued only for the resulting exact `in_progress` assignment version. Offline accept/start chaining is not supported; after any assignment transition the device must obtain a new lease before new capture.

## 5. Quantity ledger

- Pilot accepts only `progress`, `correction` and `reversal` through capture submit.
- `progress` is positive and has no corrected source.
- `correction` is a signed delta and requires an exact source entry, reason and remaining-correctable bound.
- `reversal` is negative, requires an exact source entry and cannot exceed its unreversed quantity.
- `transfer_out`, `transfer_in` and `accepted_adjustment` use separate GA commands; a transfer is a balanced atomic pair.
- quantity precision is frozen from the work-item unit-definition version;
- package inclusion is locked per quantity source across current packages; a superseding version may reuse the prior version's sources, but another period cannot double-claim them.

## 6. Review, waiver and correction

Review task uses an exact polymorphic target: capture session, occurrence or package decision item, plus target version. Exactly one target is present.

Review decisions preserve target version, assurance, actor, structured reason and lineage. Return requires a reason. A UI undo is a new compensating command allowed only inside the window and before downstream package use: it appends `review_decision_corrections`, clears only the prior `is_current` projection, reopens the capture and creates one task. It never deletes or fabricates a replacement decision; the later approve/return is linked as the lineage successor.

Waiver requires occurrence, affected quantity/value, expiry and reason. A broader migration/blanket waiver is a separate high-risk GA command. Evidence request also targets an assignment and optional occurrence; fulfillment requires approved evidence linked to that exact occurrence.

Failed occurrences return to `capture_pending` on a new capture revision while preserving every prior decision. Hold decisions store occurrence version and evidence snapshot hash. Concealment stores client operation, source, event time, evidence links and receipt hash.

## 7. Baseline, terms, rules and references

- Project creation atomically creates the Pilot contract shell and initial draft terms; legal entity is resolved from the organization.
- Contract terms preview/publish uses the same fields stored by SQL: calendar/timezone, cutoff, notice, payment, retention, numbering, required documents, adapter and effective date.
- Rule drafts conform to an allowlisted schema; unknown keys fail validation.
- Every rule carries one typed occurrence strategy: `once`, versioned calendar cadence, normalized material batch or authoritative quantity threshold. Calendar starts at assignment start at/after its anchor and ends at the earlier of assignment due/completion; an eligible late trigger keeps its original due date. Batch keys are normalized before idempotency. Quantity uses the first authoritative upward crossing; correction/reversal never deletes a historically materialized obligation. Explicit date/batch/threshold triggers use a durable `clientOperationId` and canonical trigger key; late, out-of-order or replayed inputs cannot create duplicates. A terminal-assignment trigger is rejected, and rule migration requires a separate preview without rewriting prior occurrences.
- Rule impact preview stores the canonical normalized draft payload, input hash and dependency hash. Publish consumes that exact single-use snapshot; it never reconstructs rules from summary output.
- Rule/terms/reference/assignment previews are persisted with subject, dependency versions, input hash and expiry.
- Only one current published contract version, terms version, rule version and reference revision exists per applicable key.
- Publishing a reference revision never rewrites an assignment. Open assignments become `stale_unacknowledged` until explicitly acknowledged (`stale_acknowledged`) or migrated through a new assignment.
- A stale acknowledgement binds assignment version, old snapshot hash and the exact published reference version without changing assignment lifecycle. Migration is not acknowledgement: it creates a linked replacement assignment and closes/cancels the old one under explicit guards.
- Pilot imports only positive-quantity `measured` rows. Section headings populate `section_path`; lump-sum, provisional, rate-only, zero, negative and ambiguous rows produce explicit blocking row errors. A re-import creates one acyclic work-item lineage with one current head. Availability, reservation and performed totals aggregate across `lineage_root_id`; unresolved open assignments on an old head block successor activation or require an exact migration plan, so quantity cannot be planned twice.
- Pilot rejects future-effective contract-terms publication. Existing assignments and packages remain bound to their exact terms version. Business-day calculations use the immutable calendar key/version and stored snapshot; the default Pilot calendar is Monday–Friday with no inferred public holidays.

Price indexation: индексация цены внутри опубликованной contract version не моделируется намеренно — любое изменение цены/ставки выражается только новой contract version (re-import/amendment) с impact preview; скидки/удержания проходят каналом deduction/credit adjustments. SaaS order-form индексация (doc 21) к проектным деньгам отношения не имеет.

Correction issue operations: владение issue меняется только через member offboarding resource resolution (append-only receipt); split/merge моделируются созданием новых issues со ссылкой на исходный в details и закрытием исходного с reason; severity после создания не редактируется — неверная severity закрывается и пересоздаётся. Отдельной команды правки issue нет намеренно: любой сдвиг — новый append-only факт.

## 8. Period and package arithmetic

Reporting periods for one project cannot overlap. Every period has an optimistic version and a monotonically numbered close cycle. `period_close_cycles` preserves each preflight, commit, cancellation and eligible reopen; old packages and close receipts remain immutable.

Preflight equations:

`performed = ready_candidate + blocked_risk`

`ready_candidate = included_ready + excluded_ready`

`held` is a labelled subset of `blocked_risk`, never an additional amount. `held` — это та часть `blocked_risk`, которая заблокирована активным hold-point-решением (`hold_point_decisions` в состоянии held) или authorized retention-hold; остальной `blocked_risk` — обычные незакрытые требования. `held` вычисляется как сумма performed-стоимости assignment-ов, чей единственный блокер — hold/retention, и не пересекается с прочим `blocked_risk`.

`package amount = included_ready`.

### Readiness & money derivation (нормативный алгоритм)

Readiness — детерминированная проекция; вычисляется снизу вверх без AI и без чтения audit-текста.

**Уровень occurrence.** Каждая `requirement_occurrence` даёт булев `met` по своей versioned rule: `met ⟺ state ∈ {passed, passed_with_notes, waived}`; `closed` occurrence сохраняет свой последний met. Blocking-требование с `met=false` — блокер; warning-требование в readiness не участвует.

**Уровень assignment.** `assignment_ready ⟺ каждая непогашенная blocking-occurrence этого assignment имеет met=true` и net performed quantity assignment-а > 0. Иначе assignment — под риском, а его единственный blocking-класс определяет причину (см. атрибуцию ниже).

**Уровень work item (одно состояние, precedence — lowest wins).** Состояние work item = минимальное по шкале состояние среди его не-cancelled assignment-ов и их occurrences; при равенстве применяется порядок из таблицы precedence ниже. То есть один незакрытый blocking-блокер удерживает весь work item ниже `ready_internal`, даже если остальные assignment готовы — это гарантирует, что «процент готовности» никогда не завышается.

| Порядок | Readiness state | Условие (выигрывает первое сверху, чьё условие истинно) |
|---:|---|---|
| 1 | `not_started` | net performed quantity = 0 по всем assignment |
| 2 | `evidence_missing` | есть performed, но хотя бы одно blocking evidence-требование met=false и нет активного waiver на него |
| 3 | `review_pending` | всё техническое evidence собрано, но есть непринятое обязательное internal-решение (review task не completed) |
| 4 | `overridden_ready` | внутренняя готовность достигается только благодаря активному authorized waiver/override |
| 5 | `ready_internal` | текущие versioned inputs удовлетворяют internal-правилам без waiver и без claim об acceptance |
| 6 | `packaged` | ready-объём включён в открытую версию пакета (claim в `package_line_quantity_sources`) |
| 7 | `submitted` | пакет с этим объёмом подан |
| 8 | `accepted_external` / `returned_external` | зафиксировано внешнее решение по exact-версии |

**Money split (без двойного счёта).** Performed-стоимость атрибутируется на assignment (net performed quantity × unit price контрактной версии, зафиксированной assignment-ом). Тогда: `included_ready` = Σ performed-стоимости assignment-ов в состоянии ≥ `packaged`; `excluded_ready` = Σ assignment-ов в `ready_internal`/`overridden_ready`, не включённых в открытый пакет; `blocked_risk` = Σ assignment-ов ниже `ready_internal`. Каждый assignment попадает ровно в одно слагаемое (состояние единственно), поэтому `performed = ready_candidate + blocked_risk` тождественно.

**Дедуп `affectedValue` блокеров.** `ReadinessBlocker.affectedValue` = performed-стоимость затронутого assignment, а не отдельного требования. Несколько блокеров одного assignment ссылаются на один и тот же assignment-scoped `affectedValue` с флагом `shares_assignment_value=true`; при суммировании суммы под риском по блокерам value берётся один раз на assignment (дедуп по `assignment_id`). Это исключает завышение суммы под риском при нескольких недостающих требованиях на одной работе.

**Триггеры пересчёта.** Пересчёт readiness запускается при: новой/скорректированной quantity-записи, изменении met у occurrence, публикации новой rule/terms/reference версии (invalidation зависимых оценок в stale), waiver create/revoke, package claim/withdraw, external decision. Пересчёт инкрементальный по затронутому work item (по lineage root); полный пересроет проекта — только по явной admin-команде repair (doc 33). `readiness_snapshots.projection_updated_at` фиксирует момент; drift ловится G-7 nightly job (doc 39 §9).

Package version stores exact contract, contract-terms, rule, adapter, renderer/template and source snapshot identities. Package quantity sources are reservation-checked so another period cannot include the same net source. Submitted versions remain immutable.

Package snapshot creation atomically locks the stable numbering-series row selected by the exact contract terms, allocates the next sequence, persists `document_number + numbering_sequence` on the package and writes one reservation receipt. A consumed or voided number is never reused; retries replay the same number. Uniqueness is enforced per organization document number and per stable series sequence.

Manual response flow is:

`submitted → pending_reconciliation → returned | accepted`.

An operational acknowledgement may be stored without legal acceptance semantics. Manual response creates a source receipt and `pending_reconciliation`; bounded pending-item saves can resume after response loss and do not trigger corrections. Finalization requires one exact result per package line, checks each expected item version, derives submitted/accepted/returned totals server-side and atomically freezes the set plus package/correction effects. An exact authenticated external full acceptance may generate all accepted items in the same transaction; no return has a package-only shortcut. A corrected package version links back to the decision items it resolves.

One financial line outcome may have many normalized correction issues targeting the package, line, occurrence or evidence object. Each issue has severity, owner, due date, exact version and state. No unmatched/duplicate/invalid source line is silently dropped. Any open blocking issue prevents reconciliation; resolution is an explicit append-only command with a note.

## 9. Authorization and lifecycle commands

- Invitation persists role and normalized project/location scope; `owner` is forbidden in ordinary invitations and membership patches.
- Pilot invitations use email plus an application deep link. SMS invitations remain GA/provider-gated and are not a Pilot promise.
- Membership role/scope replacement uses nested explicit project scopes; location rows cannot exist outside their parent project. Suspend and reinstate are exact-version lifecycle commands. Revoke must consume a fresh organization-level `member_offboarding` preview; a revoked membership cannot be reactivated by generic patch.
- Member offboarding is an organization-level aggregate, never a project-level impact preview. Owner/Admin/Security Admin creates a persisted cursor-based plan, pages every assignment, reviewer/escalation responsibility, evidence request, package issue, approval, organization-level integration owner, live lease and project scope, saves typed resolutions in bounded batches, resumes from exact persisted item pages, previews the exact dependency hash and consumes it once. Project-scoped rows require `projectId`; integration ownership requires `projectId=null` plus an exact replacement. `block_revoke` is a representable safe stop with null replacement/offline policy and prevents consume. It does not truncate at 500. Project/PTO managers cannot revoke organization membership; their separate command may remove only a project scope they administer after dependency validation.
- Offline authority is proven by a server-issued bounded lease, not device time. `issueWorkAssignmentExecutionBundle` persists an idempotent lease binding organization, subscription, project, contract, membership/version, assignment/version, authorized user, policy version, bundle hash, context hash, issue time and expiry. Evidence upload and capture submit bind the same actor and exact lease through composite constraints. Assignment change/cancel/complete, membership change, project pause/complete/archive, contract complete/terminate and organization/subscription grace/suspension/cancellation/closure invalidate affected leases in the same transaction.
- Owner change uses only the two-party ownership-transfer command.
- Organization lifecycle cannot be changed through settings PATCH.
- Project lifecycle uses a reasoned transition command; archive remains terminal.
- Empty project scope means no project access. For an allowed project, `all_locations=true` means all current/future locations; otherwise explicit location rows are required.
- Organization suspension keeps read/export/pay/support but blocks new domain consumption.
- Organization response always carries nullable `activeDeletionJobId`; while closing it identifies the exact nonterminal deletion workflow, so cooling-off status and cancellation never depend on browser memory.
- `technical/command-availability.csv` is the priority-ordered policy used by API, sync, workers and UI. It distinguishes scoped reads, export, payment/security recovery, processing objects already server-received, first-seen offline capture, review of existing work, new field execution, close/package and commercial correction. Every class ends in default deny.

## 10. Runtime durability

HTTP idempotency receipts are persisted with actor, tenant, operation, request hash, response status/body and expiry. Money/quantity/assignment/concealment commands also have durable domain operation IDs.

Worker jobs use lease owner, lease expiry and monotonically increasing fencing token. A stale worker cannot commit after lease loss. External calls never occur while a domain row lock is held; outbox delivery happens after commit.

## 11. Pilot feature boundary corrections

Pilot identifier search covers project/work/assignment/reference/package metadata. Location bulk import is supported through a purpose-scoped import preview/commit. Saved personal filters are Pilot convenience and may be disabled without blocking close; if enabled, they are user-scoped records. Person/content search, shared views and BIM extraction remain deferred.

Pilot has no bulk approval and no QR/NFC task deep links. Review decisions remain one exact target at a time. Session/device inventory is an identity-provider capability; AktFlow guarantees revoke-all and recent-auth consequences only when the configured provider supports them.

Quantity JSON contracts reject zero for every entry, require positive `progress`, negative `reversal` and signed non-zero `correction`, then enforce the contract-frozen precision server-side. `PaymentDueRule.from` is mandatory. `defects_period_end` retention requires a frozen `defectsPeriodDays` value or a separately validated adapter.

## 12. GA lifecycle closure

- Contract activate, complete, reopen and terminate use a dedicated exact-version command. Terminated is terminal; completed may reopen only before project archive with reason and recent authentication.
- Variation internal actions use a guarded transition command; external acknowledge/approve/reject/return/withdraw remain immutable exact-version decisions. Return creates a new editable version, dispute requires an explicit resolution record and incorporation requires a newly published contract version.
- External share revoke is immediate from created, active, OTP-challenged, opened or locked and invalidates all derived sessions atomically. Locked shares can only expire, be revoked or be reissued after cooldown and identity/scope verification.
- Acceptance decisions are append-only. A correction/resolution uses `supersedes_acceptance_record_id`; receivable stores the exact acceptance record ID and cannot exceed its accepted amount/currency.
- Acceptance lineage has one current head. A successor supplies the expected current acceptance version, belongs to the same package/root, increments the lineage version and atomically marks the prior record non-current. Two successors, cross-package links and cycles conflict. `pending|returned|disputed` require zero accepted amount; `partially_accepted|accepted` require a positive server-reconciled amount in package currency.
- An acceptance successor is blocked while a non-cancelled receivable, allocation, payment, retention or write-off consequence depends on the current head. The operator must complete an explicit cancel/credit/reversal/adjustment workflow first. `createReceivable` serializably locks and checks the exact current acceptance version; no downstream record is silently retargeted.
- Receivable reads return optimistic version plus server-derived adjustment, released-retention, paid, reversed and outstanding totals. A cursor-paged immutable ledger records every signed balance effect and balance-after value. Payment create accepts at most 500 unique receivable targets whose sum equals the payment; payment list/detail returns the tenant-unique business fingerprint, exact allocations and aggregate reversals. No UI balance depends on a lost command response or client-side arithmetic.
- Every growing list is cursor-traversable rather than a bare capped array. Contract-term revisions, work assignments, controlled references, review tasks and actor-owned saved views use the same `{data,nextCursor}` contract as the other registers; all API arrays have an explicit finite bound, and batch-specific ceilings are machine-validated.
- Package numbering belongs to a stable `numbering_series`, not a contract-terms version. Project bootstrap creates the Pilot default and `listNumberingSeries` makes its key/format/read-only next sequence reconstructible. Contract terms select an existing series but cannot provide `nextSequence`. Package creation locks and increments the server-owned series; terms publication, retry, void, generation failure or supersession never resets or reuses a number.
- A numbering series records first use. Its format becomes immutable after the first reservation; GA creates a new format only through `createNumberingSeries`, bound to an exact contract version, durable client operation, creator and receipt hash, with server-owned sequence one. An unused or used series may be retired only when no active contract terms reference and no reservation is active. `document_number` is unique within the organization and every issued/voided sequence remains non-reusable.
- Pilot contract lifecycle is explicit. An active contract must be completed or terminated before its project can complete/archive. Completion may reopen only while the project is not archived and guards pass; termination is terminal. Project archival never leaves an operationally active contract behind.
- SaaS settlement reversal returns a typed receipt naming reversal, payment, invoice/version, subscription/version, reversed and remaining amounts, resulting states and receipt hash. Currency mismatch, duplicate settlement reference and over-reversal fail under a serializable lock.
- Subscription cancel/reactivate consumes a fresh consequence preview hash. Payment may restore grace/suspended state; cancelled/export-only may reactivate only inside the eligible window.
- SaaS invoice transitions require expected version. A paid-invoice credit requires a positive amount, document reference and append-only payment reversal/refund or carry-forward receipt.

## 13. Recovery-state rule

Every nonterminal server/device state must have at least one explicit outgoing transition. Every terminal state must have none. If recovery creates a new aggregate/version/job, the old state is terminal and the new-object relationship is named in the state definition. CI rejects violations.

## 14. Pilot launch assertion

Specification closure does not prove runtime. Live customer admission still requires every Pilot blocker in document 34, real Postgres migration/RLS tests, physical-device offline tests, customer fixtures, adapter sign-off, legal/privacy documents, backup/restore evidence and independent role-based UAT.

## 15. v2.9 audit closure map

| Audit class | Normative v2.9 resolution | Machine evidence |
|---|---|---|
| core read closure | work detail, readiness blockers, package register/lines/decision set, rule versions and audit reads are explicit and scoped | OpenAPI read operations + `T-READ-CLOSURE-001` |
| occurrence expressiveness | four discriminated strategies, authoritative triggers and replay keys | occurrence schemas/events/table + `T-OCCURRENCE-STRATEGY-001` |
| offline chronology | first receipt after invalidation quarantines/rejects; only server receipt before invalidation follows normal processing | capture disposition/resolution + `T-OFFLINE-REVOKE-001` |
| preview payload ownership | canonical input snapshot is persisted and publish consumes its hash | `impact_previews.canonical_input_snapshot` + `T-RULE-PAYLOAD-001` |
| offboarding authority/scale | global plan is owner/admin/security only; project removal is separate; dependencies and persisted plan items are cursor-paged and typed; block-revoke is a safe stop | plan tables/API/permissions + `T-OFFBOARD-SCALE-001` |
| parent-state availability | one default-deny command policy and full lease invalidation registry | `command-availability.csv` + `T-LEASE-PARENT-001` |
| lease identity and sequence | membership/user/lease actor composite keys; online accept/start before issue | SQL constraints + `T-OFFLINE-AUTH-001` |
| re-import lineage | one current baseline head; availability spans every version | lineage keys + `T-REIMPORT-LINEAGE-001` |
| package correction multiplicity | one financial outcome plus many typed issues | issue aggregate + `T-PACKAGE-ISSUE-001` |
| acceptance/downstream money | successor blocked until explicit compensation | command guard + `T-ACCEPTANCE-DOWNSTREAM-001` |
| evidence association | editable only before local submit; after receipt invalidate and recapture | protocol + `T-EVIDENCE-ASSOCIATION-001` |
| waiver lifecycle | one active waiver and explicit append-only revoke/expiry | uniqueness/receipt/state + `T-WAIVER-REVOKE-001` |
| reporting date | client claim separated from authoritative open-period date | confirmation table/API + `T-REPORTING-DATE-001` |
| BOQ type safety | narrow Pilot accepts only measured positive rows | API/SQL/import test `T-BOQ-LINE-TYPE-001` |
| review correction | short-window correction receipt reopens one task; later decision is successor; package/downstream use locks shortcut | correction receipt + decision lineage + `T-REVIEW-CORRECTION-001` |
| terms timing/calendar | future dates disabled in Pilot; calendar is versioned and snapshotted | terms schema + `T-TERMS-EFFECTIVE-001`/`T-BUSINESS-CALENDAR-001` |
| numbering/period/export | stable retireable series, append-only close cycles, fenced export cancellation | lifecycle states/tables + dedicated tests |
| semantic validator | incoming reachability, recovery labels, API↔SQL parity, read closure markers and command defaults | `scripts/validate_package.py`, Redocly report and SQL parser report |
