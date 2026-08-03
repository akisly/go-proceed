# 28. Pilot MVP and Safe GA Delivery Plan

## 1. Delivery premise

Один founder может безопасно поддерживать только узкий web office, узкий native field workflow и один worker pipeline. План оптимизирует не количество функций, а завершённый evidence-to-package outcome с восстановлением и поддержкой.

## 2. Pilot MVP epics

### P0-A Foundation and safe tenancy

Deliverables: repository/environments/CI, Auth, organization/legal entity, membership/scopes, invitation accept/reissue/revoke, complete RLS/grants, audit/outbox, support metadata, Pilot subscription/plan/override authority.

Exit: owner invites scoped user; acceptance atomically binds identity/MFA/terms and copies exact scopes; owner elevation is impossible; all cross-tenant/location negative tests pass; revoke acts immediately.

### P0-B Commercial baseline

Deliverables: project/location/counterparty/contract, immutable contract-terms version, location-structure import, controlled reference register, audited exceptional single-work create, upload/scan import, mapping dry run, row errors, publish immutable contract version, re-import diff preview.

Exit: authorized PTO reconciles row count, quantity and contract total to source fixture; location hierarchy preview/confirm rejects cycle/orphan/stale-preview cases; no silent normalization.

### P0-C Rules and readiness foundation

Deliverables: electrical rule pack, allowlisted config schema, assignment and occurrence model, applicability/multiplicity, hold-point lifecycle, publish/version, requirement/evaluation snapshots and explainability.

Exit: golden work items yield deterministic reasons/totals; bounded assignment mixed batches preserve committed rows and stable receipts; old package snapshot remains unaffected by new rule.

### P0-D Offline field capture

Deliverables: Today/exact assignment/camera-document-audio/typed certificate-test-drawing forms/quantity/draft/outbox, resumable upload, local/server receipts, controlled reference binding, conflict/terminal failure UI.

Exit: app kill/network/retry/device tests prove no loss/duplicate quantity; original hashes verify.

### P0-E Internal review/correction

Deliverables: evidence inbox/review-task pane and SLA, structured return, linked correction, hold-point decision, approve, SoD, scoped evidence request/fulfillment and in-app notifications with retry state.

Exit: returned or invalidated evidence is corrected and re-approved with immutable timeline and dependency/readiness update; original/package history stays reproducible.

### P0-F Period preflight/package

Deliverables: period, blocker cockpit, include/exclude/override, guarded pre-submission reopen, immutable snapshot, generic evidence index/readiness/quantity export, typed/reference summaries, package-line manual decision reconciliation, one gated customer adapter, generation job/manifest/hash/retry.

Exit: package reproduces totals and source links; same snapshot generates deterministically; incomplete decision sets remain pending with no package effect and reconciled replay yields one receipt; no legal acceptance claim.

### P0-G Operate safely

Deliverables: organization export, export-first closure/cooling-off cancellation, audit view, Pilot immutable SaaS payment-request issue/manual settlement/grace status, monitoring/alerts, backups/restore, incident/support/migration runbooks, feature flags.

Exit: restore and rollback drills; pilot provisioning/offboarding rehearsed; owner can export during suspension.

## 3. Pilot controlled limitations

- one live project and electrical MEP;
- guided onboarding; no public self-serve live tenant;
- one generic package plus maximum one validated customer adapter;
- manual external submission and decision receipt;
- no product email sending to customer;
- no KEP/card/bank API/custom roles/SSO;
- business-hours support;
- explicit pilot data/retention terms;
- feature flags per tenant.

These limitations are shown in order/pilot agreement and UI; they are not hidden support knowledge.

## 4. GA epics

### G1 Repeatable close

Variations, package compare/resubmit, secure external review/OTP, acceptance records, advanced notification escalation/provider channels and reusable templates.

### G2 Commercial visibility

Receivables, retention, deductions, dispute, partial payments, CSV reconciliation, aging/reports. Still not full accounting.

### G3 Commercial SaaS

Plan versions, metering, usage snapshots, subscription lifecycle, VAT-validated invoice/service documents, credits/grace/suspension/export.

### G4 Operational maturity

Support console/grants, webhooks/integrations, status/SLO/error budget, independent security review, privacy/legal pack, tested DR.

### G5 Repeatability/expansion

Second/third specialization only after reusable rule evidence; first CEE country only through country pack gate and local pilots.

## 5. Sequencing and dependencies

`P0-A → P0-B → P0-C → P0-D/P0-E → P0-F → P0-G`.

