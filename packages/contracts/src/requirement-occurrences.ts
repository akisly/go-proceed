import { z } from "zod";
import { verificationTag } from "./requirement-library";
import { blockingScope, evidenceKind, interventionType, requirementTiming } from "./requirement-rules";

/**
 * Requirement occurrences — the obligation, read before the work and previewed
 * before the baseline is used.
 *
 * Two operations (technical/openapi/scope-v0.1.csv:36-37):
 *
 *   `requirement_occurrences.list`
 *     GET /v1/assignments/{assignmentId}/requirement-occurrences
 *     `query` / idempotency `natural` / `member` plane, governed by
 *     `project.view` — capabilities.csv:14 names this operation in terms and
 *     says why: «this is also how the foreman reads the occurrence set for an
 *     assignment before work starts (ADR-006 step 2)».
 *
 *   `requirement_occurrences.dry_run`
 *     POST /v1/projects/{projectId}/contract-versions/{versionId}
 *          /requirement-occurrences/dry-run
 *     `command` / idempotency `required` / `member` plane, governed by
 *     `requirements.assign` (capabilities.csv:23).
 *
 * THE PATH CARRIES THE CONTRACT VERSION, AND THAT IS THE DECISION THE PLAN LEFT
 * OPEN. version-0.1.md §v0.1-M2 §"API slice" records it as unresolved — «either
 * the path gains the version or the contract does; this document invents
 * neither» — because scope-v0.1.csv kept the operation project-scoped and no
 * module defined its request. Resolved the first way, so the request body stays
 * empty and there is no field a caller can get wrong: a dry run reports over ONE
 * published baseline, and a baseline named in a body is a baseline that can
 * disagree with the project in the path while both are well-formed.
 * scope-v0.1.csv:37 is updated with this slice; the operation id is unchanged.
 *
 * NEITHER OPERATION WRITES AN OCCURRENCE. `requirement_occurrences.create` and
 * `.bulk_instantiate` left v0.1 (version-0.1.md §v0.1-M2) — the only way an
 * occurrence exists is materialisation at assignment creation, because a
 * hand-made obligation is also a hand-removed one. The dry run is a preview of
 * that materialisation and stores nothing but its own audit and idempotency
 * records.
 */

/**
 * INV-073's rendering half, as a shape rather than as three sibling nullables.
 * A normative string may be shown only WITH its verification tag and its
 * source; carrying them in one object means «norm ref without a tag» is not a
 * state a client has to defend against, because it cannot be constructed.
 * `requirement_occurrences_norm_ref_sourced_check` (migration 0043) is the
 * storage half and this is the wire half of the same rule.
 */
export const normativeCitation = z.object({
  text: z.string().trim().min(1),
  verification: verificationTag,
  source: z.string().trim().min(1),
}).strict();
export type NormativeCitation = z.infer<typeof normativeCitation>;

/**
 * The media policy the capture screen must obey, read THROUGH the occurrence's
 * pinned rule version rather than copied onto the occurrence.
 *
 * Migration 0043 gives `requirement_occurrences` no `allowed_media` column, and
 * that is not an omission to route around: the occurrence pins
 * `rule_version_id`, the rule version is publish/retire-only with no UPDATE
 * grant and a frozen-content guard (0041), so reading through the pin returns
 * exactly what a copy would have returned and cannot drift from it. `null`
 * means the evidence kind produces no uploaded original — `measurement` and
 * `checkbox`, for which `publishRequirementRuleVersionRequest` refuses the
 * field outright.
 */
export const occurrenceAllowedMedia = z.object({
  mimeTypes: z.array(z.string()).min(1),
  maxByteSize: z.number().int().positive(),
}).strict();

