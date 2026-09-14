# DEV-010 — M0 readiness gate 14: secrets and environment separation, the rotation runbook and the dated evidence entry

## Assignment

- **Objective and user-visible outcome:** readiness gate 14 («Environment and secrets», `docs/delivery/production-readiness.md`), which carries runbook M0 item 7, closes with recorded evidence for the environments that exist today. After this task: a standalone secret rotation runbook sits at `infra/secret-rotation.md`; the deploy preflight refuses a malformed HMAC key list or an active key id the list does not hold, as the runtime registry already does; the `version-0.0.md` gate 4 box on role passwords is ticked with its 2026-08-19 evidence and a stated limit; and a dated gate 14 entry sits in `docs/delivery/version-0.1.md` §M0 «Gate evidence entries».
- **State:** reviewing
- **Coordinator:** primary Claude Code session, 2026-09-15.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** new behavior inside existing boundaries (`agents/COORDINATION.md`): coordinator implements → `gp-reviewer` + `gp-security` → `gp-qa`. `apps/app/scripts/deploy-preflight.mjs` is executed code, and a test is added.
- **Triggered stages and why:**
  - `gp-security`: the change touches application environment variables and secrets (the deploy preflight's secret checks, the rotation runbook for database role passwords, Supabase API keys and the external-link HMAC keys).
  - `gp-architect` is not triggered: no table, migration, RLS, grant, contract or catalog.
  - `gp-ui-reviewer` and `gp-mobile` are not triggered: no UI or mobile path.
  - `gp-researcher` is not used: the Vercel and Supabase facts the runbook depends on were read by the coordinator from the vendors' current documentation (Sources).
- **Owning module and allowed edit paths:** `apps/app/scripts/deploy-preflight.mjs` and a new sibling module for its key checks; a new unit test; `infra/secret-rotation.md` (new); `infra/README-staging.md` (pointers to the new runbook only); `docs/delivery/version-0.0.md` gate 4 (the one box); `docs/delivery/version-0.1.md` §M0 «Gate evidence entries»; `docs/delivery/production-readiness.md` gate 14 (an evidence pointer, no tick); `docs/delivery/pilot-execution-runbook.md` §5.7, §5.14 row 2, §5 intro, §8 question 1; `docs/STATUS.md`; `docs/BACKLOG.md` if a follow-up is filed; this record; `docs/tasks/README.md`. The owner's «секреты» scope includes `apps/landing`'s and the Telegram channel's secrets in the runbook's inventory; their code is not touched.
- **Read context:** root `AGENTS.md`; `START_HERE.md`; `agents/COORDINATION.md`; `docs/delivery/production-readiness.md` §14 and «Evidence format»; `docs/delivery/version-0.0.md` §4; `docs/delivery/version-0.1.md` §M0; `docs/delivery/pilot-execution-runbook.md` §5.7, §5.14; `infra/README-staging.md` §3, §4.3, «Status»; `apps/app/.env.example`; `apps/app/src/lib/external-link.ts` and its test; `supabase/seed.sql`; `scripts/set-local-app-password.mjs`; migrations `0003` and `0034`; `docs/tasks/DEV-009-m0-gate10-evidence.md` (the entry form).
- **Linked spec, ADR or earlier task:** [DEV-009](DEV-009-m0-gate10-evidence.md) (the first gate entry and its form).
- **Baseline:** `a5fd136` (main, «Merge pull request #90»).
- **Dependencies / constraints / out of scope:**
  - GitHub Actions starts no jobs until October 2026 (owner, 2026-09-14), so any CI row is NOT RUN, `environmental:`.
  - No hosted project is changed and no secret is read, rotated or printed. The hosted state is taken from `infra/README-staging.md` «Status» (2026-08-19).
  - No DB suite runs locally without the owner's confirmation.
  - Out of scope: a separate production project (runbook §10 Q-9), the other twelve gates, BL-084.
- **Required acceptance criteria:** see Acceptance evidence.
- **Skipped stages and rationale:** above.

## Owner decisions

| Date | Decision | Source |
|---|---|---|
| 2026-09-14 | Next after DEV-009: runbook §5.14 order 2, item 7 (readiness gate 14) and the `version-0.0.md` tick | Owner, in conversation («смержил, давай дальше», after the coordinator named it the next step) |
| 2026-09-15 | Close gate 14 for the environments that exist, recording that no separate production project exists and that the gate reopens for one when it does (Q-9) | Owner, in conversation (answer to the coordinator's question) |
| 2026-09-15 | Tick `version-0.0.md` gate 4's role-password box with the 2026-08-19 evidence and the caveat that one hosted environment exists | Owner, in conversation |
| 2026-09-15 | Fix the preflight gap in this task: refuse a malformed `*_HMAC_KEYS` or an `*_ACTIVE_KEY_ID` the list does not hold | Owner, in conversation |
| 2026-09-15 | Lift the rotation instructions into a standalone `infra/secret-rotation.md` | Owner, in conversation |

## Plan

1. A failing test first: the preflight's key checks refuse exactly what `linkKeys()` / `sessionKeys()` refuse, over a table of cases. Check: red before the change.
2. Move the key checks into a module the preflight imports; wire it in. Check: the test green; the preflight exercise refuses case G.
3. `infra/secret-rotation.md`: what to rotate, the order (new credential, update, redeploy, verify, revoke), per secret, and the compromise path; `README-staging.md` points to it. Check: every command and claim traced to the repository or the vendors' docs.
4. The `version-0.0.md` tick; the gate 14 entry; the `production-readiness.md` pointer; runbook and STATUS. Check: validators.
5. `gp-reviewer` and `gp-security`, rework, `gp-qa`, PR.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | scoped (coordinator) | Hosted reality: one Supabase project, `asrvzhjaueyvrfozxpzo`, serves staging, the pilot and the production Vercel build of `goproceed-app`; Previews are not built (`apps/app/vercel.json` `ignoreCommand` builds Production only). Seed and roles: `supabase/seed.sql` sets no password; `scripts/set-local-app-password.mjs:11-13` refuses a non-loopback host; migrations `0003` and `0034` create both LOGIN roles with no password. `README-staging.md` «Status» records both role passwords set on 2026-08-19 (SCRAM, different) and the production build printing the preflight's `OK`. A scan of tracked files found no committed secret: one placeholder connection string (`[YOUR-PASSWORD]`, README-staging) and the published local Supabase demo secret `sb_secret_N7UND0…`, used only against `127.0.0.1:54321` (`evidence-storage.ts`) | `git grep` scans; files named | Preflight exercise |
| 2 | scoped (coordinator): preflight exercise | With `DEPLOY_PREFLIGHT=1` and fake values, no network: empty environment → exit 1; `app_pw` in `APP_DB_URL` → exit 1; `APP_DB_URL` equal to `SERVICE_DB_URL` → exit 1; a legacy `eyJ…` JWT as `SUPABASE_SECRET_KEY` → exit 1; a complete valid set → exit 0 with `OK`; no `VERCEL`/`DEPLOY_PREFLIGHT` → exit 0, silent. **Case G: `EXTERNAL_LINK_HMAC_KEYS=nokeyid` and `EXTERNAL_SESSION_ACTIVE_KEY_ID=k9` → exit 0.** The runtime registry refuses both (`external-link.test.ts`: no key material, active id not in the list, a key shorter than 32 bytes), so a build passes that fails its first external request | `env -i … DEPLOY_PREFLIGHT=1 node scripts/deploy-preflight.mjs` | Owner decisions |
| 3 | implementing (coordinator): failing test first | `apps/app/scripts/deploy-preflight-keys.test.mjs` runs twelve cases, for both key pairs, through the preflight check and through `linkKeys()` / `sessionKeys()` (`src/lib/external-link.ts` `loadRegistry`), and requires the same verdict; one more test requires that a problem names the variable and never prints the secret. First run in a fresh worktree exited 254, `Command "vitest" not found` (no dependencies installed), which is not a red test; after `pnpm install --frozen-lockfile`, the red run failed on `Cannot find module './deploy-preflight-keys.mjs'` | `pnpm exec vitest run scripts/deploy-preflight-keys.test.mjs` in `apps/app` | Implement |
| 4 | implementing (coordinator) | `apps/app/scripts/deploy-preflight-keys.mjs` restates `loadRegistry`'s rules: both names set, every comma entry `<keyId>:`, a key id that is not empty after trim, a base64 secret of at least 32 bytes, the active id among the ids. `deploy-preflight.mjs` imports it and adds its problems when both names of a pair are set (an unset name is already reported). Parity test: 25 passed. Exercise with fake values: empty 1; `app_pw` 1; identical URLs 1; legacy JWT 1; a valid set 0 with `OK`; not a deploy 0; **G, `nokeyid` and an absent active id, now 1**, naming entry 1 of `EXTERNAL_LINK_HMAC_KEYS` and `EXTERNAL_SESSION_ACTIVE_KEY_ID`; H, a 16-byte key, 1, without printing the key. `pnpm --filter @goproceed/app typecheck` rc 0 (`scripts/` is outside `tsconfig.json`'s `include`) | `scratchpad/preflight2/*.txt` | Rotation runbook |
| 5 | implementing (coordinator): rotation runbook | `infra/secret-rotation.md` written: the three stores (local, CI, the one hosted environment), an inventory of ten secrets from `apps/app/.env.example`, `apps/landing/.env.example` and `apps/mobile/.env.example` (mobile holds public values only), the vendors' order, and a section per secret: database role passwords (one password per role, so no overlap; a quiet window), the Supabase `sb_secret_` key, the HMAC key lists (overlap by key id; retire an id only after the longest grant or session lifetime), the Telegram token, webhook and worker secrets, `TELEGRAM_LINK_PEPPER` (no key id; replacing it invalidates unused link tokens and breaks the erasure registry's match, so rotate only on a leak), the Resend key, and the leak path. Facts checked in the repository: `apps/app/vercel.json` `ignoreCommand` skips non-production builds; `external_access_grants.expires_at` (`0049`) and session `idle_expires_at` / `absolute_expires_at`; `apps/app/app/internal/telegram/jobs/route.ts`; `apps/app/scripts/telegram-erase-identity.mjs`; `config.ts` minimum lengths; `.env.local` ignored (`.gitignore:15`). README-staging §3 and §4.3 point to it | Sources; `git check-ignore -v`; file paths | Documents |
| 6 | implementing (coordinator): documents | `version-0.0.md` gate 4's role-password box ticked with a dated note (2026-08-19 evidence, the 2026-09-15 scan, one hosted environment, Q-9). `version-0.1.md` §M0 gains the gate 14 entry after gate 10's, with its limits. `production-readiness.md` gate 14 gains an «Evidence, 2026-09-15» pointer; unticked items still 32. Runbook §5 intro (two gates closed), §5.7 status line and the disagreement note, §5.14 row 2, §8 question 1, each keeping the replaced text. STATUS «M0 gates» State cell, preamble sentence, «Next action» 1 and 3. Validators rc 0; `scripts/deploy-preflight-keys.test.mjs` (25) and `src/lib/external-link.test.ts` (29) pass; `pnpm --filter @goproceed/app typecheck` rc 0 | `node scripts/validate-canonical-docs.mjs`; `python3 scripts/sync-agents.py --check`; `pnpm exec vitest run scripts/deploy-preflight-keys.test.mjs src/lib/external-link.test.ts` | `gp-reviewer`, `gp-security` |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

- **There is no separate production environment.** Staging, the pilot and the production app share one Supabase project; gate 14 is closed for that environment only, and a production project reopens it for itself (Q-9).
- **No secret has been rotated.** The runbook is written from the repository and the vendors' documentation and has not been exercised on the hosted project.
- **The hosted state is the 2026-08-19 record.** No hosted project, dashboard or secret was read by this task; the role passwords and the twelve Vercel variables are as `README-staging.md` «Status» recorded them then.
- **Vercel's Preview scope may still hold values.** Previews are not built, so nothing uses them; the runbook edits Production only.
- **`TELEGRAM_LINK_PEPPER` cannot be rotated without loss.** Unused link tokens die and the erasure registry stops matching earlier erasures; a key-id pepper is not built.
- **Telegram's `/token` is not documented to revoke the old token;** the runbook says to confirm it.
- **The preflight still cannot see a hosted secret's correctness** (a wrong password or a revoked key passes the build); it checks shape, not validity.
- **The new test has not run in CI** (GitHub Actions starts no jobs until October 2026).
- **The tracked-file scan is a pattern scan** (connection strings with a password to a non-loopback host, `sb_secret_` values, `k<n>:` base64 keys, JWT literals), not a full secret scanner, and does not cover git history.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|
| 1. The preflight refuses a malformed `*_HMAC_KEYS` and an `*_ACTIVE_KEY_ID` not in its list, agreeing with the runtime registry over a table of cases; the test fails first | yes | working tree over `a5fd136` | Red: `Cannot find module './deploy-preflight-keys.mjs'`; green: `scripts/deploy-preflight-keys.test.mjs` 25 passed; exercise G and H exit 1 (rows 3–4) | PASS | — |
| 2. The preflight's existing refusals and its `OK` path are unchanged | yes | working tree over `a5fd136` | Exercise A–F after the change: 1, 1, 1, 1, 0 with `OK`, 0 silent — the same as before (rows 2, 4) | PASS | assisted: fake values, `DEPLOY_PREFLIGHT=1`, no Vercel build |
| 3. `infra/secret-rotation.md` covers every secret the deployments hold, in the vendors' documented order, with the leak path, and README-staging points to it | yes | working tree over `a5fd136` | Row 5; Sources; README-staging §3 and §4.3 links | PASS | not exercised on the hosted project |
| 4. `version-0.0.md` gate 4's role-password box is ticked with dated evidence and the one-environment caveat | yes | working tree over `a5fd136` | `git diff a5fd136 -- docs/delivery/version-0.0.md` | PASS | owner-reported: the hosted fact is the 2026-08-19 record |
| 5. One dated gate 14 entry in `version-0.1.md` §M0 names its evidence and its limits; `production-readiness.md` gate 14 carries a pointer, unticked | yes | working tree over `a5fd136` | `git diff a5fd136 -- docs/delivery/version-0.1.md docs/delivery/production-readiness.md`; `grep -c -- '- \[ \]' docs/delivery/production-readiness.md` → 32 | PASS | — |
| 6. Runbook §5.7, §5.14 row 2, §5 intro, §8 question 1 and STATUS agree with the evidence | yes | working tree over `a5fd136` | `git diff a5fd136 -- docs/delivery/pilot-execution-runbook.md docs/STATUS.md` | PASS | — |
| 7. `pnpm --filter @goproceed/app typecheck`, the new test, `pnpm validate:canonical-docs` and `pnpm validate:agents` pass | yes | working tree over `a5fd136` | typecheck rc 0; 54 passed (25 new, 29 existing); both validators rc 0 | PASS | macOS, Node 24.18.0 |
| 8. CI `verify` on the PR head | no | — | — | NOT RUN | environmental: GitHub Actions starts no jobs until October 2026 (owner, 2026-09-14) |

## Sources

- Vercel, «Environment variables», `https://vercel.com/docs/environment-variables` (last updated 2026-08-20), read 2026-09-15: changes apply only to new deployments.
- Vercel, «Rotating environment variables», `https://vercel.com/docs/environment-variables/rotating-secrets` (last updated 2026-07-15), read 2026-09-15: new credential, edit, redeploy, verify, then invalidate the old one.
- Supabase, «API keys», `https://supabase.com/docs/guides/getting-started/api-keys`, and «Migrating to publishable and secret API keys», `https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys`, read 2026-09-15 through Supabase MCP `search_docs`: `sb_secret_` keys are created and revoked independently; rotate by creating a new key, switching, deleting the old one.
- Telegram, «Bot API» `setWebhook` and «Getting updates», `https://core.telegram.org/bots/api`, read 2026-09-15: `secret_token` 1–256 of `A-Z a-z 0-9 _ -` in `X-Telegram-Bot-Api-Secret-Token`; an unsuccessful request is repeated and given up «after a reasonable amount of attempts».
- Telegram, «Bots: features», `https://core.telegram.org/bots/features`, read 2026-09-15: `/token` generates a new token for a compromised or lost one; nothing said about the old token.
- Resend, «API keys», `https://resend.com/docs/dashboard/api-keys/introduction`, read 2026-09-15 (no date shown): a key's value cannot be viewed after creation; keys are deleted in the dashboard.

## Completion / handoff

- Changed files: `apps/app/scripts/deploy-preflight.mjs`, `apps/app/scripts/deploy-preflight-keys.mjs` (new), `apps/app/scripts/deploy-preflight-keys.test.mjs` (new), `infra/secret-rotation.md` (new), `infra/README-staging.md`, `docs/delivery/version-0.0.md`, `docs/delivery/version-0.1.md`, `docs/delivery/production-readiness.md`, `docs/delivery/pilot-execution-runbook.md`, `docs/STATUS.md`, this record, `docs/tasks/README.md`.
- Review independence: pending.
- Verified scope: criteria 1–7, by the coordinator.
- Remaining risks / blocked requirements: «What is not true» above.
- Next bounded action and owner: coordinator — `gp-reviewer` and `gp-security`.
- Final state and reason: reviewing.
