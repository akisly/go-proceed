# Migration safety plan (v0.0 additions)

**Status:** Approved

**Applies to:** v0.0
**Last reviewed:** 2026-07-30

## Additive rule

Migrations 0006–0009 add objects only; no baseline object is renamed or
dropped. Any destructive change needs its own approved migration per
[data-model architecture](../../docs/architecture/data-model.md)
"Additive migration rules".

## Per-migration rollback / forward-fix

| Migration | Rollback (dev only) | Forward fix (staging/prod) |
|---|---|---|
| 0006 tenant isolation | drop policies `audit_insert`/`outbox_insert`/`idem_select`/`idem_insert`; recreate `le_insert` from 0004; restore the 0003 `org_has_members` body; drop trigger `audit_events_append_only` | new migration re-creating the corrected policy; never disable RLS in place |
| 0007 idempotency expiry | drop `app.delete_expired_idempotency`/`app.purge_expired_idempotency`; `cron.unschedule('idempotency-purge')` | new migration replacing the function body |
| 0008 outbox claim | drop `app.claim_outbox`/`app.complete_outbox`/`app.fail_outbox`; drop `outbox_dead_letters`; drop the four added columns | new migration; dead-letter rows are append-only evidence and are never dropped together with data |
| 0009 default privileges | re-grant via `alter default privileges` (dev only) | new migration adjusting grants explicitly |

## Known platform residual (watched, not fixable from migrations)

`supabase_admin`'s default ACL in schema `public` still grants
anon/authenticated on objects supabase_admin itself creates. The `postgres`
migration runner cannot alter another role's defaults; user migrations never
run as supabase_admin. The catalog snapshot below records this entry per
environment so any change is visible (migration 0009 header documents both
Postgres gotchas).

## Live-catalog verification

```bash
pnpm db:catalog-snapshot
```

writes `catalog-snapshots/<stamp>.md` from `SUPABASE_DB_URL` (defaults to the
local stack). Procedure: snapshot before and after every deploy per
environment; commit local snapshots and diff. Staging access follows
[infra/README-staging.md](../../infra/README-staging.md); production repeats
the same step once production exists. This closes the baseline-verification
"live database objects and drift" unknown for any environment the snapshot
has been run against.
