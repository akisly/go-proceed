import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { withServiceTx, withTenantTx } from "@goproceed/database";
import { ADMIN_URL, hasIsolatedDatabaseCredentials } from "./helpers/fixtures";

const admin = ADMIN_URL;
const databaseDescribe = hasIsolatedDatabaseCredentials() ? describe : describe.skip;
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

  it("exposes decision tokens only through the bounded service RPC surface", async () => {
    const [privileges] = await q<{
      service_table_read: boolean; app_claim: boolean; service_claim: boolean;
      guard_count: string; return_reply_column: boolean; review_context_columns: string;
      old_claim_absent: boolean; old_issue_absent: boolean; old_finalize_absent: boolean;
      old_reserve_absent: boolean; retry_service: boolean; guard_allows_revocation_receipt: boolean;
      resolver_is_validate_only: boolean; old_finalize_v2_absent: boolean; old_finalize_v2_no_execute: boolean;
      attempt_table_read: boolean; attempt_guard: boolean; control_recovery_service: boolean;
      attempt_start_service: boolean; attempt_start_app: boolean; attempt_claim_service: boolean;
    }>(`select
      has_table_privilege('goproceed_service','public.telegram_evidence_decision_tokens','select') as service_table_read,
      has_function_privilege('goproceed_app',
        'app.claim_telegram_evidence_decision_token(text,bigint,bigint,bigint,bigint)','execute') as app_claim,
      has_function_privilege('goproceed_service',
        'app.claim_telegram_evidence_decision_token(text,bigint,bigint,bigint,bigint)','execute') as service_claim,
      (select count(*)::text from pg_trigger where tgrelid='public.telegram_evidence_decision_tokens'::regclass
        and not tgisinternal and tgname in ('telegram_evidence_decision_token_guard','telegram_evidence_decision_token_guard_v2')) as guard_count,
      exists(select 1 from information_schema.columns where table_schema='public'
        and table_name='telegram_evidence_decision_tokens' and column_name='return_reply_message_id') as return_reply_column,
      (select count(*)::text from information_schema.columns where table_schema='public'
        and table_name='telegram_evidence_decision_tokens'
        and column_name in ('review_source_kind','review_source_id','review_source_generation')) as review_context_columns,
      to_regprocedure('app.claim_telegram_evidence_decision_token(text,bigint,bigint,bigint)') is null as old_claim_absent,
      to_regprocedure('app.issue_telegram_evidence_decision_tokens(uuid,uuid,uuid,uuid,uuid,text,text)') is null as old_issue_absent,
      to_regprocedure('app.finalize_telegram_evidence_decision_token(uuid,uuid,uuid)') is null as old_finalize_absent,
      to_regprocedure('app.reserve_telegram_evidence_return_reply(uuid,uuid,bigint,uuid,bigint)') is null as old_reserve_absent,
      has_function_privilege('goproceed_service',
        'app.retry_telegram_decision_inbox(bigint,bigint,uuid,text)','execute') as retry_service,
      position('status=''active''' in pg_get_functiondef(
        'app.guard_telegram_evidence_decision_token_v2()'::regprocedure))=0 as guard_allows_revocation_receipt,
      pg_get_functiondef('app.resolve_telegram_evidence_return_reply(uuid,uuid,bigint,uuid,bigint)'::regprocedure)
        !~* 'update[[:space:]]+public[.]telegram_evidence_decision_tokens' as resolver_is_validate_only,
      to_regprocedure('app.finalize_telegram_evidence_decision_token(uuid,uuid,uuid,uuid)') is null
        as old_finalize_v2_absent,
      has_function_privilege('goproceed_service',
        to_regprocedure('app.finalize_telegram_evidence_decision_token(uuid,uuid,uuid,uuid)'),
        'execute') is not true as old_finalize_v2_no_execute,
      has_table_privilege('goproceed_service','public.telegram_evidence_decision_attempts','select') as attempt_table_read,
      exists(select 1 from pg_trigger where tgrelid='public.telegram_evidence_decision_attempts'::regclass
        and not tgisinternal and tgname='telegram_evidence_decision_attempts_guard') as attempt_guard,
      has_function_privilege('goproceed_service',
        'app.list_due_telegram_evidence_decision_controls(integer)','execute') as control_recovery_service,
      has_function_privilege('goproceed_service',
        'app.start_telegram_evidence_decision_attempt(uuid,uuid,uuid,bigint,text)','execute') as attempt_start_service,
      has_function_privilege('goproceed_app',
        'app.start_telegram_evidence_decision_attempt(uuid,uuid,uuid,bigint,text)','execute') as attempt_start_app,
      has_function_privilege('goproceed_service',
        'app.claim_telegram_evidence_decision_attempts(integer,text,integer)','execute') as attempt_claim_service`);
    expect(privileges).toEqual({
      service_table_read: false, app_claim: false, service_claim: true,
      guard_count: "2", return_reply_column: true, review_context_columns: "3",
      old_claim_absent: true, old_issue_absent: true, old_finalize_absent: true,
      old_reserve_absent: true, retry_service: true, guard_allows_revocation_receipt: true,
      resolver_is_validate_only: true, old_finalize_v2_absent: true, old_finalize_v2_no_execute: true,
      attempt_table_read: false, attempt_guard: true, control_recovery_service: true,
      attempt_start_service: true, attempt_start_app: false, attempt_claim_service: true,
    });

    await expect(withServiceTx({ actorUserId: "", organizationId: workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
      await tx.query("select id from public.telegram_evidence_decision_tokens limit 1");
    })).rejects.toThrow(/permission denied/i);
    await expect(withServiceTx({ actorUserId: "", organizationId: workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
      await tx.query("select id from public.telegram_evidence_decision_attempts limit 1");
    })).rejects.toThrow(/permission denied/i);

    await expect(withServiceTx({ actorUserId: "", organizationId: workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
      const result = await tx.query(`select * from app.prepare_telegram_evidence_decision_issue(
        $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::uuid,$7::bigint)`,
      [workspaceId, projectId, bindingId, crypto.randomUUID(), "attachment", crypto.randomUUID(), 0]);
      expect(result.rows).toEqual([]);
      const unlinked = await tx.query(`select * from app.claim_telegram_evidence_decision_token(
        $1::text,$2::bigint,$3::bigint,$4::bigint,$5::bigint)`,
      ["f".repeat(64), botId, -100777, 777777, 888888]);
      expect(unlinked.rows).toEqual([]);
      const wrongReply = await tx.query(`select * from app.resolve_telegram_evidence_return_reply(
        $1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::bigint)`,
      [workspaceId, bindingId, 777777, crypto.randomUUID(), 888888]);
      expect(wrongReply.rows).toEqual([]);
    })).resolves.toBeUndefined();

    await expect(withTenantTx({ actorUserId, organizationId: workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
      await tx.query(`select * from app.claim_telegram_evidence_decision_token(
        $1::text,$2::bigint,$3::bigint,$4::bigint,$5::bigint)`,
      ["f".repeat(64), botId, -100777, 777777, 888888]);
    })).rejects.toThrow(/permission denied/i);
  });

  it("lease-fences and bounds transient decision inbox retries without dropping payload early", async () => {
    const payload = { update_id: Number(updateId), callback_query: { id: "retry", from: { id: 77 }, data: "dec:x" } };
    await q(`insert into public.telegram_inbox_updates(bot_id,update_id,payload,payload_hash,state)
      values($1,$2,$3::jsonb,repeat('9',64),'pending')`, [botId, updateId, JSON.stringify(payload)]);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await q("update public.telegram_inbox_updates set available_at=now() where bot_id=$1 and update_id=$2", [botId, updateId]);
      const [lease] = await withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) =>
        (await tx.query<{ lease_id: string }>("select lease_id from app.claim_telegram_inbox(1,'decision-retry-test',60)")).rows);
      const outcome = await withServiceTx({ actorUserId: "", organizationId: null, requestId: crypto.randomUUID() }, async (tx) =>
        (await tx.query<{ outcome: string }>("select app.retry_telegram_decision_inbox($1::bigint,$2::bigint,$3::uuid,$4::text) as outcome",
          [botId, updateId, lease!.lease_id, "telegram_decision_transient"])).rows[0]!.outcome);
      expect(outcome).toBe(attempt < 3 ? "retry_scheduled" : "failed");
      const [row] = await q<{ state: string; payload: unknown; attempts: number }>(
        "select state,payload,attempts from public.telegram_inbox_updates where bot_id=$1 and update_id=$2", [botId, updateId]);
      expect(row?.attempts).toBe(attempt);
      expect(row?.state).toBe(attempt < 3 ? "pending" : "failed");
      expect(row?.payload === null).toBe(attempt === 3);
    }
  });

  it("reconciles legacy committed decisions before admitting a new durable attempt", async () => {
    const acceptedOccurrenceId = crypto.randomUUID();
    const returnedOccurrenceId = crypto.randomUUID();
    const acceptedTokenId = crypto.randomUUID();
    const returnedTokenId = crypto.randomUUID();
    const acceptedDecisionId = crypto.randomUUID();
    const returnedDecisionId = crypto.randomUUID();
    const acceptedControlId = crypto.randomUUID();
    const returnedControlId = crypto.randomUUID();
    const returnPromptId = crypto.randomUUID();
    const assignmentId = crypto.randomUUID();
    const adminClient = new Client({ connectionString: admin });
    await adminClient.connect();
    try {
      await adminClient.query("set session_replication_role=replica");
      await adminClient.query(`insert into public.communication_messages
        (id,workspace_id,project_id,telegram_chat_binding_id,direction,kind,text,
         provider_message_id,server_received_at,work_assignment_id,telegram_reply_markup,
         delivery_state,created_at)
        values($1,$4,$5,$6,'outbound','text','accepted controls',9920,now(),$7,
                 '{"inline_keyboard":[]}'::jsonb,'provider_accepted',now()),
              ($2,$4,$5,$6,'outbound','text','returned controls',9921,now(),$7,
                 '{"inline_keyboard":[]}'::jsonb,'provider_accepted',now()),
              ($3,$4,$5,$6,'outbound','text','return prompt',9922,now(),$7,
                 null,'provider_accepted',now())`,
      [acceptedControlId, returnedControlId, returnPromptId, workspaceId, projectId, bindingId, assignmentId]);
      await adminClient.query(`insert into public.telegram_evidence_decision_tokens
        (id,workspace_id,project_id,telegram_chat_binding_id,requirement_occurrence_id,
         actor_user_id,actor_member_id,action,token_hash,expires_at,decision_message_id,
         return_prompt_message_id,review_source_kind,review_source_id,review_source_generation)
        values($1,$3,$4,$5,$6,$7,$8,'accepted',$9,now()+interval '1 hour',$11,null,
                 'attachment',$12,0),
              ($2,$3,$4,$5,$13,$7,$8,'returned',$10,now()+interval '1 hour',$14,$15,
                 'attachment',$16,0)`,
      [acceptedTokenId, returnedTokenId, workspaceId, projectId, bindingId, acceptedOccurrenceId,
        actorUserId, memberId, "1".repeat(64), "2".repeat(64), acceptedControlId,
        crypto.randomUUID(), returnedOccurrenceId, returnedControlId, returnPromptId, crypto.randomUUID()]);
      await adminClient.query(`insert into public.requirement_evidence_decisions
        (id,workspace_id,project_id,requirement_occurrence_id,approver_role,outcome,
         decision_no,decided_by_member_id,reason,issues,idempotency_key,request_hash)
        values($1,$3,$4,$5,'technical_supervision','accepted',1,$7,null,'[]'::jsonb,
                 'telegram-decision:'||$8::text,repeat('3',64)),
              ($2,$3,$4,$6,'technical_supervision','returned',1,$7,'Needs correction','[]'::jsonb,
                 'telegram-decision:'||$9::text,repeat('4',64))`,
      [acceptedDecisionId, returnedDecisionId, workspaceId, projectId, acceptedOccurrenceId,
        returnedOccurrenceId, memberId, acceptedTokenId, returnedTokenId]);
    } finally {
      await adminClient.query("set session_replication_role=origin").catch(() => undefined);
      await adminClient.end();
    }

    const start = async (tokenId: string, hash: string) => withServiceTx({
      actorUserId: "", organizationId: workspaceId, requestId: crypto.randomUUID(),
    }, async (tx) => (await tx.query(`select * from app.start_telegram_evidence_decision_attempt(
      $1::uuid,$2::uuid,null,null,$3::text)`, [tokenId, memberId, hash])).rows);
    await expect(start(acceptedTokenId, "5".repeat(64))).resolves.toEqual([]);
    await expect(start(returnedTokenId, "6".repeat(64))).resolves.toEqual([]);

    const states = await q<{ id: string; consumed: boolean; invalidated: boolean; decision_id: string | null }>(`select
      id,consumed_at is not null as consumed,invalidated_at is not null as invalidated,decision_id
      from public.telegram_evidence_decision_tokens where id=any($1::uuid[]) order by id`,
    [[acceptedTokenId, returnedTokenId]]);
    expect(states.find((row) => row.id === acceptedTokenId)).toMatchObject({
      consumed: true, invalidated: false, decision_id: acceptedDecisionId,
    });
    expect(states.find((row) => row.id === returnedTokenId)).toMatchObject({
      consumed: false, invalidated: true, decision_id: null,
    });
    const [attempts] = await q<{ count: string }>(`select count(*)::text as count
      from public.telegram_evidence_decision_attempts where token_id=any($1::uuid[])`,
    [[acceptedTokenId, returnedTokenId]]);
    expect(attempts).toEqual({ count: "0" });
  });

  it("serializes opposite sibling callbacks without deadlock and lets exactly one action win", async () => {
    const occurrenceId = crypto.randomUUID();
    const assignmentId = crypto.randomUUID();
    const controlMessageId = crypto.randomUUID();
    const acceptedTokenId = crypto.randomUUID();
    const returnedTokenId = crypto.randomUUID();
    const adminClient = new Client({ connectionString: admin });
    await adminClient.connect();
    try {
      await adminClient.query("set session_replication_role=replica");
      await adminClient.query("update public.projects set status='active' where workspace_id=$1 and id=$2", [workspaceId, projectId]);
      await adminClient.query(`update public.project_field_channels
        set state='active',locked_at=now(),locked_by_member_id=$3
        where workspace_id=$1 and project_id=$2`, [workspaceId, projectId, memberId]);
      await adminClient.query(`insert into public.project_access_grants
        (workspace_id,project_id,member_id,capability,granted_by)
        values($1,$2,$3,'project.view',$4),($1,$2,$3,'evidence_decisions.decide',$4)
        on conflict do nothing`, [workspaceId, projectId, memberId, actorUserId]);
      await adminClient.query(`insert into public.telegram_member_links
        (id,workspace_id,member_id,telegram_user_id,verified_at,linked_by_member_id)
        values(gen_random_uuid(),$1,$2,77,now(),$2)`, [workspaceId, memberId]);
      await adminClient.query(`insert into public.requirement_occurrences
        (id,workspace_id,project_id,contract_id,work_assignment_id,rule_version_id,
         intervention_type,blocking_scope,timing,evidence_kind,acceptance_criterion,
         performer_role,approver_role,min_evidence_count,quantity_scope,created_by_member_id)
        values($1,$2,$3,gen_random_uuid(),$4,gen_random_uuid(),'review','none','after',
          'photo','synthetic callback race','performer','technical_supervision',1,'{}'::jsonb,$5)`,
      [occurrenceId, workspaceId, projectId, assignmentId, memberId]);
      await adminClient.query(`insert into public.communication_messages
        (id,workspace_id,project_id,telegram_chat_binding_id,direction,kind,text,
         provider_message_id,server_received_at,work_assignment_id,telegram_reply_markup,
         delivery_state,created_at)
        values($1,$2,$3,$4,'outbound','text','decision controls',9912,now(),$5,
          '{"inline_keyboard":[]}'::jsonb,'provider_accepted',now())`,
      [controlMessageId, workspaceId, projectId, bindingId, assignmentId]);
      await adminClient.query(`insert into public.telegram_evidence_decision_tokens
        (id,workspace_id,project_id,telegram_chat_binding_id,requirement_occurrence_id,
         action,token_hash,expires_at,decision_message_id,review_source_kind,
         review_source_id,review_source_generation)
        values($1,$3,$4,$5,$6,'accepted',$7,now()+interval '1 hour',$9,'attachment',$10,0),
              ($2,$3,$4,$5,$6,'returned',$8,now()+interval '1 hour',$9,'attachment',$10,0)`,
      [acceptedTokenId, returnedTokenId, workspaceId, projectId, bindingId, occurrenceId,
        "a".repeat(64), "b".repeat(64), controlMessageId, crypto.randomUUID()]);
    } finally {
      await adminClient.query("set session_replication_role=origin").catch(() => undefined);
      await adminClient.end();
    }

    const call = async (hash: string) => {
      const client = new Client({ connectionString: process.env.SERVICE_DB_URL!.trim() });
      await client.connect();
      try {
        await client.query("set statement_timeout='5s'");
        return (await client.query(`select id,action from app.claim_telegram_evidence_decision_token(
          $1::text,$2::bigint,$3::bigint,$4::bigint,$5::bigint)`,
        [hash, botId, -100777, 77, 9912])).rows;
      } finally {
        await client.end();
      }
    };
    const [accepted, returned] = await Promise.all([call("a".repeat(64)), call("b".repeat(64))]);
    expect(accepted.length + returned.length).toBe(1);
    const [states] = await q<{ claimed: string; invalidated: string }>(`select
      count(*) filter(where actor_member_id=$2)::text as claimed,
      count(*) filter(where invalidated_at is not null)::text as invalidated
      from public.telegram_evidence_decision_tokens where workspace_id=$1 and decision_message_id=$3`,
    [workspaceId, memberId, controlMessageId]);
    expect(states).toEqual({ claimed: "2", invalidated: "1" });

    const durableTokenId = crypto.randomUUID();
    const expiredTokenId = crypto.randomUUID();
    await q(`insert into public.telegram_evidence_decision_tokens
      (id,workspace_id,project_id,telegram_chat_binding_id,requirement_occurrence_id,
       actor_user_id,actor_member_id,action,token_hash,expires_at,decision_message_id,
       review_source_kind,review_source_id,review_source_generation)
      values($1,$3,$4,$5,$6,$7,$8,'accepted',$9,clock_timestamp()+interval '300 milliseconds',$11,
        'attachment',$12,0),
            ($2,$3,$4,$5,$6,$7,$8,'accepted',$10,clock_timestamp()+interval '300 milliseconds',$11,
        'attachment',$13,0)`,
    [durableTokenId, expiredTokenId, workspaceId, projectId, bindingId, occurrenceId,
      actorUserId, memberId, "c".repeat(64), "d".repeat(64), controlMessageId,
      crypto.randomUUID(), crypto.randomUUID()]);
    const startSql = `select * from app.start_telegram_evidence_decision_attempt(
      $1::uuid,$2::uuid,null,null,$3::text)`;
    const [started] = await withServiceTx({ actorUserId: "", organizationId: workspaceId,
      requestId: crypto.randomUUID() }, async (tx) => (await tx.query(startSql,
      [durableTokenId, memberId, "e".repeat(64)])).rows);
    expect(started).toMatchObject({ token_id: durableTokenId, status: "pending" });
    await q("select pg_sleep(0.4)");
    const replayed = await withServiceTx({ actorUserId: "", organizationId: workspaceId,
      requestId: crypto.randomUUID() }, async (tx) => (await tx.query(startSql,
      [durableTokenId, memberId, "e".repeat(64)])).rows);
    const refused = await withServiceTx({ actorUserId: "", organizationId: workspaceId,
      requestId: crypto.randomUUID() }, async (tx) => (await tx.query(startSql,
      [expiredTokenId, memberId, "f".repeat(64)])).rows);
    expect(replayed).toHaveLength(1);
    expect(refused).toEqual([]);
    const recovered = await withServiceTx({ actorUserId: "", organizationId: workspaceId,
      requestId: crypto.randomUUID() }, async (tx) => (await tx.query(
      "select token_id from app.claim_telegram_evidence_decision_attempts(10,'expiry-recovery',60)" )).rows);
    expect(recovered).toEqual([{ token_id: durableTokenId }]);
  });

  it("keeps a callback payload retryable when Telegram runtime construction fails", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "invalid");
    const payload = {
      update_id: Number(updateId),
      callback_query: {
        id: "runtime-failure", from: { id: 77 }, data: `dec:${"x".repeat(32)}`,
        message: { message_id: 812, chat: { id: -100777, type: "supergroup" } },
      },
    };
    await q(`insert into public.telegram_inbox_updates(bot_id,update_id,payload,payload_hash,state)
      values($1,$2,$3::jsonb,repeat('8',64),'pending')`, [botId, updateId, JSON.stringify(payload)]);
    const { processTelegramInboxBatch } = await import("../src/lib/telegram/processor");
    await expect(processTelegramInboxBatch({ workerId: "decision-runtime-retry", limit: 1 }))
      .resolves.toEqual({ claimed: 1, processed: 0, failed: 1 });
    const [row] = await q<{ state: string; payload: unknown; attempts: number; last_error_code: string }>(
      `select state,payload,attempts,last_error_code from public.telegram_inbox_updates
       where bot_id=$1 and update_id=$2`, [botId, updateId]);
    expect(row).toMatchObject({ state: "pending", attempts: 1, last_error_code: "telegram_decision_transient" });
    expect(row?.payload).toEqual(payload);
  });

  it("deduplicates one review source forever while admitting a new evidence cycle", async () => {
    const client = new Client({ connectionString: admin });
    const occurrenceId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const firstSource = crypto.randomUUID();
    const secondSource = crypto.randomUUID();
    await client.connect();
    try {
      // FK/guard bypass is scoped to synthetic child rows in this generated
      // workspace; unique indexes and CHECK constraints remain enforced.
      await client.query("set session_replication_role=replica");
      const insert = `insert into public.telegram_evidence_decision_tokens(
        workspace_id,project_id,telegram_chat_binding_id,requirement_occurrence_id,
        review_source_kind,review_source_id,review_source_generation,action,token_hash,
        expires_at,decision_message_id)
        values($1,$2,$3,$4,'attachment',$5,0,'accepted',$6,now()+interval '1 hour',$7)`;
      await client.query(insert, [workspaceId, projectId, bindingId, occurrenceId, firstSource, "a".repeat(64), messageId]);
      await expect(client.query(insert,
        [workspaceId, projectId, bindingId, occurrenceId, firstSource, "b".repeat(64), messageId]))
        .rejects.toThrow(/telegram_evidence_decision_review_action_uniq/i);
      await expect(client.query(insert,
        [workspaceId, projectId, bindingId, occurrenceId, secondSource, "c".repeat(64), messageId]))
        .resolves.toBeDefined();
      const count = await client.query<{ count: string }>(`select count(*)::text as count
        from public.telegram_evidence_decision_tokens where workspace_id=$1 and requirement_occurrence_id=$2`,
      [workspaceId, occurrenceId]);
      expect(count.rows[0]?.count).toBe("2");
    } finally {
      await client.query("set session_replication_role=origin").catch(() => undefined);
      await client.end();
    }
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
