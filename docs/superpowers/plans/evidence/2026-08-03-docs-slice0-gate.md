# Documentation slice 0 — "make the canon true" — gate record

**Date:** 2026-08-03
**Branch:** `claude/docs-slice0-truth`, from `main` @ `70c8107`
**Plan:** [2026-08-03-docs-slice0-truth.md](../2026-08-03-docs-slice0-truth.md)
**Spec:** [2026-08-03-docs-slice0-truth-design.md](../../specs/2026-08-03-docs-slice0-truth-design.md)
**Task:** [task-5-brief.md](../../../../.superpowers/sdd/2026-08-03-docs-slice0-truth/task-5-brief.md)

## What the green checks prove, and what they do not

**This slice changed no code.** Its whole diff against `70c8107` is nineteen
Markdown files — the corrected documents plus the plan, spec and this record —
and two CSVs under `technical/states/`. Twenty-one files, no other kind of file at
all; the full file list is in the Evidence section below.

```
$ git diff --name-only 70c8107..HEAD | sed 's/.*\.//' | sort | uniq -c
   2 csv
  19 md
```

**Deliberately the tally and not `git diff --stat`.** An earlier draft pasted the
full `--stat`, including `20 files changed, 1736 insertions(+)`. That number was
true when pasted and false one commit later, because every edit to *this file* is
inside the diff it is describing — a record that counts its own lines is stale the
moment it is written, which is the same trap the B0 procurement record fell into
counting its own mentions of a term. The tally above changes only if a file of a
new kind enters the slice, which is the fact being asserted. The full file list is
in the Evidence section, where it does not carry a self-referential number.

So the test suite and `pnpm typecheck` were never the evidence for this slice.
They are a floor: they show that nothing protected was disturbed, and they passed
happily over every one of these false claims before the slice began. A green suite
has no opinion about whether a document tells the truth.

That is a statement about what those gates can prove, not an excuse for the two of
them that go unproven below. Both are unproven for an environmental reason, and
the section that records them says exactly what would settle them. Even fully
green they would not have been the argument that this slice is correct.

**The evidence is the corrections table** — every row carries the command that
measures the truth, so a reader re-runs a command rather than trusting a diff. If
you read one section of this record, read that one.

Every command in the corrections table, the counting-rules section and the
"already correct" section was re-executed at this commit on 2026-08-03 while
writing this record. Nothing below is transcribed from a task report without
being re-run. Where a re-run disagreed with a written claim, the disagreement is
stated rather than smoothed over — see the note on the `sealed` file count in
"What this slice did not close".

## Evidence

| Gate | Result |
|---|---|
| `node scripts/validate-canonical-docs.mjs` | **PASS** — `canonical documentation: OK` (exit 0) |
| `python3 scripts/validate_package.py` | **PASS** — `AktFlow package validation: PASS`, `documents=35`, `required_artifacts=69` (exit 0) |
| `make validate` | **NOT RUN** — see below |
| `pnpm typecheck` | **NOT PROVEN — environmental** — see below |
| `pnpm turbo run test --concurrency=1 --force` | **NOT PROVEN — environmental** — see below |

Two of the five gates could not be made to produce a real result in this checkout.
They are recorded as **NOT PROVEN**, which is neither a pass nor a failure of this
branch: both stop on a declared dependency that is missing from the installed
`node_modules`, for a reason that predates the branch and that no documentation
change can reach. The verbatim output of all five is below, and the
NOT PROVEN section states exactly what a reader must do to convert them into a
real result. **A gate record that claims a green check nobody executed is worse
than no gate record**, so nothing here is marked green on the strength of an
expectation.

### `node scripts/validate-canonical-docs.mjs` — PASS

```
$ node scripts/validate-canonical-docs.mjs
canonical documentation: OK
(exit 0)
```

### `python3 scripts/validate_package.py` — PASS

```
$ python3 scripts/validate_package.py
AktFlow package validation: PASS (required_artifacts=69, documents=35, sql_tables=126, access_surfaces=158, states=261, transitions=295, errors=118, api_operations=157, requirements=41, test_contracts=149, ui_actions=103, entity_aliases=21, retention_mappings=126, command_availability_rules=32, external_gates_unvalidated=12)
External/runtime evidence status: NOT PROVEN; V-001..V-012 remain unvalidated by design.
(exit 0)
```

`documents=35` and `required_artifacts=69` match the baseline recorded by all four
task reports — confirmation that no file was added, removed or moved.

### `make validate` — NOT RUN, deliberately

`make validate` is `validate-prototype validate-qa validate-contracts`
(`Makefile:3`), and `validate-prototype` is `npm --prefix prototype run lint`
(`Makefile:9`), whose script is `eslint .` (`prototype/package.json:10`).
`prototype/node_modules` does not exist in this checkout and `eslint` is not on
`PATH`, so the target fails before reaching any documentation check — a failure
that predates this slice and has nothing to do with documentation. The plan's own
Global Constraints already ruled that the documentation gate is
`python3 scripts/validate_package.py`, invoked directly; that is the row above.
This row exists so that a reader comparing this record against
[2026-08-01-b0-gate.md](2026-08-01-b0-gate.md) does not read the absence of
`make validate` as an oversight.

### `pnpm typecheck` — NOT PROVEN, environmental

```
$ pnpm typecheck
@aktflow/domain:typecheck: src/import/xlsx.test.ts(2,21): error TS2307: Cannot find module 'exceljs' or its corresponding type declarations.
@aktflow/domain:typecheck: src/import/xlsx.ts(1,21): error TS2307: Cannot find module 'exceljs' or its corresponding type declarations.
@aktflow/domain:typecheck: src/import/xlsx.ts(36,42): error TS7006: Parameter 'row' implicitly has an 'any' type.
@aktflow/domain:typecheck: src/import/xlsx.ts(36,47): error TS7006: Parameter 'rowNumber' implicitly has an 'any' type.
@aktflow/domain:typecheck: src/import/xlsx.ts(39,46): error TS7006: Parameter 'cell' implicitly has an 'any' type.
@aktflow/domain:typecheck: src/import/xlsx.ts(39,52): error TS7006: Parameter 'colNumber' implicitly has an 'any' type.
@aktflow/domain:typecheck: src/import/xlsx.ts(49,64): error TS7006: Parameter 't' implicitly has an 'any' type.
@aktflow/database:typecheck: ../domain/src/import/xlsx.ts(1,21): error TS2307: Cannot find module 'exceljs' or its corresponding type declarations.
 Tasks:    5 successful, 10 total
Failed:    @aktflow/domain#typecheck
```

Five of ten packages typecheck clean; `@aktflow/domain` and `@aktflow/database`
fail, both on `exceljs`. The six `TS7006` errors are downstream of the same
`TS2307` — without the package's types every callback parameter becomes an
implicit `any`.

### `pnpm turbo run test --concurrency=1 --force` — NOT PROVEN, environmental

Run with the local Supabase stack up (`supabase_db_…` healthy on `54322`) and
with `pnpm db:local-credentials` executed first, then `APP_DB_URL` and
`SERVICE_DB_URL` exported from `apps/app/.env.example` for the run. No
credential value is reproduced in this record.

```
$ pnpm turbo run test --concurrency=1 --force
@aktflow/demo:test:  Test Files  16 passed (16)
@aktflow/demo:test:       Tests  134 passed (134)
@aktflow/contracts:test:  Test Files  1 passed (1)
@aktflow/contracts:test:       Tests  6 passed (6)
@aktflow/domain:test:  Test Files  1 failed | 9 passed (10)
@aktflow/domain:test:       Tests  88 passed (88)
@aktflow/domain:test:  ELIFECYCLE  Test failed. See above for more details.
 Tasks:    2 successful, 4 total
Failed:    @aktflow/domain#test
```

