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
secret; DB URL, publishable key, and secret key are). Store them in a
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
real domain, and this repository forbids inventing one.** The rule was first
written down in the retired `apps/demo`'s README (deleted 2026-08-20; the
principle outlives the file): nothing in this repository shows that any such
domain is registered or that anyone controls its DNS, and «it needs a decision
from whoever owns the registration question». A token is the honest
representation of a decision that has not been taken; a plausible-looking
`goproceed.com` would read as settled fact.

**There is deliberately no CI gate on these two tokens**, unlike the ones in
`apps/demo/src`, which `apps/demo/qa/preflight.mjs` fails the build over. That
gate existed because those tokens had to be replaced *before a deploy
published them to a visitor* (the demo and its preflight are retired; the
distinction still explains why THESE two are ungated). These two are instructions to a human operator, and an
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
   - **publishable key** — Project Settings → API → **Publishable key**, the
     `sb_publishable_…` value. This is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
     (The dashboard also still shows a legacy `anon` JWT; do not use it — it
     stops working at the end of 2026, and this repo moved to the new form on
     2026-08-19.)
   - **secret key** — Project Settings → API → **Secret keys**, an `sb_secret_…`
     value. This is `SUPABASE_SECRET_KEY`. (Likewise not the legacy
     `service_role` JWT.)
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

## 3. Set the `goproceed_app_login`, `goproceed_service_login` and `goproceed_purge_worker_login` passwords on staging (mandatory, do this now)

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
§3.2 for `goproceed_service_login` — before any traffic is allowed through. The order for rotating these and every other deployment secret, and what to do after a leak, is [secret-rotation.md](secret-rotation.md).

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
   generated secret — `openssl rand -hex 24` (hex on purpose: the secret
   goes into a URL in step 3, and hex needs no percent-encoding, where a
   base64 `+`/`/`/`=` silently would):
   ```sql
   alter role goproceed_app_login password '<generated-secret>';
   ```
2. Record `<generated-secret>` in the password manager alongside the
   project ref. Never commit it, and never reuse the local dev value
   (`app_pw` — set only by `supabase/seed.sql`, which a *default* `db
   push` never runs, but the prohibited commands listed at the top of
   this section do) here.
