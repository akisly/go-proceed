# 09. Security, privacy and compliance plan

This is a product/security plan, not legal advice. Ukrainian and target-country counsel must validate retention, signatures, labor privacy, international transfers and contractual evidence status before production commitments.

## 1. Security objectives

1. A tenant cannot read or mutate another tenant's commercial/evidence data.
2. No user can approve, submit or change financial state outside role/scope.
3. Submitted packages and evidence retain verifiable provenance and version lineage.
4. Offline/mobile loss exposes the minimum possible scoped data.
5. Customer can export and eventually delete data under a controlled process.

## 2. Threat model highlights

| Threat | Primary controls |
|---|---|
| broken tenant isolation | org-scoped schema, RLS, server authz, cross-tenant tests |
| stolen share link | hashed tokens, short expiry, OTP option, rate limit, revocation |
| forged/altered evidence | immutable original, hash, lineage, audit; no claim of absolute truth |
| lost field phone | OS secure storage, short tokens, scoped cache, remote session revoke |
| malicious file | quarantine, type validation, malware scan, safe renderer |
| duplicate offline submit | operation ID/idempotency, quantity ledger constraints |
| privilege escalation | deny-default matrix, recent auth, MFA, audit and access reviews |
| insider/support access | no default impersonation, time-bound grant, customer-visible audit |
| dependency/supply-chain attack | lockfiles, provenance, scans, minimal CI permissions |
| document job abuse | size/page limits, queue quota, sandboxed rendering, timeouts |
| public lead spam/enumeration/PII leakage | uniform receipt, WAF/rate/bot controls, strict size/schema, consent versions, operational-store isolation, analytics/log minimization |

## 3. Authentication

- email/password and secure invite in MVP; magic link optional;
- password policy favors length and breach checks, not arbitrary rotation;
- MFA mandatory for every live Pilot user; privileged commands require recent-auth step-up; recovery codes/factors are protected and cannot be bypassed by support;
- re-authentication for ownership, billing destination, export-all and destructive changes;
- OAuth/SSO later for enterprise; domain discovery must not leak membership;
- sessions list and revoke; security notification on high-risk change.

Authorization uses database membership, never editable user metadata. JWT claims may cache non-sensitive hints but database/server remains authoritative.

## 4. Application and database security

- parameterized queries and schema validation;
- RLS on exposed tables and explicit grants;
- separate migration, application, worker and read-only analytics roles;
- no service-role secret in browser, app bundle, logs or crash payloads;
- security-definer functions minimized, fixed search path and reviewed;
- secure views use invoker semantics;
- anti-CSRF for cookies, CSP, secure headers, origin validation;
- audit events cannot be updated/deleted by ANY runtime role: `REVOKE UPDATE/DELETE` от app/worker/external/support + INSERT-only security-definer функция; tamper-evidence через per-partition hash-chain и off-box WORM sink детектирует правку даже через service_role/DBA (doc 25 §8);
- integration secrets stored under envelope encryption (KEK в managed KMS → per-secret DEK, `key_id`+`wrapped_dek`); ключ ротируется независимо от значения секрета (doc 07 §7).

## 5. Mobile/offline security

- tokens in OS secure storage, not AsyncStorage;
- SQLite database protection using platform capabilities and minimized cache;
- local evidence drafts scoped to assigned projects and auto-expire per policy;
- app switcher hides sensitive views where feasible;
- rooted/jailbroken device warning/risk policy, not a brittle sole control;
- photos/audio are stored inside app flow unless explicit user action/policy permits gallery/file import; microphone permission is requested only at capture;
- sign-out removes tokens immediately and schedules local encrypted-data purge.

## 6. Privacy

Data inventory classifies identity/contact, employment/project assignment, device/network, location, media, commercial data and audit. Each category has purpose, legal basis, retention, recipients and export/deletion behavior.

Key minimization decisions:

- geolocation is project/rule controlled and not continuous tracking;
- no facial recognition;
- photo EXIF and audio metadata are parsed selectively and policy documented; Pilot performs no external speech transcription;
- product analytics excludes document content, customer names and precise financial line text;
- sales/demo uses synthetic or redacted records;
- marketing consent is separate and revocable.

Privacy notice and DPA identify controller/processor roles per deployment and subprocessors. Cross-border/data-residency obligations are assessed before country launch.

## 7. Evidence, signatures and legal semantics

AktFlow can prove system records such as hash, timestamp, actor/session and decision lineage; it cannot guarantee that a photo depicts the claimed reality. Product copy must avoid claims like “legally indisputable proof”.

Three levels remain explicit:

1. internal approval;
2. external click/OTP acknowledgement;
3. qualified electronic signature through an approved provider.

Only level 3 may be represented as КЕП after successful validation.

## 8. Operational security

- owners for vulnerability, incident, backup and vendor risk;
- dependency and secret scans every PR; high severity blocks release;
- production admin access is named, MFA-protected, least privilege and logged;
- quarterly access review during paid phase;
- annual penetration test before enterprise/high-value claims;
- coordinated vulnerability disclosure address and triage SLA;
- vendor/subprocessor register with exit plan.

## 9. Backups and continuity

- managed PITR when paid production begins;
- encrypted object versioning/lifecycle;
- monthly restore exercise in early production, then quarterly after stable automation;
- restore checks tenant isolation, DB/object consistency and document hashes;
- incident runbooks for auth compromise, tenant leak, storage exposure, destructive migration and provider outage;
- status communication templates and customer notification decision tree.

Backup existing is not success; only a verified restore counts.

## 10. Secure development lifecycle

For each feature:

1. data classification and abuse case;
2. permission change and RLS test;
3. input/file limits;
4. audit and redaction;
5. unit/integration/E2E/security test;
6. migration and rollback;
7. observability and incident owner.

Required CI: lint/typecheck, unit, migration smoke, RLS tenant tests, API schema diff, dependency/secret scan, build, critical E2E.

## 11. Pre-GA security gate

- threat model reviewed;
- all exposed tables have RLS and explicit grants;
- cross-tenant and role matrix automated;
- MFA/recovery/session revoke works;
- file pipeline quarantines and rejects malicious/oversized payloads;
- backup restore demonstrated;
- security/privacy documents and subprocessors published;
- incident contacts and response drill complete;
- export/closure tested;
- external review links expire/revoke and do not leak metadata.

## 12. v2.9 temporal and offboarding controls

- A signed offline lease proves bounded authority, not the time unseen bytes were created. Only server receipt/seal establishes trusted chronology.
- A first server receipt after membership, assignment, project, contract, organization or subscription invalidation is quarantined or rejected. Ordinary reviewer approval cannot override that disposition.
- Security exception resolution requires an independently authorized Security Admin, structured evidence/reason and an append-only receipt; it does not rewrite client timestamps.
- Lease, capture and upload identities use composite same-organization subject constraints plus transactional actor assertions.
- Organization-wide member revoke is restricted to Owner/Admin/Security Admin, uses a complete persisted dependency plan and invalidates sessions/leases atomically. Project/PTO managers have only scoped removal.
- Offboarding dependency pagination is completeness-preserving: no limit, omitted row or stale cursor can be interpreted as “no responsibility”.
- Audit reads are scope-filtered and redact secrets/tokens; export cancellation deletes partial artifacts at a fenced boundary and records what was removed.

Device attestation and a tamper-resistant monotonic local event chain may be evaluated for GA, but neither is marketed as absolute proof of capture time.
