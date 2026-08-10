import type { Client } from "pg";
import { createHash, randomUUID } from "node:crypto";
import type { RulesFixture } from "./m1-rules-fixture";
import { attemptClosure, recordDecision, type ClosureWorld } from "./m3-closure-fixture";

/**
 * NOTHING HERE HAS BEEN EXECUTED. No node_modules, no database, no docker: no
 * `pnpm`, `vitest`, `tsc`, `psql` or `supabase` was run against this file, no
 * migration was applied, and no claim is made that it applies, compiles or
 * passes. Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * Direct-insert fixture for the four tables migration 0047 adds, in the shape
 * m1-rules-fixture.ts, m2-occurrences-fixture.ts and m3-closure-fixture.ts
 * established and for the same reason: the M4 database suites test keys, CHECKs,
 * triggers, grants and RLS, so building the act through
 * `statutory_acts.compose` would make a constraint regression look like a route
 * failure — and in v0.1 it could not build a FROZEN act at all, because
 * `statutory_act_versions.freeze` refuses while the В.1/В.2 field list and the
 * ДБН retrieval record are uncommitted.
 *
 * THAT LAST POINT IS THE WHOLE REASON `attemptFreeze` EXISTS. INV-015 — «an act
 * version is immutable once frozen» — is a claim about a FROZEN row, and no
 * route in this repository can produce one today. Either the invariant goes
 * untested until two regulatory artifacts land, or the fixture performs the same
 * UPDATE the route performs. It performs it, and
 * `apps/app/tests/m4-act.int.test.ts` asserts separately that the route still
 * refuses — so if the refusal ever lifts, that suite fails and this harness is
 * the thing to delete.
 *
 * THE FREEZE IS A TRANSACTION AND NOT A STATEMENT, for m3-closure-fixture.ts's
 * reason exactly: `statutory_act_versions_freeze_complete` is DEFERRABLE
 * INITIALLY DEFERRED and fires at COMMIT, and it is SECURITY DEFINER and asks
 * `app.has_project_capability(..., array['statutory_acts.compose'])` before it
 * counts anything. A statement-at-a-time fixture would never reach it, and the
 * actor GUC has to be set inside the transaction or it refuses every freeze.
 */

/**
 * `statutory_acts.compose` appears in NO ROW of
 * technical/permissions/responsibility-presets.csv, and capabilities.csv:32 puts
 * all four M4 operations behind it — including the two READS. Granted by hand
 * here and named rather than folded into a list: M1 review finding 8 and M3
 * review finding 5, a third time (migration 0047 §11 item 6).
 */
export const M4_PRESET_GAP = ["statutory_acts.compose"] as const;

export const HEX64 = "a".repeat(64);
export const TEMPLATE_KEY = "dodatok-v";
export const TEMPLATE_VERSION = "0.1.0";
/**
 * The one normative string the act row itself carries, and its provenance.
 *
 * TRANSCRIBED HERE RATHER THAN IMPORTED because this package cannot import from
 * `apps/`. That is not a weakness: the byte-identity of the citation against
 * `docs/product/hidden-works-content-rules.md` allow-list item 3 is asserted in
 * `apps/app/tests/act-content-fidelity.test.ts`, where the renderer's constant
 * can be read. What this fixture needs is a storable value, and what the suites
 * built on it assert is that a value with no tag or no source is NOT storable.
 */
export const FORM_CITATION = "форма за Додатком В (обов'язковим)";
export const FORM_CITATION_SOURCE =
  "ДБН А.3.1-5:2016; офіційний файл e-construction.gov.ua (одне завантаження)";

/** A date that is not in the future — `app.guard_statutory_act_version()` checks. */
export const REGISTRY_CHECKED_ON = "2026-08-01";

/**
 * What a frozen row carries in `frozen_project_name` (migration 0056). It does
 * NOT have to match the seeded project's real name: what these suites assert is
 * that the column is required on a frozen row and refused on a draft, and a
 * value that matched would quietly make a wrong copy look right. The «Приклад-»
 * prefix is this repository's marker for a name no reader may mistake for a real
 * Ukrainian object.
 */
export const FROZEN_PROJECT_NAME = "Приклад-об'єкт, зафіксований при freeze";

