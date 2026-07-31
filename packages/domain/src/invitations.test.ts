import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generateInvitationToken } from "./invitations";

describe("generateInvitationToken", () => {
  it("hex-encodes 32 bytes and hashes with sha256", () => {
    const bytes = new Uint8Array(32).fill(7);
    const { token, tokenHash } = generateInvitationToken(bytes);
    expect(token).toBe("07".repeat(32));
    expect(tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
  });
  it("rejects input that is not exactly 32 bytes", () => {
    expect(() => generateInvitationToken(new Uint8Array(16))).toThrow();
  });
});
