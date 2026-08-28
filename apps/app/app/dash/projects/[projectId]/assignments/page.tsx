import { redirect } from "next/navigation";

import { listAssignments } from "../../../../../src/services/assignments.service";
import { NoAssignmentsEmptyState } from "../../../../../src/components/assignments/no-assignments-empty-state";
import { AssignmentsList } from "../../../../../src/components/assignments/assignments-list";
import { ShellFatalError } from "../../../../../src/components/dash-shell/shell-error";

/**
 * `/dash/projects/{projectId}/assignments`'s own index — Plan D slice D1,
 * Task 5. THIN, per `docs/design/03-ui-references.md` §"The hierarchy": wires
 * the one route param this screen needs, calls the one service it needs, and
 * renders exactly one of two domain components — no JSX construction of its
 * own, no empty-state copy inline, matching `app/dash/page.tsx`'s own shape
 * one level up.
 *
 * SESSION EXPIRY IS RE-CHECKED HERE, EVEN THOUGH `app/dash/layout.tsx`
 * ALREADY CHECKED IT ONCE — same reasoning `app/dash/page.tsx`'s own comment
 * gives for re-checking `listProjects()`: a soft navigation into this route
 * (e.g. from a future link on `/dash`) re-renders only this page segment, not
 * the shared layout, so a session that expired between the two can only be
 * caught here.
 *
 * NO "PROJECT NOT FOUND" BRANCH OF ITS OWN. The route
 * (`app/v1/projects/[projectId]/assignments/route.ts:12-27`) answers 404
 * `RESOURCE_NOT_FOUND` for a project id that does not exist — and, as it
 * happens, for one outside the caller's grant too. That folds into
 * `listAssignments`'s `"error"` arm,
 * same as `projects.service.ts`'s `listProjects()` does not distinguish its
 * own failure causes either.
 *
 * CORRECTED IN THE FINAL FIX WAVE — this said «and 403
 * (`SCOPE_PROJECT_DENIED`, thrown by `requireProjectCapability` at
 * `apps/app/src/lib/authz.ts:100-104`) for one that exists but is outside the
 * caller's `project.view` grant». That 403 is unreachable through this route,
 * for the reason the evidence screen's own header spells out for its twin:
 * `goproceed_app` runs NOBYPASSRLS (`packages/database/src/tx.ts`),
 * `projects_select` (migration 0011:121-122) uses
 * `app.has_project_capability(workspace_id, id,
 * array['project.view','project.admin'])`, and `requireProjectCapability`
 * expands `project.view` to exactly that same pair
 * (`IMPLIED_BY_PROJECT_ADMIN`, `authz.ts:85`). A caller lacking it gets no
 * `projects` row from the route's first query, so the route's own 404 fires
 * before the capability check is reached. The check is nonetheless correct to
 * keep: it is the layer that goes live the day the policy widens. `ShellFatalError`'s copy is generic for exactly
 * this reason (`app/dash/page.tsx`'s `listProjects()` error branch reuses the
 * same component for what is, there too, actually a projects-endpoint
 * failure, not a workspace one) — reused rather than duplicated into a
 * project-specific wording only this one route would carry.
 */
type AssignmentsPageProps = {
  // Next 16 hands a dynamic segment in as a Promise — see
  // `app/(auth)/login/page.tsx`'s comment on the same pattern for
  // `searchParams`, and `app/(app)/a/[assignmentId]/page.tsx`'s identical use
  // for `params`.
  params: Promise<{ projectId: string }>;
};

export default async function ProjectAssignmentsPage({ params }: AssignmentsPageProps) {
  const { projectId } = await params;

  const result = await listAssignments(projectId);
  if (result.kind === "session_expired") {
    redirect(`/login?next=${encodeURIComponent(`/dash/projects/${projectId}/assignments`)}`);
  }
  if (result.kind === "error") return <ShellFatalError />;
  if (result.assignments.length === 0) return <NoAssignmentsEmptyState />;
  return <AssignmentsList assignments={result.assignments} projectId={projectId} />;
}
