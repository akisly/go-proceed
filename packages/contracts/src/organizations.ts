import { z } from "zod";

export const createOrganizationRequest = z.object({
  // Bounds must match technical/openapi.yaml components.schemas.OrganizationCreate.
  legalName: z.string().trim().min(1).max(240),
  displayName: z.string().trim().min(1).max(160),
  edrpou: z.string().trim().regex(/^\d{8,10}$/).optional(),
  baseCurrency: z.string().length(3).default("UAH"),
  timezone: z.string().min(1).default("Europe/Kyiv"),
});
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequest>;

export const createOrganizationResponse = z.object({
  organizationId: z.string().guid(),
  membershipId: z.string().guid(),
  role: z.literal("owner"),
  version: z.number().int(),
});
export type CreateOrganizationResponse = z.infer<typeof createOrganizationResponse>;
