import type { TaxMode } from "./money";

export type UnitPriceState = "known" | "zero" | "missing";
export type ValuationBasis = "unit_price_derived" | "approved_source_amount";
export type UnvaluedReason = "unknown_tax_basis" | "missing_unit_price";

export interface PoolAmounts { net: bigint; tax: bigint; gross: bigint }

export interface WorkItemValuation {
  /** Canonical work-item pool in minor units (work_items.*_amount_minor_units). */
  pool: PoolAmounts;
  /** work_items.contract_quantity as a scaled bigint at scale 6. */
  contractQuantity: bigint;
  taxMode: TaxMode;
  unitPriceState: UnitPriceState;
  valuationBasis: ValuationBasis;
}

/**
 * State the allocator needs, all of it read under the work-item row lock.
 *
 * Two levels, because money is carved at work-item level but RETURNED at root
 * level. Without the root figures a correction cannot know what its own lineage
 * was actually given, and can hand back money a different root received.
 */
export interface AllocationState {
  /** Quantity performed across the whole work item before this entry, scale 6. */
  workItemPerformed: bigint;
  /** Minor units already allocated across the whole work item. */
  workItemAllocated: PoolAmounts;
  /**
   * Effective quantity of THIS entry's root before this entry, scale 6 — every
   * entry of the lineage, admitted or not.
   *
   * Read by TWO things, and until 2026-08-08 by one. The guard that refuses a
   * correction driving the root below zero, which is a question about
   * MEASUREMENT and has always wanted the unfiltered figure. And, from
   * 2026-08-08, the lineage ceiling in the positive branch — `rootQuantity +
   * delta` is the total the deferred trigger will compare the lineage's funded
   * quantity against at COMMIT, so the ceiling must be built from exactly the
   * same rows or it would bound the wrong number.
   *
   * It is still deliberately NOT the denominator of a carve, and that is the
   * distinction the old wording («not the denominator of anything») was reaching
   * for and overshot. A measurement nobody has admitted has no claim on the
   * pool, so it may not enlarge anyone's slice; see `rootAdmittedQuantity`. A
   * CEILING is the opposite direction — it can only make a slice smaller — so
   * counting unadmitted quantity in it cannot spend anything.
   */
  rootQuantity: bigint;
  /**
   * The part of that quantity which has been ADMITTED — i.e. whose entries hold
   * an allocation — scale 6.
   *
   * ADR-008 made this a different number from `rootQuantity`, and before it they
   * were the same one: every entry drew its allocation the moment it was
   * recorded, so «measured» and «admitted» named one set and no caller could
   * tell them apart. After ADR-008 an increase against an admitted root writes
   * no allocation and waits for the next closure, and the two diverge by exactly
   * that waiting quantity.
   *
   * The negative branch needs THIS figure and not `rootQuantity`: unadmitted
   * quantity is not unfunded headroom a correction may consume, it is quantity
   * the pool has not been asked about yet. Spending it as headroom spends it
   * twice — the sequence is worked through at the negative branch below.
   */
  rootAdmittedQuantity: bigint;
  /**
   * The part of the admitted quantity which actually drew money, scale 6.
   *
   * Differs from rootAdmittedQuantity once a root crosses the contract quantity:
   * the over-contract remainder is performed but unfunded. A correction has to
   * know the difference, or it returns money the root never received. This
   * cannot be derived after the fact, because each carve takes from the pool
   * remaining at that moment and money-per-unit is not constant.
   */
  rootFundedQuantity: bigint;
  /**
   * Quantity that the CALLER has already queued for removal from this lineage
   * BEHIND this entry and has not applied yet, as a non-negative figure, scale
   * 6. Zero for every caller that writes one row and then returns.
   *
   * Added 2026-08-08 with the lineage ceiling in the positive branch below,
   * which is where the whole justification for it lives. In one sentence: a
   * transaction that will admit a root and then its own `−4` a statement later
   * is momentarily allowed to fund the root's full 10, and a transaction that
   * has nothing queued behind it is not. Without this figure the ceiling cannot
   * tell those two apart, and clamping both would forbid the intermediate state
   * `app.assert_funded_within_lineage()` is DEFERRED in order to allow
   * (migration 0048 §3, «between those two statements the sum IS 10 against an
   * effective 6»).
   *
   * It is the caller's because only the caller knows its own queue.
   * `apps/app/src/lib/admission.ts` computes it from the pending list it just
   * ordered; nothing in the persisted state distinguishes «a removal that will
   * land in this transaction» from «a removal nobody has recorded».
   */
  queuedRemovalQuantity: bigint;
  /** Minor units already allocated to THIS entry's root. */
  rootAllocated: PoolAmounts;
}

