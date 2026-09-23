import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { ADMIN_URL, q } from "./helpers/fixtures";

/**
 * DEV-043 / BL-021 / ADR-014 decision 1: a project administrator revokes a
 * member's project access grants, addressed by member and capability.
 *
 * Before it, `revoked_at` was honoured by every capability check and written
 * by nothing: a mis-scoped grant stood until a superuser UPDATE, and a grant
 * that lapsed through `valid_until` blocked its capability for good, because
 * the grant route and `project_access_active_unique` treat any unrevoked row as
 * held.
 *
 * THIS FILE TRUNCATES NOTHING. It seeds its own workspaces with fixed `de43…`
 * ids, one fresh project per case, and deletes exactly those workspaces'
 * rows afterwards (the catalog-driven technique of packages/testing's
 * dropWorkspaces). Fixed-id auth.users rows outlive it, as in every other
 * suite. It needs APP_DB_URL.
 */

const id = (tail: string) => `de430000-0000-4000-8000-${tail.padStart(12, "0")}`;
const ADMIN = id("a1"), ADMIN2 = id("a2"), MEMBER = id("a3"), VIEWER = id("a4");
const NOVIEW = id("a5"), OUTSIDER = id("a6"), OWNER_B = id("a7"), SUSPENDED = id("a8");
const WS = { a: id("1"), b: id("2") } as const;
const ALL = Object.values(WS);

let current = ADMIN;
// A request may carry its own actor, so two concurrent calls cannot swap identities
// through the shared `current` while the first is still awaiting its import.
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

const revoke = (projectId: string, body: unknown, key?: string, as = current) =>
  post("projects/[projectId]/access-grants/revoke", { projectId }, body, key, as);
const grant = (projectId: string, body: unknown) =>
  post("projects/[projectId]/access-grants", { projectId }, body);
/** A contracts.edit probe: with the capability, unknown parties are 422; without it, 403. */
const createContract = (projectId: string) =>
  post("projects/[projectId]/contracts", { projectId }, {
    ownPartyId: crypto.randomUUID(), customerPartyId: crypto.randomUUID(),
    contractNo: "Д-1", currency: "UAH", taxMode: "exempt",
  });
/** The probe got past authorization: its 422 is the unknown customer party, not the body. */
async function expectAuthorized(res: Response): Promise<void> {
  expect(res.status).toBe(422);
  expect((await res.json()).fieldErrors).toEqual([{ path: "customerPartyId", message: "unknown party" }]);
}

async function listProjects(): Promise<string[]> {
  const { GET } = await import("../app/v1/projects/route");
  const res = await GET(new Request("http://x/v1/projects"), { params: Promise.resolve({}) });
  return ((await res.json()).projects as { projectId: string }[]).map((p) => p.projectId);
}

let seq = 0;
/** A fresh project in WS.a whose administrator is ADMIN (project.admin + project.view). */
async function project(): Promise<string> {
  const p = await q<{ id: string }>(
    "insert into public.projects (workspace_id, name, created_by) values ($1, $2, $3) returning id",
    [WS.a, `Приклад-Проєкт-${++seq}`, ADMIN]);
  const projectId = p[0]!.id;
  await give(projectId, memberIds.admin!, ["project.admin", "project.view"]);
  return projectId;
}

