import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { ADMIN_URL, q } from "./helpers/fixtures";

/**
 * DEV-021 / BL-107 / ADR-012: an owner or admin revokes a pending invitation.
 *
 * Since DEV-019 the server keeps only the invitation token's hash, so an admin
 * who lost the create response could neither recover the token nor withdraw
 * the invitation, and the pending-address index refused a new invitation to
 * the same address until the old one expired (up to 720 hours). A leaked link
 * admitted whoever held it for as long (BL-013).
 *
 * THIS FILE TRUNCATES NOTHING. It seeds its own workspaces with fixed `de21…`
 * ids and deletes exactly those rows afterwards (the catalog-driven technique
 * of packages/testing's dropWorkspaces), plus the recipients' own accept
 * records, which carry no workspace. Fixed-id auth.users rows outlive it, as in
 * every other suite. It needs APP_DB_URL.
 */

const id = (tail: string) => `de210000-0000-4000-8000-${tail.padStart(12, "0")}`;
const OWNER = id("a1"), ADMIN = id("a2"), MEMBER = id("a3"), AUDITOR = id("a4");
const OUTSIDER = id("a5"), OWNER_B = id("a6");
const RECIPIENTS = ["b1", "b2", "b3", "b4", "b5"].map(id);
const WS = { a: id("1"), b: id("2"), ended: id("3"), demoted: id("4") } as const;
const ALL = Object.values(WS);

let current = OWNER;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

async function dropWorkspaces(ids: readonly string[]): Promise<void> {
  const c = new Client({ connectionString: ADMIN_URL });
  await c.connect();
  try {
    const scoped = await c.query<{ table_name: string; column_name: string }>(
      `select c.table_name, c.column_name
         from information_schema.columns c
         join information_schema.tables t
           on t.table_schema = c.table_schema and t.table_name = c.table_name
        where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
          and c.column_name in ('workspace_id', 'organization_id')
          and c.table_name <> 'organizations'`);
    await c.query("set session_replication_role = replica");
    try {
      for (const { table_name, column_name } of scoped.rows) {
        await c.query(`delete from public.${table_name} where ${column_name} = any($1::uuid[])`, [[...ids]]);
      }
      await c.query("delete from public.organizations where id = any($1::uuid[])", [[...ids]]);
    } finally {
      await c.query("set session_replication_role = origin");
    }
  } finally {
    await c.end().catch(() => undefined);
  }
}

async function seedUser(user: string): Promise<void> {
  await q(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now())
     on conflict (id) do nothing`, [user, `${user}@fixture.test`]);
}

async function member(ws: string, user: string, role: string): Promise<void> {
  await q("insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, $3, 'active')", [ws, user, role]);
}

async function call(path: string, params: Record<string, string>, raw: string, key: string): Promise<Response> {
  const mod = await import(`../app/v1/${path}/route`);
  return mod.POST(new Request(`http://x/v1/${path}`, {
    method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: raw,
  }), { params: Promise.resolve(params) });
}

let emailSeq = 0;
async function invite(ws: string, email = `r${++emailSeq}@example.test`) {
  const res = await call("workspaces/[workspaceId]/invitations", { workspaceId: ws },
    JSON.stringify({ email, role: "member" }), crypto.randomUUID());
  return { res, email, body: await res.json() };
}

const revoke = (invitationId: string, key = crypto.randomUUID()) =>
  call("invitations/[invitationId]/revoke", { invitationId }, "{}", key);

const accept = (token: string) =>
  call("invitations/accept", {}, JSON.stringify({ token }), crypto.randomUUID());

async function row(invitationId: string) {
  return (await q<{ status: string; version: string; updated_at: Date }>(
    "select status, version, updated_at from public.invitations where id = $1", [invitationId]))[0]!;
}

