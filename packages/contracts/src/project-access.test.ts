import { describe, expect, it } from "vitest";
import {
  assignResponsibilityRequest, endResponsibilityRequest, endResponsibilityResponse, grantProjectAccessRequest,
  projectAccessNotHeldDetails, revokeProjectAccessRequest, revokeProjectAccessResponse,
} from "./project-access";

// BL-021 / DEV-043 / ADR-014 decision 1: a revoke is addressed by member and
// capability, like the grant, and says exactly which grants it revoked.
describe("project access revoke contracts", () => {
  const memberId = crypto.randomUUID();
  const grantId = crypto.randomUUID();

  it("the request names a member and at least one known capability, and nothing else", () => {
    expect(revokeProjectAccessRequest.parse({ memberId, capabilities: ["contracts.edit"] }))
      .toEqual({ memberId, capabilities: ["contracts.edit"] });
    expect(() => revokeProjectAccessRequest.parse({ memberId, capabilities: [] })).toThrow();
    expect(() => revokeProjectAccessRequest.parse({ memberId, capabilities: ["not.a.capability"] })).toThrow();
    expect(() => revokeProjectAccessRequest.parse({ capabilities: ["project.view"] })).toThrow();
    // A dated revoke is not part of ADR-014: the grant's validUntil is refused here.
    expect(() => revokeProjectAccessRequest.parse({ memberId, capabilities: ["project.view"], validUntil: "2099-01-01T00:00:00Z" })).toThrow();
  });

  it("the response lists the revoked grants and nothing else", () => {
    const body = { revoked: [{ capability: "contracts.edit", grantId }] };
    expect(revokeProjectAccessResponse.parse(body)).toEqual(body);
    expect(() => revokeProjectAccessResponse.parse({ ...body, memberId })).toThrow();
    expect(() => revokeProjectAccessResponse.parse({ revoked: [{ capability: "contracts.edit", grantId, revokedBy: memberId }] })).toThrow();
  });

  // DEV-049 / BL-142 / ADR-014's amendment of 2026-09-24: removing a member
  // (revoking project.view) reports what the revoke leaves live.
  it("a removal may report what stays live: the member's external links, without the recipient's address, and the Telegram group", () => {
    const link = {
      grantId, requirementOccurrenceId: crypto.randomUUID(), version: 1,
      expiresAt: "2026-10-01T00:00:00.000Z", exchanged: false, decidesEvidence: true,
    };
    const body = { revoked: [{ capability: "project.view", grantId }], remaining: { externalGrants: [link], telegramGroupBound: true } };
    expect(revokeProjectAccessResponse.parse(body)).toEqual(body);
    expect(() => revokeProjectAccessResponse.parse({ ...body, remaining: { externalGrants: [{ ...link, recipientEmail: "a@b.c" }], telegramGroupBound: true } })).toThrow();
    expect(() => revokeProjectAccessResponse.parse({ ...body, remaining: { externalGrants: [] } })).toThrow();
    expect(() => revokeProjectAccessResponse.parse({ ...body, remaining: { externalGrants: [], telegramGroupBound: false, telegramLinked: true } })).toThrow();
  });

  it("the not-held conflict names the capabilities and nothing else", () => {
    expect(projectAccessNotHeldDetails.parse({ notHeld: ["imports.manage"] })).toEqual({ notHeld: ["imports.manage"] });
    expect(() => projectAccessNotHeldDetails.parse({ notHeld: [] })).toThrow();
    expect(() => projectAccessNotHeldDetails.parse({ notHeld: ["imports.manage"], memberId })).toThrow();
  });
});

// BL-015 / DEV-044 / ADR-014 decision 2: an end names a member and a
// responsibility, takes effect when it commits, and lists the assignments it ended.
describe("responsibility end contracts", () => {
  const memberId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();

  it("the request names a member and one responsibility, and no date", () => {
    expect(endResponsibilityRequest.parse({ memberId, responsibility: "performer" }))
      .toEqual({ memberId, responsibility: "performer" });
    expect(() => endResponsibilityRequest.parse({ memberId, responsibility: "not_a_responsibility" })).toThrow();
    expect(() => endResponsibilityRequest.parse({ memberId, responsibility: "performer", endAt: "2099-01-01T00:00:00Z" })).toThrow();
    expect(() => endResponsibilityRequest.parse({ memberId, responsibility: "performer", validUntil: "2099-01-01T00:00:00Z" })).toThrow();
  });

  it("the response lists the ended assignments and nothing else", () => {
    const body = { ended: [{ assignmentId }] };
    expect(endResponsibilityResponse.parse(body)).toEqual(body);
    expect(() => endResponsibilityResponse.parse({ ...body, memberId })).toThrow();
    expect(() => endResponsibilityResponse.parse({ ended: [{ assignmentId, endedAt: "2026-09-23T00:00:00Z" }] })).toThrow();
  });
});

// DEV-053 / BL-148: an assignment's window must end after its start when both
// are sent. An end relative to now is the route's check, not the schema's: the
// clock must not turn a legitimate idempotent replay into 422.
describe("grant and assign windows end after they start", () => {
  const memberId = crypto.randomUUID();
  const at = (ms: number) => new Date(Date.now() + ms).toISOString();
  const pathOf = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
    r.error?.issues.map((i) => i.path.join("."));

  it("the grant schema does not look at the clock: a past validUntil parses, and the route refuses it", () => {
    expect(grantProjectAccessRequest.safeParse({ memberId, capabilities: ["contracts.edit"], validUntil: at(-60_000) }).success).toBe(true);
  });

  it("an assignment's validUntil must be later than its validFrom; without validFrom the schema leaves it to the route", () => {
    const from = at(86_400_000);
    expect(assignResponsibilityRequest.safeParse({ memberId, responsibility: "performer", validFrom: from, validUntil: at(2 * 86_400_000) }).success).toBe(true);
    expect(assignResponsibilityRequest.safeParse({ memberId, responsibility: "performer", validFrom: at(-2 * 86_400_000), validUntil: at(-86_400_000) }).success).toBe(true);
    expect(assignResponsibilityRequest.safeParse({ memberId, responsibility: "performer", validUntil: at(-60_000) }).success).toBe(true);
    expect(pathOf(assignResponsibilityRequest.safeParse({ memberId, responsibility: "performer", validFrom: from, validUntil: from }))).toEqual(["validUntil"]);
    expect(pathOf(assignResponsibilityRequest.safeParse({ memberId, responsibility: "performer", validFrom: from, validUntil: at(3_600_000) }))).toEqual(["validUntil"]);
  });

  it("a malformed date is reported once, on its own field (R1-02)", () => {
    expect(pathOf(assignResponsibilityRequest.safeParse({ memberId, responsibility: "performer", validFrom: "2026-13-01T00:00:00Z", validUntil: at(86_400_000) }))).toEqual(["validFrom"]);
    expect(pathOf(assignResponsibilityRequest.safeParse({ memberId, responsibility: "performer", validFrom: at(0), validUntil: "2026-13-01T00:00:00Z" }))).toEqual(["validUntil"]);
  });
});
