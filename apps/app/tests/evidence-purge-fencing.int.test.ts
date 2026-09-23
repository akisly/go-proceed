import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { q, truncateAll, jsonReq, matrixFixture, type MatrixFixture } from "./helpers/fixtures";

/**
 * Purge claims are fenced (DEV-037, BL-031; migration 0091).
 *
 * A claim older than an hour is reclaimable, so a worker that stalls past the
 * hour and resumes is racing the worker that took its rows over. Before 0091
 * `complete_upload_purge` and `fail_upload_purge` took only the intent id: the
 * stale worker could clear the newer claim or spend its retry budget. Each claim
 * now carries a token, and only the holder of the current token can finish it.
 * Vercel Cron may deliver a run twice or let runs overlap
 * (https://vercel.com/docs/cron-jobs/manage-cron-jobs, 2026-08-11), so this is
 * the runner's normal weather, not a theory.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

// The one seam: something may happen while a worker is deleting bytes.
let duringRemove: (() => Promise<void>) | null = null;
vi.mock("../src/lib/evidence-storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/lib/evidence-storage")>();
  return {
    ...real,
    removeObject: async (key: string, bucket?: string) => {
      if (duringRemove) { const hook = duringRemove; duringRemove = null; await hook(); }
      return real.removeObject(key, bucket);
    },
  };
});
const { putObject, objectExists } = await import("../src/lib/evidence-storage");
const { drainEvidencePurge, expireUploadIntents } = await import("../src/lib/evidence-purge");

const CAPS = ["assignments.manage", "evidence.record"] as const;
const PRICED = "1.1;Мурування;м2;10;199,99;1 999,90";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9, 0x00]);
const hashOf = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

let fx: MatrixFixture;
let assignmentId: string;

async function dueIntent(): Promise<{ uploadIntentId: string; storage: { key: string } }> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/upload-intents/route");
  const res = await POST(jsonReq("http://x", {
    expectedContentHash: hashOf(JPEG), expectedByteSize: JPEG.byteLength,
    claimedMediaType: "image/jpeg", deviceCaptureId: "device-1", originMethod: "native_camera",
  }), { params: Promise.resolve({ assignmentId }) });
  const intent = await res.json();
  await putObject(intent.storage.key, JPEG, "image/jpeg");
  await q(`update public.upload_intents set expires_at = now() - interval '1 hour' where id = $1`,
    [intent.uploadIntentId]);
  await expireUploadIntents();
  return intent;
}

type Claim = { upload_intent_id: string; claim_token: string | null };
const claim = () => q<Claim>("select upload_intent_id, claim_token from app.claim_upload_purge(50)");
/** The hour passes: the current claim becomes reclaimable. */
const age = (id: string) => q(
  "update public.upload_intents set purge_claimed_at = now() - interval '61 minutes' where id = $1", [id]);
const row = async (id: string) => (await q<{
  purged_at: Date | null; purge_claimed_at: Date | null; purge_attempts: number;
  purge_failure: string | null; purge_claim_token: string | null;
}>(`select purged_at, purge_claimed_at, purge_attempts, purge_failure, purge_claim_token
      from public.upload_intents where id = $1`, [id]))[0]!;

beforeEach(async () => {
  await truncateAll();
  current = A;
  duringRemove = null;
  fx = await matrixFixture(A, {
    taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
  });
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x", { workItemId: fx.bySourceKey["1.1"]!.id }),
    { params: Promise.resolve({ contractId: fx.contractId }) });
  assignmentId = (await res.json()).assignmentId as string;
});

