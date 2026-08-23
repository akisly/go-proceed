import type { AssignmentSummary, ListAssignmentsResponse } from "@goproceed/contracts";
import { apiGet, isSessionExpired } from "../lib/api";

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
