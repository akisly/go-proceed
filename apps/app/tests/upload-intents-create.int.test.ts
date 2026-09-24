import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import {
  ADMIN_URL, hasIsolatedDatabaseCredentials, q, jsonReq, matrixFixture,
  baselineFixture, type MatrixFixture,
} from "./helpers/fixtures";
import { dropWorkspaces } from "../../../packages/testing/src/pg";
import { EVIDENCE_BUCKET, removeObject } from "../src/lib/evidence-storage";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion,
  publishVersion, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUBLISHABLE = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const CAPS = ["assignments.manage", "progress.record", "evidence.record"] as const;
const PRICED = "1.1;Мурування;м2;10;199,99;1 999,90";
const OCCURRENCE_LINE = {
  sourceKey: "1.1",
  workTypeKey: "montazh-elektrotekhnichnykh-ustanovok",
  description: "Приклад-улаштування прокладки кабелю",
  unitCode: "м",
  contractQuantity: "10",
  unitPriceState: "known" as const,
  unitPrice: "100.00",
};

const PAYLOAD = new TextEncoder().encode("Приклад-фото");
const HASH = createHash("sha256").update(PAYLOAD).digest("hex");

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

async function createMatrixFixture(options: Parameters<typeof matrixFixture>[1]): Promise<MatrixFixture> {
  const fixture = await matrixFixture(A, options);
  fixtureWorkspaceIds.push(fixture.workspaceId);
  return fixture;
}

const VALID = () => ({
  expectedContentHash: HASH,
  expectedByteSize: PAYLOAD.byteLength,
  claimedMediaType: "image/jpeg",
  deviceCaptureId: "device-capture-1",
  originMethod: "native_camera" as const,
});

async function assign(f: MatrixFixture, templateVersionId?: string): Promise<string> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const body: Record<string, unknown> = { workItemId: f.bySourceKey["1.1"]!.id };
  if (templateVersionId) body.requirementTemplateVersionId = templateVersionId;
  const res = await POST(jsonReq("http://x", body),
    { params: Promise.resolve({ contractId: f.contractId }) });
  if (res.status !== 201) throw new Error(`assign ${res.status} ${await res.text()}`);
  return (await res.json()).assignmentId as string;
}

async function createIntent(
  body: Record<string, unknown>, id = assignmentId, key?: string,
): Promise<Response> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/upload-intents/route");
  const req = new Request("http://x", {
    method: "POST",
    headers: { "content-type": "application/json",
               "idempotency-key": key ?? crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ assignmentId: id }) });
}

async function transcript(response: Response): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
  const body = await response.json() as Record<string, unknown>;
  const responseRequestId = response.headers.get("x-request-id");
  expect(responseRequestId).toBe(body.requestId);
  // Request IDs are the only per-call fields. Every other response body field
  // and header is preserved below as part of the characterized route contract.
  delete body.requestId;
  return {
    status: response.status,
    headers: Object.fromEntries([...response.headers].filter(([name]) => name !== "x-request-id")),
    body,
  };
}

