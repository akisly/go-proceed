import { EmptyState } from "@goproceed/ui/components";

/**
 * `app/dash/projects/[projectId]/assignments/page.tsx` renders this when
 * `GET /v1/projects/{projectId}/assignments` returns none for a project that
 * does exist — the exact copy named in `task-5-brief.md`, catalogued as
 * `dash.empty.no_assignments_title` / `dash.empty.no_assignments`. Mirrors
 * `dash-shell/no-projects-empty-state.tsx`'s shape one level down: a project,
 * not a workspace, is what turned out to be empty.
 */
export function NoAssignmentsEmptyState() {
  return (
    <EmptyState
      className="mx-auto max-w-md py-16"
      title="Немає доручень"
      description="У цьому проєкті ще немає доручень."
    />
  );
}
