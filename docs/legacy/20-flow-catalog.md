# 20. End-to-End Flow and Edge-Case Catalog

## 1. Flow completeness contract

Каждый flow описывается как:

`actor → trigger → preconditions → numbered actions → system transitions → receipt/end state → alternate/error/recovery → audit/events → test IDs`.

Интерактивный прототип показывает ключевую развилку каждого P0/P1 family. Остальные варианты описаны здесь и в machine-readable traceability; они не требуют отдельного mockup, если layout/decision не меняется.

## 2. F01 Pilot qualification

Actor: owner/commercial/PTO lead.  
Trigger: landing CTA.  
End: qualified request with consent receipt; no workspace is silently created.

Main path: company → specialization/active projects → pain/last delayed amount → contact → separate service and marketing consents → success/booking fallback.

Edges: duplicate lead, unsupported ICP, invalid phone/email, network retry, consent withdrawal. Analytics never contains company/contact or exact delayed amount.

System contract: public `submitPilotLead` uses purpose-scoped idempotency, versioned service/privacy consent, separate optional marketing consent, uniform `202` duplicate behavior and abuse throttling. The operational lead store is outside tenant/product analytics; `T-LEAD-001` verifies minimization and recovery.

## 3. F02 Sign-in, invite and recovery

Main paths:

- password/magic link → MFA if required → workspace chooser → destination;
- invite token → validate org/inviter/scope → sign in/create identity → terms → MFA → membership active;
- forgotten password → non-enumerating response → reset → revoke sessions → login;
- lost MFA → recovery code/support identity procedure; support cannot bypass without case/audit.

Edges: expired/revoked/used token, suspended organization, revoked membership, clock skew, device/session revoke, ownership successor pending.

Domain closure: identity/session remains Supabase-owned, but membership activation is `acceptInvitation`; it validates the opaque token from the request body against the authenticated subject and server-observed MFA. `reissueInvitation` atomically revokes the old capability before queueing a replacement; `revokeInvitation` is idempotent and cannot affect an already accepted membership.

## 4. F03 Workspace/project onboarding

Owner creates organization atomically, then legal entity/project with a contract shell. Draft autosaves. User may use explicit sample values, but production actions remain disabled until required baseline is confirmed. Location structure uses purpose-bound CSV/XLSX upload → parse → exact hierarchy/code preview → row errors → idempotent confirm; rejected rows never partially mutate the tree. Scoped identifier search and user-only saved filters are available after project creation, while people/content search and shared views are deferred.

Edges: duplicate EDRPOU/company suggestion, user already belongs to tenant, plan project limit, invalid reporting dates, unsupported currency, duplicate/cyclic/orphan location codes, stale import preview, abandon/resume, atomic failure.

## 5. F04 Estimate import and re-import

Upload → scan → sheet/header → mapping → normalization preview → row errors → dry run totals → authorized confirm → published contract version. In Pilot only measured rows with positive quantity become work items; section headings build `section_path`, while lump-sum, provisional, rate-only, zero/negative or ambiguous rows visibly block confirmation. Re-import maps every successor to one stable acyclic lineage and computes planned/performed/available quantity across the whole lineage.

Edges: password-protected/corrupt file, mixed decimals, duplicate codes, formula cells, hidden rows, huge file, unsupported units, retry, same hash, re-import diff, removed submitted line. Nothing commercial is inferred silently.

## 6. F05 Rule pack configuration

Select specialization pack → inspect applicability → change requirements and typed occurrence strategy → impact preview stores the canonical normalized rule payload → publish consumes that exact single-use payload/hash → evaluation job → results. `once`, `date` (calendar), `batch` (material batch) and `quantity_threshold` — canonical wire discriminators per OpenAPI/SQL — use different required fields and deterministic trigger keys; late/out-of-order/replayed triggers cannot create duplicates.

Edges: work items without mapping, contradictory rules, before-concealment rule activated after work, publish conflict, rollback via new version, existing package remains on prior snapshot.

## 7. F06 Assignment and offline capture

PM/foreman assigns scoped task → worker opens Today → starts local session → captures required originals/metadata/quantity → validates draft → commits outbox → receives local receipt → resumes upload → server receipt → scan → review queue.

Office may create one exceptional item through `createWorkItem`; it must bind an exact published contract version and source reason and cannot overwrite imported work. Bulk creation remains import-only.