export interface SliceResult {
  amounts: PoolAmounts;
  /** Signed change to the root's funded quantity, scale 6. */
  fundedQuantity: bigint;
}

export const ZERO: PoolAmounts = { net: 0n, tax: 0n, gross: 0n };

/**
 * Whether this work item's money is knowable at all, and why not when it isn't.
 *
 * The pool numbers alone cannot answer this. M1's publish writes
 * `mp.net ?? "0"` into the pool columns
 * (apps/app/app/v1/import-batches/[batchId]/publish/route.ts:200) and those
 * columns are NOT NULL, so a work item whose money is unknown carries a pool of
 * 0 — indistinguishable by value from work that is genuinely free. The
 * qualifying facts are the only way to tell the two apart, and INV-038 needs
 * that distinction preserved at write time.
 */
export function unvaluedReason(w: WorkItemValuation): UnvaluedReason | null {
  if (w.taxMode === "unknown") return "unknown_tax_basis";
  if (w.valuationBasis === "unit_price_derived" && w.unitPriceState === "missing") {
    return "missing_unit_price";
  }
  return null;
}

/**
 * Which two components are allocated, and how the third is derived.
 * `gross = net + tax` therefore holds for every slice by construction.
 */
type Coupling = "net_tax" | "gross_tax" | "gross_only";

function coupling(taxMode: TaxMode): Coupling {
  switch (taxMode) {
    case "exclusive": return "net_tax";
    case "inclusive": return "gross_tax";
    case "exempt":
    case "out_of_scope": return "gross_only";
    default: throw new Error(`valuation: unsupported tax mode ${taxMode}`);
  }
}

function assemble(c: Coupling, a: bigint, b: bigint): PoolAmounts {
  switch (c) {
    case "net_tax":   return { net: a, tax: b, gross: a + b };
    case "gross_tax": return { net: a - b, tax: b, gross: a };
    case "gross_only": return { net: a, tax: 0n, gross: a };
  }
}

function componentsOf(c: Coupling, p: PoolAmounts): [bigint, bigint] {
  switch (c) {
    case "net_tax":   return [p.net, p.tax];
    case "gross_tax": return [p.gross, p.tax];
    case "gross_only": return [p.gross, 0n];
  }
}

/**
 * Splits `total` minor units between a carved slice of `q` and the leftover
 * `denom - q`, by floor plus largest remainder.
 *
 * The leftover is the unperformed pool, which has no lineage identifier to
 * tie-break against, so an exact tie goes to the slice — the side that does
 * carry a stable identifier. Deterministic, and documented rather than
 * incidental.
 */
function carve(total: bigint, q: bigint, denom: bigint): bigint {
  if (denom <= 0n || q <= 0n || total === 0n) return 0n;
  if (q >= denom) return total;
  const sliceProduct = total * q;
  const floorSlice = sliceProduct / denom;
  const remSlice = sliceProduct - floorSlice * denom;

  const leftProduct = total * (denom - q);
  const floorLeft = leftProduct / denom;
  const remLeft = leftProduct - floorLeft * denom;

  const deficit = total - floorSlice - floorLeft; // 0 or 1
  if (deficit <= 0n) return floorSlice;
  return remSlice >= remLeft ? floorSlice + deficit : floorSlice;
}

/** Proportional reduction of an already-allocated amount, floored. */
function shrink(allocated: bigint, newQty: bigint, oldQty: bigint): bigint {
  if (oldQty <= 0n || newQty <= 0n) return 0n;
  if (newQty >= oldQty) return allocated;
  return (allocated * newQty) / oldQty;
}

/**
 * The money one progress fact moves. Negative when the fact reduces quantity.
 *
 * Positive quantity carves from the CURRENT unperformed pool, exactly as
 * docs/domain/value-at-risk.md prescribes. Negative quantity re-proportions
 * within the entry's OWN root and returns the difference, so a correction can
 * only hand back money that root actually received.
 *
 * An earlier revision of this module computed a slice as the difference of two
 * cumulative allocations keyed off total work-item quantity. That reconciled in
 * aggregate and corrupted lineage: correcting one root could strip a cent from a
 * different root and leave the corrected one holding a negative balance. M4
 * package lines SUM per-slice amounts, so each slice has to be meaningful on its
 * own, not merely as a term in a telescoping series.
 */
