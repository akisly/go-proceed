import Link from "next/link";
import { Button, EmptyState } from "@goproceed/ui/components";
import { ProjectPage } from "../projects/project-page";

/**
 * `app/(dash)/projects/[projectId]/assignments/page.tsx` renders this when
 * `GET /v1/projects/{projectId}/assignments` returns none for a project that
 * does exist — the exact copy named in `task-5-brief.md`, catalogued as
 * `dash.empty.no_assignments_title` / `dash.empty.no_assignments`. Mirrors
 * `dash-shell/no-projects-empty-state.tsx`'s shape one level down: a project,
 * not a workspace, is what turned out to be empty — WITH TWO DELIBERATE
 * DIFFERENCES, both below.
 *
 * IT CARRIES AN ACTION, AND UNTIL THE FINAL FIX WAVE IT DID NOT — the change
 * that makes the FIRST доручення in a project creatable through the UI at all.
 *
 * `assignments/page.tsx` returns this component when the register is empty,
 * BEFORE it renders `AssignmentsList` — and `assignments-list.tsx` held the
 * only navigational entry point to `/assignments/new` in the entire app. So
 * the create link existed only once at least one assignment already existed.
 * An owner standing up a fresh pilot published a baseline, opened Доручення,
 * read «Немає доручень», and had no way to create one short of typing the URL:
 * the exact opposite of what this branch's own ADR-009 amendment commits to —
 * «a person holding only a browser and an email address creates … one
 * assignment, with no curl, no psql and no SQL».
 *
 * THE ARGUMENT AGAINST AN ACTION HERE WAS REAL AND IS NOW STALE.
 * `no-baseline-empty-state.tsx`'s header described this component's shape as
 * «name the condition, no dead-end action invented for it», which was true
 * before this branch: `/assignments/new` did not exist, so any control offered
 * here would have led nowhere. It exists now, it is a real screen, and it has
 * its own honest empty state for the case where the project has no published
 * baseline yet — so the action leads to an answer either way, never to a dead
 * end. `EmptyState`'s own header states the rule this satisfies: name the
 * condition AND the next act.
 *
 * THE CONTROL IS THE REGISTER'S OWN, not a second one. Same label, same
 * destination, same `Button asChild`+`Link` shape as `assignments-list.tsx`
 * renders above the table — a real anchor that merely looks like a button, and
 * the 44px touch floor arrives with `Button`'s own `touch` variant rather than
 * from a size prop here. Two different controls for one act on two states of
 * one screen is how a product starts disagreeing with itself.
 *
 * `max-w-md`: stock Tailwind's 28rem, back since the theme stopped clearing
 * stock namespaces (2026-09-24, DEV-073, BL-047).
 *
 * [DEV-035, 2026-09-23] Inside the project frame (`ProjectPage`) with its
 * tabs, and WITHOUT the frame's header action: the empty state's own
 * «Нове доручення» is the one create link on this screen, so a reader is not
 * offered the same act twice.
 */
export function NoAssignmentsEmptyState({
  projectId, projectName,
}: { projectId: string; projectName: string | null }) {
  return (
    <ProjectPage projectId={projectId} projectName={projectName} tab="assignments">
      <EmptyState
        className="mx-auto max-w-md py-16"
        title="Немає доручень"
        description="У цьому проєкті ще немає доручень."
        action={(
          <Button asChild variant="brand">
            <Link href={`/projects/${projectId}/assignments/new`}>Нове доручення</Link>
          </Button>
        )}
      />
    </ProjectPage>
  );
}
