# Documentation slice 1 — retire the hold, keep the gate — design

**Date:** 2026-08-03
**Branch:** `claude/docs-slice1-gate`, from `claude/docs-slice0-truth` @ `e00372c`
**Slice:** the second of a documentation restructure. One commit. No file moves.

## Why slice 1 exists

Slice 0 corrected what the documents say. Slice 2 onward moves them. Nothing can
move while `scripts/validate_package.py` runs, because that validator asserts
where the numbered documents are and what sentences they contain.

Slice 0 already met this wall once. `docs/22-data-api-contract.md:130` calls
`technical/openapi.yaml` v2.9 "the exact allowlist", which the owner has ruled
wrong — `technical/openapi/scope-v0.1.csv` is the v0.1 contract. The correction
was deferred because `validate_package.py:1718-1721` regexes that sentence's
numbers out of the prose and compares them to `openapi.yaml`. Correcting the
sentence would have reddened CI, and slice 0's constraint was zero CI changes.

This slice removes the wall and lands the deferred correction in the same commit,
so the build is never red and never without a documentation gate.

## What the validator turned out to be

Not one thing. `scripts/validate_package.py` makes **316 assertions** across 2444
lines, and they serve two unrelated purposes:

- **The `required_files` list, twelve reads of a named numbered document
  (`DOCS / "NN-….md"`), and three glob sweeps over `docs/*.md`** hold the
  numbered documentation layer in place. Roughly twenty `require()` calls hang
  off them.
- **The overwhelming majority of the rest** keep the `technical/` v2.9 artifacts
  mutually consistent: 157 API operations, 261 states, 295 transitions, 118
  errors, 149 test contracts, 103 UI actions, 158 access surfaces, plus OpenAPI
  `$ref` closure and the traceability graph.

Retiring the file wholesale would discard the second group, which has nothing to
do with documentation and has no replacement. **This slice retires the hold, not
the validator.**

A second measurement decided the CI half. `pnpm validate:canonical-docs` is
declared in `package.json:13` and wired into nothing — not `.github/workflows/`,
not the `Makefile`, not `turbo.json`. The canonical structured layer, the one
that is supposed to win, has no CI enforcement at all today.

## The five couplings

The doc-layer hold is not one mechanism. Each is severed differently, and two of
them are load-bearing in ways a line count does not show.

### 1. `required_files` pins 35 numbered documents

`validate_package.py:98-135` requires every `docs/NN-name.md` to exist at its
exact path. **Removed.** The `README.md`, `Makefile` and `technical/` entries
stay — those files are not moving.

### 2. Eight prose assertions

`validate_package.py:255-264` asserts literal substrings inside `docs/01`, `07`,
`12`, `18`, `19`, `22` and `28`. **Removed**, because `"X" in docs/01` breaks the
moment `docs/01` moves, and `document-disposition.csv` carries an approved
disposition for all 41 numbered files.

These guard product invariants rather than documentation structure, so removing
them is a real loss and is recorded as named debt rather than absorbed:

| Invariant | Guarded in | Must be re-asserted in |
|---|---|---|
| `MFA обязательно для каждого пользователя с live Pilot data` | `docs/01` | `docs/architecture/tenancy-and-security.md` |
| `Project archive is immutable and terminal`; `There is no in-place restore` | `docs/01` | `docs/product/scope-and-boundaries.md` |
| `Evidence has no generic delete action`, and `soft-deleted` must stay **absent** | `docs/01` | `docs/domain/execution-and-evidence.md` |
| `GA-forward assignment grouping only` | `docs/19` | `docs/architecture/tenancy-and-security.md` |
| `Tenant bearer tokens and tenant permissions never authorize these operations` | `docs/22` | `docs/architecture/tenancy-and-security.md` |
| `Next.js **16.2.11 or newer security-patched 16.2.x**` | `docs/07` | `docs/architecture/system-overview.md` |
| `Safe first live Pilot (months 5–9)`; `Safe standalone GA (months 10–18+)`; and `docs/28`'s solo ranges | `docs/12`, `docs/28` | `docs/product/roadmap.md` |
| Four money-concurrency markers — `PostgreSQL \`SERIALIZABLE\``, `SELECT ... FOR UPDATE`, `ascending UUID order`, `Direct multi-step BFF writes are forbidden` | `docs/18` | `docs/domain/domain-model.md` |

The successor column is where each invariant belongs, not where its text lives
today — for most of them the successor does not yet carry the sentence. Writing
it is the successor slice's work, and this table is what obliges it.

### 3. Three documents are inputs, not just subjects

This is the coupling a line count hides. `validate_package.py:749-754` derives
`flow_ids` from `docs/20`'s `## N. FNN` headings, `screen_ids` from `docs/04`'s
`### SNN` headings, and `:2290` derives `external_gates` from `docs/30`'s table.
Those three sets are then the authoritative vocabulary for validating
`technical/` artifacts:

- `:804` — every `openapi.yaml` operation's `x-flow-id` must be in `flow_ids`
- `:1735` — every `ui-actions.csv` row's `screen_id` must be in `screen_ids`
- `:2316`, `:2332`, `:2333` — `traceability.csv`'s screen, gate and flow columns,
  including full flow coverage

Deleting the doc reads would silently disable five `technical/` closure checks.

**The fix is exact, because the validator already pins each set to a literal
range:**