- UI can prototype in parallel, but backend implementation does not skip A/B/C.
- Customer adapter starts only after at least one artifact; generic package unblocks P0-F.
- External review relies on immutable package and external capability model.
- Receivables rely on acceptance semantics.
- SaaS hard enforcement relies on export/suspension flow.

## 6. Release strategy

- internal synthetic workspace;
- founder dogfood with representative fixtures;
- design partner sandbox;
- single live tenant/project behind flags;
- second live tenant only after first period close and incident review;
- Pilot cohort cap determined by support/cost, initially 3;
- GA availability only after two differing configurations and external gates.

## 7. Solo capacity and schedule range

Planning range, not commitment:

- production-ready specification/prototype: 8–12 weeks including validation wait;
- synthetic/concierge alpha: 3–4 months;
- safe first live Pilot: 6–9 months solo if the narrow Pilot boundary remains fixed;
- safe standalone GA: 12–18+ months solo, with fractional legal/security/accounting/mobile QA at gates.

Weekly capacity assumption: 50–55% build, 20–25% QA/operations, 15% discovery/onboarding, 10% support/admin. Roadmap is reforecast when support exceeds assumption.

Оценки трудоёмкости зафиксированы в `technical/implementation-backlog.csv` (колонка `size`: S/M/L/XL; 7 XL-задач декомпозированы в колонке `subtasks`, каждый под-инвариант ≈ один тест). Распределение: 7×XL, 10×L, 42×M, 37×S. Серийный критический путь Pilot ≈ 22 задачи; при среднем ~1.5 недели и XL ~3–4 недели один только критический путь ≈ верхняя граница 6–9 месяцев — поэтому **6–9 месяцев трактуется как верхняя граница, не медиана**, и предполагает fractional-помощь. Design и mobile-QA НЕ бесплатны: явно вынесены как fractional-строка capacity — design-система/экраны и mobile regression требуют contractor-времени (doc 12 §7 называет mobile+QA первым триггером найма); в бэклоге у них есть owner_role, но не founder-время. Рефорекаст при первом же превышении.

## 8. Kill/reshape signals

- foremen complete evidence later in office despite field design;
- readiness cannot reconcile to existing process;
- every customer needs custom code instead of configuration;
- GC systems make duplicate entry intolerable and no import/export bridge works;
- fewer than 3/10 qualified ICPs progress to paid pilot process;
- support/setup cost exceeds plausible gross margin;
- legal/security constraints remove the evidence timing advantage.

## 9. Definition of Pilot success

- named team uses weekly workflow;
- ≥80% assigned before-concealment captures receive server receipt before deadline in selected scope;
- performed/ready/risk totals reconcile line-by-line;
- one period package generated without DB/manual file edits;
- correction loop and export tested;
- no critical/high tenant/data-loss issue;
- sponsor confirms value and next commercial decision, even if answer is no.

Metrics are baselines to validate, not fabricated ROI claims.

## 10. Definition of GA success

- two customers close periods using different rule/configuration packs;
- package adapter changes do not require core deployment;
- external review and project-commercial ledger reconcile;
- subscription lifecycle/suspension/export works end-to-end;
- security/legal/accounting gates signed;
- operational SLO/restore/incident evidence current;
- support load remains within sustainable capacity.

## 11. v2.9 dependency additions

The implementation sequence inside the existing epics is binding:

1. P0-A delivers tenant identity composites, command-availability evaluator, state/audit/outbox base and staged offboarding storage before any field authorization.
2. P0-B delivers measured-only import, stable work lineage, versioned business calendar and immutable rule-preview payload.
3. P0-C delivers typed occurrence strategies/triggers, per-row atomic assignments, online accept/start and exact execution bundle.
4. P0-D delivers first-receipt disposition/quarantine and authoritative-date confirmation before offline capture can contribute to readiness.
5. P0-E delivers review correction, waiver revoke and evidence invalidation/recapture before operator undo/relink is exposed.
6. P0-F delivers close cycles, package register/lines/issues and no-effect pending reconciliation before package submission.
7. P0-G delivers audit read, cancellation fencing, offboarding rehearsal and all runtime admission evidence.
8. GA G2 delivers acceptance downstream compensation and payment fingerprint before receivables/payments are enabled.

Parallel UI work may use synthetic contracts, but no later slice may silently implement an earlier invariant locally. A task exits `not_started` only with its named test evidence; document completeness does not advance runtime status.
