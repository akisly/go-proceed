# Rename slice 3 — the workspace identifiers — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the ten `@aktflow/*` workspace packages to `@goproceed/*`, the root
package name, and the `aktflow-app` CSS class — without touching the five PostgreSQL
roles or any user-visible product copy.

**Architecture:** Two rename commits split by dependency direction — the six
`packages/*` libraries first, then the four `apps/*` — then the leftovers, then the
record. Each commit renames a package **completely**: its `name` field, every
dependency entry naming it, every import specifier, and its lockfile keys. Nothing is
ever half-renamed between commits.

**Tech Stack:** pnpm 9 workspaces, TypeScript 5, turbo, Vitest, GitHub Actions, Vercel.

## Global Constraints

- **Branch:** `claude/rename-slice3-packages`, from `claude/docs-slice2-archive` @
  `d59fa17`. Do not rebase. Do not merge slices 0-2.
- **Never touch the five PostgreSQL roles**, or any string containing them:
  `aktflow_app`, `aktflow_app_login`, `aktflow_worker`, `aktflow_service`,
  `aktflow_service_login`. They appear 490 times, mostly in `supabase/migrations/`.
  **Any edit under `supabase/` is out of scope for this slice.**
- **Never touch these four role names in `technical/` CSVs**, which look like packages
  and are not: `aktflow_platform_billing`, `aktflow_support`, `aktflow_external`,
  `aktflow_audit_writer`.
- **Never touch `aktflow_requirement` or `aktflow_control`.** They are **CSV column
  headers** in `technical/mobile-security-profile.csv` and `technical/asvs-profile.csv`,
  and `scripts/validate_package.py` asserts those header sets by name through
  `read_csv_contract(required_headers=…)`. Renaming a column reds the build.
- **Never touch product copy.** The 89 `AktFlow` occurrences — including
  `<h1>AktFlow — вхід</h1>` and `<title>AktFlow — демонстраційний прототип</title>` —
  are a later slice. The only exception is the single `README.md` sentence corrected in
  Task 3, which is a false claim about this rename's own completeness.
- **Never touch the domains** `aktflow.app`, `aktflow.com`, `aktflow.example`,
  `aktflow.pilot`, or the env vars `AKTFLOW_CHROME_PATH` and `AKTFLOW_BASE_URL`.
- **Never touch `aktflow-product-prototype`.** `prototype/` carries disposition `keep`
  and no workspace depends on it.
- **Nothing under `technical/`, `docs/legacy/` or `migration/` changes.**
- **No directory moves.** `packages/contracts/` stays where it is. Only `name` fields
  and the specifiers referencing them change — that is what keeps the lockfile edit to
  nine key renames with every `link:` path untouched.
- **Do not attempt `pnpm install`.** `exceljs@4.4.0` is declared and lockfile-present
  but absent from the installed tree; pnpm will only reconcile by purging and
  rebuilding node_modules across all 11 workspace projects. The owner ruled on
  2026-08-03 to hand-edit the lockfile and let CI prove it.
- **Do not run `make validate`** — it shells out to `eslint`, absent here, for reasons
  predating this branch. Run `python3 scripts/validate_package.py` directly if needed.
- **`.agents/`, `.gstack/` and `skills-lock.json` are untracked and user-added.** Never
  stage, commit, move or delete them.

## The typecheck baseline, measured 2026-08-03

These five run clean today and are the primary local proof. A rename that breaks an
import specifier fails here:

```
apps/demo           clean        packages/testing    clean
apps/landing        clean        packages/tokens     clean
                                 packages/contracts  clean
```

Two more have a `tsconfig.json` and **cannot** run, for reasons that predate this
branch — do not treat their failure as yours:

- `apps/mobile` — 162 errors, all `Cannot find module 'expo-router'` and siblings. Its
  dependencies are not installed.
- `packages/database` — 6 errors, every one originating in
  `../domain/src/import/xlsx.ts`, the `exceljs` gap leaking through a project
  reference.

`packages/ui` has no `tsconfig.json`. `apps/app` and `packages/domain` declare
`exceljs` directly.

