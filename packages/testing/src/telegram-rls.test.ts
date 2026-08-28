import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, asActor, dropWorkspaces } from "./pg";
import type { Client } from "pg";

const WS_A = "cccccccc-1111-1111-1111-111111111111";
const WS_B = "dddddddd-1111-1111-1111-111111111111";
const OWNER = "eeeeeeee-1111-1111-1111-111111111111";
const UNRELATED = "ffffffff-1111-1111-1111-111111111111";
let admin: Client;
let projectId: string;
let ownerMemberId: string;

beforeAll(async () => {
  admin = await adminClient();
  await admin.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'telegram-owner@example.test', '', now(), now()),
           ($2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'telegram-unrelated@example.test', '', now(), now())
    on conflict (id) do nothing`, [OWNER, UNRELATED]);
  await admin.query("insert into public.organizations (id, legal_name, display_name) values ($1, 'Telegram RLS A', 'Telegram RLS A'), ($2, 'Telegram RLS B', 'Telegram RLS B')", [WS_A, WS_B]);
  const member = await admin.query<{ id: string }>("insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'owner', 'active') returning id", [WS_A, OWNER]);
  ownerMemberId = member.rows[0]!.id;
  await admin.query("insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'member', 'active')", [WS_A, UNRELATED]);
  const project = await admin.query<{ id: string }>("insert into public.projects (workspace_id, name, created_by) values ($1, 'Telegram RLS', $2) returning id", [WS_A, OWNER]);
  projectId = project.rows[0]!.id;
  await admin.query("insert into public.project_field_channels (workspace_id, project_id, channel) values ($1, $2, 'telegram')", [WS_A, projectId]);
  const binding = await admin.query<{ id: string }>(`insert into public.telegram_chat_bindings
    (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
    values ($1, $2, 123456789, -100998, 'supergroup', $3) returning id`, [WS_A, projectId, ownerMemberId]);
  await admin.query(`insert into public.communication_messages
    (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, server_received_at, delivery_state)
    values ($1, $2, $3, 'inbound', 'text', 'Тест', now(), 'received')`, [WS_A, projectId, binding.rows[0]!.id]);
});

afterAll(async () => {
  await dropWorkspaces(admin, [WS_A, WS_B]);
  await admin.end();
});

describe("Telegram communication RLS", () => {
  it("a member with no project.view cannot read communication", async () => {
    const visible = await asActor(UNRELATED, WS_A, (c) => c.query(
      "select id from public.communication_messages where project_id=$1", [projectId],
    ));
    expect(visible.rows).toEqual([]);
  });

  it("an anonymous transaction cannot enumerate communication rows", async () => {
    const visible = await asActor("", null, (c) => c.query("select id from public.communication_messages"));
    expect(visible.rows).toEqual([]);
  });
});
