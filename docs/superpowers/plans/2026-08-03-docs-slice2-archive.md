# Documentation slice 2 — empty the numbered layer — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all 34 remaining numbered `docs/NN-*.md` files into `docs/legacy/`,
update the seven live files that point at them, and append the supersession index to
`docs/legacy/README.md` — putting the map inside `docs/` for the first time.

**Architecture:** Two move commits (33 files, then `docs/05` with the one test that
reads it), one index commit, one record. Every commit independently green.

**Tech Stack:** git, Node 24 (`scripts/validate-canonical-docs.mjs`), Python 3.12
(`scripts/validate_package.py`), pnpm 9, Vitest.

## Global Constraints

- **Branch:** `claude/docs-slice2-archive`, from `claude/docs-slice1-gate` @
  `f443790`. Do not rebase. Do not merge slice 0 or slice 1.
- **`git mv`, never delete-and-create.** History must follow every moved file.
  `git log --follow` is a verification step, not a nicety — the legacy policy permits
  this material to be used to "recover a user need, workflow example, test idea, or
  design rationale", which needs its history.
- **Do not edit the content of any archived document**, including its stale internal
  cross-references. Owner-confirmed 2026-08-03. Eight numbered documents refer to
  each other by path; source and target move together, so each path goes stale by one
  directory, and they stay stale. `docs/legacy/README.md` preserves this material as
  "Historical migration evidence", and editing preserved evidence to tidy its paths
  is what that policy exists to prevent. None is a Markdown link, so none breaks link
  validation.
- **No per-file banner.** The 2026-07-30 precedent is a plain move;
  `docs/legacy/02-market-competition.md` opens straight into its content.
- **`docs/22-data-api-contract.md` does not move.** Its disposition is `keep`,
  targeting itself.
- **The only new file is the gate record** in Task 4.
- **Do not touch the AktFlow→GoProceed rename.** Several moved files and several
  pointer sites contain `aktflow`. Leave every instance.
- **Run `python3 scripts/validate_package.py` directly, NOT `make validate`.**
  `make validate` also runs `validate-prototype`, which shells out to `eslint` and
  fails with `eslint: command not found` in this checkout — unrelated, and predating
  the branch.
- **`pnpm typecheck` and `pnpm turbo run test` cannot run here** — `exceljs@4.4.0` is
  declared and lockfile-present but absent from the installed tree, from a commit
  predating slice 0's base. **Do not attempt an install.** Task 2 runs one Vitest file
  directly instead, which needs no database and no missing package.
- **`.agents/`, `.gstack/` and `skills-lock.json` are untracked and user-added.**
  Never stage, commit, move or delete them.

## Baseline, measured at `9e632a7`

```
python3 scripts/validate_package.py
  → PASS (required_artifacts=35, documents=35, sql_tables=126, access_surfaces=158,
    states=261, transitions=295, errors=118, api_operations=157, requirements=41,
    test_contracts=149, ui_actions=103, entity_aliases=21, retention_mappings=126,
    command_availability_rules=32, external_gates_unvalidated=12)
node scripts/validate-canonical-docs.mjs → canonical documentation: OK
```

`documents=` is the number this slice moves: **35 → 2 after Task 1, → 1 after Task 2.**
Slice 1 made it an observation rather than a contract precisely so it would fall on
its own. Every other metric must stay identical throughout.

## File Structure

| File | What changes | Task |
|---|---|---|
| 33 × `docs/NN-*.md` | moved to `docs/legacy/` | 1 |
| `scripts/validate_package.py` | five comments naming `docs/26`, `docs/27` | 1 |
| `.github/workflows/ci.yml` | one comment naming `docs/40` | 1 |
| `apps/demo/src/styles/fonts.css` | one comment naming `docs/40` | 1 |
| `TODOS.md` | two entries naming `docs/07`, `docs/04` | 1 |
| `docs/05-design-system.md` | moved to `docs/legacy/` | 2 |
| `packages/testing/src/token-fidelity.test.ts` | the path it reads, and its comment | 2 |
| `packages/tokens/src/tokens.json` | one `ruling` string | 2 |
| `packages/ui/src/base.css` | one comment | 2 |
| `docs/legacy/README.md` | the supersession index, and one stale claim | 3 |
| `docs/superpowers/plans/evidence/2026-08-03-docs-slice2-gate.md` | new | 4 |

