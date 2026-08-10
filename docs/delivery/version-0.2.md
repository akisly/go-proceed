# v0.2 delivery — the commercial half, and everything the pilot did not need

**Status:** Approved

**Applies to:** v0.2

**Last reviewed:** 2026-08-08

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-002](../decisions/ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md),
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md),
[ADR-007](../decisions/ADR-007-pilot-field-client.md),
[ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md)

> **Version note (2026-08-08) — two decisions taken after this document was
> last reviewed. Both change what v0.1 means, and both are recorded in every
> document that states v0.1 scope.**
>
> 1. **The valuation carve happens at admission, not at recording.**
>    [ADR-008](../decisions/ADR-008-valuation-carves-at-admission.md) (Approved,
>    2026-08-07) moves it out of `progress.record` and into the **stage closure**,
>    which is v0.1's admission event. Performed quantity is recorded **unvalued**;
>    only admitted quantity competes for the work item's pool; admission is a
>    deliberate authorised act and not a side effect of measurement (INV-089, P0).
>    Until 2026-08-08 this ADR was named in no document but the glossary.
>    **What is built is not yet what it decided:** `progress.adjust` still carves
>    at measurement time whenever the root already holds an allocation — no
>    closure, `admitted_by_closure_id` NULL — and that is an open P0, not a
>    nuance.
> 2. **The work type's carrier is a column on the work line, and it needed no
>    ADR.** Settled by the owner on 2026-08-08. Migration `0050` adds
>    `public.work_items.work_type_key`, so the requirement-rule predicate's first
>    argument has a left-hand side at last and a **hand-typed** baseline
>    materialises obligations. Two things it did not settle: the **owning
>    entity** — a table that defines the set of work types — still needs an ADR
>    ([glossary.md](../domain/glossary.md) «Work type»), so a work type is validated as *a real one* and not as *the
>    right one*; and an **imported** baseline carries no work type at all, which
>    is permanent for the life of that contract version.
>
> **Neither decision is deployed, and neither is anything else.** Migrations
> `0041`–`0050` are ten files written on an uncommitted branch and **none has
> been applied anywhere**. Against applied history (`0001`–`0040`) the runtime is
> **33 tables**, of which **9** are among the 26 that ADR-006 decision 4 builds
> in v0.1. Nothing in this package may be described as green, verified, or
> confirmed working.


## What this document is

[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) re-cuts v0.1 to the six
steps a subcontractor needs to use the product unaided, and moves the rest here.
This is the **transfer record**: what moved, why each thing moved, the schema and
API slice it takes with it, and the exit gates it keeps unchanged.

Three things it is not.

- **It is not an approval.** Every capability below still requires its own
  decision before it enters v0.2. An owning version is a routing note, not an
  approval — the rule
  [ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md)
  §"Explicitly deferred" and
  [scope-and-boundaries.md](../product/scope-and-boundaries.md) already apply to
  every deferred row.
- **It is not a cancellation.** Nothing here is cancelled, thinned, or rewritten.
  Every row keeps its ADR-005 text, its DDL in
  [schema-v0.1.sql](../../technical/database/schema-v0.1.sql), its entity-catalog
  row, and its invariants. That is what makes the re-cut cheap to reverse.
- **It is not a milestone plan.** v0.2 has **no approved milestone cut**. ADR-006
  assigns contents, not an order, and inventing milestones here would smuggle in
  a sequencing decision nobody made. The blocks below are groupings by what
  cannot ship without what, not a delivery order.

## Nothing here is deployed, and v0.2 is much larger than its name

**Approved is not deployed.** The runtime is 33 tables defined by 40 migrations
through `0040`; `0036`–`0040` create no table. Packages, claim segments, the
allocation ledger's claim half, internal review, external decisions, acceptance,
and value at risk have **no tables at all**. No baseline state, test count, or
green-suite claim is made by this document.

