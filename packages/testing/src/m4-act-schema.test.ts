import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Client } from "pg";
import { randomUUID } from "node:crypto";
import { adminClient } from "./pg";
import {
  dropRulesWorkspaces, raised, seedRulesWorld, sqlstate, type RulesFixture,
} from "./m1-rules-fixture";
import { seedClosureWorld, type ClosureWorld } from "./m3-closure-fixture";
import {
  FORM_CITATION, HEX64, QUANTITY_INSERT, SIGNATORY_INSERT, VERSION_INSERT,
  ACT_INSERT, actParams, attemptFreeze, contentHashOf, insertAct, insertVersion,
  quantityParams, resetActFacts, seedActWorld, seedDraftAct, signatoryParams,
  versionParams, type ActWorld,
} from "./m4-act-fixture";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `vitest`, `tsc`, `psql` and `supabase` were never run against it, no
 * migration was applied, and no claim is made that any assertion below passes.
 * Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M4, storage layer: THE ACT AS A SHAPE.
 *
 * `apps/app/tests/m4-act.int.test.ts` proves what the four routes do. This suite
 * proves the half that survives a rewrite of them: every refusal below is
 * attempted from the ADMIN CONNECTION — the table owner, RLS bypassed — so what
 * answers is a key, a CHECK or a trigger and never a branch in a handler.
 *
 * THREE CLAIMS ARE WORTH THE WHOLE FILE:
 *
 *   INV-015. «An act version is immutable once frozen, and a correction is a
 *   successor version.» `app.guard_statutory_act_version()` rejects every delete
 *   and every update whose old status is not `draft`, which makes `frozen`
 *   TERMINAL. If that holds, a command written years from now cannot edit a
 *   handed-over document even by accident.
 *
 *   INV-073, storage half. «There is no free-text quantity field.» A printed
 *   quantity is not validated into place — it is UNSTORABLE unless it is a share
 *   of a specific recorded ROOT entry on this act's own assignment and line, in
 *   that line's own unit, with the entry's own recorded quantity pinned into the
 *   row by a six-column foreign key. Every leg of that key is attacked below,
 *   one at a time, because a key that resolves on five of six columns is a key
 *   that stopped nothing.
 *
 *   PROHIBITION E, as a schema. A fourth signatory violates a primary key over a
 *   three-value CHECK; a banned FIELD needs a migration somebody reads. That is
 *   the whole argument for departure 2 (rows with typed columns rather than
 *   three jsonb columns), and it is only true if the enumeration is actually
 *   closed — which is what the column census asserts.
 *
 * WHAT THIS SUITE CANNOT PROVE, NAMED SO IT IS NOT MISTAKEN FOR PROVED:
 *
 *   THE FROZEN ROW IS REACHED BY A FIXTURE AND NOT BY THE PRODUCT.
 *   `statutory_act_versions.freeze` refuses in v0.1 — the В.1/В.2 field list and
 *   the ДБН retrieval record are committed nowhere — so `attemptFreeze` performs
 *   the route's own UPDATE. Everything asserted about a frozen row is therefore
 *   asserted about a row the DATABASE accepted, which is the claim, and about a
 *   transition no route can currently make, which is recorded rather than hidden.
 *
 *   BYTE-DETERMINISM. INV-015's determinism half is a property of the renderer
 *   over frozen inputs and is not a database rule. What the schema contributes is
 *   that the inputs cannot move after the freeze — which is exactly what the
 *   content guard below is — and that a divergence has a nameable cause in
 *   `renderer_version`, `form_template_hash` and `content_hash`.
 */

const WS_A = "f4aa1111-1111-1111-1111-111111111111";
const WS_B = "f4aa2222-2222-2222-2222-222222222222";
const USER_A = "f4aa3333-3333-3333-3333-333333333333";
const USER_B = "f4aa4444-4444-4444-4444-444444444444";

const ACT_TABLES = [
  "statutory_acts", "statutory_act_versions",
  "statutory_act_version_quantities", "statutory_act_version_signatories",
] as const;

let c: Client;
let fa: RulesFixture;
let fb: RulesFixture;
let wa: ClosureWorld;
let a: ActWorld;
/** A second workspace's world, for the cross-tenant legs of the composite keys. */
let b: ActWorld;

async function count(table: string, workspaceId: string): Promise<number> {
  const r = await c.query<{ n: number }>(
    `select count(*)::int as n from public.${table} where workspace_id = $1`, [workspaceId]);
  return r.rows[0]!.n;
}

async function versionRow(id: string): Promise<{
  status: string; draft_version: string; content_hash: string | null;
  renderer_version: string | null; frozen_at: string | null;
}> {
  const r = await c.query(
    `select status, draft_version::text, content_hash, renderer_version,
            frozen_at::text as frozen_at
       from public.statutory_act_versions where id = $1`, [id]);
  return r.rows[0]!;
}

/** A draft act, frozen through the fixture, with the freeze asserted to have happened. */
async function frozenAct(): Promise<{ actId: string; versionId: string }> {
  const seeded = await seedDraftAct(c, a);
  const out = await attemptFreeze(c, a, { versionId: seeded.versionId });
  expect(out.error, "the fixture freeze was refused").toBeNull();
  expect(out.updated).toBe(1);
  return seeded;
}

