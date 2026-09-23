import { listRequirementOccurrencesWithReferenceImagesResponse, meContextResponse } from "@goproceed/contracts";
import type { VaultItem } from "../vault";
import { QueueRequestError } from "./queue";

interface AuthorizeDependencies {
  get(path: string, signal: AbortSignal): Promise<unknown>;
  /** The subject of the bearer that the next request will carry. */
  currentSubject(): Promise<string | null>;
}

/**
 * Re-reads server authorization before an item is sent. A thrown 401/403
 * quarantines the whole identity in NativeQueue; status 0 fails this item only.
 * Identity-wide: another subject's bearer, a rejected session, the workspace
 * membership gone. Item-only: this project's grant (`project.view` hides the
 * assignment as a 404; `evidence.record` shows as captureAllowed=false or
 * SCOPE_PROJECT_DENIED), workspace or occurrence mismatch, a transient session.
 */
export function createAuthorize(deps: AuthorizeDependencies) {
  /** A 404 is RLS hiding the assignment: tell a lost project from a lost membership. */
  async function membershipLost(item: VaultItem, signal: AbortSignal): Promise<boolean> {
    const context = meContextResponse.safeParse(await deps.get("/v1/me/context", signal));
    if (!context.success) throw new QueueRequestError(0, "ACCESS_RESPONSE_INVALID");
    if (context.data.userId !== item.subjectId) return true;
    return !context.data.memberships.some((m) => m.workspaceId === item.workspaceId && m.status === "active");
  }

  return async (item: VaultItem, signal: AbortSignal): Promise<void> => {
    const subject = await deps.currentSubject();
    // No session right now is a refresh that failed (offline); a real sign-out already quarantined.
    if (subject === null) throw new QueueRequestError(0, "SESSION_UNAVAILABLE");
    if (subject !== item.subjectId) throw new QueueRequestError(401, "SESSION_SUBJECT_CHANGED");
    let body: unknown;
    try {
      body = await deps.get(`/v1/assignments/${item.assignmentId}/requirement-occurrences?referenceImages=v1`, signal);
    } catch (error) {
      if (!(error instanceof QueueRequestError)) throw error;
      if (error.status === 403 && error.code === "SCOPE_PROJECT_DENIED") throw new QueueRequestError(0, "CAPTURE_NOT_ALLOWED");
      if (error.status === 404) {
        if (await membershipLost(item, signal)) throw new QueueRequestError(403, "ACCESS_REVOKED");
        throw new QueueRequestError(0, "ASSIGNMENT_NOT_VISIBLE");
      }
      throw error;
    }
    const access = listRequirementOccurrencesWithReferenceImagesResponse.safeParse(body);
    if (!access.success) throw new QueueRequestError(0, "ACCESS_RESPONSE_INVALID");
    if (access.data.workspaceId !== item.workspaceId) throw new QueueRequestError(0, "WORKSPACE_MISMATCH");
    if (!access.data.captureAllowed) throw new QueueRequestError(0, "CAPTURE_NOT_ALLOWED");
    if (!access.data.occurrences.some((occurrence) => occurrence.occurrenceId === item.occurrenceId)) {
      throw new QueueRequestError(0, "OCCURRENCE_NOT_FOUND");
    }
  };
}