*(Qualified 2026-08-08 — «deployed» and «written» have come apart, and every sentence above
is about the first. All of it is still exactly true of the **applied** migrations, `0001`–`0040`,
which define 33 tables. Migrations `0041`–`0050` are ten files written on an uncommitted branch and
**applied nowhere**; between them they carry `create table` for **seventeen of the twenty-six** v0.1
tables, plus every CHECK, trigger, policy and grant the readiness gate is made of. Having DDL is not
existing, and none of the ten files has ever been executed.)*

**None of those seventeen is a v0.2 table.** `0041`–`0050` build the v0.1 gate,
the act and the external plane; no package, claim segment, submission, internal
review or acceptance table exists in any file in this tree. Everything this
document describes is still absent in both senses.

[ADR-004](../decisions/ADR-004-roadmap-demo-and-documentation.md) calls v0.2
"pilot hardening". After this re-cut that name is wrong and the line needs
rewriting: v0.2 now carries the **commercial half of the product** — the half
that turns a signed act into money asked for — on top of the demo, adapter, and
onboarding work it already had.

## The 22 operations that moved

Their rows live in [scope-v0.2.csv](../../technical/openapi/scope-v0.2.csv), with
the same schema as [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv) and
`v0.2` in the `milestone` column, because v0.2 has no milestone cut to name. An
operation that is not a row in one of those two files is in neither version.

| Operation | Block |
|---|---|
| `packages.create`, `package_versions.create`, `package_versions.freeze`, `packages.head_advance`, `packages.corrected_successor`, `package_versions.get`, `package_artifacts.download` | 1 — Packages |
| `package_submissions.create`, `external_grants.issue`, `external.scope`, `external.decisions_submit` | 2 — The commercial decision |
| `internal_reviews.decide` | 3 — Internal review |
| `value_at_risk.get`, `acceptance.get` | 4 — Value at risk |
| `requirement_rules.create`, `requirement_occurrences.create`, `requirement_occurrences.bulk_instantiate` | 5 — Requirement authoring and location scope |
| `requirement_notices.create`, `notice_attendance.record` | 6 — `witness` and the notice apparatus |
| `unevidenced_closures.create`, `unevidenced_closures.clear` | 7 — The bypass |
| `evidence_links.create` | 8 — Many-to-many evidence |

## Block 1 — Packages, claim segments, and the allocation ledger

- **What moved:** package template versions, packages, package versions,
  `package_scope_heads`, package lines, claim scope lineages and heads, claim
  segments, progress sources, evidence sources, package artifacts, approval
  requirements, and the allocation ledger — `progress_allocation_heads`,
  `valuation_allocations`, `progress_claim_allocations`.
- **Why:** step 5 of v0.1 is one person accepting one requirement through one
  link. A frozen multi-line claim document is the commercial half of the product,
  and no v0.1 step needs it. A claim segment exists to be partially decided
  inside a package; with no package it is a row with nothing to say. The
  allocation ledger carves minor units out of a work-item pool for admission into
  a claim, and nothing in v0.1 is admitted to anything.
- **Deployed caveat:** `progress_allocation_heads` and `valuation_allocations`
  exist in the runtime today and `progress.record` writes them. Moving the ledger
  means **no further work on it in v0.1**, not deletion — the deployed path keeps
  working, exactly as the frozen importer does.
- **API slice:** `packages.create`, `package_versions.create`,
  `package_versions.freeze`, `packages.head_advance`,
  `packages.corrected_successor`, `package_versions.get`,
  `package_artifacts.download`.
- **Exit gates it keeps, unchanged:** a package belongs to exactly one contract;
  lines and claim segments trace to exact progress without overclaim;
  `is_package_eligible` is a **precondition of the finalisation command**, not a
  filter inside the compiler, and the command **refuses** with a per-segment
  reason list built from `blocked_reason` objects together with the sum included
  and the sum excluded by currency (INV-062); a test proves a package is never
  assembled with a silent hole, and removing the precondition fails the suite
  rather than degrading quietly; an ineligible segment is a **named refusal**,
  discriminable from a stale-source conflict and never reported as a concurrency
  error; freeze pins all material sources and approval requirements (INV-034);
  every frozen version renders «виключені позиції та підстави» as an appendix
  with value by currency; PDF, XLSX, ZIP and manifest derive from one snapshot
  and repeated generation is deterministic for a renderer version; frozen content
  and artifact keys cannot be mutated or overwritten (INV-015/045); head advance
  and corrected-successor races are safe (INV-027); line homogeneity holds
  (INV-033).
