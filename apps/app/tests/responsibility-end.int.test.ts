import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { ADMIN_URL, q } from "./helpers/fixtures";

/**
 * DEV-044 / BL-015 / ADR-014 decisions 2 and 3: a project administrator ends a
 * member's responsibility on a project.
 *
 * `project_responsibility_assignments` is append-only (0013), so an assignment
 * with no `valid_until` was permanent, and the separation-of-duties warnings the
 * assign route computes (ADR-002) kept counting it. An end is an append-only
 * fact of its own, one per assignment, written at the moment of the command.
 *
 * THIS FILE TRUNCATES NOTHING. It seeds its own workspaces with fixed `de44…`
 * ids, one fresh project per case, and deletes exactly those workspaces' rows
 * afterwards in replica mode (the end and assignment tables refuse DELETE
 * through their triggers otherwise). Fixed-id auth.users rows outlive it. It
 * needs APP_DB_URL.
 */

const id = (tail: string) => `de440000-0000-4000-8000-${tail.padStart(12, "0")}`;
const ADMIN = id("a1"), MEMBER = id("a2"), VIEWER = id("a3"), EXMEMBER = id("a4");
const OUTSIDER = id("a5"), OWNER_B = id("a6");
const WS = { a: id("1"), b: id("2") } as const;
const ALL = Object.values(WS);

let current = ADMIN;
// A request may carry its own actor, so concurrent calls cannot swap identities.
vi.mock("../src/lib/auth", () => ({
  requireUser: async (_requestId: string, req?: Request) => ({ userId: req?.headers.get("x-test-user") ?? current }),
}));

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

const memberIds: Record<string, string> = {};
async function member(ws: string, user: string, role: string, status = "active"): Promise<string> {
  const r = await q<{ id: string }>(
    "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, $3, $4) returning id",
    [ws, user, role, status]);
  return r[0]!.id;
}

async function post(path: string, params: Record<string, string>, body: unknown, key = crypto.randomUUID(),
  as = current): Promise<Response> {
  const mod = await import(`../app/v1/${path}/route`);
  return mod.POST(new Request(`http://x/v1/${path}`, {
    method: "POST", headers: { "content-type": "application/json", "idempotency-key": key, "x-test-user": as },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }), { params: Promise.resolve(params) });
}

const end = (projectId: string, body: unknown, key?: string, as = current) =>
  post("projects/[projectId]/responsibilities/end", { projectId }, body, key, as);
const assignViaRoute = (projectId: string, body: unknown) =>
  post("projects/[projectId]/responsibilities", { projectId }, body);

let seq = 0;
/** A fresh project in WS.a administered by ADMIN, with VIEWER holding project.view. */
async function project(): Promise<string> {
  const p = await q<{ id: string }>(
    "insert into public.projects (workspace_id, name, created_by) values ($1, $2, $3) returning id",
    [WS.a, `Приклад-Проєкт-${++seq}`, ADMIN]);
  const projectId = p[0]!.id;
  for (const [memberId, cap] of [[memberIds.admin!, "project.admin"], [memberIds.admin!, "project.view"],
    [memberIds.viewer!, "project.view"]] as const) {
    await q(
      `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
       values ($1, $2, $3, $4, $5)`, [WS.a, projectId, memberId, cap, ADMIN]);
  }
  return projectId;
}

/** An assignment written directly, so its window can be in the past or the future. */
async function assign(projectId: string, memberId: string, responsibility: string,
  window: { from?: string; until?: string } = {}): Promise<string> {
  const r = await q<{ id: string }>(
    `insert into public.project_responsibility_assignments
       (workspace_id, project_id, member_id, responsibility, valid_from, valid_until, assigned_by)
     values ($1, $2, $3, $4, coalesce($5::timestamptz, now()), $6::timestamptz, $7) returning id`,
    [WS.a, projectId, memberId, responsibility, window.from ?? null, window.until ?? null, ADMIN]);
  return r[0]!.id;
}

async function ends(projectId: string) {
  return q<{ assignment_id: string; ended_by: string; ended_at: Date }>(
    "select assignment_id, ended_by, ended_at from public.project_responsibility_assignment_ends where workspace_id = $1 and project_id = $2 order by assignment_id",
    [WS.a, projectId]);
}

