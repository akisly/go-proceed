import type { ReactNode } from "react";
import { Sidebar } from "../components/dash-shell/sidebar";
import { TopBar } from "../components/dash-shell/top-bar";
import { NoWorkspaceEmptyState } from "../components/dash-shell/no-workspace-empty-state";
import { ProfileMenu } from "../components/dash-shell/profile-menu";
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
 *
 * THE PROFILE MENU IS BUILT HERE AND HANDED TO BOTH SURFACES — Task 3's
 * DEFECT 2. Task 2 shipped `profileSlot` on `Sidebar` and on `TopBar` and
 * then passed neither, so both fell through to a placeholder. Composing the
 * element here rather than in `app/dash/layout.tsx` keeps that route file
 * thin (it wires services and renders ONE component, per the hierarchy rule)
 * and keeps the "which chrome shows the profile" question in the file that
 * owns the chrome. One element, two call sites, so the desktop rail and the
 * mobile drawer cannot drift apart — the shape Task 2's report specified.
 *
 * The two `Sidebar`s are separate React instances, so each opens its own
 * menu; only one is ever visible (`hidden md:flex` on the rail, `md:hidden`
 * on the top bar that owns the drawer).
 */
export function DashLayout({
  memberships, accountLabel, accountInitial, children,
}: {
  memberships: Membership[];
  /** Already resolved (address, or the Ukrainian fallback) by
   * `session.service.ts`, called once in `app/dash/layout.tsx`. This layout
   * never fetches: a shell that reads its own data is a shell that reads it
   * again for every screen nested inside it. */
  accountLabel: string;
  accountInitial: string;
  children: ReactNode;
}) {
  const hasWorkspace = memberships.length > 0;
  const profileSlot = <ProfileMenu accountLabel={accountLabel} accountInitial={accountInitial} />;

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar memberships={memberships} profileSlot={profileSlot} className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar memberships={memberships} profileSlot={profileSlot} />
        <main className="min-w-0 flex-1">
          {hasWorkspace ? children : <NoWorkspaceEmptyState />}
        </main>
      </div>
    </div>
  );
}
