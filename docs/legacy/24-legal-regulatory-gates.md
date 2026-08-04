# 24. Legal, Privacy and Regulatory Gates

## 1. Status and claims boundary

Это implementation checklist, не юридическое заключение. До external sign-off AktFlow предоставляет operational evidence organization and document drafting. Он не заявляет, что:

- internal readiness означает договорную приёмку;
- click acknowledgement является КЕП;
- фотография сама доказывает качество/объём работ;
- generic package соответствует любому договору/форме;
- хранение в AktFlow заменяет обязательный архив заказчика;
- сумма в dashboard является бухгалтерской дебиторской задолженностью без acceptance/invoice basis.

Signer authority boundary: Pilot не проверяет полномочия подписанта ни для typed evidence, ни для submission receipt — фиксируются только заявленный assurance label и актор записи; проверка полномочий/КЕП появляется исключительно за V-005 и до того не может подразумеваться ни в UI, ни в продажах. Submission receipt корректируется только append-only: новая запись с `supersedes` ссылкой на ошибочную (сама запись неизменна), опциональное вложение-доказательство отправки связывается как evidence object retention-класса `package_artifact`.

## 2. Legal pack before GA

- Master Subscription Agreement/Terms;
- Order Form and Guided Pilot Agreement;
- Data Processing Agreement;
- Privacy Notice;
- Cookie/analytics notice and consent configuration;
- Acceptable Use Policy;
- SLA and Support Policy;
- Security Appendix;
- Subprocessor List;
- Retention and Deletion Schedule;
- Incident/Breach Notification clause;
- IP/confidentiality and customer-content rights;
- termination/export assistance;
- country/customer adapter disclaimer and responsibility matrix.

## 3. Controller/processor matrix

| Data/use | Default role | Gate |
|---|---|---|
| tenant user/account/access | AktFlow controller for service administration; customer role assessed | counsel review |
| project/evidence content | customer controller; AktFlow processor | DPA/instructions |
| field worker photos/voice/location | customer controller; AktFlow processor | lawful basis, workforce notice, minimization; transcription separately gated |
| external reviewer identity/session | roles depend on review setup | privacy notice and contract |
| service security logs | AktFlow controller/legitimate security purpose | retention/minimization |
| product analytics | AktFlow role/basis assessed; pseudonymized | consent/basis decision |
| support access | processing under documented customer authorization | support grant/DPA |

No model training on customer content by default. Any future AI processor/use requires separate feature, subprocessor review, customer instruction and opt-in/contract basis.

## 4. Data inventory and privacy controls

For each field/file/event record:

- purpose and lawful basis;
- controller/processor;
- source and data subjects;
- required/optional;
- visibility;
- retention class;
- export/delete behavior;
- subprocessors/region;
- security classification.

Privacy defaults:

- GPS optional until justified;
- no continuous employee tracking;
- no face recognition or productivity scoring;
- device metadata minimized;
- push notifications hide sensitive text/value;
- analytics uses pseudonymous IDs and buckets;
- redaction derivative preserves original under controlled access;
- public links forbidden.

## 5. Data subject and customer requests

Workflow supports access, correction, deletion/restriction/objection where applicable, identity verification, tenant notification, legal-hold check, processor assistance, response evidence and deadline tracking. The product must distinguish user-profile correction from immutable business ledger history; corrections append context rather than falsify records.

## 6. Breach workflow

Detect → contain → preserve evidence → classify affected tenants/data/regions → counsel/DPO assessment → regulatory/customer notification decision → remediation → postmortem. Notification text/timeline is not hardcoded before counsel/customer contract; system stores deadline, approver and sent evidence.

## 7. Construction/document gates for Ukraine

Validation baseline includes current versions of:

- Cabinet Resolution №668 on construction contracts;
- Law №851-IV on electronic documents;
- Law №2155-VIII on electronic identification/trust services;
- Law №2297-VI on personal data;
- Law №996-XIV on accounting and financial reporting;
- current ЄДЕССБ/document exchange specifications and applicable contract/industry forms.

For each customer adapter collect:

- signed contract/addenda and document list;
- accepted and returned redacted packages;
- required participants/signers;
- source system/file format;
- mandatory fields, codes, rounding and totals;
- submission channel and receipt;
- retention and archive responsibility;
- whether artifact is draft, primary document, attachment or internal control.

## 8. Electronic signature assurance levels

Display levels explicitly:

1. `workflow comment`;
2. `operational acknowledgement`;
3. `authenticated acceptance record`;
4. `electronic signature`;
5. `qualified electronic signature`, only through validated provider flow.

КЕП gate requires provider/legal procurement, certificate chain/qualified status validation, revocation/OCSP/CRL, trusted timestamp, container/document hash binding, signer authority, multi-signer order, validation report and long-term archive strategy. Failure never downgrades silently to click acceptance.

## 9. Retention classes

Provisional classes, not final durations:

- `identity_access`: identity/invitation/session;
- `security_audit`: security/audit;
- `contract_baseline`: contract/baseline and verified estimate-import source;
- `evidence_original`, `evidence_derivative`: immutable evidence lineage;
- `package_artifact`: manifest, generated package, submission/decision attachment;
- `project_commercial`: project commercial/accounting;
- `saas_billing`: SaaS billing/tax;
- `support_incident`: support/incident;
- `analytics_minimized`: minimized analytics;
- `temporary_export`: generated export with mandatory expiry.

Each class has active retention, post-termination retention, legal-hold behavior, backup expiry and deletion verification. Exact duration is `EXTERNAL GATE`; code uses configurable policy versions, never scattered constants.

`technical/data-retention-catalog.csv` является машинным source of truth для покрытия таблиц и стратегии disposal; `technical/schema.sql` остаётся source of truth для row-level classes у файлов. Catalog coverage не означает, что длительности подтверждены: все 126 записей остаются `duration_external_gate` и ссылаются на V-003 до приложенного внешнего решения.

No object may enter durable storage without a class and integrity tuple. Upload purpose deterministically selects `contract_baseline` or `evidence_original`; a client cannot submit/override the class. Derivatives, package artifacts and exports receive server-owned classes at creation. Retention workers enumerate database references and provider inventory in both directions; an unreferenced or unclassified object is quarantined as an incident, not deleted opportunistically. Legal hold is evaluated before active-store deletion and backup expiry remains separately evidenced.

## 10. Sensitive sites and wartime context

Customer/project policy may restrict GPS, EXIF, façade/equipment imagery, exports, external shares, country/region storage and support personnel. High-sensitivity project can disable external link/download and require tenant membership/VPN/managed-device controls. Product marketing must not encourage capture that violates site/security rules.

## 11. CEE expansion

EU trade access does not normalize privacy, worker monitoring, construction acceptance, tax forms or signing workflow. Each country is a versioned country pack with local counsel/accountant/industry validation, DPA transfer assessment, locale/units/currency and two pilot customers before GA.

## 12. Sign-off record

Each external review stores reviewer organization/name/role, scope, version, issues, decisions, date, expiry/revisit trigger and artifact links. `Reviewed` without scope/version/evidence is not a gate pass.
