import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { dropWorkspaces } from "../../../packages/testing/src/pg";
import {
  grantM2Capabilities, seedM2World, type M2Fixture,
} from "../../../packages/testing/src/m2-fixture";

const hasDatabaseCredentials = ["APP_DB_URL", "SERVICE_DB_URL", "TEST_DB_ADMIN_URL"]
  .every((name) => Boolean(process.env[name]?.trim()));
const databaseDescribe = hasDatabaseCredentials ? describe : describe.skip;

let actorUserId = "";
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: actorUserId }) }));

function jsonRequest(url: string, method: "GET" | "POST", body?: unknown, key?: string): Request {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (key) headers["idempotency-key"] = key;
  return new Request(url, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function admin(): Promise<Client> {
  const client = new Client({ connectionString: process.env.TEST_DB_ADMIN_URL });
  await client.connect();
  return client;
}

async function connectTelegram(client: Client, fixture: M2Fixture, botId = "123456789"): Promise<string> {
  await client.query("update public.projects set status='active' where workspace_id=$1 and id=$2", [
    fixture.workspaceId, fixture.projectId,
  ]);
  await client.query(`insert into public.project_field_channels
    (workspace_id, project_id, channel, state, locked_at, locked_by_member_id, last_healthy_at)
    values ($1,$2,'telegram','active',now(),$3,now())`, [
    fixture.workspaceId, fixture.projectId, fixture.memberId,
  ]);
  const binding = await client.query<{ id: string }>(`insert into public.telegram_chat_bindings
    (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
    values ($1,$2,$3::bigint,$4::bigint,'supergroup',$5) returning id`, [
    fixture.workspaceId, fixture.projectId, botId,
    `-${Math.floor(Math.random() * 8_000_000_000 + 1_000_000_000)}`, fixture.memberId,
  ]);
  return binding.rows[0]!.id;
}

async function seedTimeline(client: Client, fixture: M2Fixture, bindingId: string): Promise<string[]> {
  const ids = [
    "10000000-0000-4000-8000-000000000001",
    "10000000-0000-4000-8000-000000000002",
    "10000000-0000-4000-8000-000000000003",
  ];
  for (let index = 0; index < ids.length; index += 1) {
    await client.query(`insert into public.communication_messages
      (id,workspace_id,project_id,telegram_chat_binding_id,direction,kind,text,author_member_id,
       provider_user_id,provider_display_name_snapshot,provider_message_id,provider_sent_at,
       server_received_at,delivery_state)
      values ($1,$2,$3,$4,'inbound',$5,$6,$7,9001,'Приклад-Іван',$8,
              '2026-08-28T09:59:00.000Z','2026-08-28T10:00:00.000Z','received')`, [
      ids[index], fixture.workspaceId, fixture.projectId, bindingId,
      index === 1 ? "photo" : "text", `Повідомлення ${index + 1}`, fixture.memberId, 700 + index,
    ]);
  }
  await client.query(`insert into public.communication_message_events
    (workspace_id,project_id,message_id,event_kind,text,provider_update_id,server_received_at)
    values ($1,$2,$3,'edited','Уточнене повідомлення',991,'2026-08-28T10:01:00.000Z')`, [
    fixture.workspaceId, fixture.projectId, ids[2],
  ]);
  await client.query(`insert into public.communication_attachments
    (workspace_id,project_id,message_id,provider_file_id,provider_file_unique_id,
     filename_snapshot,media_type_snapshot,byte_size,state)
    values ($1,$2,$3,'provider-secret-file','provider-secret-unique','photo.jpg','image/jpeg',123,'staged')`, [
    fixture.workspaceId, fixture.projectId, ids[1],
  ]);
  return ids;
}

describe("project communication member API surface", () => {
  it("exports timeline, reply, and retry handlers", async () => {
    // Break caught: a catalog-only API cannot be used by the project web app.
    const communications = await import("../app/v1/projects/[projectId]/communications/route");
    const retry = await import("../app/v1/projects/[projectId]/communications/[messageId]/retry/route");
    expect(communications.GET).toBeTypeOf("function");
    expect(communications.POST).toBeTypeOf("function");
    expect(retry.POST).toBeTypeOf("function");
  });

  it("rejects malformed cursors and out-of-range limits before querying a project", async () => {
    // Break caught: permissive cursor decoding can turn caller input into an unbounded or unstable query.
    const { GET } = await import("../app/v1/projects/[projectId]/communications/route");
    const projectId = crypto.randomUUID();
    for (const query of ["cursor=not-base64!", "limit=0", "limit=101", "limit=2.5"]) {
      const response = await GET(jsonRequest(
        `http://x/v1/projects/${projectId}/communications?${query}`, "GET",
      ), { params: Promise.resolve({ projectId }) });
      expect(response.status).toBe(422);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
  });
});

databaseDescribe("project communication member API", () => {
  let client: Client;
  let primary: M2Fixture;
  let foreign: M2Fixture;
  let bindingId = "";
  let foreignBindingId = "";
  let timelineIds: string[] = [];

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
    primary = await seedM2World(client, {
      workspaceId: crypto.randomUUID(), userId: actorUserId,
      email: "unused@example.test", suffix: "TG-COMM-PRIMARY",
    });
    await grantM2Capabilities(client, primary, ["project.view", "communication.reply"]);
    bindingId = await connectTelegram(client, primary);
    timelineIds = await seedTimeline(client, primary, bindingId);

    foreign = await seedM2World(client, {
      workspaceId: crypto.randomUUID(), userId: actorUserId,
      email: "unused@example.test", suffix: "TG-COMM-FOREIGN",
    });
    await grantM2Capabilities(client, foreign, ["project.view", "communication.reply"]);
    foreignBindingId = await connectTelegram(client, foreign);
  });

  afterEach(async () => {
    if (client) {
      const ids = [primary?.workspaceId, foreign?.workspaceId].filter((id): id is string => Boolean(id));
      if (ids.length > 0) await dropWorkspaces(client, ids);
      await client.end();
    }
    vi.unstubAllEnvs();
  });

  it("returns stable newest-first cursor pages with edits and no provider file handles", async () => {
    // Break caught: timestamp-only pagination skips or duplicates tied Telegram messages.
    const { GET } = await import("../app/v1/projects/[projectId]/communications/route");
    const first = await GET(jsonRequest(
      `http://x/v1/projects/${primary.projectId}/communications?limit=2`, "GET",
    ), { params: Promise.resolve({ projectId: primary.projectId }) });
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.messages.map((message: { messageId: string }) => message.messageId))
      .toEqual([timelineIds[2], timelineIds[1]]);
    expect(firstBody.nextCursor).toEqual(expect.any(String));
    expect(firstBody.messages[0].events).toMatchObject([{ kind: "edited", text: "Уточнене повідомлення" }]);
    expect(firstBody.messages[1].attachments).toMatchObject([{ state: "staged", mediaType: "image/jpeg" }]);
    expect(JSON.stringify(firstBody)).not.toMatch(/provider_file|providerUser|chatId|botToken|verifier/i);

    const second = await GET(jsonRequest(
      `http://x/v1/projects/${primary.projectId}/communications?limit=2&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
      "GET",
    ), { params: Promise.resolve({ projectId: primary.projectId }) });
    expect(second.status).toBe(200);
    expect((await second.json()).messages.map((message: { messageId: string }) => message.messageId))
      .toEqual([timelineIds[0]]);
  });

  it("queues one Telegram-fixed web reply and replays it idempotently", async () => {
    // Break caught: retrying an HTTP request must not create two Telegram sends or expose a recipient picker.
    const { POST } = await import("../app/v1/projects/[projectId]/communications/route");
    const key = crypto.randomUUID();
    const request = () => jsonRequest(`http://x/v1/projects/${primary.projectId}/communications`, "POST", {
      text: "Потрібен загальний план", replyToMessageId: timelineIds[0],
    }, key);
    const first = await POST(request(), { params: Promise.resolve({ projectId: primary.projectId }) });
    const replay = await POST(request(), { params: Promise.resolve({ projectId: primary.projectId }) });
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    const firstBody = await first.json();
    const replayBody = await replay.json();
    expect(firstBody).toMatchObject({
      channel: "telegram", deliveryState: "queued", replyToMessageId: timelineIds[0], retryOfMessageId: null,
    });
    expect(firstBody).not.toHaveProperty("recipient");
    expect(replayBody.messageId).toBe(firstBody.messageId);

    const rows = await client.query<{ messages: string; outbox: string; author_member_id: string }>(`select
      count(*)::text as messages,
      (select count(*)::text from public.transaction_outbox
        where organization_id=$1 and topic='communication.telegram.send' and aggregate_id=$3) as outbox,
      min(author_member_id::text) as author_member_id
      from public.communication_messages where workspace_id=$1 and id=$2`, [
      primary.workspaceId, firstBody.messageId, String(firstBody.messageId),
    ]);
    expect(rows.rows[0]).toEqual({ messages: "1", outbox: "1", author_member_id: primary.memberId });
  });

  it("refuses a reply target from another project without creating a message", async () => {
    // Break caught: a caller must not use a visible foreign-project message as a Telegram reply target.
    const foreignMessage = (await client.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id,project_id,telegram_chat_binding_id,direction,kind,text,provider_message_id,delivery_state)
      values ($1,$2,$3,'inbound','text','Інший проєкт',811,'received') returning id`, [
      foreign.workspaceId, foreign.projectId, foreignBindingId,
    ])).rows[0]!.id;
    const { POST } = await import("../app/v1/projects/[projectId]/communications/route");
    const response = await POST(jsonRequest(
      `http://x/v1/projects/${primary.projectId}/communications`, "POST",
      { text: "Не туди", replyToMessageId: foreignMessage }, crypto.randomUUID(),
    ), { params: Promise.resolve({ projectId: primary.projectId }) });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "VALIDATION_FAILED", fieldErrors: [{ path: "replyToMessageId" }],
    });
  });

  it("requires communication.reply and an active healthy Telegram binding", async () => {
    // Break caught: project visibility is not authority to speak into the field group.
    const { POST } = await import("../app/v1/projects/[projectId]/communications/route");
    await client.query(`update public.project_access_grants set revoked_at=now()
      where workspace_id=$1 and project_id=$2 and member_id=$3 and capability='communication.reply'`, [
      primary.workspaceId, primary.projectId, primary.memberId,
    ]);
    const denied = await POST(jsonRequest(
      `http://x/v1/projects/${primary.projectId}/communications`, "POST",
      { text: "Без права" }, crypto.randomUUID(),
    ), { params: Promise.resolve({ projectId: primary.projectId }) });
    expect(denied.status).toBe(403);

    await client.query(`update public.project_access_grants set revoked_at=null
      where workspace_id=$1 and project_id=$2 and member_id=$3 and capability='communication.reply'`, [
      primary.workspaceId, primary.projectId, primary.memberId,
    ]);
    await client.query(`update public.project_field_channels set state='unhealthy'
      where workspace_id=$1 and project_id=$2`, [primary.workspaceId, primary.projectId]);
    const unhealthy = await POST(jsonRequest(
      `http://x/v1/projects/${primary.projectId}/communications`, "POST",
      { text: "Канал зламаний" }, crypto.randomUUID(),
    ), { params: Promise.resolve({ projectId: primary.projectId }) });
    expect(unhealthy.status).toBe(409);
  });

  it("creates a new failed-message retry and audits the actor and prior state", async () => {
    // Break caught: retrying by mutating the old message reuses provider identity and loses recovery history.
    const failedId = (await client.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id,project_id,telegram_chat_binding_id,direction,kind,text,author_member_id,delivery_state)
      values ($1,$2,$3,'outbound','text','Повторіть замір',$4,'failed') returning id`, [
      primary.workspaceId, primary.projectId, bindingId, primary.memberId,
    ])).rows[0]!.id;
    const { POST } = await import("../app/v1/projects/[projectId]/communications/[messageId]/retry/route");
    const response = await POST(jsonRequest(
      `http://x/v1/projects/${primary.projectId}/communications/${failedId}/retry`, "POST", {}, crypto.randomUUID(),
    ), { params: Promise.resolve({ projectId: primary.projectId, messageId: failedId }) });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ channel: "telegram", deliveryState: "queued", retryOfMessageId: failedId });
    expect(body.messageId).not.toBe(failedId);
    const audit = await client.query<{ actor_user_id: string; details: Record<string, unknown> }>(`select
      actor_user_id::text,details from public.audit_events
      where organization_id=$1 and action='project_communication.retried' and object_id=$2`, [
      primary.workspaceId, body.messageId,
    ]);
    expect(audit.rows[0]).toMatchObject({
      actor_user_id: actorUserId, details: { projectId: primary.projectId, retryOfMessageId: failedId, priorState: "failed" },
    });
  });

  it("requires explicit duplicate acknowledgement before retrying delivery_unknown", async () => {
    // Break caught: an automatic-looking retry can duplicate a message Telegram already accepted before a timeout.
    const unknownId = (await client.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id,project_id,telegram_chat_binding_id,direction,kind,text,author_member_id,delivery_state)
      values ($1,$2,$3,'outbound','text','Можливо доставлено',$4,'delivery_unknown') returning id`, [
      primary.workspaceId, primary.projectId, bindingId, primary.memberId,
    ])).rows[0]!.id;
    const { POST } = await import("../app/v1/projects/[projectId]/communications/[messageId]/retry/route");
    const denied = await POST(jsonRequest(
      `http://x/v1/projects/${primary.projectId}/communications/${unknownId}/retry`, "POST", {}, crypto.randomUUID(),
    ), { params: Promise.resolve({ projectId: primary.projectId, messageId: unknownId }) });
    expect(denied.status).toBe(422);
    expect(await denied.json()).toMatchObject({
      code: "VALIDATION_FAILED", fieldErrors: [{ path: "acknowledgePossibleDuplicate" }],
    });

    const allowed = await POST(jsonRequest(
      `http://x/v1/projects/${primary.projectId}/communications/${unknownId}/retry`, "POST",
      { acknowledgePossibleDuplicate: true }, crypto.randomUUID(),
    ), { params: Promise.resolve({ projectId: primary.projectId, messageId: unknownId }) });
    expect(allowed.status).toBe(201);
    expect(await allowed.json()).toMatchObject({ retryOfMessageId: unknownId, channel: "telegram" });
  });

  it("refuses retry for an ineligible state or another project's message", async () => {
    // Break caught: the recovery command must be terminal-state- and exact-project-scoped.
    const queuedId = (await client.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id,project_id,telegram_chat_binding_id,direction,kind,text,author_member_id,delivery_state)
      values ($1,$2,$3,'outbound','text','Ще в черзі',$4,'queued') returning id`, [
      primary.workspaceId, primary.projectId, bindingId, primary.memberId,
    ])).rows[0]!.id;
    const foreignFailedId = (await client.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id,project_id,telegram_chat_binding_id,direction,kind,text,author_member_id,delivery_state)
      values ($1,$2,$3,'outbound','text','Інший проєкт',$4,'failed') returning id`, [
      foreign.workspaceId, foreign.projectId, foreignBindingId, foreign.memberId,
    ])).rows[0]!.id;
    const { POST } = await import("../app/v1/projects/[projectId]/communications/[messageId]/retry/route");
    const queued = await POST(jsonRequest(
      `http://x/v1/projects/${primary.projectId}/communications/${queuedId}/retry`, "POST", {}, crypto.randomUUID(),
    ), { params: Promise.resolve({ projectId: primary.projectId, messageId: queuedId }) });
    expect(queued.status).toBe(409);
    const foreignMessage = await POST(jsonRequest(
      `http://x/v1/projects/${primary.projectId}/communications/${foreignFailedId}/retry`, "POST", {}, crypto.randomUUID(),
    ), { params: Promise.resolve({ projectId: primary.projectId, messageId: foreignFailedId }) });
    expect(foreignMessage.status).toBe(404);
  });
});
