import type { AssignmentMaterialisation, DryRunLineCoverageValue } from "@goproceed/contracts";

/**
 * THE MATERIALISATION PLAN — one function, two callers, and the reason they
 * must be one function.
 *
 * `assignments.create` materialises the obligation set; `requirement_occurrences
 * .dry_run` previews what materialisation would produce. A preview computed by
 * a second implementation is not a preview, it is a second opinion — and the
 * one thing a dry run exists to be is the same answer as the command it
 * anticipates. So the matching, the stage derivation and the copied fields live
 * here, as a pure function over rows, and both routes call it.
 *
 * NOTHING IN THIS FILE WRITES. The INSERT statements are in ./occurrence-writer,
 * which the dry-run route does not import. «The dry run stores no occurrence» is
 * therefore a property of the import graph and not of a code path someone has to
 * keep reading correctly.
 */

/**
 * A rule version the baseline BOUND, joined through the binding.
 *
 * Read through `contract_version_rule_bindings` and never by predicate over
 * `requirement_rule_versions`: the baseline pins a SET at publication, a rule
 * published afterwards does not enter it (INV-080), and a version retired
 * afterwards does not leave it (INV-067). The binding is the only correct
 * source, and migration 0043's `requirement_occurrences_from_binding_fkey`
 * makes an occurrence pinning anything else unstorable — so a query that read
 * the rule table directly would not merely be wrong, it would fail at INSERT.
 */
export interface BoundRuleVersion {
  ruleVersionId: string;
  requirementRuleId: string;
  workTypeKey: string;
  stageKey: string;
  ordinal: number;
  interventionType: string;
  blockingScope: string;
  timing: string;
  evidenceKind: string;
  acceptanceCriterion: string;
  performerRole: string;
  approverRole: string;
  approverIsExternal: boolean;
  minEvidenceCount: number;
  maxEvidenceCount: number | null;
  normRef: string | null;
  normRefVerification: string | null;
  normRefSource: string | null;
  referenceImageVersionId?: string | null;
}

/**
 * The one SELECT both routes use. Written once so the two callers cannot drift
 * in what they read, in the same spirit as «one mapper per table»
 * (src/lib/requirement-content.ts:11-14).
 *
 * `$1` workspace id, `$2` contract version id.
 */
export const BOUND_RULE_VERSIONS_SQL = `
  select rv.id as rule_version_id, b.requirement_rule_id, rv.work_type_key, rv.stage_key,
         rv.ordinal, rv.intervention_type, rv.blocking_scope, rv.timing, rv.evidence_kind,
         rv.acceptance_criterion, rv.performer_role, rv.approver_role,
         rv.approver_is_external, rv.min_evidence_count, rv.max_evidence_count,
         rv.norm_ref, rv.norm_ref_verification, rv.norm_ref_source, rv.reference_image_version_id
    from public.contract_version_rule_bindings b
    join public.requirement_rule_versions rv
      on rv.workspace_id = b.workspace_id and rv.id = b.requirement_rule_version_id
   where b.workspace_id = $1 and b.contract_version_id = $2
   order by rv.stage_key, rv.ordinal, rv.id`;

export function boundRuleVersion(r: Record<string, unknown>): BoundRuleVersion {
  return {
    ruleVersionId: String(r.rule_version_id),
    requirementRuleId: String(r.requirement_rule_id),
    workTypeKey: String(r.work_type_key),
    stageKey: String(r.stage_key),
    ordinal: Number(r.ordinal),
    interventionType: String(r.intervention_type),
    blockingScope: String(r.blocking_scope),
    timing: String(r.timing),
    evidenceKind: String(r.evidence_kind),
    acceptanceCriterion: String(r.acceptance_criterion),
    performerRole: String(r.performer_role),
    approverRole: String(r.approver_role),
    approverIsExternal: r.approver_is_external === true,
    minEvidenceCount: Number(r.min_evidence_count),
    maxEvidenceCount: r.max_evidence_count === null || r.max_evidence_count === undefined
      ? null : Number(r.max_evidence_count),
    normRef: (r.norm_ref as string | null) ?? null,
    normRefVerification: (r.norm_ref_verification as string | null) ?? null,
    normRefSource: (r.norm_ref_source as string | null) ?? null,
    referenceImageVersionId: (r.reference_image_version_id as string | null) ?? null,
  };
}

/**
 * One work line, as much of it as the predicate and the disclosure need.
 *
 * `workTypeKey` is the predicate's first argument on the LINE side. It is
 * `string | null` and null is not an error: see `workTypeKeyOf`.
 */
