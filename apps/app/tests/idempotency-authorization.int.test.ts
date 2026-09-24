import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { ADMIN_URL, q, qBypassingGuards } from "./helpers/fixtures";

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
  expiredGrant: "de200000-0000-4000-8000-000000000007",
  telegram: "de200000-0000-4000-8000-000000000008",
  // DEV-022 / BL-112: the request hash binds the target.
  templates: "de200000-0000-4000-8000-000000000009",
  items: "de200000-0000-4000-8000-00000000000a",
  sameBody: "de200000-0000-4000-8000-00000000000b",
  otherWorkspace: "de200000-0000-4000-8000-00000000000c",
  demotedReuse: "de200000-0000-4000-8000-00000000000d",
  // DEV-043 / BL-021: project_access.revoke binds its project too.
  revoke: "de200000-0000-4000-8000-00000000000e",
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

/**
 * Every live grant of `capabilities` held by U on the project lapses: its validity window moves into the past.
 * A grant's window is frozen by 0099 (DEV-051), so the fixture rewrites it past the guard.
 */
async function expireGrants(ws: string, projectId: string, capabilities: string[]): Promise<void> {
  await qBypassingGuards(
    `update public.project_access_grants
        set valid_from = now() - interval '2 hours', valid_until = now() - interval '1 hour'
      where project_id = $1 and capability = any($4::text[]) and revoked_at is null
        and member_id = (select id from public.memberships where organization_id = $2 and user_id = $3)`,
    [projectId, ws, U, capabilities]);
}

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

