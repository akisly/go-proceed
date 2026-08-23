import { z } from "zod";
import type { WorkItemView } from "./contract-versions";

/**
 * Manual work-line entry. ПТВ types the lines.
 *
 * ADR-006 decision 2 makes this a FIRST-CLASS v0.1 capability: it is how a
 * v0.1 object is created, it is what the six steps are demonstrated on, and it
 * is what the blocked-money sum of step 6 is computed over. It gets the same
 * schema quality, the same provenance fields, the same validation and the same
 * tests as an imported line. No field name, comment, error message or type in
 * this file may describe it as a stopgap for a missing importer, because it is
 * not one.
 *
 * THE XLSX/CSV IMPORTER IS FROZEN (ADR-006 decision 6) AND THESE THREE
 * OPERATIONS DO NOT TOUCH IT. They write `public.work_items` directly under a
 * draft contract version; they do not create an import batch, do not read a
 * column mapping, do not extend unit inference or number parsing, and do not
 * change `import_batches.publish`. The importer keeps working, unchanged, as
 * the other route to a published baseline. "Frozen" means no extension work,
 * not deletion (version-0.1.md §v0.1-M1).
 *
 * All three are `command` / idempotency `required` / `member` plane in
 * technical/openapi/scope-v0.1.csv:17-19, so each carries an `Idempotency-Key`
 * HEADER — required and hashed by apps/app/src/lib/command.ts:38-47, never a
 * body field. `work_items.remove` is the ONLY DELETE in the v0.1 route set and
 * is permitted only while the version is a draft (INV-015).
 *
 * Twenty lines is twenty calls: there is no bulk row in scope-v0.1.csv, and
 * the M1 acceptance evidence ("type twenty work lines by hand") is written
 * against exactly this operation.
 */

/** Decimal on the wire, never a JS number — the same reason money is bigint. */
const decimal = z.string().regex(/^\d+(\.\d{1,6})?$/);

/**
 * Minor units on the wire. Bounded at 19 digits because the column is `bigint`
 * and an unbounded digit run is a resource-exhaustion input, not a large
 * amount (M0 exit gate). A string rather than a number for the same reason the
 * decimals above are: `WorkItemView.netMinor` is a string too.
 */
const minorUnits = z.string().regex(/^\d{1,19}$/);

/** Zero is a value; "0", "0.0", "0.000000" are all it. */
const isZeroDecimal = (v: string) => /^0+(\.0+)?$/.test(v);

/**
 * `contract_quantity` and `unit_price_decimal` are `numeric(18,6)`, which holds
 * twelve integer digits. The `decimal` regex above is this package's shared
 * idiom (assignments.ts:4, progress.ts:4, progress-adjustments.ts:5) and is
 * left exactly as it is; this is the storability check the idiom does not
 * make. Without it a value that CANNOT be written validates here and fails as
 * a numeric overflow inside the transaction, which reaches the caller as a 500
 * rather than as the field error it is.
 */
const overflowsNumeric18_6 = (v: string) => (v.split(".")[0] ?? "").length > 12;

const checkDecimalFits = (
  ctx: z.RefinementCtx, path: string, value: string | null | undefined,
) => {
  if (typeof value === "string" && overflowsNumeric18_6(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [path],
      message: "beyond numeric(18,6): at most 12 digits before the decimal point",
    });
    return false;
  }
  return true;
};

export const unitPriceState = z.enum(["known", "zero", "missing"]);
export type UnitPriceStateValue = z.infer<typeof unitPriceState>;

/**
 * Length bounds are defensive limits, not domain facts: `public.work_items`
 * stores these as unconstrained `text` (migration 0012:219-268). They are here
 * because an unbounded string on a member-plane command is the resource
 * exhaustion the M0 gate names, and they are generous enough that a line
 * transcribed from a real кошторис fits.
 */
const sourceKey = z.string().trim().min(1).max(200);
const workCode = z.string().trim().min(1).max(100);
const description = z.string().trim().min(1).max(2000);
const section = z.string().trim().min(1).max(500);
const unitCode = z.string().trim().min(1).max(50);
const externalRef = z.string().trim().min(1).max(200);

