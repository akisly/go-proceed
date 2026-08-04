# 19. Organizations, Roles and Access Control

## 1. Три плоскости организаций

### AktFlow tenant

Изолированный customer workspace. Tenant владеет данными, subscription и security settings. Пользователь может состоять в нескольких tenants, но каждый API request имеет один explicit organization context.

### Customer corporate structure

- `organization`: tenant/billing boundary;
- `legal_entity`: сторона договора и реквизиты;
- `branch`: operational grouping без отдельного tenant;
- `team/crew`: GA-forward assignment grouping only. Narrow Pilot authorizes field work through an exact versioned `work_assignment.assigned_user_id`; a contract work line never acts as an assignment, and no team aggregate is implied until its own lifecycle, API and negative tests are added;
- `project`: construction access boundary.

Pilot: один tenant + одно legal entity. GA: несколько legal entities/branches, если entitlement разрешает.

### Project counterparties

`customer`, `general_contractor`, `designer`, `technical_supervision`, `supplier`, `sub_subcontractor`, `other`.

Counterparty не получает tenant access автоматически. Его contact становится external reviewer или invited member только через отдельный grant.

## 2. Customer role presets

| Role | Scope | Назначение | Sensitive permissions |
|---|---|---|---|
| Owner | organization | ownership, subscription, export/close | transfer ownership, export all, close org |
| Org Admin | organization | users, settings, templates | invite/revoke, integrations; no ownership by default |
| Commercial Director | org/project | contracts, variations, packages, receivables | approve/submit, commercial rates |
| PTO Lead | org/project | baseline, rules, review, readiness | publish rules, overrides |
| Project Manager | project | assignment, variation, package coordination | scoped submit if granted |
| Foreman | project/location | field assignment and capture | no rates by default |
| Field Worker | assigned/location | capture-only | own drafts/corrections only |
| Internal Reviewer | project | evidence decision | cannot approve own capture under SoD |
| Estimator | project | import, quantities, package lines | rates and commercial baseline |
| Project Accountant | org/project | receivables/payments/reports | no ownership/team escalation |
| Auditor/Viewer | scoped | read/export if granted | no mutations |
| Integration Admin | organization | connections/webhooks | secrets rotate, no raw secret readback |
| Security Admin | organization | MFA, access reviews, sessions | no commercial mutation by default |

Pilot roles shown in onboarding: Owner, PTO Lead, Project Manager, Foreman, Field Worker, Internal Reviewer, Project Accountant, Viewer. Advanced roles appear after activation.

Canonical machine role for `Project Accountant` is `accountant`. The former `billing_specialist` alias is removed: it had an identical permission vector and created provisioning ambiguity. `SaaS Billing Operator` below is a separate platform audience for AktFlow seller billing and is never granted access to project evidence/commercials merely by that platform role.

## 3. External roles

External access is a resource grant, not membership:

- Package Reviewer — view/comment/return/operational accept exact package version.
- Signed Approver — same plus provider-backed signing after GA gate.
- Customer Observer — read-only exact share scope.
- Variation Reviewer — exact variation version only.
- External Accountant — receivable documents explicitly shared.
- Sub-subcontractor Contributor — must be a scoped tenant membership, not an anonymous share, if uploading evidence.

## 4. Platform roles

| Platform role | Default tenant data access | Allowed operation |
|---|---|---|
| Support Agent | none | metadata/status; request time-bound support grant |
| Implementation Specialist | none | tenant-authorized configuration session |
| SaaS Billing Operator | billing metadata only | isolated platform audience for payment-request issue, payment reconciliation and bounded entitlement override; never derives authority from tenant membership |
| Template Curator | anonymized/global templates only | publish versioned generic/country packs |
| Security Operator | security metadata/logs | incident response under case |
| Incident Commander | none until break-glass | coordinate incident and approvals |
| Platform Admin | infrastructure only | deployment/provider administration |
| Break-glass Admin | none normally | emergency scoped/time-bound access with dual approval |

Support impersonation запрещена по умолчанию. Допустим только explicit grant с tenant approver, ticket/case, reason, scope, expiry, visible banner and audit.

## 5. Scope evaluation

Effective tenant access is intersection:

`active organization membership ∩ role permissions ∩ membership permission overrides ∩ project membership ∩ location scope ∩ field assignment ∩ entity state ∩ entitlement`.

Platform billing is outside this intersection. Its bearer audience, service identity and database role are separate. An Owner, Org Admin or Accountant may view its organization's SaaS invoices and manage allowed subscription choices, but cannot issue, settle, cancel or credit an AktFlow invoice. A future tenant payment-proof upload creates a non-authoritative claim; it never writes `saas_payments`, changes invoice state or restores entitlement.

Rules:

- empty project scope means `none`, except organization-wide roles explicitly marked `all_projects`;
- deny overrides allow;
- archive/closed state removes mutations even when role allows;
- financial rate visibility is a separate permission from work-item visibility;
- export never broadens source row access;
- background jobs re-evaluate authorization snapshot and tenant ownership, not trust client identifiers;
- service role cannot be exposed to clients.

Authority dimensions (нормативная граница): полномочия ограничиваются organization/project/location scope и lifecycle-состоянием. Ограничение по сумме существует ровно в двух местах — variation `approve_internal` (guard `sod_and_value_scope`) и maker-checker порог записи/сверки платежа; для review-решений и package submit денежного лимита нет намеренно (Pilot-компенсация — SoD + recent auth + аудит). Ограничения по work type и по customer/counterparty не моделируются: Pilot работает с одним заказчиком на проект, расширение возможно только через реестр doc 37.

## 6. Segregation of duties

Project policies:

- `review_own_capture`: default deny;
- `override_and_submit_same_package`: default deny for GA, explicit pilot exception with audit;
- `record_and_reconcile_same_payment`: warning/dual approval above configured threshold;
- `change_bank_and_approve_invoice`: deny;
- `invite_role_higher_than_self`: deny;
- `support_grant_self_approve`: deny;
- `final_owner_remove`: deny.

Solo-pilot exception: один человек может совмещать PTO/PM/commercial duties, но каждый high-risk transition показывает conflict banner и сохраняет `solo_exception` reason. Исключение не переносится на enterprise default.

## 7. Authentication assurance

- email/password or magic link for normal pilot access;
- MFA mandatory for every live Pilot user; Owner, Org Admin and Security Admin additionally use recent-auth step-up for high-risk tenant commands; SaaS Billing Operator and every platform role use a separate platform identity, MFA and recent-auth step-up;
- recent authentication (≤10 minutes) for ownership, bank details, export-all, organization close, requirement waiver create/revoke, integration secret and support grant;
- recovery codes; reset invalidates previous sessions;
- session inventory and revoke-all;
- enterprise SSO/SCIM deferred, but identity is keyed by stable internal user ID, not email.

## 8. Invitations and offboarding

Invite persists role plus explicit project/location scope mode and exact scope rows, inviter, expiry and optional phone channel. `owner` is never assignable through invitation or ordinary membership update. `all_projects` and `all_locations` are explicit booleans rather than empty-list inference; a location scope must belong to an allowed project. Resend atomically revokes the prior capability before issuing a new token.

Acceptance is one transaction: validate opaque token hash/expiry/revocation/unused state, bind the authenticated subject, verify server-observed MFA, record exact terms/privacy versions, create or update only the permitted membership, copy invitation scopes, mark the invite used and emit audit/outbox events. A failure commits none of these effects. Existing membership conflicts return a visible preview/error and cannot silently elevate, narrow or widen access.

Offboarding workflow:

1. suspend immediately;
2. revoke sessions and pending invites;
3. Owner, Org Admin or Security Admin creates one persisted organization-level plan bound to membership version;
4. a resumable cursor scan enumerates assignments, review assignee and escalation ownership, evidence requests, package issues/corrections, approval responsibilities, integration operational owner, live offline leases and project scopes across every project;
5. save normalized exact-version resolutions in bounded batches: assignment replacement plus post-invalidation policy, separate reviewer/escalation replacements, request/issue owner replacement, integration transfer, lease invalidation and scope removal/block;
6. after the scan is complete, preview freezes project IDs, plan version, dependency hash and blocker/warning totals; any dependency/version drift invalidates it;
7. consume the same preview once; responsibility transfers, membership-version change, lease/session invalidation, notifications and audit commit atomically without a 500-item correctness limit;
8. preserve historical authorship and system-owned running jobs;
9. generate the access-change receipt and include it in the next access review.

Organization membership suspend/revoke and global role/scope replacement are never project-scoped powers. Only Owner, Org Admin or Security Admin may perform them. PTO/Project Manager receives a separate least-privilege command that removes one project scope they administer after its dependency plan passes; it cannot change the global role, other projects, `all_projects` membership or final owner.

## 9. Access review

Quarterly for GA and before customer audit:

- active users, role, scope, MFA, last active;
- external shares and expiries;
- support grants;
- integration credentials;
- orphaned objects/tasks;
- owner and emergency contacts.

Report does not expose hidden surveillance metrics; `last active` is security/administration data with retention and disclosure.

## 10. Database enforcement

- membership/scope tables normalized, no UUID arrays for access control;
- every exposed table has RLS and explicit grants;
- tenant-safe composite foreign keys prevent cross-organization references;
- policy helpers are `security definer` only when necessary, locked `search_path`, minimal execute grants;
- authorization negative tests cover cross-tenant, wrong project, wrong location, revoked membership, stale token, archived resource and external exact-version scope.
