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
 * Minimal stand-in for the allocation state a caller maintains under the
 * work-item lock. Tests drive this rather than calling sliceAllocation with
 * hand-built state, so the per-root bookkeeping is exercised the way the routes
 * exercise it.
 *
 * THE CALLER CHANGED WITH ADR-008 AND THE ALGEBRA DID NOT. This file is the third
 * of the three ADR-008 §Consequences names, and it is the one the ADR says is
 * «unaffected. Only its caller moves.» So nothing below is rewritten: the state
 * this class threads used to be maintained by `progress.record` and
 * `progress.adjust`, and after ADR-008 it is maintained by `progress.adjust` and
 * by the ADMISSION command — `apps/app/src/lib/admission.ts`, called inside the
 * stage-closure transaction. `apps/app/tests/admission-valuation.int.test.ts` is
 * where the same matrix is exercised end to end against a real database; this
 * file stays the pure-arithmetic half and knows about no route at all.
 *
 * One consequence IS visible here in what the class does NOT model: after ADR-008
 * only ADMITTED quantity competes for the pool, so a recorded-and-unadmitted entry
 * contributes to neither `workItemPerformed` nor `workItemAllocated` until its
 * closure. `Ledger.apply` therefore represents an ADMISSION and not a measurement,
 * and a walk over this class says nothing about the gap between the two.
 */
class Ledger {
  workItemPerformed = 0n;
  workItemAllocated: PoolAmounts = ZERO;
  readonly roots = new Map<string,
    { quantity: bigint; funded: bigint; allocated: PoolAmounts }>();

  constructor(private readonly w: WorkItemValuation) {}

