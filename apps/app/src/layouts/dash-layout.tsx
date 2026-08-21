import type { ReactNode } from "react";
import { Sidebar } from "../components/dash-shell/sidebar";
import { TopBar } from "../components/dash-shell/top-bar";
import { NoWorkspaceEmptyState } from "../components/dash-shell/no-workspace-empty-state";
import type { Membership } from "../components/dash-shell/workspace-switch";

/**
 * The office dashboard's shell chrome — `apps/app/app/dash/layout.tsx` (the
 * ROUTE file) renders this once it has decided the request is allowed to
 * proceed. Kept separate from that route file per
 * `docs/design/03-ui-references.md` §"The hierarchy": a route wires params,
 * calls a service, and renders a component — the actual rail/top-bar/main
 * composition is not routing, so it lives here, not in `app/dash/layout.tsx`.
 *
 * `hasWorkspace` is decided here, not by the route, because it is a
 * presentation decision about THIS shell (which branch of `<main>` to show),
 * not a redirect/error decision the route has to make — those two are
 * already handled before this component is ever reached.
 */
export function DashLayout({
  memberships, children,
}: {
  memberships: Membership[];
  children: ReactNode;
}) {
  const hasWorkspace = memberships.length > 0;

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar memberships={memberships} className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar memberships={memberships} />
        <main className="min-w-0 flex-1">
          {hasWorkspace ? children : <NoWorkspaceEmptyState />}
        </main>
      </div>
    </div>
  );
}
