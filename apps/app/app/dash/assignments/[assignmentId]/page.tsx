import { redirect } from "next/navigation";

import { listEvidenceByAssignment } from "../../../../src/services/evidence.service";
import { NoEvidenceEmptyState } from "../../../../src/components/evidence/no-evidence-empty-state";
import { EvidenceByOccurrence } from "../../../../src/components/evidence/evidence-by-occurrence";
import { ShellFatalError } from "../../../../src/components/dash-shell/shell-error";

/**
 * `/dash/assignments/{assignmentId}` — Plan D slice D1, Task 6. The screen
 * this whole slice exists for: ПТВ spends days searching photos in chats and
 * retyping facts into Word; this is where that search ends. THIN, per
 * `docs/design/03-ui-references.md` §"The hierarchy" and matching
 * `app/dash/projects/[projectId]/assignments/page.tsx`'s own shape one
 * level up: wires the one route param this screen needs, calls the one
 * service it needs, renders exactly one of two domain components.
 *
 * REACHABLE TODAY, NOT A DEAD END — verified by reading the actual link
 * chain, not assumed: `dash-shell/projects-list.tsx` links each project row
 * to `/dash/projects/{projectId}/assignments`
 * (`ProjectsList`), and `assignments/assignments-list.tsx` already links
 * each row to `/dash/assignments/{assignmentId}` — that link was added in
 * Task 5's own commit, ahead of this route existing, specifically so this
 * task would close the chain rather than open a new one. `Sidebar`'s
 * "Докази" nav item stays disabled: it is a DIFFERENT, not-yet-built screen
 * (a cross-assignment evidence surface `04-role-pain-map.md` names
 * separately), not this per-assignment one.
 *
 * SESSION EXPIRY IS RE-CHECKED HERE, EVEN THOUGH `app/dash/layout.tsx`
 * ALREADY CHECKED IT ONCE — same reasoning `app/dash/projects/[projectId]/
 * assignments/page.tsx`'s own comment gives: a soft navigation into this
 * route (from `AssignmentsList`'s row link) re-renders only this page
 * segment, not the shared layout, so a session that expired between the two
 * can only be caught here.
 *
 * NO "ASSIGNMENT NOT FOUND" BRANCH OF ITS OWN. The route
 * (`app/v1/assignments/[assignmentId]/evidence/route.ts:28-30`) answers 404
 * `RESOURCE_NOT_FOUND` for an assignment id that does not exist, and the
 * evidence route's own authorization chain (membership, then
 * `project.view`) answers 403 for one outside the caller's grant — both fold
 * into `listEvidenceByAssignment`'s `"error"` arm, same as
 * `listAssignments`/`listProjects` do not distinguish their own failure
 * causes either. `ShellFatalError`'s copy stays generic for the same reason.
 *
 * ZERO GROUPS, NOT ZERO EVIDENCE OBJECTS, IS THE EMPTY CHECK. An assignment
 * with at least one group (even a lone null group of unbound photos) is not
 * empty — `NoEvidenceEmptyState` renders only when `groups` itself has
 * nothing in it, which is exactly the case the route's own grouping
 * construction produces when no `upload_intents` row for this assignment
 * has ever reached `status = 'available'`.
 */
type EvidencePageProps = {
  // Next 16 hands a dynamic segment in as a Promise — see
  // `app/(auth)/login/page.tsx`'s comment on the same pattern for
  // `searchParams`, and `app/dash/projects/[projectId]/assignments/
  // page.tsx`'s identical use for `params`.
  params: Promise<{ assignmentId: string }>;
};

export default async function AssignmentEvidencePage({ params }: EvidencePageProps) {
  const { assignmentId } = await params;

  const result = await listEvidenceByAssignment(assignmentId);
  if (result.kind === "session_expired") {
    redirect(`/login?next=${encodeURIComponent(`/dash/assignments/${assignmentId}`)}`);
  }
  if (result.kind === "error") return <ShellFatalError />;
  if (result.evidence.groups.length === 0) return <NoEvidenceEmptyState />;
  return <EvidenceByOccurrence assignmentId={assignmentId} groups={result.evidence.groups} />;
}