export interface ActWorld {
  rules: RulesFixture;
  closure: ClosureWorld;
  /** A satisfied, committed closure of the concealed stage. */
  stageClosureId: string;
  /** A ROOT entry of 10.000000 on the closure's assignment and line. */
  rootProgressEntryId: string;
  recordedQuantity: string;
  /** The line's own unit, which the printed quantity is pinned to by key. */
  unitId: string;
  unitPrecision: number;

  /** relationship 'general_contractor' — the builder slot. */
  builderProjectPartyId: string;
  builderPartyId: string;
  builderContactId: string;
  /** relationship 'technical_supervision'. */
  supervisionProjectPartyId: string;
  supervisionPartyId: string;
  supervisionContactId: string;
  /** relationship 'customer' — nothing in п. 8.4.3.5 maps to it. */
  customerProjectPartyId: string;
  customerPartyId: string;
  customerContactId: string;
}

async function seedParticipant(
  c: Client, f: RulesFixture, o: { displayName: string; relationship: string; fullName: string },
): Promise<{ partyId: string; projectPartyId: string; contactId: string }> {
  const p = await c.query<{ id: string }>(
    `insert into public.parties (workspace_id, display_name, created_by)
     values ($1,$2,$3) returning id`, [f.workspaceId, o.displayName, f.userId]);
  const partyId = p.rows[0]!.id;
  const pp = await c.query<{ id: string }>(
    `insert into public.project_parties
       (workspace_id, project_id, party_id, relationship, created_by)
     values ($1,$2,$3,$4,$5) returning id`,
    [f.workspaceId, f.projectId, partyId, o.relationship, f.userId]);
  const pc = await c.query<{ id: string }>(
    `insert into public.party_contacts
       (workspace_id, party_id, full_name, role_title, created_by)
     values ($1,$2,$3,$4,$5) returning id`,
    [f.workspaceId, partyId, o.fullName, "виконроб", f.userId]);
  return { partyId, projectPartyId: pp.rows[0]!.id, contactId: pc.rows[0]!.id };
}

/**
 * Everything an act needs to exist: a SATISFIED closure, a recorded root entry
 * to take a share of, and three participants — two that the slot-to-role map
 * admits and one it does not.
 *
 * THE CUSTOMER PARTICIPANT IS THE CONTROL. Without it,
 * `..._slot_role_assumption_check` could be satisfied by a suite that never
 * offered it a relationship to refuse, and the map — which no document states —
 * would be asserted only in the direction it already holds.
 */
