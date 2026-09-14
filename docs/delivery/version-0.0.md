# v0.0 delivery gate — canonical and safe foundation

**Status:** Approved

**Applies to:** v0.0

**Last reviewed:** 2026-08-03

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md)

## Outcome

One authoritative GoProceed package describes the actual runtime separately
from the approved v0.1 target, and the foundation this gate started from —
six tables, extended to seven by migration `0008` within the gate itself —
is safe to extend. The recorded starting point is
[baseline verification](../../migration/goproceed-canonical-v0.1/baseline-verification.md):
143/165 tests passing, 22 failures dominated by the unavailable local database,
three demo suites broken by a missing `@/lib/utils` import, and an unresolved
pnpm build-script policy.

## Work items and evidence

### 1. Environment and build policy

- [x] Decide the pnpm build-script allow/deny policy for `esbuild`,
      `puppeteer`, and `sharp`; record the decision and rationale in the repo
      (supply-chain task from baseline verification).
- [x] Make local Supabase startup and `APP_DB_URL` provisioning reproducible
      with one documented command path.
- [x] Fix the three `apps/demo` suites that fail collection on the missing
      `@/lib/utils` module; this is a code/import defect, not an environment
      failure, and must not be quarantined as one.
- [x] Pin third-party GitHub Actions to commit SHAs and add a least-privilege
      `permissions:` block to `.github/workflows/ci.yml` (2026-07-30 security
      gate, finding 1).

**Evidence:** a clean-machine bootstrap log; CI run with the pinned actions.

### 2. Green baseline

- [x] Re-run the complete root test command after the environment items above.
- [x] All baseline tests pass, or a time-bounded quarantine for a non-security
      test names its owner, reason, expiry, and removal condition.
- [x] Tenant-isolation, authorization, migration-integrity, immutable-history,
      backup/restore, and external-decision security tests can never be
      quarantined.

**Evidence:** the recorded pass/fail counts distinguishing environmental from
code failures. Until this re-run happens, no document may claim a green
baseline.

### 3. Foundation tenant isolation

- [x] `audit_events`, `idempotency_records`, and `transaction_outbox` become
      tenant-safe (workspace binding plus RLS or equivalent grant isolation).
- [x] First-owner bootstrap is serialized between different actors (INV-018).
- [x] Own-party/legal-entity creation is capability-aware (INV-020).
- [x] Future object privileges are deny-by-default for every actual migration
      owner (INV-060).
- [x] Audit is enforced append-only with actor/workspace consistency (INV-043)
      and idempotency expiry is applied and purged.
- [x] Outbox gains real claim, retry, backoff, error, and dead-letter behavior
      instead of drain-only bookkeeping (jobs/attempts/dead_letters slice of
      [schema-v0.1.sql](../../technical/database/schema-v0.1.sql)).

**Evidence:** migration diffs plus the invariant tests named in
[invariant-catalog.csv](../../technical/database/invariant-catalog.csv).

### 4. Secrets and seed safety

- [x] Remove the development password statement from `supabase/seed.sql`; set
      dev/CI credentials through a step Supabase tooling can never auto-apply
      (2026-07-30 security gate, finding 2: `--include-seed` paths and Supabase
      Branching would reseed a reachable database with a known password while
      `[db.seed] enabled = true`).
- [x] Verify staging/production role passwords are generated per environment
      and never committed (infra/README-staging.md §3 stays authoritative).
      *[Ticked 2026-09-15 ([DEV-010](../tasks/DEV-010-m0-gate14-evidence.md)): both
      `goproceed_*_login` passwords were set on 2026-08-19, SCRAM, different
      (README-staging «Status»); a scan of tracked files on 2026-09-15 found no
      committed credential. One hosted environment exists — staging, the pilot and
      the production app share it — so «per environment» is shown for that one;
      a separate production project owes the same check (runbook §10 Q-9).]*
- [x] Confirm no service-role or worker credential is reachable from browser
      or mobile code paths.

**Evidence:** repo scan plus the environment-safety test from the roadmap gate
"seed credentials are environment-safe".

### 5. Migration safety rails

- [x] Additive migration, compatibility, rollback, and live-catalog
      verification plans are written and approved before any v0.1 domain table
      lands (data-model.md "Additive migration rules").
- [x] A live `pg_catalog` snapshot procedure exists so staging/production drift
      stops being unknown.

**Evidence:** approved plan documents plus one executed catalog snapshot.

## Status 2026-07-30

Implemented by the v0.0 plan
([2026-07-30-goproceed-v0.0-foundation-hardening.md](../superpowers/plans/2026-07-30-goproceed-v0.0-foundation-hardening.md)),
migrations 0006–0009, and recorded in the
[baseline re-run addendum](../../migration/goproceed-canonical-v0.1/baseline-verification.md):
**serialized suite fully green — 196 tests / 31 files, zero failures, zero
quarantines** (194 via `turbo run test --concurrency=1 --force` plus the
2-test outbox-drain project) from a freshly reset local database.

CI evidence recorded 2026-07-30: PR
[akisly/akt-flow#3](https://github.com/akisly/akt-flow/pull/3) runs the
pinned-SHA workflow green — `verify` (serialized suite against the freshly
migrated local stack), `demo-qa`, and `package-validate` all pass.

Still open before v0.0 formally closes:

- staging password verification and a staging catalog snapshot (needs staging
  access per infra/README-staging.md);
- the `supabase_admin` default-ACL residual stays a watched platform item
  ([migration-safety-plan.md](../../migration/goproceed-canonical-v0.1/migration-safety-plan.md)).

## Exit rule

v0.0 closes only when every checklist above has recorded evidence. Closing
v0.0 does not implement any v0.1 domain capability; it makes implementing them
safe.