3. Compose `APP_DB_URL` for the app deployment using that password and
   the **Session pooler** host/port from §1 — Project Settings → Database
   → Connection string → Session pooler shows
   `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`;
   take ONLY the host and port from it and put our role and our secret in:
   ```
   postgresql://goproceed_app_login.<project-ref>:<generated-secret>@<pooler-host>:5432/postgres
   ```
   **The `.<project-ref>` suffix on the username is not optional.** The
   shared pooler (Supavisor) is multi-tenant and routes by that suffix —
   `postgres.<project-ref>` in Supabase's own string, and for our role
   `goproceed_app_login.<project-ref>`. Without it the pooler answers
   «Tenant or user not found». (Until 2026-08-19 this line showed the
   username without the suffix — read from memory, not from the docs;
   https://supabase.com/docs/guides/database/connecting-to-postgres.)
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
   freshly generated secret (`openssl rand -hex 24` again; do not reuse the
   `goproceed_app_login` secret from §3.1 — the two logins must not share a
   password):
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
   and the same Session pooler host/port as §3.1, with the same
   `.<project-ref>` suffix on the username:
   ```
   postgresql://goproceed_service_login.<project-ref>:<generated-secret>@<pooler-host>:5432/postgres
   ```
   `packages/database/src/pool.ts`'s `getServicePool()` reads this
   verbatim from `SERVICE_DB_URL` at request time — no other code path
   composes it, and it must never be the same value as `APP_DB_URL`.
4. Do not proceed to §4 until this step and §3.1 above are both
   complete — there is no working `SERVICE_DB_URL` to configure the
   deployment with otherwise.

### 3.3 `goproceed_purge_worker_login` and `CRON_SECRET` (DEV-036, after `0090`)

The evidence purge (INV-047: orphaned and expired upload bytes deleted within
24 hours) runs as its own login, which can execute the five
`app.*upload*purge*` functions and nothing else (migration `0090`). Vercel
Cron calls `GET /internal/evidence/purge` four times a day
(`apps/app/vercel.json`; Hobby allows one run a day per expression, anywhere in
its hour) with `Authorization: Bearer <CRON_SECRET>`. Crons run on
**production** deployments only, and this project builds production only.

**If this step is skipped**, the deploy preflight refuses the build (both
names are required). If the variables are set but `0090` is not applied, every
scheduled run answers 500 and the bytes stay.

1. Once `0090` is applied, set a **third** freshly generated secret (`openssl
   rand -hex 24`; never the §3.1 or §3.2 value, never `purge_pw`):
   ```sql
   alter role goproceed_purge_worker_login password '<generated-secret>';
   ```
2. Record it in the password manager as its own entry.
3. Compose `PURGE_DB_URL` with the same Session pooler host and `.<project-ref>`
   username suffix as §3.1:
   ```
   postgresql://goproceed_purge_worker_login.<project-ref>:<generated-secret>@<pooler-host>:5432/postgres
   ```
   The worker refuses any other login (`withPurgeWorkerTx` checks
   `session_user`), a superuser's included.
4. Generate `CRON_SECRET` (32+ characters, e.g. `openssl rand -hex 32`) and set
   it, with `PURGE_DB_URL`, in the Vercel project (§4.3). Vercel sends it on
   every cron call; the route refuses every call while it is unset or short.
5. After the next production deploy, check **Settings → Cron Jobs**: four
   entries on `/internal/evidence/purge`. Trigger one (**Run**, or `vercel crons
   run /internal/evidence/purge`) and read its log: 200 with counts, or 500
   `purge_attention_required` with counts and a request id. A 500 that persists
   means a row failed five times or has waited past 24 hours:
   `select id, status, purge_attempts, purge_failure from public.upload_intents
    where purged_at is null and purge_attempts >= 5;` names it.

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
| Function region | `arn1` (Stockholm) | `apps/app/vercel.json` `regions` | **Co-location with the database is a latency decision, not a preference.** With no `regions` field a project falls to the account default `iad1` (Ashburn, US) while the Supabase project is `eu-north-1` (Stockholm) — ~6,600 km, ~95–115 ms per round trip. Measured 2026-08-20: server-side calls reached Supabase Auth from `us-east-1` IPs via Cloudflare colo IAD; GoTrue's own `/user` handler took 2.8 ms p50 while the gateway observed 136 ms p50 — the difference is the Atlantic. One «Мої доручення» render makes ~3 `getUser` calls + 2 pooler connects + 21 SQL statements, most of them serial, so each ~100 ms round trip is paid several times over. Set it to the Vercel region matching the Supabase region; if the database ever moves, move this too |
| Ignored build step | `VERCEL_ENV` ≠ `production` → exit 0 (skip); else `npx turbo-ignore @goproceed/app` | `vercel.json` `ignoreCommand` | Production only for the pilot — every push to a PR branch would otherwise build a Preview against the Preview environment, which §4.3 does not fill; and within Production, a push touching only `apps/demo` or docs does not redeploy the app. Overrides the dashboard's Ignored Build Step (Vercel docs) — so set it here, not there |
| Pre-build gate | `apps/app/scripts/deploy-preflight.mjs` | `package.json` `prebuild` | **refuses to build** on Vercel if any variable in §4.3 is unset or carries a local value — silent in CI and locally |
| Every §4.3 name in the build's env | all twelve in `turbo.json` `build.env` | `turbo.json` | Turborepo's strict env mode hands the build task ONLY the names declared there, and the preflight runs inside that task. Until 2026-08-19 only the three `NEXT_PUBLIC_*` names were declared, and the first real Vercel build reported nine variables "unset" that WERE set on the project. Values enter the cache key as a hash, so a build cached with a complete environment is not replayed after a variable is removed — which is also why a CHANGED origin cannot replay a cached bundle with the old one baked in |

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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | build | the `sb_publishable_…` key | §1 → Project Settings → API → Publishable key |
| `NEXT_PUBLIC_APP_ORIGIN` | build | `https://{{APP_HOSTNAME}}` — **the exact origin, https, no path** | §0 |
| `APP_DB_URL` | runtime | `postgresql://goproceed_app_login.<project-ref>:<secret-1>@<pooler-host>:5432/postgres` — `<secret-1>` is the password YOU set in §3.1 | §3.1 |
| `SERVICE_DB_URL` | runtime | same shape as `goproceed_service_login.<project-ref>` with `<secret-2>` from §3.2 — **a different role and password from `APP_DB_URL`** | §3.2 |
| `PURGE_DB_URL` | runtime | same shape as `goproceed_purge_worker_login.<project-ref>` with the §3.3 secret — **a third role and password** | §3.3 |
| `CRON_SECRET` | runtime | 32+ random characters; Vercel Cron sends it as the Bearer token to `/internal/evidence/purge` | §3.3 |
| `SUPABASE_URL` | runtime | same host as `NEXT_PUBLIC_SUPABASE_URL` | §1 |
| `SUPABASE_SECRET_KEY` | runtime | an `sb_secret_…` key | §1 → Project Settings → API → Secret keys. **Server secret. Never `NEXT_PUBLIC_`.** |
| `EXTERNAL_LINK_ORIGIN` | runtime | `https://{{APP_HOSTNAME}}` | same as the app origin |
| `EXTERNAL_LINK_HMAC_KEYS` | runtime | `<keyId>:<base64 32+ bytes>` | generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `EXTERNAL_LINK_ACTIVE_KEY_ID` | runtime | that `<keyId>` | |
| `EXTERNAL_SESSION_HMAC_KEYS` | runtime | a DIFFERENT generated key | |
| `EXTERNAL_SESSION_ACTIVE_KEY_ID` | runtime | that `<keyId>` | |
| `FIELD_CLIENT_ORIGINS` | runtime | OPTIONAL: comma-separated exact origins | Plan C; unset = CORS layer off, `/v1` behaves exactly as before; set only when the Expo-web field client origin exists |

**Three of these were undocumented until 2026-08-18 and would have failed the
first deploy quietly.** `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are read
by `src/lib/evidence-storage.ts`, which defaults them to the LOCAL stack — a
deploy that set only the previously documented variables would have aimed
every evidence upload at `127.0.0.1:54321` on the server. And
`NEXT_PUBLIC_APP_ORIGIN` was documented but not in `turbo.json`'s build cache
key, so a redeploy to a different hostname could have served the old origin
from cache. The preflight checks all three; `.env.example` explains all three.

**The four `EXTERNAL_*` values are GENERATED, not fetched from anywhere.** They
are the HMAC keys that sign the protected external link (the bearer URL a
party outside the workspace opens to act on a stage — `src/lib/external-link.ts`)
and its session cookie (`src/lib/external-session.ts`). There is no default
and there must not be one: a default key is a key in every deployment that
forgot to set one. Make two DIFFERENT secrets, one per pair:

```bash
node -e "console.log('k1:' + require('crypto').randomBytes(32).toString('base64'))"
```

Run it twice. The first output is `EXTERNAL_LINK_HMAC_KEYS` and the second is
`EXTERNAL_SESSION_HMAC_KEYS` (each is `<keyId>:<base64 of 32+ random bytes>`;
several keys may be listed comma-separated for rotation); both
`*_ACTIVE_KEY_ID` are then `k1`. Mark the two `*_HMAC_KEYS` Sensitive. Later
rotation is why the key id exists: add `k2:…` to the list, move the active id
to `k2`, and links signed under `k1` still verify (INV-044). [secret-rotation.md](secret-rotation.md) §«External-link and session HMAC keys» has the full order, including when the old id may be removed.

**Two names changed on 2026-08-19, and the dashboard will happily keep the old
ones.** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is now `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
and `SUPABASE_SERVICE_ROLE_KEY` is now `SUPABASE_SECRET_KEY` — and the values
moved with them, to the `sb_publishable_…` / `sb_secret_…` keys the same API
page shows beside the legacy JWTs. A project that still carries the old names
fails the preflight with both new names reported unset (the old names are not
read by anything any more), and a new name carrying a legacy `eyJ…` JWT is
refused by name. Rename in the dashboard; do not add a second copy.

**Preview deployments need a `NEXT_PUBLIC_APP_ORIGIN` too**, and it cannot be
the production one: `resolveBaseOrigin` returns it verbatim, so a Preview built
with the Production origin would self-fetch across deployments with the
session cookie attached. Either set the Preview scope to the Vercel preview
hostname pattern you actually use, or — simplest for a pilot — **do not build
Previews at all, which is what the repository does**: `apps/app/vercel.json`'s
`ignoreCommand` exits 0 («ignore this build») for every `VERCEL_ENV` other
than `production`, and runs `turbo-ignore` only for Production. Two things
about that, both read from the current Vercel docs on 2026-08-19: **there is
no «disable Preview Deployments» switch in Settings → Git** (that page holds
the repository connection, LFS, deploy hooks and verified commits — an earlier
revision of this runbook named a toggle that does not exist); the dashboard's
equivalent is Settings → **Build and Deployment → Ignored Build Step → «Only
build production»**, and **`vercel.json`'s `ignoreCommand` overrides that
dashboard setting**, so while the file carries one, the dashboard choice does
nothing — the rule lives in the file on purpose, where a commit can change it.
A skipped build shows as CANCELED in Deployments, not as a failure, and the
preflight never runs for it. To build Previews later: set every §4.3 variable
for Preview (with a Preview origin) AND drop the `VERCEL_ENV` guard from
`ignoreCommand` in the same commit.

### 4.4 `apps/landing` — a second project, deployed 2026-08-20 under ADR-009

**Previously (until 2026-08-20):** this section was titled «optional, and not
part of the P0» and described `apps/landing` as a static-first Next app that
would be deployed only if time permitted. It is now a live Vercel project,
provisioned on 2026-08-20 as a pilot for the Vercel MCP's project-creation
flow (ADR-009).

**Created:** Project `goproceed-landing` (Vercel ID `prj_hoBlVEmml70Ap5X2alvKtPUToQpj`)
linked to GitHub repository `akisly/go-proceed`, root directory `apps/landing`,
production branch `main`. Created 2026-08-20 via the Vercel MCP
(`create_git_project`/`deploy_to_vercel` tools) with the owner watching; no manual
dashboard configuration was performed.

**Environment (added 2026-09-05, the Daylight landing):** the pilot form's
handler reads `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RESEND_API_KEY`,
`PILOT_TO_EMAIL`, `PILOT_FROM_EMAIL` — set at least one channel's pair in the
dashboard for Production. Owner action; nothing else in the project changed.

**First production deployment:** `dpl_CnUUmJCiCcJfd5qt4j8mN1fhkZU1`, deployed from
commit `c77891f` (2026-08-20, before `apps/landing/vercel.json` had merged).
Vercel's pnpm-workspace auto-detection installed at the repo root automatically,
because `apps/landing` did not yet have its own `vercel.json`. The committed
`vercel.json` (added by this branch) will govern builds after merge, making
install/build explicit instead of inferred. Build succeeded and reached READY in
~50 seconds.

**Aliases and measured response (2026-08-20):**
- Canonical: `https://goproceed-landing.vercel.app`
- Dashboard alias: `goproceed-landing-akislys-projects.vercel.app`
- Git-main alias: yes (automatic)
- Measured at canonical:
  ```
  HTTP/2 200
  content-type: text/html; charset=utf-8
  x-vercel-id: arn1::…
  ttfb 0.29 s
  <title>GoProceed — Evidence-to-payment operating layer</title>
  ```

**Deployment Protection difference — MCP-created vs dashboard:** Unlike §5.4's
trap for the `apps/app` project (which ships with Vercel Authentication ON), a
project created via the Vercel MCP shipped with `ssoProtection.enabled=false` —
Vercel Authentication OFF. The next operator need not open Deployment Protection
for this project unless a custom domain is attached; the vercel.app alias is
reachable by anyone. This difference is MCP-specific, not a general Vercel
change: the dashboard flow still creates projects with the authentication trap.

**Hostname:** `{{LANDING_HOSTNAME}}` remains a token; no custom domain has been
decided. The canonical `goproceed-landing.vercel.app` is the origin for now.

**Environment variables:** none. `apps/landing` is a static-rendered site with no
build-time or runtime secrets.

### 4.5 `apps/mobile` — the field client (`goproceed-field`)

**Created:** Project `goproceed-field` (Vercel ID `prj_q0pHp3k54YSlqw0CZUIylZ56FGBg`)
linked to GitHub repository `akisly/go-proceed`, root directory `apps/mobile`,
production branch `main`. Created 2026-08-21 via the Vercel MCP, **link-only** —
the same creation path §4.4 used for `goproceed-landing`, and with the same
consequence that follows from it: `apps/mobile/vercel.json` (Task 7, commit
`ed94d19`) exists only on branch `claude/expo-field-client`, not on `main`. A
build triggered from `main` today is doomed before it starts — there is no
build/install command for Vercel to detect, because the config arrives WITH
the branch, at merge. The first real deploy waits on two things together:
the owner's environment steps below, and this branch's PR merging.

**Deployment Protection, read back:** all OFF. Same MCP-created pattern §4.4
already recorded for `goproceed-landing` (`ssoProtection.enabled=false`) — a
project created through the Vercel MCP does not ship with Vercel
Authentication on, unlike the dashboard-created default that traps
`apps/app` in §5 step 4. No dashboard action is needed for this setting on
`goproceed-field` either.

**The `vercel.json` contract** (`apps/mobile/vercel.json`):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm --filter @goproceed/tokens generate && pnpm --filter @goproceed/mobile exec expo export --platform web && node apps/mobile/scripts/finalize-web-html.mjs",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "rewrites": [{ "source": "/:path*", "destination": "/" }]
}
```

Three moving parts, in build order. `expo export --platform web` produces a
SPA — this project sets no explicit `web.output`, so Expo's default `single`
mode applies, one `index.html` for every route — hence the `rewrites` entry
sending every path back to it. `pnpm --filter @goproceed/tokens generate`
runs first so the exported bundle carries current tokens. `node
apps/mobile/scripts/finalize-web-html.mjs` runs LAST, as a post-export patch —
**renamed from `set-html-lang.mjs` on 2026-08-21**, when the script grew from
setting `lang="uk"` alone to also injecting `<link rel="manifest">`, `<meta
name="theme-color">`, the `apple-mobile-web-app-*` trio and `<link rel=
"apple-touch-icon">` into the exported `dist/index.html` (§"Installable"
below) — the name now describes what it does, not just its first job. And
**not the first thing tried.** Expo Router's documented root-document
customization point is `src/app/+html.tsx`; it was tried first and measured,
not assumed, to do nothing here: with that file in place, `expo export
--platform web` produced a `dist/index.html` byte-identical to the one
produced without it — still `lang="en"`. The docs describe `+html.tsx` under
STATIC rendering (`web.output: "static"`); this project runs the default
`single` (SPA) mode, which does not honour the file at all. So the script is
the honest fallback: a direct string replacement on the one `index.html` a
`single`-mode export produces, and it fails loudly (`process.exit(1)`) if the
`lang="en"` pattern it targets is absent, rather than shipping the wrong
`<html lang>` silently.

**Installable (2026-08-21).** `apps/mobile/public/manifest.webmanifest` —
name «GoProceed — польовий клієнт», `short_name` "GoProceed", `lang: "uk"`,
`display: "standalone"` — plus `icons/icon-192.png`, `icon-512.png`, and a
`purpose: "maskable"` `icon-maskable-512.png`, generated once from
`assets/icon.png` and committed (no build-time image dependency), and a
separate `apple-touch-icon.png` (180×180) that `finalize-web-html.mjs` links
from `<head>`. Colours are read from `@goproceed/tokens`' light theme, not
invented for the manifest: `background_color` `#ECE9DF` (`bg-canvas`),
`theme_color` `#0C0C0A` (`action-primary-bg`). `apps/mobile/public/` is
copied byte-for-byte into `dist/` by `expo export --platform web`
(docs.expo.dev/deploy/web, read 2026-08-20), and Vercel serves it under the
project's filesystem-before-rewrite routing — a static file under
`outputDirectory` answers before `vercel.json`'s SPA `rewrites` entry ever
fires, which is exactly the mechanism this depends on: the manifest is a real
file on disk at `dist/manifest.webmanifest`, not a route the rewrite could
swallow. **To verify on the live origin after this branch merges and
deploys:**
```bash
curl -sI https://goproceed-field.vercel.app/manifest.webmanifest
```
expect a `content-type` containing `application/manifest+json`. **Before this
change it answered `200 text/html`** — the SPA rewrite catching the request
because no manifest file existed on disk at all (measured 2026-08-21, the gap
this task closes; see `docs/superpowers/plans/2026-08-21-field-client-installable.md`).

