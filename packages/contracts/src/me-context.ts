import { z } from "zod";

export const meContextResponse = z.object({
  userId: z.string().uuid(),
  memberships: z.array(z.object({
    organizationId: z.string().uuid(),
    displayName: z.string(),
    role: z.string(),
    status: z.string(),
    membershipVersion: z.number().int(),
  })),
});
export type MeContextResponse = z.infer<typeof meContextResponse>;