The failing suite, verbatim:

```
 FAIL  src/import/xlsx.test.ts [ src/import/xlsx.test.ts ]
Error: Cannot find package 'exceljs' imported from '/…/packages/domain/src/import/xlsx.test.ts'
Caused by: Error: Failed to load url exceljs (resolved id: exceljs) in /…/packages/domain/src/import/xlsx.test.ts. Does the file exist?
```

Turbo halts on the first failing task, so `@aktflow/testing`, `@aktflow/database`
and `@aktflow/app` never ran under the gate command. They were then run under the
same command plus `--continue`, recorded here as a **supplementary** run — the
gate command itself is the one above, and it failed:

```
$ pnpm turbo run test --concurrency=1 --force --continue
@aktflow/demo:test:       Tests  134 passed (134)
@aktflow/contracts:test:       Tests  6 passed (6)
@aktflow/domain:test:       Tests  88 passed (88)      [1 suite failed to load]
@aktflow/testing:test:       Tests  139 passed (139)
@aktflow/database:test:       Tests  7 passed (7)
@aktflow/app:test:       Tests  194 failed | 28 passed | 9 skipped (231)
 Tasks:    4 successful, 6 total
Failed:    @aktflow/app#test, @aktflow/domain#test
```

**The database tests pass, 7/7, against the running local stack** — the one part
of the suite that needed the credentials, and the part most likely to fail for an
environment reason, is green. `@aktflow/testing` is green at 139/139, which
matters because that package holds the token-fidelity guard the colour
corrections lean on.

`@aktflow/app`'s 23 failing files are one root cause, verified rather than
assumed. Its three failed *suites* are `tests/vertical-m1.int.test.ts` and
`tests/vertical-m2a.int.test.ts` (`Cannot find package 'exceljs'`) and
`src/lib/command.test.ts` (`Cannot find package 'zod'`). A representative
integration file was then run alone to classify the 194 failed *tests*:

```
$ npx vitest run tests/assignments.int.test.ts
   × assignments.create > creates an assignment against a published work item
     → Cannot find package 'exceljs' imported from '/…/packages/domain/src/import/xlsx.ts'
   … 13 of 13 identical
 Test Files  1 failed (1)
      Tests  13 failed (13)
```

Every failure traces to a module that will not resolve. The two exceptions are
`tests/evidence-storage.int.test.ts`'s two anonymous-client cases, which fail on
`Error: supabaseKey is required.` because `apps/app/.env.example` ships
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as **empty**
placeholders (`length 0`) while the tests read `SUPABASE_URL`, which the file does
not define at all. That is missing local configuration, not a defect.

### Why both are NOT PROVEN rather than failing

**The only question a reader should care about is whether this slice caused it.
It did not, and the whole diff is the proof — every changed file is
documentation.**

```
$ git diff --name-only 70c8107..HEAD
README.md
docs/04-screen-specification.md
docs/05-design-system.md
docs/07-technical-architecture.md
docs/20-flow-catalog.md
docs/22-data-api-contract.md
docs/23-offline-media-protocol.md
docs/27-qa-traceability.md
docs/README.md
docs/architecture/data-model.md
docs/architecture/files-and-storage.md
docs/architecture/jobs-events-and-audit.md
docs/architecture/system-overview.md
docs/architecture/tenancy-and-security.md
docs/delivery/version-0.0.md
docs/domain/execution-and-evidence.md
docs/superpowers/plans/2026-08-03-docs-slice0-truth.md
docs/superpowers/plans/evidence/2026-08-03-docs-slice0-gate.md
docs/superpowers/specs/2026-08-03-docs-slice0-truth-design.md
technical/states/state-catalog.csv
technical/states/transition-catalog.csv

$ git diff --name-only 70c8107..HEAD | sed 's/.*\.//' | sort | uniq -c
   2 csv
  19 md
```

Twenty-one files: nineteen Markdown, two CSV, nothing else. No TypeScript, no
`package.json`, no lockfile, no `node_modules`. There is no path from this diff to
a module-resolution error.

**The missing package.** `exceljs@4.4.0` is declared at
`packages/domain/package.json:13` and present in `pnpm-lock.yaml`, but absent from
the installed tree; root `node_modules` holds five entries. It was introduced by
`314fb58` ("feat(m1): XLSX container guard and inert-formula parse (INV-016)"),
which `git merge-base --is-ancestor` confirms is an ancestor of this slice's base
`70c8107`. The condition predates the branch.

**The root cause is a pnpm version mismatch, not a broken dependency.** The
installed `node_modules` was built by a different pnpm version than the one now on
`PATH`, which announces itself on every invocation:

```
[WARN] The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: "pnpm.onlyBuiltDependencies". See https://pnpm.io/settings for the new home of each setting.
```

Reconciling that state is not an incremental install. `pnpm install
--frozen-lockfile` stops at an interactive confirmation —
`The modules directories will be removed and reinstalled from scratch. Proceed?` —
i.e. a full purge and rebuild of `node_modules` across all 11 workspace projects.
It was declined and **no install was performed**: the command exited without
installing, `node_modules/.pnpm` still contains no `exceljs`, and `git status` plus
`git diff pnpm-lock.yaml` confirm the attempt changed nothing.

Wiping and rebuilding every workspace package is an environment repair in a
checkout currently running a live database. That is the owner's call, not a
documentation slice's, so it was left alone and these two rows were left unproven
rather than quietly made green.

**What would prove them.** Run a full `pnpm install` and accept the modules purge,
then re-run `pnpm typecheck` and `pnpm turbo run test --concurrency=1 --force`.
Until someone does that, the honest state of these two gates is: **not known**.
This record does not claim they pass, does not claim they fail on the branch, and
does not predict what they will say — only that whatever they say next will be a
fact about the checkout's `node_modules`, since the branch contains no code to
break.

## The corrections

One row per corrected claim. **Task 1's edit sites across seven files collapse
into three claims** and Task 2's six into one, because a claim repeated in four
files is one correction applied four times — the order the slice worked in. The
command IDs resolve in "The measuring commands" below; each was re-run at this
commit.

Rows 1-16 are Tasks 1-4's work. **Rows 17-21 were found after the four tasks had
closed** — row 17 by this gate pass, rows 18-21 by the whole-branch review — all
five by asking the same question of the whole corpus instead of one task's file
list. See "One correction that no task's grep could have found"; five of the
twenty-one corrections in this table were found that way, which is the strongest
argument the record makes for its own method.

**"It said" is the text each correction replaced, which is not always the text at
`70c8107`.** Rows 5 and 16 correct claims this slice introduced itself and then
caught in review, so `git show 70c8107:<path>` will not find them; both are
annotated with the commit the text entered at. Every other row's "It said" is the
base's own text.

