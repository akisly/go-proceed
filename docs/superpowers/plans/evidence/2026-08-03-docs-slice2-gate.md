# Documentation slice 2 — "empty the numbered layer" — gate record

**Date:** 2026-08-03
**Branch:** `claude/docs-slice2-archive`, from `claude/docs-slice1-gate` @ `f443790`
**Plan:** [2026-08-03-docs-slice2-archive.md](../2026-08-03-docs-slice2-archive.md)
**Spec:** [2026-08-03-docs-slice2-archive-design.md](../../specs/2026-08-03-docs-slice2-archive-design.md)
**Predecessor record:** [2026-08-03-docs-slice1-gate.md](2026-08-03-docs-slice1-gate.md)

## Read this first: what has *not* happened

**CI has not run. Nothing has been pushed.** The remote exists and carries nine
branches; this is not one of them, and the branch has no upstream:

```
$ git remote -v
origin	git@github.com:akisly/akt-flow.git (fetch)
origin	git@github.com:akisly/akt-flow.git (push)
$ git ls-remote --heads origin claude/docs-slice2-archive; echo "exit=$?"
exit=0
        (no output — no remote branch of this name exists)
$ git ls-remote --heads origin | wc -l
       9
$ git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
fatal: no upstream configured for branch 'claude/docs-slice2-archive'
```

This slice is the first one that moves files — thirty-four of them — and it changes a
test that CI runs. **Nobody has watched CI execute against any of it.** Everything
below marked PASS was executed on this machine, in this checkout, at commit `0787901`,
while writing this record.

**The evidence for this slice is the mutation checks, not the green runs.** Both
validators were green before this slice, over thirty-four documents sitting in a
directory `docs/README.md:41` could not demote. They would also be green if the index
were a table of dead links and the token test had quietly stopped reading anything.
Six mutations are recorded in full below; **three of them were designed by reviewers
who deliberately did not reuse the implementer's**, which is the only reason two of
the six exist at all.

Every command in this record was re-executed at `0787901` while writing it. Where a
claim in this slice's own paperwork did not reproduce, that is stated rather than
smoothed over — see "Claims in this slice's own documents that do not reproduce".

## Evidence

| Gate | Result |
|---|---|
| `node scripts/validate-canonical-docs.mjs` | **PASS** — `canonical documentation: OK` (exit 0) |
| `python3 scripts/validate_package.py` | **PASS** — `documents=1`, all 14 other metrics unchanged from the base (exit 0) |
| `pnpm --filter @aktflow/testing exec vitest run src/token-fidelity.test.ts` | **PASS** — 5 tests, 5 passed, same count as the base |
| The six mutation checks | **PASS** — each turns its check red for the stated reason; each restored |
| GitHub Actions | **NOT RUN** — never pushed; see above |
| `make validate` | **NOT RUN** — `eslint` absent; see below |
| `pnpm typecheck` | **NOT PROVEN — environmental** — `exceljs` absent; see below |
| `pnpm turbo run test` | **NOT PROVEN — environmental** — same cause |

### `node scripts/validate-canonical-docs.mjs` — PASS

```
$ node scripts/validate-canonical-docs.mjs; echo "exit=$?"
canonical documentation: OK
exit=0
```

### `python3 scripts/validate_package.py` — PASS

```
$ python3 scripts/validate_package.py; echo "exit=$?"
AktFlow package validation: PASS (required_artifacts=35, documents=1, sql_tables=126, access_surfaces=158, states=261, transitions=295, errors=118, api_operations=157, requirements=41, test_contracts=149, ui_actions=103, entity_aliases=21, retention_mappings=126, command_availability_rules=32, external_gates_unvalidated=12)
External/runtime evidence status: NOT PROVEN; V-001..V-012 remain unvalidated by design.
exit=0
```

### `token-fidelity.test.ts` — PASS

The only code this slice changes, and the only thing in it that can red CI.

```
$ pnpm --filter @aktflow/testing exec vitest run src/token-fidelity.test.ts
 RUN  v3.2.4 /Users/akisliy/Downloads/GoProceed/packages/testing
 ✓ src/token-fidelity.test.ts (5 tests) 74ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Five tests, matching the pre-slice baseline recorded in the controller's ledger at
`f3e47dd`. **The count matters as much as the colour** — a suite that silently drops a
test also prints green.

### `make validate` — NOT RUN, deliberately

`make validate` is `validate-canonical validate-prototype validate-qa
validate-contracts`, and `validate-prototype` shells out to `eslint`, which is not
installed in this checkout:

```
$ sed -n '1,15p' Makefile
.PHONY: validate validate-canonical validate-contracts validate-prototype validate-qa

validate: validate-canonical validate-prototype validate-qa validate-contracts

validate-canonical:
	node scripts/validate-canonical-docs.mjs

validate-contracts:
	python3 scripts/validate_package.py

validate-prototype:
	npm --prefix prototype run lint
	npm --prefix prototype run build

