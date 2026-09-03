# ADR-006: A pilot-shaped v0.1

**Status:** Approved

**Applies to:** v0.1 and v0.2

**Last reviewed:** 2026-08-08

**Related decisions:** [ADR-001](ADR-001-product-boundary.md),
[ADR-002](ADR-002-tenancy-parties-and-contracts.md),
[ADR-003](ADR-003-evidence-packages-and-acceptance.md),
[ADR-004](ADR-004-roadmap-demo-and-documentation.md),
[ADR-005](ADR-005-readiness-gate-and-hidden-works.md),
[ADR-007](ADR-007-pilot-field-client.md),
[ADR-008](ADR-008-valuation-carves-at-admission.md)

> **Amendment note.** This ADR amends the v0.1 release boundary set by ADR-001
> for the **second** time; ADR-005 was the first. ADR-001 is not superseded: its
> loop, its financial boundary, and all thirteen of its deferrals remain in
> force. ADR-005 is not superseded either: every decision in it stands, and this
> ADR moves five of them into v0.2 without altering one word of what they say.
> What this ADR **does** supersede is the milestone structure — ADR-004's six
> v0.1 milestones (ADR-004:44-53), the milestone contents in
> [roadmap.md](../product/roadmap.md), and the milestone slices in
> [version-0.1.md](../delivery/version-0.1.md).
>
> **Authority.** This re-cut is made on the owner's instruction of 2026-08-06.
> It is **not** made on the founder-reported market signal of 2026-08-05, which
> [validated-assumptions.md](../discovery/validated-assumptions.md) §"What this would change if it were validated"
> forbids from driving a roadmap change, and which is not cited here for
> anything.
>
> **Amendment note, 2026-08-08 — what decision 1 step 1 needed, and what it did
> not.** Decision 1 step 1 says ПТВ «enters the work lines by hand, **picks a
> work type**, and the requirements load from the shipped ДБН library». The
> picking had no carrier: `public.work_items` held no `work_type_key`, so the
> requirement-rule predicate's first argument had no left-hand side and
> `assignments.create` materialised **zero** obligations for every line in the
> product — every stage empty, every closure vacuous, decision 3's gate
> structurally sound and never once fired. The owner settled the question on
> **2026-08-08: the CARRIER is a column and needed no ADR**, because decision 1
> step 1 already requires it in terms. Migration `0050` adds the column, a shape
> CHECK, and a write-time refusal of a key that names no bindable rule version
> (**INV-090**, allocated 2026-08-08). **This ADR is not amended in substance and
> its build list of 26 tables is unchanged** — `0050` creates no table. What is
> still deferred, and is what [glossary.md](../domain/glossary.md) «Work type»
> means by «a scope decision an ADR must make», is the **owning entity**: a table
> defining the set of work types, with an operation and a capability. Building it
> would move decision 4's list from 26 to 27 in five documents and in
> `scripts/validate-canonical-docs.mjs`. **Decision 6's frozen importer writes no
> work type**, so an imported baseline materialises nothing and — a published
> version being immutable — the only remedy is a successor version typed by hand.
>
> **Amendment note, 2026-08-08 — the money.**
> [ADR-008](ADR-008-valuation-carves-at-admission.md) (Approved 2026-08-07)
> settles where the valuation carve happens: at **admission**, which in v0.1 is
> decision 1 step 3's stage closure, and not at recording. It changes no scope
> decision here, it adds no table and it moves no operation; it is named because
> decision 1 step 6's blocked-money read now has a second, adjacent quantity to
> report — performed, priced, and not admitted — and because until 2026-08-08 the
> ADR was cited in no document but the glossary.

## Context

> **How to read the citations below.** This Context describes the package **as it
> stood on 2026-08-06, before this decision landed**, and the quotations are of
> that state. [roadmap.md](../product/roadmap.md),
> [version-0.1.md](../delivery/version-0.1.md) and
> [scope-and-boundaries.md](../product/scope-and-boundaries.md) have since been
> rewritten against this ADR — which §"The precedence problem" makes a condition
> of it taking effect — so their line numbers no longer resolve to the quoted
> text and are not used here. Section names are used instead. **No sentence below
> is a claim about the present state of any of those documents.**

### The pilot is currently the last thing built

ADR-004 delivers v0.1 through six vertical milestones and puts the pilot in the
sixth (ADR-004:53; [roadmap.md](../product/roadmap.md), the old M6 section that
§"The re-cut, and its authority" now replaces). Read literally,
that ordering says: build parties, contracts, import, assignments, evidence,
requirements, stage closure, internal review, immutable packages, claim
segments, protected external access, partial acceptance, decision coverage, and
the seven-state value-at-risk projection — and *then* let a subcontractor touch
it.

The [package review](../delivery/package-review-2026-08-04.md)
§7 "Under-engineering register — what a pilot hits first" measured that remainder: "Items 4–9 are M3–M6 and are approximately the same size
as everything built so far." ADR-005 then made it larger on purpose and said so
(ADR-005 §"Consequences"). The target design in
[`schema-v0.1.sql`](../../technical/database/schema-v0.1.sql) is now **86
tables**; the runtime is **33 tables** defined by 40 migrations through `0040`,
and `0036`–`0040` create no table
([version-0.1.md](../delivery/version-0.1.md) §"Nothing below is deployed").