| # | Where | It said | It says now | Measures |
|---|---|---|---|---|
| 1 | `files-and-storage.md` ×5, `execution-and-evidence.md` ×3, `jobs-events-and-audit.md`, `tenancy-and-security.md`, `system-overview.md`, `states/state-catalog.csv` ×3 | the upload machine runs `intent_authorized → staged → integrity_verified → scan_pending → available \| scan_blocked`, with the intermediate values as current semantics | `intent_authorized → available \| scan_blocked \| orphaned_for_purge \| expired`; the three intermediate values are named as reserved for the v0.3 resumable protocol and not written in v0.1 | **M1** |
| 2 | `technical/states/transition-catalog.csv` | eight rows for transitions that cannot fire, and one of the four that can (`intent_authorized → expired`, already present and correct) | all four `intent_authorized →` rows present — the three missing ones added; the eight unreachable rows carry the reserved note in `guard_or_rule` rather than being deleted. Upload-intent rows: 9 → 12 | **M2** |
| 3 | `jobs-events-and-audit.md` | "Inspection **jobs** operate only on intent-bound staged content" — a background worker | inspection runs synchronously inside the finalization command; no worker exists | **M3** |
| 4 | `docs/README.md`, root `README.md`, `data-model.md` ×3, `tenancy-and-security.md` | "six tables, one API view, three functions, and two application roles" | 33 tables, one API view (`api.me_context`), 27 functions (22 `app`, 5 `public`), five database roles, from 35 migrations through `0035`; the six tables are reframed as the v0.0 origin slice | **M4** |
| 5 | `data-model.md` | this inventory is corroborated by `baseline-verification.md`'s live `pg_catalog` snapshot — *mid-slice text, introduced by this slice at `3ffa97e`; absent at `70c8107`* | corroborated by `catalog-snapshots/20260731-2102.md` (`## tables (33)`, `## functions (27)`); `baseline-verification.md` is cited separately, for known gaps | **M5** |
| 6 | `docs/delivery/version-0.0.md:15` | "the existing six-table foundation is safe to extend" | "the foundation this gate started from — six tables, extended to seven by migration `0008` within the gate itself — is safe to…" | **M6** |
| 7 | `docs/23-offline-media-protocol.md:36` | the server "transitions `authorized → sealed`" | "transitions `intent_authorized → available`", with the note that there is no `sealed` state and that `sealed`/`authorized` come from the superseded `technical/schema.sql` | **M7** |
| 8 | `docs/23-offline-media-protocol.md:34` | the server persists an `authorized` upload intent | an `intent_authorized` upload intent | **M7** |
| 9 | `docs/23-offline-media-protocol.md:71` | "an expired/cancelled/sealed intent cannot be reused" | "an intent that has left `intent_authorized` — `available`, `scan_blocked`, `orphaned_for_purge` or `expired` — cannot be reused" | **M7**, **M8** |
| 10 | `docs/20-flow-catalog.md:60` | only an object "server-**sealed**" before invalidation may finish the review path | only an object "transitioned server-side to `available`" before invalidation | **M7** |
| 11 | `docs/27-qa-traceability.md:172` | "server-**sealed**-before-invalidation versus first-seen-after-invalidation" | "server-**available**-before-invalidation versus first-seen-after-invalidation" | **M7** |
| 12 | `architecture/system-overview.md`, root `README.md` | `apps/mobile` "does not yet physically exist … an approved target that must be created"; "**Not yet created.**" | it exists as a committed pnpm workspace — 22 tracked files, Expo SDK 57.0.9, expo-router; the milestone is open on functionality, not existence | **M9** |
| 13 | `docs/07-technical-architecture.md` ×2 | "Expo SDK 56" | "Expo SDK 57" in the stack table, "Expo SDK 57.0.9" in the version-baseline sentence | **M10** |
| 14 | `docs/05-design-system.md`, four of twelve colour rows | `ink-800 #2A2D2F`, `signal-700 #84A625`, `blue-500 #5278D8`, `muted #686E6A` | `#242424`, `#667F12`, `#3756a1`, `#666979` — the values in `packages/tokens/src/tokens.json` | **M11** |
| 15 | `docs/04-screen-specification.md:275`, `:276`, `:323` | scheme `aktflow://`, universal links covered by AASA and `assetlinks.json`, four target routes, and a tap that opens them | the `goproceed` scheme and Expo Router exist; the universal links, both coverage files and all four routes do not — the whole mobile route table is `_layout.tsx` and `index.tsx`; the rest is named as a v0.1 target | **M12** |
| 16 | `docs/04-screen-specification.md:421` | deep links are "live for the web `/app/...` routes today" — *mid-slice text, introduced by this slice at `c0da6b9`; at `70c8107` the line read only "actionable notifications with deep links;"* | "a v0.1 target on both surfaces: the web workspace ships only `/login` and `/context` today, and the mobile deep-link routes in §6 do not exist yet" | **M13** |
| 17 | `docs/23-offline-media-protocol.md:36` | finalization "creates one verification **job**/receipt and then **waits for** detected MIME/scan" | "creates one evidence-object receipt in that same transaction, and waits for nothing further: in v0.1 content inspection runs synchronously inside the finalization command (…`finalize/route.ts`), not as a separate job, so inspection has already succeeded by the time the receipt exists and a blocked upload never produces one" | **M14** |
| 18 | `architecture/system-overview.md:220`, in the `### Online mobile evidence` diagram | "→ BFF/**worker** verifies bytes, hash, authorization, and inspection state" | "→ **finalization command** verifies …", with a following paragraph stating that in v0.1 this step is not a worker and citing `finalize/route.ts` | **M14** |
| 19 | `docs/07-technical-architecture.md:113-115`, §6 Media pipeline | the superseded async model in full: object "lands in quarantine bucket/prefix", a "**Worker** scans file type/malware, calculates SHA-256, extracts dimensions/pages, creates derivatives", then "clean original moves/marks available" | the object lands on a private intent-bound staging key; finalization verifies size and SHA-256 and inspects synchronously — a magic-byte check, policy `m2a-magic-bytes-1`, whose own source says v0.1 ships no anti-malware engine; malware scanning, dimension/page extraction and derivatives are named as a later target; the same transaction writes `available` or `scan_blocked` | **M14**, **M15** |
| 20 | `docs/22-data-api-contract.md:103` | "completion can only **seal** the persisted tuple and **enqueue one verification job**" | "completion can only finalize the persisted tuple — in v0.1 it verifies and inspects synchronously inside the finalization command and enqueues no verification job" | **M14** |
| 21 | `docs/22-data-api-contract.md:144` | "A successful **verification job** materializes the purpose-specific row" | "A successful **finalization** materializes the purpose-specific row … in v0.1 inside the finalization command itself, not a separate verification job" | **M14** |

### The measuring commands

Every block below was executed at this commit, from the repository root, and the
output shown is what it printed.

**M1 — the upload machine has four transitions, not eight.**

```
$ grep -rhoE "set status = '[a-z_]+'" supabase/migrations/*.sql | sort | uniq -c
   1 set status = 'accepted'
   6 set status = 'available'
   2 set status = 'expired'
   6 set status = 'orphaned_for_purge'
   2 set status = 'scan_blocked'

$ grep -rnE "set status = '(staged|integrity_verified|scan_pending)'" supabase/migrations/*.sql
(no output — the intermediate values are never written)
```

The initial value is the column default, `intent_authorized`. One `expired` write
and the single `accepted` write target `public.invitations`, not
`public.upload_intents`. The engineering ruling that fixes the horizon is inline
at `apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts:76-82`: the
intermediate values "stay in the enum for the resumable protocol in v0.3".

**M2 — the four real transitions are in the catalog.**

```
$ grep -n "^upload_intent.status,intent_authorized," technical/states/transition-catalog.csv
27:…,intent_authorized,staged,…; reserved for the v0.3 resumable protocol; not written in v0.1 …
35:…,intent_authorized,available,finalization commits,…
36:…,intent_authorized,scan_blocked,inspection fails or errors,…
37:…,intent_authorized,orphaned_for_purge,authorization recheck fails,…
38:…,intent_authorized,expired,intent expiry,quota reservation released,…
```

Lines 35-38 are the four that fire; line 27 is a reserved row kept with its note.
Against the base, which is what makes the row's "It said" column checkable:

