import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq, baselineFixture, type BaselineFixture } from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion, publishVersion,
  removeLine, retireRuleVersion, ruleVersionBody, seedRequirementLibrary, withOutboxInsertFailure,
} from "./helpers/manual-baseline";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. It was written with no node_modules,
 * no database and no docker available: `vitest`, `tsc`, `psql` and `supabase`
 * were never run against it, no route was invoked, no migration was applied,
 * and no claim is made that any assertion below passes. Static reading is the
 * only check that was available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M1: the rule-version set a baseline pins, and the atomicity of pinning
 * it. INV-083 (no baseline is published without a bound set), INV-080 (a rule
 * published after the baseline never enters it) and the transactional claim
 * underneath both — an induced failure binds nothing and publishes nothing.
 *
 * ONE ACT, TWO COMMANDS, AND THE DIFFERENCE MATTERS TO WHAT IS ASSERTED HERE.
 * technical/openapi/scope-v0.1.csv:19-20 ships `contract_versions.bind_rules`
 * and `contract_versions.publish` as separate operations, and
 * `publishContractVersionRequest` carries only `confirmedManifestHash` — so
 * "publishing binds the selected rules" is not one HTTP call in v0.1. The
 * PROPERTY the spec states is still a property of the pair, and it is what the
 * tests below assert:
 *
 *   * a bind either lands whole or does not land at all;
 *   * a publication either happens with exactly the bound set or does not
 *     happen — a failure anywhere leaves a draft with its previous bindings and
 *     nothing else;
 *   * and the set is FIXED by publication, so what the published version
 *     carries is exactly what was bound at that moment
 *     (app.guard_rule_binding_window(), migration 0042 §5).
 *
 * Together those three are the whole of "atomically", including the failure
 * mode a single command would have been chosen to avoid: a published version
 * with no bindings, or with some of them.
 *
 * INDUCING A FAILURE THAT LANDS AFTER THE WRITES. Every refusal reachable from
 * outside — a missing binding, a stale manifest, an already-published version —
 * is checked BEFORE the command writes anything, so it proves nothing about
 * rollback. `withOutboxInsertFailure` puts a temporary trigger on
 * public.transaction_outbox scoped to one aggregate id, which makes the LAST
 * statement of each command fail: by then the bindings are inserted, the
 * positions renumbered, the status flipped and the audit row written. What the
 * tests then assert is that none of it survived.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const LINE = {
  sourceKey: "1.1",
  description: "Улаштування прокладки кабелю",
  unitCode: "м",
  contractQuantity: "10",
  unitPriceState: "known" as const,
  unitPrice: "199.99",
};

let fx: BaselineFixture;
let library: Map<string, string>;

