import Link from "next/link";
import type { ProjectListRow } from "@goproceed/contracts";

/**
 * `dash/page.tsx`'s landing content once at least one project exists.
 *
 * EACH ROW NOW LINKS TO `/projects/{projectId}` — CHANGED in Plan D
 * slice D2, from the `.../assignments` target Task 5's fix round 1 set. That
 * choice was correct for its own moment: D1 had not built a project detail
 * screen yet, and `.../assignments` was "the closest thing to a project
 * detail view that exists today" (this comment's own earlier wording, kept
 * below in spirit). D2 built the actual one — the blocked-value screen at
 * `app/(dash)/projects/[projectId]/page.tsx` — and the task brief for it is
 * explicit that the project → доручення chain now goes THROUGH the money
 * screen, not around it: "project → money → доручення → докази". The
 * assignments register is still one click away — the new screen's own
 * `ProjectPage` [`ProjectOverviewHeader` until DEV-035] links to it — so nothing this row used to reach is
 * now unreachable, only one hop further in.
 *
 * THE PROJECT NAME IS STILL THE LINK (matching `assignments-list.tsx`'s own
 * row-link pattern) and `project.code` still sits outside it, for the same
 * reason as before: a fact about the row, not part of the control.
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
              href={`/projects/${project.projectId}`}
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
