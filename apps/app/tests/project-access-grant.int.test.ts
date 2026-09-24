import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { ADMIN_URL, q, qBypassingGuards } from "./helpers/fixtures";

/**
 * DEV-048 / BL-140: `project_access.grant` keeps a member's `project.view`
 * window covering the action capabilities it was added for.
 *
 * Before it, the grant added `project.view` to any action capability but skipped
 * a still-unrevoked `project.view` as a duplicate without looking at its
 * window: a view that lapsed tomorrow stayed next to an undated action, and a
 * view that had already lapsed was never re-granted, so a member could hold an
 * action capability on a project they could not see (the Telegram evidence
 * resolver checks `evidence.record` alone, 0084). INV-111 covered the revoke
 * only.
 *
 * THIS FILE TRUNCATES NOTHING. It seeds its own workspace with fixed `de48…`
 * ids, one fresh project per case, and deletes exactly that workspace's rows
 * afterwards, as project-access-revoke.int.test.ts does. It needs APP_DB_URL.
 */

const id = (tail: string) => `de480000-0000-4000-8000-${tail.padStart(12, "0")}`;
const ADMIN = id("a1"), MEMBER = id("a2");
const WS = id("1");

vi.mock("../src/lib/auth", () => ({
  requireUser: async (_requestId: string, req?: Request) => ({ userId: req?.headers.get("x-test-user") ?? ADMIN }),
}));

async function dropWorkspace(ws: string): Promise<void> {
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
        await c.query(`delete from public.${table_name} where ${column_name} = $1`, [ws]);
      }
      await c.query("delete from public.organizations where id = $1", [ws]);
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

const members: Record<string, string> = {};

async function grantRoute(projectId: string, body: unknown, as = ADMIN): Promise<Response> {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  return POST(new Request(`http://x/v1/projects/${projectId}/access-grants`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID(), "x-test-user": as },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ projectId }) });
}

let seq = 0;
async function project(): Promise<string> {
  const p = await q<{ id: string }>(
    "insert into public.projects (workspace_id, name, created_by) values ($1, $2, $3) returning id",
    [WS, `Приклад-Проєкт-${++seq}`, ADMIN]);
  const projectId = p[0]!.id;
  await give(projectId, members.admin!, "project.admin");
  await give(projectId, members.admin!, "project.view");
  return projectId;
}

/** A grant written by the fixture, with an explicit window: `from`/`until` are SQL expressions. */
async function give(projectId: string, memberId: string, capability: string, until = "null", from = "now()"): Promise<string> {
  const r = await q<{ id: string }>(
    `insert into public.project_access_grants
       (workspace_id, project_id, member_id, capability, granted_by, valid_from, valid_until)
     values ($1, $2, $3, $4, $5, ${from}, ${until}) returning id`,
    [WS, projectId, memberId, capability, ADMIN]);
  return r[0]!.id;
}

type Row = { id: string; capability: string; revoked: boolean; until: Date | null };
async function rows(projectId: string, capability?: string): Promise<Row[]> {
  return q<Row>(
    `select id, capability, revoked_at is not null as revoked, valid_until as until
       from public.project_access_grants
      where workspace_id = $1 and project_id = $2 and member_id = $3 and ($4::text is null or capability = $4)
      order by created_at, id`,
    [WS, projectId, members.member, capability ?? null]);
}
const liveView = async (projectId: string) => (await rows(projectId, "project.view")).filter((r) => !r.revoked);
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

beforeAll(async () => {
  await dropWorkspace(WS);
  for (const u of [ADMIN, MEMBER]) await seedUser(u);
  await q("insert into public.organizations (id, legal_name, display_name) values ($1, $2, $2)", [WS, "Приклад-Простір-48"]);
  for (const [key, user, role] of [["admin", ADMIN, "owner"], ["member", MEMBER, "member"]] as const) {
    const r = await q<{ id: string }>(
      "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, $3, 'active') returning id",
      [WS, user, role]);
    members[key] = r[0]!.id;
  }
}, 60_000);

