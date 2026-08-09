import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq, baselineFixture, type BaselineFixture } from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, patchLine, publishRuleVersion,
  publishVersion, removeLine, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. It was written with no node_modules,
 * no database and no docker available: `vitest`, `tsc`, `psql` and `supabase`
 * were never run against it, no route was invoked, no migration was applied,
 * and no claim is made that any assertion below passes. Static reading is the
 * only check that was available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M1, ADR-006 decision 2: ПТВ types the baseline by hand. The three
 * `work_items` operations SUCCEED while the contract version is a draft and are
 * REFUSED once it is published (INV-015).
 *
 * MANUAL ENTRY IS A FIRST-CLASS CAPABILITY, NOT A STOPGAP. The assertions below
 * hold a typed line to the same standard as an imported one: the same
 * derivation, the same INV-038 and INV-054 refusals, the same view.
 *
 * THE REFUSAL IS ASSERTED AT BOTH LAYERS. The route turns it into a catalogued
 * problem+json the caller can act on; app.guard_work_item() (migration 0042 §3)
 * makes it impossible in the database, so a future route that forgot the check
 * would still fail rather than corrupt a published baseline. Neither layer is
 * decorative, and a test that probed only one of them would let the other be
 * deleted.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

/**
 * The line every test starts from. 10 м2 at 199,99 under an exclusive contract
 * at 2000 bps: net 199 990, tax 39 998, gross 239 988 minor units.
 */
const LINE = {
  sourceKey: "1.1",
  workCode: "Е8-1-1",
  description: "Мурування зовнішніх стін",
  unitCode: "м2",
  contractQuantity: "10",
  unitPriceState: "known" as const,
  unitPrice: "199.99",
};

/**
 * The same line, carrying the work type the bound rule version carries.
 *
 * Since migration 0050 the work type is the left-hand side of the
 * materialisation predicate, so a baseline whose lines have none intersects no
 * binding and `contract_versions.publish` answers 409 RULE_BINDING_REQUIRED.
 * Every path in this file that actually PUBLISHES needs this one.
 *
 * Bare `LINE` is kept, and deliberately: the audit cases below assert
 * `workTypeKeyPresent: false` on work_items.create, and they can only do that
 * with a line that genuinely carries no work type.
 */
const TYPED_LINE = {
  ...LINE, workTypeKey: "montazh-elektrotekhnichnykh-ustanovok",
};

let fx: BaselineFixture;
let library: Map<string, string>;

interface Draft { versionId: string; versionNo: number; workItemId: string }

async function publishedRuleVersionId(over: Record<string, unknown> = {}): Promise<string> {
  const item = library.get("Н.15/1");
  if (!item) throw new Error("manual-baseline: the library fixture seeded no Н.15/1");
  const res = await publishRuleVersion(fx.workspaceId, ruleVersionBody(item, over));
  if (res.status !== 201) {
    throw new Error(`requirement_rule_versions.publish returned ${res.status} ${await res.text()}`);
  }
  return (await res.json()).ruleVersionId as string;
}

async function draftWithLine(): Promise<Draft> {
  const created = await createDraft(fx.contractId);
  if (created.status !== 201) {
    throw new Error(`contract_versions.create returned ${created.status} ${await created.text()}`);
  }
  const { contractVersionId, versionNo } = await created.json();
  const line = await addLine(contractVersionId, TYPED_LINE);
  if (line.status !== 201) {
    throw new Error(`work_items.create returned ${line.status} ${await line.text()}`);
  }
  const body = await line.json();
  return { versionId: contractVersionId, versionNo, workItemId: body.workItem.workItemId };
}

/** A draft carried all the way to `published` through the real route set. */
async function publishedVersion(): Promise<Draft> {
  const draft = await draftWithLine();
  const bound = await bindRules(draft.versionId, [await publishedRuleVersionId()]);
  if (bound.status !== 201) {
    throw new Error(`bind_rules returned ${bound.status} ${await bound.text()}`);
  }
  const view = await (await getVersion(fx.contractId, draft.versionNo)).json();
  const res = await publishVersion(draft.versionId, manifestOf(view));
  if (res.status !== 201) {
    throw new Error(`contract_versions.publish returned ${res.status} ${await res.text()}`);
  }
  return draft;
}

beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await baselineFixture(A);
  // baselineFixture grants contracts.edit / imports.manage / imports.publish;
  // binding is its own capability (migration 0041 §4 widens the CHECK by it).
  const { POST: grant } = await import("../app/v1/projects/[projectId]/access-grants/route");
  await grant(jsonReq("http://x", { memberId: fx.memberId, capabilities: ["rule_bindings.manage"] }),
    { params: Promise.resolve({ projectId: fx.projectId }) });
  // Nothing in the product seeds these yet — see the helper's own note.
  library = await seedRequirementLibrary(fx.workspaceId);
});

describe("work_items.create succeeds on a draft", () => {
  it("stores the line and derives its money from the version's pins", async () => {
    const created = await createDraft(fx.contractId);
    expect(created.status).toBe(201);
    const { contractVersionId } = await created.json();

    const res = await addLine(contractVersionId, LINE);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.workItemCount).toBe(1);
    expect(body.workItem.position).toBe(1);
    expect(body.workItem.netMinor).toBe("199990");
    expect(body.workItem.taxMinor).toBe("39998");
    expect(body.workItem.grossMinor).toBe("239988");
    // The pins come from the VERSION, not from the contract, so a later edit of
    // the contract cannot move a number under an open draft.
    expect(body.workItem.valuationBasis).toBe("unit_price_derived");

    const rows = await q<{
      net_amount_minor_units: string; unit_code: string; unit_precision: number;
      contract_quantity: string; source_row_result_id: string | null;
    }>(`select net_amount_minor_units::text, unit_code, unit_precision,
               contract_quantity::text, source_row_result_id
          from public.work_items where id = $1`, [body.workItem.workItemId]);
    expect(rows[0]!.net_amount_minor_units).toBe("199990");
    expect(rows[0]!.unit_code).toBe("м2");
    // The quantity is pinned to the UNIT's precision, and the response returns
    // the stored value — so the typist sees the number that was stored, not the
    // number that was typed.
    expect(Number(rows[0]!.contract_quantity)).toBe(10);
    // A typed line carries no import provenance, and inventing one would make
    // the two paths distinguishable in the wrong direction.
    expect(rows[0]!.source_row_result_id).toBeNull();
  });

  it("numbers positions max+1 within the version", async () => {
    const { contractVersionId } = await (await createDraft(fx.contractId)).json();
    const first = await (await addLine(contractVersionId, LINE)).json();
    const second = await (await addLine(contractVersionId, { ...LINE, sourceKey: "1.2" })).json();
    expect(first.workItem.position).toBe(1);
    expect(second.workItem.position).toBe(2);
    expect(second.workItemCount).toBe(2);
  });

  it("keeps a missing price and a zero price different (INV-038)", async () => {
    const { contractVersionId } = await (await createDraft(fx.contractId)).json();
    // 'known' with a zero price is two spellings of one fact, so it is refused.
    expect((await addLine(contractVersionId,
      { ...LINE, unitPriceState: "known", unitPrice: "0.00" })).status).toBe(422);
    // 'zero' with a price is the same confusion from the other side.
    expect((await addLine(contractVersionId,
      { ...LINE, unitPriceState: "zero", unitPrice: "1.00" })).status).toBe(422);

    const zero = await addLine(contractVersionId, {
      ...LINE, sourceKey: "1.3", unitPriceState: "zero", unitPrice: undefined,
    });
    expect(zero.status).toBe(201);
    const missing = await addLine(contractVersionId, {
      ...LINE, sourceKey: "1.4", unitPriceState: "missing", unitPrice: undefined,
    });
    expect(missing.status).toBe(201);
    // Both are worth nothing in the pool, and only the STATE distinguishes «the
    // кошторис prices this at nothing» from «the кошторис does not price this»
    // — which is what keeps an unvalued line out of the value-at-risk sum.
    expect((await zero.json()).workItem.netMinor).toBe("0");
    expect((await missing.json()).workItem.netMinor).toBe("0");
  });

  it("refuses a source amount outside the contract's pinned tolerance (INV-054)", async () => {
    const { contractVersionId } = await (await createDraft(fx.contractId)).json();
    const res = await addLine(contractVersionId, { ...LINE, sourceAmountMinor: "999999" });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDATION_FAILED");

    // A typed line has no import row result, so there is nowhere to record the
    // approval a resolution would need; the refusal is the whole remedy and no
    // half-written row may survive it.
    const rows = await q<{ n: string }>(
      `select count(*) n from public.work_items where contract_version_id = $1`,
      [contractVersionId]);
    expect(rows[0]!.n).toBe("0");
  });

  it("refuses an amount with no price to compare it against", async () => {
    const { contractVersionId } = await (await createDraft(fx.contractId)).json();
    const res = await addLine(contractVersionId, {
      ...LINE, unitPriceState: "missing", unitPrice: undefined, sourceAmountMinor: "199990",
    });
    expect(res.status).toBe(422);
  });

  it("records an audit row naming the line it created", async () => {
    const draft = await draftWithLine();
    const rows = await q<{ n: string }>(
      `select count(*) n from public.audit_events
        where action = 'work_item.created' and object_id = $1`, [draft.workItemId]);
    expect(rows[0]!.n).toBe("1");
  });

  it("records WHETHER the line was classified, in both directions", async () => {
    // The work type decides which obligations the line will ever carry: an
    // unclassified line materialises no occurrence, closes every stage
    // vacuously, and is frozen there the moment the version is published. Until
    // this assertion existed the audit row said position and unit and nothing
    // about the field the consequence turns on.
    //
    // A BOOLEAN, NOT THE KEY — the same field_codes_no_values restraint
    // work_item.corrected applies to its `fields`. Asserted as the WHOLE key
    // set so that a field VALUE added later is visible here.
    const untyped = await draftWithLine();
    const a = await q<{ details: Record<string, unknown> }>(
      `select details from public.audit_events
        where action = 'work_item.created' and object_id = $1`, [untyped.workItemId]);
    expect(a[0]!.details.workTypeKeyPresent).toBe(false);
    expect(Object.keys(a[0]!.details).sort())
      .toEqual(["contractVersionId", "position", "unitCode", "workTypeKeyPresent"]);

    // A key can only be typed once the workspace publishes a rule version
    // carrying it — app.work_type_key_is_bindable, migration 0050 §4.
    const { contractVersionId } = await (await createDraft(fx.contractId)).json();
    await publishedRuleVersionId();
    const typed = await addLine(contractVersionId,
      { ...LINE, workTypeKey: "montazh-elektrotekhnichnykh-ustanovok" });
    expect(typed.status).toBe(201);
    const typedId = (await typed.json()).workItem.workItemId;
    const b = await q<{ details: Record<string, unknown> }>(
      `select details from public.audit_events
        where action = 'work_item.created' and object_id = $1`, [typedId]);
    expect(b[0]!.details.workTypeKeyPresent).toBe(true);
  });
});

