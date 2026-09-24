import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { ADMIN_URL, q } from "./helpers/fixtures";

/**
 * DEV-054 / BL-149: a grant or an assignment whose `validUntil` does not come
 * after its start is 422 on `validUntil` — not 500. An end relative to now is
 * checked against the transaction's `now()` inside `withIdempotency`, so a replay
 * of a request that committed while its end was ahead still gets the stored
 * response (review R1-01); `validUntil` against `validFrom` is the schema's.
 *
 * Before it, both contracts took any datetime, and the insert hit the tables'
 * CHECK `valid_until > valid_from` (0010): the grant starts at `now()`, the
 * assignment at `validFrom` or `now()`, so a past `validUntil` (or one not after
 * `validFrom`) raised 23514, which no route maps, and became 500 INTERNAL_ERROR.
 *
 * THIS FILE TRUNCATES NOTHING. It seeds its own workspace with fixed `de53…`
 * ids and deletes exactly that workspace's rows afterwards, as
 * project-access-grant.int.test.ts does. It needs APP_DB_URL.
 */

const id = (tail: string) => `de530000-0000-4000-8000-${tail.padStart(12, "0")}`;
const ADMIN = id("a1"), MEMBER = id("a2");
const WS = id("1");

vi.mock("../src/lib/auth", () => ({
  requireUser: async () => ({ userId: ADMIN }),
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

const members: Record<string, string> = {};
let projectId = "";

async function post(path: string, body: unknown, key: string = crypto.randomUUID()): Promise<Response> {
  const mod = await import(`../app/v1/projects/[projectId]/${path}/route`);
  return mod.POST(new Request(`http://x/v1/projects/${projectId}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ projectId }) });
}

const count = async (table: string) => Number((await q<{ n: string }>(
  `select count(*) as n from public.${table} where workspace_id = $1 and member_id = $2`, [WS, members.member]))[0]!.n);
const at = (ms: number) => new Date(Date.now() + ms).toISOString();

beforeAll(async () => {
  await dropWorkspace(WS);
  for (const u of [ADMIN, MEMBER]) {
    await q(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now())
       on conflict (id) do nothing`, [u, `${u}@fixture.test`]);
  }
  await q("insert into public.organizations (id, legal_name, display_name) values ($1, $2, $2)", [WS, "Приклад-Простір-53"]);
  for (const [key, user, role] of [["admin", ADMIN, "owner"], ["member", MEMBER, "member"]] as const) {
    const r = await q<{ id: string }>(
      "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, $3, 'active') returning id",
      [WS, user, role]);
    members[key] = r[0]!.id;
  }
  const p = await q<{ id: string }>(
    "insert into public.projects (workspace_id, name, created_by) values ($1, $2, $3) returning id",
    [WS, "Приклад-Проєкт-53", ADMIN]);
  projectId = p[0]!.id;
  for (const capability of ["project.admin", "project.view"]) {
    await q(
      `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
       values ($1, $2, $3, $4, $5)`, [WS, projectId, members.admin, capability, ADMIN]);
  }
}, 60_000);

afterAll(async () => {
  await dropWorkspace(WS);
});

function expectValidUntil422(status: number, body: { code: string; fieldErrors?: { path: string }[] }): void {
  expect(`${status} ${body.code}`).toBe("422 VALIDATION_FAILED");
  expect(body.fieldErrors?.map((e) => e.path)).toEqual(["validUntil"]);
}

describe("a validUntil that does not come after the start is 422, not 500 (DEV-054, BL-149)", () => {
  it("project_access.grant: a past validUntil is 422 and nothing is written", async () => {
    const res = await post("access-grants", { memberId: members.member, capabilities: ["contracts.edit"], validUntil: at(-60_000) });
    expectValidUntil422(res.status, await res.json());
    expect(await count("project_access_grants")).toBe(0);
  });

  it("project_access.grant: a future validUntil is still granted", async () => {
    const res = await post("access-grants", { memberId: members.member, capabilities: ["contracts.edit"], validUntil: at(86_400_000) });
    expect(res.status).toBe(201);
  });

  it("project_responsibilities.assign: a past validUntil without validFrom is 422 and nothing is written", async () => {
    const res = await post("responsibilities", { memberId: members.member, responsibility: "performer", validUntil: at(-60_000) });
    expectValidUntil422(res.status, await res.json());
    expect(await count("project_responsibility_assignments")).toBe(0);
  });

  it("project_responsibilities.assign: a validUntil not after validFrom is 422; a later one is assigned", async () => {
    const from = at(86_400_000);
    for (const until of [from, at(3_600_000)]) {
      const res = await post("responsibilities", { memberId: members.member, responsibility: "performer", validFrom: from, validUntil: until });
      expectValidUntil422(res.status, await res.json());
    }
    expect(await count("project_responsibility_assignments")).toBe(0);
    const ok = await post("responsibilities", { memberId: members.member, responsibility: "performer", validFrom: from, validUntil: at(2 * 86_400_000) });
    expect(ok.status).toBe(201);
  });

  it("a repeat of a held grant with a past validUntil is 422, where it used to write nothing and answer 201 (R1-03)", async () => {
    // The member holds contracts.edit and a covering view from the grant above: before DEV-054 the
    // duplicate was skipped and the route answered 201 { granted: [] }. The check runs first now.
    const before = await count("project_access_grants");
    const res = await post("access-grants", { memberId: members.member, capabilities: ["contracts.edit"], validUntil: at(-60_000) });
    expectValidUntil422(res.status, await res.json());
    expect(await count("project_access_grants")).toBe(before);
  });

  it("a replay after the end has passed returns the stored response, not 422 (R1-01)", async () => {
    for (const [path, rest] of [
      ["access-grants", { capabilities: ["imports.manage"] }],
      ["responsibilities", { responsibility: "evidence_recorder" }],
    ] as const) {
      // Anchored to the database's clock, which the routes compare with, not the host's (R2-02).
      const until = (await q<{ u: string }>(
        `select to_char((now() + interval '1.5 seconds') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as u`))[0]!.u;
      const body = { memberId: members.member, ...rest, validUntil: until };
      const key = crypto.randomUUID();
      const first = await post(path, body, key);
      expect(first.status, path).toBe(201);
      const stored = await first.json();
      // Wait until the database itself says the end has passed: the replay must be the only way to a 201.
      for (let i = 0; !(await q<{ past: boolean }>("select $1::timestamptz <= now() as past", [until]))[0]!.past; i++) {
        expect(i, "the end never passed").toBeLessThan(100);
        await new Promise((r) => setTimeout(r, 100));
      }
      const again = await post(path, body, key);
      expect(again.status, path).toBe(201);
      expect(again.headers.get("idempotency-replay-until"), path).toBeTruthy();
      expect(await again.json(), path).toEqual(stored);
    }
  }, 20_000);
});
