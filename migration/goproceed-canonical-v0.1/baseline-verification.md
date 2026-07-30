# Baseline verification

**Status:** Verified with stated environmental limits

**Applies to:** v0.0
**Last reviewed:** 2026-07-30

## Git and workspace

- Canonical worktree: `.` (repository-relative)
- Branch: `codex/goproceed-canonical`
- Base commit: `e578243ced66a7aecb74a8704728b0f29eb5f49e`
- Approved design commit: `1ce4e51`
- Read-only comparison branch and HEAD: `main` at
  `e578243ced66a7aecb74a8704728b0f29eb5f49e`
- Old comparison tree contains modified and untracked files; none were copied
  automatically into this worktree.

`canonical` and `legacy` are symbolic source roots. Machine-local absolute
paths are intentionally excluded from committed evidence.

## Actual runtime represented by migrations

The migration chain currently defines six runtime tables:

1. `organizations`
2. `legal_entities`
3. `memberships`
4. `audit_events`
5. `idempotency_records`
6. `transaction_outbox`

It also defines:

- view `api.me_context`;
- functions `app.current_actor`, `app.org_has_members`, and
  `public.drain_outbox`;
- application roles `aktflow_app` and `aktflow_app_login`;
- optional `pg_cron` scheduling.

This is a migration-derived baseline. A live `pg_catalog` snapshot was not
available, so staging or production drift remains unknown.

## Confirmed runtime strengths

- organization, owner membership, initial legal entity, audit, outbox, and
  idempotency record are committed atomically;
- application SQL is parameterized;
- outsider-negative RLS tests exist;
- idempotency uses advisory locking;
- outbox drain uses `SKIP LOCKED`.

## Confirmed runtime risks

- RLS protects only organizations, legal entities, and memberships;
- app-role access to audit and idempotency data is not tenant-isolated;
- outbox insert is not tenant-bound;
- any active member may insert legal entities;
- first-owner bootstrap is not safely serialized between different actors;
- audit is not enforced append-only and its hash fields are not maintained;
- idempotency expiry is not applied or purged;
- outbox marks rows processed without a real delivery consumer;
- future object privileges are not deny-by-default;
- workspace legal name and EDRPOU duplicate the first legal entity;
- seed configuration can place a known development password in an unsafe
  environment.

## Dependency setup baseline

Required toolchain:

- Node `>=24 <25`;
- pnpm `9.12.0`.

The system Node was 26.4.0. Verification used the bundled Node 24.14.0 without
changing global settings.

`pnpm install --frozen-lockfile` downloaded the locked dependencies but exited
non-zero because build-script policy is not decided for:

- `esbuild@0.28.1`;
- `puppeteer@24.10.2`;
- `sharp@0.34.5`.

The automatic placeholder mutation proposed by the package manager was removed.
The allow/deny decision is a v0.0 supply-chain task.

## Test baseline

Direct Vitest execution:

```text
Test files: 17 passed, 10 failed
Tests:      143 passed, 22 failed
Total:      165
```

Failure groups:

- database integration and RLS tests cannot connect to
  `127.0.0.1:54322`;
- database transaction/idempotency tests lack `APP_DB_URL`;
- one RLS reset attempts `pnpm dlx supabase db reset`;
- three demo suites fail during collection because `@/lib/utils` is missing.

The 22 test failures are primarily the unavailable local database environment.
The three demo suite collection failures are a separate code/import defect and
must not be described as an environmental DB failure.

**2026-07-30 correction:** the three `apps/demo` collection failures were a
root-runner configuration gap, not a missing module —
`apps/demo/src/lib/utils.ts` exists and `apps/demo/vitest.config.ts` defines
the `@` alias, but the root `vitest run` ignored per-package configs.
`vitest.workspace.ts` restores parity (demo project: 16 files / 134 tests
pass under the root runner); per-package runs were always green.

The root Turbo command is also blocked while pnpm build-script approvals remain
unresolved.

## What is not verified

- live database objects and drift;
- exact production grants and policies;
- deployed cron presence;
- real outbox delivery;
- production storage configuration;
- hosted authentication-to-database flow;
- backup/restore;
- retention enforcement;
- any v0.1 domain table or workflow.

## Baseline rule

Documentation work may continue from this recorded state. Product
implementation cannot claim a green baseline until v0.0 supplies the local
database, resolves demo imports and build-script policy, and reruns the complete
test command.
