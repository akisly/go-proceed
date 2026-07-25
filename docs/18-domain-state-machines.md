# 18. Business Rules and State Machines

## 1. Общие правила переходов

Любая команда выполняется только после проверки:

`authentication → active membership/share → tenant scope → role permission → project/location scope → entity version → plan entitlement → business guard → idempotency`.

Успешный переход атомарно создаёт:

- новую версию/ledger entry или изменяет допустимое mutable состояние;
- audit event (actor, tenant, command, aggregate + `object_version`, `reason_code` — обязателен для guarded/override-команд, timestamp, correlation ID);
- transaction-outbox event;
- idempotency result;
- notification intent, если он предусмотрен;
- projection refresh request, если изменяется readiness/money.

Неуспех не оставляет частично применённых money/quantity transitions. External side effects выполняются worker-ом после commit и имеют retry/dead-letter state.

## 2. Organization

`trial → active → suspended → closing → closed`

`grace` принадлежит lifecycle подписки, а не organization. Пока subscription находится в `grace`, organization остаётся `active`, но entitlement policy может ограничивать новое потребление. Переход subscription в `suspended` атомарно переводит organization в `suspended` либо применяет эквивалентную server-side restriction projection; реализация выбирает один способ и не хранит две расходящиеся истины.

| Transition | Actor | Guard | Side effects/recovery |
|---|---|---|---|
| create trial | platform/pilot workflow | verified email; abuse controls | owner membership created atomically |
| activate | billing operator/system | Pilot order/override or reconciled payment under configured policy | plan-version entitlements start |
| suspend | billing operator/system | subscription grace expired or authorized security/contract action; owner notified | mutations blocked except payment/export/support; no deletion |
| begin closing | owner | recent auth; no ownership transfer pending; available from `trial`, `active` and `suspended` | retention clock starts; cancel is allowed before close |

Project archive guard: `completed → archive` дополнительно требует отсутствия открытых receivable и pending external decision (`no_open_receivable_or_pending_external_decision`) — коммерческие факты нельзя «запереть» в терминальном архиве; поздние решения/оплаты приходят только в linked continuation project.
| cancel closing | owner | recent auth; cooling-off not executed | deletion job cancelled and interactive access restored |
| close | retention worker | export window passed; retention validated; legal holds evaluated | deletion/anonymization jobs by retention class |

Invariant: последнего owner нельзя revoke; support/platform role не является tenant owner.

Invariant (offboarding without payment): выход из workspace не находится за платёжным барьером. `begin_closing` доступен owner-у из `trial`, `active` и `suspended`; неплатящая организация закрывается и попадает в retention/deletion workflow без обязательного `restore`.

## 3. Membership and invitation

Invitation: `draft → queued → sent → accepted | expired | revoked | delivery_failed`.

Membership: `invited → active → suspended → revoked`.

- Invite token хранится только как hash, имеет TTL, one-time use и target organization/role/scope.
- `acceptInvitation` receives the opaque token in the request body after authentication and verifies server-observed MFA/terms before atomically activating membership.
- Reissue revokes the prior capability before a new delivery intent; invitation revoke and membership revoke are separate commands.
- Acceptance существующим пользователем не раскрывает другие workspace.
- Повышение до owner требует recent auth текущего owner, recent auth successor и двух подтверждений.
- Смена scope инвалидирует active authorization cache и refresh token claims; DB policy не полагается только на stale JWT.
- Revocation закрывает active sessions или вводит membership-version check на каждом запросе.
- Offboarding сохраняет авторство исторических объектов, убирая доступ.

Project archive is terminal and immutable. “Continue work” is not a reversal: `createProject` creates a distinct draft in the same organization with `reactivatedFromProjectId` pointing to the archived source. Only explicitly selected setup/rule references may be copied; evidence, quantity/money ledgers, packages, decisions and audit history never move or rewrite.

Project `complete` and `archive` are blocked while its contract is `active`. Pilot exposes the guarded contract lifecycle: complete or terminate first; completion may reopen only before project archive and after dependency checks; termination is terminal.

## 4. Contract version and work item

Contract version: `draft → validating → ready_to_publish → published → superseded | rejected`.

- Dry run не меняет baseline.
- Publish — одна транзакция: contract version, work items, location mappings, import report, audit.
- Published version immutable. Исправление создаёт следующую версию.
- Re-import показывает added/changed/removed rows, money delta, affected packages/rules.
- Work item, уже включённый в submitted package, не удаляется: новая версия связывается через lineage.
- Exceptional `createWorkItem` binds a published contract version, source reason and idempotency key; it cannot rewrite an imported item or act as bulk import.

