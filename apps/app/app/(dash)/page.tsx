import { redirect } from "next/navigation";

import { listProjects } from "../../src/services/projects.service";
import { getMeContext } from "../../src/services/workspaces.service";
import { NoProjectsEmptyState } from "../../src/components/dash-shell/no-projects-empty-state";
import { NoWorkspaceEmptyState } from "../../src/components/dash-shell/no-workspace-empty-state";
import { ProjectsList } from "../../src/components/dash-shell/projects-list";
import { ShellFatalError } from "../../src/components/dash-shell/shell-error";

/**
 * `/`'s own index. THIN, per `docs/design/03-ui-references.md`
 * §"The hierarchy": calls the one service this page needs and renders
 * exactly one of three domain components — no JSX construction of its own,
 * no empty-state copy inline.
 *
 * THE "NO WORKSPACE" CASE IS THIS FILE'S, as of fix round 1. It used to be
 * handled one level up in `dash-layout.tsx`, and this header used to say so
 * and add that "this page only ever runs once a workspace is known to exist" —
 * both untrue five lines below since that branch moved here. See the comment
 * on the branch itself for why a layout was the wrong place for it.
 */
export default async function DashIndexPage() {
  // THE "NO WORKSPACE" BRANCH LIVES HERE NOW, not in `src/layouts/dash-layout.tsx`.
  // A layout wraps every route in the segment and cannot tell which one it is
  // wrapping, so deciding there replaced `/settings/profile` — the only
  // screen that shows the signed-in address — with «Немає робочого простору»
  // for precisely the new account most likely to be checking it. This is the
  // one screen the sentence is actually about, and it is asked BEFORE
  // `listProjects`, because a caller with no workspace also has no projects
  // and would otherwise be told the narrower, wronger thing («Немає проєктів»).
  //
  // Not a second round trip: `app/(dash)/layout.tsx` already called this in the
  // same render pass, and `apiGet` goes through `fetch`, which Next memoizes
  // per pass for an identical GET.
  const meResult = await getMeContext();
  if (meResult.kind === "session_expired") redirect(`/login?next=${encodeURIComponent("/")}`);
  if (meResult.kind === "error") return <ShellFatalError />;
  if (meResult.meContext.memberships.length === 0) return <NoWorkspaceEmptyState />;

  const result = await listProjects();
  if (result.kind === "session_expired") redirect(`/login?next=${encodeURIComponent("/")}`);
  if (result.kind === "error") {
    // NORMALLY THE LAYOUT GETS HERE FIRST — BUT NOT ALWAYS, AND THE
    // DIFFERENCE IS SOFT NAVIGATION.
    //
    // On a full request `app/(dash)/layout.tsx` calls this same
    // `listProjects()` before this page runs, and returns `ShellFatalError`
    // without rendering `{children}` — so this branch does not execute.
    // (`apiGet` fetches with `{ cache: "no-store" }`, and Next memoizes GET
    // fetches with the same URL and options within one render pass
    // regardless of that option — nextjs.org/docs/app/api-reference/
    // functions/fetch#memoization, checked against installed `next@16.3.1` —
    // so the two calls cannot disagree within a request either.)
    //
    // That is only true of a FULL request, and this commit is what made the
    // difference matter: `/settings/profile` is a sibling page under the
    // same layout, linked from the profile menu. A soft navigation back from
    // it re-renders only the page segment — the shared layout does not re-run
    // and its guard does not re-run — so this branch is reachable TODAY, with
    // the shell still on screen, not once D1–D4 land.
    //
    // So it renders rather than throws. There is no `error.tsx` or
    // `global-error.tsx` anywhere under `apps/app`, so a throw here paints
    // Next's generic English "Application error" screen for a
    // Ukrainian-speaking user; `ShellFatalError` says the same thing in the
    // same words whether the layout or the page is the one that observed
    // the failure (`dash.error.shell`).
    return <ShellFatalError />;
  }
  if (result.projects.length === 0) return <NoProjectsEmptyState />;
  return <ProjectsList projects={result.projects} />;
}
