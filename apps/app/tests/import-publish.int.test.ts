import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  q, truncateAll, jsonReq, baselineFixture, createBatch, addFile, getBatch,
  publishBindableRuleVersion, type BaselineFixture,
} from "./helpers/fixtures";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const enc = (s: string) => new TextEncoder().encode(s);
const MAPPING = { sourceKey: "A", description: "B", unit: "C", quantity: "D", unitPrice: "E", amount: "F" };
// Row 3 (1.2): source amount 2 100,00 vs derived 10×199,99=1 999,90 → mismatch.
const CSV_V1 =
  "Шифр;Назва;Од;К-сть;Ціна;Сума\n" +
  "1.1;Мурування;м2;10;199,99;1 999,90\n" +
  "1.2;Штукатурення;м2;10;199,99;2 100,00\n" +
  "1.3;Утеплення;м2;5,5;150,00;825,00\n";
// V2: 1.1 quantity 10→12 (changed), 1.2 removed (its approved basis cannot be
// "unchanged" across reimports), 1.3 identical (unchanged), 1.4 added.
const CSV_V2 =
  "Шифр;Назва;Од;К-сть;Ціна;Сума\n" +
  "1.1;Мурування;м2;12;199,99;2 399,88\n" +
  "1.3;Утеплення;м2;5,5;150,00;825,00\n" +
  "1.4;Фарбування;м2;3;100,00;300,00\n";

let fx: BaselineFixture;
/**
 * A published rule version this file's baselines can pin.
 *
 * Every block below is about money, lineage, immutability or idempotency
 * rather than about INV-083, so they name this set and move on. The gate
 * itself is exercised in «INV-083 on the frozen importer» at the end of the
 * file, where the absence of a set is the subject rather than an obstacle.
 */
let ruleVersionId: string;
beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await baselineFixture(A);
  ({ ruleVersionId } = await publishBindableRuleVersion(fx.workspaceId));
});

async function validate(batchId: string, expectedVersion: number) {
  const { POST } = await import("../app/v1/import-batches/[batchId]/validate/route");
  return POST(jsonReq("http://x", { mapping: MAPPING, config: { headerRow: 1 }, expectedVersion }),
    { params: Promise.resolve({ batchId }) });
}
async function resolve(batchId: string, body: Record<string, unknown>) {
  const { POST } = await import("../app/v1/import-batches/[batchId]/resolutions/route");
  return POST(jsonReq("http://x", body), { params: Promise.resolve({ batchId }) });
}
/**
 * `ruleVersionIds` defaults to the file's one published rule version. Passing
 * `[]` explicitly is how a test asks for the INV-083 refusal; the default keeps
 * every other block from restating a gate it is not about.
 */
async function publish(
  batchId: string, expectedVersion: number, manifest: string,
  ruleVersionIds: string[] = [ruleVersionId],
) {
  const { POST } = await import("../app/v1/import-batches/[batchId]/publish/route");
  return POST(jsonReq("http://x", {
    expectedVersion, confirmedManifestHash: manifest, ruleVersionIds,
  }), { params: Promise.resolve({ batchId }) });
}
async function getVersion(contractId: string, versionNo: number) {
  const { GET } = await import("../app/v1/contracts/[contractId]/versions/[versionNo]/route");
  return GET(new Request("http://x"), { params: Promise.resolve({ contractId, versionNo: String(versionNo) }) });
}

/** Stage CSV_V1, validate (→ validated with 1 mismatch), return current batch view. */
async function stagedV1() {
  const batchId = await createBatch(fx.contractId);
  await addFile(batchId, "кошторис.csv", enc(CSV_V1));
  await validate(batchId, 2);
  const view = await (await getBatch(batchId)).json();
  return { batchId, view };
}

