import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
async function q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: admin }); await c.connect();
  const r = await c.query(sql, p); await c.end(); return r.rows as T[];
}

const jsonReq = (url: string, body: unknown, method = "POST") =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });

let workspaceId: string;
let projectId: string;
let ownPartyId: string;
let customerPartyId: string;
let memberIdC: string;

async function createParty(name: string): Promise<string> {
  const { POST } = await import("../app/v1/workspaces/[workspaceId]/parties/route");
  const res = await POST(jsonReq(`http://x`, { displayName: name }), { params: Promise.resolve({ workspaceId }) });
  return (await res.json()).partyId;
}
async function makeOwn(partyId: string, edrpou: string): Promise<void> {
  const { PUT } = await import("../app/v1/parties/[partyId]/legal-profile/route");
  await PUT(jsonReq(`http://x`, { officialName: `ТОВ Приклад-${edrpou}`, edrpou }, "PUT"), { params: Promise.resolve({ partyId }) });
  const { POST } = await import("../app/v1/parties/[partyId]/own-profile/route");
  await POST(jsonReq(`http://x`, {}), { params: Promise.resolve({ partyId }) });
}
async function createContract(body: Record<string, unknown>) {
  const { POST } = await import("../app/v1/projects/[projectId]/contracts/route");
  return POST(jsonReq(`http://x/v1/projects/${projectId}/contracts`, {
    currency: "UAH", taxMode: "exclusive", taxRateBps: 2000, ...body,
  }), { params: Promise.resolve({ projectId }) });
}

beforeEach(async () => {
  const c = new Client({ connectionString: admin }); await c.connect();
  await c.query("truncate public.organizations cascade");
  await c.query("truncate public.audit_events, public.transaction_outbox, public.idempotency_records cascade");
  await c.end();
  current = A;
  const { POST: createW } = await import("../app/v1/workspaces/route");
  const w = await createW(jsonReq("http://x/v1/workspaces", { displayName: "Приклад-Контракти" }), { params: Promise.resolve({}) });
  workspaceId = (await w.json()).workspaceId;
  const { POST: createP } = await import("../app/v1/workspaces/[workspaceId]/projects/route");
  const p = await createP(jsonReq("http://x", { name: "Приклад-Обʼєкт" }), { params: Promise.resolve({ workspaceId }) });
  projectId = (await p.json()).projectId;
  // A already has project.admin+view from INV-019; add contracts.edit.
  const me = await q<{ id: string }>("select id from public.memberships where organization_id=$1 and user_id=$2", [workspaceId, A]);
  const { POST: grant } = await import("../app/v1/projects/[projectId]/access-grants/route");
  await grant(jsonReq("http://x", { memberId: me[0].id, capabilities: ["contracts.edit"] }), { params: Promise.resolve({ projectId }) });
  ownPartyId = await createParty("Приклад-Власна");
  await makeOwn(ownPartyId, "12345678");
  customerPartyId = await createParty("Приклад-Замовник");
  const cm = await q<{ id: string }>(
    "insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'member','active') returning id",
    [workspaceId, C]);
  memberIdC = cm[0].id;
});

describe("contracts.create", () => {
  it("creates with normalized number", async () => {
    const res = await createContract({ ownPartyId, customerPartyId, contractNo: "  д-2026/01 " });
    expect(res.status).toBe(201);
    const rows = await q<{ normalized_contract_no: string }>(
      "select normalized_contract_no from public.contracts where workspace_id=$1", [workspaceId]);
    expect(rows[0].normalized_contract_no).toBe("Д-2026/01");
  });

  it("INV-022: duplicate normalized number per own party → 409; different own party → 201", async () => {
    expect((await createContract({ ownPartyId, customerPartyId, contractNo: "Д-2026/07" })).status).toBe(201);
    const dup = await createContract({ ownPartyId, customerPartyId, contractNo: " д-2026/07" });
    expect(dup.status).toBe(409);
    expect((await dup.json()).code).toBe("VERSION_CONFLICT");
    expect((await q<{ n: string }>("select count(*) n from public.contracts where workspace_id=$1", [workspaceId]))[0].n).toBe("1");
    const own2 = await createParty("Приклад-Спецмонтаж");
    await makeOwn(own2, "87654321");
    const other = await createContract({ ownPartyId: own2, customerPartyId, contractNo: "Д-2026/07" });
    expect(other.status).toBe(201);
  });

  it("INV-002: ownPartyId without an own profile → 422; no row created", async () => {
    const res = await createContract({ ownPartyId: customerPartyId, customerPartyId: ownPartyId, contractNo: "Д-2026/09" });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDATION_FAILED");
    expect((await q<{ n: string }>("select count(*) n from public.contracts", []))[0].n).toBe("0");
  });

  it("ownPartyId === customerPartyId → 422 (zod refine)", async () => {
    const res = await createContract({ ownPartyId, customerPartyId: ownPartyId, contractNo: "Д-2026/10" });
    expect(res.status).toBe(422);
  });

  it("actor with project.view but not contracts.edit → 403 SCOPE_PROJECT_DENIED", async () => {
    const { POST: grant } = await import("../app/v1/projects/[projectId]/access-grants/route");
    await grant(jsonReq("http://x", { memberId: memberIdC, capabilities: ["project.view"] }), { params: Promise.resolve({ projectId }) });
    current = C;
    const res = await createContract({ ownPartyId, customerPartyId, contractNo: "Д-2026/11" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });
});
