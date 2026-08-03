# Documentation slice 1 — invariant debt

**Date:** 2026-08-03
**Branch:** `claude/docs-slice1-gate`, from `claude/docs-slice0-truth` @ `e00372c`
**Incurred by:** `8e37caa` (Task 2 Step 3), `b28f044` (Task 3 Step 4) and `e7634f3`
(Task 4 Step 2) — three commits, not one; see "What this file is"
**Plan:** [2026-08-03-docs-slice1-gate.md](../2026-08-03-docs-slice1-gate.md)
**Gate record:** [2026-08-03-docs-slice1-gate.md](2026-08-03-docs-slice1-gate.md)

## What this file is

`scripts/validate_package.py` used to assert **nine** literal substrings inside
**eight** numbered documents. Those assertions were not documentation-structure
checks. They were **product invariants** — the only automated guard, anywhere in the
repository, against someone quietly softening universal live-Pilot MFA, or the
terminal project archive, or the honest solo delivery ranges. Slice 1 removed them,
because `"X" in docs/01` breaks the moment `docs/01` moves and slices 2-7 exist to
move it.

**Nine, not eight, and they did not all go in one commit.** Eight came out together
at `b28f044` (Task 3 Step 4) and are described by the comment that replaced them,
which is why `scripts/validate_package.py:183` says "Eight prose assertions" — that
comment is accurate about its own block. The ninth, on `docs/30`, came out one commit
earlier at `8e37caa` (Task 2 Step 3), riding along with the external-gate vocabulary
change, and no comment marks its site. **A debt recorded per-commit would have lost
it**, which is why this record is organised by invariant rather than by commit.

Two further debts are not removed assertions at all — one hold that *survived* this
slice outside the validator entirely, and one assertion that was weakened rather than
removed. They are in "Two debts that are not removed assertions" below, and they are
the two most likely to surprise a later slice, precisely because neither shows up as
a deletion in this branch's diff.

**All of it is a real loss, and this file is the receipt.** It exists so the loss has
an owner rather than a shrug.

**The "Must be re-asserted in" column says where each invariant *belongs*, not where
its text lives today.** For most of these the successor document does not yet carry
the sentence at all. Writing it there is the successor slice's work; this table is
what obliges it. Do not read a row as a claim that the structured layer already
covers the invariant — it does not, which is the whole point of recording the debt.

**Where the invariant text lives today is the "Still in" column**, and every row was
re-measured at this commit. All nine are currently intact in their original numbered
document. They are unguarded, not gone.

## The nine removed content assertions

Line numbers are the assertion's address in `scripts/validate_package.py` at
`e00372c`, this slice's base — the last commit at which they existed. Rows 1-8 were
removed at `b28f044`; row 9 at `8e37caa`.

| # | Invariant (the exact asserted string) | Still in | Was asserted at | Failure message it produced | Must be re-asserted in |
|---|---|---|---|---|---|
| 1 | `MFA обязательно для каждого пользователя с live Pilot data` | `docs/01-prd.md` | `:255` (text read `:248`) | `docs/01: universal live-Pilot MFA boundary drifted` | `docs/architecture/tenancy-and-security.md` |
| 2 | `Project archive is immutable and terminal` **and** `There is no in-place restore` | `docs/01-prd.md` | `:256` | `docs/01: project archive/continuation contract drifted` | `docs/product/scope-and-boundaries.md` |
| 3 | `Evidence has no generic delete action` present, **and `soft-deleted` absent** | `docs/01-prd.md` | `:257` | `docs/01: evidence must use immutable invalidation/correction, not an unspecified soft delete` | `docs/domain/execution-and-evidence.md` |
| 4 | `GA-forward assignment grouping only` | `docs/19-organizations-roles-access.md` | `:258` (text read `:249`) | `docs/19: team/crew must remain explicitly GA-forward until modelled` | `docs/architecture/tenancy-and-security.md` |
| 5 | `Tenant bearer tokens and tenant permissions never authorize these operations` | `docs/22-data-api-contract.md` | `:259` (text read `:250`) | `docs/22: platform billing authority separation missing` | `docs/architecture/tenancy-and-security.md` |
| 6 | `Next.js **16.2.11 or newer security-patched 16.2.x**` | `docs/07-technical-architecture.md` | `:260` (text read `:251`) | `docs/07: current Next.js security-patched floor missing` | `docs/architecture/system-overview.md` |
| 7 | `Safe first live Pilot (months 5–9)` **and** `Safe standalone GA (months 10–18+)`; `safe first live Pilot: 6–9 months solo` **and** `safe standalone GA: 12–18+ months solo` | `docs/12-roadmap-delivery.md`, `docs/28-pilot-ga-delivery.md` | `:261`, `:262` (text reads `:252`, `:253`) | `docs/12: solo delivery stages drifted back to the optimistic schedule`; `docs/28: honest solo planning range missing` | `docs/product/roadmap.md` |
| 8 | Four money-concurrency markers, each required separately: `` PostgreSQL `SERIALIZABLE` ``, `SELECT ... FOR UPDATE`, `ascending UUID order`, `Direct multi-step BFF writes are forbidden` | `docs/18-domain-state-machines.md` | `:263-264` loop (text read `:254`) | `docs/18: money concurrency algorithm missing {marker}` | `docs/domain/domain-model.md` |
| 9 | ``all V-001–V-012 remain `unvalidated` `` | `docs/30-validation-evidence-register.md` | `:2292` (text read `:2289`) — **removed at `8e37caa`, one commit before the other eight** | `validation register must preserve explicit unvalidated status` | `docs/discovery/validated-assumptions.md` |

