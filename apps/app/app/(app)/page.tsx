import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import type {
  ListAssignmentsResponse,
  ProjectListRow,
  ProjectsListResponse,
} from "@goproceed/contracts";

import { apiGet, isSessionExpired } from "../../src/lib/api";
import {
  buildMyAssignmentsScreen, failedProjectMessage, rowSubtitle,
  type ProjectAssignments,
} from "../../src/lib/field/assignments";
import { Button } from "@goproceed/ui/components";

/**
 * «Мої доручення» — the screen a foreman lands on the instant he signs in.
 * This file owns the ROOT route ("/"): no `app/page.tsx` existed before this
 * task (task 5's report confirms `/` 404'd after a successful sign-in), and
 * a foreman with no bookmark still needs *something* to land on.
 *
 * A THIN SHELL, AS OF THE FINAL REVIEW (Important 5). Every decision this
 * screen makes — the two distinct empty states, the all-projects-failed
 * fallback, the `showProjectName` rule, the subtitle composition — now lives
 * in `src/lib/field/assignments.ts` and is unit-tested there, matching the
 * pattern `src/lib/field/obligations.ts` set one task earlier and this file
 * had never been brought up to. What remains here is I/O and JSX.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HOW PROJECTS ARE ENUMERATED — there is no "list my projects with my
 * assignments" endpoint. `assignments.list` is per-project
 * (`GET /v1/projects/{projectId}/assignments`), and `/v1/me/context` returns
 * memberships, not projects. `GET /v1/projects` is the one route that answers
 * "which projects can I see" — it takes no workspace or member id from the
 * caller at all; RLS (`projects_select`, requires an active
 * `project.view`/`project.admin` grant) IS the filter, so the response is
 * exactly the set this session is allowed to read. So this page runs two
 * hops: list the projects, then ask each one, in parallel, for
 * `?assignee=me` — never the other way round, since there is no route that
 * would let it be.
 *
 * WHY `?assignee=me` AND NOT A MEMBER ID: the assignments route resolves
 * "me" from the session itself and 422s on any other value by design (see
 * `app/v1/projects/[projectId]/assignments/route.ts`) — a member id on the
 * wire would be a filter one member could point at another, and
 * `meContextResponse` doesn't even carry one for a client to send. Nothing
 * in this file could construct a request that names a member id even if it
 * tried; the only lever offered is "me".
 *
 * WHY ONE FAILED PROJECT CANNOT HIDE THE OTHERS — fix-round-1, task 7,
 * finding 2. The assignments route re-checks `project.view` on every call,
 * so a grant revoked between the two hops (or one transient 500) is a real,
 * expected failure mode for exactly ONE project, not for the whole page. The
 * ORIGINAL version fanned the per-project calls out with a bare
 * `Promise.all`, which rejects the instant any single item rejects — that
 * turned one flaky project into "the foreman sees no assignments anywhere",
 * indistinguishable from him genuinely having none, the worse of the two
 * possible lies a partial outage can tell him. `loadAssignmentsByProject`
 * now catches each project's own fetch INSIDE that project's own async
 * closure and resolves to a `"failed"` entry instead of rejecting, so the
 * still-outer `Promise.all` only ever sees a rejection for the one case that
 * should genuinely abort the page (session expiry — see below). Every
 * project that answered still renders; a project that didn't gets a named,
 * visible notice instead of silent disappearance.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default async function MyAssignmentsPage() {
  let projects: ProjectListRow[];
  try {
    ({ projects } = await apiGet<ProjectsListResponse>("/v1/projects"));
  } catch (err) {
    if (isSessionExpired(err)) redirect(`/login?next=${encodeURIComponent("/")}`);
    return <ErrorState />;
  }

  let byProject: ProjectAssignments[];
  try {
    byProject = await loadAssignmentsByProject(projects);
  } catch (err) {
    // The only way this throws is `loadAssignmentsByProject` re-throwing a
    // 401 one of the per-project fetches hit (see that function): an
    // expired/revoked session, not a per-project problem, and the response
    // is the same bounce-to-sign-in as the `/v1/projects` catch above.
    // Anything else a project's own fetch could fail with (403, 404, 500, a
    // network hiccup) never reaches here — it was already caught and
    // absorbed into a `"failed"` entry below, not re-thrown.
    if (isSessionExpired(err)) redirect(`/login?next=${encodeURIComponent("/")}`);
    return <ErrorState />;
  }

  const screen = buildMyAssignmentsScreen(projects, byProject);

  if (screen.kind === "no_projects") return <EmptyState message={screen.message} />;
  if (screen.kind === "error") return <ErrorState />;

  const failedNotice = screen.failedProjects.length > 0
    ? <FailedProjectsNotice projects={screen.failedProjects} />
    : null;

  if (screen.kind === "empty") {
    return <EmptyState message={screen.message}>{failedNotice}</EmptyState>;
  }

  // No auto-redirect even with exactly one row: a surprise navigation the
  // instant a phone screen finishes loading is worse than one extra tap, and
  // it would also make this page impossible to get back to.
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-8">
      <h1 className="text-h1 font-semibold text-ink">Мої доручення</h1>
      {failedNotice}
      <ul className="flex flex-col gap-3">
        {screen.rows.map((row) => (
          <li key={row.assignmentId}>
            <Link
              href={`/a/${row.assignmentId}`}
              className="flex flex-col gap-1 rounded-panel border border-line bg-surface p-4 transition-colors hover:bg-subtle"
            >
              <span className="text-body font-medium text-ink">{row.description}</span>
              <span className="text-data text-ink-secondary">
                {rowSubtitle(row, screen.showProjectName)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

async function loadAssignmentsByProject(projects: ProjectListRow[]): Promise<ProjectAssignments[]> {
  // Each project's own fetch catches its own failure and resolves to a
  // `"failed"` entry rather than rejecting — see the header comment's "WHY
  // ONE FAILED PROJECT CANNOT HIDE THE OTHERS". That makes a plain
  // `Promise.all` correct and sufficient here (every item settles, except
  // the one case below that deliberately still rejects): no item's failure
  // can abort another item that already answered, without needing
  // `Promise.allSettled` plus a second index-matched pass to recover which
  // project a given rejection belonged to.
  return Promise.all(
    projects.map(async (project): Promise<ProjectAssignments> => {
      try {
        const { assignments } = await apiGet<ListAssignmentsResponse>(
          `/v1/projects/${project.projectId}/assignments?assignee=me`,
        );
        return { status: "ok", project, assignments };
      } catch (err) {
        // An expired/revoked SESSION (401) is not a per-project failure —
        // every other in-flight project would fail the identical way a
        // moment later, and there is nothing project-specific to degrade
        // into. Re-throw instead of masking it as one more `"failed"` row;
        // the caller redirects to sign-in exactly as the top-level
        // `/v1/projects` fetch already does for the same status.
        if (isSessionExpired(err)) throw err;
        return { status: "failed", project };
      }
    }),
  );
}

function EmptyState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-4 py-8">
      <h1 className="text-h1 font-semibold text-ink">Мої доручення</h1>
      <p className="text-body text-ink-secondary">{message}</p>
      {children}
    </main>
  );
}

function ErrorState() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-4 py-8">
      <h1 className="text-h1 font-semibold text-ink">Мої доручення</h1>
      <p className="text-body text-ink-secondary">
        Не вдалося завантажити ваші доручення. Спробуйте ще раз.
      </p>
      <Button asChild variant="outline" className="self-start">
        <Link href="/">Оновити</Link>
      </Button>
    </main>
  );
}

/**
 * `role="alert"` because this is new information about a load failure, not
 * a static label — a screen reader should announce it, not require scanning
 * for it. The sentence itself is `failedProjectMessage`, in the tested
 * module, so the "named, not silently dropped" guarantee is asserted rather
 * than only described.
 */
function FailedProjectsNotice({ projects }: { projects: ProjectListRow[] }) {
  return (
    <ul className="flex flex-col gap-2" role="alert">
      {projects.map((project) => (
        <li
          key={project.projectId}
          className="rounded-panel border border-status-attention-line bg-status-attention p-3 text-data text-status-attention-fg"
        >
          {failedProjectMessage(project)}
        </li>
      ))}
    </ul>
  );
}
