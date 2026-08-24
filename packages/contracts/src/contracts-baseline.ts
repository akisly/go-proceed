import { z } from "zod";

export const taxMode = z.enum(["exclusive", "inclusive", "exempt", "out_of_scope", "unknown"]);
export type TaxModeValue = z.infer<typeof taxMode>;

export const createContractRequest = z.object({
  ownPartyId: z.string().guid(),
  customerPartyId: z.string().guid(),
  contractNo: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  taxMode,
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  // The explicit `z.string()` key is zod 4's required form. It accepts what
  // the single-argument form accepted: any string key, any value.
  terms: z.record(z.string(), z.unknown()).default({}),
  approvalPolicy: z.record(z.string(), z.unknown()).default({}),
  // `.prefault({})`, not `.default({})`: prefault substitutes the value and
  // then parses it, so `midpoint` comes out `"half_up"`. Under `.default()`
  // the object would be returned unparsed and `midpoint` would be absent.
  roundingPolicy: z.object({ midpoint: z.enum(["half_up", "half_even"]).default("half_up") }).prefault({}),
  toleranceMinorUnits: z.number().int().min(0).default(100),
  toleranceBps: z.number().int().min(0).default(10),
}).refine((v) => v.ownPartyId !== v.customerPartyId, {
  message: "own and customer party must differ",
  path: ["customerPartyId"],
}).refine(
  // exclusive adds tax to net and inclusive extracts it from gross; neither is
  // computable without a rate (docs/domain/value-at-risk.md compatibility table).
  (v) => !(["exclusive", "inclusive"].includes(v.taxMode) && v.taxRateBps == null),
  { message: "taxRateBps is required for exclusive and inclusive tax modes", path: ["taxRateBps"] },
);
export type CreateContractRequest = z.infer<typeof createContractRequest>;

export interface CreateContractResponse { contractId: string; version: number }
