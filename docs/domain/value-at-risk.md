# Acceptance value at risk

**Status:** Approved

**Applies to:** v0.2, except the v0.1 blocked-money sum described in
§"The v0.1 blocked-money sum"

**Last reviewed:** 2026-08-08

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md),
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md),
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md),
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
>    ([glossary.md](glossary.md) «Work type»), so a work type is validated as *a real one* and not as *the
>    right one*; and an **imported** baseline carries no work type at all, which
>    is permanent for the life of that contract version.
>
> **Neither decision is deployed, and neither is anything else.** Migrations
> `0041`–`0050` are ten files written on an uncommitted branch and **none has
> been applied anywhere**. Against applied history (`0001`–`0040`) the runtime is
> **33 tables**, of which **9** are among the 26 that ADR-006 decision 4 builds
> in v0.1. Nothing in this package may be described as green, verified, or
> confirmed working.


> **Version note (2026-08-06) — read this before any section below.**
> **There is no seven-state value-at-risk projection in v0.1.**
> [ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5 moves it to
> **v0.2** with its currencies, its tax bases and the corrected
> `evidence_blocked` precedence, because five of its seven states — `accepted`,
> `returned`, `submitted_pending`, `packaged_not_submitted` and
> `internal_review` — name packaging, submission or internal review, and none of
> those exists in v0.1. Claim segments, the allocation ledger, commercial
> decisions and prior-acceptance references move with them.
>
> This document was labelled `Applies to: v0.1` until 2026-08-06 and opened by
> declaring every state below «target design for v0.1». Under
> [docs/README.md](../README.md) §"Source of truth" it sits at precedence
> **level 2** — above the ADRs — so that label made a v0.2 projection read as
> v0.1 truth. It is corrected here, and **nothing below is cancelled**: the
> precedence correction stands and applies the moment packages exist.
>
> **What v0.1 has instead is a sum**, described in
> [The v0.1 blocked-money sum](#the-v01-blocked-money-sum). The reporting rules
> that bind in both versions are unchanged: blocked value is exposure and never a
> receivable; it is attributed once per assignment; currencies are never combined;
> missing price, zero price and over-contract performance stay distinct; and
> blocked value is reported beside the headline measures, never as the hero
> number.
>
> **A reading rule for the rest of this document.** Several sentences below still
> say «v0.1» about an object that is now v0.2 — the rounding-scope pin to
> `work_item_version_pool`, the unvalued-slice rule for an unknown tax mode, the
> absence of authority to reduce an accepted reservation, the change-order
> lifecycle. Each is a statement about **the first version that ships the object
> it constrains**, and that version is now v0.2. None of them describes anything
> v0.1 does.
>
> **Approved is not deployed.** The runtime is 33 tables plus migrations
> `0036`–`0040`, which create no table. Requirement occurrences, stage closures,
> `blocked_reasons`, packages, claim segments and external decisions have no
> tables at all, so nothing today computes any number in this document. No
> baseline state or test claim is made here.
>
> *(Qualified 2026-08-08 — «deployed» and «written» have come apart, and every sentence above
> is about the first. All of it is still exactly true of the **applied** migrations, `0001`–`0040`,
> which define 33 tables. Migrations `0041`–`0050` are ten files written on an uncommitted branch and
> **applied nowhere**; between them they carry `create table` for **seventeen of the twenty-six** v0.1
> tables, plus every CHECK, trigger, policy and grant the readiness gate is made of. Having DDL is not
> existing, and none of the ten files has ever been executed.)*

## The v0.1 blocked-money sum

Step 6 of v0.1 is one number and a breakdown by cause
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 1). Precisely:

- **the sum** is the amount of the work lines under a blocked stage, at the price
  on the published baseline, attributed **once per assignment** — several unmet
  requirements on one work reference the same assignment-scoped value and are
  deduplicated by assignment before summing;
- broken down by `blocked_reason.code`;
- summed **within one baseline and never across baselines in different
  currencies**, and never through a hidden exchange conversion;
- **missing price, zero price and over-contract performance stay distinct** and
  are reported beside the sum rather than folded into it;
- drill-down from the summary to the exact contract, work line, stage and
  blocking occurrence — every rendered sum is one tap from the `blocked_reason`
  objects that produced it, and a sum with no reachable drill-down target is a
  projection error;
- **blocked value is exposure, never a receivable.** v0.1 creates no accounting
  entry, no payment obligation and no cross-currency total, so ADR-001's
  financial boundary is untouched and easier to keep, not harder.

It **adds no table**: it is a query over `blocked_reasons` and `work_items`. It
has no state machine, no exposure slices, no claim segments and no allocation
ledger — those are the v0.2 machinery below. The lines it sums are the ones ПТВ
typed by hand in step 1.

Two of the seven cause codes have no v0.1 producer:
`NOTICE_PERIOD_NOT_ELAPSED` needs the notice event and `CLOSED_WITHOUT_ACT` needs
the closure-without-evidence bypass, and both are v0.2. **There is no bypass in
v0.1**, so the bypass bucket, the `bypass_over_accepted` line and the bypass
register described below have no v0.1 form.

**The headline measures are not computable in v0.1.** First-time acceptance rate
and days-to-signature are the pair M6 must report against a pre-gate baseline
(ADR-005 assumption **b**, ADR-006 decision 8), and both are defined only over
claim segments, submissions, package versions and commercial decisions — every
one of them v0.2. (`external_decision_batches` moved into v0.1-M5 on 2026-08-06,
but the measures still name four v0.2 objects, so neither is computable in v0.1.)
Whether either is computed
inside the product or recorded beside it from the partner's own records is
**unsettled**, and the project holds zero customer documents from which a
baseline could be taken. Until it is settled, **M6 does not open**. This document
does not invent a v0.1 definition; see
[glossary.md](glossary.md).

## Purpose and boundary

Value at risk (VaR) explains the value of performed, acceptance-relevant,
priced quantity that is not currently accepted.

It is an operational acceptance projection. It is not a receivable, invoice,
payment forecast, accounting balance, or remaining contract value. Blocked value
is exposure, never a receivable
([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md), Untouched).

Only performed quantity enters this projection. Unperformed contract balance is
reported elsewhere and is not VaR.

This projection is also the reporting surface of the readiness gate. The gate
refuses two recorded acts — the closure of a hidden or covered stage, and the
eligibility of performed quantity to enter a package version — and never refuses
to record a fact. **v0.1 ships the first refusal and not the second**
([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5), so until
packages ship the positioning sentence «Ми не блокуємо роботу на майданчику — ми
не даємо її пред'явити до оплати…» may be used only alongside an explicit
statement that payment-presentation eligibility is not in v0.1, and no
demonstration may show a payment-presentation refusal that does not exist. Money
whose scope the gate has refused is always present in the reporting surface of
its own version; it is never absent, and it is never silently reclassified as
something more comfortable.

**Reporting hierarchy.** Blocked value is reported *beside* first-time
acceptance rate and days-to-signature, never as the headline number
([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md), assumption
**b**). That is an owner assumption the owner may reverse; the projection
supports either framing without change, because both derive from the same states
and the same canonical minor units. **Neither headline measure has a v0.1
definition** — see the version note above.

**Approved is not deployed.** Every state, decomposition, and identity below is
**v0.2** target design. Requirement occurrences, stage closures, packages, claim
segments, and external decisions have no tables in the current runtime.

*(Qualified 2026-08-08 — «deployed» and «written» have come apart, and every sentence above
is about the first. All of it is still exactly true of the **applied** migrations, `0001`–`0040`,
which define 33 tables. Migrations `0041`–`0050` are ten files written on an uncommitted branch and
**applied nowhere**; between them they carry `create table` for **seventeen of the twenty-six** v0.1
tables, plus every CHECK, trigger, policy and grant the readiness gate is made of. Having DDL is not
existing, and none of the ten files has ever been executed.)*

## Canonical valuation inputs

Every published work item pins:

- canonical quantity unit and precision;
- contract quantity;
- unit price state: known, zero, or missing;
- unit price decimal and price basis: net or gross where known;
- canonical valuation basis: unit-price-derived or approved-source-amount,
  including which net/gross component is primary;
- currency;
- tax mode: exclusive, inclusive, exempt, out-of-scope, or unknown;
- tax rate where applicable;
- currency minor-unit precision;
- contract rounding policy, including decimal price precision, currency
  minor-unit precision, midpoint mode, signed-value behavior, tax calculation
  base/order, and rounding scope;
- source mismatch tolerance in absolute minor units and relative basis points;
- source amount and any approved discrepancy resolution.

Import publication blocks an unexplained material mismatch between source amount
and quantity × unit price. The chosen canonical basis and original source values
are both retained.

Calculations use arbitrary-precision decimal arithmetic. Binary floating point
is forbidden for canonical money.

v0.1 pins rounding scope to `work_item_version_pool`. Negative adjustments
release/reference monetary allocation from their original progress lineage;
they are never independently rounded as a new negative sale. A source mismatch
outside either pinned tolerance requires an explicit resolution with actor,
reason, chosen basis, and original values before publication.

Canonical compatibility is explicit:

| Tax mode | Canonical price basis | Rule |
|---|---|---|
| exclusive | net | Tax is added to canonical net |
| inclusive | gross | Net and tax are extracted from canonical gross |
| exempt / out-of-scope | net or gross | Tax is zero; canonical net equals gross |
| unknown | none | Whole slice is numerically unvalued |

`gross + exclusive` and `net + inclusive` source combinations cannot be
published directly. Mapping or discrepancy resolution must normalize them to a
compatible canonical basis while retaining the original source labels/values.

## Work-item and package-line totals

For a known unit-price-derived basis:

```text
unit_price_derived_raw = contract_quantity × unit_price
primary_pool_amount = round(unit_price_derived_raw, pinned policy)
```

If an authorized discrepancy resolution instead selects
`approved_source_amount`, that exact approved minor-unit amount becomes
`primary_pool_amount`; `quantity × unit_price` remains visible provenance but is
not silently used. The resolution pins whether the approved amount is net or
gross and must satisfy the compatibility table above.

From the primary pool amount, the contract tax/rounding policy produces the
canonical work-item valuation pool:

- `net_amount`;
- `tax_amount`;
- `gross_amount = net_amount + tax_amount`.

For exclusive tax, tax derives from rounded/unrounded base according to the
pinned policy. For inclusive tax, net and tax are derived from gross according
to the pinned policy. Exempt/out-of-scope has zero tax with a non-tax reason.
Unknown tax basis blocks monetary aggregation rather than guessing.

The pool includes the full within-contract quantity. Its money is partitioned
through an append-only valuation-allocation lineage as progress quantities split
from the remaining unperformed scope. This gives every performed exposure slice
stable canonical minor units and prevents repeated claim-level rounding.

```text
work_item_pool_quantity
  = unperformed_pool_quantity
  + sum(within_contract exposure-slice quantities)

work_item_pool amounts
  = unperformed_pool amounts
  + sum(exposure-slice amounts)
```

When quantity is performed, the transaction splits the current unperformed
pool using exact decimal ratios, the coupled allocation rule below, and stable
lineage order. A package line sums the already allocated canonical amounts of
its exact exposure slices; it does not recalculate `quantity × unit_price`.
Claim segments then partition those package-line amounts. Consequently two
quantity-1 claims at unit price `0.005` allocate from the one-cent canonical
quantity-2 pool instead of independently becoming two cents.

Reports in one currency show net, tax, and gross separately. They never sum
values that lack a compatible tax basis.

If tax mode is `unknown`, the whole exposure slice is numerically unvalued in
v0.1—even if one source component appears known—until the tax classification
is resolved. This avoids presenting net/gross components that cannot reconcile.

## Segment allocation and rounding

Segment value is allocated from canonical parent/line minor units, not computed
as independently rounded fragments that may drift.

The algorithm never allocates net, tax, and gross independently:

1. calculate each child exact share from canonical quantity ratio;
2. for net-priced/exclusive scope, allocate parent net and tax minor units, then
   derive each child gross as `net + tax`;
3. for gross-priced/inclusive scope, allocate parent gross and tax minor units,
   then derive each child net as `gross - tax`;
4. for exempt/out-of-scope scope, allocate the pinned primary component, set
   tax to zero, and derive the other component;
5. for each allocated component, assign floor minor units and distribute the
   remainder by largest remainder with stable lineage identifier tie-break;
6. assert every child has `gross = net + tax` and all child components reconcile
   to the parent.

When a segment is partitioned, its net, tax, and gross minor units are
partitioned in the same transaction as quantity and decision.

This rule applies recursively, so any descendants reconcile to the original
line total.

## State precedence — v0.2

The projection first partitions effective performed quantity into non-overlapping
**acceptance exposure slices**. Before packaging, a slice is derived from exact
progress sources plus homogeneous location/price/tax/readiness facts. After
packaging, it maps to an active leaf claim segment. No quantity is materialized
twice.

Each in-scope exposure slice belongs to exactly one state:

```text
accepted
→ returned
→ evidence_blocked
→ submitted_pending
→ packaged_not_submitted
→ internal_review
→ ready_not_packaged
```

The arrow is evaluation precedence, not a lifecycle transition.

### Why the previous ordering was wrong

Until 2026-08-05 this list ranked `packaged_not_submitted` fourth and
`evidence_blocked` sixth. First match wins, so a slice that was both packaged and
blocked reported as `packaged_not_submitted` — and its blocker disappeared. Not
merely from the headline: from the state totals, from every per-state
drill-down, and from the package summary. The reader saw money waiting for a
signature. The truth was money that could not lawfully be presented at all, for
a reason nobody was being shown. The report actively suppressed the one fact the
product exists to surface.

The ordering also asserted something about the domain. **Precedence between two
disjoint states is a claim that their combination is reachable** — an
unreachable combination has no tie to break. Ranking packaging above blocking
therefore specified the reporting semantics for "unready scope was packaged
anyway", which
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) decision 7
makes impossible to create: package freeze **refuses** ineligible scope with a
per-segment reason list instead of relying on the compiler to filter it out
silently.

Two residual paths keep the combination reachable, and both are the reason
`evidence_blocked` must win it:

- scope packaged **before** the readiness gate is implemented — which is all
  scope today, because the gate is an approved target and nothing in it is
  deployed;
- evidence invalidated **after** a freeze: a returned evidence decision, a
  pinned evidence object that leaves the `available` state, or an exception
  revoked on scope already inside a frozen version.

In both, "blocked" is the actionable truth and the packaging fact is the less
useful one. The packaging fact is not lost: the slice keeps its package lineage,
and the frozen version reports it in its own «виключені позиції та підстави»
appendix.

Ranks 1 and 2 do not move. `accepted` stays first because ADR-003's rule is
unchanged — evidence return after quantity acceptance creates a compliance
exception and does not move money. `returned` stays second because an external
decision on quantity is a decided fact and outranks an internal one.

Restoring `evidence_blocked` below the packaging states is a boundary change
requiring a superseding ADR, not a backlog item
([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md), Replacement
rule). Where the enumerated list in
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md) "Value at
risk" still shows the old order, ADR-005 decision 8 governs.