Before offline work, the assignee accepts/starts the assignment online and the client then idempotently issues an exact execution bundle with a bounded server-signed authorization lease. Capture and evidence upload bind that lease ID/hash. Device time is metadata only and never proves authorization. Reassignment, suspension and revoke invalidate the lease in the same commit. Only an object durably received and transitioned server-side to `available` before invalidation may finish the normal scan/review path; bytes first seen after invalidation are quarantined for an independent Security Admin decision or rejected by the frozen policy and cannot satisfy requirement, quantity or readiness.

Edges: denied camera/location, gallery prohibited, low storage, lease/token expires offline, device clock wrong or manipulated, partial multipart upload, duplicate tap, app killed, device lost, reassignment/suspension/revoke, server contract version changed, terminal malware reject. Safety-critical capture permits location reason instead of unsafe GPS action.

## 8. F07 Internal review and correction

Reviewer opens prioritized queue → checks original/context/requirements/amount impact → approve or return reason → worker sees returned item → linked correction → re-review → readiness refresh.

Reviewer/PM may create a scoped `evidence_request` for an assignee and requirement. Creation only creates work/notification state and never marks the requirement met. Only server-observed approval of matching linked evidence fulfills it; authorized cancellation/expiry retains the blocker and history.

Edges: reviewer created evidence, simultaneous reviewers, decision already committed, evidence quarantined, correction changes quantity. A 30-second UI undo calls guarded `correctReviewDecision`: it appends a correction receipt, makes only the current-decision projection non-current, reopens the exact capture and creates one task while no downstream package use exists. It does not fabricate a replacement decision; the subsequent approve/return becomes the lineage successor. Otherwise the UI directs to the relevant business correction instead of rewriting history.

## 9. F08 Readiness and override

Engine evaluates immutable input snapshot → reason tree shown → user resolves blocker or authorized manager creates expiring waiver → projection refresh → package manifest records waiver.

Edges: stale engine version, failed evaluation, rule published mid-close, waiver expires or is explicitly revoked after package generation, money mismatch. Expiry/revoke preserves the original waiver, recomputes current readiness once and never changes an earlier package manifest. `ready_internal` always carries explanatory label.

## 10. F09 Variation

Foreman/PM drafts notice before/while work occurs → evidence and commercial valuation → internal approval → issue exact version → customer acknowledges/returns/approves outside or through secure link → incorporate as new contract version.

Edges: work already started, no written direction, partial approval, price dispute, withdrawn/reissued version, external link expiry, base line duplication.

## 11. F10 Period close and package generation

Open preflight → choose period → see performed/ready/held/excluded → assign blockers → acknowledge warnings/authorized overrides → atomically reserve the next immutable package document number and freeze snapshot → generate → validate hash/pages/manifest → preview redaction/PII → mark ready.

Edges: close lock conflict, generation timeout, template defect, oversized artifact, missing font, evidence removed/quarantined, rule changes, reopen period. Retry explicitly says whether snapshot is reused.

`reopenPeriod` is allowed only before a package has a submission/external-decision/acceptance/receivable/payment dependency and requires exact period version, reason, recent authentication and permission. Every close/reopen attempt creates a serialized numbered close cycle. Existing package snapshots/artifacts remain immutable and become historical; submitted periods use correction/resubmission, not reopen.

## 12. F11 Submission and external review

Authorized user records channel/recipient/reference or creates secure exact-version link → reviewer validates OTP → opens package → comments/returns/operationally accepts → decision receipt → package state and internal tasks update. Sender/security can immediately revoke a created, active, challenged, opened or locked share together with every derived session.

Edges: wrong recipient, expired/revoked/locked share, download disabled, partial return, simultaneous new version, reviewer disputes identity, decision after expiry. Email auto-send is deferred; user remains final sender in Pilot.

## 13. F12 Accepted to paid

Append-only acceptance record → exact acceptance-linked receivable/invoice details → retention/deductions → due date → manual/CSV payment import → matching preview → partial allocation → overdue/dispute/release → paid. Aggregate reads expose exact receivable version and derived totals; the paged receivable ledger exposes every signed adjustment, retention, allocation and reversal effect. Payment list/detail preserves the normalized business fingerprint, bounded unique allocations and reversal total. A later acceptance resolution supersedes rather than edits the prior decision.

Command closure: `recordAcceptance` → `createReceivable` → `transitionReceivable`/`adjustReceivable`/`releaseRetention` → `recordPayment`/`reversePayment`. `createReceivable` locks and checks the exact current acceptance head. A new acceptance successor is blocked while any active downstream receivable or payment depends on that head; the downstream ledger must first be explicitly cancelled/credited/reversed/resolved. `createPaymentReconciliationImport` produces a preview job only; each selected row later uses the normal idempotent payment command and immutable business `sourceFingerprint`.

