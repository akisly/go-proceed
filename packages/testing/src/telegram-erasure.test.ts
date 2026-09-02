import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { Client, QueryResult } from "pg";
import { adminClient, asActor, asService, dropWorkspaces } from "./pg";

/**
 * THE ERASURE PROCEDURE, EXERCISED ON SYNTHETIC DATA — M0 gate 4's «manual
 * deletion procedure … exercised once end to end», scoped to one identity.
 *
 * Fixture: workspace WS_A with two Telegram senders. X (SUBJECT) wrote two
 * messages, one of them edited, has a member link and one attachment with a
 * filename. Y (BYSTANDER) wrote one message. Every assertion about X is paired
 * with «and Y is byte-identical», because an erasure that reaches one row too
 * many is a different bug from one that reaches one too few.
 */
const WS_A = "a1a1a1a1-2222-4222-8222-222222222222";
const WS_B = "b1b1b1b1-2222-4222-8222-222222222222";
const OWNER = "c1c1c1c1-2222-4222-8222-222222222222";
const SUBJECT = 700001n;
const BYSTANDER = 700002n;
const MARKER = "[текст стерто на запит]";
const PEPPER = "p".repeat(32);

let admin: Client;
let projectId: string;
let ownerMemberId: string;
let bindingId: string;
let subjectMessageIds: string[] = [];
let bystanderMessageId: string;

export function subjectHmac(pepper: string, workspaceId: string, telegramUserId: bigint): string {
  return createHmac("sha256", pepper).update(`erasure:${workspaceId}:${telegramUserId}`, "utf8").digest("hex");
}

async function sqlstate(fn: () => Promise<unknown>): Promise<string> {
  try { await fn(); return "ok"; } catch (e) { return (e as { code?: string }).code ?? "unknown"; }
}

/** One row of every column the guard watches, as a comparable object. */
async function messageRow(id: string): Promise<Record<string, unknown>> {
  const r = await admin.query("select * from public.communication_messages where id = $1", [id]);
  return r.rows[0]!;
}

beforeAll(async () => {
  admin = await adminClient();
  await admin.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'erasure-owner@example.test', '', now(), now())
    on conflict (id) do nothing`, [OWNER]);
  await admin.query("insert into public.organizations (id, legal_name, display_name) values ($1, 'Erasure A', 'Erasure A'), ($2, 'Erasure B', 'Erasure B')", [WS_A, WS_B]);
  const member = await admin.query<{ id: string }>("insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'owner', 'active') returning id", [WS_A, OWNER]);
  ownerMemberId = member.rows[0]!.id;
  const project = await admin.query<{ id: string }>("insert into public.projects (workspace_id, name, created_by) values ($1, 'Erasure', $2) returning id", [WS_A, OWNER]);
  projectId = project.rows[0]!.id;
  await admin.query("insert into public.project_field_channels (workspace_id, project_id, channel) values ($1, $2, 'telegram')", [WS_A, projectId]);
  const binding = await admin.query<{ id: string }>(`insert into public.telegram_chat_bindings
    (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
    values ($1, $2, 123456789, -100777, 'supergroup', $3) returning id`, [WS_A, projectId, ownerMemberId]);
  bindingId = binding.rows[0]!.id;
  const insertMessage = async (sender: bigint, text: string | null, name: string, username: string) => {
    const r = await admin.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, provider_user_id,
       provider_display_name_snapshot, provider_username_snapshot, server_received_at, delivery_state)
      values ($1, $2, $3, 'inbound', 'text', $4, $5, $6, $7, now(), 'received') returning id`,
      [WS_A, projectId, bindingId, text, sender.toString(), name, username]);
    return r.rows[0]!.id;
  };
  subjectMessageIds = [
    await insertMessage(SUBJECT, "Кабель прокладено, фото додаю", "Петро Петренко", "petrenko"),
    await insertMessage(SUBJECT, null, "Петро Петренко", "petrenko"),
  ];
  bystanderMessageId = await insertMessage(BYSTANDER, "Прийнято", "Ольга Іваненко", "ivanenko");
  await admin.query(`insert into public.communication_message_events
    (workspace_id, project_id, message_id, event_kind, text, server_received_at)
    values ($1, $2, $3, 'edited', 'Кабель прокладено, фото додаю (виправлено)', now())`,
    [WS_A, projectId, subjectMessageIds[0]]);
  await admin.query(`insert into public.telegram_member_links
    (workspace_id, member_id, telegram_user_id, display_name_snapshot, username_snapshot, linked_by_member_id)
    values ($1, $2, $3, 'Петро Петренко', 'petrenko', $2)`, [WS_A, ownerMemberId, SUBJECT.toString()]);
  await admin.query(`insert into public.communication_attachments
    (workspace_id, project_id, message_id, provider_file_id, provider_file_unique_id,
     filename_snapshot, media_type_snapshot, byte_size, state)
    values ($1, $2, $3, 'file-x', 'uniq-x', 'Петренко_акт.pdf', 'application/pdf', 11, 'staged')`,
    [WS_A, projectId, subjectMessageIds[0]]);
});

afterAll(async () => {
  await dropWorkspaces(admin, [WS_A, WS_B]);
  await admin.end();
});

describe("§1 — the registry and the policy exist, in schema app, reachable by no role", () => {
  it("app.telegram_erasures answers 42501 to the member plane and to the service plane", async () => {
    expect(await sqlstate(() => asActor(OWNER, WS_A, (c) => c.query("select 1 from app.telegram_erasures")))).toBe("42501");
    expect(await sqlstate(() => asService("", WS_A, (c) => c.query("select 1 from app.telegram_erasures")))).toBe("42501");
  });

  it("app.retention_policy answers 42501 to both planes and holds three NULL durations", async () => {
    expect(await sqlstate(() => asActor(OWNER, WS_A, (c) => c.query("select 1 from app.retention_policy")))).toBe("42501");
    expect(await sqlstate(() => asService("", WS_A, (c) => c.query("select 1 from app.retention_policy")))).toBe("42501");
    const r = await admin.query<{ data_class: string; duration: string | null }>(
      "select data_class, duration::text as duration from app.retention_policy order by 1");
    expect(r.rows).toEqual([
      { data_class: "customer_communication", duration: null },
      { data_class: "customer_identity", duration: null },
      { data_class: "operational_security", duration: null },
    ]);
  });

  it("both tables have row level security enabled and no policy", async () => {
    const r = await admin.query<{ relname: string; rls: boolean; policies: number }>(`
      select c.relname, c.relrowsecurity as rls,
             (select count(*) from pg_policies p where p.schemaname = 'app' and p.tablename = c.relname)::int as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'app' and c.relname in ('telegram_erasures', 'retention_policy') order by 1`);
    expect(r.rows).toEqual([
      { relname: "retention_policy", rls: true, policies: 0 },
      { relname: "telegram_erasures", rls: true, policies: 0 },
    ]);
  });
});
