# Documentation slice 2 — empty the numbered layer — design

**Date:** 2026-08-03
**Branch:** `claude/docs-slice2-archive`, from `claude/docs-slice1-gate` @ `f443790`
**Slice:** the third of a documentation restructure. The first one that moves files.

## Why this can happen now, and could not before

Slice 1 removed `scripts/validate_package.py`'s hold on the numbered layer:
`required_files` pinned all 34 at exact paths, a contiguity contract required a
sequence, and reads of `docs/04`, `docs/20`, `docs/22` and `docs/30` crashed the
validator outright if their file was absent. Moving any numbered document reddened
CI. Slice 1's evidence was a mutation check proving the opposite: twelve numbered
documents archived at once, both validators green.

This slice spends that.

## What the corpus turned out to be

The numbered layer is **already orphaned — it is simply not demoted.**

- `docs/README.md` indexes not one numbered document.
- **22 of the 34** are referenced by nothing live anywhere in the repository.
- Yet `docs/README.md:41` demotes only files "marked Historical or located under
  `docs/legacy`". These are neither, so a reader who finds one is formally
  entitled to treat it as an active source.

The dispositions were settled long ago and are not in question here.
`migration/goproceed-canonical-v0.1/document-disposition.csv` carries an approved
disposition and a named successor for every one, and **all six `archive` rows were
already executed on 2026-07-30**. The 34 that remain are 19 `rewrite`, 5 `merge` and
10 `defer` — every one with a successor that exists on disk today.

## What this slice does

**Moves 34 files into `docs/legacy/` and writes the map that was missing.**

`docs/22-data-api-contract.md` stays: its disposition is `keep`, targeting itself.
Afterwards `docs/` root holds exactly two Markdown files — `README.md` and
`docs/22-data-api-contract.md`.

### The move follows the existing precedent exactly

Plain `git mv`. **No per-file banner.** `docs/legacy/02-market-competition.md`,
archived on 2026-07-30, opens straight into its content; the directory is governed
collectively by `docs/legacy/README.md`. Thirty-four banners would duplicate the
same facts in thirty-four places that can drift from the CSV, and would break a
precedent set by the owner-approved cleanup.

A free proof the move happened: `validate_package.py`'s `documents=` metric counts
`docs/NN-*.md` from disk. It reads **35** today and must read **1** afterwards.
Slice 1 deliberately made that an observation rather than a contract, so it falls on
its own without anyone editing a number.

### The index is the deliverable

One table appended to `docs/legacy/README.md`. One row per archived file: a link to
the file, a link to its successor, and the CSV's `information_moved` and
`information_rejected` **quoted verbatim rather than paraphrased**. Paraphrase is how
a map starts disagreeing with the territory.

This is what moves the supersession map inside `docs/`. Slice 0's design named its
absence as the reason `docs/README.md` cannot answer which layer wins: "The
supersession map lives outside `docs/`." After this slice it does not.

**The index gets validated for free.** `docs/legacy/README.md` is in
`scripts/validate-canonical-docs.mjs`'s `METADATA_DOCS` set, so every relative link
in that table is resolved on every run. A row pointing at a successor that does not
exist reds the build. That is worth more than a banner, because it cannot rot
silently.

Two risks that being in `METADATA_DOCS` creates were checked before this design was
written, and both are clear:

- **All 19 distinct successor targets exist on disk today**, including the four that
  are CSVs and the one under `migration/`. No row will be born broken.
- **No `information_moved` or `information_rejected` cell contains the string
  `AktFlow`.** `METADATA_DOCS` is also the branding-checked set, and a verbatim quote
  carrying the old name onto a line without legacy context would fail
  `brandingViolations`. Quoting verbatim is therefore safe as well as honest.

## The twenty-three pointer sites

### Seven live files must be updated — the slice's only real risk

| File | Points at | Kind |
|---|---|---|
| `packages/testing/src/token-fidelity.test.ts:80,82` | `docs/05` | **an unconditional `readFileSync`** — the only build hold |
| `packages/tokens/src/tokens.json:8` | `docs/05` | inside a `ruling` string |
| `packages/ui/src/base.css:10` | `docs/05` | comment |
| `scripts/validate_package.py:2324-2328` | `docs/26`, `docs/27` | comments naming `DOC_ONLY_TEST_REFS`' sources |
| `.github/workflows/ci.yml:229` | `docs/40` | comment |
| `apps/demo/src/styles/fonts.css:2` | `docs/40` | comment |
| `TODOS.md:270,341` | `docs/07`, `docs/04` | live backlog entries |

`token-fidelity.test.ts` is the one that can red CI, and it was found by slice 1's
whole-branch review rather than by any validator — recorded there as debt A, with the
ordering constraint that it must move in the same commit as `docs/05`. This slice
honours that: `docs/05` is moved last, with its test, in one commit.

### Eight cross-references inside the moving set are left alone

`docs/40`→`docs/05`, `docs/17`→`docs/34` and `docs/28`, `docs/34`→`docs/32`,
`docs/32`→`docs/34`, `docs/08`→`docs/35`, `docs/40`→`docs/14` and `docs/20`. Source
and target move together, so each written path goes stale by one directory.

They stay stale, and the reason is the legacy policy itself: `docs/legacy/README.md`
preserves this material as "Historical migration evidence". Editing preserved
evidence to tidy its internal paths is the thing that policy exists to prevent. None
of the eight is a Markdown link — slice 1 measured that all 35 numbered documents
contain zero Markdown links — so none breaks link validation. The index is the
reader's map. **Owner-confirmed, 2026-08-03.**

## One correction, because the file is being edited anyway

`docs/legacy/README.md:28` permits legacy material to be used to "compare the
implemented six-table foundation with prior intentions". The foundation is 33 tables;
slice 0 corrected that claim in five documents and explicitly excluded `docs/legacy/`
from its scope. This slice edits that file to add the index, and it is a
`Status: Approved` policy document rather than preserved evidence, so it gets the
same correction slice 0 applied elsewhere. Scope is the sentence, nothing else.

## How this slice is verified

The bar is not that the validators pass — they pass today, over a numbered layer
sitting in a directory the precedence rule cannot demote.

- **`documents=` falls 35 → 1**, measured before and after. This is the single
  number that says the layer is empty.
- **Every link in the new index resolves**, proven by the canonical validator — and
  mutation-checked: break one successor link, confirm the build goes red, restore.
  An index nobody can break is an index nobody is checking.
- **`git log --follow` on a sample of moved files shows continuous history**, proving
  `git mv` rather than delete-and-add. History that stops at the move makes the
  archive useless for the one thing the policy permits it for.
- **Zero live references remain** to `docs/NN-` outside `docs/legacy/`, by grep.
- **`token-fidelity.test.ts` passes**, run directly. It is the only code change in
  the slice and the only thing that can red CI.

## Out of scope

The AktFlow→GoProceed rename. Splitting `docs/22-data-api-contract.md`. Placing
`docs/superpowers/`. The ten `technical/*.csv` files carrying `defer` dispositions.
Rewriting any archived document's content, including its stale internal paths.
Verifying that each successor genuinely absorbed what its `information_moved` claims
— the dispositions are owner-approved and archiving does not destroy anything, since
every file remains readable at its new path.