afterEach(() => { vi.unstubAllEnvs(); });

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
          and member_id = (select id from public.memberships where organization_id = $2 and user_id = $3) and revoked_at is null`,
      [projectId, WS.accessGrant, U]);
    const again = await call("projects/[projectId]/access-grants", "POST", { projectId }, raw, key);
    expect(again.status).toBe(403);
    expect((await again.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  // S1-02: a grant's `valid_until` passing is the one reduction a v0.1 user can
  // cause through the product (project_access.grant takes it).
  it("project route (access grant): the caller's project.admin lapsed through valid_until → 403 SCOPE_PROJECT_DENIED", async () => {
    current = U;
    const created = await createProject(WS.expiredGrant, JSON.stringify({ name: "Об'єкт DEV-020" }), crypto.randomUUID());
    expect(created.status).toBe(201);
    const { projectId } = await created.json();
    const target = await q<{ id: string }>(
      "select id from public.memberships where organization_id = $1 and user_id = $2", [WS.expiredGrant, T]);
    const raw = JSON.stringify({ memberId: target[0]!.id, capabilities: ["project.view"] });
    const key = crypto.randomUUID();
    expect((await call("projects/[projectId]/access-grants", "POST", { projectId }, raw, key)).status).toBe(201);

    await expireGrants(WS.expiredGrant, projectId, ["project.admin"]);
    const again = await call("projects/[projectId]/access-grants", "POST", { projectId }, raw, key);
    expect(again.status).toBe(403);
    expect((await again.json()).code).toBe("SCOPE_PROJECT_DENIED");
    expect(again.headers.get("idempotency-replay-until")).toBeNull();
  });

  // S1-02: the service plane. This route already authorized in a tenant
  // transaction before its service transaction, so this case guards the shape
  // rather than proving a defect: it passes at 902c214 too.
  it("service plane (Telegram member link): the caller's project access lapsed → 404, nothing replayed", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t".repeat(32));
    vi.stubEnv("TELEGRAM_BOT_ID", "123456789");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "GoProceedTestBot");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "w".repeat(32));
    vi.stubEnv("TELEGRAM_WORKER_SECRET", "r".repeat(32));
    vi.stubEnv("TELEGRAM_LINK_HMAC_KEYS", `k1:${Buffer.alloc(32, 1).toString("base64")}`);
    vi.stubEnv("TELEGRAM_LINK_ACTIVE_KEY_ID", "k1");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://app.goproceed.test");
    current = U;
    const created = await createProject(WS.telegram, JSON.stringify({ name: "Об'єкт DEV-020" }), crypto.randomUUID());
    expect(created.status).toBe(201);
    const { projectId } = await created.json();
    // A member link needs the project's field channel (the intent's foreign key).
    expect((await call("projects/[projectId]/field-channel", "POST", { projectId },
      JSON.stringify({ channel: "telegram", expectedVersion: 1 }), crypto.randomUUID())).status).toBe(200);
    const key = crypto.randomUUID();
    const first = await call("projects/[projectId]/telegram/member-link-intents", "POST", { projectId }, "{}", key);
    expect(first.status).toBe(201);
    expect((await first.json()).kind).toBe("issued");

    // project.admin implies project.view (authz.ts), so both lapse. Without
    // project.view the project itself is invisible under RLS, so the lookup
    // answers first: 404, as for an ex-member on a resource route.
    await expireGrants(WS.telegram, projectId, ["project.view", "project.admin"]);
    const again = await call("projects/[projectId]/telegram/member-link-intents", "POST", { projectId }, "{}", key);
    const text = await again.text();
    expect(again.status).toBe(404);
    expect(JSON.parse(text).code).toBe("RESOURCE_NOT_FOUND");
    expect(text).not.toContain("replayed");
    expect(again.headers.get("idempotency-replay-until")).toBeNull();
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

/**
 * DEV-022 / BL-112: a command's request hash covered its body only, so a key
 * reused with the same body on ANOTHER target of the same command found the
 * first target's record and replayed its result, and the second target was
 * never touched. `commandRoute` now hashes the path parameters with the body.
 */
describe("a key reused for another target is refused, not replayed (BL-112)", () => {
  async function draftTemplate(ws: string, templateKey: string): Promise<string> {
    const res = await call("workspaces/[workspaceId]/requirement-templates", "POST", { workspaceId: ws },
      JSON.stringify({ templateKey, evidenceType: "photo", allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 1048576 } }),
      crypto.randomUUID());
    expect(res.status).toBe(201);
    return (await res.json()).templateVersionId as string;
  }
  const publish = (templateVersionId: string, key: string) =>
    call("requirement-templates/[templateVersionId]/publish", "POST", { templateVersionId }, "{}", key);
  const templateStatus = async (id: string) =>
    (await q<{ status: string }>("select status from public.requirement_template_versions where id = $1", [id]))[0]!.status;

  it("requirement_templates.publish: the same key on another template is 409, and that template stays a draft", async () => {
    current = U;
    const a = await draftTemplate(WS.templates, "dev022-a");
    const b = await draftTemplate(WS.templates, "dev022-b");
    const key = crypto.randomUUID();
    const first = await publish(a, key);
    expect(first.status).toBe(200);
    const body = await first.json();

    const reused = await publish(b, key);
    expect(reused.status).toBe(409);
    expect((await reused.json()).code).toBe("IDEMPOTENCY_CONFLICT");
    expect(await templateStatus(b)).toBe("draft");

    const again = await publish(a, key);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(body);
    expect(again.headers.get("idempotency-replay-until")).toBe(first.headers.get("idempotency-replay-until"));
    const upper = await publish(a.toUpperCase(), key);
    expect(upper.status).toBe(200);
    expect(upper.headers.get("idempotency-replay-until")).toBe(first.headers.get("idempotency-replay-until"));

    expect((await publish(b, crypto.randomUUID())).status).toBe(200);
  });

  it("project_requirements.archive: the same key on another item is 409, and that item stays active", async () => {
    current = U;
    const created = await createProject(WS.items, JSON.stringify({ name: "Об'єкт DEV-022" }), crypto.randomUUID());
    const { projectId } = await created.json();
    const item = async (n: string) => {
      const res = await call("workspaces/[workspaceId]/project-requirements", "POST", { workspaceId: WS.items },
        JSON.stringify({ projectId, itemTextUk: `Вимога ${n}`, sourceDocument: "РД", sourceSheet: "1", sourceDrawingNo: n }),
        crypto.randomUUID());
      expect(res.status).toBe(201);
      return (await res.json()).itemId as string;
    };
    const a = await item("A-1");
    const b = await item("B-1");
    const archive = (itemId: string, key: string) =>
      call("project-requirements/[itemId]/archive", "POST", { itemId }, "{}", key);
    const key = crypto.randomUUID();
    const first = await archive(a, key);
    expect(first.status).toBe(200);
    const body = await first.json();

    const reused = await archive(b, key);
    expect(reused.status).toBe(409);
    expect((await reused.json()).code).toBe("IDEMPOTENCY_CONFLICT");
    const stillActive = await q<{ status: string; archived_at: Date | null }>(
      "select status, archived_at from public.project_sourced_requirement_items where id = $1", [b]);
    expect(stillActive[0]).toEqual({ status: "active", archived_at: null });

    const again = await archive(a, key);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(body);
  });

  it("parties.update: an identical body on another party under the same key is 409, and that party is unchanged", async () => {
    current = U;
    const party = async (name: string) => {
      const res = await call("workspaces/[workspaceId]/parties", "POST", { workspaceId: WS.sameBody },
        JSON.stringify({ displayName: name }), crypto.randomUUID());
      expect(res.status).toBe(201);
      return (await res.json()).partyId as string;
    };
    const a = await party("Сторона A");
    const b = await party("Сторона B");
    const raw = JSON.stringify({ displayName: "Однакова назва", expectedVersion: 1 });
    const key = crypto.randomUUID();
    expect((await call("parties/[partyId]", "PATCH", { partyId: a }, raw, key)).status).toBe(200);
    const reused = await call("parties/[partyId]", "PATCH", { partyId: b }, raw, key);
    expect(reused.status).toBe(409);
    expect((await reused.json()).code).toBe("IDEMPOTENCY_CONFLICT");
    const rowB = await q<{ version: string; display_name: string }>(
      "select version, display_name from public.parties where id = $1", [b]);
    expect(Number(rowB[0]!.version)).toBe(1);
    expect(rowB[0]!.display_name).toBe("Сторона B");
  });

  it("the same key in another workspace executes, and a demoted caller reusing it gets 403, not 409", async () => {
    current = U;
    const a = await draftTemplate(WS.otherWorkspace, "dev022-c");
    const b = await draftTemplate(WS.demotedReuse, "dev022-d");
    const c = await draftTemplate(WS.demotedReuse, "dev022-e");
    const key = crypto.randomUUID();
    expect((await publish(a, key)).status).toBe(200);
    // Another workspace: another record scope, so a fresh execution.
    expect((await publish(b, key)).status).toBe(200);
    await setMembership(WS.demotedReuse, { role: "member" });
    const refused = await publish(c, key);
    expect(refused.status).toBe(403);
    expect((await refused.json()).code).toBe("SCOPE_DENIED");
    expect(await templateStatus(c)).toBe("draft");
  });

  it("project_access.revoke: the same key and body on another project is 409, and that project's grants are untouched", async () => {
    current = U;
    const project = async (name: string) => {
      const res = await createProject(WS.revoke, JSON.stringify({ name }), crypto.randomUUID());
      expect(res.status).toBe(201);
      return (await res.json()).projectId as string;
    };
    const a = await project("Об'єкт DEV-043 A");
    const b = await project("Об'єкт DEV-043 B");
    const target = (await q<{ id: string }>(
      "select id from public.memberships where organization_id = $1 and user_id = $2", [WS.revoke, T]))[0]!.id;
    for (const projectId of [a, b]) {
      const g = await call("projects/[projectId]/access-grants", "POST", { projectId },
        JSON.stringify({ memberId: target, capabilities: ["contracts.edit"] }), crypto.randomUUID());
      expect(g.status).toBe(201);
    }
    const raw = JSON.stringify({ memberId: target, capabilities: ["contracts.edit"] });
    const key = crypto.randomUUID();
    const revoke = (projectId: string) =>
      call("projects/[projectId]/access-grants/revoke", "POST", { projectId }, raw, key);
    expect((await revoke(a)).status).toBe(200);
    const reused = await revoke(b);
    expect(reused.status).toBe(409);
    expect((await reused.json()).code).toBe("IDEMPOTENCY_CONFLICT");
    const left = await q("select 1 from public.project_access_grants where project_id = $1 and member_id = $2 and revoked_at is null",
      [b, target]);
    expect(left).toHaveLength(2);
  });
});
