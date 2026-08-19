# Staging provisioning runbook — GoProceed

This is an executable runbook for a human operator with a Supabase account
and a Vercel account. Nothing in this repo automates it, and nothing in
this repo has run it yet (see "Status" at the bottom). It provisions:

1. A staging Supabase project with the full migration chain applied — **58
   files, `0001` through `0058`** as of 2026-08-18. This document said
   «0001-0005» until that date; it was written for the P0a foundation slice
   and the chain grew under it. Re-read the number from
   `ls supabase/migrations | wc -l` rather than from here.
2. A Vercel project for **`apps/app`** — the API and, since 2026-08-11, the
   PWA field client a foreman opens on a phone. This is the P0 of `TODOS.md`:
   the client is built, merged and green in CI, and **nothing serves it on the
   public internet until this runbook has been run.** `apps/landing` is a
   second, optional project and is covered separately in §4.
3. A verification pass that proves the same vertical slice this repo tests
   locally (`POST /v1/organizations` → `GET /v1/me/context`, audit +
   outbox + cron drain, tenant isolation) also works against staging — plus,
   new with the field client, one signed-in foreman opening «Мої доручення»
   on a real phone at the real origin (§6 step 9).

Do not commit any secret produced by these steps (project ref is not
secret; DB URL, anon key, and service_role key are). Store them in a
password manager and in Vercel's encrypted environment variables only.

---

## 0. The two hostnames this runbook does not know

`{{APP_HOSTNAME}}` and `{{LANDING_HOSTNAME}}` are PLACEHOLDERS, in the same
style as `{{CONTACT_EMAIL}}` and `{{DEMO_HOSTNAME}}` elsewhere in this
repository. Substitute your own values everywhere they appear below —
including in every `curl` of §6 — before running anything.

| Token | What it is | Example shape |
|---|---|---|
| `{{APP_HOSTNAME}}` | the host `apps/app` answers on — the field client and `/v1` | `app.example.com` |
| `{{LANDING_HOSTNAME}}` | the host `apps/landing` answers on | `example.com` |

**They were literal until 2026-08-17, and they were the WRONG literal.** This
runbook spelled the pre-rename product's domain in nine places, including every
verification `curl`. The product was renamed to GoProceed on 2026-08-03;
these were the last customer-facing instructions still naming the old one, so
an operator following this document would have provisioned a domain for a
product that no longer exists — at the one moment where that mistake is
expensive, because DNS and a Vercel domain binding are not free to undo.

**They are tokens rather than corrected literals because nobody has decided the
real domain, and this repository forbids inventing one.**
`apps/demo/README.md` §2 states it directly: nothing here shows that any such
domain is registered or that anyone controls its DNS, and «it needs a decision
from whoever owns the registration question». A token is the honest
representation of a decision that has not been taken; a plausible-looking
`goproceed.com` would read as settled fact.

**There is deliberately no CI gate on these two tokens**, unlike the ones in
`apps/demo/src`, which `apps/demo/qa/preflight.mjs` fails the build over. That
gate exists because those tokens must be replaced *before a deploy publishes
them to a visitor*. These two are instructions to a human operator, and an
unreplaced token in an instruction is the instruction working as intended —
gating it would make CI permanently red, which `preflight.mjs`'s own header
argues against in terms: «a suite that is red by design trains everyone to
ignore red». What IS gated is the reverse: `staleDomainErrors` in
`scripts/validate-canonical-docs.mjs` fails the build if an old `aktflow.*` domain
returns to a live file.

---

## 1. Create the staging Supabase project

