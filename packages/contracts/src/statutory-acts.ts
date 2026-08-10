import { z } from "zod";
import { verificationTag } from "./requirement-library";

/**
 * The four v0.1-M4 operations (technical/openapi/scope-v0.1.csv:49-52), all
 * governed by the single capability `statutory_acts.compose`
 * (technical/permissions/capabilities.csv:32):
 *
 *   statutory_acts.compose         POST /v1/stages/{stageId}/statutory-acts
 *   statutory_act_versions.freeze  POST /v1/statutory-act-versions/{id}/freeze
 *   statutory_acts.get             GET  /v1/statutory-act-versions/{id}
 *   statutory_acts.render          GET  /v1/statutory-act-versions/{id}/render
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CONTENT RULES ARE THE SPECIFICATION, NOT THE BACKGROUND
 *
 * docs/product/hidden-works-content-rules.md is Approved and RESTRICTS at every
 * precedence level, INCLUDING over ADRs (docs/README.md §"Source of truth").
 * Three of its rules are load-bearing on the shapes below, and each one is a
 * field that is ABSENT rather than a field that is validated:
 *
 *   INV-073 — THERE IS NO QUANTITY FIELD ON THIS WIRE. `composeQuantityEntry`
 *   carries a recorded entry's id and a share, and nothing else. The printed
 *   number is computed by the server from the entry's own recorded quantity, at
 *   the canonical precision of the line the entry was recorded against. A
 *   composer who wants to print a number nobody recorded has no key to put it
 *   in; `.strict()` turns the attempt into a 422 that names the key, which is
 *   the closest a JSON body can come to «stopped by the absence of the field
 *   rather than by validation» (version-0.1.md §v0.1-M4 acceptance evidence).
 *
 *   PROHIBITION E — «шифр», «аркуш», «ким видана», «паспорт», «Акт №», «м.п.»
 *   and a fourth signatory are not fields of Додаток В. `composeSignatories` has
 *   exactly three named keys over a `.strict()` object, so a fourth slot is a
 *   422 and not an omission, and no key anywhere below can carry a certificate
 *   or its issuer.
 *
 *   THE КВАЛІФІКАЦІЙНИЙ СЕРТИФІКАТ IS NOT ON THIS WIRE EITHER. Allow-list item
 *   10 establishes that технагляд HOLDS one (ПКМУ № 903, п. 3); whether Додаток
 *   В has a slot for its серія and номер is NOT established, and prohibition E
 *   bans the adjacent «ким видана». Migration 0047 §11 item 5 records that the
 *   participant record does not carry it in the deployed database either.
 *
 * A SIGNATORY SLOT CARRIES NO TYPED NAMES. The composer names a participant of
 * the project and a person of that participant, by id; the organisation name,
 * the person's name and the посада are FROZEN FROM THOSE RECORDS by the server.
 * A caller cannot type an organisation onto an act.
 */

/**
 * The share of one recorded entry that this act prints, as a decimal string in
 * (0, 1]. Six fractional digits, matching
 * `statutory_act_version_quantities.source_quantity_share numeric(9,6)`.
 *
 * A STRING RATHER THAN A NUMBER, for docs/architecture/data-model.md's reason
 * («Numeric and temporal representation»): binary floating point is not a
 * decimal, and 0.1 + 0.2 is the shape of bug that reaches a printed act as a
 * quantity nobody can reproduce.
 */
export const quantityShare = z.string().trim()
  .regex(/^(?:0(?:\.\d{1,6})?|1(?:\.0{1,6})?)$/,
    "share must be a decimal in (0, 1] with at most 6 fractional digits")
  .refine((s) => Number.parseFloat(s) > 0, "share must be greater than zero");

/**
 * ONE PRINTED LINE = ONE ALREADY-RECORDED ROOT PROGRESS ENTRY.
 *
 * ADR-005 decision 10: «the composer offers only `quantity_entries` already
 * recorded against the line, with a share selector» — PLURAL, which is why
 * migration 0047 departure 1 makes the printed quantity a table rather than four
 * columns. The alternative is a composer facing three recorded entries who can
 * only drop two or print their sum, and their sum is not any recorded entry.
 */
export const composeQuantityEntry = z.object({
  rootProgressEntryId: z.string().uuid(),
  share: quantityShare,
}).strict();
export type ComposeQuantityEntry = z.infer<typeof composeQuantityEntry>;

