# Documentation slice 1 — retire the hold, keep the gate — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `scripts/validate_package.py` from pinning the numbered
documentation layer in place, without losing the assertions that keep the
`technical/` v2.9 artifacts mutually consistent; give the canonical structured
layer its first CI gate; and land slice 0's deferred `docs/22:130` correction.

**Architecture:** Five surgical edits to one Python file, one CI step, one
Makefile target, one sentence, and two records. Nothing is created except the
records; nothing moves.

**Tech Stack:** Python 3.12 (`scripts/validate_package.py`), Node 24
(`scripts/validate-canonical-docs.mjs`), GNU make, GitHub Actions, pnpm 9.

## Global Constraints

- **Branch:** `claude/docs-slice1-gate`, from `claude/docs-slice0-truth` @
  `e00372c`. Do not rebase. Do not merge slice 0.
- **Zero file moves.** No `git mv`, no archiving. The only new files are the two
  records in Task 5. A mutation check that moves a file must restore it.
- **The gate goes in before anything comes out.** Task 1 adds the canonical
  validator to CI. Every later task removes assertions. That order is the whole
  safety argument and must not be inverted.
- **No commit may be red or ungated.** The design called for one commit; this
  plan achieves the same property by ordering, and more strictly — the gate
  precedes every removal, which a single commit cannot express. Each task's
  commit is independently green.
- **`docs/22-data-api-contract.md:130` is the only documentation sentence this
  slice edits.** Not `:172`, not any other line, not any other file.
- **Do not touch the AktFlow→GoProceed rename.** `docs/22:130` ends with "absent
  from the AktFlow domain API". Leave that clause exactly as it is — the rename
  is a later slice with its own approach, and changing one instance here creates
  an inconsistency that slice then has to find.
- **Do not rename `scripts/validate_package.py`** or the `package-validate` CI
  job. Only its module docstring changes.
- **Do not touch the `package-validate` job's prototype half**, or
  `Makefile:validate-prototype` / `validate-qa`.
- **Run `python3 scripts/validate_package.py` directly, NOT `make validate`.**
  `make validate` also runs `validate-prototype`, which shells out to `eslint`
  and fails with `eslint: command not found` in a checkout where `prototype/`'s
  dependencies are not installed. That failure is unrelated to this work and
  predates the branch. Baseline confirmed 2026-08-03 at `e00372c`: the package
  validator alone exits 0 with `PASS (required_artifacts=69, documents=35, …)`.
- **`pnpm typecheck` and `pnpm turbo run test` cannot run in this checkout.**
  `exceljs@4.4.0` is declared in `packages/domain/package.json` and present in
  `pnpm-lock.yaml` but absent from the installed tree, from a commit predating
  slice 0's base. Reconciling it needs a full `pnpm install` accepting a modules
  purge across all 11 workspace projects. **Do not attempt an install.** No task
  in this plan touches TypeScript, so neither gate is evidence for it.

## What must not be touched

| Protected | Where | Why |
|---|---|---|
| The link-resolution sweep over `README.md` + `docs/*.md` + `prototype/README.md` | `validate_package.py:234-246` | Owner-confirmed keep, 2026-08-03. It is a glob and pins nothing; it is also the only check that resolves links inside the numbered layer, and slices 2-7 are a sustained file-moving exercise. |
| Every `technical/` assertion | `validate_package.py`, everywhere else | The reason this slice trims rather than deletes. |
| `Tenant bearer tokens and tenant permissions never authorize these operations` | `docs/22:172` | Its *assertion* is removed in Task 3; the sentence itself stays in the document. |
| The `### S01`…`### S42` and `## N. F01`…`F22` heading sets | `docs/04`, `docs/20` | Their assertions move to constants in Task 2. Do not edit the headings themselves. |

## File Structure

| File | What changes | Task |
|---|---|---|
| `.github/workflows/ci.yml` | one step added to the `verify` job | 1 |
| `Makefile` | `validate-canonical` target, added to `validate` | 1 |
| `scripts/validate_package.py` | vocabularies become constants | 2 |
| `scripts/validate_package.py` | `required_files`, contiguity, test sweep, 8 prose assertions | 3 |
| `scripts/validate_package.py` | the `docs/22:130` allowlist assertion | 4 |
| `docs/22-data-api-contract.md` | line 130 | 4 |
| `docs/superpowers/plans/evidence/2026-08-03-docs-slice1-invariant-debt.md` | new | 5 |
| `docs/superpowers/plans/evidence/2026-08-03-docs-slice1-gate.md` | new | 5 |

---

### Task 1: The gate goes in first

Nothing is removed in this task. It exists so that every removal in Tasks 2-4
happens with the canonical structured layer already under CI enforcement — which
it has never been.

**Files:**
- Modify: `.github/workflows/ci.yml` (the `verify` job)
- Modify: `Makefile`

**Interfaces:**
- Consumes: nothing.
- Produces: a green `pnpm validate:canonical-docs` step in CI that Tasks 2-4 rely
  on as their standing gate.

- [ ] **Step 1: Confirm the validator is wired into nothing today**

```bash
cd /Users/akisliy/Downloads/GoProceed
grep -rn "validate:canonical-docs\|validate-canonical-docs" .github/ Makefile package.json turbo.json
```