Edges: duplicate bank row, overpayment, wrong currency, reversal, disputed deduction, retention release without acceptance, payment against superseded package. Construction commercials never affect SaaS entitlements.

## 14. F13 SaaS subscription

Pilot plan version + bounded override → plan offer → legal/billing details → immutable payment-request basis → issue → exact one-invoice manual reconciliation → entitlement activation/restore → usage visibility. GA continues with self-service upgrade/downgrade → renewal/grace/suspension → consequence preview → cancel/export/reactivate and expected-version invoice corrections/payment reversals.

Pilot and GA use the same `plan_versions + subscriptions + entitlement_overrides` authority. Pilot issues a `payment_request` via platform-only `issueSaasInvoice`, freezes plan/period/basis, and the isolated platform billing plane records one bank settlement via platform-only `recordSaasPayment`; GA adds tenant self-service plan/state commands, validated seller-document mode and platform-only cancel/credit adjustments. Tenant membership never authorizes SaaS invoice issue/settlement/correction, and project payments cannot satisfy AktFlow invoices.

Edges: plan version changes, VAT correction, late transfer, payment without reference, project limit, storage limit, refund/credit note, ownership change. No data deletion on downgrade or failed payment.

## 15. F14 Team and access administration

Email/deep-link invite → nested project/location scope preview → accept atomically → access review → versioned role/scope replacement/re-auth where sensitive → Owner/Admin/Security Admin suspends access and creates an organization-level offboarding plan → server pages every exact responsibility across all projects → actor saves typed replacement/transfer/offline resolutions → persisted plan-item pages restore exact progress after navigation or response loss → fresh impact preview → dedicated revoke transition consumes the complete plan → reassignment, lease/session invalidation and audit commit atomically. `block_revoke` is an explicit safe terminal choice for the current attempt and must be cleared before preview/consume. A revoked membership is not reactivated by patch; owner transfer remains its separate two-party aggregate. Project/PTO managers may remove only an administered project scope through its own command and can never consume an organization revoke.

`listInvitations` is the reconstructible management register: it returns IDs, role/scope, delivery state and expiry but never a token. Resend is a reissue, never the same token. Revoke affects only an unused invitation; membership revoke is a separate audited command. GA `listOwnershipTransfers` is visible only to the current owner, named successor or authorized security actor and lets the UI resume/poll completion without retaining creation response state. Canonical tenant finance role is `accountant` / UI `Project Accountant`; platform SaaS Billing Operator is not a tenant project role.

Edges: final owner, self-removal, higher role invite, user in multiple tenants, duplicate contact, stale session, orphaned reviews/integrations.

## 16. F15 Notification and escalation

Domain event → mandatory/preference policy → in-app delivery intent → retry-safe commit → list → own-recipient read receipt. GA branch: approved provider attempt → delivered/bounced/failed → digest/escalation if configured.

Security/billing mandatory notifications cannot be fully disabled. Free text and exact money are excluded from push preview by default.

Pilot includes canonical recipient-scoped in-app notifications, atomic idempotent read receipts, ETag-versioned preferences, an explicit event-catalog version, mandatory event keys, advertised channel availability and retry-safe delivery state. Preference updates are partial, reject a stale catalog/unknown key and cannot enable email, push or SMS unless that exact channel is advertised. Every delivery attempt references the exact same-tenant notification/recipient/channel tuple, so retries cannot invent or cross-link content. External providers remain feature-gated until their privacy/security/vendor review.

## 17. F16 Integration/webhook

Admin creates connection → verifies least-privilege secret → mapping/dry run → activate → signed delivery → retry/dead letter → replay by authorized operator → rotate/revoke.

The command order is enforced: create → fresh redacted preview → activate/resume; pause retains queue/history, revoke invalidates the secret and cancels new delivery, rotation returns the new secret once with bounded overlap.

Edges: provider rate limit, duplicate webhook, signature mismatch, mapping drift, replay after tenant revocation, secret exposure. Secrets never redisplayed or logged.

## 18. F17 Export, retention and organization close

Owner recent-auth → choose scope/format → async export → download receipt → close request → cooling-off → legal hold check → retention jobs → verification report. Before `ready`, the owner may request cancellation: queued work cancels immediately; a running worker records `cancel_requested`, stops at a fenced boundary, removes partial artifacts and emits a cancellation receipt. A ready/downloadable artifact is not retroactively cancelled.

Edges: job too large, expired download, partial failure, legal hold, active contract, owner cancels during cooling-off, backup expiry disclosure.

Pilot supports export-first closure request/status/cancellation. While V-003 retention is unvalidated, the safe default permits closing interactive use but blocks destructive scheduling; cancellation during cooling-off restores access. Completed deletion is not advertised as reversible.

