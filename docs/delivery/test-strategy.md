# Test strategy

**Status:** Approved

**Applies to:** v0.0 and v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md)

## Principles

1. Every invariant in
   [invariant-catalog.csv](../../technical/database/invariant-catalog.csv) has
   named test evidence; the catalog's `test_evidence` column is the traceable
   index of required suites.
2. Security and tenant-isolation suites can never be quarantined
   ([v0.0 gate](version-0.0.md)).
3. Environmental failures (unavailable local DB) are reported separately from
   code failures; a suite blocked by the environment is not "passing".
4. Tests run against the same Postgres engine as production (local Supabase);
   no mocked database for RLS, constraint, or transaction behavior.

## Test families

### Unit

Pure domain logic in `packages/domain` and contract schemas in
`packages/contracts`: builders, validation, problem mapping, monetary
calculation helpers. Fast, no I/O.

### Migration

Each migration applies cleanly on an empty database and on the previous chain;
`supabase db reset` matches the incremental path. Additive-only checks: no
rename/drop of baseline objects without a separately approved destructive
migration. Backfill jobs produce reconciliation reports; rollback/forward-fix
paths are exercised (data-model.md "Additive migration rules").

### Invariant

Database-level proofs for the P0 rows of the invariant catalog: composite-FK
injection denial, terminal-decision uniqueness, append-only/immutability
trigger rejection, reservation balance checks, exception/review fork denial,
head serialization races (bootstrap, adjustment/allocation,
partition/decision, head advance, corrected successor). Concurrency tests use
real parallel transactions, not sequential simulation.

### RLS

Positive and negative policy tests per exposed table, following the matrix in
[tenancy-and-security.md](../architecture/tenancy-and-security.md): outsider
denial, same-user-other-workspace denial, membership-without-project-access
denial, responsibility/visibility separation, forced-RLS owner behavior, and
default-privilege checks proving new objects are inaccessible until granted.

### API integration

Route-level tests through the BFF: auth required, idempotency replay and
conflict, optimistic-version conflicts, problem+json codes, `X-Request-Id`
validation, and the full command list in
[scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv).

### Storage

Bucket privacy (no anonymous list/read), cross-workspace signed-URL denial,
key overwrite rejection, staging invisibility, orphan purge within 24 hours,
signed-URL expiry, and proxied revocation behavior
(files-and-storage.md "Required verification").

### External link

The protected-review protocol matrix: prefetch/GET non-consumption, exchange
single-use concurrency, HMAC key rotation, generic failure responses, cookie
flags and TTLs, session rotation, CSRF/origin, epoch/revocation denial, token
absence from logs/DB/outbox, and decision-vs-partition and
decision-vs-head-advance races.

### Import fuzz

Hostile fixture corpus: macro/formula workbooks, ZIP bombs, deep nesting, path
traversal names, encoding attacks, NUL/control characters, oversized
rows/cells, MIME spoofing. Every fixture fails closed with a named error and
no publishable rows (INV-016). CSV export neutralization round-trips without
losing source provenance.

### Rounding and property

Property-based tests over decimal quantities and repeated partitions: coupled
net/tax/gross allocation, largest-remainder ties, pool-allocation
reconciliation, missing-vs-zero price, over-contract exclusion, and
reviewer-order equivalence for partitioned decisions
(value-at-risk.md "Required tests").

### Mobile interruption

Device-level tests on the supported matrix (iOS 16.4+, Android 10+): connection
loss before/after bytes sent, app restart persistence, retry idempotency,
integrity mismatch, logout/revocation quarantine, cross-identity access denial,
cleanup only after a matching `available` receipt.

### End-to-end

One scripted vertical scenario per milestone (see
[version-0.1.md](version-0.1.md)) plus the full M6 pilot loop. E2E asserts
structural facts (rows, receipts, decision coverage), not only screenshots.

## Execution

- Local/CI: `supabase start` + `supabase db reset`, then the root test command
  serialized across packages that share one database (`--concurrency=1` stays
  load-bearing until suites stop truncating shared tables).
- Quarantine ledger: any temporarily skipped non-security test carries owner,
  reason, expiry, and removal condition in the repo.
- Baseline honesty: pass/fail counts are recorded verbatim; the 2026-07-30
  baseline (143 passed / 22 failed, 10 failed files) remains the reference
  until the v0.0 re-run.
