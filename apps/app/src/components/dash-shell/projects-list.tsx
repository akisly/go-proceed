import type { ProjectListRow } from "@goproceed/contracts";

/**
 * `dash/page.tsx`'s landing content once at least one project exists — a
 * plain list of project names, D0 only. NOT a link to `/dash/p/{id}` or
 * anywhere else: those detail routes are D-later slices and do not exist yet
 * (`docs/design/04-role-pain-map.md` screen 5), so these are plain text
 * rows rather than an anchor to a route that would 404 — the same
 * discipline `Sidebar`'s disabled nav items hold to.
 */
export function ProjectsList({ projects }: { projects: ProjectListRow[] }) {
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
