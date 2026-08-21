// PORT of apps/app/src/lib/field/assignments.ts — byte-identical logic and copy. Transitional duplication under ADR-009: the PWA original retires when the Expo client passes the parity gate; until then fix bugs in BOTH files.

// Inlined from @goproceed/contracts (not a mobile app dependency)
interface ProjectListRow {
  projectId: string;
  workspaceId: string;
  name: string;
  code: string | null;
}

interface AssignmentSummary {
  assignmentId: string;
  workItemId: string;
  workCode: string | null;
  description: string;
  unitCode: string;
  plannedQuantity: string | null;
  effectiveQuantity: string;
  status: string;
  requirementTemplateVersionId: string | null;
  assigneeMemberId: string | null;
}

/**
 * «МОЇ ДОРУЧЕННЯ» — the screen a foreman lands on the instant he signs in,
 * with every decision it makes moved out of the JSX and into here.
 *
 * WHY THIS FILE EXISTS AT ALL (final whole-branch review, Important 5).
 * `app/(app)/page.tsx` was ~252 lines of real decisions — the per-project
 * catch, two distinct empty states with two different remedies, the failed-
 * project notice, the `showProjectName` rule — with no unit test, no
 * integration test and no browser coverage: `qa/field.mjs` visited `/` only
 * UNAUTHENTICATED and then jumped straight to `/a/{id}` via `?next=`. The
 * authenticated list screen had never been rendered by anything. It was also
 * the branch's clearest abstraction drift: `src/lib/field/obligations.ts`
 * established the pure-core pattern one task earlier (decisions in a tested
 * module, dumb component) and it was never applied backwards to this screen.
 *
 * The pattern is `obligations.ts`'s, for the same stated reason: `apps/app`
 * runs Node-only vitest with no jsdom, so a decision left in JSX can only be
 * proven by eye. `page.tsx` now fetches, calls `buildMyAssignmentsScreen`, and
 * renders exactly what comes back.
 *
 * WHAT STAYS IN `page.tsx`, on purpose: the two `apiGet` calls and the
 * per-project `try`/`catch` that turns one project's failure into a `"failed"`
 * entry. That is I/O and error classification against a live session, not a
 * decision about what to show; the classification predicate itself
 * (`isSessionExpired`) lives in `src/lib/api.ts` and is tested there.
 */

/**
 * One project's answer to "what is assigned to me here". `"failed"` is a real,
 * expected outcome, not an error case to swallow: the assignments route
 * re-checks `project.view` on every call, so a grant revoked between the two
 * hops — or one transient 500 — degrades exactly one project.
 */
export type ProjectAssignments =
  | { status: "ok"; project: ProjectListRow; assignments: AssignmentSummary[] }
  | { status: "failed"; project: ProjectListRow };

export type AssignmentRow = AssignmentSummary & { project: ProjectListRow };

/**
 * The four things this screen can be. A closed union rather than a bag of
 * booleans, so `page.tsx` cannot render two of them at once and cannot forget
 * one: the two empty states in particular are DIFFERENT SCREENS with different
 * remedies, and collapsing them was the mistake this shape prevents.
 */
export type MyAssignmentsScreen =
  | { kind: "no_projects"; message: string }
  | { kind: "error" }
  | { kind: "empty"; message: string; failedProjects: ProjectListRow[] }
  | {
      kind: "list";
      rows: AssignmentRow[];
      /** See `buildMyAssignmentsScreen` — true only once it earns its place. */
      showProjectName: boolean;
      failedProjects: ProjectListRow[];
    };

/**
 * EMPTY STATE #1 — a GRANT problem. Nobody has given this member
 * `project.view` on anything yet, and the remedy is "ask an administrator",
 * not "wait, a task will appear". Collapsing this into the same message as
 * empty state #2 would send a foreman to the wrong person.
 */
export const NO_PROJECTS_MESSAGE =
  "У вас немає доступу до жодного проєкту. Щоб побачити свої доручення, зверніться до "
  + "адміністратора — він має надати вам доступ.";

/**
 * EMPTY STATE #2 — an ASSIGNMENT problem. He can see projects; none of them
 * has work booked to him. A different remedy: whoever assigns work, not
 * whoever grants access.
 */
export const NO_ASSIGNMENTS_MESSAGE =
  "Наразі за вами не закріплено жодного доручення. Якщо вважаєте, що це помилка, "
  + "зверніться до керівника проєкту.";

/**
 * A degraded project stays NAMED. Without this a project whose assignments
 * call failed is visually identical to a project that genuinely has no work
 * assigned right now, and the foreman has no way to tell "go check that site,
 * its list is unknown" from "confirmed nothing to do there".
 */
export function failedProjectMessage(project: ProjectListRow): string {
  return `Не вдалося завантажити доручення за проєктом «${project.name}». Спробуйте оновити сторінку.`;
}

export function buildMyAssignmentsScreen(
  projects: ProjectListRow[],
  byProject: ProjectAssignments[],
): MyAssignmentsScreen {
  if (projects.length === 0) {
    return { kind: "no_projects", message: NO_PROJECTS_MESSAGE };
  }

  const ok = byProject.filter(
    (p): p is Extract<ProjectAssignments, { status: "ok" }> => p.status === "ok",
  );
  const failedProjects = byProject
    .filter((p): p is Extract<ProjectAssignments, { status: "failed" }> => p.status === "failed")
    .map((p) => p.project);

  // EVERY project failed: there is nothing left to degrade gracefully into.
  // This is the same generic failure the top-level `/v1/projects` catch would
  // have shown, discovered one layer later. Note the guard is on `ok.length`,
  // not on `failedProjects.length === projects.length` — a `byProject` that
  // came back short for any other reason lands here too, which is the safe
  // direction: better a "try again" than a confident empty list.
  if (ok.length === 0) return { kind: "error" };

  const rows: AssignmentRow[] = ok.flatMap(({ project, assignments }) =>
    assignments.map((a) => ({ ...a, project })),
  );

  // Every project that answered has no work assigned. Any project that FAILED
  // is surfaced alongside rather than folded in: "no assignments" and "one
  // site's list is unknown" are not the same claim, and only the first is
  // actually true here.
  if (rows.length === 0) {
    return { kind: "empty", message: NO_ASSIGNMENTS_MESSAGE, failedProjects };
  }

  // A project name is shown per row only once it is actually doing work — i.e.
  // once more than one project is CONTRIBUTING ROWS. A foreman on a single
  // project gains nothing from seeing its name repeated on every line; a
  // foreman split across two sites needs it to tell the rows apart. Counted
  // over the rows, not over `projects` or over `ok`: a second project that
  // answered with an empty list changes nothing about telling these rows
  // apart.
  const distinctProjectsWithWork = new Set(rows.map((r) => r.project.projectId)).size;

  return {
    kind: "list",
    rows,
    showProjectName: distinctProjectsWithWork > 1,
    failedProjects,
  };
}

/**
 * The secondary line under each row: work code, unit, and the project name
 * only when `showProjectName` says it earns its place. Blank parts are dropped
 * rather than rendered as empty separators — `workCode` and `unitCode` are
 * both nullable on the wire.
 */
export function rowSubtitle(row: AssignmentRow, showProjectName: boolean): string {
  return [row.workCode, row.unitCode, showProjectName ? row.project.name : null]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