Expected: exactly one hit, `package.json:13`, the script declaration. If any
other hit appears, stop and report — the premise of this task is wrong.

- [ ] **Step 2: Add the CI step**

In `.github/workflows/ci.yml`, in the `verify` job, immediately after the
`- run: pnpm install --frozen-lockfile` line and **before** the
`- uses: supabase/setup-cli@…` step, insert:

```yaml
      # Documentation gate. Runs before the Supabase steps, which are allowed
      # fifteen minutes, so a documentation failure reports in about a minute
      # rather than after a full local-stack boot. Needs no database and no
      # build — it reads the tree.
      - run: pnpm validate:canonical-docs
```

Match the surrounding indentation exactly: six spaces before `- run:`.

- [ ] **Step 3: Add the Makefile target**

`Makefile` currently reads:

```make
.PHONY: validate validate-contracts validate-prototype validate-qa

validate: validate-prototype validate-qa validate-contracts

validate-contracts:
	python3 scripts/validate_package.py
```

Change the first two lines and add the new target, so local `make validate` and
CI agree about what a documentation gate is:

```make
.PHONY: validate validate-canonical validate-contracts validate-prototype validate-qa

validate: validate-canonical validate-prototype validate-qa validate-contracts

validate-canonical:
	node scripts/validate-canonical-docs.mjs

validate-contracts:
	python3 scripts/validate_package.py
```

`validate-canonical` runs first in the aggregate for the same reason it runs
first in CI: it is the cheapest check.

**Recipe lines must start with a literal TAB, not spaces.** Verify with
`cat -A Makefile | grep 'validate-canonical' -A1` — the recipe line must begin
with `^I`.

- [ ] **Step 4: Verify both entry points**

```bash
node scripts/validate-canonical-docs.mjs
make validate-canonical
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('ci.yml parses')"
```

Expected: `canonical documentation: OK` twice, then `ci.yml parses`. If PyYAML
is unavailable, use `node -e` with no YAML library available either — in that
case skip the parse check and say so in your report rather than claiming it ran.

Then confirm the step landed in the right job and the right place:

```bash
grep -n -B2 -A2 "pnpm validate:canonical-docs" .github/workflows/ci.yml
awk '/^  verify:/,/^  demo-qa:/' .github/workflows/ci.yml | grep -n "pnpm install --frozen-lockfile\|validate:canonical-docs\|supabase/setup-cli"
```

Expected from the second command: three hits in that order — install, then
validate, then setup-cli.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml Makefile
git commit -m "ci: give the canonical documentation layer its first gate

pnpm validate:canonical-docs has been declared in package.json since the
canonical package landed and wired into nothing — not CI, not the Makefile, not
turbo. The structured layer that docs/README.md says wins had no enforcement at
all, while the numbered layer it supersedes had 316 assertions.

The step runs immediately after install and before supabase start, which is
allowed fifteen minutes: a documentation failure now reports in about a minute
instead of after a full local-stack boot.

