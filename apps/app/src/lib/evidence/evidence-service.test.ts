import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { dropWorkspaces } from "../../../../../packages/testing/src/pg";
import {
  seedAssignment, seedM2World, grantM2Capabilities, type M2Fixture,
} from "../../../../../packages/testing/src/m2-fixture";
import { putObject } from "../evidence-storage";
import { authorizeUploadIntent } from "./authorize-upload-intent";
import { finalizeUploadIntent } from "./finalize-upload-intent";

const databaseDescribe = process.env.APP_DB_URL && process.env.SERVICE_DB_URL && process.env.TEST_DB_ADMIN_URL
  ? describe
  : describe.skip;
const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9, 0x00]);
let actorUserId = "";

async function admin(): Promise<Client> {
  const client = new Client({ connectionString: process.env.TEST_DB_ADMIN_URL });
  await client.connect();
  return client;
}

databaseDescribe("shared evidence services", () => {
  let client: Client;
  let fixture: M2Fixture;
  let assignmentId = "";

  beforeEach(async () => {
    actorUserId = crypto.randomUUID();
    client = await admin();
    fixture = await seedM2World(client, {
      workspaceId: crypto.randomUUID(), userId: actorUserId, email: "unused@example.test", suffix: "EVIDENCE-SERVICE",
    });
    await grantM2Capabilities(client, fixture);
    assignmentId = await seedAssignment(client, fixture);
    await client.query(`insert into public.telegram_member_links
      (workspace_id, member_id, telegram_user_id, verified_at, linked_by_member_id)
      values ($1, $2, 81001, now(), $2)`, [fixture.workspaceId, fixture.memberId]);
  });

  afterEach(async () => {
    if (fixture?.workspaceId) await dropWorkspaces(client, [fixture.workspaceId]);
    await client.end();
  });

  it("authorizes and finalizes for a verified linked member", async () => {
    // Break caught: a Telegram-linked member could otherwise need a browser
    // session or take a subtly different authorization/finalization path.
    const contentHash = await crypto.subtle.digest("SHA-256", bytes);
    const authorized = await authorizeUploadIntent({
      actorUserId,
      requestId: crypto.randomUUID(),
      assignmentId,
      body: {
        expectedContentHash: Buffer.from(contentHash).toString("hex"),
        expectedByteSize: bytes.byteLength,
        claimedMediaType: "image/jpeg",
        deviceCaptureId: crypto.randomUUID(),
        originMethod: "origin_not_distinguished",
      },
      idempotencyKey: crypto.randomUUID(),
      requestHash: crypto.createHash("sha256").update(crypto.randomUUID()).digest("hex"),
    });
    const authorizedBody = authorized.body as { storage: { key: string }; uploadIntentId: string };
    await putObject(authorizedBody.storage.key, bytes, "image/jpeg");

    const finalized = await finalizeUploadIntent({
      actorUserId, requestId: crypto.randomUUID(), intentId: authorizedBody.uploadIntentId,
    });

    expect(finalized).toMatchObject({ status: 200, body: { status: "available" } });
  });
});
