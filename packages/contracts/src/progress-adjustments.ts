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

export interface AdjustProgressResponse {
  adjustmentEntryId: string;
  rootProgressEntryId: string;
  effectiveRootQuantity: string;
  allocation: AllocationView;
}
