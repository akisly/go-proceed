# v0.0 delivery gate — canonical and safe foundation

**Status:** Approved

**Applies to:** v0.0

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md)

## Outcome

One authoritative GoProceed package describes the actual runtime separately
from the approved v0.1 target, and the existing six-table foundation is safe to
extend. The recorded starting point is
[baseline verification](../../migration/goproceed-canonical-v0.1/baseline-verification.md):
143/165 tests passing, 22 failures dominated by the unavailable local database,
three demo suites broken by a missing `@/lib/utils` import, and an unresolved
pnpm build-script policy.

## Work items and evidence

### 1. Environment and build policy

- [ ] Decide the pnpm build-script allow/deny policy for `esbuild`,
      `puppeteer`, and `sharp`; record the decision and rationale in the repo
      (supply-chain task from baseline verification).
- [ ] Make local Supabase startup and `APP_DB_URL` provisioning reproducible
      with one documented command path.
- [ ] Fix the three `apps/demo` suites that fail collection on the missing
      `@/lib/utils` module; this is a code/import defect, not an environment
      failure, and must not be quarantined as one.
- [ ] Pin third-party GitHub Actions to commit SHAs and add a least-privilege
      `permissions:` block to `.github/workflows/ci.yml` (2026-07-30 security
      gate, finding 1).

**Evidence:** a clean-machine bootstrap log; CI run with the pinned actions.

### 2. Green baseline

- [ ] Re-run the complete root test command after the environment items above.
- [ ] All baseline tests pass, or a time-bounded quarantine for a non-security
      test names its owner, reason, expiry, and removal condition.
- [ ] Tenant-isolation, authorization, migration-integrity, immutable-history,
      backup/restore, and external-decision security tests can never be
      quarantined.

**Evidence:** the recorded pass/fail counts distinguishing environmental from
code failures. Until this re-run happens, no document may claim a green
baseline.

### 3. Foundation tenant isolation

- [ ] `audit_events`, `idempotency_records`, and `transaction_outbox` become
      tenant-safe (workspace binding plus RLS or equivalent grant isolation).
- [ ] First-owner bootstrap is serialized between different actors (INV-018).
- [ ] Own-party/legal-entity creation is capability-aware (INV-020).
- [ ] Future object privileges are deny-by-default for every actual migration
      owner (INV-060).
- [ ] Audit is enforced append-only with actor/workspace consistency (INV-043)
      and idempotency expiry is applied and purged.
- [ ] Outbox gains real claim, retry, backoff, error, and dead-letter behavior
      instead of drain-only bookkeeping (jobs/attempts/dead_letters slice of
      [schema-v0.1.sql](../../technical/database/schema-v0.1.sql)).

**Evidence:** migration diffs plus the invariant tests named in
[invariant-catalog.csv](../../technical/database/invariant-catalog.csv).

### 4. Secrets and seed safety

- [ ] Remove the development password statement from `supabase/seed.sql`; set
      dev/CI credentials through a step Supabase tooling can never auto-apply
      (2026-07-30 security gate, finding 2: `--include-seed` paths and Supabase
      Branching would reseed a reachable database with a known password while
      `[db.seed] enabled = true`).
- [ ] Verify staging/production role passwords are generated per environment
      and never committed (infra/README-staging.md §3 stays authoritative).
- [ ] Confirm no service-role or worker credential is reachable from browser
      or mobile code paths.

**Evidence:** repo scan plus the environment-safety test from the roadmap gate
"seed credentials are environment-safe".

### 5. Migration safety rails

- [ ] Additive migration, compatibility, rollback, and live-catalog
      verification plans are written and approved before any v0.1 domain table
      lands (data-model.md "Additive migration rules").
- [ ] A live `pg_catalog` snapshot procedure exists so staging/production drift
      stops being unknown.

**Evidence:** approved plan documents plus one executed catalog snapshot.

## Exit rule

v0.0 closes only when every checklist above has recorded evidence. Closing
v0.0 does not implement any v0.1 domain capability; it makes implementing them
safe.
