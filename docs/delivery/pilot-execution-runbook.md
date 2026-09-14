# Pilot execution runbook — from today's tree to a real pilot

**Status:** Draft

**Applies to:** v0.1

**Last reviewed:** 2026-09-13

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md),
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](../decisions/ADR-007-pilot-field-client.md),
[ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md),
[ADR-009](../decisions/ADR-009-three-pilot-surfaces.md),
[ADR-010](../decisions/ADR-010-project-sourced-requirements.md),
[ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md)

> **[Changed 2026-09-13 — DEV-003.]** §3, §4, §6.6 and §7 describe the process that root [AGENTS.md](../../AGENTS.md) and [agents/COORDINATION.md](../../agents/COORDINATION.md) set out. That process replaced a skill-driven loop and seven named review gates on 2026-09-13 (DEV-002). The measured record of the earlier loop moved to [docs/ai-workflow.md](../ai-workflow.md). Where this runbook and root `AGENTS.md` disagree, root `AGENTS.md` wins. Citations that used to point at `CLAUDE.md` lines now name the section of root `AGENTS.md` that holds the rule.

---

## §0. What this runbook is, and what it refuses to do

This is the repeatable procedure for taking GoProceed from the tree at commit
`1c418fb` through v0.1 completion — M0 closed, M1–M7 closed, the pilot object
filled — and into one pilot with one named company and one adversarial
технагляд. It is a **delivery view**. It has no authority of its own.

### What it refuses to do

- **It does not decide scope.** Adding a capability to v0.1 requires an ADR, not
  a runbook line ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):689-692).
  Where this document names work, that work is already authorised by a numbered
  decision, and the decision is cited beside it.
- **It does not define the two headline success measures.** First-time
  acceptance rate and days-to-signature have no v0.1 definition anywhere in this
  repository, deliberately: both are defined over claim segments, package
  versions, submissions and `commercial_decision`, all of which are v0.2
  ([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md):91-97).
  «No slice may invent a definition»
  ([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md):95-96);
  the delivery view states the same rule in its own words — «No slice of the
  implementation may write those definitions»
  ([version-0.1.md](version-0.1.md):822). This runbook does not invent one
  either, and records M6 as un-closable until
  [glossary.md](../domain/glossary.md) supplies both.
- **It does not claim a green baseline.** [test-strategy.md](test-strategy.md):595-604
  forbids any document in this package from stating a passing suite, a test
  count, or a green baseline as a present fact without a dated reproducible run.
  Every measurement below carries the date and the command that produced it, or
  it is marked `NOT PROVEN`.
- **It does not resolve contradictions by preferring the newer document.** By
  [docs/README.md](../README.md):28-75 the applied database outranks the target
  design, which outranks the public API, which outranks release contents, which
  outranks ADRs. A later Approved ADR does **not** automatically win — see
  [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):593-628, which records
  that an un-recut level-2 domain document resolves the contradiction *against*
  the ADR. §9 carries this as a hard guardrail.
- **It does not invent process.** Where the repository defines nothing, this
  document says «undefined in repo» and files the question in §10 rather than
  filling the hole with a plausible-sounding procedure.

### Its own honesty contract

1. Every factual claim carries a `file:line` citation, or the command that
   produced it and the date it ran.
2. Where a document **asserts** something the repository cannot **prove**, both
   words are used and the difference is stated.
3. Where two documents disagree, both sides are cited and neither is smoothed.
   §1's corrections-owed table is the register.
4. This document is `Status: Draft`. It has had no owner review. Nothing in it
   overrides an Approved document, and where it disagrees with one, the Approved
   document wins until an explicit correction lands there.
5. The team is **one person**. §3's roles are agent functions executed on that
   person's behalf. Naming anyone else would be fiction
   ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):480-484).

### Read these first, in this order

This document is long and has no authority of its own. A cold-start reader who
opens it without the sources below will read transcriptions as decisions.

1. [docs/README.md](../README.md):28-75 — the precedence ladder. Nothing else
   here is safe to apply without it.
2. [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) — the pilot-shaped
   re-cut: the twelve M0 gates, the pilot object, the five protections.
3. [version-0.1.md](version-0.1.md) §M0 and the per-milestone **Acceptance
   evidence** blocks (:305, :412, :546, :614, :681, :743, :835).
4. [production-readiness.md](production-readiness.md) §Evidence format
   (:385-391) — what a closed gate's record has to be.
5. [02-building-ui.md](../design/02-building-ui.md), in full, **before** any
   slice touching `apps/landing/**`, `apps/app/app/**`, `packages/ui/**` or
   `packages/tokens/**`. Reviewing UI counts.
6. [glossary.md](../domain/glossary.md) — технагляд, ПТВ, кошторис, АВР,
   Додаток В/Н and КЕП are used untranslated throughout this document.

### Dated reproducible run behind §1

Everything in §1 marked *measured* came from this run, in this checkout, with
`node_modules` installed (`pnpm install --frozen-lockfile` → exit 0):

```
$ date -u +%Y-%m-%dT%H:%M:%SZ
2026-09-03T10:10:11Z
$ git rev-parse --short HEAD
1c418fb
$ ls supabase/migrations/*.sql | wc -l
81
$ ls supabase/migrations | tail -1
0081_the_identity_that_asked_to_be_forgotten.sql
$ tail -n +2 technical/openapi/scope-v0.1.csv | awk -F, '{print $NF}' | sort | uniq -c
  35 v0.1-M1
   9 v0.1-M2
   6 v0.1-M3
   6 v0.1-M4
   6 v0.1-M5
   3 v0.1-M6
  10 v0.1-M7
$ grep -c '^- \[ \]' docs/delivery/production-readiness.md
32
$ grep -c '^- \[x\]' docs/delivery/production-readiness.md
0
$ node scripts/validate-canonical-docs.mjs; echo "EXIT=$?"
canonical documentation: OK
EXIT=0
$ grep -H '^\*\*Status:\*\*' docs/decisions/ADR-0*.md | grep -vc Approved
0
$ ls docs/superpowers/plans/evidence/*-gate.md | wc -l
8
$ ls docs/superpowers/plans/evidence/*-gate.md | tail -1
docs/superpowers/plans/evidence/2026-09-03-telegram-identity-erasure-gate.md
$ ls docs/superpowers/plans/20*.md | wc -l
35
$ ls docs/superpowers/specs/ | grep -c design.md
19
$ git log --merges 7397d7d..HEAD --format=%s | wc -l
12
$ grep "^## P[0-3]" TODOS.md | grep -vi CLOSED | wc -l
35
$ supabase --version
2.114.0
$ cat .supabase-cli-version
2.115.0
$ docker exec -i supabase_db_goproceed psql -U postgres -d postgres -Atc "select max(version) from supabase_migrations.schema_migrations"
0081
```

The full suite was run in this checkout too, after the transcript above:

```
$ pnpm turbo run test --concurrency=1
2026-09-03T10:12:51Z  (start)
 Tasks:    8 successful, 8 total
@goproceed/testing:test:   Test Files  42 passed (42)      Tests  666 passed (666)
@goproceed/app:test:       Test Files  106 passed | 7 skipped (113)
@goproceed/app:test:       Tests  1084 passed | 125 skipped (1209)
@goproceed/contracts 136, @goproceed/domain 102, @goproceed/mobile 150,
@goproceed/discovery 73, @goproceed/landing 46, @goproceed/database 7 — all passed
exit=0
```

The isolated `apps/app` suites skip locally by design — their `beforeEach`
truncates the only local database and they run only where
`TEST_DB_ADMIN_URL` is set, which since #62 is CI and nowhere else. So a local
green is a green of everything *except* the suites that are red in CI, and
§1.1 states both halves rather than one.

What changed since the 2026-09-01 revision of this block: `node_modules` is
present, so nothing below is `NOT PROVEN — environmental` for that reason any
more; the tree is twenty-one migrations longer; and the CI baseline is no longer
green — see §1.1 for why that is a gain in what is known, not a loss in what
works.

---

## §1. Where GoProceed actually stands, 2026-09-03

### 1.1 Proven — measured today, in this checkout

| Fact | Evidence |
|---|---|
| 81 migrations on disk, `0001`–`0081` | measured; last file `0081_the_identity_that_asked_to_be_forgotten.sql`. Twenty-one landed since the 2026-09-01 revision: `0061`–`0079` (the Telegram channel, PR #58), `0080` (the choice-session policy, #62), `0081` (erasure and retention, #65) |
| 75 catalogued v0.1 operations, split 35/9/6/6/6/3/10 across M1–M7 | measured from [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv). The ten `v0.1-M7` rows are the channel's; M6 keeps three |
| Eight milestones, M0–M7. `v0.1-M7 — The channel` exists since 2026-09-03 | [ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md) decision 9, ruled by the owner; one row each in [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4's table, [roadmap.md](../product/roadmap.md) and [version-0.1.md](version-0.1.md); fifteen entity rows tagged `v0.1-M7` (measured) |
| Eleven ADRs, **all `Status: Approved`** — ADR-011 since 2026-09-03, on the owner's nine rulings recorded in its §"Open items — ruled by the owner on 2026-09-03" | measured; the approval procedure is still undefined in repo (Q-6) and this is one more recorded instance of the only form it has ever taken: rulings in conversation, transcribed with the date |
| M0 has **zero** closed gates. 32 unchecked items, 0 checked | measured. Two gates now carry dated **evidence notes** under their unchecked boxes — gate 2 (the retention mechanism exists, inert) and gate 4 (the identity-level deletion procedure, exercised on synthetic data) at [production-readiness.md](production-readiness.md):212, :245-259 — which is what an evidence entry looks like on the way to a tick, and is not a tick |
| The canonical-docs gate is **GREEN** — `canonical documentation: OK`, exit 0 | measured, and green on every CI run since 2026-09-01 |
| The evidence chain resumed: the newest gate record is dated **2026-09-03** | [2026-09-03-telegram-identity-erasure-gate.md](../superpowers/plans/evidence/2026-09-03-telegram-identity-erasure-gate.md), the eighth `*-gate.md` and the first since 2026-08-03. It uses §7's vocabulary as written, including `PASS (assisted)` for a CI run read against a known-red baseline |
| The ДБН Додаток Н library is exactly twelve rows, all `VERIFIED_PRIMARY`, each carrying URL + retrieval date + SHA-256 | [dbn-a31-5-2016-dodatok-n.csv](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv):1-13 |
| All eight discovery assumptions A-1…A-8 are `Unvalidated`; every evidence column is `none` **except A-8's Reply, which is `founder-reported`** — and ADR-011 decision 11 now records that the channel was built **on the owner's instruction, before validation**, and that A-8 is never cited as evidence for it | [validated-assumptions.md](../discovery/validated-assumptions.md):33-40 (A-8 at :40); [ADR-007](../decisions/ADR-007-pilot-field-client.md) as amended 2026-09-03 |
| The local Supabase CLI (2.114.0) is behind the pin (2.115.0) | measured; `pnpm db:check-cli` warns on exactly this |
| Local dev carries `0081` | measured against the local container's `supabase_migrations.schema_migrations` |

**The CI baseline is red, and the red is older than the channel.** This is the
one row a reader must not skim. Until 2026-09-02 `.github/workflows/ci.yml`
never set `TEST_DB_ADMIN_URL`, so the eight isolated `apps/app` suites — 125
cases — were **skipped** on every run, including the green baseline run
33540108319 that [test-strategy.md](test-strategy.md) §Baseline still records.
PR #62 set the variable (`ci.yml`:61-68, `turbo.json`:42). The suites now run,
and **eighteen** of their cases fail: fourteen in
`tests/telegram-evidence.int.test.ts`, one each in
`tests/telegram-delivery.int.test.ts`, `tests/project-communications.int.test.ts`,
`tests/upload-intents-finalize.int.test.ts` and
`src/lib/evidence/evidence-service.test.ts`. They fail **identically** on `main`
before the channel merged (baseline PR #63) and after it (run 33736763584 at
`7bf8e4b`; run 33742738613 at `1c418fb`: `app-qa` success, `verify` failure, the same eighteen titles; `packages/testing` 42 files passed; `apps/app` 5 files failed, 108 passed); every slice merged
since was read against that set and added nothing. `app-qa` is green
throughout; `packages/testing` is green throughout — 42 files, including the 28
erasure cases and the tenant-isolation sweeps. So the honest statement is:
**`verify` is red on `main` with a known, fixed set, and the set predates every
change this runbook describes.** Fixing the eighteen is its own slice
([TODOS.md](../../TODOS.md) P1, 2026-09-03). While `verify` is red on a known set, a task record's CI
row is FAIL, Limitation `known-red baseline:` with that set named and no case outside it failing (§7.4) — never PASS — and
[test-strategy.md](test-strategy.md) §Baseline is owed a correction (C-16):
the run it names was green because it skipped, not because it passed.

### 1.2 Asserted by a dated operator record — not reproduced here

Not measured by this runbook — **asserted by a dated record written by the
operator who ran it**, which is a stronger source than the delivery docs and a
weaker one than a live catalog query. The word in the heading is *asserted*
deliberately: nothing in this subsection was re-run against a hosted project,
and [test-strategy.md](test-strategy.md):601-604 forbids any document in this
package from turning an assertion of that kind into a present-tense claim.

| Fact | Source | Date |
|---|---|---|
| Supabase staging project `asrvzhjaueyvrfozxpzo` (eu-north-1): 58/58 migrations, `pg_cron` present, 140 policies, 53/53 public tables with RLS, both `goproceed_*_login` passwords set | [infra/README-staging.md](../../infra/README-staging.md) §Status | 2026-08-19 |
| Vercel `goproceed-app`, root `apps/app`, region `arn1`, twelve preflight-checked variables; `GET /login` answers 200 over TLS at `https://goproceed-app.vercel.app`; the owner has signed in once | same | 2026-08-19 |
| Vercel `goproceed-landing`, zero environment variables, HTTP/2 200 | same, :462-487 | 2026-08-20 |
| Vercel `goproceed-field`, root `apps/mobile`; CORS measured on the wire — `OPTIONS /v1/projects` echoes the exact origin, and a 401 still carries the `access-control-allow-origin` header | same, :505-508, :703-716 | 2026-08-21 |
| The Telegram channel's ten operations, fifteen tables and its erasure procedure are **built and CI-proven on `packages/testing`; deployed nowhere; the webhook enabled in no environment** | [ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md) §"Status against the runtime", addendum 2026-09-03 | 2026-09-03 |

**The migration gap, stated as a number.** The last recorded apply to a hosted
project is `0058` (2026-08-19). The tree holds `0081`. **Twenty-three
migrations — `0059` through `0081` — have no apply record anywhere**, and
among them are the channel's nineteen, the choice-session policy fix and the
erasure slice. Nothing in this runbook may describe any of that as «on
staging»; §8.1 carries what applying them costs and Q-9 carries what is
undefined about doing it.

`HANDOFF-2026-08-27.md`:234-239 still **asserts** a clean `supabase db reset`
through `0059` on local dev, dated 2026-08-27, with no output, no counts and no
transcript. It is prose, not a dated reproducible run
([test-strategy.md](test-strategy.md):601-604), it predates `0060`–`0081`, and
the local database it describes now carries `0081` (measured, §0). It is not a
baseline of anything and is not used as one here.

### 1.3 Written but unproven

| Thing | Why it is unproven |
|---|---|
| Whether M1–M6 are code-complete — «every catalogued operation has a route, every build-list table has DDL, every milestone has a suite» | Asserted at [2026-08-06-v0.1-implementation-progress.md](../superpowers/plans/2026-08-06-v0.1-implementation-progress.md):487-503 («**No delivery work remains.**»), and that source disqualifies itself twelve lines on, at :492-494: «**Execution.** Nothing in this repository has been run… until they have been run and their output read, no statement in this document about behaviour is more than a claim derived from reading.» The catalog has moved from 58 to 75 rows since its date. **Operation↔route coverage as a whole is not re-measured here.** |
| Whether **M7** works end to end | Not unproven — **half-proven and half-red**, and this row exists so the two halves are not averaged. The unit and `packages/testing` halves are green in CI (the guards, the RLS sweeps, the erasure suite, the CLI test). The integration halves under `apps/app/tests/` are **among the eighteen red cases** (§1.1): `telegram-evidence.int` (fourteen), `telegram-delivery.int` and `project-communications.int` (one each). ADR-011 §"Status against the runtime" records the same suites as *skipped* on 2026-09-02; since #62 they run and fail. «CI green» was never true of those invariants and is not true now. And the spec's own rule stands: «No completion claim is made from green mocks alone; the real-group staging pass is required before the feature is described as operational» |
| Whether staging is at head | It is not, and the number is known: twenty-three behind (§1.2). What is unproven is the state *between* — whether `0058` is still exactly where staging stands. Settle it with `select max(version) from supabase_migrations.schema_migrations` against staging before any push (§8.1) |
| Whether `progress.adjust`'s ADR-008 fix works | The route reads `(rootAdmitted && delta < 0n)` and the test assertion was inverted in the same change; the route header ends «NOTHING HERE WAS EXECUTED». Its suite is not among the eighteen, so it runs green in CI — which proves the assertion as written, not that the assertion is the right one. [ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md):194-205 still calls it a live P0 (C-6) |
| Whether the Expo-web field client reaches parity | The parity gate is a measurement on two physical phones ([ADR-009](../decisions/ADR-009-three-pilot-surfaces.md):113-128), and **three of its five sub-items are unmeasured** (§8.3). The repository disagrees with itself on the hardware: [2026-08-01-b0-procurement.md](../superpowers/plans/evidence/2026-08-01-b0-procurement.md) and [TODOS.md](../../TODOS.md) record both devices as unprocured, while [README-staging.md](../../infra/README-staging.md):922-926 and :941-949 carry iPhone measurements dated 2026-08-21. **No Android measurement exists anywhere.** C-13. ADR-011 open item 8 adds one fact: the field client **stays available on a Telegram-locked project**, so the parity gate's meaning is unchanged by the channel |
| Whether the manifest is served as `application/manifest+json` from the field origin | [README-staging.md](../../infra/README-staging.md):576-583 writes the check as a to-be-run instruction. No measured result exists |
| Whether retention ever runs | `app.apply_communication_retention` is scheduled nightly and does nothing: all three rows of `app.retention_policy` carry `duration = NULL` (0081 §1, unchanged). Proven inert by test; **retention under a real duration in a real environment is `NOT PROVEN — environmental`** by the gate record's own row, and stays so until the owner lands a duration (Q-4) |

### 1.4 Stale — what the docs claim that the tree contradicts

| Claim | Where | Current truth |
|---|---|---|
| «Migrations `0041`–`0050` are ten files… none applied anywhere — not once»; «The runtime is 33 tables defined by 40 migrations» | [version-0.1.md](version-0.1.md):103-116, [production-readiness.md](production-readiness.md):133-147, both **Last reviewed 2026-08-08** | 81 files on `main`; applied through `0058` on staging (2026-08-19) and through `0081` on local dev (measured 2026-09-03) |
| «**Approved is not deployed.**», under «## Nothing below is **closed**» | [production-readiness.md](production-readiness.md):133-135 | Provisioned and public per [README-staging.md](../../infra/README-staging.md) §Status — through `0058` |
| «nothing in this repo automates it, and nothing in this repo has run it yet»; «58 files, `0001` through `0058`» | [README-staging.md](../../infra/README-staging.md):4-11, **never corrected** — while §Status records the provisioning | 81 files; the runbook itself says to read the number from `ls`, and this row is why. C-11 |
| «The scope lists **58 operations** in `scope-v0.1.csv`» | [technical/openapi/README.md](../../technical/openapi/README.md):29; [test-strategy.md](test-strategy.md):342 | **75**, measured; the progression is at [version-0.1.md](version-0.1.md):162. C-14 |
| A **green** baseline: «176 files, 2174 tests, all passed» from run 33540108319 | [test-strategy.md](test-strategy.md) §Baseline, recorded 2026-09-01 | That run skipped 125 cases for want of `TEST_DB_ADMIN_URL`. Since #62 they run and eighteen fail, on `main` before and after the channel. The baseline is **red with a named set**, and the section must say so. **C-16** |
| «The outbox has no consumer» / «Outbox/job claiming and delivery: **None.**» | [jobs-events-and-audit.md](../architecture/jobs-events-and-audit.md):45, [tenancy-and-security.md](../architecture/tenancy-and-security.md):243 — **both precedence level 2** | `apps/app/src/lib/telegram/delivery.ts` claims `communication.telegram.send` and delivers. ADR-011 records the contradiction (its §"Contradictions", item 3) and, by [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):600-612, both documents **outrank ADR-011 until edited**. **C-17** |
| «Seventeen of the twenty-six v0.1 tables still have no table in any APPLIED migration» | [version-0.1.md](version-0.1.md):131-132 | 53 tables live on staging through `0058`; the fifteen channel tables and the two `app`-schema tables of `0081` live only on local dev |
| `statutory_acts.render` «refuses by design» for want of the В.1/В.2 field list and the ДБН retrieval record | [production-readiness.md](production-readiness.md):149-155 | Both landed 2026-08-10. The mechanism described is still accurate; its factual premise is not. C-2 |
| «`progress.adjust` — NOT implemented as decided, and this is a live P0» | [ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md):194-205 | The direction gate is in the source and the test was inverted with it. Not a present-tense P0. C-6 |
| «M6 cannot **open** without a definition of the two measures» | [roadmap.md](../product/roadmap.md):354, :404; [glossary.md](../domain/glossary.md):253 | Corrected in place at [version-0.1.md](version-0.1.md):813-818: M6 was built; «M6 cannot **CLOSE** without them». C-4 |
| «M2's `origin_not_distinguished` token has not landed» | [version-0.1.md](version-0.1.md):530-536, [roadmap.md](../product/roadmap.md):660-670 | The literal exists in `packages/contracts/src/uploads.ts` and migration `0043`'s CHECK; INV-086 now names **two** senders of it, the PWA and the Telegram bridge (amended 2026-09-03) |
| «ADR-010 is the highest today» and «every ADR on disk simply carries `Status: Approved`» | this runbook's own §4.1 step 5b, 2026-09-01 revision | ADR-011 is the highest; it was `Draft` from 2026-09-02 to 2026-09-03 and moved to Approved on recorded rulings. Corrected in §4.1 below rather than left as a dated observation |
| «`apps/demo/src/domain/format.ts` — port `pluralUk`/`rowsUk` from there»; «every screen under `apps/app/app/(dash)/**`» | [03-ui-references.md](../design/03-ui-references.md) §6 and :4 | `apps/demo` was deleted 2026-08-20; the route is `/dash`. C-9 |
| «D1–D4 remain» | [TODOS.md](../../TODOS.md):741-745 | D1, D2 and D3 landed (PRs #46, #48, #54). Only D4 has no route. C-12 |
| The 33-table / 40-migration baseline «and no document in this package may state another one» | [docs/README.md](../README.md):180-188 | Stale by forty-one migrations. The clause makes the staleness binding on anything that inherits from it |

### 1.5 Corrections owed

[version-0.1.md](version-0.1.md):929-934 states the rule this table obeys:
«This document is the delivery view; it does not silently rewrite the artifacts
it now disagrees with. Each is a correction owed, and delivery of a slice that
depends on one stops until it lands.» And: **a row leaves the table when it
lands.** Re-measured 2026-09-03: **none of C-1…C-15 has left the table**; C-7
moved; two rows are added.

| # | Owed by | Correction | Blocks |
|---|---|---|---|
| C-1 | [production-readiness.md](production-readiness.md) | The headline «33 tables, 40 migrations / 0041–0050 applied nowhere» paragraph, against [README-staging.md](../../infra/README-staging.md) §Status and the 81-file tree | Any M0 gate closure that cites deployment state |
| C-2 | [production-readiness.md](production-readiness.md):149-155 | The two act-render blockers closed 2026-08-10 | M4 acceptance evidence |
| C-3 | [version-0.1.md](version-0.1.md):103-133, :193-201 | The three-state «Applied / written and never run / neither» vocabulary, against an 81-migration tree with a staging push through `0058` | Any statement about what exists in a shared environment |
| C-4 | [roadmap.md](../product/roadmap.md):354, :404 and [glossary.md](../domain/glossary.md):253 | «M6 does not open» → «M6 does not close» | M6 closure attempt |
| C-5 | [glossary.md](../domain/glossary.md) | The v0.1 definitions of first-time acceptance rate and days-to-signature — **owed, and no other document may supply them** | M6 closure, the pilot pre-gate baseline |
| C-6 | [ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md):194-205 | §"Status of this decision against the runtime" item 3 is stale; the code no longer contradicts the ADR | Nothing — but it misleads every reader |
| C-7 | [roadmap.md](../product/roadmap.md) | **Moved, not landed.** It gained the M7 row and section on 2026-09-03 and still carries no ADR-009 or ADR-010 content — no three-surface split, no Plan D, no project-sourced requirements (measured: zero mentions of either ADR) | Any roadmap-sourced statement of v0.1 scope |
| C-8 | six files named at [ADR-009](../decisions/ADR-009-three-pilot-surfaces.md):154 | `glossary.md`, `roadmap.md`, `vision-and-positioning.md`, `personas-and-workflows.md`, `test-strategy.md`, `execution-and-evidence.md` still describe `apps/mobile` as v0.3 | Plan C landing |
| C-9 | [03-ui-references.md](../design/03-ui-references.md) | `(dash)` → `/dash`; the deleted `apps/demo` reference; no `**Last reviewed:**` field at all | Any dashboard slice reading it as procedure |
| C-10 | [04-role-pain-map.md](../design/04-role-pain-map.md) | No `**Applies to:**`, no `**Last reviewed:**`, no `**Related decisions:**` — it violates [docs/README.md](../README.md):87-119 and the validator does not check it | Nothing mechanical; a real unrecorded exemption |
| C-11 | [README-staging.md](../../infra/README-staging.md):4-11, :102, :173, :184, §Status | «58 files» → 81; §Status's «58/58» is a 2026-08-19 fact that must be dated as one, beside the sentence that twenty-three migrations have no apply record; and §4.5:510's branch-only `vercel.json` claim, merged 2026-08-21 | Any operator following §2, §4.5 or §Status literally |
| C-12 | [TODOS.md](../../TODOS.md):741-745 | «D1–D4 remain» → only D4 remains | Sprint ordering |
| C-13 | [2026-08-01-b0-procurement.md](../superpowers/plans/evidence/2026-08-01-b0-procurement.md) and [TODOS.md](../../TODOS.md) | Both record two unprocured devices; stale on the iPhone half (measurements of 2026-08-21), current on the Android half | Any statement that the parity gate is blocked *by hardware* |
| C-14 | [technical/openapi/README.md](../../technical/openapi/README.md):29 and [test-strategy.md](test-strategy.md):342 | «58 operations» → 75, per [version-0.1.md](version-0.1.md):162 | Any statement of the v0.1 route-set size |
| C-15 | [README-staging.md](../../infra/README-staging.md) §Status | Custom SMTP listed as open while :899-926 record Brevo done 2026-08-19/20 and depend on it | Any operator reading §Status as the state of email delivery |
| **C-16** | [test-strategy.md](test-strategy.md) §Baseline | The 2026-09-01 «green baseline» skipped 125 cases; the baseline since 2026-09-03 is **red with eighteen named cases** on `main`, and the section must record that run and that reading (§1.1) | Every gate record's CI row, which today cites this runbook instead |
| **C-17** | [jobs-events-and-audit.md](../architecture/jobs-events-and-audit.md):45 and [tenancy-and-security.md](../architecture/tenancy-and-security.md):243 | «The outbox has no consumer» / «None.» — against `delivery.ts`. Both are level 2 and outrank ADR-011 until edited ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):600-612), so ADR-011's own consumer statement is the one that loses today | M7's monitoring gate (§5.8) and any architecture-sourced statement about the outbox |

**None of these is a licence to skip the work.** The rule is that a slice
depending on a stale artifact stops until the correction lands — not that the
runbook may read past it. §4.1 step 4.5 is where a slice consults this
register, and §5.15 gives the register a task table of its own. **A rewrite of
this runbook is not a correction of any of them**: this document is a delivery
view and lands none of the rows above by restating them.

### 1.6 Open defects in [TODOS.md](../../TODOS.md), and which phase owns each

§3.1 makes the Senior PM function accountable for «TODOS.md residual entries»,
and [docs/ai-workflow.md](../ai-workflow.md) («The measured record of the retired loop») records that filing residuals there is what replaced the retired review
gates' verdict chain. *[Changed 2026-09-14 (DEV-005): §3.1 now names [docs/BACKLOG.md](../BACKLOG.md), which holds the open items of `TODOS.md`. The count below is the 2026-09-03 measurement of `TODOS.md` and was not re-taken.]*
Measured 2026-09-03: **35** open entries, **two** P1. Six bear directly on the
pilot and appear in no other section of this runbook; each is a failure a real
партнер or a real person in a Telegram group can hit on day one.

| Entry | What it is | Phase that owns it | Pilot impact |
|---|---|---|---|
| P1 — eighteen `apps/app` cases fail in CI (2026-09-03) | The set of §1.1, red on `main` since the isolated suites started running; fourteen of the eighteen are the channel's evidence bridge | P1 (readiness gate 11 cannot cite a red integration suite as isolation evidence) and P1b (M7's integration half) | **Blocks any «CI green» claim** and every gate record's CI row until fixed |
| P2 — retention durations are owed (0081 shipped inert) | Three `NULL` rows in `app.retention_policy`; twelve catalog rows at `duration_external_gate`; two tables with no row | P1 (M0 item 2) | No retention runs; an erased identity's raw id survives in two intent columns until `operational_security` has a duration |
| P2 — the assignment card renders a normative string without its tag and source (ADR-011 open item 9) | `cards.ts` renders `criterion — normRef` with neither; the owner ruled the card carries both before a real group sees it | P1 (M0 item 9) and P1b (M7's webhook-enable blockers) | **Blocks enabling the webhook anywhere** |
| P2 — a project access grant can be issued through the product and never taken back | No v0.1 operation revokes a project access capability; the only route back is a superuser `UPDATE` | P2, and §8.7 as an operating procedure | A mis-scoped grant during a pilot cannot be corrected through the product |
| P1 — the external review shell's auto-exchange, closed in code 2026-08-08, NEVER EXECUTED | The residue is external-plane throttling «which does not exist» — on the surface the технагляд uses | P1 (readiness gate 8) and §8.7 | A gateway that clicks every button burns the grant; recovery is `external_grants.revoke_reissue`, which reaches no browser |
| P2 — the evidence purge worker still runs nowhere | With `0031`, unpurged bytes count against a workspace quota | P1 item 12's resource-exhaustion half (§5.12) and §8.7 | A quota'd workspace eventually stops accepting uploads |

Three erasure-slice entries are not in the table because they are decisions or
notes rather than day-one failures, and §5.2 carries them: the parked findings
of 0081 (a service session can set the erasure markers itself; the raw id in
two intent columns), the workspace-closure procedure (P3), and the missing
test pin for the Telegram sender of `origin_not_distinguished`.

---

## §2. The phase model

Six labelled phases. **P1, P1b and P3 run in parallel** and block each other on
nothing; **P2 runs alongside all three and gates none of them**; P4a, P4b and P5
are strictly ordered. These are GoProceed's own phases, taken from
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decisions 7, 8 and 9 and
[ADR-009](../decisions/ADR-009-three-pilot-surfaces.md)'s three follow-up plans.
Nothing here is a phase invented for this document.

**A naming caution.** These phase labels collide with
[TODOS.md](../../TODOS.md)'s priority vocabulary, which also runs P0–P3 and
which this runbook uses at §1.4 and §1.6. Wherever the two could be confused,
this document writes «phase P2» or «TODOS P2» rather than a bare token.

```
  P1   M0 closure ─────────────────────────────┐
       (12 gates, evidence per item)           │
                                               │
  P1b  M1–M5 and M7 closure ───────────────────┤
       (acceptance evidence per milestone;      ├──► P4a  M6 OPENS ──► P5  Pilot
        M7 also: the webhook-enable blockers)   │
                                               │                        │
  P3   Pilot-object fill (discovery) ──────────┘                        │
       (six fields, none of them code)                                  │
                                                           P4b  M6 CLOSES
  P2   Plan C / Plan D delivery front                      (its acceptance
       (field-client parity, dashboard D4)                  evidence IS the
       — gates none of the above; see its                   pilot loop)
         own «Blocks» row
```

**Why P4 is drawn in two halves, and why P2 does not feed the junction.** Both
are corrections to an earlier drawing of this diagram that contradicted the
tables beneath it, and both are stated rather than smoothed:

- **M6 does not close before the pilot; it closes *by* the pilot.**
  [version-0.1.md](version-0.1.md):846-853 makes M6's acceptance evidence «the
  pilot loop, end to end, on a named object with a named adversarial технагляд
  … measured against a pre-gate baseline», and its **closing** evidence «the
  pilot findings document, plus the M0 evidence verified as still holding
  throughout the pilot». A P5 whose entry condition is «P4 complete» is
  therefore unsatisfiable as written. P4a (M6 opens) gates P5; P4b (M6 closes)
  happens inside it.
- **P2 is not on the critical path to M6.** The P2 table's own «Blocks» row
  says so, and the diagram is drawn to agree with it rather than against it.
  What P2 *is* on the critical path for is pilot **operability**, which is a
  different claim and is stated in that table.

### The hard ordering rule

> **M6 cannot open until M0 is closed, and closure means recorded evidence per
> item, not a checklist someone has read.**
> — [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):480-481, repeated
> **verbatim** at [production-readiness.md](production-readiness.md):98-99 and
> [scope-and-boundaries.md](../product/scope-and-boundaries.md):258-259.

[roadmap.md](../product/roadmap.md):494-496 is **not** a verbatim repeat and the
difference is worth keeping: it carries the rule in the words of protection 5 —
«**M6 cannot open until this milestone is closed.** Real customer data entering
an environment that has not closed M0 is a boundary violation regardless of
which document or schedule requests it» — and **not** the
closure-means-recorded-evidence clause. `grep -n "closure means recorded
evidence" docs/product/roadmap.md` returns nothing (measured 2026-09-01). Which
matters here, because the clause the roadmap is missing is the whole point of
this passage. C-7 already records that the roadmap carries no content dated
after 2026-08-08.

And its replacement-rule teeth
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):679-713, protection 5):

