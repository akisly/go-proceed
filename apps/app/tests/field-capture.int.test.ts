import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import {
  q, truncateAll, jsonReq, baselineFixture, type BaselineFixture,
} from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion,
  publishVersion, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";
import type { CreateUploadIntentResponse, FinalizeUploadIntentResponse } from "@goproceed/contracts";
import { buildCreateIntentBody } from "../app/(app)/a/[assignmentId]/capture";

/**
 * ---------------------------------------------------------------------------
 * Task 9: the capture island. This suite drives the three routes the field
 * client actually calls (create → PUT to Supabase Storage → finalize) in
 * exactly the sequence `capture.tsx`'s `upload()` follows, and separately
 * proves the negative migration 0043 asks for (§6): a v0.1 PWA build cannot
 * express `native_camera`, because `buildCreateIntentBody` — the one place
 * this client's request body is assembled — has no parameter that reaches
 * `originMethod` at all.
 *
 * WHY THE FIRST SUITE DOES NOT MOCK THE STORAGE PUT. Context item 1 of this
 * task's brief is explicit that the bytes go "STRAIGHT TO SUPABASE STORAGE"
 * and never through Next — a mocked PUT would test a shape this client never
 * actually uses. The PUT below is a real HTTP PUT to the local Supabase
 * Storage the create route just issued a grant for, with no Authorization or
 * apikey header at all: that is not an oversight, it was checked by hand
 * against the running local stack before this file was written (a signed
 * upload URL's token is itself the authorization Supabase Storage's gateway
 * asks for). `capture.tsx`'s own PUT is written the identical way for the
 * identical reason — seeing this succeed here is what license that has.
 *
 * THE OCCURRENCE FIXTURE MIRRORS `requirement-occurrences.int.test.ts`'s
 * `boundBaseline`, trimmed to one rule version, because `upload()`'s own
 * signature takes an `occurrenceId` it always sends — a fixture that left
 * `requirementOccurrenceId` unset would exercise the fallback-media path this
 * client never actually takes.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

// `project.view` is not decoration: the create route's occurrence read is
// gated by RLS policy `ro_select` (migration 0043 §9), which asks for
// project.view/project.admin — a caller holding only evidence.record sees no
// rows and is told the occurrence is unknown (see the route's own comment).
const CAPS = ["assignments.manage", "evidence.record", "rule_bindings.manage",
              "requirements.assign", "project.view"] as const;

const LINE = {
  sourceKey: "1.1",
  workTypeKey: "montazh-elektrotekhnichnykh-ustanovok",
  description: "Приклад-улаштування прокладки кабелю",
  unitCode: "м",
  contractQuantity: "10",
  unitPriceState: "known" as const,
  unitPrice: "100.00",
};

/** A minimal but genuine JPEG: SOI + APP0 marker, then a byte of payload. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const hashOf = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

interface Fx extends BaselineFixture {
  assignmentId: string;
  occurrenceId: string;
}

async function grant(projectId: string, memberId: string): Promise<void> {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  const res = await POST(jsonReq("http://x", { memberId, capabilities: [...CAPS] }),
    { params: Promise.resolve({ projectId }) });
  if (res.status >= 300) throw new Error(`grant ${res.status} ${await res.text()}`);
}

/** One published baseline, one bound photo rule, one assignment, one materialised occurrence. */
async function boundOccurrence(): Promise<Fx> {
  const fx = await baselineFixture(A);
  await grant(fx.projectId, fx.memberId);
  const library = await seedRequirementLibrary(fx.workspaceId);

  const rv = await publishRuleVersion(fx.workspaceId, ruleVersionBody(library.get("Н.15/1")!));
  if (rv.status !== 201) throw new Error(`publishRuleVersion ${rv.status} ${await rv.text()}`);
  const ruleVersionId = (await rv.json()).ruleVersionId as string;

  const draft = await createDraft(fx.contractId);
  const contractVersionId = (await draft.json()).contractVersionId as string;
  const line = await addLine(contractVersionId, LINE);
  if (line.status !== 201) throw new Error(`addLine ${line.status} ${await line.text()}`);
  const workItemId = (await line.json()).workItem.workItemId as string;

  const bind = await bindRules(contractVersionId, [ruleVersionId]);
  if (bind.status !== 201) throw new Error(`bindRules ${bind.status} ${await bind.text()}`);

  const view = await (await getVersion(fx.contractId, 1)).json();
  const pub = await publishVersion(contractVersionId, manifestOf(view));
  if (pub.status !== 201) throw new Error(`publishVersion ${pub.status} ${await pub.text()}`);

  const { POST: createAssignment } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const asg = await createAssignment(jsonReq("http://x", { workItemId }),
    { params: Promise.resolve({ contractId: fx.contractId }) });
  if (asg.status !== 201) throw new Error(`assignments.create ${asg.status} ${await asg.text()}`);
  const assignmentId = (await asg.json()).assignmentId as string;

  const occ = await q<{ id: string }>(
    `select id from public.requirement_occurrences
      where workspace_id = $1 and work_assignment_id = $2 and rule_version_id = $3`,
    [fx.workspaceId, assignmentId, ruleVersionId]);
  if (occ.length !== 1) {
    throw new Error(`boundOccurrence: expected exactly one occurrence, got ${occ.length}`);
  }

  return { ...fx, assignmentId, occurrenceId: occ[0]!.id };
}