---

### Task 1: Move the thirty-three, and repoint what names them

`docs/05-design-system.md` is deliberately **not** in this task — it is read by a test
and moves with it in Task 2.

**Files:**
- Move: 33 files, listed verbatim in Step 2
- Modify: `scripts/validate_package.py`, `.github/workflows/ci.yml`,
  `apps/demo/src/styles/fonts.css`, `TODOS.md`

**Interfaces:**
- Consumes: nothing.
- Produces: 33 files at `docs/legacy/NN-*.md`, which Task 3's index links to. Task 3
  cannot run before this one — its links would not resolve.

- [ ] **Step 1: Record the baseline**

```bash
cd /Users/akisliy/Downloads/GoProceed
python3 scripts/validate_package.py | tee /tmp/slice2-before.txt
ls docs/*.md | wc -l
```

Expected: `PASS` with `documents=35`, and **36** files in `docs/*.md` (34 numbered
plus `README.md` plus `22-data-api-contract.md`). Paste both into your report.

- [ ] **Step 2: Move the thirty-three**

Run exactly this list. `git mv`, never `mv` — history must follow.

```bash
git mv docs/00-product-brief.md docs/legacy/
git mv docs/01-prd.md docs/legacy/
git mv docs/03-personas-jtbd-workflows.md docs/legacy/
git mv docs/04-screen-specification.md docs/legacy/
git mv docs/06-data-model-permissions.md docs/legacy/
git mv docs/07-technical-architecture.md docs/legacy/
git mv docs/08-api-integrations.md docs/legacy/
git mv docs/09-security-compliance.md docs/legacy/
git mv docs/10-billing-pricing.md docs/legacy/
git mv docs/11-analytics-events.md docs/legacy/
git mv docs/12-roadmap-delivery.md docs/legacy/
git mv docs/13-qa-acceptance.md docs/legacy/
git mv docs/14-gtm-pilot.md docs/legacy/
git mv docs/15-risks-decisions.md docs/legacy/
git mv docs/17-production-readiness-index.md docs/legacy/
git mv docs/18-domain-state-machines.md docs/legacy/
git mv docs/19-organizations-roles-access.md docs/legacy/
git mv docs/20-flow-catalog.md docs/legacy/
git mv docs/21-plans-entitlements-billing.md docs/legacy/
git mv docs/23-offline-media-protocol.md docs/legacy/
git mv docs/24-legal-regulatory-gates.md docs/legacy/
git mv docs/25-security-threat-model.md docs/legacy/
git mv docs/26-sre-operations.md docs/legacy/
git mv docs/27-qa-traceability.md docs/legacy/
git mv docs/28-pilot-ga-delivery.md docs/legacy/
git mv docs/30-validation-evidence-register.md docs/legacy/
git mv docs/31-architecture-decisions.md docs/legacy/
git mv docs/32-customer-country-adapters.md docs/legacy/
git mv docs/33-support-admin-plane.md docs/legacy/
git mv docs/34-production-gate-checklist.md docs/legacy/
git mv docs/35-data-access-tenancy.md docs/legacy/
git mv docs/36-security-verification-profile.md docs/legacy/
git mv docs/40-phase1-discovery-outreach.md docs/legacy/
```

Then confirm the move registered as renames, not as delete-plus-add:

```bash
git status --porcelain | grep -c '^R '
ls docs/*.md
```

Expected: **33** renames, and `docs/*.md` now lists exactly `docs/05-design-system.md`,
`docs/22-data-api-contract.md` and `docs/README.md`.

- [ ] **Step 3: Repoint `scripts/validate_package.py`'s five comments**

The block reads:

```python
DOC_ONLY_TEST_REFS = {
    "T-ADAPTER-001",             # docs/27-qa-traceability.md
    "T-BUSINESS-CALENDAR-001",   # docs/27-qa-traceability.md
    "T-PILOT-ADMISSION-001",     # docs/27-qa-traceability.md
    "T-STATE-REACHABILITY-001",  # docs/27-qa-traceability.md
    "T-DEPLOY-SMOKE-001",        # docs/26-sre-operations.md
}
```

Replace the five comments with the new paths, keeping the alignment:

```python
DOC_ONLY_TEST_REFS = {
    "T-ADAPTER-001",             # docs/legacy/27-qa-traceability.md
    "T-BUSINESS-CALENDAR-001",   # docs/legacy/27-qa-traceability.md
    "T-PILOT-ADMISSION-001",     # docs/legacy/27-qa-traceability.md
    "T-STATE-REACHABILITY-001",  # docs/legacy/27-qa-traceability.md
    "T-DEPLOY-SMOKE-001",        # docs/legacy/26-sre-operations.md
}
```

There is a second sentence above this block, added by slice 1, that also names those
documents in prose. Read the whole comment above `DOC_ONLY_TEST_REFS` and update any
path in it the same way. Do not change the set's contents, the `require` below it, or
any other logic.

- [ ] **Step 4: Repoint `.github/workflows/ci.yml`**

Find, in the long comment at the end of the `package-validate` job:

```
      # (see docs/40-phase1-discovery-outreach.md §A.6 for the deferred-debt
```

Replace with:

```
      # (see docs/legacy/40-phase1-discovery-outreach.md §A.6 for the deferred-debt
```

Change nothing else in that file. In particular do not touch the
`pnpm validate:canonical-docs` step slice 1 added.

- [ ] **Step 5: Repoint `apps/demo/src/styles/fonts.css`**

Find:

```css
 * A.3.8 item 14 (docs/40-phase1-discovery-outreach.md:879): "Fonts subset to
```

Replace with:

```css
 * A.3.8 item 14 (docs/legacy/40-phase1-discovery-outreach.md:879): "Fonts subset to
```

This is a comment in a CSS file. Do not touch any rule.

- [ ] **Step 6: Repoint `TODOS.md`'s two entries**

First:

```
**What:** `docs/07-technical-architecture.md:8` names "Expo SDK 56" and `:20`
```

becomes

```
**What:** `docs/legacy/07-technical-architecture.md:8` names "Expo SDK 56" and `:20`
```

Second:

```
`docs/04-screen-specification.md` also still specifies `aktflow://` and
```

becomes

```
`docs/legacy/04-screen-specification.md` also still specifies `aktflow://` and
```

Leave `aktflow://` and `aktflow.app` exactly as they are — the rename is a later
slice.

The second entry's next sentence claims the document "is normative by
`docs/README.md`'s precedence". After this commit that is false: it is under
`docs/legacy/`, which `docs/README.md:41` makes non-normative — which is the whole
point of this slice. Correct that clause too, and say in your report what you changed
it to. This is a judgement call: keep the entry's meaning (the deep-link content still
needs deliberate treatment in the rename slice) while removing the false claim about
its authority.

- [ ] **Step 7: Verify**

```bash
python3 scripts/validate_package.py | tee /tmp/slice2-after1.txt
node scripts/validate-canonical-docs.mjs
diff <(tr ',' '\n' < /tmp/slice2-before.txt) <(tr ',' '\n' < /tmp/slice2-after1.txt)
```

Expected: `PASS`; `canonical documentation: OK`; and a diff showing exactly one
changed field — `documents` falling from 35 to **2**. Any other metric that moved
means something was disturbed — stop and report.

Then prove history followed, on three files chosen to span the alphabet. **Run this
after Step 8's commit, not here.** `git log --follow` traces rename history only
through committed history: against a staged-but-uncommitted rename it returns nothing
at all, whether or not the rename is correct. Post-commit is not a weaker place to run
it — it is the only place the check means anything.

```bash
for f in 00-product-brief 20-flow-catalog 40-phase1-discovery-outreach; do
  echo "--- $f ---"
  git log --follow --oneline -- "docs/legacy/$f.md" | tail -3
done
```

