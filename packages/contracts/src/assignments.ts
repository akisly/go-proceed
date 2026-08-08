import { z } from "zod";

/** Decimal on the wire, never a JS number — the same reason money is bigint. */
const decimal = z.string().regex(/^\d+(\.\d{1,6})?$/);

export const createAssignmentRequest = z.object({
  workItemId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  performerPartyId: z.string().uuid().optional(),
  assigneeMemberId: z.string().uuid().optional(),
  plannedQuantity: decimal.optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /**
   * RETIRED BY ADR-005 DECISION 2 AND STILL ACCEPTED, FOR ONE MILESTONE, ON
   * PURPOSE. Read this before removing it.
   *
   * The pin's replacement is the requirement occurrence: assignment creation
   * materialises the obligation set from the rule versions the published
   * baseline binds, and the upload gate reads its media policy from the
   * occurrence. The plan's contradiction 3 fixes the order in which the three
   * halves may land — «add the occurrence source, then retire the pin, then
   * remove the template read» — because any other order opens a window in which
   * every upload in the product falls back to `FALLBACK_MEDIA`: 50 MB and four
   * MIME types for every requirement, silently, with nothing failing.
   *
   * That slice landed the FIRST half only, because materialisation could not
   * produce an occurrence at all: the rule predicate's first argument — the
   * work type — had no carrier, `public.work_items` had no `work_type_key`
   * (migration 0012:219-268) and `createWorkItemRequest` accepted none.
   *
   * MIGRATION 0050 LANDS THE CARRIER, AND THE SECOND HALF IS STILL NOT TAKEN
   * HERE. The condition for retiring this pin is not «an occurrence can exist»
   * but «every assignment that reads a media policy HAS one», and that is still
   * false: the column is nullable, every imported line carries NULL (ADR-006
   * decision 6 freezes the importer; INV-015 freezes the published line), and
   * an assignment on such a line materialises nothing. Retiring the pin today
   * would drop exactly those assignments to `FALLBACK_MEDIA` — 50 MB and four
   * MIME types for every requirement, silently — which is the widening the
   * ordering constraint exists against.
   *
   * So it stays, deprecated and disclosed: the response says a retired pin was
   * used, the audit record says so, and the route rejects a draft template
   * exactly as before. What has changed is that the blocker is now nameable and
   * bounded — it is the untyped line, not a missing ADR — and the slice that
   * retires this field is the one that decides what an assignment on an untyped
   * line reads its media policy from. `entity-catalog.csv:22` already states
   * the outcome.
   *
   * @deprecated Retired by ADR-005 decision 2; removed by the slice that decides
   * the media policy for an assignment with no occurrence. Do not add a new
   * caller.
   */
  requirementTemplateVersionId: z.string().uuid().optional(),
}).strict();
export type CreateAssignmentRequest = z.infer<typeof createAssignmentRequest>;

/**
 * What materialisation did, in the creating command's own answer.
 *
 * A count alone would be unreadable: zero occurrences means «this work carries
 * no obligation», «this baseline bound no rules» or «the obligation set could
 * not be computed», and those have three different owners. Silent non-coverage
 * means there is no gate (INV-072), and an assignment created with an empty
 * obligation set is the exact shape of silence the invariant is about — so the
 * verdict is part of the 201, not something a client must run a second
 * operation to discover.
 */
export interface AssignmentMaterialisation {
  occurrenceCount: number;
  stageCount: number;
  ruleVersionIds: string[];
  coverage: "covered" | "no_bindings" | "no_matching_rule" | "work_type_unresolved";
  /** True when a retired `requirementTemplateVersionId` was pinned by this call. */
  usedRetiredTemplatePin: boolean;
}

export interface CreateAssignmentResponse {
  assignmentId: string;
  version: number;
  requirementOccurrences: AssignmentMaterialisation;
}

export interface AssignmentSummary {
  assignmentId: string;
  workItemId: string;
  workCode: string | null;
  description: string;
  unitCode: string;
  plannedQuantity: string | null;
  effectiveQuantity: string;
  status: string;
  /** Deployed lineage. Read for rows that carry one; never written by new work. */
  requirementTemplateVersionId: string | null;
}
export interface ListAssignmentsResponse { assignments: AssignmentSummary[] }
