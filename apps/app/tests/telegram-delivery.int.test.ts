import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { dropWorkspaces } from "../../../packages/testing/src/pg";
import { seedAssignment, seedM2World, grantM2Capabilities, type M2Fixture } from "../../../packages/testing/src/m2-fixture";
import { TelegramApiError, type TelegramApiClient } from "../src/lib/telegram/api";
import { deliverTelegramOutboxBatch } from "../src/lib/telegram/delivery";

const databaseDescribe = process.env.APP_DB_URL && process.env.SERVICE_DB_URL && process.env.TEST_DB_ADMIN_URL
  ? describe
  : describe.skip;
let actorUserId = "";

vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: actorUserId }) }));

async function admin(): Promise<Client> {
  const client = new Client({ connectionString: process.env.TEST_DB_ADMIN_URL });
  await client.connect();
  return client;
}

const jsonRequest = (assignmentId: string, key: string) => new Request(
  `http://x/v1/assignments/${assignmentId}/communication-card`,
  { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: "{}" },
);

databaseDescribe("Telegram assignment-card publication", () => {
  let client: Client;
  let fixture: M2Fixture;
  let assignmentId = "";

  beforeEach(async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t".repeat(32));
    vi.stubEnv("TELEGRAM_BOT_ID", "123456789");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "GoProceedTestBot");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "w".repeat(32));
    vi.stubEnv("TELEGRAM_WORKER_SECRET", "r".repeat(32));
    vi.stubEnv("TELEGRAM_LINK_PEPPER", "p".repeat(32));
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://app.goproceed.test");
    actorUserId = crypto.randomUUID();
    client = await admin();
    fixture = await seedM2World(client, {
      workspaceId: crypto.randomUUID(), userId: actorUserId, email: "unused@example.test", suffix: "TG-CARD",
    });
    await grantM2Capabilities(client, fixture);
    assignmentId = await seedAssignment(client, fixture);
    await client.query(`insert into public.project_field_channels
      (workspace_id, project_id, channel, state, locked_at, locked_by_member_id, last_healthy_at)
      values ($1, $2, 'telegram', 'active', now(), $3, now())`,
    [fixture.workspaceId, fixture.projectId, fixture.memberId]);
    await client.query(`insert into public.telegram_chat_bindings
      (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
      values ($1, $2, 123456789, -100123, 'supergroup', $3)`,
    [fixture.workspaceId, fixture.projectId, fixture.memberId]);
  });

  afterEach(async () => {
    if (fixture?.workspaceId) await dropWorkspaces(client, [fixture.workspaceId]);
    await client.end();
    vi.unstubAllEnvs();
  });

  it("publishes one queued card and outbox intent under an idempotent replay", async () => {
    // Break caught: a replay can otherwise create a second card for the same
    // assignment and leave Telegram participants with two reply anchors.
    const { POST } = await import("../app/v1/assignments/[assignmentId]/communication-card/route");
    const key = crypto.randomUUID();
    const first = await POST(jsonRequest(assignmentId, key), { params: Promise.resolve({ assignmentId }) });
    const replay = await POST(jsonRequest(assignmentId, key), { params: Promise.resolve({ assignmentId }) });

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect((await first.json()).messageId).toBe((await replay.json()).messageId);
    const result = await client.query<{ cards: string; outbox: string }>(`select
      count(*) filter (where kind='assignment_card' and delivery_state='queued')::text as cards,
      (select count(*)::text from public.transaction_outbox
        where organization_id=$1 and topic='communication.telegram.send') as outbox
      from public.communication_messages where workspace_id=$1`, [fixture.workspaceId]);
    expect(result.rows[0]).toEqual({ cards: "1", outbox: "1" });
  });

  it("requires assignments.manage in addition to project.view", async () => {
    // Break caught: project visibility alone could publish field instructions.
    await client.query(`update public.project_access_grants set revoked_at=now()
      where workspace_id=$1 and project_id=$2 and member_id=$3 and capability='assignments.manage'`,
    [fixture.workspaceId, fixture.projectId, fixture.memberId]);
    const { POST } = await import("../app/v1/assignments/[assignmentId]/communication-card/route");
    const response = await POST(jsonRequest(assignmentId, crypto.randomUUID()), { params: Promise.resolve({ assignmentId }) });

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("anchors an accepted card and settles an unknown send without retrying it", async () => {
    // Break caught: provider acceptance must be the reply anchor, while an
    // uncertain send must leave no claimable row that can duplicate the card.
    const { POST } = await import("../app/v1/assignments/[assignmentId]/communication-card/route");
    const first = await POST(jsonRequest(assignmentId, crypto.randomUUID()), { params: Promise.resolve({ assignmentId }) });
    const firstMessageId = (await first.json()).messageId as string;
    const acceptedApi: TelegramApiClient = {
      sendMessage: async () => ({ messageId: "881" }),
      answerCallbackQuery: async () => undefined,
      setWebhook: async () => undefined,
      getFile: async () => ({ fileId: "file", fileUniqueId: null, fileSize: null }),
      downloadFile: async () => new Uint8Array(),
    };
    await expect(deliverTelegramOutboxBatch({ workerId: "delivery-test", limit: 10, apiClient: acceptedApi }))
      .resolves.toEqual({ accepted: 1, failed: 0, unknown: 0 });
    const accepted = await client.query<{ delivery_state: string; provider_message_id: string; processed: boolean }>(`select
      m.delivery_state, m.provider_message_id::text,
      (select processed_at is not null from public.transaction_outbox where aggregate_id=m.id::text) as processed
      from public.communication_messages m where m.id=$1`, [firstMessageId]);
    expect(accepted.rows[0]).toEqual({ delivery_state: "provider_accepted", provider_message_id: "881", processed: true });

    const second = await POST(jsonRequest(assignmentId, crypto.randomUUID()), { params: Promise.resolve({ assignmentId }) });
    const secondMessageId = (await second.json()).messageId as string;
    let sends = 0;
    const uncertainApi: TelegramApiClient = {
      sendMessage: async () => {
        sends += 1;
        throw new TelegramApiError("delivery_unknown", "network_outcome_unknown", null, false, "unknown");
      },
      answerCallbackQuery: async () => undefined,
      setWebhook: async () => undefined,
      getFile: async () => ({ fileId: "file", fileUniqueId: null, fileSize: null }),
      downloadFile: async () => new Uint8Array(),
    };
    await expect(deliverTelegramOutboxBatch({ workerId: "delivery-test", limit: 10, apiClient: uncertainApi }))
      .resolves.toEqual({ accepted: 0, failed: 0, unknown: 1 });
    await expect(deliverTelegramOutboxBatch({ workerId: "delivery-test", limit: 10, apiClient: uncertainApi }))
      .resolves.toEqual({ accepted: 0, failed: 0, unknown: 0 });
    expect(sends).toBe(1);
    const unknown = await client.query<{ delivery_state: string; processed: boolean }>(`select
      m.delivery_state, (select processed_at is not null from public.transaction_outbox where aggregate_id=m.id::text) as processed
      from public.communication_messages m where m.id=$1`, [secondMessageId]);
    expect(unknown.rows[0]).toEqual({ delivery_state: "delivery_unknown", processed: true });
  });

  it("fails a queued card without sending when its locked binding becomes unhealthy", async () => {
    // Break caught: completing an outbox item with no message transition hides
    // that a card was never sent after the field channel lost health.
    const { POST } = await import("../app/v1/assignments/[assignmentId]/communication-card/route");
    const queued = await POST(jsonRequest(assignmentId, crypto.randomUUID()), { params: Promise.resolve({ assignmentId }) });
    const messageId = (await queued.json()).messageId as string;
    await client.query(`update public.project_field_channels set state='unhealthy'
      where workspace_id=$1 and project_id=$2`, [fixture.workspaceId, fixture.projectId]);
    let sends = 0;
    const api: TelegramApiClient = {
      sendMessage: async () => { sends += 1; return { messageId: "never" }; },
      answerCallbackQuery: async () => undefined,
      setWebhook: async () => undefined,
      getFile: async () => ({ fileId: "file", fileUniqueId: null, fileSize: null }),
      downloadFile: async () => new Uint8Array(),
    };

    await expect(deliverTelegramOutboxBatch({ workerId: "delivery-test", limit: 10, apiClient: api }))
      .resolves.toEqual({ accepted: 0, failed: 1, unknown: 0 });
    expect(sends).toBe(0);
    const state = await client.query<{ delivery_state: string; processed: boolean }>(`select m.delivery_state,
      (select processed_at is not null from public.transaction_outbox where aggregate_id=m.id::text) as processed
      from public.communication_messages m where m.id=$1`, [messageId]);
    expect(state.rows[0]).toEqual({ delivery_state: "failed", processed: true });
  });
});
