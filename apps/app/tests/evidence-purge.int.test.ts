import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { q, truncateAll, jsonReq, matrixFixture, type MatrixFixture } from "./helpers/fixtures";
import { putObject, objectExists } from "../src/lib/evidence-storage";
import { expireUploadIntents, drainEvidencePurge } from "../src/lib/evidence-purge";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const CAPS = ["assignments.manage", "evidence.record"] as const;
const PRICED = "1.1;Мурування;м2;10;199,99;1 999,90";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9, 0x00]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00, 0xc9, 0xfe, 0x92, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const hashOf = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

let fx: MatrixFixture;
let assignmentId: string;

async function assign(f: MatrixFixture): Promise<string> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x", { workItemId: f.bySourceKey["1.1"]!.id }),
    { params: Promise.resolve({ contractId: f.contractId }) });
  return (await res.json()).assignmentId as string;
}

async function stagedIntent(bytes = JPEG, mediaType = "image/jpeg") {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/upload-intents/route");
  const res = await POST(jsonReq("http://x", {
    expectedContentHash: hashOf(bytes), expectedByteSize: bytes.byteLength,
    claimedMediaType: mediaType, deviceCaptureId: "device-1",
    originMethod: "native_camera",
  }), { params: Promise.resolve({ assignmentId }) });
  const intent = await res.json();
  await putObject(intent.storage.key, bytes, mediaType);
  return intent;
}

async function finalize(intentId: string): Promise<Response> {
  const { POST } = await import("../app/v1/upload-intents/[intentId]/finalize/route");
  return POST(jsonReq("http://x", {}), { params: Promise.resolve({ intentId }) });
}

const statusOf = async (id: string) =>
  (await q<{ status: string; purged_at: Date | null; purge_attempts: number;
             purge_failure: string | null }>(
    `select status, purged_at, purge_attempts, purge_failure
       from public.upload_intents where id = $1`, [id]))[0]!;

beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await matrixFixture(A, {
    taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
  });
  assignmentId = await assign(fx);
});

describe("expiry sweep", () => {
  it("expires an intent whose window closed without a finalize", async () => {
    const intent = await stagedIntent();
    await q(`update public.upload_intents set expires_at = now() - interval '1 hour'
              where id = $1`, [intent.uploadIntentId]);

    expect(await expireUploadIntents()).toBeGreaterThanOrEqual(1);
    const row = await statusOf(intent.uploadIntentId);
    expect(row.status).toBe("expired");
  });

  it("leaves a live intent alone", async () => {
    const intent = await stagedIntent();
    await expireUploadIntents();
    expect((await statusOf(intent.uploadIntentId)).status).toBe("intent_authorized");
  });

  it("never expires an available intent", async () => {
    const intent = await stagedIntent();
    await finalize(intent.uploadIntentId);
    await q(`update public.upload_intents set expires_at = now() - interval '1 hour'
              where id = $1`, [intent.uploadIntentId]);

    await expireUploadIntents();
    expect((await statusOf(intent.uploadIntentId)).status).toBe("available");
  });
});