## 19. F18 Support and incident

Customer opens case → metadata diagnosis → explicit scoped support grant if needed → banner and audit → action → revoke/expire → resolution. Security incident uses separate severity/communication process and break-glass dual approval.

Edges: customer unavailable, suspected tenant leak, active legal hold, support employee conflict, grant expires mid-session, evidence export requested during incident.

## 20. Global UI states

Every surface references reusable states rather than inventing copy:

- `loading.skeleton`;
- `empty.first_action`;
- `error.retryable` with correlation ID;
- `error.terminal` with safe next step;
- `offline.local_only`;
- `sync.conflict`;
- `permission.denied` naming required role/grant owner;
- `entitlement.soft_limit`;
- `entitlement.hard_limit` blocking new consumption only;
- `resource.archived`;
- `organization.suspended` with pay/export/support actions;
- `job.progress/retry_wait/failed`;
- `destructive.cooling_off`;
- `external.expired/revoked/locked`.

## 21. F19 Contract terms and controlled references

PTO/Commercial creates draft contract terms → enters explicit reporting/cutoff/notice/payment/retention/numbering/adapter rules → deterministic impact preview → publish immutable version. PTO uploads reference → validates number/revision/source → previews affected open work → publishes/supersedes. Open assignments receive stale-reference actions; submitted snapshots remain pinned.

Edges: missing legal/accounting confirmation, invalid calendar/formula, publish race, reference duplicate hash with different revision, supersede while offline assignment cached, old revision remains contractually applicable. No legal meaning is inferred.

## 22. F20 Assignment and occurrence planning

PM selects work/location rows → enters positive planned quantity/one assignee/window/priority and a stable `clientOperationId` per row → previews baseline/rule/reference impact → commits a bounded batch. Each row is its own transaction: valid rows create a `planned` assignment atomically issued to `assigned` in the same commit, deterministic requirement occurrences and exactly one notification; invalid/conflicting rows return a stable rejection and do not roll back committed siblings. Replay returns the same per-row receipt. Reassignment is a separate exact-version command with offline policy; stale-reference acknowledgement is a separate non-lifecycle command; migration creates a linked replacement assignment. Field cache receives exact assignment/contract-term/rule/reference versions and lifecycle commands enforce assigned → accepted/in-progress/submitted/returned/completed or reasoned cancellation.

The field cache is populated only by `issueWorkAssignmentExecutionBundle`, which returns and persists a bounded authorization lease. Capture/upload commands require the exact lease. A changed device clock cannot extend authority.

Edges: over-plan, duplicate occurrence key/client operation, user outside scope, stale preview/contract/rule/reference, mixed `207` batch result, retry after response loss, reassignment during offline capture, cancellation with submitted evidence. Team/crew is absent from Pilot.

## 23. F21 Typed evidence and hold point

Field opens assignment occurrence → exact schema/reference loads from cache → enters certificate/test/drawing/document values and originals against the same organization/project/work/assignment/location/occurrence tuple → local validation → durable outbox/server receipt → review task → pass/return/fail → authorized concealment closure. Evidence reuse requires target preview and creates a new exact occurrence link; it never retargets the original. A privileged invalidation preserves the original/hash, records reason/version/actor, marks dependent evaluations stale and creates new review/correction work without deleting history.

Edges: unsupported schema, unit mismatch, expired certificate/calibration, out-of-range value, stale reference, missing original, closure attempted before decision, witness unavailable, device offline. Validation is a configured completeness check, never truth/legal acceptance.

## 24. F22 Package line decision and correction

Pilot user records a manual external response, or a GA reviewer records one exact-share package response → server creates an exact-version source receipt/decision set → normalizes unmatched/duplicate/ambiguous source rows into explicit package decision issues → an authorized tenant commercial/PTO user saves bounded subsets of one financial outcome per package line plus any number of requirement/evidence/occurrence issues with per-item optimistic versions → resolves or acknowledges eligible issues → resumes until every required line is covered and no blocking issue remains → remains `pending_reconciliation` with no package/readiness/correction effect while incomplete → finalizes once → exact correction actions/review tasks → new package version → compare/resubmit. The server derives submitted/accepted/returned totals; clients never assert authoritative totals. Exact GA full-package acceptance may materialize all accepted line items atomically; return always enters tenant reconciliation.

Edges: totals mismatch, line from another version, stale item version, response loss after partial save/finalize, two editors, more than 500 rows per save, partial acceptance without allocation, simultaneous superseding package, duplicate receipt, decision after expiry, returned line already corrected. Submitted package remains immutable.
