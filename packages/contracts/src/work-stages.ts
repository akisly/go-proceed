import { z } from "zod";

/**
 * `work_stages.create` — POST /v1/assignments/{assignmentId}/stages
 * (technical/openapi/scope-v0.1.csv:43; command, idempotency required, member
 * plane).
 *
 * WHY A COMMAND EXISTS AT ALL FOR A TABLE M2 ALREADY FILLS. The plan's
 * contradiction 5 was resolved as option A: `work_stages` is built by migration
 * 0043 and `assignments.create` materialises one stage per bound `stage_key`, so
 * the stage set a baseline IMPLIES needs no member command. This operation is for
 * the stages a baseline did NOT imply — the plan says so in those words
 * («M3 then adds the member-plane command for stages the baseline did not
 * imply»). It WAS the whole of the reachable case: until migration 0050 no work
 * line carried a work type and materialisation produced nothing
 * (`src/lib/requirement-materialisation.ts`, `workTypeKeyOf`), so this was how
 * a stage existed at all. 0050 lands the carrier; an assignment on a TYPED line
 * now arrives with materialised stages, and this command covers the untyped
 * line — every imported one — and the stage a typed baseline did not imply.
 *
 * GOVERNED BY `assignments.manage`, NOT BY `stage_closures.close`. The RLS policy
 * `ws_insert` (migration 0043 §9) names `assignments.manage`, and this command
 * does not widen it: creating the closable unit is the same act as creating the
 * assignment it hangs from, and closing one is a different act with a different
 * capability and a different persona (migration 0045 §10 argues the same split
 * from the other side).
 *
 * IT MATERIALISES NO OCCURRENCE. `requirement_occurrences.create` and
 * `.bulk_instantiate` are v0.2, and `src/lib/occurrence-writer.ts` is the only
 * door an occurrence comes through. A stage created here is therefore EMPTY, it
 * closes vacuously, and the response says so rather than letting a caller infer
 * readiness from silence (INV-072).
 */
export const createWorkStageRequest = z.object({
  /**
   * From the vocabulary the contract-version rule bindings pin. NOT constrained
   * relationally by migration 0043 and not constrained here either, and the
   * reason is the same one 0043 gives: an uncovered stage is a finding INV-072
   * must be able to print, not a row the database must refuse.
   */
  stageKey: z.string().trim().min(1).max(200),
  /**
   * The hidden-works case is a CONCEALED stage: migration 0043's
   * `check (timing <> 'before_concealment' or stage_is_concealed is true)` makes
   * a before-concealment obligation unstorable against a stage that is not
   * concealed. Defaulting to `false` would therefore make the default stage the
   * one v0.1's central case cannot use, so the field is REQUIRED and the caller
   * states which kind of stage this is.
   */
  isConcealed: z.boolean(),
}).strict();
export type CreateWorkStageRequest = z.infer<typeof createWorkStageRequest>;

export interface CreateWorkStageResponse {
  workStageId: string;
  workAssignmentId: string;
  stageKey: string;
  isConcealed: boolean;
  status: "open";
  version: number;
  /**
   * Zero for every stage this command creates, because no v0.1 route
   * materialises an occurrence outside `assignments.create`. A stage with no
   * blocking occurrence CLOSES — `∀` over an empty set is true — so the count
   * travels with the creation receipt and the caller is told, at the moment the
   * stage exists, that closing it will prove nothing.
   */
  blockingOccurrenceCount: number;
}
