# DEV-011 — Key ids for the Telegram link and erasure HMAC keys (BL-085)

## Assignment

- **Objective and user-visible outcome:** the HMAC keys behind Telegram link-token verifiers and the erasure registry's `subject_hmac` carry key ids, so they can be rotated without invalidating live links, losing the erasure registry's match or leaving a leaked key re-identifying erased people (BL-085). Readiness gate 14 waits on it.
- **State:** implementing
- **Coordinator:** primary Claude Code session, 2026-09-15.
- **Execution mode:** independent subagents for the required stages, as native `gp-*` agent types.
- **Selected route and why:** schema, definer and erasure change (`agents/COORDINATION.md`): `gp-architect` design → owner decisions → coordinator implements → `gp-reviewer` + `gp-security` → `gp-qa`.
- **Triggered stages and why:**
  - `gp-architect`: tables, constraints and a migration; `SECURITY DEFINER` functions; the Telegram channel workflow; identity erasure.
  - `gp-security`: HMAC keys, application environment variables and secrets, the Telegram webhook's link flow, identity erasure.
- **Owning module and allowed edit paths:** `supabase/migrations/0085_the_key_that_named_itself.sql` (new); `apps/app/src/lib/hmac-key-registry.ts` (new), `external-link.ts`, `telegram/{tokens,config,linking}.ts`, the two intent routes; `apps/app/scripts/{deploy-preflight,deploy-preflight-keys,telegram-erase-identity}.mjs`; `turbo.json` `build.env`; `apps/app/.env.example`; the tests named in the Plan and the Telegram test fixtures that stubbed the pepper; `technical/database/invariant-catalog.csv`, `technical/data-access-surface.csv`, `technical/database/schema-v0.1.sql`; `infra/secret-rotation.md`, `infra/README-staging.md` §7; `docs/BACKLOG.md`, `docs/STATUS.md`, `docs/delivery/production-readiness.md`; this record and the index.
- **Read context and applicable local instructions:** root `AGENTS.md`, `apps/app/AGENTS.md`, `infra/secret-rotation.md` §`TELEGRAM_LINK_PEPPER`, [DEV-010](DEV-010-m0-gate14-evidence.md).
- **Linked spec, ADR or earlier task:** [BL-085](../BACKLOG.md#bl-085); DEV-010 review R1-01, security S1-06.
- **Baseline:** `7ae12b7` (main after PR #91).
- **Dependencies / constraints / out of scope:** no hosted project is changed and no migration is applied to one; local migrations are applied by hand as `postgres`, never with `supabase db reset`; database suites run only with the owner's confirmation. BL-086 and BL-024 are out of scope.
- **Required acceptance criteria:**
  1. Link tokens: a new verifier is stored with the active key id; a token signed before a rotation is consumed while its key stays configured; a token whose key was removed answers `invalid_or_expired` and stays unconsumed; the consume audit row is keyed by the intent id the definer returns.
  2. Erasure registry: a repeat request under a rotated key set finds the same surrogate and moves the row to the active key; the definer refuses, before any write, a key set that omits a key id the workspace's registry holds, a key id with a different secret than on first use, more than one match, and malformed key arguments (22023); a re-link refusal rolls the re-key back.
  3. The old pepper's UTF-8 bytes under the id `legacy` reproduce the HMACs and verifiers the pepper produced, in the application, the script and the database.
  4. Privileges: the keyless signatures are gone; only `goproceed_service` executes the new erase and consume definers; no application role executes `_internal` or reads `app.telegram_erasure_keys`; the key-id columns are not null / paired with the HMAC.
  5. Configuration: the app refuses a missing or unusable `TELEGRAM_LINK_*` pair with the generic error and without key material; the pepper alone no longer loads; the script refuses unusable or repeated erasure keys before connecting, and passes no key material to the database; the deploy preflight checks the link pair when either name is set, in parity with the runtime registry.
  6. Regression: the existing erasure, retention, binding, token, external-link, preflight and Telegram unit suites pass; `pnpm --filter @goproceed/app typecheck`, `pnpm validate:canonical-docs` and `pnpm validate:agents` pass.
  7. Catalogs and documents agree with 0085: INV-099 and the new invariants, the data-access surface rows, `schema-v0.1.sql`, the rotation runbook and README-staging §7; BL-085 and the new wrapping-scheme entry.
  8. CI `verify` on the PR head (not required: GitHub Actions starts no jobs until October 2026).
- **Skipped stages and rationale:** `gp-ui-reviewer` (no UI), `gp-mobile` (no field client).

## Owner decisions

Record each decision on the day it is made. Write it in the owner's terms; never paraphrase it into something stronger.

| Date | Decision | Source |
|---|---|---|
| 2026-09-15 | Build a key-id `TELEGRAM_LINK_PEPPER` rather than close gate 14 with the limit | DEV-010, owner |
| 2026-09-15 | Two key sets: `TELEGRAM_LINK_HMAC_KEYS` for the deployed app's link tokens, `TELEGRAM_ERASURE_HMAC_KEYS` only on the operator's machine for the erasure registry; `TELEGRAM_LINK_PEPPER` removed without a compatibility shim | chat, answer «Два набора» |
| 2026-09-15 | Add the key check-value table, so the same key id with a different secret is refused rather than silently allocating a second surrogate | chat, answer «Добавить» |
| 2026-09-15 | The wrapping scheme that would repair a leaked old erasure key for rows not yet re-keyed is a separate backlog entry, with the limit stated in the runbook | chat, answer «Отдельный BL» |
| 2026-09-15 | Apply 0084 and the new 0085 to the local database by hand as `postgres`, and run only `packages/testing/src/telegram-erasure.test.ts` and `apps/app/tests/telegram-bindings.int.test.ts`; local tenant data may be cleared; no `supabase db reset` | chat, answer «Да, эти два файла» |

## Plan

1. Failing tests (row 3). 2. Migration `0085` and the code (row 4). 3. Green run of the unit files, typecheck and the two owner-approved database files (row 5). 4. Catalogs and documents. 5. `gp-reviewer` + `gp-security` on the diff. 6. `gp-qa` on the final revision.

Numbered steps. For each step, name the files it touches and the check that proves it. A step that adds a contract, refusal or invariant starts with its failing test.

## Progress and decisions

| Order | State or role | Decision / result | Evidence / reference | Next action |
|---|---|---|---|---|
| 1 | designing (`gp-architect`, native) on `7ae12b7` | **Design returned, read-only.** (a) Two key spaces replace `TELEGRAM_LINK_PEPPER`, with no compatibility shim (no hosted environment holds it, `infra/secret-rotation.md:41`): `TELEGRAM_LINK_HMAC_KEYS` + `TELEGRAM_LINK_ACTIVE_KEY_ID` for the deployed app, and `TELEGRAM_ERASURE_HMAC_KEYS` + `TELEGRAM_ERASURE_ACTIVE_KEY_ID` on operator machines only (the script is the sole reader; retention passes no HMAC, `0081:462,481`). The parser moves to a neutral `apps/app/src/lib/hmac-key-registry.ts`; the script gets `parseHmacKeys` in `deploy-preflight-keys.mjs`, and refuses duplicate erasure key ids. (b) Migration `0085`: `verifier_key_id` on both intent tables (backfill `legacy`, not null, blank check; `unique (verifier_hash)` kept); the consume definers take paired key-id and hash arrays (1–8) and return the intent id, so `linking.ts` drops its `verifier_hash` audit lookups; `subject_key_id` on `app.telegram_erasures` (null together with `subject_hmac`); optional `app.telegram_erasure_keys` with a per-key check value; `_internal` gains `p_subject_key_id default null`; `app.erase_telegram_identity` takes the active id, key ids, HMACs and check values, locks the workspace, refuses a check-value mismatch, a registry row under a key id not supplied, or more than one match, and re-keys a match under a non-active key to the active key in the same transaction. (c) Link keys retire after 15 minutes plus the deploy overlap; an erasure key leaves use only when its subjects ask again, so old erasure keys stay sealed; a leaked old erasure key still re-identifies rows not yet re-keyed and pre-re-key backups — fixing that needs a wrapping scheme, proposed as a new BL. (d) INV-099 text changes; INV-100 and INV-101 new; DA-151, DA-152, DA-159 notes; DA-177 new; `schema-v0.1.sql`; no ADR (`tenancy-and-security.md:792`, ADR-011 already require key ids). (e) Tests first: unit (preflight parity, tokens incl. the legacy-equivalence case, config, erase CLI) and local database (`packages/testing/src/telegram-erasure.test.ts` alone; `apps/app/tests/telegram-bindings.int.test.ts`). Unverified: the string-key HMAC equivalence, the 5-argument retention call resolving through the default, Supabase's default `EXECUTE` grant, Turbo `build.env` visibility, `0062:444-447` | architect report | Owner decisions |
| 2 | implementing (coordinator): research | `gp-researcher`: Node 24 `createHmac` with a string key uses `Buffer.from(str, 'utf8')`, so a `legacy` entry of the pepper's UTF-8 bytes reproduces the pepper's HMACs (nodejs.org crypto and buffer docs, v24.21.0, and the v24.x source); PostgreSQL 17 grants `EXECUTE` to `PUBLIC` on a newly created function and a drop-then-create function is a new object, so the explicit `revoke` stays; Turborepo strict env mode filters a task's environment to its `env` list, so the link-key names go into `build.env` | researcher report | Failing tests |
| 3 | implementing (coordinator): failing tests first | Unit: `tokens.test.ts` (active key signs, one candidate per key, legacy equivalence), `config.test.ts` (new), `erase-identity-cli.test.ts` (registry refusals incl. repeated id, HMACs per key, check values, arrays to the definer, no key material, the script refusing the pepper alone before connecting), `deploy-preflight-keys.test.mjs` (the `TELEGRAM_LINK_*` pair in the parity table, `parseHmacKeys`, the script checking the pair). Database: `telegram-erasure.test.ts` §1 (key table), §4 on the new signature, §6 (nine cases); `telegram-bindings.int.test.ts` (three rotation cases). **Red:** unit 11 failed plus two files that could not load the missing module; `telegram-erasure.test.ts` on local `0084`: 18 failed, §2, §3 and §5 passed. The bindings suite was not run red | `scratchpad/dev011-red-unit.txt`, `dev011-red-erasure.txt` | Implementation |
| 4 | implementing (coordinator) | Migration `0085` (as designed, plus `app.assert_keyed_hmacs` shared by the consume and erase definers); `hmac-key-registry.ts` extracted from `external-link.ts` (which now delegates); `tokens.ts` `telegramVerifier` / `telegramVerifierCandidates`; `config.ts` `linkKeys` (generic error, at most eight keys); `linking.ts` passes candidates and audits by the returned intent id; routes store `verifier_key_id`; `parseHmacKeys` in `deploy-preflight-keys.mjs`; preflight checks the link pair when either name is set; `turbo.json` `build.env`; the script reads `TELEGRAM_ERASURE_*` and checks its keys before connecting; fixtures in seven Telegram test files, `api.test.ts` and `.env.example`. Local database: `0084` and `0085` applied by hand as `postgres` (rc 0) and recorded in `supabase_migrations.schema_migrations`. The red run's `afterAll` failed on the missing key table and left its fixture workspaces; the next run's `afterAll` removed them, and a cleanup script then found none | `scratchpad/dev011-apply-0084.txt`, `dev011-apply-0085.txt` | Green run |
| 5 | implementing (coordinator): green | Unit (nine files: tokens, config, erase CLI, preflight keys, external-link, api, processor, processor-failure, ingress): 130 passed. `pnpm --filter @goproceed/app typecheck` rc 0 (after casting the spawn env in the CLI test). `packages/testing/src/telegram-erasure.test.ts` alone: 38 passed (one assertion first failed because `public.external_sessions` already has a `verifier_key_id` column; the check was narrowed to the two intent tables). `apps/app/tests/telegram-bindings.int.test.ts` with the local `APP_DB_URL` / `SERVICE_DB_URL`: 8 passed, not skipped. Not run: the other Telegram integration suites whose fixtures changed (`telegram-delivery`, `telegram-evidence`, `telegram-ingress`, `telegram-processing`, `project-communications`) — outside the owner's two-file permission | `scratchpad/dev011-green-unit.txt`, `dev011-typecheck.txt`, `dev011-green-erasure.txt`, `dev011-green-bindings.txt` | Catalogs and documents |
| 6 | implementing (coordinator): catalogs and documents | `invariant-catalog.csv`: INV-099 enforcement and evidence re-worded; INV-100 (link verifiers carry key ids) and INV-101 (erasure key ids and the refusals) added. `data-access-surface.csv`: DA-151, DA-152, DA-159 notes; DA-177 `app.telegram_erasure_keys`. `schema-v0.1.sql`: `verifier_key_id` on both intent tables. `infra/secret-rotation.md`: stores and inventory rows, and «Telegram link and erasure HMAC keys» replacing the pepper section. `infra/README-staging.md` §7 run instructions. `docs/BACKLOG.md`: BL-085 `scheduled → DEV-011`; BL-087 (P2) the wrapping scheme, per the owner. `production-readiness.md` gate 14 and runbook §5.7: dated DEV-011 notes, the gate still open on Q-9. `STATUS.md` next actions and the latest-migration marker | `validate-canonical-docs` | Reviews |

## Findings and rework

| Finding ID | Severity | Trigger / location | Expected vs actual | Owner | Resolution and evidence |
|---|---|---|---|---|---|

Rework count and hypothesis changes:

## What is not true after this task

List what a reader might assume this task achieved but it did not. Examples: untested platforms, targets not yet delivered, NOT RUN criteria, and follow-ups.

## Acceptance evidence

| Criterion | Required? | Checked revision | Command or evidence | PASS / FAIL / NOT RUN | Limitation |
|---|---|---|---|---|---|

A blank cell is not a passed check. A required FAIL or NOT RUN prevents done, unless the task scope is explicitly revised and the original requirement stays recorded. A skipped test suite is NOT RUN. Record its environmental reason and the command that would settle it.

The Limitation column opens with at most one qualifier from this closed set, then its detail:

- **PASS:** `negative` (the command correctly produced nothing, and the absence is the evidence); `assisted:` what had to be arranged by hand first; `owner-reported` (the owner's report, not a session observation).
- **FAIL:** `known-red baseline:` the named set of pre-existing failures, with no case outside it failing.
- **NOT RUN:** `environmental:` the cause and the command that settles it; `not-provable-locally:` what would settle it; or, with no qualifier, the reason: why it was deliberately not attempted, or why a PASS was earned for the wrong reason (`agents/roles/gp-qa.md`).

Gate records written before 2026-09-13 keep their own tokens; `docs/delivery/pilot-execution-runbook.md` §7.4 maps them onto this set.

## Sources

Third-party documentation and primary sources checked for this task. Give each one its URL, the installed version it applies to, its publication date if known (never substitute today's date) and the access date.

## Completion / handoff

- Changed / inspected files:
- Review independence: same-session / independent (name the actual stage roles)
- Verified scope:
- Remaining risks / blocked requirements:
- Next bounded action and owner:
- Final state and reason:
