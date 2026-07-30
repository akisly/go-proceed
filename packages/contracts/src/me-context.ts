import { z } from "zod";

export const meContextResponse = z.object({
  userId: z.string().uuid(),
  memberships: z.array(z.object({
    // Canonical name (v0.1-M1): workspaceId. organizationId is kept for
    // compatibility with v0.0 clients; both carry the same value.
    workspaceId: z.string().uuid(),
    organizationId: z.string().uuid(),
    displayName: z.string(),
    role: z.string(),
    status: z.string(),
    membershipVersion: z.number().int(),
  })),
});
export type MeContextResponse = z.infer<typeof meContextResponse>;
