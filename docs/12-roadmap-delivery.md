# 12. Roadmap, iterations and delivery plan

## 1. Product stages

### Stage 0 — Problem validation (weeks 1–4)

- 15–20 interviews using last-period artifacts;
- collect redacted estimate, returned package, evidence sets and acceptance rules;
- clickable prototype tests with owner, PTO, foreman, billing;
- three design partners sign pilot criteria/data terms;
- manual concierge readiness audit proves value without full build.

Gate: ≥3 companies provide artifacts and commit named team/project; at least one agrees to pay or signs conditional paid pilot.

### Stage 1 — Synthetic evidence-ready alpha (months 2–4)

Build identity/RLS, project/import, rules, field offline capture, quantity ledger, internal review, readiness dashboard, basic period package, audit/export and isolated platform manual billing. One specialization: electrical works. One generic document/export pack. Evidence is synthetic or redacted; no live customer admission is implied.

Gate: founder dogfood plus design-partner sandbox completes weekly workflow; no known tenant/security blocker; package-ready amount reconciles to approved synthetic/redacted fixtures.

### Stage 2 — Safe first live Pilot (months 5–9)

Close every applicable Pilot blocker: ordered migrations, deny-default RLS, exact invitation/access flows, physical-device offline/media tests, one verified customer adapter, internal review/readiness, manual submission receipt, export/offboarding, platform billing separation, observability, backup/restore/rollback, legal/privacy/support pack and independent role-based UAT. Variations, secure external review and project receivables remain GA-forward and disabled.

Gate: one customer safely completes a close with no critical/high isolation, authorization, data-loss, duplicate-ledger or corrupt-package finding. A second live tenant is admitted only after incident/restore review; two differing configurations and a repeatable paid process are required before GA.

### Stage 3 — Safe standalone GA (months 10–18+)

Self-serve organization lifecycle, hardened billing/commercial documents, variations, secure external review, receivables/partial payments, customer templates, support/admin plane, retention/DSAR/legal-hold drills, dependency program, independent security review, accessibility/browser/device matrix, capacity/cost controls and operational independence. Only then add HVAC/plumbing packs, API/webhooks, storage/accounting exports and repeatable customer-success playbook.

### Stage 4 — CEE discovery (after Ukrainian GA evidence, earliest month 18)

Choose one country by existing customer corridor. Research local acceptance/signature/tax/data practices, build adapter and run 2–3 local pilots. No simultaneous multi-country launch.

## 2. MVP release slices

| Slice | User outcome | Demonstrable end state |
|---|---|---|
| A | safe workspace | owner invites scoped team; isolation test passes |
| B | commercial baseline | PTO imports and validates contract/work items |
| C | field proof | foreman captures offline and server confirms once |
| D | trusted review | PTO returns/approves with immutable history |
| E | money visibility | owner sees reproducible performed/ready/risk |
| F | close package | billing generates versioned evidence package |
| G | operate safely | export, audit, backup restore, support/admin runbook |

Each slice is releasable behind feature flag and includes telemetry, migration, permissions and failure states.

## 3. Solo-founder capacity assumptions

One developer can sustainably own one web app, one narrow mobile workflow and one worker if scope is disciplined. Budget weekly capacity roughly: 55% product build, 20% testing/operations, 15% customer discovery/onboarding, 10% support/admin. Do not promise 24/7 SLA or custom integrations during MVP.

Use fractional legal/security/design review at gates where an error is expensive. This does not invalidate solo-product ownership.

## 4. Release process

Trunk-based short branches, PR checklist even solo, automated preview, production feature flags. Weekly pilot release window; hotfix process separate. Release note states user impact, migration, flag, monitoring and rollback. Database breaking changes use expand/migrate/contract.

## 5. Definition of done

Feature is done when: outcome acceptance passes; roles/RLS/offline/errors handled; analytics/audit present; accessibility reviewed; docs/support copy updated; migration/rollback and observability exist; pilot user validates with representative data.

## 6. Backlog priority model

Score `(pain frequency × financial impact × strategic wedge × evidence confidence) / (build + support + compliance cost)`. Founder may override only with written reason. Loud customer requests outside evidence-to-payment are parked unless three ICPs validate them or contract economics fund a reusable capability.

Ранжированный cut-list Pilot-удобств (режем первым, если не сокращают time-to-submission/amount-under-risk): 1) saved personal filters; 2) dashboard export; 3) глобальный identifier search; 4) bulk assignment preview-экстры (остаётся одиночная выдача). Ядро evidence→submission под cut не попадает.

## 7. Resourcing trigger

Hire/contract when one constraint is proven:

- mobile/QA slows committed paid pilots;
- support >20% founder time for four weeks;
- security/ops commitments require independent ownership;
- repeatable sales pipeline exceeds founder delivery capacity.

First likely help: senior product/QA contractor for regression and mobile; then customer implementation. Do not hire a broad sales team before repeatable activation.

## 8. Expansion decision gates

Add specialization after ≥5 retained customers and a reusable rule/template pack. Add country after local buyer, legal workflow and channel validated. Add enterprise deployment after annual contract covers dedicated infrastructure/ops. Add AI only where measured correction time drops without weakening trust.