> **M0 cannot be reordered behind M6.** Real customer data entering an
> environment that has not closed M0 is a boundary violation *regardless of
> which document or schedule requests it*.

M0 is numbered **0, not 5.5**. It may be built in parallel with M1–M5, but it is
not allowed to be last.

### P1 — M0 closure

| | |
|---|---|
| **Outcome** | The environment is fit to hold a real subcontractor's personal data and a real customer's commercial data **before any of it arrives** ([version-0.1.md](version-0.1.md):272-275) |
| **Entry evidence** | The twelve exit gates transcribed into a per-item record naming the artifact that will close each and the form that artifact takes. «Nothing else, because every item is inside the builder's control — which is why this milestone can open first» ([roadmap.md](../product/roadmap.md):441-448). **That per-item record does not exist yet.** |
| **Exit gates** | Twelve. Twelve is eight plus four. §5 enumerates them. |
| **Acceptance evidence** | One dated evidence entry per gate in [version-0.1.md](version-0.1.md) §M0 — **all fourteen gates 1–14 of [production-readiness.md](production-readiness.md)**, per :305-313 — plus one executed restore exercise in an isolated environment and one executed deletion-then-restore test proving tombstones are reapplied before restored data is reachable |
| **Blocks** | P4a (M6 open), and therefore P5 |
| **Blocked by** | Nothing. This is why it can start today. |
| **Current status** | **Unopened.** 32 unchecked items, 0 checked (measured). |

Note the counting trap and do not fall into it: **M0 has twelve exit gates;
[production-readiness.md](production-readiness.md) carries fourteen numbered
gates** with the 12→14 mapping printed at :167-180. Gates 7 (incident path), 9
(capture-assurance) and 13 (demo and data separation) carry no M0 row and are
that document's own obligations. A runbook that says «twelve gates, twelve
evidence entries» under-collects by two. A document that says «twelve *plus*
four», or reaches sixteen, or counts a merged pair as one gate, is contradicting
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 7.

### P1b — M1–M5 and M7 closure

**This phase exists because P4a's entry evidence names it and nothing else in
this runbook did.** [roadmap.md](../product/roadmap.md):908-913 makes «M1–M5
closed» an entry condition for M6, and §8.6 step 5 gates real customer data on
it. Neither P1, P2 nor P3 contains it. The repository is not silent about what
closure means per milestone — [version-0.1.md](version-0.1.md) carries an
**Acceptance evidence** block for each and [roadmap.md](../product/roadmap.md)
carries **Entry evidence** and **Exit gates** for each — so the omission was
this document's, not the package's.

What is genuinely undefined in repo is the *mechanism*: **who** signs a
milestone closed and **where** it is recorded. Only M0 has one (fourteen dated
entries in [version-0.1.md](version-0.1.md) §M0). That is §10 Q-2 and this
phase does not invent an answer.

Status vocabulary is §5's: **OPEN**, **PARTIAL**, **BUILT / UNRECORDED**.
**No milestone below is closed**, because closure is a dated record and there
are zero of them.

| Milestone | Acceptance evidence, transcribed | Roadmap gates | Status | Next action |
|---|---|---|---|---|
| **M1 — the object** | «create a project and a contract; type twenty work lines by hand; correct one; remove one; be refused publication until a rule-version set is bound; publish; prove the published version immutable and the hand-typed line indistinguishable in provenance quality from an imported one; then run the frozen importer on a synthetic file and prove an object created by import still works end to end» ([version-0.1.md](version-0.1.md):423-428) | entry :501-521, exit :522-568 | **BUILT / UNRECORDED** — the routes and suites exist; no dated closure record does | Run the scenario against a stack that is up, record it in the Q-2 artifact once that artifact is decided |
| **M2 — the phone** | «**on one physical supported iPhone and one lower-resource physical Android device** — still required, and now the only way to know what the client actually does … Record, per browser and OS version, the measured behaviour of the `capture` hint, of image-metadata stripping or transcoding, and of site-storage eviction: none of it may be asserted from memory in any customer-facing artifact.» Closing evidence is «the device-matrix recording plus that measurement table» ([version-0.1.md](version-0.1.md):557-569) | entry :576-601, exit :602-698 | **OPEN — external dependency.** This is the same measurement §8.3 sub-item 4 is blocked on. An iPhone produced measurements on 2026-08-21 (C-13); **no Android measurement exists** | Sub-items 2 and 4 of §8.3 are iPhone-measurable today; the Android half needs the device |
| **M3 — the refusal** | «on a hand-typed baseline, create a stage; be refused its closure and read the `blocked_reason` object with the money behind it; record an `accept_risk` exception and watch the refusal lift while the exception stays visible and attributed; decide the occurrence internally and close; verify readiness recomputes and every blocker drills to authoritative facts» ([version-0.1.md](version-0.1.md):625-630) | entry :707-723, exit :724-772 | **BUILT / UNRECORDED** — `m3-refusal.int.test.ts` and `m3-closure-rls` exist (§6.3 proof 1) | Same as M1 |
| **M4 — the act** | «close a satisfied stage; compose the act; freeze it; render twice and diff the bytes; attempt to type a quantity and be stopped by **the absence of the field** rather than by validation; check the render field by field against the В.1/В.2 list.» And, in the same block: «**Entry evidence still owed and still absent:** one signed акт на закриття прихованих робіт from the target workflow, sanitized» ([version-0.1.md](version-0.1.md):692-699) | entry :779-795, exit :796-827 | **PARTIAL** — the В.1/В.2 list landed 2026-08-10 (§6.3 proof 2), so the render half is testable; the sanitized real act is still absent, and it comes from a partner | The byte-diff and field-by-field check can run today; the entry evidence is a P3 ask |
| **M5 — the link** | «an **adversarial** технагляд (ADR-006 decision 9) opens the link with no account, reads the requirement in the standard's own wording with the photo, and returns it with a reason; the return is visible as a refusal on the closure; the crew corrects and the decision is retaken» ([version-0.1.md](version-0.1.md):754-760) | entry :833-850, exit :851-897 | **OPEN — external dependency.** The acceptance evidence names a **real person from outside**, which makes M5 closure a P5 activity in the same way M6's is | Nothing inside the builder's control. It is filled by P3's second field |
| **M7 — the channel** (added 2026-09-03, [ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md) decision 9) | ADR-011 decision 10: the M0 gates the channel engages (1, 2, 3, 4, 5, 7, 8, 9, 11, 12) close with recorded evidence; the identity-level deletion procedure of gate 4 is exercised; and **before any environment enables the webhook**: Task 13's edge rate limit, the real-group staging pass, the scheduler, and the assignment card carrying the verification tag and source of every normative string it renders (ADR-011 open item 9). The spec's own rule: «No completion claim is made from green mocks alone; the real-group staging pass is required before the feature is described as operational» | [version-0.1.md](version-0.1.md) §v0.1-M7 | **BUILT / UNRECORDED on the unit half; RED on the integration half.** One gate record exists (the erasure procedure, 2026-09-03); the four webhook-enable blockers are all open; fourteen of CI's eighteen red cases are the channel's evidence bridge (§1.1) | Fix the eighteen; land the card slice; then Task 13, the scheduler and the real-group pass, in that order — none of them a real group |

**M7 and M0 are coupled twice over.** The channel is the first milestone whose acceptance evidence *is* M0 evidence — decision 10 closes it with the M0 gates it engages — and the first with a rule that runs across environments rather than across code: «no real group until M0 is closed» is the same sentence as protection 5's, applied to a Telegram group instead of a spreadsheet. A plan that schedules «enable the webhook on staging» before §5's gates 2, 4, 8, 9 and 11 have records is scheduling a boundary violation.

**The consequence P4a's entry condition hides.** Two of these six — M2 and M5 —
have acceptance evidence that **cannot be produced without something external**
(two physical devices; one adversarial технагляд). «M1–M5 closed» is therefore
not a purely internal precondition, and a plan that treats it as one will read
M6's opening as nearer than it is. Both sides are on the page rather than
resolved: [roadmap.md](../product/roadmap.md):908-913 states the condition and
[version-0.1.md](version-0.1.md):557-567 and :754-763 state what satisfying it
costs.

### P2 — the ADR-009 delivery front (Plans B, C, D)

The letter mapping lives in
[2026-08-20-three-pilot-surfaces.md](../superpowers/plans/2026-08-20-three-pilot-surfaces.md):46-48,
not in the ADR.