afterAll(async () => {
  await dropWorkspace(WS);
});

describe("project_access.grant keeps project.view covering the member's action capabilities (DEV-048, BL-140)", () => {
  it("an undated view already covers a dated action: the view is left alone", async () => {
    const projectId = await project();
    const view = await give(projectId, members.member!, "project.view");
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["contracts.edit"], validUntil: inDays(3) });
    expect(res.status).toBe(201);
    expect((await res.json()).granted.map((g: { capability: string }) => g.capability)).toEqual(["contracts.edit"]);
    expect((await liveView(projectId)).map((r) => r.id)).toEqual([view]);
  });

  it("a view that ends tomorrow is replaced by an undated one when an undated action is granted", async () => {
    const projectId = await project();
    const old = await give(projectId, members.member!, "project.view", "now() + interval '1 day'");
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["contracts.edit"] });
    expect(res.status).toBe(201);
    const granted = (await res.json()).granted as { capability: string; grantId: string }[];
    expect(granted.map((g) => g.capability).sort()).toEqual(["contracts.edit", "project.view"]);
    const view = await liveView(projectId);
    expect(view).toHaveLength(1);
    expect(view[0]).toMatchObject({ until: null });
    expect(view[0]!.id).toBe(granted.find((g) => g.capability === "project.view")!.grantId);
    expect((await rows(projectId, "project.view")).find((r) => r.id === old)).toMatchObject({ revoked: true });
    const audit = await q<{ details: Record<string, unknown> }>(
      "select details from public.audit_events where organization_id = $1 and object_id = $2 and action = 'project_access.granted'",
      [WS, projectId]);
    // gp-security S1-03: the event says what was written and what the view ended at before.
    const viewId = granted.find((g) => g.capability === "project.view")!.grantId;
    expect(audit[0]!.details).toMatchObject({
      replacedGrantIds: [old], grantIds: expect.arrayContaining(granted.map((g) => g.grantId)), validUntil: null,
      view: { grantId: viewId, replacedValidUntil: expect.stringMatching(/Z$/) },
    });
  });

  it("a view that ends tomorrow is extended to a dated action's end", async () => {
    const projectId = await project();
    await give(projectId, members.member!, "project.view", "now() + interval '1 day'");
    const until = inDays(10);
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["evidence.record"], validUntil: until });
    expect(res.status).toBe(201);
    const view = await liveView(projectId);
    expect(view).toHaveLength(1);
    expect(view[0]!.until?.toISOString()).toBe(until);
  });

  it("the view also covers the member's other unexpired actions, not only the one granted now", async () => {
    const projectId = await project();
    await give(projectId, members.member!, "contracts.edit");
    await give(projectId, members.member!, "project.view", "now() + interval '2 days'");
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["evidence.record"], validUntil: inDays(1) });
    expect(res.status).toBe(201);
    expect(await liveView(projectId)).toEqual([expect.objectContaining({ until: null })]);
  });

  it("a lapsed, unrevoked view is re-granted instead of being skipped as a duplicate", async () => {
    const projectId = await project();
    const lapsed = await give(projectId, members.member!, "project.view", "now() - interval '1 day'", "now() - interval '2 days'");
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["project.view"] });
    expect(res.status).toBe(201);
    expect((await res.json()).granted.map((g: { capability: string }) => g.capability)).toEqual(["project.view"]);
    expect(await liveView(projectId)).toEqual([expect.objectContaining({ until: null })]);
    expect((await rows(projectId, "project.view")).find((r) => r.id === lapsed)).toMatchObject({ revoked: true });
  });

  it("a project.view grant alone that would end before the member's actions is 422 on validUntil, and nothing is written", async () => {
    const projectId = await project();
    await give(projectId, members.member!, "contracts.edit");
    const before = await rows(projectId);
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["project.view"], validUntil: inDays(1) });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fieldErrors.map((e: { path: string }) => e.path)).toEqual(["validUntil"]);
    expect(await rows(projectId)).toEqual(before);
  });

  it("a lapsed action does not hold the view open: a short view alone is granted", async () => {
    const projectId = await project();
    await give(projectId, members.member!, "contracts.edit", "now() - interval '1 day'", "now() - interval '2 days'");
    const until = inDays(1);
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["project.view"], validUntil: until });
    expect(res.status).toBe(201);
    // Review R1-02: the view is the one asked for, not widened by the lapsed action.
    expect((await liveView(projectId)).map((r) => r.until?.toISOString())).toEqual([until]);
  });

  it("a view that already covers is never shortened by a shorter request", async () => {
    const projectId = await project();
    const view = await give(projectId, members.member!, "project.view");
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["project.view"], validUntil: inDays(1) });
    expect(res.status).toBe(201);
    expect((await res.json()).granted).toEqual([]);
    expect((await liveView(projectId)).map((r) => [r.id, r.until])).toEqual([[view, null]]);
  });
});