Expected for each: commits predating this branch. A history that begins at your own
commit means `git mv` did not register and the file was recorded as a new file —
stop and report.

Finally, confirm no live pointer to a moved file survives:

```bash
git ls-files | grep -v '^docs/legacy/\|^docs/superpowers/\|^migration/' \
  | xargs grep -l 'docs/0[0-46-9]-\|docs/1[0-9]-\|docs/2[0-13-9]-\|docs/3[0-9]-\|docs/4[0-9]-' 2>/dev/null
```

Expected: no output. The character classes deliberately exclude `docs/05-` (Task 2's)
and `docs/22-` (which does not move). If a file appears, read it and repoint it.

Three properties of this sweep were verified before this plan was written, so you can
trust its shape:

- Run today, before any move, it lists exactly the four files this task edits:
  `.github/workflows/ci.yml`, `TODOS.md`, `apps/demo/src/styles/fonts.css`,
  `scripts/validate_package.py`. The three files that point at `docs/05` are correctly
  absent — they are Task 2's.
- It does **not** match a path that has already moved: `docs/legacy/17-…` contains
  `docs/l`, not `docs/1`.
- Neither `docs/22-data-api-contract.md`, `docs/05-design-system.md` nor
  `docs/README.md` contains a reference to any moved document, so nothing that stays
  behind is left pointing into the archive.

- [ ] **Step 8: Commit**

```bash
git add -u
git add docs/legacy/
git status --porcelain
git commit -m "docs: move thirty-three numbered documents into docs/legacy/

The numbered layer was already orphaned — docs/README.md indexes not one of these
files, and twenty-two of the thirty-four are referenced by nothing live anywhere
in the repository. What it was not is demoted. docs/README.md:41 demotes only
files marked Historical or located under docs/legacy/, and these were neither, so
a reader who found one was formally entitled to treat it as an active source.

Nothing about the dispositions is new here. All thirty-four have carried an
approved disposition and a named successor in
migration/goproceed-canonical-v0.1/document-disposition.csv since 2026-07-30, and
the six with disposition 'archive' moved that day. What was missing was the
ability to move the rest: validate_package.py pinned them at exact paths and
crashed outright on an absent one. Slice 1 removed that hold; this spends it.

git mv throughout, so history follows every file — the legacy policy permits this
material to be used to recover a design rationale, which needs its history.

docs/05-design-system.md is not here. It is read by
packages/testing/src/token-fidelity.test.ts and moves with it in the next commit,
which is the ordering constraint slice 1's whole-branch review recorded as debt A.
Their internal cross-references stay stale by one directory, owner-confirmed:
editing preserved historical evidence to tidy its paths is what the legacy policy
exists to prevent."
```

`git status --porcelain` before committing must show 33 `R` entries plus the four
modified files, and the three untracked user directories. Nothing else.

---

### Task 2: Move `docs/05`, with the test that reads it

Slice 1's whole-branch review found this and recorded it as debt A: the move and the
test change must be **one commit**, because between them CI is red on an `ENOENT`.

**Files:**
- Move: `docs/05-design-system.md`
- Modify: `packages/testing/src/token-fidelity.test.ts`,
  `packages/tokens/src/tokens.json`, `packages/ui/src/base.css`

**Interfaces:**
- Consumes: the 33 files already at `docs/legacy/` from Task 1.
- Produces: `docs/legacy/05-design-system.md`, the last row Task 3's index needs.

- [ ] **Step 1: Confirm the test is green before you touch anything**

```bash
cd /Users/akisliy/Downloads/GoProceed
pnpm --filter @aktflow/testing exec vitest run src/token-fidelity.test.ts
```

Expected: all tests pass. **Do not run `pnpm turbo run test`** — that pulls in
packages blocked by a missing `exceljs`, unrelated to this work. **Do not run
`pnpm install`.** If this command cannot run at all, stop and report rather than
proceeding blind — this test is the only thing standing between this task and a red
CI.

- [ ] **Step 2: Move the file**

```bash
git mv docs/05-design-system.md docs/legacy/
```

- [ ] **Step 3: Repoint the test**

`packages/testing/src/token-fidelity.test.ts` currently reads:

```ts
    // docs/05-design-system.md:19-30. Parsed from the document rather than
    // copied, so adding a row there without adding a token fails here.
    const doc = readFileSync(join(repoRoot, "docs/05-design-system.md"), "utf8");
```

Replace with:

```ts
    // docs/legacy/05-design-system.md:19-30. Parsed from the document rather than
    // copied, so adding a row there without adding a token fails here. The document
    // is non-normative by location, but it remains the only place the twelve colour
    // names are written down, so this test still reads it rather than a successor.
    const doc = readFileSync(join(repoRoot, "docs/legacy/05-design-system.md"), "utf8");
```

Search the whole file for any other occurrence of `docs/05` and repoint it the same
way. Do not change the assertions, the regex, or the expected count of 12.

- [ ] **Step 4: Repoint `packages/tokens/src/tokens.json`**

One `ruling` string names the document:

```json
      "ruling": "agree — docs/05-design-system.md:19 and packages/ui/src/tokens.css:15 (--ink) are identical"
```

becomes

```json
      "ruling": "agree — docs/legacy/05-design-system.md:19 and packages/ui/src/tokens.css:15 (--ink) are identical"
```

**Search the whole file** — there are twelve token entries and more than one may
carry a `docs/05` path in its `ruling`. Repoint every occurrence. Change no `hex`, no
`alpha`, no `use`, and no key.

- [ ] **Step 5: Repoint `packages/ui/src/base.css`**

```css
   (docs/05-design-system.md), separate from the generated values they
```

becomes

```css
   (docs/legacy/05-design-system.md), separate from the generated values they
```

A comment. Touch no rule.

- [ ] **Step 6: Verify**

```bash
pnpm --filter @aktflow/testing exec vitest run src/token-fidelity.test.ts
python3 scripts/validate_package.py | grep -o "documents=[0-9]*"
node scripts/validate-canonical-docs.mjs
ls docs/*.md
```

Expected: the test passes with the same test count as Step 1; `documents=1`;
`canonical documentation: OK`; and `docs/*.md` listing exactly
`docs/22-data-api-contract.md` and `docs/README.md`.

Then mutation-check that the test genuinely reads the file at its new path, rather
than passing for some other reason:

```bash
mv docs/legacy/05-design-system.md /tmp/05-probe.md
pnpm --filter @aktflow/testing exec vitest run src/token-fidelity.test.ts; echo "exit=$?"
mv /tmp/05-probe.md docs/legacy/05-design-system.md
git status --porcelain
```

Plain `mv`, not `git mv` — git cannot move a tracked file out of the work tree, and
the point here is to make the file briefly absent, not to record anything.

Expected: the test **fails** with an `ENOENT` naming `docs/legacy/05-design-system.md`,
then the tree is clean again after the restore. A test that still passes with the file
absent is not reading it — stop and report.

Finally:

```bash
git ls-files | grep -v '^docs/legacy/\|^docs/superpowers/\|^migration/' \
  | xargs grep -ln 'docs/05-design-system' 2>/dev/null
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add -u
git status --porcelain
git commit -m "docs: move docs/05 and the one test that reads it, together

packages/testing/src/token-fidelity.test.ts does an unconditional readFileSync of
docs/05-design-system.md and asserts its colour table has exactly twelve rows.
Moving the document without the test reds CI on an ENOENT inside the test suite —
not in either documentation validator, and with nothing pointing back at the
decision that moved it. Slice 1's whole-branch review found that and recorded it
as debt A with exactly this ordering constraint: same commit, or not at all.

The test still reads the document rather than a successor, because none exists.
docs/05 has disposition 'defer' and no structured document yet writes down the
twelve colour names; the test's comment now says so, so the next reader does not
mistake the legacy path for an oversight.

docs/ root now holds two Markdown files: README.md and 22-data-api-contract.md,
whose disposition is 'keep'. The numbered layer is empty."
```

---

### Task 3: The index, and the claim that outlived its subject

**Files:**
- Modify: `docs/legacy/README.md`

**Interfaces:**
- Consumes: all 34 files present at `docs/legacy/NN-*.md` from Tasks 1 and 2. Every
  index link resolves only because they are already there.
- Produces: nothing.

- [ ] **Step 1: Generate the table rather than transcribing it**

The table is derived data — 34 rows, each quoting two free-text CSV columns verbatim.
Transcribing it by hand is how a map starts disagreeing with its territory. Generate
it:

```bash
cd /Users/akisliy/Downloads/GoProceed
python3 - <<'PY' > /tmp/slice2-index.md
import csv, os, posixpath
rows = list(csv.DictReader(open('migration/goproceed-canonical-v0.1/document-disposition.csv', encoding='utf-8')))
num = [r for r in rows
       if r['source_path'].startswith('docs/') and r['source_path'][5:7].isdigit()
       and r['disposition'] not in ('archive', 'keep')]
print("| Archived document | Disposition | Successor | Information moved | Information rejected |")
print("|---|---|---|---|---|")
missing = []
for r in sorted(num, key=lambda x: x['source_path']):
    base = r['source_path'].split('/')[-1]
    tgt = r['target_path']
    if not os.path.exists(tgt):
        missing.append(tgt)
    if not os.path.exists(os.path.join('docs/legacy', base)):
        missing.append('docs/legacy/' + base)
    moved = r['information_moved'].replace('|', '\\|')
    rejected = r['information_rejected'].replace('|', '\\|')
    print(f"| [`{base}`](./{base}) | `{r['disposition']}` | [`{tgt}`]({posixpath.relpath(tgt, 'docs/legacy')}) | {moved} | {rejected} |")
assert not missing, f"paths that do not exist: {sorted(set(missing))}"
assert len(num) == 34, f"expected 34 rows, got {len(num)}"
PY
head -5 /tmp/slice2-index.md
wc -l /tmp/slice2-index.md
```

Expected: **36** lines (34 rows plus two header lines), no assertion error, and the
first three rows looking exactly like this:

```
| [`00-product-brief.md`](./00-product-brief.md) | `rewrite` | [`docs/product/vision-and-positioning.md`](../product/vision-and-positioning.md) | positioning problem statement and target segment | unverified ROI and market-size claims |
| [`01-prd.md`](./01-prd.md) | `rewrite` | [`docs/product/scope-and-boundaries.md`](../product/scope-and-boundaries.md) | v0.1 in/out boundary and deferred contexts | 126-table single-release framing |
| [`03-personas-jtbd-workflows.md`](./03-personas-jtbd-workflows.md) | `rewrite` | [`docs/product/personas-and-workflows.md`](../product/personas-and-workflows.md) | actor separation and end-to-end workflows | rigid job-title role model |
```

The script asserts both that every successor exists and that every archived file is
where the row says it is, so it cannot emit a row that would red the link check. If
an assertion fires, the earlier tasks are incomplete — stop and report.

- [ ] **Step 2: Append the index to `docs/legacy/README.md`**

Add a new section at the end of the file. Write this prose, then paste the generated
table beneath it:

```markdown
## What is here, and what replaced it

Every numbered document in this directory was superseded by an approved disposition
recorded in
[`document-disposition.csv`](../../migration/goproceed-canonical-v0.1/document-disposition.csv).
The two right-hand columns are quoted from that file verbatim rather than summarised,
so this table and the disposition record cannot drift into disagreeing.

"Information rejected" is the column worth reading. A document is not here because it
was wrong about everything — it is here because a successor absorbed what survived
review, and the rest was rejected for a stated reason.

The six documents archived on 2026-07-30 carry disposition `archive`: nothing was
carried forward from them, and they have no successor beyond this policy. They are
not listed below.
```

Then the 34 rows.

- [ ] **Step 3: Correct the claim that outlived its subject**

`docs/legacy/README.md:28` reads:

```
- compare the implemented six-table foundation with prior intentions;
```

The foundation is 33 tables across 35 migrations. Slice 0 corrected this claim in five
documents and explicitly excluded `docs/legacy/` from its scope; this task edits the
file anyway, and it is a `Status: Approved` policy document rather than preserved
evidence. Replace with:

```
- compare the implemented runtime — 33 tables across 35 migrations — with prior
  intentions;
```

Verify the number before you write it rather than trusting this plan:

```bash
grep -rhoiE "^[[:space:]]*create table (if not exists )?[a-z0-9_.]+" supabase/migrations/*.sql | wc -l
ls -1 supabase/migrations/*.sql | wc -l
```

Expected: `33` and `35`. If either differs, write what you measured and say so.

Change nothing else in that file, including its `Last reviewed:` date — set that to
`2026-08-03`, since this task genuinely reviews and corrects it.

- [ ] **Step 4: Verify the index is real**

```bash
node scripts/validate-canonical-docs.mjs
python3 scripts/validate_package.py | grep -o "documents=[0-9]*"
grep -c '^| \[' docs/legacy/README.md
```

Expected: `canonical documentation: OK`; `documents=1`; **34** table rows.

Now mutation-check it. An index nobody can break is an index nobody is checking:

```bash
python3 - <<'PY'
import pathlib
p = pathlib.Path("docs/legacy/README.md")
s = p.read_text(encoding="utf-8")
p.write_text(s.replace("(../product/vision-and-positioning.md)", "(../product/does-not-exist.md)", 1), encoding="utf-8")
PY
node scripts/validate-canonical-docs.mjs; echo "exit=$?"
git checkout -- docs/legacy/README.md
```

Expected: **failure** naming `docs/legacy/README.md: broken relative link -> ../product/does-not-exist.md`, and `exit=1`. Then the restore. Paste the failure message into your report.

If it passes, the index is not being link-checked and the whole argument for putting
it in this file rather than in per-file banners is wrong — stop and report.

**Careful:** `git checkout --` after the mutation discards the file. Make the mutation
*after* you have committed nothing else uncommitted in it, or your Step 2 and Step 3
edits go with it. Safest order: make the edits, verify, `git add docs/legacy/README.md`,
then mutate, verify the failure, then `git checkout -- docs/legacy/README.md` — which
restores from the index, keeping your staged work.

- [ ] **Step 5: Commit**

```bash
git add docs/legacy/README.md
git commit -m "docs: put the supersession map inside docs/

Slice 0's design named the absence of this table as the reason docs/README.md
cannot answer which layer wins: the map existed, but it lived in
migration/goproceed-canonical-v0.1/document-disposition.csv, outside docs/
entirely. A reader landing on docs/legacy/09-security-compliance.md had no way to
learn what replaced it.

Thirty-four rows, each quoting the disposition record's information_moved and
information_rejected verbatim rather than summarising them, because a paraphrase
is how a map starts disagreeing with its territory. Generated from the CSV rather
than transcribed, with assertions that every successor and every archived file
exists, so a row that would red the link check cannot be emitted.

docs/legacy/README.md is in validate-canonical-docs.mjs's METADATA_DOCS, so every
link in this table is resolved on every run — mutation-checked here by breaking
one successor link and confirming the build goes red. That is the argument for an
index over thirty-four per-file banners: a banner cannot be validated, and thirty-
four copies of the same facts drift.

Also corrects this policy's own claim about a 'six-table foundation'. It is 33
tables across 35 migrations. Slice 0 fixed that sentence in five documents and
excluded docs/legacy/ from its scope; this file is Approved policy rather than
preserved evidence, and this task was editing it anyway."
```

---

### Task 4: The gate record

**Files:**
- Create: `docs/superpowers/plans/evidence/2026-08-03-docs-slice2-gate.md`

**Interfaces:**
- Consumes: the measurements from Tasks 1-3.
- Produces: nothing.

- [ ] **Step 1: Write it**

Follow the house style of
`docs/superpowers/plans/evidence/2026-08-03-docs-slice1-gate.md`, whose contract is
that every claim carries the command that reproduces it. It must contain:

- Branch, base commit, and the commits this slice produced.
- An evidence table: `node scripts/validate-canonical-docs.mjs`,
  `python3 scripts/validate_package.py`, the `token-fidelity.test.ts` run, and
  `make validate` / `pnpm typecheck` / `pnpm turbo run test` recorded as **NOT RUN**
  or **NOT PROVEN — environmental** with their reasons. **CI has not run** — nothing
  is pushed — and the record must say so.
- **The `documents=` sequence, 35 → 2 → 1**, which is the single number that says the
  layer is empty. Show the command.
- **The mutation checks, in full**: the broken index link, and the absent
  `docs/05-design-system.md` failing the test. These are the evidence; the PASS lines
  are the floor.
- **The `git log --follow` output** proving history survived the move.
- What the slice deliberately did not do: the eight stale cross-references inside the
  archived set and why, `docs/22`'s `keep` disposition, the rename, and the ten
  `technical/*.csv` files still carrying `defer` dispositions.

Two rules that override tidiness:

- **Never record a check you did not run.** If something could not run, write NOT RUN
  and the reason.
- **Self-referential counts go stale.** The commit count counts the commit that writes
  it. State it as of that commit and get it by adding one to
  `git log --oneline 9e632a7..HEAD | wc -l` *before* committing. This trap has been
  sprung five times across slices 0 and 1.

- [ ] **Step 2: Validate and commit**

```bash
node scripts/validate-canonical-docs.mjs
python3 scripts/validate_package.py
git add docs/superpowers/plans/evidence/2026-08-03-docs-slice2-gate.md
git commit -m "docs: record what slice 2 archived, and how it was proven

The evidence is not that the validators pass — they passed before this slice, over
thirty-four documents sitting in a directory the precedence rule could not demote.
The evidence is documents= falling 35 to 1, a broken index link reddening the
build, and token-fidelity.test.ts failing on the absent document it reads.

git log --follow output is included because the legacy policy permits this
material to be used to recover a design rationale, and a history that stopped at
the move would make it useless for that."
```

---

## Self-Review

**Spec coverage.** The 34 moves — Tasks 1 and 2. The seven live pointer files — Task 1
Steps 3-6 and Task 2 Steps 3-5. The index quoting the CSV verbatim — Task 3 Step 1-2.
The `docs/legacy/README.md` six-table correction — Task 3 Step 3. The `documents=`
35 → 1 evidence — Task 1 Step 7, Task 2 Step 6, restated in Task 4. The index link
mutation check — Task 3 Step 4. The `git log --follow` history check — Task 1 Step 7.
`token-fidelity.test.ts` passing — Task 2 Steps 1 and 6, with a mutation check that it
genuinely reads the file. The eight stale cross-references left alone — Global
Constraints, and nothing in any task touches an archived document's content.

**Placeholder scan.** No TBD or TODO. The one derived artifact — the 34-row index — is
produced by a generator given verbatim, with its expected row count and its first
three rows shown so the implementer can confirm the output's shape. That is
deliberate: hand-transcribing 34 rows of quoted free text is a worse instruction than
a script, because the failure mode is silent. Two steps require judgement rather than
transcription — Task 1 Step 6's `TODOS.md` normativity clause and Task 4's record —
and each says what the judgement is and what to report.

**Consistency.** `documents=` is the through-line and its expected value is stated at
every checkpoint: 35 at Task 1 Step 1, 2 at Task 1 Step 7, 1 at Task 2 Step 6 and Task
3 Step 4. Task 3's generator asserts the preconditions Tasks 1 and 2 establish, so it
cannot run early and silently emit broken rows. The `docs/05` exclusion is stated in
Task 1's header, its file list, its commit message, and again in Task 2's opening.
Line numbers appear only as a starting index; every step locates its target by quoted
content, because Tasks 1 and 2 shift line numbers in `scripts/validate_package.py` and
`docs/legacy/README.md` before later steps read them.