describe("the claim token (BL-031)", () => {
  it("is issued with every claim, and a reclaim issues a new one", async () => {
    const intent = await dueIntent();
    const [first] = await claim();
    expect(first!.claim_token).toMatch(/^[0-9a-f-]{36}$/);
    expect((await row(intent.uploadIntentId)).purge_claim_token).toBe(first!.claim_token);
    await age(intent.uploadIntentId);
    const [second] = await claim();
    expect(second!.claim_token).toMatch(/^[0-9a-f-]{36}$/);
    expect(second!.claim_token).not.toBe(first!.claim_token);
  });

  it("completes only for the holder of the current token", async () => {
    const intent = await dueIntent();
    const [stale] = await claim();
    await age(intent.uploadIntentId);
    const [fresh] = await claim();

    const late = await q<{ ok: boolean }>("select app.complete_upload_purge($1, $2) as ok",
      [intent.uploadIntentId, stale!.claim_token]);
    expect(late[0]!.ok).toBe(false);
    const r = await row(intent.uploadIntentId);
    expect(r.purged_at).toBeNull();
    expect(r.purge_claim_token).toBe(fresh!.claim_token);

    const done = await q<{ ok: boolean }>("select app.complete_upload_purge($1, $2) as ok",
      [intent.uploadIntentId, fresh!.claim_token]);
    expect(done[0]!.ok).toBe(true);
    expect((await row(intent.uploadIntentId)).purged_at).not.toBeNull();
    expect((await row(intent.uploadIntentId)).purge_claim_token).toBeNull();
  });

  it("lets a stale worker neither release the newer claim nor spend its retry budget", async () => {
    const intent = await dueIntent();
    const [stale] = await claim();
    await age(intent.uploadIntentId);
    const [fresh] = await claim();

    const late = await q<{ ok: boolean }>("select app.fail_upload_purge($1, $2, $3) as ok",
      [intent.uploadIntentId, stale!.claim_token, "stale worker"]);
    expect(late[0]!.ok).toBe(false);
    const r = await row(intent.uploadIntentId);
    expect(r.purge_attempts).toBe(0);
    expect(r.purge_failure).toBeNull();
    expect(r.purge_claimed_at).not.toBeNull();
    expect(r.purge_claim_token).toBe(fresh!.claim_token);

    const failed = await q<{ ok: boolean }>("select app.fail_upload_purge($1, $2, $3) as ok",
      [intent.uploadIntentId, fresh!.claim_token, "storage unavailable"]);
    expect(failed[0]!.ok).toBe(true);
    const after = await row(intent.uploadIntentId);
    expect(after.purge_attempts).toBe(1);
    expect(after.purge_failure).toBe("storage unavailable");
    expect(after.purge_claimed_at).toBeNull();
    expect(after.purge_claim_token).toBeNull();
  });

  it("refuses a null token", async () => {
    const intent = await dueIntent();
    await claim();
    expect((await q<{ ok: boolean }>("select app.complete_upload_purge($1, null) as ok",
      [intent.uploadIntentId]))[0]!.ok).toBe(false);
    expect((await q<{ ok: boolean }>("select app.fail_upload_purge($1, null, 'x') as ok",
      [intent.uploadIntentId]))[0]!.ok).toBe(false);
    expect((await row(intent.uploadIntentId)).purge_attempts).toBe(0);
  });

  it("never holds a token without a claim", async () => {
    const intent = await dueIntent();
    await expect(q("update public.upload_intents set purge_claim_token = gen_random_uuid(), purge_claimed_at = null where id = $1",
      [intent.uploadIntentId])).rejects.toThrow(/violates check constraint "upload_intents_purge_claim_token_needs_claim"/);
  });

  it("keeps the old one-argument signatures gone", async () => {
    const r = await q<{ fn: string }>(
      `select p.oid::regprocedure::text as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname in ('complete_upload_purge', 'fail_upload_purge') order by 1`);
    expect(r.map((x) => x.fn)).toEqual([
      "app.complete_upload_purge(uuid,uuid)", "app.fail_upload_purge(uuid,uuid,text)"]);
  });
});

describe("the worker under a takeover", () => {
  it("counts a row another worker took over as superseded, not purged or failed", async () => {
    const intent = await dueIntent();
    // While this worker deletes the bytes, its claim ages out and a second
    // worker takes the row over.
    duringRemove = async () => {
      await age(intent.uploadIntentId);
      await claim();
    };
    const outcome = await drainEvidencePurge();
    expect(outcome).toEqual({ claimed: 1, purged: 0, failed: 0, superseded: 1 });
    const r = await row(intent.uploadIntentId);
    expect(r.purged_at).toBeNull();
    expect(r.purge_claim_token).not.toBeNull();
    // The bytes are gone (deleting them twice is harmless: keys are never reused).
    expect(await objectExists(intent.storage.key)).toBe(false);
  });

  it("purges normally when nobody interferes", async () => {
    await dueIntent();
    expect(await drainEvidencePurge()).toEqual({ claimed: 1, purged: 1, failed: 0, superseded: 0 });
  });
});