async function createIntent(body: Record<string, unknown>, assignmentId: string): Promise<Response> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/upload-intents/route");
  return POST(jsonReq("http://x", body), { params: Promise.resolve({ assignmentId }) });
}

async function finalize(intentId: string): Promise<Response> {
  const { POST } = await import("../app/v1/upload-intents/[intentId]/finalize/route");
  return POST(jsonReq("http://x", {}), { params: Promise.resolve({ intentId }) });
}

/** The exact, unauthenticated PUT `capture.tsx` performs against a signed upload URL. */
async function putToSignedUrl(signedUrl: string, bytes: Uint8Array, contentType: string): Promise<Response> {
  return fetch(signedUrl, { method: "PUT", headers: { "content-type": contentType }, body: bytes });
}

let fx: Fx;
beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await boundOccurrence();
});

describe("field capture — the three routes, driven as capture.tsx drives them", () => {
  it("creates with origin_not_distinguished, PUTs straight to storage, finalizes, and reaches available", async () => {
    const file = new File([JPEG], "фото.jpg", {
      type: "image/jpeg",
      lastModified: new Date("2026-08-10T09:00:00Z").getTime(),
    });
    const deviceCaptureId = crypto.randomUUID();
    const body = buildCreateIntentBody({
      file, occurrenceId: fx.occurrenceId, expectedContentHash: hashOf(JPEG), deviceCaptureId,
    });

    expect(body.originMethod).toBe("origin_not_distinguished");

    const createRes = await createIntent(body, fx.assignmentId);
    expect(createRes.status, await createRes.clone().text()).toBe(201);
    const created = await createRes.json() as CreateUploadIntentResponse;

    // Recorded on public.upload_intents at creation, before a single byte has
    // moved — this is what makes the value INV-086 asks for durable, not just
    // a claim this test happens to send.
    const stored = await q<{ origin_method: string; device_capture_id: string }>(
      `select origin_method, device_capture_id from public.upload_intents where id = $1`,
      [created.uploadIntentId]);
    expect(stored[0]!.origin_method).toBe("origin_not_distinguished");
    expect(stored[0]!.device_capture_id).toBe(deviceCaptureId);

    const putRes = await putToSignedUrl(created.upload.signedUrl, JPEG, "image/jpeg");
    expect(putRes.status, await putRes.clone().text()).toBe(200);

    const finalizeRes = await finalize(created.uploadIntentId);
    expect(finalizeRes.status, await finalizeRes.clone().text()).toBe(200);
    const finalized = await finalizeRes.json() as FinalizeUploadIntentResponse;

    expect(finalized.status).toBe("available");
    expect(finalized.contentHash).toBe(hashOf(JPEG));
    expect(finalized.evidenceObjectId).toBeTruthy();

    // The vocabulary the intent carried is what finalize copies onto the
    // evidence object (migration 0043 §6) — the guarantee has to survive
    // that copy, not just the create call.
    const evidence = await q<{ origin_method: string }>(
      `select origin_method from public.evidence_objects where id = $1`,
      [finalized.evidenceObjectId]);
    expect(evidence[0]!.origin_method).toBe("origin_not_distinguished");
  });

  it("carries the device-claimed capture time separately from the server receipt", async () => {
    const claimed = new Date("2026-08-01T06:00:00Z").getTime();
    const file = new File([JPEG], "фото.jpg", { type: "image/jpeg", lastModified: claimed });
    const body = buildCreateIntentBody({
      file, occurrenceId: fx.occurrenceId, expectedContentHash: hashOf(JPEG),
      deviceCaptureId: crypto.randomUUID(),
    });
    expect(body.claimedCaptureTime).toBe(new Date(claimed).toISOString());

    const created = await (await createIntent(body, fx.assignmentId)).json() as CreateUploadIntentResponse;
    await putToSignedUrl(created.upload.signedUrl, JPEG, "image/jpeg");
    const finalized = await (await finalize(created.uploadIntentId)).json() as FinalizeUploadIntentResponse;

    const rows = await q<{ claimed_capture_time: Date; server_received_at: Date; capture_time_trust: string }>(
      `select claimed_capture_time, server_received_at, capture_time_trust
         from public.evidence_objects where id = $1`, [finalized.evidenceObjectId]);
    expect(rows[0]!.capture_time_trust).toBe("device_claimed");
    expect(new Date(rows[0]!.claimed_capture_time).getTime()).toBe(claimed);
    expect(new Date(rows[0]!.claimed_capture_time).getTime())
      .not.toBe(new Date(rows[0]!.server_received_at).getTime());
  });
});

