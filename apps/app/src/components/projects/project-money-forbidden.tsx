import { Banner } from "@goproceed/ui/components";
import { ProjectPage } from "./project-page";

/**
 * `getBlockedValue`'s `forbidden` branch (403 `SCOPE_PROJECT_DENIED`) — the
 * refusal the task brief asked to be established rather than assumed. Traced
 * through `app/v1/projects/[projectId]/blocked-value/route.ts` and
 * `apps/app/src/lib/authz.ts`'s `requireProjectCapability`: this route calls
 * that function TWICE, and the FIRST call — `readiness.view` — is the one
 * `projects_select`'s RLS policy does NOT already gate (that policy admits
 * `project.view`/`project.admin` only, `supabase/migrations/
 * 0011_workspace_access_security.sql`, the `create policy projects_select`
 * block). A member holding `project.view` — and therefore ABLE to open
 * `/projects/{projectId}/assignments`, the register the «Доручення» tab
 * points at (`ProjectOverviewHeader`'s outline link until DEV-035) — but not `readiness.view` reaches this exact branch:
 * the route's own `notFound` guard passes, `requireActiveMembership` passes,
 * and `requireProjectCapability(…, "readiness.view")` then throws its own
 * `SCOPE_PROJECT_DENIED`. NAMED BY FUNCTION, NOT BY LINE — round 2's own
 * ruling, earned by this exact file: fix round 1 cited `authz.ts:101` for
 * that throw, and the SAME round's edit to `authz.ts` (growing a comment
 * above it) moved it to `authz.ts:115` before the round even closed.
 * `requireProjectCapability` has exactly one `SCOPE_PROJECT_DENIED` throw,
 * which is enough to re-find it without a number that rots. UNLIKE
 * `assignments.service.ts`'s own `project.view`-only 403, which that file's
 * header proves is unreachable through the identical RLS coupling, THIS 403
 * is the reachable one — checked by reading both files together, not stated
 * on the strength of a plausible-sounding argument (the mistake this
 * branch's own review history warns against repeating).
 *
 * A MEMBER WHO CAN SEE ДОРУЧЕННЯ MAY THEREFORE LAND HERE, which is exactly
 * why this branch keeps `ProjectPage` [`ProjectOverviewHeader` until DEV-035] (and its link back to the
 * register) rather than replacing the whole page with a dead end — the
 * refusal is about the MONEY, not about the project.
 */
export function ProjectMoneyForbidden({
  projectId, projectName, detail,
}: { projectId: string; projectName: string | null; detail: string | null }) {
  return (
    <ProjectPage projectId={projectId} projectName={projectName} tab="overview">
      <Banner tone="attention" title="Немає доступу до заблокованої вартості">
        {/* The route's own Ukrainian `detail` ("Немає доступу до цього
         * проєкту.") is rendered rather than a second hand-written
         * translation of the same refusal — same move `problemDetail`
         * makes in `app/(app)/a/[assignmentId]/page.tsx` [deleted 2026-09-23, DEV-035]. */}
        {detail ??
          "Перегляд доручень цього проєкту не дає права бачити його гроші. "
          + "Зверніться до адміністратора проєкту, щоб отримати доступ."}
      </Banner>
    </ProjectPage>
  );
}