describe("the late review of DEV-048 (2026-09-24)", () => {
  it("R1-01: a view not yet valid — as one a concurrent grant commits — is replaced by a live one, never a shorter one", async () => {
    const projectId = await project();
    const future = await give(projectId, members.member!, "project.view", "null", "now() + interval '1 minute'");
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["contracts.edit"], validUntil: inDays(1) });
    expect(res.status).toBe(201);
    // Review R2-02: the future view was replaced, and its replacement is live and undated.
    expect((await rows(projectId, "project.view")).find((r) => r.id === future)).toMatchObject({ revoked: true });
    const live = await q<{ id: string; until: Date | null }>(
      `select id, valid_until as until from public.project_access_grants
        where project_id = $1 and member_id = $2 and capability = 'project.view' and revoked_at is null and valid_from <= now()`,
      [projectId, members.member]);
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ until: null });
    const audit = await q<{ details: Record<string, unknown> }>(
      "select details from public.audit_events where organization_id = $1 and object_id = $2 and action = 'project_access.granted' order by occurred_at desc limit 1",
      [WS, projectId]);
    // gp-security S2-02: a view that had not started is visible in the event.
    expect(audit[0]!.details).toMatchObject({ view: { replacedValidFrom: expect.stringMatching(/Z$/), replacedValidUntil: null } });
  });

  it("gp-security S1-02: a requested action skipped as a lapsed duplicate does not widen the view", async () => {
    const projectId = await project();
    await give(projectId, members.member!, "contracts.edit", "now() - interval '1 day'", "now() - interval '2 days'");
    const view = await give(projectId, members.member!, "project.view", "now() + interval '1 day'");
    const before = await liveView(projectId);
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["contracts.edit"] });
    expect(res.status).toBe(201);
    expect((await res.json()).granted).toEqual([]);
    expect((await liveView(projectId)).map((r) => [r.id, r.until?.getTime()])).toEqual([[view, before[0]!.until?.getTime()]]);
  });

  it("review R2-03: a held live action with a lapsed view gets a covering view from the next grant, even one that inserts nothing", async () => {
    const projectId = await project();
    await give(projectId, members.member!, "contracts.edit");
    const lapsed = await give(projectId, members.member!, "project.view", "now() - interval '1 day'", "now() - interval '2 days'");
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["contracts.edit"] });
    expect(res.status).toBe(201);
    expect((await res.json()).granted.map((g: { capability: string }) => g.capability)).toEqual(["project.view"]);
    expect(await liveView(projectId)).toEqual([expect.objectContaining({ until: null })]);
    expect((await rows(projectId, "project.view")).find((r) => r.id === lapsed)).toMatchObject({ revoked: true });
  });

  it("review R2-01: a sub-millisecond end is written to the view as sent, so the view never ends before the action", async () => {
    const projectId = await project();
    const until = new Date(Date.now() + 86_400_000).toISOString().replace(/\.(\d{3})Z$/, ".$1500Z");
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["contracts.edit"], validUntil: until });
    expect(res.status).toBe(201);
    const covered = await q<{ ok: boolean }>(
      `select v.valid_until >= a.valid_until as ok
         from public.project_access_grants v join public.project_access_grants a
           on a.project_id = v.project_id and a.member_id = v.member_id
        where v.project_id = $1 and v.member_id = $2 and v.capability = 'project.view' and v.revoked_at is null
          and a.capability = 'contracts.edit' and a.revoked_at is null`,
      [projectId, members.member]);
    expect(covered).toEqual([{ ok: true }]);
  });

  it("gp-security S1-01 (owner 2026-09-24 «Раскрывать»): each granted row names the end it was written with", async () => {
    const projectId = await project();
    await give(projectId, members.member!, "contracts.edit");
    await give(projectId, members.member!, "project.view", "now() + interval '1 day'");
    const until = inDays(1);
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["evidence.record"], validUntil: until });
    expect(res.status).toBe(201);
    const granted = (await res.json()).granted as { capability: string; validUntil: string | null }[];
    expect(granted.find((g) => g.capability === "evidence.record")).toMatchObject({ validUntil: until });
    // The view came out undated because of the held undated action — and the response says so.
    expect(granted.find((g) => g.capability === "project.view")).toMatchObject({ validUntil: null });
  });
});

