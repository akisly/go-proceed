# Documentation slice 1 — "retire the hold, keep the gate" — gate record

**Date:** 2026-08-03
**Branch:** `claude/docs-slice1-gate`, from `claude/docs-slice0-truth` @ `e00372c`
**Plan:** [2026-08-03-docs-slice1-gate.md](../2026-08-03-docs-slice1-gate.md)
**Spec:** [2026-08-03-docs-slice1-gate-design.md](../../specs/2026-08-03-docs-slice1-gate-design.md)
**Task:** [task-5-brief.md](../../../../.superpowers/sdd/2026-08-03-docs-slice1-gate/task-5-brief.md)
**Debt incurred:** [2026-08-03-docs-slice1-invariant-debt.md](2026-08-03-docs-slice1-invariant-debt.md)

## Read this first: what has *not* happened

**CI has not run. Nothing has been pushed.** The branch has no upstream and no
remote counterpart:

```
$ git ls-remote --heads origin claude/docs-slice1-gate
(no output — no remote branch exists)
$ git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
fatal: no upstream configured for branch 'claude/docs-slice1-gate'
```

This slice's headline change is a new step in the `verify` job of
`.github/workflows/ci.yml`. **That step's presence, position and unconditional-ness
were established by parsing the workflow file and by running the same command
locally — not by observing a GitHub Actions run**, because there has not been one.
Nobody has seen this workflow execute. Everything below marked PASS was executed on
this machine, in this checkout, at this commit.

The distinction matters more here than usual. The defect this whole documentation
effort exists to remove is the confident sentence nobody measured. A gate record
implying a green CI run that nobody observed would be that exact defect, committed
by the document whose job is to prevent it.

**The evidence for this slice is the mutation checks, not the green runs.** The
validator passed before this slice over every pin the slice removed; it would also
pass if the slice had deleted the checks outright instead of rewiring them. Eight
mutations are recorded in full below. If you read one section of this record, read
that one.

Every command in this record was executed at this commit while writing it. Where a
task report's command did not reproduce, that is stated rather than smoothed over —
see "Claims in this slice's own documents that do not reproduce".

## Evidence

| Gate | Result |
|---|---|
| `node scripts/validate-canonical-docs.mjs` | **PASS** — `canonical documentation: OK` (exit 0) |
| `python3 scripts/validate_package.py` | **PASS** — `required_artifacts=35`, `documents=35`, all 13 other metrics unchanged (exit 0) |
| The eight mutation checks | **PASS** — each turns the validator red for the stated reason; each restored |
| GitHub Actions `verify` job | **NOT RUN** — never pushed; see above |
| `make validate` | **NOT RUN** — `eslint` absent; see below |
| `pnpm typecheck` | **NOT PROVEN — environmental** — `exceljs` absent; see below |
| `pnpm turbo run test --concurrency=1` | **NOT PROVEN — environmental** — same cause |

### `node scripts/validate-canonical-docs.mjs` — PASS

```
$ node scripts/validate-canonical-docs.mjs
canonical documentation: OK
$ echo "exit=$?"
exit=0
```

### `python3 scripts/validate_package.py` — PASS

```
$ python3 scripts/validate_package.py
AktFlow package validation: PASS (required_artifacts=35, documents=35, sql_tables=126, access_surfaces=158, states=261, transitions=295, errors=118, api_operations=157, requirements=41, test_contracts=149, ui_actions=103, entity_aliases=21, retention_mappings=126, command_availability_rules=32, external_gates_unvalidated=12)
External/runtime evidence status: NOT PROVEN; V-001..V-012 remain unvalidated by design.
$ echo "exit=$?"
exit=0
```

### `make validate` — NOT RUN, deliberately

`make validate` is `validate-canonical validate-prototype validate-qa
validate-contracts` (`Makefile:3` after this slice), and `validate-prototype` is
`npm --prefix prototype run lint` (`Makefile:11-13`), whose script is `eslint .`
(`prototype/package.json:10`).

```
$ command -v eslint || echo "eslint: not on PATH"
eslint: not on PATH
$ ls prototype/node_modules >/dev/null 2>&1 && echo present || echo "prototype/node_modules: absent"
prototype/node_modules: absent
$ grep -n '"lint"' prototype/package.json
10:    "lint": "eslint .",
```

The target fails before reaching any documentation check, for a reason that predates
this branch and that no documentation change can reach. The plan's Global Constraints
ruled that the documentation gates are `python3 scripts/validate_package.py` and
`node scripts/validate-canonical-docs.mjs`, invoked directly; those are the two rows
above. **The half of `make validate` this slice added was run**, on its own:

```
$ make validate-canonical
node scripts/validate-canonical-docs.mjs
canonical documentation: OK
```

(recorded by Task 1 at `22a3223`; the target is unchanged since, and the underlying
command is re-run above.)

### `pnpm typecheck` and `pnpm turbo run test --concurrency=1` — NOT PROVEN, environmental

Both stop on `exceljs@4.4.0`, declared in `packages/domain/package.json` and present
in `pnpm-lock.yaml` but absent from the installed `node_modules`:

```
$ grep -n '"exceljs"' packages/domain/package.json
13:    "exceljs": "4.4.0"
$ grep -c "exceljs" pnpm-lock.yaml
4
$ ls node_modules/.pnpm | grep -ci exceljs
0
```

The condition predates slice 0's base; slice 0's gate record
([2026-08-03-docs-slice0-gate.md](2026-08-03-docs-slice0-gate.md)) traces it to
`314fb58` and records the full failure output. Reconciling it requires a `pnpm
install` that purges and rebuilds `node_modules` across all 11 workspace projects,
which is the owner's call, not a documentation slice's. **No install was attempted
in this slice**, per the plan's Global Constraints.