beforeAll(async () => {
  await dropWorkspaces(ALL);
  for (const u of [OWNER, ADMIN, MEMBER, AUDITOR, OUTSIDER, OWNER_B, ...RECIPIENTS]) await seedUser(u);
  for (const ws of ALL) {
    await q("insert into public.organizations (id, legal_name, display_name) values ($1, $2, $2)", [ws, `Приклад-Простір-${ws.slice(-2)}`]);
  }
  await member(WS.a, OWNER, "owner");
  await member(WS.a, ADMIN, "admin");
  await member(WS.a, MEMBER, "member");
  await member(WS.a, AUDITOR, "auditor");
  await member(WS.b, OWNER_B, "owner");
  await member(WS.ended, OWNER, "owner");
  await member(WS.ended, ADMIN, "admin");
  await member(WS.demoted, OWNER, "owner");
  await member(WS.demoted, ADMIN, "admin");
}, 60_000);

afterAll(async () => {
  await dropWorkspaces(ALL);
  // invitations.accept stores its record with no workspace (DEV-020), so the
  // recipients' records are not reached by dropWorkspaces: remove them by actor.
  await q("delete from public.idempotency_records where organization_id is null and actor_scope = any($1::text[])",
    [RECIPIENTS.map((r) => `user:${r}`)]);
});

