import { describe, it, expect } from "vitest";
import {
  unvaluedReason, sliceAllocation, ZERO,
  type WorkItemValuation, type PoolAmounts, type AllocationState,
} from "./valuation";

/** Scale-6 quantity, matching numeric(20,6). */
const Q = (whole: number): bigint => BigInt(whole) * 1_000_000n;

const exclusive: WorkItemValuation = {
  pool: { net: 10_000n, tax: 2_000n, gross: 12_000n },
  contractQuantity: Q(4),
  taxMode: "exclusive",
  unitPriceState: "known",
  valuationBasis: "unit_price_derived",
};

const add = (a: PoolAmounts, b: PoolAmounts): PoolAmounts =>
  ({ net: a.net + b.net, tax: a.tax + b.tax, gross: a.gross + b.gross });

/**
 * Minimal stand-in for what progress.record / progress.adjust maintain under the
 * work-item row lock. Tests drive this rather than calling sliceAllocation with
 * hand-built state, so the per-root bookkeeping is exercised the way the routes
 * will exercise it.
 */
class Ledger {
  workItemPerformed = 0n;
  workItemAllocated: PoolAmounts = ZERO;
  readonly roots = new Map<string, { quantity: bigint; allocated: PoolAmounts }>();

  constructor(private readonly w: WorkItemValuation) {}

  apply(rootId: string, delta: bigint): PoolAmounts {
    const root = this.roots.get(rootId) ?? { quantity: 0n, allocated: ZERO };
    const state: AllocationState = {
      workItemPerformed: this.workItemPerformed,
      workItemAllocated: this.workItemAllocated,
      rootQuantity: root.quantity,
      rootAllocated: root.allocated,
    };
    const slice = sliceAllocation(this.w, state, delta);
    this.workItemPerformed += delta;
    this.workItemAllocated = add(this.workItemAllocated, slice);
    this.roots.set(rootId, {
      quantity: root.quantity + delta,
      allocated: add(root.allocated, slice),
    });
    return slice;
  }

  unperformed(): PoolAmounts {
    return {
      net: this.w.pool.net - this.workItemAllocated.net,
      tax: this.w.pool.tax - this.workItemAllocated.tax,
      gross: this.w.pool.gross - this.workItemAllocated.gross,
    };
  }
}

describe("unvaluedReason", () => {
  it("names unknown tax basis", () => {
    expect(unvaluedReason({ ...exclusive, taxMode: "unknown" })).toBe("unknown_tax_basis");
  });
  it("names a missing unit price on unit-price-derived items", () => {
    expect(unvaluedReason({ ...exclusive, unitPriceState: "missing" }))
      .toBe("missing_unit_price");
  });
  it("treats a zero unit price as genuinely free, not unknown", () => {
    expect(unvaluedReason({ ...exclusive, unitPriceState: "zero" })).toBeNull();
  });
  it("ignores price state when the basis is an approved source amount", () => {
    expect(unvaluedReason({
      ...exclusive, unitPriceState: "missing", valuationBasis: "approved_source_amount",
    })).toBeNull();
  });
  it("puts unknown tax ahead of a missing price", () => {
    expect(unvaluedReason({
      ...exclusive, taxMode: "unknown", unitPriceState: "missing",
    })).toBe("unknown_tax_basis");
  });
});

describe("coupled allocation by tax mode", () => {
  it("derives gross from net plus tax for exclusive scope", () => {
    const l = new Ledger(exclusive);
    expect(l.apply("r1", Q(2))).toEqual({ net: 5_000n, tax: 1_000n, gross: 6_000n });
  });

  it("derives net from gross minus tax for inclusive scope", () => {
    const l = new Ledger({ ...exclusive, taxMode: "inclusive" });
    expect(l.apply("r1", Q(2))).toEqual({ net: 5_000n, tax: 1_000n, gross: 6_000n });
  });

  it("zeroes tax for exempt scope", () => {
    const l = new Ledger({
      ...exclusive, taxMode: "exempt", pool: { net: 9_000n, tax: 0n, gross: 9_000n },
    });
    expect(l.apply("r1", Q(1))).toEqual({ net: 2_250n, tax: 0n, gross: 2_250n });
  });

  it("zeroes tax for out-of-scope scope", () => {
    const l = new Ledger({
      ...exclusive, taxMode: "out_of_scope", pool: { net: 8_000n, tax: 0n, gross: 8_000n },
    });
    expect(l.apply("r1", Q(2))).toEqual({ net: 4_000n, tax: 0n, gross: 4_000n });
  });

  it("refuses to invent numbers for an unvalued work item", () => {
    const l = new Ledger({ ...exclusive, taxMode: "unknown" });
    expect(() => l.apply("r1", Q(1))).toThrow(/unvalued/);
  });
});

describe("within-contract boundary", () => {
  it("allocates nothing beyond the contract quantity", () => {
    const l = new Ledger(exclusive);
    l.apply("r1", Q(4));
    expect(l.apply("r2", Q(3))).toEqual(ZERO);
    expect(l.workItemAllocated).toEqual(exclusive.pool);
  });

  it("allocates only the within-contract part of a straddling slice", () => {
    const l = new Ledger(exclusive);
    l.apply("r1", Q(3));
    const straddle = l.apply("r2", Q(5));
    expect(straddle.gross).toBe(3_000n); // the remaining quarter of a 12000 pool
    expect(l.unperformed()).toEqual(ZERO);
  });

  it("allocates nothing when the contract quantity is zero", () => {
    const l = new Ledger({ ...exclusive, contractQuantity: 0n });
    expect(l.apply("r1", Q(1))).toEqual(ZERO);
  });
});