describe("purge worker", () => {
  it("deletes the bytes behind an expired intent", async () => {
    const intent = await stagedIntent();
    await q(`update public.upload_intents set expires_at = now() - interval '1 hour'
              where id = $1`, [intent.uploadIntentId]);
    await expireUploadIntents();

    expect(await objectExists(intent.storage.key)).toBe(true);
    const outcome = await drainEvidencePurge();
    expect(outcome.purged).toBeGreaterThanOrEqual(1);

    expect(await objectExists(intent.storage.key)).toBe(false);
    expect((await statusOf(intent.uploadIntentId)).purged_at).not.toBeNull();
  });

  it("deletes the bytes behind an intent orphaned by revocation (INV-047)", async () => {
    const intent = await stagedIntent();
    await q(
      `update public.project_access_grants set revoked_at = now()
        where workspace_id = $1 and member_id = $2 and capability = 'evidence.record'`,
      [fx.workspaceId, fx.memberId]);
    await finalize(intent.uploadIntentId);
    expect((await statusOf(intent.uploadIntentId)).status).toBe("orphaned_for_purge");

    await drainEvidencePurge();
    expect(await objectExists(intent.storage.key)).toBe(false);
  });

  it("never touches bytes that became evidence", async () => {
    const intent = await stagedIntent();
    await finalize(intent.uploadIntentId);

    await expireUploadIntents();
    const outcome = await drainEvidencePurge();
    expect(outcome.claimed).toBe(0);
    expect(await objectExists(intent.storage.key)).toBe(true);
  });

  it("leaves scan-blocked content alone inside its retention window", async () => {
    // Blocked content follows restricted retention, which is a different policy
    // from "the caller never came back" — a shorter window would delete a file
    // captured on Friday before anyone reported it on Monday.
    const intent = await stagedIntent(PNG, "image/jpeg");
    await finalize(intent.uploadIntentId);
    expect((await statusOf(intent.uploadIntentId)).status).toBe("scan_blocked");

    await expireUploadIntents();
    const outcome = await drainEvidencePurge();
    expect(outcome.claimed).toBe(0);
    expect(await objectExists(intent.storage.key)).toBe(true);
  });

  it("purges scan-blocked content once its window closes, keeping the record", async () => {
    const intent = await stagedIntent(PNG, "image/jpeg");
    await finalize(intent.uploadIntentId);
    const blocked = await statusOf(intent.uploadIntentId);
    expect(blocked.status).toBe("scan_blocked");

    // Eight days after the block, one past the seven-day default.
    await q(`update public.upload_intents set blocked_at = now() - interval '8 days'
              where id = $1`, [intent.uploadIntentId]);

    const outcome = await drainEvidencePurge();
    expect(outcome.purged).toBe(1);
    expect(await objectExists(intent.storage.key)).toBe(false);

    // The content goes; what happened does not. The failure stays diagnosable
    // after the bytes are gone.
    const after = await statusOf(intent.uploadIntentId);
    expect(after.status).toBe("scan_blocked");
    expect(after.purged_at).not.toBeNull();
    const detail = await q<{ failure_code: string; expected_content_hash: string }>(
      `select failure_code, expected_content_hash from public.upload_intents
        where id = $1`, [intent.uploadIntentId]);
    expect(detail[0]!.failure_code).toBe("declared_type_mismatch");
    expect(detail[0]!.expected_content_hash).toBeTruthy();
  });

  it("honours a workspace's own retention window", async () => {
    await q(`update public.organizations set blocked_content_retention_days = 30
              where id = $1`, [fx.workspaceId]);
    const intent = await stagedIntent(PNG, "image/jpeg");
    await finalize(intent.uploadIntentId);
    await q(`update public.upload_intents set blocked_at = now() - interval '8 days'
              where id = $1`, [intent.uploadIntentId]);

    // Eight days is past the default and well inside thirty.
    expect((await drainEvidencePurge()).claimed).toBe(0);
    expect(await objectExists(intent.storage.key)).toBe(true);
  });

  it("is idempotent: a second run claims nothing and deletes nothing", async () => {
    const intent = await stagedIntent();
    await q(`update public.upload_intents set expires_at = now() - interval '1 hour'
              where id = $1`, [intent.uploadIntentId]);
    await expireUploadIntents();
    await drainEvidencePurge();

    const second = await drainEvidencePurge();
    expect(second.claimed).toBe(0);
    expect(second.failed).toBe(0);
  });

  it("purges an intent whose bytes were never uploaded", async () => {
    // Removing an absent object must not be an error, or one abandoned capture
    // would wedge the queue.
    const { POST } = await import("../app/v1/assignments/[assignmentId]/upload-intents/route");
    const res = await POST(jsonReq("http://x", {
      expectedContentHash: hashOf(JPEG), expectedByteSize: JPEG.byteLength,
      claimedMediaType: "image/jpeg", deviceCaptureId: "never-sent",
      originMethod: "native_camera",
    }), { params: Promise.resolve({ assignmentId }) });
    const intent = await res.json();

    await q(`update public.upload_intents set expires_at = now() - interval '1 hour'
              where id = $1`, [intent.uploadIntentId]);
    await expireUploadIntents();
    const outcome = await drainEvidencePurge();
    expect(outcome.purged).toBe(1);
    expect(outcome.failed).toBe(0);
  });

  it("keeps a failed delete claimable and records why", async () => {
    // Driven through the failure path directly rather than by hoping the
    // storage service rejects some contrived key: a test that passes whichever
    // way the dependency behaves asserts nothing.
    const intent = await stagedIntent();
    await q(`update public.upload_intents set expires_at = now() - interval '1 hour'
              where id = $1`, [intent.uploadIntentId]);
    await expireUploadIntents();

    const claimed = await q<{ upload_intent_id: string }>(
      `select * from public.claim_upload_purge(50)`);
    expect(claimed.map((r) => r.upload_intent_id)).toContain(intent.uploadIntentId);
    // Claiming spends no retry budget: a worker that dies here attempted
    // nothing, and burning an attempt for that was how a row could be excluded
    // permanently with no failure ever recorded (0024).
    expect(Number((await statusOf(intent.uploadIntentId)).purge_attempts)).toBe(0);

    await q(`select public.fail_upload_purge($1,$2)`,
      [intent.uploadIntentId, "storage unavailable"]);

    const failed = await statusOf(intent.uploadIntentId);
    expect(failed.purged_at).toBeNull();
    expect(failed.purge_failure).toBe("storage unavailable");

    // Released, so the next run picks it up again instead of stranding the bytes.
    const again = await q<{ upload_intent_id: string }>(
      `select * from public.claim_upload_purge(50)`);
    expect(again.map((r) => r.upload_intent_id)).toContain(intent.uploadIntentId);
    expect(await objectExists(intent.storage.key)).toBe(true);
  });

  it("marks purged only after the delete returns", async () => {
    const intent = await stagedIntent();
    await q(`update public.upload_intents set expires_at = now() - interval '1 hour'
              where id = $1`, [intent.uploadIntentId]);
    await expireUploadIntents();
    await q(`select * from public.claim_upload_purge(50)`);

    // Claimed but not completed: the bytes are still there and the row is not
    // done, which is what a crash mid-batch must look like.
    expect((await statusOf(intent.uploadIntentId)).purged_at).toBeNull();
    expect(await objectExists(intent.storage.key)).toBe(true);
  });

  it("stops claiming a row after five failed attempts so it stands as an alert", async () => {
    const intent = await stagedIntent();
    await q(`update public.upload_intents set expires_at = now() - interval '1 hour'
              where id = $1`, [intent.uploadIntentId]);
    await expireUploadIntents();
    await q(
      `update public.upload_intents set purge_attempts = 5, purge_failure = 'stuck'
        where id = $1`, [intent.uploadIntentId]);

    const outcome = await drainEvidencePurge();
    expect(outcome.claimed).toBe(0);
    expect((await statusOf(intent.uploadIntentId)).purged_at).toBeNull();
  });

  it("is not reachable from the member-facing database role", async () => {
    // Purging crosses tenants by nature, so goproceed_app must not be able to
    // trigger byte deletion in another workspace.
    const grants = await q<{ n: string }>(
      `select count(*) n from information_schema.role_routine_grants
        where grantee = 'goproceed_app'
          and routine_name in ('claim_upload_purge','complete_upload_purge',
                               'fail_upload_purge','expire_upload_intents')`);
    expect(grants[0]!.n).toBe("0");
  });

  it("spends the retry budget only on attempts that actually failed", async () => {
    const intent = await stagedIntent();
    await q(`update public.upload_intents set expires_at = now() - interval '1 hour'
              where id = $1`, [intent.uploadIntentId]);
    await expireUploadIntents();

    // Three claims with no worker outcome, standing in for three crashes.
    for (let i = 0; i < 3; i++) {
      await q(`select * from public.claim_upload_purge(50)`);
      await q(`update public.upload_intents set purge_claimed_at = null where id = $1`,
        [intent.uploadIntentId]);
    }
    expect(Number((await statusOf(intent.uploadIntentId)).purge_attempts)).toBe(0);

    // One real failure does cost a retry.
    await q(`select * from public.claim_upload_purge(50)`);
    await q(`select public.fail_upload_purge($1,$2)`,
      [intent.uploadIntentId, "storage unavailable"]);
    expect(Number((await statusOf(intent.uploadIntentId)).purge_attempts)).toBe(1);

    // And the bytes are still there to be retried.
    expect(await objectExists(intent.storage.key)).toBe(true);
  });

  it("refuses to purge when the database names no bucket", async () => {
    // Deleting from a guessed bucket reports success whether or not the bytes
    // were there, so the row would be marked purged while they survived.
    const intent = await stagedIntent();
    await q(`update public.upload_intents
                set expires_at = now() - interval '1 hour' where id = $1`,
      [intent.uploadIntentId]);
    await expireUploadIntents();
    await q(`update public.upload_intents set staging_bucket = null where id = $1`,
      [intent.uploadIntentId]);

    const outcome = await drainEvidencePurge();
    expect(outcome.failed).toBe(1);
    expect(outcome.purged).toBe(0);

    const row = await statusOf(intent.uploadIntentId);
    expect(row.purged_at).toBeNull();
    expect(row.purge_failure).toContain("bucket");
    expect(await objectExists(intent.storage.key)).toBe(true);
  });
});