So the current plan is: build roughly the second half of a product, at a
size the package review already called equal to everything built so far, before
one subcontractor clicks anything.

### The roadmap's own rule forbids it

[roadmap.md](../product/roadmap.md) §"Roadmap policy" read, until this decision:
"Discovery runs alongside delivery and precedes each irreversible schema or UX
freeze. M6 is the integrated live pilot, not the first point at which the team
sees customer artifacts or external-review behavior."

That rule is not being kept, and it cannot be kept by the current ordering.
Every milestone from M1 to M5 freezes a schema or a UX; every one of them names
entry evidence that requires a practitioner; and
[roadmap.md](../product/roadmap.md) §"Entry-evidence status as of 2026-08-06"
records that **every entry-evidence item that depends on a conversation with a
practitioner is unmet**. M1 shipped without the "at least one representative
sanitized estimate/contract artifact" its own entry condition demanded
([validated-assumptions.md](../discovery/validated-assumptions.md) §"What this would change if it were validated").

The discovery ledger records 21 evidenced sends, zero replies, zero interviews,
zero named projects, zero pilot commitments, zero willingness-to-pay signals,
and **zero customer documents of any kind**
([validated-assumptions.md](../discovery/validated-assumptions.md) §"Assumption ledger" and
§"Founder-reported signal, 2026-08-05"). Building the second half first is therefore not merely the most
expensive available ordering; it is the ordering that keeps the ledger at zero
for longest.

### What a pilot is

A pilot is not a milestone at the end of a version. It is a **minimal finished
product** — small, whole, and handed to a customer who clicks through it, feels
the value, and says yes or no. The value of that answer is highest when the
product is cheapest, and it decays with every table built before it is asked.

That is the entire content of this decision. Everything below is bookkeeping.

### What this ADR is not

It is not evidence. Nothing here is deployed, no milestone below is closed by
being written, and this document makes no test-count, green-baseline, or
delivery claim. It does not weaken the gate: the refusal ADR-005 decision 7
specifies still ships in v0.1, still as a precondition, still proven by a test
that the command refuses.

## Decision

### 1. v0.1 is six steps, and nothing else is v0.1

v0.1 is the smallest whole thing a subcontractor can use unaided:

1. **The object.** ПТВ creates an object, enters the work lines **by hand**,
   picks a work type, and the requirements load from the shipped ДБН library at
   [`dbn-a31-5-2016-dodatok-n.csv`](../../technical/requirements/dbn-a31-5-2016-dodatok-n.csv).
2. **The phone.** The foreman opens the field client and sees what must be
   photographed **before covering**, in the standard's own wording, with a
   reference image. He takes it. That is the whole interaction.
3. **The refusal.** The stage cannot be recorded as closed while a `hold`
   requirement on it is unmet, and the attempt names exactly what is missing.
4. **The act.** «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ» by the form of Додаток В,
   assembled only from already-recorded facts, with no free-text quantity field
   in any render (ADR-005 decision 10, unchanged).
5. **The link.** Технічний нагляд opens a personal link with no account and
   accepts or returns with a reason.
6. **The money.** The owner sees what is blocked and how much money sits behind
   it — a sum over the manually entered lines with a breakdown by cause.

**The client in step 2 is a browser page.**
[ADR-007](ADR-007-pilot-field-client.md) decisions 1–2, made the same day, put
the v0.1 field client in `apps/app` as a PWA and take `apps/mobile` off the v0.1
path without deleting it. Step 2 is unchanged in substance by that — it is still
"show the requirement, take the photo" — but four claims a reader might attach to
it are **withdrawn from v0.1** by ADR-007 decision 5 and may not be re-asserted
through this list or any document that cites it: camera-only capture for a
blocking requirement, camera-versus-gallery distinguishability, tamper-evident
provenance, and verified capture-time GPS. ADR-007 decision 6 additionally makes
the pending original **not durable** in v0.1; step 2 promises a warning, never a
queue.

**Nothing outside this list is v0.1.** A capability does not enter because it is
already specified, already catalogued, already in the DDL, or already written
down in an Approved document. "It is already specified" is the cheapest argument
available and it is not a reason to build.

### 2. Manual work-line entry is a first-class capability

ПТВ types the lines. This is **not a stopgap for a missing importer** and no
document may describe it as one. It is how a v0.1 object is created, it is what
the six steps are demonstrated on, and it is what the blocked-money sum in step
6 is computed over. It gets the same schema quality, the same provenance, and
the same tests as an imported line.

### 3. The milestone re-cut

Seven milestones. One is new; four survive with changed contents; one splits;
one moves out of v0.1 entirely.

[Amended 2026-09-03 by [ADR-011](ADR-011-telegram-locked-project-channel.md)
decision 9: eight — `v0.1-M7 — The channel`, the Telegram project channel of
the 2026-08-28 design, is added after M6 and re-cuts none of the seven.]