export const requirementOccurrenceView = z.object({
  occurrenceId: z.string().uuid(),
  workAssignmentId: z.string().uuid(),
  /** The pinned identity, never a live rule (INV-067). */
  ruleVersionId: z.string().uuid(),
  ordinal: z.number().int().min(1),

  /**
   * The closable unit. Nullable in the column and non-null for every v0.1
   * occurrence, because the v0.1 case is `before_concealment` and migration
   * 0043's CHECK makes that timing unstorable without a concealed stage.
   */
  stage: z.object({
    stageId: z.string().uuid().nullable(),
    stageKey: z.string().min(1),
    isConcealed: z.boolean().nullable(),
  }).strict(),

  /**
   * COPIED at materialisation and pinned to the rule version by foreign key
   * (INV-066): the occurrence cannot misreport the consequence of the version
   * it copied. Not inferred from a severity word at read time — `severity` as a
   * free axis is retired (ADR-005 decision 4).
   */
  interventionType,
  blockingScope,
  timing: requirementTiming,
  evidenceKind,
  acceptanceCriterion: z.string().trim().min(1),
  performerRole: z.string().min(1),
  approverRole: z.string().min(1),
  approverIsExternal: z.boolean(),
  minEvidenceCount: z.number().int().min(1),
  maxEvidenceCount: z.number().int().positive().nullable(),
  allowedMedia: occurrenceAllowedMedia.nullable(),
  normRef: normativeCitation.nullable(),

  /**
   * There is NO satisfaction field and no status field, in the response for the
   * same reason there is none in the table: satisfaction is a projection over
   * decisions, exceptions and review heads (state-catalog.csv
   * `requirement_occurrence.satisfaction`) and M3 is the milestone that ships
   * it. A nullable «satisfied» here would be read as «not yet satisfied» in the
   * milestone that cannot compute it.
   */
  materialisedAt: z.string().datetime({ offset: true }),
}).strict();
export type RequirementOccurrenceView = z.infer<typeof requirementOccurrenceView>;

/**
 * Parsed at the route boundary, like `requirementLibraryListResponse` and for
 * the same reason: this response carries REGULATORY STRINGS, and
 * docs/product/hidden-works-content-rules.md is binding on every surface that
 * shows one. A row that reached the wire with a citation but no source would be
 * a defect upstream; refusing it here names it instead of rendering it.
 */
export const listRequirementOccurrencesResponse = z.object({
  workAssignmentId: z.string().uuid(),
  contractVersionId: z.string().uuid(),
  occurrences: z.array(requirementOccurrenceView),
  /**
   * WHY AN EMPTY SET IS NOT JUST AN EMPTY ARRAY. A foreman shown nothing cannot
   * tell «this work carries no obligation» from «this baseline bound no rules»
   * from «the obligation set could not be computed», and the three have
   * different owners. Silent non-coverage means there is no gate (INV-072), so
   * the reason travels with the emptiness.
   */
  coverage: z.enum(["covered", "no_bindings", "no_matching_rule", "work_type_unresolved"]),
}).strict();
export type ListRequirementOccurrencesResponse =
  z.infer<typeof listRequirementOccurrencesResponse>;

/**
 * Empty body. The baseline is in the path and the replay protection is in the
 * `Idempotency-Key` header — the shape `publishRequirementTemplateRequest`,
 * `retireRequirementRuleVersionRequest` and `finalizeUploadIntentRequest` all
 * take.
 *
 * WHAT IS DELIBERATELY NOT ON THIS WIRE: an acknowledgement token for the
 * uncovered list. INV-072's enforcement column asks that «the command fails
 * closed unless that list is acknowledged inside the request hash» — but the
 * command that would fail closed is the BULK INSTANTIATION, and it is a v0.2
 * row of scope-v0.2.csv. In v0.1 the instantiating command is
 * `assignments.create`, one work line at a time, and giving IT an
 * acknowledgement field would make every assignment creation depend on a dry
 * run of the whole baseline. The v0.1 half of INV-072 that this operation can
 * carry is disclosure, and it carries it in the response below.
 */
export const requirementOccurrenceDryRunRequest = z.object({}).strict();
export type RequirementOccurrenceDryRunRequest =
  z.infer<typeof requirementOccurrenceDryRunRequest>;