**No task in this slice touched TypeScript.** The whole diff is one Python file, one
YAML file, the `Makefile`, and Markdown — the file list is below. There is no path
from this diff to a module-resolution error, which is why these are NOT PROVEN rather
than failing.

Note that CI, when it eventually runs, *does* execute both — they are steps `[9]` and
`[10]` of the `verify` job. Whatever they say there will be a fact about that
runner's `node_modules`, not about this branch.

## The CI step, verified structurally

Parsed rather than grepped, so that indentation accidents and wrong-job placement
cannot hide:

```
$ python3 - <<'PY'
import yaml
d = yaml.safe_load(open(".github/workflows/ci.yml"))
print("jobs:", list(d["jobs"]))
for job, spec in d["jobs"].items():
    hits = [i for i,s in enumerate(spec.get("steps",[])) if "validate:canonical-docs" in str(s.get("run",""))]
    print(f"  {job}: {len(spec.get('steps',[]))} steps, validate:canonical-docs at index {hits}")
steps = d["jobs"]["verify"]["steps"]
for i,s in enumerate(steps):
    label = s.get("run") or s.get("uses")
    print(f"  [{i}] {str(label).splitlines()[0][:70]}" + ("   <-- GATE" if "validate:canonical-docs" in str(s.get('run','')) else ""))
g = next(s for s in steps if "validate:canonical-docs" in str(s.get("run","")))
print("gate step keys:", sorted(g))
print("no if/continue-on-error:", not ({"if","continue-on-error"} & set(g)))
print("no '|| true':", "|| true" not in g["run"])
PY
jobs: ['verify', 'demo-qa', 'package-validate']
  verify: 12 steps, validate:canonical-docs at index [4]
  demo-qa: 14 steps, validate:canonical-docs at index []
  package-validate: 5 steps, validate:canonical-docs at index []
  [0] actions/checkout@11d5960a326750d5838078e36cf38b85af677262
  [1] pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1
  [2] actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
  [3] pnpm install --frozen-lockfile
  [4] pnpm validate:canonical-docs   <-- GATE
  [5] supabase/setup-cli@ab058987d8d6c725971f6cf9d0b5c98467e30bd1
  [6] supabase start
  [7] supabase db reset
  [8] pnpm db:local-credentials
  [9] pnpm turbo run typecheck
  [10] pnpm turbo run test --concurrency=1
  [11] pnpm turbo run build
gate step keys: ['run']
no if/continue-on-error: True
no '|| true': True
```

The step is in `verify` only, immediately after `pnpm install --frozen-lockfile` and
before `supabase/setup-cli` — so a documentation failure reports in about a minute
instead of after the Supabase boot, which is allowed fifteen. Its only key is `run`:
no `if:`, no `continue-on-error:`, no `|| true`. It can fail the job.

**This is what "verified" means here: the file says so, and the command it runs
exits 0 locally.** It has not been observed failing a real pull request.

### What the new gate actually covers — and what it does not

```
$ node -e '
const fs=require("fs");
const s=fs.readFileSync("scripts/validate-canonical-docs.mjs","utf8");
const m=s.match(/const REQUIRED = \[([\s\S]*?)\n\];/);
const items=[...m[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
const meta=items.filter(p=>p.endsWith(".md")&&p.startsWith("docs/")&&!p.startsWith("docs/superpowers/"));
console.log("REQUIRED paths:", items.length);
console.log("METADATA_DOCS:", meta.length, "+2 technical READMEs =", meta.length+2);
console.log("numbered docs/NN-*.md in METADATA_DOCS:", meta.filter(p=>/^docs\/\d\d-/.test(p)));
'
REQUIRED paths: 48
METADATA_DOCS: 26 +2 technical READMEs = 28
numbered docs/NN-*.md in METADATA_DOCS: []
```

**Zero numbered documents.** The gate this slice installed covers the structured
layer and nothing else. That is the reason the link sweep inside
`validate_package.py` was deliberately kept — it is still the only check anywhere
that resolves links inside the numbered layer, which slices 2-7 are about to move.
Read together, the two validators cover both layers; either alone does not.

## The metric line, before and after

| Metric | Base `e00372c` | HEAD `e7634f3` |
|---|---|---|
| `required_artifacts` | **69** | **35** |
| `documents` | 35 | 35 |
| `sql_tables` | 126 | 126 |
| `access_surfaces` | 158 | 158 |
| `states` | 261 | 261 |
| `transitions` | 295 | 295 |
| `errors` | 118 | 118 |
| `api_operations` | 157 | 157 |
| `requirements` | 41 | 41 |
| `test_contracts` | 149 | 149 |
| `ui_actions` | 103 | 103 |
| `entity_aliases` | 21 | 21 |
| `retention_mappings` | 126 | 126 |
| `command_availability_rules` | 32 | 32 |
| `external_gates_unvalidated` | 12 | 12 |

One field moved. Fourteen did not — including `documents`, which matters, and
`external_gates_unvalidated=12`, which proves Task 2 rewired the V-gate vocabulary
rather than deleting it.

### `required_artifacts` went 69 → 35 — a fall of **34**, not 35, and not "to 34"

**The design document and the plan both said "falls by 35, to 34". Both were wrong,
and the same mistake was in both.** Task 3's implementer, told to delete a
comprehension the brief described as holding 35 `(index, name)` pairs, counted it,
found **34**, followed the code rather than the brief, and reported the discrepancy
instead of quietly forcing the number either way. Its reviewer counted independently
and agreed. The plan was corrected at `ae2e917`; the design was left alone, because
it is a point-in-time record.

`required_artifacts` is `len(required_files)` (`scripts/validate_package.py:2378`),
so the count is decidable statically from the source at any revision, without running
anything:

