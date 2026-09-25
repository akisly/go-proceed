/**
 * v0.1-M1 vertical test (delivery gate, docs/delivery/version-0.1.md):
 * import a sanitized estimate; resolve one mismatch; publish; reimport and
 * verify diff plus lineage; prove published immutability — end to end through
 * the real route handlers, RLS, and database.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { q, truncateAll, jsonReq, publishBindableRuleVersion } from "./helpers/fixtures";
import { buildEstimateV1, buildEstimateV2, MAPPING_V1, V1_EXPECTED_NET_MINOR } from "./helpers/estimate-fixture";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // засновниця
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // запрошена адміністраторка
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // стороння особа
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

// Shared journey state (vitest runs a single file serially).
let workspaceId: string;
let projectId: string;
let ownParty1: string;
let ownParty2: string;
let customerParty: string;
let contract1: string;
let batch1: string;
let batch1View: { version: number; sourceManifestHash: string; rowResults: { rowResultId: string; errorCodes: string[]; severity: string }[] };
let v1: { contractVersionId: string; versionNo: number };
let v1Snapshot: unknown;
/**
 * The rule-version set both publications pin. INV-083 refuses a baseline
 * without one on this route as well as on the manual one, so it is part of the
 * vertical rather than an aside: an estimate that reaches a published baseline
 * carrying no obligations is the state ADR-005 decision 2 exists to prevent.
 */
let ruleVersionId: string;