describe("no double rounding", () => {
  it("keeps two quantity-1 slices of a 1-cent quantity-2 pool at 1 cent total", () => {
    // The worked example in docs/domain/value-at-risk.md.
    const cheap: WorkItemValuation = {
      ...exclusive, taxMode: "exempt", contractQuantity: Q(2),
      pool: { net: 1n, tax: 0n, gross: 1n },
    };
    const l = new Ledger(cheap);
    const a = l.apply("A", Q(1));
    const b = l.apply("B", Q(1));
    expect(a.gross + b.gross).toBe(1n);
    expect(l.unperformed()).toEqual(ZERO);
  });
});

describe("corrections return from their own lineage", () => {
  // Regression for the defect the engineering review's outside voice found in
  // the telescopic revision of this module: correcting one root stripped a cent
  // from a DIFFERENT root and left the corrected one holding a negative balance,
  // while the aggregate still reconciled.
  const cheap: WorkItemValuation = {
    ...exclusive, taxMode: "exempt", contractQuantity: Q(2),
    pool: { net: 1n, tax: 0n, gross: 1n },
  };

  it("never leaves a root with a negative balance", () => {
    const l = new Ledger(cheap);
    l.apply("A", Q(1));
    l.apply("B", Q(1));
    l.apply("A", -Q(1));

    for (const [id, root] of l.roots) {
      expect(root.allocated.gross, `root ${id}`).toBeGreaterThanOrEqual(0n);
      expect(root.quantity, `root ${id}`).toBeGreaterThanOrEqual(0n);
    }
  });

  it("does not move money between roots", () => {
    const l = new Ledger(cheap);
    l.apply("A", Q(1));
    const bAfterInsert = l.roots.get("B")?.allocated.gross ?? 0n;
    l.apply("B", Q(1));
    const bBefore = l.roots.get("B")!.allocated.gross;
    l.apply("A", -Q(1));
    const bAfter = l.roots.get("B")!.allocated.gross;

    expect(bAfterInsert).toBe(0n);
    // B was not touched by A's correction.
    expect(bAfter).toBe(bBefore);
  });

  it("returns exactly what the root held when it is fully corrected away", () => {
    const l = new Ledger(exclusive);
    l.apply("A", Q(3));
    const held = { ...l.roots.get("A")!.allocated };
    const returned = l.apply("A", -Q(3));
    expect(returned).toEqual({ net: -held.net, tax: -held.tax, gross: -held.gross });
    expect(l.roots.get("A")!.allocated).toEqual(ZERO);
    expect(l.unperformed()).toEqual(exclusive.pool);
  });

  it("returns proportionally on a partial correction", () => {
    const l = new Ledger(exclusive);
    l.apply("A", Q(4));           // whole pool: 10000 / 2000 / 12000
    const returned = l.apply("A", -Q(1));
    expect(returned).toEqual({ net: -2_500n, tax: -500n, gross: -3_000n });
    expect(l.roots.get("A")!.allocated).toEqual({ net: 7_500n, tax: 1_500n, gross: 9_000n });
  });
});

describe("ledger invariants over a randomised walk", () => {
  it("keeps the pool identity, per-root non-negativity, and component coupling", () => {
    let seed = 42;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (const taxMode of ["exclusive", "inclusive", "exempt", "out_of_scope"] as const) {
      for (let trial = 0; trial < 120; trial++) {
        const net = BigInt(Math.floor(next() * 100_000));
        const tax = (taxMode === "exempt" || taxMode === "out_of_scope") ? 0n : net / 5n;
        const item: WorkItemValuation = {
          ...exclusive, taxMode,
          pool: { net, tax, gross: net + tax },
          contractQuantity: BigInt(Math.floor(next() * 50) + 1) * 1_000_000n,
        };
        const l = new Ledger(item);
        const rootIds = ["r1", "r2", "r3"];

        for (let step = 0; step < 12; step++) {
          const id = rootIds[Math.floor(next() * rootIds.length)]!;
          const root = l.roots.get(id);
          const up = next() < 0.6 || !root || root.quantity === 0n;
          const delta = up
            ? BigInt(Math.floor(next() * 8_000_000)) + 1n
            : -(BigInt(Math.floor(next() * Number(root!.quantity / 1_000_000n + 1n))) * 1_000_000n);
          if (delta === 0n) continue;
          if (!up && root!.quantity + delta < 0n) continue;
          l.apply(id, delta);
        }

        const unperformed = l.unperformed();
        // The pool closes exactly, on every component.
        expect(unperformed.gross).toBe(unperformed.net + unperformed.tax);
        expect(l.workItemAllocated.gross)
          .toBe(l.workItemAllocated.net + l.workItemAllocated.tax);
        expect(unperformed.net).toBeGreaterThanOrEqual(0n);
        expect(unperformed.tax).toBeGreaterThanOrEqual(0n);
        // No root ever holds money it did not receive, or a negative balance.
        for (const [id, root] of l.roots) {
          expect(root.quantity, `root ${id} quantity`).toBeGreaterThanOrEqual(0n);
          expect(root.allocated.net, `root ${id} net`).toBeGreaterThanOrEqual(0n);
          expect(root.allocated.gross, `root ${id} gross`)
            .toBe(root.allocated.net + root.allocated.tax);
        }
        // Per-root sums reconstruct the work-item total: no orphaned money.
        let sum = ZERO;
        for (const root of l.roots.values()) sum = add(sum, root.allocated);
        expect(sum).toEqual(l.workItemAllocated);
      }
    }
  });
});