beforeAll(async () => {
  c = await adminClient();
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  fa = await seedRulesWorld(c, { workspaceId: WS_A, userId: USER_A, suffix: "M4A" });
  fb = await seedRulesWorld(c, { workspaceId: WS_B, userId: USER_B, suffix: "M4B" });
  wa = await seedClosureWorld(c, fa);
  const wb = await seedClosureWorld(c, fb);
  a = await seedActWorld(c, wa);
  b = await seedActWorld(c, wb);
}, 120_000);

beforeEach(async () => {
  await resetActFacts(c, WS_A);
  await resetActFacts(c, WS_B);
});

afterAll(async () => {
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  await c.end();
});

// ───────────────────────────────────────────────────────────────────────────

describe("INV-015 — a frozen act version is immutable, by trigger", () => {
  it("freezes exactly once, and the row then carries all five freeze facts", async () => {
    // THE POSITIVE CONTROL, and it is not optional: a guard that refused every
    // update would pass every refusal below and break the product.
    const { versionId } = await frozenAct();
    const row = await versionRow(versionId);
    expect(row.status).toBe("frozen");
    expect(row.draft_version).toBe("2");
    expect(row.content_hash).toBe(contentHashOf(versionId));
    expect(row.renderer_version).toBe("statutory-act-render/1");
    expect(row.frozen_at).not.toBeNull();
  });

  it("REFUSES every update of a frozen version, and says why", async () => {
    const { versionId } = await frozenAct();
    // Not «refuses a status change» — refuses ANY update. The column chosen is
    // the most innocuous one there is.
    const message = await raised(() => c.query(
      `update public.statutory_act_versions
          set correction_reason = 'Приклад-виправлення', draft_version = draft_version + 1
        where id = $1`, [versionId]));
    expect(message).toContain("is frozen and is immutable");
    expect(message).toContain("INV-015");
    expect((await versionRow(versionId)).draft_version).toBe("2");
  });

  it("REFUSES an update that would move it back to draft", async () => {
    const { versionId } = await frozenAct();
    const message = await raised(() => c.query(
      `update public.statutory_act_versions
          set status = 'draft', draft_version = draft_version + 1 where id = $1`, [versionId]));
    // The guard tests `old.status <> 'draft'` FIRST, so the reason a reader is
    // given is «frozen is terminal» and not «that status is not permitted».
    expect(message).toContain("is frozen and is immutable");
  });

  it("REFUSES a DELETE of any version, frozen or draft", async () => {
    const { actId, versionId } = await frozenAct();
    const frozenMessage = await raised(() => c.query(
      `delete from public.statutory_act_versions where id = $1`, [versionId]));
    expect(frozenMessage).toContain("is never deleted");
    expect(frozenMessage).toContain("successor version");

    // A DRAFT COMPOSED BY MISTAKE IS SUPERSEDED, NOT REMOVED (0047 §8): the row
    // records that somebody composed an act against a closure, which is a fact
    // about the workflow even when the document is wrong.
    //
    // The draft is the SUCCESSOR of the frozen version and not a second act,
    // because `statutory_acts_closure_key` allows exactly one act identity per
    // closure — a second `insertAct` here would fail as a duplicate and the
    // delete would never be attempted.
    const successorId = await insertVersion(c, a, {
      statutoryActId: actId, versionNo: 2, predecessorVersionId: versionId,
      predecessorVersionNo: 1, predecessorStatus: "frozen",
      correctionReason: "Приклад-виправлення обсягу.",
    });
    expect(await raised(() => c.query(
      `delete from public.statutory_act_versions where id = $1`, [successorId])))
      .toContain("is never deleted");
  });

  it("REFUSES a draft edit that does not advance draft_version by exactly one", async () => {
    const { versionId } = await seedDraftAct(c, a);
    expect(await raised(() => c.query(
      `update public.statutory_act_versions set correction_reason = 'x' where id = $1`,
      [versionId]))).toContain("advance draft_version exactly once");
    expect(await raised(() => c.query(
      `update public.statutory_act_versions
          set draft_version = draft_version + 2 where id = $1`, [versionId])))
      .toContain("advance draft_version exactly once");
    // Two commands that both read version N cannot both write N+1: this is what
    // makes the expected-version discipline structural rather than procedural.
    const first = await attemptFreeze(c, a, { versionId, expectedDraftVersion: 1 });
    expect(first.updated).toBe(1);
    const second = await attemptFreeze(c, a, { versionId, expectedDraftVersion: 1 });
    expect(second.updated).toBe(0);
  });

  it("REFUSES a change to identity, lineage, scope or provenance, even in a draft", async () => {
    const { versionId } = await seedDraftAct(c, a);
    for (const [column, value] of [
      ["version_no", "9"], ["statutory_act_id", `'${randomUUID()}'::uuid`],
      ["work_item_id", `'${randomUUID()}'::uuid`], ["composed_by_member_id", `'${randomUUID()}'::uuid`],
      ["idempotency_key", "'another-key'"], ["request_hash", `'${"b".repeat(64)}'`],
    ] as const) {
      const message = await raised(() => c.query(
        `update public.statutory_act_versions
            set ${column} = ${value}, draft_version = draft_version + 1 where id = $1`,
        [versionId]));
      expect(message, column).toContain("are fixed at composition");
    }
  });

  it("REFUSES the freeze of an act that would claim a registry check in the future", async () => {
    // An act that claims it was checked against the Реєстр будівельних норм on a
    // date that has not happened is a FALSE REGULATORY CLAIM printed inside a
    // mandatory disclaimer. One day of slack is a timezone allowance and not a
    // business rule, so the probe is well past it.
    const actId = await insertAct(c, a);
    const versionId = await insertVersion(c, a, {
      statutoryActId: actId, registryCheckedOn: "2099-01-01",
    });
    await c.query(SIGNATORY_INSERT, signatoryParams(a, { versionId, slot: "builder" }));
    await c.query(SIGNATORY_INSERT,
      signatoryParams(a, { versionId, slot: "technical_supervision" }));
    const out = await attemptFreeze(c, a, { versionId });
    expect(out.error).toContain("Реєстр будівельних норм");
    expect((await versionRow(versionId)).status).toBe("draft");
  });

  it("REFUSES the freeze of an act missing a signatory slot п. 8.4.3.5 requires", async () => {
    // The deferred completeness trigger. It fires at COMMIT because the freeze
    // UPDATE and the last signatory INSERT are one transaction and the route may
    // write them in either order.
    const actId = await insertAct(c, a);
    const versionId = await insertVersion(c, a, { statutoryActId: actId });
    await c.query(SIGNATORY_INSERT, signatoryParams(a, { versionId, slot: "builder" }));
    const out = await attemptFreeze(c, a, { versionId });
    expect(out.error).toContain("technical_supervision");
    expect(out.error).toContain("8.4.3.5");
    expect((await versionRow(versionId)).status).toBe("draft");
  });

  it("does NOT require авторський нагляд, and that is the open question", async () => {
    // schema-v0.1.sql:1656-1657 makes the third slot optional; п. 8.4.3.5 names
    // three roles and NO document in this package says the third is conditional.
    // Migration 0047 §11 item 8 records the question. This asserts the shape the
    // answer will change, so it fails when the answer arrives.
    const { versionId } = await frozenAct();
    const slots = await c.query<{ slot: string }>(
      `select slot from public.statutory_act_version_signatories
        where statutory_act_version_id = $1 order by slot`, [versionId]);
    expect(slots.rows.map((r) => r.slot)).toEqual(["builder", "technical_supervision"]);
  });

  it("REFUSES the freeze to an actor without statutory_acts.compose", async () => {
    // The deferred trigger is SECURITY DEFINER and authorizes FIRST, before it
    // counts anything (0017:78-81), so it is not an oracle for a project the
    // caller does not already hold.
    const { versionId } = await seedDraftAct(c, a);
    const out = await attemptFreeze(c, a, { versionId, actorUserId: USER_B });
    expect(out.error).toContain("not authorized");
    expect((await versionRow(versionId)).status).toBe("draft");
  });
});

