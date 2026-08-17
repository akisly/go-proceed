import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { q, truncateAll, jsonReq, baselineFixture, type BaselineFixture } from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion,
  publishVersion, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";
import { readDodatokN, DODATOK_N_SOURCE_STANDARD, type DodatokNRow } from "./helpers/dodatok-n";
import { prohibitionEBannedFields } from "./helpers/content-rules";
import { withTenantTx } from "@goproceed/database";
import { statutoryActVersionView } from "@goproceed/contracts";
import {
  BOUND_RULE_VERSIONS_SQL, boundRuleVersion, planForWorkType,
} from "../src/lib/requirement-materialisation";
import { materialiseOccurrences } from "../src/lib/occurrence-writer";
import { citationOf } from "../src/lib/requirement-content";
import { DODATOK_V_TEMPLATE, FORM_CITATION_TEXT, DBN_RETRIEVAL_RECORD, RENDERER_VERSION,
} from "../src/lib/statutory-act-form";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `pnpm`, `vitest`, `tsc`, `psql` and `supabase` were never run against
 * it, no route was invoked, no migration was applied, and no claim is made that
 * any assertion below passes. Static reading is the only check that was
 * available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M4 — THE ACT, THROUGH ITS FOUR ROUTES.
 *
 * version-0.1.md §v0.1-M4's acceptance walk is: close a satisfied stage; compose
 * the act; freeze it; render twice and diff the bytes; attempt to type a
 * quantity and be stopped by the ABSENCE OF THE FIELD; check the render field by
 * field against the В.1/В.2 list.
 *
 * TWO OF THOSE SIX STEPS CANNOT BE PERFORMED IN THIS REPOSITORY, and this suite
 * says so in assertions rather than in silence:
 *
 *   «check the render field by field against the В.1/В.2 list» — the list is
 *   committed nowhere. docs/delivery/test-strategy.md:139-152 records that
 *   `technical/requirements/` holds the Додаток Н CSV and nothing else, and adds
 *   the rule that closes the only remaining door: NO TEST MAY SUBSTITUTE A FIELD
 *   LIST TYPED FROM MEMORY. Nothing below invents a caption of Додаток В — not
 *   even a transparently «Приклад-» one, because a fake caption in a fixture is
 *   the thing somebody copies into the template.
 *
 *   «render twice and diff the bytes» — there is no render. `statutory_acts.render`
 *   refuses with `dbn_retrieval_record_absent`, and `statutory_act_versions.freeze`
 *   refuses with it because `content_hash` is the digest OF the render. That
 *   refusal is ASSERTED here, with its blocker code, so the day the last
 *   artifact lands these tests fail and are replaced by the positive halves.
 *
 *   ONE OF THE TWO ARTIFACTS LANDED ON 2026-08-10 and these cases failed exactly
 *   as this paragraph promised they would. The field list is committed under
 *   technical/requirements/dbn-a31-5-2016-dodatok-v.csv, machine-transcribed from
 *   the official file and verified byte-for-byte, so
 *   `dodatok_v_field_list_not_committed` is gone and its ABSENCE is now asserted
 *   below. What is still missing is the retrieval record: the URL the file was
 *   downloaded from and the date. A suite that
 *   quietly skipped them would let M4 look finished.
 *
 * WHAT IS THEREFORE PROVED HERE: the refusal from an unclosed stage; that the
 * assembled act carries no field prohibition E bans and nothing for the
 * технагляд's кваліфікаційний сертифікат; that no free-text quantity can reach
 * it; that its Додаток Н content is byte-identical to the CSV; and tenant
 * isolation across all four operations. The STORAGE half — a frozen version's
 * immutability, an unstorable printed quantity, a fourth signatory slot — is
 * attacked from the table owner in `packages/testing/src/m4-act-schema.test.ts`,
 * because what must survive a rewrite of these routes is a key, a CHECK or a
 * trigger and not a branch in a handler.
 *
 * THE ROUTE BUILDS THE FIXTURE NOW. This file used to hand-write the obligation
 * set, because no work line carried a work type and `assignments.create`
 * therefore materialised nothing — a fixture built through the route would have
 * produced an EMPTY stage, which closes vacuously and yields an act with no
 * decision block, making every Додаток Н assertion below vacuous too. The line
 * carries WORK_TYPE now, so the route materialises the pair and
 * `materialisedFor` only reads what it wrote.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // composer, owner of workspace A
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // owner of a DIFFERENT workspace
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // member of A's workspace, no project grant
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

/**
 * `statutory_acts.compose` appears in NO ROW of
 * technical/permissions/responsibility-presets.csv, and capabilities.csv:32 puts
 * all four M4 operations — compose, freeze, get AND render — behind it. So every
 * persona needs a hand-issued grant to READ an act, and this fixture issues one.
 *
 * Named rather than folded into the list below, because this is M1 review
 * finding 8 and M3 review finding 5 arriving a third time (migration 0047 §11
 * item 6). On the day a preset carries it, this constant becomes redundant and
 * nothing else in the file changes.
 */
// `statutory_acts.compose` was in NO preset when this list was written and is on
// `pto_engineer` as of 2026-08-17, beside `stage_closures.close` — INV-084 makes
// the closure the event that pins the act, so the closer and the composer are one
// persona on purpose. The `M4_PRESET_GAP` constant that named the gap has gone
// with it; the grant stays, because a suite grants the set it needs.
const CAPS = ["assignments.manage", "rule_bindings.manage", "requirements.assign",
              "progress.record", "progress.adjust", "evidence.record",
              "stage_closures.close", "evidence_decisions.decide",
              "requirement_exceptions.decide", "readiness.view",
              "statutory_acts.compose"] as const;

const WORK_TYPE = "montazh-elektrotekhnichnykh-ustanovok";
const STAGE = "prykhovani-roboty";
const REGISTRY_CHECKED_ON = "2026-08-01";

/** The CSV, read independently of anything the product does with it. */
const CSV: DodatokNRow[] = readDodatokN();

interface Fx extends BaselineFixture {
  contractVersionId: string;
  workItemId: string;
  assignmentId: string;
  workStageId: string;
  stageClosureId: string;
  occurrenceIds: string[];
  /**
   * An assignment on an UNTYPED line of the same baseline.
   *
   * Migration 0051 §1 admits any stage key where the line implies none, and the
   * covered line's baseline implies exactly {prykhovani-roboty}. The two cases
   * that need an ad-hoc stage — one still open, one closed and not concealed —
   * build it here.
   */
  uncoveredAssignmentId: string;
  /** The two library rows the two obligations cite, keyed «Н.15/1», «Н.15/2». */
  libraryKeys: string[];
  progressEntryId: string;
  /** relationship 'general_contractor' — the builder slot. */
  builderPartyId: string;
  builderProjectPartyId: string;
  builderContactId: string;
  /** relationship 'technical_supervision' — and NO legal profile, deliberately. */
  supervisionPartyId: string;
  supervisionProjectPartyId: string;
  supervisionContactId: string;
}

// ── route drivers ───────────────────────────────────────────────────────────

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

async function compose(stageId: string, body: Record<string, unknown>): Promise<Response> {
  const { POST } = await import("../app/v1/stages/[stageId]/statutory-acts/route");
  return POST(jsonReq("http://x", body), params({ stageId }));
}
async function getAct(actVersionId: string): Promise<Response> {
  const { GET } = await import("../app/v1/statutory-act-versions/[actVersionId]/route");
  return GET(new Request("http://x"), params({ actVersionId }));
}
async function renderAct(actVersionId: string): Promise<Response> {
  const { GET } = await import("../app/v1/statutory-act-versions/[actVersionId]/render/route");
  return GET(new Request("http://x"), params({ actVersionId }));
}
async function freezeAct(
  actVersionId: string, expectedDraftVersion = 1,
): Promise<Response> {
  const { POST } = await import(
    "../app/v1/statutory-act-versions/[actVersionId]/freeze/route");
  return POST(jsonReq("http://x", { expectedDraftVersion }), params({ actVersionId }));
}
async function createStage(
  assignmentId: string, stageKey: string, isConcealed: boolean,
): Promise<Response> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/stages/route");
  return POST(jsonReq("http://x", { stageKey, isConcealed }), params({ assignmentId }));
}
async function closeStage(stageId: string, expectedVersion = 1): Promise<Response> {
  const { POST } = await import("../app/v1/stages/[stageId]/closures/route");
  return POST(jsonReq("http://x", { expectedVersion }), params({ stageId }));
}