validate-qa: validate-prototype
$ command -v eslint || echo "eslint: not on PATH"
eslint: not on PATH
$ ls prototype/node_modules >/dev/null 2>&1 && echo present || echo "prototype/node_modules: absent"
prototype/node_modules: absent
$ grep -n '"lint"' prototype/package.json
10:    "lint": "eslint .",
```

The target fails before reaching any documentation check, for a reason that predates
this branch. The plan's Global Constraints ruled that the documentation gates are the
two validators invoked directly; those are the two rows above, and both halves of
`make validate` that concern documentation are among them
(`validate-canonical` and `validate-contracts`).

### `pnpm typecheck` and `pnpm turbo run test` — NOT PROVEN, environmental

Both stop on `exceljs@4.4.0`, declared and lockfile-present but absent from the
installed tree:

```
$ grep -n '"exceljs"' packages/domain/package.json
13:    "exceljs": "4.4.0"
$ grep -c "exceljs" pnpm-lock.yaml
4
$ ls node_modules/.pnpm | grep -ci exceljs
0
```

The condition predates slice 0's base and is traced to `314fb58` in
[slice 0's gate record](2026-08-03-docs-slice0-gate.md). Reconciling it needs a
`pnpm install` that rebuilds `node_modules` across all 11 workspace projects — the
owner's call. **No install was attempted**, per the plan's Global Constraints.

**This is why the single Vitest file was run directly.** It needs no database and no
missing package, and it is the one test in the repository that this slice could break.
Running it alone is a narrower claim than `pnpm turbo run test` would be, and it is
the claim this slice actually needs.

## The `documents=` sequence: 35 → 2 → 1

**This is the single number that says the layer is empty.** `documents` is
`len(doc_numbers)` (`scripts/validate_package.py:2379`), and `doc_numbers` counts
`docs/NN-*.md` **from disk**, non-recursively:

```
$ sed -n '158,167p' scripts/validate_package.py
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

Slice 1 made this an observation rather than a contract precisely so it would fall on
its own. It did. The whole sequence, reproduced at this commit by extracting each
revision's tree and running that revision's own validator inside it — **nothing is
written into the repository and no checkout is switched**:

```
$ for rev in f3e47dd c54ae78 4b1b0bb 0787901; do
    d="$SCRATCH/tree-$rev"; rm -rf "$d"; mkdir -p "$d"
    git archive "$rev" | tar -x -C "$d"
    printf '%s: ' "$rev"; (cd "$d" && python3 scripts/validate_package.py | head -1)
  done
f3e47dd: AktFlow package validation: PASS (required_artifacts=35, documents=35, sql_tables=126, access_surfaces=158, states=261, transitions=295, errors=118, api_operations=157, requirements=41, test_contracts=149, ui_actions=103, entity_aliases=21, retention_mappings=126, command_availability_rules=32, external_gates_unvalidated=12)
c54ae78: AktFlow package validation: PASS (required_artifacts=35, documents=2, sql_tables=126, access_surfaces=158, states=261, transitions=295, errors=118, api_operations=157, requirements=41, test_contracts=149, ui_actions=103, entity_aliases=21, retention_mappings=126, command_availability_rules=32, external_gates_unvalidated=12)
4b1b0bb: AktFlow package validation: PASS (required_artifacts=35, documents=1, sql_tables=126, access_surfaces=158, states=261, transitions=295, errors=118, api_operations=157, requirements=41, test_contracts=149, ui_actions=103, entity_aliases=21, retention_mappings=126, command_availability_rules=32, external_gates_unvalidated=12)
0787901: AktFlow package validation: PASS (required_artifacts=35, documents=1, sql_tables=126, access_surfaces=158, states=261, transitions=295, errors=118, api_operations=157, requirements=41, test_contracts=149, ui_actions=103, entity_aliases=21, retention_mappings=126, command_availability_rules=32, external_gates_unvalidated=12)
```

**35 → 2 → 1 → 1.** Every one of the fourteen other metrics is byte-identical across
all four revisions. One number moved, and it moved because files moved on disk — not
because anyone edited a constant.

### Why the floor is 1 and not 0

`docs/22-data-api-contract.md` has disposition `keep`, targeting itself, so it stays
at `docs/` root by design:

```
$ python3 -c "
import csv
rows=[r for r in csv.DictReader(open('migration/goproceed-canonical-v0.1/document-disposition.csv',encoding='utf-8'))
      if r['source_path'].startswith('docs/') and r['source_path'][5:7].isdigit()]
print('numbered docs/NN-* rows:', len(rows))
import collections; print(dict(collections.Counter(r['disposition'] for r in rows)))
print('keep:', [(r['source_path'], r['target_path']) for r in rows if r['disposition']=='keep'])"
numbered docs/NN-* rows: 41
{'rewrite': 19, 'archive': 6, 'defer': 10, 'merge': 5, 'keep': 1}
keep: [('docs/22-data-api-contract.md', 'docs/22-data-api-contract.md')]
```

41 = 34 moved here + 6 already archived on 2026-07-30 + 1 `keep`. `documents=1` **is**
that `keep`. The end state on disk:

```
$ ls docs/*.md
docs/22-data-api-contract.md
docs/README.md
$ ls docs/legacy/[0-9][0-9]-*.md | wc -l
      40
```

Two Markdown files at `docs/` root; forty numbered documents in `docs/legacy/` — the
34 this slice moved plus the 6 moved on 2026-07-30.

## Not one byte of archived content changed

`git mv` should preserve content exactly, and "should" is not evidence. Task 1's
reviewer compared blob hashes for **all 33** files it moved — not a sample —
`git rev-parse f3e47dd:docs/<name>` against `git rev-parse c54ae78:docs/legacy/<name>`.
Re-run here:

```
$ for name in $(git diff --name-status --diff-filter=R f3e47dd c54ae78 | awk '{print $2}' | sed 's|^docs/||'); do
    a=$(git rev-parse "f3e47dd:docs/$name"); b=$(git rev-parse "c54ae78:docs/legacy/$name")
    n=$((n+1)); [ "$a" != "$b" ] && echo "MISMATCH $name"
  done; echo "files compared: $n"; echo "mismatches: $mismatch"
files compared: 33
mismatches: 0
```

