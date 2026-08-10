import type { Tx } from "@goproceed/database";
import {
  statutoryActVersionView,
  type StatutoryActDecisionView, type StatutoryActQuantityLineView,
  type StatutoryActSignatoryView, type StatutoryActVersionView, type VerificationTagValue,
} from "@goproceed/contracts";
import { rescale, type Decimal, type Midpoint } from "@goproceed/domain";
import { assuranceLevelOf } from "./statutory-act-form";

/**
 * The act's shared reads and the printed-quantity arithmetic.
 *
 * ONE MAPPER PER TABLE, for src/lib/requirement-content.ts's reason: a row must
 * read identically however it is fetched, and two mappers are two chances for it
 * not to. `statutory_acts.compose`, `.freeze`, `.get` and `.render` all return
 * the same `StatutoryActVersionView` from this one function, so a caller cannot
 * be shown an act by one route that disagrees with the act another route shows.
 *
 * NOTHING HERE WAS EXECUTED: no test run, no query issued, no build.
 */

// ───────────────────────────────────────────────────────────────────────────
// The printed quantity
// ───────────────────────────────────────────────────────────────────────────

/**
 * Parse a PostgreSQL `numeric` as it arrives over the wire — a plain decimal
 * with a dot, never localized. `parseLocalizedDecimal` is for text a human
 * typed; this is for text the database produced, and using the localized parser
 * here would make a column's meaning depend on a locale argument.
 */
export function parsePgNumeric(text: string): Decimal | null {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!m) return null;
  const sign = m[1] ?? "";
  const intPart = m[2] ?? "";
  const frac = m[3] ?? "";
  return { scaled: BigInt(sign + intPart + frac), scale: frac.length };
}

/** A scaled integer back to a decimal string with exactly `scale` fraction digits. */
export function formatScaled(scaled: bigint, scale: number): string {
  const neg = scaled < 0n;
  const digits = (neg ? -scaled : scaled).toString().padStart(scale + 1, "0");
  const cut = digits.length - scale;
  const body = scale === 0 ? digits : `${digits.slice(0, cut)}.${digits.slice(cut)}`;
  return neg ? `-${body}` : body;
}

export type PrintedQuantityOutcome =
  | { ok: true; printedQuantity: string }
  | { ok: false; reason: "rounds_to_zero" | "exceeds_recorded" };

/**
 * `share × recordedQuantity`, at the CANONICAL PRECISION OF THE LINE.
 *
 * THE UNIT IS NOT AN ARGUMENT A COMPOSER SUPPLIES. `printed_unit_id` and
 * `printed_unit_precision` resolve against `public.work_items` by foreign key
 * (migration 0047 §5), so «in that entry's canonical unit» is a key rather than
 * a convention and there is no unit selector to get wrong. This function is
 * handed the precision that key will enforce.
 *
 * THE ROUNDING MODE IS READ, NOT CHOSEN. Migration 0047 states that no document
 * in this package gives a quantity rounding rule — INV-011 and INV-037 are about
 * MONEY — so its CHECK is mode-agnostic: it bounds the printed value to strictly
 * less than one unit in the last place away from `share × recorded`, and admits
 * half-up, half-even and truncation alike. Something still has to pick one to
 * compute with. Rather than a constant in code, the caller passes the midpoint
 * off `public.contract_versions.rounding_policy` — the baseline's OWN pinned
 * rule, which is a recorded fact. That the baseline states it for money and this
 * applies it to a quantity is the product's assumption, and it is reported.
 *
 * TWO REFUSALS, both of which the database would otherwise turn into a 500:
 *
 *   `rounds_to_zero` — `printed_quantity > 0`. A share too small to print at the
 *     line's precision is UNSTORABLE, deliberately: «an act that prints «0.000»
 *     as the quantity performed is worse than an act that refuses to be
 *     composed». The composer must refuse the share, not print a zero.
 *   `exceeds_recorded` — `printed_quantity <= source_recorded_quantity`. It
 *     cannot happen while `progress.record` refuses a quantity finer than the
 *     line's unit precision (apps/app/app/v1/assignments/[assignmentId]/progress/route.ts),
 *     because rounding a value ≤ recorded to a scale recorded is already at
 *     lands ≤ recorded. It is checked anyway: the day that upstream rule is
 *     relaxed, this is a legible 422 instead of a constraint violation.
 */
export function printedQuantityOf(args: {
  recordedQuantity: Decimal; share: Decimal; unitPrecision: number; midpoint: Midpoint;
}): PrintedQuantityOutcome {
  const product: Decimal = {
    scaled: args.recordedQuantity.scaled * args.share.scaled,
    scale: args.recordedQuantity.scale + args.share.scale,
  };
  const printedScaled = rescale(product, args.unitPrecision, args.midpoint);
  if (printedScaled <= 0n) return { ok: false, reason: "rounds_to_zero" };

  // Compare at a common scale rather than through a float.
  const common = Math.max(args.unitPrecision, args.recordedQuantity.scale);
  const lhs = rescale({ scaled: printedScaled, scale: args.unitPrecision }, common, args.midpoint);
  const rhs = rescale(args.recordedQuantity, common, args.midpoint);
  if (lhs > rhs) return { ok: false, reason: "exceeds_recorded" };

  return { ok: true, printedQuantity: formatScaled(printedScaled, args.unitPrecision) };
}