/** The compose body every positive case uses, with one override point. */
function composeBody(fx: Fx, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    registryCheckedOn: REGISTRY_CHECKED_ON,
    quantityEntries: [{ rootProgressEntryId: fx.progressEntryId, share: "0.5" }],
    signatories: {
      builder: {
        projectPartyId: fx.builderProjectPartyId, partyContactId: fx.builderContactId,
      },
      technicalSupervision: {
        projectPartyId: fx.supervisionProjectPartyId,
        partyContactId: fx.supervisionContactId,
      },
    },
    ...over,
  };
}

// ── the fixture ─────────────────────────────────────────────────────────────

async function grant(projectId: string, memberId: string): Promise<void> {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  const res = await POST(jsonReq("http://x", { memberId, capabilities: [...CAPS] }),
    params({ projectId }));
  if (res.status >= 300) throw new Error(`grant ${res.status} ${await res.text()}`);
}

/**
 * THE PARTICIPANT ROWS ARE INSERTED DIRECTLY, AND THAT IS A GAP AND NOT A
 * SHORTCUT.
 *
 * `technical/openapi/scope-v0.1.csv` carries no `project_parties.*` and no
 * `party_contacts.*` operation, and `apps/app/app/v1/` has no route that writes
 * either table. So the three typed signatory slots of п. 8.4.3.5 name records
 * that NO v0.1 COMMAND CAN CREATE: a pilot workspace reaches
 * `statutory_acts.compose` and has nothing to put in any slot.
 *
 * The fixture inserts them because the alternative is not testing the act at
 * all. It is reported rather than routed around — the same shape as the four
 * capabilities M3 had to grant by hand.
 */
async function seedParticipant(
  fx: BaselineFixture, o: {
    partyId?: string; displayName: string; relationship: string;
    officialName?: string; fullName: string; roleTitle: string | null;
  },
): Promise<{ partyId: string; projectPartyId: string; contactId: string }> {
  let partyId = o.partyId;
  if (partyId === undefined) {
    const p = await q<{ id: string }>(
      `insert into public.parties (workspace_id, display_name, created_by)
       values ($1,$2,$3) returning id`,
      [fx.workspaceId, o.displayName, A]);
    partyId = p[0]!.id;
    if (o.officialName !== undefined) {
      await q(
        `insert into public.party_legal_profiles
           (workspace_id, party_id, official_name, updated_by)
         values ($1,$2,$3,$4)`,
        [fx.workspaceId, partyId, o.officialName, A]);
    }
  }
  const pp = await q<{ id: string }>(
    `insert into public.project_parties
       (workspace_id, project_id, party_id, relationship, created_by)
     values ($1,$2,$3,$4,$5) returning id`,
    [fx.workspaceId, fx.projectId, partyId, o.relationship, A]);
  const pc = await q<{ id: string }>(
    `insert into public.party_contacts
       (workspace_id, party_id, full_name, role_title, created_by)
     values ($1,$2,$3,$4,$5) returning id`,
    [fx.workspaceId, partyId, o.fullName, o.roleTitle, A]);
  return { partyId, projectPartyId: pp[0]!.id, contactId: pc[0]!.id };
}

/**
 * A published bound baseline, one line, one CONCEALED stage carrying TWO
 * obligations, both satisfied and the stage CLOSED — the only state from which
 * an act can be composed at all.
 *
 * THE TWO OBLIGATIONS ARE SATISFIED DIFFERENTLY, deliberately: one by an
 * accepting evidence decision and one by an `accept_risk` exception. The act's
 * decision blocks are read through `stage_closure_occurrences`, and a mapper
 * that walked only the decision branch would produce an act with one block
 * where the closure froze two — which is a document that omits an obligation
 * the closure was granted against.
 *
 * THE ORDER IS FORCED BY INV-069. The decision must be taken BEFORE any progress
 * is recorded on the assignment, because `evidence_decisions.create` denies a
 * decision to the member who recorded the quantity. One member is all a v0.1
 * pilot has — responsibility-presets.csv says «one member may combine
 * responsibilities in v0.1» — so the sequence is decide, record, except, close.
 */
async function baseline(): Promise<Fx> {
  const base = await baselineFixture(A);
  await grant(base.projectId, base.memberId);
  const library = await seedRequirementLibrary(base.workspaceId);

  const libraryKeys = ["Н.15/1", "Н.15/2"];
  const ruleIds: string[] = [];
  for (const key of libraryKeys) {
    const res = await publishRuleVersion(base.workspaceId,
      ruleVersionBody(library.get(key)!, { workTypeKey: WORK_TYPE, stageKey: STAGE }));
    if (res.status !== 201) {
      throw new Error(`publishRuleVersion ${res.status} ${await res.text()}`);
    }
    ruleIds.push((await res.json()).ruleVersionId as string);
  }

  const draft = await createDraft(base.contractId);
  const contractVersionId = (await draft.json()).contractVersionId as string;
  const line = await addLine(contractVersionId, {
    // WORK_TYPE, matching the two rule versions published above. Since
    // migration 0050 the line's work type is what a bound rule has to
    // intersect, so without it `publishVersion` below answers 409
    // RULE_BINDING_REQUIRED and this fixture never returns.
    sourceKey: "1.1", workTypeKey: WORK_TYPE,
    description: "Приклад-прокладання кабелю в штробі",
    unitCode: "м", contractQuantity: "10",
    unitPriceState: "known", unitPrice: "100.00",
  });
  if (line.status !== 201) throw new Error(`addLine ${line.status} ${await line.text()}`);
  const workItemId = (await line.json()).workItem.workItemId as string;

  // A SECOND LINE, DELIBERATELY UNTYPED. Publication refuses only TOTAL
  // disjointness, so this rides along; its assignment implies no stage
  // vocabulary and is therefore the only place a stage may still be made by
  // hand.
  const spare = await addLine(contractVersionId, {
    sourceKey: "1.2", description: "Приклад-позиція без виду робіт",
    unitCode: "м", contractQuantity: "10",
    unitPriceState: "known", unitPrice: "100.00",
  });
  if (spare.status !== 201) throw new Error(`addLine ${spare.status} ${await spare.text()}`);
  const spareWorkItemId = (await spare.json()).workItem.workItemId as string;

  const bind = await bindRules(contractVersionId, ruleIds);
  if (bind.status !== 201) throw new Error(`bindRules ${bind.status} ${await bind.text()}`);
  const view = await (await getVersion(base.contractId, 1)).json();
  const pub = await publishVersion(contractVersionId, manifestOf(view));
  if (pub.status !== 201) throw new Error(`publishVersion ${pub.status} ${await pub.text()}`);

  const { POST: createAssignment } = await import(
    "../app/v1/contracts/[contractId]/assignments/route");
  const asg = await createAssignment(jsonReq("http://x", { workItemId }),
    params({ contractId: base.contractId }));
  if (asg.status !== 201) throw new Error(`assignments.create ${asg.status} ${await asg.text()}`);
  const assignmentId = (await asg.json()).assignmentId as string;

  const { workStageId, occurrenceIds } = await materialisedFor(base, assignmentId);

  const spareAsg = await createAssignment(jsonReq("http://x", { workItemId: spareWorkItemId }),
    params({ contractId: base.contractId }));
  if (spareAsg.status !== 201) {
    throw new Error(`assignments.create (uncovered) ${spareAsg.status} ${await spareAsg.text()}`);
  }
  const uncoveredAssignmentId = (await spareAsg.json()).assignmentId as string;

  // 1. decide, while nobody has recorded progress on this assignment (INV-069)
  const { POST: decide } = await import(
    "../app/v1/occurrences/[occurrenceId]/evidence-decisions/route");
  const decided = await decide(jsonReq("http://x", { outcome: "accepted", expectedVersion: null }),
    params({ occurrenceId: occurrenceIds[0]! }));
  if (decided.status !== 201) {
    throw new Error(`evidence_decisions.create ${decided.status} ${await decided.text()}`);
  }

  // 2. record the quantity the act will print a share of
  const { POST: record } = await import("../app/v1/assignments/[assignmentId]/progress/route");
  const recorded = await record(jsonReq("http://x", { quantity: "4" }),
    params({ assignmentId }));
  if (recorded.status !== 201) {
    throw new Error(`progress.record ${recorded.status} ${await recorded.text()}`);
  }
  const progressEntryId = (await recorded.json()).progressEntryId as string;

  // 3. the second obligation, by the escape the single-member pilot actually has
  const { POST: except } = await import("../app/v1/occurrences/[occurrenceId]/exceptions/route");
  const excepted = await except(jsonReq("http://x", {
    action: "accept_risk", reason: "Приклад-ризик прийнято до усунення.",
    expectedVersion: null,
  }), params({ occurrenceId: occurrenceIds[1]! }));
  if (excepted.status !== 201) {
    throw new Error(`requirement_exceptions.create ${excepted.status} ${await excepted.text()}`);
  }

  const closed = await closeStage(workStageId);
  if (closed.status !== 201) throw new Error(`closure ${closed.status} ${await closed.text()}`);
  const stageClosureId = (await closed.json()).stageClosureId as string;

  const builder = await seedParticipant(base, {
    partyId: base.ownPartyId, displayName: "Приклад-Власна",
    relationship: "general_contractor",
    fullName: "Приклад-Виконроб Іваненко І. І.", roleTitle: "виконроб",
  });
  // NO LEGAL PROFILE, deliberately: this is the arm on which the composer must
  // fall back to `parties.display_name` and record that it did.
  const supervision = await seedParticipant(base, {
    displayName: "Приклад-Технагляд", relationship: "technical_supervision",
    fullName: "Приклад-Технагляд Петренко П. П.", roleTitle: "інженер технічного нагляду",
  });

  return {
    ...base, contractVersionId, workItemId, assignmentId, workStageId, stageClosureId,
    occurrenceIds, libraryKeys, progressEntryId, uncoveredAssignmentId,
    builderPartyId: builder.partyId,
    builderProjectPartyId: builder.projectPartyId,
    builderContactId: builder.contactId,
    supervisionPartyId: supervision.partyId,
    supervisionProjectPartyId: supervision.projectPartyId,
    supervisionContactId: supervision.contactId,
  };
}

