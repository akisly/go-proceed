# 36. Security Verification Profile

Версия: 1.0 — normative target, not a compliance claim  
Дата фиксации: 22.07.2026

## 1. Standards baseline

- Web/BFF/API/worker/support: OWASP ASVS **v5.0.0 stable**. Requirement references always include the version prefix, e.g. `v5.0.0-8.4.1`; the rolling/bleeding-edge release is not a production baseline.
- Native field app: OWASP MASVS **v2.1.0**, verified with applicable OWASP MASTG **v2.0.0** atomic tests and profiles for Android/iOS.
- Web accessibility remains WCAG 2.2 AA; it is a separate quality/security-adjacent gate, not an ASVS substitute.

Machine profiles: `technical/asvs-profile.csv` and `technical/mobile-security-profile.csv`.

## 2. Release targets

### Live Pilot

All applicable ASVS 5.0.0 Level 1 requirements plus every Pilot-selected Level 2 row in the profile are mandatory. The selected L2 set explicitly includes multi-tenant isolation, field/property authorization, upload/download controls, MFA, identity assertion validation, data classification and security logging. All applicable MASVS controls for enabled mobile functions are mandatory.

Secure external review is disabled in Pilot; its synthetic prototype is not release evidence. Live Pilot customer data is prohibited until the Pilot security profile has evidence. MFA is required for all live Pilot users; recent authentication is additionally required for owner/admin/export/close/waiver/security-sensitive commands.

### Safe GA

All applicable ASVS 5.0.0 Level 1 and Level 2 requirements are mandatory across web, API, worker, external review and support plane. Mobile uses the applicable MASTG profiles selected from its threat model. An independent application-security reviewer must sample evidence and retest remediation. GA is blocked by any open critical/high finding involving tenancy, authorization, authentication, secret exposure, code execution, evidence/ledger integrity or unrecoverable loss.

ASVS/MASVS are verification baselines, not certificates and not legal/privacy opinions. A passing internal checklist does not close V-003/V-005 or replace an independent review.

## 3. Applicability workflow

1. Import the pinned upstream stable checklist for the release.
2. Mark every requirement `applicable`, `not_applicable` or `deferred_by_disabled_feature`.
3. `not_applicable` requires threat-model rationale, reviewer and date; “not implemented” is never N/A.
4. Link design/control, code/config, executable test and timestamped release evidence.
5. Re-evaluate when a new endpoint, provider, role, file type, country adapter, mobile permission or data class is enabled.
6. Independent reviewer samples both positive evidence and negative/abuse behavior.

Allowed evidence statuses: `not_started`, `implemented_unverified`, `automated_evidence`, `manual_evidence`, `independently_verified`, `failed`, `not_applicable_approved`. This package currently records design only; its profile rows deliberately say `specified_no_runtime_evidence`.

## 4. No-waiver controls

Release owner cannot waive:

- cross-tenant/project/location access or effect;
- authentication/MFA bypass for live data;
- service/runtime use of a bypass-RLS credential;
- public/unscanned customer file exposure;
- remote code/command/query injection;
- production secret/token exposure;
- duplicate/corrupt money, quantity or immutable package provenance;
- failed restore causing unexplained loss;
- critical/high finding in an enabled surface.

Other low/medium exceptions require impact, compensating control, owner, expiry, affected tenants/features, monitoring and rollback. Expired exception blocks release automatically.

## 5. Verification ownership

Founder/engineer may implement and gather evidence but cannot independently close the GA review. Pilot may use a fractional independent reviewer for tenant/Auth/file/storage boundaries before live admission. Privacy counsel/accountant/process owner gates remain separate. The same person may not both approve a high-risk support break-glass event and close its retrospective review.

## 6. Required evidence bundle

- pinned upstream versions and applicability export;
- threat model and data-flow revision;
- effective Supabase schemas/grants/RLS/roles report;
- API/error/authorization/tenant/file abuse reports;
- mobile static/dynamic/physical-device results;
- SBOM, dependency/secret/SAST scans and remediation SLA;
- structured log/redaction/alert evidence;
- restore/rollback evidence;
- finding register, severity rationale, owner, fix and retest;
- independent reviewer identity, scope, limitations and signature.

## 7. Authoritative sources

- ASVS stable project/release: <https://github.com/OWASP/ASVS/tree/v5.0.0_release/5.0>
- ASVS project page: <https://owasp.org/www-project-application-security-verification-standard/>
- MASVS 2.1.0 release: <https://mas.owasp.org/news/2024/01/18/masvs-v210-release--masvs-privacy/>
- MASTG 2.0.0 release: <https://mas.owasp.org/news/2026/07/04/mastg-v200-release/>

Upstream standards are linked, not copied into this package. Their licenses/wording remain authoritative; the AktFlow CSV records applicability and evidence mapping only.