export async function seedActWorld(c: Client, w: ClosureWorld): Promise<ActWorld> {
  const f = w.rules;
  for (const capability of M4_PRESET_GAP) {
    await c.query(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,$4,$5) on conflict do nothing`,
      [f.workspaceId, f.projectId, f.memberId, capability, f.userId]);
  }

  // Both blocking obligations accepted, then the closure — the only state from
  // which `statutory_acts_closure_fkey` has anything to resolve against.
  const decisionA = await recordDecision(c, w, { occurrenceId: w.blockingA, outcome: "accepted" });
  const decisionB = await recordDecision(c, w, { occurrenceId: w.blockingB, outcome: "accepted" });
  const closed = await attemptClosure(c, w, {
    members: [
      { occurrenceId: w.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
      { occurrenceId: w.blockingB, satisfiedBy: "evidence_decision", decisionId: decisionB },
    ],
  });
  if (closed.error !== null) {
    throw new Error(`m4-act-fixture: the fixture closure was refused — ${closed.error}`);
  }

  const entry = await c.query<{ id: string; quantity: string }>(
    `insert into public.progress_entries
       (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
        quantity, recorded_by_member_id)
     values ($1,$2,$3,$4,'root','10',$5)
     returning id, quantity::text as quantity`,
    [f.workspaceId, f.projectId, w.assignmentId, w.workItemId, f.memberId]);

  const line = await c.query<{ unit_definition_id: string; unit_precision: number }>(
    `select unit_definition_id, unit_precision from public.work_items
      where workspace_id = $1 and id = $2`, [f.workspaceId, w.workItemId]);

  const builder = await seedParticipant(c, f, {
    displayName: "Приклад-Підрядник", relationship: "general_contractor",
    fullName: "Приклад-Виконроб Іваненко І. І." });
  const supervision = await seedParticipant(c, f, {
    displayName: "Приклад-Технагляд", relationship: "technical_supervision",
    fullName: "Приклад-Технагляд Петренко П. П." });
  const customer = await seedParticipant(c, f, {
    displayName: "Приклад-Замовник-М4", relationship: "customer",
    fullName: "Приклад-Замовник Сидоренко С. С." });

  return {
    rules: f, closure: w,
    stageClosureId: closed.closureId,
    rootProgressEntryId: entry.rows[0]!.id,
    recordedQuantity: entry.rows[0]!.quantity,
    unitId: line.rows[0]!.unit_definition_id,
    unitPrecision: Number(line.rows[0]!.unit_precision),
    builderProjectPartyId: builder.projectPartyId,
    builderPartyId: builder.partyId,
    builderContactId: builder.contactId,
    supervisionProjectPartyId: supervision.projectPartyId,
    supervisionPartyId: supervision.partyId,
    supervisionContactId: supervision.contactId,
    customerProjectPartyId: customer.projectPartyId,
    customerPartyId: customer.partyId,
    customerContactId: customer.contactId,
  };
}

// ── the act identity and its versions ───────────────────────────────────────

export interface ActSeed {
  actId?: string;
  stageClosureId?: string;
  workStageId?: string;
  stageIsConcealed?: boolean;
  actForm?: string;
  actFormBasis?: string;
  workspaceId?: string;
  projectId?: string;
}

export const ACT_INSERT = `
  insert into public.statutory_acts
    (id, workspace_id, project_id, contract_id, work_assignment_id, work_item_id,
     work_stage_id, stage_closure_id, stage_is_concealed, act_form, act_form_basis,
     composed_by_member_id)
  values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8::uuid,
          $9::boolean,$10::text,$11::text,$12::uuid)
  returning id`;

export function actParams(a: ActWorld, o: ActSeed = {}): unknown[] {
  const f = a.rules;
  return [
    o.actId ?? randomUUID(),
    o.workspaceId ?? f.workspaceId,
    o.projectId ?? f.projectId,
    f.contractId,
    a.closure.assignmentId,
    a.closure.workItemId,
    o.workStageId ?? a.closure.stageId,
    o.stageClosureId ?? a.stageClosureId,
    o.stageIsConcealed ?? true,
    o.actForm ?? "dodatok_v",
    o.actFormBasis ?? "product_assumption",
    f.memberId,
  ];
}

export async function insertAct(c: Client, a: ActWorld, o: ActSeed = {}): Promise<string> {
  const r = await c.query<{ id: string }>(ACT_INSERT, actParams(a, o));
  return r.rows[0]!.id;
}

export interface VersionSeed {
  versionId?: string;
  statutoryActId: string;
  versionNo?: number;
  status?: string;
  predecessorVersionId?: string | null;
  predecessorVersionNo?: number | null;
  predecessorStatus?: string | null;
  correctionReason?: string | null;
  formTemplateKey?: string;
  formTemplateVersion?: string;
  formTemplateHash?: string | null;
  formCitation?: string;
  formCitationVerification?: string;
  formCitationSource?: string | null;
  registryCheckedOn?: string | null;
  rendererVersion?: string | null;
  contentHash?: string | null;
  frozenAt?: string | null;
  frozenByMemberId?: string | null;
  /**
   * Migration 0056's three. They default BY STATUS rather than to `null`,
   * because that is what the freeze does: a draft carries none of them
   * (`statutory_act_versions_draft_clean_check`) and a frozen row carries the
   * name and the version (`..._frozen_complete_check`). Pass an explicit `null`
   * to seed the shape either constraint is supposed to refuse.
   */
  frozenProjectName?: string | null;
  frozenProjectAddress?: string | null;
  sourceProjectVersion?: number | null;
  draftVersion?: number;
  idempotencyKey?: string;
  workspaceId?: string;
  projectId?: string;
}

export const VERSION_INSERT = `
  insert into public.statutory_act_versions
    (id, workspace_id, project_id, contract_id, statutory_act_id,
     work_assignment_id, work_item_id, version_no, status,
     predecessor_version_id, predecessor_version_no, predecessor_status, correction_reason,
     form_template_key, form_template_version, form_template_hash,
     form_citation, form_citation_verification, form_citation_source,
     registry_checked_on, renderer_version, content_hash, frozen_at, frozen_by_member_id,
     frozen_project_name, frozen_project_address, source_project_version,
     composed_by_member_id, draft_version, idempotency_key, request_hash)
  values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8::integer,$9::text,
          $10::uuid,$11::integer,$12::text,$13::text,
          $14::text,$15::text,$16::text,
          $17::text,$18::text,$19::text,
          $20::date,$21::text,$22::text,$23::timestamptz,$24::uuid,
          $25::text,$26::text,$27::bigint,
          $28::uuid,$29::bigint,$30::text,$31::text)
  returning id`;

export function versionParams(a: ActWorld, o: VersionSeed): unknown[] {
  const f = a.rules;
  return [
    o.versionId ?? randomUUID(),
    o.workspaceId ?? f.workspaceId,
    o.projectId ?? f.projectId,
    f.contractId,
    o.statutoryActId,
    a.closure.assignmentId,
    a.closure.workItemId,
    o.versionNo ?? 1,
    o.status ?? "draft",
    o.predecessorVersionId ?? null,
    o.predecessorVersionNo ?? null,
    o.predecessorStatus ?? null,
    o.correctionReason ?? null,
    o.formTemplateKey ?? TEMPLATE_KEY,
    o.formTemplateVersion ?? TEMPLATE_VERSION,
    o.formTemplateHash ?? null,
    o.formCitation ?? FORM_CITATION,
    o.formCitationVerification ?? "VERIFIED_PRIMARY",
    o.formCitationSource === undefined ? FORM_CITATION_SOURCE : o.formCitationSource,
    o.registryCheckedOn === undefined ? REGISTRY_CHECKED_ON : o.registryCheckedOn,
    o.rendererVersion ?? null,
    o.contentHash ?? null,
    o.frozenAt ?? null,
    o.frozenByMemberId ?? null,
    // BY STATUS, not `?? null` — see VersionSeed. `frozen_project_address` is
    // nullable in BOTH states, because `public.projects.address` is.
    o.frozenProjectName === undefined
      ? ((o.status ?? "draft") === "frozen" ? FROZEN_PROJECT_NAME : null)
      : o.frozenProjectName,
    o.frozenProjectAddress ?? null,
    o.sourceProjectVersion === undefined
      ? ((o.status ?? "draft") === "frozen" ? 1 : null)
      : o.sourceProjectVersion,
    f.memberId,
    o.draftVersion ?? 1,
    o.idempotencyKey ?? randomUUID(),
    HEX64,
  ];
}

export async function insertVersion(
  c: Client, a: ActWorld, o: VersionSeed,
): Promise<string> {
  const r = await c.query<{ id: string }>(VERSION_INSERT, versionParams(a, o));
  return r.rows[0]!.id;
}

// ── the two content tables ──────────────────────────────────────────────────

export interface QuantitySeed {
  versionId: string;
  rootProgressEntryId?: string;
  sourceEntryKind?: string;
  sourceRecordedQuantity?: string;
  share?: string;
  printedUnitId?: string;
  printedUnitPrecision?: number;
  printedQuantity?: string;
  lineNo?: number;
  workAssignmentId?: string;
  workItemId?: string;
  workspaceId?: string;
  projectId?: string;
}

export const QUANTITY_INSERT = `
  insert into public.statutory_act_version_quantities
    (workspace_id, project_id, statutory_act_version_id, work_assignment_id, work_item_id,
     root_progress_entry_id, source_entry_kind, source_recorded_quantity,
     source_quantity_share, printed_unit_id, printed_unit_precision, printed_quantity, line_no)
  values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::text,$8::numeric,
          $9::numeric,$10::uuid,$11::smallint,$12::numeric,$13::integer)`;

export function quantityParams(a: ActWorld, o: QuantitySeed): unknown[] {
  const f = a.rules;
  return [
    o.workspaceId ?? f.workspaceId,
    o.projectId ?? f.projectId,
    o.versionId,
    o.workAssignmentId ?? a.closure.assignmentId,
    o.workItemId ?? a.closure.workItemId,
    o.rootProgressEntryId ?? a.rootProgressEntryId,
    o.sourceEntryKind ?? "root",
    o.sourceRecordedQuantity ?? a.recordedQuantity,
    o.share ?? "0.500000",
    o.printedUnitId ?? a.unitId,
    o.printedUnitPrecision ?? a.unitPrecision,
    o.printedQuantity ?? "5.000",
    o.lineNo ?? 1,
  ];
}

export interface SignatorySeed {
  versionId: string;
  slot: string;
  projectPartyId?: string;
  partyId?: string;
  partyRelationship?: string;
  partyContactId?: string;
  frozenOrganizationName?: string;
  frozenOrganizationNameSource?: string;
  frozenPersonName?: string;
  frozenPersonRoleTitle?: string | null;
  workspaceId?: string;
  projectId?: string;
}

export const SIGNATORY_INSERT = `
  insert into public.statutory_act_version_signatories
    (workspace_id, project_id, statutory_act_version_id, slot,
     project_party_id, party_id, party_relationship, party_contact_id,
     frozen_organization_name, frozen_organization_name_source,
     frozen_person_name, frozen_person_role_title,
     source_party_version, source_contact_version)
  values ($1::uuid,$2::uuid,$3::uuid,$4::text,$5::uuid,$6::uuid,$7::text,$8::uuid,
          $9::text,$10::text,$11::text,$12::text,1,1)`;

/**
 * The participant each slot names by default: the map 0047 §6 assumes.
 *
 * ONLY `builder` AND `technical_supervision` HAVE A DEFAULT, because those are
 * the two `statutory_act_versions_freeze_complete` requires and the two this
 * world seeds a participant for. `designer_supervision` needs `relationship =
 * 'designer'` and this world has no designer, so a caller naming that slot must
 * override — and a caller that forgets is refused by
 * `..._slot_role_assumption_check`, which is the constraint under test rather
 * than an accident.
 */
function defaultsForSlot(a: ActWorld, slot: string): {
  projectPartyId: string; partyId: string; relationship: string; contactId: string;
} {
  if (slot === "technical_supervision") {
    return {
      projectPartyId: a.supervisionProjectPartyId, partyId: a.supervisionPartyId,
      relationship: "technical_supervision", contactId: a.supervisionContactId,
    };
  }
  return {
    projectPartyId: a.builderProjectPartyId, partyId: a.builderPartyId,
    relationship: "general_contractor", contactId: a.builderContactId,
  };
}

export function signatoryParams(a: ActWorld, o: SignatorySeed): unknown[] {
  const f = a.rules;
  const d = defaultsForSlot(a, o.slot);
  return [
    o.workspaceId ?? f.workspaceId,
    o.projectId ?? f.projectId,
    o.versionId,
    o.slot,
    o.projectPartyId ?? d.projectPartyId,
    o.partyId ?? d.partyId,
    o.partyRelationship ?? d.relationship,
    o.partyContactId ?? d.contactId,
    o.frozenOrganizationName ?? "ТОВ Приклад-Підрядник",
    o.frozenOrganizationNameSource ?? "party_display_name",
    o.frozenPersonName ?? "Приклад-Виконроб Іваненко І. І.",
    o.frozenPersonRoleTitle === undefined ? "виконроб" : o.frozenPersonRoleTitle,
  ];
}

/**
 * A draft act with one quantity line and the two signatory slots
 * `statutory_act_versions_freeze_complete` requires — the shape a freeze can
 * legally act on.
 */
export async function seedDraftAct(
  c: Client, a: ActWorld, o: { actId?: string } = {},
): Promise<{ actId: string; versionId: string }> {
  const actId = o.actId ?? await insertAct(c, a);
  const versionId = await insertVersion(c, a, { statutoryActId: actId });
  await c.query(QUANTITY_INSERT, quantityParams(a, { versionId }));
  await c.query(SIGNATORY_INSERT, signatoryParams(a, { versionId, slot: "builder" }));
  await c.query(SIGNATORY_INSERT,
    signatoryParams(a, { versionId, slot: "technical_supervision" }));
  return { actId, versionId };
}

export interface FreezeAttempt {
  versionId: string;
  contentHash?: string;
  rendererVersion?: string;
  formTemplateHash?: string;
  /** Migration 0056's pair, required of a frozen row beside the other five. */
  frozenProjectName?: string;
  sourceProjectVersion?: number;
  expectedDraftVersion?: number;
  /** Whose capability the deferred definer trigger resolves at COMMIT. */
  actorUserId?: string;
  workspaceId?: string;
}

export interface FreezeOutcome {
  error: string | null;
  sqlstate: string | null;
  /** Rows the UPDATE matched. Zero means the guard was never reached. */
  updated: number;
}

/**
 * THE FREEZE, AS ONE TRANSACTION — the same UPDATE
 * `statutory_act_versions.freeze` performs, and nothing else.
 *
 * IT IS A HARNESS FOR A ROUTE THAT REFUSES, and it must be deleted on the day
 * the route stops refusing. `apps/app/tests/m4-act.int.test.ts` asserts that
 * refusal with its two blocker codes, so that day announces itself.
 *
 * The five columns are exactly the five
 * `statutory_act_versions_frozen_complete_check` requires beside
 * `registry_checked_on`, and `draft_version` advances by exactly one because
 * `app.guard_statutory_act_version()` requires it — which is what makes the
 * expected-version discipline structural rather than procedural.
 */
export async function attemptFreeze(
  c: Client, a: ActWorld, o: FreezeAttempt,
): Promise<FreezeOutcome> {
  const f = a.rules;
  try {
    await c.query("begin");
    await c.query("select set_config('app.actor_user_id', $1, true)",
      [o.actorUserId ?? f.userId]);
    // `frozen_project_name` and `source_project_version` join the set migration
    // 0056 added to `statutory_act_versions_frozen_complete_check`, so a freeze
    // path that does not pin them is refused — here exactly as in the route.
    // That refusal is the point of the column: `public.projects` takes an UPDATE
    // from any project.admin at any time, and a frozen act that read the name
    // live would be destroyed by an ordinary rename.
    const r = await c.query(
      `update public.statutory_act_versions
          set status = 'frozen', frozen_at = now(), frozen_by_member_id = $3,
              content_hash = $4, renderer_version = $5, form_template_hash = $6,
              frozen_project_name = $8, source_project_version = $9,
              draft_version = draft_version + 1
        where workspace_id = $1 and id = $2 and status = 'draft' and draft_version = $7`,
      [o.workspaceId ?? f.workspaceId, o.versionId, f.memberId,
       o.contentHash ?? contentHashOf(o.versionId),
       o.rendererVersion ?? "statutory-act-render/1",
       o.formTemplateHash ?? HEX64,
       o.expectedDraftVersion ?? 1,
       o.frozenProjectName ?? FROZEN_PROJECT_NAME,
       o.sourceProjectVersion ?? 1]);
    await c.query("commit");
    return { error: null, sqlstate: null, updated: r.rowCount ?? 0 };
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    return {
      error: (e as Error).message,
      sqlstate: (e as { code?: string }).code ?? "unknown",
      updated: 0,
    };
  }
}

/**
 * A stand-in for the digest of the render.
 *
 * IT IS NOT THE PRODUCT'S HASH AND MUST NOT BE READ AS ONE. The renderer's
 * `contentHash` is sha256 over the canonical serialisation of a rendered
 * document, and there is no rendered document in v0.1. What the SCHEMA requires
 * is 64 lowercase hex characters; what these suites assert is that the column
 * refuses anything else and that a frozen row cannot lose it. Derived from the
 * version id so two frozen versions differ, which is what makes «the hash moved»
 * a visible event in a suite rather than a constant everywhere.
 */
export function contentHashOf(versionId: string): string {
  return createHash("sha256").update(versionId, "utf8").digest("hex");
}

/** Returns the world to the state `seedActWorld` left it in: no acts at all. */
export async function resetActFacts(c: Client, workspaceId: string): Promise<void> {
  for (const t of [
    "statutory_act_version_signatories", "statutory_act_version_quantities",
    "statutory_act_versions", "statutory_acts",
  ]) {
    await c.query(`alter table public.${t} disable trigger user`);
    try {
      await c.query(`delete from public.${t} where workspace_id = $1`, [workspaceId]);
    } finally {
      await c.query(`alter table public.${t} enable trigger user`);
    }
  }
}
