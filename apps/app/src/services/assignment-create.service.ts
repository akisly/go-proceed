"use client";

import { createAssignmentRequest } from "@goproceed/contracts";
import { apiPost, type FetchLike } from "../lib/api-command";

export interface CreateAssignmentInput {
  contractId: string;
  workItemId: string;
  assigneeMemberId: string;
  plannedQuantity?: string | undefined;
  dueDate?: string | undefined;
}

export type CreateAssignmentResult =
  | { kind: "ok"; assignmentId: string }
  /** Refused by the contract itself, before the network. */
  | { kind: "invalid" }
  | { kind: "session_expired" }
  /**
   * Refused by the server. Carries the WHOLE problem document, unlike
   * `issueReviewLink`'s otherwise identical arm: `fieldErrors` is what puts a
   * message next to the field that caused it, and a `detail`-only arm would
   * throw that away at the one boundary that has it.
   */
  | { kind: "refused"; status: number; problem: unknown; detail: string | null }
  | { kind: "error"; error: unknown };

export async function createAssignment(
  input: CreateAssignmentInput,
  idempotencyKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<CreateAssignmentResult> {
  // An absent optional is OMITTED, never sent as null: `createAssignmentRequest`
  // marks these `.optional()`, and `.strict()` on the request would refuse a
  // null. Building the object conditionally is also what `exactOptionalPropertyTypes`
  // asks for at the type level.
  const body = {
    workItemId: input.workItemId,
    assigneeMemberId: input.assigneeMemberId,
    ...(input.plannedQuantity ? { plannedQuantity: input.plannedQuantity } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
  };

  const parsed = createAssignmentRequest.safeParse(body);
  if (!parsed.success) return { kind: "invalid" };

  let res: Response;
  try {
    res = await apiPost(
      `/v1/contracts/${input.contractId}/assignments`, parsed.data, idempotencyKey, fetchImpl,
    );
  } catch (error) {
    return { kind: "error", error };
  }

  if (res.status === 401) return { kind: "session_expired" };

  let problem: unknown = null;
  try { problem = await res.json(); } catch { /* not JSON; the banner copes */ }

  if (!res.ok) {
    const detail =
      problem && typeof problem === "object" && typeof (problem as { detail?: unknown }).detail === "string"
        ? (problem as { detail: string }).detail
        : null;
    return { kind: "refused", status: res.status, problem, detail };
  }

  const assignmentId =
    problem && typeof problem === "object" ? (problem as { assignmentId?: unknown }).assignmentId : undefined;
  if (typeof assignmentId !== "string" || assignmentId.length === 0) {
    return { kind: "error", error: "assignments.create returned no assignmentId" };
  }
  return { kind: "ok", assignmentId };
}
