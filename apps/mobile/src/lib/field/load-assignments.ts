// The fetch-orchestration half of `apps/app/app/(app)/page.tsx` — extracted
// into its own module (no equivalent file exists in `apps/app`; that page
// inlines it) so `src/screens/my-assignments.tsx` can stay a thin shell the
// same way `page.tsx` itself is one, and so the orchestration can be driven
// by `load-assignments.test.ts` under plain Node `vitest` instead of only
// being provable by rendering the screen under RN/jsdom.
//
// THE DECISIONS STAY OUT OF THIS FILE. The four screen kinds, the two empty
// states, `showProjectName` — all of that is `./assignments`'s
// `buildMyAssignmentsScreen`, already ported and already tested. This file's
// only job is I/O: two hops of `/v1` reads, per-project failure isolation,
// and 401 classification. `my-assignments.tsx` calls `loadMyAssignments`
// first and feeds an `"ok"` result's `projects`/`byProject` straight into
// `buildMyAssignmentsScreen`, unchanged.

import type { ProjectAssignments } from "./assignments";

// Inlined from @goproceed/contracts (not a mobile app dependency) — same
// shapes `./assignments.ts` inlines, kept in sync with it by hand.
interface ProjectListRow {
  projectId: string;
  workspaceId: string;
  name: string;
  code: string | null;
}

interface AssignmentSummary {
  assignmentId: string;
  workItemId: string;
  workCode: string | null;
  description: string;
  unitCode: string;
  plannedQuantity: string | null;
  effectiveQuantity: string;
  status: string;
  requirementTemplateVersionId: string | null;
  assigneeMemberId: string | null;
}

interface ProjectsListResponse {
  projects: ProjectListRow[];
}

interface ListAssignmentsResponse {
  assignments: AssignmentSummary[];
}

/**
 * Thrown by a `Fetcher` for any non-OK `/v1` response. Mirrors
 * `apps/app/src/lib/api.ts`'s `ApiError` — same two fields, same reason:
 * `isSessionExpired` below stays a one-line predicate instead of every
 * caller re-deriving "was this a 401" from a raw status code by hand.
 */
export class ApiError extends Error {
  constructor(readonly status: number, readonly problem: unknown) { super("api"); }
}

/**
 * Ported from `apps/app/src/lib/api.ts`'s `isSessionExpired` — same
 * predicate, same reason: a 401 is never a per-project failure to absorb,
 * because every other in-flight request would fail identically a moment
 * later.
 */
export function isSessionExpired(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/**
 * A `/v1` GET that resolves with parsed JSON and rejects with `ApiError` on
 * any non-OK response — the shape `apps/app`'s server-side `apiGet<T>` has
 * natively. Mobile's own `apiGet` (`src/lib/api.ts`) returns a raw
 * `Response` instead — it has no server-only `headers()`/`cookies()` to
 * thread through, so there was never a reason to commit to a parsed-or-throw
 * shape there — so `src/screens/my-assignments.tsx` adapts it to this
 * signature at the one real call site. Injected so this module's tests never
 * touch `fetch`, Supabase, or React Native.
 */
export type Fetcher = <T>(path: string) => Promise<T>;

export type LoadAssignmentsResult =
  | { kind: "session_expired" }
  | { kind: "error" }
  | { kind: "ok"; projects: ProjectListRow[]; byProject: ProjectAssignments[] };

/**
 * The two-hop read `app/(app)/page.tsx` performs, minus the JSX: list the
 * projects this session can see, then ask each one — IN PARALLEL — for
 * `?assignee=me`. See that file's header comment for why there is no "list
 * my projects with my assignments" endpoint to call instead, and why the
 * order can only run this way round.
 */
export async function loadMyAssignments(fetcher: Fetcher): Promise<LoadAssignmentsResult> {
  let projects: ProjectListRow[];
  try {
    ({ projects } = await fetcher<ProjectsListResponse>("/v1/projects"));
  } catch (err) {
    if (isSessionExpired(err)) return { kind: "session_expired" };
    return { kind: "error" };
  }

  try {
    const byProject = await loadAssignmentsByProject(projects, fetcher);
    return { kind: "ok", projects, byProject };
  } catch (err) {
    // The only way this throws is `loadAssignmentsByProject` re-throwing a
    // 401 one of the per-project fetches hit (see that function): an
    // expired/revoked session, not a per-project problem. Anything else a
    // project's own fetch could fail with (403, 404, 500, a network hiccup)
    // never reaches here — it was already caught and absorbed into a
    // `"failed"` entry below, not re-thrown. The generic `"error"` branch is
    // kept anyway, matching `page.tsx`'s own belt-and-braces catch: better a
    // "try again" than an uncaught rejection reaching the screen.
    if (isSessionExpired(err)) return { kind: "session_expired" };
    return { kind: "error" };
  }
}

/**
 * Byte-identical failure isolation to `app/(app)/page.tsx`'s
 * `loadAssignmentsByProject`: each project's own fetch catches its own
 * failure and resolves to a `"failed"` entry rather than rejecting, so a
 * plain `Promise.all` is correct and sufficient — one flaky project can
 * never hide another project's already-answered work. A 401 is the one
 * exception, re-thrown rather than absorbed: every other in-flight project
 * would fail identically a moment later, and there is nothing
 * project-specific to degrade into.
 */
async function loadAssignmentsByProject(
  projects: ProjectListRow[],
  fetcher: Fetcher,
): Promise<ProjectAssignments[]> {
  return Promise.all(
    projects.map(async (project): Promise<ProjectAssignments> => {
      try {
        const { assignments } = await fetcher<ListAssignmentsResponse>(
          `/v1/projects/${project.projectId}/assignments?assignee=me`,
        );
        return { status: "ok", project, assignments };
      } catch (err) {
        if (isSessionExpired(err)) throw err;
        return { status: "failed", project };
      }
    }),
  );
}