/**
 * A slot names a participant OF THIS PROJECT and a person OF THAT PARTICIPANT,
 * by id. Both strings the act freezes are read off those records.
 */
export const composeSignatorySlot = z.object({
  projectPartyId: z.string().uuid(),
  partyContactId: z.string().uuid(),
}).strict();
export type ComposeSignatorySlot = z.infer<typeof composeSignatorySlot>;

/**
 * EXACTLY THREE SLOTS EXIST, and `.strict()` is what makes a fourth one a 422
 * rather than a field somebody adds later. п. 8.4.3.5 names three roles
 * (ADR-005 decision 10); hidden-works-content-rules.md §"Open items" records
 * that a Київводоканал blank reportedly carries a fourth, «two passes agree,
 * neither fetched the file», which is exactly the pressure this shape resists.
 *
 * `designerSupervision` IS OPTIONAL HERE, following
 * technical/database/schema-v0.1.sql:1656-1657 and migration 0047's completeness
 * trigger, which require the builder and the технагляд and not the third.
 * п. 8.4.3.5 names three and NO document in this package says the third is
 * conditional — migration 0047 §11 item 8 records that as owed, and this
 * optionality is the product's assumption until it is answered.
 */
export const composeSignatories = z.object({
  builder: composeSignatorySlot,
  technicalSupervision: composeSignatorySlot,
  designerSupervision: composeSignatorySlot.optional(),
}).strict();
export type ComposeSignatories = z.infer<typeof composeSignatories>;

/**
 * `statutory_acts.compose` — POST /v1/stages/{stageId}/statutory-acts.
 *
 * IT REFUSES A STAGE THAT IS NOT CLOSED. The act is a by-product of closure
 * (ADR-005 decision 10; state-catalog.csv:47; transition-catalog.csv:54), not a
 * document someone writes, and the refusal is structural twice over: the route
 * checks the stage status and names it, and `statutory_acts_closure_fkey`
 * (migration 0047 §3) has no referent to resolve against when no closure exists.
 */
export const composeStatutoryActRequest = z.object({
  /**
   * The date the mandatory footer disclaimer prints — «Перевірено за Реєстром
   * будівельних норм: {дата останньої перевірки}»
   * (hidden-works-content-rules.md §"Required disclaimers").
   *
   * A HAND-ENTERED OPERATIONAL CLAIM, and said so. M0 gate 10 owns the registry
   * check and builds no fact table for it, so nothing in this repository records
   * when the check was performed, by whom, or against what. The only thing the
   * database checks is that the date is not in the future
   * (`app.guard_statutory_act_version()`); migration 0047 §11 item 3 records the
   * fact table as owed.
   */
  registryCheckedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/,
    "registryCheckedOn must be an ISO calendar date (YYYY-MM-DD)"),

  /**
   * MAY BE EMPTY. Migration 0047's completeness trigger does not require a
   * printed quantity, because the target DDL's quadruple is entirely nullable
   * and whether Додаток В's field list makes a quantity mandatory is exactly
   * what is not established. A frozen act with no quantity line is
   * representable; the product decision is owed.
   */
  quantityEntries: z.array(composeQuantityEntry).max(500),

  signatories: composeSignatories,

  /**
   * A correction is a SUCCESSOR VERSION and never an edit (INV-015). It names
   * the frozen predecessor it supersedes and says why;
   * `statutory_act_versions_chain_check` and
   * `statutory_act_versions_correction_reason_check` refuse anything else.
   */
  correction: z.object({
    predecessorVersionId: z.string().uuid(),
    reason: z.string().trim().min(1).max(4000),
  }).strict().optional(),
}).strict();
export type ComposeStatutoryActRequest = z.infer<typeof composeStatutoryActRequest>;

/**
 * `statutory_act_versions.freeze` — POST /v1/statutory-act-versions/{id}/freeze.
 *
 * `expectedDraftVersion` is not decoration: `app.guard_statutory_act_version()`
 * requires `draft_version` to advance by exactly one, so two commands that both
 * read version N cannot both write N+1. The freeze writes no new row, so its
 * idempotency lives only in `public.idempotency_records` — migration 0047 §11
 * item 7 records that as the whole of it.
 */
export const freezeStatutoryActVersionRequest = z.object({
  expectedDraftVersion: z.number().int().min(1),
}).strict();
export type FreezeStatutoryActVersionRequest =
  z.infer<typeof freezeStatutoryActVersionRequest>;