| Plan | What | Status |
|---|---|---|
| **B** | `/v1` cross-origin access — CORS in the shared route wrappers (`proxy.ts`'s matcher excludes `/v1`), `FIELD_CLIENT_ORIGINS` env; bearer already worked | **Done 2026-08-20**, measured on the wire 2026-08-21 ([README-staging.md](../../infra/README-staging.md):703-716) |
| **C** | Expo-web field client to parity, deployed as the third Vercel project, measured on the two physical phones | **Client exists; gate NOT closed.** [TODOS.md](../../TODOS.md):712-716: «none of the above is the parity gate» |
| **D** | Dashboard UI-minimum — D0 shell, D1 evidence read, D2 blocked value, D3 assignments (list + create), D4 members & access | **D0–D3 landed; D4 has no route** (measured: six `page.tsx` under `apps/app/app/dash`) |

| | |
|---|---|
| **Entry evidence, Plan C** | Two physical devices — one supported iPhone, one lower-resource Android — confirming the iOS 16.4+ / Android 10+ floor ([ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md):80-84: «A change to the floor requires an explicit compatibility decision and recorded device evidence»). **The Android device is unattested anywhere in the repository; an iPhone demonstrably existed on 2026-08-21** — C-13, §8.3. |
| **Exit gate, Plan C** | The Expo-web client passes [README-staging.md](../../infra/README-staging.md) §6 item 9 **plus INV-081, applied verbatim** — no new checklist is authored ([ADR-009](../decisions/ADR-009-three-pilot-surfaces.md):113-128). Passing is a measurement on hardware, not a code review. |
| **Entry evidence, Plan D4** | Two things, and only the first is satisfied. **(a)** A row in [04-role-pain-map.md](../design/04-role-pain-map.md) naming the role and the sentence in the demand scan that describes its pain; if neither exists, the screen is a guess (:134-140). **That row already exists** — :72, «Members & access … ПТВ / admin … signature-authority and “who is this subcontractor” ambiguity starts here» — so a reader need not go check. **(b)** The identity decision D4's own plan records as unresolved: «`GET /v1/workspaces/{ws}/members` returns `{memberId, userId, role, status}` and **no email, no name**: the office user would be granting capabilities to UUIDs… Deciding what identity to show is product work, not layout» ([2026-08-21-plan-d-dashboard.md](../superpowers/plans/2026-08-21-plan-d-dashboard.md):73). That is an owner decision, and if it needs a new operation to supply an identity, it needs its own dated ADR-009 amendment (§9.2). **§10 Q-15.** |
| **Exit gate, Plan D4** | The five-command UI gate of [02-building-ui.md](../design/02-building-ui.md):193-210 plus §6's six-viewport pass, and **no new API operation** unless a dated ADR-009 amendment authorises it |
| **Blocks** | **Nothing in P1, P1b, P3 or P4a** — this is why the diagram above does not draw P2 into the M6 junction. Plan C blocks the retirement of the `apps/app` PWA field pages. **But «and nothing else» would be false**, and the exception is operability rather than milestone closure: pilot *recovery* has no product route. [TODOS.md](../../TODOS.md):900-930 records that a project access grant issued through the product **cannot be revoked through it** — «the only route back is a superuser `UPDATE`» — and §6.1 records that `external_grants.revoke_reissue`, the only recovery INV-044 leaves for a lost link, reaches no browser at all. (Assignment *creation* is no longer in this list: D3's create screen landed in PR #54, which retires [2026-08-21-plan-d-dashboard.md](../superpowers/plans/2026-08-21-plan-d-dashboard.md):58's «today this is SQL».) Whether the revocation gap is accepted for the pilot or is a P2 exit condition is **undefined in repo**; §8.7 carries it as an operating risk rather than pretending it is closed. |
| **Standing rule** | «`apps/app`'s field pages stay deployed and functional and are the pilot's only working field client until Plan C's parity measurement lands. **No task in any of the three plans above may remove them first.**» ([TODOS.md](../../TODOS.md):746-750; [ADR-009](../decisions/ADR-009-three-pilot-surfaces.md):115-128) |

### P3 — the pilot object fill

This is **discovery work, not delivery work**
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):486-505). It cannot be
done by writing code and it does not get faster by building more.

| | |
|---|---|
| **Outcome** | All six fields of the ADR-006 decision 8 pilot object are filled |
| **Entry evidence** | The *reply* is not inside the builder's control — «A condition that requires a conversation nobody has had is not an entry condition; it is a wish» ([roadmap.md](../product/roadmap.md):339-365). **The asking is.** [2026-08-23-validation-push.md](../discovery/2026-08-23-validation-push.md) holds three asks ordered by cost-to-say-yes (:49-81) and four drafted materials — the follow-up to the 21 (:82), the one-file ask (:115), a 20-minute artifact-first interview guide (:137), the demo (:174) — all `Status: Draft for the owner. Nothing here has been sent.` The work exists and is unsent; §5.15 carries it as a task table |
| **Exit gate** | Six fields filled, in writing, in a named artifact. **That artifact does not exist** — see §10, Q-1. Note that [2026-08-23-validation-push.md](../discovery/2026-08-23-validation-push.md):191-201 («How this gets recorded») partly answers Q-1 and is the nearest thing the repository has to a proposal |
| **Blocks** | P4a (M6 open). **It also unfreezes import**: Material 2, the one-file ask, is exactly the request the cross-phase rule below says is the only thing that unfreezes it |
| **Current status** | Every field empty as of 2026-08-06; no ADR records any of them filled since. All eight assumptions still `Unvalidated` (measured). |

### P4a — M6 opens

| | |
|---|---|
| **Entry evidence** | M0 closed with a recorded artifact per item; **every** field of the pilot object filled; M1–M5 closed ([roadmap.md](../product/roadmap.md):908-913) — see P1b for what that last condition actually costs |
| **Already built** | `blocked_value.get` is routed with an integration suite. M6 was built without either headline measure and its suite asserts their **absence** ([ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md):151-161) |
| **Exit gates** | The sum is over work lines under a blocked stage, at the published-baseline price, attributed once per assignment (INV-070), broken down by `blocked_reason.code`, summed within one baseline and never across currencies; missing price, zero price and over-contract performance stay distinct and are reported *beside* the sum; blocked value is exposure, never a receivable; it is reported beside the two headline measures and **never as the hero number** ([version-0.1.md](version-0.1.md):781-798) |
| **The single cannot-close blocker** | The two headline measures have no v0.1 definition. C-5. |

### P4b — M6 closes, and it closes inside the pilot

| | |
|---|---|
| **Acceptance evidence** | «the pilot loop, end to end, on a named object with a named adversarial технагляд — a hand-typed baseline, an occurrence read on the phone before work started, a refused closure, an attributed exception, a satisfied closure and its act, an external return and its correction, and the blocked-money screen — measured against a pre-gate baseline … taken **before the gate is switched on**» ([version-0.1.md](version-0.1.md):846-852) |
| **Closing evidence** | «the pilot findings document, plus the M0 evidence verified as still holding throughout the pilot» ([version-0.1.md](version-0.1.md):853). Neither artifact exists; §8.7 is where they are specified and Q-1/Q-6 are where their homes are still open |
| **Runs during** | P5. This is not a phase that precedes the pilot and it must not be scheduled as one |

### P5 — the pilot

| | |
|---|---|
| **Entry** | P1, P1b, P3 and **P4a** complete. Not P4b — M6's own acceptance evidence is this phase |
| **Shape** | One named company, one named object, one named person who agreed. One технагляд, **named and adversarial**. Sample written down *before the first act*. Stopping conditions named in advance, in both directions. |
| **Exit** | Not a date. Either a stopping condition fires, or the sample is complete. |
| **Failure handling** | «A технагляд who refuses to open the link, refuses to decide inside it, or demands paper **invalidates A-3** and is written into [validated-assumptions.md](../discovery/validated-assumptions.md) as an invalidation» — recorded as a result, not as a bug ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):507-536) |

### Cross-phase rules

- **Every milestone closes** with tenant-isolation tests and one working vertical
  scenario through the UI/API/database boundary. From M3 onward a milestone
  **also** closes with at least one refusal proved by test — a closure denied and
  named, a `not_applicable` rejected on a `hold`, an external decision returned.
  «A screen that displays «не готово» closes nothing.»
  ([version-0.1.md](version-0.1.md):891-901)
- **Discovery entry evidence precedes each irreversible schema or UX freeze.**
- **Import is frozen, not deleted.** One real sanitized кошторис, АВР or
  interim-works file from a named company unfreezes it, and nothing else does
  ([version-0.1.md](version-0.1.md):146-153). One file is enough to unfreeze; it
  is not enough to validate.

---

## §3. Roles

**These are agent roles executed on behalf of one human owner. They are not
staff.** There is one person on this project; [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):480-484
says naming anyone else would be fiction. What the roster buys is *separation of
concerns inside one head* — which artifact a given pass is accountable for, and
which gate it must clear before the next pass starts. It buys no headcount, no
standups, and no sprint ceremonies. This repository runs none of those and this
runbook does not introduce any.

Where a role is written as accountable for an artifact, that means: the pass
executing that role writes the artifact, and the gate in the fourth column is
what stops the pass from claiming it is done. Concretely: the Frontend
Developer role owns `packages/ui/**`, and the gate that stops it is the
five-command UI gate of [02-building-ui.md](../design/02-building-ui.md):193-210
— which is exactly the gate whose step 3 was silently replayed from cache while
the motion audit was red from 2026-08-28 to 2026-08-31 (§6.4 gap (b)). A gate
that can be replayed from cache is not stopping anything, which is why the
fourth column and §6.4 have to be read together.

**A note on the labels.** «Sprint Prioritizer», «DevOps Automator», «Growth /
outreach» and «Support / onboarding» are borrowed names, and this document has
just disclaimed sprints two lines above. **The second column is the
definition** — each role is the artifact it owns, not the title it carries.
Read «Sprint Prioritizer» as *scope order* and «DevOps Automator» as *CI and
environments* if the borrowed word gets in the way.

### 3.1 Delivery tier — active today

Since 2026-09-13 the repository's development roles carry out each function below. The roles are listed in [agents/registry.json](../../agents/registry.json), routed by [agents/COORDINATION.md](../../agents/COORDINATION.md), and bound by root [AGENTS.md](../../AGENTS.md). The function names stay because the rest of this runbook uses them, including §5's owners and §10's «Who» column. The last column says who executes each function today. «Coordinator» is the primary coding session; «implementer» is the coordinator, or `gp-implementer` on an explicitly delegated slice.

| Function | Owns which artifact | Must clear which gate | Executed as |
|---|---|---|---|
| **Agents Orchestrator** | The slice sequence itself; which of P1/P2/P3 the next slice serves; the branch and the worktree | The scope-addition test (§9.1): name the numbered ADR-006 decision 1 step the slice is necessary for | Coordinator |
| **Senior Project Manager** | The task record `docs/tasks/DEV-NNN-<slug>.md` (its Assignment, Plan and Progress); the corrections-owed register (§1.5); [docs/BACKLOG.md](../BACKLOG.md) entries (residual entries in [TODOS.md](../../TODOS.md) until 2026-09-14, DEV-005) | The task record exists before implementation, with its route, allowed paths and acceptance criteria ([agents/COORDINATION.md](../../agents/COORDINATION.md), «Task state»: scoped before implementing) | Coordinator |
| **Sprint Prioritizer** | The order of P2's remaining work (D4 vs Plan C vs the M0 gates) | The demand-scan rule: a screen with no named role and no named pain sentence is a guess ([04-role-pain-map.md](../design/04-role-pain-map.md):134-140) | Coordinator proposes; **the owner decides**, recorded as a dated row in the task record's Owner decisions |
| **UX Architect** | A design spec at `docs/specs/YYYY-MM-DD-<slug>.md` for user-facing flows (the first spec creates the directory; specs before 2026-09-13 stay in `docs/superpowers/specs/`); the [04-role-pain-map.md](../design/04-role-pain-map.md) row that justifies a screen | The owner's approval of the spec before implementation; for any screen, the §3.3 three questions of [02-building-ui.md](../design/02-building-ui.md); `gp-ui-reviewer`'s PASS on the built screen | Coordinator writes the spec; `gp-ui-reviewer` gates the implementation |
| **Frontend Developer** | Everything under `apps/landing/**`, `apps/app/app/**`, `apps/mobile/src/**`, `packages/ui/**`, `packages/tokens/**` | The five-command UI gate ([02-building-ui.md](../design/02-building-ui.md) §5), output pasted, not paraphrased; then §6's six-viewport pass with real Ukrainian strings | Implementer, under the [02-building-ui.md](../design/02-building-ui.md) procedure |
| **Backend Architect** | `supabase/migrations/**`, `apps/app/app/v1/**`, `apps/app/app/external/**`, `packages/domain`, `packages/contracts`, `technical/**` catalogs; ADR drafts where a decision is being changed | `gp-architect`'s design before implementation (root AGENTS.md triggers); `pnpm validate:canonical-docs`, then the milestone's RLS + refusal suites | `gp-architect` designs; the implementer builds |
| **DevOps Automator** | [.github/workflows/ci.yml](../../.github/workflows/ci.yml), [turbo.json](../../turbo.json), [deploy-preflight.mjs](../../apps/app/scripts/deploy-preflight.mjs), [infra/README-staging.md](../../infra/README-staging.md), the three Vercel projects. It also owns **the accounts and quotas behind them**: a billing pause stopped CI for roughly a month (§4.2, §6.2), and that outage is the whole reason §1.3 cannot say whether nineteen merged PRs ever had a signal | CI's own two jobs green on a real push; the preflight's `OK` line in a production build log; `gp-security` over any change to CI permissions, action pins or application environment variables | Implementer; `gp-security` by trigger |
| **Evidence Collector** | The task record's Acceptance evidence matrix; the M0 dated entries in [version-0.1.md](version-0.1.md) §M0. Gate records written before 2026-09-13 stay in `docs/superpowers/plans/evidence/` | The baseline-honesty rule: nothing recorded as PASS without a command a reader can re-run ([test-strategy.md](test-strategy.md):595-604). A required NOT RUN blocks done | `gp-qa`, as an independent subagent on the final revision; the coordinator records its matrix |
| **Reality Checker** | The corrections-owed table; each task record's «What is not true after this task»; the §10 open-questions list | The precedence ladder ([docs/README.md](../README.md):28-75): it must name which side is current and why, never smooth | `gp-reviewer` over every diff; `gp-qa`, which records a PASS earned for the wrong reason as NOT RUN |

### 3.2 Security tier — activates per slice

| Function | Owns | Gate | When it activates |
|---|---|---|---|
| **Security reviewer** | The external-plane surface, RLS policies, grants, migration code | `gp-security` over the diff, as an independent subagent | For any slice touching `external_access_grants`, `external_sessions`, RLS, capability presets or the HMAC key handling. Also whenever another security trigger in root AGENTS.md matches, for example evidence storage, the Telegram webhook and identity erasure, or application environment variables. **An RLS or grant defect found in QA is reported by `gp-qa`. The implementer fixes it, as its own commit naming the test. Auth code is never a QA fix; it always takes the `gp-architect` and `gp-security` route** (root AGENTS.md, «RLS and grants found in QA»; the rule's history is in [docs/ai-workflow.md](../ai-workflow.md)) |

### 3.3 Growth tier — **not yet activatable, and this is not a scheduling problem**

| Role | What it would own | What must be true first |
|---|---|---|
| **Growth / outreach** | [outreach-log.md](../discovery/outreach-log.md), [2026-08-23-validation-push.md](../discovery/2026-08-23-validation-push.md)'s three asks and four materials, the seven letters under `discovery/templates/`, the landing page's claims | A production URL to point at. There is none: the seven letters are the *entire* current red of the canonical-docs gate, and the commit that narrowed the gate to them says the fix «needs an answer this commit cannot supply — what outreach should point at now» ([validate-canonical-docs.mjs](../../scripts/validate-canonical-docs.mjs):169-179). `https://goproceed-app.vercel.app` now exists; whether it is the answer is an owner decision, not a code change. **The four drafted materials do not wait on that decision** — Material 1, the follow-up to the 21, needs only a send. |
| **Pilot partner management** | The pilot object's six fields | A reply. **And the count that is usually quoted here needs its correction quoted beside it, not after it.** [version-0.1.md](version-0.1.md):136-143 records «21 evidenced sends, zero replies, zero interviews, zero named projects, zero pilot commitments, zero willingness-to-pay signals». [outreach-log.md](../discovery/outreach-log.md):66 records all 21 on **one day, 2026-07-28**, with no follow-up recorded since (that file's own **Last reviewed is 2026-07-30**) — **35 days with one touch** as of 2026-09-01, extending the «26 days» that document itself counted on 2026-08-23. [2026-08-23-validation-push.md](../discovery/2026-08-23-validation-push.md):11-25 names the standing reading as an error in terms: «That is a fair count and a misleading conclusion… Zero replies to a single cold email is the expected outcome of a single cold email; it is not information about the market». **This runbook relies on the second reading**: the zero is not a market signal, it is an unsent follow-up. |
| **Support / onboarding** | Anything a real user needs when something goes wrong | A real user. There are none, and M0's twelve gates are what has to close before there may be. **This stops being true on the pilot's first day** — §8.7 is where the support path is owed, and readiness gate 7 (incident path) is recorded OPEN at §5.13. |

The honest statement, corrected: **the growth tier's work is drafted and
unsent, not absent.** Four materials exist in
[2026-08-23-validation-push.md](../discovery/2026-08-23-validation-push.md);
what is blocked on a reply is the *result*, not the work. What is blocked on an
owner decision is the outreach URL (Q-3) and the send itself. Filling P3's six
fields remains the only growth-tier work that closes a phase, and §5.15 carries
it as a task table rather than as a sentence.

The demand scan those pain sentences come from is
[research-ua-demand-2026-08-21.md](../discovery/research-ua-demand-2026-08-21.md);
wherever this document or [04-role-pain-map.md](../design/04-role-pain-map.md)
uses «the demand-scan sentence» as a gate, that is the file being pointed at.

### 3.4 What no role does

No role in this roster is authorised to:

- expand v0.1 scope. Only an ADR can (§9.1);
- weaken a refusal. Only a superseding ADR can ([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md):884-901);
- expand an already approved scope from inside a stage. A conflict a stage finds goes back to the owner as a finding ([agents/COORDINATION.md](../../agents/COORDINATION.md), «Approved design and plan»);
- override the approved design and plan when a stage's recommendation conflicts with them (the same paragraph);
- modify RLS policies, grants, their migration or auth code as QA. `gp-qa` reports and the implementer fixes (root AGENTS.md, «RLS and grants found in QA»);
- merge, deploy, apply a migration to a hosted project, send outbound messages or make paid calls because a stage passed (root AGENTS.md, «Authority»).

---

## §4. The slice loop

The repeatable unit of work is a task. Each task has one record, `docs/tasks/DEV-NNN-<slug>.md`. [agents/COORDINATION.md](../../agents/COORDINATION.md) routes it under root [AGENTS.md](../../AGENTS.md), and [agents/PLAYBOOKS.md](../../agents/PLAYBOOKS.md) walks through it.

This section is the delivery view of that route for pilot work. It adds the pilot's own steps: the corrections check, the ADR test, and the UI and CI-shape gates. Where it and those files disagree, root `AGENTS.md` wins.

**What changed on 2026-09-13, stated rather than implied.** Until then a skill pack and seven named review gates drove the loop. The measured record of how much of that loop actually ran is in [docs/ai-workflow.md](../ai-workflow.md) («The measured record of the retired loop»): the plan shape across 33 plans, and the gates that produced no product, engineering or design review verdict after 2026-07-31. It moved there because a live procedure naming retired commands would fail the documentation gate that retired them. In practice those gates had been replaced by independent per-task review plus a whole-branch review. That replacement is now the rule, not a drift, which answers most of §10 Q-6.

### 4.0 The prohibitions, before anything else

1. **A stage never expands an approved scope, and the approved design and plan win when a stage's recommendation conflicts with them** ([agents/COORDINATION.md](../../agents/COORDINATION.md), «Approved design and plan»).
2. **QA does not modify RLS policies, grants, their migration or auth code.**
   - `gp-qa` records FAIL, with the smallest fix and the test that exposes the defect.
   - The implementer applies the fix as its own commit naming that test. In the same change it keeps `technical/data-access-surface.csv`, `technical/database/invariant-catalog.csv` and the spec or task record in agreement.
   - `gp-security` re-checks the fix, and `gp-qa` re-verifies it.
   - Auth code (`apps/app/proxy.ts`, session and OTP code, `supabase/templates/`, and the auth settings in `supabase/config.toml`) is never a QA fix: it always takes the `gp-architect` and `gp-security` route.

   Source: root AGENTS.md, «RLS and grants found in QA». History: until 2026-09-02 QA could touch none of this; from 2026-09-02 to 2026-09-13 QA could edit RLS and grants itself ([docs/ai-workflow.md](../ai-workflow.md)).
3. **Every behavior change gets an independent `gp-reviewer` and `gp-qa`, plus the stages its triggers name** (root AGENTS.md, «Required independent review»). A same-session self-review is never reported as independent.
4. **Touching `apps/landing/**`, `apps/app/app/**`, `packages/ui/**` or
   `packages/tokens/**` means reading [02-building-ui.md](../design/02-building-ui.md)
   FIRST.** It is the procedure, not background. **Reviewing UI counts as
   touching it.**
5. **Never implement, configure or advise on a third-party library, SDK,
   platform API or hosted service from memory.**
   - Read the installed version (`package.json`, lockfile, `--version`).
   - Fetch the CURRENT docs for **that** version.
   - Where the installed version and the current docs disagree, say so explicitly, name both, and **record the upgrade as an entry in [docs/BACKLOG.md](../BACKLOG.md) with its deadline**, rather than silently coding to the old shape. *[Changed 2026-09-14 (DEV-005): this named `TODOS.md`, whose open items moved to the backlog.]*
   - **Cite what was checked, version and doc URL, in the commit or PR and in the task record's Sources.**

   Source: root AGENTS.md, «Third-party libraries and services: current docs first, never memory». There is a live instance today: the local Supabase CLI is 2.114.0 against a 2.115.0 pin (§1.1), and §8.1 makes bringing it up a precondition of any push.
6. **Two UI rules fail with no error at all**, which is why they are prohibitions rather than style:
   - **never write a Tailwind class as a template literal.** With `bg-${tone}`, the scanner sees the template, emits no CSS, and the element renders unstyled with nothing warning;
   - **never edit a file whose header says GENERATED.** Edit `packages/tokens/src/tokens.json`, then run `pnpm --filter @goproceed/tokens generate`.

   Both are among the five rules in root AGENTS.md («UI and the design system») that «hold even if you read nothing else».
7. **A local test run against the local stack destroys its data.** Most `apps/app` integration suites truncate tenant tables. The `packages/testing` suites that call `resetDb()` run `supabase db reset`. Run them locally only with the owner's confirmation (root AGENTS.md, «What "the tests pass" means here»).

### 4.1 The steps

