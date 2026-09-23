import { readinessResponse, type ReadinessResponse } from "@goproceed/contracts";
import { apiGet, ApiError, isSessionExpired } from "../lib/api";

/**
 * `GET /v1/projects/{id}/readiness` for the project page's readiness block
 * (DEV-035). The same result shape as `blocked-value.service.ts`, so the
 * page can branch on it the same way; the route requires `readiness.view`
 * and `project.view`, so a member who can see the money may still get a 403
 * here, and the page renders the rest without this block.
 */
export type ReadinessResult =
  | { kind: "ok"; readiness: ReadinessResponse }
  | { kind: "session_expired" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "error"; error: unknown };

export async function getReadiness(projectId: string): Promise<ReadinessResult> {
  try {
    const body = await apiGet<unknown>(`/v1/projects/${projectId}/readiness`);
    return { kind: "ok", readiness: readinessResponse.parse(body) };
  } catch (error) {
    if (isSessionExpired(error)) return { kind: "session_expired" };
    if (error instanceof ApiError && error.status === 404) return { kind: "not_found" };
    if (error instanceof ApiError && error.status === 403) return { kind: "forbidden" };
    return { kind: "error", error };
  }
}
