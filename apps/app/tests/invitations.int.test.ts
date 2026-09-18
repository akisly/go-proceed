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

async function inviteWithKey(workspaceId: string, raw: string, key: string) {
  const { POST } = await import("../app/v1/workspaces/[workspaceId]/invitations/route");
  return POST(new Request(`http://x/v1/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: raw,
  }), { params: Promise.resolve({ workspaceId }) });
}

// Every column a stored copy of the token could sit in: the idempotency record
// (body and headers), the audit detail and the outbox payload.
async function storedCopies(token: string): Promise<number> {
  const r = await q<{ n: string }>(
    `select (select count(*) from public.idempotency_records
              where response_body::text like '%' || $1 || '%'
                 or response_headers::text like '%' || $1 || '%')
          + (select count(*) from public.audit_events where details::text like '%' || $1 || '%')
          + (select count(*) from public.transaction_outbox where payload::text like '%' || $1 || '%') n`,
    [token]);
  return Number(r[0].n);
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

// BL-104 / DEV-019 / INV-102: the raw token is returned by the execution that
// created it and by nothing else. withIdempotency stores whatever its callback
// returns, so a token inside that body lived in idempotency_records for thirty
// days while public.invitations kept only its hash.
describe("POST /v1/workspaces/{id}/invitations — the token is never stored (BL-104)", () => {
  it("a fresh create returns the token once, and no stored record carries it", async () => {
    const w = await createWorkspace();
    const res = await invite(w, { email: "b@example.test", role: "member" });
    expect(res.status).toBe(201);
    const body = await res.json();
    // The record exists and holds exactly the receipt, so the absence checks
    // below cannot pass on an empty table or a secret under another key.
    const record = await q<{ response_body: unknown }>(
      `select response_body from public.idempotency_records
        where operation_id = 'invitations.create' and organization_id = $1`, [w]);
    expect(record).toHaveLength(1);
    expect(record[0].response_body).toEqual({ invitationId: body.invitationId, expiresAt: body.expiresAt });
    expect(await storedCopies(body.invitationId)).toBeGreaterThanOrEqual(1);
    const stored = await q<{ n: string }>(
      `select count(*) n from public.idempotency_records
        where operation_id = 'invitations.create' and response_body ? 'token'`);
    expect(Number(stored[0].n)).toBe(0);
    expect(await storedCopies(body.token)).toBe(0);
    expect(body.kind).toBe("issued");
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    const rows = await q<{ token_hash: string }>("select token_hash from public.invitations where workspace_id=$1", [w]);
    expect(rows[0].token_hash).toBe(createHash("sha256").update(body.token).digest("hex"));
  });

  it("a replay of the same key and body returns the receipt without the token", async () => {
    const w = await createWorkspace();
    const raw = JSON.stringify({ email: "b@example.test", role: "member" });
    const key = crypto.randomUUID();
    const first = await inviteWithKey(w, raw, key);
    expect(first.status).toBe(201);
    const issued = await first.json();

    const again = await inviteWithKey(w, raw, key);
    expect(again.status).toBe(201);
    const replayed = await again.json();
    expect(replayed).not.toHaveProperty("token");
    expect(JSON.stringify(replayed)).not.toContain(issued.token);
    expect(replayed).toEqual({ kind: "replayed", invitationId: issued.invitationId, expiresAt: issued.expiresAt });
    expect(again.headers.get("idempotency-replay-until")).toBe(first.headers.get("idempotency-replay-until"));
    const n = await q<{ n: string }>("select count(*) n from public.invitations where workspace_id=$1", [w]);
    expect(Number(n[0].n)).toBe(1);

    // Option (a), owner 2026-09-18: the replay does not rotate the token, so
    // the one the first response carried still admits.
    current = B;
    expect((await accept(issued.token)).status).toBe(200);
  });

  it("a replay over a record stored before the fix does not serve its token", async () => {
    const w = await createWorkspace();
    const raw = JSON.stringify({ email: "old@example.test", role: "member" });
    const key = crypto.randomUUID();
    const oldToken = "ab".repeat(32);
    const invitationId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    await q(
      `insert into public.idempotency_records
         (organization_id, actor_scope, operation_id, idempotency_key, request_hash,
          state, response_status, response_body, response_headers, expires_at, completed_at)
       values ($1, $2, 'invitations.create', $3, $4, 'completed', 201, $5::jsonb, '{}'::jsonb,
               now() + interval '1 day', now())`,
      [w, `user:${A}`, key, createHash("sha256").update(raw).digest("hex"),
       JSON.stringify({ invitationId, token: oldToken, expiresAt })]);

    const res = await inviteWithKey(w, raw, key);
    expect(res.status).toBe(201);
    const text = await res.text();
    expect(text).not.toContain(oldToken);
    expect(JSON.parse(text)).toEqual({ kind: "replayed", invitationId, expiresAt });
  });

  it("a replay by an admin who has since lost the role carries no token (the status is BL-103's)", async () => {
    const w = await createWorkspace();
    const raw = JSON.stringify({ email: "b@example.test", role: "member" });
    const key = crypto.randomUUID();
    const issued = await (await inviteWithKey(w, raw, key)).json();
    expect(issued.kind).toBe("issued");
    expect(issued.token).toMatch(/^[0-9a-f]{64}$/);
    await q("update public.memberships set role = 'member' where organization_id = $1 and user_id = $2", [w, A]);

    // The status is not pinned: 201 today, 403 once BL-103 (DEV-020) checks
    // authority before the replay. Either way the response carries no token.
    const res = await inviteWithKey(w, raw, key);
    expect([201, 403]).toContain(res.status);
    const text = await res.text();
    expect(text).not.toContain(issued.token);
    if (res.status === 201) {
      expect(JSON.parse(text)).toEqual({ kind: "replayed", invitationId: issued.invitationId, expiresAt: issued.expiresAt });
    }
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