Run a typecheck as: `cd <dir> && npx tsc --noEmit -p tsconfig.json`

## The measured surface

**156 `@aktflow/*` occurrences** across the ten packages:

| Package | Occurrences | Files | Lockfile keys |
|---|---|---|---|
| `@aktflow/contracts` | 50 | 47 | 4 |
| `@aktflow/database` | 43 | 42 | 1 |
| `@aktflow/domain` | 18 | 17 | 2 |
| `@aktflow/tokens` | 8 | 8 | 1 |
| `@aktflow/ui` | 8 | 5 | 1 |
| `@aktflow/demo` | 21 | 8 | 0 |
| `@aktflow/app` | 3 | 3 | 0 |
| `@aktflow/testing` | 2 | 2 | 0 |
| `@aktflow/landing` | 2 | 2 | 0 |
| `@aktflow/mobile` | 1 | 1 | 0 |

Task 1's six libraries touch **64 files** — 63 by substitution plus
`.github/workflows/ci.yml` by hand. Task 2's four apps touch **12**, 11 by
substitution plus `ci.yml` again.

## Two sites a test suite cannot catch

- **`apps/demo/vercel.json:3`** — `"buildCommand": "cd ../.. && pnpm turbo run build --filter=@aktflow/demo"`. A stale filter breaks the **Vercel deploy**, not CI.
- **`.github/workflows/ci.yml` mixes both worlds.** Lines 22, 25 and 65 contain
  **role names inside connection strings** and must survive byte-identical. Lines
  72-73 (a comment) and 142-146 (`pnpm --filter @aktflow/demo …`) are package names
  and must change. **Edit this file by hand. Never run a substitution over it.**

## File Structure

| File | What changes | Task |
|---|---|---|
| `packages/{contracts,database,domain,testing,tokens,ui}/package.json` | `name` field | 1 |
| 63 files importing or depending on those six | specifiers and dependency keys | 1 |
| `.github/workflows/ci.yml` | two names in one comment, by hand | 1 |
| `pnpm-lock.yaml` | 9 `importers:` keys | 1 |
| `apps/{app,demo,landing,mobile}/package.json` | `name` field | 2 |
| 12 files naming those four | specifiers, `--filter` flags | 2 |
| `.github/workflows/ci.yml` | 6 package-name sites, by hand | 2 |
| `apps/demo/vercel.json` | the `buildCommand` filter | 2 |
| `package.json` (root) | `"name": "aktflow"` → `"goproceed"` | 3 |
| `apps/demo/src/styles/theme.css` + 10 files | the `aktflow-app` class | 3 |
| `README.md` | one false sentence about this rename | 3 |
| `docs/superpowers/plans/evidence/2026-08-03-rename-slice3-gate.md` | new | 4 |

---

### Task 1: The six `packages/*` libraries

Renamed first because everything depends on them and nothing among them depends on an
app. After this commit the libraries answer to `@goproceed/*` and every importer —
including files inside `apps/` — uses the new name. The apps' own names are still
`@aktflow/*`; that is Task 2's and is not a broken state.

**Files:**
- Modify: `packages/{contracts,database,domain,testing,tokens,ui}/package.json` (the `name` field)
- Modify: 63 files that import them or declare them as dependencies, plus
  `.github/workflows/ci.yml` by hand
- Modify: `pnpm-lock.yaml` (9 keys)

**Interfaces:**
- Consumes: nothing.
- Produces: six packages named `@goproceed/contracts`, `@goproceed/database`,
  `@goproceed/domain`, `@goproceed/testing`, `@goproceed/tokens`, `@goproceed/ui`.
  Task 2 relies on those names already being in place.

- [ ] **Step 1: Record the baseline**

```bash
cd /Users/akisliy/Downloads/GoProceed
for d in apps/demo apps/landing packages/testing packages/tokens packages/contracts; do
  printf "%-20s " "$d"
  (cd "$d" && npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && echo clean || echo FAILING)
done
git ls-files | grep -vE '^(docs/legacy|docs/superpowers|migration)/' | xargs grep -oh '@aktflow/[a-z]*' 2>/dev/null | sort | uniq -c
```

