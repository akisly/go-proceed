import { z } from "zod";
import type { VerificationTagValue } from "./requirement-library";

/**
 * Requirement rule versions — the immutable published obligation.
 *
 * Two operations, both `command` / idempotency `required` / `member` plane
 * (technical/openapi/scope-v0.1.csv:29-30), so both carry an `Idempotency-Key`
 * HEADER rather than a body field:
 *   `requirement_rule_versions.publish`
 *     POST /v1/workspaces/{workspaceId}/requirement-rule-versions
 *   `requirement_rule_versions.retire`
 *     POST /v1/requirement-rule-versions/{ruleVersionId}/retire
 *
 * A rule version is PUBLISH OR RETIRE ONLY and is never updated (INV-067),
 * which is why there is no update request in this file and never will be: a
 * consumer addresses a version by id, and retirement stops future binding
 * without changing an obligation already agreed.
 *
 * PUBLICATION IS ONE COMMAND, NOT A DRAFT LIFECYCLE. `public.requirement_rules`
 * is not in v0.1 (ADR-006 decision 4.1) and there is no rule-drafting
 * operation in either scope CSV, so a version cannot be published "through" a
 * draft rule that does not exist. `draft` stays in the column's vocabulary so
 * that v0.2's drafting slice is additive
 * (supabase/migrations/0041_requirement_rules_bound_to_the_baseline.sql:288-292).
 *
 * These operations have nothing to do with `requirement_templates.create` and
 * `.publish` in ./requirements, which author the one-template-per-assignment
 * model ADR-005 decision 2 retires. Those routes are live and are owed a
 * removal slice; this file supersedes them and does not extend them.
 */

export const interventionType = z.enum(["hold", "witness", "review"]);
export type InterventionTypeValue = z.infer<typeof interventionType>;

export const blockingScope = z.enum([
  "none", "blocks_stage_closure", "blocks_package_inclusion", "blocks_both",
]);
export type BlockingScopeValue = z.infer<typeof blockingScope>;

export const requirementTiming = z.enum([
  "before_work", "during", "before_concealment", "after", "before_package",
]);
export type RequirementTimingValue = z.infer<typeof requirementTiming>;

export const evidenceKind = z.enum(["photo", "measurement", "document", "checkbox"]);
export type EvidenceKindValue = z.infer<typeof evidenceKind>;

/**
 * Identical in shape to `createRequirementTemplateRequest.allowedMedia`, and
 * that identity is load-bearing rather than tidy. The deployed upload gate
 * reads `allowed_media` as this exact object
 * (apps/app/app/v1/assignments/[assignmentId]/upload-intents/route.ts:59-63)
 * and M2 repoints it at the requirement occurrence, which copies its media
 * rules from the rule version. A different shape here would make the gate read
 * a value it cannot interpret and fall through to `FALLBACK_MEDIA`.
 */
const allowedMedia = z.object({
  mimeTypes: z.array(z.string().regex(/^[a-z]+\/[a-z0-9.+-]+$/)).min(1).max(20),
  maxByteSize: z.number().int().positive().max(50 * 1024 * 1024),
}).strict();
export type AllowedMedia = z.infer<typeof allowedMedia>;

