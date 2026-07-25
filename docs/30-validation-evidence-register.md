# 30. Assumption and External Validation Register

## 1. Rule

Unknown customer/legal/accounting facts are stored as testable assumptions. Each has safe default, evidence request, owner, decision deadline and configuration impact. A founder opinion cannot change status to `validated`.

## 2. Critical external gates

| ID | Unknown | Safe default now | Evidence to collect | Gate | Owner | Target |
|---|---|---|---|---|---|---|
| V-001 | first customer document pack | generic evidence index/readiness/quantity export | 3 accepted + returned redacted sets | customer adapter | founder/product | before Stage 1 package build |
| V-002 | exact acceptance semantics | internal ready and operational receipt only | contract + authorized reviewer interview | external acceptance claim | founder + counsel | before external acceptance claim |
| V-003 | retention durations | configurable classes; no premature purge | counsel/accountant/customer schedule | GA retention | counsel/accountant | before GA retention |
| V-004 | GPS/gallery rule | optional GPS; labelled gallery allowed | site/privacy/security workshop | strict capture policy | security/founder | before strict capture policy |
| V-005 | KEP provider/flow | disabled | counsel + provider PoC + signer authority | KEP | counsel + provider | before KEP (GA) |
| V-006 | seller VAT/docs | generic bank invoice status | seller accountant/counsel | production SaaS docs | seller accountant | before production SaaS docs |
| V-007 | price/meter | Pilot negotiated; published prices hypotheses | 10 matched tests + paid process | public pricing | founder/product | before public pricing |
| V-008 | first CEE country | Ukraine only | corridor, local counsel, 2 pilots | country launch | founder + local counsel | before CEE launch |
| V-009 | field device constraints | current supported iOS/Android assumption | 5+ physical device/user tests | supported matrix | product/QA | before live field Pilot |
| V-010 | GC duplicate-entry tolerance | export/manual bridge | buyer/user interviews + actual workflow | integration priority | founder/product | before integration priority |
| V-011 | integration/vendor privacy and security terms | provider-backed connection disabled; signed first-party webhook only after technical review | DPA, subprocessors, residency, security review and sandbox PoC | GA vendor integration | security + counsel | before GA vendor integration |
| V-012 | cross-tenant support authority and workforce policy | metadata-only support; customer content access disabled | counsel/HR policy, worker terms, tenant approval wording and incident exercise | GA support content access | counsel/HR | before GA support content access |

## 3. Artifact request checklist

Ask qualified design partner for redacted:

- contract/BOQ export;
- previous period act/package;
- returned/rejected package and comments;
- hidden-work/evidence requirements;
- variation notice/approval;
- submission receipt/channel;
- invoice/retention/payment example;
- role/signature matrix;
- site camera/GPS/data policies;
- systems/formats currently used.

Offer secure upload, deletion date and purpose limitation. Do not request unredacted personal/security-sensitive content when fields/schema are enough.

## 4. Interview evidence standard

Record role/company-size/project type/date, last concrete period, artifact observed, current steps/time/errors, value/delay range bucket, buying authority/process, contradictions and consent. Separate fact, quote summary and founder inference. No fabricated quote.

## 5. Configuration response

Validated findings change versioned configuration where possible:

- customer package adapter;
- rule pack/applicability;
- review assurance policy;
- retention policy;
- capture policy;
- country/localization pack;
- entitlement/offer.

Core code changes only when finding is shared invariant or safe extension boundary cannot represent it.

## 6. Decision record

Every closed gate stores:

- assumption ID;
- evidence links/versions;
- participants and authority;
- decision and alternatives;
- implementation/config versions;
- approval/sign-off;
- expiry/revisit trigger;
- impacted tests/docs/customers.

## 7. Current status

As of 23.07.2026 all V-001–V-012 remain `unvalidated` unless a future artifact is attached. Internal v2.9 evidence—semantic package validation, SHA-bound PostgreSQL parsing, Redocly lint and prototype smoke—may close only specification gates; it cannot close any V-gate. Customer-specific/legal/price/vendor/support claims therefore remain disabled or qualified.