async function newRuleVersion(over: Record<string, unknown> = {}): Promise<{
  ruleVersionId: string; requirementRuleId: string; stageKey: string;
}> {
  const item = library.get("Н.15/1");
  if (!item) throw new Error("rule-binding-publish: the library fixture seeded no Н.15/1");
  const res = await publishRuleVersion(fx.workspaceId, ruleVersionBody(item, over));
  if (res.status !== 201) {
    throw new Error(`requirement_rule_versions.publish returned ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return {
    ruleVersionId: body.ruleVersionId,
    requirementRuleId: body.requirementRuleId,
    stageKey: body.stageKey,
  };
}

async function draftWithLines(count = 1): Promise<{ versionId: string; versionNo: number }> {
  const created = await createDraft(fx.contractId);
  if (created.status !== 201) {
    throw new Error(`contract_versions.create returned ${created.status} ${await created.text()}`);
  }
  const { contractVersionId, versionNo } = await created.json();
  for (let i = 1; i <= count; i += 1) {
    const res = await addLine(contractVersionId, { ...LINE, sourceKey: `1.${i}` });
    if (res.status !== 201) {
      throw new Error(`work_items.create returned ${res.status} ${await res.text()}`);
    }
  }
  return { versionId: contractVersionId, versionNo };
}

const bindingCount = async (versionId: string): Promise<number> => {
  const rows = await q<{ n: string }>(
    `select count(*) n from public.contract_version_rule_bindings where contract_version_id = $1`,
    [versionId]);
  return Number(rows[0]!.n);
};

const versionRow = async (versionId: string) => {
  const rows = await q<{
    status: string; published_at: Date | null; source_manifest_hash: string | null;
  }>(`select status, published_at, source_manifest_hash
        from public.contract_versions where id = $1`, [versionId]);
  return rows[0]!;
};

const outboxCount = async (topic: string, aggregateId: string): Promise<number> => {
  const rows = await q<{ n: string }>(
    `select count(*) n from public.transaction_outbox where topic = $1 and aggregate_id = $2`,
    [topic, aggregateId]);
  return Number(rows[0]!.n);
};

const auditCount = async (action: string, objectId: string): Promise<number> => {
  const rows = await q<{ n: string }>(
    `select count(*) n from public.audit_events where action = $1 and object_id = $2`,
    [action, objectId]);
  return Number(rows[0]!.n);
};

const idempotencyCount = async (operationId: string): Promise<number> => {
  const rows = await q<{ n: string }>(
    `select count(*) n from public.idempotency_records where operation_id = $1`, [operationId]);
  return Number(rows[0]!.n);
};

beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await baselineFixture(A);
  const { POST: grant } = await import("../app/v1/projects/[projectId]/access-grants/route");
  await grant(jsonReq("http://x", { memberId: fx.memberId, capabilities: ["rule_bindings.manage"] }),
    { params: Promise.resolve({ projectId: fx.projectId }) });
  library = await seedRequirementLibrary(fx.workspaceId);
});

describe("INV-083 — no baseline is published without a bound rule-version set", () => {
  it("refuses the publication, names the code, and publishes nothing", async () => {
    const draft = await draftWithLines();
    const view = await (await getVersion(fx.contractId, draft.versionNo)).json();

    const res = await publishVersion(draft.versionId, manifestOf(view));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("RULE_BINDING_REQUIRED");
    expect(body.userAction).toBe("bind_rule_versions_then_publish");

    const row = await versionRow(draft.versionId);
    expect(row.status).toBe("draft");
    expect(row.published_at).toBeNull();
    expect(row.source_manifest_hash).toBeNull();
    expect(await outboxCount("contract_version.published", draft.versionId)).toBe(0);
    expect(await auditCount("contract_version.published", draft.versionId)).toBe(0);
  });

  it("reports the missing binding BEFORE a stale line set, because that is what survives a refresh", async () => {
    // A caller holding a stale view still has no rule-version set, and the
    // binding count does not depend on the lines — so naming the milestone's own
    // condition first tells them the thing that will still be true afterwards.
    const draft = await draftWithLines();
    const stale = manifestOf(await (await getVersion(fx.contractId, draft.versionNo)).json());
    await addLine(draft.versionId, { ...LINE, sourceKey: "9.9" });

    const res = await publishVersion(draft.versionId, stale);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("RULE_BINDING_REQUIRED");
  });

  it("refuses a draft with no work lines at all", async () => {
    const created = await createDraft(fx.contractId);
    const { contractVersionId, versionNo } = await created.json();
    const rv = await newRuleVersion();
    expect((await bindRules(contractVersionId, [rv.ruleVersionId])).status).toBe(201);
    const view = await (await getVersion(fx.contractId, versionNo)).json();

    // A baseline with no lines has an empty money pool and nothing for M2 to
    // assign against; the frozen importer refuses an empty batch too.
    expect((await publishVersion(contractVersionId, manifestOf(view))).status).toBe(422);
    expect((await versionRow(contractVersionId)).status).toBe("draft");
  });
});

describe("a bind lands whole or not at all", () => {
  it("binds the selected set and returns the baseline's stage vocabulary", async () => {
    const draft = await draftWithLines();
    const one = await newRuleVersion({ stageKey: "prykhovani-roboty" });
    const two = await newRuleVersion({ stageKey: "zakryttia-kabeliv" });

    const res = await bindRules(draft.versionId, [one.ruleVersionId, two.ruleVersionId]);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.bindings).toHaveLength(2);
    expect(body.stageKeys.sort()).toEqual(["prykhovani-roboty", "zakryttia-kabeliv"]);
    expect(body.bindings.every((b: { interventionType: string }) => b.interventionType === "hold"))
      .toBe(true);
    expect(await bindingCount(draft.versionId)).toBe(2);
    expect(await outboxCount("contract_version.rules_bound", draft.versionId)).toBe(1);
  });

  it("binds NONE of a set that names a rule version from another workspace", async () => {
    const draft = await draftWithLines();
    const mine = await newRuleVersion();

    // A second workspace of the same owner, with its own library and its own
    // rule version. The refusal must be about the TENANT and not about the
    // caller's permissions, which is why the same person owns both.
    const { POST: createW } = await import("../app/v1/workspaces/route");
    const other = await createW(jsonReq("http://x", { displayName: "Приклад-Інший простір" }),
      { params: Promise.resolve({}) });
    const otherWorkspaceId = (await other.json()).workspaceId as string;
    const otherLibrary = await seedRequirementLibrary(otherWorkspaceId);
    const otherItem = otherLibrary.get("Н.15/1");
    if (!otherItem) throw new Error("rule-binding-publish: second library was not seeded");
    const foreign = await publishRuleVersion(otherWorkspaceId, ruleVersionBody(otherItem));
    expect(foreign.status).toBe(201);
    const foreignId = (await foreign.json()).ruleVersionId as string;

    const res = await bindRules(draft.versionId, [mine.ruleVersionId, foreignId]);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fieldErrors.some((f: { path: string }) => f.path === "ruleVersionIds[1]")).toBe(true);

    // The valid half of the set is not bound either. A partially applied bind
    // would be a baseline nobody asked for.
    expect(await bindingCount(draft.versionId)).toBe(0);
  });

  it("binds NONE of a set that names a retired rule version (INV-067)", async () => {
    const draft = await draftWithLines();
    const live = await newRuleVersion();
    const doomed = await newRuleVersion();
    expect((await retireRuleVersion(doomed.ruleVersionId)).status).toBe(200);

    const res = await bindRules(draft.versionId, [live.ruleVersionId, doomed.ruleVersionId]);
    expect(res.status).toBe(422);
    expect(await bindingCount(draft.versionId)).toBe(0);
  });

  it("binds NONE of a set that names two versions of ONE rule", async () => {
    // ONE RULE CONTRIBUTES AT MOST ONE VERSION TO A BASELINE (0041:471-476).
    // Two versions of the same lineage inside one published version would make
    // "what was agreed" ambiguous, and reproducibility is the whole point.
    //
    // THIS IS THE ONE MID-LOOP FAILURE THE COMMAND COULD REACH: the already-bound
    // check reads only the bindings that ALREADY exist, so without a check on the
    // REQUEST the first insert lands and the second meets
    // unique (workspace_id, contract_version_id, requirement_rule_id) as a raw
    // 23505 — a 500 the caller cannot act on (M1 review finding 3).
    //
    // REQUIRED BEHAVIOUR: the catalogued 422, BOTH offending ids named so the
    // caller can see which two collide, and zero bindings — the refusal is
    // decided before any insert runs rather than rolled back after one.
    const draft = await draftWithLines();
    const first = await newRuleVersion();
    const second = await newRuleVersion({ requirementRuleId: first.requirementRuleId });

    const res = await bindRules(draft.versionId, [first.ruleVersionId, second.ruleVersionId]);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fieldErrors.map((f: { path: string }) => f.path).sort())
      .toEqual(["ruleVersionIds[0]", "ruleVersionIds[1]"]);
    expect(await bindingCount(draft.versionId)).toBe(0);
    expect(await outboxCount("contract_version.rules_bound", draft.versionId)).toBe(0);
    expect(await auditCount("contract_version.rules_bound", draft.versionId)).toBe(0);
  });

  it("still binds the FIRST of two lineage-mates when the request names only one", async () => {
    // The positive control for the refusal above: it must be about the pair in
    // one request and not about either version being unbindable on its own.
    // Without this, a check that rejected any request naming a rule with more
    // than one published version would pass the test above for the wrong reason.
    const draft = await draftWithLines();
    const first = await newRuleVersion();
    await newRuleVersion({ requirementRuleId: first.requirementRuleId });

    expect((await bindRules(draft.versionId, [first.ruleVersionId])).status).toBe(201);
    expect(await bindingCount(draft.versionId)).toBe(1);
  });

  it("refuses a second version of an ALREADY-bound rule rather than appending it", async () => {
    const draft = await draftWithLines();
    const first = await newRuleVersion();
    expect((await bindRules(draft.versionId, [first.ruleVersionId])).status).toBe(201);
    const second = await newRuleVersion({ requirementRuleId: first.requirementRuleId });

    // Answering 201 would let a client believe a set was REPLACED when the
    // table is append-only and can only ever be appended to.
    const res = await bindRules(draft.versionId, [second.ruleVersionId]);
    expect(res.status).toBe(422);
    expect(await bindingCount(draft.versionId)).toBe(1);
  });

  it("binds nothing when the command fails after its own inserts", async () => {
    const draft = await draftWithLines();
    const one = await newRuleVersion({ stageKey: "stage-one" });
    const two = await newRuleVersion({ stageKey: "stage-two" });

    const res = await withOutboxInsertFailure(draft.versionId, () =>
      bindRules(draft.versionId, [one.ruleVersionId, two.ruleVersionId]));
    expect(res.status).toBe(500);

    // Both inserts had already run when the outbox statement raised. If the
    // command were not one transaction, this is where a half-bound baseline
    // would be sitting.
    expect(await bindingCount(draft.versionId)).toBe(0);
    expect(await auditCount("contract_version.rules_bound", draft.versionId)).toBe(0);
    expect(await outboxCount("contract_version.rules_bound", draft.versionId)).toBe(0);
    // And no idempotency record claims the command completed, so an honest
    // retry re-executes instead of replaying a success that never happened.
    expect(await idempotencyCount("contract_versions.bind_rules")).toBe(0);
  });

  it("still binds after the induced failure is removed", async () => {
    // The positive control for the probe itself: without it, a trigger left
    // behind by a failed cleanup would make every later test pass for the wrong
    // reason.
    const draft = await draftWithLines();
    const one = await newRuleVersion();
    await withOutboxInsertFailure(draft.versionId, () =>
      bindRules(draft.versionId, [one.ruleVersionId]));
    expect((await bindRules(draft.versionId, [one.ruleVersionId])).status).toBe(201);
    expect(await bindingCount(draft.versionId)).toBe(1);
  });
});

describe("publication fixes the bound set, and fixes it atomically", () => {
  it("publishes with exactly the set that was bound", async () => {
    const draft = await draftWithLines(2);
    const one = await newRuleVersion({ stageKey: "prykhovani-roboty" });
    const two = await newRuleVersion({ stageKey: "zakryttia-kabeliv" });
    await bindRules(draft.versionId, [one.ruleVersionId, two.ruleVersionId]);

    const view = await (await getVersion(fx.contractId, draft.versionNo)).json();
    const res = await publishVersion(draft.versionId, manifestOf(view));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.boundRuleVersionCount).toBe(2);
    expect(body.workItemCount).toBe(2);

    const row = await versionRow(draft.versionId);
    expect(row.status).toBe("published");
    expect(row.published_at).not.toBeNull();
    // The content address of the line set the publisher confirmed — computed
    // here from what contract_versions.get returned, which is the whole point
    // of the guard.
    expect(row.source_manifest_hash).toBe(manifestOf(view));

    const bound = await q<{ requirement_rule_version_id: string }>(
      `select requirement_rule_version_id from public.contract_version_rule_bindings
        where contract_version_id = $1 order by requirement_rule_version_id`, [draft.versionId]);
    expect(bound.map((b) => b.requirement_rule_version_id).sort())
      .toEqual([one.ruleVersionId, two.ruleVersionId].sort());
    expect(await outboxCount("contract_version.published", draft.versionId)).toBe(1);
  });

  it("admits no further binding once published — route and database (INV-080)", async () => {
    const draft = await draftWithLines();
    const bound = await newRuleVersion();
    await bindRules(draft.versionId, [bound.ruleVersionId]);
    const view = await (await getVersion(fx.contractId, draft.versionNo)).json();
    expect((await publishVersion(draft.versionId, manifestOf(view))).status).toBe(201);

    const late = await newRuleVersion({ stageKey: "stage-late" });
    const res = await bindRules(draft.versionId, [late.ruleVersionId]);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("VERSION_CONFLICT");

    // The route's refusal exists to give the caller a code. The window is what
    // makes the set actually fixed, and it holds against a direct insert from
    // the owner connection with no route involved.
    await expect(q(
      `insert into public.contract_version_rule_bindings
         (workspace_id, project_id, contract_id, contract_version_id,
          requirement_rule_id, requirement_rule_version_id, stage_key, bound_by_member_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [fx.workspaceId, fx.projectId, fx.contractId, draft.versionId,
       late.requirementRuleId, late.ruleVersionId, late.stageKey, fx.memberId]))
      .rejects.toThrow(/INV-080/);

    expect(await bindingCount(draft.versionId)).toBe(1);
  });

  it("publishes nothing when the command fails after its own writes", async () => {
    // The draft is deliberately GAPPED: publication renumbers 1..N as its first
    // write, so if the transaction were not atomic the positions would come out
    // renumbered even though the version stayed a draft.
    const draft = await draftWithLines(3);
    const lines = await q<{ id: string; position: number }>(
      `select id, position from public.work_items where contract_version_id = $1
        order by position`, [draft.versionId]);
    expect((await removeLine(lines[0]!.id)).status).toBe(200);

    const one = await newRuleVersion({ stageKey: "prykhovani-roboty" });
    const two = await newRuleVersion({ stageKey: "zakryttia-kabeliv" });
    await bindRules(draft.versionId, [one.ruleVersionId, two.ruleVersionId]);

    const view = await (await getVersion(fx.contractId, draft.versionNo)).json();
    const res = await withOutboxInsertFailure(draft.versionId, () =>
      publishVersion(draft.versionId, manifestOf(view)));
    expect(res.status).toBe(500);

    const row = await versionRow(draft.versionId);
    expect(row.status).toBe("draft");
    expect(row.published_at).toBeNull();
    expect(row.source_manifest_hash).toBeNull();

    // The renumbering ran before the status flip and must have rolled back with
    // it: the gap work_items.remove left is still there.
    const after = await q<{ position: number }>(
      `select position from public.work_items where contract_version_id = $1 order by position`,
      [draft.versionId]);
    expect(after.map((r) => r.position)).toEqual([2, 3]);

    // The set that was bound before the attempt is untouched — a failed
    // publication must not shrink or grow it.
    expect(await bindingCount(draft.versionId)).toBe(2);
    expect(await auditCount("contract_version.published", draft.versionId)).toBe(0);
    expect(await outboxCount("contract_version.published", draft.versionId)).toBe(0);
    expect(await idempotencyCount("contract_versions.publish")).toBe(0);
  });

  it("publishes cleanly once the induced failure is gone, from the same draft", async () => {
    // Proves the rollback above left the draft usable rather than wedged, and
    // that the bindings it kept are the ones the eventual publication pins.
    const draft = await draftWithLines(2);
    const one = await newRuleVersion();
    await bindRules(draft.versionId, [one.ruleVersionId]);
    const view = await (await getVersion(fx.contractId, draft.versionNo)).json();

    expect((await withOutboxInsertFailure(draft.versionId, () =>
      publishVersion(draft.versionId, manifestOf(view)))).status).toBe(500);

    const res = await publishVersion(draft.versionId, manifestOf(view));
    expect(res.status).toBe(201);
    expect((await res.json()).boundRuleVersionCount).toBe(1);
    expect((await versionRow(draft.versionId)).status).toBe("published");
  });

  it("refuses a stale line set and publishes nothing (the guard before the writes)", async () => {
    const draft = await draftWithLines();
    const one = await newRuleVersion();
    await bindRules(draft.versionId, [one.ruleVersionId]);
    const stale = manifestOf(await (await getVersion(fx.contractId, draft.versionNo)).json());

    // Another typist corrects a line between review and publication.
    expect((await addLine(draft.versionId, { ...LINE, sourceKey: "1.9" })).status).toBe(201);

    const res = await publishVersion(draft.versionId, stale);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("VERSION_CONFLICT");
    expect((await versionRow(draft.versionId)).status).toBe("draft");
    expect(await bindingCount(draft.versionId)).toBe(1);

    // And the current digest publishes it, so the guard is about staleness and
    // not about the hash being unsatisfiable.
    const fresh = manifestOf(await (await getVersion(fx.contractId, draft.versionNo)).json());
    expect((await publishVersion(draft.versionId, fresh)).status).toBe(201);
  });

  it("refuses a second publication of the same version", async () => {
    const draft = await draftWithLines();
    const one = await newRuleVersion();
    await bindRules(draft.versionId, [one.ruleVersionId]);
    const view = await (await getVersion(fx.contractId, draft.versionNo)).json();
    const hash = manifestOf(view);
    expect((await publishVersion(draft.versionId, hash)).status).toBe(201);

    // A fresh Idempotency-Key, so this is the STATE refusing and not the
    // idempotency record replaying.
    const again = await publishVersion(draft.versionId, hash);
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe("VERSION_CONFLICT");
  });
});