| Old milestone (ADR-004:48-53) | Fate |
|---|---|
| — | **New: M0 — Fit to hold someone else's data.** Decision 7 |
| M1 — parties, contracts, versions, and import | **Survives, re-scoped** as *The object and what it owes*. Import extension leaves (decision 6); manual entry enters; the requirement rules, the Додаток Н library, and the baseline rule binding **merge in** from old M2 |
| M2 — assignments, progress, and online evidence | **Survives, re-scoped** as *The phone*. Requirement-occurrence materialisation **merges in** from old M3; capture telemetry and location-subtree bulk instantiation leave |
| M3 — requirements, stage closure, internal review, and readiness | **Splits.** The closure refusal survives as the new M3, *The refusal*. Internal review and `is_package_eligible` **move to v0.2** with packages |
| M4 — immutable package generation | **Moves to v0.2 entire.** What survives of it in v0.1 is the statutory act, which becomes the new M4, *The act* |
| M5 — protected external access and partial decisions | **Survives, halved**, as *The link*. The evidence decision on a requirement occurrence survives; the commercial decision and everything segment-shaped moves to v0.2 |
| M6 — value at risk and pilot hardening | **Survives, replaced in content**, as *The blocked money*. The seven-state projection moves to v0.2; the sum, the breakdown by cause, and the pilot survive |

**One long-open contradiction closes as a side effect.**
[roadmap.md](../product/roadmap.md) recorded, until this decision, that contract
versions published in M1 can never acquire a rule binding, because rules bind at
publication, published versions are immutable, and `contract_versions.bind_rules`
was an M2 operation — leaving every M1 baseline permanently outside the gate,
with delivery of the affected slice stopped. Merging the rule half of old M2 into
M1 dissolves it: the milestone that publishes a baseline is now the milestone
that binds its rules. **No baseline is published in v0.1 without a rule-version
set.** The item is closed by this decision and needs no separate one.

### 4. The v0.1 table set

Twenty-six tables of the 86 in
[`schema-v0.1.sql`](../../technical/database/schema-v0.1.sql). **Nine already
have a table in an applied migration, so v0.1 builds seventeen.** Every row is
here because a numbered step above cannot happen without it.

> **Amended 2026-08-06 by the owner, from twenty-three to twenty-six.** The
> re-cut originally left `requirement_exception_heads`,
> `requirement_evidence_decision_heads` (both M3) and `external_decision_batches`
> (M5) in v0.2 while the lineages they serialise stayed in v0.1. The
> re-verification of the audit escalated that as the one finding a file edit
> could not settle: `can_close_stage` is the only predicate v0.1 ships, and
> without those heads it cannot be enforced — a fork or a second root decision
> becomes representable, which is exactly what the heads exist to prevent.
> The owner chose to move the three into v0.1 rather than re-declare INV-035 and
> the relationship rows without them. Cost: three more tables in the pilot
> build. The alternative — a v0.1 that serialises its lineages some other way —
> was not specified, and shipping the gate on an unenforceable predicate would
> have made the refusal advisory, which is the thing ADR-005 exists to prevent.
>
> **How this amendment was made, recorded so it is not inferred from a date.**
> It was made **in place, by the owner**, and not by a superseding ADR.
> §"Replacement rule" below requires a superseding ADR to change any of the nine
> decisions, and this note does not claim to be one: it identifies the version
> impact and the migration cost and it does not address data ownership or
> security impact, because the change adds three tables to decision 4's list and
> alters no other decision. The block this paragraph replaces argued the opposite
> conclusion from the same rule — that the heads could not be added without a
> superseding ADR — and was deleted on 2026-08-06 because the owner decided
> otherwise on the same date; it is recorded here rather than silently dropped.
> A change of this kind that is **not** the owner's own dated decision still
> needs the superseding ADR.

**What this list is, exactly.** It is the set of tables v0.1 **builds or
changes**. It is not an inventory of the tables v0.1 *touches*, and it is not a
statement about anything absent from it. Three consequences, so that no catalog
has to guess:

- a table that is **already deployed and that v0.1 neither builds nor extends**
  is not on this list and is not thereby moved out of v0.1. `party_legal_profiles`,
  `own_legal_entity_profiles`, `party_contacts`, `project_parties`,
  `project_access_grants`, `project_responsibility_assignments`, `locations`,
  `unit_definitions`, `progress_allocation_heads`, `valuation_allocations`,
  `capture_events` and the four import tables all exist in applied migrations and
  keep working. Where an operation on one of them is a v0.1 row in
  [scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv) it stays v0.1, and
  where the further **work** on one of them moved to v0.2 (`locations` and the
  allocation ledger, decision 4.2 and decision 5) the deployed row is untouched.
  Their invariants stand either way — INV-002 is a **P0** invariant requiring an
  own-legal-entity profile on a v0.1 contract's own party, and nothing here
  weakens it;