describe("work_items.update succeeds on a draft", () => {
  it("corrects the wording and re-derives the money under the same pins", async () => {
    const draft = await draftWithLine();
    const res = await patchLine(draft.workItemId, {
      description: "Мурування внутрішніх стін",
      contractQuantity: "20",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workItem.description).toBe("Мурування внутрішніх стін");
    // 20 × 199,99 = 3 999,80.
    expect(body.workItem.netMinor).toBe("399980");
    expect(body.workItem.taxMinor).toBe("79996");
    expect(body.workItem.grossMinor).toBe("479976");
    expect(body.workItemCount).toBe(1);
  });

  it("clears a field on null and leaves an absent field alone", async () => {
    // The distinction is the whole reason the correction is a PATCH: without it
    // there is no way to remove a work code that was typed by mistake.
    const draft = await draftWithLine();
    const res = await patchLine(draft.workItemId, { workCode: null });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workItem.workCode).toBeNull();
    expect(body.workItem.sourceKey).toBe("1.1");
    expect(body.workItem.description).toBe(LINE.description);
  });

  it("refuses an empty patch, and a price without its state", async () => {
    const draft = await draftWithLine();
    expect((await patchLine(draft.workItemId, {})).status).toBe(422);
    // The price and its state are one fact under one CHECK, so sending one
    // would ask the command to guess which half of the rule was meant.
    expect((await patchLine(draft.workItemId, { unitPrice: "1.00" })).status).toBe(422);
  });

  it("records field NAMES in the audit detail and no values", async () => {
    // technical/error-catalog.csv's log policy for a validation failure is
    // field_codes_no_values, and a quantity is commercial content: the same
    // restraint applies to an audit detail.
    const draft = await draftWithLine();
    await patchLine(draft.workItemId, { contractQuantity: "20", description: "Інша назва" });
    const rows = await q<{ details: Record<string, unknown> }>(
      `select details from public.audit_events
        where action = 'work_item.corrected' and object_id = $1`, [draft.workItemId]);
    expect(rows[0]!.details.fields).toEqual(["contractQuantity", "description"]);
    // Stated as the WHOLE key set rather than as "does not contain the value":
    // a substring check against a uuid is a coin toss, and enumerating the keys
    // is what makes a field VALUE added later visible here.
    //
    // The key set gained two BOOLEANS on 2026-08-08 and that is the tripwire
    // working as intended, not being loosened: neither carries a value, and
    // both answer a question `fields` cannot — see the next test.
    expect(Object.keys(rows[0]!.details).sort())
      .toEqual(["contractVersionId", "fields", "workTypeKeyChanged", "workTypeKeyCleared"]);
    // This correction did not touch the work type.
    expect(rows[0]!.details.workTypeKeyChanged).toBe(false);
    expect(rows[0]!.details.workTypeKeyCleared).toBe(false);
  });

  it("records that a correction REMOVED the line's obligations, which the field names cannot", async () => {
    // `fields` says "workTypeKey" for a key set, a key changed and a key
    // cleared alike — three transitions with three different consequences, and
    // the cleared one empties the obligation set. It is also how a draft slips
    // past RULE_BINDING_REQUIRED at publication, so it is the transition a
    // dispute would turn on, and the version is immutable afterwards.
    const { contractVersionId } = await (await createDraft(fx.contractId)).json();
    await publishedRuleVersionId();
    const created = await addLine(contractVersionId,
      { ...LINE, workTypeKey: "montazh-elektrotekhnichnykh-ustanovok" });
    expect(created.status).toBe(201);
    const workItemId = (await created.json()).workItem.workItemId;

    const cleared = await patchLine(workItemId, { workTypeKey: null });
    expect(cleared.status).toBe(200);
    expect((await cleared.json()).workItem.workTypeKey).toBeNull();

    const rows = await q<{ details: Record<string, unknown> }>(
      `select details from public.audit_events
        where action = 'work_item.corrected' and object_id = $1`, [workItemId]);
    expect(rows[0]!.details.workTypeKeyChanged).toBe(true);
    expect(rows[0]!.details.workTypeKeyCleared).toBe(true);
    // Still no value: the key itself never enters the audit detail.
    expect(Object.keys(rows[0]!.details).sort())
      .toEqual(["contractVersionId", "fields", "workTypeKeyChanged", "workTypeKeyCleared"]);
  });

  it("does not report a clearing when the key is merely resent unchanged", async () => {
    // `workTypeKeyChanged` is a comparison against the STORED key, not a test
    // for the field's presence in the body. A caller that resends the same key
    // changed nothing, and an audit row that said otherwise would put a
    // transition in the record that never happened.
    const { contractVersionId } = await (await createDraft(fx.contractId)).json();
    await publishedRuleVersionId();
    const created = await addLine(contractVersionId,
      { ...LINE, workTypeKey: "montazh-elektrotekhnichnykh-ustanovok" });
    const workItemId = (await created.json()).workItem.workItemId;

    const res = await patchLine(workItemId,
      { workTypeKey: "montazh-elektrotekhnichnykh-ustanovok" });
    expect(res.status).toBe(200);
    const rows = await q<{ details: Record<string, unknown> }>(
      `select details from public.audit_events
        where action = 'work_item.corrected' and object_id = $1`, [workItemId]);
    expect(rows[0]!.details.fields).toEqual(["workTypeKey"]);
    expect(rows[0]!.details.workTypeKeyChanged).toBe(false);
    expect(rows[0]!.details.workTypeKeyCleared).toBe(false);
  });
});