**The correction moves with the projection.**
[ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md) decision 5 defers the
seven-state projection and its precedence to v0.2: with no packaging states there
is nothing to rank. The correction stands and applies the moment packages exist —
which also means the first of the two residual paths above, "scope packaged
before the readiness gate is implemented", cannot arise in v0.1, because v0.1
packages nothing.

### 1. Accepted

No required commercial approval covering the exact segment has returned, and for
every required commercial approval there is either current accept coverage or a
valid unchanged prior acceptance reference to that same requirement's original
accepted fact.

Evidence-only return after quantity acceptance creates a compliance exception
but does not move the segment out of accepted. The same holds for an uncleared
closure-without-evidence fact discovered over already-accepted scope: the
segment stays `accepted`, and the exposure is reported as a compliance exception
outside VaR (see "The bypass bucket"). v0.1 has no authority to reduce an
accepted reservation, and inventing one through a projection is not that
authority.

### 2. Returned

At least one required commercial approval covering the exact segment has returned
it. A quantity return outranks incomplete approvals.

A quantity return is a `commercial_decision`
([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) decision 9).
An `evidence_decision` that returns is **not** a quantity return: it produces
`evidence_blocked` with the applicable cause code, never `returned`. Which one
applies follows the decision kind actually recorded, never the wording of the
letter that carried it — a «мотивована відмова» may be recorded as either, and
the projection reads the fact, not the prose.

