import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { withServiceTx } from "@goproceed/database";
import { TelegramApiError } from "../src/lib/telegram/api";
import { asService, dropWorkspaces } from "../../../packages/testing/src/pg";
import { seedRulesWorld, type RulesFixture } from "../../../packages/testing/src/m1-rules-fixture";
import { deleteOccurrence, insertOccurrence, seedOccurrenceWorld, type OccurrenceWorld } from "../../../packages/testing/src/m2-occurrences-fixture";
import { ADMIN_URL, hasIsolatedDatabaseCredentials } from "./helpers/fixtures";
import { readDodatokN } from "./helpers/dodatok-n";
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
  stored: new Map<string, Uint8Array>(), storedTypes: new Map<string, string>(), downloads: [] as string[], payloads: new Map<string, Uint8Array>(),
  failedDownloads: new Set<string>(), retryableDownloads: new Set<string>(), failNextWrite: false,
  sent: [] as Array<{ chatId: string; text: string; replyToMessageId?: string | null; inlineKeyboard?: unknown }>,
  callbacks: [] as Array<{ callbackId: string; text?: string }>, nextProviderMessageId: 70_000, nextKey: 0,
  // app.finalize_upload_intent verifies the object EXISTS in storage.objects
  // before it will mark evidence available. The in-memory mock satisfied every
  // application-side read and none of that, so no Telegram evidence could ever
  // reach 'available'. Routed through the hoisted object because the vi.mock
  // factory is hoisted above `client`.
  writeStorageObject: null as null | ((key: string, size: number) => Promise<void>),
}));