export function midpointOfRoundingPolicy(policy: unknown): Midpoint {
  const p = policy as { midpoint?: unknown } | null;
  return p?.midpoint === "half_even" ? "half_even" : "half_up";
}

// ───────────────────────────────────────────────────────────────────────────
// The read
// ───────────────────────────────────────────────────────────────────────────

export interface ActVersionLocator {
  workspaceId: string;
  projectId: string;
  statutoryActId: string;
  statutoryActVersionId: string;
  workStageId: string;
  stageClosureId: string;
  status: "draft" | "frozen";
  draftVersion: number;
}

/**
 * Resolve an act version to its tenant and its scope, or `null`.
 *
 * NULL IS ALSO WHAT AN ACTOR WITHOUT THE CAPABILITY GETS, and that is
 * deliberate on the cross-workspace arc and a cost on the in-workspace one.
 * `sav_select` (migration 0047 §10) admits `statutory_acts.compose` and
 * `project.admin`; a row this actor may not see is invisible to this query, so
 * an act in another workspace is a 404 and never an oracle (INV-001/INV-002).
 * The cost is that a member of the RIGHT workspace who simply lacks the
 * capability also gets a 404 where a 403 would be more useful. A `project.admin`
 * still gets the legible 403, because the policy lets them see the row and the
 * route then refuses them by capability.
 */
export async function locateActVersion(
  tx: Tx, statutoryActVersionId: string,
): Promise<ActVersionLocator | null> {
  const r = await tx.query(
    `select v.workspace_id, v.project_id, v.statutory_act_id, v.id, v.status, v.draft_version,
            a.work_stage_id, a.stage_closure_id
       from public.statutory_act_versions v
       join public.statutory_acts a
         on a.workspace_id = v.workspace_id and a.id = v.statutory_act_id
      where v.id = $1`,
    [statutoryActVersionId]);
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    statutoryActId: row.statutory_act_id,
    statutoryActVersionId: row.id,
    workStageId: row.work_stage_id,
    stageClosureId: row.stage_closure_id,
    status: row.status,
    draftVersion: Number(row.draft_version),
  };
}

/**
 * The whole act version, as recorded facts. Four reads, each ordered
 * deterministically because INV-015's determinism half is a property of the
 * renderer over these rows and `order by created_at` over rows written in one
 * transaction is not an order.
 */
