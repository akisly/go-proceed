# 37. Functional Closure and Feature Promise Register

## 1. Purpose

This register prevents prose-only features. A capability is release-ready only when it has explicit actor/trigger/state, screen or deliberate headless surface, permission, API command/read, canonical entity, audit/event, tests, entitlement and recovery behavior.

Statuses:

- `Pilot contract` — required for the narrow live electrical/MEP Pilot;
- `GA modelled` — canonical target exists but runtime is feature-gated;
- `Deferred` — not promised; discovery/fixtures required before specification;
- `Integration-only` — AktFlow stores links/status or exchanges files but does not own the workflow;
- `No-build` — excluded before PMF.

## 2. Binding decisions

| Capability | Decision | Boundary |
|---|---|---|
| Contract terms/policies | Pilot contract | versioned reporting, cutoff, notice, payment, retention, numbering and adapter bindings; no legal inference |
| Work assignment/capture task | Pilot contract | one assignee; no team/crew aggregate |
| Requirement occurrence | Pilot contract | per assignment/location/date/batch/quantity trigger |
| Before-concealment hold point | Pilot contract | operational evidence gate, not statutory inspection claim |
| Typed certificate/test/drawing/document forms | Pilot contract | allowlisted schemas + immutable original; no automatic truth claim |
| Controlled reference revisions | Pilot contract | lightweight register/link/stale warning; no BIM/CDE authoring |
| Review task/SLA | Pilot contract | internal deterministic queue and escalation |
| Package line decision items | Pilot contract | manual external receipt in Pilot; exact-version external decision in GA |
| Quantity progress/correction/reversal | Pilot contract | append-only, source-bounded |
| Quantity transfer/accepted adjustment | GA modelled | maker-checker and ledger gates |
| Field video capture | GA modelled | camera video with configurable size limit; enabled by feature flag only after Pilot demand evidence; Pilot captures photo/file/audio |
| Return-cause learning suggestions | No-build (Pilot/GA-core) | recurring causes — только отчёты по versioned reason codes; автоматических rule-предложений нет; правила меняет администратор новой версией |
| Unified action inbox | Deferred (GA candidate) | Pilot-норма — распределённые поверхности (doc 04 §9); единый inbox только по evidence спроса |
| Per-project multi-account integrations | No-build (Pilot/GA-core) | подключения органиционного уровня (doc 08 §1); future model по спросу ≥3 ICP |
| Amount/work-type/counterparty authority limits | No-build (Pilot/GA-core) | границы полномочий = scope+state (doc 19 §5); сумма — только variation approve и payment maker-checker |
| Evidence impact query (money exposed by one evidence object) | GA modelled | канонический путь Evidence Graph (doc 39 §6); в Pilot доступен через invalidation impact receipt, отдельной операции нет |
| Variations/external review | GA modelled | exact version, notice terms, operational acknowledgement |
| Receivables/payments/cash forecast | GA modelled | deterministic contract/state forecast; not accounting or guaranteed cash |
| Location structure import | Pilot contract | CSV/XLSX preview/confirm using import job; no map/BIM extraction |
| Global identifier search | Pilot contract | scoped project/work/assignment/reference/package metadata only |
| Saved personal filters | Pilot contract | user-scoped; shared views deferred |
| Bulk assignment | Pilot contract | preview + bounded batch; no bulk evidence approval |
| Assignment/project lifecycle commands | Pilot contract | versioned reasoned transitions; no generic status patch |
| Contract lifecycle commands | Pilot contract | active contract must complete/terminate before project completion/archive; guarded reopen only before archive |
| Membership lifecycle commands | Pilot contract | nested project/location scopes plus organization-wide exact-responsibility offboarding and versioned suspend/reinstate/revoke; owner remains separate two-party flow |
| Offline authorization lease | Pilot contract | server-issued membership/assignment/policy-bound expiry; capture and upload bind exact lease; device time is non-authoritative |
| Package numbering series | Pilot contract + GA lifecycle | Pilot bootstrap creates and lists a visible default; GA creates a distinct exact-contract-version format and may retire an unreferenced series; retries and voids never reset/reuse numbers |
| Evidence invalidation | Pilot contract | append-only invalidation + dependency refresh/correction; no delete or silent retarget |
| Package decision-set reconciliation | Pilot contract | exact package version, partial pending state, server-derived totals, idempotent final receipt |
| Bulk approve | Deferred | single decision remains Pilot safe default until artifact/risk validation |
| Project setup clone | Deferred | only terminal-archive linked continuation with explicit copy preview is modelled |
| QR/NFC deep links | Deferred | add after field validation; no Pilot pricing/onboarding promise |
| Custom report builder | Deferred | Pilot presets/export only |
| Device/session list | Integration-only | identity provider account/security surface; AktFlow exposes revoke-all/recent-auth consequences only when supported |
| Full RFI/submittal/issue manager | Integration-only | external reference/link/status; no parallel GC workflow |
| Daily log/weather/manpower | No-build | use field-management product/integration |
| Timecards/payroll/safety suite | No-build | outside evidence-to-payment job |
| Procurement/inventory/Gantt/BIM authoring/accounting | No-build | outside product boundary |
| AI photo quality/acceptance decision | No-build | AI may assist classification later; human/rules remain authoritative |

## 3. Orphan prevention

CI and release review must fail when:

- a Pilot/GA mutation is absent from `ui-actions.csv`;
- a screen promises data absent from OpenAPI/entity contracts;
- a rule occurrence strategy is not representable by the published config schema;
- a package/variation/reference decision has no exact version target;
- a roadmap/pricing feature contradicts this register;
- a deferred/no-build capability appears enabled or marketed.

## 4. Expansion rule

New capability requires a real artifact or observed workflow, named release, owner, kill condition and update of PRD/screens/flows/data/API/permissions/states/events/tests/backlog/prototype coverage. Adding a table or UI card alone is not product closure.

## 5. v2.9 closure additions

| Capability | Decision | Boundary |
|---|---|---|
| Composite work/readiness/package/rule/audit reads | Pilot contract | bounded, scope-before-filter/pagination; no generic analytics query |
| Occurrence trigger engine | Pilot contract | typed once/calendar/material-batch/quantity-threshold only |
| Post-invalidation offline intake | Pilot contract | quarantine/reject at first receipt; no device-time proof |
| Canonical preview payload ownership | Pilot contract | publish consumes immutable normalized preview input |
| Staged member offboarding | Pilot contract | organization-authorized paginated plan; project scope removal is separate |
| BOQ re-import lineage | Pilot contract | measured positive rows only; availability across one stable lineage |
| Authoritative reporting date | Pilot contract | claimed date retained; guarded server authority decides period |
| Waiver/review/evidence correction | Pilot contract | append-only revoke/successor/invalidate-and-recapture |
| Period close cycles and export cancellation | Pilot contract | immutable cycle history and fenced safe-boundary cancel |
| Package decision issues | Pilot contract | one financial outcome plus many exact-target issues |
| Acceptance downstream compensation | GA modelled | successor blocked until active receivable/payment dependency is resolved |
| Payment business fingerprint | GA modelled | immutable tenant-level dedupe independent of request id |
| Numbering-series retirement | GA modelled | no reset/reuse; issued document number organization-unique |

These additions close previously promised behavior; they do not add general project management, BIM, payroll, procurement, accounting or autonomous AI decisions.