describe("the content of a frozen version is frozen with it", () => {
  it("REFUSES an inserted, updated or deleted quantity line on a frozen version", async () => {
    const { versionId } = await frozenAct();
    const insert = await raised(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, lineNo: 2, share: "0.250000", printedQuantity: "2.500",
    })));
    expect(insert).toContain("is frozen");
    expect(insert).toContain("INV-015");

    expect(await raised(() => c.query(
      `update public.statutory_act_version_quantities set line_no = 7
        where statutory_act_version_id = $1`, [versionId]))).toContain("is frozen");
    expect(await raised(() => c.query(
      `delete from public.statutory_act_version_quantities
        where statutory_act_version_id = $1`, [versionId]))).toContain("is frozen");
    expect(await count("statutory_act_version_quantities", WS_A)).toBe(1);
  });

  it("REFUSES a signatory added after the freeze — a snapshot that can gain one is not one", async () => {
    const { versionId } = await frozenAct();
    const message = await raised(() => c.query(SIGNATORY_INSERT, signatoryParams(a, {
      versionId, slot: "designer_supervision",
      projectPartyId: a.builderProjectPartyId, partyId: a.builderPartyId,
      partyRelationship: "general_contractor", partyContactId: a.builderContactId,
    })));
    expect(message).toContain("is frozen");
    expect(await count("statutory_act_version_signatories", WS_A)).toBe(2);
  });

  it("PERMITS both while the version is a draft — composing is iterative", async () => {
    // The positive control the guard needs: a quantity line chosen and then
    // unchosen has to be removable while the version is a draft, which is why
    // §5 and §6 are not append-only and why the guard keys on the parent's
    // STATUS rather than on its xmin.
    const { versionId } = await seedDraftAct(c, a);
    expect(await sqlstate(() => c.query(
      `delete from public.statutory_act_version_quantities
        where statutory_act_version_id = $1`, [versionId]))).toBeNull();
    expect(await sqlstate(() => c.query(QUANTITY_INSERT,
      quantityParams(a, { versionId })))).toBeNull();
    expect(await count("statutory_act_version_quantities", WS_A)).toBe(1);
  });

  it("REFUSES content whose parent version is invisible", async () => {
    // Not SECURITY DEFINER, deliberately (0042:288-291): the guard reads under
    // the mutating role, so a hidden parent raises rather than proceeding on a
    // NULL.
    const message = await raised(() => c.query(QUANTITY_INSERT,
      quantityParams(a, { versionId: randomUUID() })));
    expect(message).toContain("not visible in this workspace");
  });
});

