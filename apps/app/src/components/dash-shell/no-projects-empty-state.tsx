import { EmptyState } from "@goproceed/ui/components";

/**
 * `dash/page.tsx` renders this when `GET /v1/projects` returns none for a
 * workspace that does exist — the exact copy named in `task-2-brief.md`,
 * catalogued as `dash.empty.no_projects_title` / `dash.empty.no_projects`.
 */
export function NoProjectsEmptyState() {
  return (
    <EmptyState
      className="mx-auto max-w-md py-16"
      title="Немає проєктів"
      description="У цьому просторі ще немає проєктів."
    />
  );
}