export const dryRunLineCoverage = z.enum([
  /** At least one bound rule version matches this line's work type. */
  "covered",
  /** The line has a work type and no bound rule version names it. */
  "no_matching_rule",
  /**
   * The line has NO work type to match against, so the predicate's first
   * argument has no left-hand side on this line.
   *
   * Until migration 0050 this was true of EVERY work line in the product —
   * nothing carried `work_type_key` on `public.work_items` and no operation
   * wrote one. 0050 adds the column and `work_items.create`/`.update` write it,
   * so this value now means what it says: THIS line names no work type. Two
   * populations reach it and both are legitimate — every line the frozen
   * importer wrote (ADR-006 decision 6 freezes import expansion, so an imported
   * line carries NULL and a published version is immutable), and a hand-typed
   * line whose typist supplied no work type, which stays permitted because the
   * column is nullable and a null key is a disclosure and not an error.
   *
   * STILL REPORTED AS ITS OWN VALUE rather than folded into `no_matching_rule`,
   * and the reason is unchanged in shape though not in owner: one is a baseline
   * someone must finish binding, the other is a line nobody has classified.
   * The work-type vocabulary still has no owning entity — glossary.md:109's «a
   * key with no owning fact… giving it one is a scope decision an ADR must
   * make» is untouched by 0050, which lands the carrier and not the entity.
   */
  "work_type_unresolved",
]);
export type DryRunLineCoverageValue = z.infer<typeof dryRunLineCoverage>;

export interface DryRunWorkLine {
  workItemId: string;
  position: number;
  workCode: string | null;
  description: string;
  workTypeKey: string | null;
  coverage: DryRunLineCoverageValue;
  /** The rule versions that would be materialised for an assignment on this line. */
  ruleVersionIds: string[];
}

export interface DryRunBoundRule {
  ruleVersionId: string;
  requirementRuleId: string;
  workTypeKey: string;
  stageKey: string;
  interventionType: string;
  blockingScope: string;
  timing: string;
  /** How many of the baseline's work lines this rule version matches. */
  matchedWorkLineCount: number;
}

export interface RequirementOccurrenceDryRunResponse {
  projectId: string;
  contractId: string;
  contractVersionId: string;
  versionNo: number;
  boundRules: DryRunBoundRule[];
  workLines: DryRunWorkLine[];
  /**
   * The explicit uncovered list, as part of the command's own output and not as
   * a report someone may choose to run (INV-072; version-0.1.md §v0.1-M2 exit
   * gates). A subset of `workLines` and repeated deliberately: a client that
   * renders only a summary must still have been handed the lines.
   */
  uncoveredLines: DryRunWorkLine[];
  summary: {
    workLineCount: number;
    boundRuleCount: number;
    uncoveredLineCount: number;
    /** Occurrences an assignment on every line, taken together, would produce. */
    wouldMaterialiseCount: number;
    /**
     * One machine-readable verdict, so «0 matched» is never read as «this
     * baseline is fine».
     *
     * `no_work_line_is_typed` says the count is zero because not one line of
     * this baseline names a work type, so the predicate had no left-hand side
     * to evaluate anywhere — a different fault from a baseline whose bindings
     * do not cover its lines, and one nobody fixes by binding more rules.
     *
     * RENAMED FROM `work_type_has_no_carrier`, and the rename is the point.
     * That value asserted a fact about the PRODUCT — «no column carries
     * work_type_key» — which was true until migration 0050 added
     * `public.work_items.work_type_key`. It is now a fact about the DATA: an
     * imported baseline, or a hand-typed one whose typist left the field empty.
     * The remedy differs accordingly (a superseding version with typed lines,
     * not an ADR), so the value may not keep a name that sends a reader to the
     * old one. Nothing is deployed and no client reads this yet.
     */
    diagnosis: "covered" | "partially_uncovered" | "no_bindings" | "no_work_line_is_typed";
  };
}