**Install hint (2026-08-21, browser matrix and dwell gate added 2026-08-21).**
`src/screens/install-hint.tsx`, mounted once in `src/app/_layout.tsx` beneath
the `Stack` for every route, offers installation in one tap where the
platform allows it and states the only honest alternative — per browser —
where it does not
(`docs/superpowers/plans/2026-08-21-install-hint.md`,
`docs/superpowers/plans/2026-08-21-install-hint-ios-browsers.md`).

*Browser matrix* — `installHintVariant` (`src/lib/install-hint.ts`) resolves
one of four outcomes:

| Browser | Variant | What it shows | Gated on |
| --- | --- | --- | --- |
| Chromium — desktop and Android Chrome, or any other browser implementing `beforeinstallprompt` | `chromium` | Bottom banner («Встановити GoProceed на телефон?»), «Встановити» calls the browser's own install dialog from the deferred `beforeinstallprompt` event | Chrome's own engagement heuristic (a tap plus roughly 30 seconds, MDN, read 2026-08-21) — this build has no opinion on when that fires, only reacts once it has |
| iPhone/iPad Safari | `ios-safari` | «Натисніть «Поділитися» ↓ внизу екрана, потім «На Початковий екран».» — Share is the bottom-centre toolbar button | 10s dwell (below) |
| Chrome-for-iOS (`CriOS`) | `ios-chrome` | «Натисніть «Поділитися» ↗ біля адресного рядка (або меню ⋮), прокрутіть униз і виберіть «На Початковий екран».» — Share sits beside the address bar at the top, or in the «⋮» menu | 10s dwell |
| Every other iOS browser (Firefox-for-iOS/`FxiOS`, Edge-for-iOS/`EdgiOS`, …) | `ios-other` | «Відкрийте меню «Поділитися» вашого браузера та виберіть «На Початковий екран».» — no verified Share-control location for these, so no directional pointer is given | 10s dwell |

