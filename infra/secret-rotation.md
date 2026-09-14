# Secret rotation — GoProceed

How to replace every secret the deployments hold, in an order that does not take them down, and what to do when one leaks. Readiness gate 14 («Environment and secrets», `docs/delivery/production-readiness.md`) asks for this runbook; [DEV-010](../docs/tasks/DEV-010-m0-gate14-evidence.md) wrote it on 2026-09-15 from the instructions that used to live only inside [README-staging.md](README-staging.md).

Nothing here has been exercised against a hosted project yet. Every step names the vendor documentation it rests on; read it again before a rotation, because vendor dashboards move.

## Where the secrets live

| Environment | Store | What it holds |
|---|---|---|
| Local development | `apps/*/.env.local` (git-ignored) and the local Supabase stack | Loopback-only role passwords `app_pw` / `service_pw`, set by `scripts/set-local-app-password.mjs`, which refuses any non-loopback host; the published local Supabase demo keys; the `dev1` HMAC keys in `apps/app/.env.example` |
| CI | `.github/workflows/ci.yml` `env` | The same loopback values against a disposable stack; `ci-placeholder-publishable-key` for the build |
| Hosted (staging, the pilot and the production app) | Supabase project `asrvzhjaueyvrfozxpzo` (role passwords), the Vercel projects `goproceed-app` and `apps/landing`'s project (environment variables, Production scope), and the owner's password manager (the only copy of every generated value) | Everything in the inventory below |

**There is one hosted environment.** Staging, the pilot and `goproceed-app.vercel.app` share one Supabase project, and Preview builds are skipped (`apps/app/vercel.json` `ignoreCommand`). When a separate production project exists (`docs/delivery/pilot-execution-runbook.md` §10 Q-9), it gets its own generated values for every row below — never a copy of these — and this table gains a row.

## Inventory

| Secret | Where it is used | Rotation shape |
|---|---|---|
| `goproceed_app_login` password, inside `APP_DB_URL` | `packages/database/src/pool.ts`, every tenant read and write | Replace in place: the database holds one password per role |
| `goproceed_service_login` password, inside `SERVICE_DB_URL` | `getServicePool()`, every service write | Replace in place, a value different from the app role's |
| `SUPABASE_SECRET_KEY` (`sb_secret_…`) | `apps/app/src/lib/evidence-storage.ts`, signed uploads | Create a second key, switch, delete the old one |
| `EXTERNAL_LINK_HMAC_KEYS` + `EXTERNAL_LINK_ACTIVE_KEY_ID` | `apps/app/src/lib/external-link.ts`, the external review link | Add a key id, move the active id, retire the old id later |
| `EXTERNAL_SESSION_HMAC_KEYS` + `EXTERNAL_SESSION_ACTIVE_KEY_ID` | the same file, the external session cookie | The same, in its own key space |
| `TELEGRAM_BOT_TOKEN` (`apps/app`, and separately `apps/landing`) | the channel adapter; the landing's `/api/pilot` delivery | Issue a new token in @BotFather |
| `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WORKER_SECRET` | `apps/app/src/lib/telegram/config.ts`: the webhook's secret header, the jobs route | Replace, then re-register the webhook |
| `TELEGRAM_LINK_PEPPER` | link-token verifiers and the erasure registry's `subject_hmac` | **Not rotatable in place** — see its section |
| `RESEND_API_KEY` | `apps/landing/app/api/pilot/deliver.ts` | Create a second key, switch, delete the old one |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | compiled into the client bundle | Public by design; replace it the way a secret key is replaced if the project's keys are reissued |

No Telegram channel secret is set on any hosted environment yet: the webhook stays off until BL-024's blockers close. The Telegram rows are written for the day it is enabled.

## The order, for every secret