// ───────────────────────────────────────────────────────────────────────────
// Views
// ───────────────────────────────────────────────────────────────────────────

/**
 * One printed line. `recordedQuantity` is the entry's OWN quantity, pinned into
 * the act row by a six-column foreign key into `public.progress_entries`, and
 * `printedQuantity` is the server's `share × recordedQuantity` at the line's
 * canonical precision. Both travel so a reader can re-derive the second from the
 * first without trusting the server.
 */
export const statutoryActQuantityLineView = z.object({
  lineNo: z.number().int().min(1),
  rootProgressEntryId: z.string().uuid(),
  recordedQuantity: z.string().min(1),
  share: z.string().min(1),
  printedQuantity: z.string().min(1),
  /** Resolved from `public.work_items` by foreign key. There is no unit selector. */
  unitCode: z.string().min(1),
  unitPrecision: z.number().int().min(0).max(6),
}).strict();
export type StatutoryActQuantityLineView = z.infer<typeof statutoryActQuantityLineView>;

export const signatorySlotName = z.enum([
  "builder", "technical_supervision", "designer_supervision",
]);
export type SignatorySlotName = z.infer<typeof signatorySlotName>;

/**
 * A filled slot. NOTHING HERE IS A SIGNATURE — no signature, no assurance label,
 * no signed-at, no acceptance. In v0.1 a signatory slot is a TYPED SLOT on a
 * document that is printed and signed elsewhere, which is why prohibition S
 * («never render «підпис» / «підписано» for a record below level 4») has nothing
 * on this object to mislabel.
 *
 * `frozenOrganizationNameSource` says WHICH participant record the frozen string
 * was taken from, so a reviewer comparing a years-old act against a corrected
 * participant record knows what they are comparing. The two `source*Version`
 * numbers are the same argument in numbers.
 */
export const statutoryActSignatoryView = z.object({
  slot: signatorySlotName,
  projectPartyId: z.string().uuid(),
  partyId: z.string().uuid(),
  partyRelationship: z.string().min(1),
  partyContactId: z.string().uuid(),
  frozenOrganizationName: z.string().min(1),
  frozenOrganizationNameSource: z.enum(["legal_profile_official_name", "party_display_name"]),
  frozenPersonName: z.string().min(1),
  /** «посада». Nullable because `public.party_contacts.role_title` is. */
  frozenPersonRoleTitle: z.string().nullable(),
  sourcePartyVersion: z.number().int().min(1),
  sourceContactVersion: z.number().int().min(1),
}).strict();
export type StatutoryActSignatoryView = z.infer<typeof statutoryActSignatoryView>;

/**
 * THE ASSURANCE LADDER, hidden-works-content-rules.md §"Electronic-signature
 * assurance ladder". Five levels; v0.1 can produce two of them and NEITHER is a
 * signature.
 *
 * The standing rule is what makes this enum mandatory rather than optional:
 * «a package or act that cannot state the level of a decision it carries must
 * not render that decision». So a decision whose level cannot be determined is
 * not rendered as an unlabelled block — the render refuses.
 */
export const assuranceLevel = z.enum([
  "workflow_comment",                 // 1
  "operational_acknowledgement",      // 2
  "authenticated_acceptance_record",  // 3 — v0.1's LINK_CONFIRMATION
  "electronic_signature",             // 4 — not shipped
  "qualified_electronic_signature",   // 5 — v0.2 at the earliest
]);
export type AssuranceLevel = z.infer<typeof assuranceLevel>;

/**
 * One decision block, read THROUGH the closure's frozen occurrence set
 * (`public.stage_closure_occurrences`) rather than re-derived. Migration 0047
 * departure 6: the closure already froze this set and cannot gain a member
 * after its own transaction, so a second frozen set on the act could only be a
 * copy that disagrees.
 */