describe("INV-054 blocking + resolution flow", () => {
  it("publish on validated (unresolved mismatch) → 409; resolve → revalidate → preview_ready", async () => {
    const { batchId, view } = await stagedV1();
    expect(view.status).toBe("validated");
    expect(view.needsResolutionCount).toBe(1);
    const denied = await publish(batchId, view.version, view.sourceManifestHash);
    expect(denied.status).toBe(409);
    expect((await denied.json()).code).toBe("IMPORT_JOB_CONFLICT");
    expect((await q<{ n: string }>("select count(*) n from public.contract_versions", []))[0]!.n).toBe("0");

    const mismatch = view.rowResults.find((r: { errorCodes: string[] }) => r.errorCodes.includes("AMOUNT_MISMATCH"));
    const res = await resolve(batchId, {
      rowResultId: mismatch.rowResultId, chosenBasis: "approved_source_amount",
      reason: "Сума з урахуванням транспортних витрат",
    });
    expect(res.status).toBe(201);

    const reval = await (await validate(batchId, view.version)).json();
    expect(reval.status).toBe("preview_ready");
    const resolvedRow = reval.rowResults.find((r: { errorCodes: string[] }) => r.errorCodes.includes("AMOUNT_MISMATCH"));
    expect(resolvedRow.severity).toBe("warning");
  });

  it("resolution by an actor without imports.manage → 403; duplicate resolution → 409", async () => {
    const { batchId, view } = await stagedV1();
    const mismatch = view.rowResults.find((r: { errorCodes: string[] }) => r.errorCodes.includes("AMOUNT_MISMATCH"));
    // C gets project.view only: the batch is VISIBLE (no existence-safe 404),
    // but imports.manage is missing → 403 SCOPE_PROJECT_DENIED.
    await q("insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'member','active')", [fx.workspaceId, C]);
    const cm = await q<{ id: string }>("select id from public.memberships where organization_id=$1 and user_id=$2", [fx.workspaceId, C]);
    const { POST: grant } = await import("../app/v1/projects/[projectId]/access-grants/route");
    await grant(jsonReq("http://x", { memberId: cm[0]!.id, capabilities: ["project.view"] }), { params: Promise.resolve({ projectId: fx.projectId }) });
    current = C;
    const denied = await resolve(batchId, { rowResultId: mismatch.rowResultId, chosenBasis: "unit_price_derived", reason: "х" });
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe("SCOPE_PROJECT_DENIED");
    current = A;
    await resolve(batchId, { rowResultId: mismatch.rowResultId, chosenBasis: "approved_source_amount", reason: "Перше" });
    const dup = await resolve(batchId, { rowResultId: mismatch.rowResultId, chosenBasis: "unit_price_derived", reason: "Друге" });
    expect(dup.status).toBe(409);
    expect((await dup.json()).code).toBe("VERSION_CONFLICT");
  });
});