No iOS browser ever fires `beforeinstallprompt`, and none exposes a
programmatic install API at all — WebKit blog 13878 (read 2026-08-21)
confirms every third-party iOS browser adds web apps to the Home Screen
"from the Share menu" too, since 16.4, because Apple requires every one of
them to run on WebKit. `classifyIOSBrowser` (`src/lib/install-hint.ts`) is
the pure UA classifier behind the three iOS rows above: `CriOS` → chrome,
`FxiOS` → firefox (folded into `ios-other`), `EdgiOS` → other, anything else
on an iPhone/iPad/iPod UA → Safari.

*The 10-second dwell gate.* Unlike Chromium, no iOS browser gates its
Share/Add-to-Home-Screen gesture on engagement at all — without a gate of
this app's own, an iOS variant would render at first paint, on every visit,
before a foreman has even read the page. `IOS_DWELL_THRESHOLD_MS` (10,000ms)
is timed off `sessionStorage["goproceed.installHint.firstSeenAt"]`, written
once on first mount so a reload mid-visit does not reset the clock; Chromium
ignores it entirely; since Chrome has already done its own engagement gating
before `hasPromptEvent` can become true, gating it a second time here would
be redundant, not safer.

Every variant remembers a «Не зараз» tap for seven days (`localStorage`) and
none renders once the app is already running installed (`display-mode:
standalone`, or on iOS `navigator.standalone === true`).

