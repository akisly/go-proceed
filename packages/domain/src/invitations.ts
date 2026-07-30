import { createHash } from "node:crypto";

/**
 * One-time invitation token: 32 random bytes hex-encoded (64 chars). Only the
 * sha256 hex of the token is stored (invitations.token_hash); the plaintext
 * appears exactly once in the create response and never in audit/outbox/logs.
 */
export function generateInvitationToken(bytes: Uint8Array): { token: string; tokenHash: string } {
  if (bytes.length !== 32) throw new Error("invitation token requires exactly 32 random bytes");
  const token = Buffer.from(bytes).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}