async function wrongAssignmentOccurrence(): Promise<{
  sourceAssignmentId: string; targetAssignmentId: string; occurrenceId: string;
}> {
  const foreign = await baselineFixture(A);
  fixtureWorkspaceIds.push(foreign.workspaceId);
  const { POST: grant } = await import("../app/v1/projects/[projectId]/access-grants/route");
  await grant(jsonReq("http://x", {
    memberId: foreign.memberId,
    capabilities: ["assignments.manage", "evidence.record", "rule_bindings.manage", "requirements.assign", "project.view"],
  }), { params: Promise.resolve({ projectId: foreign.projectId }) });
  const library = await seedRequirementLibrary(foreign.workspaceId);
  const rule = await publishRuleVersion(foreign.workspaceId, ruleVersionBody(library.get("Н.15/1")!));
  if (rule.status !== 201) throw new Error(`publish rule ${rule.status} ${await rule.text()}`);
  const ruleVersionId = (await rule.json()).ruleVersionId as string;
  const draft = await createDraft(foreign.contractId);
  const contractVersionId = (await draft.json()).contractVersionId as string;
  const line = await addLine(contractVersionId, OCCURRENCE_LINE);
  if (line.status !== 201) throw new Error(`add line ${line.status} ${await line.text()}`);
  const workItemId = (await line.json()).workItem.workItemId as string;
  const binding = await bindRules(contractVersionId, [ruleVersionId]);
  if (binding.status !== 201) throw new Error(`bind rules ${binding.status} ${await binding.text()}`);
  const view = await (await getVersion(foreign.contractId, 1)).json();
  const published = await publishVersion(contractVersionId, manifestOf(view));
  if (published.status !== 201) throw new Error(`publish baseline ${published.status} ${await published.text()}`);
  const { POST: createAssignment } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const first = await createAssignment(jsonReq("http://x", { workItemId }),
    { params: Promise.resolve({ contractId: foreign.contractId }) });
  const firstAssignmentId = (await first.json()).assignmentId as string;
  const occurrence = await q<{ id: string }>(
    `select id from public.requirement_occurrences
      where workspace_id = $1 and work_assignment_id = $2 and rule_version_id = $3`,
    [foreign.workspaceId, firstAssignmentId, ruleVersionId]);
  if (occurrence.length !== 1) throw new Error(`expected one foreign occurrence, got ${occurrence.length}`);
  const target = await createAssignment(jsonReq("http://x", { workItemId }),
    { params: Promise.resolve({ contractId: foreign.contractId }) });
  if (target.status !== 201) throw new Error(`create target assignment ${target.status} ${await target.text()}`);
  const targetAssignmentId = (await target.json()).assignmentId as string;
  if (targetAssignmentId === firstAssignmentId) {
    throw new Error("expected a distinct target assignment for wrong-occurrence characterization");
  }
  return { sourceAssignmentId: firstAssignmentId, targetAssignmentId, occurrenceId: occurrence[0]!.id };
}

async function publishedTemplate(
  f: MatrixFixture, allowedMedia: { mimeTypes: string[]; maxByteSize: number },
): Promise<string> {
  const { POST: create } = await import(
    "../app/v1/workspaces/[workspaceId]/requirement-templates/route");
  const created = await create(jsonReq("http://x", {
    templateKey: `set-${Math.random().toString(36).slice(2, 8)}`,
    evidenceType: "photo", allowedMedia,
  }), { params: Promise.resolve({ workspaceId: f.workspaceId }) });
  const id = (await created.json()).templateVersionId as string;
  const { POST: publish } = await import(
    "../app/v1/requirement-templates/[templateVersionId]/publish/route");
  await publish(jsonReq("http://x", {}), { params: Promise.resolve({ templateVersionId: id }) });
  return id;
}

beforeEach(async () => {
  fixtureWorkspaceIds = [];
  current = A;
  fx = await createMatrixFixture({
    taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
  });
  assignmentId = await assign(fx);
});
afterEach(cleanupFixtureWorkspaces);

