# 33. Support and Platform Administration

## 1. Separation

Platform admin plane uses separate route/domain/auth audience and is never shipped inside tenant navigation. Platform staff roles do not become tenant memberships.

## 2. Safe metadata view

Support may see without grant:

- organization ID/display label and service status;
- plan/entitlement summary;
- regions/app versions;
- job counts/error codes/correlation IDs;
- storage/usage buckets;
- named tenant support/security contacts;
- open case and incident status.

No evidence thumbnails, filenames, work descriptions, free text, exact commercial rows, external tokens, credentials or full export.

## 3. Support grant flow

Case → requested scope/actions/duration → tenant Owner/Admin approval with recent auth → platform staff assignment/MFA → visible tenant banner → all reads/actions audited → manual revoke or automatic expiry → resolution summary. `listSupportGrants` reconstructs requested/active/history metadata for the tenant approver and isolated support audience after navigation; it grants no content access by itself and supplies the exact ID needed for revoke.

Scopes: project metadata, import troubleshooting, package job troubleshooting, configuration assistance. Export/download/evidence original/money mutation are denied unless exceptional separately approved scope exists and policy permits.

## 4. Break-glass

Only SEV1/2 containment when tenant approval is impossible and contract/policy allows. Requires two platform approvers, narrow scope/TTL, security case, real-time alert, session recording where lawful/feasible, immediate review and tenant notification assessment. Cannot erase audit.

## 5. Operational actions

- retry/cancel safe job;
- replay signed webhook after tenant authorization;
- rotate/revoke platform integration credential;
- apply signed entitlement/order/credit adjustment;
- disable compromised external share/integration;
- place legal/security hold through authorized workflow;
- provision/close pilot tenant from approved record.

No direct SQL mutation as normal support tool. Exceptional database action follows reviewed script, backup/invariant plan, dual approval and post-check.

## 6. Customer case lifecycle

`new → triaged → waiting_customer | investigating → workaround → resolved → closed` with severity, service impact, affected organization, correlation IDs, communications, owner, SLA target and resolution. Customer-provided attachments are private content with retention.

Case lifecycle живёт в support/service-desk plane платформы, а не в tenant-домене: он намеренно отсутствует в `technical/state-catalog.csv`, и единственная tenant-видимая машина этого plane — `support_grant`. Если case-состояния станут частью продуктовых контрактов (API/SLA-отчёты для клиентов), они должны быть добавлены в state-catalog по правилу doc 17 §6 до реализации.

## 7. Abuse and quality controls

- quarterly platform access review;
- immediate offboarding/session revoke;
- alerts on bulk or unusual tenant access;
- no shared accounts;
- support exports disabled by default;
- training/demo uses synthetic tenants;
- every privileged tool action has dry-run/confirmation where feasible;
- support runbooks define prohibited shortcuts.

## 8. Founder mode

Founder still uses named support/platform identities separate from customer owner test accounts. Production access requires MFA; routine debugging relies on telemetry/synthetic reproduction. Emergency credential escrow and external incident contact reduce single-person risk.