- **no catalog may re-tag a deployed table to a future version.** Applied
  migrations are precedence level 1 ([docs/README.md](../README.md) §"Source of
  truth"); a `v0.2` marker on a table that exists in the runtime asserts
  something false about the world. What moves to v0.2 is the **work**, never the
  row;
- consequently the entity catalog carries **more** `v0.1-*` rows than this list
  has, and that is correct rather than a disagreement. Any document demanding
  that the catalog agree with this list "row for row" is asking for something
  this decision does not say; the agreement owed is for every table v0.1 builds
  or changes.

| Milestone | Tables | Already in the runtime |
|---|---|---|
| M1 — The object and what it owes | `parties`, `projects`, `contracts`, `contract_versions`, `work_items`, `requirement_rule_versions`, `requirement_library_items`, `contract_version_rule_bindings` | first five |
| M2 — The phone | `work_assignments`, `requirement_occurrences`, `progress_entries`, `upload_intents`, `evidence_objects` | all but `requirement_occurrences` |
| M3 — The refusal | `work_stages`, `stage_closures`, `requirement_evidence_decisions`, `requirement_exceptions`, `requirement_exception_heads`, `requirement_evidence_decision_heads`, `readiness_projection`, `blocked_reasons` | none |
| M4 — The act | `statutory_acts`, `statutory_act_versions` | none |
| M5 — The link | `external_access_grants`, `external_sessions`, `external_decision_batches` | none |
| M6 — The blocked money | none. It is a query over `blocked_reasons` and `work_items` | — |
| M7 — The channel (added 2026-09-03, ADR-011 decision 9) | fifteen communication tables outside this list, from project_field_channels (0061) to the erasure registry (0081), tagged v0.1-M7 in the entity catalog; not counted in the twenty-six | — |

Five consequences of that list, each of which amends ADR-005 and none of which
makes anything overridable:

1. **`requirement_rules` is not in v0.1.** The only rule source in v0.1 is the
   shipped library; workspace-authored rule drafting is v0.2. Rule *versions*
   stay publish/retire-only and an occurrence still stores `rule_version_id`,
   exactly as ADR-005 decision 2 requires.
2. **The rule predicate narrows to (work type, stage).** ADR-005 decision 2
   defines it over (work type, location node, stage); `locations` and the
   location-subtree bulk instantiation move to v0.2. The dry run and its
   **explicit list of uncovered lines survive** — a work type with no matching
   rule must still be named in the command's output, because silent
   non-coverage means there is no gate.
3. **`intervention_type` is `hold` only in v0.1.** `witness` needs the notice
   event and its attendance outcomes; `review`'s only blocking scope is package
   inclusion, and there are no packages. Both move to v0.2. The CHECK keeps all
   three values and the publication command rejects the other two, so v0.2 is
   additive and no v0.1 record is reinterpreted.
4. **A v0.1 `hold` is `blocks_stage_closure`, not `blocks_both`.** ADR-005
   decision 4 makes the publication command reject any `hold` that is not
   `blocks_both`; in v0.1 it rejects any `hold` that is not
   `blocks_stage_closure`, because the other half of `both` has nothing to
   block. **The v0.2 package milestone must carry a migration that widens every
   `hold` written during v0.1 to `blocks_both`**, and a test that fails if one
   is left behind. Without it, every requirement recorded during the pilot is
   permanently outside the payment-eligibility half of the gate, and nobody
   would notice.

   **A consequence 4.3 and 4.4 have together, stated because it was not:**
   `blocking_scope = none` — ADR-005's advisory tier — is **unreachable in
   v0.1**. `hold` is the only type v0.1 admits and a v0.1 `hold` must be
   `blocks_stage_closure`, so no v0.1 requirement can carry `none`. The advisory
   tier is not retired: it keeps its ADR-005 text and returns with `witness` and
   `review` in v0.2. But **no v0.1 milestone may name an advisory occurrence in
   an entry or exit gate**, because the version cannot produce one, and any
   invariant about rendering advisories is a v0.2 invariant.
5. **Act versions are pinned by the stage closure, not by a package version.**
   ADR-005 decision 10 pins them to the package version that carries them. In
   v0.1 the closure is the pin; in v0.2 the package version pins them
   additionally. The freeze discipline is unchanged: an act version is immutable
   and is assembled only from recorded facts.

**There is no bypass in v0.1.** ADR-005 decision 5 is unchanged and unshipped:
its price is that the money waits, and in a version with no packages there is no
money to make wait, so `unevidenced_closures` and its clearance would ship a
defeat that costs nothing. The v0.1 escape is the ADR-005 exception —
`waiver` and `accept_risk` by an authorised actor, attributed and visible,
with `not_applicable` still rejected on a `hold` by the exception command
itself. One attributed, visible escape exists, which is what ADR-005's argument
against an absolute lock actually requires.

**The blocked-money sum, precisely.** It is the amount of the work lines under a
blocked stage, at the price on the published baseline, attributed **once per
assignment** (ADR-005's deduplication rule, unchanged), broken down by
`blocked_reason.code`, summed **within one baseline and never across baselines
in different currencies**. Missing price, zero price, and over-contract
performance stay distinct and are reported beside the sum rather than folded
into it — ADR-001's financial boundary is untouched, and blocked value is
exposure, never a receivable.

**Size, stated honestly.** The owner's instruction set a target of roughly 15–18
tables. The disciplined list is 26, of which 17 are new build — 23 and 14 before
the 2026-08-06 amendment above. The two nearest further cuts were considered and
not taken: dropping `upload_intents` costs the
whole-upload retry contract, and a foreman who loses a photo in a basement has
no reason to open the app again; dropping `statutory_acts` and keeping only its
versions leaves a corrected act with no thread to its predecessor. Both are
cheap to defer and expensive to be wrong about, so both stay.

### 5. What moves to v0.2, and why each one moves

Every row keeps its ADR-005 text unchanged. None is cancelled; each is named
with the reason it is not needed by one of the six steps.

| Moved to v0.2 | Reason |
|---|---|
| Package versions, package lines, `package_scope_heads`, package artifacts, package approval requirements | Step 5 is one person accepting one act through one link. A frozen multi-line claim document is the commercial half of the product, and no step needs it |
| Claim segments and their lineage heads | A segment exists to be partially decided inside a package. With no package, a segment is a row with nothing to say |
| The allocation ledger — `progress_allocation_heads`, `valuation_allocations`, `progress_claim_allocations` | It carves minor units out of a work-item pool for admission into a claim. Nothing in v0.1 is admitted to anything |
| Per-segment partial acceptance | Requires segments |
| Decision coverage | Reviewer-order independence across arbitrary partial partitions is correct and is far ahead of any evidence that a first pilot needs it ([package review](../delivery/package-review-2026-08-04.md) §6) |
| Prior-acceptance references | Requires a prior acceptance, which requires a package |
| The seven-state value-at-risk projection with currencies and tax bases | Five of its seven states name packaging or submission. Step 6 needs a sum and a cause, not a state machine over states that cannot occur |
| КБ-2в (Додаток 36) and КБ-3 (Додаток 37) rendering | Already v0.2 under ADR-005; unchanged, and named here because it is the first thing asked for after the act |
| The working-day notice calendar and the whole statutory notice apparatus | The **calendar and the apparatus** were already v0.2 under ADR-005 §"Explicitly deferred". The **notice event itself was v0.1** — ADR-005 decision 3 §"Witness scope in v0.1" and ADR-005 §"Included in v0.1" ship it with a server-computed `earliest_proceed_at` and recorded non-attendance — and it moves to v0.2 **here**. That is a narrowing of ADR-005 made by this ADR, not a restatement of it; see §"Relationship…" below. `witness` moves with it (decision 4.3), and **no document may describe a v0.1 notice of any kind** |
| КЕП | Already v0.2 under ADR-005 assumption **d**; unchanged. v0.1 prints `LINK_CONFIRMATION` and the negative statement, at level 3 of the assurance ladder in [hidden-works-content-rules.md](../product/hidden-works-content-rules.md) |
| Contract-baseline **import** — extension only | Decision 6 |
| Internal review — `review_target_sets`, `review_target_items`, `internal_review_decisions`, and their heads | Internal review is a precondition of package eligibility and of the `review` intervention type. Both move, so it moves with them |
| `is_package_eligible` and freeze-refuses-ineligible-scope | Requires packages. `can_close_stage` — the half a foreman meets — ships in v0.1 |
| `commercial_decision`, decision issues, and decision coverage | Step 5 is an evidence decision. The v0.1 decision is **named `evidence_decision` from the first migration**, so adding `commercial_decision` in v0.2 is additive and no v0.1 record has to be reinterpreted. **`external_decision_batches` does not move**: it entered v0.1-M5 by the 2026-08-06 amendment to decision 4 above, because it carries the receipt, the confirmation-text version and the idempotency record that the M5 exit gate and the `requirement_evidence_decisions` CHECK both require. What stays v0.2 is the commercial decision, the issue rows and the coverage relation recorded **against** a batch |
| The corrected value-at-risk precedence (ADR-005 decision 8) | It ranks `evidence_blocked` above the packaging states. With no packaging states there is nothing to rank. The correction stands and applies the moment packages exist |
| `locations`, location-subtree bulk instantiation, `unit_definitions` beyond the units a manual line needs | Decision 4.2 |
| The closure-without-evidence bypass and its clearance | Decision 4; its price is package ineligibility |

### 6. Import is frozen, not deleted

**Frozen means:** the XLSX/CSV importer built in M1 stays in the code exactly as
it is. No migration drops its tables, no code path is removed, nothing is
archived, and an object created by import continues to work. What changes is
that the roadmap stops treating its extension as v0.1 work, and stops making a
customer artifact an entry condition for a milestone that already shipped.

**Why.** There are **zero customer documents of any kind** — no example акт, no
кошторис, no КБ-2в, no виконавча документація
([validated-assumptions.md](../discovery/validated-assumptions.md) §"Founder-reported signal, 2026-08-05"). That
document makes A-6 the sharpest open risk in the project, ahead of A-1, and it
does so without depending on any market signal: the import schema was specified
against no real file, and the roadmap made a representative sanitized artifact
an *entry* condition for M1, which shipped without one
([validated-assumptions.md](../discovery/validated-assumptions.md) §"What this would change if it were validated"). Every
further hour spent on column mapping, unit inference, or number-format handling
is an hour spent guessing at a file nobody has seen.

**What unfreezes it:** one real sanitized кошторис, АВР, or interim-works file
from a named company. That is the same minimum
[validated-assumptions.md](../discovery/validated-assumptions.md) §"What would upgrade it" names for
moving A-6, and it is deliberately the same: import work resumes when the
assumption it rests on can start moving, and not before. One file is enough to
unfreeze; it is not enough to validate.

### 7. M0 — Fit to hold someone else's data

[scope-and-boundaries.md](../product/scope-and-boundaries.md) carried a floating
list of things that must be complete before real pilot data enters GoProceed, and
[roadmap.md](../product/roadmap.md) repeated the requirement in a single
sentence. **Neither named an owner and neither named a milestone** when this
decision was written. A list with no milestone is a list that gets done last, and
a list that gets done last on a one-person project is a list that gets done never
— while a pilot with real personal data on a real site is waiting on it. Both
documents have since been rewritten against this decision and both now name the
milestone and the owner; the sentences above are the reason M0 exists, not a
claim about their present state.

It becomes **M0**. Its exit gates are **twelve, and twelve is eight plus four** —
this is the count, and every other document states it this way or is wrong.

The **eight cross-cutting items**, from
[scope-and-boundaries.md](../product/scope-and-boundaries.md) §"M0 — Fit to hold
someone else's data":

1. privacy notice and versioned external confirmation text;
2. documented retention periods and a manual closure/deletion procedure;
3. workspace export;
4. restricted audit and security telemetry;
5. backup and restore verification;
6. documented external-link assurance limits, including an explicit statement in
   the UI and on every printed page that link confirmation **is not an electronic
   signature**;
7. secrets and environment separation;
8. monitored job and message failure paths.

The **four** already carried by
[ADR-005](ADR-005-readiness-gate-and-hidden-works.md) and
[hidden-works-content-rules.md](../product/hidden-works-content-rules.md):

9. no normative string renderable without its `verification` tag **and its
   source**, enforced in storage rather than in a template;
10. a recorded date of last verification against the Реєстр будівельних норм,
    printed in the disclaimer on every generated act;
11. tenant-isolation tests for every module v0.1 ships;
12. malware/content-type and resource-exhaustion controls for uploads **and
    imports**, including the formula, macro, archive, file-size, worksheet and row
    safety limits of the frozen importer **and export neutralization against
    spreadsheet formula injection** — the workspace export at item 3 is what makes
    the second half a v0.1 obligation rather than a package concern.

Three things this enumeration settles, because the count was being restated four
different ways:

- **items 7 and 8 are two gates, not one.** Merging "secrets and environment
  separation" with "monitored job and message failure paths" is what produced a
  list of twelve that contained only eleven obligations and left room for a
  thirteenth;
- **the export-formula-injection half of item 12 is not optional and is not
  inferable** from a shortened "uploads and imports" wording. It was written down
  because the workspace export makes it v0.1's problem;
- **the retrieval record for the primary ДБН file — exact URL, retrieval date and
  SHA-256, committed under `technical/requirements/` — is not a thirteenth gate.**
  It is what closes **item 9** for every `VERIFIED_PRIMARY` row v0.1 ships: by
  [hidden-works-content-rules.md](../product/hidden-works-content-rules.md)'s own
  vocabulary a source no reviewer can reopen leaves the tag asserted and the
  source gone, and item 9 requires the source. It is recorded as an Open item
  there and closes as evidence under item 9 here.

A document that says "twelve **plus** four", or that reaches sixteen, or that
counts a merged pair as one gate, is contradicting this decision.

Three rules about M0:

- it is numbered **0, not 5.5**, deliberately. It may be built in parallel with
  M1–M5, but it is not allowed to be last;
- **M6 cannot open until M0 is closed**, and closure means recorded evidence
  per item, not a checklist someone has read;
- its owner is the owner. There is one person, so naming anyone else would be
  fiction; what M0 adds is that the absence of an owner can no longer be the
  reason the list is not done.

### 8. The pilot is an object, not a date

The pilot stops being "M6" and becomes a record with required fields. **Every
field below is empty as of 2026-08-06.** M6 does not open until all of them are
filled, and filling them is discovery work, not delivery work.

| Field | What it must contain |
|---|---|
| **Named partner** | One named company, one named object, and one named person who agreed. Not a lead, not a send, not a reply |
| **The технагляд** | Named, and **adversarial** — decision 9 |
| **Success measures** | First-time acceptance rate and days-to-signature (ADR-005 assumption **b**), plus one measure the partner names themselves. If the partner cannot name one, that is a finding to record, not a field to skip |
| **Baseline** | Both measures taken on that object **before the gate is switched on**. Without a pre-gate baseline the pilot cannot show the gate helped, and a pilot that cannot fail cannot succeed |
| **Sample** | How many stages, over what period, on what scope. Written down before the first act, so the sample cannot be chosen after the results are visible |
| **Stopping conditions** | What ends the pilot early, in both directions — the result that says stop building, and the result that says stop measuring and start selling. Named in advance, or the pilot runs until someone gets tired |

The pilot's job is to answer question 2 of
[competitive-landscape.md](../product/competitive-landscape.md) §8 — whether
evidence gaps are even a top-two cause of delayed payment — which ADR-005
records can invalidate the gate itself rather than merely its wording
(ADR-005:738-743).

### 9. The technical supervisor must be adversarial

[ADR-005](ADR-005-readiness-gate-and-hidden-works.md):673-678 left this open,
naming it question 10 of [competitive-landscape.md](../product/competitive-landscape.md)
§8 (line 456) and saying plainly that it decides whether the gate is tested at
all. **This ADR answers it: one pilot with a hostile технагляд, not three with
loyal ones.**

The reasoning is one sentence. A gate is a refusal, a refusal is only observable
when someone wanted to pass, and a client who signs everything never wanted to
pass — so a pilot with a compliant технагляд produces a clean run, a happy
customer, and **no evidence whatsoever about the product's only differentiator**.
That is a false positive, and it is the most expensive kind, because it is
indistinguishable from success until the second customer.

Three consequences, stated so the cost is not discovered later:

- the pilot is **harder to sell**. A subcontractor is being asked to run a new
  tool on their most difficult counterparty. The compensation offered is that
  this is exactly where the tool is worth something;
- the pilot is **more likely to fail**, and that is the point. A refusal that
  the технагляд disputes, escalates, or routes around is the single most
  valuable observation available to this project, and it cannot be obtained from
  a loyal reviewer;
- **failure must be recorded as a result, not as a bug.** If the технагляд
  refuses to open the link, refuses to decide inside it, or demands paper, that
  invalidates A-3 and it is written into
  [validated-assumptions.md](../discovery/validated-assumptions.md) as an
  invalidation, per that document's own rule that a failed assumption is marked
  `Invalidated` and never deleted.

## Relationship to ADR-001, ADR-004, and ADR-005

**ADR-001.** The loop is unchanged in shape and truncated in reach: v0.1 now
runs `contract baseline → assignment and performed quantity → requirements and
evidence → stage closure and act → external evidence decision`, and stops before
`immutable package version → partial acceptance → derived acceptance value at
risk`, which arrive in v0.2. The financial boundary (ADR-001:87-94) is untouched
and is easier to keep, not harder: v0.1 creates no accounting entry, no payment
obligation, and no cross-currency sum. All thirteen deferrals remain deferred.

**ADR-004.** Its six v0.1 milestones (ADR-004:44-53) are superseded by decision
3. Its version gates, product surfaces, mobile decisions, and documentation
migration are untouched — except that "v0.2: pilot hardening" (ADR-004:33) now
also carries the commercial half of the loop, which is a much larger v0.2 than
that line describes.

**ADR-005.** All ten decisions stand. Five are moved into v0.2 by decision 5 of
this ADR — internal review's role in `satisfied(o)`, `is_package_eligible`, the
`witness` and `review` intervention types, `commercial_decision`, and the
corrected precedence — and five amendments are made to how the remaining ones
land in v0.1, listed at decision 4. ADR-005's own protections apply to those
amendments: none makes `hold` markable not-applicable, none allows a manual
override of a derived readiness state, none lets a command filter where ADR-005
says refuse.

**Three narrowings of ADR-005 this ADR makes, recorded because "all ten
decisions stand" would otherwise hide them.** None is a new decision; each is a
consequence of decisions 4 and 5 that ADR-005 does not survive unchanged:

1. **ADR-005's advisory tier becomes unreachable in v0.1.** ADR-005 decision 4
   permits `blocking_scope = none` on any intervention type — "advisory:
   recorded, surfaced, never blocking". With `hold` the only type v0.1 admits
   (4.3) and a v0.1 `hold` required to be `blocks_stage_closure` (4.4), no v0.1
   requirement can carry it. The tier is not cancelled and returns in v0.2; what
   is withdrawn is any v0.1 gate, invariant or acceptance criterion that depends
   on an advisory occurrence existing.
2. **`review`'s pre-start warning moves with `review`, and decision 5's stated
   reason was incomplete.** Decision 5 justifies moving `review` by "its only
   blocking scope is package inclusion". ADR-005 decision 4 also gives it a
   **non-package** consequence — "it raises a pre-start warning in the field
   client" — which is a step-2 behaviour and not a packaging one. That half moves
   too. What v0.1 keeps in its place is ADR-005 decision 2's own requirement,
   which is stronger and client-agnostic: requirement occurrences are
   materialised at assignment creation and are **visible in the field client
   before work starts**. Nothing about the pre-start display is lost; the
   `review`-typed warning is what is deferred.
3. **The witness notice event was v0.1 under ADR-005 and this ADR moves it.**
   Decision 5's row said it was "already v0.2 under ADR-005". That was wrong as
   written and is corrected above: ADR-005 decision 3 §"Witness scope in v0.1"
   and ADR-005 §"Included in v0.1" put the notice **event** — recipients, server
   `sent_at`, configured `required_notice`, server-computed `earliest_proceed_at`
   and recorded non-attendance — in v0.1, and deferred only the statutory
   apparatus. Moving the event is a real change to ADR-005 made here, and it is
   the one narrowing that is not among the five amendments of decision 4.

**The precedence problem, stated rather than dodged.** By
[docs/README.md](../README.md) authority order, product scope and roadmap
(level 4) **outrank ADRs** (level 5) for release contents. An ADR therefore
cannot quietly win against an unedited roadmap. Until
[roadmap.md](../product/roadmap.md), [version-0.1.md](../delivery/version-0.1.md),
[scope-and-boundaries.md](../product/scope-and-boundaries.md),
[entity-catalog.csv](../../technical/database/entity-catalog.csv) and
[scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv) are rewritten against
this ADR, the package is internally contradictory and **no milestone may be
planned from either the roadmap or this document.** Making those edits is a
condition of this decision taking effect, not a follow-up task.

**The five were named too narrowly, and the omission is recorded here rather
than left to be discovered.** The same reasoning reaches further than product
scope and the roadmap: [docs/README.md](../README.md) §"Source of truth" puts
the approved **domain** design at level **2**, two levels above an ADR. An
unedited [docs/domain/](../domain/) document therefore outranks this ADR and
ADR-007 by the package's own rules, on every question it answers — intervention
types, blocking scope, the notice, the act-version pin, and what a field client
guarantees about a pending original. The same is true of
[docs/architecture/](../architecture/) at the same level. So: this ADR does not
win against an un-recut domain or architecture document, and until each of them
carries the re-cut, the contradiction is resolved **against** this ADR and not by
it. That is the reverse of what a reader would assume from an Approved,
later-dated decision, which is exactly why it is written down.

**What "rewritten against this ADR" means, so the condition is checkable rather
than felt.** For the roadmap, version-0.1 and scope-and-boundaries: seven
milestones with M0's twelve gates as decision 7 enumerates them, and no v0.1
capability that decision 5 moved. For
[scope-v0.1.csv](../../technical/openapi/scope-v0.1.csv): no operation belonging
to a moved capability, with the moved rows carried in `scope-v0.2.csv`. For
[entity-catalog.csv](../../technical/database/entity-catalog.csv): every table
this decision builds or changes marked with its milestone, **and no deployed
table tagged to a future version** (decision 4). None of those five is asserted
here to be in that state; each is checked in the document itself.

## Consequences

- **v0.1 ships without the commercial half, so ADR-005's positioning is only
  half delivered.** ADR-005 decision 1 blocks two recorded acts: the closure of
  a hidden or covered stage, and the eligibility of performed quantity to enter
  a package version. **v0.1 ships the first and not the second.** The sentence
  ADR-005:150-153 fixes verbatim — «Ми не блокуємо роботу на майданчику — ми не
  даємо її пред'явити до оплати, поки доказ не отримано і не погоджено» —
  describes a product whose second clause arrives with packages in v0.2. It is
  the main cost of this re-cut and it is stated here so that no product
  document, landing page, or demonstration has to discover it. Until packages
  ship, that sentence may be used only alongside an explicit statement that
  payment-presentation eligibility is not in v0.1, and **no demonstration may
  show a payment-presentation refusal that does not exist.**
- **The buyer gets a signature, not an invoice.** ADR-005 assumption **a** rests
  on the subcontractor buying speed of signature, with Siteline as the surviving
  counter-example. v0.1 delivers a signed act faster; it does not deliver a
  payment application at all. Whether that is enough to pay for is A-7, and A-7
  is unvalidated. This is the sharpest commercial risk the re-cut creates, and
  it is the price of asking the question two milestones earlier than the current
  plan would.
- **Two migrations are owed to v0.2 and must not be forgotten.** Widening every
  v0.1 `hold` from `blocks_stage_closure` to `blocks_both` (decision 4.4), and
  pinning existing act versions to package versions once packages exist
  (decision 4.5). Each needs a test that fails if a v0.1 row is left behind.
  Work recorded during the pilot is the work most likely to be looked at later.
- **v0.2 is now much larger than ADR-004:33 describes.** It carries packages,
  claim segments, the allocation ledger, internal review, partial acceptance,
  the value-at-risk projection, `witness`, `review`, `commercial_decision`, and
  the КЕП and КБ-form work it already had. Calling it "pilot hardening" is no
  longer accurate and that line needs rewriting with the rest.
- **Approved is not deployed.** Seventeen of the twenty-six v0.1 tables have no
  table in any applied migration; the runtime is 33 tables plus migrations
  `0036`–`0040`, which create none. No baseline state is claimed by this
  document. *(Qualified 2026-08-08: those same seventeen now have `create table`
  in migrations `0041`–`0050`, ten files written on an uncommitted branch and
  **applied nowhere**. The sentence above is still exactly right about applied
  history and is no longer right about the tree; having DDL is not existing.)*
- **The evidence for this re-cut is the owner's instruction, not the market.**
  It is a judgement about ordering, made against a discovery ledger that records
  zero replies, zero interviews, and zero customer documents. Ordering
  judgements are cheap to reverse and this one is deliberately the cheapest
  available: everything moved to v0.2 keeps its specification, its DDL, and its
  catalogs intact.
- **A smaller v0.1 makes a wrong answer cheaper, not less likely.** If the pilot
  says the product is not wanted, this re-cut saves roughly the second half of a
  build. If the pilot says it is wanted, the re-cut costs one extra release
  boundary and the two migrations above. That asymmetry is the whole argument.

## Replacement rule

This ADR amends ADR-001 for the second time, supersedes the milestone structure
of ADR-004, and moves five ADR-005 decisions into v0.2 without altering their
text. Changing any of the nine decisions above requires a superseding ADR that
identifies the user evidence, the version impact, the data ownership, the
security impact, and the migration cost.

Five specific protections:

1. **Adding a capability to v0.1 requires an ADR, not a backlog item.** "It is
   already specified", "it is already in the DDL", "the catalog already has the
   row", and "it is only one more table" are each explicitly not reasons. The
   test is decision 1: name the step it is necessary for.
2. **Moving the pilot later requires an ADR.** The pilot's position ahead of the
   commercial half is the substance of this decision; moving it back to the end
   restores exactly the ordering this ADR exists to fix.
3. **Unfreezing import requires the file.** One real sanitized кошторис, АВР, or
   interim-works file, recorded in
   [validated-assumptions.md](../discovery/validated-assumptions.md) with the
   named company and the date. A decision to resume import work without one is a
   decision to build against an assumption, and must say so in writing.
4. **Choosing a loyal технагляд for the first pilot requires an ADR that
   supersedes decision 9** and records what the resulting evidence will not
   prove. Three loyal pilots are not a substitute for one adversarial one, and
   the reason must be written down at the time, not reconstructed after the
   results are in.
5. **M0 cannot be reordered behind M6.** Real customer data entering an
   environment that has not closed M0 is a boundary violation regardless of
   which document or schedule requests it.

No regulatory content changes through this ADR.
[hidden-works-content-rules.md](../product/hidden-works-content-rules.md)
governs every regulatory string without exception, and nothing above adds a
Додаток Н item, a Додаток В field, or a clause number.
