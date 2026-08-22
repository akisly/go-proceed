import { assignmentEvidenceResponse, type AssignmentEvidenceResponse } from "@goproceed/contracts";
import { apiGet, isSessionExpired } from "../lib/api";

/**
 * The evidence domain's one service module — see `workspaces.service.ts`'s
 * header for why this returns a discriminated result rather than throwing.
 *
 * PARSED THROUGH `assignmentEvidenceResponse`, NOT JUST CAST — the task
 * brief's own instruction, and the same reasoning `getMeContext`
 * (`workspaces.service.ts`) already gives for `meContextResponse`:
 * `apiGet`'s `<T>` is a compile-time assertion only, and asserts nothing
 * about what the network actually returned. `assignmentEvidenceResponse` IS
 * a zod schema (`packages/contracts/src/evidence.ts`, matching
 * `evidenceObjectView`'s own `.strict()`), so — unlike `listAssignments` /
 * `listProjects`, which stay cast-only because their contracts are plain
 * TypeScript interfaces with no schema to parse against — this call has one
 * to actually run.
 *
 * NO ARGUMENT BEYOND `assignmentId`. The route
 * (`app/v1/assignments/[assignmentId]/evidence/route.ts`) resolves
 * `workspace_id`/`project_id` off the assignment row itself (RLS plus
 * `project.view`) and needs nothing else from the caller.
 */
export type EvidenceResult =
  | { kind: "ok"; evidence: AssignmentEvidenceResponse }
  | { kind: "session_expired" }
  | { kind: "error"; error: unknown };

export async function listEvidenceByAssignment(assignmentId: string): Promise<EvidenceResult> {
  try {
    const body = await apiGet<unknown>(`/v1/assignments/${assignmentId}/evidence`);
    const evidence = assignmentEvidenceResponse.parse(body);
    return { kind: "ok", evidence };
  } catch (error) {
    if (isSessionExpired(error)) return { kind: "session_expired" };
    return { kind: "error", error };
  }
}