- **Acceptance evidence it keeps:** at least one real sanitized package example
  with its source work, evidence, expected sections and review requirements; a
  recorded package-compiler walkthrough before snapshot/template fields freeze;
  at least one real sanitized case in which scope was packaged and then returned
  for missing evidence, with the money and the number of cycles involved. **None
  of these exists** ([validated-assumptions.md](../discovery/validated-assumptions.md)).
- **What v0.1 does instead:** nothing. There is no v0.1 substitute for a package,
  and the honest consequence is stated in
  [version-0.1.md](version-0.1.md) — v0.1 delivers a signed act, not a payment
  application, and the second clause of the positioning sentence arrives here.

## Block 2 — The commercial decision, submission, and partial acceptance

- **What moved:** `commercial_decision`, package submissions, decision issues,
  decision coverage, prior-acceptance references, per-segment partial
  acceptance, the package review status projection, and the package-version
  scope kind on the external grant. **`external_decision_batches` did not
  move**: it entered v0.1-M5 on 2026-08-06 by owner decision
  ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 4, amendment
  note), because the occurrence-scoped submit needs the receipt, the
  confirmation-text version and the idempotency record it carries. What is v0.2
  is the commercial content recorded **against** a batch, not the batch.
- **Why:** step 5 is an **evidence** decision. Per-segment partial acceptance
  requires segments; prior-acceptance references require a prior acceptance,
  which requires a package; decision coverage — reviewer-order independence
  across arbitrary partial partitions — is correct and is far ahead of any
  evidence that a first pilot needs it
  ([package review](package-review-2026-08-04.md) §6).
- **API slice:** `package_submissions.create`, `external_grants.issue`,
  `external.scope`, `external.decisions_submit`.
- **Additive by construction:** the v0.1 decision is named `evidence_decision`
  **from the first migration**, so adding `commercial_decision` here reinterprets
  no v0.1 record. The external grant's scope-kind exclusivity (INV-074) is what
  makes adding the package-version scope additive rather than a redefinition.
- **Exit gates it keeps, unchanged:** a segment carries two decisions with
  different authorities and the API cannot express one as the other; an
  `evidence_decision` is a precondition of admission, which is a different moment
  in time from a monetary effect; evidence return after quantity acceptance still
  creates a compliance exception and still moves no money (ADR-003, unchanged;
  INV-075); several parallel required approvers can address the same exact scope
  and reach identical leaf coverage in either order (INV-006); partial commercial
  decisions partition and reconcile claim segments; correction, resubmission, and
  references to unchanged prior acceptance work without copying a decision
  (INV-008/030); observers cannot decide (INV-031).
- **Acceptance evidence it keeps:** customer and technical-supervision
  walkthroughs of the review surface using synthetic or sanitized package data,
  with expected quantity/evidence decisions, return reasons, observer behaviour
  and receipt language recorded before the external API freezes.
- **What v0.1 does instead:** one occurrence-scoped grant, one evidence decision,
  one immutable receipt, and the same link discipline
  ([version-0.1.md](version-0.1.md) §M5).

## Block 3 — Internal review

- **What moved:** `review_target_sets`, `review_target_items`,
  `internal_review_decisions` and their heads; internal review's role in
  `satisfied(o)`; the `review` intervention type; `is_package_eligible` and
  freeze-refuses-ineligible-scope.
- **Why:** internal review is a precondition of package eligibility and of the
  `review` intervention type. Both are here, so it comes with them.
  `review`'s only blocking scope is package inclusion, and in v0.1 there are no
  packages.
- **API slice:** `internal_reviews.decide`.
- **Exit gates it keeps, unchanged:** exception and review forks are denied
  (INV-035); target-set identity is immutable (INV-036); a member may not decide
  a review target set containing their own capture or their own recorded progress
  (INV-069); internal outcomes never accept contractual quantity; internal queues
  do not become a second source of truth.
