# Documentation slice 0 — make the canon true — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every documented claim about the shipped system agree with the
shipped system, in place, so that a later slice can archive files without
pointing readers at documents that are wrong.

**Architecture:** Eight measured corrections, grouped into four tasks by blast
radius and by what a reviewer could reject independently, plus a gate record.
Each correction is verified by running a measurement command before and after —
the bar is not "the tests pass" (they pass today over every one of these false
claims) but "the document now says what the command reports".

**Tech Stack:** Markdown, CSV catalogs, `grep`/`git grep`, Node 24, pnpm 9,
turbo, Vitest.

## Global Constraints

- **Branch:** `claude/docs-slice0-truth`, from `main` @ `70c8107`. Do not rebase.
- **Zero file moves.** No `git mv`, no archiving, no new files except the gate
  record. This slice changes only what documents say.
- **Zero CI changes.** Do not edit `.github/workflows/`, `Makefile`,
  `scripts/validate_package.py` or `scripts/validate-canonical-docs.mjs`.
- **Do not edit point-in-time records.** Everything under `docs/superpowers/`
  (plans, specs, evidence) is a record of what was believed on its date and is
  correct as a record. The same applies to
  `migration/goproceed-canonical-v0.1/baseline-verification.md`, which pins its
  own base commit.
- **Do not edit anything under `docs/legacy/`.** It is non-normative by location
  per `docs/README.md:41`.
- **Do not touch `Last reviewed:` dates** except on files this slice actually
  corrects, and then only in the task that corrects them.
- **CI-protected strings must not change.** Full list in "What must not be
  touched" below. Editing any of them fails the package validator.
- **Run `python3 scripts/validate_package.py`, NOT `make validate`.** `make
  validate` also runs `validate-prototype`, which shells out to `eslint` and
  fails with `eslint: command not found` in a checkout where `prototype/`'s
  dependencies are not installed. That failure is unrelated to documentation and
  would block you on the first step. Baseline confirmed 2026-08-03: the package
  validator alone exits 0 with `PASS (required_artifacts=69, documents=35, …)`.
- **CSV column width is validated.** `technical/states/*.csv` are checked for
  constant column count by `scripts/validate-canonical-docs.mjs:82-87`. Those
  files use **semicolons, never commas**, inside free-text fields. A bare comma
  in a description widens the row and fails the validator.

## What must not be touched

Each is asserted literally by `scripts/validate_package.py`, which runs in CI via
`Makefile:6` → `.github/workflows/ci.yml` job `package-validate`. Invoke it
directly rather than through `make validate` — see Global Constraints.

| Protected string | Where | Assertion |
|---|---|---|
| `exact allowlist: 113 Pilot and 44 GA-forward` | `docs/22-data-api-contract.md:130` | `validate_package.py:1718-1721` regexes the two numbers and compares to `technical/openapi.yaml` |
| `Tenant bearer tokens and tenant permissions never authorize these operations` | `docs/22-data-api-contract.md:172` | `validate_package.py:259` |
| `Next.js **16.2.11 or newer security-patched 16.2.x**` (exact, asterisks included) | `docs/07-technical-architecture.md:20` | `validate_package.py:260`. The `Expo SDK 56` and `Node.js 24 LTS` words in the same sentence are **not** asserted — correcting Expo is safe. |
| `MFA обязательно для каждого пользователя с live Pilot data` | `docs/01-prd.md` | `validate_package.py:255` |
| `Project archive is immutable and terminal`, `There is no in-place restore` | `docs/01-prd.md` | `validate_package.py:256` |
| `Evidence has no generic delete action`; the string `soft-deleted` must stay ABSENT | `docs/01-prd.md` | `validate_package.py:257` |
| `GA-forward assignment grouping only` | `docs/19-organizations-roles-access.md` | `validate_package.py:258` |
| `Safe first live Pilot (months 5–9)`, `Safe standalone GA (months 10–18+)` | `docs/12-roadmap-delivery.md` | `validate_package.py:261` |
| Exactly `### S01`…`### S42` headings | `docs/04-screen-specification.md` | `validate_package.py:751-753`. Body text is free to edit; do not add, remove or renumber a heading. |
| Exactly `## N. F01`…`F22` headings | `docs/20-flow-catalog.md` | `validate_package.py:752` |
| Cross-file value integrity among top-level `technical/*.csv` | `technical/state-catalog.csv`, `state-transitions.csv`, `error-catalog.csv` | `validate_package.py:353-368`. **The flat `technical/state-catalog.csv` is a different file from `technical/states/state-catalog.csv`.** This slice edits only the latter. |
| Exactly 12 rows in the colour table, and every documented name present in the token source | `docs/05-design-system.md` | `packages/testing/src/token-fidelity.test.ts:86-90`. Hex values are free to edit; row count, names and order-independence are asserted. |