| # | Step | Route / role | Artifact produced | Function (§3) |
|---|---|---|---|---|
| 1 | **Isolate** | A git worktree and branch. **Branch naming is `claude/<slug>` for feature work and `chore/<slug>` for maintenance.** That is the convention the tree shows, not a rule any document states | A branch | Orchestrator |
| 2 | **Intent and owner decisions** | The coordinator states the goal, the user it serves and what is out of scope. It puts questions only the owner can answer to the owner, one at a time ([agents/PLAYBOOKS.md](../../agents/PLAYBOOKS.md), feature slice step 1) | The coordinator opens the task record from [agents/TASK_TEMPLATE.md](../../agents/TASK_TEMPLATE.md) as `docs/tasks/DEV-NNN-<slug>.md`, next free number, with a row in `docs/tasks/README.md`; the record's **Owner decisions** table, each row dated | Orchestrator / owner |
| 3 | **Design spec**, where the slice has a real design | Written by hand. Copy the shape of an existing spec that matches the slice's kind: [2026-08-28-assignment-creation-design.md](../superpowers/specs/2026-08-28-assignment-creation-design.md) for a screen, [2026-08-24-project-sourced-requirements-design.md](../superpowers/specs/2026-08-24-project-sourced-requirements-design.md) for a schema-and-route slice | `docs/specs/YYYY-MM-DD-<slug>.md`, approved by the owner before implementation and linked from the task record | UX Architect |
| 4 | **Product-level test**, §9.1's: **if the slice would need an ADR to be authorised, or changes what a screen claims, it is product-level.** A slice that only implements an already-numbered ADR-006 decision-1 step is not | The coordinator applies the test; the owner rules | A dated Owner decisions row. If the slice is product-level, step 5b comes before step 5 | Sprint Prioritizer / owner |
| **4.5** | **Corrections check**. This step exists because §4.4 names the rule this repository breaks most often | Read §1.5 | If any row's **Blocks** column names this slice's subject, **land that correction first, in its own commit, and strike the row** (a row leaves the table when it lands). Then update the Approved product or domain document the slice changes **before** writing the plan ([docs/README.md](../README.md):169-171, change control step 2) | Reality Checker / Senior PM |
| 5 | **Task record: Assignment and Plan** | The coordinator fills the record opened at step 2 | The Assignment section (route, triggered stages, allowed paths, acceptance criteria) and the **Plan** section: ordered steps, the files each touches, and the check that proves each | Senior PM |
| **5b** | **ADR, where §9.1's test demands one** | The coordinator drafts it with `gp-architect`, and with `gp-researcher` for any unverified external fact; **the owner rules** ([agents/COORDINATION.md](../../agents/COORDINATION.md), «A decision that needs an ADR») | `docs/decisions/ADR-0NN-<slug>.md`, next free number (ADR-011 is the highest today), carrying the owner's ruling with its date. **Two things stay undefined in repo until the status layer lands** (§10 Q-6): what an ADR's status field moves through, and whether the ruling-in-conversation form ADR-011 records is the whole procedure | Backend Architect / **owner** |
| 6 | **Design stage** | `gp-architect` before implementing a schema, RLS, grant, contract, catalog, worker or Telegram-channel change, or auth code; `gp-mobile` for field-client or device behaviour (root AGENTS.md triggers) | The design, the invariants it touches and its failure cases, recorded in the task record's Progress; the Plan is revised to match the design before step 7 | Backend Architect / UX Architect |
| 7 | **Execute** | The implementer. **A contract, refusal, invariant, token or audit rule gets its failing test first.** Any failure follows the bug-fix playbook: a hypothesis, evidence that could refute it, one change at a time, and a fix seen failing without itself | Code, migrations, tests | Frontend / Backend |
| 8 | **UI gate** (where applicable) | §6.1 **Group D**, which transcribes the five commands of [02-building-ui.md](../design/02-building-ui.md) §5, then §6's viewport pass. **Command 3 of that gate is a Group B command**: the database must already be up (§6.6), and it resets the local database (§4.0 item 7) and needs the owner's confirmation first | Pasted output | Frontend |
| 9 | **Local suite in CI's shape** | See §6.2. **Local database suites need the owner's confirmation first** (§4.0 item 7) | A dated run that names which suites ran | DevOps |
| 10 | **Review** | `gp-reviewer` over the diff file, always; `gp-security` and `gp-ui-reviewer` when their triggers match. Each runs as an independent subagent | Findings in the task record; fix rounds committed as `fix(<scope>): fix round N — <what was wrong>`. Rework is limited to the findings' stated fixes. `gp-reviewer` runs again if rework changes behaviour beyond a stated fix, and `gp-security` re-checks fixes to its own blocker and major findings. A round, as root AGENTS.md counts it, is one rework and re-verification cycle that ends in a QA FAIL or a new blocker. The first review does not count, and the `fix round N` commit number is not that count. After three rounds, stop: record the escalation in the task record (failure history, root cause, options) and ask the owner to choose | Reality Checker |
| 11 | **Verify** | `gp-qa` on the final revision, once findings are resolved | The task record's **Acceptance evidence** matrix: PASS / FAIL / NOT RUN per criterion (§7.4). A required NOT RUN blocks done | Evidence Collector |
| 12 | **Land** | A PR; **the owner merges** | A PR whose body names the task record, the slice's ADR or numbered step, and, where a third-party library was touched, the version and doc URL checked (§4.0 item 5). **Merge convention is `Merge pull request #N`, which is what §1.3's PR count is measured off** | Orchestrator |
| **Abort** | A slice stopped before done, including one escalated after three rounds where the owner chooses not to continue | Root AGENTS.md, «Records, rework and escalation» | The task record moves to `cancelled`, with the reason, the partial artifacts and the remaining risks. The branch is left as it is | Orchestrator / owner |

### 4.2 Task record shape

The shape is [agents/TASK_TEMPLATE.md](../../agents/TASK_TEMPLATE.md). This runbook adds to it only what §7.3 lists for pilot slices. [docs/ai-workflow.md](../ai-workflow.md) records the plan shape slices used before 2026-09-13, with the commands that measured it across the 33 dated plans in `docs/superpowers/plans/`.

Every slice from about 2026-08-20 to 2026-09-01 carried a standing Global Constraint: «CI is billing-paused until 2026-09-01. Verify locally in CI's shape; a red check before then is billing, not code.» **It has expired, by the rule this paragraph set for it: a run exists.** CI has run on every push since 2026-09-01 (§6.2 lists the runs). A red check today is code, and §1.1 names which code. Task records written after 2026-09-03 must not carry the constraint.

### 4.3 The retired review gates

[docs/ai-workflow.md](../ai-workflow.md) («The measured record of the retired loop») records the seven review gates of the pre-2026-09-13 loop and the date each last produced a recorded verdict. Two facts from that record matter to this runbook:

- no product, engineering or design review verdict exists after 2026-07-31;
- the security audit of 2026-09-02 drove two merged PRs (#62, #65), but its report was never tracked.

**Since 2026-09-13 the stages in root AGENTS.md replace those gates, and each stage's result lives in the task record.** Evidence that exists only outside the tree is not evidence of record.

### 4.4 The rule this repository breaks most often

[docs/README.md](../README.md):167-176, change control, step 2: **Approved
product and domain documents are updated BEFORE implementation planning.**
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):593-628 states the
consequence in terms — making those edits «is a condition of this decision
taking effect, not a follow-up task». **Six** of the fifteen corrections in §1.5
are traceable to that step being deferred — C-1, C-2, C-3, C-4, C-7 and C-8, all
of them Approved product or delivery documents not rewritten before planning.
The rest have other causes and saying «all of them» would be a round number
rather than a finding: C-10 is a metadata omission
([docs/README.md](../README.md):87-119), C-11 and C-15 are a stale operator
runbook, C-13 is a stale procurement record overtaken by a measurement, and
C-14 is two catalog documents left behind by a growing route set.

**§4.1 step 4.5 is where this rule becomes executable.** Naming the rule and
then leaving the loop unchanged is how it got broken fifteen times.

---

## §5. The twelve M0 gates, as an executable checklist

M0 has **twelve** exit gates
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):422-474). Twelve is eight
plus four. [production-readiness.md](production-readiness.md) carries them as
**fourteen** numbered gates with the mapping at :167-180; that document's gates
7, 9 and 13 carry no M0 row and are obligations it owes on its own account.
**All fourteen still need a dated evidence entry**
([version-0.1.md](version-0.1.md):316-324). One numbering is the decision's; the
other is the readiness document's. Keep them distinct and never present fourteen
as an M0 count.

Three traps this section preserves rather than smooths:

- **items 7 and 8 are two gates, not one.** Merging them is what produced a list
  of twelve containing eleven obligations and room for a thirteenth;
- **the export-formula-injection half of item 12 is not optional** and is not
  inferable from a shortened "uploads and imports" wording;
- **the ДБН retrieval record is not a thirteenth gate.** It is what closes
  item 9.

Status vocabulary in the tables below: **OPEN** (nothing built), **PARTIAL**
(mechanism exists, gate not closable as written), **BUILT / UNRECORDED** (the
artifact exists in code and no dated evidence entry does). **No gate anywhere
below is closed**, because closure is a dated record and there are zero of them.

### 5.1 — Item 1: privacy notice and versioned external confirmation text

*(readiness gate 1)*

| Half | Status | Evidence today |
|---|---|---|
| Published privacy notice covering evidence content, EXIF/GPS policy, contacts, filenames, security telemetry | **OPEN** | No privacy route, page or document exists in `apps/landing` or `apps/app` |
| Versioned external confirmation text, pinned on every external decision | **BUILT / UNRECORDED** | `EXTERNAL_CONFIRMATION_TEXT_VERSION` is `external-occurrence-decision/1+<12 hex>` over a SHA-256 of the text, the level statement and the not-a-signature denial joined by NUL; `external_decision_batches.confirmation_text_version` is NOT NULL with a non-blank CHECK; the submit route refuses a mismatch |

**Blocked on a decision outside the code.** A published notice needs a
controller identity and a domain. `{{APP_HOSTNAME}}`, `{{LANDING_HOSTNAME}}` and
`{{CONTACT_EMAIL}}` are unresolved tokens by design
([README-staging.md](../../infra/README-staging.md):29-68) because no custom
domain has been chosen for any of the three surfaces.

**Next action:** owner decides the domain (§10 Q-3). Then write the notice, with
the EXIF paragraph constrained by [ADR-007](../decisions/ADR-007-pilot-field-client.md)
Cost 1 — a browser may strip or re-encode metadata before the page sees the
bytes, so the notice may promise neither retention nor removal, in either
direction.

### 5.2 — Item 2: retention periods and a manual closure/deletion procedure

*(readiness gates 2 and 4)*

| Half | Status | Evidence today |
|---|---|---|
| Documented retention periods | **PARTIAL** — mechanism built, every duration NULL | [technical/data-retention-catalog.csv](../../technical/data-retention-catalog.csv) still carries `duration_external_gate` on every row. Since 2026-09-03 a mechanism exists for the communication classes — `app.retention_policy` (three rows, all `NULL`) and `app.apply_communication_retention`, scheduled nightly and inert until a duration lands by migration; the catalog notes say which of its rows the mechanism reaches and which it does not ([TODOS.md](../../TODOS.md) P2, retention durations) |
| Manual closure/deletion procedure with authorization, separation of duties, dry-run inventory, export offer, confirmation, recorded outcome | **PARTIAL** — the identity-level half exists and was exercised | Since 2026-09-03: one Telegram identity can be erased on request (`app.erase_telegram_identity`, the operator script in [README-staging.md](../../infra/README-staging.md) §7) and the procedure was exercised on synthetic data with a gate record ([2026-09-03-telegram-identity-erasure-gate.md](../superpowers/plans/evidence/2026-09-03-telegram-identity-erasure-gate.md)). **Workspace-level closure — authorization, separation of duties, dry-run inventory, export offer, recorded outcome for a whole workspace — is still OPEN** ([TODOS.md](../../TODOS.md) P3, workspace closure) |
| Deletion-then-restore test proving tombstones are reapplied before restored data is reachable | **OPEN** | Requires both a deletion path and a restore path; neither exists |

**A live contradiction to fix, not to work around.** The Hard Rule at
[production-readiness.md](production-readiness.md):118-123 says durations must
come from the approved retention schedule, **not from implementation defaults**.
Migration `0027` ships `organizations.blocked_content_retention_days integer not
null default 7` — a duration invented in code with no approved schedule behind
it. Closing this gate means either the schedule ratifies 7, or the column
changes.

**Next action:** decide pilot durations (§10 Q-4) — the three communication classes first, because a mechanism is waiting on them — version the catalog, then write the workspace-level procedure.

### 5.3 — Item 3: workspace export

*(readiness gate 3)*

**Status: OPEN, and not even in scope.** No operation in
[scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv) mentions export; no
route exists under `apps/app/app/v1`.

This is deliberate and it is recorded: the export is **an operator-run procedure
in v0.1**; making it a member-plane operation would add a row to the route set,
«and that is not decided here» ([version-0.1.md](version-0.1.md):214-217).

What the gate asks for: an export reproducing authorized originals and the
statutory act version with manifest, hashes, provenance and **named omissions**,
and reproducing manually entered work lines with the same provenance as imported
ones.

**This gate blocks item 12's second half.** There is no export to neutralize
against spreadsheet formula injection until this exists.

**Next action:** design the operator procedure — what it runs, who runs it, what
output counts as «produced and reopened». All three are undefined in repo.

### 5.4 — Item 4: restricted audit and security telemetry

*(readiness gate 2)*

| Half | Status | Evidence today |
|---|---|---|
| Restricted audit trail | **BUILT / UNRECORDED** | `public.audit_events` exists with `organization_id`, `actor_type`, `action`, `object`, `request_id`, `details`, `reason_code` and a `prev_row_hash`/`row_hash` chain, tenant-restricted (migration `0002`). The service plane writes to it only through definers (`0078`), and an erasure writes one row that carries the surrogate and never the identifier (`0081` §4) |
| «each event carrying a declared purpose and retention» ([roadmap.md](../product/roadmap.md):460-461) | **OPEN** | `audit_events` carries no purpose column and no retention column |
| Security telemetry | **OPEN** | No `security_events` table exists in any migration, although the retention catalog lists one |

**Next action:** decide whether purpose/retention are per-event columns or a
declared mapping from `action` to a class. Undefined in repo.

### 5.5 — Item 5: backup and restore verification

*(readiness gate 5)*

**Status: OPEN.** No encrypted backup policy document exists. `grep -i
'backup\|restore'` over the 1003-line
[README-staging.md](../../infra/README-staging.md) returns nothing. No restore
exercise record exists anywhere.

Required form: an approved policy **plus one executed restore into an isolated
environment** verifying relational rows, object bytes, hashes, tenant boundaries
and the v0.1 evidence links.

**Two things undefined in repo:** what Supabase's own PITR/backup tier gives
this project, and what «an isolated environment» means for a one-person project.

**Next action:** read the current Supabase docs for the plan actually in use —
per root [AGENTS.md](../../AGENTS.md) («Third-party libraries and services: current docs first, never memory») — then
write the policy, then run one restore and record it.

### 5.6 — Item 6: documented external-link assurance limits

*(readiness gate 8)*

| Half | Status | Evidence today |
|---|---|---|
| UI half, external review shell | **BUILT / UNRECORDED** | The shell renders `assurance.levelStatement` and `assurance.notASignature` and repeats both on the receipt; the confirmation sentence labels reviewer name/company/title as self-declared («відомості, які я повідомляю про себе; вони не є підтвердженою особою»); a test bans «допустим», «доказ», «юридичн» and «підпис» from it |
| Print half | **PARTIAL** | `renderStatutoryAct` emits the level line and, for level 3 only, the not-a-signature text after it, and `act-content-fidelity.test.ts` compares five mandated disclaimers **byte for byte** against [hidden-works-content-rules.md](../product/hidden-works-content-rules.md) read at test time. But **there is no paginator and no print/PDF surface**, so «on every printed page» is asserted at model level only |
| The office dashboard | **OPEN** | It displays no assurance level anywhere, although [hidden-works-content-rules.md](../product/hidden-works-content-rules.md):341-343 requires every recorded acknowledgement, decision or signature to carry one «displayed in the UI and printed on the page» |

Consistent with the gate, and to be preserved: neither article of Закон
№ 2155-VIII is printed in a customer-facing artifact — both remain UNVERIFIED
because the law's primary text was never fetched. v0.1 prints only the negative
statement.

**Next action:** add the assurance level to the dashboard's evidence and act
views; decide whether «every printed page» is satisfiable without a paginator
(§10 Q-5).

### 5.7 — Item 7: secrets and environment separation

*(readiness gate 14 — **and this is a separate gate from item 8**)*

| Half | Status | Evidence today |
|---|---|---|
| No known default password reachable on a hosted database | **BUILT / UNRECORDED** | [supabase/seed.sql](../../supabase/seed.sql) sets no role password; local/CI passwords come from `scripts/set-local-app-password.mjs`, which refuses any non-loopback host; migrations `0003` and `0034` create both LOGIN roles with **no password at all** |
| A deploy contract that refuses a misconfigured build | **BUILT / UNRECORDED** | `apps/app/.env.example` is the complete contract; [deploy-preflight.mjs](../../apps/app/scripts/deploy-preflight.mjs) enforces twelve required names, refuses `app_pw`/`service_pw`/loopback values, refuses `APP_DB_URL === SERVICE_DB_URL`, and refuses a legacy `eyJ…` JWT in either new key name — running only when `VERCEL=1` or `DEPLOY_PREFLIGHT=1` |
| Key IDs on HMAC and session verifier keys | **BUILT / UNRECORDED** | `EXTERNAL_LINK_HMAC_KEYS` / `EXTERNAL_LINK_ACTIVE_KEY_ID` and the session pair, format `<keyId>:<base64 ≥32 bytes>`, no default key by design |
| A per-environment secret store with its own rotation runbook | **PARTIAL** | Rotation instructions exist but live *inside* the staging provisioning runbook ([README-staging.md](../../infra/README-staging.md):410-422, :226-232), not as a standalone artifact |

**One recorded disagreement to settle with a tick, not an argument:**
[version-0.0.md](version-0.0.md):78-79 leaves «staging/production role passwords
are generated per environment and never committed» **unticked**, while
[README-staging.md](../../infra/README-staging.md):971-984 records both
`goproceed_*_login` passwords set (SCRAM, different) on 2026-08-19. Under M0's
own rule the unticked box is the operative state. The correction owed is to tick
it with the 2026-08-19 date and that Status paragraph as its evidence.

### 5.8 — Item 8: monitored job and message failure paths

*(readiness gate 6 — **the second of the pair, not a merge**)*

**Status: OPEN, and it cannot be closed by adding a dashboard.**

The nine metrics are specified (outbox age, job/retry counts, lease/fence,
dead-letter, provider errors, artifact hash mismatch, projection lag, orphan
purge) and **nothing is wired**: no Sentry/OTel/Datadog dependency, no alerting
code. The external exchange route states it in terms: «distributed-abuse
alerting on this exact endpoint. NONE OF IT EXISTS — this product has no rate
limiter for any surface.»