### 3. Evidence blocked

The segment has at least one requirement occurrence, applicable to its scope and
carrying `blocking_scope ∈ {blocks_package_inclusion, blocks_both}`, that is not
satisfied; or has a current returned internal evidence decision; or has a pinned
evidence object that is not in state `available`; or is covered by an uncleared
closure-without-evidence fact.

Satisfaction is the `satisfied(o)` predicate of
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) decision 7.
This projection does not define a second one. In particular:

- a current exception head of kind `waiver` or `accept_risk` satisfies an
  occurrence and removes it as a cause. The exception stays visible on the
  segment and prints in the package manifest; it is not a way to make the money
  look unblocked quietly;
- `not_applicable` cannot satisfy an occurrence whose `intervention_type` is
  `hold`, so it can never remove a `hold` cause;
- a `witness` occurrence whose notice period has not elapsed is unsatisfied, and
  its cause is `NOTICE_PERIOD_NOT_ELAPSED` — a block that clears by the clock is
  still a block.

Every slice in this state carries at least one `blocked_reason` object
(decision 6). A slice in `evidence_blocked` with no reason object is a
projection error, not a rounding detail: it is a sum with nothing to point at.

### 4. Submitted pending

The segment is included in a recorded submission, has no required quantity
return, and does not yet have all required quantity accepts.

