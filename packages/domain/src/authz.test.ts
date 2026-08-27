import { describe, it, expect } from "vitest";
import { workspaceCapabilities } from "./authz";

describe("workspaceCapabilities (plan decision 5, INV-020)", () => {
  it("owner holds own_legal_profiles.manage; admin does not", () => {
    expect(workspaceCapabilities("owner")).toContain("own_legal_profiles.manage");
    expect(workspaceCapabilities("admin")).not.toContain("own_legal_profiles.manage");
  });
  it("admin holds parties.manage, projects.create, units.manage", () => {
    for (const c of ["parties.manage", "projects.create", "units.manage"] as const) {
      expect(workspaceCapabilities("admin")).toContain(c);
    }
  });
  it("member and auditor hold no workspace capabilities", () => {
    expect(workspaceCapabilities("member")).toEqual([]);
    expect(workspaceCapabilities("auditor")).toEqual([]);
  });
});

describe("M2-A capabilities", () => {
  it("grants requirement template management to owner and admin only", () => {
    expect(workspaceCapabilities("owner")).toContain("requirement_templates.manage");
    expect(workspaceCapabilities("admin")).toContain("requirement_templates.manage");
    expect(workspaceCapabilities("member")).not.toContain("requirement_templates.manage");
    expect(workspaceCapabilities("auditor")).not.toContain("requirement_templates.manage");
  });
});

describe("project_requirements.manage", () => {
  it("grants project_requirements.manage to exactly the roles that hold requirement_rules.manage", () => {
    for (const role of ["owner", "admin", "member", "auditor"] as const) {
      expect(workspaceCapabilities(role).includes("project_requirements.manage"))
        .toBe(workspaceCapabilities(role).includes("requirement_rules.manage"));
    }
  });
});
