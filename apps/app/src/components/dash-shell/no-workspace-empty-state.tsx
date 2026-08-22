import { EmptyState } from "@goproceed/ui/components";

/**
 * `dash/layout.tsx` renders this in place of `children` when the signed-in
 * user has zero workspace memberships — the exact copy named in
 * `task-2-brief.md`, catalogued as `dash.empty.no_workspace_title` /
 * `dash.empty.no_workspace`.
 */
export function NoWorkspaceEmptyState() {
  return (
    <EmptyState
      className="mx-auto max-w-md py-16"
      title="Немає робочого простору"
      description="У вас ще немає робочого простору."
    />
  );
}
