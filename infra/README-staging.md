# Staging provisioning runbook — AktFlow P0a slice 1

This is an executable runbook for a human operator with a Supabase account
and a Vercel account. Nothing in this repo automates it, and nothing in
this repo has run it yet (see "Status" at the bottom). It provisions:

1. A staging Supabase project with migrations 0001-0005 applied.
2. Two Vercel projects (`apps/app`, `apps/landing`) built from this
   monorepo via pnpm + Turborepo.
3. A verification pass that proves the same vertical slice this repo tests
   locally (`POST /v1/organizations` → `GET /v1/me/context`, audit +
   outbox + cron drain, tenant isolation) also works against staging.

Do not commit any secret produced by these steps (project ref is not
secret; DB URL, anon key, and service_role key are). Store them in a
password manager and in Vercel's encrypted environment variables only.

---

## 1. Create the staging Supabase project

1. In the Supabase dashboard, create a new project named `aktflow-staging`
   (region: pick the one closest to `app.aktflow.com`'s expected traffic).
2. Record, in a password manager (not in this repo):
   - **Project ref** (e.g. `abcdefghijklmnop`) — visible in the dashboard
     URL and in Project Settings → General.
   - **DB URL** — Project Settings → Database → Connection string (use the
     **session pooler** connection string for `APP_DB_URL`, since Vercel
     serverless functions are short-lived; the direct connection string is
     fine for one-off `psql`/SQL-editor work).
   - **anon key** — Project Settings → API → `anon` `public` key. This is
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - **service_role key** — Project Settings → API → `service_role` key.
     Needed only for the outbox-drain Edge Function path (not deployed in
     this slice, see `supabase/functions/outbox-drain/index.ts`) and for
     any one-off admin scripts. Never expose it to the browser or commit it.
3. `NEXT_PUBLIC_SUPABASE_URL` is `https://<project-ref>.supabase.co`.

## 2. Link the project and push migrations

From the repo root, with the Supabase CLI installed and authenticated
(`supabase login`):

```bash
supabase link --project-ref <project-ref>
supabase db push
```

This applies `supabase/migrations/0001_core_tenancy.sql` through
`0005_outbox_drain_cron.sql` in order, exactly as `supabase db reset` does
locally. A plain `supabase db push` (as run above, with no flags) does
**not** apply `supabase/seed.sql` — push only runs migrations — so do not
seed staging with the local dev fixtures (`AUTH_USER_A` / `AUTH_USER_B`)
this way; staging users are created via Supabase Auth in §6. This is
about the default, unflagged command only — see the prohibition list at
the start of §3 for the specific push/reset/Branching variants that DO
apply `seed.sql`, which must never be run against this project.

### 2.1 Verify `pg_cron` exists on the staging image

Migration `0005_outbox_drain_cron.sql` wraps `create extension pg_cron`
and every `cron.*` call in defensive `do $$ ... exception ... end $$`
blocks specifically because `pg_cron` requires
`shared_preload_libraries=pg_cron`, which is true on the standard
Supabase-hosted image but is **not guaranteed** on every plan/region — if
it's absent, the migration only `raise notice`s and silently skips
scheduling the `outbox-drain` job. A clean `db push` is therefore not
sufficient proof the drain is live. After pushing, check explicitly in
the SQL Editor:

```sql
select extname from pg_extension where extname = 'pg_cron';
-- expect one row

select jobid, jobname, schedule, active from cron.job where jobname = 'outbox-drain';
-- expect exactly one active row, schedule = '30 seconds'
```

If `pg_cron` is missing: enable it via Database → Extensions in the
dashboard (or contact Supabase support if the plan doesn't expose it),
then re-run `supabase db push` (§2.2 proves this is safe to repeat) so the
`do $$ ... end $$` block in `0005` re-evaluates and schedules the job.

### 2.2 Empirically double-apply the migrations (idempotency proof)

Every migration in this slice is written to be safe to re-run (`create
... if not exists`, `drop policy if exists` before `create policy`,
`cron.schedule` upserts by job name, etc.) — but that is a claim, and this
runbook requires proving it on staging rather than trusting the comments:

```bash
supabase db push   # first apply — should report 5 migrations applied
supabase db push   # second apply, immediately after — should report
                    # "Remote database is up to date" / 0 migrations
                    # applied, and exit 0
```

Then confirm nothing was duplicated:

```sql
select count(*) from cron.job where jobname = 'outbox-drain'; -- expect 1, not 2
select count(*) from pg_extension where extname = 'pg_cron';  -- expect 1
```

If either apply exits non-zero, or `outbox-drain` shows up twice, treat
that as a migration bug and stop — do not proceed to §3 against a staging
DB in an unknown state.

## 3. Set the `aktflow_app_login` and `aktflow_service_login` passwords on staging (mandatory, do this now)

**Never run any of the following against this (or any real) Supabase
project — each one applies `supabase/seed.sql`, which sets
`aktflow_app_login`'s password to the known dev value `app_pw`:**

- `supabase db push --include-seed`
- `supabase db reset --linked` (with or without `--include-seed` — the
  reset itself destroys and rebuilds the linked remote database from
  local migrations, and `--include-seed` on top of that reloads
  `seed.sql`)
- Enabling Supabase Branching while `[db.seed] enabled = true` in
  `supabase/config.toml` — preview branches are reseeded from
  `./supabase/seed.sql` automatically (equivalent to a local `supabase db
  reset`), with no flag required, on every preview branch's own
  internet-reachable database. If Branching is ever turned on for this
  project, set `[db.seed] enabled = false` first.

None of the above is scoped to `aktflow_app_login` alone: a
`db reset --linked` rebuilds the whole database from
`supabase/migrations`, which carries no password for
`aktflow_service_login` either (migration `0034_service_principal_role.sql`
creates it exactly like `0003` creates `aktflow_app_login` — LOGIN, no
password, on purpose). Running any of these commands against staging or
production is just as unsafe for the service login as for the app login.

If any of the above is ever run against staging or production, treat
`aktflow_app_login`'s password as compromised — it will have been reset
to `app_pw` — and treat `aktflow_service_login`'s password as lost (reset
to no password, so the service connection goes inert rather than
compromised to a known value). Immediately re-run the rotation steps
below for whichever role was affected — §3.1 for `aktflow_app_login`,
§3.2 for `aktflow_service_login` — before any traffic is allowed through.

**Do not skip or defer either step below.** Migration
`0003_roles_and_grants.sql` creates the `aktflow_app_login` LOGIN role,
and migration `0034_service_principal_role.sql` creates the
`aktflow_service_login` LOGIN role, both with **no password at all** —
`supabase db push` never sets one for either, on purpose. Nothing can
password-authenticate as `aktflow_app_login` or `aktflow_service_login`
until you set a secret here, which is intentional: it means a freshly
pushed staging database is inert (unreachable by the app, and unreachable
by the server's own service connection) rather than reachable with a
known default, and §4-§5 below (creating the Vercel deployment, which
needs both `APP_DB_URL` and `SERVICE_DB_URL`) cannot meaningfully proceed
until both steps below are done.

Membership in the `aktflow_app` role **is** full tenant-table
read/write privilege: `app.actor_user_id` is a plain session GUC that
any connection authenticated as `aktflow_app_login` can set via `set
local role aktflow_app` (see `packages/database/src/tx.ts`), and RLS
policies key off that GUC, not off any secondary secret. There is no
second gate — anyone who has this password can read and write every
tenant's `organizations`, `memberships`, `legal_entities`,
`audit_events`, `transaction_outbox` and `idempotency_records` rows.
Treat it as a top-tier secret, equivalent in blast radius to a database
admin credential for tenant data — not as a low-stakes app-connection
password.

### 3.1 `aktflow_app_login`

1. Open the staging project's SQL Editor and run, with a freshly
   generated secret (e.g. `openssl rand -base64 24`):
   ```sql
   alter role aktflow_app_login password '<generated-secret>';
   ```
2. Record `<generated-secret>` in the password manager alongside the
   project ref. Never commit it, and never reuse the local dev value
   (`app_pw` — set only by `supabase/seed.sql`, which a *default* `db
   push` never runs, but the prohibited commands listed at the top of
   this section do) here.
3. Compose `APP_DB_URL` for the app deployment using that password and
   the **pooler** host/port from §1, e.g.:
   ```
   postgresql://aktflow_app_login:<generated-secret>@<pooler-host>:<pooler-port>/postgres
   ```
   `packages/database/src/pool.ts` reads this verbatim from `APP_DB_URL`
   at request time — no other code path composes it.
4. Do not proceed to §4 (creating the Vercel projects / setting their
   `APP_DB_URL`) until this step and §3.2 below are complete — there is
   no working `APP_DB_URL` to configure them with otherwise.

### 3.2 `aktflow_service_login`

Migration `0034_service_principal_role.sql` creates `aktflow_service`
(NOLOGIN, a member of `aktflow_app`) and `aktflow_service_login` (LOGIN,
a member of `aktflow_service` and nothing else), with no password, for
the same reason as `aktflow_app_login` above. `aktflow_service_login` is
the connection `withServiceTx` (`packages/database/src/tx.ts`) uses for
every write the server makes about what it itself observed — since
migration 0035, that is the only way an inspection verdict or a
server-sourced capture event can be written at all.

**If this step is skipped**, the deployed app has no working
`SERVICE_DB_URL`: `getServicePool()` (`packages/database/src/pool.ts`)
throws on the very first call, so *every* upload finalization, every
integrity-failure record, and every blocked-content record fails with a
500 — the entire evidence path is down. It fails closed rather than
insecurely open, but nothing in CI or the database catches a missing
staging env var; the first signal is a user-facing 500 on the first real
upload.

1. Open the staging project's SQL Editor and run, with a **different**
   freshly generated secret (do not reuse the `aktflow_app_login`
   secret from §3.1 — the two logins must not share a password):
   ```sql
   alter role aktflow_service_login password '<generated-secret>';
   ```
2. Record `<generated-secret>` in the password manager alongside the
   project ref, as its own entry distinct from `aktflow_app_login`'s.
   Never commit it, and never reuse the local dev value (`service_pw` —
   set only by `scripts/set-local-app-password.mjs` against a local
   database, and refused by that script against any non-local host)
   here.
3. Compose `SERVICE_DB_URL` for the app deployment using that password
   and the **pooler** host/port from §1, e.g.:
   ```
   postgresql://aktflow_service_login:<generated-secret>@<pooler-host>:<pooler-port>/postgres
   ```
   `packages/database/src/pool.ts`'s `getServicePool()` reads this
   verbatim from `SERVICE_DB_URL` at request time — no other code path
   composes it, and it must never be the same value as `APP_DB_URL`.
4. Do not proceed to §4 until this step and §3.1 above are both
   complete — there is no working `SERVICE_DB_URL` to configure the
   deployment with otherwise.

## 4. Create two Vercel projects from the monorepo

Both projects import the same GitHub repo/branch; only the root directory
and env vars differ.

### `apps/app`

- Root directory: `apps/app`
- Framework preset: Next.js
- Build command: `cd ../.. && pnpm turbo run build --filter=@aktflow/app`
  (or accept Vercel's monorepo auto-detection, which runs `pnpm install`
  at the repo root and `next build` in the root directory — either works
  since Turborepo's task graph builds `@aktflow/database`,
  `@aktflow/domain`, `@aktflow/contracts` first via `dependsOn: ["^build"]`
  in `turbo.json`).
- Install command: `pnpm install` (repo root — pnpm workspaces require
  this; do not let Vercel install inside `apps/app` alone).
- Environment variables (Production + Preview):
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://<project-ref>.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon key from §1
  - `APP_DB_URL` = the pooler connection string composed in §3.1
  - `SERVICE_DB_URL` = the pooler connection string composed in §3.2. It
    must authenticate as `aktflow_service_login` — not as
    `aktflow_app_login`, and not as a superuser/`postgres` connection.

    A superuser connection would pass migration 0035's database-side
    guard silently: `pg_has_role(session_user, 'aktflow_service',
    'member')` is true for a superuser too, so a `SERVICE_DB_URL`
    mistakenly pointed at one would look correct at the database layer
    while writing server-attested facts (inspection verdicts,
    server-sourced capture events) from a connection nobody meant to
    grant that power to. The application does not rely on the database
    to catch this alone — `withServiceTx` (`packages/database/src/tx.ts`)
    asserts `session_user = 'aktflow_service_login'` at the start of
    every service transaction, so a wrong `SERVICE_DB_URL` (superuser,
    app login, or anything else) fails closed with an explicit error at
    the first service write instead of going unnoticed.
- Domain: `app.aktflow.com`

### `apps/landing`

- Root directory: `apps/landing`
- Framework preset: Next.js
- Build command: default (Vercel monorepo auto-detect) or
  `cd ../.. && pnpm turbo run build --filter=@aktflow/landing`
- Install command: `pnpm install` (repo root)
- Environment variables: none required — `apps/landing` is static-first
  and contains no API routes and no Supabase server client (see
  `apps/landing/next.config.ts`).
- Domain: `aktflow.com`

### 4.1 pnpm + Turborepo build settings (both projects)

- Vercel auto-detects pnpm from `pnpm-lock.yaml` + `packageManager` in the
  root `package.json` (`pnpm@9.12.0`) — no manual override needed for the
  package manager itself.
- Set an **Ignored Build Step** per project so a push touching only the
  other app (or only docs) doesn't trigger a redundant deploy:
  ```
  npx turbo-ignore
  ```
  (run from each project's root directory setting — `turbo-ignore` reads
  the project name from `apps/app/package.json` /
  `apps/landing/package.json` and diffs against the last successful
  deploy for that project using Turborepo's task graph, so a change to
  `packages/ui` correctly triggers `apps/landing` but a change to
  `apps/app/app/v1/organizations/route.ts` alone does not trigger
  `apps/landing`.)

## 5. Deploy

Push to the branch each Vercel project is configured to track (or trigger
a manual deploy from the Vercel dashboard). Confirm both builds succeed
and `app.aktflow.com` / `aktflow.com` resolve once DNS is pointed at
Vercel.

## 6. End-to-end verification checklist

Run this against the **staging** Supabase project + the deployed
`apps/app`, not local. Record actual results (row counts, header values,
timings) — a checked box with no evidence is not verification.

1. **Create an Auth user.** In the staging Supabase dashboard →
   Authentication → Users → Add user (or via the Auth API). Obtain a
   session/access token for that user (e.g. via the Auth REST API's
   password-grant endpoint, or the dashboard's "impersonate" flow if
   available). Call this user **A**.

2. **Bootstrap an organization.**
   ```bash
   curl -i -X POST https://app.aktflow.com/v1/organizations \
     -H "Authorization: Bearer <A's access token>" \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: $(uuidgen)" \
     -d '{"legalName":"Staging Verify LLC","displayName":"Staging Verify"}'
   ```
   - [ ] Response status is **201**.
   - [ ] Response has an `Idempotency-Replay-Until` header (an ISO
     timestamp in the future) — set by `apps/app/app/v1/organizations/route.ts`.
   - [ ] Response body has `organizationId`, `membershipId`,
     `role: "owner"`, `version: 1`.

3. **Repeat the exact same request (same `Idempotency-Key`, same body).**
   - [ ] Response status is still **201** (a replay, not a new create) with
     the **same** `organizationId`/`membershipId` as step 2.
   - [ ] `select count(*) from organizations where id = '<organizationId>'`
     in the SQL editor is **1**, not 2 — the retry did not create a second
     org.

4. **Repeat with the same `Idempotency-Key` but a different body**
   (e.g. change `displayName`):
   - [ ] Response status is **409** with problem-type `code:
     IDEMPOTENCY_CONFLICT` (see `packages/database/src/idempotency.ts` /
     `technical/error-catalog.csv`).

5. **Read back tenant context.**
   ```bash
   curl -i https://app.aktflow.com/v1/me/context \
     -H "Authorization: Bearer <A's access token>"
   ```
   - [ ] Response status **200**.
   - [ ] The organization created in step 2 appears in the response with
     role `owner`.

6. **Confirm audit + outbox rows, and that the cron drain runs.**
   In the SQL editor, immediately after step 2:
   ```sql
   select count(*) from audit_events where organization_id = '<organizationId>';
   -- expect 1
   select id, processed_at from transaction_outbox where organization_id = '<organizationId>';
   -- expect 1 row, processed_at is NULL right after creation
   ```
   Wait ~30 seconds (the `outbox-drain` cron job's schedule — confirmed
   present in §2.1), then re-run the second query:
   - [ ] `processed_at` is now set (non-null) on that row, without any
     manual intervention — proves `cron.schedule('outbox-drain', '30
     seconds', ...)` is actually running on staging, not just present in
     `cron.job`.

7. **Cross-tenant isolation.** Create a second Auth user, **B**, who has
   never been added to A's organization. Obtain B's access token and:
   ```bash
   curl -i https://app.aktflow.com/v1/me/context \
     -H "Authorization: Bearer <B's access token>"
   ```
   - [ ] B's `organizations` list does **not** include the org created in
     step 2 (empty list, or only orgs B legitimately created/joined).
   - [ ] Optionally, attempt B reading A's org directly at the DB level
     (mirrors `packages/testing/src/rls.test.ts`'s local RLS suite) and
     confirm zero rows — RLS policies from `0004_rls_policies.sql` should
     behave identically on staging since the schema is identical.

8. **Confirm a finalize succeeds using the service credential.** This
   checklist otherwise never exercises `SERVICE_DB_URL` — the org
   bootstrap/context/isolation checks above all run on `APP_DB_URL`
   alone — but finalize is the one request path that does, and it is
   exactly what §3.2 warns goes silently missing if that variable is
   unset or misconfigured. Standing up an evidence-capable
   project/work-assignment/upload-intent is outside what this
   organizations-only checklist covers (see
   `packages/testing/src/m2-service-principal.test.ts` for the shape of
   that setup); once one exists, call:
   ```bash
   curl -i -X POST https://app.aktflow.com/v1/upload-intents/<intentId>/finalize \
     -H "Authorization: Bearer <A's access token>"
   ```
   - [ ] Response status is **200**, not 500. A 500 here with no other
     symptom is exactly what a missing or wrong `SERVICE_DB_URL`
     produces — either `getServicePool()` throwing because the variable
     is unset, or `withServiceTx`'s `session_user` assertion failing
     because it points at the wrong role (§3.2, §4).

If every box above is checked with real evidence pasted into the PR/ops
log, staging is verified end-to-end. Do not mark this done from local
results alone — local Postgres and hosted Supabase can diverge in
`pg_cron` availability, connection pooling, and role/grant edge cases,
which is exactly what §2.1 and §2.2 exist to catch.

---

## Status

**Staging has not been provisioned or verified as of this writing.** This
repo's environment has no GitHub remote, no Vercel account, and no
Supabase cloud project connected — Tasks 1-12 of the P0a slice-1 plan were
built and verified entirely against the local Supabase stack
(`supabase start` / `supabase db reset`, `pnpm turbo run
typecheck|test|build`). This runbook is written so a human operator with
real Supabase/Vercel accounts can execute it later; none of its steps
have been run against a real staging project. See
`.superpowers/sdd/2026-07-24-p0a-slice1-skeleton-tenancy-core/task-12-report.md`
for the local substitute proof that was run instead.