export interface WorkLine {
  workItemId: string;
  position: number;
  workCode: string | null;
  description: string;
  workTypeKey: string | null;
}

/**
 * THE PREDICATE'S FIRST ARGUMENT, READ OFF THE LINE.
 *
 * A requirement rule is a predicate over (work type, stage) in v0.1 (ADR-006
 * decision 4.2), and `requirement_rule_versions.work_type_key` is its first
 * argument's right-hand side. The left-hand side is the work line's own work
 * type — glossary.md:109: «carried as `work_type_key` on the work item and on
 * the rule version».
 *
 * UNTIL MIGRATION 0050 THE LINE SIDE HAD NO CARRIER, and this function returned
 * null for every row in the product. Only the line side: the rule version has
 * carried `work_type_key` since 0041:326, so the predicate always had a
 * right-hand side and never a left one. (This sentence read «IT WAS CARRIED ON
 * NEITHER» until 2026-08-08 — meant as «on neither of the two carriers
 * glossary.md:109 names», read as a claim about the rule version that is
 * false.) The old comment recorded why the null was a disclosed hole and not a
 * stub, and the two routes around it that were worse:
 *
 *   * MATCH EVERYTHING — every assignment under the baseline materialises every
 *     bound rule. The foreman on a masonry line is then told to photograph
 *     cable trays before concealment, and INV-063 forbids clearing that with
 *     `not_applicable` on a hold: the only escape is a waiver or an accepted
 *     risk, both permanent, both attributed, both recording that someone waived
 *     a real obligation. It manufactures false entries in the record the whole
 *     product exists to keep.
 *   * MATCH NOTHING, QUIETLY — the foreman sees an empty screen and a stage
 *     closes vacuously. That is exactly INV-072's failure, and it is silent.
 *
 * Migration 0050 adds `public.work_items.work_type_key` and this function reads
 * it. THE OLD BEHAVIOUR IS STILL REACHABLE AND IS STILL CORRECT: the column is
 * nullable, every line the frozen importer wrote carries NULL, and a null key
 * matches nothing and is disclosed as `work_type_unresolved` exactly as before.
 * What changed is that it is no longer the only outcome.
 *
 * WHAT THIS FUNCTION DOES NOT DO, and must not: it does not normalise. This
 * comparison, `app.work_type_key_is_bindable` and the database's row constraint
 * must all be exact string equality on the same bytes; trimming or case-folding
 * in one of them and not the others is how two comparisons come to disagree,
 * which is the failure this whole carrier exists to remove.
 *
 * WHERE THE NORMALISED FORM COMES FROM, stated precisely because this comment
 * used to get it wrong. It said «the database refuses a padded key on this
 * column outright (`work_items_work_type_key_shape_check`)». It does not:
 * that CHECK is `work_type_key = btrim(work_type_key)`, and PostgreSQL's
 * one-argument `btrim` strips SPACES ONLY, so a tab-, newline- or NBSP-padded
 * key satisfies it. Corrected 2026-08-08 (migration 0050 §1 carries the full
 * statement and records the tightening as owed on both columns). The key is
 * trimmed before it ever reaches a row, by `z.string().trim()` on both wires
 * that can write one — `workTypeKey` in packages/contracts/src/work-items.ts on
 * the line side and in requirement-rules.ts on the rule side — and a key that
 * escaped that would still have to name a rule version the workspace can bind,
 * which `work_items_work_type_guard` enforces. So THE REQUEST SCHEMA NORMALISES
 * AND THIS FUNCTION DOES NOT, deliberately: normalisation happens once, at the
 * edge, on the way in; every comparison after it is byte equality.
 *
 * WHAT IT DOES NOT GUARANTEE: that the key matches anything the BASELINE bound.
 * The database guarantees only that a non-null key names a rule version the
 * WORKSPACE can bind. A line whose key resolves in the workspace and matches no
 * bound rule is the ordinary uncovered line — `no_matching_rule` — which
 * ADR-006 decision 4.2 requires be named rather than refused, and which
 * `contract_versions.publish` names by position at publication.
 */
export function workTypeKeyOf(line: WorkLine): string | null {
  return line.workTypeKey;
}

function matchesLine(rule: BoundRuleVersion, workTypeKey: string | null): boolean {
  if (workTypeKey === null) return false;
  return rule.workTypeKey === workTypeKey;
}

