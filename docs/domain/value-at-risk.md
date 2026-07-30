# Acceptance value at risk

**Status:** Approved

**Applies to:** v0.1

**Last reviewed:** 2026-07-30

**Related decisions:** [ADR-001](../decisions/ADR-001-product-boundary.md),
[ADR-003](../decisions/ADR-003-evidence-packages-and-acceptance.md)

## Purpose and boundary

Value at risk (VaR) explains the value of performed, acceptance-relevant,
priced quantity that is not currently accepted.

It is an operational acceptance projection. It is not a receivable, invoice,
payment forecast, accounting balance, or remaining contract value.

Only performed quantity enters this projection. Unperformed contract balance is
reported elsewhere and is not VaR.

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

## State precedence

The projection first partitions effective performed quantity into non-overlapping
**acceptance exposure slices**. Before packaging, a slice is derived from exact
progress sources plus homogeneous location/price/tax/readiness facts. After
packaging, it maps to an active leaf claim segment. No quantity is materialized
twice.

Each in-scope exposure slice belongs to exactly one state:

```text
accepted
→ returned
→ submitted_pending
→ packaged_not_submitted
→ internal_review
→ evidence_blocked
→ ready_not_packaged
```

The arrow is evaluation precedence, not a lifecycle transition.

### 1. Accepted

No required quantity approval covering the exact segment has returned, and for
every required quantity approval there is either current accept coverage or a
valid unchanged prior acceptance reference to that same requirement's original
accepted fact.

Evidence-only return after quantity acceptance creates a compliance exception
but does not move the segment out of accepted.

### 2. Returned

At least one required quantity approval covering the exact segment has returned
it. A quantity return outranks incomplete approvals.

### 3. Submitted pending

The segment is included in a recorded submission, has no required quantity
return, and does not yet have all required quantity accepts.

### 4. Packaged not submitted

The segment belongs to the sole `current_prepared` version selected by the
package scope head and no active submission covers it. Frozen successor
candidates are excluded until the serialized head advance, so they cannot
double-count the current version. The first freeze establishes the initial
current prepared version.

### 5. Internal review

The performed segment is undergoing internal evidence/requirement review and is
not yet ready.

### 6. Evidence blocked

The segment lacks applicable evidence, has current returned internal evidence,
or has an unresolved blocking requirement without a valid exception.

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
     submitted_pending,
     packaged_not_submitted,
     internal_review,
     evidence_blocked,
     ready_not_packaged}

acceptance_var_net(c)
  = sum(state_value_net(c, s) for s in RISK_STATES)

acceptance_var_tax(c)
  = sum(state_value_tax(c, s) for s in RISK_STATES)

acceptance_var_gross(c)
  = acceptance_var_net(c) + acceptance_var_tax(c)
  = sum(state_value_gross(c, s) for s in RISK_STATES)
```

Every API/UI value names `net`, `tax`, or `gross`; an unqualified numeric
`acceptance_var` field is forbidden. Each state component is available
separately. Accepted value is reported alongside, not included in VaR.

Project summary is a list keyed by currency. There is no single cross-currency
total and no implicit FX rate. A later explicitly sourced FX view may be a
separate non-authoritative analysis.

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
- currency and valuation basis;
- stale/error state.

The UI never allows manual aggregate editing. To correct a result, correct the
authoritative progress, price/contract version, allocation, decision, or prior
acceptance fact and recompute. v0.1 cannot reduce an accepted reservation:
disputed accepted quantity is reported as an issue outside VaR until a later
formal reversal/compensation capability exists.

## Required tests

- every effective in-scope segment receives exactly one state;
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
