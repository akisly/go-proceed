import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { Client } from "pg";
import {
  ADMIN_URL, hasIsolatedDatabaseCredentials, q, jsonReq, matrixFixture, type MatrixFixture,
} from "./helpers/fixtures";
import { dropWorkspaces } from "../../../packages/testing/src/pg";
import { putObject, objectExists, objectInfo, removeObject } from "../src/lib/evidence-storage";
import { setInspector, resetInspector, sniffMediaType } from "../src/lib/evidence-inspection";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const CAPS = ["assignments.manage", "evidence.record"] as const;
const PRICED = "1.1;Мурування;м2;10;199,99;1 999,90";

/** A minimal but genuine JPEG: SOI, a 1×1 baseline frame header, EOI, then a byte (DEV-033: the size check reads the frame). */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9, 0x00]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde]);
const hashOf = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

let fx: MatrixFixture;
let assignmentId: string;
let fixtureWorkspaceIds: string[] = [];

const databaseDescribe = hasIsolatedDatabaseCredentials() ? describe : describe.skip;

async function cleanupFixtureWorkspaces(): Promise<void> {
  if (fixtureWorkspaceIds.length === 0) return;
  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    const workspaceIds = [...new Set(fixtureWorkspaceIds)].reverse();
    const keys = await client.query<{ staging_storage_key: string }>(
      `select staging_storage_key from public.upload_intents
        where workspace_id = any($1::uuid[])`, [workspaceIds]);
    await Promise.all(keys.rows.map(({ staging_storage_key }) => removeObject(staging_storage_key)));
    await dropWorkspaces(client, workspaceIds);
  } finally {
    await client.end();
  }
}

async function assign(f: MatrixFixture): Promise<string> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x", { workItemId: f.bySourceKey["1.1"]!.id }),
    { params: Promise.resolve({ contractId: f.contractId }) });
  return (await res.json()).assignmentId as string;
}

async function createIntent(
  bytes: Uint8Array, mediaType = "image/jpeg", id = assignmentId,
  over: Record<string, unknown> = {},
) {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/upload-intents/route");
  const res = await POST(jsonReq("http://x", {
    expectedContentHash: hashOf(bytes), expectedByteSize: bytes.byteLength,
    claimedMediaType: mediaType, deviceCaptureId: "device-1",
    originMethod: "native_camera", ...over,
  }), { params: Promise.resolve({ assignmentId: id }) });
  if (res.status !== 201) throw new Error(`intent ${res.status} ${await res.text()}`);
  return await res.json();
}

async function finalize(intentId: string): Promise<Response> {
  const { POST } = await import("../app/v1/upload-intents/[intentId]/finalize/route");
  return POST(jsonReq("http://x", {}), { params: Promise.resolve({ intentId }) });
}

async function transcript(response: Response): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
  const body = await response.json() as Record<string, unknown>;
  const responseRequestId = response.headers.get("x-request-id");
  // Every response carries the request id in its header. A problem body
  // repeats it (packages/contracts' problem shape); a success body does not —
  // FinalizeUploadIntentResponse has no requestId field — so the equality is
  // asserted only where the body claims one.
  expect(responseRequestId).toBeTruthy();
  if ("requestId" in body) expect(body.requestId).toBe(responseRequestId);
  delete body.requestId;
  return {
    status: response.status,
    headers: Object.fromEntries([...response.headers].filter(([name]) => name !== "x-request-id")),
    body,
  };
}

/** Authorizes an intent and puts the bytes where finalize will look for them. */
async function staged(bytes: Uint8Array, mediaType = "image/jpeg") {
  const intent = await createIntent(bytes, mediaType);
  await putObject(intent.storage.key, bytes, mediaType);
  return intent;
}

beforeEach(async () => {
  fixtureWorkspaceIds = [];
  resetInspector();
  current = A;
  fx = await matrixFixture(A, {
    taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
  });
  fixtureWorkspaceIds.push(fx.workspaceId);
  assignmentId = await assign(fx);
});
afterEach(async () => {
  resetInspector();
  await cleanupFixtureWorkspaces();
});