describe("public.statutory_acts is append-only", () => {
  it("REFUSES every update and every delete of the identity row", async () => {
    const actId = await insertAct(c, a);
    expect(await raised(() => c.query(
      `update public.statutory_acts set act_form_basis = 'user_selected' where id = $1`,
      [actId]))).not.toBe("");
    expect(await raised(() => c.query(
      `delete from public.statutory_acts where id = $1`, [actId]))).not.toBe("");
    expect(await count("statutory_acts", WS_A)).toBe(1);
  });

  it("allows exactly one act per closure", async () => {
    await insertAct(c, a);
    // A second act for the same closure would be a second document asserting the
    // same event, and «a correction is a successor VERSION» is the only
    // correction this milestone has.
    expect(await sqlstate(() => c.query(ACT_INSERT, actParams(a)))).toBe("23505");
  });

  it("REFUSES an act naming a closure that does not exist", async () => {
    // There is NO RELATIONAL PATH from an unclosed stage to an act: the only
    // provenance foreign key targets public.stage_closures, and 0045 makes such
    // a row storable only when can_close_stage held over the stage's complete
    // frozen obligation set. The route's own refusal is a sentence on top of
    // this, not instead of it.
    expect(await sqlstate(() => c.query(ACT_INSERT,
      actParams(a, { stageClosureId: randomUUID() })))).toBe("23503");
  });

  it("REFUSES an act naming another workspace's closure", async () => {
    expect(await sqlstate(() => c.query(ACT_INSERT,
      actParams(a, { stageClosureId: b.stageClosureId })))).toBe("23503");
  });

  it("REFUSES form Г in v0.1, through one named constraint", async () => {
    // DEPARTURE 5: 'dodatok_g' stays in the vocabulary so v0.2 is ADDITIVE, and
    // `statutory_acts_v01_form_v_only_check` is the single named constraint that
    // slice drops. Asserted by NAME so a slice that drops the wrong one fails.
    const message = await raised(() => c.query(ACT_INSERT,
      actParams(a, { actForm: "dodatok_g" })));
    expect(message).toContain("statutory_acts_v01_form_v_only_check");
  });

  it("REFUSES form В against a stage that is not concealed", async () => {
    const message = await raised(() => c.query(ACT_INSERT,
      actParams(a, { stageIsConcealed: false })));
    expect(message).toContain("statutory_acts_concealment_check");
  });

  it("records the В/Г choice as the product's assumption and has no column for a norm", async () => {
    // PROHIBITION G. Two values, both of which say «the product chose this»,
    // and no norm-reference column anywhere on this table — so the mapping
    // cannot be recorded as a norm even by a caller that wants to.
    const cols = await c.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'statutory_acts'`);
    const names = cols.rows.map((r) => r.column_name);
    expect(names).toContain("act_form_basis");
    expect(names.filter((n) => /norm|verification|source|citation/i.test(n))).toEqual([]);
    expect(await sqlstate(() => c.query(ACT_INSERT,
      actParams(a, { actFormBasis: "norm_requires_it" })))).toBe("23514");
  });
});

describe("INV-073 storage half — a printed quantity is a share of a recorded fact", () => {
  let versionId: string;
  beforeEach(async () => {
    const actId = await insertAct(c, a);
    versionId = await insertVersion(c, a, { statutoryActId: actId });
  });

  it("stores a well-formed line — the positive control", async () => {
    expect(await sqlstate(() => c.query(QUANTITY_INSERT,
      quantityParams(a, { versionId })))).toBeNull();
  });

  it("REFUSES an entry nobody recorded", async () => {
    expect(await sqlstate(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, rootProgressEntryId: randomUUID() })))).toBe("23503");
  });

  it("REFUSES a recorded quantity that is not the entry's own", async () => {
    // (c) of the six-column key. `source_recorded_quantity` is not a caller's
    // CLAIM about the entry — it is the entry's `quantity` column, pinned by
    // key, and public.progress_entries is append-only so it cannot move after.
    expect(await sqlstate(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, sourceRecordedQuantity: "20.000000",
      printedQuantity: "10.000" })))).toBe("23503");
  });

  it("REFUSES an ADJUSTMENT — a correction is not a quantity of its own", async () => {
    // (a) of the six-column key, enforced twice: the column CHECK forces 'root'
    // before the key is ever consulted.
    expect(await sqlstate(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, sourceEntryKind: "adjustment" })))).toBe("23514");
  });

  it("REFUSES an entry recorded on another assignment or another line", async () => {
    // (b) of the six-column key. A share of another line's entry cannot be
    // printed under this act's heading.
    expect(await sqlstate(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, rootProgressEntryId: b.rootProgressEntryId })))).toBe("23503");
    expect(await sqlstate(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, workAssignmentId: a.closure.otherAssignmentId })))).toBe("23503");
  });

  it("REFUSES a unit the line does not have — there is no unit selector", async () => {
    expect(await sqlstate(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, printedUnitId: randomUUID() })))).toBe("23503");
    expect(await sqlstate(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, printedUnitPrecision: a.unitPrecision === 6 ? 5 : 6,
      printedQuantity: "5.00000" })))).toBe("23503");
  });

  it("REFUSES a NULL share, unit or recorded quantity — none of them is optional", async () => {
    for (const column of [
      "source_quantity_share", "source_recorded_quantity",
      "printed_unit_id", "printed_unit_precision", "printed_quantity",
      "root_progress_entry_id",
    ]) {
      const params = quantityParams(a, { versionId });
      const index = [
        "workspace_id", "project_id", "statutory_act_version_id", "work_assignment_id",
        "work_item_id", "root_progress_entry_id", "source_entry_kind",
        "source_recorded_quantity", "source_quantity_share", "printed_unit_id",
        "printed_unit_precision", "printed_quantity", "line_no",
      ].indexOf(column);
      expect(index, column).toBeGreaterThanOrEqual(0);
      params[index] = null;
      expect(await sqlstate(() => c.query(QUANTITY_INSERT, params)), column).toBe("23502");
    }
  });

  it("REFUSES a printed quantity larger than the entry recorded", async () => {
    const message = await raised(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, share: "1.000000", printedQuantity: "11.000" })));
    // Two constraints could catch this; the assertion names the arithmetic one
    // that would still be there if the other were relaxed.
    expect(message).toMatch(/statutory_act_version_quantities_(share|rounding)_check/);
  });

  it("REFUSES a printed quantity that is not the share of the recorded one", async () => {
    // A number that satisfies every other constraint and is simply not
    // `share × recorded`: 10 × 0.5 is 5, and this row says 3.
    expect(await raised(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, share: "0.500000", printedQuantity: "3.000" }))))
      .toContain("statutory_act_version_quantities_rounding_check");
  });

  it("REFUSES a printed quantity finer than the unit it prints in", async () => {
    expect(await raised(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, share: "0.500001", printedQuantity: "5.000010" }))))
      .toContain("statutory_act_version_quantities_precision_check");
  });

  it("REFUSES a zero printed quantity rather than printing «0.000»", async () => {
    // Deliberate, and named in 0047 §5: «an act that prints «0.000» as the
    // quantity performed is worse than an act that refuses to be composed». The
    // composer must refuse the share.
    expect(await sqlstate(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, share: "0.000001", printedQuantity: "0.000" })))).toBe("23514");
  });

  it("REFUSES a share outside (0, 1]", async () => {
    for (const share of ["0.000000", "1.500000", "-0.500000"]) {
      expect(await sqlstate(() => c.query(QUANTITY_INSERT,
        quantityParams(a, { versionId, share, printedQuantity: "5.000" }))), share)
        .toBe("23514");
    }
  });

  it("allows one line per recorded entry and no more", async () => {
    await c.query(QUANTITY_INSERT, quantityParams(a, { versionId }));
    // Two shares of one entry would reach a total the entry does not support.
    expect(await sqlstate(() => c.query(QUANTITY_INSERT, quantityParams(a, {
      versionId, share: "0.250000", printedQuantity: "2.500", lineNo: 2 })))).toBe("23505");
  });

  it("has NO COLUMN a typed quantity could go in", async () => {
    // The claim the whole table is built on: «a number a human types is not
    // storable because there is nowhere to put it — not because a validator
    // rejects it». Every numeric column is either copied from a recorded fact by
    // foreign key or bounded by one, and the census is what keeps that true when
    // a later migration adds a column.
    const cols = await c.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'statutory_act_version_quantities'`);
    expect(cols.rows.map((r) => r.column_name).sort()).toEqual([
      "created_at", "line_no", "printed_quantity", "printed_unit_id",
      "printed_unit_precision", "project_id", "root_progress_entry_id",
      "source_entry_kind", "source_quantity_share", "source_recorded_quantity",
      "statutory_act_version_id", "work_assignment_id", "work_item_id", "workspace_id",
    ]);
  });
});

