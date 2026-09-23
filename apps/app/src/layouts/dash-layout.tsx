import type { ReactNode } from "react";
import type { ProjectListRow } from "@goproceed/contracts";
import { Sidebar } from "../components/dash-shell/sidebar";
import { TopBar } from "../components/dash-shell/top-bar";
import { ProfileMenu } from "../components/dash-shell/profile-menu";
import type { Membership } from "../components/dash-shell/workspace-switch";

/**
 * The office dashboard's shell chrome — `apps/app/app/(dash)/layout.tsx` (the
 * ROUTE file) renders this once it has decided the request is allowed to
 * proceed. Kept separate from that route file per
 * `docs/design/03-ui-references.md` §"The hierarchy": a route wires params,
 * calls a service, and renders a component — the actual rail/top-bar/main
 * composition is not routing, so it lives here, not in `app/(dash)/layout.tsx`.
 *
 * IT NO LONGER DECIDES THE "NO WORKSPACE" BRANCH, and that was a real bug
 * while it did. This layout used to render `{hasWorkspace ? children :
 * <NoWorkspaceEmptyState />}`, which swaps the empty state in for EVERY route
 * under `/**` — including `/settings/profile`, the one screen that
 * shows the signed-in address, made unreachable for exactly the person most
 * likely to be looking for it: a brand-new account with no workspace yet,
 * checking which address they signed in as. A layout cannot tell which child
 * route it is wrapping, so it is the wrong place to make a per-screen
 * decision; `app/(dash)/page.tsx` now makes it for the one screen it is true
 * of. (Sign-out was never affected — the profile menu lives in this chrome,
 * outside `children`.)
 *
 * THE PROFILE MENU IS BUILT HERE AND HANDED TO BOTH SURFACES — Task 3's
 * DEFECT 2. Task 2 shipped `profileSlot` on `Sidebar` and on `TopBar` and
 * then passed neither, so both fell through to a placeholder. Composing the
 * element here rather than in `app/(dash)/layout.tsx` keeps that route file
 * thin (it wires services and renders ONE component, per the hierarchy rule)
 * and keeps the "which chrome shows the profile" question in the file that
 * owns the chrome. One element, two call sites, so the desktop rail and the
 * mobile drawer cannot drift apart — the shape Task 2's report specified.
 *
 * The two `Sidebar`s are separate React instances, so each opens its own
 * menu; only one is ever visible (`hidden md:flex` on the rail, `md:hidden`
 * on the top bar that owns the drawer).
 *
 * THE WORK SHEET (DEV-035, 2026-09-23, after the owner's Autumn CRM
 * reference). From `md` the page is two grounds: the rail on the paper and the
 * screen on a white sheet with a hairline, `rounded-card` and `shadow-raised`
 * — the outer instrument is rounded, nothing inside it is (the Document Edge
 * Rule). The rail is sticky and as tall as the viewport, so its groups and
 * the profile control stay put while the sheet scrolls. Below `md` there is no
 * sheet: the top bar and the page share the paper edge to edge, as before.
 */
export function DashLayout({
  memberships, projects, accountLabel, accountInitial, children,
}: {
  memberships: Membership[];
  projects: ProjectListRow[];
  /** Already resolved (address, or the Ukrainian fallback) by
   * `session.service.ts`, called once in `app/(dash)/layout.tsx`. This layout
   * never fetches: a shell that reads its own data is a shell that reads it
   * again for every screen nested inside it. */
  accountLabel: string;
  accountInitial: string;
  children: ReactNode;
}) {
  const profileSlot = <ProfileMenu accountLabel={accountLabel} accountInitial={accountInitial} />;

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar
        memberships={memberships}
        projects={projects}
        profileSlot={profileSlot}
        className="sticky top-0 hidden h-dvh shrink-0 md:flex"
      />
      <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
        <TopBar memberships={memberships} projects={projects} profileSlot={profileSlot} />
        <main
          data-slot="work-sheet"
          className="min-w-0 flex-1 md:rounded-card md:border md:border-line md:bg-surface md:shadow-raised"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
