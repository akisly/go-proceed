import { describe, expect, it } from "vitest";

import { ApiError, loadMyAssignments, type Fetcher } from "./load-assignments";

// Inlined from @goproceed/contracts by hand (a dependency since DEV-042;
// importing the types is a backlog entry) — same
// shape `./assignments.ts` and its own test inline.
interface ProjectListRow {
  projectId: string;
  workspaceId: string;
  name: string;
  code: string | null;
}

/**
 * The ONE thin test this file exists to be — see `load-assignments.ts`'s
 * header for why the orchestration (not the screen's decisions, which stay
 * in `./assignments` and are already covered by `assignments.test.ts`) is
 * the only thing worth a dedicated unit test here: it is the one piece of
 * `src/screens/my-assignments.tsx` that isn't itself the ported builder, and
 * a decision left in that component could only be proven by eye.
 */

function project(id: string, name: string): ProjectListRow {
  return { projectId: id, workspaceId: "ws-1", name, code: null };
}

const P1 = project("p1", "Приклад-Обʼєкт-1");
const P2 = project("p2", "Приклад-Обʼєкт-2");

/** Builds a `Fetcher` from a fixed path → response map, each entry either a
 * value to resolve with or an `Error`/`ApiError` to reject with. */
function fakeFetcher(routes: Record<string, unknown>): Fetcher {
  return async <T>(path: string): Promise<T> => {
    if (!(path in routes)) throw new Error(`fakeFetcher: unmocked path ${path}`);
    const entry = routes[path];
    if (entry instanceof Error) throw entry;
    return entry as T;
  };
}

describe("loadMyAssignments — all projects answer", () => {
  it("returns every project's assignments, keyed by project", async () => {
    const fetcher = fakeFetcher({
      "/v1/projects": { projects: [P1, P2] },
      "/v1/projects/p1/assignments?assignee=me": { assignments: [{ assignmentId: "a1" }] },
      "/v1/projects/p2/assignments?assignee=me": { assignments: [{ assignmentId: "a2" }] },
    });

    const result = await loadMyAssignments(fetcher);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.projects).toEqual([P1, P2]);
    expect(result.byProject).toEqual([
      { status: "ok", project: P1, assignments: [{ assignmentId: "a1" }] },
      { status: "ok", project: P2, assignments: [{ assignmentId: "a2" }] },
    ]);
  });
});

describe("loadMyAssignments — one project fails, the rest survive", () => {
  it("resolves the failing project to a \"failed\" entry instead of rejecting the whole batch", async () => {
    const fetcher = fakeFetcher({
      "/v1/projects": { projects: [P1, P2] },
      "/v1/projects/p1/assignments?assignee=me": { assignments: [{ assignmentId: "a1" }] },
      "/v1/projects/p2/assignments?assignee=me": new ApiError(500, {}),
    });

    const result = await loadMyAssignments(fetcher);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.byProject).toEqual([
      { status: "ok", project: P1, assignments: [{ assignmentId: "a1" }] },
      { status: "failed", project: P2 },
    ]);
  });

  it("also absorbs a non-ApiError network failure into a \"failed\" entry", async () => {
    const fetcher = fakeFetcher({
      "/v1/projects": { projects: [P1] },
      "/v1/projects/p1/assignments?assignee=me": new Error("network down"),
    });

    const result = await loadMyAssignments(fetcher);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.byProject).toEqual([{ status: "failed", project: P1 }]);
  });
});

describe("loadMyAssignments — a 401 anywhere is reported as sessionExpired", () => {
  it("on the top-level /v1/projects fetch", async () => {
    const fetcher = fakeFetcher({ "/v1/projects": new ApiError(401, {}) });

    const result = await loadMyAssignments(fetcher);

    expect(result.kind).toBe("session_expired");
  });

  it("on a per-project assignments fetch — not folded into a \"failed\" row", async () => {
    const fetcher = fakeFetcher({
      "/v1/projects": { projects: [P1, P2] },
      "/v1/projects/p1/assignments?assignee=me": { assignments: [] },
      "/v1/projects/p2/assignments?assignee=me": new ApiError(401, {}),
    });

    const result = await loadMyAssignments(fetcher);

    expect(result.kind).toBe("session_expired");
  });

  it("a non-401 failure on /v1/projects itself is a generic error, not sessionExpired", async () => {
    const fetcher = fakeFetcher({ "/v1/projects": new ApiError(500, {}) });

    const result = await loadMyAssignments(fetcher);

    expect(result.kind).toBe("error");
  });
});

describe("loadMyAssignments — no projects at all", () => {
  it("resolves ok with empty projects and no per-project fetch attempted", async () => {
    const fetcher = fakeFetcher({ "/v1/projects": { projects: [] } });

    const result = await loadMyAssignments(fetcher);

    expect(result).toEqual({ kind: "ok", projects: [], byProject: [] });
  });
});
