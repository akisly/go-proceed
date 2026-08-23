import Link from "next/link";
import { Button } from "@goproceed/ui/components";

/**
 * `/dash/projects/{projectId}`'s own heading and its one navigation act —
 * shared by every render branch that page can reach (the money content, the
 * good-news empty state, the 403 refusal), so the chain the task exists to
 * build — **project → money → доручення → докази** — is reachable from
 * every one of them rather than only the happy path.
 *
 * NOT SHARED WITH THE 404 BRANCH. `ProjectMoneyNotFound` renders no header
 * at all: there is no project to link FROM — `notFound: RESOURCE_NOT_FOUND`
 * means the RLS-gated read at `blocked-value/route.ts:70` returned zero
 * rows, so this page cannot even assert this `projectId` names a project the
 * caller may open, and a «Доручення» link under that heading would point at
 * a route that will refuse the identical way.
 *
 * TITLED «Заблокована вартість», NOT «Огляд» — `docs/design/
 * 04-role-pain-map.md` calls this screen "Overview" and lists three data
 * sources under it (blocked value, blocked reasons, readiness), but the task
 * brief this file implements is explicit that this slice reads exactly ONE
 * of the three (`GET .../blocked-value`) and calls out BY NAME that
 * `/blocked-reasons` and `/readiness` are not read here. A heading that said
 * «Огляд» would promise the other two panes this page does not have.
 */
export function ProjectOverviewHeader({ projectId }: { projectId: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-h1 font-semibold text-ink">Заблокована вартість</h1>
      <Button asChild variant="outline" size="sm">
        <Link href={`/dash/projects/${projectId}/assignments`}>Доручення</Link>
      </Button>
    </div>
  );
}
