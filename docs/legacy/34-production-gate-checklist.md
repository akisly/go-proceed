# 34. Production Gate Checklist

## 1. Purpose and status language

Это единая launch-доска, а не декларация, что продукт уже создан. Каждая строка получает один статус: `not_started`, `in_progress`, `evidence_attached`, `approved`, `waived_with_expiry`, `failed`. `Done` без ссылки на доказательство запрещён.

Категории:

- `SPEC-BLOCKER`: пакет нельзя передавать в реализацию;
- `PILOT-BLOCKER`: нельзя подключать живые данные/пользователей pilot-клиента;
- `GA-BLOCKER`: нельзя открывать самостоятельный коммерческий GA;
- `ADAPTER-BLOCKER`: нельзя обещать конкретную форму, юрисдикцию, КЕП или интеграцию.

## 2. Specification handoff — current package

| Gate | Class | Evidence | Current status |
|---|---|---|---|
| Pilot/GA scope and non-goals fixed | SPEC-BLOCKER | docs 17, 28 | approved |
| Roles, organizations, scopes and SoD specified | SPEC-BLOCKER | docs 19 + permissions.csv + data-access-surface.csv | approved — v2.9 separates Owner/Admin/Security organization revoke from project-scoped removal and uses a persisted paginated offboarding plan |
| Critical entity lifecycles specified | SPEC-BLOCKER | docs 18 + state-transitions.csv + Project/ProjectCreate contract | approved — archive is terminal; continuation is a distinct same-tenant linked project; evidence has no unspecified delete |
| Happy/error/recovery flows covered | SPEC-BLOCKER | docs 20, 29 | approved |
| Plans, meters and suspension consequences specified | SPEC-BLOCKER | docs 21 + entitlements.csv + platform billing access rows | approved — issue/settle/cancel/credit require isolated platform audience/role; tenant history is read-only |
| API conventions/errors/idempotency/jobs specified | SPEC-BLOCKER | docs 22 + OpenAPI/error catalog + `technical/openapi-redocly-report.txt` | approved — exact org/request headers, ETags, 30d/400d TTL classes, replay deadline and explicit 429; Redocly 0 errors/0 warnings |
| Every mutating action closes UI/API/permission/state/event/test and release | SPEC-BLOCKER | `ui-actions.csv` + semantic validator + `T-SPEC-SEMANTIC-001` | approved |
| Conceptual entity names and tenant roles are canonical | SPEC-BLOCKER | `entity-aliases.csv` + permission-vector check | approved |
| Every SQL table and stored object has a retention source and disposal/hold rule | SPEC-BLOCKER | `data-retention-catalog.csv` + storage tuple/FK validator | approved — durations remain V-003 |
| Offline/media protocol and conflict behavior specified | SPEC-BLOCKER | docs 23 | approved |
| Security, legal, SRE and QA gates specified | SPEC-BLOCKER | docs 24–27 | approved |
| Unknown external facts have safe defaults and owners | SPEC-BLOCKER | docs 30, 32 | approved |
| Key flows represented in interactive prototype | SPEC-BLOCKER | prototype + docs 16, 29 | evidence_attached — v2.9 React lint/build and repository smoke required on every handoff |
| Critical prototype browser smoke at desktop/mobile reference viewports | SPEC-BLOCKER | `prototype/qa-results.json` + 19 screenshots; 17 document-29 flow families | evidence_attached — v2.9 repository Chromium run passed with zero findings, including staged offboarding and offline authorization/quarantine; this is not target-browser certification |
| Full target-browser, screen-reader, zoom and physical-device matrix | PILOT-BLOCKER | CI/manual/device evidence under P0-G08 and P0-D06 | not_started |

## 3. Pilot MVP admission