- **What v0.1 does instead:** `can_close_stage` — the half a foreman meets —
  ships in v0.1 without internal review in the predicate. `is_package_eligible`
  ships here, whole.

## Block 4 — Value at risk and acceptance

- **What moved:** the seven-state value-at-risk projection with currencies and
  tax bases, the acceptance projection, and the corrected precedence of ADR-005
  decision 8.
- **Why:** five of the seven states name packaging or submission. Step 6 of v0.1
  needs a sum and a cause, not a state machine over states that cannot occur.
  The corrected precedence ranks `evidence_blocked` above the packaging states;
  with no packaging states there is nothing to rank. **The correction stands and
  applies the moment packages exist** — it is not weakened by being deferred, and
  restoring `evidence_blocked` below the packaging states remains a boundary
  change requiring a superseding ADR.
- **API slice:** `value_at_risk.get`, `acceptance.get`.
- **Exit gates it keeps, unchanged:** disjoint state precedence assigns every
  in-scope segment exactly once, first match wins, in the order
  `accepted → returned → evidence_blocked → submitted_pending →
  packaged_not_submitted → internal_review → ready_not_packaged`
  ([value-at-risk.md](../domain/value-at-risk.md), INV-040/071); **no eighth
  state exists for the bypass** — `CLOSED_WITHOUT_ACT` is a
  `blocked_reason.code` inside `evidence_blocked`; currency, tax basis, precision
  and rounding are explicit and reconcile, including largest-remainder ties
  (INV-011/012/037/055); missing price, zero price and over-contract exposure
  stay distinct (INV-038/039); a v2 correction references unchanged v1 acceptance
  without copying a decision; watermark determinism holds (INV-051).
- **What v0.1 does instead:** `blocked_value.get` — a sum over the work lines
  under a blocked stage, at the price on the published baseline, attributed once
  per assignment (INV-070) and broken down by `blocked_reason.code`, within one
  baseline and never across currencies. It is exposure, never a receivable, and
  ADR-001's financial boundary is untouched in both versions.

## Block 5 — Requirement authoring, location scope, and import extension

- **What moved:** `requirement_rules` — workspace-authored rule drafting;
  `locations` in the rule predicate and location-subtree bulk instantiation;
  `unit_definitions` beyond the units a manual line needs; and the
  **extension** of contract-baseline import.
- **Why:** the only rule source v0.1 needs is the shipped ДБН library, and the
  predicate narrows to (work type, stage). Import extension moves because there
  are **zero customer documents of any kind**: the import schema was specified
  against no real file, and every further hour on column mapping, unit inference
  or number-format handling is an hour spent guessing at a file nobody has seen.
- **API slice:** `requirement_rules.create`, `requirement_occurrences.create`,
  `requirement_occurrences.bulk_instantiate`.
- **Import is frozen, not moved and not deleted.** The importer built in M1 stays
  in v0.1's code exactly as it is; its tables are not dropped and an object
  created by import keeps working. What is deferred here is only its extension —
  and it is deferred to **evidence, not to a date**: one real sanitized кошторис,
  АВР, or interim-works file from a named company, recorded in
  [validated-assumptions.md](../discovery/validated-assumptions.md) with the
  company and the date, unfreezes it. Resuming import work without that file is a
  decision to build against an assumption and must say so in writing (ADR-006
  replacement rule 3). One file is enough to unfreeze; it is not enough to
  validate.
- **Exit gates it keeps, unchanged:** rule versions stay publish/retire only and
  are never updated in place (INV-067); bulk instantiation reports **every**
  uncovered line, because silent non-coverage means there is no gate (INV-072);
  each added import adapter or template is versioned and tested against real
  sanitized samples.
- **What v0.1 does instead:** rule versions are published from the shipped
  library; occurrences are materialised only at assignment creation; the dry run
  and its explicit uncovered-line list survive over a contract version's work
  lines rather than a location subtree.

## Block 6 — `witness`, the notice event, and the statutory notice apparatus