  apply(rootId: string, delta: bigint): PoolAmounts {
    const root = this.roots.get(rootId) ?? { quantity: 0n, funded: 0n, allocated: ZERO };
    const state: AllocationState = {
      workItemPerformed: this.workItemPerformed,
      workItemAllocated: this.workItemAllocated,
      rootQuantity: root.quantity,
      // THE SAME NUMBER, AND ONLY IN THIS MODEL. `AllocationState` split measured
      // from admitted quantity on 2026-08-08 (see the negative branch of
      // `sliceAllocation`), and every `apply` here IS an admission — the class
      // header says so — so a Ledger root has no entry that fails to hold an
      // allocation and the two figures coincide by construction. The case where
      // they diverge is a route-level one: `progress.adjust` writing no
      // allocation for an increase against an admitted root. It cannot be
      // expressed here at all, and it is asserted end to end in
      // `apps/app/tests/progress-adjust.int.test.ts`.
      rootAdmittedQuantity: root.quantity,
      rootFundedQuantity: root.funded,
      // NOTHING IS EVER QUEUED IN THIS MODEL, and that is what makes the lineage
      // ceiling (added to the positive branch on 2026-08-08) invisible to every
      // walk below. `apply` writes one slice and returns, so there is no later
      // statement of the same transaction for a removal to be waiting in. With
      // the queue empty the ceiling is `rootQuantity + delta - rootFunded`, and
      // this class keeps `funded <= quantity` by construction — every apply IS an
      // admission — so the ceiling is never below the delta and never binds. The
      // case that needs it is a route-level one and cannot be expressed here:
      // see `apps/app/tests/progress-adjust.int.test.ts`.
      queuedRemovalQuantity: 0n,
      rootAllocated: root.allocated,
    };
    const { amounts, fundedQuantity } = sliceAllocation(this.w, state, delta);
    this.workItemPerformed += delta;
    this.workItemAllocated = add(this.workItemAllocated, amounts);
    this.roots.set(rootId, {
      quantity: root.quantity + delta,
      funded: root.funded + fundedQuantity,
      allocated: add(root.allocated, amounts),
    });
    return amounts;
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

describe("over-contract corrections do not destroy money", () => {
  // Found by the pre-landing review's outside voice. The first implementation
  // shrank a root's allocation by its TOTAL quantity, including the
  // over-contract part that never earned anything, so money vanished and — once
  // the work item was fully performed — could never be allocated again.
  const item: WorkItemValuation = {
    pool: { net: 400n, tax: 0n, gross: 400n },
    contractQuantity: Q(4),
    taxMode: "exempt",
    unitPriceState: "known",
    valuationBasis: "unit_price_derived",
  };

  it("keeps the pool fully allocated when a correction removes only unfunded quantity", () => {
    const l = new Ledger(item);
    l.apply("A", Q(3));          // carves 300, one unit of contract scope left
    l.apply("B", Q(3));          // only one unit is fundable, carves the last 100
    expect(l.workItemAllocated.gross).toBe(400n);

    const returned = l.apply("B", -Q(2));   // both units removed were unfunded
    expect(returned.gross).toBe(0n);
    expect(l.roots.get("B")!.allocated.gross).toBe(100n);
    expect(l.workItemAllocated.gross).toBe(400n);
    expect(l.unperformed().gross).toBe(0n);
  });

  it("returns money once the correction reaches funded quantity", () => {
    const l = new Ledger(item);
    l.apply("A", Q(3));
    l.apply("B", Q(3));
    l.apply("B", -Q(2));         // unfunded only
    const returned = l.apply("B", -Q(1));   // now it bites

    expect(returned.gross).toBe(-100n);
    expect(l.roots.get("B")!.allocated.gross).toBe(0n);
    expect(l.workItemAllocated.gross).toBe(300n);
    // Freed scope is allocatable again, which is the whole point.
    const c = l.apply("C", Q(1));
    expect(c.gross).toBe(100n);
    expect(l.workItemAllocated.gross).toBe(400n);
  });

  it("allocates the whole pool once performed quantity reaches the contract", () => {
    // The general property the example is one case of.
    const l = new Ledger(item);
    l.apply("A", Q(10));         // wildly over contract in one go
    expect(l.workItemAllocated.gross).toBe(400n);
    l.apply("A", -Q(6));         // still over contract afterwards
    expect(l.workItemAllocated.gross).toBe(400n);
    expect(l.unperformed().gross).toBe(0n);
  });
});

describe("ledger invariants with over-contract quantities", () => {
  const base: WorkItemValuation = {
    pool: { net: 400n, tax: 0n, gross: 400n },
    contractQuantity: Q(4),
    taxMode: "exempt",
    unitPriceState: "known",
    valuationBasis: "unit_price_derived",
  };

  it("never leaves the pool short while performed quantity covers the contract", () => {
    // The earlier random walk never crossed the contract quantity, which is why
    // it missed the defect above. This one deliberately over-performs.
    let seed = 7;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (const taxMode of ["exclusive", "inclusive", "exempt"] as const) {
      for (let trial = 0; trial < 150; trial++) {
        const net = BigInt(Math.floor(next() * 50_000) + 1);
        const tax = taxMode === "exempt" ? 0n : net / 5n;
        const contractQuantity = BigInt(Math.floor(next() * 5) + 1) * 1_000_000n;
        const item2: WorkItemValuation = {
          ...base, taxMode,
          pool: { net, tax, gross: net + tax },
          contractQuantity,
        };
        const l = new Ledger(item2);
        const ids = ["r1", "r2", "r3"];

        for (let step = 0; step < 10; step++) {
          const id = ids[Math.floor(next() * ids.length)]!;
          const root = l.roots.get(id);
          const up = next() < 0.65 || !root || root.quantity === 0n;
          // Deliberately generous deltas relative to the contract quantity.
          const delta = up
            ? BigInt(Math.floor(next() * 4) + 1) * 1_000_000n
            : -(BigInt(Math.floor(next() * Number(root!.quantity / 1_000_000n) + 1)) * 1_000_000n);
          if (delta === 0n || (!up && root!.quantity + delta < 0n)) continue;
          l.apply(id, delta);
        }

        const unperformed = l.unperformed();
        expect(unperformed.net).toBeGreaterThanOrEqual(0n);
        expect(unperformed.gross).toBe(unperformed.net + unperformed.tax);
        for (const root of l.roots.values()) {
          expect(root.allocated.net).toBeGreaterThanOrEqual(0n);
          expect(root.funded).toBeLessThanOrEqual(root.quantity);
        }
        // Money never exceeds the pool, and every root's holding is backed by
        // funded quantity. The stronger property — "pool fully allocated
        // whenever the contract quantity is performed" — does NOT hold, by
        // design gap rather than by accident; see the test below.
        expect(unperformed.gross).toBeGreaterThanOrEqual(0n);
        let held = 0n;
        for (const root of l.roots.values()) held += root.allocated.gross;
        expect(held).toBe(l.workItemAllocated.gross);
      }
    }
  });
});

describe("the lineage ceiling on a positive carve", () => {
  // THE ONE PLACE THIS FILE BUILDS STATE BY HAND, and the Ledger's own header
  // says why it has to: every `apply` there is an admission, so a Ledger root
  // never has an entry that holds no allocation, and the state this ceiling
  // exists for — an ADMITTED root carrying an UNADMITTED increase, corrected
  // downward by more than it was funded — cannot be reached through the model at
  // all. `apps/app/tests/progress-adjust.int.test.ts` exercises it end to end;
  // these three cases pin the arithmetic the route depends on.
  const line: WorkItemValuation = {
    pool: { net: 1_000n, tax: 0n, gross: 1_000n },
    contractQuantity: Q(10),
    taxMode: "exempt",
    unitPriceState: "known",
    valuationBasis: "unit_price_derived",
  };

  it("funds only the lineage's effective quantity when nothing more is queued", () => {
    // `record 4 / admit / +6 / −8`, at the moment the waiting +6 is admitted
    // alone. The line's admitted entries are the root (+4) and the correction
    // (−8), so it reads −4 performed; the lineage measures 2 and holds no
    // funding, because the −8 handed back all four funded units.
    const slice = sliceAllocation(line, {
      workItemPerformed: -Q(4),
      workItemAllocated: ZERO,
      rootQuantity: -Q(4),
      rootAdmittedQuantity: -Q(4),
      rootFundedQuantity: 0n,
      queuedRemovalQuantity: 0n,
      rootAllocated: ZERO,
    }, Q(6));

    // SIX WERE MEASURED AND TWO MAY DRAW MONEY. Unbounded this returned 6, the
    // lineage reached funded 6 against an effective 2, and
    // app.assert_funded_within_lineage() (migration 0048 §3) aborted the closure
    // at COMMIT — identically on every retry.
    expect(slice.fundedQuantity).toBe(Q(2));
    // 2/10 of the pool and not 2/14. The line's performed quantity is floored at
    // zero before it becomes a denominator: −4 performed would claim 14 units of
    // a ten-unit line are still available to draw money.
    expect(slice.amounts.gross).toBe(200n);
  });

  it("leaves room for a removal the same admission has queued behind it", () => {
    // `record 10 / adjust −4 / close` — both entries pending, root first. The
    // root is funded its full 10 and the correction gives 4 back a statement
    // later. Migration 0048 §3 makes the trigger DEFERRABLE INITIALLY DEFERRED
    // precisely so that intermediate state is legal, and a ceiling that ignored
    // the queue would be that immediate trigger written in TypeScript.
    const state: AllocationState = {
      workItemPerformed: 0n,
      workItemAllocated: ZERO,
      rootQuantity: -Q(4),
      rootAdmittedQuantity: 0n,
      rootFundedQuantity: 0n,
      queuedRemovalQuantity: Q(4),
      rootAllocated: ZERO,
    };
    const queued = sliceAllocation(line, state, Q(10));
    expect(queued.fundedQuantity).toBe(Q(10));
    expect(queued.amounts.gross).toBe(1_000n);

    // The same state with an empty queue is the flat ceiling, and it is a
    // DIFFERENT answer — which is the whole reason the queue is carried. Pinned
    // here so that dropping the field cannot look harmless.
    const flat = sliceAllocation(line, { ...state, queuedRemovalQuantity: 0n }, Q(10));
    expect(flat.fundedQuantity).toBe(Q(6));
  });

  it("never bounds a lineage that has funded no more than it measured", () => {
    // The ordinary case, stated so the ceiling cannot quietly start biting: a
    // root whose funded quantity is within its measured quantity has headroom of
    // at least the delta, because the ceiling grows by the delta too.
    const l = new Ledger(line);
    expect(l.apply("A", Q(4)).gross).toBe(400n);
    expect(l.apply("A", Q(6)).gross).toBe(600n);
    expect(l.roots.get("A")!.funded).toBe(Q(10));
  });
});

describe("KNOWN GAP: funding is first-come and is not redistributed", () => {
  it("leaves a later root unfunded after an earlier root withdraws", () => {
    // Found by the over-contract property walk above, and NOT the same defect
    // the outside voice named. Funding is claimed by whoever records first. When
    // that root withdraws, the freed pool is not offered to roots whose
    // performed quantity is now within the contract.
    const item: WorkItemValuation = {
      pool: { net: 400n, tax: 0n, gross: 400n },
      contractQuantity: Q(4), taxMode: "exempt",
      unitPriceState: "known", valuationBasis: "unit_price_derived",
    };
    const l = new Ledger(item);
    l.apply("A", Q(4));                      // takes the whole pool
    expect(l.apply("B", Q(4)).gross).toBe(0n);   // nothing left to fund
    l.apply("A", -Q(4));                     // gives it all back

    // B has performed four units, exactly the contract quantity, and holds
    // nothing. The pool is idle.
    expect(l.roots.get("B")!.allocated.gross).toBe(0n);
    expect(l.unperformed().gross).toBe(400n);
    expect(l.workItemPerformed).toBe(Q(4));

    // Recorded as a test rather than left implicit: closing it means writing
    // allocations for roots OTHER than the one being corrected, which is a
    // design decision about lineage, not a patch. Tracked in TODOS.md.
  });
});