vi.mock("../src/lib/evidence-storage", () => ({
  EVIDENCE_BUCKET: "evidence",
  newEvidenceKey: () => `telegram-test/${++fakes.nextKey}`,
  createSignedUpload: async (key: string) => ({ signedUrl: `memory://${key}`, token: "memory", path: key }),
  putObject: async (key: string, bytes: Uint8Array, contentType: string) => {
    if (fakes.failNextWrite) { fakes.failNextWrite = false; throw new Error("storage write refused"); }
    fakes.stored.set(key, bytes);
    fakes.storedTypes.set(key, contentType);
    await fakes.writeStorageObject?.(key, bytes.byteLength);
  },
  downloadObject: async (key: string) => {
    const value = fakes.stored.get(key); if (!value) throw new Error("missing memory object"); return value;
  },
  // As Storage's metadata: the size and the type the PUT declared.
  objectInfo: async (key: string) => {
    const bytes = fakes.stored.get(key);
    return bytes ? { size: bytes.byteLength, contentType: fakes.storedTypes.get(key) ?? null } : null;
  },
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
      if (fakes.retryableDownloads.has(fileId)) {
        throw new TelegramApiError("network_error", "network_error", null, true, "provider unavailable");
      }
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
      TELEGRAM_LINK_HMAC_KEYS: `k1:${Buffer.alloc(32, 1).toString("base64")}`, TELEGRAM_LINK_ACTIVE_KEY_ID: "k1", APP_PUBLIC_ORIGIN: "https://telegram-evidence.test",
    });
  });

  beforeEach(async () => {
    fakes.stored.clear(); fakes.storedTypes.clear(); fakes.downloads.length = 0; fakes.payloads.clear(); fakes.failedDownloads.clear();
    fakes.retryableDownloads.clear();
    fakes.failNextWrite = false; fakes.sent.length = 0; fakes.callbacks.length = 0; fakes.nextKey = 0;
    client = new Client({ connectionString: ADMIN_URL }); await client.connect();
    fakes.writeStorageObject = async (key, size) => {
      await client.query(`insert into storage.objects (bucket_id, name, metadata)
        values ('evidence', $1, jsonb_build_object('size', $2::int)) on conflict do nothing`, [key, size]);
    };
    rules = await seedRulesWorld(client, { workspaceId: crypto.randomUUID(), userId: crypto.randomUUID(), suffix: "TG-EVIDENCE" });
    world = await seedOccurrenceWorld(client, rules);
    occurrenceId = await insertOccurrence(client, world);
    alternateOccurrenceId = await insertOccurrence(client, world, {
      ruleVersionId: world.permissiveRuleVersionId, workStageId: world.permissiveStageId,
      stageIsConcealed: false, stageKey: world.permissiveStageKey, ordinal: 2,
      blockingScope: "blocks_both", timing: "after",
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
    fakes.writeStorageObject = null;
    if (rules?.workspaceId) await dropWorkspaces(client, [rules.workspaceId]);
    await client.end();
  });

  async function deliverCard(snapshot: string[] = [occurrenceId, alternateOccurrenceId]): Promise<Card> {
    let id = "";
    await withServiceTx({ actorUserId: "", organizationId: rules.workspaceId, requestId: crypto.randomUUID() }, async (tx) => {
      id = (await enqueueTelegramMessage(tx, { actorUserId: "", organizationId: rules.workspaceId, requestId: crypto.randomUUID() }, {
        workspaceId: rules.workspaceId, projectId: rules.projectId, telegramChatBindingId: bindingId,
        workAssignmentId: world.assignmentId, kind: "assignment_card", text: "Картка завдання",
        occurrenceSnapshot: snapshot,
      })).messageId;
    });
    expect(await deliverTelegramOutboxBatch({ workerId: "telegram-evidence-card", limit: 10, apiClient: fakeTelegramApi() }))
      .toEqual({ accepted: 1, failed: 0, unknown: 0 });
    const delivered = await client.query<{ provider_message_id: string; delivery_state: string }>(
      "select provider_message_id::text, delivery_state from public.communication_messages where id=$1", [id]);
    expect(delivered.rows[0]).toMatchObject({ delivery_state: "provider_accepted" });
    return { id, providerMessageId: delivered.rows[0]!.provider_message_id };
  }

  function imageUpdate(input: { updateId: string; messageId: string; fileId: string; replyTo: string | null; album?: string | null; fileSize?: number; senderId?: string }) {
    return normalizeTelegramUpdate({ update_id: input.updateId, message: {
      message_id: input.messageId, date: 1_700_000_000, chat: { id: Number(CHAT_ID), type: "supergroup" }, from: { id: Number(input.senderId ?? UPLOADER_ID) },
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
    // The parts age WITH the group. Production writes group.last_part_at and
    // attachment.created_at inside one transaction, from one now(), and every
    // stage of the album pipeline fences on `created_at <= claimed_last_part_at`.
    // Rewinding only the group put the cut-off three seconds before every part,
    // so nothing was ever claimed, prepared, downloaded or terminalised — and
    // the pipeline reported an empty album rather than an error.
    await client.query(`update public.communication_attachments
        set created_at = least(created_at, now() - interval '4 seconds')
      where workspace_id=$1 and telegram_media_group_id is not null`, [rules.workspaceId]);
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

  it("leaves every no-card album part unbound before any provider download", async () => {
    fakes.payloads.set("unbound-album-a", JPEG); fakes.payloads.set("unbound-album-b", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "3", messageId: "703", fileId: "unbound-album-a", replyTo: null, album: "unbound-album" }));
    await processTelegramUpdate(imageUpdate({ updateId: "4", messageId: "704", fileId: "unbound-album-b", replyTo: null, album: "unbound-album" }));
    await makeAlbumsDue();
    expect(await processDueTelegramMediaGroups()).toBe(1);
    expect(fakes.downloads).toEqual([]);
    expect(await attachmentsFor(["703", "704"])).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: "unbound", failure_code: "unbound_card_reply", provider_file_id: null }),
      expect.objectContaining({ state: "unbound", failure_code: "unbound_card_reply", provider_file_id: null }),
    ]));
  });

  it("uses the exact delivered card to create durable evidence, clear handles, and send the terminal receipt", async () => {
    await deleteOccurrence(client, alternateOccurrenceId);
    const card = await deliverCard(); fakes.payloads.set("one-live", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "2", messageId: "702", fileId: "one-live", replyTo: card.providerMessageId }));
    const [attachment] = await attachmentsFor(["702"]);
    expect(fakes.downloads).toEqual(["one-live"]);
    expect(attachment).toMatchObject({ state: "available", provider_file_id: null });
    expect(attachment!.evidence_object_id).toMatch(/^[0-9a-f-]{36}$/);
    const messages = await client.query<{ text: string; telegram_reply_markup: Array<Array<{ text: string; callbackData: string }>> | null }>(
      `select text, telegram_reply_markup from public.communication_messages
        where workspace_id=$1 and direction='outbound' and kind='text' order by created_at`, [rules.workspaceId]);
    expect(messages.rows.map((row) => row.text)).toContain("Зображення обробляється. Підтвердження буде надіслано після збереження доказу.");
    expect(messages.rows.map((row) => row.text)).toContain(`Збережено доказів: 1.\nЗображення 702: збережено — ${attachment!.evidence_object_id}.`);
    // The third outbound text is the decision keyboard. Accept and return are
    // explicit actions (2026-08-28 design §8.4), published once an occurrence
    // holds a durable available object (processor.ts, reconcile); it landed
    // on 2026-08-31 (19f05ff), after this case counted two deliveries.
    const keyboard = messages.rows.find((row) => row.telegram_reply_markup !== null);
    expect(keyboard?.telegram_reply_markup?.[0]?.map(({ text, callbackData }) => [text, callbackData.slice(0, 4)]))
      .toEqual([["Прийняти", "dec:"], ["Повернути", "dec:"]]);
    expect(messages.rows).toHaveLength(3);
    expect(await deliverTelegramOutboxBatch({ workerId: "telegram-evidence-receipt", limit: 10, apiClient: fakeTelegramApi() }))
      .toEqual({ accepted: 3, failed: 0, unknown: 0 });
  });

  it("offers requirements with their tag and source, and never on a button", async () => {
    // Break caught: `app.resolve_telegram_evidence_context` composed
    // `left(o.acceptance_criterion,120)` and the processor put it on a button,
    // so a requirement's words reached the закрита група truncated, with no
    // verification tag and no source — including the words the card had just
    // WITHHELD, because the card's snapshot carries every occurrence id
    // (prohibition T; migration 0084).
    // REPLACED, not added: `requirement_occurrences_materialisation_uniq` keys
    // an occurrence by (workspace, assignment, stage, rule version), and the
    // world's two occurrences already hold both of its pairs. The hold rule's
    // slot is freed and re-taken with a citation on it.
    await deleteOccurrence(client, occurrenceId);
    const citedId = await insertOccurrence(client, world, {
      acceptanceCriterion: "Підготовка ніш, каналів та борозен.",
      normRef: "ДБН А.3.1-5:2016, Додаток Н", normRefVerification: "VERIFIED_PRIMARY",
      normRefSource: readDodatokN()[0]!.source,
    });
    // The world's own occurrences carry no citation (the fixture default), so
    // one card holds both halves of the rule: an attributed requirement and a
    // withheld one. Timing rank orders the cited one first — 0084 gives the
    // definer the card route's order.
    const card = await deliverCard([citedId, alternateOccurrenceId]);
    fakes.payloads.set("cited-file", JPEG);
    await processTelegramUpdate(imageUpdate({
      updateId: "60", messageId: "760", fileId: "cited-file", replyTo: card.providerMessageId,
    }));

    const prompt = await client.query<{ text: string; telegram_reply_markup: Array<Array<{ text: string }>> }>(
      `select text, telegram_reply_markup from public.communication_messages
        where workspace_id=$1 and direction='outbound' and telegram_reply_markup is not null
          and text like '%Виберіть вимогу%'`, [rules.workspaceId]);
    const text = prompt.rows[0]!.text;

    expect(text).toContain("1. Підготовка ніш, каналів та борозен.");
    expect(text).toContain("перевірено за першоджерелом");
    expect(text).toContain(readDodatokN()[0]!.source);
    expect(text).toContain("2. Вимога без підтвердженого джерела — текст не показано.");
    expect(text).not.toContain("Приклад-критерій приймання.");
    expect(prompt.rows[0]!.telegram_reply_markup.map((row) => row[0]!.text)).toEqual(["Вимога 1", "Вимога 2"]);
  });

  it("binds opaque multiple-occurrence choices to uploader and group and rejects wrong, expired, and replayed callbacks", async () => {
    const card = await deliverCard();
    // The rows storeMessage would write for a linked uploader's card reply:
    // author_member_id is the linked member, as linkedMemberId() resolves it.
    async function stagedReply(providerMessageId: string, fileId: string): Promise<{ messageId: string; attachmentId: string }> {
      const message = await client.query<{ id: string }>(`insert into public.communication_messages
        (workspace_id, project_id, telegram_chat_binding_id, direction, kind, author_member_id, provider_user_id, provider_message_id, provider_reply_to_message_id, delivery_state)
        values ($1,$2,$3,'inbound','photo',$4,$5::bigint,$6::bigint,$7::bigint,'received') returning id`,
      [rules.workspaceId, rules.projectId, bindingId, rules.memberId, UPLOADER_ID, providerMessageId, card.providerMessageId]);
      const attachment = await client.query<{ id: string }>(`insert into public.communication_attachments
        (workspace_id, project_id, message_id, provider_file_id, provider_file_unique_id, media_type_snapshot, byte_size, state)
        values ($1,$2,$3,$4,$5,'image/jpeg',$6,'staged') returning id`,
      [rules.workspaceId, rules.projectId, message.rows[0]!.id, fileId, `${fileId}-unique`, JPEG.byteLength]);
      return { messageId: message.rows[0]!.id, attachmentId: attachment.rows[0]!.id };
    }
    async function prepare(reply: { messageId: string; attachmentId: string }, fileId: string) {
      return prepareTelegramEvidenceCandidate({ workspaceId: rules.workspaceId, projectId: rules.projectId, telegramChatBindingId: bindingId,
        messageId: reply.messageId, attachmentId: reply.attachmentId, senderId: UPLOADER_ID, replyToProviderMessageId: card.providerMessageId, mediaGroupId: null,
        file: { kind: "photo" as const, fileId, fileUniqueId: `${fileId}-unique`, fileName: null, mimeType: "image/jpeg", fileSize: JPEG.byteLength, width: 1, height: 1 } });
    }
    const first = await stagedReply("703", "choice-file");
    const prepared = await prepare(first, "choice-file");
    expect(prepared.kind).toBe("awaiting_requirement_choice");
    if (prepared.kind !== "awaiting_requirement_choice") throw new Error("expected choice");
    const token = prepared.tokens[0]!.token; const before = await attachmentsFor(["703"]);
    expect(await selectTelegramOccurrence({ botId: BOT_ID, chatId: "-100992", uploaderTelegramUserId: UPLOADER_ID, token })).toEqual({ kind: "rejected" });
    expect(await selectTelegramOccurrence({ botId: BOT_ID, chatId: CHAT_ID, uploaderTelegramUserId: "902", token })).toEqual({ kind: "rejected" });
    // Age the session as a whole: the table's CHECK keeps expires_at after
    // created_at, so moving expires_at alone into the past is refused (23514).
    await client.query(`update public.telegram_requirement_choice_sessions
      set created_at=now()-interval '25 hours', expires_at=now()-interval '1 hour'
      where token_hash = encode(digest($1, 'sha256'), 'hex')`, [token]);
    expect(await selectTelegramOccurrence({ botId: BOT_ID, chatId: CHAT_ID, uploaderTelegramUserId: UPLOADER_ID, token })).toEqual({ kind: "rejected" });
    expect(await attachmentsFor(["703"])).toEqual(before);
    // An expired choice is terminal (0071, app.expire_telegram_evidence_choices;
    // design §8.3: no selection within 24 hours closes the attachment as
    // not_evidence and the user must reply again in the correct context). The
    // same attachment is never offered a second prompt.
    await processDueTelegramMediaGroups();
    expect(await attachmentsFor(["703"])).toMatchObject([{ state: "not_evidence", failure_code: "choice_expired", provider_file_id: null }]);
    expect(await prepare(first, "choice-file")).toEqual({ kind: "not_evidence", code: "already_processed" });
    expect((await receiptRows()).filter(({ telegram_evidence_copy_key }) => telegram_evidence_copy_key === "telegram.evidence.choice_expired"))
      .toMatchObject([{ telegram_evidence_recipient_member_id: rules.memberId }]);
    // The reply the user sends again carries its own choice.
    const second = await stagedReply("704", "choice-file-again");
    const fresh = await prepare(second, "choice-file-again");
    if (fresh.kind !== "awaiting_requirement_choice") throw new Error("expected fresh choice");
    expect((await selectTelegramOccurrence({ botId: BOT_ID, chatId: CHAT_ID, uploaderTelegramUserId: UPLOADER_ID, token: fresh.tokens[0]!.token })).kind).toBe("selected");
    expect(await attachmentsFor(["704"])).toMatchObject([{ state: "processing" }]);
    expect(await selectTelegramOccurrence({ botId: BOT_ID, chatId: CHAT_ID, uploaderTelegramUserId: UPLOADER_ID, token: fresh.tokens[0]!.token })).toEqual({ kind: "rejected" });
  });

  it("waits two seconds for a three-image album, applies one choice, and creates three durable evidence objects", async () => {
    const card = await deliverCard();
    for (const [offset, fileId] of ["album-ok", "album-download-fails", "album-write-fails"].entries()) {
      fakes.payloads.set(fileId, JPEG);
      await processTelegramUpdate(imageUpdate({ updateId: String(10 + offset), messageId: String(710 + offset), fileId, replyTo: card.providerMessageId, album: "album-1" }));
    }
    await makeAlbumsDue();
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
    expect(fakes.callbacks.filter(({ callbackId }) => callbackId === "album-choice"))
      .toEqual([{ callbackId: "album-choice", text: "Обробляємо зображення." }]);
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
    await makeAlbumsDue();
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
    await deleteOccurrence(client, alternateOccurrenceId);
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
    // 6b619ef moved the quota preflight AHEAD of the provider download, so a
    // duplicate is refused before a byte is fetched. The preflight is right;
    // the expectation predated it.
    expect(fakes.downloads).toEqual([]); expect(await attachmentsFor(["730"])).toMatchObject([{ state: "failed", provider_file_id: null }]);
    // Four outbound texts, each one the design asks for (2026-08-28 §8.3: the
    // bot reports an exact failure such as unsupported type or the provider
    // download limit, and reports `processing` before a quota refusal). The
    // count of two was written on 2026-08-29 (49ab4ce), when only the ready
    // path spoke; terminal receipts for not_evidence attachments arrived with
    // 0070 (9936e5f) the day after. The second, duplicate update converges:
    // nothing is added for it.
    const outbound = await client.query<{ text: string }>(`select m.text
      from public.communication_messages m
      where m.workspace_id=$1 and m.direction='outbound' and m.kind='text' order by m.created_at`, [rules.workspaceId]);
    expect(outbound.rows.map(({ text }) => text)).toEqual([
      "Доказ не збережено.\nЗображення 729: не збережено — unsupported_media.",
      "Доказ не збережено.\nЗображення 728: не збережено — unsupported_media.",
      "Зображення обробляється. Підтвердження буде надіслано після збереження доказу.",
      "Доказ не збережено.\nЗображення 730: не збережено — upload_size_limit.",
    ]);
    await client.query("update public.organizations set evidence_quota_bytes=null where id=$1", [rules.workspaceId]);
    await client.query("update public.telegram_member_links set revoked_at=now() where workspace_id=$1", [rules.workspaceId]);
    fakes.payloads.set("revoked", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "31", messageId: "731", fileId: "revoked", replyTo: card.providerMessageId }));
    // A revoked link replying to a LIVE card is refused evidence, not filed
    // as unbound: design §11 «Unlinked participant — mirror the message as
    // unverified communication; refuse evidence», and §8.3 reserves `unbound`
    // for an image not replying to a live assignment card. The card-exists
    // branch (evidence.ts, `card.rows[0] ? "evidence_authorization_failed" :
    // "unbound_card_reply"`) landed with a145414 on 2026-08-31, after this
    // case was written; the grants case in this file pins the same outcome.
    expect(fakes.downloads).toEqual([]); expect(await attachmentsFor(["731"])).toMatchObject([{
      state: "not_evidence", failure_code: "evidence_authorization_failed", provider_file_id: null,
    }]);
  });

  it("terminalizes and reports all-unsupported and mixed albums without orphaned handles", async () => {
    await deleteOccurrence(client, alternateOccurrenceId);
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
      .toEqual(["telegram.evidence.failed", "telegram.evidence.partial"]);
  });

  it("persists every multi-chunk partial outcome once across group replay", async () => {
    await deleteOccurrence(client, alternateOccurrenceId);
    const card = await deliverCard(); fakes.payloads.set("chunk-image", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "64", messageId: "764", fileId: "chunk-image", replyTo: card.providerMessageId, album: "chunk-album" }));
    await processTelegramUpdate(documentUpdate({ updateId: "65", messageId: "765", fileId: "chunk-pdf", replyTo: card.providerMessageId, album: "chunk-album" }));
    await makeAlbumsDue(); await processDueTelegramMediaGroups();
    const group = (await client.query<{ id: string; processing_generation: string }>(
      `select id, processing_generation::text from public.telegram_media_groups
        where workspace_id=$1 and provider_media_group_id='chunk-album'`, [rules.workspaceId],
    )).rows[0]!;

    await client.query(`with inserted_messages as (
      insert into public.communication_messages (
        workspace_id, project_id, telegram_chat_binding_id, direction, kind,
        author_member_id, provider_user_id, provider_message_id,
        provider_reply_to_message_id, delivery_state, server_received_at, created_at
      )
      select $1, $2, $3, 'inbound', 'document', $4, $5::bigint,
             900000 + part, $6::bigint, 'received',
             now() - interval '4 seconds', now() - interval '4 seconds'
        from generate_series(1, 90) part
      returning id
    )
    insert into public.communication_attachments (
      workspace_id, project_id, message_id, telegram_media_group_id,
      filename_snapshot, media_type_snapshot, byte_size, state,
      failure_code, terminal_at, created_at
    )
    select $1, $2, id, $7, 'unsupported.pdf', 'application/pdf', 11,
           'not_evidence', 'unsupported_media', now(), now() - interval '4 seconds'
      from inserted_messages`, [
      rules.workspaceId, rules.projectId, bindingId, rules.memberId,
      UPLOADER_ID, card.providerMessageId, group.id,
    ]);
    await client.query(`update public.telegram_media_groups
      set last_part_at=now()-interval '3 seconds' where id=$1`, [group.id]);
    expect(await processDueTelegramMediaGroups()).toBe(1);

    const generation = Number(group.processing_generation) + 1;
    const chunks = (await client.query<{ id: string; telegram_evidence_chunk_index: number; text: string }>(
      `select id, telegram_evidence_chunk_index, text from public.communication_messages
        where workspace_id=$1 and telegram_evidence_source_media_group_id=$2
          and telegram_evidence_generation=$3 and telegram_evidence_copy_key='telegram.evidence.partial'
        order by telegram_evidence_chunk_index`, [rules.workspaceId, group.id, generation],
    )).rows;
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map(({ telegram_evidence_chunk_index }) => telegram_evidence_chunk_index))
      .toEqual(chunks.map((_, index) => index));
    const completeText = chunks.map(({ text }) => text).join("\n");
    for (let part = 1; part <= 90; part += 1) {
      expect(completeText.match(new RegExp(`Зображення ${900000 + part}:`, "g"))).toHaveLength(1);
    }
    const outboxBefore = Number((await client.query<{ count: string }>(
      `select count(*)::text from public.transaction_outbox
        where organization_id=$1 and aggregate_id=any($2::text[])`,
      [rules.workspaceId, chunks.map(({ id }) => id)],
    )).rows[0]!.count);
    expect(outboxBefore).toBe(chunks.length);

    await client.query(`update public.telegram_media_groups
      set state='open', completed_at=null where id=$1`, [group.id]);
    expect(await processDueTelegramMediaGroups()).toBe(1);
    const replayed = (await client.query<{ id: string }>(
      `select id from public.communication_messages
        where workspace_id=$1 and telegram_evidence_source_media_group_id=$2
          and telegram_evidence_generation=$3 and telegram_evidence_copy_key='telegram.evidence.partial'`,
      [rules.workspaceId, group.id, generation],
    )).rows;
    expect(replayed).toHaveLength(chunks.length);
    expect(Number((await client.query<{ count: string }>(
      `select count(*)::text from public.transaction_outbox
        where organization_id=$1 and aggregate_id=any($2::text[])`,
      [rules.workspaceId, replayed.map(({ id }) => id)],
    )).rows[0]!.count)).toBe(chunks.length);
  });

  it("reopens a claimed generation for a late part and reclaims an expired lease", async () => {
    await deleteOccurrence(client, alternateOccurrenceId);
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

  it("fences an expired prepared album worker and lets the new claimant recover every part", async () => {
    await deleteOccurrence(client, alternateOccurrenceId);
    const card = await deliverCard(); fakes.payloads.set("fenced-a", JPEG); fakes.payloads.set("fenced-b", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "72", messageId: "772", fileId: "fenced-a", replyTo: card.providerMessageId, album: "fenced-album" }));
    await processTelegramUpdate(imageUpdate({ updateId: "73", messageId: "773", fileId: "fenced-b", replyTo: card.providerMessageId, album: "fenced-album" }));
    await makeAlbumsDue();
    // The two timestamps go back into equality fences (`processing_lease_expires_at=$5`,
    // `claimed_last_part_at=$4` in prepareTelegramEvidenceCandidate). Read with
    // `select *`, node-pg returns them as Dates with millisecond precision, the
    // microseconds Postgres stored are gone, and the fence at evidence.ts's
    // «current» lookup matched nothing — so this case's first `prepare` came
    // back `album_pending` before any of the fencing it exists to prove ran.
    // Text keeps every digit; it is how the processor reads the same claim.
    const claim = (await asService<{
      id: string; lease_token: string; lease_expires_at: string; processing_generation: string; claimed_last_part_at: string;
    }>("", null, (service) => service.query(`select id, lease_token::text, lease_expires_at::text,
      processing_generation::text, claimed_last_part_at::text from app.claim_telegram_media_groups(1,60)`))).rows[0]!;
    const first = (await client.query<{ id: string }>(`select a.id from public.communication_attachments a
      join public.communication_messages m on m.id=a.message_id where a.telegram_media_group_id=$1
      order by m.provider_message_id limit 1`, [claim.id])).rows[0]!;
    const prepared = await prepareTelegramEvidenceCandidate({
      workspaceId: rules.workspaceId, projectId: rules.projectId, telegramChatBindingId: bindingId,
      messageId: card.id, attachmentId: first.id, senderId: UPLOADER_ID,
      replyToProviderMessageId: card.providerMessageId, mediaGroupId: "fenced-album",
      telegramMediaGroupId: claim.id, allowMediaGroup: true,
      albumClaim: { leaseToken: claim.lease_token, leaseExpiresAt: claim.lease_expires_at,
        generation: Number(claim.processing_generation), claimedLastPartAt: claim.claimed_last_part_at },
      file: { kind: "photo", fileId: "fenced-a", fileUniqueId: "fenced-a-unique", fileName: null,
        mimeType: "image/jpeg", fileSize: JPEG.byteLength, width: 1, height: 1 },
    });
    expect(prepared.kind).toBe("ready");
    // One statement per query (the extended protocol parses exactly one
    // command; two raise 42601 before either runs — same as the anchor fixture).
    await client.query("update public.telegram_media_groups set processing_lease_expires_at=now()-interval '1 second' where id=$1", [claim.id]);
    await client.query(`update public.communication_attachments set provider_retry_lease_expires_at=now()-interval '1 second'
       where telegram_media_group_id=$1 and state='processing'`, [claim.id]);
    const replacement = (await asService<{ lease_token: string }>("", null, (service) => service.query(
      "select lease_token::text from app.claim_telegram_media_groups(1,60)",
    ))).rows[0]!;
    const stalePrepared = await prepareTelegramEvidenceCandidate({
      workspaceId: rules.workspaceId, projectId: rules.projectId, telegramChatBindingId: bindingId,
      messageId: card.id, attachmentId: first.id, senderId: UPLOADER_ID,
      replyToProviderMessageId: card.providerMessageId, mediaGroupId: "fenced-album",
      telegramMediaGroupId: claim.id, allowMediaGroup: true,
      albumClaim: { leaseToken: claim.lease_token, leaseExpiresAt: claim.lease_expires_at,
        generation: Number(claim.processing_generation), claimedLastPartAt: claim.claimed_last_part_at },
      file: { kind: "photo", fileId: "fenced-a", fileUniqueId: "fenced-a-unique", fileName: null,
        mimeType: "image/jpeg", fileSize: JPEG.byteLength, width: 1, height: 1 },
    });
    expect(stalePrepared).toEqual({ kind: "not_evidence", code: "album_pending" });
    const stale = await asService<{ settled: boolean }>("", null, (service) => service.query(
      `select app.settle_telegram_evidence_attachment($1,$2,'failed',null,'stale_worker',$3,$2,$4,$5,$6) as settled`,
      [first.id, claim.lease_token, claim.id, claim.lease_expires_at, claim.processing_generation, claim.claimed_last_part_at],
    ));
    expect(stale.rows[0]!.settled).toBe(false);
    expect(replacement.lease_token).not.toBe(claim.lease_token);
    await client.query("update public.telegram_media_groups set processing_lease_expires_at=now()-interval '1 second' where id=$1", [claim.id]);
    expect(await processDueTelegramMediaGroups()).toBe(1);
    expect((await attachmentsFor(["772", "773"])).every(({ state }) => state === "available")).toBe(true);
  });

  it("rejects stale retry ownership and unrelated receipt assignments", async () => {
    const terminal = imageUpdate({ updateId: "82", messageId: "782", fileId: "assignment-source", replyTo: null });
    await processTelegramUpdate(terminal);
    const attachment = (await client.query<{ id: string }>(`select a.id from public.communication_attachments a
      join public.communication_messages m on m.id=a.message_id where m.provider_message_id=782`, [])).rows[0]!;
    await expect(asService("", null, (service) => service.query(
      `select app.enqueue_telegram_evidence_receipt($1,$2,$3,$4,$5,null,'telegram.evidence.unbound',0,0,$6,null,null,null)`,
      [rules.workspaceId, rules.projectId, bindingId, crypto.randomUUID(), attachment.id,
        "Фото не прив’язано до чинної картки завдання та залишено лише в історії чату."],
    ))).rejects.toThrow(/assignment mismatch/);

    const oldToken = crypto.randomUUID(); const newToken = crypto.randomUUID();
    await client.query(`update public.communication_attachments set state='processing',terminal_at=null,
      failure_code=null,provider_file_id='stolen',provider_retry_lease_token=$2,
      provider_retry_lease_expires_at=now()+interval '60 seconds' where id=$1`, [attachment.id, newToken]);
    const stale = await asService<{ settled: boolean }>("", null, (service) => service.query(
      "select app.settle_telegram_evidence_attachment($1,$2,'failed',null,'stale_retry',null,null,null,null,null) as settled",
      [attachment.id, oldToken],
    ));
    expect(stale.rows[0]!.settled).toBe(false);
    expect((await client.query<{ provider_file_id: string | null }>(
      "select provider_file_id from public.communication_attachments where id=$1", [attachment.id],
    )).rows[0]!.provider_file_id).toBe("stolen");
  });

  it("recovers direct processing-orphan replay and terminal-before-receipt replay", async () => {
    await deleteOccurrence(client, alternateOccurrenceId);
    const card = await deliverCard(); fakes.payloads.set("orphan", JPEG);
    const orphanUpdate = imageUpdate({ updateId: "83", messageId: "783", fileId: "orphan", replyTo: card.providerMessageId });
    const messageId = (await client.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id,project_id,telegram_chat_binding_id,direction,kind,author_member_id,provider_user_id,
       provider_message_id,provider_reply_to_message_id,delivery_state)
      values ($1,$2,$3,'inbound','photo',$4,$5,783,$6,'received') returning id`,
    [rules.workspaceId, rules.projectId, bindingId, rules.memberId, UPLOADER_ID, card.providerMessageId])).rows[0]!.id;
    const attachmentId = (await client.query<{ id: string }>(`insert into public.communication_attachments
      (workspace_id,project_id,message_id,provider_file_id,provider_file_unique_id,media_type_snapshot,byte_size,state)
      values ($1,$2,$3,'orphan','orphan-unique','image/jpeg',$4,'staged') returning id`,
    [rules.workspaceId, rules.projectId, messageId, JPEG.byteLength])).rows[0]!.id;
    const prepared = await prepareTelegramEvidenceCandidate({
      workspaceId: rules.workspaceId, projectId: rules.projectId, telegramChatBindingId: bindingId,
      messageId, attachmentId, senderId: UPLOADER_ID, replyToProviderMessageId: card.providerMessageId,
      mediaGroupId: null, file: { kind: "photo", fileId: "orphan", fileUniqueId: "orphan-unique",
        fileName: null, mimeType: "image/jpeg", fileSize: JPEG.byteLength, width: 1, height: 1 },
    });
    expect(prepared.kind).toBe("ready");
    await client.query("update public.communication_attachments set provider_retry_lease_expires_at=now()-interval '1 second' where id=$1", [attachmentId]);
    await processTelegramUpdate(orphanUpdate);
    expect(await attachmentsFor(["783"])).toMatchObject([{ state: "available", provider_file_id: null }]);

    const terminalMessage = (await client.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id,project_id,telegram_chat_binding_id,direction,kind,author_member_id,provider_user_id,provider_message_id,delivery_state)
      values ($1,$2,$3,'inbound','photo',$4,$5,784,'received') returning id`,
    [rules.workspaceId, rules.projectId, bindingId, rules.memberId, UPLOADER_ID])).rows[0]!.id;
    await client.query(`insert into public.communication_attachments
      (workspace_id,project_id,message_id,state,failure_code,terminal_at)
      values ($1,$2,$3,'unbound','unbound_card_reply',now())`, [rules.workspaceId, rules.projectId, terminalMessage]);
    await processTelegramUpdate(imageUpdate({ updateId: "84", messageId: "784", fileId: "terminal-replay", replyTo: null }));
    expect((await receiptRows()).filter(({ text }) => text.includes("не прив’язано"))).toHaveLength(1);
  });

  it("denies revoked, future, and expired evidence grants before choice or download", async () => {
    const card = await deliverCard();
    const cases = [
      ["revoked", "update public.project_access_grants set revoked_at=now() where workspace_id=$1 and capability='evidence.record'"],
      ["future", "update public.project_access_grants set revoked_at=null,valid_from=now()+interval '1 day',valid_until=null where workspace_id=$1 and capability='evidence.record'"],
      ["expired", "update public.project_access_grants set revoked_at=null,valid_from=now()-interval '2 days',valid_until=now()-interval '1 day' where workspace_id=$1 and capability='evidence.record'"],
    ] as const;
    for (const [index, [name, sql]] of cases.entries()) {
      await client.query(sql, [rules.workspaceId]); fakes.payloads.set(name, JPEG);
      await processTelegramUpdate(imageUpdate({ updateId: String(90 + index), messageId: String(7900 + index),
        fileId: name, replyTo: card.providerMessageId }));
    }
    expect(fakes.downloads).toEqual([]);
    expect((await attachmentsFor(["7900", "7901", "7902"])).every((row) =>
      row.state === "not_evidence" && row.failure_code === "evidence_authorization_failed" && row.provider_file_id === null)).toBe(true);
    expect((await receiptRows()).filter(({ telegram_evidence_copy_key }) =>
      telegram_evidence_copy_key === "telegram.evidence.failed")).toHaveLength(3);
    expect((await client.query<{ count: string }>(`select count(*)::text from public.telegram_requirement_choice_sessions
      where workspace_id=$1`, [rules.workspaceId])).rows[0]!.count).toBe("0");
  });

  it("authorizes every album part against the same card anchor and uploader", async () => {
    await deleteOccurrence(client, alternateOccurrenceId);
    const card = await deliverCard(); const otherCard = await deliverCard();
    const secondUser = crypto.randomUUID(); const secondMember = crypto.randomUUID(); const secondSender = "902";
    // One statement per query. A parameterised call goes through the extended
    // protocol, which parses exactly one command — four semicolon-separated
    // statements raise 42601 before any of them runs.
    await client.query(`insert into auth.users (id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
      values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,'',now(),now())`,
    [secondUser, `${secondUser}@fixture.test`]);
    await client.query(`insert into public.memberships (id,organization_id,user_id,role,status)
      values ($1,$2,$3,'member','active')`, [secondMember, rules.workspaceId, secondUser]);
    await client.query(`insert into public.project_access_grants (workspace_id,project_id,member_id,capability,granted_by)
      values ($1,$2,$3,'evidence.record',$4)`, [rules.workspaceId, rules.projectId, secondMember, secondUser]);
    await client.query(`insert into public.telegram_member_links (workspace_id,member_id,telegram_user_id,linked_by_member_id)
      values ($1,$2,$3::bigint,$2)`, [rules.workspaceId, secondMember, secondSender]);
    for (const fileId of ["anchor-ok", "anchor-none", "anchor-other", "uploader-other"]) fakes.payloads.set(fileId, JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "100", messageId: "800", fileId: "anchor-ok", replyTo: card.providerMessageId, album: "anchor-album" }));
    await processTelegramUpdate(imageUpdate({ updateId: "101", messageId: "801", fileId: "anchor-none", replyTo: null, album: "anchor-album" }));
    await processTelegramUpdate(imageUpdate({ updateId: "102", messageId: "802", fileId: "anchor-other", replyTo: otherCard.providerMessageId, album: "anchor-album" }));
    await processTelegramUpdate(imageUpdate({ updateId: "103", messageId: "803", fileId: "uploader-other", replyTo: card.providerMessageId, album: "anchor-album", senderId: secondSender }));
    await makeAlbumsDue(); expect(await processDueTelegramMediaGroups()).toBe(1);
    expect(fakes.downloads).toEqual(["anchor-ok"]);
    const outcomes = await attachmentsFor(["800", "801", "802", "803"]);
    expect(outcomes.find((row) => row.state === "available")).toBeTruthy();
    expect(await attachmentsFor(["801"])).toMatchObject([{ state: "unbound", failure_code: "unbound_card_reply" }]);
    expect(outcomes.map(({ failure_code }) => failure_code)).toEqual(expect.arrayContaining([
      null, "unbound_card_reply", "album_anchor_mismatch", "album_uploader_mismatch",
    ]));
    expect(outcomes.every(({ provider_file_id }) => provider_file_id === null)).toBe(true);
    const partial = (await receiptRows()).filter(({ telegram_evidence_copy_key }) => telegram_evidence_copy_key === "telegram.evidence.partial");
    expect(partial).toHaveLength(1);
    expect(partial[0]!.text).toContain("unbound_card_reply");
    expect(partial[0]!.text).toContain("album_anchor_mismatch");
    expect(partial[0]!.text).toContain("album_uploader_mismatch");
  });

  it("reports a previously-terminal album with mismatched common context as safe failure", async () => {
    const card = await deliverCard();
    await processTelegramUpdate(documentUpdate({ updateId: "104", messageId: "804", fileId: "terminal-card", replyTo: card.providerMessageId, album: "terminal-context" }));
    await processTelegramUpdate(documentUpdate({ updateId: "105", messageId: "805", fileId: "terminal-no-card", replyTo: null, album: "terminal-context" }));
    await makeAlbumsDue();
    expect(await processDueTelegramMediaGroups()).toBe(1);
    expect(fakes.downloads).toEqual([]);
    expect(await attachmentsFor(["804", "805"])).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: "not_evidence", provider_file_id: null }),
      expect.objectContaining({ state: "not_evidence", provider_file_id: null }),
    ]));
    // Both parts are PDFs. The design keeps PDFs as communication and never
    // as evidence (2026-08-28, «Evidence media in the first release»), so each
    // part is terminal `unsupported_media` the moment it is stored — before
    // the album is claimed. The claim's context classification
    // (0071, app.claim_telegram_media_groups) runs only on parts still
    // `staged`, so nothing here is ever named `album_anchor_mismatch`; the
    // one safe failure receipt names each part with its exact, true reason.
    expect(await attachmentsFor(["804", "805"])).toMatchObject([
      { failure_code: "unsupported_media" }, { failure_code: "unsupported_media" },
    ]);
    const receipts = await receiptRows();
    expect(receipts.filter(({ telegram_evidence_copy_key }) => telegram_evidence_copy_key === "telegram.evidence.failed")).toHaveLength(1);
    expect(receipts.find(({ telegram_evidence_copy_key }) => telegram_evidence_copy_key === "telegram.evidence.failed")?.text)
      .toBe("Доказ не збережено.\nЗображення 804: не збережено — unsupported_media.\nЗображення 805: не збережено — unsupported_media.");
  });

  it("enqueues one canonical unbound receipt on replay and one uploader expiry receipt on repeated cleanup", async () => {
    const unbound = imageUpdate({ updateId: "80", messageId: "780", fileId: "unbound-replay", replyTo: null });
    await processTelegramUpdate(unbound); await processTelegramUpdate(unbound);
    let receipts = await receiptRows();
    expect(receipts.filter(({ telegram_evidence_copy_key }) => telegram_evidence_copy_key === "telegram.evidence.unbound")).toHaveLength(1);
    // The unbound receipt is queued for delivery like any outbound message.
    // deliverCard() below asserts the whole batch count, and that receipt was
    // still in the outbox when the card went out — so the card's batch
    // accepted two. Deliver the receipt first, and prove it is what went out.
    expect(await deliverTelegramOutboxBatch({ workerId: "telegram-evidence-unbound", limit: 10, apiClient: fakeTelegramApi() }))
      .toEqual({ accepted: 1, failed: 0, unknown: 0 });
    expect((await client.query<{ delivery_state: string }>(`select delivery_state from public.communication_messages
      where workspace_id=$1 and telegram_evidence_copy_key='telegram.evidence.unbound'`, [rules.workspaceId])).rows)
      .toEqual([{ delivery_state: "provider_accepted" }]);

    const card = await deliverCard(); fakes.payloads.set("choice-expiry", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "81", messageId: "781", fileId: "choice-expiry", replyTo: card.providerMessageId, album: "expiry-album" }));
    await makeAlbumsDue(); await processDueTelegramMediaGroups();
    // Age the whole session, not one column: the table's CHECK keeps
    // expires_at after created_at, so moving expires_at alone into the past is
    // refused (23514) and the case never reached the cleanup it is about.
    await client.query(`update public.telegram_requirement_choice_sessions
      set created_at=now()-interval '25 hours', expires_at=now()-interval '1 hour' where workspace_id=$1`, [rules.workspaceId]);
    await processDueTelegramMediaGroups(); await processDueTelegramMediaGroups();
    receipts = await receiptRows();
    const expired = receipts.filter(({ telegram_evidence_copy_key }) => telegram_evidence_copy_key === "telegram.evidence.choice_expired");
    expect(expired).toHaveLength(1);
    expect(expired[0]!.telegram_evidence_recipient_member_id).toBe(rules.memberId);
    expect(await attachmentsFor(["781"])).toMatchObject([{ state: "not_evidence", provider_file_id: null }]);
  });

  it("waits for retryable album parts, then completes once on retry success or exhaustion", async () => {
    await deleteOccurrence(client, alternateOccurrenceId);
    const card = await deliverCard();
    for (const [album, messageId, fileId] of [["retry-success", "790", "retry-once"], ["retry-exhaust", "791", "retry-always"]] as const) {
      fakes.payloads.set(fileId, JPEG); fakes.retryableDownloads.add(fileId);
      await processTelegramUpdate(imageUpdate({ updateId: messageId, messageId, fileId, replyTo: card.providerMessageId, album }));
    }
    await makeAlbumsDue(); await processDueTelegramMediaGroups();
    expect(await receiptRows()).toHaveLength(0);
    expect((await client.query<{ state: string }>("select state from public.telegram_media_groups where workspace_id=$1", [rules.workspaceId])).rows.every(({ state }) => state === "processing")).toBe(true);
    const scheduled = (await client.query<{ provider_retry_attempts: number; provider_next_retry_at: string | null; provider_file_id: string | null; provider_retry_lease_token: string | null }>(
      `select provider_retry_attempts, provider_next_retry_at::text, provider_file_id,
              provider_retry_lease_token::text from public.communication_attachments
        where workspace_id=$1 and provider_file_id in ('retry-once','retry-always') order by provider_file_id`,
      [rules.workspaceId],
    )).rows;
    expect(scheduled).toHaveLength(2);
    expect(scheduled.every((row) => row.provider_retry_attempts === 1
      && row.provider_next_retry_at !== null && row.provider_file_id !== null
      && row.provider_retry_lease_token === null)).toBe(true);

    fakes.retryableDownloads.delete("retry-once");
    await client.query("update public.communication_attachments set provider_next_retry_at=now() where workspace_id=$1", [rules.workspaceId]);
    await processDueTelegramEvidenceRetries();
    // The retry must be a real second download that succeeds — a receipt
    // alone would also be written for a retry refused before download.
    expect(fakes.downloads.filter((fileId) => fileId === "retry-once")).toHaveLength(2);
    expect(await attachmentsFor(["790"])).toMatchObject([{ state: "available", provider_file_id: null }]);
    expect((await receiptRows()).filter(({ text }) => text.includes("790")))
      .toMatchObject([{ telegram_evidence_copy_key: "telegram.evidence.complete" }]);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await client.query("update public.communication_attachments set provider_next_retry_at=now() where workspace_id=$1 and provider_file_id='retry-always'", [rules.workspaceId]);
      await processDueTelegramEvidenceRetries();
    }
    const terminal = await attachmentsFor(["791"]);
    expect(terminal).toMatchObject([{ state: "failed", provider_file_id: null }]);
    expect((await receiptRows()).filter(({ text }) => text.includes("791"))).toHaveLength(1);
  });

  it("does not download due retries after identity relink or delivered-card invalidation", async () => {
    await deleteOccurrence(client, alternateOccurrenceId);
    const firstCard = await deliverCard();
    fakes.payloads.set("retry-relinked", JPEG); fakes.retryableDownloads.add("retry-relinked");
    await processTelegramUpdate(imageUpdate({ updateId: "110", messageId: "810", fileId: "retry-relinked", replyTo: firstCard.providerMessageId }));
    expect(fakes.downloads).toEqual(["retry-relinked"]);

    const relinkedUser = crypto.randomUUID(); const relinkedMember = crypto.randomUUID();
    // Same reason as the anchor fixture above: one statement per query.
    await client.query(`insert into auth.users (id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
      values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,'',now(),now())`,
    [relinkedUser, `${relinkedUser}@fixture.test`]);
    await client.query(`insert into public.memberships (id,organization_id,user_id,role,status)
      values ($1,$2,$3,'member','active')`, [relinkedMember, rules.workspaceId, relinkedUser]);
    await client.query(`insert into public.project_access_grants (workspace_id,project_id,member_id,capability,granted_by)
      values ($1,$2,$3,'evidence.record',$4)`, [rules.workspaceId, rules.projectId, relinkedMember, relinkedUser]);
    await client.query(`update public.telegram_member_links set member_id=$1,linked_by_member_id=$1
      where workspace_id=$2 and telegram_user_id=$3::bigint`, [relinkedMember, rules.workspaceId, UPLOADER_ID]);
    await client.query(`update public.communication_attachments set provider_next_retry_at=now()
      where workspace_id=$1 and provider_file_id='retry-relinked'`, [rules.workspaceId]);
    await processDueTelegramEvidenceRetries();
    expect(fakes.downloads).toEqual(["retry-relinked"]);
    expect(await attachmentsFor(["810"])).toMatchObject([{
      state: "failed", failure_code: "evidence_authorization_failed", provider_file_id: null,
    }]);

    await client.query(`update public.telegram_member_links set member_id=$1,linked_by_member_id=$1
      where workspace_id=$2 and telegram_user_id=$3::bigint`, [rules.memberId, rules.workspaceId, UPLOADER_ID]);
    // 810's processing notice and its failure receipt are still queued;
    // deliverCard() asserts the whole batch, so deliver them first.
    expect(await deliverTelegramOutboxBatch({ workerId: "telegram-evidence-retry", limit: 10, apiClient: fakeTelegramApi() }))
      .toEqual({ accepted: 2, failed: 0, unknown: 0 });
    const staleCard = await deliverCard();
    fakes.payloads.set("retry-stale-card", JPEG); fakes.retryableDownloads.add("retry-stale-card");
    await processTelegramUpdate(imageUpdate({ updateId: "111", messageId: "811", fileId: "retry-stale-card", replyTo: staleCard.providerMessageId }));
    expect(fakes.downloads).toEqual(["retry-relinked", "retry-stale-card"]);
    // One statement per query, as everywhere else in this file.
    await client.query("update public.communication_messages set delivery_state='failed' where id=$1", [staleCard.id]);
    await client.query(`update public.communication_attachments set provider_next_retry_at=now()
       where workspace_id=$1 and provider_file_id='retry-stale-card'`, [rules.workspaceId]);
    await processDueTelegramEvidenceRetries();
    expect(fakes.downloads).toEqual(["retry-relinked", "retry-stale-card"]);
    expect(await attachmentsFor(["811"])).toMatchObject([{
      state: "failed", failure_code: "evidence_authorization_failed", provider_file_id: null,
    }]);
  });

  it("records a bridge-received photo with origin_not_distinguished on the intent and the evidence object (INV-086)", async () => {
    // The Telegram bridge is INV-086's second sender: evidence.ts builds the
    // preflight body and the CreateUploadIntentRequest with the literal and
    // carries no parameter through which another value could be routed. The
    // PWA sender is pinned in field-capture.int.test.ts; this pins the bridge
    // on both of its paths — a direct card reply and an album part — at the
    // persisted rows, not at the literal in the source.
    await deleteOccurrence(client, alternateOccurrenceId);
    const card = await deliverCard();
    fakes.payloads.set("origin-direct", JPEG); fakes.payloads.set("origin-album", JPEG);
    await processTelegramUpdate(imageUpdate({ updateId: "120", messageId: "820", fileId: "origin-direct", replyTo: card.providerMessageId }));
    await processTelegramUpdate(imageUpdate({ updateId: "121", messageId: "821", fileId: "origin-album", replyTo: card.providerMessageId, album: "origin-album" }));
    await makeAlbumsDue(); expect(await processDueTelegramMediaGroups()).toBe(1);
    const rows = (await client.query<{ provider_message_id: string; intent_origin: string; evidence_origin: string }>(
      `select m.provider_message_id::text, i.origin_method as intent_origin, e.origin_method as evidence_origin
         from public.communication_attachments a
         join public.communication_messages m on m.workspace_id=a.workspace_id and m.id=a.message_id
         join public.evidence_objects e on e.id=a.evidence_object_id
         join public.upload_intents i on i.id=e.upload_intent_id
        where a.workspace_id=$1 and a.state='available' order by m.provider_message_id`, [rules.workspaceId])).rows;
    expect(rows).toEqual([
      { provider_message_id: "820", intent_origin: "origin_not_distinguished", evidence_origin: "origin_not_distinguished" },
      { provider_message_id: "821", intent_origin: "origin_not_distinguished", evidence_origin: "origin_not_distinguished" },
    ]);
  });

  it("attempts one generic callback acknowledgement when context resolution throws", async () => {
    const result = await processTelegramUpdate({
      kind: "callback_query", updateId: "112", callbackId: "callback-db-error", senderId: UPLOADER_ID,
      chatId: "999999999999999999999999999999", messageId: "812", data: `req:${"a".repeat(43)}`,
    });
    expect(result).toBe("failed_requirement_choice");
    expect(fakes.callbacks.filter(({ callbackId }) => callbackId === "callback-db-error"))
      .toEqual([{ callbackId: "callback-db-error", text: "Не вдалося обробити вибір. Спробуйте ще раз." }]);
  });
});
