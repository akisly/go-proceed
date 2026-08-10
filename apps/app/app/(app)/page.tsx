import { redirect } from "next/navigation";
import Link from "next/link";
import type {
  AssignmentSummary,
  ListAssignmentsResponse,
  ProjectListRow,
  ProjectsListResponse,
} from "@goproceed/contracts";

import { apiGet, ApiError } from "../../src/lib/api";
import { Button } from "../../src/ui/button";

/**
 * «Мої доручення» — the screen a foreman lands on the instant he signs in.
 * This file owns the ROOT route ("/"): no `app/page.tsx` existed before this
 * task (task 5's report confirms `/` 404'd after a successful sign-in), and
 * a foreman with no bookmark still needs *something* to land on.
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
 * ─────────────────────────────────────────────────────────────────────────
 */

type AssignmentRow = AssignmentSummary & { project: ProjectListRow };

export default async function MyAssignmentsPage() {
  let byProject: { project: ProjectListRow; assignments: AssignmentSummary[] }[];
  try {
    byProject = await loadAssignmentsByProject();
  } catch (err) {
    // A 401 here means the session that got him past `middleware.ts` a
    // moment ago is no longer valid by the time this fetch actually ran
    // (expired/revoked mid-render) — rare, but not impossible, and the
    // response contract for it is exactly the one `middleware.ts` already
    // uses: bounce to sign-in, carrying `next` back to this same page ("/"),
    // so the very next successful sign-in lands him right back here rather
    // than on some default. Anything else (403 from a grant pulled between
    // the membership check and the read, 404, 500, a network hiccup) is a
    // problem this page cannot fix by re-authenticating, so it gets ONE
    // fixed Ukrainian sentence — never `err.problem`'s content rendered
    // directly. `ApiError.problem` is typed `unknown` on purpose: every
    // route in this app happens to answer with a Ukrainian `detail` today
    // (all of them funnel through `toProblemResponse`), but "happens to
    // today" is not a guarantee this page should stake a foreman's screen
    // on, and a raw driver message or an English SDK string reaching this
    // render would violate the one rule that has no exception anywhere in
    // this product: every string a foreman reads is Ukrainian.
    if (err instanceof ApiError && err.status === 401) {
      redirect(`/login?next=${encodeURIComponent("/")}`);
    }
    return <ErrorState />;
  }

  // Empty state #1: no project at all. This is a GRANT problem — nobody has
  // given this member `project.view` on anything yet — and the remedy is
  // "ask an admin for access", not "wait, a task will appear". Collapsing
  // this into the same message as "you have projects but no work assigned"
  // would send him to the wrong person.
  if (byProject.length === 0) {
    return <EmptyState message="У вас немає доступу до жодного проєкту. Щоб побачити свої доручення, зверніться до адміністратора — він має надати вам доступ." />;
  }

  const rows: AssignmentRow[] = byProject.flatMap(({ project, assignments }) =>
    assignments.map((a) => ({ ...a, project })),
  );

  // Empty state #2: he has project access but nothing is assigned to him yet.
  // A DIFFERENT problem, a different remedy — "check with whoever assigns
  // work", not "get access". No auto-redirect either way: even with exactly
  // one row below, this list still renders rather than jumping straight to
  // `/a/{id}` — a surprise navigation the instant a phone screen finishes
  // loading is worse than one extra tap, and it would also make this page
  // impossible to get back to.
  if (rows.length === 0) {
    return <EmptyState message="Наразі за вами не закріплено жодного доручення. Якщо вважаєте, що це помилка, зверніться до керівника проєкту." />;
  }

  // A project name is shown per row only once it's actually doing work —
  // i.e. once more than one project is contributing rows. A foreman on a
  // single project gains nothing from seeing its name repeated on every
  // line; a foreman split across two sites needs it to tell the rows apart.
  const distinctProjectsWithWork = new Set(rows.map((r) => r.project.projectId)).size;
  const showProjectName = distinctProjectsWithWork > 1;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-8">
      <h1 className="text-h1 font-display font-semibold text-foreground">Мої доручення</h1>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.assignmentId}>
            <Link
              href={`/a/${row.assignmentId}`}
              // `/a/{id}` doesn't exist until task 8. That's expected, not a
              // bug in this task — the link is still the correct target.
              className="flex flex-col gap-1 rounded-panel border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
            >
              <span className="text-body font-medium text-foreground">{row.description}</span>
              <span className="text-data text-foreground-secondary">
                {[row.workCode, row.unitCode, showProjectName ? row.project.name : null]
                  .filter((part): part is string => Boolean(part))
                  .join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

async function loadAssignmentsByProject(): Promise<
  { project: ProjectListRow; assignments: AssignmentSummary[] }[]
> {
  const { projects } = await apiGet<ProjectsListResponse>("/v1/projects");
  // In parallel, not sequentially: a foreman's project count is small in
  // practice, but there is no reason to pay N round trips serially when the
  // route has nothing to gain from ordering here — the display order is
  // decided afterward, from the assembled rows, not from fetch order.
  return Promise.all(
    projects.map(async (project) => {
      const { assignments } = await apiGet<ListAssignmentsResponse>(
        `/v1/projects/${project.projectId}/assignments?assignee=me`,
      );
      return { project, assignments };
    }),
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-4 py-8">
      <h1 className="text-h1 font-display font-semibold text-foreground">Мої доручення</h1>
      <p className="text-body text-foreground-secondary">{message}</p>
    </main>
  );
}

function ErrorState() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-4 py-8">
      <h1 className="text-h1 font-display font-semibold text-foreground">Мої доручення</h1>
      <p className="text-body text-foreground-secondary">
        Не вдалося завантажити ваші доручення. Спробуйте ще раз.
      </p>
      <Button asChild variant="outline" className="self-start">
        <Link href="/">Оновити</Link>
      </Button>
    </main>
  );
}
