import { z } from "zod";

export const taxMode = z.enum(["exclusive", "inclusive", "exempt", "out_of_scope", "unknown"]);
export type TaxModeValue = z.infer<typeof taxMode>;

export const createContractRequest = z.object({
  ownPartyId: z.string().uuid(),
  customerPartyId: z.string().uuid(),
  contractNo: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  taxMode,
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  terms: z.record(z.unknown()).default({}),
  approvalPolicy: z.record(z.unknown()).default({}),
  roundingPolicy: z.object({ midpoint: z.enum(["half_up", "half_even"]).default("half_up") }).default({}),
  toleranceMinorUnits: z.number().int().min(0).default(100),
  toleranceBps: z.number().int().min(0).default(10),
}).refine((v) => v.ownPartyId !== v.customerPartyId, {
  message: "own and customer party must differ",
  path: ["customerPartyId"],
});
export type CreateContractRequest = z.infer<typeof createContractRequest>;

export interface CreateContractResponse { contractId: string; version: number }