**Owner's verification item, still open.** The Ukrainian label for Apple's
"Add to Home Screen" menu item used throughout this section —
«На Початковий екран» — is this task's best-effort translation, not a
label read off a device. **Before this copy is trusted in production, the
owner must open the Share sheet on a real iPhone set to the Ukrainian
system locale, read the exact label Apple ships there, and update
`technical/copy-catalog.csv`'s `hint.install.body_ios_safari` /
`_ios_chrome` / `_ios_other` rows (and `src/lib/install-hint.ts`'s matching
constants) if it differs** — a prior row here once carried «На екран
Домой», a Russianism corrected without ever having been checked against a
device either; this note exists so the same mistake is not repeated a third
time.

Verifying the browser-matrix behaviour required working around two things
measured rather than assumed. First: this repo's pinned Chrome for Testing
(`puppeteer` 25.8.0, `HeadlessChrome/152`) fires `beforeinstallprompt` on any
page meeting the install criteria within roughly 150-250ms of load, with no
tap and no dwell at all — nothing like the engagement heuristic real Chrome
documents — so `qa/field-web.mjs`'s `withPage` suppresses that event on
every page it opens (a capture-phase listener registered before the bundle's
own script runs, calling `stopImmediatePropagation()`). Second: `localStorage`
(unlike `sessionStorage`) is shared across every page opened against the
same origin, not scoped to one tab, so a dismissal («Не зараз») tap made by
one check would silently gate every following check for an unrelated
reason unless cleared first — the harness now issues a one-time CDP
`Storage.clearDataForOrigin` call before each load rather than a
per-document script, which would also wipe out the same check's own
dismissal write right before its own reload assertion reads it back. What
this makes possible: an iPhone Safari UA load — pre-seeded 20s past the
dwell gate via `evaluateOnNewDocument` (wrapped in try/catch, since Chrome
re-runs that script on an interim placeholder document per navigation that
denies storage access) — asserting the `ios-safari` body, both pressables
≥44×44, «Не зараз» hiding it and the dismissal surviving a reload; a second,
otherwise-identical load with an iPhone Chrome UA (`CriOS/`) asserting the
`ios-chrome` body; and a third load on the same Safari UA with NO pre-seed,
asserting the banner stays absent — the dwell gate's own negative proof —
all running deterministically against the same "not yet engaged" baseline a
first-time visitor is actually in, rather than racing this file's own
`await`s or the real 10-second clock.