And `docs/05`, moved separately in Task 2, is the same blob at both ends:

```
$ git rev-parse 02cfe0f:docs/05-design-system.md
bc736452908b995c7273249ffa356bac299a956c
$ git rev-parse 4b1b0bb:docs/legacy/05-design-system.md
bc736452908b995c7273249ffa356bac299a956c
```

Both move commits registered as renames rather than delete-plus-add:

```
$ git diff --name-status --diff-filter=R c54ae78^ c54ae78 | wc -l
      33
$ git diff --name-status --diff-filter=R 4b1b0bb^ 4b1b0bb | wc -l
       1
$ git diff --name-status --diff-filter=R f443790..HEAD | wc -l
      34
```

## History survived the move

The legacy policy permits this material to be used to "recover a user need, workflow
example, test idea, or design rationale". **A history that stopped at the move would
make it useless for exactly that**, which is why this is a verification step and not
a nicety.

Six files, deliberately not a contiguous block: three chosen by Task 1's implementer,
three different ones chosen independently by its reviewer, plus `docs/05` from Task 2.

```
$ for f in 00-product-brief 20-flow-catalog 40-phase1-discovery-outreach \
           09-security-compliance 27-qa-traceability 34-production-gate-checklist \
           05-design-system; do
    echo "--- $f ---"; git log --follow --oneline -- "docs/legacy/$f.md" | tail -3
  done
--- 00-product-brief ---
c54ae78 docs: move thirty-three numbered documents into docs/legacy/
907f8a7 chore: track product docs, prototype, design references and validator
--- 20-flow-catalog ---
c54ae78 docs: move thirty-three numbered documents into docs/legacy/
a3283e6 docs: there is no 'sealed' upload state and never was
907f8a7 chore: track product docs, prototype, design references and validator
--- 40-phase1-discovery-outreach ---
c54ae78 docs: move thirty-three numbered documents into docs/legacy/
e1b3de9 docs: record validator crash and screenshot non-determinism as deferred debt
907f8a7 chore: track product docs, prototype, design references and validator
--- 09-security-compliance ---
c54ae78 docs: move thirty-three numbered documents into docs/legacy/
907f8a7 chore: track product docs, prototype, design references and validator
--- 27-qa-traceability ---
c54ae78 docs: move thirty-three numbered documents into docs/legacy/
907f8a7 chore: track product docs, prototype, design references and validator
--- 34-production-gate-checklist ---
c54ae78 docs: move thirty-three numbered documents into docs/legacy/
907f8a7 chore: track product docs, prototype, design references and validator
--- 05-design-system ---
4b1b0bb docs: move docs/05 and the one test that reads it, together
c0da6b9 docs: four claims a reader could disprove in a minute
907f8a7 chore: track product docs, prototype, design references and validator
```

All seven trace back to `907f8a7`, the commit that first tracked these files, far
predating this branch. None begins at its own move commit.

## The mutation checks — this is the slice's evidence

The PASS lines above are the floor. **Only a mutation distinguishes a live check from
a decorative one.** All six below were re-executed at `0787901` while writing this
record; none is transcribed from a task report without being run again.

The tree was clean before and after the whole set:

```
$ git status --porcelain
?? .agents/
?? .gstack/
?? skills-lock.json
```

(`.agents/`, `.gstack/` and `skills-lock.json` are user-added and untracked. No task
in this slice staged, committed, moved or deleted them — confirmed by
`git log --oneline --name-only 9e632a7~1..HEAD -- .agents .gstack skills-lock.json`,
which returns nothing.)

### Group A — the token test genuinely reads the document (two mutations, two authors)

`token-fidelity.test.ts` is the reason `docs/05` had to move in the same commit as its
own repointing. Slice 1's whole-branch review recorded that as debt A. Both mutations
below attack the same assertion from different directions, and **the second exists
only because Task 2's reviewer refused to re-run the first**.

**Mutation 1 — the document briefly absent** (Task 2's implementer; the plan's
nominated probe). Plain `mv`, not `git mv`: git cannot move a tracked file out of the
work tree, and the point is to make the file briefly absent, not to record anything.

```
$ mv docs/legacy/05-design-system.md "$SCRATCH/05-probe.md"
$ pnpm --filter @aktflow/testing exec vitest run src/token-fidelity.test.ts
   ✓ generated tokens match their source > the committed CSS is what the generator produces 41ms
   ✓ generated tokens match their source > the committed React Native module is what the generator produces 37ms
   × the source accounts for every documented colour > names every token the design document's table defines, or records it contested 3ms
     → ENOENT: no such file or directory, open '/Users/akisliy/Downloads/GoProceed/docs/legacy/05-design-system.md'
   ✓ the source accounts for every documented colour > carries a ruling for every token, so no value is unexplained 0ms
   ✓ the source accounts for every documented colour > the contested list is empty, so every B0 render has been ruled 0ms
 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
$ mv "$SCRATCH/05-probe.md" docs/legacy/05-design-system.md
```

The failure names the exact **new** path. The read is happening at
`docs/legacy/05-design-system.md`, not surviving on a stale one.

**Mutation 2 — the document present but empty** (Task 2's reviewer, and the better
probe). An `ENOENT` proves only that the test opens a file. It does not prove the test
*parses* it — a test that read the file and threw the contents away would pass mutation
1 identically. Truncating to zero bytes separates the two:

```
$ : > docs/legacy/05-design-system.md
$ pnpm --filter @aktflow/testing exec vitest run src/token-fidelity.test.ts; echo "exit=$?"
   ✓ generated tokens match their source > the committed CSS is what the generator produces 54ms
   ✓ generated tokens match their source > the committed React Native module is what the generator produces 39ms
   × the source accounts for every documented colour > names every token the design document's table defines, or records it contested 4ms
     → expected +0 to be 12 // Object.is equality
   ✓ the source accounts for every documented colour > carries a ruling for every token, so no value is unexplained 0ms
   ✓ the source accounts for every documented colour > the contested list is empty, so every B0 render has been ruled 0ms
AssertionError: expected +0 to be 12 // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
exit=1
$ git checkout -- docs/legacy/05-design-system.md
$ git hash-object docs/legacy/05-design-system.md
bc736452908b995c7273249ffa356bac299a956c
```

`expected +0 to be 12` — the regex found zero rows where it needs twelve. **The test
parses the document's colour table, it does not merely stat the file.** The restore is
proven by the blob hash, not by an absence of complaints.

Both mutations fail exactly one of the five tests and leave the other four green,
which is what a targeted probe should look like: a mutation that reds everything has
usually broken the harness rather than the assertion.

### Group B — the index is link-checked (two mutations, two authors, two link classes)

`docs/legacy/README.md` is in `validate-canonical-docs.mjs`'s `METADATA_DOCS`, so
every relative link in the new 34-row table is resolved on every run. **That claim is
the entire argument for one index over thirty-four per-file banners** — a banner cannot
be validated. So it had to be attacked rather than asserted.

The file is committed, so `git checkout --` restores it from the index.

**Mutation 3 — a broken successor link** (Task 3's implementer; the plan's nominated
probe).

```
$ python3 -c "
import pathlib; p=pathlib.Path('docs/legacy/README.md'); s=p.read_text(encoding='utf-8')
p.write_text(s.replace('(../product/vision-and-positioning.md)', '(../product/does-not-exist.md)', 1), encoding='utf-8')"
$ node scripts/validate-canonical-docs.mjs; echo "exit=$?"
canonical documentation: 1 problem(s)
  - docs/legacy/README.md: broken relative link -> ../product/does-not-exist.md
exit=1
$ git checkout -- docs/legacy/README.md
```