### 5. Packaged not submitted

The segment belongs to the sole `current_prepared` version selected by the
package scope head and no active submission covers it. Frozen successor
candidates are excluded until the serialized head advance, so they cannot
double-count the current version. The first freeze establishes the initial
current prepared version.

### 6. Internal review

The performed segment is undergoing internal evidence/requirement review and is
not yet ready.

### 7. Ready not packaged

The segment is internally ready but not allocated to a frozen package.

Any performed scope that cannot enter exactly one state is a projection error
and must not be silently omitted.

## Monetary definitions

For currency `c` and state `s`:

```text
state_value_net(c, s)
  = sum(segment_net_minor_units)

state_value_tax(c, s)
  = sum(segment_tax_minor_units)

state_value_gross(c, s)
  = state_value_net(c, s) + state_value_tax(c, s)
```

The acceptance VaR for currency `c` is a three-component result:

```text
RISK_STATES
  = {returned,
     evidence_blocked,
     submitted_pending,
     packaged_not_submitted,
     internal_review,
     ready_not_packaged}

acceptance_var_net(c)
  = sum(state_value_net(c, s) for s in RISK_STATES)

acceptance_var_tax(c)
  = sum(state_value_tax(c, s) for s in RISK_STATES)

acceptance_var_gross(c)
  = acceptance_var_net(c) + acceptance_var_tax(c)
  = sum(state_value_gross(c, s) for s in RISK_STATES)
```