```
$ python3 - <<'PY'
import ast, subprocess, pathlib
def count(rev):
    src = subprocess.run(["git","show",f"{rev}:scripts/validate_package.py"],capture_output=True,text=True).stdout
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", None) == "required_files":
            env = {"ROOT": pathlib.Path("."), "DOCS": pathlib.Path("docs"), "TECH": pathlib.Path("technical")}
            return len(eval(compile(ast.Expression(node.value), "<lit>", "eval"), env))
for rev in ("e00372c","22a3223","8e37caa","b28f044","46f7d94","HEAD"):
    print(f"{rev}: len(required_files) = {count(rev)}")
PY
e00372c: len(required_files) = 69
22a3223: len(required_files) = 69
8e37caa: len(required_files) = 69
b28f044: len(required_files) = 35
46f7d94: len(required_files) = 35
HEAD: len(required_files) = 35
```

HEAD's static count is 35 and the validator prints `required_artifacts=35`, so the
method is sound; applied to the base it gives 69. **69 − 35 = 34.**

And the comprehension that was deleted held 34 pairs, counted from the base source:

```
$ python3 - <<'PY'
import re, subprocess
src = subprocess.run(["git","show","e00372c:scripts/validate_package.py"],capture_output=True,text=True).stdout
m = re.search(r'\*\(DOCS / f"\{index:02d\}-\{name\}\.md" for index, name in \[(.*?)\]\)', src, re.S)
pairs = re.findall(r'\(\s*(\d+),\s*"([^"]+)"\s*\)', m.group(1))
print("pairs in required_files DOCS comprehension:", len(pairs))
print("first:", pairs[0], "last:", pairs[-1])
PY
pairs in required_files DOCS comprehension: 34
first: ('0', 'product-brief') last: ('36', 'security-verification-profile')
```

**Where the wrong number came from: two different sets were written down as one.**
`documents=35` is unchanged because the old contiguity contract counted numbered
files *from disk*, while `required_files` pinned an explicit list of 34. The extra
file is `docs/40-phase1-discovery-outreach.md` — on disk, numbered, and never in
`required_files`:

```
$ ls docs/[0-9][0-9]-*.md | wc -l
      35
$ ls docs/[0-9][0-9]-*.md | tail -1
docs/40-phase1-discovery-outreach.md
```

The old validator says so itself. Under the archive probe below, the pre-slice
validator reports:

```
- docs: expected one contiguous document for every index 00..40; missing: 23
```

Upper bound `40`, minus the six-entry `ARCHIVED_DOC_INDICES = {2, 16, 29, 37, 38, 39}`
— that is 41 − 6 = **35 from disk**, against **34 pinned**. Two contracts over two
different sets, differing by exactly `docs/40`. Writing them as one set is what
produced "35".

**This is the most useful thing in this record.** The design and the plan both
asserted a number that neither had derived, and it survived a design review, a plan
review and dispatch. It was caught by an implementer who counted the thing it was
about to delete. The generalisation: a number stated in a brief is an input to be
checked, not an instruction to be satisfied.

## The mutation checks — this is the slice's evidence

The PASS lines above are the floor. They were green before this slice too, over
every pin it removed, and they would stay green if the slice had deleted the checks
instead of rewiring them. **Only a mutation distinguishes a live check from a
deleted one.**

Eight are recorded. All eight were re-executed at this commit while writing this
record; none is transcribed from a task report without being re-run. Reviewers
deliberately designed their own mutations rather than reusing the implementers' —
mutations 4 through 8 exist because a reviewer asked a question nobody had asked.

The tree was clean before and after the whole set:

```
$ git status --porcelain
?? .agents/
?? .gstack/
?? skills-lock.json
```

(`.agents/`, `.gstack/` and `skills-lock.json` are user-added and untracked. They
were never staged, committed, moved or deleted by any task in this slice.)

### Group A — the three vocabulary mutations (Task 2 Step 5)

These prove that replacing the doc-derived `flow_ids` / `screen_ids` /
`external_gates` sets with literal constants rewired the `technical/` closure checks
rather than disabling them.

**Mutation 1 — an unknown `x-flow-id` in `openapi.yaml`** (call site: the
`x-flow-id` closure).

```
$ python3 - <<'PY'
import pathlib
p = pathlib.Path("technical/openapi.yaml"); s = p.read_text(encoding="utf-8")
i = s.index('"x-flow-id":')
p.write_text(s[:i] + s[i:].replace("F0","F9",1), encoding="utf-8")
PY
$ python3 scripts/validate_package.py; echo "exit=$?"
AktFlow package validation: FAILED (1 findings)
- openapi.yaml: submitPilotLead has unknown x-flow-id F91
exit=1
$ git checkout -- technical/openapi.yaml
```

**Mutation 2 — an unknown `screen_id` in `ui-actions.csv`.**

```
$ python3 - <<'PY'
import pathlib
p = pathlib.Path("technical/ui-actions.csv"); lines = p.read_text(encoding="utf-8").split("\n")
lines[1] = lines[1].replace("S0","S9",1)
p.write_text("\n".join(lines), encoding="utf-8")
PY
$ python3 scripts/validate_package.py; echo "exit=$?"
AktFlow package validation: FAILED (1 findings)
- ui-actions.csv:A-001 screen: unresolved references ['S92']
exit=1
$ git checkout -- technical/ui-actions.csv
```

**Mutation 3 — an unknown external gate in `traceability.csv`.**

```
$ python3 - <<'PY'
import pathlib
p = pathlib.Path("technical/traceability.csv"); lines = p.read_text(encoding="utf-8").split("\n")
i = next(n for n, line in enumerate(lines) if "V-0" in line)
lines[i] = lines[i].replace("V-0","V-9",1)
print("mutated line", i + 1)
p.write_text("\n".join(lines), encoding="utf-8")
PY
mutated line 5
$ python3 scripts/validate_package.py; echo "exit=$?"
AktFlow package validation: FAILED (1 findings)
- traceability.csv:REQ-IMPORT-01 gates: unresolved references ['V-901']
exit=1
$ git checkout -- technical/traceability.csv
```

