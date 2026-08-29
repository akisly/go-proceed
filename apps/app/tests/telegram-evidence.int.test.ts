import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { dropWorkspaces } from "../../../packages/testing/src/pg";
import { grantM2Capabilities, seedAssignment, seedM2World, type M2Fixture } from "../../../packages/testing/src/m2-fixture";
import { ADMIN_URL, hasIsolatedDatabaseCredentials } from "./helpers/fixtures";
import { prepareTelegramEvidenceCandidate } from "../src/lib/telegram/evidence";

const databaseDescribe = hasIsolatedDatabaseCredentials() ? describe : describe.skip;

databaseDescribe("Telegram evidence bridge", () => {
  let client: Client;
  let fixture: M2Fixture;
  let bindingId = "";
  let messageId = "";
  let attachmentId = "";

  beforeEach(async () => {
    client = new Client({ connectionString: ADMIN_URL });
    await client.connect();
    fixture = await seedM2World(client, {
      workspaceId: crypto.randomUUID(), userId: crypto.randomUUID(), email: "telegram-evidence@example.test", suffix: "TG-EVIDENCE",
    });
    await grantM2Capabilities(client, fixture);
    await seedAssignment(client, fixture);
    await client.query(`insert into public.project_field_channels
      (workspace_id, project_id, channel, state, locked_at, locked_by_member_id, last_healthy_at)
      values ($1,$2,'telegram','active',now(),$3,now())`, [fixture.workspaceId, fixture.projectId, fixture.memberId]);
    [bindingId] = (await client.query<{ id: string }>(`insert into public.telegram_chat_bindings
      (workspace_id, project_id, bot_id, chat_id, chat_type, connected_by_member_id)
      values ($1,$2,123456789,-100991,'supergroup',$3) returning id`,
    [fixture.workspaceId, fixture.projectId, fixture.memberId])).rows.map(({ id }) => id);
    [messageId] = (await client.query<{ id: string }>(`insert into public.communication_messages
      (workspace_id, project_id, telegram_chat_binding_id, direction, kind, provider_user_id,
       provider_message_id, delivery_state)
      values ($1,$2,$3,'inbound','photo',901,701,'received') returning id`,
    [fixture.workspaceId, fixture.projectId, bindingId])).rows.map(({ id }) => id);
    [attachmentId] = (await client.query<{ id: string }>(`insert into public.communication_attachments
      (workspace_id, project_id, message_id, provider_file_id, provider_file_unique_id,
       media_type_snapshot, byte_size, state)
      values ($1,$2,$3,'unbound-file','unbound-unique','image/jpeg',3,'staged') returning id`,
    [fixture.workspaceId, fixture.projectId, messageId])).rows.map(({ id }) => id);
  });

  afterEach(async () => {
    if (fixture?.workspaceId) await dropWorkspaces(client, [fixture.workspaceId]);
    await client.end();
  });

  it("makes a no-card image terminal communication before any provider download", async () => {
    // Break caught: resolving a project from an image alone would download
    // ordinary group media and let it become evidence without its card anchor.
    const prepared = await prepareTelegramEvidenceCandidate({
      workspaceId: fixture.workspaceId, projectId: fixture.projectId, telegramChatBindingId: bindingId,
      messageId, attachmentId, senderId: "901", replyToProviderMessageId: null, mediaGroupId: null,
      file: { kind: "photo", fileId: "unbound-file", fileUniqueId: "unbound-unique", fileName: null,
        mimeType: "image/jpeg", fileSize: 3, width: 1, height: 1 },
    });
    expect(prepared).toEqual({ kind: "not_evidence", code: "unbound_card_reply" });
    const attachment = await client.query<{ state: string; provider_file_id: string | null; provider_file_unique_id: string | null }>(
      "select state, provider_file_id, provider_file_unique_id from public.communication_attachments where id=$1", [attachmentId],
    );
    expect(attachment.rows[0]).toEqual({ state: "unbound", provider_file_id: null, provider_file_unique_id: null });
  });
});
