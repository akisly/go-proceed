import { describe, expect, it, vi } from "vitest";
import type { VaultItem } from "../vault";
import { createAuthorize } from "./authorize";
import { QueueRequestError } from "./queue";

// The response schemas are covered in packages/contracts; this suite covers the mapping.
vi.mock("@goproceed/contracts", () => {
  const passes = (key: string) => ({
    safeParse: (value: unknown) => value && typeof value === "object" && key in value
      ? { success: true, data: value } : { success: false },
  });
  return { listRequirementOccurrencesWithReferenceImagesResponse: passes("workspaceId"), meContextResponse: passes("memberships") };
});

const item = { subjectId: "subject", workspaceId: "workspace", assignmentId: "assignment", occurrenceId: "occurrence" } as VaultItem;
const access = { workspaceId: "workspace", captureAllowed: true, occurrences: [{ occurrenceId: "occurrence" }] };
const member = { userId: "subject", memberships: [{ workspaceId: "workspace", status: "active" }] };
const signal = new AbortController().signal;
const hidden = () => { throw new QueueRequestError(404, "RESOURCE_NOT_FOUND"); };

async function outcome(read: (path: string) => unknown, subject: string | null = "subject") {
  const authorize = createAuthorize({ get: async (path) => read(path), currentSubject: async () => subject });
  try { await authorize(item, signal); return "ok"; } catch (error) {
    const e = error as QueueRequestError; return `${e.status}:${e.code}`;
  }
}
const occurrencesOr = (me: unknown) => (path: string) => path === "/v1/me/context" ? me : hidden();

describe("send-time authorization", () => {
  it("passes a current, matching grant", async () => {
    expect(await outcome(() => access)).toBe("ok");
  });
  it("quarantines when the bearer belongs to another subject, before any request", async () => {
    const read = vi.fn(() => access);
    expect(await outcome(read, "someone-else")).toBe("401:SESSION_SUBJECT_CHANGED");
    expect(read).not.toHaveBeenCalled();
  });
  it("treats a missing session as transient, not as a revocation", async () => {
    expect(await outcome(() => access, null)).toBe("0:SESSION_UNAVAILABLE");
  });
  it("fails only the item when one project is hidden but the membership is active", async () => {
    expect(await outcome(occurrencesOr(member))).toBe("0:ASSIGNMENT_NOT_VISIBLE");
  });
  it("quarantines when the hidden assignment means the membership is gone", async () => {
    expect(await outcome(occurrencesOr({ ...member, memberships: [] }))).toBe("403:ACCESS_REVOKED");
    expect(await outcome(occurrencesOr({ ...member, memberships: [{ workspaceId: "workspace", status: "suspended" }] }))).toBe("403:ACCESS_REVOKED");
    expect(await outcome(occurrencesOr({ ...member, userId: "other" }))).toBe("403:ACCESS_REVOKED");
  });
  it("fails only the item when the membership read itself fails", async () => {
    expect(await outcome(occurrencesOr({ nonsense: true }))).toBe("0:ACCESS_RESPONSE_INVALID");
    expect(await outcome((path) => path === "/v1/me/context" ? (() => { throw new QueueRequestError(503, "UNAVAILABLE"); })() : hidden()))
      .toBe("503:UNAVAILABLE");
  });
  it("quarantines when the membership read rejects the session", async () => {
    expect(await outcome((path) => path === "/v1/me/context" ? (() => { throw new QueueRequestError(401, "AUTH_REQUIRED"); })() : hidden()))
      .toBe("401:AUTH_REQUIRED");
  });
  it("fails only the item when one project's capability is refused", async () => {
    expect(await outcome(() => { throw new QueueRequestError(403, "SCOPE_PROJECT_DENIED"); })).toBe("0:CAPTURE_NOT_ALLOWED");
    expect(await outcome(() => ({ ...access, captureAllowed: false }))).toBe("0:CAPTURE_NOT_ALLOWED");
    expect(await outcome(() => ({ ...access, workspaceId: "other" }))).toBe("0:WORKSPACE_MISMATCH");
    expect(await outcome(() => ({ ...access, occurrences: [] }))).toBe("0:OCCURRENCE_NOT_FOUND");
  });
  it("keeps other refusals identity-wide", async () => {
    expect(await outcome(() => { throw new QueueRequestError(401, "AUTH_REQUIRED"); })).toBe("401:AUTH_REQUIRED");
    expect(await outcome(() => { throw new QueueRequestError(403, "MEMBERSHIP_INACTIVE"); })).toBe("403:MEMBERSHIP_INACTIVE");
  });
});
