# Final review — canonical package promotion

**Status:** Complete for documentation promotion; v0.0 implementation not started

**Applies to:** documentation migration
**Last reviewed:** 2026-07-30

## 1. Conflicts

The [conflict register](conflict-register.md) holds 34 conflicts
(C-001..C-034). All 34 have an approved resolution recorded in the canonical
documents; their implementation status is Pending until the named v0.0/v0.1
slices land. No conflict was closed by deleting or rewriting legacy evidence.

## 2. Spec coverage

Every section of the approved canonical design
(`docs/superpowers/specs/2026-07-30-goproceed-canonical-design.md`) has an
active owner:

| Spec § | Owner |
|---|---|
| 1 Purpose | docs/README.md |
| 2 Product boundary | docs/product/scope-and-boundaries.md + ADR-001 |
| 3 Product surfaces | docs/architecture/system-overview.md + ADR-004 |
| 4 Tenancy and legal parties | docs/domain/domain-model.md + ADR-002 |
| 5 Access and responsibility | docs/architecture/tenancy-and-security.md + technical/permissions/ |
| 6 Contract baseline and import | docs/domain/domain-model.md + docs/architecture/files-and-storage.md |
| 7 Execution, requirements, evidence | docs/domain/execution-and-evidence.md |
| 8 Package model | docs/domain/packages-and-acceptance.md |
| 9 Protected external review | docs/domain/packages-and-acceptance.md + docs/architecture/tenancy-and-security.md |
| 10 Resubmission and prior acceptance | docs/domain/packages-and-acceptance.md |
| 11 Acceptance and value at risk | docs/domain/value-at-risk.md |
| 12 v0.1 logical data modules | technical/database/entity-catalog.csv + schema-v0.1.sql (D-045/D-046) |
| 13 Foundation security | docs/delivery/version-0.0.md |
| 14 Deferred contexts | docs/product/scope-and-boundaries.md |
| 15 AI extension boundary | docs/product/scope-and-boundaries.md |
| 16 Privacy and retention | docs/delivery/production-readiness.md |
| 17 Version roadmap | docs/product/roadmap.md + docs/delivery/version-0.1.md |
| 18 Documentation hierarchy | docs/README.md |
| 19 Discovery evidence | docs/discovery/outreach-log.md + validated-assumptions.md |
| 20 Required invariant tests | technical/database/invariant-catalog.csv (INV-001..INV-016 verbatim; INV-017..INV-060 derived) |
| 21 Migration principle | docs/legacy/README.md + this ledger |

## 3. Remaining external gates

Not invented, not defaulted; each blocks pilot data until approved:

- retention schedule (all storage classes, audit, telemetry, backups);
- privacy notice and EXIF/GPS policy;
- versioned external confirmation text;
- workspace export and manual closure/deletion procedure;
- backup/restore exercise;
- statutory registration/VAT validation rules;
- pilot-device inventory confirmation for the mobile support floor.

## 4. Test baseline (recorded, not green)

Two direct root `vitest run` executions on 2026-07-30 (after the documentation
work; no code changed):

- **Recorded checkpoint baseline:** 143 passed / 22 failed of 165
  (17/10 files) with no local database reachable.
- **This session's runs (twice, consistent):** 153 passed / 12 failed of 165
  (19 passed / 8 failed files). Failure classes:
  1. `apps/demo` — 3 suites still fail collection on the missing `@/lib/utils`
     module (code defect, unchanged);
  2. `packages/database` — 2 files / 4 tests fail on `APP_DB_URL is not set`
     (environmental);
  3. `apps/app` integration + `supabase/functions/outbox-drain` — 3 files /
     8 tests failed while a local Postgres WAS reachable, including one
     `deadlock detected` during a cross-package truncate. A direct root
     `vitest run` executes packages in parallel against one database, which
     CI explicitly serializes (`turbo run test --concurrency=1`); these
     results are therefore not authoritative for correctness either way.

**Verdict unchanged:** the baseline is not green and may not be claimed green
until v0.0 supplies the local database environment, fixes the demo import,
resolves the build-script policy, and re-runs the serialized suite.

**2026-07-30 update:** v0.0 execution delivered exactly that. The serialized
re-run from a clean database after migrations 0006–0009 is fully green —
196 tests / 31 files, zero failures, zero quarantines — recorded in the
[baseline re-run addendum](baseline-verification.md). Remaining v0.0
evidence: a CI run with pinned actions (needs push) and staging verification.

## 5. Discovery evidence discrepancy

The founder reports outreach to 50 companies; the 2026-07-28 workbook
evidences 21 sends (22-record queue, one unsent for an unconfirmed email).
The 29-send difference remains explicitly unreconciled
([outreach-log.md](../../docs/discovery/outreach-log.md)). Zero replies,
interviews, or pilot commitments are on record
([validated-assumptions.md](../../docs/discovery/validated-assumptions.md)).

## 6. Security gate (2026-07-30, read-only)

A /cso-style audit of the runtime auth/RLS/storage slice produced two
findings, both routed into [version-0.0.md](../../docs/delivery/version-0.0.md)
gates: (1) third-party CI actions pinned by tag with no `permissions:` block;
(2) the committed dev password in `supabase/seed.sql` combined with
`[db.seed] enabled = true` leaves a procedural-only guard against reseeding a
reachable database. The slice's RLS policies, idempotency locking, and
negative tests were assessed as sound. Findings are recorded separately from
target-document claims in `.gstack/security-reports/` (local, untracked).

## 7. Exact next implementation plan required

v0.0 foundation hardening per [version-0.0.md](../../docs/delivery/version-0.0.md).
Its first executable slice needs a written implementation plan covering:
environment/build-script policy, demo import fix, tenant isolation for
audit/idempotency/outbox, serialized bootstrap, deny-by-default privileges,
seed-credential restructuring, append-only audit enforcement, and the
serialized re-run of the full test suite. No v0.1 domain table may land before
that plan is approved.

## 8. Non-destruction statement

No source data was destructively removed. The old comparison tree was never
modified. No legacy file in this worktree was moved, rewritten in place, or
deleted; all cleanup remains a proposal
([cleanup-proposal.md](cleanup-proposal.md)) awaiting explicit user approval
of exact paths. User-added `.agents/` and `skills-lock.json` remain preserved
and untracked.
