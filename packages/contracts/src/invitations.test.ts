import { describe, expect, it } from "vitest";
import {
  createInvitationReceipt, createInvitationResponse,
  invitationPendingConflictDetails, revokeInvitationRequest, revokeInvitationResponse,
} from "./invitations";

// BL-104 / DEV-019 / INV-102: the stored receipt is token-free, the fresh
// response carries the token, and the replay refuses one.
describe("invitation contracts", () => {
  const receipt = { invitationId: crypto.randomUUID(), expiresAt: new Date().toISOString() };
  const token = "cd".repeat(32);

  it("the receipt stored by the idempotency record refuses a token", () => {
    expect(createInvitationReceipt.parse(receipt)).toEqual(receipt);
    expect(() => createInvitationReceipt.parse({ ...receipt, token })).toThrow();
  });

  it("distinguishes the issued response from its token-free replay", () => {
    expect(createInvitationResponse.parse({ ...receipt, kind: "issued", token }))
      .toEqual({ ...receipt, kind: "issued", token });
    expect(createInvitationResponse.parse({ ...receipt, kind: "replayed" }))
      .toEqual({ ...receipt, kind: "replayed" });
    expect(() => createInvitationResponse.parse({ ...receipt, kind: "issued" })).toThrow();
    expect(() => createInvitationResponse.parse({ ...receipt, kind: "replayed", token })).toThrow();
  });
});

// BL-107 / DEV-021 / ADR-012: revoke is token-free, and the create's conflict
// names the pending invitation that blocks the address.
describe("invitation revoke contracts", () => {
  const invitationId = crypto.randomUUID();

  it("the revoke request is empty and strict; the response names the revoked invitation", () => {
    expect(revokeInvitationRequest.parse({})).toEqual({});
    expect(() => revokeInvitationRequest.parse({ reason: "x" })).toThrow();
    expect(revokeInvitationResponse.parse({ invitationId, status: "revoked" })).toEqual({ invitationId, status: "revoked" });
    expect(() => revokeInvitationResponse.parse({ invitationId, status: "pending" })).toThrow();
    expect(() => revokeInvitationResponse.parse({ invitationId, status: "revoked", token: "cd".repeat(32) })).toThrow();
  });

  it("the pending-address conflict carries only the blocking invitation's id", () => {
    expect(invitationPendingConflictDetails.parse({ invitationId })).toEqual({ invitationId });
    expect(() => invitationPendingConflictDetails.parse({ invitationId, email: "b@example.test" })).toThrow();
  });
});