export const publishRequirementRuleVersionRequest = z.object({
  /**
   * The lineage key. Absent starts a new lineage and the command mints one;
   * present publishes the next version of an existing lineage under
   * `unique (workspace_id, requirement_rule_id, version_no)`. In v0.1 it has
   * no referent — `public.requirement_rules` is a v0.2 table (ADR-006 decision
   * 4.1) — and the uniqueness constraints carry its meaning instead: one rule
   * contributes at most one version to a baseline.
   */
  requirementRuleId: z.string().guid().optional(),
  /** Position inside the rule's ordered set; the order is part of what was agreed. */
  ordinal: z.number().int().min(1).default(1),
  /**
   * The v0.1 predicate is (work type, stage) and nothing else. ADR-005
   * decision 2 defines it over (work type, location node, stage); ADR-006
   * decision 4.2 moves `locations` and location-subtree instantiation to v0.2,
   * so there is no location predicate on this wire and the column keeps its
   * `{}` default.
   */
  workTypeKey: z.string().trim().min(1).max(200),
  stageKey: z.string().trim().min(1).max(200),
  /**
   * The full vocabulary is accepted by the SCHEMA so that the refusal below
   * can name what is wrong; the CHECK in the database keeps all three values
   * for the same reason (v0.2 stays additive and no v0.1 record is
   * reinterpreted). See the two INV-082 refinements at the bottom.
   */
  interventionType,
  blockingScope,
  timing: requirementTiming,
  evidenceKind,
  /**
   * Absent means the command copies the cited library item's `item_text_uk`
   * VERBATIM — the standard's own wording, which is what ADR-006 step 2
   * promises the foreman will see. Supplied means workspace wording: it is
   * stored as the acceptance criterion and it is NOT a normative string, and
   * it never acquires the citation's verification tag by sitting next to it.
   */
  acceptanceCriterion: z.string().trim().min(1).max(2000).optional(),
  performerRole: z.string().trim().min(1).max(100),
  approverRole: z.string().trim().min(1).max(100),
  /**
   * INV-085 — while v0.1-M5 is open a `hold` must name an INTERNAL approver
   * role — is enforced by the COMMAND and is deliberately not a refinement
   * here. It is lifted WITHIN v0.1, by the same change that ships the
   * occurrence grant; a request contract that changes between M4 and M5 would
   * make a client that is already correct start failing. The two INV-082
   * refusals below are different in kind: they are lifted only at v0.2, which
   * is a different contract set anyway.
   */
  approverIsExternal: z.boolean().default(false),
  minEvidenceCount: z.number().int().min(1).default(1),
  maxEvidenceCount: z.number().int().positive().nullable().default(null),
  /**
   * Required for the evidence kinds that produce an uploaded original, and
   * refused for the ones that do not. The column defaults to `'[]'::jsonb` —
   * an ARRAY, which is not the object the upload gate reads — so a rule
   * version that relies on the default would hand M2 a media policy it cannot
   * interpret. Making it required where it matters means the default is never
   * the value an occurrence copies.
   */
  allowedMedia: allowedMedia.optional(),
  /**
   * One of two mutually exclusive sources for this version's content — see
   * `projectSourcedRequirementItemId` and the superRefine below for the
   * exactly-one rule. REQUIRED, and the only source, until ADR-010
   * superseded that one clause of ADR-006 decision 4.1 ("the only rule
   * source in v0.1 is the shipped library") and gave a workspace a second
   * source of its own, still within v0.1. The column was already nullable
   * for exactly this reason: a NOT NULL would have baked "library only" into
   * the schema and made a second source a schema change rather than the
   * additive one ADR-010 turned out to need.
   *
   * NOTE WHAT IS NOT ON THIS WIRE: `normRef`, `normRefVerification` and
   * `normRefSource`. The command COPIES all three from the cited library row
   * into the version's immutable content. A caller that could send them could
   * assert a normative string with a verification tag it invented, which is
   * exactly what INV-073 and hidden-works-content-rules.md exist to prevent.
   * They are returned, never accepted.
   */
  requirementLibraryItemId: z.string().guid().optional(),
  /**
   * The second source (ADR-010): an item a workspace authored into
   * `project_requirements` from its own робоча документація, rather than the
   * shipped library. Exactly one of this and `requirementLibraryItemId` is
   * required — see the superRefine below — because a version rests on one
   * source, never both and never neither. Same shape as the library arm: the
   * caller names which item, and the command copies its content into the
   * version rather than accepting normative text directly.
   */
  projectSourcedRequirementItemId: z.string().guid().optional(),
}).strict().superRefine((v, ctx) => {
  // INV-082, first refusal (ADR-006 decision 4.3). `witness` needs the notice
  // event and its attendance outcomes; `review`'s only blocking scope is
  // package inclusion and v0.1 has no packages. Both return in v0.2.
  if (v.interventionType !== "hold") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["interventionType"],
      message: "v0.1 publishes intervention_type 'hold' only (ADR-006 decision 4.3)",
    });
  }
  // INV-082, second refusal (ADR-006 decision 4.4). A v0.1 hold is
  // blocks_stage_closure, not blocks_both: in a version with no packages the
  // other half of `both` has nothing to block. v0.2's package milestone owes a
  // migration that widens every hold written during v0.1 (INV-066).
  if (v.interventionType === "hold" && v.blockingScope !== "blocks_stage_closure") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["blockingScope"],
      message: "a v0.1 hold is 'blocks_stage_closure' (ADR-006 decision 4.4)",
    });
  }
  if (v.maxEvidenceCount != null && v.maxEvidenceCount < v.minEvidenceCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxEvidenceCount"],
      message: "maxEvidenceCount must not be below minEvidenceCount",
    });
  }
  const needsMedia = v.evidenceKind === "photo" || v.evidenceKind === "document";
  if (needsMedia && v.allowedMedia == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowedMedia"],
      message: "allowedMedia is required for evidenceKind 'photo' and 'document'",
    });
  }
  if (!needsMedia && v.allowedMedia != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowedMedia"],
      message: "allowedMedia is not accepted for evidenceKind 'measurement' and 'checkbox'",
    });
  }
  // ADR-010: v0.1 has two rule sources and a version rests on exactly one.
  // AT MOST ONE IN THE DATABASE, EXACTLY ONE ON THE WIRE — the two halves are
  // not the same rule and the difference is load-bearing.
  // requirement_rule_versions_one_provenance_check (0059) is
  // `library is null or project_sourced is null`: it refuses BOTH ids and
  // admits NEITHER, so a row citing no source at all is storable and
  // m1-project-sourced-schema.test.ts asserts that it is. The exactly-one rule
  // lives HERE and nowhere else, so this refusal is not a friendlier restating
  // of a constraint — for the both-ids half it names the field instead of
  // raising 23514, and for the neither-id half it is the only refusal there is.
  if ((v.requirementLibraryItemId != null) === (v.projectSourcedRequirementItemId != null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["requirementLibraryItemId"],
      message: "exactly one of requirementLibraryItemId or projectSourcedRequirementItemId is required",
    });
  }
});
export type PublishRequirementRuleVersionRequest =
  z.infer<typeof publishRequirementRuleVersionRequest>;