Work item operational state is a read-only projection over its versioned assignments and immutable quantity ledger: `planned | assigned | in_progress | performed | completed | cancelled`. These labels describe aggregate facts and are never command targets. The server evaluates, in order: (1) `completed` when net performed quantity covers the contract quantity at frozen unit precision and every non-cancelled assignment is completed; (2) `in_progress` when any assignment is `in_progress` or `returned`; (3) `performed` when net performed quantity is positive or any assignment is `submitted`; (4) `assigned` when any non-cancelled assignment is `planned`, `assigned` or `accepted`; (5) `cancelled` when at least one assignment exists, all are cancelled and net performed is zero; otherwise (6) `planned`. A serializable assignment/quantity command updates the cached status, monotonically increments projection `version` and sets `projectionUpdatedAt`; replay/rebuild must produce the same result. `cancelled` is not terminal because a later authorized assignment can change the projection. Commercial readiness is a separate projection and never substitutes this operational view.

Contract terms version: `draft → validating → published → superseded | rejected`. It owns deterministic calendars/formulas/policy references, not legal interpretation. A published version cannot change an open assignment or closed period without explicit migration preview.

Work assignment: `planned → assigned → accepted → in_progress → submitted → completed`; `assigned|accepted|in_progress|submitted → returned`; non-terminal states may transition to `cancelled` under reason/version guard. One Pilot assignment has one assignee, exact location/planned quantity/due window and snapshots of terms/rules/references.

## 5. Quantity ledger

Pilot quantity command type: `progress | correction | reversal`. `transfer_out | transfer_in | accepted_adjustment` remain canonical GA ledger types but are rejected by the Pilot capture endpoint.

Invariants:

- запись immutable;
- correction ссылается на корректируемую запись и объясняет причину;
- сумма по work item/location не может превышать contract limit без authorized variation/override;
- decimal precision берётся из unit definition;
- один `client_operation_id` создаёт максимум один server entry;
- package line хранит точные source entry links;
- перерасчёт projection детерминирован и сверяется с ledger total.

## 6. Capture and evidence

Device state:

`local_draft → local_queued → uploading → server_confirmed | failed_terminal`.

Server capture session:

`server_received → scanning → pending_review → returned | approved | quarantined | terminal_failed`.

`corrected` не является mutable state старой session: исправление создаёт linked revision, которая проходит собственный lifecycle от `server_received`. Это сохраняет returned decision неизменным.

Правила:

- `local_draft/local_queued` живут в encrypted-or-platform-protected app storage; UI не говорит «отправлено»;
- server receipt появляется только после commit manifest + quantity commands;
- original object immutable; annotation/redaction создают derivative;
- malware/quarantine блокирует review/package, но сохраняет безопасную metadata record;
- return требует reason code; free-text optional;
- correction не переписывает returned session, а создаёт linked revision;
- self-approval запрещён, если project segregation enabled;
- duplicate/clock/location anomalies являются warning, не обвинением и не auto-rejection.

## 7. Requirement and readiness

Requirement state: `not_applicable | missing | pending_scan | pending_review | met | failed | waived | expired`.

Requirement occurrence state: `required → capture_pending → ready_for_inspection → passed | passed_with_notes | failed | waived | expired → closed` where only passed/passed-with-notes/authorized-waived occurrences may close. Date/batch/quantity occurrences have distinct immutable occurrence keys.

Review task: `open → assigned → in_review → completed | cancelled | expired`; return/correction creates or reopens the appropriate task under a new target version, never rewrites a completed task.

Reference document version: `draft → validating → published → superseded | rejected`; published/superseded versions are immutable.

Readiness state:

`not_started | evidence_missing | review_pending | ready_internal | overridden_ready | packaged | submitted | accepted_external | returned_external`.

Readiness — проекция, не командная машина: work item получает ровно одно состояние по правилу **lowest-wins** (минимальное достижимое состояние среди его assignment-ов и occurrences удерживает весь item), а точный алгоритм классификации occurrence→assignment→work item, precedence-таблица и money-split заданы в `docs/38-business-logic-closure.md` §8 «Readiness & money derivation». Один незакрытый blocking-блокер удерживает item ниже `ready_internal` независимо от готовности прочих assignment.

Readiness engine input snapshot содержит:

- engine version;
- contract/work item version;
- rule version;
- quantity ledger cutoff;
- evidence/review IDs and hashes;
- active waiver IDs;
- evaluation timestamp.

Waiver/override:

- scope, reason code, free-text justification, actor, expiry, affected value;
- не меняет исходный requirement;
- автоматически истекает и инициирует re-evaluation;
- отображается в package manifest;
- никогда не создаётся AI или anonymous external reviewer.

Evidence request: `open → fulfilled | cancelled | expired`. Request creation is workflow state only and never satisfies a requirement. `fulfilled` is server-derived from approved matching linked evidence; cancel/expiry retains the underlying readiness blocker and immutable request history.