Expected: five `clean`, and the occurrence table from this plan's "measured surface"
section. Paste both into your report. **If any of the five is not clean, stop and
report** — you cannot prove a rename against a broken baseline.

- [ ] **Step 2: Rename the six `name` fields**

In each file, change only the `"name"` value:

| File | From | To |
|---|---|---|
| `packages/contracts/package.json` | `"@aktflow/contracts"` | `"@goproceed/contracts"` |
| `packages/database/package.json` | `"@aktflow/database"` | `"@goproceed/database"` |
| `packages/domain/package.json` | `"@aktflow/domain"` | `"@goproceed/domain"` |
| `packages/testing/package.json` | `"@aktflow/testing"` | `"@goproceed/testing"` |
| `packages/tokens/package.json` | `"@aktflow/tokens"` | `"@goproceed/tokens"` |
| `packages/ui/package.json` | `"@aktflow/ui"` | `"@goproceed/ui"` |

- [ ] **Step 3: Rewrite every reference to those six**

This is the only substitution in the plan, and it is safe **because the pattern is
anchored to the six names**. It cannot match a role (`aktflow_app`), a domain
(`aktflow.com`), a CSV header (`aktflow_control`) or product copy (`AktFlow`).

```bash
cd /Users/akisliy/Downloads/GoProceed
git ls-files \
  | grep -vE '^(docs/legacy|docs/superpowers|migration|supabase|technical|prototype)/' \
  | grep -v '^\.github/workflows/ci\.yml$' \
  | xargs grep -lE '@aktflow/(contracts|database|domain|testing|tokens|ui)\b' 2>/dev/null \
  | tee /tmp/rename-t1-files.txt \
  | xargs sed -i '' -E 's#@aktflow/(contracts|database|domain|testing|tokens|ui)[[:>:]]#@goproceed/\1#g'
wc -l < /tmp/rename-t1-files.txt
```

Expected: **63** files.

**`\b` does not work in BSD `sed -E`.** It matches nothing, `sed` exits **0**, and the
files are rewritten unchanged — a silent no-op that looks exactly like success. Task 1's
implementer hit this and caught it only because the file count was checked. The macOS
word-boundary form is `[[:>:]]`, used above. On GNU sed use `\b` with `sed -i -E`.
Verify your substitution actually changed something before trusting its exit code:
`git diff --stat` must be non-empty. Note `grep -E` handles `\b` correctly on both
platforms — this trap is specific to `sed`.

`.github/workflows/ci.yml` is excluded here and edited by hand in Step 3a. Its comment
at lines 72-73 names two of these six, so the unfenced pattern *would* have matched it
— but that file also carries role names in connection strings, and this plan holds one
rule about it without exception: **`ci.yml` is only ever edited by hand.** A pattern
that is safe today is not a reason to weaken a rule that exists for the pattern that
will not be. `sed -i ''` is the BSD/macOS form; on GNU sed use `sed -i -E`.
Verify which you have with `sed --version 2>/dev/null | head -1` before running, and
say in your report which form you used.

This deliberately excludes `supabase/`, `technical/`, `prototype/`, `docs/legacy/`,
`docs/superpowers/` and `migration/` — none should contain these six names, and
excluding them means a surprise there becomes a visible discrepancy in the count
rather than a silent edit.

- [ ] **Step 3a: Edit `.github/workflows/ci.yml`'s comment by hand**

Lines 72-73 read:

```
      # --concurrency=1 is load-bearing, not a style choice: @aktflow/database,
      # @aktflow/testing (the RLS negative-policy suite), and @aktflow/app's
```

Change `@aktflow/database` and `@aktflow/testing` to `@goproceed/…`. **Leave
`@aktflow/app` exactly as it is** — the apps are Task 2's, and this line will be
finished there.

Verify nothing else in that file moved:

```bash
git diff .github/workflows/ci.yml | grep -c '^[+-][^+-]'
grep -n 'aktflow' .github/workflows/ci.yml
```