export interface PlannedStage {
  stageKey: string;
  /**
   * DERIVED FROM THE TIMING OF THE RULES THAT LAND ON THIS STAGE, and the
   * derivation is a judgement the spec does not make. A stage is concealed
   * because it will be covered, which is a fact about the building; nothing in
   * the rule version records it, and no v0.1 command asks anyone. What the
   * schema does say is that an occurrence timed `before_concealment` is
   * unstorable unless its stage is concealed (migration 0043's CHECK), so a
   * stage carrying such a rule must be concealed or materialisation fails
   * inside the transaction that creates the assignment.
   *
   * Any rule on the stage timed `before_concealment` therefore conceals it. The
   * derivation is per stage and not per rule because the stage is ONE row —
   * `work_stages_closable_unit_uniq` makes (assignment, location, stage_key) a
   * single closable unit — so if two bound rules disagree about whether the
   * stage is covered, the covered reading wins. Recorded as a judgement, not as
   * a reading of the spec.
   */
  isConcealed: boolean;
}

export interface PlannedOccurrence {
  stageKey: string;
  rule: BoundRuleVersion;
}

export interface MaterialisationPlan {
  stages: PlannedStage[];
  occurrences: PlannedOccurrence[];
  coverage: AssignmentMaterialisation["coverage"];
  workTypeKey: string | null;
}

/**
 * What an assignment on `line`, under a baseline binding `bound`, would
 * materialise.
 *
 * Deterministic in order: stages by key, occurrences by (stage key, ordinal,
 * rule version id). `ordinal` is the rule's position in an ordered set and
 * nothing constrains it to be distinct (M1 review finding 6), so the id breaks
 * the tie rather than leaving two rows in whichever order the database returned
 * them.
 */
export function planMaterialisation(
  line: WorkLine, bound: readonly BoundRuleVersion[],
): MaterialisationPlan {
  return planForWorkType(workTypeKeyOf(line), bound);
}

/**
 * The plan, given a work type that has already been resolved.
 *
 * Split from `planMaterialisation` so that the matching, the stage derivation
 * and the ordering can be exercised by a test that SUPPLIES a work type. It was
 * written when the product could not store one; migration 0050 lands the
 * carrier, `workTypeKeyOf` reads it, and everything below is unchanged — which
 * is what the split was for. The unit tests that supply a key directly stay
 * valuable: they cover the matching itself without a database.
 */
export function planForWorkType(
  workTypeKey: string | null, bound: readonly BoundRuleVersion[],
): MaterialisationPlan {
  const matched = bound.filter((r) => matchesLine(r, workTypeKey));

  const stageKeys = [...new Set(matched.map((r) => r.stageKey))].sort();
  const stages: PlannedStage[] = stageKeys.map((stageKey) => ({
    stageKey,
    isConcealed: matched.some(
      (r) => r.stageKey === stageKey && r.timing === "before_concealment"),
  }));

  const occurrences: PlannedOccurrence[] = [...matched]
    .sort((a, b) => a.stageKey.localeCompare(b.stageKey)
      || a.ordinal - b.ordinal
      || a.ruleVersionId.localeCompare(b.ruleVersionId))
    .map((rule) => ({ stageKey: rule.stageKey, rule }));

  return { stages, occurrences, coverage: coverageOf(bound, matched, workTypeKey), workTypeKey };
}

function coverageOf(
  bound: readonly BoundRuleVersion[], matched: readonly BoundRuleVersion[],
  workTypeKey: string | null,
): AssignmentMaterialisation["coverage"] {
  if (matched.length > 0) return "covered";
  // Ordered deliberately: a baseline with no bindings is the finding M1 review
  // finding 1 left open (import_batches.publish can publish one), and it must
  // not be reported as a work-type problem. INV-083 is what should have made it
  // impossible; until both publication routes refuse it, this is the value that
  // names it.
  if (bound.length === 0) return "no_bindings";
  if (workTypeKey === null) return "work_type_unresolved";
  return "no_matching_rule";
}

/** The dry run's per-line verdict, from the same computation. */
export function lineCoverage(
  bound: readonly BoundRuleVersion[], line: WorkLine,
): { coverage: DryRunLineCoverageValue; ruleVersionIds: string[]; workTypeKey: string | null } {
  const plan = planMaterialisation(line, bound);
  const ruleVersionIds = plan.occurrences.map((o) => o.rule.ruleVersionId);
  if (ruleVersionIds.length > 0) {
    return { coverage: "covered", ruleVersionIds, workTypeKey: plan.workTypeKey };
  }
  // A baseline with no bindings leaves every line uncovered, and the reason a
  // caller can act on is still the line's own: with no work type there is
  // nothing to bind FOR. `no_bindings` is reported once, in the summary.
  return {
    coverage: plan.workTypeKey === null ? "work_type_unresolved" : "no_matching_rule",
    ruleVersionIds,
    workTypeKey: plan.workTypeKey,
  };
}
