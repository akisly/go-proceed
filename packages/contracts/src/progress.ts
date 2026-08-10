import { z } from "zod";

/** Decimal on the wire, never a JS number — the same reason money is bigint. */
const positiveDecimal = z.string().regex(/^\d+(\.\d{1,6})?$/);

export const recordProgressRequest = z.object({
  quantity: positiveDecimal,
  recordedAt: z.string().datetime({ offset: true }).optional(),
}).strict();
export type RecordProgressRequest = z.infer<typeof recordProgressRequest>;

export interface AllocationView {
  valued: boolean;
  netMinorUnits: string | null;
  taxMinorUnits: string | null;
  grossMinorUnits: string | null;
  unvaluedReason: string | null;
}

/**
 * THE 201 NO LONGER CARRIES ALLOCATION FIGURES, AND THAT IS ADR-008.
 *
 * `progress.record` shipped in v0.1-M2-A carving money in the same transaction
 * that recorded the quantity, and returned net/tax/gross on the receipt.
 * ADR-008 (Approved, 2026-08-07) moves the carve to ADMISSION — in v0.1 the
 * stage-closure command — so there is nothing left to return at record time:
 * «The plan's narrower fix — returning net/tax/gross minor units to the v0.1
 * caller — is superseded: after this decision there is nothing to return at
 * record time.»
 *
 * The field is REMOVED rather than nulled. A `null` allocation would be read as
 * «unvalued» — the state INV-038 reserves for a line whose price is unknown — and
 * the two are opposites: a recorded-and-unadmitted quantity is priced perfectly
 * well, it simply has not passed the gate. `AllocationView` itself stays, because
 * `progress.adjust` still returns one and the admission receipt of
 * `stage_closures.create` carries the same shape.
 *
 * THIS IS A BREAKING CHANGE TO A DEPLOYED ROUTE and ADR-008 §Consequences names
 * it as such: «A caller that reads the 201 body for allocation figures will stop
 * receiving them.» The state a caller now sees is «performed, priced, and not
 * allocated», which ADR-008 says the value-at-risk projection owes a bucket and
 * `blocked_value.get` (M6) owes a line; INV-089 records it in
 * `technical/database/invariant-catalog.csv`.
 */
export interface RecordProgressResponse {
  progressEntryId: string;
  effectiveQuantity: string;
  /**
   * Always `false` in v0.1 after ADR-008, and present so the absence is a stated
   * fact rather than a missing key a client has to interpret. It becomes
   * meaningful again only if a superseding ADR moves the carve back, which the
   * replacement rule requires an ADR for.
   */
  admitted: false;
}
