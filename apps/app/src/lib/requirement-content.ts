import type {
  AllowedMedia, RequirementLibraryItem, RequirementOccurrenceView,
  RequirementRuleVersionResponse, VerificationTagValue,
} from "@goproceed/contracts";

/**
 * The regulatory content shared by `requirement_library.list` and the two
 * `requirement_rule_versions` commands: one row → one view, and one composer for
 * the attribution string.
 *
 * ONE MAPPER PER TABLE, for the reason src/lib/manual-baseline.ts:274-279 gives
 * about a work line: a row must read identically however it is fetched, and two
 * mappers are two chances for it not to.
 */

/**
 * The attribution a rule version freezes into `norm_ref`.
 *
 * THE FORM IS NOT INVENTED HERE. docs/product/hidden-works-content-rules.md
 * §"What the product MAY assert" item 1 gives it literally — «ДБН А.3.1-5:2016,
 * Додаток Н (довідковий), позиція Н.15» — and this function reproduces that
 * shape with the standard and the position read off the cited row rather than
 * written into the code, so a row whose `source_standard` ever differs cannot be
 * attributed to a standard it does not name.
 *
 * WHAT IS DELIBERATELY ABSENT, and each absence is a prohibition:
 *
 *  * NO ITEM NUMBER. The allow-listed attribution is position-level. «п. 3» is a
 *    citation this repository has no licence for, and prohibition A is written
 *    against exactly the habit of extending a normative citation because it
 *    reads better. The item number is still carried — `acceptance_criterion`
 *    holds the item's verbatim text — it is simply not part of the citation.
 *  * NO PAGE NUMBER (prohibition Q: three sourcing passes produced three
 *    paginations).
 *  * NO APPROVING ORDER. «наказ Мінрегіону від 05.05.2016 № 115» is asserted by
 *    no allow-list item and was removed from the act disclaimer on 2026-08-06;
 *    §"Open items" records that removal as stopping it from reaching a customer
 *    rather than closing the gap. It must not re-enter through a citation.
 *  * NO «орієнтовний». Prohibition B: the string «орієнтовн» occurs zero times
 *    in the standard, and «довідковий» is the correct word — which is also the
 *    only storable value of `normative_character`.
 *
 * The string this returns is normative, so it is stored ONLY alongside the
 * cited row's own `verification` tag and `source_citation`, and
 * `requirement_rule_versions_norm_ref_sourced_check` (0041) makes any other
 * combination unstorable.
 */
export function citationOf(sourceStandard: string, positionCode: string): string {
  return `${sourceStandard}, Додаток Н (довідковий), позиція ${positionCode}`;
}

/**
 * The citation of a requirement a workspace took from its own робоча
 * документація. Allow-list item 8 is the only thing asserted about WHY it
 * binds: «the binding list for a given site comes from робоча документація
 * (п. 8.4.3.3)». Nothing here attributes the TEXT to a ДБН.
 *
 * THE ДБН REFERENCE INSIDE THE PARENTHESES IS NOT AN ATTRIBUTION OF THE TEXT,
 * and the distinction is the whole of why this string is allowed to name a
 * standard at all. It cites the clause that makes a site's own documentation
 * binding for that site; `citationOf` above cites a standard as the AUTHOR of
 * the wording. Confusing the two is exactly what
 * hidden-works-content-rules.md §"Project-sourced strings" forbids — «never as
 * content of ДБН А.3.1-5:2016 … and never under a standard's attribution».
 *
 * NO «Додаток Н», ever. A project-sourced string «must never appear inside a
 * Додаток Н block», and a citation carrying that name is how it would end up
 * rendered inside one.
 */
export function projectSourceNormRef(): string {
  return "Робоча документація об'єкта (п. 8.4.3.3 ДБН А.3.1-5:2016)";
}

/**
 * The structured source that must accompany `projectSourceNormRef()` —
 * document, аркуш, креслення, and the ревізія when one was given.
 *
 * THE PROJECT NAME IS DELIBERATELY ABSENT. A name is mutable and this string is
 * frozen into `rule_version_hash`, so a renamed project would leave every
 * version that cited it carrying a name the workspace no longer uses. The three
 * structured fields identify the document, and the version's own
 * `project_sourced_requirement_item_id` carries the project mark by reference.
 *
 * THE REVISION IS OPTIONAL BECAUSE THE COLUMN IS. `source_revision` is the one
 * nullable identifying field on `project_sourced_requirement_items` (0059); the
 * other three are NOT NULL and non-blank, which is what makes «робоча
 * документація» a source rather than a word (INV-073, ADR-010 decision 3).
 */