beforeAll(async () => {
  await dropWorkspaces(ALL);
  for (const u of [ADMIN, MEMBER, VIEWER, EXMEMBER, OUTSIDER, OWNER_B]) await seedUser(u);
  for (const ws of ALL) {
    await q("insert into public.organizations (id, legal_name, display_name) values ($1, $2, $2)", [ws, `Приклад-Простір-${ws.slice(-1)}`]);
  }
  memberIds.admin = await member(WS.a, ADMIN, "owner");
  memberIds.member = await member(WS.a, MEMBER, "member");
  memberIds.viewer = await member(WS.a, VIEWER, "member");
  memberIds.exmember = await member(WS.a, EXMEMBER, "member", "ended");
  memberIds.ownerB = await member(WS.b, OWNER_B, "owner");
}, 60_000);

afterAll(async () => {
  await dropWorkspaces(ALL);
});

describe("POST /v1/projects/{projectId}/responsibilities/end (BL-015, ADR-014 decision 2)", () => {
  it("ends a live assignment at the moment of the command, and a later assign no longer warns about it", async () => {
    const projectId = await project();
    const performer = await assign(projectId, memberIds.member!, "performer");
    current = ADMIN;
    const warned = await assignViaRoute(projectId, { memberId: memberIds.member, responsibility: "internal_verifier" });
    expect((await warned.json()).warnings).toEqual(["sod:performer+internal_verifier"]);

    const before = Date.now();
    const res = await end(projectId, { memberId: memberIds.member, responsibility: "performer" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ended: [{ assignmentId: performer }] });
    const rows = await ends(projectId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.assignment_id).toBe(performer);
    expect(rows[0]!.ended_by).toBe(ADMIN);
    expect(Math.abs(rows[0]!.ended_at.getTime() - before)).toBeLessThan(60_000);

    const clean = await assignViaRoute(projectId, { memberId: memberIds.member, responsibility: "internal_verifier" });
    expect(clean.status).toBe(201);
    expect((await clean.json()).warnings).toEqual([]);

    const audit = await q<{ object_id: string; details: Record<string, unknown> }>(
      "select object_id, details from public.audit_events where organization_id = $1 and action = 'project_responsibility.ended' and object_id = $2",
      [WS.a, performer]);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.details).toMatchObject({ memberId: memberIds.member, responsibility: "performer" });
    const outbox = await q("select 1 from public.transaction_outbox where organization_id = $1 and aggregate_id = $2", [WS.a, projectId]);
    expect(outbox).toHaveLength(0);
  });

  it("cancels a future assignment of the pair in the same call, and leaves a lapsed one and other responsibilities alone", async () => {
    const projectId = await project();
    const live = await assign(projectId, memberIds.member!, "evidence_recorder");
    const future = await assign(projectId, memberIds.member!, "evidence_recorder", { from: "2099-01-01T00:00:00Z" });
    await assign(projectId, memberIds.member!, "evidence_recorder", { from: "2026-01-01T00:00:00Z", until: "2026-02-01T00:00:00Z" });
    await assign(projectId, memberIds.member!, "performer");
    current = ADMIN;
    const res = await end(projectId, { memberId: memberIds.member, responsibility: "evidence_recorder" });
    expect(res.status).toBe(200);
    expect((await res.json()).ended.map((e: { assignmentId: string }) => e.assignmentId).sort()).toEqual([live, future].sort());
    expect((await ends(projectId)).map((e) => e.assignment_id).sort()).toEqual([live, future].sort());
  });

  it("nothing live or future is 409 VERSION_CONFLICT with nothing written; ending twice is 409", async () => {
    const projectId = await project();
    await assign(projectId, memberIds.member!, "performer", { from: "2026-01-01T00:00:00Z", until: "2026-02-01T00:00:00Z" });
    current = ADMIN;
    const lapsed = await end(projectId, { memberId: memberIds.member, responsibility: "performer" });
    expect(lapsed.status).toBe(409);
    const p = await lapsed.json();
    expect(p.code).toBe("VERSION_CONFLICT");
    expect(p.retryable).toBe(false);
    expect((await end(projectId, { memberId: memberIds.member, responsibility: "requirement_owner" })).status).toBe(409);
    expect(await ends(projectId)).toHaveLength(0);

    await assign(projectId, memberIds.member!, "performer");
    expect((await end(projectId, { memberId: memberIds.member, responsibility: "performer" })).status).toBe(200);
    expect((await end(projectId, { memberId: memberIds.member, responsibility: "performer" })).status).toBe(409);
    expect(await ends(projectId)).toHaveLength(1);
  });

  it("two concurrent ends under two keys: one 200 and one 409, never 500; a same-key retry replays once", async () => {
    const projectId = await project();
    await assign(projectId, memberIds.member!, "performer");
    current = ADMIN;
    const body = { memberId: memberIds.member, responsibility: "performer" };
    const [x, y] = await Promise.all([end(projectId, body), end(projectId, body)]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
    expect(await ends(projectId)).toHaveLength(1);

    await assign(projectId, memberIds.member!, "progress_recorder");
    const key = crypto.randomUUID();
    const body2 = { memberId: memberIds.member, responsibility: "progress_recorder" };
    const first = await end(projectId, body2, key);
    const second = await end(projectId, body2, key);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    expect(await ends(projectId)).toHaveLength(2);
  });

  it("an ex-member's assignment can be ended", async () => {
    const projectId = await project();
    const a = await assign(projectId, memberIds.exmember!, "performer");
    current = ADMIN;
    const res = await end(projectId, { memberId: memberIds.exmember, responsibility: "performer" });
    expect(res.status).toBe(200);
    expect((await ends(projectId)).map((e) => e.assignment_id)).toEqual([a]);
  });

  it("authority and input: a view-only member is 403; an outsider and another workspace's owner get 404; a foreign or unknown member is 422", async () => {
    const projectId = await project();
    await assign(projectId, memberIds.member!, "performer");
    const body = { memberId: memberIds.member, responsibility: "performer" };
    current = VIEWER;
    const viewer = await end(projectId, body);
    expect(viewer.status).toBe(403);
    expect((await viewer.json()).code).toBe("SCOPE_PROJECT_DENIED");
    for (const who of [OUTSIDER, OWNER_B]) {
      current = who;
      expect((await end(projectId, body)).status).toBe(404);
    }
    current = ADMIN;
    for (const memberId of [memberIds.ownerB, crypto.randomUUID()]) {
      const res = await end(projectId, { memberId, responsibility: "performer" });
      expect(res.status).toBe(422);
      expect((await res.json()).code).toBe("VALIDATION_FAILED");
    }
    expect((await end("not-a-uuid", body)).status).toBe(404);
    expect((await end(projectId, { ...body, endAt: "2099-01-01T00:00:00Z" })).status).toBe(422);
    expect((await end(projectId, { ...body, responsibility: "not_a_responsibility" })).status).toBe(422);
    expect(await ends(projectId)).toHaveLength(0);
  });

  it("an end leaves the member's access alone (INV-021)", async () => {
    const projectId = await project();
    await q(
      `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
       values ($1, $2, $3, 'project.view', $4)`, [WS.a, projectId, memberIds.member, ADMIN]);
    await assign(projectId, memberIds.member!, "performer");
    current = ADMIN;
    expect((await end(projectId, { memberId: memberIds.member, responsibility: "performer" })).status).toBe(200);
    const g = await q("select 1 from public.project_access_grants where project_id = $1 and member_id = $2 and revoked_at is null",
      [projectId, memberIds.member]);
    expect(g).toHaveLength(1);
  });

  // DEV-052 / BL-144 (DEV-044's gp-qa follow-up 2): the route lower-cases the
  // member id, so an upper-case spelling is the same member — in the lookup,
  // the end, and the audit record.
  it("an upper-case member id is the same member, and the audit record names it in lower case", async () => {
    const projectId = await project();
    const performer = await assign(projectId, memberIds.member!, "performer");
    current = ADMIN;
    const res = await end(projectId, { memberId: memberIds.member!.toUpperCase(), responsibility: "performer" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ended: [{ assignmentId: performer }] });
    const audit = await q<{ details: Record<string, unknown> }>(
      "select details from public.audit_events where organization_id = $1 and action = 'project_responsibility.ended' and object_id = $2",
      [WS.a, performer]);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.details).toMatchObject({ memberId: memberIds.member });
  });
});
