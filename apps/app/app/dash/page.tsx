import { redirect } from "next/navigation";
import type { ProjectListRow, ProjectsListResponse } from "@goproceed/contracts";
import { EmptyState } from "@goproceed/ui/components";

import { apiGet, isSessionExpired } from "../../src/lib/api";

/**
 * `/dash`'s own index — the shell's landing content once a workspace exists
 * (the "no workspace" case is handled one level up, in `layout.tsx`, since
 * that is where the membership data already lives).
 *
 * D0 ONLY: a plain list of project names, not a link to `/dash/p/{id}` or
 * anywhere else. Those detail routes are D-later slices and do not exist —
 * `docs/design/04-role-pain-map.md` screen 5 ("Projects — list + detail
 * shell") is not this task. Rendering a real `<Link>` to a route that 404s
 * would be exactly the "disabled item as a dead link" mistake this plan
 * explicitly rules out for the nav items; a project row gets the same
 * discipline, so these are plain text rows, not anchors.
 */
export default async function DashIndexPage() {
  let projects: ProjectListRow[];
  try {
    ({ projects } = await apiGet<ProjectsListResponse>("/v1/projects"));
  } catch (err) {
    if (isSessionExpired(err)) redirect(`/login?next=${encodeURIComponent("/dash")}`);
    return <PageLoadError />;
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        className="mx-auto max-w-md py-16"
        title="Немає проєктів"
        description="У цьому просторі ще немає проєктів."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-6">
      <h1 className="text-h1 font-semibold text-ink">Проєкти</h1>
      <ul className="flex flex-col rounded-panel border border-line bg-surface">
        {projects.map((project, i) => (
          <li
            key={project.projectId}
            className={
              i < projects.length - 1
                ? "flex items-center justify-between gap-4 border-b border-line px-4 py-3"
                : "flex items-center justify-between gap-4 px-4 py-3"
            }
          >
            <span className="text-data font-medium text-ink">{project.name}</span>
            {project.code && (
              <span className="text-meta text-ink-muted">{project.code}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PageLoadError() {
  return (
    <div className="flex items-center justify-center p-16">
      <p className="max-w-sm text-center text-data text-ink-muted">
        Не вдалося завантажити проєкти. Спробуйте ще раз.
      </p>
    </div>
  );
}