```
$ git show 70c8107:technical/states/transition-catalog.csv | grep -n "^upload_intent.status,intent_authorized,"
27:upload_intent.status,intent_authorized,staged,bytes received on the intent-bound key,single staging attempt key; no overwrite (INV-045),…
35:upload_intent.status,intent_authorized,expired,intent expiry,quota reservation released,docs/architecture/files-and-storage.md

$ git show 70c8107:technical/states/transition-catalog.csv | grep -c '^upload_intent.status,'
9
$ grep -c '^upload_intent.status,' technical/states/transition-catalog.csv
12
```

**The design document said this catalog had "zero" rows for the four transitions
that fire. That is wrong, and the gate pass caught it.** One of the four —
`intent_authorized → expired` — was already there and already correct; the base's
line 35 is byte-identical to HEAD's line 38. Task 1's implementer found this,
checked it before writing, said so in its report, and added the other three; its
reviewer confirmed it. The false "zero" is in
`2026-08-03-docs-slice0-truth-design.md:74`, and the first draft of this record
copied it forward without re-deriving it — which is exactly the failure this slice
exists to correct, committed by the document whose job is to certify the
correction. The design is a point-in-time record and is not edited; the correction
lives here, where the measurement is.

This is the third of this record's three lessons about its own fallibility, beside
"Three corrections that were themselves wrong" and "One correction that no task's
grep could have found" — and the most pointed. Those two were caught by a reviewer
reading a correction and by a grep widened past its task's file list. This one was
caught only by re-deriving a number that a written claim had made to sound settled:
"zero" invites no measurement, which is precisely why it survived a design, a plan,
four tasks and the first draft of this record.

**M3 — inspection is inline, not a job.**

```
$ grep -rn "inspectContent" apps/ packages/ supabase/ --include="*.ts" --include="*.sql"
apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts:12:import { inspectContent } from "../../../../../src/lib/evidence-inspection";
apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts:217:  const inspection = await inspectContent(bytes, intent.claimed_media_type);
apps/app/src/lib/evidence-inspection.ts:79:export function inspectContent(
```

One definition, one call site, inside the finalize route. No worker, no queue.

**M4 — the baseline inventory.**

```
$ ls -1 supabase/migrations/*.sql | wc -l
      35
$ grep -rhoiE "^[[:space:]]*create table (if not exists )?[a-z0-9_.]+" supabase/migrations/*.sql | wc -l
      33
$ grep -rciE "drop[[:space:]]+table|alter[[:space:]]+table[^;]*rename[[:space:]]+to|drop[[:space:]]+view|drop[[:space:]]+role" supabase/migrations/*.sql | grep -v ':0' || echo "none"
none
$ grep -rniE "create[[:space:]]+(or[[:space:]]+replace[[:space:]]+)?(materialized[[:space:]]+)?view" supabase/migrations/*.sql
supabase/migrations/0004_rls_policies.sql:42:create view api.me_context as
$ grep -rniE "create[[:space:]]+role" supabase/migrations/*.sql
supabase/migrations/0003_roles_and_grants.sql:8:    create role aktflow_app nologin nobypassrls;
supabase/migrations/0003_roles_and_grants.sql:11:    create role aktflow_app_login login noinherit nobypassrls;
supabase/migrations/0008_outbox_claim_retry_dead_letter.sql:35:    create role aktflow_worker nologin nobypassrls;
supabase/migrations/0034_service_principal_role.sql:25:    create role aktflow_service nologin nobypassrls;
supabase/migrations/0034_service_principal_role.sql:28:    create role aktflow_service_login login noinherit nobypassrls;
```

Zero destructive operations is what lets "created" stand in for "surviving".
The function counts have their own section below.

**M5 — the snapshot lives in the other file.**

```
$ sed -n '41,42p' migration/goproceed-canonical-v0.1/baseline-verification.md
This is a migration-derived baseline. A live `pg_catalog` snapshot was not
available, so staging or production drift remains unknown.

$ grep -nE "^## (tables|functions|roles) " migration/goproceed-canonical-v0.1/catalog-snapshots/20260731-2102.md
5:## tables (33)
2571:## functions (27)
2713:## roles (6)
```

The snapshot's `roles (6)` is `aktflow_app`, `aktflow_app_login`,
`aktflow_worker` plus the three Supabase platform roles (`anon`,
`authenticated`, `service_role`), and it predates migration `0034`. It is not a
counter-example to the five migration-created roles in M4.

**M6 — migration `0008` fell inside the v0.0 gate's own range.**

```
$ grep -rn "six[- ]table\|six tables\|three functions\|two application roles" docs/ README.md --include="*.md" | grep -v "docs/superpowers/\|docs/legacy/"
docs/architecture/data-model.md:26:### v0.0 origin slice: six tables (migrations 0001-0002)
docs/architecture/data-model.md:418:The v0.0 origin slice's six tables were hardened and evolved additively into
docs/delivery/version-0.0.md:16:six tables, extended to seven by migration `0008` within the gate itself —
docs/decisions/ADR-001-product-boundary.md:18:six-table tenant foundation, so that target could not safely serve as either a
```

Four survivors, each scoped: two name the origin slice explicitly, one carries
the gate's own qualifier, and the ADR records decision context and is out of
scope by instruction.

**M7 — the state name `sealed` is gone from the live documentation. The verb
`seal` is not, and one use of it is deliberately kept.**

The command is widened to the whole word family, because the original grep keyed
on `sealed` alone and so could not see `seal` at `docs/22:103` or
`docs/09:139` — a heading that claimed more than its command measured:

```
$ grep -rniE "\bseal(s|ed|ing)?\b" docs/ --include="*.md" | grep -v "docs/legacy/\|docs/superpowers/"
docs/23-offline-media-protocol.md:36:6. complete upload; … transitions `intent_authorized → available` (there is no `sealed` state: …)
docs/09-security-compliance.md:139:- A signed offline lease proves bounded authority … Only server receipt/seal establishes trusted chronology.
```

Two survivors. The first is the note that describes `sealed` as a value that was
never permitted. The second is a general security principle about who establishes
time, kept on purpose — see "What this slice did not close". Its source, and the source of `authorized` and `cancelled`:

```
$ grep -n "check (state in ('authorized'" technical/schema.sql
726:  state text not null default 'authorized' check (state in ('authorized','sealed','expired','cancelled')),

$ grep -n "check (status in ('intent_authorized'" supabase/migrations/0015_execution_evidence_module.sql
267:    check (status in ('intent_authorized','staged','integrity_verified','scan_pending',
```

One superseded four-value vocabulary in `technical/schema.sql`, one live
eight-value vocabulary in the migration chain. They share no member.

**M8 — the four real values are genuinely terminal.** Every command that writes
`public.upload_intents.status` gates on `status = 'intent_authorized'`:
`app.finalize_upload_intent` (`0035:54-63` — an `already` short-circuit for
`available` at `:54`, then the `i.status <> 'intent_authorized'` conflict guard at
`:59`), `app.block_upload_intent` (`0031:132-140`),
`app.orphan_upload_intent` (`0031:168-174`), and `expire_upload_intents`
(`0021:37-48`, which sweeps only the initial state and the three never-written
intermediates). No command can write to a row that has already left
`intent_authorized`.

All four were re-run line by line in review round 3. The first cited
`0035:237-247` until then — a range that cannot exist, since
`0035_server_facts_are_service_only.sql` is 170 lines. It was a transposition:
`0031` carries its own copy of the same guard at `:242`, and M8's two middle
citations are into `0031`, so that file's line numbering was carried onto `0035`'s
name. The claim was true and is unchanged; only the pointer was wrong. **In the
one section of this record whose entire contract is that its pointers resolve,
that is the worst available kind of error**, and it survived two prior review
rounds because a plausible-looking line range invites no more checking than the
word "zero" did.

