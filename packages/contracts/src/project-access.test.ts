import { describe, expect, it } from "vitest";
import {
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

  it("the not-held conflict names the capabilities and nothing else", () => {
    expect(projectAccessNotHeldDetails.parse({ notHeld: ["imports.manage"] })).toEqual({ notHeld: ["imports.manage"] });
    expect(() => projectAccessNotHeldDetails.parse({ notHeld: [] })).toThrow();
    expect(() => projectAccessNotHeldDetails.parse({ notHeld: ["imports.manage"], memberId })).toThrow();
  });
});
