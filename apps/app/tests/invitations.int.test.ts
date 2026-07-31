import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "pg";
import { createHash } from "node:crypto";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
async function q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: admin }); await c.connect();
  const r = await c.query(sql, p); await c.end(); return r.rows as T[];
}

beforeEach(async () => {
  const c = new Client({ connectionString: admin }); await c.connect();
  await c.query("truncate public.organizations cascade");
  await c.query("truncate public.audit_events, public.transaction_outbox, public.idempotency_records cascade");
  await c.end();
  current = A;
});

async function createWorkspace(): Promise<string> {
  const { POST } = await import("../app/v1/workspaces/route");
  const res = await POST(new Request("http://x/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({ displayName: "Приклад-Простір" }),
  }), { params: Promise.resolve({}) });
  return (await res.json()).workspaceId as string;
}

async function invite(workspaceId: string, body: Record<string, unknown>) {
  const { POST } = await import("../app/v1/workspaces/[workspaceId]/invitations/route");
  return POST(new Request(`http://x/v1/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ workspaceId }) });
}

async function accept(token: string) {
  const { POST } = await import("../app/v1/invitations/accept/route");
  return POST(new Request("http://x/v1/invitations/accept", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({ token }),
  }), { params: Promise.resolve({}) });
}

describe("POST /v1/workspaces/{id}/invitations", () => {
  it("owner issues an invitation; DB stores only the hash; outbox carries no token", async () => {
    const w = await createWorkspace();
    const res = await invite(w, { email: "b@example.test", role: "member" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    const rows = await q<{ token_hash: string }>("select token_hash from public.invitations where workspace_id=$1", [w]);
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(createHash("sha256").update(body.token).digest("hex"));
    expect(rows[0].token_hash).not.toBe(body.token);
    const outbox = await q<{ n: string }>(
      "select count(*) n from public.transaction_outbox where topic='invitation.issued' and payload::text like '%' || $1 || '%'",
      [body.token]);
    expect(Number(outbox[0].n)).toBe(0);
  });

  it("a member-role actor cannot invite (403 SCOPE_DENIED)", async () => {
    const w = await createWorkspace();
    await q("insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'member','active')", [w, B]);
    current = B;
    const res = await invite(w, { email: "c@example.test", role: "member" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_DENIED");
  });

  it("an outsider cannot invite into a foreign workspace (403 MEMBERSHIP_INACTIVE)", async () => {
    const w = await createWorkspace();
    current = B;
    const res = await invite(w, { email: "c@example.test", role: "member" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("MEMBERSHIP_INACTIVE");
  });
});

describe("POST /v1/invitations/accept", () => {
  it("invited user accepts once; second accept and unknown tokens are existence-safe 404", async () => {
    const w = await createWorkspace();
    const token = (await (await invite(w, { email: "b@example.test", role: "member" })).json()).token as string;

    current = B;
    const res = await accept(token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaceId).toBe(w);
    expect(body.role).toBe("member");
    const m = await q<{ status: string }>("select status from public.memberships where organization_id=$1 and user_id=$2", [w, B]);
    expect(m[0].status).toBe("active");
    const inv = await q<{ status: string }>("select status from public.invitations where workspace_id=$1", [w]);
    expect(inv[0].status).toBe("accepted");

    const again = await accept(token);
    expect(again.status).toBe(404);
    expect((await again.json()).code).toBe("RESOURCE_NOT_FOUND");

    const unknown = await accept("cd".repeat(32));
    expect(unknown.status).toBe(404);
  });

  it("accepting while already a member → 409 VERSION_CONFLICT", async () => {
    const w = await createWorkspace();
    const t1 = (await (await invite(w, { email: "b@example.test", role: "member" })).json()).token as string;
    current = B;
    await accept(t1);
    current = A;
    const t2 = (await (await invite(w, { email: "b2@example.test", role: "auditor" })).json()).token as string;
    current = B;
    const res = await accept(t2);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("VERSION_CONFLICT");
  });
});