describe("publish", () => {
  async function readyBatch() {
    const { batchId, view } = await stagedV1();
    const mismatch = view.rowResults.find((r: { errorCodes: string[] }) => r.errorCodes.includes("AMOUNT_MISMATCH"));
    await resolve(batchId, { rowResultId: mismatch.rowResultId, chosenBasis: "approved_source_amount", reason: "Транспорт" });
    const reval = await (await validate(batchId, view.version)).json();
    return { batchId, view: reval };
  }

  it("wrong manifest → 409 IMPORT_REVIEW_STALE; imports.manage alone cannot publish", async () => {
    const { batchId, view } = await readyBatch();
    const stale = await publish(batchId, view.version, "ab".repeat(32));
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe("IMPORT_REVIEW_STALE");

    await q("insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'member','active')", [fx.workspaceId, C]);
    const cm = await q<{ id: string }>("select id from public.memberships where organization_id=$1 and user_id=$2", [fx.workspaceId, C]);
    const { POST: grant } = await import("../app/v1/projects/[projectId]/access-grants/route");
    await grant(jsonReq("http://x", { memberId: cm[0]!.id, capabilities: ["imports.manage"] }), { params: Promise.resolve({ projectId: fx.projectId }) });
    current = C;
    const denied = await publish(batchId, view.version, view.sourceManifestHash);
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("happy publish freezes v1 with snapshots, money, and approved basis; replay is idempotent", async () => {
    const { batchId, view } = await readyBatch();
    const res = await publish(batchId, view.version, view.sourceManifestHash);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.versionNo).toBe(1);
    expect(body.workItemCount).toBe(3);
    expect(body.supersedesVersionId).toBeNull();

    const items = await q<Record<string, unknown>>(
      "select * from public.work_items where workspace_id=$1 and contract_version_id=$2 order by position",
      [fx.workspaceId, body.contractVersionId]);
    expect(items).toHaveLength(3);
    // Row 1.1: derived 199990 net, tax 20% → 39998, gross 239988.
    expect(String(items[0]!.net_amount_minor_units)).toBe("199990");
    expect(String(items[0]!.gross_amount_minor_units)).toBe("239988");
    // Row 1.2: approved source 210000 → basis approved_source_amount.
    expect(items[1]!.valuation_basis).toBe("approved_source_amount");
    expect(String(items[1]!.approved_amount_minor_units)).toBe("210000");
    expect(String(items[1]!.net_amount_minor_units)).toBe("210000");
    const version = await q<{ own_party_snapshot: { official_name: string; edrpou: string } }>(
      "select own_party_snapshot from public.contract_versions where id=$1", [body.contractVersionId]);
    expect(version[0]!.own_party_snapshot.official_name).toBe("ТОВ Приклад-Власна");
    expect(version[0]!.own_party_snapshot.edrpou).toBe("12345678");
    const outbox = await q<{ n: string }>(
      "select count(*) n from public.transaction_outbox where topic='contract_version.published'", []);
    expect(Number(outbox[0]!.n)).toBe(1);

    // Idempotent replay: publish already flipped the batch to published, but the
    // SAME key + hash must replay the original 201 without a second version.
    const { POST } = await import("../app/v1/import-batches/[batchId]/publish/route");
    // The set is named again so the 409 under test is the batch's status and
    // not INV-083 — a request that would fail both cannot distinguish them.
    const req = jsonReq("http://x", {
      expectedVersion: view.version, confirmedManifestHash: view.sourceManifestHash,
      ruleVersionIds: [ruleVersionId],
    });
    const r1 = await POST(req.clone() as Request, { params: Promise.resolve({ batchId: await (async () => batchId)() }) });
    expect(r1.status).toBe(409); // new key, already-published batch → conflict
    expect((await r1.json()).code).toBe("IMPORT_JOB_CONFLICT");
    expect((await q<{ n: string }>("select count(*) n from public.contract_versions", []))[0]!.n).toBe("1");
  });

  it("reimport publishes v2 with lineage and diff; v1 stays immutable", async () => {
    const { batchId, view } = await readyBatch();
    const pub1 = await (await publish(batchId, view.version, view.sourceManifestHash)).json();
    const v1Before = await (await getVersion(fx.contractId, 1)).json();

    const batch2 = await createBatch(fx.contractId);
    await addFile(batch2, "кошторис-2.csv", enc(CSV_V2));
    const val2 = await (await validate(batch2, 2)).json();
    expect(val2.status).toBe("preview_ready");
    const pub2 = await (await publish(batch2, val2.version, val2.sourceManifestHash)).json();
    expect(pub2.versionNo).toBe(2);
    expect(pub2.supersedesVersionId).toBe(pub1.contractVersionId);

    const v2 = await (await getVersion(fx.contractId, 2)).json();
    expect(v2.diff).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 1 });
    const changed = v2.workItems.find((w: { sourceKey: string }) => w.sourceKey === "1.1");
    expect(changed.predecessorWorkItemId).toBeTruthy();
    const v1ItemIds = v1Before.workItems.map((w: { workItemId: string }) => w.workItemId);
    expect(v1ItemIds).toContain(changed.predecessorWorkItemId);

    // Immutability: v1 byte-identical after v2; direct mutation rejected.
    const v1After = await (await getVersion(fx.contractId, 1)).json();
    expect(v1After).toEqual(v1Before);
    await expect(q("update public.contract_versions set currency='USD' where id=$1", [pub1.contractVersionId]))
      .rejects.toThrow(/immutable/i);
    await expect(q("delete from public.work_items where contract_version_id=$1", [pub1.contractVersionId]))
      .rejects.toThrow(/immutable/i);

    // Third publish attempt on batch 1 → 409 (already published).
    const again = await publish(batchId, view.version + 1, view.sourceManifestHash);
    expect(again.status).toBe(409);
  });

  it("versions.get: foreign actor 404; unknown versionNo 404", async () => {
    const { batchId, view } = await readyBatch();
    await publish(batchId, view.version, view.sourceManifestHash);
    current = C; // no membership
    expect((await getVersion(fx.contractId, 1)).status).toBe(404);
    current = A;
    expect((await getVersion(fx.contractId, 99)).status).toBe(404);
  });
});

