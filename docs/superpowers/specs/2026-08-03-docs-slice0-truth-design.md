# Documentation slice 0 — make the canon true — design

**Date:** 2026-08-03
**Branch:** `claude/docs-slice0-truth`, from `main` @ `70c8107`
**Slice:** the first of a documentation restructure. Zero file moves, zero CI changes.

## What the corpus turned out to be

Not two competing layers. **One restructure stopped halfway.**
`migration/goproceed-canonical-v0.1/document-disposition.csv` already carries an
approved disposition and a named successor for all 41 numbered files. Six of them
were physically moved to `docs/legacy/` on 2026-07-30; the other 35 were left at
`docs/` root untouched. The decision exists; the execution and the in-`docs/`
statement of it do not.

That is why `docs/README.md` cannot answer which layer wins: its precedence rule
demotes only files "marked Historical or located under `docs/legacy`", and the
numbered files are neither. The supersession map lives outside `docs/`.

## The finding that reorders the work

The restructure looked like a problem in the numbered layer. It is not. Nine
false claims live in the **structured** layer — the one that is supposed to be
canonical — and every one of them carries `**Status:** Approved`:

- `docs/architecture/system-overview.md` states that `apps/mobile` "does not yet
  physically exist" and is "an approved target that must be created". It exists
  and shipped.
- The baseline inventory "six tables, one API view, three functions, and two
  application roles" is repeated in four files. Measured: 33 tables, 1 view,
  27 functions, 5 roles.
- `docs/architecture/data-model.md` prescribes an `app_private` schema the
  database rejected. The ruling that replaced it lives in a migration comment
  (`supabase/migrations/0016_execution_evidence_security.sql:7-9`), not in a
  document.
- The upload state machine is documented with three intermediate states the
  server never writes.

**Archiving first would produce one tidy layer that still lies.** Every
supersession banner a later slice writes points a reader at these files. Sending
someone to a document that says the mobile app does not exist is worse than
leaving the old file where it is. So correction comes before any move.

## What this slice does

Makes the documentation agree with the shipped system, in place. Nothing moves,
nothing is archived, no validator or workflow changes.

Twenty-three claims were measured against the code and confirmed wrong. They are
corrected in descending order of blast radius, because a claim repeated in four
files is one correction applied four times.

The complete row-by-row list — file, line, current text, required text, and the
command that measures the truth — belongs in the implementation plan rather than
here. This document explains what the slice is and why the order is what it is;
the plan is what an implementer executes.

### The largest: the upload state machine, about twenty edit sites

`public.upload_intents.status` permits eight values. Four are ever written.
Every write to that column across all 35 migrations resolves to `available` (6
sites), `orphaned_for_purge` (6), `scan_blocked` (2) or `expired` (2); the
initial value comes from the column default `intent_authorized`. The one other
`set status` in the chain targets `public.invitations`, not this table
(`supabase/migrations/0011_workspace_access_security.sql:196-197`) — stated
because a repository-wide grep for status writes returns it and it is not a
counter-example. The three intermediate values —
`staged`, `integrity_verified`, `scan_pending` — appear only in the CHECK
constraint, two comments, one index predicate, and two purge predicates that can
never match.

The shipped machine is `intent_authorized → available | scan_blocked |
orphaned_for_purge | expired`. Four transitions.
`technical/states/transition-catalog.csv` currently contains **zero** rows for
those four and several rows for transitions that do not happen.

The engineering ruling already exists and states its own horizon, in
`apps/app/app/v1/upload-intents/[intentId]/finalize/route.ts:76-82`: the
intermediate values "stay in the enum for the resumable protocol in v0.3". The
correction records that horizon rather than deleting the values.

**The template already exists in-tree.** `technical/copy-catalog.csv:55-58`
carries exactly this ruling in its free-text `context` column, with a provenance
pointer to migration `0015`. It is the only artifact in the repository already
reconciled against the shipped vocabulary, it needs no change, and every other
correction of this class follows its form.

**One format constraint is load-bearing.** `technical/states/*.csv` are checked
for constant column width by `scripts/validate-canonical-docs.mjs:82-87`, and
both files use semicolons — never commas — inside free-text fields. A bare comma
in a description widens the row and reds the validator.

### The counts, settled

Three prior surveys produced three different function counts. The disagreement
was resolved rather than averaged, and the counting rule is recorded beside each
number so it cannot recur:

| | Value | Rule |
|---|---|---|
| Tables | **33** | `create table` in any schema; no `drop table` or rename exists, so created equals surviving |
| Views | **1** (`api.me_context`) | views and materialized views in any schema; exhaustive search |
| Roles | **5** | created by migrations; Supabase built-ins excluded because the provider creates them |
| Functions | **27** | distinct schema-qualified name plus argument types, surviving all drops; includes `SECURITY DEFINER` and trigger functions |

The other answers were real facts about a different question. **24** is the
`SECURITY DEFINER` subset. **3** was correct through migration `0005`. **43** is
the statement count, inflated because five statements redefine
`app.finalize_upload_intent` alone. The live catalog snapshot at
`migration/goproceed-canonical-v0.1/catalog-snapshots/20260731-2102.md:2571`
reads `## functions (27)`, independently confirming the object count.

**On the roles wording:** the documents say "two application roles". The
migrations create five. The correction states five and names them, rather than
preserving a phrase that is only true under an unwritten convention about what
"application role" means.

## What this slice deliberately does not do

**The OpenAPI allowlist correction moves to slice 1.** The owner ruled that
`technical/openapi/scope-v0.1.csv` (51 operations) is the v0.1 contract, and
that `docs/22-data-api-contract.md:130` is therefore wrong to name
`technical/openapi.yaml` v2.9 as "the exact allowlist".

That sentence is asserted by `scripts/validate_package.py:1718-1721`, which
regexes the Pilot/GA counts out of the prose and compares them to
`openapi.yaml`. Correcting it here would red CI, and this slice's constraint is
zero CI changes. The owner has also ruled that `validate_package.py` is being
retired. The correction therefore lands in slice 1, in the same commit that
removes the validator and wires `pnpm validate:canonical-docs` into CI — so the
build is never red and never without a documentation gate.

**Review dates are not bulk-stamped.** All 24 structured files read
`Last reviewed: 2026-07-30`, and repo-wide there is no other review date. That is
a true statement about a fact, not a false claim in a document. Writing today's
date onto 24 files would assert a review that did not happen. A file's date moves
when someone actually reviews it — which, for the files this slice corrects,
means those files and no others.

**Point-in-time records are not edited.** Everything under `docs/superpowers/`
is a record of what was believed on its date and is correct as a record. Where a
stale number appears only there, it stays.

## Claims that were checked and found already correct

Recorded so nobody "fixes" them later. Each was a hypothesis going in:

- **The Next.js and Node pins in `docs/07:20` are right.** Both Next apps pin
  exactly `16.2.11`; `.nvmrc` is `24`. Only the Expo number in that sentence is
  wrong.
- **`scripts/validate_package.py` does not pin the Expo fragment.** It asserts
  only the bolded Next.js substring, so correcting `SDK 56` → `57.0.9` cannot
  red the build. The earlier belief that the whole sentence was protected was
  wrong.
- **All eight code comments citing `docs/22` by line number still resolve.**
  `:166` is the idempotency paragraph whose two TTLs match
  `packages/database/src/idempotency.ts:3-7` digit for digit; `:170` is the
  `X-Request-Id` paragraph. Zero drift.
- **The `113 Pilot and 44 GA-forward` arithmetic is exact.** 157 operations,
  counted from `openapi.yaml`'s `x-release` values. Only the authority claim in
  that sentence is wrong, and it is deferred to slice 1.
- **Eight of the twelve colour rows match**, including `line` — which matches
  because the owner ruled on it on 2026-08-03, not by luck. The shadow spec four
  lines below the table also matches the generated token exactly.
- **`Status: Historical` being unused is not a defect.** `docs/README.md:41`
  makes the marker optional: location under `docs/legacy/` is an equivalent
  route to non-normativity.
- **`Status: Implemented` being unused is the policy working.**
  `docs/README.md:56-57` says implementation status belongs in delivery
  evidence, and that route is populated.

## How this slice is verified

The bar is not "the tests pass" — they pass today, over every one of these false
claims. The bar is that a specific claim now matches a specific measurement.

Each correction ships with the command that produced its number, so a reviewer
re-runs it rather than trusting the diff. `make validate` and
`pnpm turbo run test --concurrency=1 --force` must stay green, which proves only
that nothing protected was disturbed — it is a floor, not the evidence.

The evidence is a gate record listing every corrected claim with its before,
after, and the reproducible measurement that settles it.

## Out of scope

File moves, archiving, the `Status: Historical` marking policy, the
`SUPERSESSION.md` index, wiring the canonical validator into CI, retiring
`validate_package.py`, and the AktFlow→GoProceed rename. Each is a later slice.
This one changes only what documents say about the system that exists.