Each names a concrete unknown identifier — `F91`, `S92`, `V-901` — rather than
failing for an unrelated reason such as a malformed row. All three reproduce Task 2's
reported output byte for byte.

### Group B — the mutation nobody had thought to run (Task 2's reviewer)

**Mutation 4 — flow *coverage*, not flow validity.** The three mutations above all
test the same shape of assertion: "is this identifier in the set?" None of them
exercised the *other* direction — `trace_flow_coverage == flow_ids`, which requires
every flow to be covered by at least one requirement. The reviewer moved
`REQ-ACQ-01` from `F01` to `F02`, a **valid** flow id, so nothing is unknown and the
first three checks stay silent:

```
$ python3 - <<'PY'
import pathlib
p = pathlib.Path("technical/traceability.csv"); lines = p.read_text(encoding="utf-8").split("\n")
i = next(n for n,l in enumerate(lines) if l.startswith("REQ-ACQ-01"))
lines[i] = lines[i].replace("F01","F02",1)
p.write_text("\n".join(lines), encoding="utf-8")
PY
$ python3 scripts/validate_package.py; echo "exit=$?"
AktFlow package validation: FAILED (1 findings)
- traceability.csv: uncovered flows ['F01']
exit=1
$ git checkout -- technical/traceability.csv
```

A different failure on a different path. This one mattered: the implementer's
evidence set never reached it, so `flow_ids`'s second consumer would have been
recorded as proven when it was untested. **The gap was in the evidence, not in the
code** — but the two are indistinguishable until someone runs the mutation.

### Group C — the archive probes, run against two validators

This is the slice's central claim: **a numbered document can now be archived without
the validator objecting.** A one-sided probe would only show today's validator green,
which proves nothing about what changed. Each probe below is run twice — once against
HEAD, once against the validator as it stood before the hold came off.

The historical validator is executed from its git object with `__file__` bound to the
repository's real script path (it derives `ROOT` from `__file__`), so **nothing is
written into the repository and `scripts/validate_package.py` is never edited**. The
harness is faithful — running HEAD through it reproduces the direct run exactly.

**Mutation 5 — `docs/23-offline-media-protocol.md` archived** (Task 3 Step 8, the
plan's nominated evidence).

```
$ git mv docs/23-offline-media-protocol.md docs/legacy/23-offline-media-protocol.md
$ python3 scripts/validate_package.py; echo "exit=$?"          # HEAD
AktFlow package validation: PASS (required_artifacts=35, documents=34, sql_tables=126, access_surfaces=158, states=261, transitions=295, errors=118, api_operations=157, requirements=41, test_contracts=149, ui_actions=103, entity_aliases=21, retention_mappings=126, command_availability_rules=32, external_gates_unvalidated=12)
External/runtime evidence status: NOT PROVEN; V-001..V-012 remain unvalidated by design.
exit=0

  … the same tree, under the 8e37caa validator (before the hold came off):
AktFlow package validation: FAILED (3 findings)
- missing required artifact: docs/23-offline-media-protocol.md
- docs: expected one contiguous document for every index 00..40; missing: 23
- docs/22: exact OpenAPI release count statement missing
exit=1

$ git mv docs/legacy/23-offline-media-protocol.md docs/23-offline-media-protocol.md
```

Green where it used to be red, and `documents` correctly falls 35 → 34 — the count
tracking reality on its own, which is the behaviour the design asked for. The third
old-validator finding is the `docs/22` sentence, which Task 4 corrected; it appears
because the old validator is being run against today's tree.

**Mutation 6 — `docs/18-domain-state-machines.md` archived** (Task 3's reviewer's own
choice, and a better one: mid-sequence, individually pinned, *and* the target of the
four money-concurrency assertions).

```
$ git mv docs/18-domain-state-machines.md docs/legacy/18-domain-state-machines.md
$ python3 scripts/validate_package.py; echo "exit=$?"          # HEAD
AktFlow package validation: PASS (required_artifacts=35, documents=34, …)
exit=0

  … the same tree, under the 8e37caa validator:
FileNotFoundError: [Errno 2] No such file or directory: '/…/docs/18-domain-state-machines.md'
exit=CRASH

$ git mv docs/legacy/18-domain-state-machines.md docs/18-domain-state-machines.md
```

The old validator did not fail — it **crashed**, on an unconditional `read_text()`.
Worth noting on its own: a validator that crashes rather than failing gives no
finding, no message, and no clue which file to look at.

**Mutation 7 — `docs/22-data-api-contract.md` archived** (Task 4's reviewer, checking
the very last hold).

```
$ git mv docs/22-data-api-contract.md docs/legacy/22-data-api-contract.md
$ python3 scripts/validate_package.py; echo "exit=$?"          # HEAD
AktFlow package validation: PASS (required_artifacts=35, documents=34, …)
exit=0

  … the same tree, under the 46f7d94 validator (Task 4's parent):
FileNotFoundError: [Errno 2] No such file or directory: '/…/docs/22-data-api-contract.md'
exit=CRASH

$ git mv docs/legacy/22-data-api-contract.md docs/22-data-api-contract.md
```

**`docs/22` is the one that proves the sequence finished.** After Task 3 the file
still read it unconditionally; the crash above is at `46f7d94`, one commit before
Task 4 removed that read. That is exactly why Task 3's docstring was corrected (see
the plan-defects section). Today:

```
$ grep -n 'DOCS / "' scripts/validate_package.py
(no output — zero matches)
$ grep -n 'DOCS' scripts/validate_package.py
33:DOCS = ROOT / "docs"
164:    for path in DOCS.glob("*.md")
169:markdown_files = [ROOT / "README.md", *sorted(DOCS.glob("*.md")), ROOT / "prototype" / "README.md"]
```

Three uses of `DOCS` remain: the definition, the `doc_numbers` count (an observation
for the metrics line), and the link sweep. **No numbered document is read by name
anywhere in the file.** The wide `grep -n 'DOCS'` is used rather than the narrow
`grep -n 'DOCS / "'` on purpose — the narrow one cannot see an f-string or a
differently-built path, so it could report zero while a read survived.

### Group D — the two kept checks, proven still live

Removing four holds is only safe if what was kept still works. Both kept checks were
attacked, not merely read.

**Mutation 8a — the link sweep** (kept deliberately, owner-confirmed; the only check
anywhere that resolves links inside the numbered layer).

```
$ cp docs/20-flow-catalog.md /tmp/docs20.bak
$ printf '\n[deliberately broken](./2026-08-03-docs-slice1-gate.md)\n' >> docs/20-flow-catalog.md
$ python3 scripts/validate_package.py; echo "exit=$?"
AktFlow package validation: FAILED (1 findings)
- broken link in docs/20-flow-catalog.md: ./2026-08-03-docs-slice1-gate.md
exit=1
$ cp /tmp/docs20.bak docs/20-flow-catalog.md; rm /tmp/docs20.bak
$ git status --porcelain -- docs/20-flow-catalog.md
(no output — restored)
```

**The probe's link target was chosen so that this record can quote it safely.**
`./2026-08-03-docs-slice1-gate.md` does not resolve from `docs/`, which is what makes
it a broken link there — and it *does* resolve from
`docs/superpowers/plans/evidence/`, which is where this record lives. The sweep does
not read this directory today (`DOCS.glob("*.md")` is non-recursive, and
`validate-canonical-docs.mjs` excludes `docs/superpowers/`), but a gate record should
not be quietly waiting to red a future slice that widens it. A transcript containing
a deliberately broken link is a landmine in any file a link checker might one day
read.

This probe was necessary because Task 3's own archive mutation did **not** fire the
link sweep — nothing in the swept set linked to `docs/23` by that path, so the
mutation could not tell a live sweep from a dead one. The probe can.

**Mutation 8b — the orphan-test sweep**, narrowed by Task 3 and therefore the one
most at risk of having been narrowed to nothing.

```
$ … append a row to technical/test-catalog.csv whose test_id is T-REVIEWER-ORPHAN-001
$ python3 scripts/validate_package.py; echo "exit=$?"
AktFlow package validation: FAILED (1 findings)
- test-catalog.csv: orphan tests ['T-REVIEWER-ORPHAN-001']
exit=1
$ … technical/test-catalog.csv restored from a backup taken before the append
```

### Group E — the repointed `x-release` assertion (Task 4's reviewer)

Task 4 did not delete the assertion that read two numbers out of `docs/22`'s prose;
it **repointed** it at `openapi.yaml` itself. A repointed assertion is the easiest
kind to get wrong — it can look busy and check nothing. Two mutations, on two
different failure paths:

**Mutation 9 — an `x-release` set to a third value.**

```
$ … set the first "x-release": "Pilot" to "x-release": "Later"
$ python3 scripts/validate_package.py; echo "exit=$?"
AktFlow package validation: FAILED (4 findings)
- openapi.yaml: submitPilotLead has invalid x-release Later
- openapi.yaml: every operation must declare x-release Pilot or GA; 112 + 44 != 157 operations
- ui-actions.csv:A-001: release differs from OpenAPI Later
- traceability.csv:REQ-ACQ-01: submitPilotLead is Later but requirement is Pilot
exit=1
$ git checkout -- technical/openapi.yaml
```

**Mutation 10 — the `x-release` key removed entirely**, which the enum check alone
might have slept through:

```
$ … delete the line '        "x-release": "Pilot",' from the first operation
$ python3 scripts/validate_package.py; echo "exit=$?"
AktFlow package validation: FAILED (4 findings)
- openapi.yaml: submitPilotLead has invalid x-release None
- openapi.yaml: every operation must declare x-release Pilot or GA; 112 + 44 != 157 operations
- ui-actions.csv:A-001: release differs from OpenAPI None
- traceability.csv:REQ-ACQ-01: submitPilotLead is None but requirement is Pilot
exit=1
$ git checkout -- technical/openapi.yaml
```

The second finding is the assertion under test, and it fires on both paths. The other
three are pre-existing cross-checks catching the same mutation from other angles —
incidental confirmation that the corpus is well cross-checked, not the thing being
proven.

## The deferred correction, measured

Slice 0 could not correct `docs/22-data-api-contract.md:130` because
`validate_package.py` regexed that sentence's numbers out of the prose. Task 4 made
the removal and the correction one commit. All three numbers in the new sentence were
re-measured at this commit:

```
$ echo -n "scope-v0.1.csv operations: "; tail -n +2 technical/openapi/scope-v0.1.csv | grep -c .
scope-v0.1.csv operations: 51
$ echo "openapi.yaml x-release tally:"; grep -A1 "x-release" technical/openapi.yaml | grep -oE "Pilot|GA" | sort | uniq -c
openapi.yaml x-release tally:
  44 GA
 113 Pilot
$ python3 scripts/validate_package.py | grep -o "api_operations=[0-9]*"
api_operations=157
```

51; 113 + 44 = 157 = `api_operations`. The sentence now reads:

```
$ grep -n "scope-v0.1.csv\` is the exact v0.1 allowlist" docs/22-data-api-contract.md
130:`technical/openapi/scope-v0.1.csv` is the exact v0.1 allowlist: 51 operations. `technical/openapi.yaml` v2.9 is the wider target surface — 157 operations, 113 Pilot and 44 GA-forward at this revision — and is not authorization to implement anything in v0.1. An endpoint name in prose is not authorization to implement it either. Supabase owns sign-in/session primitives; therefore `/me` and raw session/token operations are intentionally absent from the AktFlow domain API.
```

`scope-v0.1.csv`'s authority claim was checked at the source rather than inferred
from the filename — its `milestone` column reads `v0.1-M1`, and 51 is an operation
count, not a line count (52 lines, 1 header):

```
$ head -2 technical/openapi/scope-v0.1.csv
operation_id,method,path,kind,idempotency,auth_plane,request_contract_owner,response_contract_owner,milestone
workspaces.create,POST,/v1/workspaces,command,required,member,@goproceed/contracts,@goproceed/contracts,v0.1-M1
$ wc -l < technical/openapi/scope-v0.1.csv
      52
```

The old phrasing survives nowhere in the live corpus:

```
$ grep -rn "is the exact allowlist" docs/ --include='*.md' | grep -v "docs/superpowers/\|docs/legacy/"
(no output)
```

**And the pairing is proven from the other direction, which is the part slice 0 could
not demonstrate.** Run the *base* validator against today's corrected tree:

```
  … e00372c validator, current tree:
AktFlow package validation: FAILED (1 findings)
- docs/22: exact OpenAPI release count statement missing
exit=1
```

The corrected sentence would have reddened the pre-slice build. That is precisely why
the assertion's removal and the sentence's correction had to be one commit, and it is
now a measured fact rather than an argument.

## Four defects in the plan, caught during execution

The plan is a document like any other. Four of its claims were wrong, and each was
caught by someone running the thing rather than reading it. They are recorded because
a plan that produced no defects is usually a plan nobody executed carefully.

**1. A mutation script that would have mutated nothing** (Task 2). The brief's
mutation searched for a bare YAML-style `x-flow-id:`. `openapi.yaml` stores the key
JSON-style, quoted:

```
$ grep -c 'x-flow-id:' technical/openapi.yaml
0
$ grep -c '"x-flow-id":' technical/openapi.yaml
157
$ python3 -c "import pathlib; pathlib.Path('technical/openapi.yaml').read_text().index('x-flow-id:')" 2>&1 | tail -2
  File "<string>", line 1, in <module>
ValueError: substring not found
```

The script raised before writing, so no file was touched. **The failure mode it
avoided is the dangerous one:** had the token merely matched something harmless, the
mutation would have changed nothing, the validator would have printed PASS, and a
live check would have been recorded as dead. The implementer corrected the token,
targeted `openapi.yaml:121`, and got the expected failure — recorded as mutation 1
above.

**2. A traceability mutation aimed at a row that would have been a silent no-op** —
caught while writing the plan, before dispatch, and written into the plan as a
warning. Row 2's `external_gates` column is `none`:

```
$ python3 - <<'PY'
import csv
rows = list(csv.DictReader(open("technical/traceability.csv", encoding="utf-8")))
for i, r in enumerate(rows[:4], start=2):
    print(f"line {i}: {r['requirement_id']:<16} external_gates={r['external_gates']!r}")
print("first row carrying a real gate:",
      next((i, r['requirement_id'], r['external_gates']) for i, r in enumerate(rows, start=2) if r['external_gates'].startswith("V-")))
PY
line 2: REQ-ACQ-01       external_gates='none'
line 3: REQ-ID-01        external_gates='none'
line 4: REQ-ORG-01       external_gates='none'
line 5: REQ-IMPORT-01    external_gates='V-001'
first row carrying a real gate: (5, 'REQ-IMPORT-01', 'V-001')
```

Mutating `none` changes nothing and produces a PASS that looks exactly like a
disabled check. The plan named line 5 instead, and told the implementer to scan for a
real gate token rather than trust the line number. Same failure mode as defect 1,
found one step earlier.

**3. The arithmetic** — `required_artifacts`, recorded in full above. Corrected in
the plan at `ae2e917`; left standing in the design as a point-in-time record.

**4. A docstring asserting an end state one commit before it existed** (Task 3,
fixed at `46f7d94`). Task 3's new module docstring said the validator "no longer
asserts the numbered `docs/NN-*.md` layer's shape, **contents** or existence". The
contents half was false at `b28f044`: an unconditional read of `docs/22` remained,
feeding two `require`s, and it was Task 4's to remove. Task 3's reviewer disproved
the sentence by moving `docs/22` and watching the validator crash — reproduced above
as mutation 7. **Task 3 was right not to touch the read; the defect was the docstring
claiming an end state the commit had not reached.** It was fixed by qualifying the
sentence, after a widened grep confirmed `docs/22` really was the last named read.

The pattern in defects 1, 2 and 4: three of the four are about **a claim that looks
verified but is not** — a mutation that verifies nothing, a mutation that verifies
nothing, and a docstring that describes a future commit. Defect 3 is a number nobody
derived. All four are the same species.

## Claims in this slice's own documents that do not reproduce

Recorded rather than corrected. The plan's Global Constraints forbid this task from
editing documents; a claim found here belongs in the record as an open item, never
smoothed into a record as though it had been fixed.

**The design says "316 assertions"; the assertion count is 315.** The 316 is a grep
count that includes the helper's own definition line:

```
$ git show e00372c:scripts/validate_package.py | grep -c 'require('
316
$ git show e00372c:scripts/validate_package.py | python3 -c "
import ast,sys; t=ast.parse(sys.stdin.read())
print(sum(1 for n in ast.walk(t) if isinstance(n,ast.Call) and getattr(n.func,'id','')=='require'))"
315
```

