import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { ADMIN_URL, q } from "./helpers/fixtures";

/**
 * DEV-020 / BL-103: a repeated Idempotency-Key replays its stored response
 * only to a caller who may still perform the command.
 *
 * `withIdempotency` returned the stored status and body BEFORE its callback
 * ran, and the callback is where every route checked membership, role and
 * project capability. So a user whose membership ended, an admin demoted to
 * member, or a member whose project grant was revoked, who repeated the same
 * key and body inside the retention window, got the stored 2xx again — and a
 * different body under the same key got 409 IDEMPOTENCY_CONFLICT, which told a
 * caller with no authority that the record existed. The design order in
 * docs/architecture/tenancy-and-security.md puts authorization (steps 1-6)
 * before command idempotency (step 7).
 *
 * THIS FILE TRUNCATES NOTHING. It seeds its own workspaces with fixed `de20…`
 * ids and deletes exactly those rows afterwards, with the catalog-driven
 * technique of packages/testing's dropWorkspaces. Three auth.users rows with
 * fixed ids outlive it, as in every other suite. It needs APP_DB_URL (the
 * routes' tenant connection).
 */

const U = "de200000-0000-4000-8000-0000000000a1"; // the actor whose authority changes
const T = "de200000-0000-4000-8000-0000000000b1"; // a second member, the access-grant target
const WS = {
  endedProjects: "de200000-0000-4000-8000-000000000001",
  demotedProjects: "de200000-0000-4000-8000-000000000002",
  party: "de200000-0000-4000-8000-000000000003",
  accessGrant: "de200000-0000-4000-8000-000000000004",
  control: "de200000-0000-4000-8000-000000000005",
  differentBody: "de200000-0000-4000-8000-000000000006",
} as const;
const ALL = Object.values(WS);

let current = U;
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

async function seedUser(id: string): Promise<void> {
  await q(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now())
     on conflict (id) do nothing`, [id, `${id}@fixture.test`]);
}

/** A workspace in which U is an active admin (and T an active member). */
async function seedWorkspace(ws: string): Promise<void> {
  await q("insert into public.organizations (id, legal_name, display_name) values ($1, $2, $2)",
    [ws, `Приклад-Простір-${ws.slice(-2)}`]);
  await q("insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'admin', 'active')", [ws, U]);
  await q("insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'member', 'active')", [ws, T]);
}

async function setMembership(ws: string, fields: { role?: string; status?: string }): Promise<void> {
  if (fields.role) await q("update public.memberships set role = $3 where organization_id = $1 and user_id = $2", [ws, U, fields.role]);
  if (fields.status) await q("update public.memberships set status = $3 where organization_id = $1 and user_id = $2", [ws, U, fields.status]);
}

async function call(
  path: string, method: "POST" | "PATCH", params: Record<string, string>, raw: string, key: string,
): Promise<Response> {
  const mod = await import(`../app/v1/${path}/route`);
  return mod[method](new Request(`http://x/v1/${path}`, {
    method, headers: { "content-type": "application/json", "idempotency-key": key }, body: raw,
  }), { params: Promise.resolve(params) });
}

const createProject = (ws: string, raw: string, key: string) =>
  call("workspaces/[workspaceId]/projects", "POST", { workspaceId: ws }, raw, key);

async function projectCount(ws: string): Promise<number> {
  return Number((await q<{ n: string }>("select count(*) n from public.projects where workspace_id = $1", [ws]))[0].n);
}

beforeAll(async () => {
  await dropWorkspaces(ALL);
  await seedUser(U);
  await seedUser(T);
  for (const ws of ALL) await seedWorkspace(ws);
}, 60_000);

afterAll(async () => {
  await dropWorkspaces(ALL);
});