export const createWorkItemRequest = z.object({
  /**
   * The line's own key in the source document the ПТВ is typing from — the
   * same field an imported line carries, and half of what makes work-item
   * lineage resolvable across a superseding version.
   */
  sourceKey: sourceKey.optional(),
  workCode: workCode.optional(),
  description,
  section: section.optional(),
  /**
   * The unit as written. Resolved to `public.unit_definitions` by normalized
   * code in the command, find-or-create, exactly as the importer resolves it
   * (apps/app/app/v1/import-batches/[batchId]/validate/route.ts:215-232). The
   * caller does not name a `unitDefinitionId`: a typist knows «м2», not a uuid,
   * and `unit_precision` must come from the resolved definition rather than
   * from the request.
   *
   * OPEN, AND THE COMMAND MUST DECIDE IT: the importer registers an unknown
   * unit only when the actor holds `units.manage` (validate/route.ts:217), and
   * `units.manage` is a WORKSPACE capability while manual entry is governed by
   * the PROJECT capability `contracts.edit`. A ПТВ typing «м. п.» for the first
   * time therefore either needs a second capability or gets UNIT_UNKNOWN. This
   * schema cannot settle which; it only refuses to hide the question behind a
   * caller-supplied uuid.
   */
  unitCode,
  contractQuantity: decimal,
  /**
   * INV-038: a missing price and a zero price are DIFFERENT, and the
   * difference is what keeps an unvalued line out of the numeric
   * value-at-risk sum instead of showing it as free work. The state is
   * explicit rather than inferred from the presence of `unitPrice`, because
   * inference cannot distinguish "the кошторис prices this at nothing" from
   * "the кошторис does not price this".
   */
  unitPriceState,
  /**
   * Present exactly when the state is `known`, and then strictly positive.
   * The deployed CHECK is
   * `(unit_price_state = 'known') = (unit_price_decimal is not null)`
   * (migration 0012:235-236), so a `zero` line stores NULL and its zero-ness
   * lives in the state — this is the DEPLOYED shape, which differs from
   * technical/database/schema-v0.1.sql:578 where `zero` stores 0. The
   * positivity rule is the target DDL's and is asserted here because without
   * it `known` with "0.00" and `zero` become two spellings of one fact.
   */
  unitPrice: decimal.optional(),
  /**
   * The line amount printed in the source document, in minor units. Optional
   * and purely provenance: it is not what the line is worth. Net, tax and
   * gross are computed by the command from quantity, price and the version's
   * pinned tax mode, rate and rounding policy — never sent by the caller —
   * and a source amount that disagrees with the derived amount beyond the
   * contract's pinned tolerance blocks publication until it is resolved
   * (INV-054), on this path exactly as on the importer's.
   */
  sourceAmountMinor: minorUnits.optional(),
  /**
   * v0.1 accepts `unit_price_derived` only, and the reason is not that manual
   * entry is lesser. `approved_source_amount` means "the source document's
   * amount was reviewed and approved despite disagreeing with quantity ×
   * price", and INV-054 requires that approval to exist as a recorded fact
   * with a reason. The only table that records one is
   * `public.source_amount_resolutions`, whose key is an import row result — a
   * hand-typed line has nowhere to put the reason, so accepting the basis here
   * would record an approval nobody made. Widening this needs a place to store
   * the resolution, which is a migration and a decision, not a schema edit.
   */
  valuationBasis: z.literal("unit_price_derived").default("unit_price_derived"),
  externalRef: externalRef.optional(),
  /**
   * THE WORK TYPE ПТВ PICKS — ADR-006 decision 1 step 1, «enters the work lines
   * by hand, PICKS A WORK TYPE, and the requirements load». It is the left-hand
   * side of the requirement-rule predicate, whose right-hand side is
   * `requirement_rule_versions.work_type_key` (ADR-006 decision 4.2). Carried by
   * `public.work_items.work_type_key` from migration 0050.
   *
   * OPTIONAL, AND ABSENT IS NOT AN ERROR. A line with no work type matches no
   * rule, materialises no occurrence, and is disclosed as
   * `work_type_unresolved` on every surface — which is what every line in the
   * product did before 0050 and what every imported line still does. Making it
   * required would refuse the manual entry of a line whose work has no ДБН
   * hidden-works requirement at all, and the refusal would push the typist
   * toward whichever key looks closest, which is worse than an honest blank.
   *
   * A VALUE THAT NAMES NOTHING IS REFUSED, and that is the point of the field.
   * The command checks the key against the work types this workspace can
   * actually bind — a published rule version anywhere in the workspace, or a
   * rule version this draft has already bound — and returns VALIDATION_FAILED
   * on `workTypeKey` when it resolves to neither.
   * `app.work_type_key_is_bindable` and `work_items_work_type_guard` (migration
   * 0050 §4-5) make the same refusal structural, so a route that forgot cannot
   * write a key nothing can use. Without that check a single typo produces an
   * empty obligation set, a vacuous stage closure and a passing constraint on
   * every row — the failure the null-returning stub avoided loudly.
   *
   * `.trim()` MATTERS HERE MORE THAN ELSEWHERE, AND IT IS THE ONLY FULL TRIM
   * IN THE CHAIN. The workspace-side resolver
   * (`app.work_type_key_is_bindable`) and the materialisation predicate
   * (`matchesLine`) are both exact string equality, so a key must be stored in
   * the one form everything compares against; normalising in one place and not
   * another is how two comparisons come to disagree.
   *
   * CORRECTED 2026-08-08: this comment said «the database CHECK refuses a
   * padded key outright». It does not. `work_items_work_type_key_shape_check`
   * is `work_type_key = btrim(work_type_key)`, and PostgreSQL's one-argument
   * `btrim` strips SPACES ONLY — a tab-, newline- or NBSP-padded key satisfies
   * it. This `.trim()` is JavaScript's, which is a real whitespace trim, so on
   * this wire the normalisation is COMPLETE and the CHECK is a backstop for the
   * one character it covers. The rule side trims the same way
   * (`workTypeKey` in ./requirement-rules.ts), which is what keeps the two
   * comparisons agreeing. Migration 0050 §1 records the CHECK tightening as
   * owed on both columns.
   */
  workTypeKey: z.string().trim().min(1).max(200).optional(),
  /**
   * The line in the superseded version that this line continues. The importer
   * derives lineage by matching source key, work code and description against
   * the previous version (`matchLineage`); a typed line has no file to match,
   * so the operator names the predecessor. Absent means "this line is new in
   * this version", which is the same thing the matcher records when it finds
   * no match.
   */
  predecessorWorkItemId: z.string().guid().optional(),
}).strict().superRefine((v, ctx) => {
  const qtyFits = checkDecimalFits(ctx, "contractQuantity", v.contractQuantity);
  const priceFits = checkDecimalFits(ctx, "unitPrice", v.unitPrice);
  if (!qtyFits || !priceFits) return;
  if ((v.unitPriceState === "known") !== (v.unitPrice != null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unitPrice"],
      message: "unitPrice is required for unitPriceState 'known' and forbidden otherwise",
    });
    return;
  }
  if (v.unitPriceState === "known" && v.unitPrice != null && isZeroDecimal(v.unitPrice)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unitPrice"],
      message: "a price of zero is unitPriceState 'zero', not 'known' with 0 (INV-038)",
    });
  }
});
export type CreateWorkItemRequest = z.infer<typeof createWorkItemRequest>;