export const statutoryActDecisionView = z.object({
  requirementOccurrenceId: z.string().uuid(),
  satisfiedBy: z.enum(["evidence_decision", "exception"]),
  reliedOnDecisionId: z.string().uuid().nullable(),
  reliedOnExceptionId: z.string().uuid().nullable(),
  reliedOnExceptionAction: z.enum(["waiver", "accept_risk"]).nullable(),
  /** The role the occurrence names as owing the decision. Never re-typed. */
  approverRole: z.string().min(1),
  acceptanceCriterion: z.string().min(1),
  /**
   * INV-073, rendering half: the three columns travel as ONE object or not at
   * all. `requirement_occurrences_norm_ref_sourced_check` (migration 0043) is
   * what makes the partial combination unstorable.
   */
  normRef: z.object({
    text: z.string().min(1),
    verification: verificationTag,
    source: z.string().min(1),
  }).strict().nullable(),
  /**
   * NULLABLE, AND THE NULL IS LOAD-BEARING. `null` means this record's mechanism
   * maps to no level of the ladder — which is a state `statutory_acts.get` must
   * still be able to REPORT (it is a recorded fact about a decision that exists)
   * and which the RENDER must refuse: «a package or act that cannot state the
   * level of a decision it carries must not render that decision»
   * (hidden-works-content-rules.md §"Standing rules"). A non-nullable field here
   * would have forced the assembly step to guess a level, which is the one
   * outcome the standing rule forbids.
   */
  assuranceLevel: assuranceLevel.nullable(),
  /**
   * The raw label the record carries, when it carries one. v0.1's only value is
   * `LINK_CONFIRMATION`; an internal member decision carries none.
   */
  assuranceLabel: z.string().nullable(),
  decidedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();
export type StatutoryActDecisionView = z.infer<typeof statutoryActDecisionView>;

/**
 * The act version as a set of RECORDED FACTS. This is `statutory_acts.get`'s
 * whole answer and it is deliberately not a document: it names no field of
 * Додаток В, and the laid-out form is `statutory_acts.render`'s job.
 */
export const statutoryActVersionView = z.object({
  statutoryActVersionId: z.string().uuid(),
  statutoryActId: z.string().uuid(),
  projectId: z.string().uuid(),
  contractId: z.string().uuid(),
  workAssignmentId: z.string().uuid(),
  workItemId: z.string().uuid(),
  workStageId: z.string().uuid(),
  stageClosureId: z.string().uuid(),
  stageIsConcealed: z.boolean(),

  /** v0.1 stores and renders `dodatok_v` only; `statutory_acts_v01_form_v_only_check`. */
  actForm: z.enum(["dodatok_v", "dodatok_g"]),
  /**
   * PROHIBITION G. No source establishes which Додаток Н position takes which
   * form; both values say «the product chose this», and there is no third.
   */
  actFormBasis: z.enum(["product_assumption", "user_selected"]),

  versionNo: z.number().int().min(1),
  status: z.enum(["draft", "frozen"]),
  predecessorVersionId: z.string().uuid().nullable(),
  correctionReason: z.string().nullable(),
  draftVersion: z.number().int().min(1),

  /**
   * THE ONE NORMATIVE STRING THE ACT ROW ITSELF CARRIES, with its tag and its
   * source beside it in NOT NULL columns (INV-073, storage half). Its tag rests
   * on the SINGLE UNREPRODUCED ДБН FETCH recorded in hidden-works-content-rules.md
   * §"Open items"; rendering it in a customer-facing artifact is gated on that
   * retrieval record landing, and no column can enforce that.
   */
  formCitation: z.object({
    text: z.string().min(1),
    verification: verificationTag,
    source: z.string().min(1),
  }).strict(),
  formTemplateKey: z.string().min(1),
  formTemplateVersion: z.string().min(1),
  formTemplateHash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),

  registryCheckedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  rendererVersion: z.string().nullable(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  frozenAt: z.string().datetime({ offset: true }).nullable(),
  frozenByMemberId: z.string().uuid().nullable(),
  composedByMemberId: z.string().uuid(),
  composedAt: z.string().datetime({ offset: true }),

  quantityLines: z.array(statutoryActQuantityLineView),
  signatories: z.array(statutoryActSignatoryView),
  decisions: z.array(statutoryActDecisionView),
}).strict();
export type StatutoryActVersionView = z.infer<typeof statutoryActVersionView>;

// ───────────────────────────────────────────────────────────────────────────
// The render
// ───────────────────────────────────────────────────────────────────────────

/**
 * WHY EVERY BLOCK CARRIES A PROVENANCE, AND WHY THERE IS NO VARIANT WITHOUT ONE.
 *
 * hidden-works-content-rules.md §"Required disclaimers", architectural
 * requirement: «every normative string the product displays carries its
 * `verification` tag and its source IN THE DATA, not in a template. A string
 * with no source must be unrenderable, so a future contributor cannot add an
 * unsourced line to Н.15 by editing a view.»
 *
 * A convention cannot carry that. A discriminated union can: there is no shape
 * of `RenderBlock` whose text is not accompanied by one of the three
 * provenances below, so a contributor who adds a line to the renderer must
 * choose which one it is, and choosing `normative` forces a tag and a source.
 * The whole document is re-parsed by `renderedStatutoryAct` at the route
 * boundary, so a hand-built object that evaded the type system fails loudly
 * there instead of printing.
 *
 * THE THREE KINDS ARE NOT INTERCHANGEABLE:
 *
 *   `normative`   — a quotation of, or an assertion about, a standard. Needs a
 *                   `verification` tag and a `source`. This is the only kind the
 *                   architectural requirement is written about.
 *   `disclaimer`  — text this product is REQUIRED to print by
 *                   hidden-works-content-rules.md §"Required disclaimers". It
 *                   asserts nothing normative on its own; several of them exist
 *                   precisely to deny a normative reading («офіційним виданням
 *                   норми не є», «Це не електронний підпис»). It carries the
 *                   rule that mandates it, verbatim and non-collapsible.
 *   `recorded_fact` — a value read out of this database. Its provenance is the
 *                   row it came from, so a printed number can be traced to the
 *                   entry somebody recorded.
 *
 * There is deliberately no fourth kind, and in particular no «free text».
 */
export const renderBlockProvenance = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("normative"),
    verification: verificationTag,
    source: z.string().trim().min(1),
  }).strict(),
  z.object({
    kind: z.literal("disclaimer"),
    /** The rule that makes this text mandatory, cited so a template edit is visible. */
    mandatedBy: z.string().trim().min(1),
  }).strict(),
  z.object({
    kind: z.literal("recorded_fact"),
    /** e.g. `progress_entries.quantity`, `party_legal_profiles.official_name`. */
    factRef: z.string().trim().min(1),
  }).strict(),
]);
export type RenderBlockProvenance = z.infer<typeof renderBlockProvenance>;

