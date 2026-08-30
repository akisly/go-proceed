import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { withServiceTx } from "@goproceed/database";
import { asService, dropWorkspaces } from "../../../packages/testing/src/pg";
import { seedRulesWorld, type RulesFixture } from "../../../packages/testing/src/m1-rules-fixture";
import { insertOccurrence, seedOccurrenceWorld, type OccurrenceWorld } from "../../../packages/testing/src/m2-occurrences-fixture";
import { ADMIN_URL, hasIsolatedDatabaseCredentials } from "./helpers/fixtures";
import { enqueueTelegramMessage, deliverTelegramOutboxBatch } from "../src/lib/telegram/delivery";
import { prepareTelegramEvidenceCandidate, selectTelegramOccurrence } from "../src/lib/telegram/evidence";
import { normalizeTelegramUpdate } from "../src/lib/telegram/normalize";
import {
  processDueTelegramEvidenceRetries,
  processDueTelegramMediaGroups,
  processTelegramUpdate,
} from "../src/lib/telegram/processor";

// This file never falls back to local Postgres: it changes real evidence and
// outbox rows, so all three isolated URLs must exist before setup starts.
const databaseDescribe = hasIsolatedDatabaseCredentials() ? describe : describe.skip;

const fakes = vi.hoisted(() => ({
  stored: new Map<string, Uint8Array>(), downloads: [] as string[], payloads: new Map<string, Uint8Array>(),
  failedDownloads: new Set<string>(), failNextWrite: false,
  sent: [] as Array<{ chatId: string; text: string; replyToMessageId?: string | null; inlineKeyboard?: unknown }>,
  callbacks: [] as Array<{ callbackId: string; text?: string }>, nextProviderMessageId: 70_000, nextKey: 0,
}));

vi.mock("../src/lib/evidence-storage", () => ({
  EVIDENCE_BUCKET: "evidence",
  newEvidenceKey: () => `telegram-test/${++fakes.nextKey}`,
  createSignedUpload: async (key: string) => ({ signedUrl: `memory://${key}`, token: "memory", path: key }),
  putObject: async (key: string, bytes: Uint8Array) => {
    if (fakes.failNextWrite) { fakes.failNextWrite = false; throw new Error("storage write refused"); }
    fakes.stored.set(key, bytes);
  },
  downloadObject: async (key: string) => {
    const value = fakes.stored.get(key); if (!value) throw new Error("missing memory object"); return value;
  },
  objectSize: async (key: string) => fakes.stored.get(key)?.byteLength ?? null,
}));

vi.mock("../src/lib/telegram/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/telegram/api")>();
  return { ...actual, createTelegramApiClient: () => fakeTelegramApi() };
});

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const CHAT_ID = "-100991";
const BOT_ID = "123456789";
const UPLOADER_ID = "901";

function fakeTelegramApi() {
  return {
    sendMessage: async (input: { chatId: string; text: string; replyToMessageId?: string | null; inlineKeyboard?: unknown }) => {
      fakes.sent.push(input); return { messageId: String(++fakes.nextProviderMessageId) };
    },
    answerCallbackQuery: async (input: { callbackId: string; text?: string }) => { fakes.callbacks.push(input); },
    setWebhook: async () => undefined,
    getFile: async (fileId: string) => ({ fileId, fileUniqueId: `${fileId}-unique`, fileSize: fakes.payloads.get(fileId)?.byteLength ?? null }),
    downloadFile: async (fileId: string) => {
      fakes.downloads.push(fileId);
      if (fakes.failedDownloads.has(fileId)) throw new Error("provider unavailable");
      const payload = fakes.payloads.get(fileId); if (!payload) throw new Error("provider fixture missing file"); return payload;
    },
  };
}

type Card = { id: string; providerMessageId: string };