describe("origin method — native_camera is unreachable through the field path (INV-086)", () => {
  it("buildCreateIntentBody has no parameter that reaches originMethod", () => {
    const file = new File([JPEG], "фото.jpg", { type: "image/jpeg", lastModified: Date.now() });
    const args = {
      file, occurrenceId: fx.occurrenceId, expectedContentHash: hashOf(JPEG),
      deviceCaptureId: crypto.randomUUID(),
    };

    // The honest call: no way to ask for anything but the one value ADR-007
    // decision 5 permits.
    expect(buildCreateIntentBody(args).originMethod).toBe("origin_not_distinguished");

    // The dishonest call: a caller that reaches for `native_camera` anyway,
    // exactly as INV-086 anticipates a defect might. TypeScript's own object
    // type already refuses this at the call site — `buildCreateIntentBody`'s
    // parameter type has no `originMethod` field to assign into — so proving
    // it needs a cast to smuggle the property past the compiler the way a
    // real regression (a stray `...rest` spread, a mis-typed helper) would.
    // The builder does not read the property even once it is there: the
    // function body never references `args.originMethod`, so the output is
    // unaffected by what a caller manages to attach.
    const smuggled = { ...args, originMethod: "native_camera" } as unknown as typeof args;
    expect(buildCreateIntentBody(smuggled).originMethod).toBe("origin_not_distinguished");
  });

  it("what native_camera WOULD store, for contrast — proving the guarantee is capture.tsx's, not the database's", async () => {
    // migration 0043 §6 widened the CHECK additively so the native client
    // (apps/mobile, v0.3) keeps working; it does not and must not narrow for
    // the PWA. This is the fact that makes INV-086 a client-side promise
    // rather than a server-enforced one, spelled out rather than assumed —
    // a native_camera intent sent by SOME OTHER caller is accepted, on
    // purpose. What stops it being THIS client's caller is that
    // `buildCreateIntentBody`, proven above, cannot be made to emit it.
    const file = new File([JPEG], "фото.jpg", { type: "image/jpeg", lastModified: Date.now() });
    const res = await createIntent({
      requirementOccurrenceId: fx.occurrenceId,
      expectedContentHash: hashOf(JPEG),
      expectedByteSize: file.size,
      claimedMediaType: "image/jpeg",
      deviceCaptureId: crypto.randomUUID(),
      originMethod: "native_camera",
    }, fx.assignmentId);
    expect(res.status, await res.clone().text()).toBe(201);
  });
});
