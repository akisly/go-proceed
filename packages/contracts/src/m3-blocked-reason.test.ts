import { describe, it, expect } from "vitest";
import {
  BLOCKED_REASON_CODE_VOCABULARY_VERSION, blockedReason, blockedReasonsResponse,
  holdPointBlockedDetails,
} from "./index";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. It was written with no node_modules,
 * no database and no docker available: `vitest` and `tsc` were never run against
 * it, and no claim is made that any assertion below passes. Static reading is
 * the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M3, the wire: EVERY REFUSAL NAMES THE MONEY.
 *
 * version-0.1.md §M3: «every refusal names the requirement, the missing
 * evidence, the role that owes the decision, and the money that waits». The
 * table says the same thing as a constraint —
 * `blocked_reasons_names_money_check` (migration 0045:1396-1397) is
 * `net_minor_units is not null or unvalued_quantity is not null` — and until
 * 2026-08-08 the contract did not: `blockedValue` and `unvaluedQuantity` were
 * independently nullable, so an object naming NEITHER passed the schema and
 * could not have been stored (M3 pre-landing review finding 6). A foreman was
 * shown a block with a blank amount, which reads as «this is worth nothing»
 * rather than as «this figure is broken».
 *
 * What is asserted here is the REQUIRED behaviour — the refusal, on all three
 * surfaces the object reaches a human through — and not the shape the code
 * happens to have.
 */

const VALUED = {
  requirementOccurrenceId: "11111111-1111-1111-1111-111111111111",
  ruleVersionId: "22222222-2222-2222-2222-222222222222",
  workAssignmentId: "33333333-3333-3333-3333-333333333333",
  workStageId: "44444444-4444-4444-4444-444444444444",
  stageKey: "prykhovani-roboty",
  workItemId: "55555555-5555-5555-5555-555555555555",
  code: "SUPERVISION_SIGNATURE_MISSING" as const,
  codeVocabularyVersion: BLOCKED_REASON_CODE_VOCABULARY_VERSION,
  missingEvidence: [],
  awaitingApproverRole: "technical_supervisor",
  since: "2026-08-08T09:00:00.000Z",
  blockedValue: {
    currency: "UAH",
    netMinorUnits: "100000", taxMinorUnits: "20000", grossMinorUnits: "120000",
  },
  unvaluedQuantity: null,
  valueAttribution: "whole_line" as const,
  acceptanceCriterion: "Приклад-критерій приймання.",
  normRef: null,
};

/** The other lawful half of the disjunction: no price, so the size is a quantity. */
const UNVALUED = {
  ...VALUED,
  blockedValue: null,
  unvaluedQuantity: "10.000000",
  valueAttribution: "unvalued" as const,
};

/** The row the table refuses and the wire used to admit. */
const SILENT = { ...VALUED, blockedValue: null, unvaluedQuantity: null };

describe("blockedReason names the money or the quantity", () => {
  it("admits a valued block", () => {
    expect(blockedReason.parse(VALUED).blockedValue?.grossMinorUnits).toBe("120000");
  });

  it("admits an unvalued block that names its quantity", () => {
    // INV-038: missing price is unvalued, never zero. A `0` here would be the
    // defect this branch exists to prevent, so the branch has to stay lawful.
    expect(blockedReason.parse(UNVALUED).unvaluedQuantity).toBe("10.000000");
  });

  it("REFUSES a block that names neither, and says which rule it broke", () => {
    const res = blockedReason.safeParse(SILENT);
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues.some((i) => i.message.includes("INV-038"))).toBe(true);
  });

  it("admits a block that names both, exactly as the table does", () => {
    // `blocked_reasons_names_money_check` is an OR and not an exclusive one.
    // Refusing this here would make the wire stricter than the storage, which is
    // how a route ends up producing 500s for rows the database would take.
    expect(blockedReason.safeParse({ ...VALUED, unvaluedQuantity: "10.000000" }).success)
      .toBe(true);
  });
});

describe("the three surfaces the object reaches a human through", () => {
  it("refuses it inside the HOLD_POINT_BLOCKED body", () => {
    // `stage_closures.create` parses its own refusal before throwing it, so a
    // money-less reason fails in the route that built it rather than on the
    // screen that renders it.
    const details = {
      workStageId: VALUED.workStageId,
      workAssignmentId: VALUED.workAssignmentId,
      stageKey: VALUED.stageKey,
      blockingOccurrenceCount: 2,
      unsatisfiedOccurrenceCount: 1,
      blockedReasons: [SILENT],
    };
    expect(holdPointBlockedDetails.safeParse(details).success).toBe(false);
    expect(holdPointBlockedDetails.safeParse({ ...details, blockedReasons: [VALUED] }).success)
      .toBe(true);
  });

  it("refuses it inside blocked_reasons.get", () => {
    const body = {
      projectId: "66666666-6666-6666-6666-666666666666",
      source: "computed" as const,
      algorithmVersion: "v0.1-m3",
      calculatedAt: "2026-08-08T09:00:00.000Z",
      blockedReasons: [SILENT],
      byCode: [{ code: "SUPERVISION_SIGNATURE_MISSING" as const, occurrenceCount: 1 }],
      totalsByCurrency: [],
      unvaluedAssignmentCount: 0,
    };
    expect(blockedReasonsResponse.safeParse(body).success).toBe(false);

    // The same body with the same object VALUED parses — so the failure above is
    // the money rule and not some other field of the response.
    expect(blockedReasonsResponse.safeParse({
      ...body,
      blockedReasons: [VALUED],
      totalsByCurrency: [{
        currency: "UAH", netMinorUnits: "100000", taxMinorUnits: "20000",
        grossMinorUnits: "120000", assignmentCount: 1, wholeLineAttributionCount: 1,
      }],
    }).success).toBe(true);
  });
});