describe("zero-priced rows publish", () => {
  // Found while building the v0.1-M2 valuation matrix. publish wrote
  // unit_price_decimal from `mp.unitPrice ? … : null`, and a price of 0,00
  // parses into a Decimal whose object is truthy, so a 'zero' row was stored
  // with a non-null decimal and violated
  // `(unit_price_state = 'known') = (unit_price_decimal is not null)`.
  // Publishing any estimate containing a zero-priced row returned 500. No M1
  // fixture ever imported one.
  const CSV_ZERO =
    "Шифр;Назва;Од;К-сть;Ціна;Сума\n" +
    "1.1;Мурування;м2;10;199,99;1 999,90\n" +
    "1.5;Складування (у вартості);м2;4;0,00;0,00\n";

  it("stores a zero price as state 'zero' with no decimal", async () => {
    const batchId = await createBatch(fx.contractId);
    await addFile(batchId, "кошторис.csv", enc(CSV_ZERO));
    await validate(batchId, 2);
    const view = await (await getBatch(batchId)).json();

    const res = await publish(batchId, view.version, view.sourceManifestHash);
    expect(res.status, await res.clone().text()).toBe(201);

    const rows = await q<{ unit_price_state: string; unit_price_decimal: string | null; price_basis: string | null }>(
      `select unit_price_state, unit_price_decimal::text, price_basis from public.work_items
        where workspace_id = $1 and source_key = '1.5'`, [fx.workspaceId]);
    expect(rows[0]!.unit_price_state).toBe("zero");
    expect(rows[0]!.unit_price_decimal).toBeNull();
    // The basis a typed zero line now states too (DEV-088, BL-022); the
    // fixture's contract is tax-exclusive, so net.
    expect(rows[0]!.price_basis).toBe("net");
  });
});

