import { describe, it, expect } from "vitest";
import {
  createProjectRequirementRequest,
  archiveProjectRequirementRequest,
  projectSourcedRequirementItem,
  projectRequirementListResponse,
} from "./project-requirements";

// ADR-010: a workspace authors a requirement from its own робоча документація.
// Covers the project_requirements.* operations catalogued in
// technical/openapi/scope-v0.1.csv. Pure schema tests in the discipline
// m1-baseline-and-rules.test.ts states: every refusal ties to ADR-010 or
// INV-073, never to the shape a schema happens to have.
//
// verificationTag (./requirement-library) is reused here, not restated. Its
// widening to include PROJECT_DOCUMENTATION is a parallel change this suite
// does not assume has landed, so fixtures below exercise it with the values
// it carries today rather than the one the command will actually write.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const validCreate = {
  projectId: uuid(1),
  itemTextUk: "Приклад-текст вимоги з робочої документації",
  sourceDocument: "Приклад-РД-2026-014",
  sourceSheet: "12",
  sourceDrawingNo: "АР-07",
};

describe("project_requirements.create", () => {
  it("accepts the mandatory identifying fields with no revision", () => {
    expect(createProjectRequirementRequest.safeParse(validCreate).success).toBe(true);
  });

  it("accepts an absent revision and refuses a blank one", () => {
    expect(createProjectRequirementRequest.safeParse(validCreate).success).toBe(true);
    expect(createProjectRequirementRequest.safeParse({ ...validCreate, sourceRevision: " " }).success)
      .toBe(false);
  });

  it("accepts a present, non-blank revision", () => {
    expect(createProjectRequirementRequest.safeParse({ ...validCreate, sourceRevision: "Rev. C" }).success)
      .toBe(true);
  });

  // ADR-010 decision 3: «робоча документація» without a sheet and a drawing
  // number is a word, not a source.
  it("refuses a create with a blank sheet or drawing number", () => {
    for (const field of ["sourceSheet", "sourceDrawingNo", "sourceDocument", "itemTextUk"]) {
      const r = createProjectRequirementRequest.safeParse({ ...validCreate, [field]: "   " });
      expect(r.success).toBe(false);
    }
  });

  // ADR-010 decision 4: the project mark cannot be omitted. The other fields
  // are the citation ADR-010 decision 3 requires in place of free text.
  it.each(["projectId", "itemTextUk", "sourceDocument", "sourceSheet", "sourceDrawingNo"] as const)(
    "refuses an absent %s",
    (field) => {
      const rest: Record<string, unknown> = { ...validCreate };
      delete rest[field];
      expect(createProjectRequirementRequest.safeParse(rest).success).toBe(false);
    },
  );

  it("refuses a projectId that is not a guid", () => {
    expect(createProjectRequirementRequest.safeParse({ ...validCreate, projectId: "not-a-guid" }).success)
      .toBe(false);
  });

  // ADR-010 decision 2 / INV-073: verification is returned, never accepted —
  // the command chooses the only storable tag and a caller may not choose one.
  it("refuses a caller-supplied verification tag", () => {
    expect(createProjectRequirementRequest
      .safeParse({ ...validCreate, verification: "VERIFIED_PRIMARY" }).success).toBe(false);
  });

  it("refuses an unknown field", () => {
    expect(createProjectRequirementRequest.safeParse({ ...validCreate, extra: "x" }).success).toBe(false);
  });
});

describe("project_requirements.archive", () => {
  // Identity is in the path; replay protection is the Idempotency-Key header,
  // the same shape retireRequirementRuleVersionRequest takes.
  it("takes no body", () => {
    expect(archiveProjectRequirementRequest.safeParse({}).success).toBe(true);
  });

  it("refuses a smuggled field", () => {
    expect(archiveProjectRequirementRequest.safeParse({ reason: "duplicate" }).success).toBe(false);
  });
});

const ITEM = {
  itemId: uuid(2),
  projectId: uuid(1),
  itemTextUk: "Приклад-текст вимоги з робочої документації",
  sourceDocument: "Приклад-РД-2026-014",
  sourceSheet: "12",
  sourceDrawingNo: "АР-07",
  sourceRevision: null,
  verification: "VERIFIED_PRIMARY" as const,
  status: "active" as const,
  createdAt: "2026-08-24T00:00:00.000Z",
  archivedAt: null,
};

describe("project_requirements.list", () => {
  it("accepts an active item with no revision", () => {
    expect(projectSourcedRequirementItem.safeParse(ITEM).success).toBe(true);
  });

  it("accepts an archived item and a present revision", () => {
    const r = projectSourcedRequirementItem.safeParse({
      ...ITEM,
      sourceRevision: "Rev. C",
      status: "archived" as const,
      archivedAt: "2026-08-25T00:00:00.000Z",
    });
    expect(r.success).toBe(true);
  });

  // This schema reuses verificationTag rather than restating its values, so it
  // accepts whatever that constant accepts without being told to here.
  it.each(["VERIFIED_PRIMARY", "VERIFIED_SECONDARY"] as const)(
    "accepts verification %s",
    (tag) => {
      expect(projectSourcedRequirementItem.safeParse({ ...ITEM, verification: tag }).success).toBe(true);
    },
  );

  // INV-073, restated at the boundary: UNVERIFIED is not a storable value and
  // must not become a returnable one.
  it("refuses UNVERIFIED as a verification tag", () => {
    const r = projectSourcedRequirementItem.safeParse({ ...ITEM, verification: "UNVERIFIED" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["verification"]);
  });

  it("refuses an empty source field even in a response row", () => {
    for (const field of ["sourceDocument", "sourceSheet", "sourceDrawingNo", "itemTextUk"]) {
      expect(projectSourcedRequirementItem.safeParse({ ...ITEM, [field]: "" }).success).toBe(false);
    }
  });

  it("refuses a status outside active or archived", () => {
    expect(projectSourcedRequirementItem.safeParse({ ...ITEM, status: "draft" }).success).toBe(false);
  });

  it("wraps a list of items and accepts a project with none", () => {
    expect(projectRequirementListResponse.safeParse({ items: [ITEM] }).success).toBe(true);
    expect(projectRequirementListResponse.safeParse({ items: [] }).success).toBe(true);
  });
});
