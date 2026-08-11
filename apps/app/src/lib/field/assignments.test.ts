import { describe, it, expect } from "vitest";
import type { AssignmentSummary, ProjectListRow } from "@goproceed/contracts";

import {
  buildMyAssignmentsScreen, failedProjectMessage, NO_ASSIGNMENTS_MESSAGE,
  NO_PROJECTS_MESSAGE, rowSubtitle, type ProjectAssignments,
} from "./assignments";

/**
 * The FIRST executed coverage «Мої доручення» has ever had. Before the final
 * whole-branch review this screen had none of any kind — no unit test, no
 * integration test, and `qa/field.mjs` visited `/` only unauthenticated before
 * signing in with `?next=/a/{id}` and going straight past it.
 */

function project(id: string, name: string): ProjectListRow {
  return { projectId: id, workspaceId: "ws-1", name, code: null };
}

function assignment(id: string, over: Partial<AssignmentSummary> = {}): AssignmentSummary {
  return {
    assignmentId: id,
    workItemId: `wi-${id}`,
    workCode: "1.1",
    description: "Приклад-улаштування прокладки кабелю",
    unitCode: "м",
    plannedQuantity: "10",
    effectiveQuantity: "10",
    status: "active",
    requirementTemplateVersionId: null,
    assigneeMemberId: "member-1",
    ...over,
  };
}

const P1 = project("p1", "Приклад-Обʼєкт-1");
const P2 = project("p2", "Приклад-Обʼєкт-2");

describe("the two empty states are two different screens, with two different remedies", () => {
  it("no project at all is a GRANT problem and says so", () => {
    const screen = buildMyAssignmentsScreen([], []);
    expect(screen.kind).toBe("no_projects");
    if (screen.kind === "no_projects") {
      expect(screen.message).toBe(NO_PROJECTS_MESSAGE);
      expect(screen.message).toContain("адміністратора");
    }
  });

  it("projects but no work is an ASSIGNMENT problem and sends him somewhere else", () => {
    const screen = buildMyAssignmentsScreen([P1], [{ status: "ok", project: P1, assignments: [] }]);
    expect(screen.kind).toBe("empty");
    if (screen.kind === "empty") {
      expect(screen.message).toBe(NO_ASSIGNMENTS_MESSAGE);
      expect(screen.message).toContain("керівника проєкту");
    }
  });

  it("does not use the same words for both — collapsing them sends him to the wrong person", () => {
    expect(NO_PROJECTS_MESSAGE).not.toBe(NO_ASSIGNMENTS_MESSAGE);
  });
});

describe("one flaky project cannot hide another project's work", () => {
  it("still lists the work that answered, and names the project that did not", () => {
    const screen = buildMyAssignmentsScreen([P1, P2], [
      { status: "ok", project: P1, assignments: [assignment("a1")] },
      { status: "failed", project: P2 },
    ]);

    expect(screen.kind).toBe("list");
    if (screen.kind !== "list") return;
    expect(screen.rows.map((r) => r.assignmentId)).toEqual(["a1"]);
    expect(screen.failedProjects.map((p) => p.projectId)).toEqual(["p2"]);
    // The failed project must not turn into a phantom second source of work,
    // which would also flip showProjectName on for a single-site foreman.
    expect(screen.showProjectName).toBe(false);
  });

  it("reports the failure ALONGSIDE the empty state, never folded into it", () => {
    // "You have no assignments" and "one site's list is unknown" are not the
    // same claim, and only the first is actually true here.
    const screen = buildMyAssignmentsScreen([P1, P2], [
      { status: "ok", project: P1, assignments: [] },
      { status: "failed", project: P2 },
    ]);
    expect(screen.kind).toBe("empty");
    if (screen.kind === "empty") {
      expect(screen.failedProjects.map((p) => p.name)).toEqual(["Приклад-Обʼєкт-2"]);
    }
  });

  it("falls back to the error screen only when NOTHING answered", () => {
    const allFailed: ProjectAssignments[] = [
      { status: "failed", project: P1 }, { status: "failed", project: P2 },
    ];
    expect(buildMyAssignmentsScreen([P1, P2], allFailed).kind).toBe("error");
  });

  it("names the project in the notice, so a degraded site is not silently dropped", () => {
    expect(failedProjectMessage(P2)).toContain("«Приклад-Обʼєкт-2»");
  });
});

describe("the project name appears only once it is doing work", () => {
  it("is hidden for a foreman on one site, however many rows he has", () => {
    const screen = buildMyAssignmentsScreen([P1], [
      { status: "ok", project: P1, assignments: [assignment("a1"), assignment("a2")] },
    ]);
    expect(screen.kind === "list" && screen.showProjectName).toBe(false);
  });

  it("appears once two projects actually contribute rows", () => {
    const screen = buildMyAssignmentsScreen([P1, P2], [
      { status: "ok", project: P1, assignments: [assignment("a1")] },
      { status: "ok", project: P2, assignments: [assignment("a2")] },
    ]);
    expect(screen.kind === "list" && screen.showProjectName).toBe(true);
  });

  it("stays hidden when the second project answered with nothing", () => {
    // Counted over ROWS, not over projects: a second project with no work
    // changes nothing about telling these rows apart.
    const screen = buildMyAssignmentsScreen([P1, P2], [
      { status: "ok", project: P1, assignments: [assignment("a1")] },
      { status: "ok", project: P2, assignments: [] },
    ]);
    expect(screen.kind === "list" && screen.showProjectName).toBe(false);
  });

  it("carries each row's own project through, so the name shown is that row's", () => {
    const screen = buildMyAssignmentsScreen([P1, P2], [
      { status: "ok", project: P1, assignments: [assignment("a1")] },
      { status: "ok", project: P2, assignments: [assignment("a2")] },
    ]);
    if (screen.kind !== "list") throw new Error("expected a list");
    expect(screen.rows.map((r) => [r.assignmentId, r.project.projectId]))
      .toEqual([["a1", "p1"], ["a2", "p2"]]);
  });
});

describe("the subtitle line", () => {
  const row = { ...assignment("a1"), project: P1 };

  it("joins the parts that exist and adds the project name only when asked", () => {
    expect(rowSubtitle(row, false)).toBe("1.1 · м");
    expect(rowSubtitle(row, true)).toBe("1.1 · м · Приклад-Обʼєкт-1");
  });

  it("drops a null workCode instead of rendering a dangling separator", () => {
    expect(rowSubtitle({ ...row, workCode: null }, false)).toBe("м");
  });
});
