import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { q, truncateAll, jsonReq, matrixFixture, type MatrixFixture } from "./helpers/fixtures";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

/**
 * The object disappears between the route reading it and the command writing
 * evidence for it. That is a real race — the route hashes bytes it has already
 * downloaded, so nothing it checked is still guaranteed by the time the command
 * runs — but it cannot be provoked by timing, so it is injected here.
 *
 * What is under test is not the race itself. It is that the failure the command
 * records SURVIVES the response. `withTenantTx` rolls back on a thrown error, so
 * an outcome that writes must be returned and raised after the commit. The first
 * version of migration 0033 wrote `content_missing` inside a transaction the
 * route then threw out of, and the write was silently discarded — a fix that
 * type-checked, read correctly, and did nothing.
 */
let vanishNext = false;
vi.mock("../src/lib/evidence-storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/lib/evidence-storage")>();
  return {
    ...real,
    downloadObject: async (key: string) => {
      const bytes = await real.downloadObject(key);
      if (vanishNext) {
        vanishNext = false;
        await real.removeObject(key, real.EVIDENCE_BUCKET);
      }
      return bytes;
    },
  };
});

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PRICED = "1.1;Мурування;м2;10;199,99;1 999,90";
const hashOf = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const CAPS = ["assignments.manage", "evidence.record"] as const;

let fx: MatrixFixture;
let assignmentId: string;

beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await matrixFixture(A, {
    taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
  });
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x", { workItemId: fx.bySourceKey["1.1"]!.id }),
    { params: Promise.resolve({ contractId: fx.contractId }) });
  assignmentId = (await res.json()).assignmentId as string;
  vanishNext = false;
});

describe("bytes that vanish between the read and the write", () => {
  it("answers 409 and keeps the failure it recorded", async () => {
    const { putObject } = await import("../src/lib/evidence-storage");
    const { POST: createIntent } = await import(
      "../app/v1/assignments/[assignmentId]/upload-intents/route");
    const intent = await (await createIntent(jsonReq("http://x", {
      expectedContentHash: hashOf(JPEG), expectedByteSize: JPEG.byteLength,
      claimedMediaType: "image/jpeg", deviceCaptureId: "device-1",
      originMethod: "native_camera",
    }), { params: Promise.resolve({ assignmentId }) })).json();
    await putObject(intent.storage.key, JPEG, "image/jpeg");

    vanishNext = true;
    const { POST: finalize } = await import(
      "../app/v1/upload-intents/[intentId]/finalize/route");
    const res = await finalize(jsonReq("http://x", {}),
      { params: Promise.resolve({ intentId: intent.uploadIntentId }) });

    expect(res.status, await res.clone().text()).toBe(409);
    expect((await res.json()).code).toBe("UPLOAD_INTENT_CONFLICT");

    // The write is the point: rolled back, this row would still read null.
    const row = (await q<{ failure_code: string | null; status: string }>(
      `select failure_code, status from public.upload_intents where id = $1`,
      [intent.uploadIntentId]))[0]!;
    expect(row.failure_code).toBe("content_missing");

    // Still retryable. The bytes going missing is not the caller's fault, and
    // re-uploading against the same intent is the right next move.
    expect(row.status).toBe("intent_authorized");

    // And no receipt was written for content that is not there.
    const evidence = await q<{ n: string }>(
      `select count(*) n from public.evidence_objects where upload_intent_id = $1`,
      [intent.uploadIntentId]);
    expect(evidence[0]!.n).toBe("0");
  });
});
