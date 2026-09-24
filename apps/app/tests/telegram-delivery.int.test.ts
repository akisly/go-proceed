import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { asService, dropWorkspaces } from "../../../packages/testing/src/pg";
import { seedAssignment, seedM2World, grantM2Capabilities, type M2Fixture } from "../../../packages/testing/src/m2-fixture";
import { seedRulesWorld, type RulesFixture } from "../../../packages/testing/src/m1-rules-fixture";
import { insertOccurrence, seedOccurrenceWorld, type OccurrenceWorld } from "../../../packages/testing/src/m2-occurrences-fixture";
import { readDodatokN } from "./helpers/dodatok-n";
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

  // One world per case. The oversized-card case reseeds with a long work-item
  // description, because a published version's lines are immutable (INV-015)
  // and the card's title is the work item's description.
  async function seedWorld(workItemDescription?: string): Promise<void> {
    fixture = await seedM2World(client, {
      workspaceId: crypto.randomUUID(), userId: actorUserId, email: "unused@example.test", suffix: "TG-CARD",
      ...(workItemDescription === undefined ? {} : { workItemDescription }),
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
  }

  beforeEach(async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t".repeat(32));
    vi.stubEnv("TELEGRAM_BOT_ID", "123456789");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "GoProceedTestBot");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "w".repeat(32));
    vi.stubEnv("TELEGRAM_WORKER_SECRET", "r".repeat(32));
    vi.stubEnv("TELEGRAM_LINK_HMAC_KEYS", `k1:${Buffer.alloc(32, 1).toString("base64")}`);
    vi.stubEnv("TELEGRAM_LINK_ACTIVE_KEY_ID", "k1");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://app.goproceed.test");
    actorUserId = crypto.randomUUID();
    client = await admin();
    await seedWorld();
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
      where workspace_id=$1 and project_id=$2 and member_id=$3 and capability='assignments.manage' and revoked_at is null`,
    [fixture.workspaceId, fixture.projectId, fixture.memberId]);
    const { POST } = await import("../app/v1/assignments/[assignmentId]/communication-card/route");
    const response = await POST(jsonRequest(assignmentId, crypto.randomUUID()), { params: Promise.resolve({ assignmentId }) });

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("rejects an oversized card rather than dropping ordered occurrences", async () => {
    // Break caught: a successful-looking card that omits a requirement creates
    // an evidence reply surface that no longer matches the assignment.
    await dropWorkspaces(client, [fixture.workspaceId]);
    await seedWorld("Надто довга робота ".repeat(400));
    const { POST } = await import("../app/v1/assignments/[assignmentId]/communication-card/route");
    const response = await POST(jsonRequest(assignmentId, crypto.randomUUID()), { params: Promise.resolve({ assignmentId }) });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "VALIDATION_FAILED", fieldErrors: [{ path: "assignment", message: "assignment_card_too_long" }],
    });
    const rows = await client.query("select count(*)::integer as count from public.communication_messages where workspace_id=$1", [fixture.workspaceId]);
    expect(rows.rows[0]?.count).toBe(0);
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

  it("uses the provider retry delay without broad outbox reads and dead-letters only after the bounded final rejection", async () => {
    // Break caught: reading transaction_outbox after fail as the service role
    // rolls the retry transaction back; retry_after must also never shorten the
    // repository's existing bounded backoff.
    const { POST } = await import("../app/v1/assignments/[assignmentId]/communication-card/route");
    const queued = await POST(jsonRequest(assignmentId, crypto.randomUUID()), { params: Promise.resolve({ assignmentId }) });
    const messageId = (await queued.json()).messageId as string;
    const retryingApi: TelegramApiClient = {
      sendMessage: async () => {
        throw new TelegramApiError("provider_error", "provider_rejected", 429, true, "retry", 2_000);
      },
      answerCallbackQuery: async () => undefined,
      setWebhook: async () => undefined,
      getFile: async () => ({ fileId: "file", fileUniqueId: null, fileSize: null }),
      downloadFile: async () => new Uint8Array(),
    };
    await expect(deliverTelegramOutboxBatch({ workerId: "delivery-test", limit: 10, apiClient: retryingApi }))
      .resolves.toEqual({ accepted: 0, failed: 1, unknown: 0 });
    const first = await client.query<{ attempt_count: number; deferred: boolean; processed: boolean }>(`select attempt_count,
      available_at >= now() + interval '2 seconds' as deferred, processed_at is not null as processed
      from public.transaction_outbox where aggregate_id=$1`, [messageId]);
    expect(first.rows[0]).toEqual({ attempt_count: 1, deferred: true, processed: false });
    await expect(asService("", fixture.workspaceId, (service) => service.query(
      "select * from public.transaction_outbox where aggregate_id=$1", [messageId],
    ))).rejects.toThrow(/permission denied/i);

    for (let attempt = 2; attempt <= 5; attempt += 1) {
      await client.query("update public.transaction_outbox set available_at=now() where aggregate_id=$1", [messageId]);
      await expect(deliverTelegramOutboxBatch({ workerId: "delivery-test", limit: 10, apiClient: retryingApi }))
        .resolves.toEqual({ accepted: 0, failed: 1, unknown: 0 });
    }
    const terminal = await client.query<{ delivery_state: string; attempts: string; processed: boolean; letters: string }>(`select
      m.delivery_state, (select count(*)::text from public.communication_delivery_attempts where message_id=m.id) as attempts,
      (select processed_at is not null from public.transaction_outbox where aggregate_id=m.id::text) as processed,
      (select count(*)::text from public.outbox_dead_letters d join public.transaction_outbox o on o.id=d.outbox_id where o.aggregate_id=m.id::text) as letters
      from public.communication_messages m where m.id=$1`, [messageId]);
    expect(terminal.rows[0]).toEqual({ delivery_state: "failed", attempts: "5", processed: true, letters: "1" });
  });

  it("rejects a stolen lease before it can be prepared for provider I/O", async () => {
    // Break caught: a worker that lost its lease must never send a duplicate
    // after another worker acquired the outbox row.
    const { POST } = await import("../app/v1/assignments/[assignmentId]/communication-card/route");
    const queued = await POST(jsonRequest(assignmentId, crypto.randomUUID()), { params: Promise.resolve({ assignmentId }) });
    const messageId = (await queued.json()).messageId as string;
    const claimed = await client.query<{ id: string; lease_token: string }>(
      "select id, lease_token from app.claim_outbox_topic('communication.telegram.send', 1, 'first', 60) where aggregate_id=$1", [messageId],
    );
    const claim = claimed.rows[0]!;
    await client.query("update public.transaction_outbox set lease_token=gen_random_uuid() where id=$1", [claim.id]);
    await expect(asService("", fixture.workspaceId, (service) => service.query(
      "select * from app.prepare_telegram_delivery($1::uuid, $2::uuid, $3::bigint, $4::integer)",
      [claim.id, claim.lease_token, 123456789, 60],
    ))).rejects.toThrow(/lease rejected/i);
  });

  it("rejects an expired lease before it can be prepared for provider I/O", async () => {
    const { POST } = await import("../app/v1/assignments/[assignmentId]/communication-card/route");
    const queued = await POST(jsonRequest(assignmentId, crypto.randomUUID()), { params: Promise.resolve({ assignmentId }) });
    const messageId = (await queued.json()).messageId as string;
    const claimed = await client.query<{ id: string; lease_token: string }>(
      "select id, lease_token from app.claim_outbox_topic('communication.telegram.send', 1, 'first', 60) where aggregate_id=$1", [messageId],
    );
    const claim = claimed.rows[0]!;
    await client.query("update public.transaction_outbox set lease_expires_at=now()-interval '1 second' where id=$1", [claim.id]);
    await expect(asService("", fixture.workspaceId, (service) => service.query(
      "select * from app.prepare_telegram_delivery($1::uuid, $2::uuid, $3::bigint, $4::integer)",
      [claim.id, claim.lease_token, 123456789, 60],
    ))).rejects.toThrow(/lease rejected/i);
  });

  it("serializes bot removal behind an in-flight fenced send", async () => {
    // Break caught: unlocked target snapshots allow a removal to commit between
    // validation and provider I/O, producing a send after channel health fell.
    const { POST } = await import("../app/v1/assignments/[assignmentId]/communication-card/route");
    await POST(jsonRequest(assignmentId, crypto.randomUUID()), { params: Promise.resolve({ assignmentId }) });
    let releaseSend: ((value: { messageId: string }) => void) | null = null;
    let started: (() => void) | null = null;
    const sendStarted = new Promise<void>((resolve) => { started = resolve; });
    const api: TelegramApiClient = {
      sendMessage: async () => {
        started?.();
        return new Promise<{ messageId: string }>((resolve) => { releaseSend = resolve; });
      },
      answerCallbackQuery: async () => undefined,
      setWebhook: async () => undefined,
      getFile: async () => ({ fileId: "file", fileUniqueId: null, fileSize: null }),
      downloadFile: async () => new Uint8Array(),
    };
    const delivery = deliverTelegramOutboxBatch({ workerId: "delivery-test", limit: 10, apiClient: api });
    await sendStarted;
    const removal = client.query(`update public.project_field_channels set state='unhealthy'
      where workspace_id=$1 and project_id=$2`, [fixture.workspaceId, fixture.projectId]);
    const blocked = await Promise.race([
      removal.then(() => false),
      new Promise<true>((resolve) => setTimeout(() => resolve(true), 25)),
    ]);
    expect(blocked).toBe(true);
    releaseSend?.({ messageId: "882" });
    await expect(delivery).resolves.toEqual({ accepted: 1, failed: 0, unknown: 0 });
    await removal;
    const final = await client.query<{ delivery_state: string; state: string }>(`select m.delivery_state, c.state::text
      from public.communication_messages m join public.project_field_channels c
        on c.workspace_id=m.workspace_id and c.project_id=m.project_id
      where m.workspace_id=$1`, [fixture.workspaceId]);
    expect(final.rows[0]).toEqual({ delivery_state: "provider_accepted", state: "unhealthy" });
  }, 10_000);
});

/**
 * THE CARD IS A RENDERER OF REGULATORY STRINGS, and M0 gate 9 governs it: «no
 * normative string renderable without its `verification` tag and its source»
 * (ADR-006:439-440, reached through ADR-007:236-237 and ruled for this card by
 * ADR-011 open item 9 on 2026-09-03). The unit halves live in
 * `src/lib/telegram/cards.test.ts`; this is the half that proves the ROUTE
 * selects the tag and the source at all and hands them to the renderer
 * indivisibly — a card route that selected `norm_ref` alone would still pass
 * every unit test in that file.
 */
databaseDescribe("Telegram assignment-card citations", () => {
  // Read, never transcribed — the CSV is the one place this wording comes from.
  const DBN_SOURCE = readDodatokN()[0]!.source;
  let client: Client;
  let rules: RulesFixture;
  let world: OccurrenceWorld;

  beforeEach(async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "t".repeat(32));
    vi.stubEnv("TELEGRAM_BOT_ID", "123456789");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "GoProceedTestBot");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "w".repeat(32));
    vi.stubEnv("TELEGRAM_WORKER_SECRET", "r".repeat(32));
    vi.stubEnv("TELEGRAM_LINK_HMAC_KEYS", `k1:${Buffer.alloc(32, 1).toString("base64")}`);
    vi.stubEnv("TELEGRAM_LINK_ACTIVE_KEY_ID", "k1");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://app.goproceed.test");
    actorUserId = crypto.randomUUID();
    client = await admin();
    rules = await seedRulesWorld(client, {
      workspaceId: crypto.randomUUID(), userId: actorUserId, suffix: "TG-CITE",
    });
    world = await seedOccurrenceWorld(client, rules);
    // Ordered by the route's own timing rank: `before_concealment` (the default
    // seed) precedes `after`, so the cited requirement is 1 and the uncited one
    // is 2 — the ordinals the assertions below name.
    await insertOccurrence(client, world, {
      acceptanceCriterion: "Підготовка ніш, каналів та борозен.",
      normRef: "ДБН А.3.1-5:2016, Додаток Н",
      normRefVerification: "VERIFIED_PRIMARY",
      normRefSource: DBN_SOURCE,
    });
    await insertOccurrence(client, world, {
      ruleVersionId: world.permissiveRuleVersionId, workStageId: world.permissiveStageId,
      stageIsConcealed: false, stageKey: world.permissiveStageKey, ordinal: 2,
      blockingScope: "blocks_both", timing: "after",
      acceptanceCriterion: "Текст вимоги, який ніхто не атрибутував.",
    });
    // `project.view` is ALREADY GRANTED by seedRulesWorld, together with
    // project.admin, contracts.edit, imports.manage, imports.publish and
    // rule_bindings.manage (m1-rules-fixture.ts:88-97). Only the card route's
    // second capability is missing, and re-granting the first one collides with
    // `project_access_active_unique` before a single assertion runs.
    await client.query(`insert into public.project_access_grants
      (workspace_id, project_id, member_id, capability, granted_by)
      values ($1,$2,$3,'assignments.manage',$4)`,
    [rules.workspaceId, rules.projectId, rules.memberId, rules.userId]);
    await client.query(`insert into public.project_field_channels
      (workspace_id, project_id, channel, state, locked_at, locked_by_member_id, last_healthy_at)
      values ($1,$2,'telegram','active',now(),$3,now())`,
    [rules.workspaceId, rules.projectId, rules.memberId]);
    await client.query(`insert into public.telegram_chat_bindings
      (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
      values ($1,$2,123456789,-100124,'supergroup',$3)`,
    [rules.workspaceId, rules.projectId, rules.memberId]);
  });

  afterEach(async () => {
    if (rules?.workspaceId) await dropWorkspaces(client, [rules.workspaceId]);
    await client.end();
    vi.unstubAllEnvs();
  });

  it("publishes the tag and the source with the citation, and withholds an unattributed requirement", async () => {
    // Break caught: the route selected `acceptance_criterion` and `norm_ref`
    // only, so the group received «критерій — ДБН …» with no verification tag
    // and no source, and «Нормативне посилання не вказано» where a source was
    // missing — a normative string rendered on the product's word alone.
    const { POST } = await import("../app/v1/assignments/[assignmentId]/communication-card/route");
    const response = await POST(
      jsonRequest(world.assignmentId, crypto.randomUUID()),
      { params: Promise.resolve({ assignmentId: world.assignmentId }) },
    );
    expect(response.status).toBe(201);

    const card = await client.query<{ text: string }>(
      `select text from public.communication_messages
        where workspace_id=$1 and kind='assignment_card'`, [rules.workspaceId]);
    const text = card.rows[0]?.text ?? "";

    expect(text).toContain("1. Підготовка ніш, каналів та борозен.");
    expect(text).toContain("перевірено за першоджерелом");
    expect(text).toContain(DBN_SOURCE);
    expect(text).not.toContain("Нормативне посилання не вказано");
    expect(text).not.toContain("Текст вимоги, який ніхто не атрибутував.");
    expect(text).toContain("2. Вимога без підтвердженого джерела — текст не показано.");
  });
});
