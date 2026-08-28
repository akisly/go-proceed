import type { AssignmentSummary, ListAssignmentsResponse } from "@goproceed/contracts";
import { apiGet, isSessionExpired } from "../lib/api";
import { createAssignmentRequest } from "@goproceed/contracts";
import { apiPost, type FetchLike } from "../lib/api";

/**
 * The assignments domain's one service module — see `workspaces.service.ts`'s
 * header for why this returns a discriminated result rather than throwing.
 *
 * PER-PROJECT, NOT CROSS-WORKSPACE. Unlike `projects.service.ts`'s
 * `listProjects()`, `GET /v1/projects/{projectId}/assignments` takes a
 * resource id: the route resolves the project with no workspace predicate
 * (RLS supplies it), reads `workspace_id` off that row, then checks
 * `project.view` — see
 * `apps/app/app/v1/projects/[projectId]/assignments/route.ts`. No `?assignee`
 * filter is sent: that query param exists on the route for the field client's
 * "my assignments" view (`app/(app)/page.tsx`'s `?assignee=me`), but this
 * screen is the office register — every assignment on the project, not one
 * member's own.
 */
export type AssignmentsResult =
  | { kind: "ok"; assignments: AssignmentSummary[] }
  | { kind: "session_expired" }
  | { kind: "error"; error: unknown };

export async function listAssignments(projectId: string): Promise<AssignmentsResult> {
  try {
    // NO RUNTIME PARSE HERE, UNLIKE `workspaces.service.ts`'s `getMeContext` —
    // same reasoning `projects.service.ts` already recorded for its own
    // `ProjectsListResponse`: `@goproceed/contracts` exports
    // `ListAssignmentsResponse`/`AssignmentSummary` (`packages/contracts/src/
    // assignments.ts`) as plain TypeScript interfaces, not a zod schema, so
    // there is nothing to `.parse()` against. Adding one for real would mean:
    // an `assignmentSummary`/`listAssignmentsResponse` `z.object` in that
    // file, `apps/app/app/v1/projects/[projectId]/assignments/route.ts`
    // parsing its own response through it before returning (matching
    // `me/context/route.ts`'s pattern), and this call switching from
    // `apiGet<ListAssignmentsResponse>` to `apiGet<unknown>` + `.parse()`.
    const { assignments } = await apiGet<ListAssignmentsResponse>(
      `/v1/projects/${projectId}/assignments`,
    );
    return { kind: "ok", assignments };
  } catch (error) {
    if (isSessionExpired(error)) return { kind: "session_expired" };
    return { kind: "error", error };
  }
}

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
