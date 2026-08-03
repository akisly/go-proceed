# Documentation slice 1 — invariant debt

**Date:** 2026-08-03
**Branch:** `claude/docs-slice1-gate`, from `claude/docs-slice0-truth` @ `e00372c`
**Incurred by:** `b28f044` ("refactor(validate): stop requiring the numbered layer
to stand still"), Task 3 Step 4
**Plan:** [2026-08-03-docs-slice1-gate.md](../2026-08-03-docs-slice1-gate.md)
**Gate record:** [2026-08-03-docs-slice1-gate.md](2026-08-03-docs-slice1-gate.md)

## What this file is

`scripts/validate_package.py` used to assert eight literal substrings inside seven
numbered documents. Those assertions were not documentation-structure checks. They
were **product invariants** — the only automated guard, anywhere in the repository,
against someone quietly softening universal live-Pilot MFA, or the terminal project
archive, or the honest solo delivery ranges. Slice 1 removed them, because
`"X" in docs/01` breaks the moment `docs/01` moves and slices 2-7 exist to move it.

**That removal is a real loss, and this file is the receipt.** It exists so the loss
has an owner rather than a shrug.

**The "Must be re-asserted in" column says where each invariant *belongs*, not where
its text lives today.** For most of these the successor document does not yet carry
the sentence at all. Writing it there is the successor slice's work; this table is
what obliges it. Do not read a row as a claim that the structured layer already
covers the invariant — it does not, which is the whole point of recording the debt.

**Where the invariant text lives today is the "Still in" column**, and every row was
re-measured at this commit. All eight are currently intact in their original
numbered document. They are unguarded, not gone.

## The eight invariants

Line numbers are the assertion's address in `scripts/validate_package.py` at
`e00372c`, this slice's base — the last commit at which they existed.

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
```

`1` for every presence assertion; `0` for `soft-deleted`, which is correct — that one
asserted the string's **absence**. **No invariant has drifted as of this commit.**
Every one of them is currently true and currently unguarded.

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

Eighteen lines, seven reads and ten `require` call sites — the eight invariants of
the table above, counting row 7's pair as one and row 8's loop as one.

They are gone from the working tree, and the file says so at the site rather than
leaving a hole:

```
$ grep -n "Eight prose assertions" scripts/validate_package.py
183:# Eight prose assertions on docs/01, 07, 12, 18, 19, 22 and 28 stood here. They
$ grep -n 'DOCS / "' scripts/validate_package.py
(no output — no numbered document is read by name anywhere in the file)
```

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
| `docs/architecture/tenancy-and-security.md` | invariants 1, 4, 5 |
| `docs/product/scope-and-boundaries.md` | invariant 2 |
| `docs/domain/execution-and-evidence.md` | invariant 3 — **including the `soft-deleted` absence half** |
| `docs/architecture/system-overview.md` | invariant 6 |
| `docs/product/roadmap.md` | invariant 7 — four strings across two source documents |
| `docs/domain/domain-model.md` | invariant 8 — four separate markers |
| whichever slice rewrites `docs/26`, `docs/27` | the five `DOC_ONLY_TEST_REFS`, then empty the set |

Re-asserting the sentence in the successor is only half the job. The other half is
giving it a guard again — a check in `scripts/validate-canonical-docs.mjs`, which is
now the structured layer's CI gate. A sentence copied into a new document with no
assertion behind it is exactly the state this table records as debt.
