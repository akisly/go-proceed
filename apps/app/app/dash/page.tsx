import { redirect } from "next/navigation";

import { listProjects } from "../../src/services/projects.service";
import { NoProjectsEmptyState } from "../../src/components/dash-shell/no-projects-empty-state";
import { ProjectsList } from "../../src/components/dash-shell/projects-list";
import { ShellFatalError } from "../../src/components/dash-shell/shell-error";

/**
 * `/dash`'s own index. THIN, per `docs/design/03-ui-references.md`
 * §"The hierarchy": calls the one service this page needs and renders
 * exactly one of three domain components — no JSX construction of its own,
 * no empty-state copy inline. The "no workspace" case is handled one level
 * up, in `dash-layout.tsx`, since that is where the membership data already
 * lives; this page only ever runs once a workspace is known to exist.
 */
export default async function DashIndexPage() {
  const result = await listProjects();
  if (result.kind === "session_expired") redirect(`/login?next=${encodeURIComponent("/dash")}`);
  if (result.kind === "error") {
    // NORMALLY THE LAYOUT GETS HERE FIRST — BUT NOT ALWAYS, AND THE
    // DIFFERENCE IS SOFT NAVIGATION.
    //
    // On a full request `app/dash/layout.tsx` calls this same
    // `listProjects()` before this page runs, and returns `ShellFatalError`
    // without rendering `{children}` — so this branch does not execute.
    // (`apiGet` fetches with `{ cache: "no-store" }`, and Next memoizes GET
    // fetches with the same URL and options within one render pass
    // regardless of that option — nextjs.org/docs/app/api-reference/
    // functions/fetch#memoization, checked against installed `next@16.3.1` —
    // so the two calls cannot disagree within a request either.)
    //
    // That is a fact about the CURRENT route topology, not an invariant.
    // Once D1–D4 add sibling routes under `/dash`, a soft navigation between
    // them re-renders only the page segment: the shared layout does not
    // re-run, its guard does not re-run, and this branch is reached with the
    // shell still on screen.
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