**Row 9 is the one with a live consumer, which makes it the sharpest of the nine.**
The validator still prints, on every successful run:

```
$ python3 scripts/validate_package.py | tail -1
External/runtime evidence status: NOT PROVEN; V-001..V-012 remain unvalidated by design.
```

That line is a **hardcoded string** (`scripts/validate_package.py:2403`). Row 9's
assertion was the last thing checking that `docs/30` still agreed with it. The
validator now states a fact about external evidence on its own authority, with
nothing tying it to the register it names. It is true today —

```
$ grep -cF 'all V-001–V-012 remain `unvalidated`' docs/30-validation-evidence-register.md
1
```

— and if someone validates a gate in `docs/30` tomorrow, the validator will go on
printing that all twelve are unvalidated. **A hardcoded reassurance that outlives its
check is worse than no reassurance**, because it reads like a measurement. Its
successor, `docs/discovery/validated-assumptions.md`, is where the claim belongs, and
whatever re-asserts it should be what the printed line reads from rather than a
second copy of the same sentence.

### The successor column against the approved disposition

The successor column is this slice's judgement about where an *invariant* belongs,
which is not always where its *document* goes. Both are recorded so a later slice can
see the difference rather than discover it:

```
$ for d in 01-prd 07-technical-architecture 12-roadmap-delivery 18-domain-state-machines \
           19-organizations-roles-access 22-data-api-contract 28-pilot-ga-delivery \
           30-validation-evidence-register; do
    grep "^docs/$d.md," migration/goproceed-canonical-v0.1/document-disposition.csv | cut -d, -f1,3,4
  done
docs/01-prd.md,rewrite,docs/product/scope-and-boundaries.md
docs/07-technical-architecture.md,rewrite,docs/architecture/system-overview.md
docs/12-roadmap-delivery.md,rewrite,docs/product/roadmap.md
docs/18-domain-state-machines.md,rewrite,technical/states/state-catalog.csv
docs/19-organizations-roles-access.md,rewrite,docs/architecture/tenancy-and-security.md
docs/22-data-api-contract.md,keep,docs/22-data-api-contract.md
docs/28-pilot-ga-delivery.md,rewrite,docs/delivery/version-0.1.md
docs/30-validation-evidence-register.md,rewrite,docs/discovery/validated-assumptions.md
```

Rows 2, 4, 6, 7 and 9 route their invariant to the document's own approved target.
Rows 1, 3 and 8 deliberately do not: `docs/01`'s MFA and evidence-delete invariants
belong with tenancy and with the evidence domain rather than with scope, and
`docs/18`'s money markers belong in `docs/domain/domain-model.md` rather than in the
CSV that `docs/18` rewrites into.

**Row 5 is the exception that matters: `docs/22-data-api-contract.md` is not moving
at all.** Its disposition is `keep`, targeting itself. So the tenant-bearer-token
invariant lost its guard without its document ever being at risk — the assertion
could have stayed. It is the least urgent of the nine to re-assert, and the only one
that could be restored in place rather than written somewhere new.