```python
require(flow_ids == {f"F{index:02d}" for index in range(1, 23)}, …)
require(screen_ids == {f"S{index:02d}" for index in range(1, 43)}, …)
require(external_gates == {f"V-{index:03d}" for index in range(1, 13)}, …)
```

If those assertions pass, the doc-derived set **is** the constant. Replacing each
with the constant leaves every downstream check byte-identical in behaviour and
drops only the assertion that the document still carries those headings — which
is precisely the pinning being removed.

### 4. Numbered-index contiguity

`validate_package.py:186-227` requires `docs/NN-*.md` to form a contiguous
sequence from `00` to the highest index, minus a hand-maintained
`ARCHIVED_DOC_INDICES = {2, 16, 29, 37, 38, 39}`. **Removed.** It is the shape-pin
that would make every future archive a validator edit, and a set of six
exceptions is already the evidence that it does not scale.

That block also produces `doc_numbers`, which `:2420` reports as `documents=35`
in the summary line. The count survives, recomputed from the glob: it is an
observation, not an assertion, and it should fall on its own as documents are
archived rather than requiring anyone to edit a number.

### 5. The global test-reference sweep

`validate_package.py:2354-2374` collects `T-*` identifiers from `README.md`,
`docs/*.md` and `technical/*.csv`, then requires every test in
`test-catalog.csv` to be referenced somewhere. Archiving a numbered document
orphans whatever tests only it referenced — the existing
`ARCHIVED_BACKLOG_TEST_REFS` allowlist of ten is that failure already having
happened once.

**Scoped to `README.md` + `technical/*.csv`.** Measured: **134 of 149** tests are
referenced there and are unaffected. Exactly five are referenced only from a
numbered document:

| Test | Referenced only in |
|---|---|
| `T-ADAPTER-001` | `docs/27-qa-traceability.md` |
| `T-BUSINESS-CALENDAR-001` | `docs/27-qa-traceability.md` |
| `T-PILOT-ADMISSION-001` | `docs/27-qa-traceability.md` |
| `T-STATE-REACHABILITY-001` | `docs/27-qa-traceability.md` |
| `T-DEPLOY-SMOKE-001` | `docs/26-sre-operations.md` |

They join the existing allowlist, named individually with their current home, so
the slice that rewrites `docs/26` and `docs/27` knows exactly what to carry
forward.

## What is kept, deliberately

**The link-resolution sweep stays** (`validate_package.py:232-246`), over
`README.md`, `docs/*.md` and `prototype/README.md`. It is a glob, so it pins
nothing — it validates whatever documents exist. It is also the only check in the
repository that resolves links inside the numbered layer:
`validate-canonical-docs.mjs` checks links only within `METADATA_DOCS`, the
structured layer. Slices 2 through 7 are a sustained file-moving exercise, and
this is the check that catches a link they break. Keeping it makes those moves
safer rather than harder. Owner-confirmed 2026-08-03.

## The deferred correction

`docs/22-data-api-contract.md:130` reads:

> `technical/openapi.yaml` v2.9 is the exact allowlist: 113 Pilot and 44
> GA-forward operations at this revision.

Both halves are wrong about authority and right about arithmetic. Measured today:
`technical/openapi/scope-v0.1.csv` carries **51** operations; `openapi.yaml`'s
`x-release` values tally **113 Pilot + 44 GA = 157**. The sentence therefore names
`scope-v0.1.csv` as the v0.1 allowlist and demotes `openapi.yaml` v2.9 to the
wider target surface it is, keeping the 113/44 figures because they are exact.

The sentence `An endpoint name in prose is not authorization to implement it`
survives — it is the point of the paragraph.

## CI

`pnpm validate:canonical-docs` becomes a step in the `verify` job, immediately
after `pnpm install --frozen-lockfile` and **before** the `supabase start` step
that is allowed fifteen minutes. A documentation failure then reports in about a
minute instead of after a full stack boot. A `validate-canonical` target is added
to the `Makefile` and folded into `validate`, so the local entry point and CI
agree about what a documentation gate is.

The `package-validate` job and its prototype half are untouched.

## Why one commit

At no instant is the build red or ungated. The commit that removes the assertion
on `docs/22:130` is the commit that corrects the sentence, and it is the commit
that gives CI its first canonical-documentation gate. Splitting it in either
direction produces a state that is one or the other.

## How this slice is verified

The bar is not "the validator still passes" — it passes today over every pin this
slice removes.

**The evidence is a mutation check.** Move one numbered document to
`docs/legacy/`, run the trimmed validator, and confirm it stays green where the
current validator fails; then restore the file. That proves the hold is gone
rather than merely looking gone. The same shape of check applies to the
vocabularies: the `technical/` closure assertions must still fail when given a
bad `x-flow-id` or `screen_id`, proving the constants replaced the doc-derived
sets rather than disabling the checks.

Supporting, not sufficient: `python3 scripts/validate_package.py` still exits 0
with every count unchanged except `required_artifacts`, which falls by 35; and
`node scripts/validate-canonical-docs.mjs` still prints `canonical documentation:
OK`.

## Out of scope

Renaming `scripts/validate_package.py` — its module docstring is corrected to say
what it now validates, and a rename in the same commit would obscure a diff that
needs reading closely. The `package-validate` job's prototype half. Any file move,
archive or supersession banner. Any documentation correction other than
`docs/22:130`. The AktFlow→GoProceed rename. Each belongs to a later slice.
