import { describe, expect, it } from "vitest";
import { createInvitationReceipt, createInvitationResponse } from "./invitations";

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
