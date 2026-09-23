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
    // NO RUNTIME PARSE HERE, UNLIKE `workspaces.service.ts`'s `getMeContext`:
    // `@goproceed/contracts` exports `meContextResponse` as a zod schema but
    // `ProjectsListResponse`/`ProjectListRow` (this file) are plain
    // TypeScript interfaces — there is no `projectsListResponse` schema to
    // parse with, and inventing one here, in the app, would duplicate a
    // contract this package doesn't yet own. Adding it for real would mean:
    // a `z.object` in `packages/contracts/src/projects.ts` mirroring
    // `ProjectListRow` exactly, `apps/app/app/v1/projects/route.ts` parsing
    // its own response through it before returning (matching
    // `me/context/route.ts`'s pattern), and this call switching from
    // `apiGet<ProjectsListResponse>` to `apiGet<unknown>` + `.parse()`.
    const { projects } = await apiGet<ProjectsListResponse>("/v1/projects");
    return { kind: "ok", projects };
  } catch (error) {
    if (isSessionExpired(error)) return { kind: "session_expired" };
    return { kind: "error", error };
  }
}

/**
 * The name a project page shows in its breadcrumb and heading (DEV-035).
 * Read from the same list the shell's sidebar renders — there is no
 * single-project read — and `null` when the member cannot see the project,
 * so the page decides what to show rather than this helper inventing a name.
 */
export async function getProjectName(projectId: string): Promise<string | null> {
  const result = await listProjects();
  if (result.kind !== "ok") return null;
  return result.projects.find((p) => p.projectId === projectId)?.name ?? null;
}