/**
 * The frozen content of a published rule version.
 *
 * `interventionType` and `blockingScope` are narrowed to the single value each
 * that v0.1 can produce — the same choice `ContractVersionResponse.status`
 * already makes with `"published"`. v0.2 widens both, and widening a response
 * union is additive for a reader that switches on it.
 */
export interface RequirementRuleVersionResponse {
  ruleVersionId: string;
  requirementRuleId: string;
  versionNo: number;
  ordinal: number;
  status: "published";
  /** Content hash, hex. What an occurrence and a binding pin, and never a live pointer. */
  ruleVersionHash: string;
  workTypeKey: string;
  stageKey: string;
  interventionType: "hold";
  blockingScope: "blocks_stage_closure";
  timing: RequirementTimingValue;
  evidenceKind: EvidenceKindValue;
  acceptanceCriterion: string;
  performerRole: string;
  approverRole: string;
  approverIsExternal: boolean;
  minEvidenceCount: number;
  maxEvidenceCount: number | null;
  allowedMedia: AllowedMedia | null;
  /**
   * The citation, copied. `normRef` is non-null only alongside BOTH its tag and
   * its source — unstorable otherwise (INV-073), so unrenderable rather than
   * merely undecorated.
   */
  normRef: string | null;
  normRefVerification: VerificationTagValue | null;
  normRefSource: string | null;
  /**
   * The two provenances (ADR-010), EXACTLY ONE of them non-null — the same
   * exactly-one rule the publish request states above and
   * `requirement_rule_versions_one_provenance_check` enforces in the database.
   *
   * BOTH ARE CARRIED, AND THE NULL HALF IS THE INFORMATION. Which source a
   * version rests on is not derivable from `normRefVerification` alone
   * (`PROJECT_DOCUMENTATION` names an origin, not the item), and a response
   * carrying only the filled field would leave a consumer unable to tell an
   * absent provenance from an arm it did not read. `requirementLibraryItemId`
   * became nullable here when the second arm shipped: a reader that treated it
   * as always present would dereference `null` on every project-sourced
   * version.
   */
  requirementLibraryItemId: string | null;
  projectSourcedRequirementItemId: string | null;
  publishedAt: string;
}
export type PublishRequirementRuleVersionResponse = RequirementRuleVersionResponse;

/**
 * `requirement_rule_versions.retire`. Empty body: the identity is in the path
 * and the replay protection is in the `Idempotency-Key` header, the same shape
 * `publishRequirementTemplateRequest` and `finalizeUploadIntentRequest` take.
 *
 * There is no reason field because there is no column to hold one, and a
 * reason accepted and dropped is worse than a reason not asked for. Retirement
 * stops FUTURE binding; a baseline that already bound this version keeps it,
 * and the occurrence that pinned it is unchanged (INV-067).
 */
export const retireRequirementRuleVersionRequest = z.object({}).strict();
export type RetireRequirementRuleVersionRequest =
  z.infer<typeof retireRequirementRuleVersionRequest>;

export interface RetireRequirementRuleVersionResponse {
  ruleVersionId: string;
  status: "retired";
  retiredAt: string;
}
