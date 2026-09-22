import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { q, truncateAll, jsonReq, matrixFixture, type MatrixFixture } from "./helpers/fixtures";
import { putObject } from "../src/lib/evidence-storage";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const CAPS = ["assignments.manage", "evidence.record"] as const;
const PRICED = "1.1;Мурування;м2;10;199,99;1 999,90";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9, 0x00]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde]);
const hashOf = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

let fx: MatrixFixture;
let assignmentId: string;

async function assign(f: MatrixFixture): Promise<string> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x", { workItemId: f.bySourceKey["1.1"]!.id }),
    { params: Promise.resolve({ contractId: f.contractId }) });
  return (await res.json()).assignmentId as string;
}

async function createIntent(bytes: Uint8Array, mediaType = "image/jpeg") {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/upload-intents/route");
  const res = await POST(jsonReq("http://x", {
    expectedContentHash: hashOf(bytes), expectedByteSize: bytes.byteLength,
    claimedMediaType: mediaType, deviceCaptureId: "device-1",
    originMethod: "native_camera",
  }), { params: Promise.resolve({ assignmentId }) });
  return await res.json();
}

async function finalize(intentId: string): Promise<Response> {
  const { POST } = await import("../app/v1/upload-intents/[intentId]/finalize/route");
  return POST(jsonReq("http://x", {}), { params: Promise.resolve({ intentId }) });
}

async function getIntent(intentId: string): Promise<Response> {
  const { GET } = await import("../app/v1/upload-intents/[intentId]/route");
  return GET(new Request("http://x"), { params: Promise.resolve({ intentId }) });
}

beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await matrixFixture(A, {
    taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
  });
  assignmentId = await assign(fx);
});

describe("upload_intents.get", () => {
  it("re-fetches an available receipt so a lost local write costs no re-upload", async () => {
    const intent = await createIntent(JPEG);
    await putObject(intent.storage.key, JPEG, "image/jpeg");
    const finalized = await (await finalize(intent.uploadIntentId)).json();

    const res = await getIntent(intent.uploadIntentId);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.status).toBe("available");
    expect(body.evidenceObjectId).toBe(finalized.evidenceObjectId);
    expect(body.contentHash).toBe(hashOf(JPEG));
    expect(body.byteSize).toBe(JPEG.byteLength);
    expect(body.serverReceivedAt).toBeTruthy();
  });

  it("reports an authorized-but-unsent intent with no receipt yet", async () => {
    const intent = await createIntent(JPEG);
    const body = await (await getIntent(intent.uploadIntentId)).json();
    expect(body.status).toBe("intent_authorized");
    expect(body.evidenceObjectId).toBeNull();
    expect(body.contentHash).toBeNull();
    expect(body.serverReceivedAt).toBeNull();
  });

  it("reports scan_blocked with its failure code", async () => {
    const intent = await createIntent(PNG, "image/jpeg");
    await putObject(intent.storage.key, PNG, "image/jpeg");
    await finalize(intent.uploadIntentId);

    const body = await (await getIntent(intent.uploadIntentId)).json();
    expect(body.status).toBe("scan_blocked");
    expect(body.failureCode).toBe("declared_type_mismatch");
    expect(body.evidenceObjectId).toBeNull();
  });

  it("never leaks a storage key", async () => {
    // A key in a response is a capability leak, and permanent download URLs are
    // forbidden outright.
    const intent = await createIntent(JPEG);
    const raw = await (await getIntent(intent.uploadIntentId)).text();
    expect(raw).not.toContain(intent.storage.key);
    expect(raw).not.toContain("storage");
    expect(raw).not.toContain("signedUrl");
  });

  it("still answers the creator after their capability is revoked", async () => {
    // The recovery path must survive exactly the situation that made recovery
    // necessary.
    const intent = await createIntent(JPEG);
    await q(
      `update public.project_access_grants set revoked_at = now()
        where workspace_id = $1 and member_id = $2 and capability <> 'project.view'`,
      [fx.workspaceId, fx.memberId]);
    expect((await getIntent(intent.uploadIntentId)).status).toBe(200);
  });

  it("lets another member of the project read the status", async () => {
    const intent = await createIntent(JPEG);
    const other = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    await q(`delete from auth.users where email = $1 and id <> $2`,
      ["viewer@example.test", other]);
    await q(
      `insert into auth.users (id, instance_id, aud, role, email,
                               encrypted_password, created_at, updated_at)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
               'viewer@example.test','',now(),now())
       on conflict (id) do nothing`, [other]);
    const member = await q<{ id: string }>(
      `insert into public.memberships (organization_id, user_id, role, status)
       values ($1,$2,'member','active') returning id`, [fx.workspaceId, other]);
    await q(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,'project.view',$4)`,
      [fx.workspaceId, fx.projectId, member[0]!.id, A]);

    current = other;
    expect((await getIntent(intent.uploadIntentId)).status).toBe(200);
  });

  it("tells a workspace member with no project grant nothing at all", async () => {
    const intent = await createIntent(JPEG);
    const stranger = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    await q(`delete from auth.users where email = $1 and id <> $2`,
      ["stranger@example.test", stranger]);
    await q(
      `insert into auth.users (id, instance_id, aud, role, email,
                               encrypted_password, created_at, updated_at)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
               'stranger@example.test','',now(),now())
       on conflict (id) do nothing`, [stranger]);
    await q(
      `insert into public.memberships (organization_id, user_id, role, status)
       values ($1,$2,'member','active')`, [fx.workspaceId, stranger]);

    current = stranger;
    const res = await getIntent(intent.uploadIntentId);
    // 404, not 403: the select policy on upload_intents already requires
    // project.view, so the row is invisible and the route's capability check is
    // never reached. The stranger learns nothing about whether the intent
    // exists, which is stronger than a permission denial.
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("RESOURCE_NOT_FOUND");
  });

  it("hides another workspace's intent", async () => {
    const intent = await createIntent(JPEG);
    current = B;
    const res = await getIntent(intent.uploadIntentId);
    expect([403, 404]).toContain(res.status);
  });

  it("reports an unknown intent as not found", async () => {
    const res = await getIntent("00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});
