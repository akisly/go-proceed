import type { ProjectListRow, ProjectsListResponse } from "@goproceed/contracts";
import { apiGet, isSessionExpired } from "../lib/api";

/**
 * The projects domain's one service module — see `workspaces.service.ts`'s
 * header for why this returns a discriminated result rather than throwing.
 *
 * `GET /v1/projects` is already cross-workspace (that route's own comment:
 * RLS — `projects_select`, an active `project.view`/`project.admin` grant —
 * IS the filter, no workspace id is ever sent), so this service takes no
 * argument and returns exactly what the caller is allowed to see.
 */
export type ProjectsResult =
  | { kind: "ok"; projects: ProjectListRow[] }
  | { kind: "session_expired" }
  | { kind: "error"; error: unknown };

export async function listProjects(): Promise<ProjectsResult> {
  try {
    const { projects } = await apiGet<ProjectsListResponse>("/v1/projects");
    return { kind: "ok", projects };
  } catch (error) {
    if (isSessionExpired(error)) return { kind: "session_expired" };
    return { kind: "error", error };
  }
}