describe("INV-088 — publication order and version_no order agree", () => {
  /**
   * WHY THIS IS A PROPERTY AND NOT A DETAIL. contract_versions.create assigns a
   * draft its number at DRAFT time; import_batches.publish assigns one at
   * PUBLISH time. Nothing re-checked the number when a draft was finally
   * published, so a draft opened first and published LAST landed with the LOWER
   * number — and every reader of «the contract's current version» finds it by
   * `order by version_no desc limit 1` over published rows. The newest agreement
   * became invisible and two published versions both claimed to supersede the
   * one before them (M1 review finding 4).
   *
   * THE INTERLEAVING BELOW IS MANUAL-VS-MANUAL, and deliberately so: it is the
   * half the publish command's own advisory lock can actually make airtight.
   * The import-vs-manual interleaving needs the frozen importer to take the same
   * lock and is recorded as owed on INV-088 rather than asserted here as if it
   * held.
   */
  async function boundDraft(): Promise<{ versionId: string; versionNo: number }> {
    const draft = await draftWithLines();
    const rv = await newRuleVersion();
    const bound = await bindRules(draft.versionId, [rv.ruleVersionId]);
    if (bound.status !== 201) {
      throw new Error(`bind_rules returned ${bound.status} ${await bound.text()}`);
    }
    return draft;
  }

  const publishedNumbers = async (contractId: string): Promise<number[]> => {
    const rows = await q<{ version_no: number }>(
      `select version_no from public.contract_versions
        where contract_id = $1 and status = 'published' order by version_no`, [contractId]);
    return rows.map((r) => Number(r.version_no));
  };

  it("refuses a draft that a later baseline has already overtaken", async () => {
    const first = await boundDraft();
    const second = await boundDraft();
    expect(second.versionNo).toBeGreaterThan(first.versionNo);

    const secondView = await (await getVersion(fx.contractId, second.versionNo)).json();
    expect((await publishVersion(second.versionId, manifestOf(secondView))).status).toBe(201);

    // The earlier draft is complete and correct in every other respect: lines,
    // a bound rule-version set, a current manifest. It is refused only because
    // publishing it now would put the newest agreement behind an older number.
    const firstView = await (await getVersion(fx.contractId, first.versionNo)).json();
    const res = await publishVersion(first.versionId, manifestOf(firstView));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("VERSION_CONFLICT");
    expect(body.userAction).toBe("refresh_compare_retry");

    const row = await versionRow(first.versionId);
    expect(row.status).toBe("draft");
    expect(row.published_at).toBeNull();
    expect(row.source_manifest_hash).toBeNull();
    expect(await outboxCount("contract_version.published", first.versionId)).toBe(0);
    expect(await auditCount("contract_version.published", first.versionId)).toBe(0);
    // The bound set a refused publication found is the set it leaves behind.
    expect(await bindingCount(first.versionId)).toBe(1);

    // The property itself: exactly one published version and it is the newest
    // number, so `order by version_no desc limit 1` names the agreement that was
    // actually reached.
    expect(await publishedNumbers(fx.contractId)).toEqual([second.versionNo]);
  });

  it("names the overtaking BEFORE the missing rule-version set", async () => {
    // Ordering of refusals, and it is the point rather than a nicety: binding is
    // APPEND-ONLY with no unbind in v0.1, so answering RULE_BINDING_REQUIRED here
    // would send the caller to perform an irreversible act on a draft that can
    // never be published.
    const stranded = await draftWithLines();          // no bindings at all
    const winner = await boundDraft();
    const winnerView = await (await getVersion(fx.contractId, winner.versionNo)).json();
    expect((await publishVersion(winner.versionId, manifestOf(winnerView))).status).toBe(201);

    const strandedView = await (await getVersion(fx.contractId, stranded.versionNo)).json();
    const res = await publishVersion(stranded.versionId, manifestOf(strandedView));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("VERSION_CONFLICT");
    expect(await bindingCount(stranded.versionId)).toBe(0);
  });

  it("publishes both drafts when they are published in the order they were numbered", async () => {
    // The positive control. Two open drafts per contract stay legal (0042's
    // header says so explicitly) and the refusal must be about the ORDER and not
    // about a second draft existing.
    const first = await boundDraft();
    const second = await boundDraft();

    const firstView = await (await getVersion(fx.contractId, first.versionNo)).json();
    expect((await publishVersion(first.versionId, manifestOf(firstView))).status).toBe(201);
    const secondView = await (await getVersion(fx.contractId, second.versionNo)).json();
    expect((await publishVersion(second.versionId, manifestOf(secondView))).status).toBe(201);

    expect(await publishedNumbers(fx.contractId)).toEqual([first.versionNo, second.versionNo]);
    expect((await versionRow(first.versionId)).status).toBe("published");
    expect((await versionRow(second.versionId)).status).toBe("published");
  });
});