`RISK_STATES` membership is unchanged: the same six states, listed here in the
corrected precedence order for readability. The reordering changes which state a
slice lands in, never which states are summed.

Every API/UI value names `net`, `tax`, or `gross`; an unqualified numeric
`acceptance_var` field is forbidden. Each state component is available
separately. Accepted value is reported alongside, not included in VaR.

Project summary is a list keyed by currency. There is no single cross-currency
total and no implicit FX rate. A later explicitly sourced FX view may be a
separate non-authoritative analysis.

## Blocked value by cause — v0.2

A single number labelled «заблоковано» is not actionable, and a gate is worth
exactly what can be pointed at in a meeting with the general contractor. The
decomposition below is that surface: **per currency, per cause, and one tap from
any sum to the specific unmet requirement.** It decomposes the
`evidence_blocked` state only; the other six states are not decomposed by cause.

**The v0.1 sum carries the same discipline over different objects**: it is broken
down by `blocked_reason.code`, deduplicated once per assignment, kept inside one
baseline and one currency, and drillable to the exact blocking occurrence. What
v0.1 does not have is an exposure-slice partition, a state to decompose, or the
bypass code — so the additive/non-additive pair, the primary-cause precedence and
the bypass bucket below are v0.2 machinery. The **cause labels** in the next
table are product interface strings and are usable in v0.1 for the five codes a
v0.1 record can carry.

### Cause vocabulary

Causes are the `blocked_reason.code` vocabulary of
[ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) decision 6.
The vocabulary is closed and versioned: a projection result names the vocabulary
version it was computed under, and an unrecognised code is a projection error,
not an "other" bucket.

| Code | Render label | Cleared by |
|---|---|---|
| `CLOSED_WITHOUT_ACT` | «закрито без акта (обхід гейта)» | an internal-reviewer clearance naming substitute evidence |
| `CUSTOMER_MOTIVATED_REFUSAL` | «мотивована відмова замовника» | a later accepting evidence decision on the same occurrence |
| `SUPERVISION_SIGNATURE_MISSING` | «немає підпису технагляду» | the named approver role deciding |
| `ACT_NOT_SIGNED` | «не підписано акт на закриття прихованих робіт» | all three typed signatory slots satisfied on the act version |
| `TEST_REPORT_MISSING` | «немає протоколу випробувань» | the required evidence linked, available, and accepted |
| `MATERIAL_CERTIFICATE_MISSING` | «немає сертифіката на матеріал» | the required evidence linked, available, and accepted |
| `NOTICE_PERIOD_NOT_ELAPSED` | «строк повідомлення не сплив» | elapse of the server-computed `earliest_proceed_at`, or attendance with an accepting decision |

