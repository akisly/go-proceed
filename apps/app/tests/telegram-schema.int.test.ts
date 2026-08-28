import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const A = "aaaaaaaa-1111-1111-1111-111111111111";
const B = "bbbbbbbb-1111-1111-1111-111111111111";
let aProject: string;
let bProject: string;
let aMember: string;
let bMember: string;

async function q<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string, params: unknown[] = [],
): Promise<T[]> {
  const c = new Client({ connectionString: admin });
  await c.connect();
  try { return (await c.query<T>(sql, params)).rows; }
  finally { await c.end(); }
}

async function insertBinding(workspaceId: string, projectId: string, memberId: string, chatId: string) {
  return q(`insert into public.telegram_chat_bindings
      (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
    values ($1, $2, 123456789, $4::bigint, 'supergroup', $3)`,
  [workspaceId, projectId, memberId, chatId]);
}

beforeAll(async () => {
  await q(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'telegram-a@example.test', '', now(), now()),
           ($2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'telegram-b@example.test', '', now(), now())
    on conflict (id) do nothing`, [A, B]);
  await q("insert into public.organizations (id, legal_name, display_name) values ($1, 'Telegram A', 'Telegram A'), ($2, 'Telegram B', 'Telegram B')", [A, B]);
  [aMember] = (await q<{ id: string }>("insert into public.memberships (organization_id, user_id, role, status) values ($1, $1, 'owner', 'active') returning id", [A])).map((r) => r.id);
  [bMember] = (await q<{ id: string }>("insert into public.memberships (organization_id, user_id, role, status) values ($1, $1, 'owner', 'active') returning id", [B])).map((r) => r.id);
  [aProject] = (await q<{ id: string }>("insert into public.projects (workspace_id, name, created_by) values ($1, 'Telegram A', $1) returning id", [A])).map((r) => r.id);
  [bProject] = (await q<{ id: string }>("insert into public.projects (workspace_id, name, created_by) values ($1, 'Telegram B', $1) returning id", [B])).map((r) => r.id);
  await q("insert into public.project_field_channels (workspace_id, project_id, channel) values ($1, $2, 'telegram'), ($3, $4, 'telegram')", [A, aProject, B, bProject]);
});

afterAll(async () => {
  await q("delete from public.telegram_inbox_updates where bot_id=123456789 and update_id=77").catch(() => undefined);
  await q("delete from public.telegram_chat_bindings where workspace_id in ($1, $2)", [A, B]).catch(() => undefined);
  await q("delete from public.project_field_channels where workspace_id in ($1, $2)", [A, B]).catch(() => undefined);
  await q("delete from public.projects where workspace_id in ($1, $2)", [A, B]);
  await q("delete from public.memberships where organization_id in ($1, $2)", [A, B]);
  await q("delete from public.organizations where id in ($1, $2)", [A, B]);
});

describe("Telegram persistence schema", () => {
  it("one live Telegram group cannot bind across tenants", async () => {
    await insertBinding(A, aProject, aMember, "-100123");
    await expect(insertBinding(B, bProject, bMember, "-100123"))
      .rejects.toMatchObject({ code: "23505" });
  });

  it("records a terminal inbox receipt without retaining its raw webhook payload", async () => {
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state)
      values (123456789, 77, '{"update_id":77}'::jsonb, repeat('a', 64), 'pending')`);
    const [claimed] = await q<{ lease_id: string }>(
      "select lease_id from app.claim_telegram_inbox(1, 'schema-test', 60)",
    );
    await q("select app.complete_telegram_inbox(123456789, 77, $1, 'normalized')", [claimed!.lease_id]);
    const rows = await q<{ state: string; payload: unknown }>(
      "select state, payload from public.telegram_inbox_updates where bot_id=123456789 and update_id=77",
    );
    expect(rows).toEqual([{ state: "processed", payload: null }]);
  });
});
