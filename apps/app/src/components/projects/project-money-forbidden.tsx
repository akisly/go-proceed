import { Banner } from "@goproceed/ui/components";
import { ProjectOverviewHeader } from "./project-overview-header";

/**
 * `getBlockedValue`'s `forbidden` branch (403 `SCOPE_PROJECT_DENIED`) — the
 * refusal the task brief asked to be established rather than assumed. Traced
 * through `app/v1/projects/[projectId]/blocked-value/route.ts:74-75` and
 * `apps/app/src/lib/authz.ts:86-104`: this route checks TWO project
 * capabilities, and the FIRST — `readiness.view` — is the one `projects_
 * select`'s RLS policy does NOT already gate (that policy admits
 * `project.view`/`project.admin` only, `supabase/migrations/
 * 0011_workspace_access_security.sql:121-122`). A member holding
 * `project.view` — and therefore ABLE to open `/dash/projects/{projectId}/
 * assignments`, the register `ProjectOverviewHeader`'s own link points at —
 * but not `readiness.view` reaches this exact branch: the RLS-gated read at
 * `route.ts:70` succeeds, `requireActiveMembership` succeeds, and
 * `requireProjectCapability(…, "readiness.view")` then throws at `authz.
 * ts:101`. UNLIKE `assignments.service.ts`'s own `project.view`-only 403,
 * which that file's header proves is unreachable through the identical RLS
 * coupling, THIS 403 is the reachable one — checked by reading both files
 * together, not stated on the strength of a plausible-sounding argument (the
 * mistake this branch's own review history warns against repeating).
 *
 * A MEMBER WHO CAN SEE ДОРУЧЕННЯ MAY THEREFORE LAND HERE, which is exactly
 * why this branch keeps `ProjectOverviewHeader` (and its link back to the
 * register) rather than replacing the whole page with a dead end — the
 * refusal is about the MONEY, not about the project.
 */
export function ProjectMoneyForbidden({
  projectId, detail,
}: { projectId: string; detail: string | null }) {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-6">
      <ProjectOverviewHeader projectId={projectId} />
      <Banner tone="attention" title="Немає доступу до заблокованої вартості">
        {/* The route's own Ukrainian `detail` ("Немає доступу до цього
         * проєкту.") is rendered rather than a second hand-written
         * translation of the same refusal — same move `problemDetail`
         * makes in `app/(app)/a/[assignmentId]/page.tsx`. */}
        {detail ??
          "Перегляд доручень цього проєкту не дає права бачити його гроші. "
          + "Зверніться до адміністратора проєкту, щоб отримати доступ."}
      </Banner>
    </div>
  );
}
