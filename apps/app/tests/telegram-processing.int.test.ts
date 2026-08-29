import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { withServiceTx, withTenantTx } from "@goproceed/database";

const admin = process.env.TEST_DB_ADMIN_URL ?? "";
const databaseDescribe = process.env.APP_DB_URL && process.env.SERVICE_DB_URL && admin ? describe : describe.skip;
const actorUserId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const botId = "123456789";

async function q<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string, params: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: admin });
  await client.connect();
  try {
    return (await client.query<T>(sql, params)).rows;
  } finally {
    await client.end();
  }
}

async function deleteFixture(workspaceId: string, inboxUpdateId: string): Promise<void> {
  const client = new Client({ connectionString: admin });
  await client.connect();
  try {
    // This is intentionally narrow: developer databases can be behind the
    // migration sequence, so this test never resets, truncates, seeds, or
    // sweeps unrelated tenant data.
    await client.query("set session_replication_role = replica");
    const scoped = await client.query<{ table_name: string; column_name: string }>(`
      select c.table_name, c.column_name
        from information_schema.columns c
        join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name
       where c.table_schema='public' and t.table_type='BASE TABLE'
         and c.table_name <> 'organizations'
         and c.column_name in ('workspace_id', 'organization_id')`);
    for (const { table_name, column_name } of scoped.rows) {
      await client.query(`delete from public.${table_name} where ${column_name}=$1`, [workspaceId]);
    }
    await client.query("delete from public.telegram_inbox_updates where bot_id=$1 and update_id between $2::bigint and ($2::bigint + 1)",
      [botId, inboxUpdateId]);
    await client.query("delete from public.organizations where id=$1", [workspaceId]);
  } finally {
    await client.query("set session_replication_role = origin").catch(() => undefined);
    await client.end();
  }
}