**M9 — `apps/mobile` exists.**

```
$ git ls-files apps/mobile | wc -l
      22
$ ls apps/
app
demo
landing
mobile
$ grep -n '"name"\|"expo"' apps/mobile/package.json
2:  "name": "@aktflow/mobile",
7:    "expo": "57.0.9",

$ grep -rn "Not yet created\|does not yet physically exist" README.md docs/ --include="*.md" | grep -v docs/superpowers/
(no output — no absence claim survives)
```

**M10 — the Expo pin.**

```
$ grep -n '^  expo@57' pnpm-lock.yaml | head -2
3184:  expo@57.0.9:
8649:  expo@57.0.9(@babel/core@7.29.7)…

$ grep -rn "SDK 56" docs/ --include="*.md" | grep -v docs/superpowers/
(no output)
```

**M11 — every colour row now matches the token source.**

```
$ node -e "
const fs=require('fs');
const doc=[...fs.readFileSync('docs/05-design-system.md','utf8').matchAll(/^\| \`([a-z0-9-]+)\` \| \`(#[0-9A-Fa-f]{6})\` \|/gm)];
const gen=JSON.parse(fs.readFileSync('packages/tokens/src/tokens.json','utf8')).color;
let bad=0;
for (const [,name,hex] of doc) { const g=gen[name]?.hex; if (g && g.toLowerCase()!==hex.toLowerCase()) { console.log(name,'doc',hex,'source',g); bad++; } }
console.log('rows compared:', doc.length, '| mismatches:', bad);
"
rows compared: 12 | mismatches: 0
```

Twelve rows, zero mismatches. Before the slice the same command printed four
lines. The row count and the token names are unchanged — only four hex values
moved.

**M12 — the mobile deep-link surface.**

```
$ grep -n '"scheme"' apps/mobile/app.json
5:    "scheme": "goproceed",
$ find . -path ./node_modules -prune -o \( -iname 'assetlinks.json' -o -iname 'apple-app-site-association*' \) -print
(no output — neither coverage file exists)
$ ls apps/mobile/src/app/
_layout.tsx
index.tsx
$ grep -rn "aktflow://" docs/ --include="*.md" | grep -v "docs/superpowers/\|TODOS"
(no output)
```

**M13 — the web workspace ships two pages.**

```
$ find apps/app/app -name page.tsx
apps/app/app/(app)/context/page.tsx
apps/app/app/(auth)/login/page.tsx
$ grep -n "basePath\|rewrites" apps/app/next.config.ts
(no output)
```

Route groups `(app)` and `(auth)` do not appear in the URL, so these resolve to
`/context` and `/login` — nothing under a literal `/app` segment. The
`app/v1/**/route.ts` tree is the JSON API, not UI a notification can open.

**M14 — there is no verification job, and the receipt is the evidence row.**

```
$ grep -rn "verification job\|verification_job" apps/ packages/ supabase/
(no output — no such job exists anywhere in the tree)

$ grep -n "insert into public.evidence_objects\|set status = 'available', finalized_evidence_object_id" supabase/migrations/0035_server_facts_are_service_only.sql
98:  insert into public.evidence_objects
115:     set status = 'available', finalized_evidence_object_id = v_evidence,
```

**The same grep, over `docs/` — which is where the claim actually lived.** As
first written this command searched only the code, which proved the job does not
exist but could not find the four documents still asserting that it does. Widened:

```
$ grep -rn "verification job\|verification_job" docs/ --include="*.md" | grep -v "docs/legacy/\|docs/superpowers/"
docs/22-data-api-contract.md:103:… enqueues no verification job;
docs/22-data-api-contract.md:144:… not a separate verification job;
```

Two survivors, both of them corrected sentences that name the job in order to deny
it — the same shape as M7's expected survivor. Before round 3 this returned the
uncorrected `docs/22:103` and `:144`; `worker` phrasing at
`architecture/system-overview.md:220` and `docs/07:113-115` carried the same model
without using the word, and was found by reading the diagram, not by this grep.

`app.finalize_upload_intent` inserts the evidence row and writes the terminal
`available` in one function body — one transaction, no queue. Inspection runs
*before* either, at `finalize/route.ts:217` (`await inspectContent(…)`, see
**M3**), so the old clause also had the order backwards: it described a receipt
created first and a scan awaited afterwards.

**"Receipt" is the one word in that clause that was accurate, and it survives.**
The corpus is explicit that the evidence row *is* the receipt —
`supabase/migrations/0032_evidence_requires_bytes.sql:9` calls it "an evidence
row — a receipt, with a storage key", and
`0027_blocked_content_retention.sql:22-23` turns on the same identity: "a blocked
upload never produces a receipt — so the capturing device still holds the
original". The rewrite keeps the word and names what it is, rather than dropping
a real concept along with the two false ones beside it.

**M15 — what v0.1's inspection actually is, which is what `docs/07` now says.**

```
$ grep -n "^export const INSPECTION_POLICY_VERSION\|no anti-malware" apps/app/src/lib/evidence-inspection.ts
11:export const INSPECTION_POLICY_VERSION = "m2a-magic-bytes-1";
38: * v0.1 ships no anti-malware engine, and this does not pretend otherwise.
```

A synchronous magic-byte sniff, named by its own policy version, with the source
saying in its own comment that it is not a malware scanner. Nothing in `apps/` or
`packages/` extracts dimensions or pages or builds derivatives. That is why row 19
names those three as a later target rather than deleting them: they are real
intent, just not current behaviour.

## The settled counts, and the rule each one answers

Three prior surveys produced three different function counts. They were resolved
rather than averaged, and **the rule is recorded beside the number so the
disagreement cannot recur** — a count without its counting rule is the defect,
not the count.

| | Value | Counting rule |
|---|---|---|
| Tables | **33** | `create table` in any schema. No `drop table` and no rename exists anywhere in the chain, so created equals surviving |
| Views | **1** (`api.me_context`) | views and materialized views in any schema, exhaustive search |
| Roles | **5** | roles created by the migrations. Supabase built-ins are excluded because the provider creates them, not us |
| Functions | **27** | distinct schema-qualified name plus argument-type list, surviving all drops; includes `SECURITY DEFINER` helpers and trigger functions |

### Why 3, 24 and 43 were each a real answer — to a different question

None of the three rejected numbers was a mistake. Each answered a question nobody
wrote down next to it.

**3 was correct through migration `0005`.** It is the function count of the v0.0
origin slice, and it is exactly the three functions the old prose named:

```
$ grep -rhoiE "create[[:space:]]+(or[[:space:]]+replace[[:space:]]+)?function[[:space:]]+[a-z0-9_.]+" supabase/migrations/000[1-5]*.sql | awk '{print $NF}' | tr 'A-Z' 'a-z' | sort -u
app.current_actor
app.org_has_members
public.drain_outbox
```

The number never went stale so much as its scope went unstated. It was a true
statement about migrations `0001`-`0005` still sitting in a sentence that had come
to mean "today".

**24 is the `SECURITY DEFINER` subset.** Of the 27 distinct functions, 24 are
declared `SECURITY DEFINER` and three are not:

```
$ node -e '…split each migration on create-function, take the header before the $$ body…'
distinct functions: 27
distinct SECURITY DEFINER functions: 24
not SECURITY DEFINER: app.current_actor, app.guard_template_version, app.reject_mutation
```

A survey counting the privileged surface — a reasonable thing to count — lands on
24 and is right about that.