export function projectSourceCitationOf(
  document: string, sheet: string, drawingNo: string, revision: string | null,
): string {
  const base = `${document}, арк. ${sheet}, кресл. ${drawingNo}`;
  return revision === null ? base : `${base}, ревізія ${revision}`;
}

export interface LibraryItemRow {
  id: string;
  source_standard: string;
  position_code: string;
  position_title_uk: string;
  item_no: number | string;
  item_text_uk: string;
  normative_character: string;
  verification: string;
  source_citation: string;
  act_form_assumption: string | null;
  act_form_basis: string;
}

/**
 * One library row → the one view. The narrow literal types
 * (`positionCode`, `normativeCharacter`, `actFormBasis`) are asserted rather
 * than checked here on purpose: `requirementLibraryItem` in @goproceed/contracts
 * re-parses the whole object at the route boundary, so a row that somehow
 * carried another value fails loudly there instead of being coerced quietly here.
 */
export function libraryItemView(r: LibraryItemRow): RequirementLibraryItem {
  return {
    libraryItemId: r.id,
    sourceStandard: r.source_standard,
    positionCode: r.position_code as RequirementLibraryItem["positionCode"],
    positionTitleUk: r.position_title_uk,
    itemNo: Number(r.item_no),
    itemTextUk: r.item_text_uk,
    normativeCharacter: r.normative_character as "dovidkovyi",
    verification: r.verification as VerificationTagValue,
    sourceCitation: r.source_citation,
    actFormAssumption: r.act_form_assumption as RequirementLibraryItem["actFormAssumption"],
    actFormBasis: r.act_form_basis as "product_assumption",
  };
}

export interface RuleVersionRow {
  id: string;
  requirement_rule_id: string;
  version_no: number | string;
  ordinal: number | string;
  status: string;
  rule_version_hash: string;
  work_type_key: string;
  stage_key: string;
  intervention_type: string;
  blocking_scope: string;
  timing: string;
  evidence_kind: string;
  acceptance_criterion: string;
  performer_role: string;
  approver_role: string;
  approver_is_external: boolean;
  min_evidence_count: number | string;
  max_evidence_count: number | string | null;
  allowed_media: unknown;
  norm_ref: string | null;
  norm_ref_verification: string | null;
  norm_ref_source: string | null;
  /**
   * The two provenances, exactly one of them filled —
   * `requirement_rule_versions_one_provenance_check` (0059) is what makes the
   * pair exclusive. Both are nullable HERE and not only in the database: a
   * `string` on either would let a reader dereference the arm that is null on
   * every row published from the other source.
   */
  requirement_library_item_id: string | null;
  project_sourced_requirement_item_id: string | null;
  published_at: Date | string;
}

/**
 * `allowed_media` is `jsonb not null default '[]'::jsonb` (0041). Two shapes are
 * therefore storable and they mean different things: the OBJECT the upload gate
 * reads, and the empty ARRAY that is the column's default and means «this
 * evidence kind produces no uploaded original». Returning the array as-is would
 * hand a client a value its own contract types as `AllowedMedia | null`, so the
 * default is mapped to `null` — the same distinction
 * `publishRequirementRuleVersionRequest` makes by requiring the object for
 * `photo`/`document` and refusing it for `measurement`/`checkbox`.
 */
export function allowedMediaOf(value: unknown): AllowedMedia | null {
  if (value === null || value === undefined || Array.isArray(value)) return null;
  const v = value as Partial<AllowedMedia>;
  if (!Array.isArray(v.mimeTypes) || typeof v.maxByteSize !== "number") return null;
  return { mimeTypes: v.mimeTypes, maxByteSize: v.maxByteSize };
}

/**
 * One rule-version row → the one view.
 *
 * `interventionType` and `blockingScope` are narrowed to the single value each
 * that v0.1 can produce, matching `RequirementRuleVersionResponse`. That is not
 * a coercion: INV-082 is refused by `publishRequirementRuleVersionRequest`
 * before a row can exist, and the CHECK stays permissive so v0.2's widening is
 * additive (0041 departure 2). A row carrying `witness` in a v0.1 database would
 * be a defect upstream of this mapper.
 */