databaseDescribe("Telegram evidence bridge", () => {
  let client: Client;
  let rules: RulesFixture;
  let world: OccurrenceWorld;
  let occurrenceId = "";
  let alternateOccurrenceId = "";
  let bindingId = "";

  beforeAll(() => {
    Object.assign(process.env, {
      TELEGRAM_BOT_TOKEN: "t".repeat(24), TELEGRAM_BOT_ID: BOT_ID, TELEGRAM_BOT_USERNAME: "goproceed_test_bot",
      TELEGRAM_WEBHOOK_SECRET: "w".repeat(32), TELEGRAM_WORKER_SECRET: "r".repeat(32),
      TELEGRAM_LINK_PEPPER: "p".repeat(32), APP_PUBLIC_ORIGIN: "https://telegram-evidence.test",
    });
  });

  beforeEach(async () => {
    fakes.stored.clear(); fakes.downloads.length = 0; fakes.payloads.clear(); fakes.failedDownloads.clear();
    fakes.failNextWrite = false; fakes.sent.length = 0; fakes.callbacks.length = 0; fakes.nextKey = 0;
    client = new Client({ connectionString: ADMIN_URL }); await client.connect();
    rules = await seedRulesWorld(client, { workspaceId: crypto.randomUUID(), userId: crypto.randomUUID(), suffix: "TG-EVIDENCE" });
    world = await seedOccurrenceWorld(client, rules);
    occurrenceId = await insertOccurrence(client, world);
    alternateOccurrenceId = await insertOccurrence(client, world, {
      ruleVersionId: world.permissiveRuleVersionId, workStageId: world.permissiveStageId,
      stageIsConcealed: false, stageKey: world.permissiveStageKey, ordinal: 2,
    });
    await client.query(`insert into public.project_access_grants
      (workspace_id, project_id, member_id, capability, granted_by)
      values ($1,$2,$3,'evidence.record',$4)`, [rules.workspaceId, rules.projectId, rules.memberId, rules.userId]);
    await client.query(`insert into public.project_field_channels
      (workspace_id, project_id, channel, state, locked_at, locked_by_member_id, last_healthy_at)
      values ($1,$2,'telegram','active',now(),$3,now())`, [rules.workspaceId, rules.projectId, rules.memberId]);
    [bindingId] = (await client.query<{ id: string }>(`insert into public.telegram_chat_bindings
      (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
      values ($1,$2,$3::bigint,$4::bigint,'supergroup',$5) returning id`,
    [rules.workspaceId, rules.projectId, BOT_ID, CHAT_ID, rules.memberId])).rows.map(({ id }) => id);
    await client.query(`insert into public.telegram_member_links
      (workspace_id, member_id, telegram_user_id, linked_by_member_id) values ($1,$2,$3::bigint,$2)`,
    [rules.workspaceId, rules.memberId, UPLOADER_ID]);
  });

  afterEach(async () => {
    if (rules?.workspaceId) await dropWorkspaces(client, [rules.workspaceId]);
    await client.end();
  });

  async function deliverCard(): Promise<Card> {
    let id = "";
    await withServiceTx({ actorUserId: "", organizationId: rules.workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
      id = (await enqueueTelegramMessage(tx, { actorUserId: "", organizationId: rules.workspaceId, requestId: crypto.randomUUID() }, {
        workspaceId: rules.workspaceId, projectId: rules.projectId, telegramChatBindingId: bindingId,
        workAssignmentId: world.assignmentId, kind: "assignment_card", text: "Картка завдання",
        occurrenceSnapshot: [occurrenceId, alternateOccurrenceId],
      })).messageId;
    });
    expect(await deliverTelegramOutboxBatch({ workerId: "telegram-evidence-card", limit: 10, apiClient: fakeTelegramApi() }))
      .toEqual({ accepted: 1, failed: 0, unknown: 0 });
    const delivered = await client.query<{ provider_message_id: string; delivery_state: string }>(
      "select provider_message_id::text, delivery_state from public.communication_messages where id=$1", [id]);
    expect(delivered.rows[0]).toMatchObject({ delivery_state: "provider_accepted" });
    return { id, providerMessageId: delivered.rows[0]!.provider_message_id };
  }

  function imageUpdate(input: { updateId: string; messageId: string; fileId: string; replyTo: string | null; album?: string | null; fileSize?: number }) {
    return normalizeTelegramUpdate({ update_id: input.updateId, message: {
      message_id: input.messageId, date: 1_700_000_000, chat: { id: Number(CHAT_ID), type: "supergroup" }, from: { id: Number(UPLOADER_ID) },
      reply_to_message: input.replyTo === null ? undefined : { message_id: input.replyTo }, media_group_id: input.album ?? undefined,
      photo: [{ file_id: input.fileId, file_unique_id: `${input.fileId}-unique`, file_size: input.fileSize ?? JPEG.byteLength, width: 1, height: 1 }],
    } });
  }

  function documentUpdate(input: { updateId: string; messageId: string; fileId: string; replyTo: string | null; album?: string | null; mimeType?: string }) {
    return normalizeTelegramUpdate({ update_id: input.updateId, message: {
      message_id: input.messageId, date: 1_700_000_000, chat: { id: Number(CHAT_ID), type: "supergroup" }, from: { id: Number(UPLOADER_ID) },
      reply_to_message: input.replyTo === null ? undefined : { message_id: input.replyTo }, media_group_id: input.album ?? undefined,
      document: { file_id: input.fileId, file_unique_id: `${input.fileId}-unique`, file_name: `${input.fileId}.bin`, mime_type: input.mimeType ?? "application/pdf", file_size: 11 },
    } });
  }

  async function makeAlbumsDue(): Promise<void> {
    await client.query("update public.telegram_media_groups set last_part_at=now() - interval '3 seconds' where workspace_id=$1", [rules.workspaceId]);
  }

  async function receiptRows() {
    return (await client.query<{
      telegram_evidence_copy_key: string; telegram_evidence_receipt_key: string;
      telegram_evidence_chunk_index: number; telegram_evidence_recipient_member_id: string | null; text: string;
    }>(`select telegram_evidence_copy_key, telegram_evidence_receipt_key,
              telegram_evidence_chunk_index, telegram_evidence_recipient_member_id, text
         from public.communication_messages
        where workspace_id=$1 and telegram_evidence_receipt_key is not null
        order by telegram_evidence_receipt_key`, [rules.workspaceId])).rows;
  }

  async function attachmentsFor(messageIds: string[]) {
    return (await client.query<{ id: string; state: string; evidence_object_id: string | null; provider_file_id: string | null; failure_code: string | null }>(
      `select a.id, a.state, a.evidence_object_id, a.provider_file_id, a.failure_code
         from public.communication_attachments a join public.communication_messages m on m.workspace_id=a.workspace_id and m.id=a.message_id
        where m.workspace_id=$1 and m.provider_message_id = any($2::bigint[]) order by m.provider_message_id`, [rules.workspaceId, messageIds],
    )).rows;
  }

  it("leaves a no-card image terminal before any provider download", async () => {
    fakes.payloads.set("unbound-file", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "1", messageId: "701", fileId: "unbound-file", replyTo: null }));
    expect(fakes.downloads).toEqual([]);
    expect(await attachmentsFor(["701"])).toMatchObject([{ state: "unbound", provider_file_id: null }]);
  });

  it("uses the exact delivered card to create durable evidence, clear handles, and send the terminal receipt", async () => {
    await client.query("delete from public.requirement_occurrences where id=$1", [alternateOccurrenceId]);
    const card = await deliverCard(); fakes.payloads.set("one-live", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "2", messageId: "702", fileId: "one-live", replyTo: card.providerMessageId }));
    const [attachment] = await attachmentsFor(["702"]);
    expect(fakes.downloads).toEqual(["one-live"]);
    expect(attachment).toMatchObject({ state: "available", provider_file_id: null });
    expect(attachment!.evidence_object_id).toMatch(/^[0-9a-f-]{36}$/);
    const messages = await client.query<{ text: string }>(`select text from public.communication_messages
      where workspace_id=$1 and direction='outbound' and kind='text' order by created_at`, [rules.workspaceId]);
    expect(messages.rows.map((row) => row.text)).toContain("Зображення обробляється. Підтвердження буде надіслано після збереження доказу.");
    expect(messages.rows.map((row) => row.text)).toContain(`Збережено доказів: 1.\nЗображення 702: збережено — ${attachment!.evidence_object_id}.`);
    expect(await deliverTelegramOutboxBatch({ workerId: "telegram-evidence-receipt", limit: 10, apiClient: fakeTelegramApi() }))
      .toEqual({ accepted: 2, failed: 0, unknown: 0 });
  });

  it("binds opaque multiple-occurrence choices to uploader and group and rejects wrong, expired, and replayed callbacks", async () => {
    const card = await deliverCard();
    const message = await client.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id, project_id, telegram_chat_binding_id, direction, kind, provider_user_id, provider_message_id, provider_reply_to_message_id, delivery_state)
      values ($1,$2,$3,'inbound','photo',$4::bigint,703,$5::bigint,'received') returning id`,
    [rules.workspaceId, rules.projectId, bindingId, UPLOADER_ID, card.providerMessageId]);
    const attachment = await client.query<{ id: string }>(`insert into public.communication_attachments
      (workspace_id, project_id, message_id, provider_file_id, provider_file_unique_id, media_type_snapshot, byte_size, state)
      values ($1,$2,$3,'choice-file','choice-unique','image/jpeg',$4,'staged') returning id`,
    [rules.workspaceId, rules.projectId, message.rows[0]!.id, JPEG.byteLength]);
    const candidate = { kind: "photo" as const, fileId: "choice-file", fileUniqueId: "choice-unique", fileName: null, mimeType: "image/jpeg", fileSize: JPEG.byteLength, width: 1, height: 1 };
    const prepared = await prepareTelegramEvidenceCandidate({ workspaceId: rules.workspaceId, projectId: rules.projectId, telegramChatBindingId: bindingId,
      messageId: message.rows[0]!.id, attachmentId: attachment.rows[0]!.id, senderId: UPLOADER_ID, replyToProviderMessageId: card.providerMessageId, mediaGroupId: null, file: candidate });
    expect(prepared.kind).toBe("awaiting_requirement_choice");
    if (prepared.kind !== "awaiting_requirement_choice") throw new Error("expected choice");
    const token = prepared.tokens[0]!.token; const before = await attachmentsFor(["703"]);
    expect(await selectTelegramOccurrence({ botId: BOT_ID, chatId: "-100992", uploaderTelegramUserId: UPLOADER_ID, token })).toEqual({ kind: "rejected" });
    expect(await selectTelegramOccurrence({ botId: BOT_ID, chatId: CHAT_ID, uploaderTelegramUserId: "902", token })).toEqual({ kind: "rejected" });
    await client.query(`update public.telegram_requirement_choice_sessions set expires_at=now() - interval '1 second'
      where token_hash = encode(digest($1, 'sha256'), 'hex')`, [token]);
    expect(await selectTelegramOccurrence({ botId: BOT_ID, chatId: CHAT_ID, uploaderTelegramUserId: UPLOADER_ID, token })).toEqual({ kind: "rejected" });
    expect(await attachmentsFor(["703"])).toEqual(before);
    const fresh = await prepareTelegramEvidenceCandidate({ workspaceId: rules.workspaceId, projectId: rules.projectId, telegramChatBindingId: bindingId,
      messageId: message.rows[0]!.id, attachmentId: attachment.rows[0]!.id, senderId: UPLOADER_ID, replyToProviderMessageId: card.providerMessageId, mediaGroupId: null, file: candidate });
    if (fresh.kind !== "awaiting_requirement_choice") throw new Error("expected fresh choice");
    expect((await selectTelegramOccurrence({ botId: BOT_ID, chatId: CHAT_ID, uploaderTelegramUserId: UPLOADER_ID, token: fresh.tokens[0]!.token })).kind).toBe("selected");
    expect(await attachmentsFor(["703"])).toMatchObject([{ state: "processing" }]);
    expect(await selectTelegramOccurrence({ botId: BOT_ID, chatId: CHAT_ID, uploaderTelegramUserId: UPLOADER_ID, token: fresh.tokens[0]!.token })).toEqual({ kind: "rejected" });
  });

  it("waits two seconds for a three-image album, applies one choice, and creates three durable evidence objects", async () => {
    const card = await deliverCard();
    for (const [offset, fileId] of ["album-ok", "album-download-fails", "album-write-fails"].entries()) {
      fakes.payloads.set(fileId, JPEG);
      await processTelegramUpdate(imageUpdate({ updateId: String(10 + offset), messageId: String(710 + offset), fileId, replyTo: card.providerMessageId, album: "album-1" }));
    }
    await client.query("update public.telegram_media_groups set last_part_at=now() - interval '3 seconds' where workspace_id=$1", [rules.workspaceId]);
    expect(await processDueTelegramMediaGroups()).toBe(1); expect(fakes.downloads).toEqual([]);
    expect(await attachmentsFor(["710", "711", "712"])).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: "awaiting_requirement_choice" }), expect.objectContaining({ state: "awaiting_requirement_choice" }), expect.objectContaining({ state: "awaiting_requirement_choice" }),
    ]));
    const prompt = await client.query<{ telegram_reply_markup: Array<Array<{ callbackData: string }>> }>(`select telegram_reply_markup
      from public.communication_messages where workspace_id=$1 and direction='outbound' and telegram_reply_markup is not null`, [rules.workspaceId]);
    const callback = prompt.rows[0]!.telegram_reply_markup[0]![0]!.callbackData; expect(callback).toMatch(/^req:[A-Za-z0-9_-]{43}$/);
    expect(await processTelegramUpdate(normalizeTelegramUpdate({ update_id: "20", callback_query: {
      id: "album-choice", from: { id: Number(UPLOADER_ID) }, data: callback, message: { message_id: 799, chat: { id: Number(CHAT_ID), type: "supergroup" } },
    } }))).toBe("selected_requirement_occurrence");
    const terminal = await attachmentsFor(["710", "711", "712"]);
    expect(terminal.filter((row) => row.state === "available")).toHaveLength(3); expect(terminal.filter((row) => row.state === "failed")).toHaveLength(0);
    expect(new Set(terminal.map((row) => row.evidence_object_id))).toHaveLength(3);
    expect(terminal.every((row) => row.provider_file_id === null)).toBe(true);
    const summaries = await client.query<{ text: string }>(`select text from public.communication_messages
      where workspace_id=$1 and direction='outbound' and text like 'Збережено доказів:%'`, [rules.workspaceId]);
    expect(summaries.rows).toHaveLength(1); expect(summaries.rows[0]!.text).toContain("Збережено доказів: 3.");
    expect(summaries.rows[0]!.text.match(/Зображення \d+: збережено — [0-9a-f-]{36}\./g)).toHaveLength(3);
  });

  it("retains successful album evidence while naming only safe terminal download and finalization failures", async () => {
    const card = await deliverCard();
    for (const [offset, fileId] of ["partial-ok", "partial-download-fails", "partial-write-fails"].entries()) {
      fakes.payloads.set(fileId, JPEG);
      await processTelegramUpdate(imageUpdate({ updateId: String(40 + offset), messageId: String(740 + offset), fileId, replyTo: card.providerMessageId, album: "album-partial" }));
    }
    await client.query("update public.telegram_media_groups set last_part_at=now() - interval '3 seconds' where workspace_id=$1", [rules.workspaceId]);
    expect(await processDueTelegramMediaGroups()).toBe(1);
    const prompt = await client.query<{ telegram_reply_markup: Array<Array<{ callbackData: string }>> }>(`select telegram_reply_markup
      from public.communication_messages where workspace_id=$1 and direction='outbound' and telegram_reply_markup is not null`, [rules.workspaceId]);
    const callback = prompt.rows[0]!.telegram_reply_markup[0]![0]!.callbackData;
    fakes.failedDownloads.add("partial-download-fails"); fakes.failNextWrite = true;
    await processTelegramUpdate(normalizeTelegramUpdate({ update_id: "50", callback_query: {
      id: "partial-choice", from: { id: Number(UPLOADER_ID) }, data: callback, message: { message_id: 899, chat: { id: Number(CHAT_ID), type: "supergroup" } },
    } }));
    const terminal = await attachmentsFor(["740", "741", "742"]);
    expect(terminal.filter((row) => row.state === "available")).toHaveLength(1); expect(terminal.filter((row) => row.state === "failed")).toHaveLength(2);
    expect(terminal.every((row) => row.provider_file_id === null)).toBe(true);
    const summaries = await client.query<{ text: string }>(`select text from public.communication_messages
      where workspace_id=$1 and direction='outbound' and text like 'Частину зображень збережено%'`, [rules.workspaceId]);
    expect(summaries.rows).toHaveLength(1); expect(summaries.rows[0]!.text).toContain("не збережено — provider_download_failed.");
    expect(summaries.rows[0]!.text).toContain("не збережено — evidence_processing_failed."); expect(summaries.rows[0]!.text).not.toContain("збережено — null");
  });

  it("never downloads unsupported, quota-refused, or revoked media and duplicate updates converge", async () => {
    await client.query("delete from public.requirement_occurrences where id=$1", [alternateOccurrenceId]);
    const card = await deliverCard();
    // Store a real staged attachment: the pre-download guard is part of the behavior, not a unit-only branch.
    await processTelegramUpdate(normalizeTelegramUpdate({ update_id: "29", message: { message_id: 729, date: 1_700_000_000,
      chat: { id: Number(CHAT_ID), type: "supergroup" }, from: { id: Number(UPLOADER_ID) }, reply_to_message: { message_id: card.providerMessageId },
      document: { file_id: "pdf", file_unique_id: "pdf", file_name: "x.pdf", mime_type: "application/pdf", file_size: 1 },
    } }));
    expect(fakes.downloads).toEqual([]); expect(await attachmentsFor(["729"])).toMatchObject([{ state: "not_evidence", provider_file_id: null }]);
    await processTelegramUpdate(imageUpdate({ updateId: "291", messageId: "728", fileId: "too-large", replyTo: card.providerMessageId, fileSize: 20 * 1024 * 1024 + 1 }));
    expect(fakes.downloads).toEqual([]); expect(await attachmentsFor(["728"])).toMatchObject([{ state: "not_evidence", provider_file_id: null }]);
    fakes.payloads.set("duplicate", JPEG); const update = imageUpdate({ updateId: "30", messageId: "730", fileId: "duplicate", replyTo: card.providerMessageId });
    await client.query("update public.organizations set evidence_quota_bytes=1 where id=$1", [rules.workspaceId]);
    await processTelegramUpdate(update); await processTelegramUpdate(update);
    expect(fakes.downloads).toEqual(["duplicate"]); expect(await attachmentsFor(["730"])).toMatchObject([{ state: "failed", provider_file_id: null }]);
    const count = await client.query<{ n: number }>(`select count(*)::int as n from public.communication_messages
      where workspace_id=$1 and direction='outbound' and kind='text'`, [rules.workspaceId]);
    expect(count.rows[0]!.n).toBe(2);
    await client.query("update public.organizations set evidence_quota_bytes=null where id=$1", [rules.workspaceId]);
    await client.query("update public.telegram_member_links set revoked_at=now() where workspace_id=$1", [rules.workspaceId]);
    fakes.payloads.set("revoked", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "31", messageId: "731", fileId: "revoked", replyTo: card.providerMessageId }));
    expect(fakes.downloads).toEqual(["duplicate"]); expect(await attachmentsFor(["731"])).toMatchObject([{ state: "unbound", provider_file_id: null }]);
  });

  it("terminalizes and reports all-unsupported and mixed albums without orphaned handles", async () => {
    await client.query("delete from public.requirement_occurrences where id=$1", [alternateOccurrenceId]);
    const card = await deliverCard();
    await processTelegramUpdate(documentUpdate({ updateId: "60", messageId: "760", fileId: "pdf-a", replyTo: card.providerMessageId, album: "unsupported-album" }));
    await processTelegramUpdate(documentUpdate({ updateId: "61", messageId: "761", fileId: "pdf-b", replyTo: card.providerMessageId, album: "unsupported-album" }));
    fakes.payloads.set("mixed-image", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "62", messageId: "762", fileId: "mixed-image", replyTo: card.providerMessageId, album: "mixed-album" }));
    await processTelegramUpdate(documentUpdate({ updateId: "63", messageId: "763", fileId: "mixed-pdf", replyTo: card.providerMessageId, album: "mixed-album" }));
    await makeAlbumsDue();

    expect(await processDueTelegramMediaGroups()).toBe(2);
    expect(await attachmentsFor(["760", "761"])).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: "not_evidence", provider_file_id: null }),
      expect.objectContaining({ state: "not_evidence", provider_file_id: null }),
    ]));
    const mixed = await attachmentsFor(["762", "763"]);
    expect(mixed.filter(({ state }) => state === "available")).toHaveLength(1);
    expect(mixed.filter(({ state }) => state === "not_evidence")).toHaveLength(1);
    expect(mixed.every(({ provider_file_id }) => provider_file_id === null)).toBe(true);
    expect((await receiptRows()).map(({ telegram_evidence_copy_key }) => telegram_evidence_copy_key).sort())
      .toEqual(["telegram.evidence.partial", "telegram.evidence.unbound"]);
  });

  it("reopens a claimed generation for a late part and reclaims an expired lease", async () => {
    await client.query("delete from public.requirement_occurrences where id=$1", [alternateOccurrenceId]);
    const card = await deliverCard(); fakes.payloads.set("early", JPEG); fakes.payloads.set("late", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "70", messageId: "770", fileId: "early", replyTo: card.providerMessageId, album: "late-album" }));
    await makeAlbumsDue();
    const firstClaim = await asService<{ id: string; lease_token: string; processing_generation: string }>("", null, (service) => service.query(
      "select id, lease_token::text, processing_generation::text from app.claim_telegram_media_groups(1, 60)",
    ));
    expect(firstClaim.rows).toHaveLength(1);
    await processTelegramUpdate(imageUpdate({ updateId: "71", messageId: "771", fileId: "late", replyTo: card.providerMessageId, album: "late-album" }));
    const reopened = await client.query<{ state: string; processing_generation: string; processing_lease_token: string | null }>(
      "select state, processing_generation::text, processing_lease_token::text from public.telegram_media_groups where workspace_id=$1",
      [rules.workspaceId],
    );
    expect(reopened.rows[0]).toMatchObject({ state: "open", processing_lease_token: null });
    expect(Number(reopened.rows[0]!.processing_generation)).toBeGreaterThan(Number(firstClaim.rows[0]!.processing_generation));
    await makeAlbumsDue();
    const secondClaim = await asService<{ id: string; lease_token: string }>("", null, (service) => service.query(
      "select id, lease_token::text from app.claim_telegram_media_groups(1, 60)",
    ));
    expect(secondClaim.rows[0]!.lease_token).not.toBe(firstClaim.rows[0]!.lease_token);
    await client.query("update public.telegram_media_groups set processing_lease_expires_at=now()-interval '1 second' where id=$1", [secondClaim.rows[0]!.id]);
    const reclaimed = await asService<{ lease_token: string }>("", null, (service) => service.query(
      "select lease_token::text from app.claim_telegram_media_groups(1, 60)",
    ));
    expect(reclaimed.rows[0]!.lease_token).not.toBe(secondClaim.rows[0]!.lease_token);
    await client.query("update public.telegram_media_groups set processing_lease_expires_at=now()-interval '1 second' where id=$1", [secondClaim.rows[0]!.id]);
    expect(await processDueTelegramMediaGroups()).toBe(1);
    expect(await attachmentsFor(["770", "771"])).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: "available", provider_file_id: null }),
      expect.objectContaining({ state: "available", provider_file_id: null }),
    ]));
    expect((await client.query<{ state: string }>(
      "select state from public.telegram_media_groups where id=$1", [secondClaim.rows[0]!.id],
    )).rows[0]).toEqual({ state: "completed" });
  });

  it("enqueues one canonical unbound receipt on replay and one uploader expiry receipt on repeated cleanup", async () => {
    const unbound = imageUpdate({ updateId: "80", messageId: "780", fileId: "unbound-replay", replyTo: null });
    await processTelegramUpdate(unbound); await processTelegramUpdate(unbound);
    let receipts = await receiptRows();
    expect(receipts.filter(({ telegram_evidence_copy_key }) => telegram_evidence_copy_key === "telegram.evidence.unbound")).toHaveLength(1);

    const card = await deliverCard(); fakes.payloads.set("choice-expiry", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "81", messageId: "781", fileId: "choice-expiry", replyTo: card.providerMessageId, album: "expiry-album" }));
    await makeAlbumsDue(); await processDueTelegramMediaGroups();
    await client.query("update public.telegram_requirement_choice_sessions set expires_at=now()-interval '1 second' where workspace_id=$1", [rules.workspaceId]);
    await processDueTelegramMediaGroups(); await processDueTelegramMediaGroups();
    receipts = await receiptRows();
    const expired = receipts.filter(({ telegram_evidence_copy_key }) => telegram_evidence_copy_key === "telegram.evidence.choice_expired");
    expect(expired).toHaveLength(1);
    expect(expired[0]!.telegram_evidence_recipient_member_id).toBe(rules.memberId);
    expect(await attachmentsFor(["781"])).toMatchObject([{ state: "not_evidence", provider_file_id: null }]);
  });

  it("waits for retryable album parts, then completes once on retry success or exhaustion", async () => {
    await client.query("delete from public.requirement_occurrences where id=$1", [alternateOccurrenceId]);
    const card = await deliverCard();
    for (const [album, messageId, fileId] of [["retry-success", "790", "retry-once"], ["retry-exhaust", "791", "retry-always"]] as const) {
      fakes.payloads.set(fileId, JPEG); fakes.failedDownloads.add(fileId);
      await processTelegramUpdate(imageUpdate({ updateId: messageId, messageId, fileId, replyTo: card.providerMessageId, album }));
    }
    await makeAlbumsDue(); await processDueTelegramMediaGroups();
    expect(await receiptRows()).toHaveLength(0);
    expect((await client.query<{ state: string }>("select state from public.telegram_media_groups where workspace_id=$1", [rules.workspaceId])).rows.every(({ state }) => state === "processing")).toBe(true);

    fakes.failedDownloads.delete("retry-once");
    await client.query("update public.communication_attachments set provider_next_retry_at=now() where workspace_id=$1", [rules.workspaceId]);
    await processDueTelegramEvidenceRetries();
    expect((await receiptRows()).filter(({ text }) => text.includes("790"))).toHaveLength(1);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await client.query("update public.communication_attachments set provider_next_retry_at=now() where workspace_id=$1 and provider_file_id='retry-always'", [rules.workspaceId]);
      await processDueTelegramEvidenceRetries();
    }
    const terminal = await attachmentsFor(["791"]);
    expect(terminal).toMatchObject([{ state: "failed", provider_file_id: null }]);
    expect((await receiptRows()).filter(({ text }) => text.includes("791"))).toHaveLength(1);
  });
});