Vercel applies an environment-variable change only to deployments made after it ([Environment variables](https://vercel.com/docs/environment-variables), updated 2026-08-20), and documents rotation as: generate the new credential without invalidating the old one, edit the variable, redeploy, verify, then invalidate the old credential ([Rotating environment variables](https://vercel.com/docs/environment-variables/rotating-secrets), updated 2026-07-15). Every section below follows that order unless it says why it cannot.

1. **Generate** the new value. Record it in the password manager first, as its own entry with the date.
2. **Keep the old value valid.**
3. **Edit** the variable in the Vercel project's Environment Variables, Production scope, marked Sensitive. A Sensitive value cannot be read back, only replaced (README-staging §4.3).
4. **Redeploy** Production. The deploy preflight refuses a build whose variables it knows would fail (`apps/app/scripts/deploy-preflight.mjs`); a refusal names the variable and never prints its value.
5. **Verify** the new deployment: README-staging §6 for the app, one test submission for the landing form.
6. **Invalidate** the old value at its source, and delete its password-manager entry or mark it revoked with the date.

A value that has leaked skips step 2: invalidate first, accept the outage, then generate and redeploy. The outage is the price of the leak; the old value working for another hour is worse.

## Database role passwords

The database holds one password per role, so the old password cannot stay valid beside the new one: steps 2 and 6 collapse, and the running deployment loses its connection between the `alter role` and the redeploy. Rotate in a quiet window.

1. Generate a secret with `openssl rand -hex 24` (hex, because it goes into a URL and needs no percent-encoding; README-staging §3.1).
2. In the Supabase project's SQL Editor: `alter role goproceed_app_login password '<generated-secret>';` — or `goproceed_service_login` with a **different** generated secret (README-staging §3.2).
3. Compose the URL with the Session pooler host and the `.<project-ref>` username suffix exactly as README-staging §3.1 and §3.2 show, and edit `APP_DB_URL` or `SERVICE_DB_URL` in Vercel.
4. Redeploy Production and verify README-staging §6.
5. Give the new `SERVICE_DB_URL` to every operator machine that runs `apps/app/scripts/telegram-erase-identity.mjs` (README-staging §7); the old value no longer connects.

Never use `supabase db reset --linked`, `supabase db push --include-seed`, or Branching with `[db.seed] enabled = true` against the hosted project (README-staging §3): they rebuild or reseed it, leaving `goproceed_app_login` at the local dev value and `goproceed_service_login` with no password.

## Supabase secret API key

Supabase secret keys (`sb_secret_…`) are created and revoked independently of each other, so a second key can run beside the first ([API keys](https://supabase.com/docs/guides/getting-started/api-keys); [Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys); read 2026-09-15).

1. In the project's Settings → API Keys, create a new secret key.
2. Edit `SUPABASE_SECRET_KEY` in Vercel; redeploy; verify an evidence upload.
3. Delete the old secret key in Settings → API Keys once nothing uses it.

The legacy JWT-based `service_role` key cannot be rotated this way. The preflight refuses an `eyJ…` value in `SUPABASE_SECRET_KEY`.

## External-link and session HMAC keys

Each variable is a list, `<keyId>:<base64 of 32+ bytes>[,<keyId>:…]`, with a separate active key id; the registry signs new material with the active key and verifies stored material under the key id stored beside it (INV-044; `apps/app/src/lib/external-link.ts`). So this rotation has no outage.

1. Generate: `node -e "console.log('k2:' + require('crypto').randomBytes(32).toString('base64'))"`, with the next unused key id.
2. Edit the list to `k1:<old>,k2:<new>` and the active id to `k2`, for the link pair or the session pair (two different secrets — the pairs are separate key spaces).
3. Redeploy. The preflight refuses an entry without a key id, a key shorter than 32 bytes, and an active id the list does not hold (`scripts/deploy-preflight-keys.mjs`, whose test runs the same cases through the runtime registry).
4. Verify one external link issued before and one issued after.
5. **Retire the old key id only when nothing signed under it is still needed**: removing `k1` makes every grant and session signed under it stop verifying, without an error. Grants expire (`external_access_grants.expires_at`, migration `0049`) and sessions have idle and absolute expiries (`idle_expires_at`, `absolute_expires_at`); wait out the longest of them, or accept that live links and sessions issued under `k1` stop working.

On a leak, move the active id and remove the leaked key id in the same deploy: every link and session signed under it stops verifying, which is the point.

## Telegram bot token, webhook and worker secrets

- **Bot token.** In @BotFather, `/token` issues a new token for a compromised or lost one ([Telegram bot features](https://core.telegram.org/bots/features), read 2026-09-15). The page does not say that the old token stops working; confirm with a call using the old token before trusting it gone. Edit `TELEGRAM_BOT_TOKEN` in each project that holds it (`apps/app`, `apps/landing`), redeploy both.
- **Webhook secret.** Generate 32+ characters from `A-Z a-z 0-9 _ -` (the Bot API allows 1–256 of those; [setWebhook](https://core.telegram.org/bots/api#setwebhook), read 2026-09-15; `config.ts` requires at least 32). Edit `TELEGRAM_WEBHOOK_SECRET`, redeploy, then call `setWebhook` with the new `secret_token`. Between the redeploy and the `setWebhook` call, Telegram's deliveries carry the old secret and are refused; Telegram repeats an unsuccessful request and «give[s] up after a reasonable amount of attempts» ([Getting updates](https://core.telegram.org/bots/api#getting-updates), read 2026-09-15), so keep that window short.
- **Worker secret.** Edit `TELEGRAM_WORKER_SECRET` and redeploy, then update whatever calls `POST /internal/telegram/jobs` (`apps/app/app/internal/telegram/jobs/route.ts`) with it (no scheduler exists yet; runbook Q-12).

## `TELEGRAM_LINK_PEPPER`

The pepper keys two things at once: the verifier of every outstanding link token (`apps/app/src/lib/telegram/tokens.ts`) and `subject_hmac` in `app.telegram_erasures`, which makes a repeat erasure idempotent (migration `0081`; README-staging §7). It has no key id. Replacing it therefore:

- invalidates every link token issued and not yet used; and
- breaks the match between a person erased under the old pepper and a new erasure request for them: the registry no longer recognises them.

Rotate it only when it has leaked, and then: record the date; expect to reissue outstanding links; and before erasing anyone again, check the audit trail for an earlier erasure of that person by other means. A pepper with key ids, like the HMAC keys above, is the lasting fix and is not built.

## Resend API key

Resend keys are created with a name, permission and optional domain restriction, and their value cannot be viewed after creation ([API keys](https://resend.com/docs/dashboard/api-keys/introduction), read 2026-09-15).

1. Create a new key with sending access for the landing's domain.
2. Edit `RESEND_API_KEY` in the landing's Vercel project; redeploy; send one test submission.
3. Delete the old key in the Resend dashboard.

## When a secret has leaked

1. **Invalidate it at its source now**, before anything else: `alter role … password` with a new value, delete the Supabase or Resend key, `/token` in @BotFather, or remove the HMAC key id.
2. Generate, edit and redeploy as its section says.
3. For a database role password, assume the holder could read and write every tenant's rows while it was valid (README-staging §3); for the service role, every service-sourced record. Decide with the owner what was reachable, for how long, and who must be told.
4. Record the date, what leaked, how it was found, what was rotated and what could have been read, in a task record under `docs/tasks/`. Never write the secret itself anywhere.

## What this runbook does not prove

- No rotation has been performed on the hosted project; the first one will test this document.
- There is no separate production project; its rotation is this runbook applied to its own values.
- Nothing automates or schedules rotation.
