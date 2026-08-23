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
  // ZOD 4 (2026-08-24): `z.record()` LOST ITS SINGLE-ARGUMENT FORM — the key
  // type is now required. Verified against the installed package, not recalled:
  // `zod/v4/classic/schemas.d.ts:534` declares
  // `record<Key extends core.$ZodRecordKey, Value extends core.SomeType>(keyType, valueType, params?)`
  // with no one-argument overload, and tsc says «Expected 2-3 arguments, but
  // got 1». `z.string()` is what the removed form implied, so the accepted
  // shape is unchanged: any string key, any value.
  terms: z.record(z.string(), z.unknown()).default({}),
  approvalPolicy: z.record(z.string(), z.unknown()).default({}),
  // `.prefault({})`, NOT `.default({})` — and the difference is behavioural,
  // not cosmetic. Zod 4 retyped `.default()` to take the schema's OUTPUT
  // (`zod/v4/classic/schemas.d.ts:46`: `default(def: util.NoUndefined<core.output<this>>)`)
  // and, more importantly, changed what it DOES: `$ZodDefault`'s own source
  // comment says it «returns the default value immediately in forward
  // direction. It doesn't pass the default value into the validator»
  // (`zod/v4/core/schemas.js`, the `$ZodDefault` constructor). So `{}` would
  // be handed back verbatim and `midpoint` would be ABSENT — a silent change
  // to the parsed contract that no type error would have caught here, since
  // `{}` is not even assignable to the output type. `$ZodPrefault` substitutes
  // the value and THEN runs the inner type (same file, the `$ZodPrefault`
  // constructor), which is exactly what zod 3's `.default()` did: `{}` flows
  // through the object parser and `midpoint` comes out `"half_up"`.
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