These labels are **product interface strings, not normative citations**. They
assert no clause number, no form field, and no Додаток Н item. The statutory
form title stays «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ» wherever the form itself is
named, and every regulatory string the product displays remains governed by
[hidden-works-content-rules.md](../product/hidden-works-content-rules.md).

ADR-005 fixes these seven codes as the **minimum** vocabulary. Adding a code is
a vocabulary version bump and must give the new code a position in the
primary-cause precedence below **in the same change** — a code with no position
cannot be attributed, and an unattributable code silently breaks the additive
partition.

### Two views, one of which is additive

A blocked slice usually has more than one cause. Reporting a per-cause table
that quietly counts such a slice several times inflates the very number the
product will be judged on, so both views are defined and only one of them may be
summed.

1. **`blocked_value_by_cause` — the additive partition.** Each blocked slice is
   attributed to exactly one **primary cause**, chosen by the fixed precedence
   below. Summing this view across causes reproduces the state total exactly.
2. **`blocked_value_affected_by_cause` — the non-additive view.** A slice
   appears under every distinct cause code currently blocking it. This answers
   "how much money does the missing test report touch", which is the question a
   call to the laboratory or the supplier is actually about. Every render labels
   it non-additive; it is never summed into a headline and never feeds VaR.

Primary-cause precedence, first match wins:

```text
CLOSED_WITHOUT_ACT
→ CUSTOMER_MOTIVATED_REFUSAL
→ SUPERVISION_SIGNATURE_MISSING
→ ACT_NOT_SIGNED
→ TEST_REPORT_MISSING
→ MATERIAL_CERTIFICATE_MISSING
→ NOTICE_PERIOD_NOT_ELAPSED
```

The order runs from the cause that must never be hidden behind a routine one, to
the cause that resolves without anyone acting. A bypass is an integrity fact and
outranks everything. A counterparty refusal and a missing approver decision need
a named person outside or above the crew. The document causes need the crew. A
notice period clears by the clock alone and comes last.

**ADR-005 does not fix this order.** It fixes the code vocabulary (decision 6)
and forbids an eighth state for bypass (decision 8); the precedence above is
this document's choice. It may be changed without a superseding ADR provided
both views keep their reconciliation rules, and provided `CLOSED_WITHOUT_ACT`
stays first — moving it would let a bypass be reported as a missing certificate.

### Deduplication

Two separate mechanisms, and confusing them is how a blocked headline gets
inflated:

- **across states**, the exposure-slice partition already guarantees each slice
  belongs to exactly one state, so no money is counted twice by state;
- **across causes**, blocked value is attributed **once per assignment**
  ([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md)
  decision 6). Several unmet occurrences on one work reference the same
  assignment-scoped value, and both views deduplicate by `(assignment, slice)`
  before summing. Three missing requirements on one work never produce three
  times the money — in the additive view the slice is counted once under its
  primary cause; in the non-additive view it is counted **once per distinct
  code**, never once per occurrence.

### Drill-down contract

Every rendered blocked sum is one tap from the list of `blocked_reason` objects
that produced it, each naming `requirement_occurrence_id`, `rule_version_id`,
`missing_evidence[]` by evidence kind and acceptance criterion,
`awaiting_approver_role`, `since`, and `blocked_value_by_currency`. `since`
supports an age column, which is what turns the list into a queue.

A rendered sum with no reachable drill-down target is a projection error. This
is the same rule as "a slice in `evidence_blocked` carries a reason object",
stated from the reader's side.

### The bypass bucket — v0.2

**There is no bypass in v0.1** ([ADR-006](../decisions/ADR-006-pilot-shaped-v0.1.md)
decision 4): the bypass is priced in package ineligibility, and in a version with
no packages that price is zero. `CLOSED_WITHOUT_ACT`, the bypass bucket, the
`bypass_over_accepted` compliance line and the bypass register therefore have no
v0.1 form. The v0.1 escape is the ADR-005 exception — an attributed, visible
`waiver` or `accept_risk` — and an exception is **not** a bypass and is never
reported as one.

A closure recorded without evidence is a first-class append-only fact, and its
consequence is that the money waits
([ADR-005](../decisions/ADR-005-readiness-gate-and-hidden-works.md) decision 5).
`CLOSED_WITHOUT_ACT` is a cause code inside `evidence_blocked`, **not an eighth
state** (decision 8) — but it is reported as its own named bucket, because a
bypass folded into a general blocked total is a bypass nobody will find.

