import { redirect } from "next/navigation";

import { getBlockedValue } from "../../../../src/services/blocked-value.service";
import { getReadiness } from "../../../../src/services/readiness.service";
import type { ReadinessView } from "../../../../src/components/projects/project-readiness";
import { getProjectName } from "../../../../src/services/projects.service";
import { ProjectMoneyOverview } from "../../../../src/components/projects/project-money-overview";
import { NoBlockedValueEmptyState } from "../../../../src/components/projects/no-blocked-value-empty-state";
import { ProjectMoneyForbidden } from "../../../../src/components/projects/project-money-forbidden";
import { ProjectMoneyNotFound } from "../../../../src/components/projects/project-money-not-found";
import { ShellFatalError } from "../../../../src/components/dash-shell/shell-error";

/**
 * `/projects/{projectId}` — Plan D slice D2, and the project page the
 * task brief asks for: the screen that carries the blocked-value read and
 * completes the chain **project → money → доручення → докази**.
 * `dash-shell/projects-list.tsx` now links here instead of straight to
 * `.../assignments`.
 *
 * [2026-09-23, DEV-035 — THREE CALLS NOW, in parallel. The owner's Autumn
 * reference puts a readiness breakdown on the project page, so this route
 * also reads `getReadiness` (`/readiness` — the «what could close now»
 * question the paragraph below says this screen did not ask; it asks it now)
 * and `getProjectName` (the heading and the breadcrumb). The money branches
 * below still decide the page; readiness only adds a block, and a readiness
 * read refused with 403/404 renders the page without it, and any other failure
 * renders a one-line notice in its place. The paragraph is kept as the record of the earlier scope.]
 *
 * ONE ROUTE, ONE CALL — `getBlockedValue` (`GET /v1/projects/{projectId}/
 * blocked-value`), and nothing else. Not `/blocked-reasons` (it duplicates
 * what this single response already carries) and not `/readiness` (a
 * different question — "what could close now" — that this screen does not
 * ask). This route file stays thin, matching `.../assignments/page.tsx`'s
 * own shape one level down: wire the one param, call the one service, render
 * exactly one component per result — no JSX of its own.
 *
 * FOUR OUTCOMES, NOT TWO — `getBlockedValue`'s own header carries the full
 * account of why `not_found` and `forbidden` are separate, legible branches
 * rather than both folding into `error`: this route's capability shape is
 * genuinely different from `.../assignments/page.tsx`'s (that route's own
 * 403 is proven unreachable through RLS; THIS route's `readiness.view` 403
 * is reachable, because `readiness.view` is not what `projects_select`'s RLS
 * policy already gates on `project.view`/`project.admin`).
 *
 * THE EMPTY-STATE BRANCH IS DECIDED HERE, NOT INSIDE A COMPONENT — matching
 * `.../assignments/page.tsx`'s own `assignments.length === 0` branch one
 * level down: `blockedReasons.length === 0` is both necessary and sufficient
 * for "nothing is blocked" (`NoBlockedValueEmptyState`'s own header explains
 * why, against `summariseBlockedValue`), so the route picks between the two
 * content components rather than asking `ProjectMoneyOverview` to render
 * itself into nothing.
 */
type ProjectOverviewPageProps = {
  // Next 16 hands a dynamic segment in as a Promise — see
  // `app/(auth)/login/page.tsx`'s comment on the same pattern.
  params: Promise<{ projectId: string }>;
};

export default async function ProjectOverviewPage({ params }: ProjectOverviewPageProps) {
  const { projectId } = await params;

  const [result, readinessResult, projectName] = await Promise.all([
    getBlockedValue(projectId),
    getReadiness(projectId),
    getProjectName(projectId),
  ]);
  if (result.kind === "session_expired" || readinessResult.kind === "session_expired") {
    redirect(`/login?next=${encodeURIComponent(`/projects/${projectId}`)}`);
  }
  if (result.kind === "not_found") return <ProjectMoneyNotFound />;
  if (result.kind === "forbidden") {
    return <ProjectMoneyForbidden projectId={projectId} projectName={projectName} detail={result.detail} />;
  }
  if (result.kind === "error") return <ShellFatalError />;

  // 403/404 hide the block (the member may not read readiness); any other
  // failure says so on the page rather than vanishing (DEV-035 review, R1-12).
  const readiness: ReadinessView =
    readinessResult.kind === "ok" ? { kind: "ok", readiness: readinessResult.readiness }
    : readinessResult.kind === "forbidden" || readinessResult.kind === "not_found" ? { kind: "hidden" }
    : { kind: "error" };
  if (result.blockedValue.blockedReasons.length === 0) {
    return <NoBlockedValueEmptyState projectId={projectId} projectName={projectName} readiness={readiness} />;
  }
  return (
    <ProjectMoneyOverview
      projectId={projectId}
      projectName={projectName}
      blockedValue={result.blockedValue}
      readiness={readiness}
    />
  );
}
