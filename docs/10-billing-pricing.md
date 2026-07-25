# 10. Packaging, pricing and billing

## 1. Pricing thesis

AktFlow prices the protected workflow, not every field employee. Charging per foreman discourages evidence capture and weakens the product. Primary meter is active commercial project; organization-wide field collaborators are fair-use included.

Launch currency/prices below are hypotheses for interviews and pilots, not final commitments.

## 2. Proposed plans

Это target offers, а не разрешение release flags: Guided Pilot не получает variations/external review из `Control` до GA gates.

| Plan | Monthly, excl. VAT | Included | Best for |
|---|---:|---|---|
| Pilot | paid pilot 15,000–30,000 UAH per site for 45 days (negotiable; 0 only for a formal design-partner exception) | 1 site, guided setup, outcome baseline | qualified design partner |
| Start | 4,900 UAH | 1 active project, 5 office users, field collaborators, 50 GB | small subcontractor |
| Control | 10,900 UAH | 3 active projects, 15 office users, 200 GB, variations, external review, advanced reports, limited templates, optional API/webhooks add-on | core ICP |
| Portfolio | from 22,000 UAH | 8+ projects, templates, API/webhooks, SSO option, priority support | multi-site contractor |

Pilot P&L: концьерж-нагрузка пилота (day0 checklist → mapping/rule workshops → полевой тренинг → weekly ritual, растянуто чекпоинтами 30/60/90, doc 14 §5–6) ≈ 25–40 часов фаундера на пилот. При ставке фаундера X UAH/час цена 15–30k покрывает время лишь частично — пилот является осознанным CAC/loss-leader первой когорты, а не прибыльной единицей; цель пилота — evidence и конверсия, не маржа. Design-partner exception (0 UAH) применяется только под подписанное соглашение об артефактах и named team.

Annual prepay: target 15% discount after retention is proven. Additional active project has a transparent monthly price. Archived projects remain readable and do not count; briefly deactivating/reactivating to avoid billing is rate-limited by policy.

## 3. Entitlements

Entitlements are server-side records, not scattered plan-name conditionals. Meter examples: active projects, office seats, storage, monthly package jobs, API/webhooks, custom templates, SSO, retention and support tier.

Soft limit: warn and offer action. Hard limit: block only new consumption, never access to existing customer data. Overages require explicit opt-in or contract terms.

## 4. Billing flow v1 (Ukraine)

Pilot default: legal entity details → platform operator issues idempotent `payment_request` with immutable subscription/plan/period/basis hash → bank transfer → exact one-invoice manual reconciliation. User can download the request/history and see `очікує оплати`, `оплачено`, `прострочено`. CSV/provider reconciliation and legally configured invoice/service/tax documents remain gated until seller accounting evidence exists.

Optional local provider such as LiqPay can support card/recurring flow after merchant, fiscal, refund and subscription capabilities are verified. AktFlow never stores card PAN/CVV. Stripe is a later option only for an entity in a supported country; do not design Ukrainian launch around unsupported onboarding.

## 5. Upgrade/downgrade

Self-service plan/state mutation is GA. During Guided Pilot the same preview/consequence model is used by the founder-assisted conversion process, but no plan display name bypasses release flags.

- Upgrade preview shows new entitlement, price, VAT, effective date and payable amount.
- Manual bank-transfer upgrade may activate after payment or approved grace policy.
- Downgrade applies next cycle; screen lists impacted active projects/features.
- Data is never deleted on downgrade. Mutations can become read-only only after explicit warning and grace period.
- Cancellation revokes renewal, then enters export/retention workflow.

## 6. Trial/pilot abuse controls

Pilot is sales-qualified, one organization/legal entity, synthetic or agreed live project, named sponsor and success criteria. No endless self-serve free plan at launch. Sample/demo workspace is permanent but read-only.

## 7. Commercial contract topics

Order form should define projects/users/storage, availability/support, onboarding scope, data processing, retention/export, allowed evidence use, subcontractors, price indexation, payment term, suspension/grace, liability and termination assistance. Enterprise bespoke development is separated from core subscription.

## 8. Price validation experiments

1. Ask for last three delayed/returned amounts and process cost.
2. Present Control at 7,900 / 10,900 / 14,900 UAH across matched conversations.
3. Request a signed paid-pilot proposal, not only verbal interest.
4. Track objections: budget, authority, implementation risk, GC requirement, missing integration.
5. Kill/reshape if fewer than 3 of 10 qualified ICPs accept a paid pilot or clear purchase process.

## 9. Unit economics dashboard

Track MRR/ARR, gross margin including document/storage/support, CAC by channel, sales-cycle days, pilot-to-paid, expansion, logo and revenue churn, payback and support hours/customer. For a solo founder, support/setup time is a first-class cost.

### Per-tenant cost and breakeven (заполняется реальными числами до старта продаж)

Модель себестоимости одного тенанта (диапазоны — заглушки под замер, не факты):

| Компонент COGS/тенант/мес | Драйвер | Порядок (UAH, замерить) |
|---|---|---|
| Postgres + backups | active projects, ledger/audit rows | — |
| Object storage (originals+derivatives) | строительное фото/видео, 50–200 GB | — |
| Egress + document render/pipeline | package generation, экспорт | — |
| Email/notification | delivery volume | — |
| Monitoring/observability | fixed allocation | — |
| Support/setup (founder-часы × ставка) | concierge + текущий саппорт | — |

Breakeven: `N_breakeven = (месячная инфра-база + прожиточный минимум фаундера + fractional legal/security/mobile-QA) / (ARPA − COGS/тенант)`. При целевой ARPA (Control 10 900 UAH) и оценочном COGS/тенант эта формула даёт число платящих тенантов, покрывающих операционную устойчивость; до его вычисления решение «строить 12–18 мес» принимается вслепую. Триггер ревизии архитектуры/цены — `COGS/тенант > 30% ACV` (doc 26 §9). Числа заполняются после первого месяца реального инфраструктурного счёта.

## 10. Billing acceptance

- payment-request totals round exactly; VAT/tax assertions are blocked until V-006, then validated documents round exactly;
- webhook/manual payment is idempotent;
- billing role cannot become org owner;
- failed/late payment never silently deletes data;
- plan change audit includes before/after and actor;
- customer can reproduce every charge from meter snapshot;
- billing secrets and provider payloads are redacted from logs.