This lands before slice 1 removes anything, deliberately. Every assertion the
next three commits take off the numbered layer comes off with this gate already
standing."
```

---

### Task 2: Three documents stop being inputs

`docs/04`, `docs/20` and `docs/30` are not merely asserted upon — the validator
reads their headings to build the `S`, `F` and `V` vocabularies, then validates
`technical/` artifacts against them. Deleting the reads would silently disable
five closure checks. The validator already pins each set to a literal range, so
the constants are provably equivalent.

**Files:**
- Modify: `scripts/validate_package.py:749-754`, `:2289-2292`

**Interfaces:**
- Consumes: nothing.
- Produces: `flow_ids`, `screen_ids`, `external_gates` as module-level constant
  sets with identical contents. Tasks 3-5 do not touch them. Five existing call
  sites keep using the same names: `:804` (`x-flow-id`), `:1735`
  (`ui-actions.csv` `screen_id`), `:2316`, `:2332`, `:2333` (`traceability.csv`).

- [ ] **Step 1: Prove the equivalence before relying on it**

```bash
cd /Users/akisliy/Downloads/GoProceed
python3 - <<'PY'
import re, pathlib
DOCS = pathlib.Path("docs")
flow = set(re.findall(r"^##\s+\d+\.\s+(F\d{2})\b", (DOCS/"20-flow-catalog.md").read_text(encoding="utf-8"), re.M))
screen = set(re.findall(r"^###\s+(S\d{2})\b", (DOCS/"04-screen-specification.md").read_text(encoding="utf-8"), re.M))
gates = set(re.findall(r"^\|\s*(V-\d{3})\s*\|", (DOCS/"30-validation-evidence-register.md").read_text(encoding="utf-8"), re.M))
print("flow   ==", flow   == {f"F{i:02d}"  for i in range(1, 23)}, len(flow))
print("screen ==", screen == {f"S{i:02d}"  for i in range(1, 43)}, len(screen))
print("gates  ==", gates  == {f"V-{i:03d}" for i in range(1, 13)}, len(gates))
PY
```

Expected: `True 22`, `True 42`, `True 12`. All three must be `True`. If any is
`False`, **stop and report** — the constant would not be equivalent and this task's
premise is wrong.

- [ ] **Step 2: Replace the flow and screen vocabularies**

`scripts/validate_package.py:749-754` currently reads:

```python
flow_doc = (DOCS / "20-flow-catalog.md").read_text(encoding="utf-8")
flow_ids = set(re.findall(r"^##\s+\d+\.\s+(F\d{2})\b", flow_doc, re.MULTILINE))
screen_doc = (DOCS / "04-screen-specification.md").read_text(encoding="utf-8")
screen_ids = set(re.findall(r"^###\s+(S\d{2})\b", screen_doc, re.MULTILINE))
require(flow_ids == {f"F{index:02d}" for index in range(1, 23)}, "flow catalog must define exactly F01..F22")
require(screen_ids == {f"S{index:02d}" for index in range(1, 43)}, "screen specification must define exactly S01..S42")
```

Replace all six lines with:

```python
# Flow and screen vocabularies. These were derived from docs/20's and docs/04's
# headings and then asserted to equal exactly these ranges — so the range WAS
# the vocabulary, and reading the documents only re-confirmed it. Held as
# constants now, because those documents are moving (slices 2-7) and the
# technical/ closure checks below must not move with them.
#
# Consumed by: openapi.yaml x-flow-id (below), ui-actions.csv screen_id, and
# traceability.csv's flow/screen columns including full flow coverage.
flow_ids = {f"F{index:02d}" for index in range(1, 23)}
screen_ids = {f"S{index:02d}" for index in range(1, 43)}
```

- [ ] **Step 3: Replace the external-gate vocabulary**

`scripts/validate_package.py:2289-2292` currently reads:

```python
external_register_text = (DOCS / "30-validation-evidence-register.md").read_text(encoding="utf-8")
external_gates = set(re.findall(r"^\|\s*(V-\d{3})\s*\|", external_register_text, re.MULTILINE))
require(external_gates == {f"V-{index:03d}" for index in range(1, 13)}, "validation register must define exactly V-001..V-012")
require("all V-001–V-012 remain `unvalidated`" in external_register_text, "validation register must preserve explicit unvalidated status")
```

Replace all four lines with:

```python
# External validation gates, same reasoning as flow_ids/screen_ids above.
# Consumed by traceability.csv's external_gates column and by the metrics line.
external_gates = {f"V-{index:03d}" for index in range(1, 13)}
```

The fourth line — the prose assertion that docs/30 still says the gates remain
`unvalidated` — goes with it. That assertion is documentation-pinning, and the
"NOT PROVEN" line the validator prints at the end is a hardcoded string that
does not depend on it.

- [ ] **Step 4: Run the validator**

```bash
python3 scripts/validate_package.py
```

Expected: `PASS`, with **every metric identical to the baseline**, including
`external_gates_unvalidated=12` and `documents=35`. Paste the full metric line
into your report. Any metric that moved means a check was disabled rather than
rewired — stop and report.

- [ ] **Step 5: Mutation-check that the closure assertions still bite**

A constant that is never compared is indistinguishable from a deleted check.
Prove all three vocabularies are still load-bearing, one at a time, restoring
after each:

```bash
# 1. openapi.yaml x-flow-id closure (validate_package.py:804)
python3 - <<'PY'
import pathlib
p = pathlib.Path("technical/openapi.yaml"); s = p.read_text(encoding="utf-8")
i = s.index("x-flow-id:")
p.write_text(s[:i] + s[i:].replace("F0", "F9", 1), encoding="utf-8")
PY
python3 scripts/validate_package.py; echo "exit=$?"
git checkout -- technical/openapi.yaml

# 2. ui-actions.csv screen_id closure (validate_package.py:1735)
python3 - <<'PY'
import pathlib
p = pathlib.Path("technical/ui-actions.csv"); lines = p.read_text(encoding="utf-8").split("\n")
lines[1] = lines[1].replace("S0", "S9", 1)
p.write_text("\n".join(lines), encoding="utf-8")
PY
python3 scripts/validate_package.py; echo "exit=$?"
git checkout -- technical/ui-actions.csv

# 3. traceability.csv external_gates closure (validate_package.py:2332)
#    NOTE: row 2 has external_gates = 'none', so mutate the first row that
#    actually carries a gate — currently line 5, REQ-IMPORT-01. Targeting row 2
#    would be a silent no-op and would make a live check look dead.
python3 - <<'PY'
import pathlib
p = pathlib.Path("technical/traceability.csv"); lines = p.read_text(encoding="utf-8").split("\n")
i = next(n for n, line in enumerate(lines) if "V-0" in line)
lines[i] = lines[i].replace("V-0", "V-9", 1)
print("mutated line", i + 1)
p.write_text("\n".join(lines), encoding="utf-8")
PY
python3 scripts/validate_package.py; echo "exit=$?"
git checkout -- technical/traceability.csv
```

If any mutation script prints nothing or raises `StopIteration`, the token it
looked for is not where the plan expected — find a real one and say what you
used. A mutation that silently changes nothing produces a PASS that looks like a
dead check.

Expected for each: `FAILED` and `exit=1`, naming the unknown identifier. Paste
all three failure messages into your report.

If a mutation produces PASS, that check is dead and this task has broken
something — stop and report. If a mutation fails for an unrelated reason (a
malformed row rather than an unknown identifier), adjust the mutation so it
produces a *valid but unknown* identifier and say what you changed.

Then confirm the tree is clean before committing:

```bash
git status --porcelain -- technical/
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add scripts/validate_package.py
git commit -m "refactor(validate): the S/F/V vocabularies are ranges, not documents