## 8. Variation

`draft → evidence_ready → internally_approved → issued → acknowledged → approved | rejected | withdrawn | disputed → incorporated`.

- Variation имеет immutable versions; issued version не редактируется.
- `acknowledged` означает получение/операционное подтверждение, не approval стоимости.
- Work started before direction фиксируется отдельным flag и timestamp.
- Incorporation создаёт новую contract version/lineage, не меняет base BOQ.
- Reject/withdraw не удаляет evidence и коммуникации.
- Любое external decision связывается с exact version and assurance level.

## 9. Reporting period and package

Period: `open → preflight → closing → closed → reopened`.

- одновременно один active close operation на project/period;
- hard blockers нельзя обойти без explicit override permission;
- warning допускает продолжение после acknowledgement;
- reopen требует причины, создаёт audit event и не меняет существующие package versions.

Package version:

`draft_snapshot → generating → generated | generation_failed`; after a successful retry/generation: `generated → ready_to_submit → submitted → pending_reconciliation → returned | accepted`. `ready_to_submit → superseded` and `submitted → withdrawn` are guarded alternatives. Exact authenticated GA full acceptance may transition `submitted → accepted` only while atomically materializing a complete accepted decision set.

- snapshot создаётся до async generation;
- retry использует тот же snapshot или создаёт явно новую version; это отображается пользователю;
- generated files имеют hash, renderer/template versions and manifest;
- submitted version immutable;
- `returned` is terminal for that immutable version; correction creates a linked new package version;
- изменение line/evidence/template после submission создаёт новую version;
- withdraw не удаляет submission receipt;
- compare показывает line, quantity, evidence, waiver and document differences.

Package decision item: editable `pending → returned | accepted | modified → correction_open → resolved`. Pending rows use optimistic versions and have no package/readiness/correction effect; only a complete exact-set finalization freezes them. Pilot user records an external source receipt; GA external actor writes through exact capability. External full-package acceptance may atomically materialize all accepted lines, but a return never bypasses reconciliation. Every final aggregate return/acceptance reconciles to immutable line items and server-derived submitted/accepted/returned totals.

## 10. External share and decision

Share: `created → active → otp_challenged → opened → decided | expired | revoked | locked`. Revoke is valid from every nonterminal usable/locked state. `locked` may only expire, be revoked or return to `active` after cooldown plus authorized identity/scope verification and a new token.

- token stored hashed; TTL, attempt limits, session binding and exact resource scope;
- raw token не попадает в analytics/logs;
- download/decision permissions раздельны;
- revoke действует немедленно;
- decision append-only: `comment | return | operational_accept | signed_accept`;
- share target is a checked polymorphic exact `package_version` or `variation_version`; precisely one target is present and the target snapshot hash is frozen;
- UI всегда показывает assurance level и не повышает click до КЕП.

## 11. Project commercials

Acceptance record is append-only: `pending → partially_accepted | accepted | returned | disputed`. Every recorded decision (`partially_accepted`, `accepted`, `returned`, `disputed`) is terminal for that record; a later resolution — including completing a partial acceptance — creates a same-package record with `supersedes_acceptance_record_id`, expected current version and the same lineage root. Exactly one record per lineage is current. Concurrent successors, cycles and cross-package links fail. `pending|returned|disputed` carry zero accepted value; positive accepted states reconcile to immutable package decision lines and package currency.

Receivable: `draft → issued → due → part_paid → paid | overdue | disputed | written_off | cancelled`.

- package acceptance и receivable — разные события;
- retention и deduction хранятся отдельными line items с reason/due/release terms;
- allocation total не превышает payment и receivable outstanding;
- overpayment остаётся unapplied balance или возвращается отдельной операцией;
- FX не применяется в Pilot; GA требует recorded rate/source/date;
- delete/update money facts запрещены: correction/reversal only.
- UI/API closure is explicit: record acceptance, create/transition/adjust receivable, release retention, record/reverse payment. CSV reconciliation creates a preview job and cannot silently commit money.

Normative allocation/reversal transaction algorithm:

1. run at PostgreSQL `SERIALIZABLE`; begin with tenant, actor, request and durable `clientOperationId` context;
2. insert/find the tenant-scoped command-idempotency record; a same-hash replay returns its stored receipt and a different hash fails;
3. lock the payment row and every affected receivable/adjustment row with `SELECT ... FOR UPDATE` in ascending UUID order, after resolving every row by `(organization_id, project_id, id)`;
4. recompute payment amount, prior allocations/reversals and every receivable outstanding from immutable rows inside the transaction—never from a cached projection or client total;
5. reject negative/cross-currency/cross-project values, allocation above remaining payment, allocation above receivable outstanding and reversal above the original unreversed amount;
6. append allocation/reversal rows, update only derived projection/version fields, append audit and transaction-outbox records, store the response against the idempotency record and commit;
7. on serialization/deadlock failure roll back the whole transaction and retry the same command with bounded jitter; after the bound return a retryable Problem with no partial ledger/outbox effect.

