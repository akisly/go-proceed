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
let memberIdB: string;
let memberIdC: string;

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
  const b = await q<{ id: string }>(
    "insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'admin','active') returning id",
    [workspaceId, B]);
  memberIdB = b[0].id;
  const cRow = await q<{ id: string }>(
    "insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'member','active') returning id",
    [workspaceId, C]);
  memberIdC = cRow[0].id;
});

const jsonReq = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });

async function createProject(name: string) {
  const { POST } = await import("../app/v1/workspaces/[workspaceId]/projects/route");
  return POST(jsonReq(`http://x/v1/workspaces/${workspaceId}/projects`, { name }),
    { params: Promise.resolve({ workspaceId }) });
}
async function listProjects() {
  const { GET } = await import("../app/v1/projects/route");
  return GET(new Request("http://x/v1/projects"), { params: Promise.resolve({}) });
}
async function grant(projectId: string, body: Record<string, unknown>) {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  return POST(jsonReq(`http://x/v1/projects/${projectId}/access-grants`, body),
    { params: Promise.resolve({ projectId }) });
}
async function assign(projectId: string, body: Record<string, unknown>) {
  const { POST } = await import("../app/v1/projects/[projectId]/responsibilities/route");
  return POST(jsonReq(`http://x/v1/projects/${projectId}/responsibilities`, body),
    { params: Promise.resolve({ projectId }) });
}

describe("projects.create (INV-019)", () => {
  it("admin creates a project; creator gets project.admin AND project.view atomically", async () => {
    current = B;
    const res = await createProject("Приклад-ЖК");
    expect(res.status).toBe(201);
    const { projectId } = await res.json();
    const grants = await q<{ capability: string }>(
      "select capability from public.project_access_grants where workspace_id=$1 and project_id=$2 and member_id=$3 order by capability",
      [workspaceId, projectId, memberIdB]);
    expect(grants.map((g) => g.capability)).toEqual(["project.admin", "project.view"]);
  });

  it("member cannot create a project (403 SCOPE_DENIED)", async () => {
    current = C;
    const res = await createProject("Приклад-Заборонений");
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_DENIED");
  });
});

describe("GET /v1/projects (RLS-driven visibility)", () => {
  it("no grant → empty list; grant → project appears", async () => {
    current = B;
    const { projectId } = await (await createProject("Приклад-Видимість")).json();
    current = C;
    expect((await (await listProjects()).json()).projects).toEqual([]);
    current = B;
    await grant(projectId, { memberId: memberIdC, capabilities: ["imports.manage"] });
    current = C;
    const visible = (await (await listProjects()).json()).projects;
    expect(visible).toHaveLength(1);
    expect(visible[0].projectId).toBe(projectId);
  });
});

describe("project_access.grant", () => {
  it("granting an action capability auto-adds project.view (decision 6)", async () => {
    current = B;
    const { projectId } = await (await createProject("Приклад-Гранти")).json();
    const res = await grant(projectId, { memberId: memberIdC, capabilities: ["imports.manage"] });
    expect(res.status).toBe(201);
    const body = await res.json();
    const caps = body.granted.map((g: { capability: string }) => g.capability).sort();
    expect(caps).toEqual(["imports.manage", "project.view"]);
  });

  it("non-admin of the project cannot grant (403 SCOPE_PROJECT_DENIED)", async () => {
    current = B;
    const { projectId } = await (await createProject("Приклад-НеАдмін")).json();
    await grant(projectId, { memberId: memberIdC, capabilities: ["project.view"] });
    current = C;
    const res = await grant(projectId, { memberId: memberIdC, capabilities: ["imports.publish"] });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("cross-workspace project id → 404", async () => {
    current = B;
    const w2 = await q<{ id: string }>(
      "insert into public.organizations (legal_name, display_name) values ('Приклад-В2','Приклад-В2') returning id");
    const p2 = await q<{ id: string }>(
      "insert into public.projects (workspace_id, name, created_by) values ($1,'Приклад-Чужий',$2) returning id",
      [w2[0].id, A]);
    const res = await grant(p2[0].id, { memberId: memberIdC, capabilities: ["project.view"] });
    expect(res.status).toBe(404);
  });
});

describe("project_responsibilities.assign (SoD warnings)", () => {
  it("first responsibility clean; conflicting pair warns without blocking; rows append-only", async () => {
    current = B;
    const { projectId } = await (await createProject("Приклад-Відпов")).json();
    const first = await assign(projectId, { memberId: memberIdC, responsibility: "performer" });
    expect(first.status).toBe(201);
    expect((await first.json()).warnings).toEqual([]);
    const second = await assign(projectId, { memberId: memberIdC, responsibility: "internal_verifier" });
    expect(second.status).toBe(201);
    expect((await second.json()).warnings).toEqual(["sod:performer+internal_verifier"]);
    const rows = await q("select 1 from public.project_responsibility_assignments where workspace_id=$1 and project_id=$2", [workspaceId, projectId]);
    expect(rows).toHaveLength(2);
  });

  it("assigning to an inactive member → 422 VALIDATION_FAILED", async () => {
    current = B;
    const { projectId } = await (await createProject("Приклад-Неакт")).json();
    await q("update public.memberships set status='ended' where id=$1", [memberIdC]);
    const res = await assign(projectId, { memberId: memberIdC, responsibility: "performer" });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("VALIDATION_FAILED");
  });
});