**Mutation 4 — a broken self-link** (Task 3's reviewer). Each row carries *two* links:
one to the archived document itself and one to its successor. Mutation 3 exercises
only the successor class. If the self-links were somehow unchecked — a different
resolution root, a different prefix — mutation 3 would never notice, and 34 of the 68
targets in the table would be unverified. The reviewer broke `./01-prd.md` instead:

```
$ python3 -c "
import pathlib; p=pathlib.Path('docs/legacy/README.md'); s=p.read_text(encoding='utf-8')
assert s.count('(./01-prd.md)') == 1
p.write_text(s.replace('(./01-prd.md)', '(./01-prd-does-not-exist.md)', 1), encoding='utf-8')"
$ node scripts/validate-canonical-docs.mjs; echo "exit=$?"
canonical documentation: 1 problem(s)
  - docs/legacy/README.md: broken relative link -> ./01-prd-does-not-exist.md
exit=1
$ git checkout -- docs/legacy/README.md
$ node scripts/validate-canonical-docs.mjs; echo "exit=$?"
canonical documentation: OK
exit=0
```

**Both link classes are checked.** And all 68 targets resolve today, resolved
programmatically rather than inferred from the validator's silence:

```
$ python3 -c "
import re, os
lines=[l for l in open('docs/legacy/README.md',encoding='utf-8') if l.startswith('| [')]
targets=[t for l in lines for t in re.findall(r'\]\(([^)]+)\)', l)]
bad=[t for t in targets if not os.path.exists(os.path.normpath(os.path.join('docs/legacy',t)))]
print('table rows:', len(lines)); print('link targets in table:', len(targets)); print('unresolved:', bad or 'none')"
table rows: 34
link targets in table: 68
unresolved: none
```

### Group C — the index quotes the CSV verbatim, in all 34 rows

The design's reason for generating the table rather than transcribing it is that
"paraphrase is how a map starts disagreeing with the territory". Task 3's reviewer
checked that for all 34 rows rather than spot-checking three: it re-ran the generator
and diffed the output against the committed table character for character. Re-run
here:

```
$ python3 <the plan's Task 3 Step 1 generator, minus its assertions> > /tmp/slice2-index-recheck.md
$ grep -n '^| \[\|^| Archived document\|^|---|---' docs/legacy/README.md | sed 's/^[0-9]*://' > /tmp/slice2-index-committed.md
$ diff /tmp/slice2-index-recheck.md /tmp/slice2-index-committed.md && echo "IDENTICAL"
IDENTICAL
$ wc -l /tmp/slice2-index-recheck.md
      36 /tmp/slice2-index-recheck.md
```

36 lines: two header lines plus 34 rows. **Zero characters of difference**, so
"quoted verbatim rather than summarised" is a property of all 34 rows and not of the
three the plan happened to print.

The six `archive`-disposition documents are present but deliberately unlisted — they
have no successor beyond the policy itself:

```
$ for f in 02-market-competition 16-fidelity-ledger 29-prototype-coverage \
           37-functional-closure-feature-register 38-business-logic-closure 39-evidence-graph; do
    printf "%-45s file:%s  in-table:%s\n" "$f" \
      "$([ -f docs/legacy/$f.md ] && echo yes || echo NO)" "$(grep -c "\[\`$f.md\`\]" docs/legacy/README.md)"
  done
02-market-competition                         file:yes  in-table:0
16-fidelity-ledger                            file:yes  in-table:0
29-prototype-coverage                         file:yes  in-table:0
37-functional-closure-feature-register        file:yes  in-table:0
38-business-logic-closure                     file:yes  in-table:0
39-evidence-graph                             file:yes  in-table:0
```

And no line the index adds carries the pre-rename brand, which matters because
`METADATA_DOCS` is also the branding-checked set — a verbatim quote carrying `AktFlow`
onto a line without legacy context would have failed `brandingViolations`:

```
$ git show 0787901 -- docs/legacy/README.md | grep '^+' | grep -ci 'aktflow'
0
```

## No live pointer to a moved document survives

Three sweeps, each wider than the last. The third is not in any task brief; it drops
the hand-built character classes that the first depends on, because a character class
is exactly the kind of thing that can be subtly wrong and silently return nothing.

```
$ git ls-files | grep -v '^docs/legacy/\|^docs/superpowers/\|^migration/' \
    | xargs grep -l 'docs/0[0-46-9]-\|docs/1[0-9]-\|docs/2[0-13-9]-\|docs/3[0-9]-\|docs/4[0-9]-' 2>/dev/null
(no output)
$ git ls-files | grep -v '^docs/legacy/\|^docs/superpowers/\|^migration/' \
    | xargs grep -ln 'docs/05-design-system' 2>/dev/null
(no output)
$ git ls-files | grep -v '^docs/legacy/\|^docs/superpowers/\|^migration/\|^\.superpowers/' \
    | xargs grep -on 'docs/[0-9][0-9]-[a-z0-9-]*\.md' 2>/dev/null \
    | grep -v 'docs/22-data-api-contract' | sort -u
(no output)
```

**Zero live references**, including under the sweep that would have caught a numbered
path the character classes were never written to match.

## Three defects in the plan and the brief, caught during execution

These are the most useful thing in this record. A plan that produced no defects is
usually a plan nobody executed carefully.

### 1. The history check was ordered where it could only ever return nothing

The plan's Task 1 Step 7 put `git log --follow` **before** the commit. `git log
--follow` traces renames through *committed* history; against a staged-but-uncommitted
rename it returns nothing at all — whether or not the rename is correct. Run there,
the check could only ever produce silence, and silence would have been read as either
"no history" or "nothing to report" depending on the reader.

Task 1's implementer found it, ran the check post-commit instead, and said so. Its
reviewer did not take the report's word for it and reproduced the behaviour in an
isolated scratch repository. Reproduced again here:

```
$ git init -q .; echo one > a.md; git add a.md; git commit -qm "c1: create a.md"
$ echo two >> a.md; git add a.md; git commit -qm "c2: edit a.md"
$ git mv a.md sub/a.md
$ git status --porcelain
R  a.md -> sub/a.md
$ git log --follow --oneline -- sub/a.md
(no output)
$ git log --follow --oneline -- a.md
e080ff9 c2: edit a.md
f86d0d1 c1: create a.md
$ git commit -qm "c3: move a.md into sub/"
$ git log --follow --oneline -- sub/a.md
f10fa31 c3: move a.md into sub/
e080ff9 c2: edit a.md
f86d0d1 c1: create a.md
```

**Post-commit is not a weaker place to run this check — it is the only place it means
anything.** The plan was corrected at `02cfe0f`. The design is not edited; it is a
point-in-time record.

The dangerous shape here is the one slice 1 named twice: **a check that cannot fail**.
It would have been recorded as run, produced no complaint, and proven nothing about
whether 33 files had kept their history.

### 2. A hedge the brief could have resolved by counting

Task 2's brief warned that "there are twelve token entries and more than one may carry
a `docs/05` path in its `ruling`" and told the implementer to search the whole file.
Exactly one did. The implementer grepped, found one, repointed it, and **reported that
the hedge did not hold** rather than hunting for a second occurrence to satisfy the
brief's phrasing:

```
$ git show 02cfe0f:packages/tokens/src/tokens.json | grep -c '05-design-system'
1
$ python3 -c "
import json; d=json.load(open('packages/tokens/src/tokens.json'))
print('color entries:', len(d['color']))
print('rulings naming a docs/ path:', [k for k,v in d['color'].items() if 'docs/' in v.get('ruling','')])"
color entries: 12
rulings naming a docs/ path: ['ink-950']
```

This is the benign version of the defect, and it is recorded because the failure mode
it avoided is not benign: a hedge phrased as "more than one may…" invites an
implementer to keep looking until it finds something, and the thing it eventually
finds may not be the thing the brief meant.

### 3. A comment the brief dictated, refuted nine lines below itself

**The worst of the three, and it is mine — the brief's, not the implementer's.**
Task 2's brief gave the exact replacement comment to write into
`token-fidelity.test.ts`, including the sentence that `docs/05` "remains the only
place the twelve colour names are written down". It is false, and it is disproved by
the same test function that contains it. At `4b1b0bb`:

```
$ git show 4b1b0bb:packages/testing/src/token-fidelity.test.ts | grep -n 'only place\|Object.keys(src.color)'
82:    // is non-normative by location, but it remains the only place the twelve colour
91:    const accounted = new Set([...Object.keys(src.color), ...src.contested]);
```

Nine lines apart. `Object.keys(src.color)` is exactly those twelve names — the same
set, measured against the document's own table:

```
$ python3 -c "
import json, re
src = json.load(open('packages/tokens/src/tokens.json'))
a = sorted(src['color'].keys())
doc = open('docs/legacy/05-design-system.md', encoding='utf-8').read()
b = sorted(m[0] for m in re.findall(r'^\| \`([a-z0-9-]+)\` \| \`(#[0-9A-Fa-f]{6})\` \|', doc, re.M))
print('Object.keys(src.color):', len(a), a)
print('document table names:  ', len(b), b)
print('identical sets:', a == b)"
Object.keys(src.color): 12 ['amber-500', 'blue-500', 'ink-800', 'ink-950', 'line', 'muted', 'paper', 'red-500', 'signal-500', 'signal-700', 'slate-600', 'white']
document table names:   12 ['amber-500', 'blue-500', 'ink-800', 'ink-950', 'line', 'muted', 'paper', 'red-500', 'signal-500', 'signal-700', 'slate-600', 'white']
identical sets: True
```

The reviewer also found the same twelve in both generated artifacts, confirmed here:

```
$ grep -oE '"[a-z0-9-]+":' packages/tokens/src/tokens.generated.ts | sort -u | tr '\n' ' '
"amber-500": "blue-500": "ink-800": "ink-950": "line": "muted": "paper": "red-500": "shadow": "signal-500": "signal-700": "slate-600": "white":
$ grep -oE -- '--[a-z0-9-]+:' packages/ui/src/tokens.generated.css | sort -u | tr '\n' ' '
--amber-500: --blue-500: --ink-800: --ink-950: --line: --muted: --paper: --red-500: --shadow: --signal-500: --signal-700: --slate-600: --white:
```

**The implementer's verification was correct and thorough within the scope the brief
set** — every non-legacy `docs/**.md` file, searched by both token name and hex value,
zero hits. Inside `docs/`, the claim is true. The names were never confined to
`docs/`, and nothing in the brief told the implementer to look outside it. **The bad
scope was the brief's**, and a scoped verification that confirms a claim is
indistinguishable, in a report, from an unscoped one — which is why the report says
which scope it used, and why that sentence is what let the reviewer find this.

Fixed at `f2188bb` with a replacement that states the true and narrower reason, itself
verified rather than asserted: `tokens.json` is the source, `docs/05` is the
human-readable specification the source is checked against, and the test reads a
legacy path because `docs/05` carries disposition `defer` with `information_moved=none`
and no structured successor. The current comment:

```
$ sed -n '80,87p' packages/testing/src/token-fidelity.test.ts
    // docs/legacy/05-design-system.md:19-30. Parsed from the document rather than
    // copied, so adding a row there without adding a token fails here. tokens.json
    // is the source; this document is the specification the source is checked
    // against — the point of this test is to catch a colour documented for humans
    // that no token backs. It reads the legacy path because docs/05 carries
    // disposition `defer`: no structured successor document exists yet to check
    // the source against instead. When one does, this test should read that one.
```

The `readFileSync` path, the regex, both assertions and the literal `12` are
byte-identical across that fix.

**The generalisation, and it is the same one slice 1 paid for four times:** a claim
handed down in a brief is an input to be checked, not an instruction to be satisfied —
and the check is only as good as the scope, which is why a report must state its scope
even when the answer came out clean.

## Claims in this slice's own documents that do not reproduce

Recorded rather than corrected. The plan's Global Constraints forbid this task from
editing any document; a claim found here belongs in the record as an open item, never
smoothed into it as though it had been fixed.

### The "ten `technical/*.csv` files carrying `defer`" is seven

The design's Out of scope section, the plan's Task 4 brief and this task's own
instructions all name **ten**. Counted from the CSV itself:

```
$ python3 -c "
import csv, collections
rows=list(csv.DictReader(open('migration/goproceed-canonical-v0.1/document-disposition.csv',encoding='utf-8')))
tech=[r for r in rows if r['source_path'].startswith('technical/') and r['source_path'].endswith('.csv')]
print('technical/*.csv rows:', len(tech))
print('by disposition:', dict(collections.Counter(r['disposition'] for r in tech)))
for r in tech:
    if r['disposition']=='defer': print('   ', r['source_path'])"
technical/*.csv rows: 19
by disposition: {'keep': 2, 'rewrite': 7, 'defer': 7, 'merge': 2, 'archive': 1}
    technical/entitlements.csv
    technical/data-retention-catalog.csv
    technical/asvs-profile.csv
    technical/rate-limits.csv
    technical/copy-catalog.csv
    technical/ui-actions.csv
    technical/command-availability.csv
```

**Seven, not ten**, and widening to every `technical/` row of any extension still
gives seven:

```
$ python3 -c "
import csv
rows=list(csv.DictReader(open('migration/goproceed-canonical-v0.1/document-disposition.csv',encoding='utf-8')))
tech=[r for r in rows if r['source_path'].startswith('technical/')]
print('technical/* rows (any extension):', len(tech))
print('defer among them:', len([r for r in tech if r['disposition']=='defer']))"
technical/* rows (any extension): 23
defer among them: 7
```

**Where the ten came from is visible in the numbers above.** Ten is the count of
numbered `docs/NN-*.md` rows with disposition `defer` — `{'rewrite': 19, 'archive': 6,
'defer': 10, 'merge': 5, 'keep': 1}` in the disposition tally earlier in this record.
Two different sets were written down as one, and the wrong one's total was carried
across.

**This is the same defect slice 1 recorded as its headline finding**, where the plan
said `required_files` held 35 pairs and it held 34, because `documents=35` counted
numbered files from disk while `required_files` pinned an explicit 34. Same species,
same slice family, one slice later, and it survived a design, a plan, three task
briefs and three reviews. It is corrected here, in the record, and **not** in the
design or the plan — both are point-in-time records now.

### The design's "eight stale cross-references" is eight under an unstated rule; the raw count is thirteen

The design names eight: `docs/40`→`docs/05`, `docs/17`→`docs/34` and `docs/28`,
`docs/34`→`docs/32`, `docs/32`→`docs/34`, `docs/08`→`docs/35`, `docs/40`→`docs/14`
and `docs/20`. Measured over the 34 archived documents:

```
$ python3 <count docs/NN- path references inside the 34 files this slice moved>
01-prd.md: ['37']
08-api-integrations.md: ['35']
17-production-readiness-index.md: ['28', '34']
18-domain-state-machines.md: ['38']
32-customer-country-adapters.md: ['34']
34-production-gate-checklist.md: ['32']
40-phase1-discovery-outreach.md: ['05', '05', '14', '20', '29', '40']
total stale docs/NN- references inside the archived set: 13
markdown links among them: 0
```

Thirteen raw references, which decompose exactly:

- **8** — the design's eight: distinct source→target pairs where **both** documents
  moved in this slice, so the written path goes stale by one directory *because of
  this slice*.
- **1** duplicate: `docs/40` names `docs/05` twice.
- **3** already stale before this slice: `docs/37`, `docs/38` and `docs/29` are
  `archive`-disposition documents moved on 2026-07-30. Confirmed —
  `git ls-tree --name-only f3e47dd docs/legacy/ | grep -E '(29|37|38)-'` lists all
  three at the slice's base.
- **1** the design does not count: `docs/legacy/40-phase1-discovery-outreach.md:2216`
  names **its own** old path, `| \`docs/40-phase1-discovery-outreach.md\` | This spec |`.
  A self-reference, staled by this slice like the other eight.

So the design's number is right under the rule "distinct source→target pairs newly
staled by this slice, excluding self-references" — a rule it does not state. **A count
without its counting rule is the defect, not the count.** Both numbers and both rules
are written here. `markdown links among them: 0` confirms the design's other claim:
none is a Markdown link, so none can break link validation.

### The ledger says the false comment was refuted "four lines below itself"; it is nine

Measured above at `4b1b0bb`: line 82 against line 91. The finding is entirely correct
and the distance is immaterial to it — recorded only because this record's contract,
like the ledger's, is that a stated number is one somebody measured.

### Everything else in Tasks 1–3's reports reproduced

Every command quoted in the three task reports that could be re-run at this commit was
re-run, and every one produced the output the report recorded: the baselines, the
`documents=` values, the metric lines, both validators, the 5-test Vitest run, the
`ENOENT` probe, the index mutation, the 34-row count, the 33/35 migration
measurement, the `git log --follow` samples, and all three pointer sweeps. **No claim
in any of the three reports failed to reproduce.**

## What this slice deliberately did not do

**It did not correct a single line inside any archived document.** Thirteen stale
`docs/NN-` path references remain inside the 34 files, enumerated above.

They stay stale, and the reason is the legacy policy itself: `docs/legacy/README.md`
preserves this material as historical migration evidence, and **editing preserved
evidence to tidy its internal paths is the thing that policy exists to prevent.**
Owner-confirmed 2026-08-03. None is a Markdown link, so none breaks link validation;
the 34-row index is the reader's map instead. A reviewer must not file these as an
oversight.

**`docs/22-data-api-contract.md` did not move.** Its disposition is `keep`, targeting
itself — the `keep` row printed in the disposition tally above. This is why
`documents=` floors at 1 rather than 0, and the distinction matters: **`documents=0`
would mean something had gone wrong**, not that the slice had gone further.

**The AktFlow→GoProceed rename was not started.** The validator still prints `AktFlow
package validation`; `aktflow://` and `aktflow.app` survive untouched in
`docs/legacy/04-screen-specification.md` and in the `TODOS.md` entry that points at
it. Several moved files carry `aktflow`. Every instance was left, deliberately —
changing one here would leave the rename slice an inconsistency to hunt.

**Seven `technical/*.csv` files still carry `defer` dispositions** — listed by name
above, counted from the CSV rather than repeated from the plan, which said ten. They
are out of scope by the design's own Out of scope section, unchanged by this slice,
and unaffected by it.

**No numbered document was rewritten, merged or deleted.** 19 `rewrite`, 5 `merge` and
10 `defer` dispositions were *executed as an archival move only*. Whether each
successor genuinely absorbed what its `information_moved` cell claims was explicitly
out of scope: the dispositions are owner-approved, and archiving destroys nothing
because every file remains readable at its new path with its history intact.

**`scripts/validate_package.py` gained no assertion.** Five comments in it were
repointed. The `documents=` metric that carries this slice's entire numeric argument is
an *observation*, deliberately not a contract — slice 1 made it so precisely to avoid
obliging anyone to edit a number here. **Nothing in this repository would now object if
a numbered document reappeared at `docs/` root.** That is the intended end state, and
it is also the reason this record exists: the count is evidence, not a guard.

**And CI has still not run.** That is the first section of this record and it is the
last item here, because it is the thing a reader is most likely to assume. Thirty-four
files moved, one test changed, and no continuous-integration run has observed any of
it.

## Commits

**Eight, as of the commit that writes this record**, counting from the slice's base
`f443790`. The count includes the commit that writes it, so it cannot be pasted from a
`git log … | wc -l` run beforehand — that command returned **seven** immediately
before this record landed:

```
$ git log --oneline f443790..HEAD | wc -l
       7        # before this record's commit; eight after
```

**The counting rule, stated because the last three records in this family each went
stale on a bare number:** commits reachable from the tip and not from `f443790`, the
base this branch was cut from, which is the same rule slice 1's record used. Two other
lower bounds are defensible and give different answers — `9e632a7..HEAD` returns 6
before this commit, because it excludes the design commit itself. The table below is
the re-derivable form: **the count is its row count**, and a reader who does not trust
the sentence can count the rows.

Rows are in `git log --reverse` order, verified rather than remembered.

| # | Commit | What | Files |
|---|---|---|---|
| 1 | `9e632a7` | design — no file moved | 1 (+147) |
| 2 | `f3e47dd` | plan — no file moved | 1 (+759) |
| 3 | `c54ae78` | **Task 1** — 33 documents into `docs/legacy/`, and the four live files that named them: `validate_package.py`, `ci.yml`, `fonts.css`, `TODOS.md` | 37 (+16/−14) |
| 4 | `02cfe0f` | controller — the plan's history check was ordered where `git log --follow` could only return nothing | 1 (+5/−1) |
| 5 | `4b1b0bb` | **Task 2** — `docs/05` and the test that reads it, in one commit, which is debt A's ordering constraint | 4 (+7/−5) |
| 6 | `f2188bb` | Task 2 fix round 1 — the comment the brief dictated was refuted nine lines below itself | 1 (+6/−3) |
| 7 | `0787901` | **Task 3** — the 34-row supersession index, and the six-table claim that outlived its subject | 1 (+56/−2) |
| 8 | *(this commit)* | **Task 4** — this record | 1 |

**The ordering is the safety argument, exactly as slice 1's was.** `c54ae78` moves
only what nothing reads; `4b1b0bb` moves the one document a test reads *together with*
that test, so no commit in between exists where CI is red on an `ENOENT`; `0787901`
writes the index only once all 34 targets are in place, so no row is born broken.
Reversing any two of those three produces a red commit or a broken link.

Two of the four tasks were approved with **zero findings** (Tasks 1 and 3). Both of
those reviewers had built their own mutations instead of re-running the implementer's
— Task 1's compared 33 blob hashes and reproduced the `--follow` defect in a scratch
repo; Task 3's broke a self-link where the report had broken a successor link, and
diffed all 34 generated rows against the committed table. **That is not a
coincidence.** The one Important finding in this slice came from the third reviewer,
which also built its own probe.

### The whole diff

```
$ git diff --name-status f443790..HEAD -- ':!docs/superpowers/' ':!.superpowers/' | grep -v '^R'
M	.github/workflows/ci.yml
M	TODOS.md
M	apps/demo/src/styles/fonts.css
M	docs/legacy/README.md
M	packages/testing/src/token-fidelity.test.ts
M	packages/tokens/src/tokens.json
M	packages/ui/src/base.css
M	scripts/validate_package.py
$ git diff --name-status --diff-filter=R f443790..HEAD | wc -l
      34
$ git diff --name-status f443790..HEAD -- 'docs/superpowers/'
A	docs/superpowers/plans/2026-08-03-docs-slice2-archive.md
A	docs/superpowers/specs/2026-08-03-docs-slice2-archive-design.md
```

**Thirty-four renames and eight modified files.** The listing is split deliberately, as
slice 1's was: the first command's eight paths are everything this slice changed
outside its own paperwork and its output does not move when this record is revised;
the second command's output *gains this record* the moment it is committed, which is
exactly why it is quarantined into its own command.

Of the eight modified files, **seven are one-line pointer repointings and one is the
index**. Not one is a change of behaviour:

- `scripts/validate_package.py` — five comments in `DOC_ONLY_TEST_REFS` plus the prose
  sentence above the block. The set's contents, the `require` below it, and every
  assertion are untouched.
- `.github/workflows/ci.yml` — one comment. The `pnpm validate:canonical-docs` step
  slice 1 installed was not touched.
- `apps/demo/src/styles/fonts.css`, `packages/ui/src/base.css` — one comment each, no
  CSS rule.
- `packages/tokens/src/tokens.json` — one `ruling` string. No `hex`, no `alpha`, no
  `use`, no key.
- `packages/testing/src/token-fidelity.test.ts` — the read path and its comment. The
  regex, both assertions and the literal `12` are byte-identical across the slice.
- `TODOS.md` — two entries repointed, and one false authority claim corrected: the
  entry said `docs/04-screen-specification.md` "is normative by `docs/README.md`'s
  precedence", which this very commit makes false. Rewritten to keep the entry's point
  — the deep-link contract still needs deliberate handling in the rename slice —
  while replacing the authority claim with the true one.
- `docs/legacy/README.md` — the 34-row index, and the "six-table foundation" claim
  corrected to "33 tables across 35 migrations", re-measured here rather than trusted:

```
$ grep -rhoiE "^[[:space:]]*create table (if not exists )?[a-z0-9_.]+" supabase/migrations/*.sql | wc -l
      33
$ ls -1 supabase/migrations/*.sql | wc -l
      35
$ grep -n "33 tables across 35 migrations\|Last reviewed" docs/legacy/README.md
7:**Last reviewed:** 2026-08-03
28:- compare the implemented runtime — 33 tables across 35 migrations — with prior
```

**The map now lives inside `docs/`.** Slice 0's design named the absence of exactly
this table as the reason `docs/README.md` could not answer which layer wins: the map
existed, in
`migration/goproceed-canonical-v0.1/document-disposition.csv`, outside `docs/`
entirely. A reader landing on `docs/legacy/09-security-compliance.md` had no way to
learn what replaced it. After this slice they do — and the link check proves the
answer still resolves, on every run.
