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
 * Whether this work item's money is knowable at all, and why not when it isn't.
 *
 * The pool numbers alone cannot answer this. M1's publish writes
 * `mp.net ?? "0"` into the pool columns
 * (apps/app/app/v1/import-batches/[batchId]/publish/route.ts:200) and those
 * columns are NOT NULL, so a work item whose money is unknown carries a pool of
 * 0 — indistinguishable by value from work that is genuinely free. The
 * qualifying facts are the only way to tell the two apart, and INV-038 needs
 * that distinction preserved at write time, because nothing downstream can
 * reconstruct it later.
 */
export function unvaluedReason(w: WorkItemValuation): UnvaluedReason | null {
  if (w.taxMode === "unknown") return "unknown_tax_basis";
  // An approved source amount prices the item directly, so a missing unit price
  // is irrelevant there. A zero unit price is a real price of zero.
  if (w.valuationBasis === "unit_price_derived" && w.unitPriceState === "missing") {
    return "missing_unit_price";
  }
  return null;
}

/**
 * Money allocated to the first `cumulativeQuantity` of within-contract work.
 *
 * Telescopic rather than incremental: a slice is the difference of two
 * cumulative values (see `sliceAllocation`). That makes
 * `pool = unperformed + sum(slices)` reconcile exactly by construction on every
 * component, makes the result independent of the order entries were appended,
 * and makes a negative correction return precisely what it was given.
 *
 * Quantity beyond the contract quantity allocates nothing further: the pool
 * covers within-contract scope only (docs/domain/value-at-risk.md), and
 * over-contract exposure is INV-039's concern in M6, not a second pool here.
 *
 * Components are never allocated independently. Which pair is allocated and
 * which one is derived follows the tax mode, so `gross = net + tax` holds for
 * every slice, for their sum, and for the unperformed leftover.
 */
export function cumulativeAllocation(
  w: WorkItemValuation, cumulativeQuantity: bigint,
): PoolAmounts {
  const reason = unvaluedReason(w);
  if (reason !== null) {
    throw new Error(`cumulativeAllocation: work item is unvalued (${reason}); ` +
      "call unvaluedReason first");
  }
  const denom = w.contractQuantity;
  if (denom <= 0n) return { net: 0n, tax: 0n, gross: 0n };
  const q = cumulativeQuantity <= 0n ? 0n
    : cumulativeQuantity > denom ? denom
    : cumulativeQuantity;
  // Non-negative operands, so BigInt truncation toward zero is floor.
  const share = (component: bigint): bigint => (component * q) / denom;

  switch (w.taxMode) {
    case "exclusive": {
      const net = share(w.pool.net);
      const tax = share(w.pool.tax);
      return { net, tax, gross: net + tax };
    }
    case "inclusive": {
      const gross = share(w.pool.gross);
      const tax = share(w.pool.tax);
      return { net: gross - tax, tax, gross };
    }
    case "exempt":
    case "out_of_scope": {
      const gross = share(w.pool.gross);
      return { net: gross, tax: 0n, gross };
    }
    default:
      throw new Error(`cumulativeAllocation: unsupported tax mode ${w.taxMode}`);
  }
}

/**
 * The money one progress fact moves, as the difference between the cumulative
 * allocation after it and before it. Negative when the fact reduces quantity.
 */
export function sliceAllocation(
  w: WorkItemValuation, beforeQuantity: bigint, afterQuantity: bigint,
): PoolAmounts {
  const a = cumulativeAllocation(w, beforeQuantity);
  const b = cumulativeAllocation(w, afterQuantity);
  return { net: b.net - a.net, tax: b.tax - a.tax, gross: b.gross - a.gross };
}
