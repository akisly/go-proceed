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

export interface CreateInvitationResponse {
  invitationId: string;
  token: string;
  expiresAt: string;
}
export interface AcceptInvitationResponse {
  workspaceId: string;
  membershipId: string;
  role: string;
}
