import { describe, it, expect } from "vitest";
import {
  BLOCKED_REASON_CODE_VOCABULARY_VERSION, PRIMARY_CAUSE_PRECEDENCE,
  blockedValueResponse, type BlockedReason, type BlockedReasonCodeValue,
} from "@goproceed/contracts";
import type { AssignmentValuation } from "./readiness";
import { summariseBlockedValue, type NotAdmittedResult } from "./blocked-value";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No `vitest`, no `tsc`; no assertion
 * below has been run and no claim is made that any of them passes.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M6 — THE PARTITION, WITHOUT A DATABASE.
 *
 * `summariseBlockedValue` is pure on purpose, and this suite is why: the three
 * things most likely to be wrong about a money screen are the deduplication, the
 * precedence and the reconciliation, and none of them needs a row to exercise.
 * The integration suite proves the numbers come from the right facts; this one
 * proves that once they arrive they add up.
 *
 * EVERY CASE BELOW ASSERTS THE REQUIREMENT AND NEVER TODAY'S ARITHMETIC. Where a
 * figure is pinned it is derived in the assertion from the fixture's own inputs
 * (`A_NET + B_NET`, not `30000`), so a change to the fixture cannot make a wrong
 * total look right.
 */

const OCC = (n: number) => `0ccc0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ASG = (n: number) => `a55c0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ITEM = (n: number) => `17e40000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STAGE = (n: number) => `57a60000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const RULE = (n: number) => `41e00000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CONTRACT = "c04c0000-0000-4000-8000-000000000001";
const CV1 = "cf510000-0000-4000-8000-000000000001";
const CV2 = "cf510000-0000-4000-8000-000000000002";
const PROJECT = "9403ec70-0000-4000-8000-000000000001";
const AT = "2026-08-07T10:00:00.000Z";

function reason(o: {
  occ: number; assignment: number; item: number; stage?: number;
  code: BlockedReasonCodeValue;
  money?: { currency: string; net: string; tax: string; gross: string } | null;
  attribution?: BlockedReason["valueAttribution"];
  unvaluedQuantity?: string | null;
}): BlockedReason {
  return {
    requirementOccurrenceId: OCC(o.occ),
    ruleVersionId: RULE(o.occ),
    workAssignmentId: ASG(o.assignment),
    workStageId: STAGE(o.stage ?? o.assignment),
    stageKey: "prykhovani-roboty",
    workItemId: ITEM(o.item),
    code: o.code,
    codeVocabularyVersion: BLOCKED_REASON_CODE_VOCABULARY_VERSION,
    missingEvidence: [],
    awaitingApproverRole: "technical_supervisor",
    since: AT,
    blockedValue: o.money === undefined
      ? { currency: "UAH", netMinorUnits: "100000", taxMinorUnits: "20000", grossMinorUnits: "120000" }
      : o.money === null ? null : {
        currency: o.money.currency, netMinorUnits: o.money.net,
        taxMinorUnits: o.money.tax, grossMinorUnits: o.money.gross,
      },
    unvaluedQuantity: o.unvaluedQuantity ?? null,
    valueAttribution: o.attribution ?? "planned_share",
    acceptanceCriterion: "Приклад-критерій приймання.",
    normRef: null,
  };
}

function valuation(o: {
  assignment: number; item: number; currency?: string; unitCode?: string;
  contractVersionId?: string; contractVersionNo?: number;
  unitPriceState?: AssignmentValuation["unitPriceState"];
  unvalued?: AssignmentValuation["unvalued"];
  plannedQuantity?: bigint | null;
}): AssignmentValuation {
  return {
    workAssignmentId: ASG(o.assignment),
    workItemId: ITEM(o.item),
    contractId: CONTRACT,
    contractVersionId: o.contractVersionId ?? CV1,
    contractVersionNo: o.contractVersionNo ?? 1,
    unitCode: o.unitCode ?? "м",
    currency: o.currency ?? "UAH",
    plannedQuantity: o.plannedQuantity === undefined ? 5_000000n : o.plannedQuantity,
    contractQuantity: 10_000000n,
    net: 100000n, tax: 20000n, gross: 120000n,
    unitPriceState: o.unitPriceState ?? "known",
    unvalued: o.unvalued ?? null,
  };
}

const NO_PENDING: NotAdmittedResult = {
  view: {
    bucket: "performed_not_admitted",
    isSummandOfBlockedValue: false,
    lines: [],
    totalsByCurrency: [],
    unvaluedLineCount: 0,
    overContractLineCount: 0,
  },
  overContract: [],
};

function summarise(reasons: BlockedReason[], valuations: AssignmentValuation[],
                   notAdmitted: NotAdmittedResult = NO_PENDING) {
  return summariseBlockedValue({
    projectId: PROJECT, calculatedAt: AT, reasons,
    valuations: new Map(valuations.map((v) => [v.workAssignmentId, v] as const)),
    notAdmitted,
  });
}

/** The identity the wire schema enforces, restated so a failure names it. */
function sumsPerCurrency(rows: { currency: string; netMinorUnits: string;
  taxMinorUnits: string; grossMinorUnits: string; assignmentCount: number }[]) {
  const out = new Map<string, { net: bigint; tax: bigint; gross: bigint; assignments: number }>();
  for (const r of rows) {
    const a = out.get(r.currency) ?? { net: 0n, tax: 0n, gross: 0n, assignments: 0 };
    a.net += BigInt(r.netMinorUnits);
    a.tax += BigInt(r.taxMinorUnits);
    a.gross += BigInt(r.grossMinorUnits);
    a.assignments += r.assignmentCount;
    out.set(r.currency, a);
  }
  return out;
}

describe("the by-cause breakdown reconciles to the sum", () => {
  /**
   * THE CASE THE PARTITION EXISTS FOR. One assignment, two unmet obligations,
   * two DIFFERENT codes. A per-cause table that counted it under both would
   * report twice the money — «reporting a per-cause table that quietly counts
   * such a slice several times inflates the very number the product will be
   * judged on» (value-at-risk.md) — and the totals would still look plausible.
   */
  it("attributes an assignment blocked by two causes ONCE, under its primary cause", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING" }),
      reason({ occ: 2, assignment: 1, item: 1, code: "CUSTOMER_MOTIVATED_REFUSAL" }),
    ], [valuation({ assignment: 1, item: 1 })]);

    const uah = out.totalsByCurrency.find((t) => t.currency === "UAH")!;
    expect(uah.assignmentCount).toBe(1);
    expect(uah.netMinorUnits).toBe("100000");

    // CUSTOMER_MOTIVATED_REFUSAL outranks SUPERVISION_SIGNATURE_MISSING in the
    // transcribed precedence, and the assertion derives that rather than
    // restating it, so a change to the array cannot leave this test asserting
    // the old order.
    const expected = PRIMARY_CAUSE_PRECEDENCE.find(
      (c) => c === "CUSTOMER_MOTIVATED_REFUSAL" || c === "SUPERVISION_SIGNATURE_MISSING");
    const holder = out.byCause.filter((r) => r.assignmentCount > 0);
    expect(holder).toHaveLength(1);
    expect(holder[0]!.code).toBe(expected);

    // The other cause keeps its row and its drill-down, and holds no money.
    const other = out.byCause.find((r) => r.code === "SUPERVISION_SIGNATURE_MISSING")!;
    expect(other.assignmentCount).toBe(0);
    expect(other.totalsByCurrency).toEqual([]);
    expect(other.requirementOccurrenceIds).toEqual([OCC(1)]);
  });

  it("sums to the total across causes, per currency and per component", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING" }),
      reason({ occ: 2, assignment: 2, item: 2, code: "CUSTOMER_MOTIVATED_REFUSAL" }),
      reason({ occ: 3, assignment: 3, item: 3, code: "SUPERVISION_SIGNATURE_MISSING" }),
    ], [1, 2, 3].map((n) => valuation({ assignment: n, item: n })));

    const total = sumsPerCurrency(out.totalsByCurrency);
    const partition = sumsPerCurrency(out.byCause.flatMap((r) => r.totalsByCurrency));
    expect([...partition.keys()].sort()).toEqual([...total.keys()].sort());
    for (const [currency, want] of total) expect(partition.get(currency)).toEqual(want);
    expect(total.get("UAH")!.assignments).toBe(3);
  });

  it("reconciles by baseline too, so «within one baseline» is checkable", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING" }),
      reason({ occ: 2, assignment: 2, item: 2, code: "SUPERVISION_SIGNATURE_MISSING" }),
    ], [
      valuation({ assignment: 1, item: 1, contractVersionId: CV1, contractVersionNo: 1 }),
      valuation({ assignment: 2, item: 2, contractVersionId: CV2, contractVersionNo: 2 }),
    ]);

    expect(out.byBaseline.map((b) => b.contractVersionNo).sort()).toEqual([1, 2]);
    const total = sumsPerCurrency(out.totalsByCurrency);
    const perBaseline = sumsPerCurrency(out.byBaseline.flatMap((b) => b.totalsByCurrency));
    for (const [currency, want] of total) expect(perBaseline.get(currency)).toEqual(want);
  });

  /**
   * THE REFUSAL ITSELF. The identity above is enforced by the response schema on
   * every request, not only by this suite, and that is worth proving: a test
   * checks the fixtures somebody thought of, a `superRefine` checks the pilot's
   * own data on the day it is read.
   */
  it("the WIRE refuses a partition that does not add up", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING" }),
    ], [valuation({ assignment: 1, item: 1 })]);
    expect(blockedValueResponse.safeParse(out).success).toBe(true);

    const tampered = structuredClone(out);
    tampered.byCause[0]!.totalsByCurrency[0]!.netMinorUnits = "999999";
    const parsed = blockedValueResponse.safeParse(tampered);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain("does not reconcile");
  });

  it("the WIRE refuses a non-additive view smaller than the additive one", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING" }),
    ], [valuation({ assignment: 1, item: 1 })]);
    const tampered = structuredClone(out);
    tampered.affectedByCause[0]!.totalsByCurrency[0]!.netMinorUnits = "1";
    const parsed = blockedValueResponse.safeParse(tampered);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain("smaller than the additive one");
  });
});

describe("the two views", () => {
  it("the non-additive view counts the assignment under EVERY code blocking it", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING" }),
      reason({ occ: 2, assignment: 1, item: 1, code: "CUSTOMER_MOTIVATED_REFUSAL" }),
    ], [valuation({ assignment: 1, item: 1 })]);

    expect(out.affectedByCause).toHaveLength(2);
    for (const row of out.affectedByCause) {
      expect(row.assignmentCount).toBe(1);
      expect(row.totalsByCurrency[0]!.netMinorUnits).toBe("100000");
    }
    // And the sum of the non-additive view is DELIBERATELY larger than the
    // total. That is why it carries `affectedByCauseIsAdditive: false` on the
    // wire: a renderer that summed it would double the headline.
    const affected = sumsPerCurrency(out.affectedByCause.flatMap((r) => r.totalsByCurrency));
    const total = sumsPerCurrency(out.totalsByCurrency);
    expect(affected.get("UAH")!.net).toBeGreaterThan(total.get("UAH")!.net);
    expect(out.affectedByCauseIsAdditive).toBe(false);
    expect(out.byCauseIsAdditive).toBe(true);
  });

  it("counts three obligations on ONE work as three reasons and ONE amount — INV-070", () => {
    const out = summarise([1, 2, 3].map((n) =>
      reason({ occ: n, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING" })),
      [valuation({ assignment: 1, item: 1 })]);

    expect(out.blockedReasons).toHaveLength(3);
    const row = out.byCause.find((r) => r.code === "SUPERVISION_SIGNATURE_MISSING")!;
    expect(row.occurrenceCount).toBe(3);
    expect(row.assignmentCount).toBe(1);
    expect(out.totalsByCurrency[0]!.netMinorUnits).toBe("100000");
    expect(out.totalsByCurrency[0]!.assignmentCount).toBe(1);
  });
});

describe("currencies are never combined — INV-012", () => {
  it("keeps two currencies in two rows and produces no total of the two", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING",
               money: { currency: "UAH", net: "100000", tax: "20000", gross: "120000" } }),
      reason({ occ: 2, assignment: 2, item: 2, code: "SUPERVISION_SIGNATURE_MISSING",
               money: { currency: "EUR", net: "50000", tax: "10000", gross: "60000" } }),
    ], [
      valuation({ assignment: 1, item: 1, currency: "UAH" }),
      valuation({ assignment: 2, item: 2, currency: "EUR" }),
    ]);

    expect(out.totalsByCurrency.map((t) => t.currency)).toEqual(["EUR", "UAH"]);
    // The shape itself is the guarantee: there is no field anywhere in the
    // payload that could hold a cross-currency figure. Asserted by enumerating
    // the response's own keys, so a later slice that adds `grandTotal` fails
    // here rather than shipping.
    expect(Object.keys(out).sort()).toEqual([
      "affectedByCause", "affectedByCauseIsAdditive", "algorithmVersion", "blockedReasons",
      "byBaseline", "byCause", "byCauseIsAdditive", "calculatedAt", "codeVocabularyVersion",
      "overContract", "performedNotAdmitted", "primaryCausePrecedence", "projectId", "source",
      "totalsByCurrency", "unvaluedAssignmentCount", "unvaluedRegister",
      "zeroPricedAssignmentCount",
    ]);
  });
});

describe("missing price, zero price and over-contract stay distinct", () => {
  it("an unpriced line contributes NO money and a quantity instead — INV-038", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING",
               money: null, attribution: "unvalued", unvaluedQuantity: "5.000000" }),
      reason({ occ: 2, assignment: 2, item: 2, code: "SUPERVISION_SIGNATURE_MISSING" }),
    ], [
      valuation({ assignment: 1, item: 1, unitPriceState: "missing",
                  unvalued: "missing_unit_price" }),
      valuation({ assignment: 2, item: 2 }),
    ]);

    expect(out.unvaluedAssignmentCount).toBe(1);
    // The total holds ONE assignment, not two carrying a zero: folding an
    // unknown price into a sum as zero is how «we do not know» becomes «it is
    // free».
    expect(out.totalsByCurrency[0]!.assignmentCount).toBe(1);
    expect(out.totalsByCurrency[0]!.netMinorUnits).toBe("100000");

    expect(out.unvaluedRegister).toEqual([{
      reason: "missing_unit_price", unitCode: "м", assignmentCount: 1, quantity: "5.000000",
    }]);
    // No money field exists on a register row at all — checked by key, because a
    // later slice adding `netMinorUnits: "0"` here is exactly the regression
    // INV-038 names.
    expect(Object.keys(out.unvaluedRegister[0]!).sort())
      .toEqual(["assignmentCount", "quantity", "reason", "unitCode"]);
  });

  it("a contractually ZERO-priced line is counted apart and IS in the sum", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING",
               money: { currency: "UAH", net: "0", tax: "0", gross: "0" } }),
    ], [valuation({ assignment: 1, item: 1, unitPriceState: "zero" })]);

    expect(out.zeroPricedAssignmentCount).toBe(1);
    expect(out.unvaluedAssignmentCount).toBe(0);
    // «Zero price receives a known monetary value of zero; it participates in
    // reconciliation and state counts.» So the assignment IS counted.
    expect(out.totalsByCurrency[0]!.assignmentCount).toBe(1);
    expect(out.totalsByCurrency[0]!.netMinorUnits).toBe("0");
  });

  it("labels the over-attributing whole-line reading in the totals", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING",
               attribution: "whole_line" }),
      reason({ occ: 2, assignment: 2, item: 2, code: "SUPERVISION_SIGNATURE_MISSING" }),
    ], [
      valuation({ assignment: 1, item: 1, plannedQuantity: null }),
      valuation({ assignment: 2, item: 2 }),
    ]);
    expect(out.totalsByCurrency[0]!.wholeLineAttributionCount).toBe(1);
    expect(out.totalsByCurrency[0]!.assignmentCount).toBe(2);
  });
});

describe("the drill-down", () => {
  it("every cause row names occurrences that are in the response's own reason list", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING" }),
      reason({ occ: 2, assignment: 1, item: 1, code: "CUSTOMER_MOTIVATED_REFUSAL" }),
      reason({ occ: 3, assignment: 2, item: 2, code: "SUPERVISION_SIGNATURE_MISSING" }),
    ], [valuation({ assignment: 1, item: 1 }), valuation({ assignment: 2, item: 2 })]);

    const reachable = new Set(out.blockedReasons.map((r) => r.requirementOccurrenceId));
    for (const row of [...out.byCause, ...out.affectedByCause]) {
      expect(row.requirementOccurrenceIds.length).toBeGreaterThan(0);
      for (const id of row.requirementOccurrenceIds) expect(reachable.has(id)).toBe(true);
    }
    // And the union of the NON-ADDITIVE view is every reason: the additive view
    // may omit occurrences whose code lost the precedence, the affected view may
    // not.
    const seen = new Set(out.affectedByCause.flatMap((r) => r.requirementOccurrenceIds));
    expect([...seen].sort()).toEqual([...reachable].sort());
  });

  it("the WIRE refuses a cause row whose drill-down target does not resolve", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING" }),
    ], [valuation({ assignment: 1, item: 1 })]);
    const tampered = structuredClone(out);
    tampered.byCause[0]!.requirementOccurrenceIds = [OCC(99)];
    const parsed = blockedValueResponse.safeParse(tampered);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain("projection error");
  });
});

describe("the not-admitted bucket travels beside the sum, never inside it", () => {
  it("is labelled non-summable and is absent from totalsByCurrency", () => {
    const pending: NotAdmittedResult = {
      view: {
        bucket: "performed_not_admitted",
        isSummandOfBlockedValue: false,
        lines: [{
          workItemId: ITEM(9), contractId: CONTRACT, unitCode: "м",
          quantity: "4.000000", fundedQuantity: "4.000000", overContractQuantity: "0.000000",
          value: { currency: "UAH", netMinorUnits: "40000", taxMinorUnits: "8000",
                   grossMinorUnits: "48000" },
          unvaluedReason: null, workAssignmentIds: [ASG(9)],
        }],
        totalsByCurrency: [{ currency: "UAH", netMinorUnits: "40000", taxMinorUnits: "8000",
                             grossMinorUnits: "48000", lineCount: 1 }],
        unvaluedLineCount: 0, overContractLineCount: 0,
      },
      overContract: [],
    };
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING" }),
    ], [valuation({ assignment: 1, item: 1 })], pending);

    expect(out.performedNotAdmitted.bucket).toBe("performed_not_admitted");
    expect(out.performedNotAdmitted.isSummandOfBlockedValue).toBe(false);
    // The blocked total is untouched by the bucket: 100000, not 140000. The two
    // OVERLAP by construction — a blocked stage's quantity is also unadmitted —
    // so adding them would double-count the same work.
    expect(out.totalsByCurrency[0]!.netMinorUnits).toBe("100000");
    expect(blockedValueResponse.safeParse(out).success).toBe(true);
  });
});

describe("the precedence itself", () => {
  it("is reported on the wire, in order, so an answer names the rule it used", () => {
    const out = summarise([
      reason({ occ: 1, assignment: 1, item: 1, code: "SUPERVISION_SIGNATURE_MISSING" }),
    ], [valuation({ assignment: 1, item: 1 })]);
    expect(out.primaryCausePrecedence).toEqual([...PRIMARY_CAUSE_PRECEDENCE]);
    expect(out.codeVocabularyVersion).toBe(BLOCKED_REASON_CODE_VOCABULARY_VERSION);
  });

  /**
   * The order is value-at-risk.md's, transcribed. This asserts the two
   * properties that document makes load-bearing — `CLOSED_WITHOUT_ACT` first
   * («moving it would let a bypass be reported as a missing certificate») and
   * every code of the closed vocabulary positioned — rather than the whole
   * array, which would only be a second copy of it.
   */
  it("puts CLOSED_WITHOUT_ACT first and gives all seven codes a position", () => {
    expect(PRIMARY_CAUSE_PRECEDENCE[0]).toBe("CLOSED_WITHOUT_ACT");
    expect(new Set(PRIMARY_CAUSE_PRECEDENCE).size).toBe(7);
  });
});