**43 is the statement count.** It is what you get before de-duplicating by name:

```
$ grep -rhoiE "create[[:space:]]+(or[[:space:]]+replace[[:space:]]+)?function[[:space:]]+[a-z0-9_.]+" supabase/migrations/*.sql | wc -l
      43
$ … | awk '{print $NF}' | tr 'A-Z' 'a-z' | sort -u | wc -l
      27
$ … | sort -u | grep -c '^app\.'
22
$ … | sort -u | grep -c '^public\.'
5
```

Inflated by `create or replace`; five of the forty-three statements redefine
`app.finalize_upload_intent` alone. The live catalog snapshot reads
`## functions (27)` at
`migration/goproceed-canonical-v0.1/catalog-snapshots/20260731-2102.md:2571`,
confirming the object count independently of any grep over the migration text.

**On the roles wording.** The documents said "two application roles". The
migrations create five. The correction states five and names them rather than
preserving a phrase that is only true under an unwritten convention about what
"application role" means — which is the same failure mode as an unstated counting
rule, one level up.

## Checked, and found already correct

Recorded so that nobody "fixes" these later. **Each was a hypothesis going in**,
and each was refuted by measurement. One of them — the belief that CI pinned the
whole version-baseline sentence — would have stopped the Expo correction on a
false premise.

**The Next.js and Node pins in `docs/07` are right.** Only the Expo number in that
sentence was wrong.

```
$ grep -n '"next"' apps/app/package.json apps/landing/package.json
apps/app/package.json:19:    "next": "16.2.11",
apps/landing/package.json:13:    "next": "16.2.11",
$ cat .nvmrc
24
```

**`scripts/validate_package.py` does not pin the Expo fragment.** It asserts
exactly one substring of that sentence, and Expo is not in it:

```
$ grep -n "16.2.11\|Expo SDK\|SDK 5" scripts/validate_package.py
260:require("Next.js **16.2.11 or newer security-patched 16.2.x**" in architecture_text, "docs/07: current Next.js security-patched floor missing")
```

So `SDK 56` → `57.0.9` could not red the build. The earlier belief that the whole
sentence was protected was wrong, and acting on it would have deferred a
one-word correction indefinitely.

**All eight code comments citing `docs/22` by line number still resolve. Zero
drift.**

```
$ grep -rn "22-data-api-contract.md:[0-9]" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l
       8
```

`:166` is the idempotency paragraph — `standard_30d` at `2,592,000` seconds and
`ledger_400d` at `34,560,000` — matching
`packages/database/src/idempotency.ts:7`'s
`{ standard_30d: 2_592_000, ledger_400d: 34_560_000 }` digit for digit. `:170` is
the `X-Request-Id` paragraph, cited by four of the eight.

**The `113 Pilot and 44 GA-forward` arithmetic is exact.**

```
$ grep -A1 "x-release" technical/openapi.yaml | grep -oE "(Pilot|GA)" | sort | uniq -c
  44 GA
 113 Pilot
```

113 + 44 = 157, which is the `api_operations=157` the validator reports. Only the
*authority* claim in that sentence is wrong, and it is deferred — see below.

**Eight of the twelve colour rows already matched**, including `line`, which
matches because the owner ruled on it on 2026-08-03 rather than by luck. The
slice changed four rows and only four:

```
$ git diff 70c8107..HEAD -- docs/05-design-system.md | grep -E "^[+-]\| "
-| `ink-800` | `#2A2D2F` | secondary surfaces |
+| `ink-800` | `#242424` | secondary surfaces |
-| `signal-700` | `#84A625` | accessible text/accent |
+| `signal-700` | `#667F12` | accessible text/accent |
-| `blue-500` | `#5278D8` | informational/submitted |
+| `blue-500` | `#3756a1` | informational/submitted |
-| `muted` | `#686E6A` | secondary text |
+| `muted` | `#666979` | secondary text |
```

**The shadow spec four lines below that table also already matched.**
`docs/05-design-system.md:46` reads `0 8px 30px rgba(21,23,25,.07)`;
`packages/ui/src/tokens.generated.css:17` reads
`--shadow: 0px 8px 30px 0px rgba(21, 23, 25, 0.07);`. Same geometry, same ink
base, same alpha — the difference is CSS serialisation, not value.

**`Status: Historical` being unused is not a defect.** `docs/README.md:41`
makes the marker optional: files "marked Historical **or located under
`docs/legacy`**" are non-normative, so location is an equivalent route.

**`Status: Implemented` being unused is the policy working.** `docs/README.md:56-57`
says `Approved` does not mean deployed and that implementation status belongs in
delivery evidence — and that route is populated. Both greps return nothing, which
is the intended state, not a gap.

## Three corrections that were themselves wrong

All three were caught in review and fixed in a second commit. **They are recorded
because the "correction that was itself wrong" is the most useful thing this slice
has to teach** — a gate record showing only the final state would hide the fact
that replacing a false claim is itself an opportunity to write a false claim, and
that the review round is where that gets caught rather than the implementation
round.

**1. A citation pointing at a file that said the opposite** (Task 2, fixed in
`2af1675`). The correction added, unbidden, that the new inventory was
"independently corroborated by the live `pg_catalog` snapshot in
[baseline verification]". That file states at `:41-42` that a live snapshot
"was not available" — the corroboration was attributed to the one document that
disclaims it. The snapshot is real, but it lives in
`catalog-snapshots/20260731-2102.md`, which the same report had cited correctly
one section earlier. The prose reached for the wrong path. Fixed by citing the
snapshot file with the two headings it actually contains, and demoting
`baseline-verification.md` to a separate clause about known gaps. See **M5**.

**2. A state name from the same dead vocabulary left standing** (Task 3, fixed in
`6524193`). The `sealed` → `available` substitution at
`docs/23-offline-media-protocol.md:71` left "an expired/**cancelled**/available
intent cannot be reused". `cancelled` is not a permitted value either — and it
traces to the *identical* CHECK constraint at `technical/schema.sql:726` that
sources `sealed` and `authorized`. It survived because the measurement grep keyed
on the word "sealed", so it searched for a symptom rather than for the vocabulary.
It is the fourth member of this task's own dead vocabulary, not a later slice's
defect. Fixed by naming the four real terminal values, after verifying they are
genuinely terminal — see **M8**.

**3. A false claim replaced by a differently false one** (Task 4, fixed in
`92bb446`). The first correction at `docs/04-screen-specification.md:421` said
deep links are "live for the web `/app/...` routes today", distinguishing the web
surface from the unbuilt mobile one. The web surface has no such routes either:
`apps/app/app` holds exactly two `page.tsx`, resolving to `/login` and `/context`,
with no `basePath` and no rewrites. The correction had assumed a `/app/...` URL
space from the directory name `apps/app`. Fixed to name both surfaces as v0.1
targets and state what the web workspace actually ships. See **M13**.

The pattern across all three: the correction went one clause beyond what had been
measured. Two of the three added a claim the brief never asked for.

## One correction that no task's grep could have found

Correction 17 was found by the gate pass, not by any of the four tasks — and the
reason is worth more than the correction. **Both greps that should have caught it
were correctly scoped, and it fell exactly between them.**

- **Task 1** owned the claim. Its verification grep ran over
  `docs/architecture/`, `docs/domain/` and `technical/states/` — the structured
  layer, where its twelve edit sites were. It never looked at the numbered layer,
  so it could not see `docs/23`.
- **Task 3** owned the line. It edited this exact sentence, and its brief scoped
  it to "state names only" — the right scope for a vocabulary task, and one that
  reads straight past a clause containing no state name at all.

Neither was careless. The gap is structural: **the slice was organised by claim,
and verified by claim, but a single sentence can carry two claims belonging to
two different tasks.** Task 3's edit gave the first half of that sentence this
slice's authority while the second half went on asserting a background job and a
wait that do not exist — leaving it, as of `92bb446`, in a worse state than it was
found in, because a reader now had this slice's word for half of it.

What caught it was re-running Task 1's *subject* against the whole corpus instead
of Task 1's *file list*, while writing this record. The cheap generalisation for
next time: when a task corrects a claim, grep the claim across the entire live
corpus, not across the files that task was assigned.

**Then that generalisation caught four more — including one six lines from an edit
Task 1 made.** The whole-branch review found the same async model still asserted at
`architecture/system-overview.md:220` (rows 18), `docs/07:113-115` (19) and
`docs/22:103,:144` (20, 21). The first sits inside the diagram directly above the
paragraph Task 1 rewrote: Task 1 corrected the prose beneath a diagram and left the
diagram itself standing, so one file answered "does a worker verify the bytes?"
both ways at once.

**And the lesson had to be applied twice, because the first application was too
narrow.** M14's grep ran `verification job` over `apps/ packages/ supabase/` — the
code, proving the job does not exist — but not over `docs/`, which is where the
false claim lived. Grepping the corpus is not enough if you grep it for the wrong
half of the sentence. Two of the four sites did not contain the phrase at all;
they said "worker", and were found only by reading a diagram. **A word-level grep
finds a word; only reading finds a model.**

## What this slice did not close

**The OpenAPI allowlist correction is deferred to slice 1.** The owner ruled that
`technical/openapi/scope-v0.1.csv` (51 operations) is the v0.1 contract, which
makes `docs/22-data-api-contract.md:130` wrong to call `technical/openapi.yaml`
v2.9 "the exact allowlist". That sentence cannot be touched here, because CI reads
it:

```
$ sed -n '1718,1721p' scripts/validate_package.py
count_statement = re.search(r"exact allowlist:\s*(\d+) Pilot and (\d+) GA-forward", (DOCS / "22-data-api-contract.md").read_text(encoding="utf-8"))
require(count_statement is not None, "docs/22: exact OpenAPI release count statement missing")
if count_statement:
    require((release_counts["Pilot"], release_counts["GA"]) == tuple(map(int, count_statement.groups())), "docs/22: OpenAPI Pilot/GA operation counts are stale")