315 `require()` call sites + 1 `def require(` line = 316. There are also 17
`require_refs()` calls, so under a "every assertion-helper call site" rule the base
total is **332**, and HEAD's is **314** (297 + 17). A count without its counting rule
is the defect, not the count — this record states four numbers and the rule for each.

**The design says "twelve reads of a named numbered document"; there are eleven,
naming ten distinct documents.**

```
$ git show e00372c:scripts/validate_package.py | grep -c 'DOCS / "'
11
$ git show e00372c:scripts/validate_package.py | grep -oE 'DOCS / "[0-9]{2}-[a-z0-9-]+\.md"' | sort | uniq -c
   1 DOCS / "01-prd.md"
   1 DOCS / "04-screen-specification.md"
   1 DOCS / "07-technical-architecture.md"
   1 DOCS / "12-roadmap-delivery.md"
   1 DOCS / "18-domain-state-machines.md"
   1 DOCS / "19-organizations-roles-access.md"
   1 DOCS / "20-flow-catalog.md"
   2 DOCS / "22-data-api-contract.md"
   1 DOCS / "28-pilot-ga-delivery.md"
   1 DOCS / "30-validation-evidence-register.md"
```

Eleven expressions over ten documents, `docs/22` read twice. No counting rule tried
here reproduces twelve; the nearest candidate is counting `required_files`'
`DOCS / f"{index:02d}-{name}.md"` comprehension as a twelfth, but that constructs
paths and never reads. All eleven are gone at HEAD.

**The plan still says the deleted comprehension held 35 pairs, in two places
`ae2e917` did not reach.** The correction fixed four sites; these two survive:

```
$ grep -n "Remove the 35 numbered documents\|listing 35 \`(index, name)\` pairs" docs/superpowers/plans/2026-08-03-docs-slice1-gate.md
411:- [ ] **Step 2: Remove the 35 numbered documents from `required_files`**
416:listing 35 `(index, name)` pairs from `(0, "product-brief")` to
```

Line 416 is the false one: the list holds 34 pairs, measured above. Line 411's "35
numbered documents" is defensible as a description of the layer (35 files are on
disk) but sits four lines above the wrong 34/35 and reads as the same claim.
**Neither is corrected here** — this task does not edit documents. It is a residual
of the correction at `ae2e917`, and the lesson is that a fix applied "in all four
places" needs the grep that finds the fifth.

**Task 3's report describes a `rmdir` that cannot have succeeded.** The report's
Step 8 transcript reads `rmdir docs/legacy   # empty, removed the directory the
mutation created`. `docs/legacy/` is a pre-existing tracked directory with fifteen
tracked files, created long before this branch:

```
$ git ls-files docs/legacy | wc -l
      15
$ git log --oneline --diff-filter=A -- docs/legacy | tail -1
2883c69 docs: establish GoProceed decision authority
```

So the `mkdir -p docs/legacy` was a no-op and the `rmdir` would have failed with
`Directory not empty`. **The outcome was still correct** — the report's own
`git status --porcelain` shows a clean tree, the directory survived, and nothing
user-added was disturbed — so this is a false narrative sentence, not a false
result. It is recorded because the report's contract, like this record's, is that its
transcript is what happened.

**And the design's "seven `technical/` files that still carry the dead `sealed`
vocabulary" is seven or eight depending on an unstated rule.** Measured:

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

**Eight**, or seven under the rule "files other than `technical/schema.sql`, which is
the vocabulary's *source* rather than a consumer of it". Slice 0's gate record
settled this the same way and for the same reason; both numbers are stated again here
because repeating a bare count with an unstated rule, in the record that closes a
slice about unstated contracts, would be a poor joke twice over.

## What this slice deliberately did not do

**No file moved.** Every archive probe restored its file, and the tree is clean:

```
$ git status --porcelain
?? .agents/
?? .gstack/
?? skills-lock.json
$ git diff --name-status e00372c..HEAD
M	.github/workflows/ci.yml
M	Makefile
M	docs/22-data-api-contract.md
A	docs/superpowers/plans/2026-08-03-docs-slice1-gate.md
A	docs/superpowers/specs/2026-08-03-docs-slice1-gate-design.md
M	scripts/validate_package.py
```

No `R` status anywhere: nothing was renamed or moved. The two new files are the plan
and the design; this record and the invariant-debt record are the only other
additions, and they are added by the commit that writes them.

**`scripts/validate_package.py` was not renamed**, and neither was the
`package-validate` CI job. Only the module docstring changed to describe what the
file now validates. A rename in the same commit would have obscured a diff that needs
reading closely.

**The `package-validate` job's prototype half is untouched.** It still has 5 steps
and no documentation gate — see the workflow parse above.

**The AktFlow→GoProceed rename was not started.** `docs/22:130` ends with "absent
from the AktFlow domain API" and that clause is byte-identical to before; the
validator still prints `AktFlow package validation`. Changing one instance here would
leave the rename slice an inconsistency to hunt.

**The eight product invariants are unguarded, not re-asserted.** They are the subject
of [the invariant-debt record](2026-08-03-docs-slice1-invariant-debt.md), which names
the successor document that owes each one. All eight are currently intact in their
original documents, verified there by command. **This is the largest thing this slice
gave up, and the debt record is the only thing standing between it and silence.**

**The `sealed` vocabulary survives under `technical/`** — eight files, listed above.
Correcting one without the others reds the build, because `validate_package.py`
cross-checks them against each other; correcting all eight is a coordinated change to
the pre-implementation design layer, out of scope here. A known open item, carried
forward from slice 0's record unchanged.