- **What moved:** the `witness` intervention type, `requirement_notices`,
  `notice_attendance_outcomes`, the Ukrainian working-day calendar with state
  holidays, delivery proof, the push when the notice window opens, and the
  printed notice artifact.
- **Why:** `witness` cannot be released without the notice event and its
  attendance outcomes, and the apparatus around them was already v0.2 under
  ADR-005. The type moves with the machinery it depends on.
- **API slice:** `requirement_notices.create`, `notice_attendance.record`.
- **Exit gates it keeps, unchanged:** `witness` releases only on a recorded
  notice event whose **server-computed** `earliest_proceed_at` has elapsed, and a
  client-supplied one is rejected (INV-068); attendance with an accepting
  decision releases it, and recorded non-attendance after the period also
  releases it and is kept as evidence of process in favour of the performer;
  closure is refused before the period elapses and permitted after (INV-061,
  witness half).
- **The naming rule survives the move.** Until the working-day calendar ships,
  the configured duration is a workspace setting and **must not be labelled the
  five-working-day rule** of the примітка to Додаток В/Г, because calendar days
  and робочі дні produce different dates. In v0.1 there is no notice at all, so
  there is nothing to mislabel.
- **What v0.1 does instead:** `intervention_type` is `hold` only. The CHECK keeps
  all three values and the v0.1 publication command rejects the other two, so
  adding them here is additive and no v0.1 record is reinterpreted.

## Block 7 — The closure-without-evidence bypass and its clearance

- **What moved:** `unevidenced_closures`, `unevidenced_closure_clearances`, the
  `CLOSED_WITHOUT_ACT` ineligibility consequence, and the named bypass appendix
  in the frozen manifest.
- **Why:** ADR-005 decision 5 is unchanged and its price is that **the money
  waits**. In a version with no packages there is no money to make wait, so
  shipping the bypass in v0.1 would ship a defeat that costs nothing — and a gate
  with a free exit teaches that the gate is theatre, which a later release cannot
  unteach.
- **API slice:** `unevidenced_closures.create`, `unevidenced_closures.clear`.
- **Exit gates it keeps, unchanged:** the bypass is a first-class append-only
  fact carrying the actor, the claimed authority, a mandatory reason code plus
  free text, the expected remedy, and the **exact set of unmet occurrences frozen
  at that moment**, not recomputed later; it records the stage as closed and
  satisfies nothing; its clearance is a separate append-only internal-reviewer
  fact naming substitute evidence and never deletes the bypass; an uncleared
  bypass makes every covering segment ineligible under
  `blocked_reason.code = CLOSED_WITHOUT_ACT`; the bypass appears in the frozen
  manifest as a named appendix with its value by currency (INV-064). The reason
  code vocabulary is **not enumerated anywhere in this package** and must be
  enumerated in [state-catalog.csv](../../technical/states/state-catalog.csv) and
  [glossary.md](../domain/glossary.md) before the bypass ships; until then no
  document may describe it as a closed set.
- **What v0.1 does instead:** the ADR-005 **exception** is the v0.1 escape —
  `waiver` and `accept_risk` by an authorised actor, attributed and visible, with
  `not_applicable` still rejected on a `hold` by the exception command itself
  (INV-063). One attributed, visible escape exists, which is what ADR-005's
  argument against an absolute lock actually requires.

## Block 8 — Many-to-many evidence links

- **What moved:** `evidence_requirement_links` and `evidence_links.create`.
- **Why:** in v0.1 one original is bound to the one occurrence it was captured
  against, through `upload_intents.requirement_occurrence_id`
  (`supabase/migrations/0015_execution_evidence_module.sql:251`, whose foreign
  key M2 activates). The many-to-many case — one document satisfying several
  obligations — is what the link table is for, and its sharpest instance,
  material certificates as scoped expiring evidence satisfying many lines, is
  already v0.3.
- **API slice:** `evidence_links.create`.
- **Exit gates it keeps, unchanged:** evidence links support many-to-many
  relationships; evidence correction and derivative lineage stay testable.