describe("work_items.remove succeeds on a draft", () => {
  it("removes the line and reports the new count", async () => {
    const { contractVersionId } = await (await createDraft(fx.contractId)).json();
    const first = await (await addLine(contractVersionId, LINE)).json();
    await addLine(contractVersionId, { ...LINE, sourceKey: "1.2" });

    const res = await removeLine(first.workItem.workItemId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workItemId).toBe(first.workItem.workItemId);
    expect(body.workItemCount).toBe(1);

    const rows = await q<{ n: string }>(
      `select count(*) n from public.work_items where id = $1`, [first.workItem.workItemId]);
    expect(rows[0]!.n).toBe("0");
  });

  it("leaves a gap in the positions, and publication closes it", async () => {
    // Renumbering a permutation inside unique (workspace_id,
    // contract_version_id, position) is not safe in one statement, so removal
    // does not close up. What IS required is that a PUBLISHED hand-typed
    // baseline reads 1..N exactly as an imported one does — the M1 exit gate is
    // that the two are indistinguishable, and an act numbered 1, 2, 4 is
    // distinguishable at a glance.
    const { contractVersionId, versionNo } = await (await createDraft(fx.contractId)).json();
    const one = await (await addLine(contractVersionId, TYPED_LINE)).json();
    await addLine(contractVersionId, { ...TYPED_LINE, sourceKey: "1.2" });
    await addLine(contractVersionId, { ...TYPED_LINE, sourceKey: "1.3" });
    await removeLine(one.workItem.workItemId);

    const gapped = await q<{ position: number }>(
      `select position from public.work_items where contract_version_id = $1 order by position`,
      [contractVersionId]);
    expect(gapped.map((r) => r.position)).toEqual([2, 3]);

    await bindRules(contractVersionId, [await publishedRuleVersionId()]);
    const view = await (await getVersion(fx.contractId, versionNo)).json();
    expect((await publishVersion(contractVersionId, manifestOf(view))).status).toBe(201);

    const closed = await q<{ position: number }>(
      `select position from public.work_items where contract_version_id = $1 order by position`,
      [contractVersionId]);
    expect(closed.map((r) => r.position)).toEqual([1, 2]);
  });
});