This also makes the replacement comment at `scripts/validate_package.py:183` slightly
too broad. It says of the eight files it names: "Every one of those files has an
approved disposition and is moving." `docs/22` has an approved disposition and is
**not** moving. The comment is not edited here — this task changes no code — and the
inaccuracy is harmless in context, but a later slice reading it as a list of files to
find in new locations will look for `docs/22` and not find it moved.

**Row 3 is the one that behaves differently and must be carried differently.** It is
half a presence assertion and half an **absence** assertion: `docs/01` had to say
`Evidence has no generic delete action` *and* had to not contain the string
`soft-deleted` anywhere. A successor that only asserts the positive sentence
re-establishes half of it. The absence half is the part that actually stopped
someone introducing an unspecified soft delete, and it is the harder half to
re-express in a moved document, because "this string appears nowhere" is a claim
about a whole file rather than about a sentence.

**Row 7 is two assertions over two documents**, deliberately not merged. `docs/12`
carries the stage labels and `docs/28` carries the solo ranges; the successor is one
document, so the successor slice must carry four strings, not two.

**Row 8 is a loop, not one assertion.** Each of the four markers produced its own
`require`, so a successor asserting three of the four silently loses one.

### Verification — every string still appears where the table says it does

Run at this commit, from the repository root. `grep -cF` (fixed-string) is used
rather than `grep -c` so that `` ` ``, `*`, `.` and `(` in the invariants are not
read as pattern syntax:

```
$ grep -cF "MFA обязательно для каждого пользователя с live Pilot data" docs/01-prd.md
1
$ grep -cF "Project archive is immutable and terminal" docs/01-prd.md
1
$ grep -cF "There is no in-place restore" docs/01-prd.md
1
$ grep -cF "Evidence has no generic delete action" docs/01-prd.md
1
$ grep -cF "soft-deleted" docs/01-prd.md
0
$ grep -cF "GA-forward assignment grouping only" docs/19-organizations-roles-access.md
1
$ grep -cF "Tenant bearer tokens and tenant permissions never authorize these operations" docs/22-data-api-contract.md
1
$ grep -c 'Next.js \*\*16.2.11 or newer security-patched 16.2.x\*\*' docs/07-technical-architecture.md
1
$ grep -cF "Safe first live Pilot (months 5–9)" docs/12-roadmap-delivery.md
1
$ grep -cF "Safe standalone GA (months 10–18+)" docs/12-roadmap-delivery.md
1
$ grep -cF "safe first live Pilot: 6–9 months solo" docs/28-pilot-ga-delivery.md
1
$ grep -cF "safe standalone GA: 12–18+ months solo" docs/28-pilot-ga-delivery.md
1
$ grep -cF "Direct multi-step BFF writes are forbidden" docs/18-domain-state-machines.md
1
$ grep -cF "PostgreSQL \`SERIALIZABLE\`" docs/18-domain-state-machines.md
1
$ grep -cF "SELECT ... FOR UPDATE" docs/18-domain-state-machines.md
1
$ grep -cF "ascending UUID order" docs/18-domain-state-machines.md
1
$ grep -cF 'all V-001–V-012 remain `unvalidated`' docs/30-validation-evidence-register.md
1
```

`1` for every presence assertion; `0` for `soft-deleted`, which is correct — that one
asserted the string's **absence**. **No invariant has drifted as of this commit.**
All nine are currently true and currently unguarded.

**These commands are also the interim guard.** Until the successors carry the
sentences, running this block is how anyone checks that nothing has moved. It is a
worse guard than a validator assertion, because nothing runs it — which is the
argument for closing the debt rather than living with it.

### Where the assertions were, in the base

```
$ git show e00372c:scripts/validate_package.py | sed -n '248,265p'
prd_text = (DOCS / "01-prd.md").read_text(encoding="utf-8")
access_doc_text = (DOCS / "19-organizations-roles-access.md").read_text(encoding="utf-8")
api_contract_text = (DOCS / "22-data-api-contract.md").read_text(encoding="utf-8")
architecture_text = (DOCS / "07-technical-architecture.md").read_text(encoding="utf-8")
roadmap_text = (DOCS / "12-roadmap-delivery.md").read_text(encoding="utf-8")
delivery_text = (DOCS / "28-pilot-ga-delivery.md").read_text(encoding="utf-8")
state_machine_text = (DOCS / "18-domain-state-machines.md").read_text(encoding="utf-8")
require("MFA обязательно для каждого пользователя с live Pilot data" in prd_text, "docs/01: universal live-Pilot MFA boundary drifted")
require("Project archive is immutable and terminal" in prd_text and "There is no in-place restore" in prd_text, "docs/01: project archive/continuation contract drifted")
require("Evidence has no generic delete action" in prd_text and "soft-deleted" not in prd_text, "docs/01: evidence must use immutable invalidation/correction, not an unspecified soft delete")
require("GA-forward assignment grouping only" in access_doc_text, "docs/19: team/crew must remain explicitly GA-forward until modelled")
require("Tenant bearer tokens and tenant permissions never authorize these operations" in api_contract_text, "docs/22: platform billing authority separation missing")
require("Next.js **16.2.11 or newer security-patched 16.2.x**" in architecture_text, "docs/07: current Next.js security-patched floor missing")
require("Safe first live Pilot (months 5–9)" in roadmap_text and "Safe standalone GA (months 10–18+)" in roadmap_text, "docs/12: solo delivery stages drifted back to the optimistic schedule")
require("safe first live Pilot: 6–9 months solo" in delivery_text and "safe standalone GA: 12–18+ months solo" in delivery_text, "docs/28: honest solo planning range missing")
for money_algorithm_marker in ("PostgreSQL `SERIALIZABLE`", "SELECT ... FOR UPDATE", "ascending UUID order", "Direct multi-step BFF writes are forbidden"):
    require(money_algorithm_marker in state_machine_text, f"docs/18: money concurrency algorithm missing {money_algorithm_marker}")
```

Eighteen lines, seven reads and **nine** `require` call sites — rows 1-8 of the table
above, counting row 7's pair as two (`docs/12` and `docs/28` are asserted separately)
and row 8's four-marker loop as the one `require` it contains. Verified two ways,
because an earlier draft of this record said ten:

```
$ git show e00372c:scripts/validate_package.py | sed -n '248,265p' | grep -c '^ *require('
9
```

Row 9 is not in this block — it lived at `:2292`, beside the external-gate
vocabulary, and left at `8e37caa`.

They are gone from the working tree, and the file says so at the site rather than
leaving a hole:

```
$ grep -n "Eight prose assertions" scripts/validate_package.py
183:# Eight prose assertions on docs/01, 07, 12, 18, 19, 22 and 28 stood here. They
$ grep -n 'DOCS / "' scripts/validate_package.py
(no output — no numbered document is read by name anywhere in the file)
```

## Two debts that are not removed assertions

Neither of these appears as a deletion in this branch's diff, which is why both were
missed by the first issue of this record and found by the whole-branch review. One is
a hold this slice **did not remove and did not know about**; the other is an assertion
this slice **weakened rather than deleted**.

| # | Debt | Where | What a later slice must do first |
|---|---|---|---|
| A | An unconditional read of `docs/05-design-system.md` inside the **test suite**, not the validator | `packages/testing/src/token-fidelity.test.ts:82` | Before executing `docs/05`'s approved `defer` disposition, move this assertion to read the successor — or delete it and re-guard the twelve colour rows in `validate-canonical-docs.mjs` |
| B | The `113 Pilot / 44 GA-forward` figures in the sentence this slice corrected are no longer tied to `openapi.yaml` | `docs/22-data-api-contract.md:130`; the replacement assertion at `scripts/validate_package.py:1659` | Re-tie the two figures to the artifact, or state them as of a revision rather than as current fact |

### A. The hold that survives outside the validator

**The design's premise is incomplete.** It opens with "Nothing can move while
`scripts/validate_package.py` runs, because that validator asserts where the numbered
documents are and what sentences they contain." That was the premise the whole slice
was built on, and it is missing a case: **the test suite holds a numbered document
too.**

```
$ grep -n 'readFileSync(join(repoRoot, "docs/05-design-system.md")' packages/testing/src/token-fidelity.test.ts
82:    const doc = readFileSync(join(repoRoot, "docs/05-design-system.md"), "utf8");
```

Unconditional — no `existsSync` guard, no try. And `docs/05` is approved to move:

```
$ grep -n "^docs/05-design-system.md," migration/goproceed-canonical-v0.1/document-disposition.csv
7:docs/05-design-system.md,tracked_at_base,defer,docs/legacy/README.md,none,none,design-system reference for later UI work; no v0.1 documentation authority,deferred_scope
```

The path from that read to a red build is short and fully wired:

```
$ grep -n "packages/testing" vitest.workspace.ts
12:  "packages/testing",
$ grep -n '"test"' packages/testing/package.json
9:    "test": "vitest run"
$ grep -n "pnpm turbo run test --concurrency=1" .github/workflows/ci.yml
81:      - run: pnpm turbo run test --concurrency=1
```

**Proven, not argued.** Executing the approved disposition and running the suite:

```
$ git mv docs/05-design-system.md docs/legacy/05-design-system.md
$ cd packages/testing && npx vitest run src/token-fidelity.test.ts
 FAIL  src/token-fidelity.test.ts > the source accounts for every documented colour > names every token the design document's table defines, or records it contested
Error: ENOENT: no such file or directory, open '/…/docs/05-design-system.md'
 ❯ src/token-fidelity.test.ts:82:17
 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
```

**And both documentation gates stay green through exactly that move**, which is the
whole problem:

```
$ node scripts/validate-canonical-docs.mjs; echo "canonical exit=$?"
canonical documentation: OK
canonical exit=0
$ python3 scripts/validate_package.py | head -1
AktFlow package validation: PASS (required_artifacts=35, documents=34, …)
$ git mv docs/legacy/05-design-system.md docs/05-design-system.md      # restored
```

So a later slice executing an approved disposition gets a green documentation gate, a
red test suite, an `ENOENT` inside a colour-token test, and **nothing anywhere
pointing back at this decision**. That is the failure this record exists to prevent,
so it gets a row even though this branch neither created it nor can fix it — fixing it
means editing TypeScript, which slice 1's constraints forbid.

**It is the only one of its kind.** An exhaustive sweep of every source and test file
for a read of a numbered document returns exactly this one site:

```
$ grep -rn 'readFileSync\|readFile\|require(.*docs/' packages/ apps/ supabase/ \
    --include='*.ts' --include='*.tsx' --include='*.mjs' | grep -v node_modules | grep 'docs/'
packages/testing/src/token-fidelity.test.ts:82:    const doc = readFileSync(join(repoRoot, "docs/05-design-system.md"), "utf8");
```

Every other `docs/NN-*.md` mention in `apps/` and `packages/` is a comment citing a
line number — those go stale silently rather than failing a build, and they are a
different and smaller problem.

**What the successor slice owes:** the assertion itself is good and worth keeping. It
parses the twelve colour rows out of the document rather than copying them, so adding
a row to the design system without adding a token fails the build — that is the guard
slice 0's colour corrections rely on. It should be re-pointed at wherever the colour
table lands, in the same commit that moves `docs/05`, or moved into
`scripts/validate-canonical-docs.mjs` where the documentation gates can see it.

### B. The corrected sentence's own figures are now unguarded

Task 4 replaced an assertion that tied `release_counts` to the `113` and `44` regexed
out of `docs/22:130`. The replacement checks only that the two buckets sum to the
operation count:

```
$ sed -n '1658,1662p' scripts/validate_package.py
require(
    release_counts["Pilot"] + release_counts["GA"] == len(operations),
    "openapi.yaml: every operation must declare x-release Pilot or GA; "
    f"{release_counts['Pilot']} + {release_counts['GA']} != {len(operations)} operations",
)
```

**Any partition of 157 satisfies that.** The repointing was right — it catches a
missing or unrecognised `x-release`, which the old assertion could not, and it stopped
`release_counts` being computed and read by nothing. But in the same edit that
corrected a sentence, the sentence's two new numbers stopped being checked.

**How narrow, measured rather than estimated.** Adjacent cross-checks catch a flip,
and they go three layers deep. Flipping one operation `Pilot` → `GA`:

```
- ui-actions.csv:A-001: release differs from OpenAPI GA
- traceability.csv:REQ-ACQ-01: submitPilotLead is GA but requirement is Pilot
```

Flipping the `ui-actions.csv` and `traceability.csv` rows to match still fails, on a
third check:

```
- ui-actions.csv:A-001: T-LEAD-001 release Pilot cannot prove GA action
```

The net is also complete rather than partial — **every one of the 113 Pilot
operations is referenced by `ui-actions.csv` or `traceability.csv`**, so there is no
unwatched operation to flip quietly:

```
$ … parse openapi.yaml, count Pilot operations named in neither CSV …
total operations: 157
Pilot ops referenced by neither ui-actions.csv nor traceability.csv: 0
```

**The net is exactly four files deep, and the fourth layer is the end of it.** Flip
the operation, its `ui-actions.csv` row, its `traceability.csv` row **and** the
`test-catalog.csv` release together, and everything passes while the document lies:

```
$ … four-file coordinated Pilot → GA flip …
$ python3 scripts/validate_package.py; echo "exit=$?"
AktFlow package validation: PASS (required_artifacts=35, documents=35, …, api_operations=157, …)
exit=0
$ grep -o "113 Pilot and 44 GA-forward" docs/22-data-api-contract.md
113 Pilot and 44 GA-forward
$ grep -A1 "x-release" technical/openapi.yaml | grep -oE "Pilot|GA" | sort | uniq -c
  45 GA
 112 Pilot
```

`PASS`, exit 0, and the sentence is wrong. That is the exact size of the debt:
**narrow, bounded at four coordinated edits, and not zero.** Which is also the honest
answer to "why record it at all" — a four-file coordinated release change is not an
attack, it is an ordinary afternoon's work on the API surface.

**What a later slice owes:** either re-tie the two figures to `openapi.yaml` — a
regex over the sentence compared against `release_counts`, which is what the old
assertion did and what this slice removed for a good reason — or reword the sentence
so it states the figures as of a named revision rather than as current fact. The
second is cheaper and is probably right, since `openapi.yaml` v2.9 is explicitly the
*wider target surface* in that same sentence and its exact split is not a v0.1
contract.

## The five orphaned test identifiers

Second, smaller debt from the same task. Slice 1 narrowed the global
test-reference sweep from `README.md` + `docs/*.md` + `technical/*.csv` down to
`README.md` + `technical/*.csv`, because archiving a numbered document orphans
whatever tests only that document referenced — the pre-existing ten-entry
`ARCHIVED_BACKLOG_TEST_REFS` allowlist is that failure already having happened once.

Five of the 149 catalogued tests were referenced **only** from a numbered document.
They are named individually in `DOC_ONLY_TEST_REFS` rather than disappearing into a
count that quietly went down:

| Test | Referenced only in |
|---|---|
| `T-ADAPTER-001` | `docs/27-qa-traceability.md` |
| `T-BUSINESS-CALENDAR-001` | `docs/27-qa-traceability.md` |
| `T-PILOT-ADMISSION-001` | `docs/27-qa-traceability.md` |
| `T-STATE-REACHABILITY-001` | `docs/27-qa-traceability.md` |
| `T-DEPLOY-SMOKE-001` | `docs/26-sre-operations.md` |

**What the slice that rewrites `docs/26` and `docs/27` owes them:** carry each of the
five into its successor document, or into a `technical/*.csv`, and then delete it
from `DOC_ONLY_TEST_REFS` — an allowlist that outlives the reason for it becomes a
permanent hole. The set emptying to zero is how that slice knows it is finished.

### Verification — the set is exactly the set lost by the narrowing

Recomputed both ways at this commit, rather than trusted:

```
$ python3 - <<'PY'
import re, pathlib, csv
ROOT = pathlib.Path("."); DOCS = ROOT / "docs"; TECH = ROOT / "technical"
pat = re.compile(r"\bT-[A-Z0-9]+(?:-[A-Z0-9]+)+\b")
def sweep(files):
    s = set()
    for p in files:
        if p.name == "test-catalog.csv": continue
        s |= set(pat.findall(p.read_text(encoding="utf-8")))
    return s
wide   = sweep([ROOT/"README.md", *DOCS.glob("*.md"), *TECH.glob("*.csv")])   # pre-slice
narrow = sweep([ROOT/"README.md", *TECH.glob("*.csv")])                       # post-slice
tests  = {r["test_id"] for r in csv.DictReader(open("technical/test-catalog.csv", encoding="utf-8"))}
DOC_ONLY = {"T-ADAPTER-001","T-BUSINESS-CALENDAR-001","T-PILOT-ADMISSION-001",
            "T-STATE-REACHABILITY-001","T-DEPLOY-SMOKE-001"}
lost = (tests & wide) - narrow
print("catalogued tests:", len(tests))
print("referenced under the NARROW sweep:", len(tests & narrow))
print("lost by the narrowing:", sorted(lost))
print("symmetric difference with DOC_ONLY_TEST_REFS:", sorted(lost ^ DOC_ONLY), "(empty == exact)")
for t in sorted(DOC_ONLY):
    print(" ", t, [str(p) for p in sorted(DOCS.glob("*.md")) if t in p.read_text(encoding="utf-8")])
PY
catalogued tests: 149
referenced under the NARROW sweep: 134
lost by the narrowing: ['T-ADAPTER-001', 'T-BUSINESS-CALENDAR-001', 'T-DEPLOY-SMOKE-001', 'T-PILOT-ADMISSION-001', 'T-STATE-REACHABILITY-001']
symmetric difference with DOC_ONLY_TEST_REFS: [] (empty == exact)
  T-ADAPTER-001 ['docs/27-qa-traceability.md']
  T-BUSINESS-CALENDAR-001 ['docs/27-qa-traceability.md']
  T-DEPLOY-SMOKE-001 ['docs/26-sre-operations.md']
  T-PILOT-ADMISSION-001 ['docs/27-qa-traceability.md']
  T-STATE-REACHABILITY-001 ['docs/27-qa-traceability.md']
```

Empty symmetric difference: no surplus entry, none missing. The "134 of the 149" in
the source comment is exact, and each test's stated home was re-derived from the
document text rather than copied from the plan.

**The sweep still bites.** An unreferenced test is still a build failure — proven by
mutation, not by reading the code:

```
$ # append a row to technical/test-catalog.csv with test_id T-REVIEWER-ORPHAN-001
$ python3 scripts/validate_package.py; echo "exit=$?"
AktFlow package validation: FAILED (1 findings)
- test-catalog.csv: orphan tests ['T-REVIEWER-ORPHAN-001']
exit=1
```

Restored afterwards; see the gate record's mutation section for the full set.

## Summary of what is owed, by successor document

| Successor | Owes |
|---|---|
| `docs/architecture/tenancy-and-security.md` | invariants 1, 4, 5 — 5 is the low-priority one, since `docs/22` is `keep` and never moves |
| `docs/product/scope-and-boundaries.md` | invariant 2 |
| `docs/domain/execution-and-evidence.md` | invariant 3 — **including the `soft-deleted` absence half** |
| `docs/architecture/system-overview.md` | invariant 6 |
| `docs/product/roadmap.md` | invariant 7 — four strings across two source documents |
| `docs/domain/domain-model.md` | invariant 8 — four separate markers |
| `docs/discovery/validated-assumptions.md` | invariant 9 — and the printed `NOT PROVEN` line should read from it rather than be hardcoded |
| whichever slice rewrites `docs/26`, `docs/27` | the five `DOC_ONLY_TEST_REFS`, then empty the set |
| **whichever slice moves `docs/05-design-system.md`** | **debt A — repoint `packages/testing/src/token-fidelity.test.ts:82` in the same commit, or CI goes red on `ENOENT` with nothing pointing here** |
| whichever slice next touches the API release split | debt B — re-tie or reword `docs/22:130`'s `113`/`44` |

**Two of these are ordering constraints, not just writing tasks.** Debt A must be
discharged *in the same commit* that moves `docs/05`, because the two are red apart
and green together — the same shape as the `docs/22:130` pairing this slice made
atomic in `e7634f3`, and for the same reason. Everything else on this list can be
paid late; debt A cannot be paid late without a red build in between.

Re-asserting the sentence in the successor is only half the job. The other half is
giving it a guard again — a check in `scripts/validate-canonical-docs.mjs`, which is
now the structured layer's CI gate. A sentence copied into a new document with no
assertion behind it is exactly the state this table records as debt.

**And the lesson underneath all eleven rows: this slice looked for holds in the file
it was retiring.** Nine were there. The tenth was in the test suite, the eleventh was
in the replacement it had just written, and neither was visible from
`scripts/validate_package.py`. The question that finds them is not "what does this
validator assert?" but "what breaks if this document moves?" — asked of the whole
repository, including the files this branch itself changed.
