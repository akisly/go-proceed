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
                ? "flex items-center justify-between gap-4 border-b border-line pr-4"
                : "flex items-center justify-between gap-4 pr-4"
            }
          >
            {/* THE LINK CARRIES THE ROW'S PADDING, NOT THE `<li>` — corrected
             * 2026-08-22 (Plan D slice D1 task 7), and it is an accessibility
             * fix rather than a layout preference. With `px-4 py-3` on the
             * `<li>`, the row measured 44px and the LINK measured 124×20:
             * `qa/field.mjs`'s touch-target audit reported
             * «"Приклад-Обʼєкт QA" 124x20» on every run since this row became
             * a link, and the harness has been red at HEAD ever since —
             * measured, not inferred, by running the base commit's own
             * `field.mjs` unchanged. WCAG 2.5.5's 44px floor is about the
             * TARGET, and the target is the anchor, not the box it sits in.
             * Moving the padding inside it makes the whole row the tap area,
             * which is also what a person aiming at a list row expects.
             * `min-h-(--gp-control-height-touch)` rather than a literal: 44px
             * is a token (`--gp-control-height-touch`), and a hard-coded
             * height stops tracking it the moment it moves. */}
            <Link
              href={`/dash/projects/${project.projectId}/assignments`}
              className="flex min-h-(--gp-control-height-touch) flex-1 items-center py-3 pl-4 text-data font-medium text-ink hover:underline"
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
