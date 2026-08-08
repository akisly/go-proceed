import { z } from "zod";
import type { AllocationView } from "./progress";

/** Signed decimal on the wire; the sign is the whole point of an adjustment. */
const signedDecimal = z.string().regex(/^-?\d+(\.\d{1,6})?$/);

export const adjustProgressRequest = z.object({
  quantity: signedDecimal,
  reasonCode: z.string().trim().min(1).max(100),
  recordedAt: z.string().datetime({ offset: true }).optional(),
}).strict();
export type AdjustProgressRequest = z.infer<typeof adjustProgressRequest>;

interface AdjustProgressBase {
  adjustmentEntryId: string;
  rootProgressEntryId: string;
  effectiveRootQuantity: string;
}

/**
 * A CORRECTION TO ADMITTED QUANTITY MOVES MONEY. A CORRECTION TO UNADMITTED
 * QUANTITY HAS NO MONEY TO MOVE, AND THE RESPONSE MUST NOT PRETEND OTHERWISE.
 *
 * ADR-008 moved the carve out of `progress.record` and into admission — in v0.1,
 * the stage closure. `progress.adjust` kept its unconditional carve, and that
 * left a route around the gate that needed no stage, no closure and no decision:
 * record `0.000001`, then adjust `+9.999999`, and the adjustment drew
 * essentially the whole pool with `admitted_by_closure_id` NULL. INV-089 (P0)
 * says performed quantity is recorded UNVALUED until admission, and it was not.
 *
 * So the carve is now GATED on the root already carrying an allocation, and the
 * response is a discriminated union rather than a nullable field:
 *
 *   * `admitted: true`  — the root holds money; the correction re-proportions
 *     within that root's own lineage and `allocation` says how much moved.
 *   * `admitted: false` — the root holds none; NO allocation row is written and
 *     the `allocation` KEY IS ABSENT.
 *
 * The key is absent for the same reason `progress.record`'s is (see
 * `./progress.ts`): a `null` allocation reads as «unvalued», the state INV-038
 * reserves for a line whose price is unknown, and a corrected unadmitted
 * quantity is priced perfectly well and has simply not passed the gate. An
 * `allocation` of all-zeroes would have been worse still — it asserts that money
 * was considered and came to nothing.
 *
 * THIS IS A BREAKING CHANGE TO A DEPLOYED ROUTE, in the same shape and for the
 * same decision as ADR-008's change to `progress.record`'s 201.
 *
 * WHAT THIS DOES NOT DECIDE, restated so the union is not read as deciding it:
 * ADR-008 §"What this ADR does not decide" still owes «whether an
 * admitted-then-corrected quantity releases its allocation, and by what
 * command». The `admitted: true` arm keeps today's answer — the correction
 * carves immediately, with `admitted_by_closure_id` NULL — and changes nothing
 * about it.
 */
export interface AdjustProgressAdmittedResponse extends AdjustProgressBase {
  admitted: true;
  allocation: AllocationView;
}

export interface AdjustProgressUnadmittedResponse extends AdjustProgressBase {
  admitted: false;
}

export type AdjustProgressResponse =
  | AdjustProgressAdmittedResponse
  | AdjustProgressUnadmittedResponse;