Expected: **4** changed lines (two removed, two added), and the remaining `aktflow`
hits being the three role lines (22, 25, 65), the untouched `@aktflow/app` on line 73,
and the five `--filter @aktflow/demo` steps.

- [ ] **Step 4: Rename the lockfile keys — nine entries, five distinct names**

`pnpm-lock.yaml` carries entries of exactly this shape under `importers:`:

```yaml
      '@aktflow/contracts':
        specifier: workspace:*
        version: link:../../packages/contracts
```

Change **only the key**. `specifier` and the `link:` path must stay byte-identical —
no directory moves, so no path changes.

```bash
sed -i '' -E "s#'@aktflow/(contracts|database|domain|testing|tokens|ui)':#'@goproceed/\1':#g" pnpm-lock.yaml
grep -c "'@goproceed/" pnpm-lock.yaml
grep -c "'@aktflow/" pnpm-lock.yaml
git diff --stat pnpm-lock.yaml
```

Expected: **9** and **0**, and a diffstat of 9 insertions and 9 deletions.

Nine *entries* naming five *distinct* packages — `contracts` (×4), `database`,
`domain` (×2), `tokens`, `ui` — because a package appears once per importer that
depends on it. `@goproceed/testing` has no lockfile entry at all: nothing depends on
it, it is only ever run. The pattern includes it anyway so the six names stay one
list, and matching nothing there is correct rather than a miss. Any count other than
9/0 means the pattern reached something unintended — stop and report.

- [ ] **Step 5: Prove the lockfile edit is structurally sound**

The one check that stands in for the `pnpm install` this checkout cannot run:

```bash
python3 - <<'PY'
import re, json, pathlib
lock = pathlib.Path("pnpm-lock.yaml").read_text(encoding="utf-8")
declared = {json.loads(p.read_text(encoding="utf-8")).get("name")
            for p in pathlib.Path(".").glob("*/*/package.json")
            if "node_modules" not in str(p)}
keys = set(re.findall(r"'(@(?:aktflow|goproceed)/[a-z]+)':", lock))
print("lockfile workspace keys:", sorted(keys))
print("undeclared keys        :", sorted(keys - declared) or "none")
print("stale aktflow keys     :", sorted(k for k in keys if k.startswith("@aktflow/")) or "none")
links = re.findall(r"version: (link:[^\s]+)", lock)
print("link: paths            :", len(links), "unique:", len(set(links)))
PY
git diff pnpm-lock.yaml | grep -E '^[+-].*link:' | head
```

Expected: every lockfile key declared by a real `package.json`, **no** undeclared keys,
**no** stale `@aktflow/` keys, and **no output at all** from the `link:` diff — if a
`link:` line appears in the diff, a path changed and the edit is wrong.

- [ ] **Step 6: Typecheck**

```bash
for d in apps/demo apps/landing packages/testing packages/tokens packages/contracts; do
  printf "%-20s " "$d"
  (cd "$d" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS")
done
```

Expected: **0** for all five, matching Step 1's baseline. A non-zero count here is the
rename having broken an import specifier — read the error, fix the reference, re-run.
Do not proceed with a failing typecheck.

Then the one test suite that runs without a database:

```bash
pnpm --filter @goproceed/testing exec vitest run src/token-fidelity.test.ts
```

Expected: 5 passed. **Note the filter now uses the new name** — that is itself a check
that the rename took, since pnpm resolves filters against `package.json` names.

- [ ] **Step 7: Verify no reference survives, and none leaked**

```bash
git ls-files | xargs grep -n '@aktflow/\(contracts\|database\|domain\|testing\|tokens\|ui\)' 2>/dev/null
git diff --name-only | grep -E '^(supabase|technical|prototype|docs/legacy|migration)/'
git diff --stat | tail -1
```

Expected: no output from the first two, and **65** files changed in the third — 63 by
substitution, `.github/workflows/ci.yml` by hand, and `pnpm-lock.yaml`. The second command is the important one — it proves the substitution stayed
inside its fence.

Then confirm the roles are untouched:

```bash
git diff | grep -E '^[+-].*aktflow_(app|worker|service)' | head
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add -u
git status --porcelain
git commit -m "refactor: rename the six workspace libraries to @goproceed

Ten @aktflow/* packages, the root package name and one CSS class are the
identifier half of a rename the owner ruled on 2026-08-03. The five PostgreSQL
roles are excluded by a standing ruling — ALTER ROLE ... RENAME TO clears an
md5-hashed password and needs a deployment window, not a substitution — and the
89 AktFlow product-copy occurrences are excluded because they include Ukrainian
and English UI strings that no tool can verify.

This commit takes the six packages/* libraries, in one piece each: the name
field, every dependency entry, every import specifier, and the lockfile key. The
apps still answer to @aktflow/*; that is the next commit and not a broken state,
because a package's name and its importers move together here.

The substitution is anchored to the six literal names, so it cannot reach a role
(aktflow_app), a domain (aktflow.com), a CSV column header (aktflow_control) or
product copy (AktFlow) — and it is fenced out of supabase/, technical/,
prototype/ and the archives, so a surprise there would show as a count mismatch
rather than a silent edit.

The lockfile is hand-edited: nine importer keys, every specifier and link: path
byte-identical, because no directory moved. pnpm install --frozen-lockfile is
what would actually validate that and cannot run in this checkout, so it is
verified structurally here and proven by CI."
```

`git status --porcelain` must show only modified files under `apps/`, `packages/`,
`pnpm-lock.yaml`, and the three untracked user-added paths. Nothing else.

---

### Task 2: The four `apps/*`

**Files:**
- Modify: `apps/{app,demo,landing,mobile}/package.json` (the `name` field)
- Modify: 12 files naming those four
- Modify: `.github/workflows/ci.yml` (by hand), `apps/demo/vercel.json`

**Interfaces:**
- Consumes: the six `@goproceed/*` library names from Task 1.
- Produces: `@goproceed/app`, `@goproceed/demo`, `@goproceed/landing`,
  `@goproceed/mobile`.

- [ ] **Step 1: Rename the four `name` fields**

| File | From | To |
|---|---|---|
| `apps/app/package.json` | `"@aktflow/app"` | `"@goproceed/app"` |
| `apps/demo/package.json` | `"@aktflow/demo"` | `"@goproceed/demo"` |
| `apps/landing/package.json` | `"@aktflow/landing"` | `"@goproceed/landing"` |
| `apps/mobile/package.json` | `"@aktflow/mobile"` | `"@goproceed/mobile"` |

- [ ] **Step 2: Rewrite every reference to those four, excluding the workflow**

`.github/workflows/ci.yml` is excluded from the substitution and edited by hand in
Step 3, because it also contains role names that must survive.

```bash
cd /Users/akisliy/Downloads/GoProceed
git ls-files \
  | grep -vE '^(docs/legacy|docs/superpowers|migration|supabase|technical|prototype)/' \
  | grep -v '^\.github/workflows/ci\.yml$' \
  | xargs grep -lE '@aktflow/(app|demo|landing|mobile)\b' 2>/dev/null \
  | tee /tmp/rename-t2-files.txt \
  | xargs sed -i '' -E 's#@aktflow/(app|demo|landing|mobile)[[:>:]]#@goproceed/\1#g'
cat /tmp/rename-t2-files.txt
```

Expected: **11** files listed (12 name the four packages; one of them is `ci.yml`,
excluded here). Confirm `apps/demo/vercel.json` is among them — its `buildCommand`
carries `--filter=@aktflow/demo`, and a stale filter breaks the Vercel deploy rather
than CI.

- [ ] **Step 3: Edit `.github/workflows/ci.yml` by hand**

**Six sites change. Three must not.**

Change — the comment at lines 72-73:

```
      # --concurrency=1 is load-bearing, not a style choice: @aktflow/database,
      # @aktflow/testing (the RLS negative-policy suite), and @aktflow/app's
```

to name `@goproceed/database`, `@goproceed/testing` and `@goproceed/app`.

Change — the five `demo-qa` steps at lines 142-146:

```
      - run: pnpm --filter @aktflow/demo typecheck
      - run: pnpm --filter @aktflow/demo lint
      - run: pnpm --filter @aktflow/demo test
      - run: pnpm --filter @aktflow/demo build
      - run: pnpm --filter @aktflow/demo qa
```

to `@goproceed/demo` in all five.

**Do not change** lines 22, 25 and 65. They read `aktflow_app_login` and
`aktflow_service_login` inside PostgreSQL connection strings, and a comment naming the
role whose password the next step sets. These are roles, not packages.

Verify:

```bash
grep -n 'aktflow' .github/workflows/ci.yml
```

Expected: exactly three lines, all containing `aktflow_app_login` or
`aktflow_service_login`. Any `@aktflow/` remaining is a missed site.

- [ ] **Step 4: Typecheck, test, and verify**

```bash
for d in apps/demo apps/landing packages/testing packages/tokens packages/contracts; do
  printf "%-20s " "$d"
  (cd "$d" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS")
done
pnpm --filter @goproceed/demo exec tsc --noEmit -p tsconfig.json && echo "filter resolves"
git ls-files | xargs grep -n '@aktflow/' 2>/dev/null
git diff --name-only | grep -E '^(supabase|technical|prototype|docs/legacy|migration)/'
```

Expected: **0** errors for all five; `filter resolves` — which proves pnpm can find the
renamed app by its new name; and **no output** from the last two commands. That third
command is the slice's headline check: after this commit no `@aktflow/` package
reference exists anywhere in the repository.

```bash
python3 -c "
import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml'))
print('jobs:', list(d['jobs'])); print('demo-qa steps:', len(d['jobs']['demo-qa']['steps']))"
```

Expected: three jobs, and the same step count as before your edit — proof the YAML did
not reshape.

- [ ] **Step 5: Commit**

```bash
git add -u
git status --porcelain
git commit -m "refactor: rename the four apps to @goproceed

After this commit no @aktflow/ package reference exists anywhere in the
repository. The five PostgreSQL roles are untouched and still say aktflow, which
is the standing ruling, not an oversight.

Two sites here would not have been caught by any test. apps/demo/vercel.json
carries --filter=@aktflow/demo inside its buildCommand, so a stale filter breaks
the Vercel deploy rather than CI. And .github/workflows/ci.yml mixes both worlds:
six package-name sites changed, and lines 22, 25 and 65 deliberately did not,
because they are role names inside PostgreSQL connection strings. That file was
edited by hand for exactly that reason — a substitution over it would have
renamed the roles and reddened every database test."
```

---

### Task 3: The root name, the CSS class, and one false sentence

**Files:**
- Modify: `package.json` (root), `apps/demo/src/styles/theme.css` and 10 files using
  the class, `README.md`

**Interfaces:**
- Consumes: nothing from Tasks 1-2 beyond a green tree.
- Produces: nothing.

- [ ] **Step 1: The root package name**

`package.json:2` reads `"name": "aktflow"`. Change to `"goproceed"`.

This is a private workspace root; nothing depends on it by name. Confirm:

```bash
git ls-files | xargs grep -n '"aktflow"' 2>/dev/null
```

Expected: no output after the change.

- [ ] **Step 2: The CSS class**

`aktflow-app` is defined at `apps/demo/src/styles/theme.css:251` as `.aktflow-app {`
and used in ten other files. Rename it to `goproceed-app` everywhere:

```bash
cd /Users/akisliy/Downloads/GoProceed
git ls-files \
  | grep -vE '^(docs/legacy|docs/superpowers|migration|supabase|technical|prototype)/' \
  | xargs grep -l 'aktflow-app' 2>/dev/null \
  | tee /tmp/rename-t3-css.txt \
  | xargs sed -i '' 's#aktflow-app#goproceed-app#g'
cat /tmp/rename-t3-css.txt
grep -n 'goproceed-app' apps/demo/src/styles/theme.css | head -2
```

Expected: **11** files, including `.interface-design/system.md`, and the definition now
reading `.goproceed-app {`.

The class is internal to `apps/demo` and its design-system note. It is not a public
API and appears in no HTML fixture or screenshot assertion — confirm that:

```bash
git ls-files | xargs grep -ln 'aktflow-app' 2>/dev/null
```

Expected: no output.

- [ ] **Step 3: Correct the sentence this slice makes wrong**

`README.md:19` reads:

```
- **Product name is GoProceed.** `AktFlow` survives only as legacy history and
```

That was false before this slice and is still false after it — the roles and all
user-visible copy still say AktFlow. Rewrite it to state what is actually true: the
workspace package identifiers are now `@goproceed/*`, while the five PostgreSQL roles
and the product copy have not moved and are each a later slice.

Read the surrounding lines first and match the file's voice. **Do not** rewrite any
neighbouring claim; this is one sentence. Say in your report exactly what you wrote and
why you judged it true.

- [ ] **Step 3a: Two more claims this slice falsified**

Task 2's implementer found both and correctly left them rather than scope-creep. Both
are the same class as Step 3's sentence: text that this slice makes wrong.

**`TODOS.md`, the P1 rename entry.** It says "Everything else still says `aktflow`" and
lists "**10** `package.json` files declaring `@aktflow/*` names, and **55** source
files importing them." After Tasks 1 and 2 that is zero and zero. Rewrite the entry so
it describes what is actually left — the five PostgreSQL roles, the product copy, the
domains and the env vars — and remove the package-identifier bullet. **Measure the
remaining counts yourself** rather than editing the numbers by arithmetic; the entry's
other bullets may also have drifted.

**`scripts/validate-canonical-docs.mjs:39`.** The branding check strips two patterns
before testing a line:

```js
    const stripped = line.replace(/@aktflow\/[\w-]+/g, "").replace(/aktflow_[\w]+/g, "");
```

The first strip is now dead: no branding-checked document contains an `@aktflow/`
identifier. The second is still live and still needed — `docs/architecture/data-model.md`
names the PostgreSQL roles, which are not being renamed. **Remove the first strip only,
keep the second**, and correct the comment three lines above it, which claims both
kinds are "handled by the v0.0 rename gate".

Prove the change is safe rather than assuming — the validator must still pass, and the
role strip must still be doing work:

```bash
node scripts/validate-canonical-docs.mjs
node -e "
const {brandingViolations} = await import('./scripts/validate-canonical-docs.mjs');
" 2>/dev/null || true
node --input-type=module -e "
import {readFileSync} from 'node:fs';
const src = readFileSync('docs/architecture/data-model.md','utf8');
console.log('role-bearing lines still stripped:', src.split('\n').filter(l=>/aktflow_[\w]+/.test(l)).length);
"
```

Expected: `canonical documentation: OK`, and a non-zero count of role-bearing lines —
which is why the second strip stays.

- [ ] **Step 4: Verify**

```bash
for d in apps/demo apps/landing packages/testing packages/tokens packages/contracts; do
  printf "%-20s " "$d"
  (cd "$d" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS")
done
pnpm --filter @goproceed/testing exec vitest run src/token-fidelity.test.ts
node scripts/validate-canonical-docs.mjs
python3 scripts/validate_package.py | tail -2
```

Expected: 0 errors ×5, 5 tests passed, `canonical documentation: OK`, and
`PASS` with `documents=1`.

- [ ] **Step 5: Commit**

```bash
git add -u
git status --porcelain
git commit -m "refactor: the root package name, the CSS class, and a claim this slice does not make true

README.md said the product name is GoProceed and AktFlow survives only as legacy
history. That was false when it was written and is still false now: the five
PostgreSQL roles and every user-visible AktFlow string are untouched by this
slice and belong to later ones. The sentence now says which half moved.

Correcting it here rather than leaving it is the point. A rename slice that
tidies identifiers while leaving a claim that the whole rename is done produces a
corpus that reads more finished than it is, which is the failure the first three
slices of this restructure existed to remove."
```

---

### Task 4: The gate record

**Files:**
- Create: `docs/superpowers/plans/evidence/2026-08-03-rename-slice3-gate.md`

**Interfaces:**
- Consumes: the measurements from Tasks 1-3.
- Produces: nothing.

