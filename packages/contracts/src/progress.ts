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

export interface RecordProgressResponse {
  progressEntryId: string;
  effectiveQuantity: string;
  allocation: AllocationView;
}