describe("POST /v1/invitations/{invitationId}/revoke (BL-107, ADR-012)", () => {
  it("the owner revokes a pending invitation, and its token then admits no one", async () => {
    current = OWNER;
    const { body } = await invite(WS.a);
    const res = await revoke(body.invitationId);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ invitationId: body.invitationId, status: "revoked" });
    const r = await row(body.invitationId);
    expect(r.status).toBe("revoked");
    expect(Number(r.version)).toBe(2);

    current = RECIPIENTS[0]!;
    const accepted = await accept(body.token);
    expect(accepted.status).toBe(404);
    const joined = await q("select 1 from public.memberships where organization_id = $1 and user_id = $2", [WS.a, RECIPIENTS[0]]);
    expect(joined).toHaveLength(0);
  });

  it("the create's conflict names the pending invitation, and a revoke frees the address", async () => {
    current = OWNER;
    const first = await invite(WS.a);
    const blocked = await invite(WS.a, first.email);
    expect(blocked.res.status).toBe(409);
    expect(blocked.body.code).toBe("VERSION_CONFLICT");
    expect(blocked.body.details).toEqual({ invitationId: first.body.invitationId });

    expect((await revoke(first.body.invitationId)).status).toBe(200);
    const again = await invite(WS.a, first.email);
    expect(again.res.status).toBe(201);
    expect(again.body.kind).toBe("issued");
    expect(again.body.invitationId).not.toBe(first.body.invitationId);

    current = RECIPIENTS[1]!;
    expect((await accept(again.body.token)).status).toBe(200);
  });

  it("an admin may revoke", async () => {
    current = OWNER;
    const { body } = await invite(WS.a);
    current = ADMIN;
    expect((await revoke(body.invitationId)).status).toBe(200);
  });

  it("a member and an auditor are refused with 403, and the token still admits", async () => {
    current = OWNER;
    const { body } = await invite(WS.a);
    for (const who of [MEMBER, AUDITOR]) {
      current = who;
      const res = await revoke(body.invitationId);
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("SCOPE_DENIED");
    }
    expect((await row(body.invitationId)).status).toBe("pending");
    current = RECIPIENTS[2]!;
    expect((await accept(body.token)).status).toBe(200);
  });

  it("an outsider and another workspace's owner get 404, and nothing changes", async () => {
    current = OWNER;
    const { body } = await invite(WS.a);
    for (const who of [OUTSIDER, OWNER_B]) {
      current = who;
      const res = await revoke(body.invitationId);
      expect(res.status).toBe(404);
      expect((await res.json()).code).toBe("RESOURCE_NOT_FOUND");
    }
    const r = await row(body.invitationId);
    expect(r.status).toBe("pending");
    expect(Number(r.version)).toBe(1);
  });

  it("an admin whose membership ended gets 404, on a new revoke and on a replay of an earlier one", async () => {
    current = OWNER;
    const one = await invite(WS.ended);
    const two = await invite(WS.ended);
    current = ADMIN;
    const key = crypto.randomUUID();
    expect((await revoke(one.body.invitationId, key)).status).toBe(200);
    await q("update public.memberships set status = 'ended' where organization_id = $1 and user_id = $2", [WS.ended, ADMIN]);
    expect((await revoke(two.body.invitationId)).status).toBe(404);
    const replay = await revoke(one.body.invitationId, key);
    expect(replay.status).toBe(404);
    expect((await replay.json()).code).toBe("RESOURCE_NOT_FOUND");
    expect(replay.headers.get("idempotency-replay-until")).toBeNull();
  });

  it("an admin demoted to member gets 403, on a new revoke and on a replay of an earlier one", async () => {
    current = OWNER;
    const one = await invite(WS.demoted);
    const two = await invite(WS.demoted);
    current = ADMIN;
    const key = crypto.randomUUID();
    expect((await revoke(one.body.invitationId, key)).status).toBe(200);
    await q("update public.memberships set role = 'member' where organization_id = $1 and user_id = $2", [WS.demoted, ADMIN]);
    const fresh = await revoke(two.body.invitationId);
    expect(fresh.status).toBe(403);
    expect((await fresh.json()).code).toBe("SCOPE_DENIED");
    const replay = await revoke(one.body.invitationId, key);
    expect(replay.status).toBe(403);
    expect((await replay.json()).code).toBe("SCOPE_DENIED");
    expect(replay.headers.get("idempotency-replay-until")).toBeNull();
  });

  it("a replay of the same key returns the same body and writes nothing twice", async () => {
    current = OWNER;
    const { body } = await invite(WS.a);
    const key = crypto.randomUUID();
    const first = await revoke(body.invitationId, key);
    const again = await revoke(body.invitationId, key);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(await first.json());
    expect(again.headers.get("idempotency-replay-until")).toBe(first.headers.get("idempotency-replay-until"));
    const audit = await q("select 1 from public.audit_events where action = 'invitation.revoked' and object_id = $1", [body.invitationId]);
    expect(audit).toHaveLength(1);
    const outbox = await q(
      "select 1 from public.transaction_outbox where topic = 'invitation.revoked' and payload->>'invitationId' = $1", [body.invitationId]);
    expect(outbox).toHaveLength(1);
  });

  it("an accepted, an already revoked, and a pending but expired invitation are 409 with nothing written", async () => {
    current = OWNER;
    const acceptedInv = await invite(WS.a);
    current = RECIPIENTS[3]!;
    expect((await accept(acceptedInv.body.token)).status).toBe(200);

    current = OWNER;
    const revokedInv = await invite(WS.a);
    expect((await revoke(revokedInv.body.invitationId)).status).toBe(200);

    const expiredInv = await invite(WS.a);
    await q("update public.invitations set expires_at = now() - interval '1 minute' where id = $1", [expiredInv.body.invitationId]);

    for (const inv of [acceptedInv, revokedInv, expiredInv]) {
      const before = await row(inv.body.invitationId);
      const res = await revoke(inv.body.invitationId);
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe("VERSION_CONFLICT");
      const after = await row(inv.body.invitationId);
      expect(after.status).toBe(before.status);
      expect(after.version).toBe(before.version);
      expect(after.updated_at).toEqual(before.updated_at);
    }
    expect((await row(expiredInv.body.invitationId)).status).toBe("pending");
    // INV-103's other half: a pending invitation past its expiry admits no one.
    current = RECIPIENTS[4]!;
    const late = await accept(expiredInv.body.token);
    expect(late.status).toBe(404);
    expect((await late.json()).code).toBe("RESOURCE_NOT_FOUND");
    expect(await q("select 1 from public.memberships where organization_id = $1 and user_id = $2", [WS.a, RECIPIENTS[4]]))
      .toHaveLength(0);
  });

  it("a malformed id is 404, not 500", async () => {
    current = OWNER;
    const res = await revoke("not-a-uuid");
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("RESOURCE_NOT_FOUND");
  });

  it("the stored revoke record is the receipt, and no stored column carries the token", async () => {
    current = OWNER;
    const { body, email } = await invite(WS.a);
    const key = crypto.randomUUID();
    expect((await revoke(body.invitationId, key)).status).toBe(200);
    const record = await q<{ response_body: unknown }>(
      "select response_body from public.idempotency_records where operation_id = 'invitations.revoke' and idempotency_key = $1", [key]);
    expect(record).toHaveLength(1);
    expect(record[0]!.response_body).toEqual({ invitationId: body.invitationId, status: "revoked" });
    const copies = await q<{ n: string }>(
      `select (select count(*) from public.idempotency_records where response_body::text like '%' || $1 || '%')
            + (select count(*) from public.audit_events where details::text like '%' || $1 || '%')
            + (select count(*) from public.transaction_outbox where payload::text like '%' || $1 || '%') n`, [body.token]);
    expect(Number(copies[0]!.n)).toBe(0);
    // Email-free as well (ADR-012 decision 3): the revoke's own records carry ids only.
    const emailCopies = await q<{ n: string }>(
      `select (select count(*) from public.idempotency_records
                where operation_id = 'invitations.revoke' and response_body::text like '%' || $1 || '%')
            + (select count(*) from public.audit_events
                where action = 'invitation.revoked' and details::text like '%' || $1 || '%')
            + (select count(*) from public.transaction_outbox
                where topic = 'invitation.revoked' and payload::text like '%' || $1 || '%') n`, [email]);
    expect(Number(emailCopies[0]!.n)).toBe(0);
  });

  // S1-01: the body is always `{}`, so the request hash alone cannot tell two
  // revokes apart. A key reused for another invitation must not replay the first
  // revoke's 200 while the second invitation's link stays live.
  it("a key reused for another invitation is 409 IDEMPOTENCY_CONFLICT, and that invitation is untouched", async () => {
    current = OWNER;
    const first = await invite(WS.a);
    const second = await invite(WS.a);
    const key = crypto.randomUUID();
    expect((await revoke(first.body.invitationId, key)).status).toBe(200);
    const reused = await revoke(second.body.invitationId, key);
    expect(reused.status).toBe(409);
    expect((await reused.json()).code).toBe("IDEMPOTENCY_CONFLICT");
    const r = await row(second.body.invitationId);
    expect(r.status).toBe("pending");
    expect(Number(r.version)).toBe(1);
    expect((await revoke(second.body.invitationId)).status).toBe(200);
  });

  // S1-02: the database layer under the route. `inv_update` (0014) admits an
  // owner or admin only, and SELECT … FOR UPDATE applies the UPDATE policy's
  // USING too, so a member-role session locks and updates nothing.
  it("under RLS a member locks and updates no invitation; an admin does", async () => {
    current = OWNER;
    const { body } = await invite(WS.a);
    const reach = async (actor: string) => {
      const c = new Client({ connectionString: process.env.APP_DB_URL });
      await c.connect();
      try {
        await c.query("begin");
        await c.query("set local role goproceed_app");
        await c.query("select set_config('app.actor_user_id', $1, true)", [actor]);
        const seen = await c.query("select 1 from public.invitations where id = $1", [body.invitationId]);
        const locked = await c.query("select 1 from public.invitations where id = $1 for update", [body.invitationId]);
        const updated = await c.query(
          "update public.invitations set updated_at = now() where id = $1 returning id", [body.invitationId]);
        return [seen.rowCount, locked.rowCount, updated.rowCount];
      } finally {
        await c.query("rollback").catch(() => undefined);
        await c.end();
      }
    };
    expect(await reach(MEMBER)).toEqual([1, 0, 0]);
    expect(await reach(ADMIN)).toEqual([1, 1, 1]);
  });
});
