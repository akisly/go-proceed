# v0.1 delivery gates — M1–M6 vertical slices

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md)

v0.1 is one product outcome — contract baseline to protected partial external
acceptance and derived value at risk — delivered through six vertical
milestones. Entry evidence and exit gates live in the
[roadmap](../product/roadmap.md); this document adds the exact schema slice,
API slice, security tests, vertical test, and exclusions per milestone.

Slices reference [entity-catalog.csv](../../technical/database/entity-catalog.csv)
(`status_version` column) and [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv)
(`milestone` column); those catalogs are authoritative for the row-level lists.

## v0.1-M1 — Parties, contracts, versions, and import

- **User outcome:** a workspace with several own legal entities publishes a
  clean, traceable contract baseline from XLSX/CSV.
- **Schema slice:** workspace/access module (parties, legal profiles, own
  profiles, contacts, projects, project parties, access grants,
  responsibilities) plus the whole contract-baseline module (contracts,
  contract versions, work items, locations, units, import batches/files/rows,
  source-amount resolutions).
- **API slice:** the 21 `v0.1-M1` operations from workspace bootstrap through
  `import_batches.publish` and `contract_versions.get`.
- **Security tests:** cross-workspace party/contract injection (INV-001/002),
  own-profile permission separation (INV-020), contract-number uniqueness
  (INV-022), import fuzz incl formula/macro/ZIP-bomb fail-closed (INV-016),
  discrepancy blocking (INV-054).
- **Vertical test:** import a sanitized real estimate; resolve one mismatch;
  publish; reimport and verify diff plus lineage; prove published immutability.
- **Exclusions:** no assignments, progress, evidence, packages, or external
  access; no PDF import authority.
- **Closing evidence:** entry walkthrough recordings plus the exit-gate test
  run per roadmap M1.

## v0.1-M2 — Assignments, progress, and online evidence

- **User outcome:** field work is recorded and proven online without losing an
  original during a network interruption.
- **Schema slice:** work assignments, progress entries, progress allocation
  heads, valuation allocations, upload intents, capture events, evidence
  objects; the minimal requirement-template publication needed for pinning.
- **API slice:** the seven `v0.1-M2` operations (`assignments.*`,
  `progress.*`, `upload_intents.*`).
- **Security tests:** adjustment root/lineage denial (INV-023/024),
  reservation invariant property tests (INV-025), upload authorization recheck
  and orphan purge (INV-046/047), storage key immutability (INV-045),
  cross-identity pending-original denial and quarantine (INV-053),
  restart-persistence (INV-013/014).
- **Vertical test:** capture on a supported iPhone and a lower-resource
  Android through a simulated connection loss, app restart, retry, and
  server-confirmed receipt.
- **Exclusions:** no offline authorization or task access, no background sync,
  no resumable chunks (v0.3); no occurrence review flow (M3).
- **Closing evidence:** device-matrix test recordings plus EAS internal build
  installation on both platforms.

## v0.1-M3 — Requirements, internal review, and readiness

- **User outcome:** the team proves why exact performed scope is ready or
  blocked before packaging.
- **Schema slice:** requirement template versions, occurrences, exceptions and
  exception heads, evidence-requirement links, review target sets/items,
  internal review decisions and heads, readiness projection.
- **API slice:** the seven `v0.1-M3` operations from template creation through
  `readiness.get`.
- **Security tests:** exception/review fork denial (INV-035), target-set
  identity immutability (INV-036), template immutability (INV-015),
  responsibility-vs-visibility separation (INV-021), separation-of-duties
  audit warning.
- **Vertical test:** link evidence many-to-many; return then correct; verify
  readiness recomputes and every blocker drills to authoritative facts.
- **Exclusions:** internal outcomes never accept contractual quantity; no
  external decisions yet.
- **Closing evidence:** sanitized requirement/exception/review examples from
  the target workflow reproduced end to end.

