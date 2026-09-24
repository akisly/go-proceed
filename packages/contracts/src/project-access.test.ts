import { describe, expect, it } from "vitest";
import {
  endResponsibilityRequest, endResponsibilityResponse,
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