export const renderBlock = z.object({
  blockId: z.string().min(1),
  text: z.string().min(1),
  provenance: renderBlockProvenance,
  /**
   * A disclaimer the content rules require to be shown «never collapsed» carries
   * it here, so a client that collapses it is violating a value it was given
   * rather than a paragraph in a document it never read.
   */
  neverCollapse: z.boolean(),
}).strict();
export type RenderBlock = z.infer<typeof renderBlock>;

/**
 * A rendered act. `pageFooter` is REQUIRED and non-nullable, because the footer
 * disclaimer is mandatory ON EVERY PAGE — a document model that could omit it
 * would make the omission representable.
 *
 * WHAT THIS TYPE CANNOT ENFORCE, stated so it is not mistaken for enforced:
 * v0.1 paginates nothing. «On every page» is a property of whatever turns this
 * model into paper, and no paginator ships in v0.1. What the model contributes
 * is that the footer exists, is sourced, and is marked as repeating; a client
 * that renders it once at the end is wrong and this type cannot catch it.
 */
export const renderedStatutoryAct = z.object({
  statutoryActVersionId: z.string().uuid(),
  status: z.literal("frozen"),
  actForm: z.literal("dodatok_v"),
  rendererVersion: z.string().min(1),
  formTemplateKey: z.string().min(1),
  formTemplateVersion: z.string().min(1),
  formTemplateHash: z.string().regex(/^[0-9a-f]{64}$/),
  /**
   * sha256 over the canonical serialisation of this document. INV-015's
   * determinism half is a property of the renderer over frozen inputs and is not
   * a database rule; what this makes possible is that a divergence is a
   * detectable fact with a nameable cause — `rendererVersion`,
   * `formTemplateHash` or `contentHash` — instead of an argument.
   */
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  title: renderBlock,
  /**
   * THE FORM'S OWN SECTIONS AND THE FORM'S OWN FIELDS, in the form's own order.
   * Every caption here comes from the committed В.1/В.2 field list and carries
   * that list's verification tag and source — there is no path by which a
   * caption reaches this array from a literal in the renderer.
   */
  sections: z.array(z.object({
    sectionId: z.enum(["В.1", "В.2"]),
    caption: renderBlock,
    fields: z.array(z.object({
      fieldId: z.string().min(1),
      caption: renderBlock,
      blocks: z.array(renderBlock),
    }).strict()),
  }).strict()),
  /**
   * RENDER-LEVEL LABELS THAT ARE NOT FIELDS OF THE FORM, kept in their own array
   * precisely so they cannot be mistaken for fields. Prohibition E bans adding a
   * field to Додаток В; a label the product is required to print — such as
   * ADR-005 decision 10's «the Н.14/Н.15-to-form mapping is the product's
   * assumption and is labelled as such ... in the render» — is not a field and
   * must not be laid out as one.
   */
  notes: z.array(renderBlock),
  pageFooter: renderBlock,
  pageFooterRepeatsOnEveryPage: z.literal(true),
}).strict();
export type RenderedStatutoryAct = z.infer<typeof renderedStatutoryAct>;