**iOS storage-partition note, for §6.9 item 5.** A home-screen web app on iOS
runs in its own storage partition, separate from Safari's — so the FIRST
launch from the installed icon signs in again even though the tester was
already signed in in Safari; that first re-login is expected, not a defect.
What §6.9 item 5 ("confirm the session survived") means is relaunch-to-relaunch
of the already-installed app — close it, reopen it from the home screen a
second time, and the session should still be there — not Safari-to-installed-app
continuity, which iOS does not provide.

**Owner's dashboard steps, still to run — verbatim.**

On `goproceed-field` → Settings → Environment Variables, **Production**, all
three, and they must be present at **BUILD time** — Metro inlines
`EXPO_PUBLIC_*` the same way Next.js inlines `NEXT_PUBLIC_*` (§4.2 step 4);
setting them only after a build already happened is too late:

- `EXPO_PUBLIC_SUPABASE_URL=https://asrvzhjaueyvrfozxpzo.supabase.co`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_DheHWf443RiuOjXMu0AkZw_rAwhG3wt`
- `EXPO_PUBLIC_API_ORIGIN=https://goproceed-app.vercel.app`

On `goproceed-app` → add `FIELD_CLIENT_ORIGINS=https://goproceed-field.vercel.app`
(Production), then redeploy. Plan B's CORS layer (§4.3's `FIELD_CLIENT_ORIGINS`
row) is unset-means-off, so `/v1` will not answer the field client
cross-origin until this is set and a deployment carrying it is live.

Then two curls verify the wire, not just the dashboard settings:

```bash
curl -i -X OPTIONS https://goproceed-app.vercel.app/v1/projects \
  -H "Origin: https://goproceed-field.vercel.app" \
  -H "Access-Control-Request-Method: GET"
# expect Access-Control-Allow-Origin: https://goproceed-field.vercel.app (echoed, not *)

curl -i https://goproceed-field.vercel.app/
# expect 200 text/html; charset=utf-8, with <html lang="uk" in the body
```