describe("prohibition E as a schema — three typed slots, and no banned field", () => {
  let versionId: string;
  beforeEach(async () => {
    const actId = await insertAct(c, a);
    versionId = await insertVersion(c, a, { statutoryActId: actId });
  });

  it("REFUSES a fourth signatory SLOT", async () => {
    // hidden-works-content-rules.md §"Open items" records that a Київводоканал
    // blank reportedly carries a fourth, «two passes agree, neither fetched the
    // file». A three-value CHECK is what resists that pressure.
    for (const slot of ["customer_representative", "customer", "fourth", ""]) {
      expect(await sqlstate(() => c.query(SIGNATORY_INSERT, signatoryParams(a, {
        versionId, slot }))), slot).toBe("23514");
    }
  });

  it("REFUSES a second row for a slot that is already filled", async () => {
    await c.query(SIGNATORY_INSERT, signatoryParams(a, { versionId, slot: "builder" }));
    expect(await sqlstate(() => c.query(SIGNATORY_INSERT,
      signatoryParams(a, { versionId, slot: "builder" })))).toBe("23505");
  });

  it("has NO CERTIFICATE COLUMN, and no issuer column, on any act table", async () => {
    // Allow-list item 10 establishes that технагляд HOLDS a кваліфікаційний
    // сертифікат; whether Додаток В has a slot for its серія and номер is NOT
    // established, and prohibition E bans the adjacent «ким видана». So the act
    // has nothing to print for it EVEN IF A TEMPLATE ASKED, which is a stronger
    // guarantee than a renderer that chooses not to print one.
    const cols = await c.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and table_name = any($1::text[])`,
      [[...ACT_TABLES]]);
    expect(cols.rows.length).toBeGreaterThan(0);
    for (const { table_name, column_name } of cols.rows) {
      expect(column_name, `${table_name}.${column_name}`).not.toMatch(
        /certificat|qualification|issuer|issued_by|passport|sheet_no|stamp|seal|cipher|act_no/i);
    }
  });

  it("stores no signature, no assurance label and no signed_at", async () => {
    // In v0.1 a signatory slot is a TYPED SLOT on a document printed and signed
    // ELSEWHERE. Prohibition S is a render rule and stays one precisely because
    // this table stores no rendered word to mislabel — and that is only true
    // while the enumeration below is closed.
    const cols = await c.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public'
          and table_name = 'statutory_act_version_signatories'`);
    expect(cols.rows.map((r) => r.column_name).sort()).toEqual([
      "created_at", "frozen_organization_name", "frozen_organization_name_source",
      "frozen_person_name", "frozen_person_role_title", "party_contact_id", "party_id",
      "party_relationship", "project_id", "project_party_id", "slot",
      "source_contact_version", "source_party_version", "statutory_act_version_id",
      "workspace_id",
    ]);
  });

  it("REFUSES a slot filled by a participant whose project role does not match", async () => {
    // THE PRODUCT'S ASSUMPTION, ENFORCED AND NAMED AS AN ASSUMPTION. No source
    // maps п. 8.4.3.5's three roles onto this database's seven relationship
    // values; a pilot that needs another mapping changes THIS constraint and
    // records why, rather than discovering that the technical-supervision slot
    // was filled by the customer.
    const message = await raised(() => c.query(SIGNATORY_INSERT, signatoryParams(a, {
      versionId, slot: "technical_supervision",
      projectPartyId: a.customerProjectPartyId, partyId: a.customerPartyId,
      partyRelationship: "customer", partyContactId: a.customerContactId })));
    expect(message).toContain("statutory_act_version_signatories_slot_role_assumption_check");
  });

  it("REFUSES a relationship the act restates differently from the project record", async () => {
    // The party key carries `relationship`, so an act cannot invent a
    // participant the project record does not carry and cannot restate its role.
    expect(await sqlstate(() => c.query(SIGNATORY_INSERT, signatoryParams(a, {
      versionId, slot: "builder", partyRelationship: "subcontractor" })))).toBe("23503");
  });

  it("REFUSES a person who is not a contact of that participant", async () => {
    expect(await sqlstate(() => c.query(SIGNATORY_INSERT, signatoryParams(a, {
      versionId, slot: "builder", partyContactId: a.supervisionContactId })))).toBe("23503");
  });

  it("REFUSES a participant of another project", async () => {
    expect(await sqlstate(() => c.query(SIGNATORY_INSERT, signatoryParams(a, {
      versionId, slot: "builder",
      projectPartyId: b.builderProjectPartyId, partyId: b.builderPartyId,
      partyContactId: b.builderContactId })))).toBe("23503");
  });

  it("REFUSES an invented source for the frozen organisation name", async () => {
    // A frozen string that says which record it came from is auditable; a frozen
    // string with a free-text provenance is a second place to write anything.
    expect(await raised(() => c.query(SIGNATORY_INSERT, signatoryParams(a, {
      versionId, slot: "builder", frozenOrganizationNameSource: "typed_by_composer" }))))
      .toContain("statutory_act_version_signatories_org_name_source_check");
  });

  it("permits a NULL посада, because public.party_contacts.role_title is nullable", async () => {
    // No constraint here may make a field mandatory that the form is not
    // established to have.
    expect(await sqlstate(() => c.query(SIGNATORY_INSERT, signatoryParams(a, {
      versionId, slot: "builder", frozenPersonRoleTitle: null })))).toBeNull();
  });
});

