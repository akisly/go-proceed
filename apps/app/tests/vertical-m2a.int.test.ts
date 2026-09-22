import { describe, it, expect, vi, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import { q, truncateAll, jsonReq, matrixFixture, type MatrixFixture } from "./helpers/fixtures";
import { putObject, objectExists } from "../src/lib/evidence-storage";
import { drainEvidencePurge } from "../src/lib/evidence-purge";

/**
 * The v0.1-M2-A vertical scenario, driven end to end through the public API.
 *
 * It replaces the device-matrix scenario in the roadmap, which belongs to M2-B:
 * EAS builds, TestFlight and Play distribution and acceptance on real hardware
 * cannot run here. What this proves is the server half — a published template,
 * an assignment pinned to it, money that reconciles through a correction, and an
 * evidence receipt that survives replay and refuses a revoked actor.
 *
 * THE STEP ORDER CHANGED WITH ADR-008, AND THAT IS THE POINT OF THE CHANGE.
 * Step 3 was titled «records progress and carves a reconciling exposure slice»
 * and ADR-008 §Consequences names it as one of three assertions that must MOVE
 * rather than be rewritten: money was carved at step 3 and evidence uploaded at
 * step 4, which is the inverted ordering the whole decision exists to correct.
 * Recording now carves nothing; a new step 3b admits the quantity at the stage
 * closure, which is the v0.1 admission event. Step 7 — «returns money to the pool
 * on a negative correction» — is unchanged and now runs against money that was
 * admitted rather than money that appeared with the measurement.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

// `stage_closures.close` is granted explicitly below. It WAS in no row of
// responsibility-presets.csv when this was written (the M3 preset gap, migration
// 0045 §11 item 2); it is on `pto_engineer` as of 2026-08-17.
const CAPS = ["assignments.manage", "progress.record", "progress.adjust", "evidence.record",
              "stage_closures.close"] as const;
const PRICED = "1.1;Мурування;м2;10;199,99;1 999,90";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9, 0x00]);
const hashOf = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

let fx: MatrixFixture;
let templateVersionId: string;
let assignmentId: string;
let rootEntryId: string;
let evidenceObjectId: string;
let firstReceipt: { evidenceObjectId: string; contentHash: string; serverReceivedAt: string };
let orphanedKey: string;

const post = (mod: unknown, body: unknown, params: Record<string, string>) =>
  (mod as { POST: (r: Request, c: unknown) => Promise<Response> })
    .POST(jsonReq("http://x", body), { params: Promise.resolve(params) });

async function poolTotals() {
  const item = fx.bySourceKey["1.1"]!;
  const rows = await q<{ net: string; tax: string; gross: string }>(
    `select coalesce(sum(net_minor_units),0)::text net,
            coalesce(sum(tax_minor_units),0)::text tax,
            coalesce(sum(gross_minor_units),0)::text gross
       from public.valuation_allocations where workspace_id = $1 and work_item_id = $2`,
    [fx.workspaceId, item.id]);
  const allocated = rows[0]!;
  return {
    allocated,
    unperformed: {
      net: BigInt(item.net) - BigInt(allocated.net),
      tax: BigInt(item.tax) - BigInt(allocated.tax),
      gross: BigInt(item.gross) - BigInt(allocated.gross),
    },
    pool: item,
  };
}

beforeAll(async () => {
  await truncateAll();
  current = A;
  fx = await matrixFixture(A, {
    taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
  });
});

describe("v0.1-M2-A vertical scenario", () => {
  it("1. publishes a requirement template", async () => {
    const created = await post(
      await import("../app/v1/workspaces/[workspaceId]/requirement-templates/route"),
      { templateKey: "фото-набір", evidenceType: "photo",
        allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 5 * 1024 * 1024 } },
      { workspaceId: fx.workspaceId });
    expect(created.status).toBe(201);
    templateVersionId = (await created.json()).templateVersionId;

    const published = await post(
      await import("../app/v1/requirement-templates/[templateVersionId]/publish/route"),
      {}, { templateVersionId });
    expect(published.status).toBe(200);
    expect((await published.json()).templateHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("2. creates an assignment pinned to that exact version", async () => {
    const res = await post(
      await import("../app/v1/contracts/[contractId]/assignments/route"),
      { workItemId: fx.bySourceKey["1.1"]!.id, requirementTemplateVersionId: templateVersionId },
      { contractId: fx.contractId });
    expect(res.status).toBe(201);
    assignmentId = (await res.json()).assignmentId;

    const rows = await q<{ requirement_template_version_id: string; contract_version_id: string }>(
      `select requirement_template_version_id, contract_version_id
         from public.work_assignments where id = $1`, [assignmentId]);
    expect(rows[0]!.requirement_template_version_id).toBe(templateVersionId);
    expect(rows[0]!.contract_version_id).toBe(fx.contractVersionId);
  });

  it("3. records progress, and the money does not move (ADR-008)", async () => {
    const res = await post(
      await import("../app/v1/assignments/[assignmentId]/progress/route"),
      { quantity: "6" }, { assignmentId });
    expect(res.status).toBe(201);
    const body = await res.json();
    rootEntryId = body.progressEntryId;

    // «A quantity without its proof is not yet a claim.» Performed quantity is
    // recorded and UNVALUED until it is admitted (INV-089).
    expect(body.admitted).toBe(false);
    const { allocated } = await poolTotals();
    expect(BigInt(allocated.gross)).toBe(0n);
  });

  it("3b. admits the recorded quantity at the stage closure", async () => {
    // The v0.1 admission event. This assignment carries no obligation — the work
    // line has no work type, so `assignments.create` materialised nothing — so
    // the stage is created by hand and closes VACUOUSLY. That is a real v0.1
    // state and the closure receipt says so, which is what stops a vacuous close
    // being read as a proved one (INV-072).
    const stage = await post(
      await import("../app/v1/assignments/[assignmentId]/stages/route"),
      { stageKey: "prykhovani-roboty", isConcealed: true }, { assignmentId });
    expect(stage.status, await stage.clone().text()).toBe(201);
    const workStageId = (await stage.json()).workStageId as string;

    const closed = await post(
      await import("../app/v1/stages/[stageId]/closures/route"),
      { expectedVersion: 1 }, { stageId: workStageId });
    expect(closed.status, await closed.clone().text()).toBe(201);
    const closure = await closed.json();
    expect(closure.vacuous).toBe(true);
    expect(closure.admission.admittedProgressEntryCount).toBe(1);
    expect(closure.admission.valued).toBe(true);

    // The money reconciles exactly as it used to, one step later.
    const { allocated, unperformed, pool } = await poolTotals();
    expect(BigInt(allocated.gross)).toBe(BigInt(allocated.net) + BigInt(allocated.tax));
    expect(unperformed.gross).toBe(unperformed.net + unperformed.tax);
    expect(BigInt(allocated.gross) + unperformed.gross).toBe(BigInt(pool.gross));
    expect(unperformed.net).toBeGreaterThan(0n);   // 6 of 10 performed

    // INV-089: the allocation names the admission that carved it, and the
    // assignment whose stage was closed.
    const rows = await q<{ closure: string | null; assignment: string | null }>(
      `select admitted_by_closure_id closure, admitted_work_assignment_id assignment
         from public.valuation_allocations where workspace_id = $1`, [fx.workspaceId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.closure).toBe(closure.stageClosureId);
    expect(rows[0]!.assignment).toBe(assignmentId);
  });

  it("4. authorizes, stages and finalizes an evidence upload", async () => {
    const intent = await (await post(
      await import("../app/v1/assignments/[assignmentId]/upload-intents/route"),
      { expectedContentHash: hashOf(JPEG), expectedByteSize: JPEG.byteLength,
        claimedMediaType: "image/jpeg", deviceCaptureId: "поле-1",
        originMethod: "native_camera", claimedCaptureTime: "2026-07-31T08:00:00+03:00" },
      { assignmentId })).json();

    await putObject(intent.storage.key, JPEG, "image/jpeg");

    const res = await post(
      await import("../app/v1/upload-intents/[intentId]/finalize/route"),
      {}, { intentId: intent.uploadIntentId });
    expect(res.status, await res.clone().text()).toBe(200);
    firstReceipt = await res.json();
    evidenceObjectId = firstReceipt.evidenceObjectId;

    const rows = await q<{
      storage_key: string; content_hash: string; inspection_status: string;
      capture_time_trust: string; relation_kind: string;
    }>(`select storage_key, content_hash, inspection_status, capture_time_trust, relation_kind
          from public.evidence_objects where id = $1`, [evidenceObjectId]);
    // Same key the intent was issued: identity is fixed at authorization.
    expect(rows[0]!.storage_key).toBe(intent.storage.key);
    expect(rows[0]!.content_hash).toBe(hashOf(JPEG));
    expect(rows[0]!.inspection_status).toBe("passed");
    expect(rows[0]!.capture_time_trust).toBe("device_claimed");
    expect(rows[0]!.relation_kind).toBe("original");
  });

  it("5. proves the evidence identity is immutable", async () => {
    await expect(q(
      `update public.evidence_objects set storage_key = 'x/y' where id = $1`,
      [evidenceObjectId])).rejects.toThrow();
    await expect(q(
      `update public.evidence_objects set content_hash = repeat('f',64) where id = $1`,
      [evidenceObjectId])).rejects.toThrow();
    await expect(q(
      `delete from public.evidence_objects where id = $1`, [evidenceObjectId]))
      .rejects.toThrow();
  });

  it("6. replays finalize and gets the identical receipt", async () => {
    const intentId = (await q<{ id: string }>(
      `select id from public.upload_intents where finalized_evidence_object_id = $1`,
      [evidenceObjectId]))[0]!.id;

    const res = await post(
      await import("../app/v1/upload-intents/[intentId]/finalize/route"), {}, { intentId });
    expect(res.status).toBe(200);
    const again = await res.json();
    expect(again.evidenceObjectId).toBe(firstReceipt.evidenceObjectId);
    expect(again.contentHash).toBe(firstReceipt.contentHash);

    const count = await q<{ n: string }>(
      `select count(*) n from public.evidence_objects where workspace_id = $1`,
      [fx.workspaceId]);
    expect(count[0]!.n).toBe("1");
  });

  it("7. returns money to the pool on a negative correction", async () => {
    const before = await poolTotals();

    const res = await post(
      await import("../app/v1/progress-entries/[entryId]/adjustments/route"),
      { quantity: "-2", reasonCode: "measurement_error" }, { entryId: rootEntryId });
    expect(res.status).toBe(201);
    expect(BigInt((await res.json()).allocation.grossMinorUnits)).toBeLessThan(0n);

    const after = await poolTotals();
    expect(BigInt(after.allocated.gross)).toBeLessThan(BigInt(before.allocated.gross));
    // The identity still closes on every component, and no root is in deficit.
    expect(BigInt(after.allocated.gross) + after.unperformed.gross).toBe(BigInt(after.pool.gross));
    expect(after.unperformed.gross).toBe(after.unperformed.net + after.unperformed.tax);

    const perRoot = await q<{ s: string }>(
      `select coalesce(sum(gross_minor_units),0)::text s from public.valuation_allocations
        where workspace_id = $1 group by root_progress_entry_id`, [fx.workspaceId]);
    for (const r of perRoot) expect(BigInt(r.s)).toBeGreaterThanOrEqual(0n);
  });

  it("8. orphans an upload whose authorization is revoked mid-flight", async () => {
    const intent = await (await post(
      await import("../app/v1/assignments/[assignmentId]/upload-intents/route"),
      { expectedContentHash: hashOf(JPEG), expectedByteSize: JPEG.byteLength,
        claimedMediaType: "image/jpeg", deviceCaptureId: "поле-2",
        originMethod: "native_camera" },
      { assignmentId })).json();
    orphanedKey = intent.storage.key;
    await putObject(orphanedKey, JPEG, "image/jpeg");

    await q(
      `update public.project_access_grants set revoked_at = now()
        where workspace_id = $1 and member_id = $2 and capability = 'evidence.record'`,
      [fx.workspaceId, fx.memberId]);

    const res = await post(
      await import("../app/v1/upload-intents/[intentId]/finalize/route"),
      {}, { intentId: intent.uploadIntentId });
    expect(res.status).toBe(403);

    const rows = await q<{ status: string }>(
      `select status from public.upload_intents where id = $1`, [intent.uploadIntentId]);
    expect(rows[0]!.status).toBe("orphaned_for_purge");

    const count = await q<{ n: string }>(
      `select count(*) n from public.evidence_objects where workspace_id = $1`,
      [fx.workspaceId]);
    expect(count[0]!.n).toBe("1");     // still only the first one
    expect(await objectExists(orphanedKey)).toBe(true);   // kept for the purge
  });

  it("9. purges the orphaned bytes and leaves the evidence untouched", async () => {
    const evidenceKey = (await q<{ storage_key: string }>(
      `select storage_key from public.evidence_objects where id = $1`, [evidenceObjectId]))[0]!
      .storage_key;

    const outcome = await drainEvidencePurge();
    expect(outcome.purged).toBeGreaterThanOrEqual(1);

    expect(await objectExists(orphanedKey)).toBe(false);
    expect(await objectExists(evidenceKey)).toBe(true);

    const count = await q<{ n: string }>(
      `select count(*) n from public.evidence_objects where workspace_id = $1`,
      [fx.workspaceId]);
    expect(count[0]!.n).toBe("1");
  });
});