**Measured 2026-08-21, after the owner set both environments and redeployed
(the #38 deployment — see the trap below):** preflight → `HTTP/2 200`,
`access-control-allow-origin: https://goproceed-field.vercel.app`, methods
`GET, POST, PUT, PATCH, DELETE, OPTIONS`, headers
`authorization, content-type, idempotency-key, x-request-id`, max-age 86400;
the layering fact — unauthenticated `GET /v1/projects` with the field Origin →
`HTTP/2 401`, `content-type: application/problem+json` **and**
`access-control-allow-origin` on the same response, served from `arn1`; the
field origin → `200 text/html; charset=utf-8`, ttfb 0.36 s, `<html lang="uk"`,
and its entry bundle carries the staging Supabase URL, the publishable key and
`https://goproceed-app.vercel.app` with **no** `127.0.0.1` leak — so the
`EXPO_PUBLIC_*` values were present at BUILD time, which is the only time that
matters for them.

**Two traps met on the way, both Vercel's, both now known.** (1) A merge of
this branch with two parallel landing commits produced a `pnpm-lock.yaml` that
`--frozen-lockfile` rejected (`ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` on
expo's peer-suffixed key); every project shares that install command, so all
three production builds from that merge died at install. A plain
`pnpm install` repaired it in three structural lines (PR #38). (2) **A
lockfile-only commit is «unaffected» to turbo-ignore**, so the repair's own
push was CANCELED for every project — and so was the app's, whose
`ignoreCommand` runs the same check. Env-variable changes never trigger a
build either. Both mean the same thing: after setting a variable or repairing
the lockfile, go to Deployments and **Redeploy the deployment of the commit you
actually want** — the owner's first redeploy picked the #37 row (still the
broken lockfile) and errored again; the #38 row was the right one.

**Hostname:** `*.vercel.app`, like the other two pilot surfaces — no custom
domain has been decided for this one either (§0).

## 5. Deploy

1. **Attach the domain first**: Project Settings → Domains → add
   `{{APP_HOSTNAME}}`, and point DNS at Vercel as it instructs. The origin has
   to exist BEFORE the build that bakes it in, or the value you set in §4.3 is a
   promise about a hostname that does not resolve.
2. Trigger a deploy — push to `main`, or Deployments → Redeploy.
3. **Read the build log for the preflight line before anything else.** A
   healthy build prints
   `deploy preflight (VERCEL_ENV=production): OK — origin, Supabase, database and external-link variables are all present and non-local.`
   near the top. If instead it prints `REFUSING TO BUILD`, it lists every
   variable that is missing or local; fix them all in §4.3 and redeploy. Do not
   work around it — it is telling you the bundle would not have worked.
   **Read the environment in the parentheses.** With the `ignoreCommand` in
   `vercel.json` (§4.1) a push to a PR branch is SKIPPED — the deployment shows
   CANCELED and the preflight never runs — so the line you read is from a
   Production build. If you ever see `(VERCEL_ENV=preview)` there, the guard
   was removed: a Preview build reads the Preview column of Project Settings →
   Environment Variables, and a variable set for Production only is ABSENT
   there. **Read the second half of each «is unset» line too** — it says
   ABSENT (not set for this environment, or not declared in `turbo.json`) or
   PRESENT BUT EMPTY (the name exists with no value; a Sensitive value cannot
   be read back, only replaced — Edit it and enter one). Measured 2026-08-19:
   six variables the operator had created, scoped to Production AND Preview,
   were reported unset on a Preview build, and the first reading of that was
   «Production-only scoping». The dashboard showed it was not; the names were
   present and the values were not. The distinction is in the message now so
   that reading never has to be guessed again.
4. **Open Deployment Protection before you open the URL.** A new Vercel
   project ships with **Vercel Authentication** on, in a mode that protects
   every URL except custom domains — and the `*.vercel.app` production alias
   is NOT a custom domain. Measured 2026-08-19 on the first successful
   production deployment: every path, `/login` included, answered `302` to
   `vercel.com/sso-api`, i.e. only a logged-in Vercel team member could open
   the client. Project Settings → **Deployment Protection** → Vercel
   Authentication → **«Only Preview Deployments»** (Previews are skipped by
   `ignoreCommand` anyway), or attach a custom domain, which is exempt. Docs:
   https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication
   (API values `prod_deployment_urls_and_all_previews` | `all` | `preview`;
   the Vercel MCP reports the default as `all_except_custom_domains`). This
   runbook did not mention the setting until that day.
5. Confirm `https://{{APP_HOSTNAME}}/login` renders the OTP form over TLS. This
   is the first moment the field client is reachable by a person who is not at a
   developer's keyboard, and it is the P0 of `TODOS.md` closing. Measured
   2026-08-19 at `https://goproceed-app.vercel.app` (and the
   `goproceed-app-akislys-projects.vercel.app` alias): `/` → 307
   `/login?next=%2F`, `/login` → 200 `text/html` with HSTS and the form
   (`#otp-email`, «Надіслати код»), `/assignments` → 307 to login,
   `/v1/projects` → 401 `application/problem+json`; the client bundle carries the
   staging Supabase URL and `sb_publishable_…` key and no local value.

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
   requires physical devices. **Dated pointer, 2026-08-21:** per ADR-009,
   the five boxes below are now measured against the Expo client at
   `goproceed-field` (§4.5) on these same two phones, not against this PWA —
   the PWA remains the pilot's deployed field client in service until that
   measurement passes. **Before it: custom SMTP.** Read from the
   current Supabase docs on 2026-08-19
   (https://supabase.com/docs/guides/auth/auth-smtp): the default email
   service is «2 messages per hour» and «Unless you configure a custom SMTP
   server for your project, Supabase Auth will refuse to deliver messages to
   addresses that are not part of the project's team.» So the owner's own
   address gets a code (twice an hour); an invited foreman's address gets
   nothing until Authentication settings → SMTP is configured (30/hour to
   start, raised on the Rate Limits page). **Done 2026-08-19/20: Brevo custom
   SMTP** (`smtp-relay.brevo.com:587`, single-sender gmail — Brevo rewrites
   the From to its `<account>.brevosend.com` fallback, so SPF/DKIM align);
   the closed P1 in `TODOS.md` records what was proven and the one thing
   deliberately not measured (delivery to a non-team address from THIS
   project — accepted by owner decision). On the pilot iPhone and the pilot Android
   (`TODOS.md` §"the pilot-device inventory does not exist" — buy them if they
   are still not bought):
   - [x] `https://{{APP_HOSTNAME}}/login` renders; enter an invited member's
     email; the 6-digit code arrives; sign-in lands on «Мої доручення». —
     **Done 2026-08-19 20:34 UTC on a laptop, not yet on a phone**, at
     `https://goproceed-app.vercel.app`, by the owner — the code email went
     through **Brevo custom SMTP**, per the delivered email's own headers
     (DKIM `11932482.brevosend.com`; an earlier revision credited the built-in
     service, corrected 2026-08-20): Auth logs show `mail.send` →
     `POST /verify` → `login` (`login_method: otp`), `last_sign_in_at` set,
     and Supavisor authenticating `goproceed_app_login` for the page's
     `/v1/projects` self-fetch; the screen was the empty state («У вас немає
     доступу до жодного проєкту»), correct for a user with no grant. Two
     dashboard prerequisites this step did not list: the hosted «Magic Link»
     template must contain `{{ .Token }}` (the default is a link with no code),
     and the user must exist (`shouldCreateUser: false`) — Authentication →
     Users → Create user. Repeat on the two phones for the rest of this step.
     **Also done on iPhone Safari, 2026-08-21**, at
     `https://goproceed-field.vercel.app` — the Expo field client (§4.5), not
     this PWA — the invited member's email, 6-digit code, and sign-in landing
     on «Мої доручення» all repeated there; the code again arrived through
     **Brevo custom SMTP**.
   - [ ] Open one assignment; the довідковий disclaimer is visible; every
     control is at least 44×44 CSS px (measure with the browser's inspector at
     375 px, or trust `qa/field.mjs`'s identical assertion, which passed in CI —
     but the point of this step is a REAL engine, not headless Chrome).
     **Partial, 2026-08-21, on iPhone (Expo client):** the disclaimer renders
     unconditionally and was visible. The 44×44 sweep itself was NOT done
     with a real inspector on this pass — only `apps/mobile/qa/field-web.mjs`'s
     equivalent assertion against the exported build, which is headless
     Chrome, not the real engine this step exists to use. Left unchecked; the
     real-engine 44×44 measurement is still owed.
   - [x] Take a photo through the capture control; the unsaved-photo banner is
     up while it uploads and the receipt (device time / server time / SHA-256)
     renders after. `crypto.subtle` requires this to be https — a plain-http
     origin fails here, silently, which is why §4.3 forbids one. —
     **Measured on iPhone (Expo client), 2026-08-21 08:55 UTC:** upload
     intent came back `available`, `image/jpeg`, **2 870 686 bytes**; the
     evidence object was created 3.6 s later carrying the same SHA-256
     (`de82ef4e…`); the receipt rendered. One prerequisite this uncovered:
     the staging demo world's original seed line had no `work_type_key`, so
     materialisation produced zero occurrences and there was nothing to
     photograph against — re-seeded 2026-08-21 the way the product itself
     creates one (rule version → bind on a DRAFT version → publish →
     assignment → occurrence), not by hand-inserting a row.
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

## 7. Manual erasure of a Telegram identity

M0 gate 4 asks for a manual deletion procedure exercised on synthetic data.
This is the identity-level half of it — one person, one workspace — added
with migration `0081`. Workspace closure is a separate procedure and is not
written yet.

**What it does.** Every message that person sent in the workspace's project
groups keeps its row and its links to attachments, cards and decisions, but
its `provider_user_id` becomes a negative surrogate, its name and username
snapshots become NULL, its text becomes `[текст стерто на запит]`, its edit
history is redacted the same way, its member link is revoked and surrogated,
and its attachment filenames are cleared. One audit row `telegram_identity.erased`
records the surrogate and the counts — never the identifier. The registry
`app.telegram_erasures` keeps an HMAC of the person under an erasure key, with
that key's id, so a repeat is idempotent (migration `0085`).

**Run it** on a machine holding the target environment's `SERVICE_DB_URL`,
`TELEGRAM_ERASURE_HMAC_KEYS` and `TELEGRAM_ERASURE_ACTIVE_KEY_ID`. The erasure
keys live on operator machines only, never in a deployment, and the list keeps
every key id the workspace's registry holds — the command refuses otherwise
([secret-rotation.md](secret-rotation.md) «Telegram link and erasure HMAC keys»):

```bash
pnpm --filter @goproceed/app exec node scripts/telegram-erase-identity.mjs \
  --workspace <workspace uuid> --telegram-user-id <telegram user id>
```

It prints one JSON line: `surrogate_user_id`, `messages`, `events`, `links`,
`attachments`, `pending_updates_for_subject`, `already_erased`. Exit 1 with
the message on any error; nothing is half-erased — the whole transaction rolls
back.

**If `pending_updates_for_subject` is not 0**, the worker still holds updates
from this person. The erasure that ran is complete; run the same command again
after `POST /internal/telegram/jobs` has drained the inbox. The HMAC yields the
same surrogate. This counter is per bot, not per workspace — a person still
active in another workspace on the same bot keeps it above zero, and that
alone is not a reason to run the command again.

**If the command fails with «the subject was linked again after an earlier
erasure in this workspace…»**, the person linked again after being erased
and the definer refuses the new link's erasure until the owner decides how
to handle it (`TODOS.md` P2, "a repeat erasure after the subject re-links is
refused, not resolved") — nothing was written by that call.

**Record** the date, workspace, surrogate and counts where the partner's
requests are tracked. Never record the identifier next to the surrogate.

**Never** run this against a database you have not been asked to run it
against; there is no dry run, and erased rows are not restorable by design.

---

## Status

**2026-08-19 — provisioned, deployed, and public at the Vercel alias; the §6
evidence is not yet recorded.** Supabase project `asrvzhjaueyvrfozxpzo`
(eu-north-1): 58/58 migrations, `pg_cron` present, 140 policies, 53/53 tables
with RLS, both `goproceed_*_login` passwords set (SCRAM, different). Vercel
project `goproceed-app`: twelve variables present and non-local (the production
build printed the preflight's `OK` line), `ignoreCommand` builds Production
only, Vercel Authentication on Previews only. `GET /login` answers 200 over TLS
at `https://goproceed-app.vercel.app` (canonical; the long alias serves the same
deployment), and the owner has signed in through it once (§6.9, laptop) —
`{{APP_HOSTNAME}}` remains a token; no custom domain yet. Still open, each tracked in `TODOS.md`:
§6.1–6.8 (the owner's `curl`s — they carry a bearer token), §6.9 (two phones),
and custom SMTP, without which no address outside the Supabase team receives
the code. The paragraph below is the state as of 2026-08-18 and is kept as the
record of how far the repository alone could go.

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