## File Structure

| File | What changes |
|---|---|
| `technical/states/transition-catalog.csv` | Rows for transitions that never fire are marked reserved; the four shipped transitions are added |
| `technical/states/state-catalog.csv` | Three intermediate states gain a reserved-for-v0.3 note in their description |
| `docs/architecture/files-and-storage.md` | The upload chain diagram and its operating rules restate the shipped machine |
| `docs/domain/execution-and-evidence.md` | Same, plus the orphaning path and the `integrity_verified` recording claim |
| `docs/architecture/jobs-events-and-audit.md`, `tenancy-and-security.md`, `system-overview.md` | Present-tense uses of the intermediate states |
| `docs/README.md`, `README.md`, `docs/architecture/data-model.md`, `docs/architecture/tenancy-and-security.md`, `docs/delivery/version-0.0.md` | The baseline inventory counts |
| `docs/23-offline-media-protocol.md`, `docs/20-flow-catalog.md`, `docs/27-qa-traceability.md` | The `authorized → sealed` vocabulary |
| `docs/architecture/system-overview.md`, `README.md` | `apps/mobile` existence |
| `docs/07-technical-architecture.md` | Expo SDK number |
| `docs/05-design-system.md` | Four colour hex values |
| `docs/04-screen-specification.md` | The deep-link line |
| `docs/superpowers/plans/evidence/2026-08-03-docs-slice0-gate.md` | New. The gate record. |

---

### Task 1: The upload state machine

The largest correction. `public.upload_intents.status` permits eight values and
four are ever written; the catalog describes a five-state chain and contains no
row for any transition that actually happens.