describe("a replay is refused to a caller who lost the authority the command needs (BL-103)", () => {
  it("workspace route, membership ended: the replay is 403 MEMBERSHIP_INACTIVE and carries nothing stored", async () => {
    current = U;
    const raw = JSON.stringify({ name: "Об'єкт DEV-020" });
    const key = crypto.randomUUID();
    const first = await createProject(WS.endedProjects, raw, key);
    expect(first.status).toBe(201);
    const { projectId } = await first.json();

    await setMembership(WS.endedProjects, { status: "ended" });
    const again = await createProject(WS.endedProjects, raw, key);
    const text = await again.text();
    expect(again.status).toBe(403);
    expect(JSON.parse(text).code).toBe("MEMBERSHIP_INACTIVE");
    expect(text).not.toContain(projectId);
    expect(again.headers.get("idempotency-replay-until")).toBeNull();
    expect(await projectCount(WS.endedProjects)).toBe(1);
  });

  it("workspace route, membership ended: a different body under the same key is 403, not 409", async () => {
    current = U;
    const key = crypto.randomUUID();
    expect((await createProject(WS.differentBody, JSON.stringify({ name: "Перший" }), key)).status).toBe(201);
    await setMembership(WS.differentBody, { status: "ended" });
    const other = await createProject(WS.differentBody, JSON.stringify({ name: "Другий" }), key);
    expect(other.status).toBe(403);
    expect((await other.json()).code).toBe("MEMBERSHIP_INACTIVE");
  });

  it("workspace route, admin demoted to member: the replay is 403 SCOPE_DENIED", async () => {
    current = U;
    const raw = JSON.stringify({ name: "Об'єкт DEV-020" });
    const key = crypto.randomUUID();
    const first = await createProject(WS.demotedProjects, raw, key);
    expect(first.status).toBe(201);
    const { projectId } = await first.json();

    await setMembership(WS.demotedProjects, { role: "member" });
    const again = await createProject(WS.demotedProjects, raw, key);
    const text = await again.text();
    expect(again.status).toBe(403);
    expect(JSON.parse(text).code).toBe("SCOPE_DENIED");
    expect(text).not.toContain(projectId);
    expect(await projectCount(WS.demotedProjects)).toBe(1);
  });

  it("resource route (party update): demoted → 403 SCOPE_DENIED; membership ended → 404, the lookup still first", async () => {
    current = U;
    const created = await call("workspaces/[workspaceId]/parties", "POST", { workspaceId: WS.party },
      JSON.stringify({ displayName: "Підрядник DEV-020" }), crypto.randomUUID());
    expect(created.status).toBe(201);
    const { partyId } = await created.json();

    const raw = JSON.stringify({ displayName: "Підрядник DEV-020 (нова назва)", expectedVersion: 1 });
    const key = crypto.randomUUID();
    expect((await call("parties/[partyId]", "PATCH", { partyId }, raw, key)).status).toBe(200);

    await setMembership(WS.party, { role: "member" });
    const demoted = await call("parties/[partyId]", "PATCH", { partyId }, raw, key);
    expect(demoted.status).toBe(403);
    expect((await demoted.json()).code).toBe("SCOPE_DENIED");

    await setMembership(WS.party, { status: "ended" });
    const ended = await call("parties/[partyId]", "PATCH", { partyId }, raw, key);
    expect(ended.status).toBe(404);
    expect((await ended.json()).code).toBe("RESOURCE_NOT_FOUND");
  });

  it("project route (access grant): the caller's project.admin revoked, project.view kept → 403 SCOPE_PROJECT_DENIED", async () => {
    current = U;
    const created = await createProject(WS.accessGrant, JSON.stringify({ name: "Об'єкт DEV-020" }), crypto.randomUUID());
    expect(created.status).toBe(201);
    const { projectId } = await created.json();
    const target = await q<{ id: string }>(
      "select id from public.memberships where organization_id = $1 and user_id = $2", [WS.accessGrant, T]);

    const raw = JSON.stringify({ memberId: target[0].id, capabilities: ["project.view"] });
    const key = crypto.randomUUID();
    const first = await call("projects/[projectId]/access-grants", "POST", { projectId }, raw, key);
    expect(first.status).toBe(201);

    await q(
      `update public.project_access_grants set revoked_at = now()
        where project_id = $1 and capability = 'project.admin'
          and member_id = (select id from public.memberships where organization_id = $2 and user_id = $3)`,
      [projectId, WS.accessGrant, U]);
    const again = await call("projects/[projectId]/access-grants", "POST", { projectId }, raw, key);
    expect(again.status).toBe(403);
    expect((await again.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("control: a caller whose authority is unchanged still gets the stored response and its header", async () => {
    current = U;
    const raw = JSON.stringify({ name: "Об'єкт DEV-020" });
    const key = crypto.randomUUID();
    const first = await createProject(WS.control, raw, key);
    expect(first.status).toBe(201);
    const body = await first.json();
    const again = await createProject(WS.control, raw, key);
    expect(again.status).toBe(201);
    expect(await again.json()).toEqual(body);
    expect(again.headers.get("idempotency-replay-until")).toBe(first.headers.get("idempotency-replay-until"));
    expect(await projectCount(WS.control)).toBe(1);
  });
});