**Two structural checks were narrowed rather than kept**, and both narrowings are
recorded as debt rather than absorbed: the test-reference sweep no longer reads
`docs/*.md` (five named tests in `DOC_ONLY_TEST_REFS`), and the numbered-index
contiguity contract is gone entirely (`doc_numbers` is now an observation). One minor
consequence, noted by Task 3's reviewer and deliberately accepted: the new
`doc_numbers` regex `(\d{2})(?=-)` silently skips a one- or three-digit prefix where
the old code flagged it malformed. Same value today; the metric is an observation now,
not a contract.

**Two gates remain unproven and stay unproven.** `pnpm typecheck` and
`pnpm turbo run test --concurrency=1` — see the Evidence section for what would settle
them. This record does not predict their result.

**And CI has still not run.** That is the first section of this record and it is also
the last item here, because it is the one thing a reader is most likely to assume.

## What is left over for the final review

Four minors were logged during execution, deferred rather than fixed, and none was
introduced by this slice's changes:

- The validator's final printed line — `External/runtime evidence status: NOT PROVEN;
  V-001..V-012 remain unvalidated by design.` — is a hardcoded string. The prose
  assertion Task 2 removed was the last thing checking that `docs/30` agreed with it.
  Predates the change; the change removed its last cross-check.
- The `doc_numbers` regex narrowing, above.
- Task 3 Step 4's replacement comment forward-references this slice's invariant-debt
  record, which was created by Task 5. Prescribed by the plan; true as of this commit.
- Task 4's reviewer found the new docstring's wording "slightly awkward —
  grammatically reads as if the removed assertion 'is now' the new one" but not
  inaccurate.

## Commits

**As of the commit that writes this record, nine.** The number counts the commit that
writes it, so it cannot be pasted from a pre-commit `git log … | wc -l` — that
command returns eight until this file lands. Whoever revises this next updates the
table and this sentence together, or the two stop agreeing. The same trap cost slice
0's record three revisions.

```
$ git log --oneline e00372c..HEAD | wc -l
       8        # before this record's commit; nine after
```

| Commit | What | Files |
|---|---|---|
| `4f0f47f` | design — not a change to the validator | 1 |
| `ecfc8b7` | plan — not a change to the validator | 1 |
| `22a3223` | **Task 1** — the gate goes in first: `pnpm validate:canonical-docs` into the `verify` job, `validate-canonical` into the `Makefile` | 2 (+11/−2) |
| `8e37caa` | **Task 2** — the S/F/V vocabularies become constants; the three doc reads stop being inputs | 1 (+13/−10) |
| `b28f044` | **Task 3** — the hold comes off: `required_files`, contiguity, eight prose assertions, the test sweep | 1 (+54/−109) |
| `46f7d94` | Task 3 fix round 1 — the docstring claimed an end state one commit early | 1 (+4/−2) |
| `ae2e917` | controller — the plan's arithmetic corrected in four places: 69 → 35, a fall of 34 | 1 (+7/−4) |
| `e7634f3` | **Task 4** — the deferred correction lands: the `docs/22` assertion repointed at `openapi.yaml`, and the sentence corrected, atomically | 2 (+17/−8) |
| *(this commit)* | **Task 5** — the invariant-debt record and this gate record | 2 |

**The gate precedes every removal, which is the whole safety argument.** `22a3223`
installs the CI gate; `8e37caa`, `b28f044` and `e7634f3` each remove something, in
that order, with the gate already standing. The design asked for one commit; the plan
delivered five task commits plus two fixes, and the property the design argued for —
never red, never ungated — is met more strictly by the ordering than a single commit
could express. That deviation was raised in the plan's own self-review, put to the
owner before dispatch, and ruled on rather than absorbed.

Every commit is independently green: each task ran both validators before committing,
and the one pairing that genuinely cannot be split — removing the `docs/22:130`
assertion and correcting the sentence — is atomic inside `e7634f3`.

**Two of the eight commits are fixes to this slice's own output** (`46f7d94`,
`ae2e917`), and both were prompted by someone measuring a claim rather than reading
it. Two of the four tasks were approved with zero findings (Tasks 1 and 4); both of
those reviewers had built their own mutations instead of re-running the
implementer's.

### The whole diff, as of this commit

```
$ git diff --name-only e00372c..HEAD
.github/workflows/ci.yml
Makefile
docs/22-data-api-contract.md
docs/superpowers/plans/2026-08-03-docs-slice1-gate.md
docs/superpowers/plans/evidence/2026-08-03-docs-slice1-gate.md
docs/superpowers/plans/evidence/2026-08-03-docs-slice1-invariant-debt.md
docs/superpowers/specs/2026-08-03-docs-slice1-gate-design.md
scripts/validate_package.py
```

Eight files: one workflow, one `Makefile`, one Python script, five Markdown — of
which four are this slice's own design, plan and two records, leaving
`docs/22-data-api-contract.md` as **the only documentation content this slice
changed, one line of it**. No TypeScript, no `package.json`, no lockfile.

**This listing includes the two files being added by the commit that writes it**, and
is therefore stated as the post-commit state, like the commit count above. Before
this commit the same command returns six paths. The one number in this section that
is *not* self-referential, and therefore the one worth trusting without a caveat, is
the validator's net delta:

```
$ git diff --stat e00372c..HEAD -- scripts/validate_package.py
 scripts/validate_package.py | 205 ++++++++++++++++++--------------------------
 1 file changed, 82 insertions(+), 123 deletions(-)
```

2444 lines down to 2403; 332 assertion-helper call sites down to 314. **Eighteen
assertions gone, and every one of them was about the numbered documentation layer.**
The `technical/` integrity checks — 157 API operations, 261 states, 295 transitions,
118 errors, 149 test contracts, 103 UI actions, 158 access surfaces, the OpenAPI
`$ref` closure and the traceability graph — are all still there, and the metric table
above is the proof that none of them quietly stopped counting.