**Files:**
- Modify: `technical/states/transition-catalog.csv`
- Modify: `technical/states/state-catalog.csv`
- Modify: `docs/architecture/files-and-storage.md`
- Modify: `docs/domain/execution-and-evidence.md`
- Modify: `docs/architecture/jobs-events-and-audit.md`
- Modify: `docs/architecture/tenancy-and-security.md`
- Modify: `docs/architecture/system-overview.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the phrasing convention every later task reuses for a
  reserved-not-shipped value — see Step 3.

- [ ] **Step 1: Measure, and record the output**

Run each and paste the output into your report. These are the evidence the
corrections rest on, and a reviewer will re-run them.

```bash
cd /Users/akisliy/Downloads/GoProceed
echo "--- every status write in the migration chain ---"
grep -rhoE "set status = '[a-z_]+'" supabase/migrations/*.sql | sort | uniq -c
echo "--- are the intermediate values ever written? ---"
grep -rn "= 'staged'\|= 'integrity_verified'\|= 'scan_pending'" supabase/migrations/ apps/ packages/ 2>/dev/null | grep -v node_modules || echo "NONE — confirmed"
echo "--- the permitted vocabulary ---"
sed -n '266,268p' supabase/migrations/0015_execution_evidence_module.sql
```

Expected: writes are `available` ×6, `orphaned_for_purge` ×6, `scan_blocked` ×2,
`expired` ×2, plus one `accepted` that targets `public.invitations` and is not a
counter-example. The intermediate search returns nothing.

- [ ] **Step 2: Read the ruling that already exists**

Read `apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts:76-85`. It
states the shipped reachable states and says the intermediate values "stay in the
enum for the resumable protocol in v0.3". Your corrections record that horizon;
they do not delete the values.

Then read `technical/copy-catalog.csv:55-58`. It is the only artifact in the
repository already reconciled against the shipped vocabulary, and its wording is
the template: a free-text note saying the value is not written in v0.1-M2-A and
is reserved for the resumable protocol in v0.3, with a pointer to migration
`0015`.

- [ ] **Step 3: Fix the transition catalog**

`technical/states/transition-catalog.csv` has six columns. Free-text fields use
**semicolons, never commas** — a comma widens the row and fails
`scripts/validate-canonical-docs.mjs:82-87`.

Two changes:

**(a)** Rows at `:27-34` describe transitions through `staged`,
`integrity_verified` and `scan_pending`. Append to each row's `guard_or_rule`
field, after a semicolon:

```
reserved for the v0.3 resumable protocol; not written in v0.1 (supabase/migrations/0015 permits the value; no code writes it)
```

**(b)** The catalog has no row for any transition that actually fires. Add four,
matching the file's existing column order and using semicolons in free text:

- `intent_authorized` → `available` — guard: finalize verifies content identity against the authorized hash and size; the object exists in the bucket at that size; authorization is rechecked inside the row lock; evidence row and receipt commit atomically (INV-047)
- `intent_authorized` → `scan_blocked` — guard: content inspection rejects the bytes; no evidence row is ever created (INV-046); blocked_at starts the retention window
- `intent_authorized` → `orphaned_for_purge` — guard: authorization was revoked while bytes were in flight; the bytes are marked for purge and the local original is retained (INV-013)
- `intent_authorized` → `expired` — **already present at `:35`. Verify it is correct and leave it.**

- [ ] **Step 4: Fix the state catalog**

In `technical/states/state-catalog.csv`, the rows for `staged`,
`integrity_verified` and `scan_pending` (around `:31-33`) get the same reserved
note appended to their `description` field, after a semicolon. Same comma rule.

- [ ] **Step 5: Verify the catalogs still validate**

```bash
node scripts/validate-canonical-docs.mjs
```
Expected: `canonical documentation: OK`. If it fails on column width, you used a
comma inside a free-text field.

- [ ] **Step 6: Fix the prose and the diagrams**

Each of these states the intermediate values as current behaviour. Rewrite each
to state the shipped four-transition machine, and where the intermediate values
are mentioned, say they exist in the enum and are reserved for the v0.3 resumable
protocol.

- `docs/architecture/files-and-storage.md:192-201` — the chain diagram. Replace
  with `intent_authorized → available | scan_blocked | orphaned_for_purge |
  expired`.
- `docs/architecture/files-and-storage.md:207-211` — rules 1–3 state the
  intermediate values as operating semantics; restate as reserved.
- `docs/architecture/files-and-storage.md:252`, `:272`, `:408` — further
  present-tense uses.
- `docs/domain/execution-and-evidence.md:236` — says the server "records
  `integrity_verified`". It does verify size and hash
  (`apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts:181-215`) but
  records nothing for it; the result is consumed in-transaction and only the
  terminal state is written. Say that.
- `docs/domain/execution-and-evidence.md:247-249` — the diagram, including the
  orphaning arrow drawn from `staged/integrity_verified`. The shipped orphaning
  path is `intent_authorized → orphaned_for_purge`, pinned to that from-state in
  both commands (`supabase/migrations/0031:169-173` and `0035:59-73`).
- `docs/domain/execution-and-evidence.md:255` — prose.
- `docs/architecture/jobs-events-and-audit.md:319`,
  `docs/architecture/tenancy-and-security.md:227`,
  `docs/architecture/system-overview.md:225` — present-tense uses.

Do **not** edit `technical/database/schema-v0.1.sql`. It is the
pre-implementation design layer, not a claim about the running system.

- [ ] **Step 7: Verify no present-tense claim survives**

```bash
grep -rn "staged\|integrity_verified\|scan_pending" docs/architecture/ docs/domain/ technical/states/
```
Read every hit. Each must now either be absent, or be explicitly marked reserved
for v0.3. Paste the output into your report with a one-line verdict per hit —
this is the check that the correction is complete rather than partial.

- [ ] **Step 8: Update the review dates on the files you corrected**

For each file you edited under `docs/`, set its `**Last reviewed:**` line to
`2026-08-03`. Only those files. Do not touch any other file's date.

- [ ] **Step 9: Run the gates and commit**

```bash
node scripts/validate-canonical-docs.mjs
python3 scripts/validate_package.py
```
Both must pass. The second must end `AktFlow package validation: PASS`. Then:

```bash
git add technical/states/ docs/architecture/ docs/domain/
git commit -m "docs: the upload machine has four transitions, not eight

public.upload_intents.status permits eight values and four are ever written.
Every write in all 35 migrations resolves to available, orphaned_for_purge,
scan_blocked or expired; the initial value is the column default. The three
intermediate values appear only in the CHECK constraint, two comments, an index
predicate and two purge predicates that can never match.

The transition catalog described a five-state chain and carried no row for any
transition that actually fires. It now carries all four, and the reserved values
say so in their own text rather than reading as current behaviour — the wording
follows technical/copy-catalog.csv, which was already reconciled against the
shipped vocabulary and needed no change.

The orphaning arrow was drawn from two unwritable from-states, so as documented
it could never fire. The shipped path is intent_authorized -> orphaned_for_purge,
pinned to that from-state in both commands."
```

---

### Task 2: The baseline inventory

"Six tables, one API view, three functions, and two application roles" is
repeated across the corpus. One of those four numbers is right.

**Files:**
- Modify: `docs/README.md`, `README.md`
- Modify: `docs/architecture/data-model.md`
- Modify: `docs/architecture/tenancy-and-security.md`
- Modify: `docs/delivery/version-0.0.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the settled counts, which Task 5's gate record cites.

- [ ] **Step 1: Measure, and record every command's output**

```bash
cd /Users/akisliy/Downloads/GoProceed
echo "--- migration files ---";  ls -1 supabase/migrations/*.sql | wc -l
echo "--- tables ---";           grep -rhoiE "^[[:space:]]*create table (if not exists )?[a-z0-9_.]+" supabase/migrations/*.sql | wc -l
echo "--- destructive ops (must be zero) ---"
grep -rciE "drop[[:space:]]+table|alter[[:space:]]+table[^;]*rename[[:space:]]+to|drop[[:space:]]+view|drop[[:space:]]+role" supabase/migrations/*.sql | grep -v ':0' || echo "none"
echo "--- views ---";            grep -rniE "create[[:space:]]+(or[[:space:]]+replace[[:space:]]+)?(materialized[[:space:]]+)?view" supabase/migrations/*.sql
echo "--- roles ---";            grep -rniE "create[[:space:]]+role" supabase/migrations/*.sql
echo "--- committed catalog snapshot ---"
grep -nE "^## (tables|functions|roles) " migration/goproceed-canonical-v0.1/catalog-snapshots/20260731-2102.md
```

Expected: 35 migrations, 33 tables, no destructive operations, 1 view
(`api.me_context` at `0004_rls_policies.sql:42`), 5 roles. The snapshot reads
`## tables (33)` and `## functions (27)`, independently confirming two of the
numbers from a live `pg_catalog` dump committed on 2026-07-31 — one day after
the documents' review date.

**The function count is 27** and the counting rule is: distinct schema-qualified
name plus argument-type list, surviving all drops, including `SECURITY DEFINER`
helpers and trigger functions. Three earlier surveys produced 3, 24 and 43. Each
was a real fact about a different question — 24 is the `SECURITY DEFINER` subset,
3 was correct through migration `0005`, 43 is the statement count inflated by
five successive redefinitions of `app.finalize_upload_intent`. **Write the
counting rule into the documents beside the number**, so the ambiguity that
produced three answers cannot recur.

- [ ] **Step 2: Correct the counts**

| File:line | Now | Must say |
|---|---|---|
| `docs/README.md:111-112` | "contains six tables, one API view, three functions, and two application roles" | 33 tables, one API view (`api.me_context`), 27 functions, five database roles, defined by 35 migrations through `0035`. Keep the view count — it is correct. |
| `README.md:21-24` | "**The runtime today is a six-table foundation** (…) plus one API view, three functions, and two application roles" | Same numbers. The six named tables may stay if reframed as the v0.0 origin slice. |
| `docs/architecture/data-model.md:26` | heading "### Migration-derived six-table baseline" | Retitle to name the origin slice it describes. |
| `docs/architecture/data-model.md:28` | "The current migration chain creates **exactly six** application tables:" | The six-row table at `:30-37` is accurate for migrations `0001`–`0002`; scope the sentence to that and state the current total of 33. |
| `docs/architecture/data-model.md:39-41` | "functions `app.current_actor`, `app.org_has_members`, and `public.drain_outbox`; two legacy-named application roles" | 27 functions (22 in `app`, 5 in `public`); five roles — `aktflow_app`, `aktflow_app_login` (`0003:8,11`), `aktflow_worker` (`0008:35`), `aktflow_service`, `aktflow_service_login` (`0034:25,28`). |
| `docs/architecture/data-model.md:410` | "The six-table baseline is hardened and evolved additively:" | Rescope to the origin slice. |
| `docs/architecture/tenancy-and-security.md:30-32` | "The current runtime represented by migrations contains six tables: …" | 33; the six named are the v0.0 origin slice. |
| `docs/delivery/version-0.0.md:15` | "the existing six-table foundation is safe to…" | This is a v0.0 delivery document and the sentence is correct in its own tense. Edit **only** if it reads as a claim about the present runtime; if it reads as historical, leave it and say so in your report. |

Do **not** edit `docs/decisions/ADR-001-product-boundary.md:18`. An ADR records
the context in which a decision was made; renumbering it rewrites history. Add
nothing there.

Do **not** edit `migration/goproceed-canonical-v0.1/baseline-verification.md`.
It pins its own base commit at `:12-15` and is an archival record.

- [ ] **Step 3: Verify**

```bash
grep -rn "six[- ]table\|six tables\|three functions\|two application roles" docs/ README.md --include=*.md | grep -v "docs/superpowers/\|docs/legacy/"
```
Every surviving hit must be scoped to v0.0 or to an ADR's decision context. Paste
the output with a one-line verdict per hit.

- [ ] **Step 4: Update review dates and commit**

Set `**Last reviewed:** 2026-08-03` on the `docs/` files you edited. Then:

```bash
node scripts/validate-canonical-docs.mjs && python3 scripts/validate_package.py
git add docs/README.md README.md docs/architecture/ docs/delivery/
git commit -m "docs: the baseline is 33 tables, not six

The inventory sentence was repeated across the corpus and one of its four
numbers was right. Measured: 35 migrations, 33 tables, 1 view, 27 functions,
5 roles. No drop table, no rename, no drop view, no drop role anywhere in the
chain, so created equals surviving.

The counting rule is now written beside the function count, because its absence
is what produced three different answers in three surveys: 24 is the SECURITY
DEFINER subset, 3 was correct through migration 0005, and 43 is the statement
count inflated by five redefinitions of one function.

No new measurement was needed to catch this. A live pg_catalog dump committed on
2026-07-31 reads 'tables (33)' and 'functions (27)', one day after the review
date on the documents that said six and three."
```

---

### Task 3: The `authorized → sealed` vocabulary

A second, mutually incompatible state vocabulary, inherited from the superseded
`technical/schema.sql`.

**Files:**
- Modify: `docs/23-offline-media-protocol.md`
- Modify: `docs/20-flow-catalog.md`
- Modify: `docs/27-qa-traceability.md`

**Interfaces:**
- Consumes: the reserved-value phrasing convention from Task 1 Step 3.
- Produces: nothing.

- [ ] **Step 1: Measure**

```bash
cd /Users/akisliy/Downloads/GoProceed
echo "--- is 'sealed' a permitted status? ---"
sed -n '266,268p' supabase/migrations/0015_execution_evidence_module.sql
echo "--- does any migration alter that constraint later? ---"
grep -rn "upload_intents" supabase/migrations/00[1-3]*.sql | grep -i "alter\|check" | head
echo "--- where does 'sealed' appear in live docs? ---"
grep -rn "sealed" docs/ --include=*.md | grep -v "docs/legacy/\|docs/superpowers/"
```

Expected: the CHECK lists eight values, none of them `sealed` or `authorized`;
no later migration alters it; four live documentation hits.

- [ ] **Step 2: Correct the four sites**

The state meaning "completion succeeded" is `available`, written by
`app.finalize_upload_intent`
(`supabase/migrations/0035_server_facts_are_service_only.sql:114-115`).

- `docs/23-offline-media-protocol.md:36` — "transitions `authorized → sealed`"
  becomes `intent_authorized → available`, and note there is no `sealed` state.
- `docs/23-offline-media-protocol.md:71` — same vocabulary, same fix.
- `docs/20-flow-catalog.md:60` — `sealed` → `available`. **Do not touch the
  `## N. FNN` heading on that line or nearby**; `validate_package.py:752`
  asserts the heading set exactly.
- `docs/27-qa-traceability.md:172` — `sealed` → `available`.

Do **not** edit any file under `technical/` for this correction. The flat
`technical/state-catalog.csv`, `state-transitions.csv`, `openapi.yaml`,
`ui-actions.csv`, `events.csv`, `data-access-surface.csv` and `test-catalog.csv`
carry `sealed` and are cross-validated by `validate_package.py:353-368`; changing
one value there reds the build. Those files are slice 6's problem.

- [ ] **Step 3: Verify and commit**

```bash
grep -rn "sealed" docs/ --include=*.md | grep -v "docs/legacy/\|docs/superpowers/"
```
Expected: no hits, or only hits that explicitly describe `sealed` as a vocabulary
that never shipped.

```bash
node scripts/validate-canonical-docs.mjs && python3 scripts/validate_package.py
git add docs/23-offline-media-protocol.md docs/20-flow-catalog.md docs/27-qa-traceability.md
git commit -m "docs: there is no 'sealed' upload state and never was

Neither 'authorized' nor 'sealed' is a permitted value of
public.upload_intents.status. The CHECK constraint in migration 0015 lists eight
values and no later migration alters it; there is no sealed_at column in any
migration. The state meaning completion succeeded is 'available'.

This is a second state vocabulary, incompatible with the one in
technical/states/, inherited from the superseded technical/schema.sql. Only the
four live documentation sites are corrected here — the technical/ files that
carry the same word are cross-validated against each other by the package
validator, so changing one there reds the build. They belong to the slice that
retires that validator."
```

---

### Task 4: What exists, which versions, and which colours

Four small factual corrections that share one property: each is a statement about
the current system that a reader can check in under a minute and find false.

**Files:**
- Modify: `docs/architecture/system-overview.md`, `README.md`
- Modify: `docs/07-technical-architecture.md`
- Modify: `docs/05-design-system.md`
- Modify: `docs/04-screen-specification.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: `apps/mobile` exists — measure and correct**

```bash
git ls-files apps/mobile | wc -l          # → 22
ls apps/                                  # → app demo landing mobile
grep -n '"name"\|"expo"' apps/mobile/package.json
```

- `docs/architecture/system-overview.md:38-39` says it "does not yet physically
  exist" and is "an approved target that must be created and verified before the
  v0.1 mobile milestone can close". Replace: it exists as a committed pnpm
  workspace (22 tracked files, Expo SDK 57.0.9, expo-router), and the v0.1 mobile
  milestone remains open on functionality rather than on existence.
- `README.md:64-65` — delete the sentence "**Not yet created.**" The
  online-only-in-v0.1 / offline-in-v0.3 clause on the same line is correct and
  stays.

Twenty-two other mentions of `apps/mobile` across `docs/` describe it as a target
or a surface without asserting absence. Leave them.

- [ ] **Step 2: Expo SDK — measure and correct**

```bash
grep -n '"expo"' apps/mobile/package.json    # → "expo": "57.0.9"
grep -n '^  expo@' pnpm-lock.yaml            # → expo@57.0.9:
```

- `docs/07-technical-architecture.md:8` — the stack table row says
  `Expo SDK 56`; make it `Expo SDK 57`.
- `docs/07-technical-architecture.md:20` — the version-baseline sentence says
  `Expo SDK 56`; make it `Expo SDK 57.0.9`.

**Critical:** the same sentence at `:20` contains
`Next.js **16.2.11 or newer security-patched 16.2.x**`, which
`validate_package.py:260` asserts verbatim including the asterisks. Do not touch
those words. The Next.js and Node pins were both measured and are **correct** —
only the Expo number is wrong. Change nothing else in that sentence.

- [ ] **Step 3: Four colour rows — measure and correct**

```bash
node -e "
const fs=require('fs');
const doc=[...fs.readFileSync('docs/05-design-system.md','utf8').matchAll(/^\| \\\`([a-z0-9-]+)\\\` \| \\\`(#[0-9A-Fa-f]{6})\\\` \|/gm)];
const gen=JSON.parse(fs.readFileSync('packages/tokens/src/tokens.json','utf8')).color;
for (const [,name,hex] of doc) {
  const g = gen[name]?.hex;
  if (g && g.toLowerCase() !== hex.toLowerCase()) console.log(name, 'doc', hex, 'source', g);
}"
```

Expected exactly four rows: `ink-800` `#2A2D2F`→`#242424`, `signal-700`
`#84A625`→`#667F12`, `blue-500` `#5278D8`→`#3756a1`, `muted`
`#686E6A`→`#666979`. Change only the hex values.

Each already has a committed owner ruling in `packages/tokens/src/tokens.json`
explaining why the source value won — read them and reference the reason in your
report rather than restating the hex.

**Critical:** `packages/testing/src/token-fidelity.test.ts:86` asserts the table
has exactly 12 rows and `:87-90` asserts every documented name appears in the
token source. Do not add, remove, reorder or rename a row.

- [ ] **Step 4: The deep-link line — measure and correct**

```bash
grep -n '"scheme"' apps/mobile/app.json      # → "scheme": "goproceed"
find . -path ./node_modules -prune -o \( -iname 'assetlinks.json' -o -iname 'apple-app-site-association*' \) -print
ls apps/mobile/src/app/
```

`docs/04-screen-specification.md:275` asserts three things and all three are
false: the scheme is `goproceed`, not `aktflow://`; no AASA or assetlinks.json
file exists anywhere and no associated domain is configured; and none of the four
named routes exists — the whole mobile route table is `_layout.tsx` and
`index.tsx`.

Rewrite the line so the scheme is stated correctly and the universal links, the
AASA/assetlinks coverage and the four routes are described as the v0.1 **target**
rather than as current coverage. Expo Router with typed routes is enabled, so say
the mechanism exists and the routes do not.

Lines `:276`, `:323` and `:421` inherit the same tense problem — correct them the
same way.

**Critical:** do not add, remove or renumber any `### SNN` heading;
`validate_package.py:751,753` asserts the set is exactly S01–S42.

- [ ] **Step 5: Verify all four**

```bash
grep -rn "Not yet created\|does not yet physically exist" README.md docs/ --include=*.md | grep -v docs/superpowers/
grep -rn "SDK 56" docs/ --include=*.md | grep -v docs/superpowers/
grep -rn "aktflow://" docs/ --include=*.md | grep -v "docs/superpowers/\|TODOS"
node scripts/validate-canonical-docs.mjs && python3 scripts/validate_package.py
APP_DB_URL="postgresql://aktflow_app_login:app_pw@127.0.0.1:54322/postgres" \
SERVICE_DB_URL="postgresql://aktflow_service_login:service_pw@127.0.0.1:54322/postgres" \
pnpm --filter @aktflow/testing test -- src/token-fidelity.test.ts
```

The first three greps must return nothing. The token fidelity test must stay
green — it is what proves the colour edit did not disturb the row count or names.

- [ ] **Step 6: Update review dates and commit**

```bash
git add docs/architecture/system-overview.md README.md docs/07-technical-architecture.md docs/05-design-system.md docs/04-screen-specification.md
git commit -m "docs: four claims a reader could disprove in a minute

apps/mobile was documented as not existing; it has 22 tracked files and shipped
in PR #7. The stack table pinned Expo SDK 56; the lockfile says 57.0.9 — the
Next.js and Node pins in the same sentence were measured and are correct, so only
the Expo number moved. Four of twelve colour rows disagreed with the generated
token source, each already carrying a committed ruling for why the source value
won. And the deep-link line asserted a scheme that changed, AASA and assetlinks
coverage for files that do not exist, and four routes that were never built.

The last one is the shape worth naming: a single line asserting three facts, none
of them true, in a document that is normative for the client about to consume it."
```

---

### Task 5: The gate record

**Files:**
- Create: `docs/superpowers/plans/evidence/2026-08-03-docs-slice0-gate.md`

**Interfaces:**
- Consumes: the measurements and outputs recorded by Tasks 1–4.
- Produces: nothing.

- [ ] **Step 1: Write the record**

Follow the house style of
`docs/superpowers/plans/evidence/2026-08-01-b0-gate.md`. It must contain:

- The branch, base commit, and the commits this slice produced.
- An evidence table: `node scripts/validate-canonical-docs.mjs`, `make validate`,
  `pnpm turbo run test --concurrency=1 --force`, `pnpm typecheck`.
- **A corrections table**: one row per corrected claim, with what it said, what
  it says now, and the command that measures the truth. This is the section that
  makes the slice auditable — a reader re-runs a command rather than trusting a
  diff.
- **The settled counts with their counting rules**, including why 3, 24 and 43
  were each a real answer to a different question.
- **A "checked and already correct" section** listing the hypotheses that were
  refuted: the Next.js and Node pins, the eight code comments citing `docs/22` by
  line number, the `113 Pilot / 44 GA` arithmetic, the eight matching colour
  rows, the shadow spec, and that `validate_package.py` does not pin the Expo
  fragment. Someone will otherwise "fix" these later.
- **A "what this slice did not close" section** stating in plain words: the
  OpenAPI allowlist correction is deferred to slice 1 because the sentence is
  asserted by the validator slice 1 removes; review dates were not bulk-stamped
  because that would assert a review that did not happen; the `sealed` vocabulary
  survives in seven `technical/` files that are cross-validated against each
  other; and no file moved, so the numbered layer is still in the reader's path.

- [ ] **Step 2: Validate and commit**

```bash
node scripts/validate-canonical-docs.mjs
git add docs/superpowers/plans/evidence/2026-08-03-docs-slice0-gate.md
git commit -m "docs: record what slice 0 corrected and what it deliberately left

The corrections table carries the measuring command beside every claim, so the
slice is auditable by re-running rather than by reading a diff. The
already-correct section exists because three of this slice's starting hypotheses
were refuted, including one that would have stopped the Expo fix on a false
belief that CI pinned it."
```

---

## Self-Review

**Spec coverage.** The upload machine (C-1, C-4) — Task 1. The baseline
inventory (C-2) — Task 2. The `sealed` vocabulary (C-3) — Task 3. `apps/mobile`
existence (C-5), Expo SDK (C-6), colour rows (C-7), deep links (C-8) — Task 4.
The settled counts and their rules — Task 2 Step 1, restated in Task 5. The
deferred OpenAPI correction and the no-bulk-stamping rule — Task 5's
"did not close" section. The false alarms — Task 5. Zero moves and zero CI
changes — Global Constraints, and every task's verification runs `make validate`
to prove it. That gate is `python3 scripts/validate_package.py`, invoked directly.

**Placeholder scan.** No TBD or TODO. Two steps deliberately require judgement
rather than transcription — Task 2 Step 2's `docs/delivery/version-0.0.md` row
(edit only if it reads as present-tense, and say which you concluded) and Task 4
Step 4's rewrite — and both say what the judgement is and what to report.

**Consistency.** The reserved-value phrasing is defined once, in Task 1 Step 3,
and Task 3 consumes it by reference rather than restating it. The counting rule
for functions appears in Task 2 Step 1 and is cited by Task 5 rather than
duplicated. `technical/states/state-catalog.csv` (edited) and the flat
`technical/state-catalog.csv` (not edited) are distinguished everywhere they
appear, because their names differ by one path segment and confusing them reds
the build.
