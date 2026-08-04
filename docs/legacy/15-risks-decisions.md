# 15. Risk register and decision log

## 1. Top risks

| Risk | Likelihood / impact | Early signal | Mitigation / decision |
|---|---|---|---|
| foremen reject data entry | high / critical | captures completed by office later | one-minute offline tasks, prefilled assignment, field usability tests |
| readiness data not trusted | medium / critical | totals reconciled in Excel | append-only ledger, explicit formulas, drilldown and golden fixtures |
| becomes custom document agency | high / high | each sale requires unique code | versioned template/config boundary; charge implementation; reuse gate |
| GC mandates another system | high / high | duplicate entry objection | portable subcontractor record, export/API; choose compatible accounts |
| local form/regulation changes | high / medium | template failures | adapter versions, official schema monitoring, contract tests |
| evidence has legal overclaim | medium / critical | sales says “guaranteed proof” | controlled claims, legal review, signature levels, provenance not truth |
| tenant/data leak | low / critical | RLS gaps/security alerts | deny-default/RLS tests, least privilege, external review |
| offline duplicate/data loss | medium / critical | quantity mismatch/outbox age | atomic outbox, idempotency, visible sync, chaos/device tests |
| file/document compute cost | medium / medium | margin/job backlog | limits, quotas, derivatives, async capacity and pricing |
| solo-founder overload | high / high | support >20%, release quality falls | narrow ICP/scope, guided pilots, runbooks, contractor trigger |
| payment willingness below support cost | medium / high | paid pilot resistance | value-based discovery, price tests, setup fee/ICP tightening |
| war/infrastructure disruption | medium / critical | outages/team displacement | offline operations, EU managed redundancy, backups, continuity plan |
| EU/CEE expansion assumptions wrong | high / medium | workflows differ despite trade access | one-country discovery and adapters, no premature rollout |
| design-partner / pilot-cohort concentration | high / high | one of ≤3 pilot partners drops (bankruptcy, war, lost contract) collapses validation | widen Stage-0 funnel beyond 3, staged commitments, no single-partner GA gate |
| site-level military / photo-prohibition | medium / critical | photo capture (product core) becomes prohibited near critical infrastructure or air-raids break the 30–60s flow | per-site capture-policy config, non-photo evidence fallback, legal check per site class |
| external gate slippage (V-003…V-011) | medium / high | GA capabilities (variations, external review, receivables, КЕП, tax docs) stay locked; product stuck on Pilot-only value | named owner + target date per V-gate (doc 30 §2), monthly gate review, Pilot-value-standalone fallback |
| UAH devaluation / FX | medium / medium | wartime inflation erodes UAH pricing vs infra COGS | price indexation clause (doc 10), periodic reprice, cost tracked vs ACV |
| founder mobilization | low / critical | solo Ukrainian founder conscription halts the business | continuity escrow/runbook (doc 26 §10), documented handover, early contractor relationships |

## 2. Foundational product decisions

### D-001: start with subcontractors, not GCs

They directly feel unsupported work and can adopt a portable record even when a GC system exists. Revisit after repeatable subcontractor adoption.

### D-002: electrical MEP first

Hidden work and evidence timing create a sharp before-concealment problem. Expand only after the rules are reusable.

### D-003: web office + native field workflow

Office complexity benefits from web; camera/offline reliability benefits from Expo app. PWA may remain demo/fallback, not primary field promise.

### D-004: managed modular monolith

Fast for solo delivery while domain boundaries preserve later extraction. No microservices before measured scaling/organizational need.

### D-005: versioned ledger and snapshots

Commercial trust requires correction lineage. Mutable “current totals” alone are insufficient.

### D-006: no AI in critical readiness MVP

Deterministic rules and human review first. AI can later suggest photo quality, mapping or classification with confidence and confirmation; it cannot silently approve money.

### D-007: invoice/bank transfer first in Ukraine

Matches B2B buying and avoids making the product dependent on unsupported/unfinished recurring-card infrastructure.

### D-008: no legal-signature claim for click approval

КЕП is a separate provider-backed capability with validation evidence.

## 3. Open decisions requiring discovery

| ID | Question | Evidence needed | Deadline |
|---|---|---|---|
| O-01 | exact first document/package export | 3 pilot customers' accepted/returned artifacts | before Stage 1 package build |
| O-02 | project vs throughput pricing | willingness-to-pay tests and support/storage cost | before paid conversion |
| O-03 | mobile gallery allowed? | fraud/privacy needs vs field reality | rule workshop |
| O-04 | location GPS mandatory anywhere? | customer/legal/safety workflows | per project template |
| O-05 | first accounting/estimate connector | paid demand and vendor interface | Stage 3 |
| O-06 | retention default | counsel + typical construction contracts | before GA |
| O-07 | provider for КЕП | legal/technical procurement | after workflow adoption |
| O-08 | first CEE country | customer corridor, language, buyer access | Stage 4 discovery |

## 4. Assumptions register

Critical assumptions to test:

- at-risk work can be detected early enough to change outcome;
- one person can configure reusable evidence rules;
- foremen have Android/iOS devices and intermittent, not permanently absent, connectivity;
- owner trusts a readiness view when it reconciles line by line;
- generated evidence index materially reduces close/rework;
- company will maintain AktFlow even if customer portal remains mandatory;
- value supports ≥10k UAH/month core price for multi-project ICP.

Each pilot review marks assumption supported, contradicted or unknown with artifact link—not founder intuition.

## 5. Scope guardrail

A proposed feature enters core only if it improves one of: capture before evidence disappears, readiness truth, review/variation resolution, package submission or payment visibility. Generic scheduling, chat, CRM, payroll, procurement and full accounting remain integrations/partners unless the market evidence changes the product thesis.