```

The validator regexes the Pilot/GA counts straight out of that prose and compares
them to `openapi.yaml`. Rewriting the sentence reds the build, and this slice's
constraint is zero CI changes. The owner has separately ruled that
`validate_package.py` is being retired, so the correction lands in slice 1 — in
the same commit that removes the validator and wires
`pnpm validate:canonical-docs` into CI, so the build is never red and never
without a documentation gate.

**`docs/22-data-api-contract.md` is edited by this slice after all — but not
there.** Round 3 corrected `:103` and `:144`, which asserted an enqueued
verification job (corrections 20 and 21). Editing the file at all was verified
safe first: `validate_package.py` reads it at `:250` and `:1718` only, asserting
one billing-authority string and the Pilot/GA allowlist regex, neither of which
reaches `:103` or `:144`. The validator's own "verification job receipt" wording
at `:1635` is an error-message string for an `openapi.yaml` `$ref` assertion, not
a documentation assertion.

**The allowlist sentence at `:130` is untouched and stays that way.** It is the
one sentence in this file that CI reads, and correcting it is slice 1's job, in
the commit that retires the validator. An earlier draft of this record said the
file "has no diff in this slice", which was true when written and false once
round 3 landed — recorded here rather than silently amended, since it is the
fourth instance of the same lesson.

**Review dates were not bulk-stamped, because that would assert a review that did
not happen.** Nine files moved to `2026-08-03` — exactly the files this slice
actually corrected and which carry the field — and seventeen still read
`2026-07-30`:

```
$ … first "Last reviewed:" line per file, docs/ + README.md, excluding legacy and superpowers …
2026-07-30  ×17   (4 ADRs, 3 delivery, 2 discovery, 4 domain, 4 product)
2026-08-03  ×9    README.md, docs/README.md, architecture/{data-model,files-and-storage,
                  jobs-events-and-audit,system-overview,tenancy-and-security}.md,
                  delivery/version-0.0.md, domain/execution-and-evidence.md
```

The six numbered documents this slice edited — `04`, `05`, `07`, `20`, `23`, `27`
— carry no `Last reviewed:` field at all (`grep -c` returns `0` for each); they
sit outside `validate-canonical-docs.mjs`'s `METADATA_DOCS` set, so there was
nothing to stamp. A file's date moves when someone actually reviews it.

**The `sealed` vocabulary survives under `technical/`, in files that are
cross-validated against each other.**

```
$ grep -rln "sealed" technical/ | sort
technical/data-access-surface.csv
technical/events.csv
technical/openapi.yaml
technical/schema.sql
technical/state-catalog.csv
technical/state-transitions.csv
technical/test-catalog.csv
technical/ui-actions.csv
```

**Eight files, not seven — and the counting rule matters.** The design document
says seven, and seven is right under the rule "files other than
`technical/schema.sql`, which is the vocabulary's source rather than a consumer of
it". The total including the source is eight. Both numbers are stated here
because a bare count with an unstated rule is precisely the defect this slice
spent its Task 2 correcting, and repeating it in the record that closes the slice
would be a poor joke. All eight carry `sealed` in the dead upload-intent sense
(`technical/openapi.yaml` and `technical/schema.sql` also carry the derived
`sealedAt`/`sealed_at` field names).

These are not stragglers that a grep missed. `scripts/validate_package.py`
references every one of them — `state-transitions.csv` 31 times, `schema.sql` 37,
`openapi.yaml` 137 — and cross-checks them against each other. Correcting one
without the others reds the build; correcting all eight is a coordinated change to
the pre-implementation design layer that this slice's constraints put out of
scope. It is a known open item, not an oversight.

**Nothing moved, so the numbered layer is still in the reader's path.** Thirty-five
numbered documents remain at `docs/` root; six sit under `docs/legacy/`, moved
there on 2026-07-30 — 41 in total. The approved disposition for all 41 already
exists in
`migration/goproceed-canonical-v0.1/document-disposition.csv`, outside `docs/`.
`docs/README.md`'s precedence rule demotes only files marked Historical or located
under `docs/legacy`, so the 35 at root are neither demoted nor promoted — a reader
still meets them with nothing telling them which layer wins. That is the whole
reason this slice ran first: **archiving before correcting would have produced one
tidy layer that still lied**, with every supersession banner pointing a reader at
a document saying the mobile app does not exist. Correction came first. The moves
are slice 1's.

**`docs/09-security-compliance.md:139` keeps the word "seal", deliberately.** The
sentence is "A signed offline lease proves bounded authority, not the time unseen
bytes were created. Only server receipt/seal establishes trusted chronology." It
was reviewed as a possible survivor of the dead vocabulary and **left standing**.

Three reasons, in order of weight. **Its predicate is about time, not state.** The
claim is *who establishes trusted chronology* — the client's signed lease cannot,
the server's own act of recording can. That is a general security principle about
time authority, and it stays true whatever the upload state machine is called.
Compare the sentence Task 3 *did* correct, `docs/20-flow-catalog.md:60`: "only an
object durably received and server-sealed before invalidation may finish the
normal scan/review path". That predicate — eligibility to continue down a path —
is a state-machine consequence, so the state name mattered there and was
corrected. Here nothing turns on which value the row holds.

**Its section is scoped to a different version.** The bullet sits under
`## 12. v2.9 temporal and offboarding controls`, so it is not a claim about v0.1's
shipped machine at all.

