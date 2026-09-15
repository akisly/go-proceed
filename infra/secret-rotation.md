# Secret rotation — GoProceed

How to replace every secret the deployments hold, in an order that does not take them down, and what to do when one leaks. Readiness gate 14 («Environment and secrets», `docs/delivery/production-readiness.md`) asks for this runbook; [DEV-010](../docs/tasks/DEV-010-m0-gate14-evidence.md) wrote it on 2026-09-15 from the instructions that used to live only inside [README-staging.md](README-staging.md), and revised it after that task's security review.

**Nothing here has been exercised against a hosted project.** Every step names the source it rests on; steps marked *(unverified)* rest on no vendor page read on 2026-09-15 — read the vendor's current documentation before running them. Vendor dashboards move.

## Where the secrets live

| Store | What it holds | Notes |
|---|---|---|
| The owner's password manager | Every generated value, as its own dated entry | The source every other store is filled from |
| Vercel project `goproceed-app` | The app's deployment variables | Vercel keeps **Production, Preview and Development** scopes separately; README-staging §4.3 asked for every variable in Production **and** Preview, so both hold values. List each scope with `vercel env ls production`, `vercel env ls preview`, `vercel env ls development` ([Managing environment variables across environments](https://vercel.com/docs/environment-variables/manage-across-environments), updated 2026-08-20). Sensitive values «are only available in production and preview environments»; `vercel pull` writes a scope's values to `.vercel/.env.<environment>.local`, so a hosted secret found in Development is removed (`vercel env rm <NAME> development`), not updated |
| Vercel project of `apps/landing` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RESEND_API_KEY`, `PILOT_*` | Its own bot, separate from the channel's bot (owner, 2026-09-15) |
| **Every Vercel deployment already built** | The values its scope held **when it was built** | A variable change reaches only new deployments ([Environment variables](https://vercel.com/docs/environment-variables), updated 2026-08-20). Older production deployments keep old values, and an Instant Rollback brings them back: «Vercel won't update environment variables if you change them in the project settings and will roll back to a previous build» ([Instant Rollback](https://vercel.com/docs/instant-rollback), updated 2026-07-07) |
| Supabase project `asrvzhjaueyvrfozxpzo` | Role passwords, the `postgres` password, API keys, Auth SMTP credentials | |
| Operator machines | `SERVICE_DB_URL`, `TELEGRAM_ERASURE_HMAC_KEYS` and `TELEGRAM_ERASURE_ACTIVE_KEY_ID` while running `apps/app/scripts/telegram-erase-identity.mjs` (README-staging §7). The erasure keys live here only, never in a Vercel project | Supply them per command from the password manager; do not keep them in a file or shell history |
| Local development | `apps/*/.env.local` (git-ignored, `.gitignore:15`) and the local Supabase stack | Loopback-only role passwords `app_pw` / `service_pw` from `scripts/set-local-app-password.mjs`, which refuses any non-loopback host; the published local Supabase demo keys; the `dev1` HMAC keys in `apps/app/.env.example` |
| CI | `.github/workflows/ci.yml` `env` | Loopback values against a disposable stack; `ci-placeholder-publishable-key` |

**There is one hosted environment.** Staging, the pilot and `goproceed-app.vercel.app` share one Supabase project. Preview builds are skipped by `apps/app/vercel.json`'s `ignoreCommand`, but that is not isolation: the command is read from the commit being deployed, so a push that edits it builds a Preview against the same database with the Preview scope's values. When a separate production project exists (`docs/delivery/pilot-execution-runbook.md` §10 Q-9), it gets its own generated values for every row below — never a copy.

## Inventory

| Secret | What it opens | Rotation shape |
|---|---|---|
| `postgres` database password | Owner of the database; bypasses RLS; used for `supabase db push` and one-off `psql` | Replace in place |
| `goproceed_app_login` password, inside `APP_DB_URL` | Every tenant's rows (README-staging §3: membership in `goproceed_app` is full tenant-table read/write) | Replace in place |
| `goproceed_service_login` password, inside `SERVICE_DB_URL` | Every service-sourced record | Replace in place, a value different from the app role's |
| `SUPABASE_SECRET_KEY` (`sb_secret_…`) | «Secret keys bypass Row Level Security and have full access to your data» ([Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)); evidence originals in Storage; admin operations | Create a second key, switch, delete the old one |
| Legacy `service_role` / `anon` JWTs | The same as a secret key, while they stay active (both forms answered on the hosted project per the comment in `apps/app/scripts/deploy-preflight.mjs`, undated; not re-observed) | Deactivate them; see the Supabase section |
| Auth SMTP credential (Brevo) | Sending mail as the project: every sign-in code | Regenerate at Brevo, replace in Supabase Auth SMTP settings *(unverified)* |
| `EXTERNAL_LINK_HMAC_KEYS` + `EXTERNAL_LINK_ACTIVE_KEY_ID` | Signing external review links (`apps/app/src/lib/external-link.ts`) | Add a key id, move the active id, retire the old id after 7 days |
| `EXTERNAL_SESSION_HMAC_KEYS` + `EXTERNAL_SESSION_ACTIVE_KEY_ID` | Signing external session cookies | The same, in its own key space, retire after 12 hours |
| `TELEGRAM_BOT_TOKEN` (the channel's bot; the landing's own bot) | Controlling that bot, including where its webhook points | Revoke in @BotFather |
| `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WORKER_SECRET` | Posting updates into the webhook; triggering `POST /internal/telegram/jobs` | Replace, redeploy, re-register the webhook |
| `TELEGRAM_LINK_HMAC_KEYS` + `TELEGRAM_LINK_ACTIVE_KEY_ID` | Link-token verifiers | Add a key id, move the active id, retire the old id 15 minutes after that deploy |
| `TELEGRAM_ERASURE_HMAC_KEYS` + `TELEGRAM_ERASURE_ACTIVE_KEY_ID` (operator machines only) | The erasure registry's `subject_hmac` | Add a key id and move the active id; **keep every earlier key** — see its section |
| `RESEND_API_KEY` | Sending mail from the landing's domain | Create a second key, switch, delete the old one |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public by design | Replace like a secret key if the project's keys are reissued |
| Operator access: Vercel and Supabase account tokens, GitHub access | Everything above, by changing it | **Not written here.** Revoke per vendor; it is the first thing a store-level leak touches |

No channel secret (`TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WORKER_SECRET`, `TELEGRAM_LINK_HMAC_KEYS`, the channel's bot token, nor the `TELEGRAM_LINK_PEPPER` they replaced) is set on any hosted environment yet: the webhook stays off until BL-024 closes. Whether the landing's delivery variables are set is the owner's record, not this document's.

## The order, for every secret

Vercel documents rotation as: generate the new credential without invalidating the old one, edit the variable, redeploy, verify, then invalidate the old credential ([Rotating environment variables](https://vercel.com/docs/environment-variables/rotating-secrets), updated 2026-07-15).

1. **Generate** the new value and store it in the password manager first, as its own dated entry. Use the generator the section names; never type a secret by hand.
2. **Keep the old value valid**, unless it has leaked.
3. **Edit** the variable in **Production and Preview** where they hold it, marked Sensitive. A Sensitive value cannot be read back, only replaced (README-staging §4.3). If Development holds a hosted secret, remove it there instead: Sensitive values exist only in Production and Preview, and Development values are written to developers' disks.
4. **Redeploy** Production. The deploy preflight refuses a build whose variables it can see are unusable (`apps/app/scripts/deploy-preflight.mjs`). Its HMAC-key messages name the entry by position and never the key; for a wrongly shaped Supabase key it prints the first 10–12 characters, so do not paste a different secret into a Supabase key's variable.
5. **Verify** the new deployment: README-staging §6 for the app, one test submission for the landing form.
6. **Invalidate** the old value at its source. Mark its password-manager entry revoked with the date; keep it only where a section below says to.
7. **Never roll back past a rotation.** An Instant Rollback serves an older deployment with the old values.

## Database role passwords

The database holds one password per role, so old and new cannot overlap. Changing a password does not, by itself, end sessions that are already open: PostgreSQL's `ALTER ROLE` page says nothing about existing sessions, and terminating them is the way to be sure. Rotate in a quiet window, in this order, so the outage lasts only from step 3 to step 5:

1. Generate: `openssl rand -hex 24` (hex, because it goes into a URL; README-staging §3.1).
2. Compose the URL with the Session pooler host and the `.<project-ref>` username suffix exactly as README-staging §3.1 and §3.2 show, and edit `APP_DB_URL` or `SERVICE_DB_URL` in Vercel. Nothing changes until a redeploy.
3. Set the password **without sending it as SQL text**: connect with `psql` as `postgres` and run `\password goproceed_app_login` (or `goproceed_service_login`, with a **different** value) *(unverified on Supabase: the direct host may need IPv6 or the IPv4 add-on; the session pooler host is the alternative)*. PostgreSQL warns that a cleartext `ALTER ROLE … PASSWORD` «might also be logged in the client's command history or the server log», and `\password` changes it «without exposing the cleartext password» ([ALTER ROLE](https://www.postgresql.org/docs/current/sql-alterrole.html), PostgreSQL 18). If the dashboard SQL Editor is used instead, delete the saved query afterwards *(unverified: the editor's saving and logging behaviour)*.
4. End the sessions opened with the old password, as `postgres`:
   `select pg_terminate_backend(pid) from pg_stat_activity where usename = '<the role rotated>';` ([pg_terminate_backend](https://www.postgresql.org/docs/current/functions-admin.html)) *(unverified on Supabase: its `postgres` role is not a superuser — «Superuser access is not given» ([Roles, superuser access and unsupported operations](https://supabase.com/docs/guides/database/postgres/roles-superuser)) — and that page does not say whether it may terminate another role's sessions; confirm the query returns `true` and the sessions are gone)*.
5. Redeploy Production immediately and verify README-staging §6.
6. **Prove the old password is refused**: connect with it through the pooler host and the direct host and expect an authentication failure *(unverified: whether the pooler keeps accepting it for a while)*. Let `psql` prompt for it — `psql "<connection URL without the password>" -W` — rather than exporting it: PostgreSQL advises against `PGPASSWORD` because «some operating systems allow non-root users to see process environment variables via ps» ([libpq environment variables](https://www.postgresql.org/docs/current/libpq-envars.html)), and `-W` makes `psql` «prompt for a password before connecting» ([psql](https://www.postgresql.org/docs/current/app-psql.html)).
7. Give the new `SERVICE_DB_URL` to operators for `telegram-erase-identity.mjs` runs, per command.

Never use `supabase db reset --linked`, `supabase db push --include-seed`, or Branching with `[db.seed] enabled = true` against the hosted project (README-staging §3): they rebuild or reseed it, leaving `goproceed_app_login` at the local dev value and `goproceed_service_login` with no password.

### The `postgres` password

It opens everything, including the roles above. Reset it in the Supabase project's database settings *(unverified: the current dashboard path)*, update the password manager, and re-establish any operator session that uses it. It does not change the `goproceed_*_login` passwords.

**After a leak of the `postgres` password**, resetting it is not enough, because its holder could change the database itself:

1. Reset it, then end its other sessions: `select pg_terminate_backend(pid) from pg_stat_activity where usename = 'postgres' and pid <> pg_backend_pid();` *(unverified: the effect on Supabase's own internal clients)*.
2. Rotate both `goproceed_*_login` passwords — its holder could have reset them.
3. **Before trusting the database again, compare it with the migrations.** No list of queries is complete, so do both:
   - **A schema diff.** `supabase db diff --linked` compares the linked database with a shadow database built from `supabase/migrations/` in a local container (Docker), across all schemas by default, and is known to miss publications, storage buckets and views with `security_invoker` ([supabase db diff](https://supabase.com/docs/reference/cli/supabase-db-diff)). The default `supabase db dump` holds no custom roles and excludes the `auth` and `storage` schemas; `supabase db dump --linked --role-only` dumps the cluster roles, to compare with what migrations `0003` and `0034` create ([supabase db dump](https://supabase.com/docs/reference/cli/supabase-db-dump)). *(unverified: neither has been run against this project)*
   - **A first look by query**, all read-only, as `postgres`:
     - role attributes: `select rolname, rolsuper, rolbypassrls, rolcanlogin, rolcreaterole, rolcreatedb from pg_roles;` — `goproceed_app` and `goproceed_service` must stay `NOBYPASSRLS` (migrations `0003`, `0034`), and no unknown role may log in;
     - memberships: `select r.rolname as role, m.rolname as member from pg_auth_members a join pg_roles r on r.oid = a.roleid join pg_roles m on m.oid = a.member;`
     - grants to the exposed and application roles: `select grantee, table_schema, table_name, privilege_type from information_schema.role_table_grants where grantee in ('PUBLIC', 'anon', 'authenticated', 'goproceed_app', 'goproceed_service');` and the same from `information_schema.routine_privileges` and `information_schema.column_privileges`;
     - row-level security still on: `select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r', 'p') and n.nspname in ('app', 'api', 'public', 'storage');` — `pg_policies` still lists a table's policies after `DISABLE ROW LEVEL SECURITY`, so compare these flags with the migrations;
     - schema privileges: `select nspname, nspacl from pg_namespace;`
     - policies (`select * from pg_policies`), `SECURITY DEFINER` functions (`select proname from pg_proc where prosecdef`), user triggers (`select tgname, tgrelid::regclass from pg_trigger where not tgisinternal`), event triggers (`select * from pg_event_trigger`), scheduled jobs (`select * from cron.job`), publications (`select * from pg_publication`), extensions (`select extname from pg_extension`), default privileges (`select * from pg_default_acl`), per-role settings (`select * from pg_db_role_setting`), and views in the schemas the Data API exposes (`public` unless changed): `select schemaname, viewname from pg_views where schemaname = 'public';`.

   Anything the migrations do not create is suspect, and a clean result is not proof of a clean database: these queries show what exists, not everything a `postgres` holder could have changed.
4. Treat the Auth JWT secret as possibly exposed *(unverified)* and follow «Supabase API keys» below.

## Supabase API keys

Secret keys are created and revoked independently of each other, so a second key can run beside the first ([API keys](https://supabase.com/docs/guides/getting-started/api-keys)).

1. In Settings → API Keys, create a new secret key.
2. Edit `SUPABASE_SECRET_KEY` in every scope; redeploy; verify an evidence upload.
3. Delete the old secret key once nothing uses it.

**Deactivate the legacy `anon` and `service_role` keys** in Settings → API Keys once nothing uses them; the step is reversible ([Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)). Until then, rotating the secret key leaves the legacy `service_role` JWT, with the same access, untouched. The preflight refuses an `eyJ…` value in `SUPABASE_SECRET_KEY`.

**After a leaked secret key or legacy JWT**, assume the holder could read and change every row and Storage object and use admin operations. Review the project's API and Auth logs for the exposure window; check for Auth users and workspace memberships created in it; if a legacy JWT leaked, deactivate the legacy keys **at once** (the app does not use them: the preflight refuses `eyJ…` values); and if the legacy JWT secret may be exposed, rotate the JWT signing keys and revoke the old one once the access tokens it signed have expired: «Non-expired access tokens will remain to be accepted», and for the legacy secret, «wait at least 1 hour and 15 minutes before revoking» ([JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys)).

## Auth SMTP credential

*(Unverified; no Brevo or Supabase SMTP page was read on 2026-09-15.)* Create a new SMTP key at Brevo, replace it in the Supabase project's Authentication → SMTP settings (README-staging §6, «Brevo custom SMTP»), send one sign-in code to confirm delivery, then delete the old SMTP key at Brevo.

## External-link and session HMAC keys

Each variable is a list, `<keyId>:<base64 of 32+ bytes>[,<keyId>:…]`, with a separate active id. The registry signs new material with the active key and verifies stored material under the key id stored beside it (INV-044; `apps/app/src/lib/external-link.ts`), so this rotation has no outage.

1. Generate: `node -e "console.log('k2:' + require('crypto').randomBytes(32).toString('base64'))"`, with the next unused key id. **Never reuse a key id**: both the registry and the preflight accept a duplicate, and the last entry silently wins (BL-086).
2. Edit the list to `k1:<old>,k2:<new>` and the active id to `k2`, in every scope, for the link pair or the session pair — two different secrets, because the pairs are separate key spaces.
3. Redeploy. The preflight refuses an entry without a key id, a key shorter than 32 bytes and an active id the list does not hold, and names entries by position.
4. Verify one link issued before and one after.
5. **Retire the old key id after its longest lifetime**: a grant lives at most 7 days (`expiresInDays` `max(7)`, `packages/contracts/src/external.ts`); a session at most 12 hours, 30 minutes idle (`EXTERNAL_SESSION_ABSOLUTE_SECONDS`, `EXTERNAL_SESSION_IDLE_SECONDS`), and it ends with its grant. Removing a key id makes everything signed under it stop verifying, without an error.

**On a leak**, move the active id and remove the leaked id in the same deploy. Removing a leaked **link** key ends the grants signed under it; sessions already exchanged are signed with the session key and continue until they expire. Remove a leaked **session** key to end those. A key alone forges nothing without a token or a database write, but treat it as leaked all the same.

## Telegram secrets

Generate every Telegram secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`: 43 characters, all in the Bot API's `A-Z a-z 0-9 _ -` alphabet ([setWebhook](https://core.telegram.org/bots/api#setwebhook)), above `config.ts`'s 32-character minimum.

**Before the webhook is ever enabled** (BL-024), older production deployments must not accept an old webhook or worker secret. **Delete them**, keeping only the current production deployment: that is the step that works without a custom domain. Changing Deployment Protection is not a safe substitute: on 2026-08-19 the project's default mode protected the `*.vercel.app` production alias as well, because it is not a custom domain, and every path of the app answered a Vercel sign-in redirect (README-staging §5 step 4); the project was then set to «Only Preview Deployments» (API value `preview`). Vercel documents Standard Protection (`prod_deployment_urls_and_all_previews`) as protecting every deployment «except production domains», and «(Legacy) Pre-Production Deployments» as not protecting past production deployments ([Deployment Protection](https://vercel.com/docs/deployment-protection); [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication); both updated 2026-08-28). Whether the `vercel.app` alias counts as a production domain under Standard Protection, and which of those names the recorded «Only Preview Deployments» corresponds to, are *(unverified)*; a custom domain (Q-3) removes the first question.

- **Bot token.** A bot's token «can also be revoked at any time via @BotFather» ([bot tutorial](https://core.telegram.org/bots/tutorial)); `/token` generates a new one for a compromised or lost token ([bot features](https://core.telegram.org/bots/features)). Neither page says the old token stops working at once, so confirm it is refused before trusting it gone — without putting it in shell history: `read -rs TOKEN`, then `printf 'url = "https://api.telegram.org/bot%s/getMe"\n' "$TOKEN" | curl -s --config -`, then `unset TOKEN`. `printf` is a shell builtin, so the token reaches `curl` on standard input rather than as an argument other processes can list; curl reads its config «from stdin» when the file name is `-` ([curl manual](https://curl.se/docs/manpage.html), `--config`). A leading space keeps a command out of zsh history only when `HIST_IGNORE_SPACE` is set, which it is not by default. Then call `getWebhookInfo`: whoever held the token could have pointed the webhook elsewhere, and the setting belongs to the bot. Call `setWebhook` again with our URL and a new `secret_token`. Both calls carry the new token, and `setWebhook` carries the webhook secret too, so send them the same way: `read -rs TOKEN`, `read -rs SECRET`, then `printf 'url = "https://api.telegram.org/bot%s/setWebhook"\ndata-urlencode = "url=<our webhook URL>"\ndata-urlencode = "secret_token=%s"\n' "$TOKEN" "$SECRET" | curl -s --config -` (and `getWebhookInfo` like `getMe`), then `unset TOKEN SECRET`.
- **Webhook secret.** Edit `TELEGRAM_WEBHOOK_SECRET`, redeploy, then call `setWebhook` with the new `secret_token`. Between the two, Telegram's deliveries carry the old secret and are refused; Telegram repeats an unsuccessful request and gives up «after a reasonable amount of attempts» ([Getting updates](https://core.telegram.org/bots/api#getting-updates)), so keep the window short.
- **Worker secret.** Edit `TELEGRAM_WORKER_SECRET` and redeploy, then update whatever calls `POST /internal/telegram/jobs` (`apps/app/app/internal/telegram/jobs/route.ts`; no scheduler exists yet, runbook Q-12).

## Telegram link and erasure HMAC keys

Two key registries replaced `TELEGRAM_LINK_PEPPER`, which had no key id ([DEV-011](../docs/tasks/DEV-011-telegram-hmac-key-ids.md), migration `0085`). Each is `<keyId>:<base64 of 32+ bytes>[,<keyId>:<base64>…]` with an active id, the format of the external-link keys. Generate a key with `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"`, straight into the password manager. Never reuse a key id, and never put the same key value in both lists: that would merge the two key spaces (BL-086).

**Link keys — `TELEGRAM_LINK_HMAC_KEYS` + `TELEGRAM_LINK_ACTIVE_KEY_ID`, in the deployment.** A new link token is signed with the active key, and its row stores that key id; a token is consumed under whichever configured key signed it (`apps/app/src/lib/telegram/tokens.ts`, `linking.ts`).

- **Rotate:** add the new key under a new id, make it active, redeploy. Remove the old id in a later deploy, at least 15 minutes after the first one reached every instance: an intent lives 15 minutes (`INTENT_LIFETIME_MS` in both intent routes).
- **After a leak:** remove the leaked id in the same deploy that adds the new one. Unused tokens signed under it answer «invalid or expired», and the person asks for a new link. A leaked link key with a copy of the database reveals nothing: a verifier is an HMAC of a random 256-bit token.
- At most eight keys: the consuming definers accept eight candidates, and the app refuses a longer list with its generic configuration error.

**Erasure keys — `TELEGRAM_ERASURE_HMAC_KEYS` + `TELEGRAM_ERASURE_ACTIVE_KEY_ID`, on the operator's machine only.** Only `apps/app/scripts/telegram-erase-identity.mjs` reads them, so a leak of the Vercel store no longer reaches the erasure registry. The deploy preflight refuses a build that carries either name. Each registry row stores `subject_key_id` beside `subject_hmac`, and `app.telegram_erasure_keys` records a check value per key id the first time it is used.

- **What the database refuses, before any write** (`app.erase_telegram_identity`, `0085`): a key set that does not include every key id the workspace's registry already holds, so a forgotten key fails loudly instead of splitting a person across two surrogates; a key id supplied with a different secret than on its first use; and more than one matching row. The script itself refuses a repeated key id. **The secret supplied the first time an id is seen is trusted**, and its check value is kept: a wrong secret then misses every earlier erasure under that id, allocates a second surrogate for a person erased before, and the right secret is refused from then on. **A refusal naming a key id you never supplied** means someone registered that id first — any `goproceed_service` caller can, and that principal can already erase in any workspace: inspect `app.telegram_erasure_keys` as `postgres` before choosing a new id.
- **Rotate:** add the new key under a new id and make it active. **Keep every earlier key in the list.** A repeat request for a person erased earlier matches their row under any listed key and moves it to the active key; a row leaves an old key only when that person asks again, so an old erasure key is in practice never retired.
- **After a leak:** add a new active key and keep the leaked one listed. Rows still under the leaked key, and every backup taken before a row was moved, can still be re-identified by anyone who also holds the database: rotation does not repair them (BL-087). New erasures are written under the new key.
- **Rows written before `0085`** carry the key id `legacy`. If a database holds any (as `postgres`: `select count(*) from app.telegram_erasures where subject_key_id = 'legacy';`), the operator's list includes `legacy:<base64 of the old pepper's UTF-8 bytes>`, which reproduces the HMACs the pepper computed. Produce it without putting the pepper on a command line or on screen: `IFS= read -rs PEPPER` (without `IFS=` the shell strips leading and trailing spaces), then `printf %s "$PEPPER" | base64 | tr -d '\n' | pbcopy` (macOS) and paste it into the password manager, then `unset PEPPER`. `legacy` has no check value until its first erasure run, so that run pins whatever secret it was given: a wrong value splits every person erased before and refuses the right one afterwards. The repair is, as `postgres`, `delete from app.telegram_erasure_keys where key_id = 'legacy';`, and the owner's decision on any person the wrong run split. No hosted environment ever held the pepper (above), so a hosted database is expected to hold no such row.

## Resend API key

Resend keys are created with a name, permission and optional domain restriction, and their value cannot be viewed after creation ([API keys](https://resend.com/docs/dashboard/api-keys/introduction)).

1. Create a new key with sending access for the landing's domain.
2. Edit `RESEND_API_KEY` in the landing's Vercel project, every scope; redeploy; send one test submission.
3. Delete the old key in the Resend dashboard.

## When a secret has leaked

1. **Invalidate at the source, now**: for a role password, `\password` with a new value and `pg_terminate_backend` (its section); for the `postgres` password, its leak steps; delete the Supabase or Resend key; revoke the bot token and confirm; remove the HMAC key id.
2. **Close the other copies.** Delete every older production deployment that holds the old value — do not switch Deployment Protection mid-incident without a custom domain, because it may lock users out of the production alias («Telegram secrets») — remove the value from every Vercel scope, and do not roll back past the rotation.
3. **Widen the rotation to the store.** A leak through a store — a Vercel project or account token, the password manager, an operator machine, CI — exposes every secret in it: rotate them all.
4. **Audit access**: Vercel team members, access tokens and integrations; Supabase organisation members; GitHub collaborators, deploy keys and Actions secrets; password-manager sharing.
5. **Find where it travelled**: git history across all refs (the pattern scan in DEV-010's record is a starting point, not a secret scanner), CI logs, Vercel build and runtime logs.
6. **Assess what was reachable** for the exposure window, using the «What it opens» column above; for a Telegram bot token, check `getWebhookInfo` and re-point the webhook.
7. **Record** the date, what leaked, how it was found, what was rotated and what could have been read, in a task record under `docs/tasks/`, and decide with the owner who must be told. Never write the secret itself anywhere.

## What this runbook does not prove

- No rotation has been performed on the hosted project; the first one will test this document.
- Steps marked *(unverified)* rest on no vendor page read on 2026-09-15.
- Operator account tokens (Vercel, Supabase, GitHub) have no procedure here.
- Supabase's `postgres` role is not a superuser; whether it may terminate other roles' sessions is unverified.
- There is no separate production project; its rotation is this runbook applied to its own values.
- Nothing automates or schedules rotation.