export function ruleVersionView(r: RuleVersionRow): RequirementRuleVersionResponse {
  return {
    ruleVersionId: r.id,
    requirementRuleId: r.requirement_rule_id,
    versionNo: Number(r.version_no),
    ordinal: Number(r.ordinal),
    status: "published",
    ruleVersionHash: r.rule_version_hash,
    workTypeKey: r.work_type_key,
    stageKey: r.stage_key,
    interventionType: r.intervention_type as "hold",
    blockingScope: r.blocking_scope as "blocks_stage_closure",
    timing: r.timing as RequirementRuleVersionResponse["timing"],
    evidenceKind: r.evidence_kind as RequirementRuleVersionResponse["evidenceKind"],
    acceptanceCriterion: r.acceptance_criterion,
    performerRole: r.performer_role,
    approverRole: r.approver_role,
    approverIsExternal: r.approver_is_external,
    minEvidenceCount: Number(r.min_evidence_count),
    maxEvidenceCount: r.max_evidence_count === null ? null : Number(r.max_evidence_count),
    allowedMedia: allowedMediaOf(r.allowed_media),
    normRef: r.norm_ref,
    normRefVerification: r.norm_ref_verification as VerificationTagValue | null,
    normRefSource: r.norm_ref_source,
    // BOTH provenances travel, one of them null, and the null half is
    // information rather than an omission: it is how a reader tells a version
    // resting on the shipped Додаток Н from one resting on a site's own робоча
    // документація (ADR-010). Returning only the filled one would make the two
    // arms indistinguishable to a consumer that reads a single field.
    requirementLibraryItemId: r.requirement_library_item_id,
    projectSourcedRequirementItemId: r.project_sourced_requirement_item_id,
    publishedAt: new Date(r.published_at).toISOString(),
  };
}

/**
 * One occurrence row → the one view, with `allowed_media` joined from the
 * PINNED rule version.
 *
 * WHY THE MEDIA POLICY IS JOINED AND NOT COPIED. Migration 0043 gives
 * `requirement_occurrences` no `allowed_media` column. Reading it through
 * `rule_version_id` returns exactly what a copy would have returned and cannot
 * drift from it: the version is publish/retire-only, has no UPDATE grant and
 * carries a frozen-content guard (0041), and the occurrence's pin is a foreign
 * key it cannot repoint because the table is append-only. The nine fields the
 * occurrence DOES copy are copies the schema cannot verify (0043 §4); this is
 * the tenth field, and not copying it is why there is no tenth unverifiable
 * copy.
 */
export interface OccurrenceRow {
  id: string;
  work_assignment_id: string;
  rule_version_id: string;
  ordinal: number | string;
  work_stage_id: string | null;
  stage_key: string;
  stage_is_concealed: boolean | null;
  intervention_type: string;
  blocking_scope: string;
  timing: string;
  evidence_kind: string;
  acceptance_criterion: string;
  performer_role: string;
  approver_role: string;
  approver_is_external: boolean;
  min_evidence_count: number | string;
  max_evidence_count: number | string | null;
  norm_ref: string | null;
  norm_ref_verification: string | null;
  norm_ref_source: string | null;
  created_at: Date | string;
  /** joined: public.requirement_rule_versions.allowed_media */
  allowed_media: unknown;
}

export function occurrenceView(r: OccurrenceRow): RequirementOccurrenceView {
  return {
    occurrenceId: r.id,
    workAssignmentId: r.work_assignment_id,
    ruleVersionId: r.rule_version_id,
    ordinal: Number(r.ordinal),
    stage: {
      stageId: r.work_stage_id,
      stageKey: r.stage_key,
      isConcealed: r.stage_is_concealed,
    },
    interventionType: r.intervention_type as RequirementOccurrenceView["interventionType"],
    blockingScope: r.blocking_scope as RequirementOccurrenceView["blockingScope"],
    timing: r.timing as RequirementOccurrenceView["timing"],
    evidenceKind: r.evidence_kind as RequirementOccurrenceView["evidenceKind"],
    acceptanceCriterion: r.acceptance_criterion,
    performerRole: r.performer_role,
    approverRole: r.approver_role,
    approverIsExternal: r.approver_is_external,
    minEvidenceCount: Number(r.min_evidence_count),
    maxEvidenceCount: r.max_evidence_count === null ? null : Number(r.max_evidence_count),
    allowedMedia: allowedMediaOf(r.allowed_media),
    // INV-073, rendering half. The three columns travel as one object or not at
    // all: a citation without its tag and its source may not be shown, and
    // `requirement_occurrences_norm_ref_sourced_check` (0043) is what makes the
    // partial combination unstorable. `requirementOccurrenceView` re-parses this
    // at the route boundary, so a row that somehow carried a bare norm_ref fails
    // loudly there rather than rendering as normative.
    normRef: r.norm_ref === null ? null : {
      text: r.norm_ref,
      verification: r.norm_ref_verification as VerificationTagValue,
      source: r.norm_ref_source ?? "",
    },
    materialisedAt: new Date(r.created_at).toISOString(),
  };
}
