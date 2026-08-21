import { redirect } from "next/navigation";

import { listProjects } from "../../src/services/projects.service";
import { NoProjectsEmptyState } from "../../src/components/dash-shell/no-projects-empty-state";
import { ProjectsList } from "../../src/components/dash-shell/projects-list";

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
    // UNREACHABLE IN PRACTICE, KEPT ONLY FOR TYPESCRIPT'S NARROWING.
    // `app/dash/layout.tsx` — this page's own parent, rendered first in the
    // same request — already calls this exact `listProjects()` and returns
    // `ShellFatalError` on this exact failure before this page ever runs.
    // `apiGet` fetches with `{ cache: "no-store" }`, and Next.js memoizes GET
    // fetch requests with the same URL and options within a single render
    // pass regardless of that option (nextjs.org/docs/app/api-reference/
    // functions/fetch#memoization, checked against installed `next@16.3.1`
    // on 2026-08-22) — so this call cannot observe a different outcome than
    // the layout's already did. A dedicated `ProjectsLoadError` used to
    // render here (removed as dead code in this fix round; the layout's
    // `ShellFatalError` is the only reachable error surface for this
    // failure) — `throw` rather than a silent `return null` so a future
    // change that breaks this invariant fails loudly instead of rendering
    // an empty page.
    throw result.error;
  }
  if (result.projects.length === 0) return <NoProjectsEmptyState />;
  return <ProjectsList projects={result.projects} />;
}