export async function loadActVersionView(
  tx: Tx, workspaceId: string, statutoryActVersionId: string,
): Promise<StatutoryActVersionView | null> {
  const v = await tx.query(
    `select v.*, a.work_stage_id, a.stage_closure_id,
            a.stage_is_concealed, a.act_form, a.act_form_basis
       from public.statutory_act_versions v
       join public.statutory_acts a
         on a.workspace_id = v.workspace_id and a.id = v.statutory_act_id
      where v.workspace_id = $1 and v.id = $2`,
    [workspaceId, statutoryActVersionId]);
  if (v.rows.length === 0) return null;
  const r = v.rows[0];

  const q = await tx.query(
    `select q.line_no, q.root_progress_entry_id, q.source_recorded_quantity,
            q.source_quantity_share, q.printed_quantity, q.printed_unit_precision,
            w.unit_code
       from public.statutory_act_version_quantities q
       join public.work_items w on w.workspace_id = q.workspace_id and w.id = q.work_item_id
      where q.workspace_id = $1 and q.statutory_act_version_id = $2
      order by q.line_no`,
    [workspaceId, statutoryActVersionId]);
  const quantityLines: StatutoryActQuantityLineView[] = q.rows.map((x) => ({
    lineNo: Number(x.line_no),
    rootProgressEntryId: x.root_progress_entry_id,
    recordedQuantity: String(x.source_recorded_quantity),
    share: String(x.source_quantity_share),
    printedQuantity: String(x.printed_quantity),
    unitCode: x.unit_code,
    unitPrecision: Number(x.printed_unit_precision),
  }));

  // `order by slot` and not by insertion: the three slots print in one fixed
  // order or two renders of one frozen version differ.
  const s = await tx.query(
    `select slot, project_party_id, party_id, party_relationship, party_contact_id,
            frozen_organization_name, frozen_organization_name_source,
            frozen_person_name, frozen_person_role_title,
            source_party_version, source_contact_version
       from public.statutory_act_version_signatories
      where workspace_id = $1 and statutory_act_version_id = $2
      order by slot`,
    [workspaceId, statutoryActVersionId]);
  const signatories: StatutoryActSignatoryView[] = s.rows.map((x) => ({
    slot: x.slot,
    projectPartyId: x.project_party_id,
    partyId: x.party_id,
    partyRelationship: x.party_relationship,
    partyContactId: x.party_contact_id,
    frozenOrganizationName: x.frozen_organization_name,
    frozenOrganizationNameSource: x.frozen_organization_name_source,
    frozenPersonName: x.frozen_person_name,
    frozenPersonRoleTitle: x.frozen_person_role_title,
    sourcePartyVersion: Number(x.source_party_version),
    sourceContactVersion: Number(x.source_contact_version),
  }));

  // THE DECISIONS ARE READ THROUGH THE CLOSURE'S FROZEN SET, never re-derived.
  // Migration 0047 departure 6: `public.stage_closure_occurrences` already IS the
  // frozen occurrence set, it cannot gain a member after the closure's own
  // transaction, and a second copy on the act could only be one that disagrees.
  const d = await tx.query(
    `select sco.requirement_occurrence_id, sco.satisfied_by,
            sco.relied_on_decision_id, sco.relied_on_exception_id,
            sco.relied_on_exception_action,
            ro.approver_role, ro.acceptance_criterion,
            ro.norm_ref, ro.norm_ref_verification, ro.norm_ref_source,
            red.assurance_label, red.decided_at
       from public.stage_closure_occurrences sco
       join public.requirement_occurrences ro
         on ro.workspace_id = sco.workspace_id and ro.id = sco.requirement_occurrence_id
       left join public.requirement_evidence_decisions red
         on red.workspace_id = sco.workspace_id and red.id = sco.relied_on_decision_id
      where sco.workspace_id = $1 and sco.stage_closure_id = $2
      order by sco.requirement_occurrence_id`,
    [workspaceId, r.stage_closure_id]);
  const decisions: StatutoryActDecisionView[] = d.rows.map((x) => ({
    requirementOccurrenceId: x.requirement_occurrence_id,
    satisfiedBy: x.satisfied_by,
    reliedOnDecisionId: x.relied_on_decision_id,
    reliedOnExceptionId: x.relied_on_exception_id,
    reliedOnExceptionAction: x.relied_on_exception_action,
    approverRole: x.approver_role,
    acceptanceCriterion: x.acceptance_criterion,
    // INV-073, rendering half: the three columns travel as ONE object or not at
    // all. `requirement_occurrences_norm_ref_sourced_check` (migration 0043)
    // makes the partial combination unstorable, and the view is re-parsed below
    // so a row that somehow carried a bare norm_ref fails loudly rather than
    // rendering as normative.
    normRef: x.norm_ref === null ? null : {
      text: x.norm_ref,
      verification: x.norm_ref_verification as VerificationTagValue,
      source: x.norm_ref_source ?? "",
    },
    // AN OCCURRENCE SATISFIED BY AN EXCEPTION HAS NO DECISION ROW, so it has no
    // `assurance_label`, so it lands on the same level as an internal decision —
    // level 2, `operational acknowledgement`. That is the honest reading of the
    // ladder, which grades MECHANISMS: a waiver or accept_risk recorded by an
    // identified in-product actor at a server time is exactly level 2's own
    // description, and it is certainly not the link mechanism of level 3. It is
    // an assumption no document states, and it is reported.
    assuranceLevel: assuranceLevelOf(x.assurance_label ?? null),
    assuranceLabel: x.assurance_label ?? null,
    decidedAt: x.decided_at === null || x.decided_at === undefined
      ? null : new Date(x.decided_at).toISOString(),
  }));

  // Parsed before it goes on the wire, the pattern `requirement_library.list`
  // establishes: this body carries REGULATORY STRINGS, and a citation that
  // reached a client without its verification tag or its source must fail loudly
  // rather than render as normative (INV-073).
  return statutoryActVersionView.parse({
    statutoryActVersionId: r.id,
    statutoryActId: r.statutory_act_id,
    projectId: r.project_id,
    contractId: r.contract_id,
    workAssignmentId: r.work_assignment_id,
    workItemId: r.work_item_id,
    workStageId: r.work_stage_id,
    stageClosureId: r.stage_closure_id,
    stageIsConcealed: r.stage_is_concealed,
    actForm: r.act_form,
    actFormBasis: r.act_form_basis,
    versionNo: Number(r.version_no),
    status: r.status,
    predecessorVersionId: r.predecessor_version_id,
    correctionReason: r.correction_reason,
    draftVersion: Number(r.draft_version),
    formCitation: {
      text: r.form_citation,
      verification: r.form_citation_verification as VerificationTagValue,
      source: r.form_citation_source,
    },
    formTemplateKey: r.form_template_key,
    formTemplateVersion: r.form_template_version,
    formTemplateHash: r.form_template_hash,
    registryCheckedOn: r.registry_checked_on === null
      ? null
      : new Date(r.registry_checked_on).toISOString().slice(0, 10),
    rendererVersion: r.renderer_version,
    contentHash: r.content_hash,
    frozenAt: r.frozen_at === null ? null : new Date(r.frozen_at).toISOString(),
    frozenByMemberId: r.frozen_by_member_id,
    composedByMemberId: r.composed_by_member_id,
    composedAt: new Date(r.created_at).toISOString(),
    quantityLines,
    signatories,
    decisions,
  });
}