1. In the Supabase dashboard, create a new project named `goproceed-staging`
   (region: pick the one closest to `{{APP_HOSTNAME}}`'s expected traffic).
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
(`supabase login`). **Use the pinned version** — `.supabase-cli-version` at the
repo root, `2.115.0` as of 2026-08-18 — because it is the version every
migration in this chain has been proved against in CI, and `pnpm db:check-cli`
tells you whether yours matches. Pushing 58 migrations to a real project with a
CLI that CI has never run is a way to meet a CLI-default difference for the
first time on staging (HANDOFF.md §0 records one such difference costing three
red CI runs; that is the cheap place to meet it).

```bash
supabase link --project-ref <project-ref>
supabase db push
```

This applies `supabase/migrations/0001_core_tenancy.sql` through the last file
in that directory (`0058_the_privilege_no_trigger_could_see.sql` as of
2026-08-18) in order, exactly as `supabase db reset` does locally. Two files
worth knowing about before you push, because they are the ones that behave
differently from «create a table»: `0057` RENAMES the five PostgreSQL roles
from their pre-rename spelling to `goproceed_*` — on a fresh project it creates
the old names in `0003`/`0034` and renames them in `0057`, which looks redundant
and is exactly right; and `0058` REVOKES `TRUNCATE` from `service_role` on
every table in `public`, which is why the operator must never rely on the
service key to truncate anything. A plain `supabase db push` (as run above, with no flags) does
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
it's absent, the migration only `raise notice`s and skips silently. A clean
`db push` is therefore not sufficient proof the extension is present. After
pushing, check explicitly in the SQL Editor:

```sql
select extname, extversion from pg_extension where extname = 'pg_cron';
-- expect one row

select jobid, jobname from cron.job where jobname = 'outbox-drain';
-- expect ZERO rows — read on
```

**The `outbox-drain` job is expected to be ABSENT, and this section said the
opposite until 2026-08-19.** `0005` scheduled it; **`0036_retire_outbox_drain_cron`
unscheduled it deliberately**, because `drain_outbox` had no lease check and
raced the real claim protocol `0008` built (`app.claim_outbox` /
`complete_outbox` / `fail_outbox`) — it could mark a row processed while a
correct consumer held a live lease on it. So on a database with the full chain
applied, `cron.job` correctly has no such row, and an operator following the old
text («expect exactly one active row») would have gone looking for something
that is meant to be gone. What §2.1 still legitimately proves is that `pg_cron`
itself loaded — measured 2026-08-19 on `goproceed-staging`: `pg_cron 1.6.4`,
zero drain jobs, exactly as `0036` intends.

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
supabase db push   # first apply — should report 58 migrations applied (count the directory)
supabase db push   # second apply, immediately after — should report
                    # "Remote database is up to date" / 0 migrations
                    # applied, and exit 0
```

Then confirm nothing was duplicated:

```sql
select count(*) from cron.job where jobname = 'outbox-drain'; -- expect 0 (0036 retired it; see §2.1)
select count(*) from pg_extension where extname = 'pg_cron';  -- expect 1
select max(version) from supabase_migrations.schema_migrations; -- expect '0058' (or the current last file)
```

If either apply exits non-zero, or the second `push` offers to apply anything
at all, treat that as a migration bug and stop — do not proceed to §3 against
a staging DB in an unknown state.

## 3. Set the `goproceed_app_login` and `goproceed_service_login` passwords on staging (mandatory, do this now)

**Never run any of the following against this (or any real) Supabase
project. Each one destroys and rebuilds, or reseeds, the target database:**

> This warning used to say the danger was `supabase/seed.sql` setting
> `goproceed_app_login`'s password to the known dev value `app_pw`. That stopped
> being true when the password moved out of `seed.sql` into
> `scripts/set-local-app-password.mjs`, which refuses non-local hosts — read
> the first lines of `supabase/seed.sql` and you will see it sets no password
> at all. The prohibition still stands, for a bigger reason: these commands
> rebuild the database. An operator who checks the stated reason, finds it
> false, and concludes the rule is stale would destroy staging.


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

None of the above is scoped to `goproceed_app_login` alone: a
`db reset --linked` rebuilds the whole database from
`supabase/migrations`, which carries no password for
`goproceed_service_login` either (migration `0034_service_principal_role.sql`
creates it exactly like `0003` creates `goproceed_app_login` — LOGIN, no
password, on purpose). Running any of these commands against staging or
production is just as unsafe for the service login as for the app login.

If any of the above is ever run against staging or production, treat
`goproceed_app_login`'s password as compromised — it will have been reset
to `app_pw` — and treat `goproceed_service_login`'s password as lost (reset
to no password, so the service connection goes inert rather than
compromised to a known value). Immediately re-run the rotation steps
below for whichever role was affected — §3.1 for `goproceed_app_login`,
§3.2 for `goproceed_service_login` — before any traffic is allowed through.

**Do not skip or defer either step below.** Migration
`0003_roles_and_grants.sql` creates the `goproceed_app_login` LOGIN role,
and migration `0034_service_principal_role.sql` creates the
`goproceed_service_login` LOGIN role, both with **no password at all** —
`supabase db push` never sets one for either, on purpose. Nothing can
password-authenticate as `goproceed_app_login` or `goproceed_service_login`
until you set a secret here, which is intentional: it means a freshly
pushed staging database is inert (unreachable by the app, and unreachable
by the server's own service connection) rather than reachable with a
known default, and §4-§5 below (creating the Vercel deployment, which
needs both `APP_DB_URL` and `SERVICE_DB_URL`) cannot meaningfully proceed
until both steps below are done.

Membership in the `goproceed_app` role **is** full tenant-table
read/write privilege: `app.actor_user_id` is a plain session GUC that
any connection authenticated as `goproceed_app_login` can set via `set
local role goproceed_app` (see `packages/database/src/tx.ts`), and RLS
policies key off that GUC, not off any secondary secret. There is no
second gate — anyone who has this password can read and write every
tenant's `organizations`, `memberships`, `legal_entities`,
`audit_events`, `transaction_outbox` and `idempotency_records` rows.
Treat it as a top-tier secret, equivalent in blast radius to a database
admin credential for tenant data — not as a low-stakes app-connection
password.

### 3.1 `goproceed_app_login`

1. Open the staging project's SQL Editor and run, with a freshly
   generated secret (e.g. `openssl rand -base64 24`):
   ```sql
   alter role goproceed_app_login password '<generated-secret>';
   ```
2. Record `<generated-secret>` in the password manager alongside the
   project ref. Never commit it, and never reuse the local dev value
   (`app_pw` — set only by `supabase/seed.sql`, which a *default* `db
   push` never runs, but the prohibited commands listed at the top of
   this section do) here.
3. Compose `APP_DB_URL` for the app deployment using that password and
   the **pooler** host/port from §1, e.g.:
   ```
   postgresql://goproceed_app_login:<generated-secret>@<pooler-host>:<pooler-port>/postgres
   ```
   `packages/database/src/pool.ts` reads this verbatim from `APP_DB_URL`
   at request time — no other code path composes it.
4. Do not proceed to §4 (creating the Vercel projects / setting their
   `APP_DB_URL`) until this step and §3.2 below are complete — there is
   no working `APP_DB_URL` to configure them with otherwise.

### 3.2 `goproceed_service_login`

Migration `0034_service_principal_role.sql` creates `goproceed_service`
(NOLOGIN, a member of `goproceed_app`) and `goproceed_service_login` (LOGIN,
a member of `goproceed_service` and nothing else), with no password, for
the same reason as `goproceed_app_login` above. `goproceed_service_login` is
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
   freshly generated secret (do not reuse the `goproceed_app_login`
   secret from §3.1 — the two logins must not share a password):
   ```sql
   alter role goproceed_service_login password '<generated-secret>';
   ```
2. Record `<generated-secret>` in the password manager alongside the
   project ref, as its own entry distinct from `goproceed_app_login`'s.
   Never commit it, and never reuse the local dev value (`service_pw` —
   set only by `scripts/set-local-app-password.mjs` against a local
   database, and refused by that script against any non-local host)
   here.
3. Compose `SERVICE_DB_URL` for the app deployment using that password
   and the **pooler** host/port from §1, e.g.:
   ```
   postgresql://goproceed_service_login:<generated-secret>@<pooler-host>:<pooler-port>/postgres
   ```
   `packages/database/src/pool.ts`'s `getServicePool()` reads this
   verbatim from `SERVICE_DB_URL` at request time — no other code path
   composes it, and it must never be the same value as `APP_DB_URL`.
4. Do not proceed to §4 until this step and §3.1 above are both
   complete — there is no working `SERVICE_DB_URL` to configure the
   deployment with otherwise.

## 4. Create the Vercel project for `apps/app`

**Everything Vercel needs to know about HOW to build is in the repository
already** — `apps/app/vercel.json` — so the dashboard steps below are about
WHICH repository, WHICH directory, and WHAT SECRETS. Do not retype build
settings into the dashboard; the file is authoritative and the dashboard
should show it as detected.

### 4.1 What the repository has decided for you

| Setting | Value | Where it lives | Why |
|---|---|---|---|
| Framework | Next.js | `apps/app/vercel.json` | |
| Install | `cd ../.. && pnpm install --frozen-lockfile` | `vercel.json` | pnpm workspaces install at the ROOT; installing inside `apps/app` alone cannot resolve `@goproceed/*` |
| Build | `cd ../.. && pnpm turbo run build --filter=@goproceed/app` | `vercel.json` | Turborepo's `dependsOn: ["^build"]` builds `@goproceed/database`, `domain`, `contracts` first |
| Ignored build step | `npx turbo-ignore @goproceed/app` | `vercel.json` | a push touching only `apps/demo` or docs does not redeploy the app |
| Pre-build gate | `apps/app/scripts/deploy-preflight.mjs` | `package.json` `prebuild` | **refuses to build** on Vercel if any variable in §4.3 is unset or carries a local value — silent in CI and locally |
| Origin in the build cache | `NEXT_PUBLIC_APP_ORIGIN` in `turbo.json` `build.env` | `turbo.json` | without it, a build with a CHANGED origin could replay a cached bundle with the old one baked in |

### 4.2 Dashboard steps

1. **Add New → Project → Import** the `go-proceed` GitHub repository.
2. **Root Directory: `apps/app`.** This is the one setting `vercel.json`
   cannot set for itself, and everything else keys off it — Vercel reads
   `apps/app/vercel.json` only once the root is that directory.
3. Confirm the detected framework is Next.js and the install/build commands
   match the table above. If the dashboard proposes anything else, the root
   directory is wrong.
4. **Do not deploy yet.** Add the environment variables in §4.3 first —
   `NEXT_PUBLIC_*` values are inlined at build time, and a first deploy without
   them produces a bundle that renders its error screen on every authenticated
   page and cannot be fixed by setting them afterward. (The preflight will
   refuse such a build, which is the point — but let it pass first time.)

### 4.3 Environment variables — Production AND Preview, every one

The complete contract, with reasoning per variable, is
`apps/app/.env.example`. Set each of these in **Project Settings → Environment
Variables**, for **both** Production and Preview:

| Variable | Kind | Value | Source |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | build | `https://<project-ref>.supabase.co` | §1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build | the `anon` `public` key | §1 → Project Settings → API |
| `NEXT_PUBLIC_APP_ORIGIN` | build | `https://{{APP_HOSTNAME}}` — **the exact origin, https, no path** | §0 |
| `APP_DB_URL` | runtime | pooler string as `goproceed_app_login` | §3.1 |
| `SERVICE_DB_URL` | runtime | pooler string as `goproceed_service_login` — **a different role and password from `APP_DB_URL`** | §3.2 |
| `SUPABASE_URL` | runtime | same host as `NEXT_PUBLIC_SUPABASE_URL` | §1 |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | the `service_role` key | §1 → Project Settings → API. **Server secret. Never `NEXT_PUBLIC_`.** |
| `EXTERNAL_LINK_ORIGIN` | runtime | `https://{{APP_HOSTNAME}}` | same as the app origin |
| `EXTERNAL_LINK_HMAC_KEYS` | runtime | `<keyId>:<base64 32+ bytes>` | generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `EXTERNAL_LINK_ACTIVE_KEY_ID` | runtime | that `<keyId>` | |
| `EXTERNAL_SESSION_HMAC_KEYS` | runtime | a DIFFERENT generated key | |
| `EXTERNAL_SESSION_ACTIVE_KEY_ID` | runtime | that `<keyId>` | |

**Three of these were undocumented until 2026-08-18 and would have failed the
first deploy quietly.** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are read
by `src/lib/evidence-storage.ts`, which defaults them to the LOCAL stack — a
deploy that set only the previously documented variables would have aimed
every evidence upload at `127.0.0.1:54321` on the server. And
`NEXT_PUBLIC_APP_ORIGIN` was documented but not in `turbo.json`'s build cache
key, so a redeploy to a different hostname could have served the old origin
from cache. The preflight checks all three; `.env.example` explains all three.

**Preview deployments need a `NEXT_PUBLIC_APP_ORIGIN` too**, and it cannot be
the production one: `resolveBaseOrigin` returns it verbatim, so a Preview built
with the Production origin would self-fetch across deployments with the
session cookie attached. Either set the Preview scope to the Vercel preview
hostname pattern you actually use, or — simplest for a pilot — **do not build
Previews at all**: Settings → Git → uncheck «Preview Deployments» until there
is a second environment worth having.

### 4.4 `apps/landing` — optional, and not part of the P0

`apps/landing` is a static-first Next app with no API routes and no Supabase
client (`apps/landing/next.config.ts`). It has NO `vercel.json` of its own and
nothing in the P0 depends on it. If it is deployed:

- Root directory `apps/landing`, framework Next.js, install at the repo root
  (`cd ../.. && pnpm install --frozen-lockfile`), build
  `cd ../.. && pnpm turbo run build --filter=@goproceed/landing`.
- Environment variables: none.
- Domain: `{{LANDING_HOSTNAME}}`.

It is listed for completeness, not urgency. A foreman opening the field client
does not touch it.

## 5. Deploy

1. **Attach the domain first**: Project Settings → Domains → add
   `{{APP_HOSTNAME}}`, and point DNS at Vercel as it instructs. The origin has
   to exist BEFORE the build that bakes it in, or the value you set in §4.3 is a
   promise about a hostname that does not resolve.
2. Trigger a deploy — push to `main`, or Deployments → Redeploy.
3. **Read the build log for the preflight line before anything else.** A
   healthy build prints
   `deploy preflight: OK — origin, Supabase, database and external-link variables are all present and non-local.`
   near the top. If instead it prints `REFUSING TO BUILD`, it lists every
   variable that is missing or local; fix them all in §4.3 and redeploy. Do not
   work around it — it is telling you the bundle would not have worked.
4. Confirm `https://{{APP_HOSTNAME}}/login` renders the OTP form over TLS. This
   is the first moment the field client is reachable by a person who is not at a
   developer's keyboard, and it is the P0 of `TODOS.md` closing.

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
   curl -i -X POST https://{{APP_HOSTNAME}}/v1/organizations \
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
   curl -i https://{{APP_HOSTNAME}}/v1/me/context \
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
   -- expect 1 row, processed_at is NULL
   ```
   - [ ] The audit row exists and the outbox row exists with `processed_at`
     **still NULL** — and it STAYS null. **This step said the opposite until
     2026-08-19**: it told the operator to wait ~30 seconds for the
     `outbox-drain` cron to set `processed_at`, and to read «still null» as a
     failure. That job was retired by `0036` (see §2.1) because it raced the
     real claim protocol; nothing on staging consumes the outbox yet, by design.
     On this database the old check would have failed forever. What this step
     now proves is the write path only: the command enqueued exactly one row and
     recorded exactly one audit event, in the same transaction, for the same
     organization.

7. **Cross-tenant isolation.** Create a second Auth user, **B**, who has
   never been added to A's organization. Obtain B's access token and:
   ```bash
   curl -i https://{{APP_HOSTNAME}}/v1/me/context \
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
   curl -i -X POST https://{{APP_HOSTNAME}}/v1/upload-intents/<intentId>/finalize \
     -H "Authorization: Bearer <A's access token>"
   ```
   - [ ] Response status is **200**, not 500. A 500 here with no other
     symptom is exactly what a missing or wrong `SERVICE_DB_URL`
     produces — either `getServicePool()` throwing because the variable
     is unset, or `withServiceTx`'s `session_user` assertion failing
     because it points at the wrong role (§3.2, §4).

9. **Open the field client on a real phone, at the real origin.** This is
   the step the earlier eight cannot substitute for, and the reason ADR-007
   requires physical devices. On the pilot iPhone and the pilot Android
   (`TODOS.md` §"the pilot-device inventory does not exist" — buy them if they
   are still not bought):
   - [ ] `https://{{APP_HOSTNAME}}/login` renders; enter an invited member's
     email; the 6-digit code arrives; sign-in lands on «Мої доручення».
   - [ ] Open one assignment; the довідковий disclaimer is visible; every
     control is at least 44×44 CSS px (measure with the browser's inspector at
     375 px, or trust `qa/field.mjs`'s identical assertion, which passed in CI —
     but the point of this step is a REAL engine, not headless Chrome).
   - [ ] Take a photo through the capture control; the unsaved-photo banner is
     up while it uploads and the receipt (device time / server time / SHA-256)
     renders after. `crypto.subtle` requires this to be https — a plain-http
     origin fails here, silently, which is why §4.3 forbids one.
   - [ ] **Record ADR-007's two required measurements**, per engine, in the M2
     measurement table: whether the engine stripped or transcoded EXIF from the
     uploaded bytes (compare the SHA-256 on screen with a hash of the original
     taken off the device), and how the engine honours the `capture` attribute
     (camera opened directly, or a chooser). These are the measurements the
     decision said MUST be made rather than assumed, and this is the first
     moment they can be.
   - [ ] Add the app to the home screen (the manifest is served); reopen it
     from there; confirm the session survived.

If every box above is checked with real evidence pasted into the PR/ops
log, staging is verified end-to-end — and, for the first time, the P0 of
`TODOS.md` is closed: a foreman can open the client. Do not mark this done from local
results alone — local Postgres and hosted Supabase can diverge in
`pg_cron` availability, connection pooling, and role/grant edge cases,
which is exactly what §2.1 and §2.2 exist to catch.

---

## Status

**Staging has not been provisioned or verified as of this writing — and
this document being rewritten (2026-08-18) did not change that.** What the
rewrite changed is that everything the REPOSITORY can decide about the
deployment is now decided and checked in — `apps/app/vercel.json`, the deploy
preflight, the complete environment contract in `.env.example`, the build-cache
key — so that provisioning is one sitting of credentialed steps by the operator,
each of which either works or is refused with the reason named. The steps that
need an account, a domain and a phone are still the operator's, and none of them
has been taken. This
repo's environment has no GitHub remote, no Vercel account, and no
Supabase cloud project connected — Tasks 1-12 of the P0a slice-1 plan were
built and verified entirely against the local Supabase stack
(`supabase start` / `supabase db reset`, `pnpm turbo run
typecheck|test|build`). This runbook is written so a human operator with
real Supabase/Vercel accounts can execute it later; none of its steps
have been run against a real staging project. See
`.superpowers/sdd/2026-07-24-p0a-slice1-skeleton-tenancy-core/task-12-report.md`
for the local substitute proof that was run instead.
