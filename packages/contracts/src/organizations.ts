import { z } from "zod";

export const createOrganizationRequest = z.object({
  legalName: z.string().trim().min(1).max(300),
  displayName: z.string().trim().min(1).max(200),
  edrpou: z.string().trim().regex(/^\d{8,10}$/).optional(),
  baseCurrency: z.string().length(3).default("UAH"),
  timezone: z.string().min(1).default("Europe/Kyiv"),
});
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequest>;

export const createOrganizationResponse = z.object({
  organizationId: z.string().uuid(),
  membershipId: z.string().uuid(),
  role: z.literal("owner"),
  version: z.number().int(),
});
export type CreateOrganizationResponse = z.infer<typeof createOrganizationResponse>;
