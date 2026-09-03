import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const admin = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const A = "aaaaaaaa-1111-1111-1111-111111111111";
const B = "bbbbbbbb-1111-1111-1111-111111111111";
let aProject: string;
let aOtherProject: string;
let bProject: string;
let aMember: string;
let bMember: string;
let aBindingId: string;
let aMessageId: string;
let immutableMessageId: string;
let aAttachmentId: string;
let otherProjectEvidenceId: string;

async function q<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string, params: unknown[] = [],
): Promise<T[]> {
  const c = new Client({ connectionString: admin });
  await c.connect();
  try { return (await c.query<T>(sql, params)).rows; }
  finally { await c.end(); }
}

async function cleanupFixtureWorld(): Promise<void> {
  const c = new Client({ connectionString: admin });
  await c.connect();
  await c.query("set session_replication_role = replica");
  try {
    const scoped = await c.query<{ table_name: string; column_name: string }>(`
      select c.table_name, c.column_name
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema and t.table_name = c.table_name
       where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
         and c.table_name <> 'organizations'
         and c.column_name in ('workspace_id', 'organization_id')`);
    for (const { table_name, column_name } of scoped.rows) {
      await c.query(`delete from public.${table_name} where ${column_name} in ($1, $2)`, [A, B]);
    }
    await c.query("delete from public.organizations where id in ($1, $2)", [A, B]);
  } finally {
    await c.query("set session_replication_role = origin");
    await c.end();
  }
}

async function insertBinding(workspaceId: string, projectId: string, memberId: string, chatId: string): Promise<string> {
  const rows = await q<{ id: string }>(`insert into public.telegram_chat_bindings
      (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
    values ($1, $2, 123456789, $4::bigint, 'supergroup', $3) returning id`,
  [workspaceId, projectId, memberId, chatId]);
  return rows[0]!.id;
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
  [aOtherProject] = (await q<{ id: string }>("insert into public.projects (workspace_id, name, created_by) values ($1, 'Telegram A other', $1) returning id", [A])).map((r) => r.id);
  [bProject] = (await q<{ id: string }>("insert into public.projects (workspace_id, name, created_by) values ($1, 'Telegram B', $1) returning id", [B])).map((r) => r.id);
  await q("insert into public.project_field_channels (workspace_id, project_id, channel) values ($1, $2, 'telegram'), ($1, $3, 'telegram'), ($4, $5, 'telegram')", [A, aProject, aOtherProject, B, bProject]);
  aBindingId = await insertBinding(A, aProject, aMember, "-100123");
  [aMessageId] = (await q<{ id: string }>(`insert into public.communication_messages
    (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, server_received_at, delivery_state)
    values ($1, $2, $3, 'inbound', 'photo', 'Фото', now(), 'received') returning id`, [A, aProject, aBindingId])).map((r) => r.id);
  [immutableMessageId] = (await q<{ id: string }>(`insert into public.communication_messages
    (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text, server_received_at, delivery_state)
    values ($1, $2, $3, 'inbound', 'text', 'Незмінне повідомлення', now(), 'received') returning id`, [A, aProject, aBindingId])).map((r) => r.id);
  [aAttachmentId] = (await q<{ id: string }>(`insert into public.communication_attachments
    (workspace_id, project_id, message_id, provider_file_id, provider_file_unique_id, state)
    values ($1, $2, $3, 'provider-file', 'provider-unique', 'processing') returning id`, [A, aProject, aMessageId])).map((r) => r.id);
  [otherProjectEvidenceId] = (await q<{ id: string }>(`insert into public.evidence_objects
    (workspace_id, project_id, content_hash, byte_size, media_type, storage_bucket, storage_key,
     storage_provider, origin_method, recorder_member_id, server_received_at, inspection_status, inspection_policy_version)
    values ($1, $2, repeat('b', 64), 1, 'image/jpeg', 'evidence', 'telegram-cross-project',
            'local', 'form', $3, now(), 'passed', 'test') returning id`, [A, aOtherProject, aMember])).map((r) => r.id);
});

afterAll(async () => {
  await q("delete from public.telegram_inbox_updates where bot_id=123456789 and update_id=77").catch(() => undefined);
  await cleanupFixtureWorld();
});

describe("Telegram persistence schema", () => {
  it("one live Telegram group cannot bind across tenants", async () => {
    await expect(insertBinding(B, bProject, bMember, "-100123"))
      .rejects.toMatchObject({ code: "23505" });
  });

  it("refuses evidence from another project in the same workspace", async () => {
    await expect(q(`update public.communication_attachments set evidence_object_id=$1
      where id=$2`, [otherProjectEvidenceId, aAttachmentId])).rejects.toMatchObject({ code: "23503" });
  });

  it("requires every provider file identifier to be cleared at terminal attachment states", async () => {
    await expect(q(`update public.communication_attachments
      set state='not_evidence', terminal_at=now(), provider_file_id=null
      where id=$1`, [aAttachmentId])).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects a message primary identity rewrite", async () => {
    await expect(q("update public.communication_messages set id=gen_random_uuid() where id=$1", [immutableMessageId]))
      .rejects.toThrow(/original is immutable/i);
  });

  it("rejects inbox and topic outbox leases above 900 seconds", async () => {
    await expect(q("select * from app.claim_telegram_inbox(1, 'schema-test', 901)"))
      .rejects.toThrow(/lease seconds must be between 1 and 900/i);
    await expect(q("select * from app.claim_outbox_topic('communication.telegram.send', 1, 'schema-test', 901)"))
      .rejects.toThrow(/lease seconds must be between 1 and 900/i);
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
