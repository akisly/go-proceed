import { redirect } from "next/navigation";

import { listProjects } from "../../src/services/projects.service";
import { NoProjectsEmptyState } from "../../src/components/dash-shell/no-projects-empty-state";
import { ProjectsLoadError } from "../../src/components/dash-shell/projects-load-error";
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
  if (result.kind === "error") return <ProjectsLoadError />;
  if (result.projects.length === 0) return <NoProjectsEmptyState />;
  return <ProjectsList projects={result.projects} />;
}