databaseDescribe("content sniffing", () => {
  it("identifies the supported families from their bytes", () => {
    expect(sniffMediaType(JPEG)).toBe("image/jpeg");
    expect(sniffMediaType(PNG)).toBe("image/png");
    expect(sniffMediaType(new TextEncoder().encode("%PDF-1.7\n"))).toBe("application/pdf");
    expect(sniffMediaType(new TextEncoder().encode("just text"))).toBeNull();
  });
});

databaseDescribe("upload_intents.finalize", () => {
  it("creates the evidence object and marks the intent available", async () => {
    const intent = await staged(JPEG);
    const res = await finalize(intent.uploadIntentId);
    expect(res.status, await res.clone().text()).toBe(200);
    const body = await res.json();

    expect(body.status).toBe("available");
    expect(body.contentHash).toBe(hashOf(JPEG));
    expect(body.evidenceObjectId).toBeTruthy();

    const rows = await q<{
      storage_key: string; inspection_status: string; inspection_policy_version: string;
      media_type: string; relation_kind: string; capture_time_trust: string;
    }>(`select storage_key, inspection_status, inspection_policy_version, media_type,
               relation_kind, capture_time_trust
          from public.evidence_objects where workspace_id = $1 and id = $2`,
      [fx.workspaceId, body.evidenceObjectId]);
    // The key is the one issued at intent time: there is no promotion step.
    expect(rows[0]!.storage_key).toBe(intent.storage.key);
    expect(rows[0]!.inspection_status).toBe("passed");
    expect(rows[0]!.inspection_policy_version).toBe("m2a-magic-bytes-2");
    expect(rows[0]!.relation_kind).toBe("original");
  });

  it("labels claimed capture time and server receipt as separate facts", async () => {
    const intent = await createIntent(JPEG, "image/jpeg", assignmentId,
      { claimedCaptureTime: "2026-07-31T06:00:00+03:00", claimedTzOffset: "+03:00" });
    await putObject(intent.storage.key, JPEG, "image/jpeg");
    const body = await (await finalize(intent.uploadIntentId)).json();

    const rows = await q<{
      claimed_capture_time: Date; server_received_at: Date; capture_time_trust: string;
    }>(`select claimed_capture_time, server_received_at, capture_time_trust
          from public.evidence_objects where id = $1`, [body.evidenceObjectId]);
    expect(rows[0]!.capture_time_trust).toBe("device_claimed");
    expect(new Date(rows[0]!.claimed_capture_time).getTime())
      .not.toBe(new Date(rows[0]!.server_received_at).getTime());
  });

  it("returns the same receipt on replay and creates no second object", async () => {
    // Also the recovery path for a client whose local write failed after the
    // server had already confirmed.
    const intent = await staged(JPEG);
    const first = await (await finalize(intent.uploadIntentId)).json();
    const second = await (await finalize(intent.uploadIntentId)).json();

    expect(second.evidenceObjectId).toBe(first.evidenceObjectId);
    expect(second.contentHash).toBe(first.contentHash);

    const rows = await q<{ n: string }>(
      `select count(*) n from public.evidence_objects where workspace_id = $1`,
      [fx.workspaceId]);
    expect(rows[0]!.n).toBe("1");
  });

  it("reports bytes that were never uploaded", async () => {
    const intent = await createIntent(JPEG);
    const res = await finalize(intent.uploadIntentId);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("UPLOAD_INTENT_CONFLICT");
  });

  it("keeps the original and stays retryable on a hash mismatch", async () => {
    const intent = await createIntent(JPEG);
    // Same length, different content: the size check passes and the hash fails.
    const tampered = new Uint8Array(JPEG); tampered[JPEG.length - 1] = 0x01;
    await putObject(intent.storage.key, tampered, "image/jpeg");

    const res = await finalize(intent.uploadIntentId);
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("UPLOAD_CHECKSUM_MISMATCH");

    const rows = await q<{ status: string; failure_code: string }>(
      `select status, failure_code from public.upload_intents where id = $1`,
      [intent.uploadIntentId]);
    expect(rows[0]!.status).toBe("intent_authorized");   // still retryable
    expect(rows[0]!.failure_code).toBe("integrity_hash_mismatch");
    expect(await objectExists(intent.storage.key)).toBe(true);  // original kept

    const evidence = await q<{ n: string }>(
      `select count(*) n from public.evidence_objects where workspace_id = $1`,
      [fx.workspaceId]);
    expect(evidence[0]!.n).toBe("0");
  });

  it("reports a size mismatch distinctly", async () => {
    const intent = await createIntent(JPEG);
    await putObject(intent.storage.key, new Uint8Array([...JPEG, 0x00]), "image/jpeg");
    expect((await finalize(intent.uploadIntentId)).status).toBe(422);
    const rows = await q<{ failure_code: string }>(
      `select failure_code from public.upload_intents where id = $1`, [intent.uploadIntentId]);
    expect(rows[0]!.failure_code).toBe("integrity_size_mismatch");
  });

  it("blocks content that disagrees with the declared type, and creates no evidence", async () => {
    // D7: recording inspection_status = 'passed' after re-reading the client's
    // own MIME string would be false provenance. The bytes decide.
    const intent = await createIntent(PNG, "image/jpeg");
    await putObject(intent.storage.key, PNG, "image/jpeg");

    const res = await finalize(intent.uploadIntentId);
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("SCAN_REJECTED");

    const rows = await q<{ status: string; failure_code: string }>(
      `select status, failure_code from public.upload_intents where id = $1`,
      [intent.uploadIntentId]);
    expect(rows[0]!.status).toBe("scan_blocked");
    expect(rows[0]!.failure_code).toBe("declared_type_mismatch");

    const evidence = await q<{ n: string }>(
      `select count(*) n from public.evidence_objects where workspace_id = $1`,
      [fx.workspaceId]);
    expect(evidence[0]!.n).toBe("0");
  });

  it("blocks an image whose declared size exceeds the limits, and says why (BL-088)", async () => {
    // 70,000 × 10: 70 MB of PNG header would decode to 2.8 MB here, but the
    // edge alone is past JPEG's and the policy's maximum; a few bytes suffice.
    const wide = new Uint8Array([...PNG]);
    new DataView(wide.buffer).setUint32(16, 70_000);
    const intent = await createIntent(wide, "image/png");
    await putObject(intent.storage.key, wide, "image/png");
    const res = await finalize(intent.uploadIntentId);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("SCAN_REJECTED");
    expect(body.detail).toContain("завелике");
    const rows = await q<{ status: string; failure_code: string }>(
      `select status, failure_code from public.upload_intents where id = $1`, [intent.uploadIntentId]);
    expect(rows[0]).toEqual({ status: "scan_blocked", failure_code: "image_dimensions_exceeded" });
  });

  it("blocks an image whose size cannot be read (BL-088)", async () => {
    const soiOnly = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
    const intent = await createIntent(soiOnly, "image/jpeg");
    await putObject(intent.storage.key, soiOnly, "image/jpeg");
    expect((await finalize(intent.uploadIntentId)).status).toBe(422);
    const rows = await q<{ failure_code: string }>(
      `select failure_code from public.upload_intents where id = $1`, [intent.uploadIntentId]);
    expect(rows[0]!.failure_code).toBe("image_dimensions_unreadable");
  });

  it("blocks unrecognised content", async () => {
    const text = new TextEncoder().encode("не зображення");
    const intent = await createIntent(text, "image/jpeg");
    await putObject(intent.storage.key, text, "image/jpeg");
    expect((await finalize(intent.uploadIntentId)).status).toBe(422);
    const rows = await q<{ failure_code: string }>(
      `select failure_code from public.upload_intents where id = $1`, [intent.uploadIntentId]);
    expect(rows[0]!.failure_code).toBe("unrecognised_content");
  });

  it("blocks bytes stored under a content type other than the detected one (BL-089)", async () => {
    // Storage serves an object with the type its uploader's PUT declared. A
    // JPEG-prefixed HTML polyglot passes the magic-byte check as image/jpeg;
    // stored as TEXT/HTML, Storage serves it back as TEXT/HTML — HTML to a
    // browser — to anyone who opens its signed URL without `download=`
    // (DEV-032). So the stored type must be the detected one, or the object
    // never becomes available and no URL is ever signed for it.
    const polyglot = new Uint8Array([...JPEG, ...new TextEncoder().encode("<html><script>1</script></html>")]);
    const intent = await createIntent(polyglot, "image/jpeg");
    await putObject(intent.storage.key, polyglot, "TEXT/HTML");

    const res = await finalize(intent.uploadIntentId);
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("SCAN_REJECTED");
    const rows = await q<{ status: string; failure_code: string }>(
      `select status, failure_code from public.upload_intents where id = $1`, [intent.uploadIntentId]);
    expect(rows[0]).toEqual({ status: "scan_blocked", failure_code: "stored_type_mismatch" });
    const evidence = await q<{ n: string }>(
      `select count(*) n from public.evidence_objects where workspace_id = $1`, [fx.workspaceId]);
    expect(evidence[0]!.n).toBe("0");
  });

  it("blocks a stored type LIST whose last member is scriptable (DEV-032 S2-01)", async () => {
    // Measured: Storage keeps `image/jpeg;x=1, TEXT/HTML` verbatim and serves
    // it so; a browser takes the last type of a list, and the stripped URL ran
    // the polyglot's script. Cutting at `;` would have read `image/jpeg`.
    const polyglot = new Uint8Array([...JPEG, ...new TextEncoder().encode("<html><script>1</script></html>")]);
    const intent = await createIntent(polyglot, "image/jpeg");
    await putObject(intent.storage.key, polyglot, "image/jpeg;x=1, TEXT/HTML");
    expect((await objectInfo(intent.storage.key))?.contentType).toBe("image/jpeg;x=1, TEXT/HTML");
    expect((await finalize(intent.uploadIntentId)).status).toBe(422);
    const rows = await q<{ failure_code: string }>(
      `select failure_code from public.upload_intents where id = $1`, [intent.uploadIntentId]);
    expect(rows[0]!.failure_code).toBe("stored_type_mismatch");
  });

  it("accepts the detected type stored in another case or with plain parameters", async () => {
    const intent = await createIntent(JPEG, "image/jpeg");
    await putObject(intent.storage.key, JPEG, "IMAGE/JPEG; charset=binary");
    // The positive control: Storage kept the type as sent, so the check saw it.
    expect((await objectInfo(intent.storage.key))?.contentType).toBe("IMAGE/JPEG; charset=binary");
    expect((await finalize(intent.uploadIntentId)).status).toBe(200);
  });

  it("refuses to overwrite an object after finalization, so the checked type and bytes stay (DEV-032 S2-02)", async () => {
    // The stored-type check and the hash check read the object once. They hold
    // only because Storage refuses a second PUT to the same key: the signed
    // upload is created without `upsert`, and that is load-bearing.
    const intent = await createIntent(JPEG, "image/jpeg");
    // The positive control: the client's own signed URL is what stages the bytes.
    const first = await fetch(intent.upload.signedUrl, {
      method: "PUT", headers: { "content-type": "image/jpeg" }, body: JPEG,
    });
    expect(first.ok).toBe(true);
    expect((await finalize(intent.uploadIntentId)).status).toBe(200);
    // The same URL again — with a client header asking for an upsert, which a
    // signed token must not grant — is refused as a duplicate, not for any other reason.
    const again = await fetch(intent.upload.signedUrl, {
      method: "PUT", headers: { "content-type": "TEXT/HTML", "x-upsert": "true" },
      body: new TextEncoder().encode("<html>"),
    });
    const refusal = await again.text();
    expect(again.ok).toBe(false);
    expect(refusal).toMatch(/Duplicate|already exists/i);
    expect(await objectInfo(intent.storage.key)).toEqual({ size: JPEG.byteLength, contentType: "image/jpeg" });
  });

  it("honours an injected blocking inspector", async () => {
    const intent = await staged(JPEG);
    setInspector(() => ({
      outcome: "blocked", detectedMediaType: "image/jpeg",
      failureCode: "malware_detected", policyVersion: "test-blocker",
    }));
    expect((await finalize(intent.uploadIntentId)).status).toBe(422);
    const rows = await q<{ status: string; failure_code: string }>(
      `select status, failure_code from public.upload_intents where id = $1`,
      [intent.uploadIntentId]);
    expect(rows[0]!.status).toBe("scan_blocked");
    expect(rows[0]!.failure_code).toBe("malware_detected");
  });

  it("orphans the intent when authorization is revoked mid-upload (INV-047)", async () => {
    const intent = await staged(JPEG);
    // Revoked between the upload and the finalize, which is exactly the window
    // the recheck exists for.
    await q(
      `update public.project_access_grants set revoked_at = now()
        where workspace_id = $1 and member_id = $2 and capability = 'evidence.record'`,
      [fx.workspaceId, fx.memberId]);

    const res = await finalize(intent.uploadIntentId);
    expect(res.status).toBe(403);

    const rows = await q<{ status: string; failure_code: string }>(
      `select status, failure_code from public.upload_intents where id = $1`,
      [intent.uploadIntentId]);
    expect(rows[0]!.status).toBe("orphaned_for_purge");
    expect(rows[0]!.failure_code).toBe("authorization_revoked");

    const evidence = await q<{ n: string }>(
      `select count(*) n from public.evidence_objects where workspace_id = $1`,
      [fx.workspaceId]);
    expect(evidence[0]!.n).toBe("0");
    // The bytes survive for the purge job rather than vanishing here.
    expect(await objectExists(intent.storage.key)).toBe(true);
  });

  it("refuses to finalize an expired intent", async () => {
    const intent = await staged(JPEG);
    await q(`update public.upload_intents set expires_at = now() - interval '1 hour'
              where id = $1`, [intent.uploadIntentId]);
    // 410, the catalogued answer for an expired upload grant: it is gone rather
    // than contended, and the client's next move is to ask for a new one.
    const expired = await finalize(intent.uploadIntentId);
    expect(expired.status).toBe(410);
    expect((await expired.json()).code).toBe("UPLOAD_GRANT_EXPIRED");
  });

  it("refuses to finalize a blocked intent again", async () => {
    const intent = await createIntent(PNG, "image/jpeg");
    await putObject(intent.storage.key, PNG, "image/jpeg");
    await finalize(intent.uploadIntentId);
    const again = await finalize(intent.uploadIntentId);
    expect(again.status).toBe(409);
  });

  it("refuses a member who did not create the intent, even with evidence.record", async () => {
    // The front door checks ownership rather than the capability, so that a
    // revoked capability reaches the INV-047 recheck. Ownership is what stops a
    // colleague finalizing somebody else's upload.
    const intent = await staged(JPEG);
    const other = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    await q(`delete from auth.users where email = $1 and id <> $2`,
      ["other@example.test", other]);
    await q(
      `insert into auth.users (id, instance_id, aud, role, email,
                               encrypted_password, created_at, updated_at)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
               'other@example.test','',now(),now())
       on conflict (id) do nothing`, [other]);
    const member = await q<{ id: string }>(
      `insert into public.memberships (organization_id, user_id, role, status)
       values ($1,$2,'member','active') returning id`, [fx.workspaceId, other]);
    await q(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,'evidence.record',$4), ($1,$2,$3,'project.view',$4)`,
      [fx.workspaceId, fx.projectId, member[0]!.id, A]);

    current = other;
    const res = await finalize(intent.uploadIntentId);
    expect(res.status).toBe(404);

    const rows = await q<{ status: string }>(
      `select status from public.upload_intents where id = $1`, [intent.uploadIntentId]);
    expect(rows[0]!.status).toBe("intent_authorized");
  });

  it("hides another workspace's intent", async () => {
    const intent = await staged(JPEG);
    current = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const res = await finalize(intent.uploadIntentId);
    expect([403, 404]).toContain(res.status);
  });

  it("refuses to finalize an intent the purge worker has claimed", async () => {
    // Claimed is terminal for finalization: otherwise finalize either creates
    // evidence pointing at bytes about to vanish, or races the delete.
    const intent = await staged(JPEG);
    await q(`update public.upload_intents
                set status = 'expired', purge_claimed_at = now() where id = $1`,
      [intent.uploadIntentId]);

    const res = await finalize(intent.uploadIntentId);
    expect(res.status).toBe(409);

    const evidence = await q<{ n: string }>(
      `select count(*) n from public.evidence_objects where workspace_id = $1`,
      [fx.workspaceId]);
    expect(evidence[0]!.n).toBe("0");
  });

  it("rolls back the evidence row when the intent moves during processing", async () => {
    // Storage IO and inspection happen outside the transaction, so the intent
    // can be expired or claimed in that window. The final transition is
    // conditional and its row count is checked; a miss must leave nothing
    // behind.
    const intent = await staged(JPEG);
    const { POST } = await import("../app/v1/upload-intents/[intentId]/finalize/route");

    setInspector(async (bytes, mediaType) => {
      // Simulate the sweep landing while inspection is in flight.
      await q(`update public.upload_intents set status = 'expired' where id = $1`,
        [intent.uploadIntentId]);
      return { outcome: "passed", detectedMediaType: mediaType,
               failureCode: null, policyVersion: "test-window" };
    });

    const res = await POST(jsonReq("http://x", {}),
      { params: Promise.resolve({ intentId: intent.uploadIntentId }) });
    expect(res.status).toBe(409);

    const evidence = await q<{ n: string }>(
      `select count(*) n from public.evidence_objects where workspace_id = $1`,
      [fx.workspaceId]);
    expect(evidence[0]!.n).toBe("0");
  });

  it.each(["available_replay", "hash_mismatch"] as const)(
    "preserves the pre-extraction %s contract on retry", async (scenario) => {
      if (scenario === "available_replay") {
        const intent = await staged(JPEG);
        const first = await transcript(await finalize(intent.uploadIntentId));
        const second = await transcript(await finalize(intent.uploadIntentId));
        const receiptRows = await q<{ id: string; server_received_at: Date }>(
          `select id, server_received_at from public.evidence_objects
            where workspace_id = $1 and storage_key = $2`,
          [fx.workspaceId, intent.storage.key]);
        expect(receiptRows).toHaveLength(1);
        expect(first).toEqual({
          status: 200,
          headers: { "content-type": "application/json" },
          body: {
            uploadIntentId: intent.uploadIntentId,
            status: "available",
            evidenceObjectId: receiptRows[0]!.id,
            contentHash: hashOf(JPEG),
            serverReceivedAt: receiptRows[0]!.server_received_at.toISOString(),
            failureCode: null,
          },
        });
        // The durable receipt—not a freshly produced success—is returned to a
        // retrying caller, including its original evidence identity and time.
        expect(second).toEqual(first);
      } else {
        const intent = await createIntent(JPEG);
        const tampered = new Uint8Array(JPEG); tampered[tampered.length - 1] = 0x01;
        await putObject(intent.storage.key, tampered, "image/jpeg");
        const expected = {
          status: 422,
          headers: { "content-type": "application/problem+json" },
          body: {
            code: "UPLOAD_CHECKSUM_MISMATCH",
            detail: "Хеш отриманого вмісту не збігається з очікуваним. Оригінал збережено, спробуйте ще раз.",
            fieldErrors: [], retryable: true, userAction: "retry_part",
          },
        };
        expect(await transcript(await finalize(intent.uploadIntentId))).toEqual(expected);
        expect(await transcript(await finalize(intent.uploadIntentId))).toEqual(expected);
      }
    },
  );
});
