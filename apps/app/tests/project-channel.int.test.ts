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

  it("configures Telegram once, then activates and locks the channel", async () => {
    const configured = await configure(projectId, { channel: "telegram", expectedVersion: 1 });
    expect(configured.status).toBe(200);
    expect(await configured.json()).toMatchObject({
      projectId, projectStatus: "draft", channel: "telegram", channelState: "connected", lockedAt: null, version: 2,
    });

    const activated = await activate(projectId, { expectedVersion: 2 });
    expect(activated.status).toBe(200);
    expect(await activated.json()).toMatchObject({
      projectId, projectStatus: "active", channel: "telegram", channelState: "active", version: 3,
    });
    const [outbox] = await q<{ topic: string }>(
      "select topic from public.transaction_outbox where aggregate_id=$1", [projectId]);
    expect(outbox).toEqual({ topic: "project.activated" });
  });
});