The compounding fact has changed shape since 2026-09-01 and the two halves must be kept apart. **A consumer now exists in code**: `apps/app/src/lib/telegram/delivery.ts` claims the `communication.telegram.send` topic and delivers cards and replies (the two level-2 architecture documents that still say «no consumer» are C-17). **No consumer runs anywhere**: nothing schedules it — ADR-011 decision 10 names «the scheduler» as one of the four blockers before any environment enables the webhook — `supabase/functions/outbox-drain` is explicitly not deployed, and the upload-purge worker has no runner. So on staging the queue still never drains (the staging checklist's inverted step 6 still holds) and a dashboard still closes nothing; what is new is that «monitored» now has a concrete consumer to monitor once one runs.

**Next action:** decide what «monitored» means for a pilot with one workspace —
a runner plus alerts, or a documented acceptance that nothing drains and the
failure path is the owner reading a query. Either is defensible; neither is
written.

### 5.9 — Item 9: no normative string renderable without its verification tag and its source

*(readiness gate 10, first bullet — **enforced in storage, not in a template**)*

**Status: PARTIAL since 2026-09-03.** Until the channel, this was the strongest-built gate on the list, and its storage half still is. The channel added a **renderer the gate had not met**: the Telegram assignment card (`apps/app/src/lib/telegram/cards.ts`, fed by the card route) renders `criterion — normRef` with **neither the tag nor the source**, and [hidden-works-content-rules.md](../product/hidden-works-content-rules.md) — which binds at every precedence level — carries no Telegram sentence. The owner ruled on 2026-09-03 (ADR-011 open item 9) that the card carries both before a real group sees it; the slice is in [TODOS.md](../../TODOS.md) P2 and is one of the four blockers before any environment enables the webhook. The storage half, unchanged:

- `requirement_library_items.verification text not null check (verification in
  ('VERIFIED_PRIMARY','VERIFIED_SECONDARY'))` — `UNVERIFIED` is deliberately
  **unstorable**;
- `source_citation text not null check (length(btrim(source_citation)) > 0)` —
  the comment records that NOT NULL alone is not INV-073 because it admits `''`
  and `'   '`;
- the same pattern recurs in migrations `0043`, `0047` (act form citation) and
  `0059` (project-sourced strings);
- the renderer keeps a redundant render-half blocker `form_citation_unsourced`.

**The ДБН retrieval record closes this item and is NOT a thirteenth gate.** It
exists and was reproduced rather than recorded on trust:
`url: https://e-construction.gov.ua/laws_detail/3879707932224390963`,
`retrievedOn: 2026-08-10`, `sha256: 4592edaf…a665e3`. The same three facts
appear in the source column of **every** row of
[dbn-a31-5-2016-dodatok-n.csv](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv)
(measured: twelve content rows), and the durable `laws_detail` page is stored
rather than the expiring files-token link.

**One residual nobody has resolved.** All three canonical documents word the
gate as the record being «committed under `technical/requirements/`». The record
*as a record* lives in `apps/app/src/lib/statutory-act-form.ts`;
`technical/requirements/` holds the two CSVs whose source column repeats the
three facts per row, and holds neither a separate retrieval-record file nor the
636 603-byte ДБН file itself. Whether that satisfies the wording is an owner
call (§10 Q-7).

**A re-fetch that does not reproduce the same bytes downgrades every row it
touches to `VERIFIED_SECONDARY`.**

**Next action:** write the dated evidence entry. The mechanism is done; the
record is not.

### 5.10 — Item 10: recorded date of last verification against the Реєстр будівельних норм

*(readiness gate 10, second bullet)*

**Status: PARTIAL.** The storage and print mechanism is built:
`statutory_act_versions.registry_checked_on` exists, is required at freeze by
`statutory_act_versions_frozen_complete_check`, is guarded against a future date
with a one-day UTC allowance, and `pageFooterText()` prints «Перевірено за
Реєстром будівельних норм: {date}» on the page footer of every rendered act.

**But there is no fact table behind the date.** The composer supplies a date the
database can only check is not in the future. M0 gate 10 owns the registry check
and builds nothing.

**Next action:** perform the registry check, record what was checked and when,
and decide whether the date's provenance is itself an artifact under
`technical/requirements/` or a procedure the operator repeats.

### 5.11 — Item 11: tenant-isolation tests for every module v0.1 ships

*(readiness gate 11)*

**Status: PARTIAL.**

| Half | Status |
|---|---|
| RLS suites exist per milestone | **BUILT** — `rls.test.ts` plus `m1-rls-baseline`, `m1-rls-workspace`, `m1-rules-rls`, `m2-rls`, `m2-occurrences-rls`, `m3-closure-rls`, `m4-act-rls`, `m5-external-rls`, plus `m2-policy-gaps.test.ts` for write paths the first suite missed; since 2026-09-01 also `telegram-rls.test.ts` and, in `m5-external-rls`, the column-level-grant case («a column-level grant is a fence, not a door») and INV-099's erasure sweep in `telegram-erasure.test.ts` |
| A mechanical assertion that RLS is *enabled* everywhere | **BUILT** — every `public` relation with `relrowsecurity` false must be an empty list |
| «a positive AND negative policy test per exposed tenant relation, **checked against the module list rather than sampled**» (INV-060) | **OPEN** — no mechanical checker exists. INV-060 appears in [invariant-catalog.csv](../../technical/database/invariant-catalog.csv) and three prose documents and in **zero test files** |

**One thing this gate cannot cite today.** The channel's integration suites under `apps/app/tests/` are red in CI (§1.1); a gate-11 evidence entry that reaches for them as isolation evidence is reaching for a failing run. The `packages/testing` sweeps are green and are the evidence this gate has.

**Next action:** write the coverage checker, or record explicitly that coverage
is asserted by review rather than by a checker — and say so in the evidence
entry rather than letting the RLS-enabled sweep stand in for it.

### 5.12 — Item 12: malware/content-type and resource-exhaustion controls, uploads **and** imports

*(readiness gate 12)*

| Half | Status | Evidence today |
|---|---|---|
| Content-type enforcement | **BUILT / UNRECORDED** | `sniffMediaType` recognises JPEG/PNG/PDF/HEIC **from magic bytes, not the client's claim**, and blocks with `unrecognised_content` or `declared_type_mismatch` |
| Resource exhaustion, uploads | **BUILT / UNRECORDED** | evidence-bucket `file_size_limit` (`0020`), per-workspace quota (`0026`), orphan purge (`0021`), `scan_blocked` retention (`0027`) |
| The frozen importer's safety limits | **BUILT / UNRECORDED**, and they match the wording item for item | `XLSX_LIMITS`: maxBytes 20 971 520, maxEntries 10 000, maxTotalUncompressed 104 857 600, maxCompressionRatio 100, maxRows 20 000, maxCols 256, maxCellChars 32 768. The ZIP central directory is scanned by hand with **nothing inflated**; macro containers (`vbaProject`, `xl/macros/`) rejected; errors include `XLSX_MACROS_PRESENT`, `XLSX_PATH_TRAVERSAL`, `XLSX_BOMB_RATIO`, `XLSX_BOMB_SIZE`, `XLSX_ENCRYPTED_OR_LEGACY`. Formulas are read as inert text plus cached value and surfaced as a non-blocking `FORMULA_CELL` warning. CSV has its own `maxBytes` with `CSV_TOO_LARGE` |
| Malware scanning | **OPEN by design** | `evidence-inspection.ts` says it in terms: «v0.1 ships no anti-malware engine, and this does not pretend otherwise… Real content scanning stays out of scope.» The gate says «malware … controls». **Whether magic-byte enforcement plus a bounded allow-list is accepted AS the malware control for a pilot is undefined in repo — an ADR-shaped decision nobody has written** |
| **Export neutralization against spreadsheet formula injection** | **OPEN, and unbuildable today** | There is no export. Blocked behind gate 3 (item 3). All three canonical documents flag this half as the one that «is not optional and is not inferable» |

**Next action:** take the malware decision as an ADR (or record the acceptance
in the evidence entry with the risk named); then item 3, then this half.

### 5.13 — The three readiness gates with no M0 row

They still need dated evidence entries
([version-0.1.md](version-0.1.md):316-324), and they are not M0 exit gates.

| Readiness gate | Status | Note |
|---|---|---|
| **7. Incident path** | **OPEN** | No named responder, no leaked-credential playbook. [README-staging.md](../../infra/README-staging.md):226-232 carries credential-compromise instructions — a fragment of the playbook, not the playbook. On a one-person project the responder is the owner; the gate still asks for the name and the routing path to be written down |
| **9. Capture-assurance copy** | **PARTIAL** | Bullet 1 is *structurally* enforced: the field client has exactly one literal to send, `origin_not_distinguished` (INV-086, [ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 5), and migration `0043` widened the `capture_origin` CHECK to make it storable and mandatory. Bullet 2 is built: `claimed_capture_time` with `capture_time_trust` defaulting to `device_claimed`, a server `reported_at`, and finalization refusing on a content-hash mismatch. Residual: `ORIGIN_METHOD_LABELS` still carries `native_camera`/`photo_picker` labels the product cannot produce |
| **13. Demo and data separation** | **PARTIAL (vacuous)** | `apps/demo` was retired 2026-08-20; `apps/` holds only `app`, `landing`, `mobile`. No demo surface exists in v0.1, so «no demo surface uses real data» holds vacuously. The v0.2 `/demo` server-side principal design named by [ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md) is not built |

### 5.14 — Suggested order of attack

Nothing in the repository sequences the twelve. This ordering is **this
document's suggestion, not a decision**, and the two criteria it applies are
visible in the table itself rather than stated abstractly: **items 9 and 10 are
pure recording** with the mechanism already built, so they come first and they
establish what a closed gate's record looks like; **items 2 and 4 are owner
decisions with no external dependency**, so they come before anything that waits
on a person outside the project.

The **Size** column is S/M/L effort with the reason, and it is deliberately
**not a date**: [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md)'s «the
pilot is an object, not a date» prohibits scheduling the pilot, not estimating
work. On a one-person project the difference between an S and an L is the
difference between M0 closing this month and this quarter, and leaving it
unsaid is not honesty.

| Order | Gate | Size | Why here |
|---|---|---|---|
| 1 | Item 9 + item 10 evidence entries (readiness gate 10) | **S** — writing, no code | The mechanism is done. This is pure recording, and it establishes what a closed gate's record looks like — a form that currently has no precedent anywhere |
| 2 | Item 7 (readiness gate 14) + the [version-0.0.md](version-0.0.md):78-79 tick | **S** — writing, plus lifting the rotation runbook out of README-staging | Same: substantially built, unrecorded |
| 3 | Item 12's built halves (readiness gate 12, uploads/imports) | **S** — writing | Same |
| 4 | Item 11's coverage checker (readiness gate 11) | **M** — one checker against the module list, plus its own test | The only one whose gap is a piece of code rather than a decision |
| 5 | Item 2's durations, then item 4's purpose/retention shape | **M** — the decision is short; versioning 126 catalog rows and writing the closure/deletion procedure is not | Both are owner decisions with no external dependency |
| 6 | Item 3 (export) | **L — the largest single build in M0.** An operator procedure, a manifest format, hashes, provenance and a «named omissions» vocabulary, none of which exists | Unblocks item 12's second half |
| 7 | Item 12's export half | **S**, but only once 6 exists | Follows 6 by construction |
| 8 | Item 5 (backup/restore) | **M** — a docs read, a policy, then one executed restore into an environment whose definition is itself open | Needs a read of current Supabase docs, then one exercise |
| 9 | Item 1 (privacy notice) | **M** once the domain is decided; **blocked** until then | Blocked on the domain decision |
| 10 | Item 8 (monitoring) | **S** if the answer is «documented acceptance»; **L** if it is a runner plus alerts | Needs the «what does monitored mean for one workspace» decision first |
| 11 | Item 6's dashboard assurance level + the print question | **S** for the dashboard line; the print half is **L** and entangled with a paginator that does not exist | Small, but entangled with a paginator that does not exist |
| 12 | Readiness gates 7, 9, 13 entries | **S** — writing | Bookkeeping once the rest is decided |
| **0** | **The eighteen red cases** ([TODOS.md](../../TODOS.md) P1) | **M** — fourteen are one suite's | Placed before everything else because no gate record can say PASS for CI until it lands, and item 11 cannot cite the channel's isolation suites while they fail. It is not an M0 gate; it is what every gate's CI row waits on |

### 5.15 — The work outside M0, as task lists

§5 gives M0 twelve subsections each ending in a next action. The rest of the
work in this runbook had none, which made M0 look like the only thing with
shape. These are the same treatment for the other three fronts. Status
vocabulary is §5's; **Size** is S/M/L with the reason and is not a date.

**Plan C — the field-client parity gate (phase P2).**

| Unit | Status | The artifact that closes it | Size | Next action |
|---|---|---|---|---|
| Android device | **OPEN — external** | A device, then the §8.3 sweep on it | — | Procurement. Unattested anywhere in the repo (C-13) |
| §8.3 sub-item 2 — the 44×44 sweep on a real engine | **PARTIAL** | An inspector measurement at 375 px on iPhone Safari | **S** | **Measurable today** — an iPhone produced measurements on 2026-08-21 |
| §8.3 sub-item 4 — ADR-007's two required measurements per engine | **OPEN** | EXIF strip/transcode comparison and `capture`-attribute behaviour, recorded in the M2 measurement table | **S** per engine | **Measurable today on iPhone**; the Android half waits |
| §8.3 sub-item 5 — add to home screen, reopen, session survives | **OPEN** | The same table, plus the Ukrainian «Add to Home Screen» label verified on a Ukrainian-locale iPhone | **S** | Same |
| Retiring the `apps/app` PWA field pages | **BLOCKED by construction** | The closed parity gate | **S** | Nothing until the gate closes — and the standing rule forbids doing it first |

**M7 — the channel, to «operational» (phase P1b).** The channel is merged and deployed nowhere; ADR-011 decision 10 fixes what must be true before any environment enables the webhook. None of these is a real group.

| Unit | Status | The artifact that closes it | Size | Next action |
|---|---|---|---|---|
| The eighteen red cases | **OPEN** | A green `verify` on `main`, then a task record whose CI row says PASS with no `known-red baseline:` limitation | **M** | First; see §5.14 order 0 |
| The card carries the tag and the source (ADR-011 open item 9) | **OPEN — ruled** | `cards.ts` + the card route + one Telegram sentence in [hidden-works-content-rules.md](../product/hidden-works-content-rules.md), with a test that a row without a verified source renders the substitute and no criterion | **S** | Land it as its own slice; it is gate 9's M7 half |
| Task 13 — the edge rate limit on the webhook | **OPEN** | The limit, its test, and the staging QA walk the plan names | **M** | After the card; before any environment enables the webhook |
| The scheduler — something runs `delivery.ts` and the purge worker | **OPEN — undefined in repo** (Q-12, Q-9) | A runner, its deployment record, and the monitoring decision of §5.8 | **M**, and it is a decision first | Decide «what runs it» before building it |
| The real-group staging pass | **OPEN — external** | The spec's own gate: one real group, the walk, the record | **S** to run, **blocked** by the three rows above and by M0's real-data rule | Not before M0 closes |
| Retention durations for the three communication classes | **OPEN — owner** | One migration setting `app.retention_policy` durations, per Q-4 | **S** to write, an owner decision to make | The mechanism waits on the number |
| The ADR-009/ADR-010 half of C-7, and C-17 | **OPEN** | The roadmap and the two architecture documents rewritten so that no level-2 document contradicts ADR-011 | **M** | Change control step 2, after the fact |

**Plan D4 — members & access (phase P2).**

| Unit | Status | The artifact that closes it | Size | Next action |
|---|---|---|---|---|
| The identity decision | **OPEN — owner** | A brainstorm record, and a dated ADR-009 amendment **if** it needs a new operation | **S** to decide, **M** if an operation follows | Q-15. This is what makes D4 last, not its layout |
| The screen | **OPEN** | The five-command UI gate (§6.1 Group D) plus §6's six-viewport pass | **M** — the plan calls it «smallest value per unit of work of the five» | Blocked on the row above |

**P3 — the pilot object (six fields).** The materials that would fill it exist
and are unsent ([2026-08-23-validation-push.md](../discovery/2026-08-23-validation-push.md)).

| Unit | Status | Artifact | Size | Next action |
|---|---|---|---|---|
| The artifact the six fields live in | **OPEN — owner** | Q-1. :191-201 of the validation-push document is the nearest existing proposal | **S** | Decide the file, then the fields have a home |
| Material 1 — follow-up to the 21 (:82) | **Drafted, unsent** | An [outreach-log.md](../discovery/outreach-log.md) entry per send | **S** | Send. 35 days have passed since the single touch |
| Material 2 — the one-file ask (:115) | **Drafted, unsent** | One real sanitized кошторис/АВР/interim-works file, recorded in [validated-assumptions.md](../discovery/validated-assumptions.md) with company and date | **S** to send | This is the *only* thing that unfreezes import |
| Material 3 — the 20-minute interview guide (:137) | **Drafted, unsent** | Interview notes; A-1…A-8 evidence columns | **S** to send, **M** to run ten to fifteen | The ten-to-fifteen count is what ADR-005:764-789 says settles which pain is being sold |
| Material 4 — the demo (:174) | **Drafted** | — | **S** | Gated on §8.6 step 10: it may claim no payment-presentation refusal that does not exist |
| **Stopping conditions** | **OPEN — draftable today** | The Q-1 artifact | **S** | §8.4 names this as the one field blocked on nothing external. Draft it |

**The corrections register (§1.5), as work.** Fifteen rows, six owed to
deferred change control (§4.4). Ordered by what unblocks the most:

| Order | Rows | Size | Why here |
|---|---|---|---|
| 1 | **C-5** — the two headline measures in [glossary.md](../domain/glossary.md) | **L**, and it is an owner decision, not a writing task | It is the single cannot-close blocker for M6 and half of the pilot object's baseline |
| 2 | **C-1, C-2, C-3** — production-readiness and version-0.1's deployment vocabulary | **M** | They block every M0 gate closure that cites deployment state, which is §5.14 order 1 |
| 3 | **C-13, C-14, C-15** — the three stale factual rows | **S** each | Cheap, and each one is currently misleading a reader about hardware, route-set size or email delivery |
| 4 | **C-4, C-6, C-9, C-11, C-12** | **S** each | Bookkeeping against documents already superseded in place |
| 5 | **C-7, C-8** — the roadmap and the six ADR-009 files | **L** | The roadmap carries no content after 2026-08-08 at all; C-8 blocks Plan C landing |
| 6 | **C-10** — metadata on [04-role-pain-map.md](../design/04-role-pain-map.md) | **S** | Q-14: metadata or a recorded exemption, and the validator's silence is not authority |

---

## §6. QA gates and validation

Five separable gate mechanisms already exist in this repository — the
canonical-docs validator, the motion audit, the turbo test/typecheck/build
graph, the two browser QA harnesses, and the deploy preflight. **Wire them; do
not invent a sixth.**

### 6.1 The complete runnable verification command list

**Group A — repo-wide, no database needed.**

| Command | Proves | Does NOT prove |
|---|---|---|
| `pnpm validate:canonical-docs` (identical to `node scripts/validate-canonical-docs.mjs` and to `make validate`) | **Thirteen guards** ([validate-canonical-docs.mjs](../../scripts/validate-canonical-docs.mjs):3-24 enumerates them by number), which fan out into: required paths exist; the four-key metadata contract is present on 34 documents; pre-rename branding appears only on legacy-context lines; relative links resolve on disk; eleven CSVs are well-shaped; entity catalog ↔ design DDL coherence; no deployed table tagged to a future version; the 26-table ADR-006 build list is enumerated identically in four places; capability ↔ route-set and event-producer ↔ route-set coherence; preset reachability/resolvability/sufficiency/separation-of-duties; per-milestone operation counts against [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv) | That any code compiles, any migration applies, any test passes, or that a document is **true**. It checks that four metadata keys are *present*, never their values — a `Last reviewed: 1970-01-01` passes, and so does `Status: Rejected` |
| `node packages/testing/qa/motion-audit.mjs` | No `transition: all`/`transition-all`, no layout-property transition (except the named `grid-template-rows`), no `ease-in`/`ease-in-out`, no perpetual animation outside the marquee, no `motion/react` import outside `packages/ui/src/motion` — across `packages/ui/src`, `apps/landing`, `apps/app`. Prints `motion-audit: clean` | Anything about `apps/mobile` (not in its ROOTS), and nothing about whether the motion looks right |
| `pnpm --filter @goproceed/tokens generate` | Nothing — it **regenerates** seven outputs. Skipping it after editing `tokens.json` makes `token-fidelity` fail with a misleading diff | — |
| `pnpm turbo run typecheck` | `tsc --noEmit` passes in ten packages | That a Tailwind class exists — a nonexistent class typechecks and renders unstyled with nothing warning. Also: `apps/app`'s tsconfig `include` is `["src","app","next-env.d.ts",".next/types/**/*.ts"]`, so `apps/app/tests/**` is type-checked **only** where transitively imported |
| `pnpm db:check-cli` | Whether the local CLI matches [.supabase-cli-version](../../.supabase-cli-version) | Nothing else. It **warns only** — exit 0 unless the CLI is missing entirely |

**Group B — database required.** Preconditions, in order:

```
pnpm install --frozen-lockfile
supabase start -x studio,postgres-meta,logflare,vector,edge-runtime,realtime,postgrest
supabase db reset
pnpm db:local-credentials
```

| Command | Proves | Does NOT prove |
|---|---|---|
| `pnpm db:local-credentials` | Nothing — it **sets** the dev-only passwords for `goproceed_app_login` and `goproceed_service_login` and **refuses any non-loopback hostname**. It exists so no Supabase tooling path can plant a known password on a reachable database | — |
| `pnpm turbo run test --concurrency=1` | The unit, migration, invariant, refusal, RLS, API-integration, storage, external-link, import-fuzz, blocked-money, rounding/property and design-system contract suites across **eight packages** — **locally without the eight isolated `apps/app` suites**, which skip unless `TEST_DB_ADMIN_URL` is set, and it must not be set against the only local database (their `beforeEach` truncates it); CI sets it since #62 and is the only place they run (seven with test files; `@goproceed/discovery` runs `vitest run --passWithNoTests`) — including the motion audit's logic, via `packages/testing/src/motion-audit.test.ts`. `@goproceed/ui` and `@goproceed/tokens` declare `typecheck` only, which is why the sibling «ten packages» figure for typecheck is larger and is exact | Anything in a browser. Anything in `supabase/functions/outbox-drain` (unreachable — no `package.json`, outside the pnpm workspace globs). And, because of the [turbo.json](../../turbo.json) `inputs` gap in §6.4, a **cached green result can be replayed** after a `packages/ui` component change |
| `pnpm test` | — | **Do not use.** It is the same turbo task **without** `--concurrency=1`, which lets one package's truncate race another's in-flight transaction |
| `pnpm turbo run build` | That Tailwind compiled what you wrote and every Next/tsup build succeeded; `apps/app`'s `prebuild` runs the deploy preflight | — |
| `pnpm --filter @goproceed/testing test` | The design-system contract suite and the database sweeps — 42 files (measured 2026-09-03; 40 on 2026-09-01), most of them needing Postgres | — |
| `pnpm db:catalog-snapshot` | Nothing — it **dumps** tables/RLS/policies/grants/functions/roles/triggers/default-ACLs/cron so drift becomes diffable | — |

**Group C — browser and deploy.** Preconditions, in order — **neither QA
command runs without them**, and neither prints a message that names what is
missing. `pnpm --filter @goproceed/app qa` spawns `pnpm exec next start`
([apps/app/qa/field.mjs](../../apps/app/qa/field.mjs):233-236), which needs a
build the harness never performs; it also needs the Supabase stack, a reachable
Mailpit and puppeteer's pinned Chrome:

```
pnpm install --frozen-lockfile
supabase start -x studio,postgres-meta,logflare,vector,edge-runtime,realtime,postgrest
supabase db reset
pnpm db:local-credentials
pnpm --filter @goproceed/app exec puppeteer browsers install chrome
pnpm --filter @goproceed/app build
```

- **Mailpit at `127.0.0.1:54324` must answer before the sign-in audit runs** —
  that is `MAILPIT_URL`'s default at
  [field.mjs](../../apps/app/qa/field.mjs):130, and the audit reads the real
  OTP out of it. CI probes it 30 × 1 s and fails as *infrastructure* rather
  than as a login bug (§6.2); locally there is no probe.
- **`pnpm --filter @goproceed/mobile qa` additionally requires `apps/app` to be
  built**, because it starts `next start` in `../../app` as the `/v1` backend
  ([apps/mobile/qa/field-web.mjs](../../apps/mobile/qa/field-web.mjs):121, :280)
  on top of its own `expo export --platform web`.

CI does all of this in the `app-qa` job and §6.2 describes it. A reader working
from this list on a fresh checkout — which §6.6 step 11 sends them here to do —
dies at `next start` with a message that names nothing.

| Command | Proves | Does NOT prove |
|---|---|---|
| `pnpm --filter @goproceed/app qa` (`apps/app/qa/field.mjs`) | **Eight audits**, order load-bearing: unauthenticated surface, sign-in, my assignments list, obligation screen, capture in-flight banner, evidence + review link + external plane, assignment creation, dashboard profile and sign-out. It starts its own `next start` on an ephemeral port, mints a real Supabase Auth user, drives the **real** email-OTP screen reading the code out of Mailpit, then builds workspace + project + both parties + contract + published baseline + bound rule + work item + assignment **over the same `/v1` routes the product exposes** — never a raw SQL insert standing in for a route — and drives the external plane in a second browser context with its own empty cookie jar | The **seventeen** entries in its own `NOT_COVERED` array ([field.mjs](../../apps/app/qa/field.mjs):4059-4184). Named ones worth carrying: the external **decide** path is never driven in a browser (the audit issues a view-only grant); `external_grants.revoke_reissue` reaches no browser at all though it is the only recovery INV-044 leaves; `application/pdf` is unreachable **and cannot be automated**, because headless Chrome has no PDF viewer and two blank pages compare equal; no WCAG-AA contrast scan; no real device or OS |
| `pnpm --filter @goproceed/mobile qa` (`apps/mobile/qa/field-web.mjs`) | Five audits plus the **real CORS path on the wire** — it starts `apps/app`'s `next start` as the `/v1` backend with `FIELD_CLIENT_ORIGINS` actually set, and a static server for the `expo export --platform web` output | The seven entries in its `NOT_COVERED`, including that the native camera path (`Platform.OS !== "web"`) is entirely unreached. **This command is in no CI job.** |
| `DEPLOY_PREFLIGHT=1 pnpm --filter @goproceed/app build` | That the **twelve** names [deploy-preflight.mjs](../../apps/app/scripts/deploy-preflight.mjs) enforces are present, non-local and not legacy `eyJ…` JWTs — `NEXT_PUBLIC_APP_ORIGIN` (:70), `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (:109), and the nine-name `runtime` map (:140-154) — and that `APP_DB_URL ≠ SERVICE_DB_URL` | **`FIELD_CLIENT_ORIGINS`.** [turbo.json](../../turbo.json):26 declares it under `build.env`, the preflight never reads it, and it is the variable §2's Plan B row names as what made `/v1` cross-origin access work. A production deploy with it unset passes this preflight, prints its `OK` line, and the field client's CORS then fails at the first request. (The preflight's own header states only the one-way rule — every name the script reads is also in `build.env` — which holds; the fourteen-vs-twelve gap is in the other direction) |
| `pnpm exec vitest run` at the repo root | Reaches the seven projects in `vitest.workspace.ts`; the **only** way to run `supabase/functions/outbox-drain`'s 2 tests ([drain.test.ts](../../supabase/functions/outbox-drain/drain.test.ts):45, :81) | It skips `apps/landing` (8 test files) and `discovery`. **No CI job issues it.** Note the `pnpm exec`: there is no root `vitest` script and vitest is a root devDependency, so a bare `vitest run` is `command not found` (measured 2026-09-01: `which vitest` → not found) |

**Group D — the UI gate.** Root [AGENTS.md](../../AGENTS.md) («UI and the design system») makes this
mandatory for every slice touching `apps/landing/**`, `apps/app/app/**`,
`packages/ui/**` or `packages/tokens/**`, and reviewing UI counts as touching
it. **The order is load-bearing and the five are one gate, not five commands
scattered across Groups A and B** — which is how an earlier revision of this
section carried them, while the fifth appeared nowhere at all. Transcribed from
[02-building-ui.md](../design/02-building-ui.md):193-210, which remains the
procedure of record; this runbook is transcribing a gate, not authoring one.
**Command 3 is a Group B command**, so Group B's preconditions must already be
satisfied before the gate starts.

| # | Command | Proves | Does NOT prove |
|---|---|---|---|
| 1 | `pnpm --filter @goproceed/tokens generate` | Nothing — it **regenerates** seven outputs, and it runs only if `tokens.json` changed | — |
| 2 | `node packages/testing/qa/motion-audit.mjs` | Must print `motion-audit: clean` | Anything about `apps/mobile`, or whether the motion looks right |
| 3 | `pnpm --filter @goproceed/testing test` | The contract suite — 40 files, **29 of which need Postgres** | — |
| 4 | `pnpm turbo run typecheck` | `tsc --noEmit` in ten packages | That a Tailwind class exists |
| 5 | `pnpm --filter @goproceed/landing build` | **That Tailwind compiled the classes you wrote** | Anything at runtime |

The two traps that make the order load-bearing, quoted rather than paraphrased:

> Step 1 is the one people skip. If `tokens.json` changed and you did not
> regenerate, step 3 fails on `token-fidelity` and the message looks like a
> mysterious diff rather than what it is.
> — [02-building-ui.md](../design/02-building-ui.md):205-207

> Step 5 matters more than it looks: a class that does not compile produces **no
> error at all**, only an unstyled element. The build is the only place that
> shows.
> — [02-building-ui.md](../design/02-building-ui.md):209-210

**Orphaned — do not wire:** `python scripts/validate_package.py` (~2400 lines
reading `prototype/`'s files in 29 places; `prototype/` was deleted) and
`node scripts/finalize_v29_openapi.mjs` (the historical v2.9 package).

### 6.2 CI anatomy — [.github/workflows/ci.yml](../../.github/workflows/ci.yml)

Two jobs. **They share no state**, which is why `app-qa` repeats the whole
Supabase bring-up.

**`verify`** (timeout 30 min), in order: checkout → pnpm 9.12.0 → node 24 →
`pnpm install --frozen-lockfile` → **`pnpm validate:canonical-docs`** → read the
CLI pin → `supabase/setup-cli` → assert installed == pinned → `supabase start -x
studio,postgres-meta,logflare,vector,edge-runtime,realtime,postgrest` →
`supabase db reset` (exactly one retry, with a `::warning::` on the first
failure) → `pnpm db:local-credentials` → `turbo run typecheck` → `turbo run test
--concurrency=1` → `turbo run build`.

The docs gate runs **first, before the fifteen-minute Supabase steps**, on
purpose: a documentation failure reports in about a minute rather than after a
full local-stack boot.

**`app-qa`** (timeout 20 min): the same bring-up plus a Mailpit readiness probe
(30 × `curl` at 1 s, then fail — so a slow Mailpit fails as *infrastructure*
rather than masquerading as a login bug), a puppeteer Chrome install, an apt
install of **19** headless libraries ([ci.yml](../../.github/workflows/ci.yml):317-324), a `Verify Chrome launches` step, then
`typecheck` → `build` → `qa`, a **clean-tree assertion** (`git status
--porcelain` non-empty ⇒ exit 1), and an `if: always()` artifact upload of
`apps/app/qa-output/` with 14-day retention — which is what makes a *failed*
run's report and screenshots readable.

Three details worth not re-deriving:

- **the single-retry contract.** A deterministic failure (broken migration,
  stale seed) fails **both** attempts and the job stays red; a daemon hiccup
  passes on attempt two with a visible `::warning::`, so flake count is
  countable rather than absorbed.
- **`--concurrency=1` is load-bearing, not style.** `@goproceed/database`,
  `@goproceed/testing` and `@goproceed/app` all hit the same local Postgres and
  truncate overlapping tables.
- **the CLI pin.** Before 2026-08-18 CI asked for `version: latest`; `app-qa`
  went red three times because a newer CLI's default magic-link template stopped
  carrying `{{ .Token }}`.

`demo-qa` and `package-validate` were removed 2026-08-20 **with their subjects**
and are deliberately not replaced.

**Current CI status: known, and red with a named set.** CI has run on every push since 2026-09-01. Runs read for this revision: 33540108319 (`18411ea`, 2026-09-01, both jobs green — with the isolated suites skipped); 33736763584 (`7bf8e4b`, the channel merge) and 33742738613 (`1c418fb`, this revision's head) — `app-qa` green, `verify` red with the eighteen cases of §1.1, identical across runs. The `verify` job now sets `TEST_DB_ADMIN_URL` ([ci.yml](../../.github/workflows/ci.yml):61-68) so the isolated suites run; that is the whole reason the colour changed, and it changed on `main` before any channel code merged (baseline PR #63).

### 6.3 The four "what proves the gate" proofs

[test-strategy.md](test-strategy.md):90-251. «If any one of them is absent, the
pilot demonstrates something other than the product.»

| # | Proof | State |
|---|---|---|
| 1 | **A `hold` requirement blocks closure.** The closure command REFUSES, and **the shape of the refusal is half the test**: a named problem code plus a `blocked_reason` naming the occurrence, rule version, missing evidence by kind and acceptance criterion, owed `approver_role`, `since`, and blocked value by currency. **A generic 403 fails the test even though it refused.** The negative half is equally load-bearing: while blocked, recording performed quantity, capturing evidence and recording coverage stay permitted (INV-065) | Suites exist (`m3-refusal.int.test.ts`, `m3-closure-rls`) |
| 2 | **The act contains no field outside Додаток В.** The *negative* half is writable now (prohibitions D/E/F, exactly three signatory slots, no free-text quantity field). The *positive* half — the field set is exactly В.1/В.2 in the standard's order — was blocked because no enumerated field list was committed, and «no test may substitute a field list typed from memory» | **The premise changed 2026-08-10**: `technical/requirements/dbn-a31-5-2016-dodatok-v.csv` now holds 51 В.1/В.2 rows, all `VERIFIED_PRIMARY`, compared back byte-for-byte by `dodatok-v-fidelity.test.ts`. [test-strategy.md](test-strategy.md):172-186 owes this correction |
| 3 | **No regulatory string renders without its verification tag.** Storage half (NOT NULL + CHECK make an unsourced string unstorable, therefore unrenderable) and render half — **which since the channel has a third renderer, the Telegram card, that renders neither (§5.9).** Content fixtures include Н.14 = 5 items, Н.15 = 7, **the marazm.org.ua ten-position list as a hostile fixture that must fail closed**, «орієнтовн» never rendered, the довідковий disclaimer uncollapsed, `UNVERIFIED` rows having no renderable form at all | Storage half proven (§5.9) |
| 4 | **Tenant isolation**, and the tests that cannot be quarantined | Partial (§5.11) |

### 6.4 The two known CI gaps, and which to close first

| Gap | Evidence | Cost already paid |
|---|---|---|
| **(a) `motion-audit.mjs` is not a CI step** | [02-building-ui.md](../design/02-building-ui.md):212-216; `grep motion .github/workflows/ci.yml` returns nothing | — but this gap is **narrower than it reads**: the audit's *logic* already runs in CI through `packages/testing/src/motion-audit.test.ts`, which asserts `auditMotion(repoRoot)` equals `[]`. Only the standalone CLI step is missing |
| **(b) [turbo.json](../../turbo.json)'s `test` task `inputs` is incomplete** | It lists nine entries including `../../packages/ui/src/tokens.generated.css`, and **none** of `packages/ui/src/components/**`, `packages/ui/src/motion/**`, `packages/ui/src/tw-merge.generated.ts`, `packages/ui/src/theme.generated.css` | A component change can replay a cached green test run. The motion gate was red from 2026-08-28 to 2026-08-31 and **nothing detected it** |

**Close (b) first.** The motion audit's ROOTS are `packages/ui/src`,
`apps/landing`, `apps/app` — none of which is in turbo's `test` `inputs` — so a
cached green result can be replayed regardless. Closing (a) without (b) buys
very little.

A third, unnamed gap in the same family: [turbo.json](../../turbo.json)'s `test`
task `env` array (:32-36) lists only `APP_DB_URL`, `SERVICE_DB_URL` and
`SUPABASE_DB_URL` — it is an array in that file, not a `test.env` file, and no
such file exists anywhere in the tree — while `apps/app`'s source reads
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, the `NEXT_PUBLIC_*` names and
`FIELD_CLIENT_ORIGINS`. Nothing breaks today; a future test depending on one of
those would be replayed from cache after the variable changed.

**A fourth gap this document names rather than leaves implicit: there is no
supply-chain gate at all.** `.github/` holds `workflows/ci.yml` and nothing else
— no dependabot configuration, no `pnpm audit` step, no lockfile-diff review
(measured 2026-09-01: `ls -R .github` returns one directory and one file). In a
product whose entire M0 exists to make an environment fit to hold someone else's
personal data, an unreviewed dependency graph is a hole of the same kind as the
absent quarantine ledger. **Undefined in repo** — this runbook does not invent a
policy; §10 Q-16.

### 6.5 The quarantine-ledger rule, and its missing implementation

[test-strategy.md](test-strategy.md):592-594 and
[version-0.0.md](version-0.0.md):44-48 both make it an enforcement point:

> Any temporarily skipped non-security test carries owner, reason, expiry and
> removal condition **in the repo**. A security or tenant-isolation test
> appearing in that ledger **fails the build**.

**The ledger does not exist as a file.** No format is defined, no CI step or
script reads one, and nothing anywhere greps for `.skip`/`.todo`/`it.skip`. The
un-quarantinable set is named — tenant-isolation, authorization,
migration-integrity, immutable-history, backup/restore, external-decision
security — and the mechanism that would enforce it is absent. **Undefined in
repo.** This runbook does not invent a format; §10 Q-8.

### 6.6 Where each gate sits in the slice loop

| Loop step (§4.1) | Gate |
|---|---|
| 7 — execute, per task | `pnpm turbo run typecheck`; the task's own suite |
| 8 — UI gate, where applicable | §6.1 **Group D**: the five commands in order, output pasted; then the six-viewport pass with **real Ukrainian strings**. **Group B's preconditions must already be satisfied when this step runs.** The gate's command 3, `pnpm --filter @goproceed/testing test`, is itself a Group B command: it needs Postgres for 29 of its 40 files, and it resets the local database (§4.0 item 7) and needs the owner's confirmation first. The gate cannot come before step 9's bring-up. Either bring the stack up before step 8, or run command 3 inside step 9 and say so in the record |
| 9 — local suite in CI's shape | Group B in full, in the container shape CI uses, **after the owner confirms the local database may be truncated and reset** |
| 10 — review | `gp-reviewer` over the diff; `gp-security` and `gp-ui-reviewer` by trigger |
| 11 — verify | `gp-qa`'s matrix over every command in §6.1 that the slice touched, each with a §7.4 result |
| after landing | CI's two jobs; then, for a deploy, `DEPLOY_PREFLIGHT` and the preflight `OK` line in the build log |

**One thing a local green run does not prove.** Measured 2026-09-01: this
machine runs the **full** twelve-container Supabase stack, not CI's
five-container shape. A local green does not prove CI's exclusion list still
holds.

---

## §7. Evidence requirements

### 7.1 The record is the task record; the gate records are its lineage

Since 2026-09-13 a slice's evidence lives in its task record, `docs/tasks/DEV-NNN-<slug>.md`, in three sections:

- **Findings and rework**;
- **What is not true after this task**, placed before any positive claim;
- **Acceptance evidence**.

That shape is not new. It carries forward what the gate records under `docs/superpowers/plans/evidence/` carried. There are eight `*-gate.md` records, with two companion records beside them. The strictest is [2026-08-03-rename-slice3-gate.md](../superpowers/plans/evidence/2026-08-03-rename-slice3-gate.md), and it is still the best example of a negative section that cannot be skim-read into a claim. Those records stay where they are, frozen with the rest of `docs/superpowers/`. In forward-looking instructions (§1.1's CI rule, §5.14, §6.6), «gate record» now means the slice's task record. A dated or named gate record is a file under `docs/superpowers/plans/evidence/`.

**The chain lapsed and resumed.** From 2026-08-03 to 2026-09-02 no record was written while fifty-three PRs (#7 through #61 — measured 2026-09-03 as the distinct `Merge pull request #N` subjects of `git log --merges --since=2026-08-03 --until=2026-09-03T00:00:00` — the time matters: a bare `--until=2026-09-03` is inclusive of that whole day and would count #58 and #64–#66; the 2026-09-01 revision's «nineteen, #37–#55» counted only the billing-pause window) merged. On 2026-09-03 the erasure slice wrote [2026-09-03-telegram-identity-erasure-gate.md](../superpowers/plans/evidence/2026-09-03-telegram-identity-erasure-gate.md) in the rename-slice-3 shape, with a «Deviations from the plan» section the template below now carries. The channel itself (PR #58, nineteen migrations) still has **no gate record**: ADR-011 §"Status against the runtime" is the nearest thing, and it is an ADR, not a record. The reason is stated at
[TODOS.md](../../TODOS.md):3089-3092 — the agent harness refuses report `.md`
files, so findings that would have lived in the session directory were filed in
`TODOS.md` instead.

That substitution was a decision or a drift, and which one was **undefined in repo** until 2026-09-13 (§10 Q-6). **It is now decided** (root AGENTS.md; DEV-002):

- the record is the task record, written by the coordinator, which the harness can write;
- the findings a task defers are listed in its Findings table, and in [docs/BACKLOG.md](../BACKLOG.md). *[Changed 2026-09-14 (DEV-005): this read «and in `TODOS.md` until a backlog replaces it»; the backlog replaced it on that date.]*

### 7.2 When a record is required

| Situation | Record required? |
|---|---|
| A slice that lands code, a migration, a catalog change, or changes agent instructions | **Yes**: a task record (root AGENTS.md, «Records, rework and escalation») |
| A slice that only edits prose documentation, with no behavior change as root AGENTS.md defines it | **The record's fields, not necessarily its file.** [agents/COORDINATION.md](../../agents/COORDINATION.md) lets a prose-only edit keep the fields in the conversation. The four `docs-slice*` gate records are precedent for writing a file anyway when the edit is large |
| Closing an M0 gate | **Yes**, plus a dated entry in [version-0.1.md](version-0.1.md) §M0 per [production-readiness.md](production-readiness.md):407-415 |
| Closing a milestone (M1–M6) | **Yes.** *How* a milestone is formally closed (who signs it, where it is recorded) is **undefined in repo** for M1–M6. Only M0 has a concrete mechanism (fourteen dated entries). See §10 Q-2 |
| A fix round inside an open slice | No. A fix round is a commit (`fix(<scope>): fix round N — <what was wrong>`), and the slice's single record covers it |

**Who writes it:** the coordinator. `gp-qa` returns the acceptance matrix as an independent subagent on the final revision, and the coordinator records it. `gp-reviewer` and the triggered stages return their findings the same way. **The pass that ran a command records it.** A row copied from a report without being re-run is not evidence ([docs/ai-workflow.md](../ai-workflow.md), «Run the gate yourself»).

### 7.3 What a pilot slice's record carries beyond the template

The template is [agents/TASK_TEMPLATE.md](../../agents/TASK_TEMPLATE.md); copy it. It already puts «What is not true after this task» before «Acceptance evidence», which is the order [2026-08-03-rename-slice3-gate.md](../superpowers/plans/evidence/2026-08-03-rename-slice3-gate.md) used. A pilot slice adds the following where they apply. Each is carried forward from the gate records because it caught something the template's generic sections would miss:

- **Mutation checks.** Break the mechanism, confirm exactly one test reds, restore it, and confirm the blob hash matches HEAD. This is a standing evidence type in this repository, not an optional extra.
- **Deviations from the plan, ruled during execution.** Record every ruling made where the plan and the spec, or the plan and the code, disagreed: what was decided, why, and what it costs if wrong. Record each as a Progress row, and as an Owner decisions row when the owner made the ruling. The 2026-09-03 erasure gate record is the precedent.
- **Claims in this slice's own documents that do not reproduce.**
- **The exact command that settles every NOT RUN row**, verbatim, in that row's Limitation cell.
- **Commits**, in the Completion section.

### 7.4 The result vocabulary

Task records use three results, **PASS**, **FAIL** and **NOT RUN**, and put the reason in the Limitation column ([agents/TASK_TEMPLATE.md](../../agents/TASK_TEMPLATE.md)). The six tokens the gate records used map onto them as below. Every record written before 2026-09-13 keeps its original reading, and no old record is rewritten.

| Gate-record token (before 2026-09-13) | Task-record form |
|---|---|
| **PASS**: the command ran, in this checkout, and produced the stated output | PASS |
| **PASS (negative)**: the command correctly produced nothing, and the absence is the evidence | PASS; Limitation: `negative` |
| **PASS (assisted)**: something had to be arranged by hand first | PASS; Limitation: `assisted:` and what was arranged |
| **NOT PROVEN — environmental**: the environment, not the code, prevented the run | NOT RUN; Limitation: `environmental:` the cause and the command that settles it |
| **NOT PROVEN**: nothing available here can settle it, and the reason is not environmental | NOT RUN; Limitation: `not-provable-locally:` what would settle it |
| **NOT RUN**: deliberately not attempted | NOT RUN; Limitation: the reason |

A required NOT RUN blocks done, whatever its qualifier. The 2026-09-03 record's `PASS (assisted)` for a CI run read against a known-red baseline, where the assistance was the named set of pre-existing failures, reads as FAIL, Limitation: `known-red baseline:` and that set, with no case outside it failing. A task that accepts it anyway revises its scope explicitly, as [agents/TASK_TEMPLATE.md](../../agents/TASK_TEMPLATE.md) allows, and keeps the original requirement recorded.

### 7.5 The rule about environmental non-proof

> **Environmental non-proof is recorded as NOT RUN, with an `environmental:`
> qualifier naming the command that settles it. It is never omitted, and it is
> never rounded up to PASS.**

[test-strategy.md](test-strategy.md):80-82, principle 3: environmental failures are reported **separately** from code failures, and a suite blocked by the environment is **not «passing»**. The rename slice-3 record carries five such rows, in its token `NOT PROVEN — environmental`, and names the exact command that settles each. That is the standard, and it is why that record is worth reading before writing a new one.

Three live examples this runbook must itself obey:

- **A local test run is not a free action.** The 2026-09-01 revision recorded every `node_modules` command as environmental non-proof because the worktree had no `node_modules`. The 2026-09-03 checkout had one, and those commands went to PASS without the code changing: the vocabulary doing its job in the other direction.
  - The distinction that matters now is different. Most `apps/app` integration suites truncate tenant tables, and the `packages/testing` suites that call `resetDb()` reset the local database. They run locally only with the owner's confirmation (§4.0 item 7).
  - A suite that skipped is NOT RUN, never PASS (root AGENTS.md). The `apps/app` suites that check database credentials skip without them. The run's output, not this runbook, says which skipped, and the row names them.
  - A record whose local `pnpm turbo run test --concurrency=1` row says PASS must name which suites ran, in the same row.
  - CI, where the stack is disposable, is where those suites run by default (§1.1).
- **Retention under a real duration is NOT RUN (`environmental:`) in every environment.** The erasure gate record says so in its own row. No duration has landed anywhere, so the nightly job has never erased a row. The command that settles it is a migration the owner has not written (Q-4), which is the environmental cause.
- **The Plan C parity gate is NOT RUN (`environmental:` two physical phones) until two physical phones exist.** A passing headless harness and a passing laptop smoke test are evidence *toward* it, not a substitute for it ([TODOS.md](../../TODOS.md):712-716).

---

## §8. Release and pilot readiness

### 8.1 The staging deploy path

**Which environment does the pilot's real data enter?** The runbook has to
answer this before anything below is meaningful, and P1's outcome statement
(«before any of it arrives») never names the environment.
[system-overview.md](../architecture/system-overview.md):583 names the tier —
«Development, preview, **staging/pilot**, and production use separate
environment configuration and Supabase/storage credentials» — so the pilot rides
the staging/pilot tier, and today that tier is exactly one Supabase project,
`asrvzhjaueyvrfozxpzo` ([README-staging.md](../../infra/README-staging.md):971-984),
whose provisioning runbook is written for a *fresh* project. **Whether a
separate production project is owed before or after the pilot is undefined in
repo** — §10 Q-9.

Preconditions, from [README-staging.md](../../infra/README-staging.md):

- Push with the **pinned** CLI ([.supabase-cli-version](../../.supabase-cli-version)
  — 2.115.0 today, measured; the local machine is on 2.114.0 and must be brought
  up before pushing). It is the version every migration has been proved against
  in CI.
- **Read the number from `ls supabase/migrations | wc -l`, never from a
  document.** The runbook says 58 and the tree holds 81; the runbook itself
  defends against this at :10-11 (C-11).
- **Twenty-three migrations are waiting, and three of them change what a role may do.** `0059`–`0081` have no apply record. Among them: nineteen create the channel's fifteen tables, its definers and its pg_cron job; `0080` replaces one RLS policy; `0081` creates two tables in schema `app`, two SECURITY DEFINER erasure functions with EXECUTE granted to `goproceed_service` only, and a nightly cron job that is inert until a duration lands. A push of this range is the largest single change staging has received since provisioning, and §8.6 step 4 must be answered against the *post-push* head, not the pre-push one.
- **Push applies as the CLI's role, and that is the role the objects must be owned by.** Found 2026-09-03 on local dev: a hand-apply of `0081` as `supabase_admin` left its tables and functions superuser-owned, and owner-only functions and test teardown then behaved differently from `db reset`, which creates everything as `postgres`. On a hosted project use `supabase db push` and nothing else; if a hand-apply is ever unavoidable, it is `-U postgres`.
- **Enabling the webhook is not a deploy step.** A pushed `0062`–`0081` is a schema, not a running channel: the webhook route exists in `apps/app` and answers, but ADR-011 decision 10 forbids enabling it — registering the URL with the bot, binding a real group — in any environment until Task 13's edge limit, the scheduler, the real-group pass and the card's tag-and-source have landed, and M0's real-data rule forbids a real group until M0 closes. **The variables the route needs (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_LINK_PEPPER` and their siblings — seven, per ADR-011 gate 7) are not in the twelve the deploy preflight enforces**, so a production build passes the preflight with none of them set; that is correct today and must be revisited the day the webhook is enabled anywhere.

**Three commands that must never run against a hosted project** (:193-217):

| Forbidden | Why |
|---|---|
| `supabase db push --include-seed` | Rebuilds from the seed on a reachable database |
| `supabase db reset --linked` (with or without `--include-seed`) | **The reset itself destroys and rebuilds the linked REMOTE database** |
| Enabling Supabase Branching while `[db.seed] enabled = true` | Preview branches are auto-reseeded from `./supabase/seed.sql` with no flag, on an internet-reachable database |

**And the rule that governs everything applied to this project from now on:**
«Applied migrations remain **append-only history**; corrections use new
migrations» ([docs/README.md](../README.md):172-173, change control step 4). The
chain is applied through `0058` on a shared database. There is no editing a
migration that has run — a correction is `0082`.

**The Branching hazard is live, not hypothetical.**
[supabase/config.toml](../../supabase/config.toml):77-79 currently reads
`[db.seed]` / `enabled = true`. If Branching is ever turned on, set it to false
**first**.

The runbook records a trap about its own reasoning: the *stated reason* for the
prohibition was corrected — `seed.sql` sets no password at all, and an operator
who checks the old reason, finds it false, and concludes the rule is stale would
destroy staging. **The rule stands because the commands rebuild the database.**

**Blast radius if one runs anyway:** treat `goproceed_app_login`'s password as
compromised and `goproceed_service_login`'s as lost (migration `0034` creates it
LOGIN-with-no-password, exactly as `0003` creates the app login, so the service
connection goes inert rather than compromised). Re-run both rotations
([README-staging.md](../../infra/README-staging.md) §3.1 and §3.2 — **not** this
runbook's own §3.1/§3.2, which are the delivery and security role tiers) before
any traffic.

**Two Vercel traps recorded 2026-08-21, both of which cost a day:**

1. A merge produced a `pnpm-lock.yaml` that `--frozen-lockfile` rejected,
   killing all three production builds at install.
2. **A lockfile-only commit is «unaffected» to turbo-ignore**, so the repair's
   own push was CANCELED for every project — and environment-variable changes
   never trigger a build either. After setting a variable or repairing the
   lockfile, **Redeploy the specific commit row you want**.

**What is missing from this path — stated narrowly, because an earlier revision
of this paragraph overstated it and §0 forbids exactly that.** The claim used to
be that there is no procedure at all for applying new migrations to an
already-provisioned staging project. That is not true, and the repository says
so in two places:

- **Repeat-apply is documented and proved.**
  [README-staging.md](../../infra/README-staging.md):162 says «then re-run
  `supabase db push` (§2.2 proves this is safe to repeat)», and §2.2 at :165-186
  («Empirically double-apply the migrations (idempotency proof)») runs
  `supabase db push` twice against the linked project and states the expected
  second-apply output — «Remote database is up to date» / 0 migrations, exit 0 —
  with the instruction to **stop** if the second push offers to apply anything.
- **The head check already exists, verbatim.**
  [README-staging.md](../../infra/README-staging.md):184 gives it:
  `select max(version) from supabase_migrations.schema_migrations; -- expect
  '0058' (or the current last file)`. §1.3 and §8.6 step 4 both point at this
  query; neither needs a new one devised.

**Three things really are undefined in repo**, and they are what Q-9 is now
scoped to: **(a) ownership** — who runs the push after a migration merges;
**(b) trigger** — on what event, since nothing automates it and no CI job
touches a hosted project; **(c) rollback** — what to do about a bad migration,
given `db reset --linked` is prohibited with no alternative given and
[docs/README.md](../README.md):172-173 makes applied migrations append-only, so
the answer is a forward-fix migration and that has never been written down.
This is why `0059` through `0081` have no apply record.

**Also missing:** no committed catalog snapshot of staging exists, although
`scripts/snapshot-db-catalog.mjs`'s own header instructs «Run per environment
before and after every deploy» and [docs/README.md](../README.md):30-33 requires
a live catalog comparison to detect drift. Every committed snapshot under
`migration/goproceed-canonical-v0.1/catalog-snapshots/` — **eight files, dated
2026-07-30/31** — is local: the newest carries `Source host: 127.0.0.1` on line
3 and `## tables (33)` on line 5.

### 8.2 The §6 verification checklist

Nine steps, run **against staging and the deployed `apps/app`, not local**.
«Record actual results — a checked box with no evidence is not verification.»

| Step | What it exercises | State |
|---|---|---|
| 1 | Create a staging Auth user, obtain a token | unchecked |
| 2 | `POST /v1/organizations` → 201 with `Idempotency-Replay-Until` | unchecked |
| 3 | Replay the same `Idempotency-Key` and body | unchecked |
| 4 | Same key, different body → conflict | unchecked |
| 5 | Read back tenant context | unchecked |
| 6 | Audit + outbox rows. **Expected result was inverted 2026-08-19**: `processed_at` must stay **NULL forever**, because `0036` retired the drain cron and nothing on staging consumes the outbox by design | unchecked |
| 7 | Cross-tenant isolation with a second user B | unchecked |
| 8 | A finalize using the service credential | unchecked — **and not executable as written**: it needs an evidence-capable project/assignment/upload-intent, and standing that up «is outside what this organizations-only checklist covers». The one step exercising `SERVICE_DB_URL` has no procedure behind it |
| **9** | **The two physical phones** | 2 of 5 boxes checked |

Steps 1–8 are all unchecked (measured). They carry a bearer token, which is why
they are the owner's to run.

### 8.3 The parity gate — §6 item 9, two physical phones

This is [ADR-009](../decisions/ADR-009-three-pilot-surfaces.md)'s parity gate,
applied **verbatim**: README-staging §6 item 9 **plus INV-081**, with no new
checklist authored. «Passing is a measurement taken on hardware, not a code
review.»

| Sub-item | State | Detail |
|---|---|---|
| 1. Login → OTP → «Мої доручення» | **[x]** | Done 2026-08-19 20:34 UTC on a **laptop** at `goproceed-app.vercel.app`; also on **iPhone Safari 2026-08-21** at `goproceed-field.vercel.app` (the Expo client). Both codes arrived through Brevo custom SMTP |
| 2. Assignment view; disclaimer visible; every control ≥ 44×44 CSS px | **[ ]** | **Partial.** The disclaimer was verified on iPhone. The 44×44 sweep was done only by the headless-Chrome harness — «the point of this step is a REAL engine». Still owed |
| 3. Photo capture; unsaved-photo banner; receipt renders | **[x]** | Measured on iPhone 2026-08-21 08:55 UTC: intent `available`, `image/jpeg`, 2 870 686 bytes; evidence object created 3.6 s later with the same SHA-256 (`de82ef4e…`); receipt rendered |
| 4. **ADR-007's two required measurements**, per engine | **[ ]** | Whether the engine stripped or transcoded EXIF (compare the on-screen SHA-256 against a hash of the original taken off the device), and how the engine honours the `capture` attribute (camera directly, or a chooser). «These are the measurements the decision said MUST be made rather than assumed» |
| 5. Add to home screen; reopen; session survived | **[ ]** | The Ukrainian label for Apple's «Add to Home Screen» is itself an unverified translation, flagged as an open owner item needing a real iPhone on a Ukrainian locale |

**What this gate is actually blocked on, with both sides of a disagreement the
repository has not resolved.** The **Android** device is unattested anywhere in
the repository — no Android measurement exists in any file. An **iPhone
demonstrably existed on 2026-08-21**: it produced the two measurements
transcribed in the table above
([README-staging.md](../../infra/README-staging.md):922-926 and :941-949), and
neither can be taken without one. So
[2026-08-01-b0-procurement.md](../superpowers/plans/evidence/2026-08-01-b0-procurement.md)
(dated 2026-08-01, «not yet started») and [TODOS.md](../../TODOS.md):1788-1796,
which inherits from it, are **stale on the iPhone half and current on the
Android half**. C-13.

**The gate therefore stays open for a different reason than «no phone exists».**
It stays open because sub-items 2, 4 and 5 are unmeasured and because
[ADR-009](../decisions/ADR-009-three-pilot-surfaces.md):113-128 requires **both
engines**, not one. Two consequences for sequencing that the old framing hid:
sub-items 2 and 4 are **iPhone-measurable today** (§5.15 carries them as S-sized
work), and §2's Plan C entry evidence should not be read as «procure two
devices, then start» when half of it can start now.

Until the gate is measured, **the `apps/app`
PWA is the pilot's only working field client and stays deployed**, and
[ADR-007](../decisions/ADR-007-pilot-field-client.md)'s Costs 1 and 2 apply to
the Expo-web build exactly as they applied to the PWA. Its decision 5's four
withdrawn claims stay withdrawn.

### 8.4 The pilot object — six required fields

«The pilot is an object, not a date.» Every field was **empty as of
2026-08-06**, and no ADR records any of them filled since
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):486-505).

| Field | What fills it | Blocked on |
|---|---|---|
| **Named partner** | One named company, **one named object**, and one named person who agreed. «Not a lead, not a send, not a reply» | A reply. 21 evidenced sends, zero replies |
| **The технагляд** | Named, **and adversarial** | Same, plus §8.5 |
| **Success measures** | First-time acceptance rate and days-to-signature ([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) assumption b), **plus one measure the partner names themselves**. «If the partner cannot name one, that is a finding to record, not a field to skip» | C-5 — the first two have no v0.1 definition. The third needs the partner |
| **Baseline** | Both measures taken on that object **before the gate is switched on**. «A pilot that cannot fail cannot succeed.» It can come only from the partner's own historical records — **the project holds zero customer documents of any kind** | C-5 and the partner |
| **Sample** | How many stages, over what period, on what scope — **written down before the first act**, so the sample cannot be chosen after the results are visible | The partner |
| **Stopping conditions** | What ends the pilot early, **in both directions**: the result that says stop building, and the result that says stop measuring and start selling. «Named in advance, or the pilot runs until someone gets tired» | Nothing external — this one can be drafted today |

**There is no file where this object lives.** Its existence as an artifact is
undefined in repo. §10 Q-1.

### 8.5 The adversarial технагляд requirement

[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 9:

> **One pilot with a hostile технагляд, not three with loyal ones.** A gate is a
> refusal, a refusal is only observable when someone wanted to pass, and a
> client who signs everything never wanted to pass.

Three consequences accepted in advance: the pilot is harder to sell; it is more
likely to fail, **and that is the point**; and failure is recorded as a result,
not as a bug. A технагляд who refuses to open the link, refuses to decide inside
it, or demands paper **invalidates A-3** and is written into
[validated-assumptions.md](../discovery/validated-assumptions.md) as an
invalidation.

**Choosing a loyal технагляд instead requires an ADR that supersedes decision 9
and records what the resulting evidence will not prove.** Not a backlog item.

### 8.6 The one decision procedure: may real company data enter?

Run this in order. **Any NO stops.** No step may be waived by a schedule, a
document, or a partner's impatience — [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):679-713
protection 5 makes that a boundary violation «regardless of which document or
schedule requests it».

| # | Question | Where the answer lives | Today |
|---|---|---|---|
| 1 | Do **all fourteen** readiness gates carry a dated evidence entry in [version-0.1.md](version-0.1.md) §M0? | that section | **NO** — zero entries |
| 2 | Has **one restore exercise** been executed in an isolated environment and recorded? | readiness gate 5 | **NO** |
| 3 | Has a **deletion-then-restore test** proved tombstones are reapplied before restored data is reachable? | readiness gate 4 | **NO** |
| 4 | Is the environment the data will enter the one the evidence was recorded against? | [README-staging.md](../../infra/README-staging.md) §Status + a live `select max(version) from supabase_migrations.schema_migrations` | **NO** — staging's last recorded apply is `0058`; the tree is at `0081`; nothing the evidence of 2026-09-03 exercised (the erasure procedure, the guards, the registry) exists on any hosted project |
| 5 | Are M1–M5 closed with acceptance evidence? | each milestone's acceptance-evidence list; §2's **P1b** transcribes all five | **NO** — none closed, and «code-complete» is asserted by a 2026-08-06 document that disqualifies its own behavioural claims (§1.3). Two of the five (M2, M5) have acceptance evidence that needs something external |
| **5b** | Is M7 operational by its own spec's rule — the real-group staging pass done, after the four webhook-enable blockers of ADR-011 decision 10? **And is the answer NO the right one at this step** — a real group is real data, so this row cannot be YES before rows 1–3 are | ADR-011 decision 10; §5.15's M7 table | **NO**, and must stay NO until rows 1–3 are YES — the order of this table is the rule |
| 6 | Are all six pilot-object fields filled, in writing, before the first act? | the artifact that does not exist yet | **NO** |
| 7 | Is the технагляд named **and adversarial** — or does a superseding ADR record what a loyal one will not prove? | [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 9 | **NO** |
| 8 | Are the stopping conditions written down, in both directions, **before** the first act? | the same artifact | **NO** |
| 9 | Does the pilot's field client have a measured parity gate — or is the pilot running on the `apps/app` PWA, which stays deployed until it does? | [ADR-009](../decisions/ADR-009-three-pilot-surfaces.md):113-128 | **PWA.** Legitimate; the pilot is never blocked on this |
| 10 | Does anything in the demo, the landing page, a screen or a sales sentence claim a payment-presentation refusal that does not exist? | [version-0.1.md](version-0.1.md):908-913 | Must be re-checked before the first customer sees anything. **Owner and procedure: the role §3.3 parks as «not yet activatable» owns «the landing page's claims», so on the day this step runs the owner runs it directly.** The check itself is: grep `apps/landing`, the six `page.tsx` under `apps/app/app/dash`, and every outreach letter under `discovery/templates/` for the positioning sentence, and confirm each occurrence carries the explicit «payment-presentation eligibility is not in v0.1» statement §9.3 requires. **No script does this** — undefined in repo, and it is the one step of this procedure with no mechanical form |

**Answer today: NO, at steps 1, 2, 3, 4, 5, 5b, 6, 7 and 8.** The shortest honest path
to YES is P1 (§5.14's ordering) and P3 (§5.15, §8.4) run in parallel, because
they block each other on nothing.

### 8.7 Operating the pilot — what happens after the first real record

Everything above stops at the moment the first real record is created. Two
standing obligations from Approved documents live entirely on the far side of
that moment and appeared nowhere in this runbook before.

**(a) M0 is a continuing obligation, not a one-time gate.**
[production-readiness.md](production-readiness.md):414-415: «**Gates stay
verified throughout the pilot; a regression reopens the gate and blocks new
pilot data.**» So §8.6 is not a door that closes behind you. The fourteen
readiness entries have to be re-verified during the pilot, and a regression in
any of them **stops new pilot data** — not just future ones. **The cadence is
undefined in repo** and this document does not invent one; what is not optional
is that a regression reopens the gate.

**(b) M6's closing evidence is an artifact nobody has specified.**
[version-0.1.md](version-0.1.md):853 makes it «**the pilot findings document**,
plus the M0 evidence verified as still holding throughout the pilot». That
document has no home, no template and no named writer — the same shape of gap as
Q-1 and Q-6, and it is added to Q-1's scope rather than given an invented format
here. What it must contain is fixed by :835-841: the loop end to end, and the
comparison against the pre-gate baseline.

**(c) The support path, which stops being hypothetical on day one.** §3.3 parks
Support / onboarding as «not yet activatable» because there are no real users.
The pilot creates one. Readiness gate 7 (incident path) is recorded **OPEN** at
§5.13 — «no named responder, no leaked-credential playbook» — and on a
one-person project the responder is the owner; the gate still asks for the name
and the routing path to be **written down**. Closing gate 7 before the pilot
starts is what makes this row real rather than a promise.

**(d) When the технагляд's single-use grant is burnt.** `external_grants.revoke_reissue`
is «the only recovery INV-044 leaves for a link that was lost» — and §6.1
records that it **reaches no browser at all**, because nothing in the product
calls it. [TODOS.md](../../TODOS.md):2248-2257 sharpens it: a gateway that
clicks every button on every page burns the grant, the CDP-driven click is
indistinguishable from a human one, and the residue is external-plane throttling
«which does not exist». **During a pilot this is a `curl` or a SQL statement run
by the owner**, and that is the honest answer until a screen calls the
operation. Same shape for a mis-scoped project access grant, which
[TODOS.md](../../TODOS.md):900-930 records as revocable only by a superuser
`UPDATE`.

**(f) Forgetting one person who wrote in the group.** The first data-subject request a pilot receives is the one the identity-level procedure of [README-staging.md](../../infra/README-staging.md) §7 answers: one workspace, one Telegram user id, the operator script, one JSON line, one audit row that carries the surrogate and never the identifier. Its limits are stated there and in the gate record: the raw id survives in two intent columns until `operational_security` has a duration; a person who linked again after an earlier erasure is refused with a message naming the owner's decision, not served; pending inbox updates are counted per bot, not per workspace. Workspace-level closure is still owed (§5.2).

**(e) Writing down an A-3 invalidation.** §2's P5 failure-handling row already
names it: a технагляд who refuses to open the link, refuses to decide inside it,
or demands paper **invalidates A-3** and is written into
[validated-assumptions.md](../discovery/validated-assumptions.md) as an
invalidation — «recorded as a result, not as a bug». That is a pilot-time write,
not a post-mortem one, and the ledger's own update rule is where its form comes
from.

**What this subsection does not do.** It names no cadence, no on-call rota and
no SLA, because the repository defines none and inventing one here would be the
failure §0 refuses. It records the obligations and points at the questions.

---

## §9. Guardrails

### 9.1 The scope-addition test

> **Adding a capability to v0.1 requires an ADR, not a backlog item.** «It is
> already specified», «it is already in the DDL», «the catalog already has the
> row», and «it is only one more table» are each **explicitly not reasons**. The
> test is [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 1: **name
> the numbered step it is necessary for.**
> — [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):689-692;
> [version-0.1.md](version-0.1.md):903-906

The six numbered steps, and nothing outside them is v0.1:

1. **the object** — ПТВ creates an object, types work lines by hand, picks a
   work type, requirements load from the shipped ДБН library;
2. **the phone** — the foreman sees what must be photographed **before
   covering**, in the standard's own wording, with a reference image;
3. **the refusal** — a stage cannot be recorded closed while a `hold` on it is
   unmet, and the attempt names exactly what is missing;
4. **the act** — «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ» by the form of Додаток В,
   assembled only from already-recorded facts;
5. **the link** — технічний нагляд opens a personal link with no account and
   accepts or returns with a reason;
6. **the money** — the owner sees what is blocked and how much money sits behind
   it, broken down by cause.

Related: **a screen** additionally needs a row in
[04-role-pain-map.md](../design/04-role-pain-map.md) naming the role and the
demand-scan sentence describing its pain. If neither exists, the screen is a
guess (:134-140).

**The test has been applied once at scale and the answer is on record.** The Telegram channel added fifteen tables and ten operations to v0.1 with no numbered step of its own; [ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md) §"Relationship to ADR-006 decision 1" answers the test step by step — the channel is the transport of steps 2 and 3 on the owner's instruction of 2026-08-28 — and decision 9 gave it a milestone rather than hiding it in M6. A reader who wants to know what «name the numbered step» looks like when the capability is large should read that section, not this paragraph.

### 9.2 Every "requires an ADR, not a backlog item" rule

| Rule | Source |
|---|---|
| Changing the v0.1 outcome boundary — requires a superseding ADR identifying user evidence, version impact, data ownership, security impact and migration cost | [ADR-001](../decisions/ADR-001-product-boundary.md):106-110 |
| Moving a capability between versions; changing the `/demo` isolation model; changing documentation precedence — «requires a superseding ADR with explicit scope, security, migration, and user-evidence consequences» | [ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md):134-138, the Replacement rule |
| Changing the iOS 16.4+ / Android 10+ support floor — «requires an explicit compatibility decision **and recorded device evidence**», which is not the same as requiring an ADR by name | [ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md):80-84, the device floor |
| **Weakening the gate.** Making a `hold` markable `not_applicable`; allowing manual override of a derived readiness state; letting freeze *filter* instead of *refuse*; restoring `evidence_blocked` below the packaging states — each is a boundary change | [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md):884-901 |
| Reversing an owner assumption — requires editing the assumption section in the same change | same |
| Any change to regulatory content — governed by [hidden-works-content-rules.md](../product/hidden-works-content-rules.md), which binds **at every precedence level, including over ADRs** | [docs/README.md](../README.md):156-165; [ADR-010](../decisions/ADR-010-project-sourced-requirements.md):54-64 |
| Adding a capability to v0.1 | [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):689-692 |
| **Moving the pilot later** | same, protection 2 |
| **Unfreezing import** — requires *the file*: one real sanitized кошторис, АВР or interim-works file, recorded in [validated-assumptions.md](../discovery/validated-assumptions.md) with the named company and date | same, protection 3 |
| Choosing a **loyal** технагляд for the first pilot — requires an ADR superseding decision 9 that records what the resulting evidence will not prove | same, protection 4 |
| **Reordering M0 behind M6** | same, protection 5 |
| Re-asserting a withdrawn provenance claim (camera-only capture; camera-vs-gallery discrimination; tamper-evident provenance; verified capture-time GPS) — an ADR, **not a UI change** | [ADR-007](../decisions/ADR-007-pilot-field-client.md):591-612 |
| Claiming a durable pending original — INV-013/014/053 may **not** be re-scoped back onto the browser path by a catalog edit | same |
| A client-specific field on an evidence object, upload intent or requirement occurrence — the domain and the API stay client-agnostic | same |
| Moving the valuation carve back into the recording path, or adding a readiness predicate to `progress.record`. **«A performance argument is not sufficient: the ordering is the product's central claim about itself.»** | [ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md):163-169 |
| Reverting to a single deployed surface, or moving the field client back into `apps/app` **before the parity gate is measured** | [ADR-009](../decisions/ADR-009-three-pilot-surfaces.md):156-162 |
| A third `/v1` or `/external` operation added for a dashboard slice — the 2026-08-22 amendment «authorises these two and nothing else»; a later slice needs **its own dated amendment** | [ADR-009](../decisions/ADR-009-three-pilot-surfaces.md):167-228 |
| A dashboard screen for project-sourced requirements — needs an ADR-010 amendment, a [04-role-pain-map.md](../design/04-role-pain-map.md) row, and the [02-building-ui.md](../design/02-building-ui.md) procedure | [ADR-010](../decisions/ADR-010-project-sourced-requirements.md):142-211 |
| A second communication channel, channel switching after activation, importing earlier Telegram history, a fourth deployed surface for the group, an eleventh channel operation, or a channel screen on the dashboard — each needs a dated ADR-011 amendment (and, for a screen, the ADR-009 amendment, the role-pain row and the UI procedure) | [ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md) decisions 1, 2, 7; §"Relationship to ADR-009"; §"What this decision does NOT authorise" |
| Enabling the Telegram webhook in any environment before Task 13's edge limit, the scheduler, the real-group staging pass and the card's tag-and-source have landed — and a real group before M0 closes | [ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md) decision 10; [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) protection 5 |
| Removing the field client from a Telegram-locked project | [ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md) open item 8, ruled 2026-09-03 |

**Note the asymmetry a reader will otherwise miss:** ADR-002, ADR-003 and
ADR-010 carry **no Replacement rule section at all**. Their clauses have no
explicit "requires an ADR" protection of their own; the guardrails covering them
arrive indirectly, through ADR-001's boundary rule, ADR-005's gate protections,
and hidden-works-content-rules.md's precedence over ADRs.

**And the one that reverses a reader's instinct.** A later, Approved,
higher-numbered ADR does **not** automatically win. By
[docs/README.md](../README.md)'s own ordering, product scope and roadmap sit at
level 4 and the approved domain and architecture designs at level 2 — both above
ADRs at level 5. [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):593-628:
«an unedited `docs/domain/` document therefore outranks this ADR and ADR-007 by
the package's own rules… **the contradiction is resolved AGAINST this ADR and
not by it.**» Making those edits is a condition of the decision taking effect,
not a follow-up task.

**Reading rule for a "documents that must be corrected" table — and the two
tables in play run on opposite conventions, so the rule is not generic.**

ADR-007's table is a **snapshot frozen at approval**: «Each row below was a
correction owed **when this ADR was approved on 2026-08-06**»
([ADR-007](../decisions/ADR-007-pilot-field-client.md):541-543). Its reading
rule, quoted in its own direction:

> **Read the right-hand column as the end state each document must reach, never
> as a claim that it has not reached it.** Whether a given correction has landed
> is checked in the document itself; a table that says «owed» does not become
> false by being satisfied, but a reader who treats it as current state will
> halt planning on a premise that may already be closed — **which is the failure
> this package has had twice.**
> — [ADR-007](../decisions/ADR-007-pilot-field-client.md):545-550

**§1.5's register runs the opposite convention** and says so:
[version-0.1.md](version-0.1.md):934 — «**A row leaves this table when it
lands**, because a correction recorded as owed after it is done stops delivery
on nothing and buries the rows that genuinely do.» So §1.5 **is** current state
and may be read as one; ADR-007's table is not and must not be.

An earlier revision of this line stated ADR-007's rule backwards — «never as a
claim it has **already** reached it» — which would have instructed a reader to
do precisely the thing the ADR records as having cost this package twice. It is
recorded here rather than silently corrected, because a citation-backed
misstatement of an Approved ADR inside this document's own guardrails section is
the failure §0's honesty contract exists to prevent.

### 9.3 What v0.1 may not claim

| Prohibition | Source |
|---|---|
| The positioning sentence «Ми не блокуємо роботу на майданчику — ми не даємо її пред'явити до оплати, поки доказ не отримано і не погоджено» may be used **only alongside an explicit statement that payment-presentation eligibility is not in v0.1**, and **no demonstration, landing page, screen or sales sentence may show a payment-presentation refusal that does not exist** | [version-0.1.md](version-0.1.md):908-913; [roadmap.md](../product/roadmap.md):212-223 |
| No UI, package, render, demo or sales sentence claims camera-only capture for a blocking requirement, camera-versus-gallery discrimination, tamper-evident provenance, or verified capture-time GPS. What **may** be claimed: a client-computed content hash verified at finalization, a server receipt time, and a device-claimed capture time stored beside it and **explicitly labelled untrusted** | [ADR-007](../decisions/ADR-007-pilot-field-client.md):256-295 |
| A level-3 `LINK_CONFIRMATION` record is **never labelled, exported, or demonstrated as a signature.** КЕП is v0.2 | [version-0.1.md](version-0.1.md):728-746 |
| Blocked value is **exposure, never a receivable.** v0.1 creates no accounting entry, no payment obligation, no cross-currency total | [version-0.1.md](version-0.1.md):781-798; [ADR-001](../decisions/ADR-001-product-boundary.md) |
| Blocked value is reported **beside** first-time acceptance rate and days-to-signature and **never as the hero number** | [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md):700-709 |
| Manual work-line entry is a **first-class capability, not a stopgap** — no document, screen, error message or export may describe it as one | [version-0.1.md](version-0.1.md):154-157 |
| `PROJECT_DOCUMENTATION` names an **origin, not a verification strength**. No claim that the product verified anything | [ADR-010](../decisions/ADR-010-project-sourced-requirements.md):142-211 |
| No Додаток Г, no КБ-2в (Додаток 36), no КБ-3 (Додаток 37), no КЕП in v0.1 | [version-0.1.md](version-0.1.md):699-705 |
| Nothing is printed for the технагляд's кваліфікаційний сертифікат серія/номер until [hidden-works-content-rules.md](../product/hidden-works-content-rules.md) allow-lists that field | [version-0.1.md](version-0.1.md):669-673 |
| No document may describe the bypass reason-code vocabulary as a closed set until it is enumerated in [state-catalog.csv](../../technical/states/state-catalog.csv) and [glossary.md](../domain/glossary.md). (Moot in v0.1 — [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4 removes the bypass entirely) | [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md):362-396 |
| **No notice of any kind exists in v0.1.** The witness notice event moved to v0.2 with witness, and «no document may describe a v0.1 notice of any kind» | [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md):373, :579-586 |
| No slice may write a v0.1 definition of the two headline measures | [version-0.1.md](version-0.1.md):822 |
| Telegram is a transport; PostgreSQL is the source of truth for scope, identity, authorship, evidence association, decisions, delivery state and audit; **Telegram is never the only copy of an accepted evidence original**; and the channel is «not a generic messenger bridge» | [ADR-011](../decisions/ADR-011-telegram-locked-project-channel.md) §"Owner-approved on 2026-08-28", the two travelling sentences |
| No document describes the channel as operational, deployed or monitored: it is merged, deployed nowhere, its webhook enabled nowhere, its retention inert, and its integration suites red | ADR-011 §"Status against the runtime"; §1.1 and §1.3 of this runbook |

### 9.4 The two migrations owed to v0.2

Recorded here «because work written during a pilot is the work most likely to be
looked at later, and **both are silent failures if forgotten**»
([version-0.1.md](version-0.1.md):915-927).

| # | Migration | Test it needs |
|---|---|---|
| 1 | Every `hold` written during v0.1 with `blocking_scope = blocks_stage_closure` is widened to `blocks_both` when packages ship. Without it, **every requirement recorded during the pilot sits permanently outside the payment-eligibility half of the gate** | One that **fails if a single v0.1 row is left behind** |
| 2 | Every act version written during v0.1, pinned by its stage closure, gains its package-version pin when packages ship | Same |

**A third item that is not a third migration.** M5's grants are all
`scope_kind = 'requirement_occurrence'` and every decision is
`evidence_decision`; the package arc and `commercial_decision` are additive by
construction, so v0.2 widens vocabularies rather than rewriting rows. Record it
as **a v0.2 widening to verify**, not as a back-fill migration — the sentence
introducing it in
[2026-08-06-v0.1-implementation-progress.md](../superpowers/plans/2026-08-06-v0.1-implementation-progress.md):505-513
reads as a third obligation on first pass and is not one.

### 9.5 Two things v0.1 does that are permanent consequences, not defects

- **An imported line can never materialise an obligation.** Migration `0050`
  adds `work_items.work_type_key` so a hand-typed line materialises
  requirements, but the frozen importer writes no work type and a published line
  is immutable. «An imported кошторис materialises nothing and the only remedy
  is a successor version typed by hand, one line at a time»
  ([version-0.1.md](version-0.1.md):497-507).
- **A constraint asymmetry worth a rule.**
  `requirement_rule_versions_one_provenance_check` makes citing **both** a
  library item and a project-sourced item unstorable, and leaves citing
  **neither** storable. The exactly-one half is the publish request's
  `superRefine` in `packages/contracts/src/requirement-rules.ts` — «which is
  therefore not a friendlier restating of the CHECK but the only place the
  neither-id case is refused at all»
  ([ADR-010](../decisions/ADR-010-project-sourced-requirements.md):203-211).
  Do not "simplify" that validator away.

### 9.6 Two arguments that have expired and must not be cited again

| Expired argument | Why |
|---|---|
| «`requirement_rule_versions.publish` has no screen either», as a ground for refusing a requirement-authoring screen | [ADR-010](../decisions/ADR-010-project-sourced-requirements.md):156-179, corrected 2026-08-28: the parity ground «stops being true the day that screen ships and must not be cited again once it does» — and [ADR-009](../decisions/ADR-009-three-pilot-surfaces.md)'s same-day amendment authorises that screen. **The prohibition is unchanged**; the two remaining grounds carry it unaided |
| «A component's kitchen-sink rendering is gated by `component-contract.test.ts`» | Commit `5c650b5` (2026-08-29), «the gate that never existed»: that suite asserts file ↔ `index.ts` parity in both directions and **never opens a kitchen sink**. Anything said about kitchen-sink enforcement must say **enforced by nothing today** |

---

## §10. Open questions this runbook cannot answer

Each is undefined in repo. The «who» column names the role (§3) that must
produce the answer; on a one-person project that is the owner wearing that role,
and for the **eleven rows carrying «owner decision»** — Q-1, Q-2, Q-3, Q-4, Q-6,
Q-9, Q-10, Q-11, Q-12, Q-15 and Q-17 — it is the owner deciding, not an agent inferring.

| # | Question | Who | Blocks |
|---|---|---|---|
| **Q-1** | **Where does the pilot object live?** [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 8 defines six fields and their required contents. No file holds them. Its existence as an artifact is undefined in repo | Sprint Prioritizer / **owner decision** | P3, and therefore M6 open |
| **Q-2** | **How is a milestone formally closed?** [version-0.1.md](version-0.1.md):891-901 states what closure *requires*; no artifact records a dated closure for any milestone and no procedure says who signs one or where. Only M0 has a mechanism | Senior PM / **owner decision** | M1–M5 closure, and therefore M6 |
| **Q-3** | **What is the domain?** Three surfaces on `*.vercel.app`; `{{APP_HOSTNAME}}`, `{{LANDING_HOSTNAME}}` and `{{CONTACT_EMAIL}}` unresolved; neither well-known file exists. [ADR-007](../decisions/ADR-007-pilot-field-client.md):523-530 records the decision as open and [ADR-009](../decisions/ADR-009-three-pilot-surfaces.md):136-140 adds a third hostname to it. **No ADR takes it** | **Owner decision** | M0 item 1, M5 entry evidence, the seven outreach letters (the whole current red of the docs gate) |
| **Q-4** | **What are the pilot retention durations?** Every one of 126 rows is `duration_external_gate` under V-003, whose owner is «counsel/accountant» and whose target is «before GA retention». Whether V-003 is even the right gate for a *pilot* is unstated | **Owner decision** | M0 item 2, and item 4's shape |
| **Q-5** | **Is «on every printed page» satisfiable without a paginator?** There is no print or PDF surface; `act-content-fidelity.test.ts` names the gap itself — «a model without a paginator» | UX Architect + Backend Architect | M0 item 6, M4 acceptance |
| **Q-6** | **What is left of the evidence-and-procedure question.** **Answered on 2026-09-13** by root AGENTS.md and [agents/COORDINATION.md](../../agents/COORDINATION.md) (DEV-002, owner-approved): a slice's record is its task record, `docs/tasks/DEV-NNN`; brainstorm outcomes are its dated Owner decisions; review verdicts are its Findings; an aborted slice moves to `cancelled` (§4.1, §7.1). **Still open:** the status an ADR moves through, and whether the ruling-in-conversation form ADR-011 records is the whole approval procedure (§4.1 step 5b); and whether the channel's nineteen migrations are owed a retroactive record | Senior PM / **owner decision** | ADR approvals; the channel's evidence |
| **Q-7** | **Does the ДБН retrieval record satisfy «committed under `technical/requirements/`»** when the record as a record lives in `apps/app/src/lib/statutory-act-form.ts` and the directory holds only the two CSVs repeating its three facts per row? | Reality Checker | M0 item 9's evidence entry |
| **Q-8** | **What is the quarantine ledger?** Two Approved documents make it an enforcement point. No file, no format, no reader. Nothing detects a skipped test at all | DevOps Automator | Nothing today; a real hole in gate 4 of §6.3 |
| **Q-9** | **Three narrow things, not «there is no procedure».** The repeat-apply procedure exists ([README-staging.md](../../infra/README-staging.md):162, :165-186) and so does the head check (:184, verbatim). What is undefined in repo is **(a) who** runs `supabase db push` after a migration merges, **(b) on what trigger** — nothing automates it and no CI job touches a hosted project, and **(c) what the rollback for a bad migration is**, given `db reset --linked` is prohibited and applied migrations are append-only ([docs/README.md](../README.md):172-173). Also open: whether a **separate production project** is owed before or after the pilot, since the pilot rides the single staging/pilot project today ([system-overview.md](../architecture/system-overview.md):583). This is why `0059`–`0081` have no apply record, and why the largest push since provisioning is unscheduled | DevOps Automator / **owner decision** for the production-project half | Every future deploy; step 4 of §8.6 |
| **Q-10** | **Is magic-byte content-type enforcement plus a bounded allow-list accepted AS the malware control for a pilot, or is an engine owed?** An ADR-shaped decision nobody has written | **Owner decision** (ADR) | M0 item 12 |
| **Q-11** | **Does export land inside M0, or in a milestone M0 then gates?** Gate 3 has no operation, no route, no manifest format, no hash/provenance format, no «named omissions» vocabulary — and item 12's second half is unbuildable until it exists | Backend Architect / **owner decision** | M0 items 3 and 12 |
| **Q-12** | **What does «monitored» mean for a one-workspace pilot** — and **what runs the consumer?** `delivery.ts` exists and nothing schedules it; the purge worker has no runner; ADR-011 decision 10 names «the scheduler» as a webhook-enable blocker without saying what it is (pg_cron, a Vercel cron, a worker). A dashboard closes nothing | DevOps Automator / **owner decision** | M0 item 8; M7's operational status |
| **Q-13** | **Where do [README-staging.md](../../infra/README-staging.md) §6's steps 1–8 staging curls get recorded?** (That document's §6, not this runbook's §6.) «A checked box with no evidence is not verification» — but there is no named ops log, no file, and no PR convention | DevOps Automator | §8.2 |
| **Q-14** | **Do the two design documents get metadata, or a recorded exemption?** [03-ui-references.md](../design/03-ui-references.md) and [04-role-pain-map.md](../design/04-role-pain-map.md) are Approved, are named by root [AGENTS.md](../../AGENTS.md) as required reading, and violate [docs/README.md](../README.md):87-119 — while the validator stays silent because neither is on its REQUIRED list. **The validator's silence is not authority** | Senior PM | Nothing mechanical; an unrecorded exemption |
| **Q-15** | **What identity does the members screen show, and does supplying it need a new operation?** [2026-08-21-plan-d-dashboard.md](../superpowers/plans/2026-08-21-plan-d-dashboard.md):73: `GET /v1/workspaces/{ws}/members` returns «no email, no name», so «the office user would be granting capabilities to UUIDs… Deciding what identity to show is product work, not layout». If the answer needs a third operation, it needs **its own dated ADR-009 amendment** — the 2026-08-22 amendment «authorises these two and nothing else» (§9.2) | **Owner decision** | Phase P2 / Plan D4. It is why D4 is last, and the [04-role-pain-map.md](../design/04-role-pain-map.md) row it would otherwise be waiting on already exists (:72) |
| **Q-17** | **When is a Telegram bot allowed a real group?** ADR-011 decision 10 orders the blockers; M0's rule forbids real data first; nothing says who registers the webhook URL, on which bot, with which secret, and where that act is recorded — the seven channel variables are outside the deploy preflight (§8.1) | DevOps Automator / **owner decision** | M7's real-group pass; §8.6 step 5b |
| **Q-16** | **Is there a supply-chain gate, or a recorded acceptance that there is none?** `.github/` holds `workflows/ci.yml` and nothing else — no dependabot config, no `pnpm audit` step, no lockfile-diff review (measured 2026-09-01). M0 exists to make an environment fit to hold someone else's personal data; an unreviewed dependency graph is the same class of hole as the absent quarantine ledger | DevOps Automator | Nothing mechanical today; §6.4's gap table |

### Two questions this runbook deliberately does **not** ask

- **What the two headline measures should be defined as.** That is
  [glossary.md](../domain/glossary.md)'s to write, it is C-5, and «no slice may
  invent a definition». Asking it here would be the first step toward answering
  it here.
- **Which pain is being sold** — evidence gaps, or the customer having no money.
  [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md):764-789
  leaves it open and says what settles it: **ten to fifteen interviews**, which
  can invalidate the product. It is not a documentation question and this
  document cannot move it.

---

*This document is `Status: Draft`. It has had no owner review. The DEV-003
revision's review stages are recorded in [DEV-003](../tasks/DEV-003-runbook-process.md). Its §1 measurements were taken on 2026-09-03 at commit
`1c418fb` and are reproducible from the transcript in §0; the 2026-09-01
revision's measurements at `7397d7d` are superseded, not contradicted. Everything else in it
is a reading of documents that are cited by line, and where those documents
disagree, both sides are named in §1.4 and §1.5 rather than resolved silently.*

*The 2026-09-03 revision rewrote §1 against the merged channel (PRs #58, #62, #64, #65, #66), ADR-011's nine rulings and the red CI baseline, and touched §2, §4–§10 only where those facts reach. The 2026-09-01 revision applied four adversarial reviews. Where a review found this
document had stated something backwards, overstated a hole, or rounded a count,
the correction is recorded in place rather than made quietly — see §7.5's
scoping note, §8.1's «stated narrowly» paragraph, §9.2's reading rule, and
§4.2's plan-shape commands (now kept in `docs/ai-workflow.md`). Two of those were this document asserting a thing
its own §0 forbids, which is worth keeping visible.*

*The 2026-09-13 revision (DEV-003) rewrote §3, §4, §6.6 and §7 onto the process in root `AGENTS.md`, moved the retired loop's measurements to `docs/ai-workflow.md`, and answered most of Q-6. It re-measured nothing in §1.*