## v0.1-M4 — Immutable package generation

- **User outcome:** ready scope freezes into reproducible package versions and
  artifacts.
- **Schema slice:** package template versions, packages, package versions,
  package scope heads, package lines, claim scope lineages and heads, claim
  segments, progress sources, the progress-claim allocation ledger, evidence
  sources, artifacts, approval requirements.
- **API slice:** the seven `v0.1-M4` operations (`packages.*`,
  `package_versions.*`, artifact download).
- **Security tests:** cross-contract package injection (INV-003), no-overclaim
  concurrency (INV-005/025/026), freeze approval coverage (INV-034),
  frozen-content and artifact-key immutability (INV-015/045), head advance and
  corrected-successor races (INV-027), line homogeneity (INV-033).
- **Vertical test:** freeze; verify PDF/XLSX/ZIP/manifest derive from one
  snapshot deterministically; advance the head; run the atomic
  corrected-successor command and prove accepted floors hold.
- **Exclusions:** no submissions or external access yet; no artifact
  regeneration that overwrites keys.
- **Closing evidence:** recorded package-compiler walkthrough plus the
  deterministic-generation test run.

## v0.1-M5 — Protected external access and partial decisions

- **User outcome:** customer and technical-supervision reviewers decide exact
  scope through protected personal links.
- **Schema slice:** package submissions, external access grants, external
  sessions, decision batches, quantity decisions, evidence decisions, decision
  issues, decision coverage, prior acceptance references, package review
  status projection.
- **API slice:** the nine `v0.1-M5` operations including the public shell,
  single-use exchange, and external decision submit.
- **Security tests:** the full external-link matrix from
  [tenancy-and-security.md](../architecture/tenancy-and-security.md) — prefetch
  non-consumption (INV-010), exchange single-use race (INV-057), revocation/
  expiry/reissue/epoch denial (INV-009/041/056), CSRF and origin (INV-058),
  observer denial (INV-031), terminal uniqueness and overlap denial
  (INV-028/029), token absence from DB/logs/outbox (INV-044), idempotent
  submit (INV-007).
- **Vertical test:** two parallel required approvers partially decide the same
  scope in both orders; verify identical leaf coverage (INV-006); return,
  correct, resubmit with a prior acceptance reference (INV-008/030).
- **Exclusions:** no OTP or reviewer accounts; no sequential approval routing;
  no reversal of accepted quantity (D-044).
- **Closing evidence:** recorded reviewer walkthroughs plus immutable decision
  receipts.

## v0.1-M6 — Value at risk and pilot hardening

- **User outcome:** one real end-to-end pilot explains accepted, returned,
  pending, and blocked value from exact acceptance facts.
- **Schema slice:** acceptance projection and value-at-risk projection with
  the `api.value_at_risk` / `api.acceptance` contract views.
- **API slice:** the two `v0.1-M6` queries (`value_at_risk.get`,
  `acceptance.get`).
- **Security tests:** projection state exhaustiveness (INV-040), currency
  separation (INV-012), missing/zero price distinction (INV-038),
  over-contract exclusion (INV-039), rounding reconciliation incl
  largest-remainder ties (INV-011/037/055), watermark determinism (INV-051).
- **Vertical test:** the full pilot loop — import, capture, review, freeze,
  protected external partial decision, return, correction, resubmission, and
  risk explanation — on a named pilot project.
- **Exclusions:** no receivables, invoices, payments, or FX; disputed accepted
  quantity is reported outside VaR (D-044).
- **Closing evidence:** pilot findings document plus verified pre-pilot
  privacy/retention/restore prerequisites from
  [production-readiness.md](production-readiness.md).

## Cross-milestone rule

Every milestone closes with tenant-isolation tests and one working vertical
scenario through the UI/API/database boundary. Discovery entry evidence
precedes each irreversible schema or UX freeze; M6 is the integrated pilot,
not the first customer contact.
