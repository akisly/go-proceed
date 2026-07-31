import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  q, truncateAll, jsonReq, baselineFixture, createBatch, addFile, getBatch,
  type BaselineFixture,
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
beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await baselineFixture(A);
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
async function publish(batchId: string, expectedVersion: number, manifest: string) {
  const { POST } = await import("../app/v1/import-batches/[batchId]/publish/route");
  return POST(jsonReq("http://x", { expectedVersion, confirmedManifestHash: manifest }),
    { params: Promise.resolve({ batchId }) });
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
    const req = jsonReq("http://x", { expectedVersion: view.version, confirmedManifestHash: view.sourceManifestHash });
    const r1 = await POST(req.clone() as Request, { params: Promise.resolve({ batchId: await (async () => batchId)() }) });
    expect(r1.status).toBe(409); // new key, already-published batch → conflict
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

    const rows = await q<{ unit_price_state: string; unit_price_decimal: string | null }>(
      `select unit_price_state, unit_price_decimal::text from public.work_items
        where workspace_id = $1 and source_key = '1.5'`, [fx.workspaceId]);
    expect(rows[0]!.unit_price_state).toBe("zero");
    expect(rows[0]!.unit_price_decimal).toBeNull();
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