export function sliceAllocation(
  w: WorkItemValuation, state: AllocationState, deltaQuantity: bigint,
): SliceResult {
  const reason = unvaluedReason(w);
  if (reason !== null) {
    throw new Error(`sliceAllocation: work item is unvalued (${reason}); ` +
      "call unvaluedReason first");
  }
  if (deltaQuantity === 0n) return { amounts: ZERO, fundedQuantity: 0n };

  const c = coupling(w.taxMode);

  if (deltaQuantity > 0n) {
    // Only the within-contract part of the delta draws money. The rest is
    // performed and unfunded: over-contract exposure is INV-039's concern in
    // M6, not a second pool here.
    //
    // A LINE HAS NEVER PERFORMED LESS THAN NOTHING, AND UNTIL 2026-08-08 THIS
    // TOOK `workItemPerformed` ON TRUST. That figure sums the QUANTITIES of the
    // line's admitted entries, and a removal takes away more quantity than
    // funding whenever the lineage was funded for less than it measured — the
    // `record 4 / admit / +6 / −8` sequence leaves the line reading −4 admitted
    // against an untouched pool. Unclamped, `remainingQty` then reads 14 on a
    // ten-unit line, and it is the DENOMINATOR the carve divides the unallocated
    // pool by: a denominator above the contract quantity claims the remaining
    // pool buys more units than the contract has, and under-prices every unit
    // carved against it (the same 2 units draw 2/14 of the pool where 2/10 is
    // the line's own proportion). It also raises the per-entry funding cap above
    // the contract quantity, so a single admission could store
    // `funded_quantity` 14 on a ten-unit line. The clamp is at the point of USE
    // rather than on the read, because the read is a faithful sum and it is this
    // subtraction that is only meaningful for a non-negative one.
    const performed = state.workItemPerformed > 0n ? state.workItemPerformed : 0n;
    const remainingQty = w.contractQuantity - performed;
    if (remainingQty <= 0n) return { amounts: ZERO, fundedQuantity: 0n };

    // THE LINEAGE CEILING: WHAT THIS ENTRY MAY ADD TO ITS ROOT'S FUNDED QUANTITY.
    // Added 2026-08-08 and it is the whole of the fix for the case the negative
    // branch below used to name as still open.
    //
    // `app.assert_funded_within_lineage()` (migration 0048 §3) asserts AT COMMIT
    // that a root's summed `funded_quantity` lies between zero and the quantity
    // its lineage performed. The negative branch cannot breach either side — it
    // returns at most what the lineage holds — so the only way to breach the
    // upper one is a positive carve, and the only positive carves left after
    // ADR-008 are admissions. The sequence that reached it: `record 4`, admit
    // (funded 4), `adjust +6` (an increase against an admitted root writes no
    // allocation and waits), `adjust −8` (returns all 4 funded units; effective
    // 2). The waiting `+6` is then admitted ALONE, at its own quantity, and the
    // lineage reaches funded 6 against an effective 2. The trigger raises, the
    // closure rolls back, and it rolls back identically on every retry: the
    // assignment can never close another stage and its money can never be
    // admitted, while the client is told `retryable: true`.
    //
    // THE BOUND HAS TO BE ON `funded_quantity` AND NOT ON `quantity`.
    // `valuation_allocations_progress_fact_fkey` (migration 0025:28-31, applied
    // history) makes an allocation's `quantity` equal to its entry's BY A KEY,
    // so «admit the +6 as +2» is unrepresentable — a 23503. `funded_quantity` is
    // a separate column (migration 0022) whose only per-row constraint is
    // `abs(funded_quantity) <= abs(quantity)` with a matching sign
    // (`valuation_allocations_funded_within_quantity_check`, 0025), and 2 of 6
    // satisfies both. The row still records the fact truthfully — six units were
    // measured — and records that two of them drew money.
    //
    // WHY THE CEILING CARRIES `queuedRemovalQuantity` RATHER THAN BEING THE
    // LINEAGE'S EFFECTIVE QUANTITY FLAT. The flat form — funded may never exceed
    // `rootQuantity + delta` — closes the sequence above and BREAKS the ordinary
    // one. A closure that admits `root(+10)` and then that root's own `−4` is
    // documented by migration 0048 §3 as the reason the trigger is DEFERRABLE
    // INITIALLY DEFERRED: «between those two statements the sum IS 10 against an
    // effective 6 … an immediate trigger would refuse the correct transaction
    // and permit nothing extra». The flat ceiling is exactly that immediate
    // trigger, written in TypeScript: it would fund the root 6, the `−4` would
    // then find nothing funded to return, and the lineage would settle on the
    // right funded quantity by a different route and on a DIFFERENT NUMBER OF
    // MINOR UNITS — `carve(pool, 6, 10)` is not always `shrink(carve(pool, 10,
    // 10), 6, 10)`, because the largest-remainder tie-break runs once instead of
    // once-then-floored. «Correcting 8 down to 5 lands on the same money whether
    // the correction is recorded before the closure or after it» is asserted in
    // `apps/app/tests/progress-adjust.int.test.ts`, and the flat ceiling makes it
    // false by one minor unit.
    //
    // So the ceiling is the lineage's effective quantity AS IT WILL STAND WHEN
    // THIS ENTRY IS WRITTEN — its measured total plus the removals the caller has
    // queued behind it and not yet applied. Where a removal is coming, the
    // headroom is left open for exactly as much as that removal will take back;
    // where none is coming, the headroom is the effective quantity itself. The
    // two cases the ordering used to conflate are precisely the two cases this
    // separates, and it separates them with the caller's own queue rather than
    // with a guess about intent.
    //
    // WHAT THIS GUARANTEES, and it is an induction rather than a list of cases.
    // Write F for the lineage's funded quantity, and D for its measured total
    // plus the removals still queued in this transaction. Every closure starts
    // with F ≤ D, because the previous COMMIT satisfied the trigger and a queued
    // removal only raises D. A positive entry leaves F ≤ ceiling = D, by this
    // clamp. A negative entry lowers D by its own removal m and lowers F by
    // `fundedRemoved`, which is either `m − unfundedRemoved` (and the unfunded
    // remainder is bounded by the ADMITTED quantity, which is bounded by D) or
    // the whole of F (leaving F = 0 ≤ D, since D never goes below the lineage's
    // effective quantity and the route refuses to drive that negative). So
    // F ≤ D holds after every entry; when the queue empties, D IS the lineage's
    // effective quantity, and the trigger's upper bound cannot raise. Its lower
    // bound cannot either, because `fundedRemoved` is capped at F below.
    const lineageCeiling =
      state.rootQuantity + deltaQuantity + state.queuedRemovalQuantity;
    const headroom = lineageCeiling - state.rootFundedQuantity;
    if (headroom <= 0n) return { amounts: ZERO, fundedQuantity: 0n };

    const withinContract = deltaQuantity > remainingQty ? remainingQty : deltaQuantity;
    const funded = withinContract > headroom ? headroom : withinContract;

    const [poolA, poolB] = componentsOf(c, w.pool);
    const [usedA, usedB] = componentsOf(c, state.workItemAllocated);
    return {
      amounts: assemble(c,
        carve(poolA - usedA, funded, remainingQty),
        carve(poolB - usedB, funded, remainingQty)),
      fundedQuantity: funded,
    };
  }

  // Negative: unfunded quantity goes first.
  //
  // A root that recorded three units against one unit of remaining contract
  // scope holds one unit's worth of money. Correcting away two units removes
  // exactly the part that never earned anything, so no money moves. Scaling by
  // the root's total quantity instead would hand back two thirds of a payment
  // the root did receive, and — once the work item is fully performed — that
  // money can never be allocated again.
  //
  // The guard below is the one place `rootQuantity` is read: a correction is
  // refused for driving the LINEAGE negative, whatever part of it holds money.
  const removal = -deltaQuantity;
  const newRootQty = state.rootQuantity + deltaQuantity;
  if (newRootQty < 0n) {
    throw new Error("sliceAllocation: adjustment drives root quantity below zero");
  }

  // «UNFUNDED» IS MEASURED AGAINST THE ADMITTED PART OF THE ROOT. Until
  // 2026-08-08 this line read `state.rootQuantity - state.rootFundedQuantity`,
  // which was the same number until ADR-008 (2026-08-07) stopped recording from
  // carving: before it, every entry held an allocation the moment it existed, so
  // measured and admitted quantity were one set. After it they are not, and the
  // difference is a quantity that gets spent twice. Contract quantity 10, pool
  // P, root recorded 10 and admitted, so funded 10 and holding all of P:
  //
  //   adjust +2 → an increase against an admitted root writes NO allocation and
  //               waits for the next closure. The lineage measures 12, is
  //               admitted for 10 and is funded for 10.
  //   adjust −2 → against `rootQuantity` the unfunded remainder reads 12 − 10 =
  //               2, so the correction consumes the pending +2 as free headroom,
  //               returns nothing and leaves the lineage funded 10.
  //   closure   → the +2 is still pending, so it is admitted as new quantity:
  //               the line reads 8 performed, 2 units of contract remain, and
  //               the lineage's funded quantity reaches 12 against an effective
  //               10. `app.assert_funded_within_lineage()` (migration 0048 §3)
  //               raises AT COMMIT, the closure rolls back, and it rolls back
  //               identically on every retry — that assignment can never close
  //               another stage and its money can never be admitted.
  //
  // Against the admitted figure the remainder reads 10 − 10 = 0, so the −2 takes
  // back the funding it actually has (funded 8, 80 % of P) and the closure
  // re-draws it when it admits the +2 (funded 10, all of P). THE SETTLED STATE IS
  // THE SAME UNDER EITHER READING; what differs is the window in between, and in
  // that window ADR-008's rule — unadmitted quantity holds no money — is the one
  // that has to hold.
  //
  // Clamped at zero rather than trusted: `rootFundedQuantity` is bounded by
  // `rootAdmittedQuantity` entry by entry (a positive carve funds at most its own
  // delta, a negative one returns at most its own removal), so a negative
  // remainder means a caller assembled the two figures from different sets, and
  // a silently negative `unfunded` would turn that into money.
  const admittedUnfunded = state.rootAdmittedQuantity - state.rootFundedQuantity;
  const unfunded = admittedUnfunded > 0n ? admittedUnfunded : 0n;
  const unfundedRemoved = removal > unfunded ? unfunded : removal;

  // A CORRECTION CANNOT RETURN MORE FUNDING THAN THE LINEAGE HOLDS, and this
  // bound is required BY the change above rather than left over from before it.
  // With the old unfiltered remainder the bound was free: `removal` is at most
  // `rootQuantity` (the guard above), so `removal - (rootQuantity - funded)`
  // could never exceed `funded`. Measuring the remainder against the ADMITTED
  // quantity removes that arithmetic, and a removal larger than the lineage's
  // admitted quantity — reachable as record 4, admit, adjust +6, adjust −8 —
  // would otherwise write `funded_quantity` −8 against 4 funded units. That is
  // the LOWER bound of `app.assert_funded_within_lineage()` (migration 0048 §3),
  // «a lineage cannot hand back money it never received», and it would abort the
  // correction itself.
  //
  // WHAT THIS BOUND DID NOT CLOSE, AND WHAT DOES — CORRECTED 2026-08-08 (the
  // same day, later). This paragraph used to end «that failure predates this
  // change and is unchanged by it … closing it means bounding what an ADMISSION
  // may fund by the lineage's effective quantity, which is a decision about
  // `admission.ts`'s ordering and not arithmetic that belongs here». The
  // diagnosis was right and the address was wrong.
  //
  // Right: in that same sequence the waiting +6 was afterwards admitted at its
  // own quantity, the lineage reached funded 6 against an effective 2, and
  // `app.assert_funded_within_lineage()` aborted the closure at COMMIT and kept
  // aborting it.
  //
  // Wrong about where it belongs. The second admission has exactly ONE pending
  // entry — the root and the −8 both hold allocations already — so there is no
  // order for `admission.ts` to choose between, and no ordering rule can change
  // what a single-entry list does. What that module owes is the one fact it
  // alone holds, the removals it has queued behind an entry and not yet applied;
  // the bound itself is arithmetic and is in the POSITIVE branch above, where
  // `rootQuantity` and `rootFundedQuantity` are already read under the same lock
  // and already sum the same rows the trigger will.
  const removable = removal - unfundedRemoved;
  const fundedRemoved = removable > state.rootFundedQuantity
    ? state.rootFundedQuantity : removable;
  if (fundedRemoved <= 0n) return { amounts: ZERO, fundedQuantity: 0n };

  const newFunded = state.rootFundedQuantity - fundedRemoved;
  const [heldA, heldB] = componentsOf(c, state.rootAllocated);
  const kept = assemble(c,
    shrink(heldA, newFunded, state.rootFundedQuantity),
    shrink(heldB, newFunded, state.rootFundedQuantity));

  return {
    amounts: {
      net: kept.net - state.rootAllocated.net,
      tax: kept.tax - state.rootAllocated.tax,
      gross: kept.gross - state.rootAllocated.gross,
    },
    fundedQuantity: -fundedRemoved,
  };
}