- [ ] **Step 1: Write it**

Follow the house style of
`docs/superpowers/plans/evidence/2026-08-03-docs-slice2-gate.md`, whose contract is
that every claim carries the command that reproduces it. It must contain:

- Branch, base commit, and the commits this slice produced.
- **An evidence table** covering: the five clean typechecks (before and after), the
  `token-fidelity` run, both documentation validators, and — recorded as **NOT
  PROVEN** with the exact command that would settle each —
  `pnpm install --frozen-lockfile`, `pnpm turbo run typecheck`, `pnpm turbo run test`,
  `pnpm turbo run build`, and the Vercel build that reads `vercel.json`.
  **CI has never run** across four slices; say so.
- **The lockfile's structural proof**, in full: every key declared, no stale key, and
  the `link:` paths byte-identical.
- **The boundary**, with evidence: the five roles untouched (`git diff` naming them
  returns nothing), the four role-shaped names in `technical/` untouched, the two CSV
  column headers untouched, the domains and env vars untouched, `prototype/`
  untouched, and `supabase/` untouched.
- **What this slice does not make true** — the roles, the 89 product-copy occurrences
  including the login heading and the demo title, and the four domains. Count the
  remaining `AktFlow` and `aktflow` occurrences yourself rather than repeating this
  plan's numbers.

Two rules that override tidiness:

- **Never record a check you did not run.** NOT RUN and the reason, otherwise.
- **Self-referential counts go stale.** The commit count counts the commit that writes
  it. Get it from `git log --oneline c42a36d..HEAD | wc -l` *before* committing and add
  one. This trap has been sprung seven times across three slices, twice on records
  that predicted it correctly.

- [ ] **Step 2: Validate and commit**

```bash
node scripts/validate-canonical-docs.mjs
python3 scripts/validate_package.py | tail -2
git add docs/superpowers/plans/evidence/2026-08-03-rename-slice3-gate.md
git commit -m "docs: record what the rename moved, and what it left saying aktflow

The evidence is not that the validators pass — they never read a package name.
It is five clean typechecks before and after, a lockfile whose every key resolves
to a declared package with no link: path disturbed, and a git diff that names no
PostgreSQL role.

The largest claim this slice cannot prove is the lockfile edit, because
pnpm install --frozen-lockfile needs a modules purge this checkout has not had.
That is recorded as NOT PROVEN with the command that settles it, alongside four
other gates and the fact that CI has never run across four slices."
```

---

## Self-Review

**Spec coverage.** The ten package names — Tasks 1 and 2. The root name and CSS class —
Task 3. The lockfile's nine keys and their structural proof — Task 1 Steps 4-5. The two
sites no test catches (`vercel.json`, `ci.yml`) — Task 2 Steps 2-3, with `ci.yml`
excluded from substitution and edited by hand. The six identifiers that look in-scope
and are not — Global Constraints, named individually with the reason each is excluded.
The typecheck baseline the spec required the plan to establish — measured 2026-08-03 and
recorded above: five clean, two blocked for pre-existing reasons, one without a
tsconfig. The `README.md` sentence the spec identified as false — Task 3 Step 3. The
NOT PROVEN set — Task 4.

**Placeholder scan.** No TBD or TODO. Every substitution is given verbatim with its
expected file count, and every count in this plan was measured rather than estimated.
Two steps require judgement — Task 3 Step 3's sentence and Task 4's record — and each
says what the judgement is and what to report.

**Consistency.** Package names are written `@goproceed/X` everywhere, with the six
libraries fixed in Task 1 and the four apps in Task 2, and Task 2's Interfaces block
states that dependency. The substitution fence — `supabase`, `technical`, `prototype`,
`docs/legacy`, `docs/superpowers`, `migration` — is identical in Tasks 1, 2 and 3, so a
file appearing in one and not another is a signal rather than noise. Expected file
counts are stated at every substitution (64, 11, 11) and cross-checked against the
measured-surface table. `sed -i ''` is flagged as the BSD form with the GNU alternative
and an instruction to check which is present, because the plan was written on macOS and
CI is Linux.
