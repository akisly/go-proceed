import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor, dropWorkspaces } from "./pg";

/**
 * READINESS GATE 11, MODULE requirements, the last row (DEV-016, BL-097).
 *
 * The DEV-014 shape: the owner of A reads A's requirement template version;
 * the owner of B, declaring workspace A, reads only B's. rtv_select is
 * membership only. Each workspace gets a user, the workspace, its owner and one
 * draft template version (the shape m2-rls.test.ts seeds). No resetDb.
 */
const WS_A = "de166a00-0000-4000-8000-000000000001";
const WS_B = "de166b00-0000-4000-8000-000000000001";
const USER_A = "de166a00-0000-4000-8000-0000000000a1";
const USER_B = "de166b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];

let admin: Client;

async function seedSide(ws: string, user: string, name: string): Promise<void> {
  await admin.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now())
     on conflict (id) do nothing`, [user, `${user}@fixture.test`]);
  await admin.query(
    "insert into public.organizations (id, legal_name, display_name) values ($1, $2, $2)",
    [ws, `Приклад-Простір-${name}`]);
  const member = await admin.query<{ id: string }>(
    "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'owner', 'active') returning id",
    [ws, user]);
  await admin.query(
    `insert into public.requirement_template_versions
       (workspace_id, template_key, version_no, evidence_type, allowed_media, created_by_member_id)
     values ($1, 'dev016-set', 1, 'photo', '{"mimeTypes":["image/jpeg"],"maxByteSize":1024}'::jsonb, $2)`,
    [ws, member.rows[0]!.id]);
}

/** The distinct workspaces of the rows `actor` can read, declaring workspace A. */
async function seen(actor: string, sql: string): Promise<string[]> {
  const r = await asActor<{ ws: string }>(actor, WS_A, (c) => c.query(sql, [BOTH]));
  return r.rows.map((row) => row.ws).sort();
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  await seedSide(WS_A, USER_A, "DEV016-RQ-A");
  await seedSide(WS_B, USER_B, "DEV016-RQ-B");
}, 60_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("requirements isolation — the owner of A reaches rows of A and the owner of B declaring A reaches only rows of B", () => {
  it("requirement_template_versions: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.requirement_template_versions where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });
});
