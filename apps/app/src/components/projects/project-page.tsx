import type { ReactNode } from "react";
import Link from "next/link";
import { Folder } from "lucide-react";
import { Breadcrumb, TabLink, TabNav } from "@goproceed/ui/components";

/**
 * The frame every project screen shares (DEV-035, after the owner's Autumn
 * CRM reference — «Workflow Management», Dribbble 27557794, structure only):
 * a trail back to the project list, the project's NAME as the page's `h1`
 * beside a dark index tile, one action at the right, and the project's
 * sections as tabs that are pages.
 *
 * [Replaces `project-overview-header.tsx`, whose `h1` read «Заблокована
 * вартість» and whose only link was an outline «Доручення» button. That link's
 * destination survives as the «Доручення» tab: `apps/app/qa/field.mjs` asserts
 * the first link reading «Доручення» on the overview points at the register.]
 *
 * The new-assignment form is NOT framed by this: its `h1` is «Нове доручення»
 * and the harness holds it there.
 *
 * Carried over from `project-overview-header.tsx`, still true:
 *
 * SHARED BY EVERY RENDER BRANCH that establishes a reachable project — the
 * money content, the good-news empty state, the 403 refusal, the register —
 * so the chain **project → money → доручення → докази** is reachable from
 * each of them, not only from the happy path.
 *
 * NOT SHARED WITH THE 404 BRANCH. `ProjectMoneyNotFound` renders no frame:
 * `RESOURCE_NOT_FOUND` means the RLS-gated read returned no row, so the page
 * cannot assert this id names a project the caller may open, and a tab under
 * it would point at a route that refuses the identical way.
 *
 * THE FIRST TAB IS «Огляд» NOW. The old header was titled «Заблокована
 * вартість», not «Огляд», because `docs/design/04-role-pain-map.md` lists
 * three sources under the overview (blocked value, blocked reasons,
 * readiness) and that slice read one. Since DEV-035 the page reads readiness
 * too, and blocked reasons arrive inside the blocked-value response, so the
 * tab may promise the overview. (The overview's KPI row is headed «Показники»;
 * the money is named in its cards' own labels.)
 */
export type ProjectTab = "overview" | "assignments";

export function ProjectPage({
  projectId, projectName, tab, action, children,
}: {
  projectId: string;
  /** `null` when the list did not return the project — the trail still works. */
  projectName: string | null;
  tab: ProjectTab;
  action?: ReactNode | undefined;
  children: ReactNode;
}) {
  const name = projectName ?? "Проєкт";
  const base = `/projects/${projectId}`;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6 p-6">
      {/* A grid, so one DOM order serves both widths. The action comes LAST in
        * the DOM — below `md` it sits under the tabs, so the tab strip stays
        * with the heading it belongs to (UI review U1-10), and a keyboard or
        * screen reader meets it in the order it is drawn (review R3-02). From
        * `md` it is placed beside the heading (column 2, row 2). */}
      <header className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <Breadcrumb
          className="md:col-span-2"
          items={[
            <Link
              key="projects"
              href="/"
              className="inline-flex items-center hover:text-ink touch:min-h-(--gp-control-height-touch)"
            >
              Проєкти
            </Link>,
            name,
          ]}
        />
        <div className="flex min-w-0 items-center gap-3">
          {/* Neutral, not ink: the rail marks the same project with its index
            * tint, and a black tile was the heaviest mark on the sheet —
            * heavier than the money it heads (UI review U1-04). */}
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-control border border-line bg-subtle text-ink-secondary"
          >
            <Folder strokeWidth={1.75} className="size-4" />
          </span>
          <h1 className="min-w-0 text-h1 font-semibold break-words text-ink">{name}</h1>
        </div>
        <TabNav label="Розділи проєкту" className="md:col-span-2">
          <TabLink active={tab === "overview"}>
            <Link href={base}>Огляд</Link>
          </TabLink>
          <TabLink active={tab === "assignments"}>
            <Link href={`${base}/assignments`}>Доручення</Link>
          </TabLink>
        </TabNav>
        {action && <div className="md:col-start-2 md:row-start-2">{action}</div>}
      </header>
      {children}
    </div>
  );
}