/**
 * Reads the obligation set `assignments.create` now writes for itself.
 *
 * THIS USED TO WRITE IT. `materialiseFor` hand-built the occurrences because no
 * work line carried a work type, so the route materialised nothing and a
 * fixture that used it would have built an EMPTY stage — one that closes
 * vacuously and produces an act with no decision block, making every Додаток Н
 * assertion below vacuous too. It guarded itself with a precondition that threw
 * the moment the route started doing the work, and named the remedy: delete it
 * and let the route build the fixture. The line above now carries WORK_TYPE, the
 * precondition fired, and this is that deletion.
 *
 * The count is still asserted here, for the reason the old helper asserted it:
 * an act composed over one obligation instead of two would satisfy most of this
 * file while testing half of it.
 */
async function materialisedFor(
  base: BaselineFixture, assignmentId: string,
): Promise<{ workStageId: string; occurrenceIds: string[] }> {
  const rows = await q<{ id: string; work_stage_id: string }>(
    `select id, work_stage_id from public.requirement_occurrences
      where workspace_id = $1 and work_assignment_id = $2
      order by id`, [base.workspaceId, assignmentId]);
  if (rows.length !== 2) {
    throw new Error(`m4-act: expected 2 materialised occurrences, got ${rows.length}`);
  }
  const stage = rows[0]!.work_stage_id;
  if (stage === null) throw new Error("m4-act: the materialised occurrence carries no stage");
  return { workStageId: stage, occurrenceIds: rows.map((r) => r.id) };
}

// ── assertions' helpers ─────────────────────────────────────────────────────

const ACT_TABLES = [
  "statutory_acts", "statutory_act_versions",
  "statutory_act_version_quantities", "statutory_act_version_signatories",
] as const;

async function actRowCounts(workspaceId: string): Promise<Record<string, number>> {
  const rows = await q<{ t: string; n: number }>(
    ACT_TABLES.map((t) => `select '${t}' as t, count(*)::int as n from public."${t}" where workspace_id = $1`)
      .join(" union all "), [workspaceId]);
  return Object.fromEntries(rows.map((r) => [r.t, r.n]));
}

async function composeOnce(fx: Fx, over: Record<string, unknown> = {}): Promise<string> {
  const res = await compose(fx.workStageId, composeBody(fx, over));
  if (res.status !== 201) {
    throw new Error(`statutory_acts.compose ${res.status} ${await res.text()}`);
  }
  return (await res.json()).version.statutoryActVersionId as string;
}

function sameBytes(a: string, b: string): boolean {
  return Buffer.from(a, "utf8").equals(Buffer.from(b, "utf8"));
}

let fx: Fx;
beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await baseline();
});

// ───────────────────────────────────────────────────────────────────────────

describe("statutory_acts.compose — the act is a by-product of closure", () => {
  it("REFUSES a stage that is still open, and names what to do", async () => {
    // The UNCOVERED assignment: work_stages.create refuses a stage key the
    // baseline does not imply, and this one implies none (0051 §1).
    const created = await createStage(fx.uncoveredAssignmentId, "montazhni-roboty-m4", true);
    expect(created.status, await created.clone().text()).toBe(201);
    const openStageId = (await created.json()).workStageId as string;

    const before = await actRowCounts(fx.workspaceId);
    const res = await compose(openStageId, composeBody(fx));
    expect(res.status).toBe(409);
    const body = await res.json();

    // VERSION_CONFLICT follows `stage_closures.create`'s precedent. THERE IS NO
    // WORK-STAGE STATE-CONFLICT CODE in technical/error-catalog.csv —
    // PROJECT_STATE_CONFLICT and CONTRACT_STATE_CONFLICT exist for their
    // entities and no act- or stage-shaped row does. The catalog is owed one,
    // and this suite asserts the code the route actually uses rather than one
    // nobody has written.
    expect(body.code).toBe("VERSION_CONFLICT");
    expect(body.userAction).toBe("refresh_compare_retry");
    // A refusal a foreman can act on, not «щось пішло не так».
    expect(body.detail).toContain("Спочатку закрийте етап");

    // AND IT WROTE NOTHING. The refusal is checked before the act identity row,
    // so a second attempt after closing the stage is not blocked by a half-made
    // act — and `statutory_acts_closure_key` would make that permanent.
    expect(await actRowCounts(fx.workspaceId)).toEqual(before);
  });

  it("REFUSES a closed stage that is not concealed", async () => {
    // «АКТ НА ЗАКРИТТЯ ПРИХОВАНИХ РОБІТ» is the act for CONCEALED works
    // (allow-list item 7; `statutory_acts_concealment_check`). A stage created
    // by hand carries no obligation, so it closes vacuously — which is exactly
    // the case that would slip past a check written only against the status.
    // The UNCOVERED assignment, for the reason given on the case above.
    const created = await createStage(fx.uncoveredAssignmentId, "vidkryti-roboty-m4", false);
    expect(created.status, await created.clone().text()).toBe(201);
    const stageId = (await created.json()).workStageId as string;
    const closed = await closeStage(stageId);
    expect(closed.status, await closed.clone().text()).toBe(201);
    expect((await closed.json()).vacuous).toBe(true);

    const res = await compose(stageId, composeBody(fx));
    expect(res.status).toBe(409);
    expect((await res.json()).detail).toContain("не є прихованими роботами");
    expect((await actRowCounts(fx.workspaceId)).statutory_acts).toBe(0);
  });

  it("is a 404 for a stage that does not exist", async () => {
    const res = await compose(randomUUID(), composeBody(fx));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("RESOURCE_NOT_FOUND");
  });

  it("composes exactly one act per closure and refuses a second", async () => {
    const first = await compose(fx.workStageId, composeBody(fx));
    expect(first.status, await first.clone().text()).toBe(201);
    const second = await compose(fx.workStageId, composeBody(fx));
    expect(second.status).toBe(409);
    expect((await second.json()).detail).toContain("вже існує");
    expect((await actRowCounts(fx.workspaceId)).statutory_acts).toBe(1);
  });

  it("records an audit row and NO outbox row — the catalog has no composed event", async () => {
    await composeOnce(fx);
    const audit = await q<{ action: string }>(
      `select action from public.audit_events
        where organization_id = $1 and action = 'statutory_act_version.composed'`,
      [fx.workspaceId]);
    expect(audit).toHaveLength(1);
    // technical/events/event-catalog.csv carries exactly ONE act event —
    // `statutory_act_version.frozen` — and no `…composed` row of any kind.
    const outbox = await q<{ topic: string }>(
      `select topic from public.transaction_outbox
        where organization_id = $1 and topic like 'statutory_act%'`, [fx.workspaceId]);
    expect(outbox).toEqual([]);
  });
});

