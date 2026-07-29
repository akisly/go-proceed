# Version roadmap

**Status:** Approved

**Applies to:** all

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md)

## Roadmap policy

Versions close sequentially through evidence and acceptance criteria. Dates may
be used for planning and review but are not fixed scope promises. A later
version does not begin by silently borrowing unfinished authority or invariants
from an earlier version.

For each gate, evidence means a reproducible artifact such as a passing test,
migration verification, security review, working vertical scenario, documented
pilot outcome, restore exercise, or explicit user approval.

## v0.0 — Canonical and safe foundation

### Outcome

One authoritative GoProceed package describes actual runtime separately from
the approved v0.1 target, and the existing tenant foundation is safe to extend.

### Exit gates

- canonical documentation, ADRs, source inventory, and legacy dispositions
  pass automated validation;
- local dependency installation has an explicit allow/deny build-script policy;
- local database startup and one root test command are reproducible;
- all baseline tests pass or a time-bounded quarantine for a non-security test
  identifies its owner, reason, expiry, and removal condition;
- tenant-isolation, authorization, migration-integrity, immutable-history,
  backup/restore, and external-decision security tests cannot be quarantined;
- audit, idempotency, and outbox data are tenant-isolated;
- first-owner bootstrap is serialized;
- own-party creation is permission-aware;
- audit is append-only and idempotency expiry is enforced;
- outbox has real delivery claim, retry, backoff, error, and dead-letter paths;
- seed credentials are environment-safe;
- additive migration, compatibility, rollback, and live-catalog verification
  plans are approved.

## v0.1 — Contract to acceptance and value at risk

v0.1 is one product outcome delivered through six vertical milestones. A
milestone closes only with tenant-isolation tests and a working scenario through
the UI/API/database boundary.

Discovery runs alongside delivery and precedes each irreversible schema or UX
freeze. M6 is the integrated live pilot, not the first point at which the team
sees customer artifacts or external-review behavior.

Before any real pilot data enters GoProceed, the privacy notice, versioned
external confirmation text, retention policy, manual closure/deletion
procedure, workspace export, telemetry restrictions, link-assurance
explanation, and backup/restore exercise must already be complete.

### v0.1-M1 — Parties, contracts, versions, and import

**Outcome:** a workspace with several own legal entities can publish a clean,
traceable contract baseline.

**Entry evidence:**

- at least one representative sanitized estimate/contract artifact;
- recorded import walkthrough with the person who prepares or checks that
  artifact;
- unresolved column, unit, number-format, and versioning questions listed before
  the import schema is frozen.

**Exit gates:**

- tenant-local parties and stricter own legal profiles work end to end;
- one project holds contracts for different own parties;
- every contract pins own/customer parties, currency, tax, terms, and approval
  policy;
- XLSX/CSV import preserves file/parser/mapping/row provenance;
- unsafe formula, macro, archive, and resource-exhaustion cases are rejected;
- published versions are immutable and reimport produces diff and lineage.

### v0.1-M2 — Assignments, progress, and online evidence

**Outcome:** field work can be recorded and proven online without losing an
original during a network interruption.

**Entry evidence:**

- observed field-device walkthrough covering camera/file selection, weak
  connection, interruption, retry, and ordinary app restart;
- actual pilot-device inventory confirms the iOS 16.4+ and Android 10+ support
  floor before capture UX is frozen;
- at least one supported iPhone and one lower-resource supported Android device
  are available for acceptance testing.

**Exit gates:**

- assignment supports performer, location, quantity, optional member/due date,
  and pinned requirements;
- `apps/mobile` is an Expo/React Native online-only client for iOS and Android;
- camera capture and platform photo/file selection work on the supported device
  matrix;
- EAS internal preview builds install on both platforms, and pilot distribution
  is ready through TestFlight and Google Play internal testing;
- the minimal requirement-template publication needed for assignment pinning is
  implemented here; occurrence generation, exceptions, review, and readiness
  remain in M3;
- progress correction is append-only;
- evidence original, hash, provenance, actors, capture time, and receipt time
  are immutable;
- whole-upload retry is idempotent;
- a simulated connection loss retains the local original until verified server
  receipt;
- pending original and retry state survive an ordinary app restart;
- evidence correction and derivative lineage are testable.

### v0.1-M3 — Requirements, internal review, and readiness

**Outcome:** the team can prove why exact performed scope is ready or blocked
before packaging.

**Entry evidence:**

- real sanitized examples of evidence requirements, exceptions, and review
  outcomes from the target workflow;
- the responsible practitioner has walked through what makes each example ready
  or blocked.

**Exit gates:**

- requirement template versions and occurrences are immutable;
- evidence links support many-to-many relationships;
- exceptions and review corrections preserve history;
- readiness is derived at homogeneous quantity/location scope;
- every blocker drills to authoritative facts;
- sensitive combined responsibilities produce an audit warning.

### v0.1-M4 — Immutable package generation

**Outcome:** one contract's ready scope freezes into reproducible package
versions and artifacts.

**Entry evidence:**

- at least one real sanitized package example with its source work, evidence,
  expected sections, and review requirements;
- package compiler walkthrough recorded before snapshot/template fields freeze.

**Exit gates:**

- package belongs to exactly one contract;
- lines and claim segments trace to exact progress without overclaim;
- freeze pins all material sources and approval requirements;
- PDF, XLSX, ZIP, and manifest derive from the same snapshot;
- repeated generation is deterministic for the same renderer version;
- frozen content and artifact keys cannot be mutated or overwritten.

### v0.1-M5 — Protected external access and partial decisions

**Outcome:** customer and technical-supervision reviewers can decide exact scope
inside GoProceed through protected personal links.

**Entry evidence:**

- customer and technical-supervision walkthroughs of the proposed review surface
  using synthetic or sanitized package data;
- expected quantity/evidence decisions, return reasons, observer behavior, and
  receipt language recorded before the external API freezes.

**Exit gates:**

- bearer token uses URL fragment, immediate history cleanup, same-origin POST,
  hashed storage, redacted logs, and a short revocable session;
- email scanner/prefetch GET cannot consume access;
- observer cannot decide;
- several parallel required approvers can address the same exact scope;
- partial quantity decision partitions and reconciles claim segments;
- quantity and evidence outcomes remain separate;
- revoked, expired, reissued, replayed, CSRF, and wrong-version submissions fail
  safely;
- reviewer receives an immutable decision receipt.

### v0.1-M6 — Value at risk and pilot hardening

**Outcome:** one real end-to-end pilot explains accepted, returned, pending, and
blocked value from exact acceptance facts.

**Entry evidence:**

- a named pilot project or design partner that completed the earlier artifact,
  field, requirement, package, and external-review walkthroughs;
- all real-data privacy, retention, export, deletion, telemetry, assurance, and
  restore prerequisites have passed and their evidence is recorded;
- pilot success measures, baseline, sample, and stopping conditions are agreed
  before data import.

**Exit gates:**

- disjoint state precedence assigns every in-scope segment exactly once;
- currency, tax basis, precision, and rounding are explicit and reconcile;
- missing price, zero price, and over-contract exposure remain distinct;
- v2 correction references unchanged v1 acceptance without copying a decision;
- pre-pilot privacy and restore controls remain verified throughout the pilot;
- end-to-end pilot covers import, capture, review, freeze, protected external
  partial decision, return, correction, resubmission, and risk explanation;
- pilot findings and unresolved operating constraints are documented.

## v0.2 — Pilot hardening and isolated demo

### Outcome

Observed pilot friction is reduced without changing v0.1 source-of-truth
boundaries.

### Candidate scope

- additional import adapters and package/requirement templates;
- reusable versioned import mappings justified by repeated source formats;
- guided onboarding and safe sample workspace creation;
- product analytics with privacy controls;
- durable `/demo` inside `apps/app` using isolated synthetic data;
- demo reset and abuse controls;
- the first optional AI-assist capability selected from observed work.

### Exit gates

- each added adapter/template is versioned and tested against real sanitized
  samples;
- `/demo` cannot access or mutate a customer tenant;
- analytics events have a declared purpose and retention;
- any AI suggestion is reviewable, has provenance, and requires human
  confirmation;
- at least three observed attempts across one or more pilot users record the
  original task, baseline time/error/friction, target change, post-change result,
  and remaining issue.

## v0.3 — Offline mobile

### Outcome

Authorized field users can safely browse assigned work, capture, and synchronize
through extended loss of connectivity.

### Exit gates

- offline authorization is time-bounded and revocable;
- only explicitly authorized task scope is stored on device;
- encrypted local storage and device/session lifecycle are defined;
- multi-device and server conflict rules preserve source facts;
- resumable upload verifies chunk and final content integrity;
- background retries expose durable user-visible states;
- revoked users and expired leases cannot submit;
- recovery from app restart while operating under an offline lease, device clock
  drift, duplicate send, and partial chunk upload is tested.

## v0.4+ — Project Commercials

### Outcome

Commercial teams consume finalized acceptance facts through a separate
subledger/export layer without changing evidence or acceptance history.

### Candidate sequence

- change-order boundary and approved contract adjustments;
- acceptance subledger and accounting export;
- receivable/invoice assistance;
- retentions and deductions;
- payment allocation and reconciliation.

Each capability requires its own decision on accounting authority, jurisdiction,
rounding, correction, close/reopen, and integration responsibility.

## v1.0 — Validated operating product

### Outcome

GoProceed operates a validated contract-to-acceptance workflow with documented
limits and repeatable operations.

### Exit gates

- at least two complete contract-to-acceptance cycles on a named project are
  recorded with participating roles, result, exceptions, and no manual database
  correction;
- security controls and tenant isolation have independent evidence;
- restore, retention, deletion, incident, monitoring, and support procedures
  are exercised;
- migrations, rollback, and compatibility are repeatable;
- external review assurance and legal limitations are communicated clearly;
- service objectives and failure ownership are documented;
- product claims match discovery, pilot, and operating evidence.

## Surface roadmap

- `apps/landing`: separate marketing product and deployment throughout.
- `apps/app`: authenticated product from v0.0 onward.
- `apps/mobile`: Expo/React Native iOS/Android field client from v0.1.
- online-only native capture and safe interrupted-upload recovery: v0.1.
- `/demo` in `apps/app`: durable isolated surface in v0.2.
- full offline mobile: v0.3.
- initial hosting: separate free Vercel domains are acceptable.

## Scope-change rule

Moving a capability between versions requires:

1. evidence for the change;
2. affected ADR and domain-owner update;
3. security, data, and migration impact;
4. revised acceptance gates;
5. explicit approval before implementation.
