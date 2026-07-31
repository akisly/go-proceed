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
  /** Effective quantity of THIS entry's root before this entry, scale 6. */
  rootQuantity: bigint;
  /** Minor units already allocated to THIS entry's root. */
  rootAllocated: PoolAmounts;
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
): PoolAmounts {
  const reason = unvaluedReason(w);
  if (reason !== null) {
    throw new Error(`sliceAllocation: work item is unvalued (${reason}); ` +
      "call unvaluedReason first");
  }
  if (deltaQuantity === 0n) return ZERO;

  const c = coupling(w.taxMode);

  if (deltaQuantity > 0n) {
    // Remaining within-contract quantity and the money still unallocated.
    const remainingQty = w.contractQuantity - state.workItemPerformed;
    if (remainingQty <= 0n) return ZERO; // wholly over-contract: INV-039's problem in M6
    const q = deltaQuantity > remainingQty ? remainingQty : deltaQuantity;

    const [poolA, poolB] = componentsOf(c, w.pool);
    const [usedA, usedB] = componentsOf(c, state.workItemAllocated);
    return assemble(c,
      carve(poolA - usedA, q, remainingQty),
      carve(poolB - usedB, q, remainingQty));
  }

  // Negative: return from this root's own allocation, proportionally.
  const newRootQty = state.rootQuantity + deltaQuantity;
  if (newRootQty < 0n) {
    throw new Error("sliceAllocation: adjustment drives root quantity below zero");
  }
  const [heldA, heldB] = componentsOf(c, state.rootAllocated);
  const keptA = shrink(heldA, newRootQty, state.rootQuantity);
  const keptB = shrink(heldB, newRootQty, state.rootQuantity);
  const kept = assemble(c, keptA, keptB);
  return {
    net: kept.net - state.rootAllocated.net,
    tax: kept.tax - state.rootAllocated.tax,
    gross: kept.gross - state.rootAllocated.gross,
  };
}
