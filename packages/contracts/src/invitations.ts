import { z } from "zod";

export const createInvitationRequest = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["admin", "member", "auditor"]),
  expiresInHours: z.number().int().min(1).max(720).default(168),
});
export type CreateInvitationRequest = z.infer<typeof createInvitationRequest>;

export const acceptInvitationRequest = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
});
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequest>;

// BL-104 / DEV-019 / INV-102. `withIdempotency` stores what its callback
// returns, so the callback returns this token-free receipt and the route adds
// the token outside it. The token therefore reaches the caller once, from the
// execution that created it; a replay says `replayed` and carries none, as the
// Telegram intents do (`project-communications.ts`).
export const createInvitationReceipt = z.object({
  invitationId: z.string().guid(),
  expiresAt: z.string().datetime(),
}).strict();
export type CreateInvitationReceipt = z.infer<typeof createInvitationReceipt>;

export const createInvitationResponse = z.discriminatedUnion("kind", [
  createInvitationReceipt.extend({ kind: z.literal("issued"), token: z.string().regex(/^[0-9a-f]{64}$/) }).strict(),
  createInvitationReceipt.extend({ kind: z.literal("replayed") }).strict(),
]);
export type CreateInvitationResponse = z.infer<typeof createInvitationResponse>;

// BL-107 / DEV-021 / ADR-012. The create's 409 for an address that already has
// a pending invitation names that invitation, so an owner or admin who lost the
// create response can revoke it and invite again. Only the id: the caller has
// already passed the owner/admin check and can read the row.
export const invitationPendingConflictDetails = z.object({
  invitationId: z.string().guid(),
}).strict();
export type InvitationPendingConflictDetails = z.infer<typeof invitationPendingConflictDetails>;

// `invitations.revoke`: pending → revoked. No body, and no secret back.
export const revokeInvitationRequest = z.object({}).strict();
export type RevokeInvitationRequest = z.infer<typeof revokeInvitationRequest>;
export const revokeInvitationResponse = z.object({
  invitationId: z.string().guid(),
  status: z.literal("revoked"),
}).strict();
export type RevokeInvitationResponse = z.infer<typeof revokeInvitationResponse>;
export interface AcceptInvitationResponse {
  workspaceId: string;
  membershipId: string;
  role: string;
}