databaseDescribe("upload_intents.create", () => {
  it("authorizes an intent and returns a usable upload grant", async () => {
    const res = await createIntent(VALID());
    expect(res.status, await res.clone().text()).toBe(201);
    const body = await res.json();

    expect(body.status).toBe("intent_authorized");
    expect(body.storage.bucket).toBe(EVIDENCE_BUCKET);
    expect(body.upload.signedUrl).toContain(EVIDENCE_BUCKET);

    // The grant works for a client holding no service credentials.
    const anon = createClient(SUPABASE_URL, PUBLISHABLE,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await anon.storage.from(EVIDENCE_BUCKET)
      .uploadToSignedUrl(body.storage.key, body.upload.token, PAYLOAD,
        { contentType: "image/jpeg" });
    expect(error).toBeNull();
  });

  it("records the device's own account of the capture", async () => {
    const body = await (await createIntent({
      ...VALID(), claimedCaptureTime: "2026-07-31T09:00:00+03:00", claimedTzOffset: "+03:00",
    })).json();

    const rows = await q<{
      client_state: string; event_source: string; capture_time_trust: string;
    }>(`select client_state, event_source, capture_time_trust from public.capture_events
         where workspace_id = $1 and upload_intent_id = $2`,
      [fx.workspaceId, body.uploadIntentId]);
    expect(rows.length).toBe(1);
    expect(rows[0]!.client_state).toBe("not_sent");
    expect(rows[0]!.event_source).toBe("device");
    expect(rows[0]!.capture_time_trust).toBe("device_claimed");
  });

  it("stores an opaque key carrying no business identifier", async () => {
    const body = await (await createIntent({
      ...VALID(), originalFilename: "кошторис-фото.jpg",
    })).json();
    expect(body.storage.key).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/);
    expect(body.storage.key).not.toContain("кошторис");
    expect(body.storage.key).not.toContain(fx.workspaceId);
    expect(body.storage.key).not.toContain(fx.projectId);
  });

  it("enforces the pinned template's media allowlist and size limit", async () => {
    const templateVersionId = await publishedTemplate(fx,
      { mimeTypes: ["image/png"], maxByteSize: 1024 });
    const pinned = await assign(fx, templateVersionId);

    const wrongType = await createIntent(VALID(), pinned);
    expect(wrongType.status).toBe(422);
    const typeBody = await wrongType.json();
    expect(typeBody.code).toBe("UPLOAD_SIZE_LIMIT");
    // The user must see the exact allowed set, not a generic rejection.
    expect(typeBody.detail).toContain("image/png");

    const tooBig = await createIntent(
      { ...VALID(), claimedMediaType: "image/png", expectedByteSize: 2048 }, pinned);
    expect(tooBig.status).toBe(422);
    expect((await tooBig.json()).detail).toContain("1024");
  });

  it("falls back to the module allowlist when nothing is pinned", async () => {
    expect((await createIntent({ ...VALID(), claimedMediaType: "application/pdf" })).status)
      .toBe(201);
    expect((await createIntent({ ...VALID(), claimedMediaType: "application/zip" })).status)
      .toBe(422);
  });

  it("rejects a malformed hash and a non-positive size", async () => {
    expect((await createIntent({ ...VALID(), expectedContentHash: "nope" })).status).toBe(422);
    expect((await createIntent({ ...VALID(), expectedContentHash: HASH.toUpperCase() })).status)
      .toBe(422);
    expect((await createIntent({ ...VALID(), expectedByteSize: 0 })).status).toBe(422);
  });

  it("replays one intent and one capture event under a repeated key", async () => {
    const key = crypto.randomUUID();
    const first = await (await createIntent(VALID(), assignmentId, key)).json();
    const second = await (await createIntent(VALID(), assignmentId, key)).json();

    expect(second.uploadIntentId).toBe(first.uploadIntentId);
    expect(second.storage.key).toBe(first.storage.key);

    const counts = await q<{ intents: string; events: string }>(
      `select (select count(*) from public.upload_intents where workspace_id = $1) intents,
              (select count(*) from public.capture_events where workspace_id = $1) events`,
      [fx.workspaceId]);
    expect(counts[0]!.intents).toBe("1");
    expect(counts[0]!.events).toBe("1");
  });

  it("mints the upload grant on replay rather than reading a stored one", async () => {
    // The idempotency record lives 30 days; a grant persisted in it could not
    // be reissued when it lapses. So the record holds only the intent identity
    // and key, and the grant is minted on every call. A replay therefore comes
    // back with a working grant, not a preserved one.
    //
    // The token itself is not asserted to differ: Supabase derives it from the
    // object path, so two grants for one key are byte-identical. What matters
    // is where it comes from, which the stored-body test below pins down.
    const key = crypto.randomUUID();
    const first = await (await createIntent(VALID(), assignmentId, key)).json();
    const second = await (await createIntent(VALID(), assignmentId, key)).json();

    expect(second.upload.signedUrl).toBeTruthy();
    expect(second.storage.key).toBe(first.storage.key);

    const anon = createClient(SUPABASE_URL, PUBLISHABLE,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await anon.storage.from(EVIDENCE_BUCKET)
      .uploadToSignedUrl(second.storage.key, second.upload.token, PAYLOAD,
        { contentType: "image/jpeg" });
    expect(error).toBeNull();
  });

  it("never persists a signed URL", async () => {
    await createIntent(VALID());
    const rows = await q<{ body: unknown }>(
      `select response_body::text as body from public.idempotency_records
        where operation_id = 'upload_intents.create'`);
    expect(String(rows[0]!.body)).not.toContain("token=");
    expect(String(rows[0]!.body)).not.toContain("signedUrl");
  });

  it("conflicts when the same key carries a different hash", async () => {
    const key = crypto.randomUUID();
    await createIntent(VALID(), assignmentId, key);
    const other = await createIntent(
      { ...VALID(), expectedContentHash: "b".repeat(64) }, assignmentId, key);
    expect(other.status).toBe(409);
    expect((await other.json()).code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("denies a caller without evidence.record", async () => {
    const bare = await createMatrixFixture({
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED],
      capabilities: ["assignments.manage"],
    });
    const bareAssignment = await assign(bare);
    const res = await createIntent(VALID(), bareAssignment);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("hides another workspace's assignment", async () => {
    current = B;
    const res = await createIntent(VALID());
    expect([403, 404]).toContain(res.status);
  });

  it("refuses a replay grant after the creator loses evidence.record", async () => {
    // The grant is minted outside the idempotency callback, which does not
    // re-run on replay. Without a state and authorization re-check, a caller who
    // has since lost the capability replays the original request and gets a
    // working upload token.
    const key = crypto.randomUUID();
    await createIntent(VALID(), assignmentId, key);

    await q(
      `update public.project_access_grants set revoked_at = now()
        where workspace_id = $1 and member_id = $2 and capability = 'evidence.record' and revoked_at is null`,
      [fx.workspaceId, fx.memberId]);

    const replay = await createIntent(VALID(), assignmentId, key);
    expect(replay.status).toBe(403);
  });

  it("refuses a replay grant once the intent has been purged", async () => {
    // Bytes uploaded against a purged intent are never claimed again, because
    // purged_at is already set. They would sit in the bucket forever.
    const key = crypto.randomUUID();
    const first = await (await createIntent(VALID(), assignmentId, key)).json();
    await q(
      `update public.upload_intents set status = 'expired', purged_at = now()
        where id = $1`, [first.uploadIntentId]);

    const replay = await createIntent(VALID(), assignmentId, key);
    expect(replay.status).toBe(409);
    expect((await replay.json()).code).toBe("VERSION_CONFLICT");
  });

  it("refuses a replay grant once the intent has expired", async () => {
    const key = crypto.randomUUID();
    const first = await (await createIntent(VALID(), assignmentId, key)).json();
    await q(`update public.upload_intents set expires_at = now() - interval '1 hour'
              where id = $1`, [first.uploadIntentId]);

    expect((await createIntent(VALID(), assignmentId, key)).status).toBe(409);
  });

  it("is unlimited when the workspace has no quota configured", async () => {
    // NULL means unlimited, which is the behaviour that shipped. The figure
    // itself is an external gate (the approved retention schedule), so the
    // mechanism lands without inventing a number.
    const before = await q<{ evidence_quota_bytes: string | null }>(
      `select evidence_quota_bytes from public.organizations where id = $1`,
      [fx.workspaceId]);
    expect(before[0]!.evidence_quota_bytes).toBeNull();
    expect((await createIntent(VALID())).status).toBe(201);
  });

  it("refuses an intent that would exceed the workspace quota", async () => {
    await q(`update public.organizations set evidence_quota_bytes = $2 where id = $1`,
      [fx.workspaceId, PAYLOAD.byteLength + 1]);

    // The first fits and reserves its bytes.
    expect((await createIntent(VALID())).status).toBe(201);

    // The second does not, because the live intent's reservation counts.
    const res = await createIntent(VALID());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("UPLOAD_SIZE_LIMIT");
    expect(body.userAction).toBe("reduce_file_or_request_policy_change");
  });

  it("counts a reservation until the bytes are gone, not until the grant lapses", async () => {
    await q(`update public.organizations set evidence_quota_bytes = $2 where id = $1`,
      [fx.workspaceId, PAYLOAD.byteLength + 1]);
    const first = await (await createIntent(VALID())).json();
    expect((await createIntent(VALID())).status).toBe(422);

    // This used to assert the opposite — that an expired intent "promises
    // nothing, so the room comes back" — which read as obvious and was the
    // whole exploit. An expiring grant does not remove anything from the
    // bucket: it only stops the caller finalizing. Handing the quota back at
    // that moment let one workspace hold unbounded storage by uploading,
    // never finalizing, and waiting. With no purge worker deployed, those bytes
    // stay forever (migration 0031).
    await q(`update public.upload_intents set expires_at = now() - interval '1 hour'
              where id = $1`, [first.uploadIntentId]);
    expect((await createIntent(VALID())).status).toBe(422);

    // The sweep marking it 'expired' changes nothing either — it is a label on
    // the same bytes.
    await q(`update public.upload_intents set status = 'expired' where id = $1`,
      [first.uploadIntentId]);
    expect((await createIntent(VALID())).status).toBe(422);

    // purged_at is the fact that frees the room, because it is the one that
    // means the object was deleted.
    await q(`update public.upload_intents set purged_at = now() where id = $1`,
      [first.uploadIntentId]);
    expect((await createIntent(VALID())).status).toBe(201);
  });

  it("records what the intent reserved", async () => {
    const body = await (await createIntent(VALID())).json();
    const rows = await q<{ quota_reserved_bytes: string }>(
      `select quota_reserved_bytes from public.upload_intents where id = $1`,
      [body.uploadIntentId]);
    // The column existed since 0015 and nothing ever wrote it.
    expect(Number(rows[0]!.quota_reserved_bytes)).toBe(PAYLOAD.byteLength);
  });

  it.each([
    "unknown_assignment",
    "wrong_occurrence",
    "unsupported_media",
    "quota_exhausted",
  ] as const)("preserves the pre-extraction %s contract on retry", async (scenario) => {
    const key = crypto.randomUUID();
    let run: () => Promise<Response>;
    let expected: { status: number; headers: Record<string, string>; body: Record<string, unknown> };
    switch (scenario) {
      case "unknown_assignment":
        run = () => createIntent(VALID(), "00000000-0000-0000-0000-000000000000", key);
        expected = {
          status: 404,
          headers: { "content-type": "application/problem+json" },
          body: {
            code: "RESOURCE_NOT_FOUND", detail: "Завдання не знайдено.", fieldErrors: [],
            retryable: false, userAction: "return_to_list",
          },
        };
        break;
      case "wrong_occurrence": {
        const foreign = await wrongAssignmentOccurrence();
        expect(foreign.targetAssignmentId).not.toBe(foreign.sourceAssignmentId);
        run = () => createIntent(
          { ...VALID(), requirementOccurrenceId: foreign.occurrenceId }, foreign.targetAssignmentId, key);
        expected = {
          status: 422,
          headers: { "content-type": "application/problem+json" },
          body: {
            code: "VALIDATION_FAILED", detail: "Вимогу не знайдено серед обов'язків цього завдання.",
            fieldErrors: [{ path: "requirementOccurrenceId", message: "unknown occurrence for this assignment" }],
            retryable: false, userAction: "correct_fields",
          },
        };
        break;
      }
      case "unsupported_media":
        run = () => createIntent({ ...VALID(), claimedMediaType: "application/zip" }, assignmentId, key);
        expected = {
          status: 422,
          headers: { "content-type": "application/problem+json" },
          body: {
            code: "UPLOAD_SIZE_LIMIT",
            detail: "Тип «application/zip» не дозволений. Дозволені: image/jpeg, image/png, image/heic, application/pdf.",
            fieldErrors: [{ path: "claimedMediaType", message: "media type not allowed" }],
            retryable: false, userAction: "reduce_file_or_request_policy_change",
          },
        };
        break;
      case "quota_exhausted":
        await q(`update public.organizations set evidence_quota_bytes = $2 where id = $1`,
          [fx.workspaceId, PAYLOAD.byteLength + 1]);
        await createIntent(VALID());
        run = () => createIntent(VALID(), assignmentId, key);
        expected = {
          status: 422,
          headers: { "content-type": "application/problem+json" },
          body: {
            code: "UPLOAD_SIZE_LIMIT",
            detail: `Ліміт сховища вичерпано: зайнято ${PAYLOAD.byteLength} Б із ${PAYLOAD.byteLength + 1} Б.`,
            fieldErrors: [], retryable: false, userAction: "reduce_file_or_request_policy_change",
          },
        };
        break;
    }
    const first = await transcript(await run!());
    const second = await transcript(await run!());
    expect(first).toEqual(expected!);
    expect(second).toEqual(expected!);
  });
});
