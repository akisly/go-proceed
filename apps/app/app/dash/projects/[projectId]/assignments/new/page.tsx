import { redirect } from "next/navigation";

import { listPublishedBaselines } from "../../../../../../src/services/baseline.service";
import { listProjects } from "../../../../../../src/services/projects.service";
import { getMeContext, listMembers } from "../../../../../../src/services/workspaces.service";
import { NewAssignmentForm } from "../../../../../../src/components/assignments/new-assignment-form";
import { NoBaselineEmptyState } from "../../../../../../src/components/assignments/no-baseline-empty-state";
import { ShellFatalError } from "../../../../../../src/components/dash-shell/shell-error";

/**
 * `/dash/projects/{projectId}/assignments/new` — Plan D slice A.
 *
 * THIN, like every sibling: resolve the params, call the services, render one
 * of three things (the form, the no-baseline empty state, or the shell's
 * generic fatal error). The session-expiry branch is re-checked here even
 * though `app/dash/layout.tsx` checked it once, for the reason the sibling
 * routes record: a soft navigation re-renders only this segment.
 *
 * THREE READS, AND THE ORDER IS FORCED for one of them: the members read is
 * keyed by WORKSPACE while this route only has a PROJECT, and the only thing
 * that maps one to the other is `listProjects()`'s own `workspaceId` column
 * (`ProjectListRow`, `packages/contracts/src/projects.ts`) — there is no
 * operation that goes from a project id straight to its members. So the
 * baselines and projects reads (plus `getMeContext`) run in parallel first,
 * and the members read follows once `workspaceId` is known.
 *
 * THE MEMBERS READ IS SKIPPED WHEN THERE IS NO BASELINE. A project with no
 * published baseline has no line to assign against, so `NewAssignmentForm`
 * has nothing to render regardless of who could be picked as виконавець —
 * fetching the workspace's members first would be a read this screen throws
 * away, and would turn an unrelated members-read failure into a fatal error
 * on a page whose real answer is the calm empty state.
 *
 * «WHO AM I» IS A JOIN THE API DOES NOT DO: `getMeContext()` carries
 * `userId` but no member id, and `listMembers()` carries `memberId` keyed by
 * `userId` but no session context. Matching `me.meContext.userId` against the
 * members list is how `currentMemberId` is found — the spec's §5 in one
 * sentence. A caller whose own membership is not in the ACTIVE members list
 * (suspended, revoked, or a race with an admin's own edit) gets `""`, which
 * `NewAssignmentForm` treats as "no default assignee" rather than throwing.
 */
type NewAssignmentPageProps = { params: Promise<{ projectId: string }> };

export default async function NewAssignmentPage({ params }: NewAssignmentPageProps) {
  const { projectId } = await params;
  const back = `/dash/projects/${projectId}/assignments/new`;

  const [baselines, projects, me] = await Promise.all([
    listPublishedBaselines(projectId),
    listProjects(),
    getMeContext(),
  ]);

  if (
    baselines.kind === "session_expired" || projects.kind === "session_expired"
    || me.kind === "session_expired"
  ) {
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }
  if (baselines.kind === "error" || projects.kind !== "ok" || me.kind !== "ok") {
    return <ShellFatalError />;
  }

  // Not among the caller's own projects — same "no branch of its own"
  // treatment `.../assignments/page.tsx` gives a project id outside the
  // caller's reach: `listProjects()` already filters to what RLS admits, so
  // an id that names no row here is indistinguishable from one that does not
  // exist at all, and the generic fatal error is the honest answer for both.
  const workspaceId = projects.projects.find((p) => p.projectId === projectId)?.workspaceId;
  if (workspaceId === undefined) return <ShellFatalError />;

  if (baselines.baselines.length === 0) return <NoBaselineEmptyState />;

  const members = await listMembers(workspaceId);
  if (members.kind === "session_expired") redirect(`/login?next=${encodeURIComponent(back)}`);
  if (members.kind !== "ok") return <ShellFatalError />;

  const active = members.members.filter((m) => m.status === "active");
  const currentMemberId = active.find((m) => m.userId === me.meContext.userId)?.memberId ?? "";

  return (
    <NewAssignmentForm
      projectId={projectId}
      baselines={baselines.baselines}
      members={active.map((m) => ({ memberId: m.memberId, role: m.role }))}
      currentMemberId={currentMemberId}
    />
  );
}