const call = async (mod: Promise<{ POST?: unknown; GET?: unknown; PUT?: unknown; PATCH?: unknown }>,
  method: "POST" | "GET" | "PUT" | "PATCH", url: string, body: unknown, params: Record<string, string>) => {
  const routes = await mod;
  const handler = routes[method] as (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
  const req = method === "GET"
    ? new Request(url)
    : jsonReq(url, body, method);
  return handler(req, { params: Promise.resolve(params) });
};

async function addXlsx(batchId: string, name: string, bytes: Uint8Array): Promise<Response> {
  const { POST } = await import("./helpers/fixtures").then(() => import("../app/v1/import-batches/[batchId]/files/route"));
  const fd = new FormData();
  fd.append("file", new File([bytes as BlobPart], name));
  return POST(new Request("http://x", {
    method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: fd,
  }), { params: Promise.resolve({ batchId }) });
}

beforeAll(async () => { await truncateAll(); current = A; }, 120_000);

describe("v0.1-M1 vertical: parties → contracts → import → publish → reimport", () => {
  it("1. bootstrap: A creates the workspace, invites B as admin, B accepts", async () => {
    const w = await call(import("../app/v1/workspaces/route"), "POST", "http://x",
      { displayName: "Приклад-Генпідряд" }, {});
    expect(w.status).toBe(201);
    workspaceId = (await w.json()).workspaceId;
    const inv = await call(import("../app/v1/workspaces/[workspaceId]/invitations/route"), "POST", "http://x",
      { email: "b@example.test", role: "admin" }, { workspaceId });
    const token = (await inv.json()).token as string;
    current = B;
    const acc = await call(import("../app/v1/invitations/accept/route"), "POST", "http://x", { token }, {});
    expect(acc.status).toBe(200);
    expect((await acc.json()).role).toBe("admin");
  });

  it("2. parties: two OWN legal entities (owner-only own profiles) and a customer", async () => {
    current = A;
    const mk = async (name: string): Promise<string> => {
      const r = await call(import("../app/v1/workspaces/[workspaceId]/parties/route"), "POST", "http://x",
        { displayName: name }, { workspaceId });
      return (await r.json()).partyId;
    };
    ownParty1 = await mk("Приклад-Будівельна компанія");
    ownParty2 = await mk("Приклад-Спецмонтаж");
    customerParty = await mk("Приклад-Замовник-Девелопмент");
    const putLegal = (partyId: string, name: string, edrpou: string) =>
      call(import("../app/v1/parties/[partyId]/legal-profile/route"), "PUT", "http://x",
        { officialName: name, edrpou }, { partyId });
    await putLegal(ownParty1, "ТОВ Приклад-Будівельна компанія", "12345678");
    await putLegal(ownParty2, "ТОВ Приклад-Спецмонтаж", "87654321");
    await putLegal(customerParty, "ТОВ Приклад-Замовник-Девелопмент", "11223344");
    for (const p of [ownParty1, ownParty2]) {
      const r = await call(import("../app/v1/parties/[partyId]/own-profile/route"), "POST", "http://x", {}, { partyId: p });
      expect(r.status).toBe(201);
    }
  });

  it("3. project by B (admin) + grants to A", async () => {
    current = B;
    const p = await call(import("../app/v1/workspaces/[workspaceId]/projects/route"), "POST", "http://x",
      { name: "Приклад-ЖК Сонячний" }, { workspaceId });
    expect(p.status).toBe(201);
    projectId = (await p.json()).projectId;
    const ma = await q<{ id: string }>(
      "select id from public.memberships where organization_id=$1 and user_id=$2", [workspaceId, A]);
    const g = await call(import("../app/v1/projects/[projectId]/access-grants/route"), "POST", "http://x",
      { memberId: ma[0]!.id, capabilities: ["contracts.edit", "imports.manage", "imports.publish"] }, { projectId });
    expect(g.status).toBe(201);
  });

  it("4. one project holds contracts of DIFFERENT own parties with the same number", async () => {
    current = A;
    const mkContract = async (ownPartyId: string) => call(
      import("../app/v1/projects/[projectId]/contracts/route"), "POST", "http://x",
      { ownPartyId, customerPartyId: customerParty, contractNo: "Д-2026/07",
        currency: "UAH", taxMode: "exclusive", taxRateBps: 2000 }, { projectId });
    const c1 = await mkContract(ownParty1);
    expect(c1.status).toBe(201);
    contract1 = (await c1.json()).contractId;
    const c2 = await mkContract(ownParty2);
    expect(c2.status).toBe(201); // same number, different own party (INV-022 scope)
    const dup = await mkContract(ownParty1);
    expect(dup.status).toBe(409); // same number, same own party
  });

  it("5. import: sanitized estimate XLSX validates with exactly one blocking mismatch", async () => {
    const b = await call(import("../app/v1/contracts/[contractId]/import-batches/route"), "POST", "http://x",
      {}, { contractId: contract1 });
    batch1 = (await b.json()).batchId;
    const up = await addXlsx(batch1, "приклад-кошторис.xlsx", await buildEstimateV1());
    expect(up.status).toBe(201);
    const val = await call(import("../app/v1/import-batches/[batchId]/validate/route"), "POST", "http://x",
      { mapping: MAPPING_V1, config: { headerRow: 1, locale: "uk-UA" }, expectedVersion: 2 }, { batchId: batch1 });
    expect(val.status).toBe(200);
    batch1View = await val.json();
    expect((batch1View as { status: string }).status).toBe("validated");
    expect((batch1View as { needsResolutionCount: number }).needsResolutionCount).toBe(1);
    const formulaWarn = batch1View.rowResults.filter((r) => r.errorCodes.includes("FORMULA_CELL"));
    expect(formulaWarn.length).toBe(1);
    expect(formulaWarn[0]!.severity).toBe("warning"); // inert formula, never blocking
  });

  it("6. resolve the mismatch, revalidate to preview_ready, publish v1 with exact totals", async () => {
    const mismatch = batch1View.rowResults.find((r) => r.errorCodes.includes("AMOUNT_MISMATCH"))!;
    const res = await call(import("../app/v1/import-batches/[batchId]/resolutions/route"), "POST", "http://x",
      { rowResultId: mismatch.rowResultId, chosenBasis: "approved_source_amount",
        reason: "Сума з урахуванням транспортних витрат" }, { batchId: batch1 });
    expect(res.status).toBe(201);
    const reval = await call(import("../app/v1/import-batches/[batchId]/validate/route"), "POST", "http://x",
      { mapping: MAPPING_V1, config: { headerRow: 1, locale: "uk-UA" }, expectedVersion: batch1View.version },
      { batchId: batch1 });
    batch1View = await reval.json();
    expect((batch1View as { status: string }).status).toBe("preview_ready");

    // INV-083 IS PART OF THE VERTICAL, so it is exercised in both directions
    // rather than satisfied silently: first the refusal, then the publication.
    // The library row this cites was seeded by workspaces.create in step 1 —
    // if that seeding is ever removed, this line is where the vertical stops.
    const unbound = await call(import("../app/v1/import-batches/[batchId]/publish/route"), "POST", "http://x",
      { expectedVersion: batch1View.version, confirmedManifestHash: batch1View.sourceManifestHash },
      { batchId: batch1 });
    expect(unbound.status).toBe(409);
    expect((await unbound.json()).code).toBe("RULE_BINDING_REQUIRED");
    expect((await q<{ n: string }>(
      `select count(*) n from public.contract_versions where workspace_id=$1`, [workspaceId]))[0]!.n)
      .toBe("0");

    ({ ruleVersionId } = await publishBindableRuleVersion(workspaceId));
    const pub = await call(import("../app/v1/import-batches/[batchId]/publish/route"), "POST", "http://x",
      { expectedVersion: batch1View.version, confirmedManifestHash: batch1View.sourceManifestHash,
        ruleVersionIds: [ruleVersionId] },
      { batchId: batch1 });
    expect(pub.status).toBe(201);
    v1 = await pub.json();
    expect(v1.versionNo).toBe(1);
    expect((v1 as { boundRuleVersionCount?: number }).boundRuleVersionCount).toBe(1);
    const bound = await q<{ requirement_rule_version_id: string }>(
      `select requirement_rule_version_id from public.contract_version_rule_bindings
        where workspace_id=$1 and contract_version_id=$2`, [workspaceId, v1.contractVersionId]);
    expect(bound.map((b) => b.requirement_rule_version_id)).toEqual([ruleVersionId]);
    const items = await q<{ net: string }>(
      `select sum(net_amount_minor_units)::text net from public.work_items
        where workspace_id=$1 and contract_version_id=$2`, [workspaceId, v1.contractVersionId]);
    expect(items[0]!.net).toBe(V1_EXPECTED_NET_MINOR);
  });

  it("7. reimport publishes v2 with diff {added 1, removed 1, changed 2, unchanged 5} and lineage", async () => {
    const b2 = await call(import("../app/v1/contracts/[contractId]/import-batches/route"), "POST", "http://x",
      {}, { contractId: contract1 });
    const batch2 = (await b2.json()).batchId;
    const up2 = await addXlsx(batch2, "приклад-кошторис-v2.xlsx", await buildEstimateV2());
    expect(up2.status).toBe(201);
    const val2body = await (await call(import("../app/v1/import-batches/[batchId]/validate/route"), "POST", "http://x",
      { mapping: MAPPING_V1, config: { headerRow: 1, locale: "uk-UA" }, expectedVersion: 2 }, { batchId: batch2 })).json();
    // With its failure codes, so a failed parse names itself in the log (BL-064).
    expect({ status: val2body.status, failureCodes: val2body.failureCodes })
      .toEqual({ status: "preview_ready", failureCodes: [] });
    // The SAME rule version v1 bound. The uniqueness that stops a rule
    // contributing twice is per contract version, and v2 is a new one — so a
    // reimport pins the same obligations to the new baseline rather than
    // inheriting them, which is what «the binding is pinned in the same commit
    // and never acquired later» (INV-080) means for a superseding version.
    const pub2 = await (await call(import("../app/v1/import-batches/[batchId]/publish/route"), "POST", "http://x",
      { expectedVersion: val2body.version, confirmedManifestHash: val2body.sourceManifestHash,
        ruleVersionIds: [ruleVersionId] },
      { batchId: batch2 })).json();
    expect(pub2.versionNo).toBe(2);
    expect(pub2.boundRuleVersionCount).toBe(1);
    expect(pub2.supersedesVersionId).toBe(v1.contractVersionId);

    const v1Resp = await call(import("../app/v1/contracts/[contractId]/versions/[versionNo]/route"), "GET",
      "http://x", null, { contractId: contract1, versionNo: "1" });
    v1Snapshot = await v1Resp.json();
    const v2Resp = await (await call(import("../app/v1/contracts/[contractId]/versions/[versionNo]/route"), "GET",
      "http://x", null, { contractId: contract1, versionNo: "2" })).json();
    // changed = 2: 1.2 (quantity 310→330) AND 1.5 — its v1 canonical value was
    // the APPROVED source amount (8 162,50); v2 reverts to the derived
    // 8 012,50, which is a real monetary change the diff must surface.
    expect(v2Resp.diff).toEqual({ added: 1, removed: 1, changed: 2, unchanged: 5 });
    const changed = v2Resp.workItems.find((w: { sourceKey: string }) => w.sourceKey === "1.2");
    const v1Items = (v1Snapshot as { workItems: { workItemId: string; sourceKey: string }[] }).workItems;
    expect(changed.predecessorWorkItemId)
      .toBe(v1Items.find((w) => w.sourceKey === "1.2")!.workItemId);
  });

  it("8. published immutability: v1 identical after v2; direct mutation rejected; re-publish 409", async () => {
    const v1Again = await (await call(import("../app/v1/contracts/[contractId]/versions/[versionNo]/route"), "GET",
      "http://x", null, { contractId: contract1, versionNo: "1" })).json();
    expect(v1Again).toEqual(v1Snapshot);
    await expect(q("update public.contract_versions set currency='USD' where id=$1", [v1.contractVersionId]))
      .rejects.toThrow(/immutable/i);
    await expect(q("delete from public.work_items where contract_version_id=$1", [v1.contractVersionId]))
      .rejects.toThrow(/immutable/i);
    // Named with a valid rule-version set on purpose: the refusal under test is
    // «this batch is already published», and a request that would ALSO fail
    // INV-083 could not tell the two apart. The code is asserted for the same
    // reason — three of this route's four refusals are 409.
    const again = await call(import("../app/v1/import-batches/[batchId]/publish/route"), "POST", "http://x",
      { expectedVersion: (batch1View as { version: number }).version + 1,
        confirmedManifestHash: batch1View.sourceManifestHash,
        ruleVersionIds: [ruleVersionId] }, { batchId: batch1 });
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe("IMPORT_JOB_CONFLICT");
  });

  it("9. INV-001 coda: an outsider sees nothing across every surface", async () => {
    current = C;
    const projects = await (await call(import("../app/v1/projects/route"), "GET", "http://x", null, {})).json();
    expect(projects.projects).toEqual([]);
    expect((await call(import("../app/v1/import-batches/[batchId]/route"), "GET", "http://x", null, { batchId: batch1 })).status).toBe(404);
    expect((await call(import("../app/v1/contracts/[contractId]/versions/[versionNo]/route"), "GET",
      "http://x", null, { contractId: contract1, versionNo: "1" })).status).toBe(404);
  });
});