describe("publish idempotency retention", () => {
  it("keeps the publish record for the audit window, not thirty days", async () => {
    // Publishing fixes the money pool every later exposure slice is carved
    // from, so the record has to stay replayable for the audit retention
    // window. TODOS.md carried the 30-day default as a deferred finding.
    const batchId = await createBatch(fx.contractId);
    await addFile(batchId, "кошторис.csv", enc(CSV_V1));
    await validate(batchId, 2);
    const view = await (await getBatch(batchId)).json();
    const mismatch = view.rowResults.find(
      (r: { errorCodes: string[] }) => r.errorCodes.includes("AMOUNT_MISMATCH"));
    await resolve(batchId, {
      rowResultId: mismatch.rowResultId, chosenBasis: "approved_source_amount",
      reason: "Приклад-обґрунтування",
    });
    const resolved = await (await getBatch(batchId)).json();
    await validate(batchId, resolved.version);
    const ready = await (await getBatch(batchId)).json();
    const res = await publish(batchId, ready.version, ready.sourceManifestHash);
    expect(res.status, await res.clone().text()).toBe(201);

    const rows = await q<{ expires_at: string; created_at: string }>(
      `select expires_at::text, created_at::text from public.idempotency_records
        where operation_id = 'import_batches.publish'`);
    const days = (new Date(rows[0]!.expires_at).getTime()
      - new Date(rows[0]!.created_at).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(400);
  });
});

/**
 * INV-083 ON THE FROZEN IMPORTER — M1 review finding 1.
 *
 * NOTHING IN THIS BLOCK HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `vitest`, `psql` and `supabase` were never run against it and no
 * claim is made that any assertion passes.
 *
 * «No baseline is published in v0.1 without a bound requirement rule-version
 * set: contract_versions.publish AND import_batches.publish both REFUSE a
 * version that carries no contract_version_rule_bindings row»
 * (invariant-catalog.csv:84). The manual route refused from M1; this one did
 * not, so the invariant held on one route — which the invariant itself says is
 * the same as holding on neither, and the route it did not hold on is the one
 * the pilot uses. Four authorities said it must
 * (transition-catalog.csv:13, version-0.1.md §"Exit gates", 0041:565-570's
 * grant justification, and 0042's xmin disjunct, which exists ONLY to let this
 * route bind inside its own publish transaction).
 *
 * These assertions are REQUIRED behaviour, written against the route. Every
 * refusal below is checked against the database as well as against the status
 * code: a 409 that still wrote a contract version would be a worse defect than
 * the one being fixed, and only the table can say it did not.
 */
describe("INV-083 on the frozen importer", () => {
  /** A batch with no discrepancies, ready to publish. */
  async function readyToPublish() {
    const batchId = await createBatch(fx.contractId);
    await addFile(batchId, "кошторис.csv", enc(
      "Шифр;Назва;Од;К-сть;Ціна;Сума\n1.1;Мурування;м2;10;199,99;1 999,90\n"));
    await validate(batchId, 2);
    return { batchId, view: await (await getBatch(batchId)).json() };
  }

  const publishedVersions = async () => Number((await q<{ n: string }>(
    `select count(*) n from public.contract_versions where workspace_id = $1`,
    [fx.workspaceId]))[0]!.n);

  it("refuses a publication that names no rule-version set, and writes nothing", async () => {
    const { batchId, view } = await readyToPublish();
    const res = await publish(batchId, view.version, view.sourceManifestHash, []);
    expect(res.status).toBe(409);
    const body = await res.json();
    // The SAME code the manual route answers with. One refusal on two routes
    // means one code on two routes; a client that had to branch on which route
    // it took would be reading the invariant as two different rules.
    expect(body.code).toBe("RULE_BINDING_REQUIRED");
    expect(body.userAction).toBe("bind_rule_versions_then_publish");

    expect(await publishedVersions()).toBe(0);
    expect(Number((await q<{ n: string }>(
      `select count(*) n from public.work_items where workspace_id = $1`,
      [fx.workspaceId]))[0]!.n)).toBe(0);
    expect(Number((await q<{ n: string }>(
      `select count(*) n from public.transaction_outbox where topic = 'contract_version.published'`
    ))[0]!.n)).toBe(0);
    // The batch is untouched, so the estimator can bind and retry rather than
    // re-running validate: a refusal that consumed the batch would make the
    // recovery path the userAction names impossible.
    const after = await (await getBatch(batchId)).json();
    expect(after.status).toBe("preview_ready");
    expect(after.version).toBe(view.version);
    expect(after.publishedVersionId).toBeNull();
  });

  it("refuses an ABSENT set exactly as it refuses an empty one", async () => {
    // The field defaults to `[]` rather than being required, so that this
    // request reaches the command's 409 instead of the schema's 422. A client
    // that has never heard of rule bindings must be told the thing it has to
    // do, not that its JSON is malformed.
    const { batchId, view } = await readyToPublish();
    const { POST } = await import("../app/v1/import-batches/[batchId]/publish/route");
    const res = await POST(jsonReq("http://x", {
      expectedVersion: view.version, confirmedManifestHash: view.sourceManifestHash,
    }), { params: Promise.resolve({ batchId }) });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("RULE_BINDING_REQUIRED");
    expect(await publishedVersions()).toBe(0);
  });

  it("pins the named set to the version it created, in that same transaction", async () => {
    const { batchId, view } = await readyToPublish();
    const res = await publish(batchId, view.version, view.sourceManifestHash, [ruleVersionId]);
    expect(res.status, await res.clone().text()).toBe(201);
    const body = await res.json();
    expect(body.boundRuleVersionCount).toBe(1);

    const bindings = await q<{
      contract_version_id: string; requirement_rule_version_id: string;
      requirement_rule_id: string; stage_key: string;
      bound_rule_version_is_published: boolean; bound_by_member_id: string;
      project_id: string; contract_id: string;
    }>(`select contract_version_id, requirement_rule_version_id, requirement_rule_id,
               stage_key, bound_rule_version_is_published, bound_by_member_id,
               project_id, contract_id
          from public.contract_version_rule_bindings where workspace_id = $1`,
      [fx.workspaceId]);
    expect(bindings).toHaveLength(1);
    const b = bindings[0]!;
    // The binding names the version this publication created — not a version
    // that already existed. That is what «in its own publish transaction»
    // means, and app.guard_rule_binding_window()'s xmin disjunct is what
    // permits it: a published version that was NOT born in this transaction is
    // refused (INV-080).
    expect(b.contract_version_id).toBe(body.contractVersionId);
    expect(b.requirement_rule_version_id).toBe(ruleVersionId);
    expect(b.project_id).toBe(fx.projectId);
    expect(b.contract_id).toBe(fx.contractId);
    expect(b.bound_by_member_id).toBe(fx.memberId);
    // Copied off the rule version, never taken from the caller — the composite
    // FK (0041:485-486) makes a binding that misreports its version's stage
    // unstorable, and reading it here means that refusal never has to fire.
    const rv = await q<{ stage_key: string; requirement_rule_id: string }>(
      `select stage_key, requirement_rule_id from public.requirement_rule_versions where id = $1`,
      [ruleVersionId]);
    expect(b.stage_key).toBe(rv[0]!.stage_key);
    expect(b.requirement_rule_id).toBe(rv[0]!.requirement_rule_id);
    expect(b.bound_rule_version_is_published).toBe(true);

    // The version is published and carries a binding — the state INV-083 says
    // is the only publishable one — and the audit says by what.
    const version = await q<{ status: string }>(
      `select status from public.contract_versions where id = $1`, [body.contractVersionId]);
    expect(version[0]!.status).toBe("published");
    const audit = await q<{ details: Record<string, unknown> }>(
      `select details from public.audit_events
        where action = 'contract_version.published' and object_id = $1`, [body.contractVersionId]);
    expect(audit[0]!.details.boundRuleVersionCount).toBe(1);
    expect(audit[0]!.details.ruleVersionIds).toEqual([ruleVersionId]);
  });

  it("cannot have its set extended after the publish transaction commits", async () => {
    // INV-080 from the other side: the importer may bind inside its own
    // commit, and NOBODY may bind afterwards. Without this, «pinned at
    // publication» would be a property of one route's code rather than of the
    // baseline.
    const { batchId, view } = await readyToPublish();
    const pub = await (await publish(
      batchId, view.version, view.sourceManifestHash, [ruleVersionId])).json();
    const second = await publishBindableRuleVersion(fx.workspaceId, {
      stageKey: "prykhovani-roboty-2",
    });
    // `rule_bindings.manage` has to be granted by hand because it is in NO
    // responsibility preset (M1 review finding 8) — the estimator who publishes
    // a baseline cannot bind to one. Granted here so the refusal under test is
    // INV-080 and not a 403: without it this would pass for the wrong reason.
    const { POST: grant } = await import("../app/v1/projects/[projectId]/access-grants/route");
    await grant(jsonReq("http://x", {
      memberId: fx.memberId, capabilities: ["rule_bindings.manage"],
    }), { params: Promise.resolve({ projectId: fx.projectId }) });
    const { POST: bind } = await import(
      "../app/v1/contract-versions/[versionId]/rule-bindings/route");
    const res = await bind(jsonReq("http://x", { ruleVersionIds: [second.ruleVersionId] }),
      { params: Promise.resolve({ versionId: pub.contractVersionId }) });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("VERSION_CONFLICT");
    expect(Number((await q<{ n: string }>(
      `select count(*) n from public.contract_version_rule_bindings where contract_version_id = $1`,
      [pub.contractVersionId]))[0]!.n)).toBe(1);
  });

  it("refuses a rule version from another workspace as unknown, not as forbidden", async () => {
    // Existence-safe: a version that belongs to somebody else must not be
    // distinguishable from one that does not exist, or the refusal is a
    // cross-tenant oracle (INV-001).
    const { batchId, view } = await readyToPublish();
    const otherFx = await baselineFixture(A, { contractBody: { contractNo: "Д-2026/Ф2" } });
    const foreign = await publishBindableRuleVersion(otherFx.workspaceId);

    const res = await publish(
      batchId, view.version, view.sourceManifestHash, [foreign.ruleVersionId]);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fieldErrors[0].path).toBe("ruleVersionIds[0]");
    expect(await publishedVersions()).toBe(0);

    const unknown = await publish(
      batchId, view.version, view.sourceManifestHash,
      ["11111111-1111-4111-8111-111111111111"]);
    expect(unknown.status).toBe(422);
    expect((await unknown.json()).fieldErrors[0].message)
      .toBe((body.fieldErrors[0] as { message: string }).message);
  });

  it("refuses a retired rule version with a catalogued 422, not a raw foreign-key 500", async () => {
    // INV-067: a version withdrawn from circulation does not enter a NEW
    // baseline. The composite FK on has_been_published cannot express this —
    // a retired version HAS been published — so the command is what refuses,
    // and it must refuse rather than raise.
    const { batchId, view } = await readyToPublish();
    const doomed = await publishBindableRuleVersion(fx.workspaceId, {
      stageKey: "prykhovani-roboty-3",
    });
    const { POST: retire } = await import(
      "../app/v1/requirement-rule-versions/[ruleVersionId]/retire/route");
    const retired = await retire(jsonReq("http://x", {}),
      { params: Promise.resolve({ ruleVersionId: doomed.ruleVersionId }) });
    expect(retired.status, await retired.clone().text()).toBe(200);

    const res = await publish(
      batchId, view.version, view.sourceManifestHash, [doomed.ruleVersionId]);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fieldErrors[0].message).toContain("retired");
    expect(await publishedVersions()).toBe(0);
  });

  it("refuses two versions of ONE rule with a 422 rather than raising 23505", async () => {
    // `unique (workspace_id, contract_version_id, requirement_rule_id)`
    // (0041:476) makes this unstorable, but unstorable reaches the caller as a
    // 500, and a 500 is not a refusal anyone can act on. The request names two
    // DIFFERENT ids, so deduplication cannot catch it — only the lineage can.
    const { batchId, view } = await readyToPublish();
    const rv = await q<{ requirement_rule_id: string }>(
      `select requirement_rule_id from public.requirement_rule_versions where id = $1`,
      [ruleVersionId]);
    const next = await publishBindableRuleVersion(fx.workspaceId, {
      requirementRuleId: rv[0]!.requirement_rule_id,
      stageKey: "prykhovani-roboty-4",
    });
    expect(next.requirementRuleId).toBe(rv[0]!.requirement_rule_id);
    expect(next.ruleVersionId).not.toBe(ruleVersionId);

    const res = await publish(
      batchId, view.version, view.sourceManifestHash, [ruleVersionId, next.ruleVersionId]);
    expect(res.status, await res.clone().text()).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect((body.fieldErrors as { path: string }[]).map((f) => f.path))
      .toEqual(["ruleVersionIds[0]", "ruleVersionIds[1]"]);
    expect(await publishedVersions()).toBe(0);
    expect(Number((await q<{ n: string }>(
      `select count(*) n from public.contract_version_rule_bindings where workspace_id = $1`,
      [fx.workspaceId]))[0]!.n)).toBe(0);
  });

  it("means a repeated id once", async () => {
    const { batchId, view } = await readyToPublish();
    const res = await publish(batchId, view.version, view.sourceManifestHash,
      [ruleVersionId, ruleVersionId, ruleVersionId]);
    expect(res.status, await res.clone().text()).toBe(201);
    expect((await res.json()).boundRuleVersionCount).toBe(1);
    expect(Number((await q<{ n: string }>(
      `select count(*) n from public.contract_version_rule_bindings where workspace_id = $1`,
      [fx.workspaceId]))[0]!.n)).toBe(1);
  });

  it("pins every version of a multi-rule set, not only the first", async () => {
    // A positive control with a set of THREE. With one binding, «pins the set»
    // and «pins a binding» are the same sentence and no assertion separates
    // them.
    const { batchId, view } = await readyToPublish();
    const b = await publishBindableRuleVersion(fx.workspaceId, { stageKey: "prykhovani-roboty-5" });
    const c = await publishBindableRuleVersion(fx.workspaceId, { stageKey: "prykhovani-roboty-6" });
    const res = await publish(batchId, view.version, view.sourceManifestHash,
      [ruleVersionId, b.ruleVersionId, c.ruleVersionId]);
    expect(res.status, await res.clone().text()).toBe(201);
    const body = await res.json();
    expect(body.boundRuleVersionCount).toBe(3);
    const bound = await q<{ requirement_rule_version_id: string }>(
      `select requirement_rule_version_id from public.contract_version_rule_bindings
        where workspace_id = $1 and contract_version_id = $2
        order by requirement_rule_version_id`, [fx.workspaceId, body.contractVersionId]);
    expect(bound.map((r) => r.requirement_rule_version_id).sort())
      .toEqual([ruleVersionId, b.ruleVersionId, c.ruleVersionId].sort());
  });
});