```text
bypass_exposure_net(c)
  = sum(segment_net_minor_units)
    over slices in evidence_blocked whose primary cause
    is CLOSED_WITHOUT_ACT

bypass_exposure_tax(c)   -- same slices, tax minor units
bypass_exposure_gross(c) = bypass_exposure_net(c) + bypass_exposure_tax(c)
```

Because `CLOSED_WITHOUT_ACT` is first in the primary-cause precedence, this
bucket is exactly the value covered by uncleared closure-without-evidence facts.
The two definitions cannot diverge, which is why the precedence position is
load-bearing rather than cosmetic.

Reported with the money, from the frozen fact and never recomputed:

- the count of uncleared unevidenced closures;
- for each, the actor and the **claimed authority** under which they acted;
- the mandatory reason code and text, and the expected remedy;
- the exact set of unmet requirement occurrences **as frozen at closure time**;
- the age of the closure.

Rules:

- the bucket is a **subset** of `evidence_blocked`, never a summand beside it. A
  report that adds bypass exposure to VaR double-counts;
- an internal clearance removes the slice from the bucket and does **not**
  delete the closure fact. The register keeps cleared closures with their
  clearance reference and substitute evidence, so the count of bypasses ever
  recorded never decreases;
- **the bucket does not disappear when the money is accepted.** Accepted scope
  covered by an uncleared bypass stays in state `accepted` (rank 1) and is
  reported on a separate `bypass_over_accepted` line as a compliance exception,
  outside VaR and outside this bucket. It is never added to any risk total, and
  it is never dropped from the report;
- the bucket appears in every frozen package version as a named appendix beside
  «виключені позиції та підстави», with its value by currency.

### Reconciliation of the decomposition

For every currency `c` and every component `k ∈ {net, tax, gross}`:

```text
sum(blocked_value_by_cause_k(c, cause) for cause in CAUSES)
  = state_value_k(c, evidence_blocked)

blocked_value_affected_by_cause_k(c, cause)
  ≥ blocked_value_by_cause_k(c, cause)          for every cause

bypass_exposure_k(c)
  = blocked_value_by_cause_k(c, CLOSED_WITHOUT_ACT)
  ≤ state_value_k(c, evidence_blocked)
```

The decomposition allocates already-allocated canonical minor units. It never
recalculates `quantity × unit_price`, never re-rounds, and never splits a
component independently of the others — the segment allocation rules above are
the only source of a slice's net, tax, and gross.

Slices whose price state is `missing` are `unvalued`, not zero, in this
decomposition exactly as in every other total: they appear in the cause register
and the bypass register by quantity and count, with their reason objects, and
they stay out of every numeric sum.

## Missing and zero price

### Missing price

- price state is `missing`;
- quantity remains in its workflow state;
- monetary component is `unvalued`, not zero;
- quantity and reason appear in an unvalued register;
- it is excluded from numeric VaR totals;
- UI must not display `0` or silently use a source amount/other contract rate.

### Zero price

- price state is `zero`;
- quantity receives a known monetary value of zero;
- it participates in reconciliation and state counts;
- UI labels it as contractually zero-priced.

## Over-contract exposure

Effective performed quantity above the approved contract baseline is not
silently valued at the work item's contract rate.

Report separately:

- over-contract quantity by work item/unit;
- whether a formally approved adjustment exists;
- explicitly approved over-contract price, if any;
- otherwise `unapproved_unvalued_exposure`.

Over-contract exposure is excluded from acceptance VaR until an approved
contract/change boundary supplies authoritative quantity and valuation.

That exclusion is unchanged, and it removes the *value* from VaR, never the
*fact*: an unevidenced closure covering over-contract scope is still recorded,
still counted in the bypass register, and still printed in the manifest
appendix, with its money shown as `unapproved_unvalued_exposure` rather than as
blocked value.

v0.1 does not implement the full change-order lifecycle.

## Reconciliation identities

For each package line:

```text
line_claim_quantity
  = sum(active leaf claim-segment quantities)

parent_segment_quantity
  = sum(active child-segment quantities)

line_net_minor_units
  = sum(active leaf segment net minor units)

line_tax_minor_units
  = sum(active leaf segment tax minor units)

line_gross_minor_units
  = line_net_minor_units + line_tax_minor_units

for every active leaf segment:
segment_gross_minor_units
  = segment_net_minor_units + segment_tax_minor_units
```

