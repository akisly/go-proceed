import { z } from "zod";

/** Decimal on the wire, never a JS number — the same reason money is bigint. */
const decimal = z.string().regex(/^\d+(\.\d{1,6})?$/);

export const createAssignmentRequest = z.object({
  workItemId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  performerPartyId: z.string().uuid().optional(),
  assigneeMemberId: z.string().uuid().optional(),
  plannedQuantity: decimal.optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  requirementTemplateVersionId: z.string().uuid().optional(),
}).strict();
export type CreateAssignmentRequest = z.infer<typeof createAssignmentRequest>;

export interface CreateAssignmentResponse { assignmentId: string; version: number }

export interface AssignmentSummary {
  assignmentId: string;
  workItemId: string;
  workCode: string | null;
  description: string;
  unitCode: string;
  plannedQuantity: string | null;
  effectiveQuantity: string;
  status: string;
  requirementTemplateVersionId: string | null;
}
export interface ListAssignmentsResponse { assignments: AssignmentSummary[] }