| Gate | Owner before team | Required evidence | Failure consequence |
|---|---|---|---|
| signed pilot scope and data-processing roles | founder + counsel | signed order/scope/DPA or documented lawful alternative | no live customer data |
| redacted BOQ and one package adapter | product | fixture, expected totals, customer process-owner sign-off | generic demo only |
| isolated production/staging environments | engineering | environment inventory, secret/identity separation | no pilot |
| organization/project/location authorization | engineering | positive/negative RBAC+ABAC suite | no pilot |
| invitation accept/reissue/revoke | engineering/security | atomic redemption/replay/revoke/MFA evidence | no multi-user live pilot |
| bounded assignment preview/partial commit | engineering/product | mixed valid/invalid batch, response-loss replay, occurrence count and lifecycle transition report | disable bulk assignment |
| server-verifiable offline authorization lease | engineering/security | issue/replay/expiry/reassign/suspend/revoke and manipulated-device-clock traces across upload/capture boundaries | office-only limited pilot or no pilot |
| database RLS deny-default | engineering/security reviewer | cross-tenant automated report | no pilot |
| exact evidence subject integrity | engineering/security | cross-assignment/location/occurrence negative FK/API fixtures plus invalidation dependency trace | no evidence readiness claim |
| immutable quantity/money/audit ledgers | engineering | invariant/replay/idempotency test report | no pilot |
| field offline capture and media durability | engineering | physical-device offline/retry/duplicate/crash results | office-only limited pilot or no pilot |
| quarantine/type/size/upload controls | engineering | malicious/corrupt/large fixture report | disable uploads |
| internal review and deterministic readiness | product/engineering | golden-rule fixtures and explainability output | no readiness claim |
| evidence request lifecycle | product/engineering | request/cancel/expire/approved-fulfillment trace; blocker never clears on request | disable request action |
| period preflight and versioned package export | product | line-by-line reconciliation to approved fixture | no package generation |
| package decision-set reconciliation | engineering/product | resumable bounded saves, stale-item/two-editor conflicts, incomplete/no-effect, exact-version, server-derived totals, atomic correction creation and replay evidence | disable decision recording |
| identifier search, saved views and location import | engineering/security | scope-denial, field allowlist, stale-preview/cycle/orphan and personal-view isolation tests | guided setup only; disable affected surface |
| export and offboarding | engineering | scoped export, revoke, deletion/retention rehearsal | no pilot |
| organization-wide responsibility offboarding | engineering/security | multi-project assignments/reviews/corrections/approvals/integrations, stale/omitted/501+ dependency and atomic revoke trace | no member revoke in live Pilot |
| Pilot SaaS issue/settlement and safe suspension | engineering/founder | payment-request issue idempotency, immutable plan/period/basis hash, one-invoice payment idempotency, grace/suspend/restore and project-money separation | guided sandbox only |
| backup/restore and rollback | operator | timestamped restore and rollback drill | no pilot |
| observability and alert delivery | operator | synthetic failure + received alert + runbook link | no pilot |
| privacy notice, terms, subprocessors, security contact | founder + counsel | published/versioned pack | no pilot |
| named pilot support and incident contacts | founder/customer | contact sheet, severity path, hours | no pilot |
| UAT by real role participants | customer process owner | independent task results; founder demo is insufficient | extend sandbox only |

## 4. Pilot runtime controls

- One legal entity, one specialization pack, one active project and one declared close period per pilot workspace unless a signed change is approved.
- Founder-assisted import/rule configuration is allowed and logged; direct production DB edits are forbidden.
- Email auto-send, KEP, accounting posting and legally phrased acceptance are disabled by default.
- Every generated artifact carries organization/project/period, adapter/rule/data version, timestamp, hash/manifest and `draft/operational` label.
- Pilot suspension preserves read/export/support; it does not delete customer data.
- Daily queue/upload/job review during close week; weekly permission, support-hour and exception review.
- Exit review separates product defect, configuration defect, source-data defect, process gap and external dependency.

## 5. Safe standalone GA admission

