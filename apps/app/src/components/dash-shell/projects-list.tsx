import Link from "next/link";
import type { ProjectListRow } from "@goproceed/contracts";

/**
 * `dash/page.tsx`'s landing content once at least one project exists.
 *
 * EACH ROW NOW LINKS TO `/dash/projects/{projectId}/assignments` — added in
 * Task 5's fix round 1, at the reviewer's own correction: this list is the
 * middle of the project → assignments → evidence chain the whole D1 slice
 * exists for, and a screen reachable only by typing a UUID into the URL bar
 * is not delivered. THIS IS NOT THE SAME CASE `Sidebar`'s disabled nav items
 * are — those point at slices that do not exist yet, which is why they are
 * disabled controls rather than links. `/dash/projects/{projectId}/
 * assignments` exists as of `b31b82f` (this same task's own commit), so
 * linking to it is wiring a route that is already there, not staging a dead
 * end.
 *
 * ASSIGNMENTS, NOT A GENERAL PROJECT DETAIL PAGE, because there is no general
 * one yet — `docs/design/04-role-pain-map.md` screen 5 ("Projects — list +
 * detail shell") is itself a later, unbuilt screen. Assignments is the
 * closest thing to a project detail view that exists today, so the project
 * NAME is the link (matching `assignments-list.tsx`'s own row-link pattern:
 * the existing text becomes clickable, no added label). `project.code` sits
 * outside the link, same as `assignments-list.tsx`'s `workCode` sub-label
 * sits outside its row's link — a fact about the row, not part of the
 * control. No new catalog row: the link carries the project's own name, which
 * is server data, not a new static Ukrainian string.
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
            <Link
              href={`/dash/projects/${project.projectId}/assignments`}
              className="text-data font-medium text-ink hover:underline"
            >
              {project.name}
            </Link>
            {project.code && (
              <span className="text-meta text-ink-muted">{project.code}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