async function give(projectId: string, memberId: string, caps: string[],
  window: { from?: string; until?: string } = {}): Promise<void> {
  for (const cap of caps) {
    await q(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by, valid_from, valid_until)
       values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), $7::timestamptz)`,
      [WS.a, projectId, memberId, cap, ADMIN, window.from ?? null, window.until ?? null]);
  }
}

async function grants(projectId: string, memberId: string) {
  return q<{ capability: string; revoked: boolean; version: string }>(
    `select capability, revoked_at is not null as revoked, version from public.project_access_grants
      where workspace_id = $1 and project_id = $2 and member_id = $3 order by capability, created_at`,
    [WS.a, projectId, memberId]);
}
const unrevoked = async (projectId: string, memberId: string) =>
  (await grants(projectId, memberId)).filter((g) => !g.revoked).map((g) => g.capability);

async function audits(projectId: string) {
  return q<{ action: string; details: Record<string, unknown> }>(
    "select action, details from public.audit_events where organization_id = $1 and object_id = $2 and action = 'project_access.revoked'",
    [WS.a, projectId]);
}

beforeAll(async () => {
  await dropWorkspaces(ALL);
  for (const u of [ADMIN, ADMIN2, MEMBER, VIEWER, NOVIEW, OUTSIDER, OWNER_B, SUSPENDED]) await seedUser(u);
  for (const ws of ALL) {
    await q("insert into public.organizations (id, legal_name, display_name) values ($1, $2, $2)", [ws, `Приклад-Простір-${ws.slice(-1)}`]);
  }
  memberIds.admin = await member(WS.a, ADMIN, "owner");
  memberIds.admin2 = await member(WS.a, ADMIN2, "admin");
  memberIds.member = await member(WS.a, MEMBER, "member");
  memberIds.viewer = await member(WS.a, VIEWER, "member");
  memberIds.noview = await member(WS.a, NOVIEW, "member");
  memberIds.suspended = await member(WS.a, SUSPENDED, "member", "suspended");
  memberIds.ownerB = await member(WS.b, OWNER_B, "owner");
}, 60_000);

afterAll(async () => {
  await dropWorkspaces(ALL);
});

describe("POST /v1/projects/{projectId}/access-grants/revoke (BL-021, ADR-014 decision 1)", () => {
  it("revokes an action capability, keeps project.view, and the capability stops authorizing", async () => {
    const projectId = await project();
    await give(projectId, memberIds.member!, ["project.view", "contracts.edit"]);
    current = MEMBER;
    await expectAuthorized(await createContract(projectId));

    current = ADMIN;
    const res = await revoke(projectId, { memberId: memberIds.member, capabilities: ["contracts.edit"] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revoked.map((r: { capability: string }) => r.capability)).toEqual(["contracts.edit"]);
    expect(Object.keys(body)).toEqual(["revoked"]);
    const rows = await grants(projectId, memberIds.member!);
    expect(rows.find((g) => g.capability === "contracts.edit")).toMatchObject({ revoked: true, version: "2" });
    expect(await unrevoked(projectId, memberIds.member!)).toEqual(["project.view"]);

    current = MEMBER;
    const denied = await createContract(projectId);
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe("SCOPE_PROJECT_DENIED");
    expect(await listProjects()).toContain(projectId);

    const a = await audits(projectId);
    expect(a).toHaveLength(1);
    expect(a[0]!.details).toMatchObject({ memberId: memberIds.member, capabilities: ["contracts.edit"] });
    const outbox = await q("select 1 from public.transaction_outbox where organization_id = $1 and aggregate_id = $2", [WS.a, projectId]);
    expect(outbox).toHaveLength(0);
  });

  it("revoking project.view removes the member from the project: every grant goes, and the project is 404 to them", async () => {
    const projectId = await project();
    await give(projectId, memberIds.member!, ["project.view", "contracts.edit", "evidence.record"]);
    current = ADMIN;
    const res = await revoke(projectId, { memberId: memberIds.member, capabilities: ["project.view"] });
    expect(res.status).toBe(200);
    expect((await res.json()).revoked.map((r: { capability: string }) => r.capability))
      .toEqual(["contracts.edit", "evidence.record", "project.view"]);
    expect(await unrevoked(projectId, memberIds.member!)).toEqual([]);

    current = MEMBER;
    expect(await listProjects()).not.toContain(projectId);
    const again = await revoke(projectId, { memberId: memberIds.member, capabilities: ["project.view"] });
    expect(again.status).toBe(404);
  });

  it("refuses to revoke the last live administrator grant, one's own included, and writes nothing", async () => {
    const projectId = await project();
    // Neither a suspended member's admin grant nor a lapsed one keeps the project administrable.
    await give(projectId, memberIds.suspended!, ["project.admin", "project.view"]);
    await give(projectId, memberIds.admin2!, ["project.admin"],
      { from: "2026-01-01T00:00:00Z", until: "2026-02-01T00:00:00Z" });
    current = ADMIN;
    for (const capabilities of [["project.admin"], ["project.view"], ["project.admin", "project.view"]]) {
      const res = await revoke(projectId, { memberId: memberIds.admin, capabilities });
      expect(res.status).toBe(409);
      const p = await res.json();
      expect(p.code).toBe("PROJECT_FINAL_ADMIN");
      expect(p.retryable).toBe(false);
    }
    expect(await unrevoked(projectId, memberIds.admin!)).toEqual(["project.admin", "project.view"]);
    expect(await audits(projectId)).toHaveLength(0);
  });

  it("with a second active administrator a self-revoke succeeds, and replaying its key is then refused (403)", async () => {
    const projectId = await project();
    await give(projectId, memberIds.admin2!, ["project.admin", "project.view"]);
    current = ADMIN;
    const key = crypto.randomUUID();
    const body = { memberId: memberIds.admin, capabilities: ["project.admin"] };
    const res = await revoke(projectId, body, key);
    expect(res.status).toBe(200);
    expect(await unrevoked(projectId, memberIds.admin!)).toEqual(["project.view"]);

    const replay = await revoke(projectId, body, key);
    expect(replay.status).toBe(403);
    expect((await replay.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("two administrators revoking each other at once: exactly one succeeds and one administrator remains", async () => {
    const projectId = await project();
    await give(projectId, memberIds.admin2!, ["project.admin", "project.view"]);
    const [x, y] = await Promise.all([
      revoke(projectId, { memberId: memberIds.admin2, capabilities: ["project.admin"] }, undefined, ADMIN),
      revoke(projectId, { memberId: memberIds.admin, capabilities: ["project.admin"] }, undefined, ADMIN2),
    ]);
    const [won, lost] = x.status === 200 ? [x, y] : [y, x];
    expect(won.status).toBe(200);
    expect([403, 409]).toContain(lost.status);
    expect(["PROJECT_FINAL_ADMIN", "SCOPE_PROJECT_DENIED", "VERSION_CONFLICT"]).toContain((await lost.json()).code);
    const live = await q("select 1 from public.project_access_grants where project_id = $1 and capability = 'project.admin' and revoked_at is null", [projectId]);
    expect(live).toHaveLength(1);
  });

  it("a capability the member does not hold unrevoked is 409 VERSION_CONFLICT naming it, and nothing is written", async () => {
    const projectId = await project();
    await give(projectId, memberIds.member!, ["project.view", "contracts.edit"]);
    current = ADMIN;
    const res = await revoke(projectId, { memberId: memberIds.member, capabilities: ["contracts.edit", "imports.manage"] });
    expect(res.status).toBe(409);
    const p = await res.json();
    expect(p.code).toBe("VERSION_CONFLICT");
    expect(p.details).toEqual({ notHeld: ["imports.manage"] });
    expect(await unrevoked(projectId, memberIds.member!)).toEqual(["contracts.edit", "project.view"]);

    expect((await revoke(projectId, { memberId: memberIds.member, capabilities: ["contracts.edit"] })).status).toBe(200);
    const twice = await revoke(projectId, { memberId: memberIds.member, capabilities: ["contracts.edit"] });
    expect(twice.status).toBe(409);
    expect((await twice.json()).details).toEqual({ notHeld: ["contracts.edit"] });
    expect(await audits(projectId)).toHaveLength(1);
  });

  it("a lapsed grant is revocable, which frees its capability for a new grant; a future grant is revocable", async () => {
    const projectId = await project();
    await give(projectId, memberIds.member!, ["project.view"]);
    await give(projectId, memberIds.member!, ["contracts.edit"], { from: "2026-01-01T00:00:00Z", until: "2026-02-01T00:00:00Z" });
    await give(projectId, memberIds.member!, ["imports.manage"], { from: "2099-01-01T00:00:00Z" });
    current = ADMIN;
    // The regression this fixes: a lapsed, unrevoked grant blocks re-granting its capability.
    const blocked = await grant(projectId, { memberId: memberIds.member, capabilities: ["contracts.edit"] });
    expect((await blocked.json()).granted).toEqual([]);

    const res = await revoke(projectId, { memberId: memberIds.member, capabilities: ["contracts.edit", "imports.manage"] });
    expect(res.status).toBe(200);
    const regrant = await grant(projectId, { memberId: memberIds.member, capabilities: ["contracts.edit"] });
    expect(regrant.status).toBe(201);
    expect((await regrant.json()).granted.map((g: { capability: string }) => g.capability)).toEqual(["contracts.edit"]);
    current = MEMBER;
    await expectAuthorized(await createContract(projectId));
  });

  it("authority: a view-only member is 403; an outsider, another workspace's owner and a member without view get 404", async () => {
    const projectId = await project();
    await give(projectId, memberIds.viewer!, ["project.view"]);
    await give(projectId, memberIds.member!, ["project.view", "contracts.edit"]);
    const body = { memberId: memberIds.member, capabilities: ["contracts.edit"] };

    current = VIEWER;
    const viewer = await revoke(projectId, body);
    expect(viewer.status).toBe(403);
    expect((await viewer.json()).code).toBe("SCOPE_PROJECT_DENIED");
    for (const who of [OUTSIDER, OWNER_B, NOVIEW]) {
      current = who;
      expect((await revoke(projectId, body)).status).toBe(404);
    }
    expect(await unrevoked(projectId, memberIds.member!)).toEqual(["contracts.edit", "project.view"]);
  });

  it("the target: another workspace's member or an unknown id is 422; a suspended member's grants are revocable", async () => {
    const projectId = await project();
    await give(projectId, memberIds.suspended!, ["project.view", "contracts.edit"]);
    current = ADMIN;
    for (const memberId of [memberIds.ownerB, crypto.randomUUID()]) {
      const res = await revoke(projectId, { memberId, capabilities: ["project.view"] });
      expect(res.status).toBe(422);
      expect((await res.json()).code).toBe("VALIDATION_FAILED");
    }
    const res = await revoke(projectId, { memberId: memberIds.suspended, capabilities: ["project.view"] });
    expect(res.status).toBe(200);
    expect(await unrevoked(projectId, memberIds.suspended!)).toEqual([]);
  });

  it("a malformed project id is 404; an unknown body key or an empty list is 422", async () => {
    const projectId = await project();
    current = ADMIN;
    expect((await revoke("not-a-uuid", { memberId: memberIds.member, capabilities: ["project.view"] })).status).toBe(404);
    for (const body of [
      { memberId: memberIds.member, capabilities: [] },
      { memberId: memberIds.member, capabilities: ["project.view"], validUntil: "2099-01-01T00:00:00Z" },
      { memberId: memberIds.member, capabilities: ["not.a.capability"] },
    ]) {
      const res = await revoke(projectId, body);
      expect(res.status).toBe(422);
    }
  });

  it("concurrent revokes of the same grant under two keys: one 200 and one 409; a same-key retry replays once", async () => {
    const projectId = await project();
    await give(projectId, memberIds.member!, ["project.view", "contracts.edit"]);
    current = ADMIN;
    const body = { memberId: memberIds.member, capabilities: ["contracts.edit"] };
    const [x, y] = await Promise.all([revoke(projectId, body), revoke(projectId, body)]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);

    await give(projectId, memberIds.member!, ["imports.manage"]);
    const key = crypto.randomUUID();
    const body2 = { memberId: memberIds.member, capabilities: ["imports.manage"] };
    const first = await revoke(projectId, body2, key);
    const second = await revoke(projectId, body2, key);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    expect(await audits(projectId)).toHaveLength(2);
  });

  it("a revoke leaves the member's responsibilities alone (INV-021)", async () => {
    const projectId = await project();
    await give(projectId, memberIds.member!, ["project.view"]);
    await q(
      `insert into public.project_responsibility_assignments (workspace_id, project_id, member_id, responsibility, assigned_by)
       values ($1, $2, $3, 'performer', $4)`, [WS.a, projectId, memberIds.member, ADMIN]);
    current = ADMIN;
    expect((await revoke(projectId, { memberId: memberIds.member, capabilities: ["project.view"] })).status).toBe(200);
    const kept = await q("select 1 from public.project_responsibility_assignments where project_id = $1 and member_id = $2", [projectId, memberIds.member]);
    expect(kept).toHaveLength(1);
  });

  // Review round 1 (gp-reviewer R1-01, R1-02; gp-security S1-01, S1-02).

  it("an upper-case member id is the same member (R1-01)", async () => {
    const projectId = await project();
    await give(projectId, memberIds.member!, ["project.view", "contracts.edit"]);
    current = ADMIN;
    const res = await revoke(projectId, { memberId: memberIds.member!.toUpperCase(), capabilities: ["contracts.edit"] });
    expect(res.status).toBe(200);
    expect(await unrevoked(projectId, memberIds.member!)).toEqual(["project.view"]);
  });

  it("an administrator removing themselves revokes their admin and view in one statement; the replay is then 404 (R1-02)", async () => {
    const projectId = await project();
    await give(projectId, memberIds.admin2!, ["project.admin", "project.view"]);
    current = ADMIN;
    const key = crypto.randomUUID();
    const body = { memberId: memberIds.admin, capabilities: ["project.view"] };
    const res = await revoke(projectId, body, key);
    expect(res.status).toBe(200);
    expect((await res.json()).revoked.map((r: { capability: string }) => r.capability)).toEqual(["project.admin", "project.view"]);
    expect(await unrevoked(projectId, memberIds.admin!)).toEqual([]);
    const replay = await revoke(projectId, body, key);
    expect(replay.status).toBe(404);
    expect((await replay.json()).code).toBe("RESOURCE_NOT_FOUND");
  });

  it("a surviving administrator grant with an end date does not keep the project administrable (S1-02, owner 2026-09-23)", async () => {
    const projectId = await project();
    await give(projectId, memberIds.admin2!, ["project.admin", "project.view"], { until: "2099-01-01T00:00:00Z" });
    current = ADMIN;
    const res = await revoke(projectId, { memberId: memberIds.admin, capabilities: ["project.admin"] });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("PROJECT_FINAL_ADMIN");
    // Revoking the dated grant instead is allowed: the actor's own undated grant survives.
    const other = await revoke(projectId, { memberId: memberIds.admin2, capabilities: ["project.admin"] });
    expect(other.status).toBe(200);
  });

  it("a grant racing a project.view cascade never leaves an action capability without project.view (S1-01, INV-111)", async () => {
    const projectId = await project();
    const racers: string[] = [];
    for (let i = 0; i < 10; i++) {
      const user = id(`b${i}`);
      await seedUser(user);
      const m = await q<{ id: string }>(
        `insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'member', 'active')
         on conflict do nothing returning id`, [WS.a, user]);
      const memberId = m[0]?.id ?? (await q<{ id: string }>(
        "select id from public.memberships where organization_id = $1 and user_id = $2", [WS.a, user]))[0]!.id;
      await give(projectId, memberId, ["project.view"]);
      racers.push(memberId);
    }
    current = ADMIN;
    await Promise.all(racers.flatMap((memberId) => [
      grant(projectId, { memberId, capabilities: ["evidence.record"] }),
      revoke(projectId, { memberId, capabilities: ["project.view"] }),
    ]));
    for (const memberId of racers) {
      const left = await unrevoked(projectId, memberId);
      if (left.length > 0) expect(left).toContain("project.view");
    }
  });
});