| Gate | Required evidence |
|---|---|
| self-serve organization lifecycle | create/invite/recover/transfer owner/suspend/export/begin-close/cancel-before-execution/terminal-close E2E; post-close recovery is DR/import into a new organization, never in-place restore |
| MFA/recovery/session management | owner/admin/reviewer test matrix, recovery abuse tests |
| entitlement and SaaS invoice lifecycle | preview/confirm/idempotent payment/grace/suspend/restore tests and accountant approval |
| multi-project/currency/tax boundaries | explicit supported matrix and reconciliation fixtures; no cross-currency aggregate without conversion policy |
| external review hardening | OTP/expiry/revoke/rate-limit/exact-version/receipt tests and wording approval |
| customer-configurable templates | publish/migrate/rollback/impact-preview tests |
| support/admin plane | separate audience, grant TTL, banner, audit, revoke and break-glass exercise |
| retention/DSAR/legal hold | counsel-approved schedule plus export/delete/hold drills |
| dependency/vulnerability program | lockfile, SBOM, secret scan, SAST/dependency scan and remediation SLA |
| availability/recovery claims | measured SLI window, restore history and published honest status/support commitments |
| browser/device/accessibility matrix | CI + physical device results + WCAG 2.2 AA audit for critical web flows |
| abuse/capacity/cost controls | rate/size/usage limits, queue backpressure, tenant cost dashboard and load report |
| analytics/privacy | schema validation, consent/lawful-basis decision, retention and no-content telemetry review |
| commercial/legal pack | seller/accountant/counsel sign-off; plan version and tax consequences visible before purchase |
| operational independence | credential escrow, domain/cloud/billing recovery and at least one external incident contact |
| independent security review | no open critical/high tenant-isolation, authz, data-loss or secret exposure finding |

## 6. Adapter release gate

Country/customer adapter version may move `draft → validating → approved → published` (lifecycle per `docs/32-customer-country-adapters.md`) only with:

1. source artifacts and authority recorded;
2. field/calculation/rounding semantics reviewed;
3. expected/returned examples represented as golden fixtures;
4. version impact and migration/rollback previewed;
5. labels/claims approved by process owner and, where applicable, counsel/accountant;
6. scope and effective date explicit;
7. kill switch and prior-version reproducibility tested.

Unverified adapter may be used only in sandbox and must watermark output `UNVERIFIED / NOT FOR SUBMISSION`.

## 7. Release evidence bundle

Each candidate release stores immutable links or checksums for:

- commit/build/container/SBOM and configuration versions;
- migrations up/down/forward result and database compatibility;
- unit/contract/integration/E2E/RLS/offline/accessibility/performance results;
- screenshots for critical desktop/mobile states;
- vulnerability and secret-scan reports;
- backup restore and deploy rollback result;
- adapter/rule/golden-fixture reconciliation;
- known defects, risk acceptances, waivers with owner/expiry;
- approver, rollout percentage, monitoring window and abort threshold.

## 8. Production change decision

Release is allowed only if every applicable blocker is `approved` or `waived_with_expiry`, with no critical/high isolation, authorization, data-loss, duplicate-money/quantity, corrupt-package or secret exposure finding. A waiver cannot legalize an unknown claim, bypass tenant isolation, waive unrecoverable data loss or hide a failed restore.

## 9. Immediate next implementation slice

1. Convert `schema.sql` into ordered migrations with tests and seeded synthetic tenant fixtures.
2. Implement identity, organization, invitation redemption/reissue/revoke, memberships/scopes and deny-default RLS first.
3. Implement import + exceptional single-work command → canonical BOQ → quantity ledger → rule evaluation without media.
4. Add durable upload/offline outbox, evidence requests, internal review and Pilot notifications.
5. Add readiness dashboard, period preflight/guarded reopen and one generic export adapter.
6. Rehearse provisioning, Pilot SaaS payment-request issue/settlement/suspension, export, closure cancellation, restore and offboarding on synthetic data.
7. Only then admit the first redacted design-partner fixture and close V-001/V-002 evidence gates.