**And "seal" is ordinary security English.** As a verb it means to make final and
tamper-evident; it is not a reference to `upload_intents.state = 'sealed'`, which
was a value in the superseded `technical/schema.sql`. "Receipt", its partner in
that phrase, is a real and current concept (see **M14**).

The counter-argument is recorded rather than dismissed: the word is a residue of
the dead vocabulary, it sits beside a word this slice spent effort establishing as
real, and a reader arriving from `docs/23:36`'s note could reasonably pause on it.
If a later slice rules that the whole word family should go, this is the site to
change, and **M7**'s widened grep is the command that finds it.

**Quarantine and scanning survive in the v2.9 target layer, and were left there.**
The final re-review swept the live corpus for the async model beyond the four
sites round 3 corrected, and found none as a v0.1 status claim — but it did find
target-layer material that names quarantine or scanning without naming a worker or
a verification job: `docs/35:117` ("quarantined until server-side type/size/malware
checks pass"), `docs/18:99` (a `scanning` state in a capture-session machine that
has no table in any migration), and passing mentions at `docs/05:97`,
`docs/09:21` and `docs/25:34`. None is a statement about what v0.1 does today,
which is this slice's contract, so none was touched. They belong to whichever
slice rules on the v2.9 target layer as a whole.

This is also why the commit table for `917d336` says "the four v0.1 status claims
still carrying the superseded async model" rather than "the last four sites". An
earlier wording said the latter, which the sweep disproved — the fifth instance of
this record's own lesson, and the reason the qualifier is now in the sentence.

**Two gates are unproven and stay unproven.** `pnpm typecheck` and
`pnpm turbo run test --concurrency=1 --force` both stop on a declared dependency
missing from a `node_modules` built by an older pnpm, which pnpm will only
reconcile by purging and rebuilding all 11 workspace projects. That repair is the
owner's call, not a documentation slice's, so it was not attempted. Closing them
takes a full `pnpm install` accepting the modules purge, then a re-run of both —
see the Evidence section, which records what is unproven, why, and what would
prove it. This record does not predict their result.

## Commits

`git log --oneline 70c8107..HEAD | wc -l` and the row count of the table below are
the same number by construction. **As of this commit, 16.** Two set the slice up;
**eight** are the corrections — four task commits, three review fixes (one each
for Tasks 2, 3 and 4), and round 3's four-document fix; and six are this record.
2 + 8 + 6 = 16.

**This number cannot be written without predicting it.** It counts the commit that
writes it, so the value stated must be the post-commit one — get it from
`git log … | wc -l` *before* committing and add one. Two earlier drafts got this
wrong by pasting the pre-commit count, which is the same self-referential trap
that made the pasted `--stat` go stale and that put `docs/22` in the file list
after round 3 corrected it. Whoever revises this next updates the table and this
sentence in the same commit, or the two stop agreeing:

| Commit | What |
|---|---|
| `8bb29a7` | design — not a correction |
| `d22ddb2` | plan — not a correction |
| `0b19ad7` | the upload state machine (Task 1), 7 files |
| `3ffa97e` | the baseline inventory (Task 2), 4 files |
| `2af1675` | Task 2 fix round 1 — cite the right snapshot, scope the gate's own drift |
| `a3283e6` | the `sealed` vocabulary (Task 3), 3 files |
| `6524193` | Task 3 fix round 1 — `cancelled` is the fourth member of the dead vocabulary |
| `c0da6b9` | four claims a reader could disprove in a minute (Task 4), 5 files |
| `92bb446` | Task 4 fix round 1 — the web workspace has no `/app/...` UI routes either |
| `0231e8c` | this record, as first issued |
| `c64c8c5` | correction 17 (`docs/23:36`), its table row and its lesson; the two unproven gates reworded from FAILED to NOT PROVEN once the attempted install turned out to have installed nothing |
| `802d029` | review round 2, on the record itself — four of its own claims did not reproduce |
| `917d336` | review round 3 — corrections 18-21, the four v0.1 status claims still carrying the superseded async model, plus M8's broken pointer, M7's overclaiming heading and M14's too-narrow grep |
| `fd4a788` | the counts `917d336` moved: correcting `docs/22` added it to the slice diff, falsifying the record's file tally, its pasted file list, and its "`docs/22` has no diff in this slice" |
| `814475c` | the commit count `fd4a788` moved, and its row |
| *(this commit)* | the final re-review's one residual: "the last four sites" was an overclaim the sweep disproved, so the qualifier moved into the sentence and the v2.9 target layer it found is now named under "What this slice did not close" |

Task 1 was approved without a fix round. Its reviewer independently re-derived the
four transitions from migrations `0031`/`0035`/`0021` rather than accepting the
implementer's census.

Two implementers found sites their briefs had missed and disclosed them rather
than quietly widening scope: Task 3 found a fifth site (`docs/23:34`, bare
`authorized`) that the `sealed` grep could not have surfaced, and Task 1 corrected
a "Staged bytes become `orphaned_for_purge`" rule that the brief's line list did
not name.

### Review round 2, on this record

The record was reviewed by **running it** — the treatment it asks for — and four
of its own claims did not survive that. All four were in the record, none in the
corrected documents:

- Row 2's "It said" column claimed the transition catalog had **zero** rows for
  the four transitions that fire. One was already present and correct. Corrected
  above, with the base-versus-HEAD commands that settle it.
- The opening pasted `git diff --stat` no longer reproduced: it showed
  `1736 insertions(+)` while HEAD gave `1871`, because the previous commit grew
  this file by 135 lines. Replaced with the file-type tally, which does not
  count its own lines.
- The commit count read "ten" against a table of eleven rows, and its breakdown
  named seven corrections while saying six.
- `grep -rln "sealed" technical/` was pasted with sorted output but without the
  `| sort` that produces it — the raw order is not stable.

Rows 5 and 16 were also flagged: their "It said" text is mid-slice, so
`git show 70c8107:<path>` misses it. Both now name the commit the text entered at.

A record whose commands do not reproduce fails at the one job it has, so these are
listed rather than quietly amended — and the first of them is the third instance
of this slice's own thesis, recorded as such beside **M2**.

### Review round 3, on the whole branch

Zero Critical, two Important. The review re-ran twelve measuring commands and
every self-referential claim in the record, and those reproduced. What it found:

- **Four more documents still carried the superseded async upload model** —
  corrections 18-21. One of them, `architecture/system-overview.md:220`, is inside
  the diagram immediately above a paragraph Task 1 rewrote. Recorded above under
  "One correction that no task's grep could have found", which is where the reason
  they survived belongs.
- **M8 cited `app.finalize_upload_intent` at `0035:237-247`, in a 170-line file.**
  A transposition from `0031`, which carries the same guard at `:242`. Fixed to
  `0035:54-63`; all four of M8's citations were then re-run line by line. In the
  one section whose contract is that pointers resolve, a plausible-looking range
  invites no checking — the same failure mode as "zero".
- **M7's heading claimed more than its command measured.** "`sealed` is gone from
  the live documentation" was true of the noun and false of the verb. Heading and
  command both narrowed to what is actually true and actually measured.
- **M14's grep searched the code but not `docs/`** — proving the job does not
  exist while missing the documents asserting it does. Widened.
- **M15 was written with a command that did not reproduce**, caught before commit:
  the pasted output showed two lines where the command printed five. Anchored to
  `^export const` so it prints what is shown.

`docs/09-security-compliance.md:139` was ruled a keep, with reasons, under "What
this slice did not close".