databaseDescribe("Telegram inbox processing", () => {
  let workspaceId = "";
  let projectId = "";
  let memberId = "";
  let bindingId = "";
  let updateId = "";

  beforeEach(async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t".repeat(32));
    vi.stubEnv("TELEGRAM_BOT_ID", botId);
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "GoProceedTestBot");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "w".repeat(32));
    vi.stubEnv("TELEGRAM_WORKER_SECRET", "r".repeat(32));
    vi.stubEnv("TELEGRAM_LINK_PEPPER", "p".repeat(32));
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://app.goproceed.test");

    workspaceId = crypto.randomUUID();
    [projectId] = (await q<{ id: string }>(`insert into public.organizations (id, legal_name, display_name)
      values ($1, 'Telegram processor', 'Telegram processor') returning id`, [workspaceId])).map((row) => row.id);
    [memberId] = (await q<{ id: string }>(`insert into public.memberships
      (organization_id, user_id, role, status, all_projects)
      values ($1, $2, 'owner', 'active', true) returning id`, [workspaceId, actorUserId])).map((row) => row.id);
    [projectId] = (await q<{ id: string }>(`insert into public.projects
      (workspace_id, name, created_by, status) values ($1, 'Telegram processor', $2, 'draft') returning id`,
    [workspaceId, actorUserId])).map((row) => row.id);
    await q(`insert into public.project_field_channels (workspace_id, project_id, channel, state)
      values ($1, $2, 'telegram', 'connected')`, [workspaceId, projectId]);
    [bindingId] = (await q<{ id: string }>(`insert into public.telegram_chat_bindings
      (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
      values ($1, $2, $3, -100777, 'supergroup', $4) returning id`,
    [workspaceId, projectId, botId, memberId])).map((row) => row.id);
    updateId = String(Math.floor(Math.random() * 1_000_000_000) + 1_000_000_000);
  });

  afterEach(async () => {
    if (workspaceId) await deleteFixture(workspaceId, updateId);
    vi.unstubAllEnvs();
  });

  it("stores an unlinked group author as unverified communication and clears the raw payload", async () => {
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state)
      values ($1, $2, $3::jsonb, repeat('a', 64), 'pending')`, [botId, updateId, JSON.stringify({
      update_id: Number(updateId),
      message: {
        message_id: 456, date: 1_700_000_000,
        chat: { id: -100777, type: "supergroup" },
        from: { id: 77, first_name: "Неперевірений" }, text: "Готово",
      },
    })]);

    const { processTelegramInboxBatch } = await import("../src/lib/telegram/processor");
    await expect(processTelegramInboxBatch({ workerId: "processing-test", limit: 10 }))
      .resolves.toEqual({ claimed: 1, processed: 1, failed: 0 });
    await expect(processTelegramInboxBatch({ workerId: "processing-test", limit: 10 }))
      .resolves.toEqual({ claimed: 0, processed: 0, failed: 0 });

    const [message] = await q<{ text: string; author_member_id: string | null; provider_user_id: string }>(
      "select text, author_member_id, provider_user_id::text from public.communication_messages where telegram_chat_binding_id=$1",
      [bindingId],
    );
    expect(message).toEqual({ text: "Готово", author_member_id: null, provider_user_id: "77" });
    const [inbox] = await q<{ state: string; payload: unknown; payload_hash: string }>(
      "select state, payload, payload_hash from public.telegram_inbox_updates where bot_id=$1 and update_id=$2",
      [botId, updateId],
    );
    expect(inbox).toEqual({ state: "processed", payload: null, payload_hash: "a".repeat(64) });
    const [outbox] = await q<{ count: string }>(
      "select count(*)::text as count from public.transaction_outbox where organization_id=$1 and topic='telegram.message.normalized'",
      [workspaceId],
    );
    expect(outbox).toEqual({ count: "1" });
  });

  it("appends edits without rewriting the original message", async () => {
    const originalUpdateId = String(Number(updateId) + 1);
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state)
      values ($1, $2, $3::jsonb, repeat('b', 64), 'pending')`, [botId, originalUpdateId, JSON.stringify({
      update_id: Number(originalUpdateId), message: {
        message_id: 457, date: 1_700_000_000, chat: { id: -100777, type: "supergroup" },
        from: { id: 77 }, text: "Було",
      },
    })]);
    const { processTelegramInboxBatch } = await import("../src/lib/telegram/processor");
    await processTelegramInboxBatch({ workerId: "processing-test", limit: 10 });
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state)
      values ($1, $2, $3::jsonb, repeat('c', 64), 'pending')`, [botId, updateId, JSON.stringify({
      update_id: Number(updateId), edited_message: {
        message_id: 457, date: 1_700_000_000, edit_date: 1_700_000_100,
        chat: { id: -100777, type: "supergroup" }, text: "Стало",
      },
    })]);
    await processTelegramInboxBatch({ workerId: "processing-test", limit: 10 });

    const [message] = await q<{ text: string }>(
      "select text from public.communication_messages where telegram_chat_binding_id=$1 and provider_message_id=457", [bindingId],
    );
    const [event] = await q<{ event_kind: string; text: string }>(
      `select event_kind, text from public.communication_message_events
       where workspace_id=$1 and project_id=$2 and event_kind='edited'`, [workspaceId, projectId],
    );
    expect(message).toEqual({ text: "Було" });
    expect(event).toEqual({ event_kind: "edited", text: "Стало" });
  });

  it("ignores an unknown group without creating a tenant message", async () => {
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state)
      values ($1, $2, $3::jsonb, repeat('d', 64), 'pending')`, [botId, updateId, JSON.stringify({
      update_id: Number(updateId), message: {
        message_id: 458, date: 1_700_000_000, chat: { id: -100999, type: "supergroup" }, from: { id: 77 }, text: "Не тут",
      },
    })]);
    const { processTelegramInboxBatch } = await import("../src/lib/telegram/processor");
    await processTelegramInboxBatch({ workerId: "processing-test", limit: 10 });
    const [count] = await q<{ count: string }>(
      "select count(*)::text as count from public.communication_messages where workspace_id=$1", [workspaceId],
    );
    expect(count).toEqual({ count: "0" });
  });

  it("retains normalized media metadata for later processing without creating evidence", async () => {
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state)
      values ($1, $2, $3::jsonb, repeat('1', 64), 'pending')`, [botId, updateId, JSON.stringify({
      update_id: Number(updateId), message: {
        message_id: 460, date: 1_700_000_000, chat: { id: -100777, type: "supergroup" }, from: { id: 77 },
        photo: [{ file_id: "photo-file", file_unique_id: "photo-unique", width: 20, height: 10, file_size: 123 }],
      },
    })]);
    const { processTelegramInboxBatch } = await import("../src/lib/telegram/processor");
    await processTelegramInboxBatch({ workerId: "processing-test", limit: 10 });
    const [attachment] = await q<{
      state: string; provider_file_id: string; provider_file_unique_id: string; media_type_snapshot: string; byte_size: string;
      evidence_object_id: string | null; requirement_occurrence_id: string | null;
    }>(`select state, provider_file_id, provider_file_unique_id, media_type_snapshot, byte_size::text,
               evidence_object_id, requirement_occurrence_id
          from public.communication_attachments where workspace_id=$1`, [workspaceId]);
    expect(attachment).toEqual({
      state: "staged", provider_file_id: "photo-file", provider_file_unique_id: "photo-unique",
      media_type_snapshot: "image/jpeg", byte_size: "123", evidence_object_id: null, requirement_occurrence_id: null,
    });
  });

  it("does not ingest a newly received message after the bound channel is archived", async () => {
    await q("update public.project_field_channels set state='archived' where workspace_id=$1 and project_id=$2", [workspaceId, projectId]);
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state)
      values ($1, $2, $3::jsonb, repeat('3', 64), 'pending')`, [botId, updateId, JSON.stringify({
      update_id: Number(updateId), message: {
        message_id: 461, date: 1_700_000_000, chat: { id: -100777, type: "supergroup" }, from: { id: 77 }, text: "Після архіву",
      },
    })]);
    const { processTelegramInboxBatch } = await import("../src/lib/telegram/processor");
    await expect(processTelegramInboxBatch({ workerId: "processing-test", limit: 10 }))
      .resolves.toEqual({ claimed: 1, processed: 1, failed: 0 });
    const [messageCount] = await q<{ count: string }>(
      "select count(*)::text as count from public.communication_messages where workspace_id=$1", [workspaceId],
    );
    const [outboxCount] = await q<{ count: string }>(
      "select count(*)::text as count from public.transaction_outbox where organization_id=$1 and topic='telegram.message.normalized'",
      [workspaceId],
    );
    expect(messageCount).toEqual({ count: "0" });
    expect(outboxCount).toEqual({ count: "0" });
  });

  it("does not append an edit after the bound channel is archived", async () => {
    await q(`insert into public.communication_messages
      (workspace_id, project_id, telegram_chat_binding_id, direction, kind, text,
       provider_message_id, provider_sent_at, delivery_state)
      values ($1, $2, $3, 'inbound', 'text', 'До архіву', 463, now(), 'received')`,
    [workspaceId, projectId, bindingId]);
    await q("update public.project_field_channels set state='archived' where workspace_id=$1 and project_id=$2", [workspaceId, projectId]);
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state)
      values ($1, $2, $3::jsonb, repeat('6', 64), 'pending')`, [botId, updateId, JSON.stringify({
      update_id: Number(updateId), edited_message: {
        message_id: 463, date: 1_700_000_000, edit_date: 1_700_000_100,
        chat: { id: -100777, type: "supergroup" }, text: "Після архіву",
      },
    })]);
    const { processTelegramInboxBatch } = await import("../src/lib/telegram/processor");
    await expect(processTelegramInboxBatch({ workerId: "processing-test", limit: 10 }))
      .resolves.toEqual({ claimed: 1, processed: 1, failed: 0 });
    const [message] = await q<{ text: string }>(
      "select text from public.communication_messages where telegram_chat_binding_id=$1 and provider_message_id=463", [bindingId],
    );
    const [eventCount] = await q<{ count: string }>(
      "select count(*)::text as count from public.communication_message_events where workspace_id=$1", [workspaceId],
    );
    expect(message).toEqual({ text: "До архіву" });
    expect(eventCount).toEqual({ count: "0" });
  });

  it("converges a stolen expired edit lease on one append-only event and one outbox intent", async () => {
    const originalUpdateId = String(Number(updateId) + 1);
    const editUpdateId = updateId;
    const originalPayload = {
      update_id: Number(originalUpdateId), message: {
        message_id: 462, date: 1_700_000_000, chat: { id: -100777, type: "supergroup" }, from: { id: 77 }, text: "Оригінал",
      },
    };
    const editPayload = {
      update_id: Number(editUpdateId), edited_message: {
        message_id: 462, date: 1_700_000_000, edit_date: 1_700_000_100,
        chat: { id: -100777, type: "supergroup" }, text: "Виправлено",
      },
    };
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state)
      values ($1, $2, $3::jsonb, repeat('4', 64), 'pending')`, [botId, originalUpdateId, JSON.stringify(originalPayload)]);
    const { processTelegramInboxBatch, processTelegramUpdate } = await import("../src/lib/telegram/processor");
    const { normalizeTelegramUpdate } = await import("../src/lib/telegram/normalize");
    await processTelegramInboxBatch({ workerId: "processing-test", limit: 10 });
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state)
      values ($1, $2, $3::jsonb, repeat('5', 64), 'pending')`, [botId, editUpdateId, JSON.stringify(editPayload)]);
    await q("select * from app.claim_telegram_inbox(1, 'stale-worker', 60)");

    await processTelegramUpdate(normalizeTelegramUpdate(editPayload));
    await q(`update public.telegram_inbox_updates
      set lease_expires_at=now() - interval '1 second'
      where bot_id=$1 and update_id=$2`, [botId, editUpdateId]);
    await expect(processTelegramInboxBatch({ workerId: "replacement-worker", limit: 10 }))
      .resolves.toEqual({ claimed: 1, processed: 1, failed: 0 });

    const [events] = await q<{ count: string }>(`select count(*)::text as count
      from public.communication_message_events where workspace_id=$1 and event_kind='edited'`, [workspaceId]);
    const [message] = await q<{ text: string }>(
      "select text from public.communication_messages where telegram_chat_binding_id=$1 and provider_message_id=462", [bindingId],
    );
    const [outbox] = await q<{ count: string }>(`select count(*)::text as count
      from public.transaction_outbox
      where organization_id=$1 and topic='telegram.message.normalized'
        and payload->>'providerUpdateId'=$2`, [workspaceId, editUpdateId]);
    expect(events).toEqual({ count: "1" });
    expect(message).toEqual({ text: "Оригінал" });
    expect(outbox).toEqual({ count: "1" });
  });

  it("allows only the constrained service-plane Telegram outbox RPC", async () => {
    const messageId = crypto.randomUUID();
    const providerUpdateId = Number(updateId);
    await q(`insert into public.communication_messages
      (id, workspace_id, project_id, telegram_chat_binding_id, direction, kind, text,
       provider_message_id, provider_sent_at, delivery_state)
      values ($1, $2, $3, $4, 'inbound', 'text', 'RPC source', 464, now(), 'received')`,
    [messageId, workspaceId, projectId, bindingId]);
    const args = [workspaceId, projectId, "telegram.message.normalized", messageId, providerUpdateId, "message"];
    const rpc = `select app.enqueue_telegram_processor_outbox(
      $1::uuid, $2::uuid, $3::text, $4::uuid, $5::bigint, $6::text
    )`;

    const [privileges] = await q<{ service_allowed: boolean; app_allowed: boolean }>(`select
      has_function_privilege('goproceed_service',
        'app.enqueue_telegram_processor_outbox(uuid,uuid,text,uuid,bigint,text)', 'execute') as service_allowed,
      has_function_privilege('goproceed_app',
        'app.enqueue_telegram_processor_outbox(uuid,uuid,text,uuid,bigint,text)', 'execute') as app_allowed`);
    expect(privileges).toEqual({ service_allowed: true, app_allowed: false });

    await withServiceTx({ actorUserId: "", organizationId: workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
      await tx.query(rpc, args);
    });
    const [outbox] = await q<{ aggregate_type: string; aggregate_id: string; event_kind: string }>(`select
      aggregate_type, aggregate_id, payload->>'eventKind' as event_kind
      from public.transaction_outbox
      where organization_id=$1 and topic='telegram.message.normalized' and aggregate_id=$2`, [workspaceId, messageId]);
    expect(outbox).toEqual({ aggregate_type: "communication_message", aggregate_id: messageId, event_kind: "message" });

    await expect(withTenantTx({ actorUserId, organizationId: workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
      await tx.query(rpc, args);
    })).rejects.toThrow(/permission denied/i);
    await expect(withServiceTx({ actorUserId: "", organizationId: workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
      await tx.query(rpc, [workspaceId, projectId, "unrelated.topic", messageId, providerUpdateId, "message"]);
    })).rejects.toThrow(/topic is not allowed/i);
    await expect(withServiceTx({ actorUserId: "", organizationId: workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
      await tx.query(rpc, [workspaceId, crypto.randomUUID(), "telegram.message.normalized", messageId, providerUpdateId, "message"]);
    })).rejects.toThrow(/aggregate does not match tenant/i);
  });

  it("does not retain a startgroup token as communication text", async () => {
    const rawToken = "never-store-this-token";
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state)
      values ($1, $2, $3::jsonb, repeat('e', 64), 'pending')`, [botId, updateId, JSON.stringify({
      update_id: Number(updateId), message: {
        message_id: 459, date: 1_700_000_000, chat: { id: -100777, type: "supergroup", title: "Група" },
        from: { id: 77 }, text: `/startgroup ${rawToken}`,
      },
    })]);
    const { processTelegramInboxBatch } = await import("../src/lib/telegram/processor");
    await processTelegramInboxBatch({ workerId: "processing-test", limit: 10 });
    const [messageCount] = await q<{ count: string }>(
      "select count(*)::text as count from public.communication_messages where workspace_id=$1", [workspaceId],
    );
    const [receipt] = await q<{ payload: unknown; disposition: string }>(
      "select payload, disposition from public.telegram_inbox_updates where bot_id=$1 and update_id=$2", [botId, updateId],
    );
    expect(messageCount).toEqual({ count: "0" });
    expect(receipt).toMatchObject({ payload: null, disposition: "binding_invalid_or_expired" });
    expect(JSON.stringify(receipt)).not.toContain(rawToken);
  });

  it("marks a bound channel unhealthy on bot removal and restores only its health", async () => {
    const restoredUpdateId = String(Number(updateId) + 1);
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state) values
      ($1, $2, $3::jsonb, repeat('f', 64), 'pending'),
      ($1, $4, $5::jsonb, repeat('0', 64), 'pending')`, [botId, updateId, JSON.stringify({
      update_id: Number(updateId), my_chat_member: {
        chat: { id: -100777, type: "supergroup" }, new_chat_member: { status: "kicked" },
      },
    }), restoredUpdateId, JSON.stringify({
      update_id: Number(restoredUpdateId), my_chat_member: {
        chat: { id: -100777, type: "supergroup" }, new_chat_member: { status: "member" },
      },
    })]);
    const { processTelegramInboxBatch } = await import("../src/lib/telegram/processor");
    await processTelegramInboxBatch({ workerId: "processing-test", limit: 10 });
    const [channel] = await q<{ state: string; locked_at: string | null }>(
      "select state::text, locked_at from public.project_field_channels where workspace_id=$1 and project_id=$2", [workspaceId, projectId],
    );
    const events = await q<{ event_kind: string }>(`select event_kind from public.communication_message_events
      where workspace_id=$1 and project_id=$2 order by created_at`, [workspaceId, projectId]);
    const [binding] = await q<{ chat_id: string }>(
      "select chat_id::text from public.telegram_chat_bindings where id=$1", [bindingId],
    );
    const [outboxCount] = await q<{ count: string }>(`select count(*)::text as count
      from public.transaction_outbox
      where organization_id=$1 and topic='telegram.channel.health_changed'`, [workspaceId]);
    expect(channel).toEqual({ state: "connected", locked_at: null });
    expect(events.map((event) => event.event_kind)).toEqual(["bot_removed", "bot_restored"]);
    expect(binding).toEqual({ chat_id: "-100777" });
    expect(outboxCount).toEqual({ count: "2" });
  });

  it("does not treat restricted bot membership as a healthy restoration", async () => {
    await q(`insert into public.telegram_inbox_updates (bot_id, update_id, payload, payload_hash, state)
      values ($1, $2, $3::jsonb, repeat('2', 64), 'pending')`, [botId, updateId, JSON.stringify({
      update_id: Number(updateId), my_chat_member: {
        chat: { id: -100777, type: "supergroup" }, new_chat_member: { status: "restricted" },
      },
    })]);
    const { processTelegramInboxBatch } = await import("../src/lib/telegram/processor");
    await processTelegramInboxBatch({ workerId: "processing-test", limit: 10 });
    const [channel] = await q<{ state: string }>(
      "select state::text from public.project_field_channels where workspace_id=$1 and project_id=$2", [workspaceId, projectId],
    );
    const [eventCount] = await q<{ count: string }>(
      "select count(*)::text as count from public.communication_message_events where workspace_id=$1", [workspaceId],
    );
    expect(channel).toEqual({ state: "connected" });
    expect(eventCount).toEqual({ count: "0" });
  });
});