For each contract work item:

```text
effective_performed
  = unclaimed_within_contract
  + active_claimed_within_contract
  + over_contract_quantity
```

No active progress-source allocation may be counted twice.

## Projection freshness and correction

Every projection result identifies:

- source watermark or transaction position;
- calculated-at time;
- algorithm version;
- state precedence version and blocked-cause vocabulary version;
- currency and valuation basis;
- stale/error state.

Recomputation is triggered by a new or corrected quantity entry, a change in a
requirement occurrence's satisfaction, a new rule-version binding, an exception
appended or revoked, a package claim or withdrawal, an external decision, an
unevidenced closure, and its clearance.

The UI never allows manual aggregate editing. A derived state is never an
editable status column: no override marks a blocked segment ready, and no manual
edit clears a cause. To correct a result, correct the authoritative progress,
price/contract version, allocation, decision, exception, or prior acceptance
fact and recompute. v0.1 cannot reduce an accepted reservation: disputed
accepted quantity is reported as an issue outside VaR until a later formal
reversal/compensation capability exists.

## Required tests

**The v0.1 tests** are the subset that can be written against objects v0.1
builds: per-assignment deduplication in the sum; currency separation with no
implicit cross-currency total; missing price never becoming zero; zero price
remaining a known valued state; over-contract quantity never inheriting the
contract price silently; every rendered blocked sum reaching its `blocked_reason`
objects; and the sum reconciling to the blocked stages. Everything below that
names a state, a segment, a package, a submission, an acceptance or a bypass is
**v0.2**, and a test written against the v0.1 shape of those objects is a test
against something that does not exist.

- every effective in-scope segment receives exactly one state;
- a segment that is both packaged and evidence blocked reports
  `evidence_blocked`, and its package lineage remains visible on the slice;
- a segment that is both submitted and evidence blocked reports
  `evidence_blocked`;
- a segment that is both accepted and covered by an uncleared unevidenced
  closure reports `accepted`, appears on the `bypass_over_accepted` compliance
  line, and contributes to no risk total;
- the primary-cause partition sums to `state_value(c, evidence_blocked)` for
  net, tax, and gross, in every currency;
- the affected-by-cause view is at least the primary partition for every cause
  and is never summed into a headline or into VaR;
- three unmet occurrences on one assignment produce that assignment's value once
  in both views;
- one slice blocked by two occurrences carrying the same cause code appears once
  under that code in the affected-by-cause view;
- an occurrence satisfied by a current `waiver` or `accept_risk` exception is
  not a cause, and revoking the exception restores it;
- a `not_applicable` exception never satisfies a `hold` occurrence and therefore
  never removes that cause;
- a slice in `evidence_blocked` without a `blocked_reason` object is a
  projection error;
- an unrecognised cause code is a projection error and never falls into an
  "other" bucket;
- `bypass_exposure` equals the primary-cause value of `CLOSED_WITHOUT_ACT` and
  is never added to VaR beside `evidence_blocked`;
- clearing an unevidenced closure removes the slice from the bypass bucket,
  leaves the closure fact intact, and does not decrease the recorded count;
- an evidence decision that returns never produces state `returned`;
- unvalued blocked quantity appears in the cause and bypass registers by
  quantity and count and enters no numeric total;
- evidence-only return cannot change quantity state/value;
- multi-approver return/accept/pending combinations follow precedence;
- prior acceptance requires unchanged scope;
- prior acceptance is requirement-specific and cannot bypass another required
  approver;
- accepted quantity cannot be reduced by progress correction or evidence return
  in v0.1;
- child quantity and all monetary components reconcile to parent;
- both reviewer orders around a partial partition produce identical leaf
  coverage and acceptance;
- a second/conflicting decision for the same requirement and overlapping scope
  is rejected;
- property tests cover decimal quantities and repeated partitions;
- allocation never rounds the same work-item quantity independently by package
  line;
- net-basis and gross-basis partitions preserve `gross = net + tax` for every
  child, including largest-remainder ties;
- inclusive/exclusive/exempt tax examples reconcile;
- missing price never becomes zero;
- zero price remains a known valued state;
- over-contract quantity never inherits contract price silently;
- multiple currencies never produce one implicit total;
- source amount discrepancy blocks publication until explicit resolution;
- both unit-price-derived and approved-source-amount pools reconcile under the
  pinned canonical basis;
- projection retry from the same source watermark is deterministic.
