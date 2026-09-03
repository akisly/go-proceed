import { beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
async function q<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string, params: unknown[] = [],
): Promise<T[]> {
  const c = new Client({ connectionString: admin });
  await c.connect();
  const r = await c.query(sql, params);
  await c.end();
  return r.rows as T[];
}

let workspaceId: string;
let legacyProjectId: string;
let projectId: string;

const jsonReq = (url: string, body: unknown) => new Request(url, {
  method: "POST",
  headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
  body: JSON.stringify(body),
});

beforeEach(async () => {
  const c = new Client({ connectionString: admin });
  await c.connect();
  await c.query("truncate public.organizations cascade");
  await c.query("truncate public.audit_events, public.transaction_outbox, public.idempotency_records cascade");
  await c.end();
  current = A;

  const { POST: createWorkspace } = await import("../app/v1/workspaces/route");
  const workspace = await createWorkspace(jsonReq("http://x/v1/workspaces", { displayName: "Приклад-Простір" }),
    { params: Promise.resolve({}) });
  workspaceId = (await workspace.json()).workspaceId;
  const [legacy] = await q<{ id: string }>(
    "insert into public.projects (workspace_id, name, created_by) values ($1, 'Спадковий', $2) returning id",
    [workspaceId, A],
  );
  legacyProjectId = legacy!.id;

  const { POST: createProject } = await import("../app/v1/workspaces/[workspaceId]/projects/route");
  const created = await createProject(jsonReq(`http://x/v1/workspaces/${workspaceId}/projects`, { name: "ЖК Річковий" }),
    { params: Promise.resolve({ workspaceId }) });
  projectId = (await created.json()).projectId;
});

async function activate(id: string, body: Record<string, unknown>) {
  const { POST } = await import("../app/v1/projects/[projectId]/activate/route");
  return POST(jsonReq(`http://x/v1/projects/${id}/activate`, body), { params: Promise.resolve({ projectId: id }) });
}

async function configure(id: string, body: Record<string, unknown>) {
  const { POST } = await import("../app/v1/projects/[projectId]/field-channel/route");
  return POST(jsonReq(`http://x/v1/projects/${id}/field-channel`, body), { params: Promise.resolve({ projectId: id }) });
}

describe("project field channel", () => {
  it("backfills legacy projects active without inventing a channel", async () => {
    const rows = await q<{ status: string; channel: string | null }>(`
      select p.status, c.channel
      from public.projects p
      left join public.project_field_channels c on c.workspace_id=p.workspace_id and c.project_id=p.id
      where p.id=$1`, [legacyProjectId]);
    expect(rows[0]).toEqual({ status: "active", channel: null });
  });

  it("refuses to activate a draft without a connected channel", async () => {
    const response = await activate(projectId, { expectedVersion: 1 });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("VERSION_CONFLICT");
  });

  it("keeps configuration unbound and refuses member activation before a healthy binding exists", async () => {
    const configured = await configure(projectId, { channel: "telegram", expectedVersion: 1 });
    expect(configured.status).toBe(200);
    expect(await configured.json()).toMatchObject({
      projectId, projectStatus: "draft", channel: "telegram", channelState: "unbound", lockedAt: null, version: 2,
    });

    const unbound = await activate(projectId, { expectedVersion: 2 });
    expect(unbound.status).toBe(409);
    expect((await unbound.json()).code).toBe("VERSION_CONFLICT");

    // Task 4 owns the binding write. Simulate its connected-but-unhealthy row
    // here so this Task 1 route proves it cannot treat a selected channel as a
    // live Telegram group.
    await q(
      "update public.project_field_channels set state='connected' where workspace_id=$1 and project_id=$2",
      [workspaceId, projectId],
    );
    const unhealthy = await activate(projectId, { expectedVersion: 2 });
    expect(unhealthy.status).toBe(409);
    expect((await unhealthy.json()).code).toBe("VERSION_CONFLICT");

    await q(
      "update public.project_field_channels set last_healthy_at=now() where workspace_id=$1 and project_id=$2",
      [workspaceId, projectId],
    );

    const activated = await activate(projectId, { expectedVersion: 2 });
    expect(activated.status).toBe(200);
    const body = await activated.json();
    expect(body).toMatchObject({
      projectId, projectStatus: "active", channel: "telegram", channelState: "active", version: 3,
    });
    expect(body.lockedAt).toEqual(expect.any(String));
    const [committed] = await q<{
      status: string; state: string; locked_at: string | null; organization_id: string | null; topic: string;
    }>(`
      select p.status, c.state, c.locked_at, o.organization_id, o.topic
        from public.projects p
        join public.project_field_channels c on c.workspace_id=p.workspace_id and c.project_id=p.id
        join public.transaction_outbox o on o.aggregate_id=p.id::text and o.topic='project.activated'
       where p.id=$1`, [projectId]);
    expect(committed).toMatchObject({
      status: "active", state: "active", organization_id: workspaceId, topic: "project.activated",
    });
    expect(committed!.locked_at).not.toBeNull();

    const reconfigure = await configure(projectId, { channel: "telegram", expectedVersion: 3 });
    expect(reconfigure.status).toBe(409);
    await expect(q(
      "update public.project_field_channels set locked_at=locked_at + interval '1 second' where workspace_id=$1 and project_id=$2",
      [workspaceId, projectId],
    )).rejects.toThrow(/locked field channel identity is immutable/i);
    await expect(q(
      "update public.project_field_channels set state='unbound' where workspace_id=$1 and project_id=$2",
      [workspaceId, projectId],
    )).rejects.toThrow(/locked field channel/i);
  });
});