docs/04, docs/20 and docs/30 were inputs to this validator, not just subjects of
it: their headings built the screen, flow and validation-gate vocabularies, and
five technical/ closure checks were validated against those sets — openapi.yaml's
x-flow-id, ui-actions.csv's screen_id, and traceability.csv's flow, screen and
gate columns.

Deleting the reads would have disabled those five checks silently. But the
validator already asserted each set equal to a literal range, so the range was
the vocabulary all along and the documents only re-confirmed it. Held as
constants now, ahead of the slices that move those documents.

Mutation-checked rather than assumed: an unknown x-flow-id, an unknown screen_id
and an unknown gate each still fail the build. Every metric is unchanged."
```

---

### Task 3: The hold comes off

**Files:**
- Modify: `scripts/validate_package.py:98-135` (`required_files`), `:180-232`
  (contiguity), `:248-265` (prose assertions), `:2354-2374` (test sweep), `:1-12`
  (docstring)

**Interfaces:**
- Consumes: `flow_ids`, `screen_ids`, `external_gates` as constants from Task 2 —
  do not reintroduce a document read for any of them.
- Produces: a validator whose only remaining coupling to `docs/*.md` is the link
  sweep at `:234-246`, which is kept deliberately.

- [ ] **Step 1: Record the baseline you must not disturb**

```bash
cd /Users/akisliy/Downloads/GoProceed
python3 scripts/validate_package.py | tee /tmp/slice1-before.txt
```

Paste the metric line into your report. After this task every metric must be
identical except `required_artifacts`, which falls by exactly 34, from 69 to
35. Not to 34 — the deleted comprehension holds 34 `(index, name)` pairs, and
`documents=35` is unchanged because `docs/40-phase1-discovery-outreach.md` is on
disk and numbered but was never in `required_files`.

- [ ] **Step 2: Remove the 35 numbered documents from `required_files`**

In `scripts/validate_package.py`, `required_files` begins at `:98` with
`ROOT / "README.md"` and `ROOT / "Makefile"`, then contains a generator
comprehension `*(DOCS / f"{index:02d}-{name}.md" for index, name in [...])`
listing 35 `(index, name)` pairs from `(0, "product-brief")` to
`(36, "security-verification-profile")`, then `*(TECH / filename for filename in [...])`.

**Delete the entire `*(DOCS / …)` comprehension including its 35-pair list.**
Keep `README.md`, `Makefile`, and every `TECH /` entry and anything after them
exactly as they are.

In its place put:

```python
    # The numbered docs/NN-*.md layer is deliberately absent. It carried an
    # approved disposition for all 41 files (migration/goproceed-canonical-v0.1/
    # document-disposition.csv) before this validator stopped requiring it, and
    # pinning a path is what made archiving one a validator edit. Their links
    # are still checked below; their existence is not required here.
```

- [ ] **Step 3: Remove the numbered-index contiguity contract**

Delete `scripts/validate_package.py:180-231` — the comment block beginning
`# Numbered documentation contract.`, the `numbered_docs` / `malformed_docs`
loop, all four `require(...)` calls it feeds (malformed prefix, at-least-one,
duplicate indices, contiguous sequence), the `ARCHIVED_DOC_INDICES` set, and the
`doc_numbers = sorted(numbered_docs)` line.

`doc_numbers` is consumed at `:2420` as `"documents": len(doc_numbers)`, so it
must survive as a plain count. Put this in place of the deleted block:

```python
# How many numbered docs/NN-*.md exist. An observation for the metrics line, not
# a contract: nothing here requires a particular set, a contiguous sequence or a
# minimum. The count should fall on its own as slices 2-7 archive documents,
# rather than obliging anyone to edit a number or extend an exception set.
doc_numbers = sorted(
    int(match.group(1))
    for path in DOCS.glob("*.md")
    if (match := re.match(r"(\d{2})(?=-)", path.name))
)
```

Leave `from collections import Counter, defaultdict` at `:15` alone —
`defaultdict` is used at six other sites.

- [ ] **Step 4: Remove the eight prose assertions**

Delete `scripts/validate_package.py:248-265`: the seven `…_text` reads of
`docs/01`, `docs/19`, `docs/22`, `docs/07`, `docs/12`, `docs/28` and `docs/18`,
the eight `require(...)` calls that follow them, and the
`for money_algorithm_marker in (...)` loop.

Do **not** delete the link-sweep block immediately above it (`:234-246`,
beginning `link_pattern = re.compile(...)`). It is owner-confirmed to stay.

In place of the deleted block:

```python
# Eight prose assertions on docs/01, 07, 12, 18, 19, 22 and 28 stood here. They
# guarded product invariants — universal live-Pilot MFA, terminal project
# archive, no generic evidence delete, GA-forward assignment grouping, the
# platform-billing authority split, the Next.js security floor, the honest solo
# delivery ranges, and the four money-concurrency markers — by asserting a
# literal substring inside a named file. Every one of those files has an
# approved disposition and is moving.
#
# They are not absorbed silently. Each is listed with the structured document
# that must re-assert it in docs/superpowers/plans/evidence/
# 2026-08-03-docs-slice1-invariant-debt.md, which is this slice's obligation on
# the slices that write those successors.
```

- [ ] **Step 5: Scope the global test-reference sweep**

At `scripts/validate_package.py:2355`, this line sweeps the numbered layer:

```python
reference_files = [ROOT / "README.md", *DOCS.glob("*.md"), *TECH.glob("*.csv")]
```

Replace it with:

```python
# Scoped off docs/*.md deliberately. Archiving a numbered document orphaned
# whatever tests only it referenced, which is exactly how the ten-entry
# ARCHIVED_BACKLOG_TEST_REFS allowlist below came to exist. Measured on
# 2026-08-03: 134 of the 149 catalogued tests are referenced from README.md or
# technical/*.csv and are unaffected by this narrowing; the five that were
# referenced only from a numbered document are named in
# DOC_ONLY_TEST_REFS below rather than disappearing into the count.
reference_files = [ROOT / "README.md", *TECH.glob("*.csv")]
```

Then extend the allowlist. `ARCHIVED_BACKLOG_TEST_REFS` at `:2365-2370` stays
exactly as it is; add a second named set immediately after its closing brace,
and widen the `require` that follows to include it:

```python
# Referenced only from a numbered document at the time this validator stopped
# sweeping that layer (measured 2026-08-03). Named individually, with the file
# that referenced each, so the slice that rewrites docs/26 and docs/27 knows
# precisely what to carry into their successors instead of finding a count that
# quietly went down.
DOC_ONLY_TEST_REFS = {
    "T-ADAPTER-001",             # docs/27-qa-traceability.md
    "T-BUSINESS-CALENDAR-001",   # docs/27-qa-traceability.md
    "T-PILOT-ADMISSION-001",     # docs/27-qa-traceability.md
    "T-STATE-REACHABILITY-001",  # docs/27-qa-traceability.md
    "T-DEPLOY-SMOKE-001",        # docs/26-sre-operations.md
}
require(
    tests <= (global_test_refs | ARCHIVED_BACKLOG_TEST_REFS | DOC_ONLY_TEST_REFS),
    f"test-catalog.csv: orphan tests {sorted(tests - global_test_refs - ARCHIVED_BACKLOG_TEST_REFS - DOC_ONLY_TEST_REFS)}",
)
```

Locate the existing `require(...)` by its content (`tests <= (global_test_refs |`)
and replace it, rather than by line number — Steps 2-4 have already shifted every
line below them.

- [ ] **Step 6: Correct the module docstring**

Read `scripts/validate_package.py:1-12` and update the description so it states
what the script validates now: the `technical/` machine-readable contract set,
the OpenAPI surface, the prototype's critical routes, and links across
`README.md`, `docs/*.md` and `prototype/README.md` — and that it no longer
asserts the numbered documentation layer's shape, contents or existence. Keep
the shebang and any existing usage line. Do not rename the file.

- [ ] **Step 7: Verify nothing but `required_artifacts` moved**

```bash
python3 scripts/validate_package.py | tee /tmp/slice1-after.txt
diff <(tr ',' '\n' < /tmp/slice1-before.txt) <(tr ',' '\n' < /tmp/slice1-after.txt)
```

Expected: `PASS`, and a diff showing exactly one changed field —
`required_artifacts` falling from 69 to 35. `documents=35` must be unchanged,
because 35 numbered documents still exist; it is now counted rather than
required. Paste the diff into your report.

- [ ] **Step 8: The mutation check — this is the task's actual evidence**

Everything above proves the validator still passes. This proves the hold is gone.

```bash
git stash list > /tmp/stash-before.txt
mkdir -p docs/legacy
git mv docs/23-offline-media-protocol.md docs/legacy/23-offline-media-protocol.md
python3 scripts/validate_package.py; echo "exit=$?"
```

Expected: `PASS`, `exit=0`. Today's validator fails here — on the missing
required artifact, on the broken index-23 contiguity, and possibly on orphaned
tests. If it fails now, **the hold is not gone**: read the failure, fix the cause,
and repeat.

The link sweep may legitimately report broken links from the moved file, because
its relative paths changed. That is the kept check doing its job and is not a
failure of this task — if it fires, record the exact message in your report,
then restore and note that the sweep is proven live.

Restore unconditionally, and prove you did:

```bash
git mv docs/legacy/23-offline-media-protocol.md docs/23-offline-media-protocol.md
git status --porcelain
python3 scripts/validate_package.py
```

Expected: `git status --porcelain` shows only `M  scripts/validate_package.py`
plus the pre-existing untracked `.agents/`, `.gstack/` and `skills-lock.json`,
and the validator prints `PASS`. **`.agents/`, `.gstack/` and `skills-lock.json`
are user-added — never stage, commit, move or delete them.**

- [ ] **Step 9: Confirm the canonical gate still passes**

```bash
node scripts/validate-canonical-docs.mjs
```

Expected: `canonical documentation: OK`.

- [ ] **Step 10: Commit**

```bash
git add scripts/validate_package.py
git commit -m "refactor(validate): stop requiring the numbered layer to stand still

Four mechanisms held docs/NN-*.md in place: required_files pinned all 35 at exact
paths; a contiguity contract required indices 00..36 with a hand-maintained
six-entry archive exception; eight assertions required literal substrings inside
seven of them; and the global test-reference sweep read the whole layer, so
archiving a document orphaned whatever tests only it referenced.

All four are gone. What replaces them is narrower and honest: the document count
is now an observation rather than a contract, and the five tests that were
referenced only from docs/26 and docs/27 are named in DOC_ONLY_TEST_REFS with
their source file rather than vanishing into a total. The eight product
invariants are recorded as debt against the structured documents that must
re-assert them.

The link sweep over README.md, docs/*.md and prototype/README.md stays,
owner-confirmed: it is a glob, it pins nothing, and it is the only check that
resolves links inside the numbered layer that slices 2-7 are about to move.

Evidence is a mutation check, not a green run: with docs/23 moved to
docs/legacy/, this validator passes where the previous one failed. Every metric
is unchanged except required_artifacts, 69 -> 35."
```

---

### Task 4: The deferred correction lands

This is the pairing slice 0 could not make. Removing the assertion and correcting
the sentence must be the same commit: the assertion first makes the build red the
moment the sentence changes, and the corrected sentence makes the assertion fail
the moment it lands.

**Files:**
- Modify: `scripts/validate_package.py` (the `count_statement` block, `:1718-1721`
  before Tasks 2-3 shifted it)
- Modify: `docs/22-data-api-contract.md:130`

**Interfaces:**
- Consumes: nothing from Tasks 1-3 beyond a green tree.
- Produces: nothing. This is the last functional change.

- [ ] **Step 1: Measure both numbers yourself**

```bash
cd /Users/akisliy/Downloads/GoProceed
echo -n "scope-v0.1.csv operations: "; tail -n +2 technical/openapi/scope-v0.1.csv | grep -c .
echo "openapi.yaml x-release tally:"; grep -A1 "x-release" technical/openapi.yaml | grep -oE "Pilot|GA" | sort | uniq -c
```

Expected: `51`, then `44 GA` and `113 Pilot`. The corrected sentence states all
three, so all three must come from this run and not from this plan. If any
differs, use what you measured and say so in your report.

- [ ] **Step 2: Remove the assertion**

Find this block in `scripts/validate_package.py` by content — its line number has
moved:

```python
count_statement = re.search(r"exact allowlist:\s*(\d+) Pilot and (\d+) GA-forward", (DOCS / "22-data-api-contract.md").read_text(encoding="utf-8"))
require(count_statement is not None, "docs/22: exact OpenAPI release count statement missing")
if count_statement:
    require((release_counts["Pilot"], release_counts["GA"]) == tuple(map(int, count_statement.groups())), "docs/22: OpenAPI Pilot/GA operation counts are stale")
```

`release_counts` has exactly three references — its `Counter()` at `:757`, its
increment at `:803`, and this assertion. Deleting the assertion outright would
leave a tally that is built on every run and never read. So the assertion is not
deleted but **repointed at the artifact instead of at the prose** — which is this
slice's whole thesis in four lines:

```python
# This was an assertion about a sentence in docs/22, comparing release_counts to
# two numbers regexed out of prose. The prose moved; the tally did not stop being
# worth checking. Repointed at openapi.yaml itself: every operation must carry an
# x-release that lands in one of the two buckets, so the buckets must sum to the
# operation count. Deleting it outright would have left release_counts built on
# every run and read by nothing.
require(
    release_counts["Pilot"] + release_counts["GA"] == len(operations),
    "openapi.yaml: every operation must declare x-release Pilot or GA; "
    f"{release_counts['Pilot']} + {release_counts['GA']} != {len(operations)} operations",
)
```

Verify the new assertion is true before committing, and that it is live rather
than vacuous:

```bash
grep -n "release_counts" scripts/validate_package.py
python3 scripts/validate_package.py | grep -o "api_operations=[0-9]*"
```

Expected: four references now (`Counter()`, the increment, and the two inside the
new `require`), and `api_operations=157` — which must equal 113 + 44 from Step 1.
If the sum does not match the operation count, **stop and report**: either an
operation carries no `x-release`, or one carries a third value, and both are
findings worth more than this task.

- [ ] **Step 3: Correct the sentence**

`docs/22-data-api-contract.md:130` currently reads, in full:

```
`technical/openapi.yaml` v2.9 is the exact allowlist: 113 Pilot and 44 GA-forward operations at this revision. An endpoint name in prose is not authorization to implement it. Supabase owns sign-in/session primitives; therefore `/me` and raw session/token operations are intentionally absent from the AktFlow domain API.
```

Replace it with:

```
`technical/openapi/scope-v0.1.csv` is the exact v0.1 allowlist: 51 operations. `technical/openapi.yaml` v2.9 is the wider target surface — 157 operations, 113 Pilot and 44 GA-forward at this revision — and is not authorization to implement anything in v0.1. An endpoint name in prose is not authorization to implement it either. Supabase owns sign-in/session primitives; therefore `/me` and raw session/token operations are intentionally absent from the AktFlow domain API.
```

Three things about this replacement:

- The 113/44 figures survive because they are exact. Only the authority claim was
  wrong.
- The final clause is unchanged, **including "the AktFlow domain API"**. The
  rename is a later slice with its own approach; changing one instance here would
  leave that slice an inconsistency to hunt.
- Do not touch `:172` or any other line of this file.

- [ ] **Step 4: Verify the pairing from both directions**

```bash
python3 scripts/validate_package.py
node scripts/validate-canonical-docs.mjs
grep -n "scope-v0.1.csv\` is the exact v0.1 allowlist" docs/22-data-api-contract.md
grep -rn "is the exact allowlist" docs/ --include=*.md | grep -v "docs/superpowers/\|docs/legacy/"
```

Expected: `PASS`; `canonical documentation: OK`; one hit on line 130; and **no
hits** for the old phrasing.

Then prove the assertion really is gone rather than merely passing, by checking
that the old sentence would now be accepted too:

```bash
git stash push -- docs/22-data-api-contract.md
python3 scripts/validate_package.py; echo "exit=$?"
git stash pop
```

Expected: `PASS`, `exit=0` — the validator no longer has an opinion about that
sentence in either direction. Confirm `git diff --stat` shows
`docs/22-data-api-contract.md` restored with one changed line before continuing.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate_package.py docs/22-data-api-contract.md
git commit -m "docs: scope-v0.1.csv is the v0.1 allowlist, not openapi.yaml v2.9

Slice 0 measured this sentence wrong and could not correct it: validate_package.py
regexed its Pilot/GA numbers out of the prose and compared them to openapi.yaml,
so rewriting it reddened CI, and slice 0's constraint was zero CI changes. That
is why the assertion and the correction land together here — either alone is a
broken state.

The owner ruled technical/openapi/scope-v0.1.csv the v0.1 contract. Measured
today: 51 operations there, against openapi.yaml's 157 (113 Pilot + 44
GA-forward). The 113/44 arithmetic was never the problem and survives verbatim;
the authority claim around it did not.

The assertion is repointed rather than deleted. It compared release_counts to two
numbers regexed out of prose; it now requires the Pilot and GA buckets to sum to
the operation count, so an operation with a missing or unrecognised x-release
still fails. Deleting it outright would have left release_counts built on every
run and read by nothing. What stopped being checked is a documentation sentence,
which is the point."
```

---

### Task 5: The records

Two files. The first is an obligation on later slices; the second is this slice's
gate record. Follow the house style of
`docs/superpowers/plans/evidence/2026-08-03-docs-slice0-gate.md`, whose contract
is that every claim carries the command that reproduces it.

**Files:**
- Create: `docs/superpowers/plans/evidence/2026-08-03-docs-slice1-invariant-debt.md`
- Create: `docs/superpowers/plans/evidence/2026-08-03-docs-slice1-gate.md`

**Interfaces:**
- Consumes: the measurements and command output from Tasks 1-4.
- Produces: nothing.

- [ ] **Step 1: Write the invariant-debt record**

One row per invariant removed in Task 3 Step 4, each with: the exact string that
was asserted, the file it was asserted in, the assertion's original line number
in `validate_package.py`, and the structured document that must re-assert it.

```markdown
| Invariant | Was asserted in | Must be re-asserted in |
|---|---|---|
| `MFA обязательно для каждого пользователя с live Pilot data` | `docs/01` | `docs/architecture/tenancy-and-security.md` |
| `Project archive is immutable and terminal`; `There is no in-place restore` | `docs/01` | `docs/product/scope-and-boundaries.md` |
| `Evidence has no generic delete action`, and `soft-deleted` must stay **absent** | `docs/01` | `docs/domain/execution-and-evidence.md` |
| `GA-forward assignment grouping only` | `docs/19` | `docs/architecture/tenancy-and-security.md` |
| `Tenant bearer tokens and tenant permissions never authorize these operations` | `docs/22` | `docs/architecture/tenancy-and-security.md` |
| `Next.js **16.2.11 or newer security-patched 16.2.x**` | `docs/07` | `docs/architecture/system-overview.md` |
| `Safe first live Pilot (months 5–9)`; `Safe standalone GA (months 10–18+)`; `safe first live Pilot: 6–9 months solo`; `safe standalone GA: 12–18+ months solo` | `docs/12`, `docs/28` | `docs/product/roadmap.md` |
| `PostgreSQL \`SERIALIZABLE\``; `SELECT ... FOR UPDATE`; `ascending UUID order`; `Direct multi-step BFF writes are forbidden` | `docs/18` | `docs/domain/domain-model.md` |
```

State plainly, in prose above the table, that the successor column says where
each invariant **belongs**, not where its text lives today — for most of them the
successor does not yet carry the sentence, and writing it is the successor
slice's work.

Also record the five test identifiers moved into `DOC_ONLY_TEST_REFS`, with their
source documents, and one line on what the slice that rewrites `docs/26` and
`docs/27` owes them.

Before you write the table, verify each string still appears where the table says
it does:

```bash
grep -c "MFA обязательно для каждого пользователя с live Pilot data" docs/01-prd.md
grep -c "Project archive is immutable and terminal" docs/01-prd.md
grep -c "Evidence has no generic delete action" docs/01-prd.md
grep -c "soft-deleted" docs/01-prd.md
grep -c "GA-forward assignment grouping only" docs/19-organizations-roles-access.md
grep -c "Tenant bearer tokens and tenant permissions never authorize these operations" docs/22-data-api-contract.md
grep -c 'Next.js \*\*16.2.11 or newer security-patched 16.2.x\*\*' docs/07-technical-architecture.md
grep -c "Safe first live Pilot (months 5–9)" docs/12-roadmap-delivery.md
grep -c "safe first live Pilot: 6–9 months solo" docs/28-pilot-ga-delivery.md
grep -c "Direct multi-step BFF writes are forbidden" docs/18-domain-state-machines.md
```

Expected: `1` for every line **except** `soft-deleted`, which must be `0` — that
invariant asserted the string's *absence*. Paste the output. If any is `0` where
`1` is expected, the invariant has already drifted and the record must say so
rather than implying it is intact.

- [ ] **Step 2: Write the gate record**

It must contain:

- Branch, base commit, and the commits this slice produced.
- An evidence table: `node scripts/validate-canonical-docs.mjs`,
  `python3 scripts/validate_package.py`, `make validate` (**NOT RUN**, with the
  `eslint` reason), `pnpm typecheck` and `pnpm turbo run test --concurrency=1`
  (**NOT PROVEN — environmental**, with the `exceljs` reason and the fact that no
  task in this slice touched TypeScript).
- The before/after metric lines, with `required_artifacts` 69 → 35 and every
  other metric identical.
- **The mutation checks, in full**: the three vocabulary mutations from Task 2
  Step 5 with their failure messages, and the `docs/23` archive check from Task 3
  Step 8 with its exit code. These are the slice's evidence; the PASS lines are
  the floor.
- What the slice deliberately did not do: the rename, the `package-validate`
  prototype half, any file move, and the seven `technical/` files that still
  carry the dead `sealed` vocabulary.

Never record a check you did not run. If something could not run, write NOT RUN
or NOT PROVEN and the reason. A gate record claiming a green check nobody
executed is worse than no gate record.

- [ ] **Step 3: Validate and commit**

```bash
node scripts/validate-canonical-docs.mjs
python3 scripts/validate_package.py
git add docs/superpowers/plans/evidence/2026-08-03-docs-slice1-invariant-debt.md docs/superpowers/plans/evidence/2026-08-03-docs-slice1-gate.md
git commit -m "docs: record what slice 1 unpinned, and what it now owes

The invariant-debt record is the obligation half. Eight product invariants —
universal live-Pilot MFA, terminal project archive, no generic evidence delete,
GA-forward assignment grouping, the platform-billing authority split, the Next.js
security floor, the honest solo delivery ranges, and four money-concurrency
markers — lost their guard when this slice stopped asserting substrings inside
documents that are about to move. Each is named with the structured document that
must re-assert it, so the loss has an owner rather than a shrug.

The gate record carries the mutation checks, which are the evidence. A validator
that still passes proves nothing here: it passed over every pin this slice
removed. What proves the work is that an archived docs/23 now leaves it green,
and that an unknown x-flow-id, screen_id or validation gate still turns it red."
```

---

## Self-Review

**Spec coverage.** Coupling 1, `required_files` — Task 3 Step 2. Coupling 2, the
eight prose assertions — Task 3 Step 4, with the debt table in Task 5 Step 1.
Coupling 3, the S/F/V vocabularies — Task 2. Coupling 4, index contiguity — Task
3 Step 3, including the `doc_numbers` rescue the spec calls out. Coupling 5, the
test sweep — Task 3 Step 5, with the five named tests. The kept link sweep —
protected in Global Constraints, in the "What must not be touched" table, and
again in Task 3 Step 4's warning not to delete the adjacent block. The deferred
correction — Task 4. CI and Makefile — Task 1. The mutation check the spec names
as the evidence — Task 3 Step 8, plus three more in Task 2 Step 5 that the spec
asks for in its second sentence about vocabularies. The docstring — Task 3
Step 6.

**One deliberate deviation from the spec, stated rather than hidden.** The spec
says one commit; this plan produces five. The property the spec argues for is
that no state is ever red or ungated, and ordering achieves it more strictly than
a single commit can: Task 1 installs the gate *before* Task 3 removes anything,
which one commit cannot express. Every task's commit is independently green, and
the one pairing that genuinely cannot be split — removing the `docs/22:130`
assertion and correcting the sentence — is atomic inside Task 4.

**Placeholder scan.** No TBD or TODO. Every code step carries the literal text to
write. Task 3 Step 6 and Task 5 Steps 1-2 require judgement rather than
transcription; each says what the judgement is and what to report.

**Consistency.** `flow_ids`, `screen_ids` and `external_gates` keep their exact
names in Task 2 so the five downstream call sites need no edit, and Task 3's
Interfaces block forbids reintroducing a document read for any of them.
`doc_numbers` is defined in Task 3 Step 3 and consumed at `:2420`, which Step 7's
`documents=35` check exercises. `DOC_ONLY_TEST_REFS` is defined in Task 3 Step 5
and referenced in Task 5 Step 1. Line numbers are given as a starting index
throughout: Tasks 2-4 each shift every line below their edit, and every step that
could be affected says to locate by content instead.
