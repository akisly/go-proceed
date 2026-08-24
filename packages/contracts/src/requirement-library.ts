import { z } from "zod";

/**
 * The shipped Додаток Н library — `requirement_library.list`,
 * GET /v1/workspaces/{workspaceId}/requirement-library
 * (technical/openapi/scope-v0.1.csv:31; `query`, idempotency `natural`,
 * `member` plane, so no `Idempotency-Key` and no request body).
 *
 * This is the only one of the nine v0.1-M1 operations that returns REGULATORY
 * STRINGS, and docs/product/hidden-works-content-rules.md is binding on every
 * one of them without exception. That is why the response is a zod schema and
 * not a plain interface, unlike most responses in this package: the route
 * parses it before returning (the pattern `meContextResponse` establishes at
 * apps/app/app/v1/me/context/route.ts:42), so a row that reaches the wire
 * without its verification tag or its source fails loudly at the boundary
 * instead of rendering.
 *
 * The route does NOT filter. A row with no source is unreachable here because
 * it is UNSTORABLE — `verification` is NOT NULL over a two-value CHECK and
 * `source_citation` is NOT NULL with a non-blank check, both in
 * supabase/migrations/0041_requirement_rules_bound_to_the_baseline.sql:210-217
 * — and this schema is the second layer, not the first. Filtering would hide
 * the defect; refusing names it.
 *
 * There is no create, update or delete counterpart, and adding one is not a
 * schema change. Library content is a repository change under
 * hidden-works-content-rules.md §"Change control": no row of
 * technical/openapi/scope-v0.1.csv writes this table.
 */

/**
 * INV-073's storage vocabulary. `UNVERIFIED` is deliberately absent and its
 * absence is the rule, not an omission: an unverified string must never be
 * shown as normative, and the cheapest guarantee is that it cannot be stored
 * and therefore cannot be returned.
 *
 * Every `VERIFIED_PRIMARY` row the v0.1 library ships rests on ONE download of
 * the official ДБН file that no reviewer can reopen — no URL, no retrieval
 * date, no hash were recorded (hidden-works-content-rules.md §"Open items").
 * A re-fetch that does not reproduce the same bytes must downgrade every row
 * it touches to `VERIFIED_SECONDARY`.
 */
export const verificationTag = z.enum(["VERIFIED_PRIMARY", "VERIFIED_SECONDARY"]);
export type VerificationTagValue = z.infer<typeof verificationTag>;

export const requirementLibraryItem = z.object({
  libraryItemId: z.string().guid(),
  sourceStandard: z.string().min(1),
  /**
   * The allow-list carries the verbatim contents of Н.14 and Н.15 ONLY.
   * «Н.1–Н.13» is not an allow-listed range and there is no value here that
   * could hold one.
   */
  positionCode: z.enum(["Н.14", "Н.15"]),
  positionTitleUk: z.string().min(1),
  itemNo: z.number().int().min(1),
  itemTextUk: z.string().min(1),
  /**
   * Додаток Н is довідковий. Prohibition B: «орієнтовн» occurs zero times in
   * the standard. Prohibition C: it is never presented as mandatory or
   * exhaustive. One storable value, one returnable value.
   */
  normativeCharacter: z.literal("dovidkovyi"),
  verification: verificationTag,
  /** Non-blank, because NOT NULL admits '' and '   ' and neither is a source. */
  sourceCitation: z.string().trim().min(1),
  /**
   * Prohibition G: neither ДБН А.3.1-5:2016 nor ДСТУ 9258:2023 says which
   * position takes which act form. The mapping is the product's assumption and
   * `actFormBasis` has exactly one value so it can never be returned as
   * anything else.
   */
  actFormAssumption: z.enum(["dodatok_v", "dodatok_g"]).nullable(),
  actFormBasis: z.literal("product_assumption"),
}).superRefine((v, ctx) => {
  // Prohibition A, restated at the boundary: Н.14 has exactly five items and
  // Н.15 exactly seven. Unrepresentable in storage
  // (0041:232-234); a response that carries an eighth Н.15 item is a defect
  // upstream of here and this makes it visible rather than renderable.
  // Anything the product recommends BEYOND Додаток Н belongs to a separate
  // block labelled «Додатково рекомендуємо (не з Додатка Н)» with no normative
  // citation, and that block is not this list.
  const limit = v.positionCode === "Н.14" ? 5 : 7;
  if (v.itemNo > limit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["itemNo"],
      message: `${v.positionCode} carries ${limit} items`,
    });
  }
});
export type RequirementLibraryItem = z.infer<typeof requirementLibraryItem>;

export const requirementLibraryListResponse = z.object({
  items: z.array(requirementLibraryItem),
});
export type RequirementLibraryListResponse = z.infer<typeof requirementLibraryListResponse>;