- **What v0.1 does instead:** capture against the occurrence. The cost is stated
  rather than hidden: in v0.1 the same photo cannot satisfy two requirements, and
  the foreman captures twice.

## v0.2 also carries, unchanged and with no operation yet

Each was already deferred to v0.2 by ADR-005 and keeps its text; none acquires an
operation in [scope-v0.2.csv](../../technical/openapi/scope-v0.2.csv), because
none has been designed to the level a route set records, and inventing one here
would be an approval this document is not:

- `evidence_plan` — the counter-signed, externally agreed requirement list that
  makes the gate two-sided in its **rules** and not only in its decisions;
- КЕП: `assurance_level` on decisions and a detached `.p7s` over the frozen
  version hash. v0.1 prints `LINK_CONFIRMATION` and the negative statement, at
  level 3 of the assurance ladder in
  [hidden-works-content-rules.md](../product/hidden-works-content-rules.md);
- qualified timestamps (RFC 3161) over evidence hashes and package-version Merkle
  roots;
- КБ-2в (Додаток 36) and КБ-3 (Додаток 37) rendering with a mandatory
  `form_version` on every document — the first thing asked for after the act;
- the submission-requirements matrix (Not tracked / Warn / Prevents submission)
  with attributed per-requirement waivers;
- the silence clock and the unilateral act on a counterparty's unmotivated
  refusal to sign. **The statutory basis is not established**; no civil-code
  article, part, or court decision may be cited for it until
  [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
  allow-lists one against a fetched primary text;
- non-conformance objects whose disposition moves money;
- додаткові угоди as first-class baseline amendments;
- the v0.2 surfaces already on the roadmap: additional import adapters and
  templates, reusable versioned import mappings, guided onboarding and safe
  sample workspaces, privacy-controlled product analytics, the durable `/demo`
  inside `apps/app`, and the free public requirement-list and act-blank generator
  — the last of which is an **owner decision, not a delivery decision**, and is
  recorded before the surface is built.

Web push is named here for one reason only: on iOS it requires the PWA to be
installed to the Home Screen. v0.2 must decide between an installed PWA for
recipients who want push and the native client, and until it does, **no document
may describe v0.1 as push-capable on either platform**
([ADR-007](../decisions/ADR-007-pilot-field-client.md) decision 7).

## Two migrations v0.1 owes this version

Both are silent failures if forgotten, and both need a test that fails when a
v0.1 row is left behind (ADR-006 consequences):

1. **Widen every `hold` written during v0.1** from `blocks_stage_closure` to
   `blocks_both`. Without it, every requirement recorded during the pilot sits
   permanently outside the payment-eligibility half of the gate, and nobody would
   notice.
2. **Pin every act version written during v0.1** — pinned in v0.1 by its stage
   closure — additionally to the package version that carries it, once package
   versions exist. The freeze discipline is unchanged in both versions.

## What must happen before v0.2 is planned

- **The pilot answers first.** Moving the pilot behind the commercial half again
  requires a superseding ADR (ADR-006 replacement rule 2). v0.2 is planned
  against what the pilot returns, including the possibility that it invalidates
  the gate rather than merely its wording
  ([competitive-landscape.md](../product/competitive-landscape.md) §8, question
  2).
- **The package must stop contradicting itself.**
  [roadmap.md](../product/roadmap.md),
  [scope-and-boundaries.md](../product/scope-and-boundaries.md),
  [entity-catalog.csv](../../technical/database/entity-catalog.csv) and
  [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv) were **each rewritten
  against ADR-006 on this branch**, which is the condition ADR-006 places on the
  decision taking effect. `scope-v0.1.csv` reconciles exactly — 58 rows against
  the per-milestone counts in [version-0.1.md](version-0.1.md). What is still
  owed is recorded in [version-0.1.md](version-0.1.md) §"Corrections owed
  elsewhere", and a slice that depends on one of those rows stops until it
  lands. Planning a v0.2 milestone additionally waits on the pilot, which is the
  point above and not a documentation condition.
- **Each capability above still needs its own decision.** Listing a capability
  here assigns it an owning version and nothing more.
