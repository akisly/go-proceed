import { describe, it, expect } from "vitest";
import {
  unvaluedReason, cumulativeAllocation, sliceAllocation, type WorkItemValuation,
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

describe("cumulativeAllocation", () => {
  it("derives gross from net plus tax for exclusive scope", () => {
    expect(cumulativeAllocation(exclusive, Q(2)))
      .toEqual({ net: 5_000n, tax: 1_000n, gross: 6_000n });
  });

  it("derives net from gross minus tax for inclusive scope", () => {
    const inclusive: WorkItemValuation = { ...exclusive, taxMode: "inclusive" };
    expect(cumulativeAllocation(inclusive, Q(2)))
      .toEqual({ net: 5_000n, tax: 1_000n, gross: 6_000n });
  });

  it("zeroes tax for exempt scope", () => {
    const exempt: WorkItemValuation = {
      ...exclusive, taxMode: "exempt", pool: { net: 9_000n, tax: 0n, gross: 9_000n },
    };
    expect(cumulativeAllocation(exempt, Q(1)))
      .toEqual({ net: 2_250n, tax: 0n, gross: 2_250n });
  });

  it("zeroes tax for out-of-scope scope", () => {
    const oos: WorkItemValuation = {
      ...exclusive, taxMode: "out_of_scope", pool: { net: 8_000n, tax: 0n, gross: 8_000n },
    };
    expect(cumulativeAllocation(oos, Q(2)))
      .toEqual({ net: 4_000n, tax: 0n, gross: 4_000n });
  });

  it("caps at the within-contract quantity so over-contract work adds nothing", () => {
    expect(cumulativeAllocation(exclusive, Q(9)))
      .toEqual({ net: 10_000n, tax: 2_000n, gross: 12_000n });
  });

  it("allocates nothing at zero or negative cumulative quantity", () => {
    expect(cumulativeAllocation(exclusive, 0n)).toEqual({ net: 0n, tax: 0n, gross: 0n });
    expect(cumulativeAllocation(exclusive, -Q(3))).toEqual({ net: 0n, tax: 0n, gross: 0n });
  });

  it("allocates nothing when the contract quantity is zero", () => {
    expect(cumulativeAllocation({ ...exclusive, contractQuantity: 0n }, Q(1)))
      .toEqual({ net: 0n, tax: 0n, gross: 0n });
  });

  it("refuses to invent numbers for an unvalued work item", () => {
    expect(() => cumulativeAllocation({ ...exclusive, taxMode: "unknown" }, Q(1)))
      .toThrow(/unvalued/);
  });
});

describe("sliceAllocation", () => {
  it("never double-rounds: two quantity-1 slices of a 1-cent quantity-2 pool total 1 cent", () => {
    // The worked example in docs/domain/value-at-risk.md. Two independently
    // rounded fragments would each become a cent; carving from the canonical
    // pool cannot.
    const cheap: WorkItemValuation = {
      ...exclusive, taxMode: "exempt", contractQuantity: Q(2),
      pool: { net: 1n, tax: 0n, gross: 1n },
    };
    const a = sliceAllocation(cheap, Q(0), Q(1));
    const b = sliceAllocation(cheap, Q(1), Q(2));
    expect(a.gross).toBe(0n);
    expect(b.gross).toBe(1n);
    expect(a.gross + b.gross).toBe(1n);
  });

  it("returns exactly what it gave when quantity is corrected downward", () => {
    const up = sliceAllocation(exclusive, Q(0), Q(3));
    const down = sliceAllocation(exclusive, Q(3), Q(1));
    expect(up.net + down.net).toBe(cumulativeAllocation(exclusive, Q(1)).net);
    expect(up.tax + down.tax).toBe(cumulativeAllocation(exclusive, Q(1)).tax);
    expect(up.gross + down.gross).toBe(cumulativeAllocation(exclusive, Q(1)).gross);
    expect(down.net).toBeLessThan(0n);
  });

  it("is order independent across a permutation of the same deltas", () => {
    const deltas = [Q(3), -Q(1), Q(2), -Q(2)];
    const total = (order: bigint[]): bigint => {
      let performed = 0n;
      let sum = 0n;
      for (const d of order) {
        const after = performed + d;
        sum += sliceAllocation(exclusive, performed, after).net;
        performed = after;
      }
      return sum;
    };
    const forward = total(deltas);
    const reversed = total([...deltas].reverse());
    expect(forward).toBe(reversed);
  });

  it("reconciles pool = unperformed + sum(slices) on all three components", () => {
    // Deterministic pseudo-random walk: reproducible, and no new dependency.
    let seed = 42;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (const taxMode of ["exclusive", "inclusive", "exempt"] as const) {
      for (let trial = 0; trial < 150; trial++) {
        const net = BigInt(Math.floor(next() * 100_000));
        const tax = taxMode === "exempt" ? 0n : net / 5n;
        const item: WorkItemValuation = {
          ...exclusive, taxMode,
          pool: { net, tax, gross: net + tax },
          contractQuantity: BigInt(Math.floor(next() * 50) + 1) * 1_000_000n,
        };

        let performed = 0n;
        const sum = { net: 0n, tax: 0n, gross: 0n };
        for (let step = 0; step < 8; step++) {
          const delta = BigInt(Math.floor(next() * 10_000_000)) - 3_000_000n;
          const after = performed + delta < 0n ? 0n : performed + delta;
          const s = sliceAllocation(item, performed, after);
          sum.net += s.net; sum.tax += s.tax; sum.gross += s.gross;
          performed = after;
        }

        const cum = cumulativeAllocation(item, performed);
        // Slices telescope to the cumulative allocation.
        expect(sum).toEqual(cum);

        // The unperformed remainder closes the pool, stays non-negative, and
        // stays internally coupled.
        const unperformed = {
          net: item.pool.net - sum.net,
          tax: item.pool.tax - sum.tax,
          gross: item.pool.gross - sum.gross,
        };
        expect(unperformed.net).toBeGreaterThanOrEqual(0n);
        expect(unperformed.tax).toBeGreaterThanOrEqual(0n);
        expect(unperformed.gross).toBe(unperformed.net + unperformed.tax);
        expect(sum.gross).toBe(sum.net + sum.tax);
        // Never allocate more than the pool holds.
        expect(sum.net).toBeLessThanOrEqual(item.pool.net);
      }
    }
  });
});
