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

// ── The two commands the act's signatory slots depend on ─────────────────────
//
// `composeSignatorySlot` (statutory-acts.ts) REQUIRES a `projectPartyId` and a
// `partyContactId`, and the compose route 422s if either row is absent. Until
// 2026-08-18 no operation could create either row: `project_parties` and
// `party_contacts` existed in migration 0010 with RLS and grants, and every M4
// suite inserted them by SQL. So on any real workspace two of the three slots —
// the two mandatory ones — were guaranteed 422 and `statutory_acts.compose` was
// unreachable through the API. These two contracts are what make ADR-006 step 4
// reachable end to end for the first time.

/**
 * `relationship` mirrors `project_parties.relationship`'s CHECK in migration
 * 0010 EXACTLY — same seven values, same spelling. A value here that the CHECK
 * refuses would surface as a 500 from a constraint violation rather than a 422
 * from validation, and a value the CHECK accepts but this enum omits would be
 * unreachable for no stated reason. If one changes, both change.
 */
export const projectPartyRelationship = z.enum([
  "customer", "general_contractor", "subcontractor", "technical_supervision",
  "designer", "performer", "other",
]);
export type ProjectPartyRelationship = z.infer<typeof projectPartyRelationship>;

export const createProjectPartyRequest = z.object({
  partyId: z.string().uuid(),
  relationship: projectPartyRelationship,
  note: z.string().trim().max(1000).optional(),
}).strict();
export type CreateProjectPartyRequest = z.infer<typeof createProjectPartyRequest>;
export interface ProjectPartyResponse { projectPartyId: string; version: number }

/**
 * A named person at a party — the row a signatory slot points at. `fullName`
 * is the only required field, matching the table (`full_name not null`,
 * non-blank); the act prints it and `roleTitle`, and nothing prints `email` or
 * `phone` today. NO qualification-certificate fields, deliberately: the
 * runtime table does not carry them (schema-v0.1.sql:279-283 says it does;
 * migration 0010:119-133 does not — TODOS.md records the divergence), and a
 * contract that accepted them would be a promise the database cannot keep.
 */
export const createPartyContactRequest = z.object({
  fullName: z.string().trim().min(1).max(300),
  roleTitle: z.string().trim().max(300).optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(50).optional(),
}).strict();
export type CreatePartyContactRequest = z.infer<typeof createPartyContactRequest>;
export interface PartyContactResponse { partyContactId: string; version: number }