/**
 * WHY A RENDER CAN BE REFUSED, and the vocabulary of the refusal.
 *
 * These are NOT error-catalog codes — they are the allow-listed `details`
 * payload of one, in the shape `holdPointBlockedDetails` established for
 * `HOLD_POINT_BLOCKED`. Each names a precondition of rendering that is unmet,
 * what closes it, and nothing else; `technical/error-catalog.csv`'s log policy
 * for the carrying code is counts and codes, and none of these carries content.
 *
 * EVERY ONE OF THEM IS DERIVED FROM DATA, never hardcoded prose about what is
 * missing: `dodatok_v_field_list_not_committed` is the absence of a registered
 * field list, `dbn_retrieval_record_absent` is the absence of a retrieval
 * record. The day either lands, the corresponding blocker stops being produced
 * with no change to this file.
 */
export const actRenderBlockerCode = z.enum([
  /**
   * The В.1/В.2 field list is committed nowhere in this repository.
   * hidden-works-content-rules.md allow-list item 3 licenses «every field of В.1
   * and В.2, in the standard's order»; docs/delivery/test-strategy.md:139-152
   * records that no such enumeration exists here — technical/requirements/ holds
   * the Додаток Н CSV and nothing else — and that NO TEST MAY SUBSTITUTE A FIELD
   * LIST TYPED FROM MEMORY. That applies to a renderer exactly as it applies to
   * a fixture, and more dangerously, because a rendered caption looks decided.
   */
  "dodatok_v_field_list_not_committed",
  /**
   * The single ДБН fetch behind every `VERIFIED_PRIMARY` tag is unreproducible:
   * no URL, no retrieval date, no hash (hidden-works-content-rules.md §"Open
   * items"). The plan states the consequence in terms — «M4 cannot render a
   * VERIFIED_PRIMARY string in a customer-facing artifact until it lands»
   * (docs/superpowers/plans/2026-08-06-v0.1-implementation.md:265). A rendered
   * act is a customer-facing artifact by construction.
   */
  "dbn_retrieval_record_absent",
  /** The version is still a draft. A draft is not a document to hand over. */
  "act_version_not_frozen",
  /** A decision block whose assurance level cannot be stated is not rendered. */
  "decision_assurance_level_unknown",
  /** The act's own form citation lost its tag or its source. Unstorable, so a defect. */
  "form_citation_unsourced",
  /** The pinned template key/version resolves to no registered template. */
  "form_template_unknown",
  /**
   * The render does not reproduce the `content_hash` the freeze pinned. INV-015
   * promises byte-determinism for a given renderer version; serving the
   * divergent bytes silently would make that promise unfalsifiable, so the act
   * is refused and the three columns that could explain the divergence —
   * `renderer_version`, `form_template_hash`, `content_hash` — are named.
   */
  "frozen_content_hash_divergence",
]);
export type ActRenderBlockerCode = z.infer<typeof actRenderBlockerCode>;

export const actRenderBlocker = z.object({
  code: actRenderBlockerCode,
  /** What is missing, in one sentence, with no regulatory content in it. */
  detail: z.string().min(1),
  /** What closes it — a file to commit, a command to run, a state to reach. */
  closedBy: z.string().min(1),
}).strict();
export type ActRenderBlocker = z.infer<typeof actRenderBlocker>;

export const actRenderBlockedDetails = z.object({
  statutoryActVersionId: z.string().uuid(),
  actForm: z.enum(["dodatok_v", "dodatok_g"]),
  formTemplateKey: z.string().min(1),
  formTemplateVersion: z.string().min(1),
  blockerCount: z.number().int().min(1),
  blockers: z.array(actRenderBlocker).min(1),
}).strict();
export type ActRenderBlockedDetails = z.infer<typeof actRenderBlockedDetails>;

export interface ComposeStatutoryActResponse {
  statutoryActId: string;
  version: StatutoryActVersionView;
}
export interface FreezeStatutoryActVersionResponse {
  version: StatutoryActVersionView;
}
