import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inspect } from "node:util";
import { q, truncateAll, jsonReq, matrixFixture, type MatrixFixture } from "./helpers/fixtures";
import { putObject, objectExists } from "../src/lib/evidence-storage";

/**
 * The purge's runner (DEV-036, BL-030): Vercel Cron calls
 * `GET /internal/evidence/purge` four times a day with
 * `Authorization: Bearer $CRON_SECRET` (owner, 2026-09-23: Hobby plan, one run
 * a day per expression).
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const SECRET = "c".repeat(40);
const CAPS = ["assignments.manage", "evidence.record"] as const;
const PRICED = "1.1;Мурування;м2;10;199,99;1 999,90";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9, 0x00]);
const hashOf = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

let fx: MatrixFixture;
let assignmentId: string;

async function purge(authorization?: string): Promise<Response> {
  const { GET } = await import("../app/internal/evidence/purge/route");
  return GET(new Request("http://x/internal/evidence/purge",
    authorization === undefined ? {} : { headers: { authorization } }));
}

async function expiredIntent(bytes = JPEG): Promise<{ uploadIntentId: string; storage: { key: string } }> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/upload-intents/route");
  const res = await POST(jsonReq("http://x", {
    expectedContentHash: hashOf(bytes), expectedByteSize: bytes.byteLength,
    claimedMediaType: "image/jpeg", deviceCaptureId: "device-1", originMethod: "native_camera",
  }), { params: Promise.resolve({ assignmentId }) });
  const intent = await res.json();
  await putObject(intent.storage.key, bytes, "image/jpeg");
  await q(`update public.upload_intents set expires_at = now() - interval '1 hour' where id = $1`,
    [intent.uploadIntentId]);
  return intent;
}

let errors: unknown[][];
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
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => { errors.push(args); });
  vi.stubEnv("CRON_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /internal/evidence/purge — authentication first", () => {
  it.each([
    ["no header", undefined],
    ["a wrong secret", `Bearer ${"x".repeat(40)}`],
    ["the secret without Bearer", SECRET],
    ["a prefix of the secret", `Bearer ${SECRET.slice(0, 39)}`],
  ])("refuses %s with 401 and touches nothing", async (_label, header) => {
    const intent = await expiredIntent();
    const res = await purge(header);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "worker_unauthorized" });
    expect(await objectExists(intent.storage.key)).toBe(true);
    const row = await q<{ status: string }>(
      "select status from public.upload_intents where id = $1", [intent.uploadIntentId]);
    expect(row[0]!.status).toBe("intent_authorized");
  });

  it.each([["unset", undefined], ["shorter than 32 characters", "s".repeat(31)]])(
    "refuses every caller while CRON_SECRET is %s, and says so in the log",
    async (_label, value) => {
      vi.stubEnv("CRON_SECRET", value as string);
      const header = `Bearer ${value ?? ""}`;
      const res = await purge(header);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ code: "worker_unauthorized" });
      expect(errors.map((e) => String(e[0])).join("\n")).toContain("CRON_SECRET");
    });
});

describe("GET /internal/evidence/purge — the run", () => {
  it("expires, then deletes the bytes behind an expired intent, and reports counts", async () => {
    const intent = await expiredIntent();
    const res = await purge(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toMatchObject({ expired: 1, claimed: 1, purged: 1, failed: 0, superseded: 0,
      exhausted: 0, overdue: 0 });
    expect(await objectExists(intent.storage.key)).toBe(false);
    const row = await q<{ purged_at: Date | null }>(
      "select purged_at from public.upload_intents where id = $1", [intent.uploadIntentId]);
    expect(row[0]!.purged_at).not.toBeNull();
    expect(errors).toEqual([]);
  });

  it("is idempotent: a second run finds nothing to do", async () => {
    await expiredIntent();
    expect((await purge(`Bearer ${SECRET}`)).status).toBe(200);
    const again = await purge(`Bearer ${SECRET}`);
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ expired: 0, claimed: 0, purged: 0, failed: 0 });
  });

  it("answers 500 when a row failed this run, and logs counts but no key (INV-047 alerting)", async () => {
    const intent = await expiredIntent();
    await q("select app.expire_upload_intents()");
    // The database names no bucket: the worker must refuse rather than guess.
    await q("update public.upload_intents set staging_bucket = null where id = $1", [intent.uploadIntentId]);
    const res = await purge(`Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ code: "purge_attention_required", failed: 1, purged: 0 });
    const printed = errors.map((e) => inspect(e, { depth: null })).join("\n");
    expect(printed).toContain("[EVIDENCE_PURGE]");
    for (const half of intent.storage.key.split("/")) expect(printed).not.toContain(half);
    expect(JSON.stringify(body)).not.toContain(intent.storage.key.split("/")[1]!);
  });

  it("keeps answering 500 while a row stands exhausted, not only on the run it failed", async () => {
    const intent = await expiredIntent();
    await q("select app.expire_upload_intents()");
    await q(`update public.upload_intents set purge_attempts = 5, purge_failure = 'stuck'
              where id = $1`, [intent.uploadIntentId]);
    const res = await purge(`Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      code: "purge_attention_required", claimed: 0, failed: 0, exhausted: 1 });
  });

  it("answers 500 while a due row has waited more than 24 hours", async () => {
    const intent = await expiredIntent();
    await q("select app.expire_upload_intents()");
    // Due for 25 hours, and claimed by a live worker so this run cannot take it.
    await q(`update public.upload_intents
                set expires_at = now() - interval '25 hours', purge_claimed_at = now()
              where id = $1`, [intent.uploadIntentId]);
    const res = await purge(`Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: "purge_attention_required", overdue: 1 });
  });
});

describe("the schedule (apps/app/vercel.json)", () => {
  // Hobby: each expression may run at most once a day, a more frequent one
  // fails the deployment, and a run lands anywhere in its hour
  // (https://vercel.com/docs/cron-jobs/usage-and-pricing, 2026-07-15).
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
    crons?: { path: string; schedule: string }[];
  };
  const purges = (config.crons ?? []).filter((c) => c.path === "/internal/evidence/purge");

  it("calls the purge route with daily expressions only", () => {
    expect(purges.length).toBeGreaterThanOrEqual(4);
    for (const { schedule } of purges) {
      expect(schedule, schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
    }
    expect(new Set(purges.map((c) => c.schedule)).size).toBe(purges.length);
  });

  it("leaves no gap between runs that could stretch past 24 hours with a day's hourly jitter", () => {
    const hours = purges.map((c) => Number(c.schedule.split(" ")[1])).sort((a, b) => a - b);
    const gaps = hours.map((h, i) => ((hours[(i + 1) % hours.length]! - h + 24) % 24) || 24);
    // Each run may land up to 59 minutes into its hour; with every gap at most
    // six hours, the longest wait is under seven, well inside INV-047's day.
    expect(Math.max(...gaps)).toBeLessThanOrEqual(6);
  });
});
