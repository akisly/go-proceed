import { z } from "zod";

export const createPartyRequest = z.object({
  displayName: z.string().trim().min(1).max(300),
  partyKind: z.enum(["organization", "individual"]).default("organization"),
});
export type CreatePartyRequest = z.infer<typeof createPartyRequest>;

export const updatePartyRequest = z.object({
  displayName: z.string().trim().min(1).max(300).optional(),
  expectedVersion: z.number().int().min(1),
});
export type UpdatePartyRequest = z.infer<typeof updatePartyRequest>;

export const putLegalProfileRequest = z.object({
  officialName: z.string().trim().min(1).max(500),
  edrpou: z.string().regex(/^\d{8}$|^\d{10}$/).optional(),
  vatNumber: z.string().trim().max(50).optional(),
  taxStatus: z.string().trim().max(100).optional(),
  legalAddress: z.string().trim().max(500).optional(),
  countryCode: z.string().length(2).default("UA"),
  expectedVersion: z.number().int().min(1).optional(),
});
export type PutLegalProfileRequest = z.infer<typeof putLegalProfileRequest>;

export const createOwnProfileRequest = z.object({});
export type CreateOwnProfileRequest = z.infer<typeof createOwnProfileRequest>;

export interface PartyResponse { partyId: string; version: number }
export interface LegalProfileResponse { profileId: string; version: number }
export interface OwnProfileResponse { partyId: string }