/**
 * `work_items.update` — PATCH /v1/work-items/{workItemId}. A correction to a
 * line of a DRAFT version; refused once the version is published (INV-015).
 *
 * `null` clears an optional field, absent leaves it unchanged. That
 * distinction is the whole reason this is a PATCH: without it there is no way
 * to remove a work code that was typed by mistake.
 *
 * NO OPTIMISTIC-CONCURRENCY GUARD IS DECLARED, and its absence is a recorded
 * gap rather than a decision that concurrent correction is safe.
 * `public.work_items` has no `version` column (migration 0012:219-268), so
 * there is no counter for an `expectedVersion` to compare against, and the
 * repository's convention is that `expectedVersion` names a column that
 * exists (parties.ts:11, imports.ts:37). Two ПТВ users correcting one draft
 * line therefore resolve last-write-wins. Closing it means adding the column
 * in the migration that makes a draft line updatable at all, and adding the
 * field here in the same slice.
 */
export const updateWorkItemRequest = z.object({
  sourceKey: sourceKey.nullable().optional(),
  workCode: workCode.nullable().optional(),
  description: description.optional(),
  section: section.nullable().optional(),
  unitCode: unitCode.optional(),
  contractQuantity: decimal.optional(),
  unitPriceState: unitPriceState.optional(),
  unitPrice: decimal.nullable().optional(),
  sourceAmountMinor: minorUnits.nullable().optional(),
  externalRef: externalRef.nullable().optional(),
  /**
   * Nullable like the other optional fields: `null` CLEARS the work type, which
   * is a real correction — a typist who classified a line wrongly and has not
   * yet decided what it should be must be able to say so, and the honest
   * intermediate state is the blank one every pre-0050 line already carries.
   * A non-null value is checked exactly as on create.
   *
   * Correcting a line WITHOUT touching this field re-checks nothing, and that
   * is deliberate: `app.guard_work_item_work_type` short-circuits when the key
   * is unchanged, so retiring the last rule version carrying a key never traps
   * an existing draft line into being uncorrectable (migration 0050 §5).
   */
  workTypeKey: z.string().trim().min(1).max(200).nullable().optional(),
  predecessorWorkItemId: z.string().guid().nullable().optional(),
}).strict().superRefine((v, ctx) => {
  const qtyFits = checkDecimalFits(ctx, "contractQuantity", v.contractQuantity);
  const priceFits = checkDecimalFits(ctx, "unitPrice", v.unitPrice);
  if (!qtyFits || !priceFits) return;
  if (Object.keys(v).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [],
      message: "at least one field must be supplied",
    });
    return;
  }
  // The price state and the price are one fact under one CHECK, so they are
  // corrected together or not at all. Sending a price without its state would
  // ask the command to guess which half of the coherence rule the caller meant.
  if (v.unitPrice !== undefined && v.unitPriceState === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unitPriceState"],
      message: "unitPriceState must accompany unitPrice",
    });
    return;
  }
  if (v.unitPriceState === undefined) return;
  const priced = v.unitPrice != null;
  if ((v.unitPriceState === "known") !== priced) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unitPrice"],
      message: "unitPrice is required for unitPriceState 'known' and forbidden otherwise",
    });
    return;
  }
  if (v.unitPriceState === "known" && v.unitPrice != null && isZeroDecimal(v.unitPrice)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unitPrice"],
      message: "a price of zero is unitPriceState 'zero', not 'known' with 0 (INV-038)",
    });
  }
});
export type UpdateWorkItemRequest = z.infer<typeof updateWorkItemRequest>;

/**
 * `work_items.remove` — DELETE /v1/work-items/{workItemId}. The only DELETE in
 * the v0.1 route set, permitted only while the version is a draft.
 *
 * Empty like `finalizeUploadIntentRequest` and
 * `publishRequirementTemplateRequest`: the identity is in the path and the
 * replay protection is in the `Idempotency-Key` header. `commandRoute` reads
 * an empty body as `{}` (apps/app/src/lib/command.ts:49), so a DELETE sent
 * with no body at all validates.
 */
export const removeWorkItemRequest = z.object({}).strict();
export type RemoveWorkItemRequest = z.infer<typeof removeWorkItemRequest>;

/**
 * The created or corrected line, in the SAME shape `contract_versions.get`
 * returns it. A line that reads differently depending on how it was entered
 * would be the exit gate's own counter-example.
 */
export interface WorkItemMutationResponse {
  workItem: WorkItemView;
  /** Lines now in the draft, so a caller need not re-read to count them. */
  workItemCount: number;
}
export type CreateWorkItemResponse = WorkItemMutationResponse;
export type UpdateWorkItemResponse = WorkItemMutationResponse;

export interface RemoveWorkItemResponse {
  workItemId: string;
  contractVersionId: string;
  workItemCount: number;
}