Ordered migrations may implement this as guarded SQL functions or equivalent domain transactions, but must preserve this lock order and the invariants above. Direct multi-step BFF writes are forbidden.

## 12. SaaS subscription

`pilot → trialing → active → grace → suspended → cancelled → export_only → closed`.

- plan version immutable;
- entitlement вычисляется из immutable `plan_version.entitlements` + time-bound override - suspension restrictions;
- Pilot is a normal subscription state and records idempotent one-invoice SaaS bank payments; no parallel grant table or project-payment shortcut exists;
- Pilot payment-request issue is an idempotent platform-billing command that snapshots subscription version, plan version, period, tax mode and basis hash before state becomes `issued`;
- `validated_invoice` document mode and cancel/credit corrections remain gated by V-006/GA; Pilot safe default is explicitly `payment_request`;
- usage snapshot воспроизводит charge;
- upgrade может быть immediate only after price confirmation/payment policy;
- downgrade — next cycle; данные не удаляются;
- hard limit блокирует новое потребление, не чтение существующих данных;
- failed payment не удаляет tenant data;
- `cancel` доступен owner-у из `pilot`, `trialing`, `active`, `grace` и `suspended` без предварительной оплаты: неплатящий клиент завершает подписку и проходит `cancelled → export_only → closed` c organization close workflow;
- cancellation допускает reactivation до close.

## 13. Export, deletion and legal hold

Export job: `requested → authorized → collecting → packaging → ready → expired`; `requested|authorized → cancelled`, `collecting|packaging → cancel_requested → cancelled`, and `collecting|packaging → failed`. Download не является состоянием job: скачивание из `ready` — это отдельный short-lived, logged access grant.

Deletion job: `requested → cooling_off → cancelled | blocked_by_hold | scheduled → executing → verified → complete`.

- export-all требует recent auth и owner/admin permission;
- link short-lived, single-purpose, access logged;
- legal hold блокирует только соответствующие categories/objects;
- unvalidated retention (V-003) blocks destructive scheduling by default even when no legal hold record exists;
- deletion отчёт содержит counts, failures and retained legal bases;
- backup expiry следует отдельному documented schedule; невозможность мгновенно удалить backups раскрывается в privacy notice.

## 14. Async job standard

Import/generation/integration jobs используют стандартную машину:

`queued → running → retry_wait → succeeded | failed_terminal | cancelled`.

Export job (§13), `notification_delivery` (`queued → sent → delivered | bounced`, `queued → failed → retry`) и `webhook_delivery` (`queued → sending → delivered | retry_wait | failed_terminal`) имеют собственные машины в state-catalog; их состояния не переименовываются под общий стандарт.

Обязательные поля: tenant, type, resource, idempotency key, payload version, attempts, next attempt, progress, public error code, internal correlation, created/started/finished timestamps. Пользователь видит безопасную причину и retry/cancel action, если она допустима.

## 15. v2.9 reachability, availability and compensation

The canonical state graph is `technical/state-catalog.csv` plus `technical/state-transitions.csv`. Every state is declared as initial, derived or reachable from an initial state; every nonterminal state has an outgoing recovery/success path; terminal states have none. A recovery label must name a real command or explicitly create a new aggregate/version.

Command permission and entity transition are both required. `technical/command-availability.csv` applies the highest-priority matching rule across parent states and ends every command class in default deny. In particular:

- organization `closed` is terminal; recovery creates no interactive restore path;
- organization/subscription suspension preserves scoped read, export, payment and security recovery but denies new field consumption;
- project pause/complete/archive, contract complete/terminate, membership/assignment change and subscription/organization restriction invalidate affected leases in the same commit;
- already server-received scan/review may finish only through its dedicated safe-processing class; first-seen post-invalidation capture cannot enter that class;
- period reopen requires a new numbered close cycle and is denied after submission, external decision, acceptance, receivable or payment dependency;
- export cancellation is reachable only from pre-ready states: queued work cancels directly, running work enters `cancel_requested`, and a fenced worker finalizes `cancelled`;
- acceptance successor is denied while any active downstream receivable/payment fact remains; compensation occurs in the downstream aggregate before a new head is created;
- review undo appends an immutable correction receipt and reopens one task; the next approve/return is the review-decision successor. Waiver revocation and evidence correction likewise use immutable receipts/new revisions; none rewrites history.

Package decision issues have their own lifecycle `open → resolved | cancelled`. A reconciliation can finalize only when all required financial outcomes are present and no blocking issue remains.