describe("INV-073 storage half — the form citation travels with its tag and its source", () => {
  it("REFUSES a citation with no source, no tag, or a blank text", async () => {
    const actId = await insertAct(c, a);
    expect(await sqlstate(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, formCitationSource: null })))).toBe("23502");
    expect(await sqlstate(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, formCitation: "   " })))).toBe("23514");
    expect(await sqlstate(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, formCitationSource: "  " })))).toBe("23514");
  });

  it("REFUSES an UNVERIFIED tag on a document that is nothing but normative form", async () => {
    // hidden-works-content-rules.md §"Verification vocabulary": UNVERIFIED «must
    // never be shown as normative», so it has no business being storable here.
    const actId = await insertAct(c, a);
    expect(await sqlstate(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, formCitationVerification: "UNVERIFIED" })))).toBe("23514");
    expect(await sqlstate(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, formCitationVerification: "VERIFIED_SECONDARY" })))).toBeNull();
  });

  it("stores the citation and NO other string of the form", async () => {
    // Every other string of Додаток В is TEMPLATE content pinned by key, version
    // and hash. Storing them as columns would name fields of the form: «a column
    // is a field, and a field nobody sourced is a field somebody will fill».
    const cols = await c.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'statutory_act_versions'`);
    const names = cols.rows.map((r) => r.column_name);
    expect(names).toContain("form_citation");
    expect(names).toContain("form_template_key");
    expect(names).toContain("form_template_hash");
    // No title column, no footer column, no resolution-block column: those are
    // the three that would each be a field of Додаток В.
    expect(names.filter((n) => /title|footer|disclaimer|caption|resolution|heading/i.test(n)))
      .toEqual([]);
    const stored = await c.query<{ form_citation: string }>(
      `select form_citation from public.statutory_act_versions
        where id = $1`, [(await seedDraftAct(c, a)).versionId]);
    expect(stored.rows[0]!.form_citation).toBe(FORM_CITATION);
  });
});

describe("the version lineage is contiguous, unforked and single-drafted", () => {
  it("REFUSES a successor with no predecessor, and a first version with one", async () => {
    // ONE act for both halves: `statutory_acts_closure_key` allows exactly one
    // act identity per closure, so a second `insertAct` would fail as a
    // duplicate and neither assertion would reach the constraint it names.
    const { actId, versionId } = await frozenAct();
    expect(await raised(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, versionNo: 2 }))))
      .toContain("statutory_act_versions_chain_check");
    // A CHECK is evaluated before the index, so what answers here is the chain
    // check and not the lineage key on (act, version_no).
    expect(await raised(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, versionNo: 1,
      predecessorVersionId: versionId, predecessorVersionNo: 0,
      predecessorStatus: "frozen", correctionReason: "Приклад-виправлення" }))))
      .toContain("statutory_act_versions_chain_check");
  });

  it("REFUSES a successor of a version that is still a draft", async () => {
    const actId = await insertAct(c, a);
    const draft = await insertVersion(c, a, { statutoryActId: actId });
    const successor = versionParams(a, {
      statutoryActId: actId, versionNo: 2, predecessorVersionId: draft,
      predecessorVersionNo: 1, predecessorStatus: "frozen",
      correctionReason: "Приклад-виправлення" });

    // WHICH LAYER ANSWERS, AND WHY IT CANNOT BE THE FOREIGN KEY THIS CASE USED
    // TO NAME. The chain foreign key does pin the predecessor's status to
    // 'frozen' — that part of the old comment was right — but it is unreachable
    // by this route, and not by accident:
    //
    //   * `statutory_act_versions_chain_check` forces predecessor_status =
    //     'frozen' for every version_no > 1, so a successor cannot even CLAIM a
    //     draft predecessor; and
    //   * a predecessor that is still a draft means the act HAS an open draft,
    //     so the new row — itself born draft — collides with
    //     `statutory_act_versions_single_draft_uniq` first.
    //
    // Postgres inserts index entries during the row insert and checks foreign
    // keys as after-row triggers, so the partial unique index always answers
    // before the chain key. The refusal is real either way; 23503 was the wrong
    // name for it.
    expect(await sqlstate(() => c.query(VERSION_INSERT, successor))).toBe("23505");

    // AND THE FOREIGN KEY IS STILL THERE. Asserting only the index above would
    // pass against a database that had lost the chain key entirely, which is
    // the failure mode m1-rules-schema.test.ts:28-30 warns about — one layer
    // hiding the absence of another. The index is dropped inside a transaction
    // that is then rolled back, so the same insert reaches the key it could not
    // reach a moment ago and the schema is unchanged afterwards.
    await c.query("begin");
    try {
      await c.query("drop index public.statutory_act_versions_single_draft_uniq");
      expect(await sqlstate(() => c.query(VERSION_INSERT, successor)),
        "with the single-draft index out of the way, the chain key must answer")
        .toBe("23503");
    } finally {
      await c.query("rollback");
    }

    const restored = await c.query<{ n: number }>(
      `select count(*)::int as n from pg_class
        where relname = 'statutory_act_versions_single_draft_uniq'`);
    expect(restored.rows[0]!.n, "the rollback must put the index back").toBe(1);
  });

  it("REFUSES a correction that gives no reason", async () => {
    const { actId, versionId } = await frozenAct();
    expect(await raised(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, versionNo: 2, predecessorVersionId: versionId,
      predecessorVersionNo: 1, predecessorStatus: "frozen", correctionReason: null }))))
      .toContain("statutory_act_versions_correction_reason_check");
  });

  it("REFUSES a second draft of one act, and a fork behind one predecessor", async () => {
    const { actId, versionId } = await frozenAct();
    expect(await sqlstate(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, versionNo: 2, predecessorVersionId: versionId,
      predecessorVersionNo: 1, predecessorStatus: "frozen",
      correctionReason: "Приклад-виправлення" })))).toBeNull();
    // A second OPEN draft: two candidate documents for one event, either of
    // which could be frozen first.
    expect(await sqlstate(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, versionNo: 3, predecessorVersionId: versionId,
      predecessorVersionNo: 2, predecessorStatus: "frozen",
      correctionReason: "Приклад-друге виправлення" })))).toBe("23505");
  });

  it("REFUSES a draft carrying freeze facts, and a frozen row missing one", async () => {
    const actId = await insertAct(c, a);
    // Without `statutory_act_versions_draft_clean_check` a draft could be
    // written with a content_hash and read as frozen by anything that trusts the
    // columns rather than the status.
    expect(await raised(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, contentHash: HEX64 }))))
      .toContain("statutory_act_versions_draft_clean_check");
    expect(await raised(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, status: "frozen", frozenAt: "2026-08-06T10:00:00Z",
      frozenByMemberId: a.rules.memberId, contentHash: HEX64,
      formTemplateHash: HEX64 }))))
      .toContain("statutory_act_versions_frozen_complete_check");
    expect(await raised(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, status: "frozen", frozenAt: "2026-08-06T10:00:00Z",
      frozenByMemberId: a.rules.memberId, contentHash: HEX64, rendererVersion: "r",
      formTemplateHash: HEX64, registryCheckedOn: null })))
    ).toContain("statutory_act_versions_frozen_complete_check");
  });

  it("REFUSES a frozen act with no pinned project name, and a draft that has one", async () => {
    // MIGRATION 0056. `public.projects` takes an UPDATE from any project.admin
    // at any time — no trigger, no status, no terminal state — so a frozen act
    // that read its project's name LIVE would be destroyed by an ordinary
    // rename: `content_hash` was pinned over the old string and the render
    // refuses with `frozen_content_hash_divergence` for ever after. The column
    // is the fix and this pair of CHECKs is what makes it unavoidable, in both
    // directions.
    const actId = await insertAct(c, a);
    const frozenSeed = {
      statutoryActId: actId, status: "frozen", frozenAt: "2026-08-06T10:00:00Z",
      frozenByMemberId: a.rules.memberId, contentHash: HEX64, rendererVersion: "r",
      formTemplateHash: HEX64,
    } as const;

    // A frozen act with every other freeze fact and no pinned name.
    expect(await raised(() => c.query(VERSION_INSERT, versionParams(a, {
      ...frozenSeed, frozenProjectName: null }))))
      .toContain("statutory_act_versions_frozen_complete_check");
    // …and one with the name but no version behind it: a frozen string whose
    // provenance is missing is a claim with no record.
    expect(await raised(() => c.query(VERSION_INSERT, versionParams(a, {
      ...frozenSeed, sourceProjectVersion: null }))))
      .toContain("statutory_act_versions_frozen_complete_check");

    // THE OTHER DIRECTION. A draft carrying a pinned name would read as frozen
    // to anything that trusts the columns rather than the status — the same
    // failure `content_hash` on a draft would be.
    expect(await raised(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, frozenProjectName: "Приклад-передчасно зафіксований" }))))
      .toContain("statutory_act_versions_draft_clean_check");
    expect(await raised(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, sourceProjectVersion: 1 }))))
      .toContain("statutory_act_versions_draft_clean_check");
    expect(await raised(() => c.query(VERSION_INSERT, versionParams(a, {
      statutoryActId: actId, frozenProjectAddress: "Приклад-адреса" }))))
      .toContain("statutory_act_versions_draft_clean_check");

    // AN ADDRESS IS NOT REQUIRED OF A FROZEN ACT, and that is deliberate:
    // `public.projects.address` is nullable, so an absent address is a fact
    // about the project and not an incomplete freeze.
    expect(await sqlstate(() => c.query(VERSION_INSERT, versionParams(a, {
      ...frozenSeed, frozenProjectAddress: null })))).toBeNull();
  });

  it("REFUSES a content hash or a template hash that is not 64 lowercase hex", async () => {
    const actId = await insertAct(c, a);
    for (const bad of ["ZZ", "A".repeat(64), `${HEX64}0`]) {
      expect(await sqlstate(() => c.query(VERSION_INSERT, versionParams(a, {
        statutoryActId: actId, status: "frozen", frozenAt: "2026-08-06T10:00:00Z",
        frozenByMemberId: a.rules.memberId, contentHash: bad, rendererVersion: "r",
        formTemplateHash: HEX64 }))), bad).toBe("23514");
    }
  });
});

describe("grants — route by route, so an unused grant is visible", () => {
  it("gives aktflow_app no UPDATE or DELETE on the identity row, and no DELETE on versions", async () => {
    const grants = await c.query<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and grantee = 'aktflow_app'
          and table_name = any($1::text[])`, [[...ACT_TABLES]]);
    const held = new Set(grants.rows.map((r) => `${r.table_name}:${r.privilege_type}`));
    expect(held.has("statutory_acts:SELECT")).toBe(true);
    expect(held.has("statutory_acts:INSERT")).toBe(true);
    expect(held.has("statutory_acts:UPDATE")).toBe(false);
    expect(held.has("statutory_acts:DELETE")).toBe(false);
    expect(held.has("statutory_act_versions:UPDATE")).toBe(true);
    // The grant that would let a frozen version disappear if the guard were
    // ever lost.
    expect(held.has("statutory_act_versions:DELETE")).toBe(false);
    for (const t of ["statutory_act_version_quantities", "statutory_act_version_signatories"]) {
      for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        expect(held.has(`${t}:${p}`), `${t}:${p}`).toBe(true);
      }
    }
  });

  it("gives aktflow_service nothing at all", async () => {
    // event-catalog.csv:28 names projection_rebuilder as the consumer of
    // `statutory_act_version.frozen`, and a projection rebuilder READS these
    // tables through aktflow_app membership. Nothing about an act is WRITTEN by
    // a worker in v0.1.
    const grants = await c.query<{ table_name: string }>(
      `select table_name from information_schema.role_table_grants
        where table_schema = 'public' and grantee = 'aktflow_service'
          and table_name = any($1::text[])`, [[...ACT_TABLES]]);
    expect(grants.rows).toEqual([]);
  });

  it("enables row level security on all four tables", async () => {
    const rls = await c.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
        where relnamespace = 'public'::regnamespace and relname = any($1::text[])`,
      [[...ACT_TABLES]]);
    expect(rls.rows).toHaveLength(ACT_TABLES.length);
    for (const r of rls.rows) expect(r.relrowsecurity, r.relname).toBe(true);
  });
});
