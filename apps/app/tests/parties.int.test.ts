import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // owner
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // admin
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // member
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
async function q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: admin }); await c.connect();
  const r = await c.query(sql, p); await c.end(); return r.rows as T[];
}

let workspaceId: string;

beforeEach(async () => {
  const c = new Client({ connectionString: admin }); await c.connect();
  await c.query("truncate public.organizations cascade");
  await c.query("truncate public.audit_events, public.transaction_outbox, public.idempotency_records cascade");
  await c.end();
  current = A;
  const { POST } = await import("../app/v1/workspaces/route");
  const res = await POST(new Request("http://x/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({ displayName: "Приклад-Простір" }),
  }), { params: Promise.resolve({}) });
  workspaceId = (await res.json()).workspaceId;
  await q("insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'admin','active')", [workspaceId, B]);
  await q("insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'member','active')", [workspaceId, C]);
});

const jsonReq = (url: string, method: string, body: unknown) =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });

async function createParty(name: string) {
  const { POST } = await import("../app/v1/workspaces/[workspaceId]/parties/route");
  return POST(jsonReq(`http://x/v1/workspaces/${workspaceId}/parties`, "POST", { displayName: name }),
    { params: Promise.resolve({ workspaceId }) });
}
async function putLegal(partyId: string, body: Record<string, unknown>) {
  const { PUT } = await import("../app/v1/parties/[partyId]/legal-profile/route");
  return PUT(jsonReq(`http://x/v1/parties/${partyId}/legal-profile`, "PUT", body),
    { params: Promise.resolve({ partyId }) });
}
async function createOwn(partyId: string) {
  const { POST } = await import("../app/v1/parties/[partyId]/own-profile/route");
  return POST(jsonReq(`http://x/v1/parties/${partyId}/own-profile`, "POST", {}),
    { params: Promise.resolve({ partyId }) });
}

describe("parties.create permission matrix", () => {
  it("owner and admin create parties; member is denied (SCOPE_DENIED)", async () => {
    expect((await createParty("Приклад-Один")).status).toBe(201);
    current = B;
    expect((await createParty("Приклад-Два")).status).toBe(201);
    current = C;
    const denied = await createParty("Приклад-Три");
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe("SCOPE_DENIED");
  });
});

describe("parties.update", () => {
  it("optimistic version: stale expectedVersion → 409 VERSION_CONFLICT", async () => {
    const partyId = (await (await createParty("Приклад-Ред")).json()).partyId as string;
    const { PATCH } = await import("../app/v1/parties/[partyId]/route");
    const ok = await PATCH(jsonReq(`http://x/v1/parties/${partyId}`, "PATCH",
      { displayName: "Приклад-Ред-2", expectedVersion: 1 }), { params: Promise.resolve({ partyId }) });
    expect(ok.status).toBe(200);
    expect((await ok.json()).version).toBe(2);
    const stale = await PATCH(jsonReq(`http://x/v1/parties/${partyId}`, "PATCH",
      { displayName: "Приклад-Ред-3", expectedVersion: 1 }), { params: Promise.resolve({ partyId }) });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe("VERSION_CONFLICT");
  });

  it("a party id from a foreign workspace is a 404 (INV-001 API surface)", async () => {
    const partyId = (await (await createParty("Приклад-Чужа")).json()).partyId as string;
    // B2 workspace owner (user B) should not reach W1's party — make B an
    // outsider by using a fresh workspace-less actor: C stays a member of W1,
    // so use a brand-new user with no membership anywhere: reuse B but first
    // remove B's W1 membership.
    await q("update public.memberships set status='ended' where organization_id=$1 and user_id=$2", [workspaceId, B]);
    current = B;
    const { PATCH } = await import("../app/v1/parties/[partyId]/route");
    const res = await PATCH(jsonReq(`http://x/v1/parties/${partyId}`, "PATCH",
      { displayName: "X", expectedVersion: 1 }), { params: Promise.resolve({ partyId }) });
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("RESOURCE_NOT_FOUND");
  });
});

describe("legal profile PUT", () => {
  it("creates then updates with version bump; stale version conflicts", async () => {
    const partyId = (await (await createParty("Приклад-Юр")).json()).partyId as string;
    current = B; // admin holds parties.manage
    const created = await putLegal(partyId, { officialName: "ТОВ Приклад-Юр", edrpou: "12345678" });
    expect(created.status).toBe(201);
    const updated = await putLegal(partyId, { officialName: "ТОВ Приклад-Юр-2", edrpou: "12345678", expectedVersion: 1 });
    expect(updated.status).toBe(200);
    expect((await updated.json()).version).toBe(2);
    const stale = await putLegal(partyId, { officialName: "ТОВ Приклад-Юр-3", expectedVersion: 1 });
    expect(stale.status).toBe(409);
  });
});

describe("own profile (INV-020)", () => {
  it("admin is denied; owner succeeds; row exists", async () => {
    const partyId = (await (await createParty("Приклад-Власна")).json()).partyId as string;
    await putLegal(partyId, { officialName: "ТОВ Приклад-Власна", edrpou: "12345678" });
    current = B; // admin: parties.manage yes, own_legal_profiles.manage NO
    const denied = await createOwn(partyId);
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe("SCOPE_DENIED");
    current = A; // owner
    const ok = await createOwn(partyId);
    expect(ok.status).toBe(201);
    const rows = await q("select 1 from public.own_legal_entity_profiles where workspace_id=$1 and party_id=$2", [workspaceId, partyId]);
    expect(rows).toHaveLength(1);
  });

  it("own profile without a complete legal profile → 422 VALIDATION_FAILED", async () => {
    const partyId = (await (await createParty("Приклад-Неповна")).json()).partyId as string;
    const noProfile = await createOwn(partyId);
    expect(noProfile.status).toBe(422);
    await putLegal(partyId, { officialName: "ТОВ Приклад-Неповна" }); // no edrpou
    const noEdrpou = await createOwn(partyId);
    expect(noEdrpou.status).toBe(422);
    expect((await noEdrpou.json()).code).toBe("VALIDATION_FAILED");
  });
});