/**
 * DEV-050 / BL-137 (owner, 2026-09-24: «Зафиксировать + BL-014»): through the
 * product a project keeps an active member with a live, undated
 * `project.admin` grant. `projects.create` gives the creator one; the revoke
 * refuses to take the last one (INV-110); and the grant never touches an
 * existing admin row, so a dated `project.admin` can only exist beside an
 * undated one and its lapse is harmless. These cases pin the grant's half.
 */
describe("a dated administrator grant never displaces the undated one (DEV-050, BL-137)", () => {
  const adminRows = (projectId: string, memberId: string) => q<{ until: Date | null; revoked: boolean }>(
    `select valid_until as until, revoked_at is not null as revoked from public.project_access_grants
      where workspace_id = $1 and project_id = $2 and member_id = $3 and capability = 'project.admin'`,
    [WS, projectId, memberId]);

  it("a dated re-grant of project.admin to its undated holder is skipped, and the grant stays undated", async () => {
    const projectId = await project();
    const res = await grantRoute(projectId, { memberId: members.admin, capabilities: ["project.admin"], validUntil: inDays(1) });
    expect(res.status).toBe(201);
    expect((await res.json()).granted).toEqual([]);
    expect(await adminRows(projectId, members.admin!)).toEqual([{ until: null, revoked: false }]);
  });

  it("another member's dated administrator grant lapses beside the creator's, and the creator still administers the project", async () => {
    const projectId = await project();
    const until = inDays(2);
    const res = await grantRoute(projectId, { memberId: members.member, capabilities: ["project.admin"], validUntil: until });
    expect(res.status).toBe(201);
    expect(await adminRows(projectId, members.admin!)).toEqual([{ until: null, revoked: false }]);
    expect(await adminRows(projectId, members.member!)).toEqual([{ until: new Date(until), revoked: false }]);
    // The member's dated grant has since lapsed: written by the fixture past 0099's guard, as a lapse cannot be waited for.
    const lapsed = await q<{ id: string }>(
      `select id from public.project_access_grants
        where workspace_id = $1 and project_id = $2 and member_id = $3 and capability = 'project.admin'`,
      [WS, projectId, members.member]);
    await qBypassingGuards(
      `update public.project_access_grants set valid_from = now() - interval '2 days', valid_until = now() - interval '1 day'
        where id = $1`, [lapsed[0]!.id]);
    // The lapse took effect: the member, whose view still runs, can no longer grant.
    const refused = await grantRoute(projectId, { memberId: members.admin, capabilities: ["contracts.edit"] }, MEMBER);
    expect(refused.status).toBe(403);
    expect((await refused.json()).code).toBe("SCOPE_PROJECT_DENIED");
    const again = await grantRoute(projectId, { memberId: members.member, capabilities: ["contracts.edit"] });
    expect(again.status).toBe(201);
  });
});
