# 21. Plans, Entitlements and Billing Lifecycle

## 1. Separation rule

This document covers AktFlow subscription money only. Project acts, invoices, retention and customer payments belong to Project Commercials and `/app/payments`.

## 2. Commercial offers

Prices remain validation hypotheses. Capability boundaries are production rules.

| Offer | Purpose | Runtime boundary |
|---|---|---|
| Guided Pilot | qualified design partner | one live project, named sponsor, 45-day default, guided configuration |
| Start | small contractor | one active project, core evidence/close, limited office seats/storage |
| Control | core ICP | three projects, variations, external review, advanced reports, limited custom templates, optional API/webhooks add-on |
| Portfolio | multi-project/enterprise | pooled projects, API/webhooks, templates, SSO option, priority support |

No permanent free production plan. Demo workspace is synthetic/read-only and does not share tenant data.

The narrow Guided Pilot entitlement never enables variations or secure external review, even when the negotiated conversion offer is Control. Those capabilities become available only with their GA release flags and gates; a plan name cannot bypass release maturity.

## 3. Entitlement model

Effective entitlement derives from:

`plan_version.entitlements + time_bound entitlement_overrides - suspension_restrictions`.

Canonical entities in this release:

- immutable `plan_versions` including validated feature keys/limits;
- one `subscriptions` record per organization, including `pilot` state;
- authorized, audited and time-bound `entitlement_overrides` for Pilot and exceptional commercial terms;
- immutable GA billing-period `usage_snapshots`;
- `saas_invoices` with immutable subscription/plan/period/basis snapshot, one-invoice `saas_payments` for Pilot and append-only `saas_invoice_adjustments` for GA cancel/credit.

There is no second Pilot entitlement authority. Guided Pilot is an immutable Pilot plan version plus a bounded override/order reference, so invoice FKs, grace/suspension and export consequences use the same authority as GA. Normalized feature/add-on/invoice-line/payment-allocation entities remain explicitly deferred in `entity-aliases.csv`; their absence cannot be hidden behind prose.

Never branch application logic on display name `Control`. Code asks entitlement service for feature/limit and records decision reason/version.

## 4. Meter definitions

| Meter | Counting rule | Soft/hard behavior |
|---|---|---|
| active_project | project active for any instant in billing day; anti-flap window documented | warn; block activation of next project |
| office_seat | active membership in office role | warn; block next office invite/activation |
| storage | originals + retained derivatives; quarantined counts until deletion policy | warn; block new uploads after grace, preserve reads |
| package_job | successful generation; failed provider/system jobs not billed | warn/overage opt-in |
| api_call | authenticated accepted request by billing window; 4xx policy documented | rate limit/contract overage |
| webhook_endpoint | active destination | block new endpoint |
| custom_template | published customer template version | block publish, allow existing use |

Field Worker seats are fair-use included during Pilot/Start/Control to avoid discouraging capture. Abuse threshold triggers review, not surprise charge.

## 5. Subscription dates and price

- billing timezone stored on subscription; UTC timestamps remain canonical;
- monthly anchor handles short months by documented last-day rule;
- annual prepay uses explicit start/end and renewal price;
- prices stored in minor units with currency and VAT treatment;
- plan version and order form snapshot make every charge reproducible;
- price change creates future plan version; no silent mutation;
- proration policy displayed before confirmation;
- platform-only `issueSaasInvoice` creates/returns one idempotent positive-value `payment_request`, derives plan version from the expected subscription version and freezes reference, optional order reference, reason, period and basis hash before issue. The command requires the isolated `platform_billing` bearer audience and `aktflow_platform_billing` database role; tenant Owner/Admin/Accountant roles never satisfy it;
- entitlement activation/restore uses reconciled payment or an authorized bounded override/grace decision.
- Pilot bank settlement is platform-only `recordSaasPayment(invoice_id, amount, date, source_fingerprint)`; duplicate fingerprint replays the same receipt, wrong currency/reference is blocked, and project-payment records are never consulted. It is not a tenant-facing “mark paid” action. A future tenant payment-proof submission remains a pending claim until the isolated platform operator reconciles it; only the reconciled command may emit entitlement restore.
- GA `transitionSaasInvoice` is also platform-only and append-only. Tenant subscription permission covers preview/request/cancel/reactivate of the subscription under contract rules, never invoice issue, settlement, cancel or credit accounting actions.

## 6. Lifecycle behaviors

### Upgrade

Preview: old/new plan, limits, effective date, VAT, prorated amount, payment method and non-refundable terms. Immediate activation only after configured payment/credit rule. Request is idempotent.

### Downgrade

Effective next cycle. Preview lists over-limit projects/seats/storage/features. Existing data remains readable; customer chooses which projects stay active. No automatic destructive choice.

### Failed/late payment

`due → grace → suspended`. Notifications to owner/billing contacts. During suspension: read, export, pay, cancel, organization close and support remain; capture/upload/new generation are blocked according to contract. No automatic data deletion; deletion happens only through the customer-initiated close/retention workflow.

### Cancellation/close

Stop renewal → active until period end unless contract says otherwise → export-only window → organization close/retention workflow. Reactivation available during defined window. Cancellation is never payment-gated: it is available from `pilot`, `trialing`, `active`, `grace` and `suspended`, so a non-paying customer can always reach export and closure.

## 7. Pilot contract controls

Pilot record includes:

- sponsor and implementation contacts;
- project and allowed users/storage;
- start/end;
- success metrics;
- live vs synthetic data authorization;
- support hours/channels;
- artifact/customer-adapter limitation;
- data processing/retention/export;
- price/conversion offer (paid pilot 15,000–30,000 UAH/site per doc 10; 0 only under a signed design-partner exception);
- termination and deletion process.

Expiration never locks the customer out without prior notices and export path.

## 8. Ukraine invoicing safe default

Before legal/accounting validation:

- business entity details collected separately from user profile;
- `payment_request` is generated as a commercial request for bank transfer and never labelled a validated tax/primary document;
- Pilot payment is matched manually to exactly one request using a unique bank-source fingerprint; CSV/provider matching is GA-forward and still requires explicit confirmation;
- tax invoice/service act fields are adapter/configuration and remain disabled until seller accountant confirms them;
- no claim of fiscal compliance by UI;
- card PAN/CVV never enters AktFlow systems.

`EXTERNAL GATE`: seller entity, VAT status, primary document wording, refund/credit rules and electronic delivery must be signed off by accountant/counsel.

## 9. Admin adjustments

Billing operator may create only reasoned, time-bound grants/credits. Every adjustment stores before/after, reason code, ticket/order, actor and approver above threshold. Raw provider payload and bank details are redacted in logs.

## 10. Acceptance criteria

- a charge is reproducible from order/plan/usage snapshots;
- retries cannot create duplicate payment request/payment/allocation and cannot change a stored basis hash;
- downgrade and failed payment never delete data;
- suspended tenant can authenticate, pay, export and contact support;
- UI, API and worker use the same entitlement decision;
- project-commercial money cannot activate SaaS subscription;
- cross-currency charge is forbidden unless subscription explicitly supports it;
- owner sees plan version, renewal date, tax treatment and next consequence before confirmation.