describe("all three are refused once the version is published (INV-015)", () => {
  it("work_items.create answers 409 VERSION_CONFLICT and writes nothing", async () => {
    const published = await publishedVersion();
    const res = await addLine(published.versionId, { ...LINE, sourceKey: "9.9" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("VERSION_CONFLICT");

    const rows = await q<{ n: string }>(
      `select count(*) n from public.work_items where contract_version_id = $1`,
      [published.versionId]);
    expect(rows[0]!.n).toBe("1");
  });

  it("work_items.update answers 409 and leaves the line as agreed", async () => {
    const published = await publishedVersion();
    const res = await patchLine(published.workItemId, { description: "Змінено після публікації" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("VERSION_CONFLICT");

    const rows = await q<{ description: string }>(
      `select description from public.work_items where id = $1`, [published.workItemId]);
    expect(rows[0]!.description).toBe(LINE.description);
  });

  it("work_items.remove answers 409 and the line survives", async () => {
    const published = await publishedVersion();
    const res = await removeLine(published.workItemId);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("VERSION_CONFLICT");

    const rows = await q<{ n: string }>(
      `select count(*) n from public.work_items where id = $1`, [published.workItemId]);
    expect(rows[0]!.n).toBe("1");
  });

  it("no audit row claims a correction that did not happen", async () => {
    const published = await publishedVersion();
    await patchLine(published.workItemId, { description: "Змінено після публікації" });
    await removeLine(published.workItemId);
    const rows = await q<{ n: string }>(
      `select count(*) n from public.audit_events
        where object_id = $1 and action in ('work_item.corrected','work_item.removed')`,
      [published.workItemId]);
    expect(rows[0]!.n).toBe("0");
  });

  it("the DATABASE refuses the same two mutations, with no route involved", async () => {
    // app.guard_work_item() is the layer that survives a route being rewritten.
    // Attempted from the owner connection, which bypasses both RLS and the
    // grant — so what refuses here is the trigger and nothing else.
    const published = await publishedVersion();
    await expect(q(
      `update public.work_items set description = 'обхід' where id = $1`,
      [published.workItemId])).rejects.toThrow(/immutable once it is published/);
    await expect(q(
      `delete from public.work_items where id = $1`, [published.workItemId]))
      .rejects.toThrow(/immutable once it is published/);
  });

  it("the database still allows the same mutations on a DRAFT line", async () => {
    // The positive control. Without it the assertion above would also pass
    // against a guard that refused everything, which is the shape migration
    // 0042 replaced and must not have reinstated.
    const draft = await draftWithLine();
    await q(`update public.work_items set description = 'виправлено' where id = $1`,
      [draft.workItemId]);
    const rows = await q<{ description: string }>(
      `select description from public.work_items where id = $1`, [draft.workItemId]);
    expect(rows[0]!.description).toBe("виправлено");
    await q(`delete from public.work_items where id = $1`, [draft.workItemId]);
  });

  it("the database refuses to move a draft line to another version even while it is a draft", async () => {
    // A correction changes what the line SAYS. It may not move the line to
    // another tenant, project, contract or version, nor shed the import row
    // result it came from, nor carry a different tax basis from the version
    // that pins it.
    const draft = await draftWithLine();
    const other = await createDraft(fx.contractId);
    const { contractVersionId: otherVersionId } = await other.json();
    await expect(q(
      `update public.work_items set contract_version_id = $2 where id = $1`,
      [draft.workItemId, otherVersionId]))
      .rejects.toThrow(/identity, tenancy, provenance or pinned tax basis/);
    await expect(q(
      `update public.work_items set tax_rate_bps = 0 where id = $1`, [draft.workItemId]))
      .rejects.toThrow(/identity, tenancy, provenance or pinned tax basis/);
  });
});