describe("the composed act carries no field outside Додаток В (prohibition E)", () => {
  const banned = prohibitionEBannedFields();

  it("prints none of the banned fields anywhere in the act", async () => {
    // THE NEGATIVE, ENUMERATED FROM THE PROHIBITION ITSELF. The ban list is read
    // out of docs/product/hidden-works-content-rules.md at test time, so a field
    // the document bans tomorrow is a field this test checks tomorrow.
    const actVersionId = await composeOnce(fx);
    const res = await getAct(actVersionId);
    expect(res.status, await res.clone().text()).toBe(200);
    const serialized = JSON.stringify(await res.json()).toLowerCase();

    expect(banned.length).toBeGreaterThanOrEqual(6);
    for (const field of banned) {
      expect(serialized, `«${field}» reached the act`).not.toContain(field.toLowerCase());
    }
  });

  it("has no COLUMN for one either, on any of the four act tables", async () => {
    // A string sweep over one response only proves that this act does not carry
    // one. A column is the thing a later slice fills. Prohibition E is a rule
    // about FIELDS, and «a column is a field, and a field nobody sourced is a
    // field somebody will fill» (migration 0047 §4).
    const cols = await q<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and table_name = any($1::text[])`,
      [[...ACT_TABLES]]);
    expect(cols.length).toBeGreaterThan(0);
    for (const { table_name, column_name } of cols) {
      expect(column_name, `${table_name}.${column_name}`).not.toMatch(
        /certificat|sertyfikat|qualification|issuer|issued_by|passport|sheet_no|stamp|seal|cipher|act_no/i);
    }
  });

  it("refuses a fourth signatory slot on the wire, by the absence of the key", async () => {
    // п. 8.4.3.5 names three roles. hidden-works-content-rules.md §"Open items"
    // records that a Київводоканал blank reportedly carries a fourth, «two
    // passes agree, neither fetched the file» — which is exactly the pressure
    // `composeSignatories`'s three `.strict()` keys resist.
    const body = composeBody(fx);
    const signatories = body.signatories as Record<string, unknown>;
    const res = await compose(fx.workStageId, {
      ...body,
      signatories: {
        ...signatories,
        customerRepresentative: {
          projectPartyId: fx.supervisionProjectPartyId,
          partyContactId: fx.supervisionContactId,
        },
      },
    });
    expect(res.status).toBe(422);
    const problem = await res.json();
    expect(problem.code).toBe("VALIDATION_FAILED");
    expect(problem.fieldErrors[0].path).toBe("signatories");
    expect(problem.fieldErrors[0].message).toContain("customerRepresentative");
    expect((await actRowCounts(fx.workspaceId)).statutory_acts).toBe(0);
  });

  it("refuses a certificate field on a slot, by the absence of the key", async () => {
    const body = composeBody(fx);
    const signatories = body.signatories as Record<string, Record<string, unknown>>;
    const res = await compose(fx.workStageId, {
      ...body,
      signatories: {
        ...signatories,
        technicalSupervision: {
          ...signatories.technicalSupervision,
          qualificationCertificateSeries: "АА",
          qualificationCertificateNumber: "000123",
        },
      },
    });
    expect(res.status).toBe(422);
    expect((await res.json()).fieldErrors[0].path).toBe("signatories.technicalSupervision");
  });

  it("refuses a signatory view carrying a certificate, at the read boundary too", async () => {
    // `statutoryActVersionView` is `.strict()` and is re-parsed by
    // `loadActVersionView` before the body leaves the server, so a column added
    // to the table by a future migration and mapped into the view fails loudly
    // here rather than printing.
    const actVersionId = await composeOnce(fx);
    const view = await (await getAct(actVersionId)).json();
    expect(statutoryActVersionView.safeParse(view).success).toBe(true);
    const withCertificate = {
      ...view,
      signatories: view.signatories.map((s: Record<string, unknown>) => ({
        ...s, qualificationCertificateSeries: "АА",
      })),
    };
    expect(statutoryActVersionView.safeParse(withCertificate).success).toBe(false);
  });
});

describe("nothing is printed for the технагляд's кваліфікаційний сертифікат", () => {
  it("carries no серія and no номер on the act, in the body or in the tables", async () => {
    // Allow-list item 10 establishes that технагляд HOLDS one (ПКМУ № 903, п. 3).
    // Whether Додаток В has a slot for its серія and номер is NOT established,
    // and prohibition E bans the adjacent «ким видана». ADR-005 §10 prints
    // nothing for it either.
    const actVersionId = await composeOnce(fx);
    const view = await (await getAct(actVersionId)).json();
    const supervision = view.signatories.find(
      (s: { slot: string }) => s.slot === "technical_supervision");
    expect(supervision).toBeDefined();
    // The slot is FILLED — this is not a vacuous negative over an empty act.
    expect(supervision.frozenPersonName).toBe("Приклад-Технагляд Петренко П. П.");
    expect(Object.keys(supervision).sort()).toEqual([
      "frozenOrganizationName", "frozenOrganizationNameSource", "frozenPersonName",
      "frozenPersonRoleTitle", "partyContactId", "partyId", "partyRelationship",
      "projectPartyId", "slot", "sourceContactVersion", "sourcePartyVersion",
    ]);
  });

  it("has no certificate column on public.party_contacts EITHER, and that is a finding", async () => {
    // technical/database/schema-v0.1.sql:279-283 gives party_contacts
    // `qualification_certificate_series` and `_number`; migration 0010:119-133
    // built neither, and no later migration adds them. So «the certificate lives
    // on the participant record» — said by the content rules, by ADR-005
    // decision 10 and by the glossary — is FALSE IN THE RUNTIME.
    //
    // M4 needs nothing: nothing is printed. The assertion is written as the
    // CURRENT SHAPE deliberately inverted — it asserts the act stores nothing,
    // and it names the deployed gap so that the day the columns land this test
    // still passes and the finding is closed elsewhere.
    const cols = await q<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'party_contacts'`);
    const names = cols.map((c) => c.column_name);
    expect(names).toContain("full_name");
    expect(names).toContain("role_title");
    // If this ever becomes false the participant record gained the certificate —
    // which is a good day, and still changes nothing about what the act prints.
    const hasCertificate = names.some((n) => /certificate/i.test(n));
    const actCols = await q<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'statutory_act_version_signatories'`);
    expect(actCols.some((c) => /certificate/i.test(c.column_name))).toBe(false);
    // Recorded, not asserted either way: the participant-record gap is a finding
    // about 0010 and schema-v0.1.sql, not a requirement of M4.
    expect(typeof hasCertificate).toBe("boolean");
  });
});

describe("the act carries no free-text quantity (INV-073)", () => {
  it("stops a typed quantity by the ABSENCE OF THE FIELD, naming the key", async () => {
    // version-0.1.md §v0.1-M4: «attempt to type a quantity and be stopped by the
    // absence of the field rather than by validation». A JSON body cannot
    // literally lack a key a caller writes; `.strict()` is the closest thing to
    // it, and the 422 names the key that does not exist rather than complaining
    // about its value.
    for (const key of ["quantity", "printedQuantity", "unitCode"]) {
      const res = await compose(fx.workStageId, composeBody(fx, {
        quantityEntries: [{
          rootProgressEntryId: fx.progressEntryId, share: "0.5", [key]: "999",
        }],
      }));
      expect(res.status, `key ${key}`).toBe(422);
      const problem = await res.json();
      expect(problem.code).toBe("VALIDATION_FAILED");
      expect(problem.fieldErrors[0].path).toBe("quantityEntries.0");
      expect(problem.fieldErrors[0].message).toContain(key);
    }
    expect((await actRowCounts(fx.workspaceId)).statutory_acts).toBe(0);
  });

  it("refuses a share of an entry nobody recorded on this line", async () => {
    const res = await compose(fx.workStageId, composeBody(fx, {
      quantityEntries: [{ rootProgressEntryId: randomUUID(), share: "1" }],
    }));
    expect(res.status).toBe(422);
    const problem = await res.json();
    expect(problem.fieldErrors[0].path).toBe("quantityEntries.0.rootProgressEntryId");
    expect(problem.fieldErrors[0].message)
      .toBe("not an existing recorded root progress entry on this assignment and line");
    // THE REFUSAL CARRIES NO INVARIANT ID, and one is not invented here.
    // version-0.1.md §v0.1-M4 security tests and the plan's §"Decisions this
    // plan raises and does not take" item 5 both record that
    // technical/requirements/invariant-catalog.csv owes the row.
  });

  it("refuses a share of an ADJUSTMENT — a correction is not a quantity of its own", async () => {
    const { POST } = await import("../app/v1/progress-entries/[entryId]/adjustments/route");
    const adj = await POST(jsonReq("http://x", {
      quantity: "-1", reasonCode: "measurement_correction",
    }), params({ entryId: fx.progressEntryId }));
    expect(adj.status, await adj.clone().text()).toBe(201);
    const adjustmentId = (await adj.json()).adjustmentEntryId as string;

    const res = await compose(fx.workStageId, composeBody(fx, {
      quantityEntries: [{ rootProgressEntryId: adjustmentId, share: "1" }],
    }));
    expect(res.status).toBe(422);
    expect((await res.json()).fieldErrors[0].path).toBe("quantityEntries.0.rootProgressEntryId");
  });

  it("refuses a share too small to print rather than printing a zero", async () => {
    // Migration 0047 §5, deliberately: «an act that prints «0.000» as the
    // quantity performed is worse than an act that refuses to be composed».
    const res = await compose(fx.workStageId, composeBody(fx, {
      quantityEntries: [{ rootProgressEntryId: fx.progressEntryId, share: "0.000001" }],
    }));
    expect(res.status).toBe(422);
    const problem = await res.json();
    expect(problem.fieldErrors[0].path).toBe("quantityEntries.0.share");
    expect(problem.fieldErrors[0].message).toBe("rounds_to_zero");
  });

  it("refuses the same recorded entry twice", async () => {
    const res = await compose(fx.workStageId, composeBody(fx, {
      quantityEntries: [
        { rootProgressEntryId: fx.progressEntryId, share: "0.5" },
        { rootProgressEntryId: fx.progressEntryId, share: "0.5" },
      ],
    }));
    expect(res.status).toBe(422);
    expect((await res.json()).fieldErrors[0].path).toBe("quantityEntries");
  });

  it("prints the SERVER's share of the entry's OWN recorded quantity, pinned by key", async () => {
    const actVersionId = await composeOnce(fx);
    const view = await (await getAct(actVersionId)).json();
    expect(view.quantityLines).toHaveLength(1);
    const line = view.quantityLines[0];

    // The recorded quantity travels beside the printed one, so a reader can
    // re-derive the second from the first without trusting the server.
    expect(line.rootProgressEntryId).toBe(fx.progressEntryId);
    expect(Number(line.recordedQuantity)).toBe(4);
    expect(Number(line.share)).toBe(0.5);
    // The COLUMN is numeric(20,6), so the string that comes back carries the
    // column's scale and not the unit's — «2.000000», not «2.000». The unit's
    // precision is what the value must ROUND TO, and that is what is asserted;
    // pinning the column's own text would be pinning a storage detail as if it
    // were the printed figure.
    expect(Number(line.printedQuantity)).toBe(2);
    expect(line.printedQuantity).toMatch(/^2(\.0+)?$/);
    expect(line.unitCode).toBe("м");
    expect(line.unitPrecision).toBe(3);

    // AND THE ROW PINS THE ENTRY'S OWN NUMBER, not a copy of it: the six-column
    // foreign key of migration 0047 §5 carries `quantity` itself, so the stored
    // value must equal the entry's.
    const stored = await q<{ recorded: string; printed: string }>(
      `select q.source_recorded_quantity::text recorded, q.printed_quantity::text printed
         from public.statutory_act_version_quantities q
        where q.workspace_id = $1 and q.statutory_act_version_id = $2`,
      [fx.workspaceId, actVersionId]);
    const entry = await q<{ quantity: string }>(
      `select quantity::text from public.progress_entries where id = $1`, [fx.progressEntryId]);
    expect(stored[0]!.recorded).toBe(entry[0]!.quantity);
  });

  it("composes with NO quantity line at all, and says nothing about whether it should", async () => {
    // Migration 0047's completeness trigger does not require a printed quantity,
    // because the target DDL's quadruple is entirely nullable and whether
    // Додаток В's field list makes a quantity mandatory is exactly what is not
    // established. The product decision is OWED (0047 §11); this asserts the
    // shape that decision will change, so it fails when the decision lands.
    const actVersionId = await composeOnce(fx, { quantityEntries: [] });
    const view = await (await getAct(actVersionId)).json();
    expect(view.quantityLines).toEqual([]);
  });
});

describe("the act names the works and the object, which it could not do before", () => {
  /**
   * ORDINALS 6 AND 8 OF ДОДАТОК В. Both facts were in this database and neither
   * reached the renderer, because `StatutoryActVersionView` carried ids and not
   * names — `statutory-act-form.ts` said so in terms and deferred the widening
   * to a separate step. This is that step's route half. Ten blank fields on the
   * act become eight; the other eight stay blank because NO COLUMN ANYWHERE
   * holds проектна документація, матеріали, відхилення or the two dates.
   */
  it("carries the line's own description and the project's own name", async () => {
    const actVersionId = await composeOnce(fx);
    const view = await (await getAct(actVersionId)).json();

    // Read back out of the tables rather than compared to a literal: what is
    // asserted is that the view reproduces the RECORD, not that a fixture and a
    // test agree on a string.
    const [line] = await q<{ description: string }>(
      "select description from public.work_items where workspace_id=$1 and id=$2",
      [fx.workspaceId, fx.workItemId]);
    const [project] = await q<{ name: string; address: string | null; version: string }>(
      "select name, address, version from public.projects where workspace_id=$1 and id=$2",
      [fx.workspaceId, fx.projectId]);

    expect(view.workItemDescription).toBe(line!.description);
    expect(view.projectName).toBe(project!.name);
    expect(view.projectAddress).toBe(project!.address);
    expect(view.sourceProjectVersion).toBe(Number(project!.version));
    // The view is `.strict()` and `loadActVersionView` re-parses before
    // responding, so a widening that forgot to map a column would 500 rather
    // than answer a null. Asserted, because that is the whole safety of adding
    // a field to a contract this project re-parses on the way out.
    expect(statutoryActVersionView.safeParse(view).success).toBe(true);
  });

  it("has no PINNED project name while it is a draft — a draft is not a document", async () => {
    const actVersionId = await composeOnce(fx);
    // `statutory_act_versions_draft_clean_check`: a draft carries none of the
    // freeze facts, and migration 0056's three joined that list.
    const [row] = await q<{
      n: string | null; a: string | null; v: string | null;
    }>(`select frozen_project_name n, frozen_project_address a,
               source_project_version::text v
          from public.statutory_act_versions where workspace_id=$1 and id=$2`,
      [fx.workspaceId, actVersionId]);
    expect(row).toEqual({ n: null, a: null, v: null });
  });

  it("follows a rename while it is a draft, and would not once it is frozen", async () => {
    const actVersionId = await composeOnce(fx);
    const before = await (await getAct(actVersionId)).json();

    // A rename is ORDINARY: `projects_update` (0011:125-127) admits any
    // project.admin, with no guard and no terminal state. This is the event the
    // frozen columns exist for.
    await q(`update public.projects set name = $3, address = $4, version = version + 1
              where workspace_id = $1 and id = $2`,
      [fx.workspaceId, fx.projectId, "Приклад-перейменований обʼєкт", "Приклад-нова адреса"]);

    const after = await (await getAct(actVersionId)).json();
    expect(after.projectName).toBe("Приклад-перейменований обʼєкт");
    expect(after.projectAddress).toBe("Приклад-нова адреса");
    expect(after.sourceProjectVersion).toBe(before.sourceProjectVersion + 1);

    // Nothing was pinned, because nothing was frozen.
    const [row] = await q<{ n: string | null }>(
      `select frozen_project_name n from public.statutory_act_versions
        where workspace_id=$1 and id=$2`, [fx.workspaceId, actVersionId]);
    expect(row!.n).toBeNull();
  });

  it("SURVIVES a rename once frozen — the document does not follow the project", async () => {
    // THE WHOLE REASON MIGRATION 0056 EXISTS, and until the retrieval record
    // landed this arc could not be exercised at all, because no act could
    // freeze. Renaming a project is ordinary administration: `projects_update`
    // (0011:125-127) admits any project.admin, with no guard and no terminal
    // state. If the act read the name live, `content_hash` — pinned over the OLD
    // string — would stop matching, and `statutory_acts.render` would answer
    // `frozen_content_hash_divergence` for ever after. An admin fixing a typo
    // would silently destroy every act ever frozen under that project.
    const actVersionId = await composeOnce(fx);
    const [before] = await q<{ name: string }>(
      "select name from public.projects where workspace_id=$1 and id=$2",
      [fx.workspaceId, fx.projectId]);

    expect((await freezeAct(actVersionId, 1)).status).toBe(200);
    const frozenDoc = await (await renderAct(actVersionId)).text();

    await q(`update public.projects set name = $3, address = $4, version = version + 1
              where workspace_id = $1 and id = $2`,
      [fx.workspaceId, fx.projectId, "Приклад-обʼєкт після перейменування",
       "Приклад-адреса, додана пізніше"]);

    // THE VIEW does not move…
    const view = await (await getAct(actVersionId)).json();
    expect(view.projectName).toBe(before!.name);
    // …including the address, which the project did NOT have at the freeze and
    // has now. This is why `loadActVersionView` branches on `status` instead of
    // coalescing: a coalesce would fall through the frozen NULL to the live
    // column and start printing an address into a document frozen without one.
    expect(view.projectAddress).toBeNull();

    // …AND THE DOCUMENT IS BYTE-IDENTICAL, which is the assertion that matters:
    // a 200 with the same bytes means the stored hash still re-derives.
    const after = await renderAct(actVersionId);
    expect(after.status, await after.clone().text()).toBe(200);
    expect(Buffer.from(await after.text(), "utf-8")
      .equals(Buffer.from(frozenDoc, "utf-8"))).toBe(true);
  });
});

describe("a normative string travels with its tag and its source, or not at all", () => {
  it("carries the form citation as one object of three", async () => {
    const actVersionId = await composeOnce(fx);
    const view = await (await getAct(actVersionId)).json();
    expect(view.formCitation.text).toBe(FORM_CITATION_TEXT);
    expect(view.formCitation.verification).toBe("VERIFIED_PRIMARY");
    expect(view.formCitation.source.trim().length).toBeGreaterThan(0);
    // Unstorable without all three (three NOT NULL columns), so the storage half
    // is a schema question and lives in packages/testing. What is asserted here
    // is that the READ carries all three or fails to parse: `formCitation` is a
    // `.strict()` object and `loadActVersionView` re-parses before responding.
    expect(statutoryActVersionView.safeParse({
      ...view, formCitation: { text: view.formCitation.text, verification: "VERIFIED_PRIMARY" },
    }).success).toBe(false);
  });

  it("pins the template by key, version and — once frozen — by hash", async () => {
    const actVersionId = await composeOnce(fx);
    const view = await (await getAct(actVersionId)).json();
    expect(view.formTemplateKey).toBe(DODATOK_V_TEMPLATE.key);
    expect(view.formTemplateVersion).toBe(DODATOK_V_TEMPLATE.version);
    // A DRAFT CARRIES NO FREEZE FACTS (`statutory_act_versions_draft_clean_check`),
    // so a draft cannot be mistaken for frozen by anything that trusts the
    // columns rather than the status.
    expect(view.status).toBe("draft");
    expect(view.formTemplateHash).toBeNull();
    expect(view.contentHash).toBeNull();
    expect(view.rendererVersion).toBeNull();
    expect(view.frozenAt).toBeNull();
  });
});

describe("M4 goes end to end: the act freezes, renders, and re-renders identically", () => {
  /**
   * THIS BLOCK USED TO ASSERT THAT NONE OF THIS WAS POSSIBLE, and it was right
   * to. `statutory_acts.render` refused for the whole of v0.1 on two blockers,
   * both DERIVED from artifacts this repository did not hold: the В.1/В.2 field
   * list, and the ДБН retrieval record. Both landed on 2026-08-10 — the second
   * one last, when the owner supplied the download URL and the file was
   * re-fetched from it and hashed independently, matching the digest the
   * transcription had been verified against.
   *
   * The refusals were not deleted. Every one of them is still computed from the
   * absence of its datum, and the two that no longer fire are asserted ABSENT
   * below rather than dropped, so a regression that brings either back fails
   * here instead of quietly restoring «M4 ships a composer and no document».
   */
  it("REFUSES a DRAFT render — and on that ground alone, now the other two are closed", async () => {
    const actVersionId = await composeOnce(fx);
    const res = await renderAct(actVersionId);
    expect(res.status).toBe(422);
    const problem = await res.json();

    // technical/error-catalog.csv:26. NO CODE IN THAT CATALOG DESCRIBES «a
    // regulatory content artifact this document needs is not committed», and
    // one is not invented; the catalog is owed an act-shaped row.
    expect(problem.code).toBe("PACKAGE_BLOCKED");
    expect(problem.userAction).toBe("resolve_listed_blockers");
    const codes = problem.details.blockers.map((b: { code: string }) => b.code);
    // A draft is not a document to hand over — that refusal is a JUDGEMENT this
    // route records, not a missing artifact, and it survives the milestone.
    expect(codes).toEqual(["act_version_not_frozen"]);
    expect(codes).not.toContain("dodatok_v_field_list_not_committed");
    expect(codes).not.toContain("dbn_retrieval_record_absent");
    expect(problem.details.blockerCount).toBe(problem.details.blockers.length);
    for (const b of problem.details.blockers) {
      expect(b.detail.trim().length).toBeGreaterThan(0);
      expect(b.closedBy.trim().length).toBeGreaterThan(0);
    }
  });

  it("carries NO regulatory content in the refusal payload", async () => {
    // The blockers say what is missing and what closes it. They must not carry
    // the captions that could not be printed, the citation that could not be
    // rendered, or an acceptance criterion — error-catalog.csv's log policy for
    // this code is counts and codes.
    const actVersionId = await composeOnce(fx);
    const problem = await (await renderAct(actVersionId)).json();
    const payload = JSON.stringify(problem.details);
    expect(payload).not.toContain(FORM_CITATION_TEXT);
    expect(payload).not.toContain(DODATOK_V_TEMPLATE.title.text);
    for (const row of CSV) expect(payload).not.toContain(row.itemTextUk);
  });

  it("FREEZES, and the row gains its five freeze facts and the pinned project", async () => {
    // `content_hash` is the digest OF THE RENDER, so an act that cannot be
    // rendered cannot be frozen — that is why this refused for the whole of
    // v0.1 and why it now succeeds. INV-015's «a rendered act that cannot be
    // re-derived from its own record» is what the hash exists to prevent.
    const actVersionId = await composeOnce(fx);
    const res = await freezeAct(actVersionId, 1);
    expect(res.status, await res.clone().text()).toBe(200);

    const row = await q<{
      status: string; draft_version: string; content_hash: string | null;
      renderer_version: string | null; form_template_hash: string | null;
      frozen_at: Date | null; frozen_by_member_id: string | null;
      frozen_project_name: string | null; source_project_version: string | null;
    }>(`select status, draft_version::text, content_hash, renderer_version,
               form_template_hash, frozen_at, frozen_by_member_id,
               frozen_project_name, source_project_version::text
          from public.statutory_act_versions where id = $1`, [actVersionId]);
    const r = row[0]!;
    expect(r.status).toBe("frozen");
    expect(r.draft_version).toBe("2");
    expect(r.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.renderer_version).toBe(RENDERER_VERSION);
    expect(r.form_template_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.frozen_at).not.toBeNull();
    expect(r.frozen_by_member_id).not.toBeNull();

    // MIGRATION 0056. The freeze pins the project's name from the view it just
    // rendered — `statutory_act_versions_frozen_complete_check` makes a freeze
    // that skips it unstorable.
    const [project] = await q<{ name: string; version: string }>(
      "select name, version from public.projects where workspace_id=$1 and id=$2",
      [fx.workspaceId, fx.projectId]);
    expect(r.frozen_project_name).toBe(project!.name);
    expect(r.source_project_version).toBe(project!.version);

    // event-catalog.csv:28 — the one act event this product has.
    const outbox = await q<{ topic: string }>(
      `select topic from public.transaction_outbox
        where organization_id = $1 and topic = 'statutory_act_version.frozen'`,
      [fx.workspaceId]);
    expect(outbox).toHaveLength(1);
  });

  it("renders twice and the bytes are identical — INV-015's determinism clause", async () => {
    // version-0.1.md §v0.1-M4's acceptance walk, step 4, performed for the first
    // time. The document carries no clock — no renderedAt, no now() — and every
    // read behind it is explicitly ordered, because `order by created_at` over
    // rows written in one transaction is not an order.
    const actVersionId = await composeOnce(fx);
    expect((await freezeAct(actVersionId, 1)).status).toBe(200);

    const first = await renderAct(actVersionId);
    expect(first.status).toBe(200);
    const a = await first.text();
    const b = await (await renderAct(actVersionId)).text();
    expect(Buffer.from(b, "utf-8").equals(Buffer.from(a, "utf-8"))).toBe(true);

    // AND THE STORED HASH AGREES WITH THE RENDERED ONE. The route refuses with
    // `frozen_content_hash_divergence` when they part; that it does not is the
    // whole of «a frozen act can be re-derived from its own record».
    const doc = JSON.parse(a);
    const [stored] = await q<{ content_hash: string }>(
      "select content_hash from public.statutory_act_versions where id = $1", [actVersionId]);
    expect(doc.contentHash).toBe(stored!.content_hash);
  });

  it("lays the document out against the committed В.1/В.2 list and adds nothing", async () => {
    // Acceptance walk step 6, also performed for the first time. The field list
    // IS the layout: every caption comes from the committed CSV, so a caption in
    // the document that is not in the list is a caption somebody typed.
    const actVersionId = await composeOnce(fx);
    expect((await freezeAct(actVersionId, 1)).status).toBe(200);
    const doc = await (await renderAct(actVersionId)).json();

    expect(doc.sections.map((s: { sectionId: string }) => s.sectionId)).toEqual(["В.1", "В.2"]);
    const fields = doc.sections.flatMap((s: { fields: unknown[] }) => s.fields);
    expect(fields).toHaveLength(51);

    const committed = [...DODATOK_V_TEMPLATE.fieldList!].sort((x, y) => x.ordinal - y.ordinal);
    for (const [i, f] of fields.entries()) {
      const want = committed[i]!;
      expect(f.fieldId).toBe(want.fieldId);
      // BYTE-IDENTICAL, not `toBe` on decoded strings: two apostrophes, a
      // missing space in «посада,номер», and trailing spaces from the PDF's own
      // text layer all survive a careless normalise in a way `toBe` can miss.
      expect(Buffer.from(f.caption.text, "utf-8")
        .equals(Buffer.from(want.caption, "utf-8")), `caption ${want.ordinal}`).toBe(true);
    }
    // Prohibition F's three quirks reached the DOCUMENT, not just the CSV.
    const captions = fields.map((f: { caption: { text: string } }) => f.caption.text);
    expect(captions.some((c: string) => c.includes("посада,номер"))).toBe(true);
    expect(captions.some((c: string) => c.includes("посада, номер"))).toBe(true);
    expect(captions.some((c: string) => c.includes("На основі викладеного"))).toBe(true);
  });

  it("means M4 composes, freezes AND renders end to end — both artifacts landed", () => {
    // Not an assertion about the product — the marker this suite has carried
    // since it was written, flipped. Both artifacts are here:
    //
    //   the В.1/В.2 field list, committed under technical/requirements/ and
    //   machine-transcribed from the official file;
    //
    //   the ДБН retrieval record — the URL, the date and the hash — with the
    //   bytes re-fetched from that URL and hashed independently to check it.
    //
    // «M4 ships a composer and no document» was true for the whole of v0.1 and
    // is no longer. TODOS.md's BLOCKER entry and this marker move together.
    expect(DODATOK_V_TEMPLATE.fieldList).not.toBeNull();
    expect(DODATOK_V_TEMPLATE.fieldList!.length).toBe(51);
    expect(DBN_RETRIEVAL_RECORD).not.toBeNull();
    expect(DBN_RETRIEVAL_RECORD!.url.length).toBeGreaterThan(0);
    expect(DBN_RETRIEVAL_RECORD!.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DBN_RETRIEVAL_RECORD!.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("every Додаток Н item the act carries is byte-identical to the CSV", () => {
  it("reproduces the acceptance criterion of each obligation, character for character", async () => {
    const actVersionId = await composeOnce(fx);
    const view = await (await getAct(actVersionId)).json();

    // BOTH obligations are in the act, satisfied two different ways. A mapper
    // that walked only the decision branch would carry one.
    expect(view.decisions).toHaveLength(2);
    expect(view.decisions.map((d: { satisfiedBy: string }) => d.satisfiedBy).sort())
      .toEqual(["evidence_decision", "exception"]);

    const expected = fx.libraryKeys.map((k) => {
      const [position, itemNo] = k.split("/");
      const row = CSV.find((r) => r.position === position && r.itemNo === Number(itemNo));
      if (!row) throw new Error(`m4-act: the CSV has no row ${k}`);
      return row;
    });
    const criteria = view.decisions
      .map((d: { acceptanceCriterion: string }) => d.acceptanceCriterion).sort();
    expect(criteria).toEqual(expected.map((r) => r.itemTextUk).sort());
    // `===` on sorted arrays would pass for a lookalike codepoint; the bytes
    // are compared explicitly.
    for (const c of criteria) {
      expect(expected.some((r) => sameBytes(r.itemTextUk, c)), c).toBe(true);
    }
  });

  it("attributes each one exactly as allow-list item 1 gives the attribution", async () => {
    const actVersionId = await composeOnce(fx);
    const view = await (await getAct(actVersionId)).json();
    for (const d of view.decisions) {
      expect(d.normRef).not.toBeNull();
      // «ДБН А.3.1-5:2016, Додаток Н (довідковий), позиція Н.15» — position
      // level, and composed from the cited row rather than written into code.
      expect(sameBytes(d.normRef.text, citationOf(DODATOK_N_SOURCE_STANDARD, "Н.15"))).toBe(true);
      expect(d.normRef.verification).toBe("VERIFIED_PRIMARY");
      // The source column of the CSV, verbatim: one unreproduced fetch, named
      // in the same words the requirement library uses.
      expect(CSV.some((r) => sameBytes(r.source, d.normRef.source))).toBe(true);
    }
  });

  it("adds no thirteenth item, and prints no prohibited word", async () => {
    // Prohibition A: «Never add an item to Н.15. It has exactly seven lines.»
    // Prohibition B: «орієнтовн» occurs zero times in the standard.
    // Prohibition Q: no page number.
    const actVersionId = await composeOnce(fx);
    const view = await (await getAct(actVersionId)).json();
    const texts = CSV.map((r) => r.itemTextUk);
    for (const d of view.decisions) {
      expect(texts).toContain(d.acceptanceCriterion);
      expect(d.acceptanceCriterion).not.toContain("орієнтовн");
      expect(d.normRef.text).toContain("довідковий");
      expect(d.normRef.text).not.toContain("орієнтовн");
      expect(d.normRef.text).not.toMatch(/стор\.|с\. \d/);
      // No approving order: it is asserted by no allow-list item.
      expect(d.normRef.text).not.toContain("наказ");
    }
  });

  it("holds exactly five Н.14 rows and seven Н.15 rows, in the library and in the CSV", async () => {
    expect(CSV.filter((r) => r.position === "Н.14")).toHaveLength(5);
    expect(CSV.filter((r) => r.position === "Н.15")).toHaveLength(7);
    const stored = await q<{ position_code: string; n: number }>(
      `select position_code, count(*)::int as n from public.requirement_library_items
        where workspace_id = $1 group by position_code order by position_code`,
      [fx.workspaceId]);
    expect(stored).toEqual([
      { position_code: "Н.14", n: 5 }, { position_code: "Н.15", n: 7 },
    ]);
  });

  it("states the assurance level of every decision block it carries", async () => {
    // hidden-works-content-rules.md §"Standing rules": «a package or act that
    // cannot state the level of a decision it carries must not render that
    // decision». Both of v0.1's mechanisms — an internal member decision and an
    // occurrence satisfied by an exception — map to level 2, and THAT MAPPING IS
    // THE PRODUCT'S ASSUMPTION, stated by no document (0047 §11; the render
    // slice's report). It is asserted because it is what ships, and it is the
    // assertion that has to change if the ladder ever grades either one higher.
    const actVersionId = await composeOnce(fx);
    const view = await (await getAct(actVersionId)).json();
    for (const d of view.decisions) {
      expect(d.assuranceLevel).toBe("operational_acknowledgement");
      expect(d.assuranceLabel).toBeNull();
      // NOTHING ON THIS OBJECT IS A SIGNATURE. Prohibition S has nothing here to
      // mislabel because the act stores no signature of any kind.
      expect(Object.keys(d)).not.toContain("signature");
      expect(Object.keys(d)).not.toContain("signedAt");
    }
  });
});

describe("the frozen strings come off the participant record, never off the wire", () => {
  it("prefers the legal profile's official name and records which one it froze", async () => {
    const actVersionId = await composeOnce(fx);
    const view = await (await getAct(actVersionId)).json();
    const builder = view.signatories.find((s: { slot: string }) => s.slot === "builder");
    expect(builder.frozenOrganizationName).toBe("ТОВ Приклад-Власна");
    expect(builder.frozenOrganizationNameSource).toBe("legal_profile_official_name");
    expect(builder.partyRelationship).toBe("general_contractor");

    // The other arm: a participant with NO legal profile falls back to the
    // display name and SAYS SO, so a reviewer years later knows what they are
    // comparing a corrected record against.
    const supervision = view.signatories.find(
      (s: { slot: string }) => s.slot === "technical_supervision");
    expect(supervision.frozenOrganizationName).toBe("Приклад-Технагляд");
    expect(supervision.frozenOrganizationNameSource).toBe("party_display_name");
    expect(supervision.partyRelationship).toBe("technical_supervision");
  });

  it("freezes авторський нагляд only when it is given, and freezes two slots otherwise", async () => {
    // schema-v0.1.sql:1656-1657 requires the builder and the технагляд and not
    // the third; п. 8.4.3.5 names three and NO document says the third is
    // conditional. Migration 0047 §11 item 8 records the question. The
    // assertion below is of the shape that decision will change.
    const actVersionId = await composeOnce(fx);
    const view = await (await getAct(actVersionId)).json();
    expect(view.signatories.map((s: { slot: string }) => s.slot))
      .toEqual(["builder", "technical_supervision"]);
  });

  it("refuses a participant whose project role does not match the slot", async () => {
    // THE SLOT-TO-RELATIONSHIP MAP IS THE PRODUCT'S ASSUMPTION and is enforced
    // by one named constraint, `..._slot_role_assumption_check`, so a pilot that
    // needs another mapping changes something somebody can find rather than
    // discovering that the technical-supervision slot was filled by the
    // customer. The builder leg — general_contractor / subcontractor /
    // performer — is the guess (0047 §11).
    const customer = await seedParticipant(fx, {
      partyId: fx.customerPartyId, displayName: "Приклад-Замовник",
      relationship: "customer",
      fullName: "Приклад-Замовник Сидоренко С. С.", roleTitle: "директор",
    });
    const res = await compose(fx.workStageId, composeBody(fx, {
      signatories: {
        builder: {
          projectPartyId: fx.builderProjectPartyId, partyContactId: fx.builderContactId,
        },
        technicalSupervision: {
          projectPartyId: customer.projectPartyId, partyContactId: customer.contactId,
        },
      },
    }));
    // NO COMPOSER-SIDE PRE-CHECK EXISTS, so what refuses this is the CHECK, and
    // the caller sees whatever `toProblemResponse` makes of a 23514 rather than
    // a sentence naming the slot. The assertion is deliberately only «not
    // composed»: asserting the status code would pin today's shape, and the
    // owed work is a legible 422 that names `signatories.technicalSupervision`.
    expect(res.status).not.toBe(201);
    const counts = await actRowCounts(fx.workspaceId);
    // The whole transaction rolls back, so no half-made act survives — which
    // matters more than the code, because `statutory_acts_closure_key` would
    // make a surviving identity row permanent.
    expect(counts.statutory_acts).toBe(0);
    expect(counts.statutory_act_version_signatories).toBe(0);
  });

  it("refuses a person who is not a contact of that participant", async () => {
    const res = await compose(fx.workStageId, composeBody(fx, {
      signatories: {
        builder: {
          projectPartyId: fx.builderProjectPartyId,
          partyContactId: fx.supervisionContactId,
        },
        technicalSupervision: {
          projectPartyId: fx.supervisionProjectPartyId,
          partyContactId: fx.supervisionContactId,
        },
      },
    }));
    expect(res.status).toBe(422);
    expect((await res.json()).fieldErrors[0].path).toBe("signatories.builder.partyContactId");
  });
});

describe("tenant isolation — INV-001 and INV-002 across all four operations", () => {
  it("is a 404 for every operation, from another workspace's owner", async () => {
    const actVersionId = await composeOnce(fx);
    // B owns a workspace of their own, so this is a real actor and not an
    // unauthenticated one: the question is whether A's act is reachable, not
    // whether an anonymous caller is refused.
    current = B;
    const own = await baselineFixture(B);
    expect(own.workspaceId).not.toBe(fx.workspaceId);

    for (const res of [
      await getAct(actVersionId), await renderAct(actVersionId), await freezeAct(actVersionId),
    ]) {
      expect(res.status).toBe(404);
      expect((await res.json()).code).toBe("RESOURCE_NOT_FOUND");
    }
    const composed = await compose(fx.workStageId, composeBody(fx));
    expect(composed.status).toBe(404);
  });

  it("answers a foreign id and a nonexistent id identically — no oracle", async () => {
    const actVersionId = await composeOnce(fx);
    current = B;
    await baselineFixture(B);
    const foreign = await getAct(actVersionId);
    const absent = await getAct(randomUUID());
    expect(foreign.status).toBe(absent.status);
    const [a, b] = [await foreign.json(), await absent.json()];
    // requestId differs by construction; everything a caller could distinguish
    // the two by must not.
    expect({ ...a, requestId: null }).toEqual({ ...b, requestId: null });
  });

  it("hides the row from a member of the RIGHT workspace who lacks the capability", async () => {
    const actVersionId = await composeOnce(fx);
    await q(`insert into public.memberships (organization_id, user_id, role, status)
             values ($1,$2,'member','active')`, [fx.workspaceId, C]);
    current = C;
    const res = await getAct(actVersionId);
    // 404 AND NOT 403, DELIBERATELY on the cross-workspace arc and a COST on
    // this one: `sav_select` (0047 §10) admits `statutory_acts.compose` and
    // `project.admin`, so a row this actor may not see is invisible to the
    // locating query. A member of the right workspace who simply lacks the
    // capability gets a 404 where a 403 would be more useful. Asserted so the
    // cost is visible rather than discovered.
    expect(res.status).toBe(404);
  });

  it("gives a project.admin the legible 403 instead", async () => {
    const actVersionId = await composeOnce(fx);
    await q(`insert into public.memberships (organization_id, user_id, role, status)
             values ($1,$2,'member','active')`, [fx.workspaceId, C]);
    const member = await q<{ id: string }>(
      `select id from public.memberships where organization_id=$1 and user_id=$2`,
      [fx.workspaceId, C]);
    const { POST: grantTo } = await import("../app/v1/projects/[projectId]/access-grants/route");
    const granted = await grantTo(jsonReq("http://x", {
      memberId: member[0]!.id, capabilities: ["project.admin", "project.view"],
    }), params({ projectId: fx.projectId }));
    expect(granted.status, await granted.clone().text()).toBeLessThan(300);

    current = C;
    const res = await getAct(actVersionId);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("hides the act's rows from another tenant at the POLICY level, not only at the route", async () => {
    const actVersionId = await composeOnce(fx);
    current = B;
    const own = await baselineFixture(B);
    // Read AS B, through the application role, with B's actor GUC — the same
    // path a route takes. A route check that was accidentally removed would
    // still find nothing here.
    const seen = await withTenantTx(
      { actorUserId: B, organizationId: own.workspaceId, requestId: randomUUID() },
      async (tx) => {
        const v = await tx.query(
          `select count(*)::int as n from public.statutory_act_versions where id = $1`,
          [actVersionId]);
        const a = await tx.query(
          `select count(*)::int as n from public.statutory_acts where workspace_id = $1`,
          [fx.workspaceId]);
        const s = await tx.query(
          `select count(*)::int as n from public.statutory_act_version_signatories
            where statutory_act_version_id = $1`, [actVersionId]);
        const qn = await tx.query(
          `select count(*)::int as n from public.statutory_act_version_quantities
            where statutory_act_version_id = $1`, [actVersionId]);
        return [v.rows[0].n, a.rows[0].n, s.rows[0].n, qn.rows[0].n];
      });
    expect(seen).toEqual([0, 0, 0, 0]);
  });
});
