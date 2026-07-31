import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import {
  q, truncateAll, jsonReq, matrixFixture, createBatch, addFile, getBatch,
  type MatrixFixture,
} from "./helpers/fixtures";
import { inParallel, fulfilled } from "./helpers/concurrency";
import { putObject } from "../src/lib/evidence-storage";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const CAPS = ["assignments.manage", "progress.record", "progress.adjust", "evidence.record"] as const;
const PRICED = "1.1;Мурування;м2;10;199,99;1 999,90";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const hashOf = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

let fx: MatrixFixture;
let assignmentId: string;

const keyed = (body: unknown, key: string) => new Request("http://x", {
  method: "POST",
  headers: { "content-type": "application/json", "idempotency-key": key },
  body: JSON.stringify(body),
});

async function assign(f: MatrixFixture): Promise<string> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x", { workItemId: f.bySourceKey["1.1"]!.id }),
    { params: Promise.resolve({ contractId: f.contractId }) });
  return (await res.json()).assignmentId as string;
}

async function record(quantity: string, key: string): Promise<Response> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/progress/route");
  return POST(keyed({ quantity }, key), { params: Promise.resolve({ assignmentId }) });
}

beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await matrixFixture(A, {
    taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
  });
  assignmentId = await assign(fx);
});

describe("the work-item lock actually serializes money", () => {
  it("never allocates more than the pool under parallel measurements", async () => {
    // DIFFERENT idempotency keys, so idempotency cannot be what saves this — the
    // advisory lock on the work item is. Five callers each claim four units of a
    // ten-unit contract quantity; the pool must still close exactly.
    const results = await inParallel(5, (i) => record("4", `race-${i}`));
    const created = fulfilled(results).filter((r) => r.status === 201);
    expect(created.length).toBe(5);

    const item = fx.bySourceKey["1.1"]!;
    const totals = await q<{ gross: string; performed: string }>(
      `select coalesce(sum(v.gross_minor_units),0)::text gross,
              (select coalesce(sum(p.quantity),0)::text from public.progress_entries p
                where p.workspace_id = $1 and p.work_item_id = $2) performed
         from public.valuation_allocations v
        where v.workspace_id = $1 and v.work_item_id = $2`,
      [fx.workspaceId, item.id]);

    expect(Number(totals[0]!.performed)).toBe(20);          // over-contract on purpose
    // Twenty units performed against a ten-unit contract: the pool is fully
    // allocated and not a minor unit more.
    expect(totals[0]!.gross).toBe(item.gross);
  });

  it("reaches the same totals in parallel as it does one at a time", async () => {
    // The property a concurrency test should assert: contention changes the
    // interleaving, not the answer. Comparing against a hand-computed figure
    // would instead re-derive the rounding rule in the test, and get it wrong —
    // gross is DERIVED from independently carved net and tax, so it is not
    // simply a share of the pool's gross.
    const parallel = await inParallel(4, (i) => record("2", `slice-${i}`));
    expect(fulfilled(parallel).filter((r) => r.status === 201).length).toBe(4);

    const totalsFor = async (workspaceId: string, workItemId: string) =>
      (await q<{ net: string; tax: string; gross: string }>(
        `select coalesce(sum(net_minor_units),0)::text net,
                coalesce(sum(tax_minor_units),0)::text tax,
                coalesce(sum(gross_minor_units),0)::text gross
           from public.valuation_allocations
          where workspace_id = $1 and work_item_id = $2`,
        [workspaceId, workItemId]))[0]!;

    const item = fx.bySourceKey["1.1"]!;
    const raced = await totalsFor(fx.workspaceId, item.id);

    const rows = await q<{ net: string; tax: string; gross: string }>(
      `select net_minor_units::text net, tax_minor_units::text tax,
              gross_minor_units::text gross
         from public.valuation_allocations where workspace_id = $1 and work_item_id = $2`,
      [fx.workspaceId, item.id]);
    for (const r of rows) {
      // Coupling holds slice by slice, not merely in the total.
      expect(BigInt(r.gross)).toBe(BigInt(r.net) + BigInt(r.tax));
      expect(BigInt(r.gross)).toBeGreaterThanOrEqual(0n);
    }
    expect(BigInt(raced.gross)).toBeLessThanOrEqual(BigInt(item.gross));

    // The same four measurements, sequentially, in a fresh world.
    await truncateAll();
    const serial = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    assignmentId = await assign(serial);
    for (let i = 0; i < 4; i++) await record("2", `serial-${i}`);
    const oneAtATime = await totalsFor(serial.workspaceId, serial.bySourceKey["1.1"]!.id);

    expect(raced).toEqual(oneAtATime);
  });
});

describe("idempotency under contention", () => {
  it("creates one entry and one allocation for one repeated key", async () => {
    const key = crypto.randomUUID();
    const results = await inParallel(4, () => record("3", key));
    const ok = fulfilled(results).filter((r) => r.status === 201);
    expect(ok.length).toBe(4);   // all replays, none rejected

    const counts = await q<{ entries: string; allocations: string }>(
      `select (select count(*) from public.progress_entries where workspace_id = $1) entries,
              (select count(*) from public.valuation_allocations where workspace_id = $1) allocations`,
      [fx.workspaceId]);
    expect(counts[0]!.entries).toBe("1");
    expect(counts[0]!.allocations).toBe("1");
  });
});

describe("parallel adjustments on one root", () => {
  it("serialize on the allocation head and never go negative", async () => {
    const root = (await (await record("10", crypto.randomUUID())).json()).progressEntryId;
    const { POST } = await import("../app/v1/progress-entries/[entryId]/adjustments/route");

    // Four callers each try to remove three of the ten units. Whatever mix
    // succeeds, the effective quantity must never fall below zero.
    const results = await inParallel(4, (i) => POST(
      keyed({ quantity: "-3", reasonCode: "measurement_error" }, `adj-${i}`),
      { params: Promise.resolve({ entryId: root }) }));

    const accepted = fulfilled(results).filter((r) => r.status === 201).length;
    expect(accepted).toBeGreaterThanOrEqual(3);

    const effective = await q<{ s: string }>(
      `select coalesce(sum(quantity),0)::text s from public.progress_entries
        where workspace_id = $1 and (id = $2 or root_progress_entry_id = $2)`,
      [fx.workspaceId, root]);
    expect(Number(effective[0]!.s)).toBeGreaterThanOrEqual(0);

    const head = await q<{ effective_quantity: string }>(
      `select effective_quantity::text from public.progress_allocation_heads
        where workspace_id = $1 and root_progress_entry_id = $2`, [fx.workspaceId, root]);
    // The head agrees with the entries after the dust settles.
    expect(Number(head[0]!.effective_quantity)).toBe(Number(effective[0]!.s));
  });
});

describe("parallel finalize on one upload intent", () => {
  it("creates exactly one evidence object", async () => {
    const { POST: createIntent } = await import(
      "../app/v1/assignments/[assignmentId]/upload-intents/route");
    const intent = await (await createIntent(jsonReq("http://x", {
      expectedContentHash: hashOf(JPEG), expectedByteSize: JPEG.byteLength,
      claimedMediaType: "image/jpeg", deviceCaptureId: "device-1",
      originMethod: "native_camera",
    }), { params: Promise.resolve({ assignmentId }) })).json();
    await putObject(intent.storage.key, JPEG, "image/jpeg");

    const { POST: finalize } = await import(
      "../app/v1/upload-intents/[intentId]/finalize/route");
    const results = await inParallel(4, () => finalize(jsonReq("http://x", {}),
      { params: Promise.resolve({ intentId: intent.uploadIntentId }) }));

    const rows = await q<{ n: string }>(
      `select count(*) n from public.evidence_objects where workspace_id = $1`,
      [fx.workspaceId]);
    expect(rows[0]!.n).toBe("1");

    // EVERY caller succeeds, not just the one that won. Asserting only on the
    // 200s hid a real defect: the losers used to receive 500 from an unhandled
    // unique violation, and the caller most likely to be racing here is the
    // client retrying because it is unsure the first call landed.
    const statuses = fulfilled(results).map((r) => r.status);
    expect(statuses).toEqual([200, 200, 200, 200]);

    const bodies = await Promise.all(fulfilled(results).map((r) => r.json()));
    const ids = new Set(bodies.map((b) => b.evidenceObjectId));
    expect(ids.size).toBe(1);
    for (const b of bodies) expect(b.contentHash).toBe(bodies[0]!.contentHash);
  });
});

describe("v0.1-M1 carry-over", () => {
  it("publishes one contract version from two parallel publishes of one batch", async () => {
    // M1 reasoned about the contract row lock and never demonstrated it. This is
    // the demonstration, carried over as the review asked.
    const csv =
      "Шифр;Назва;Од;К-сть;Ціна;Сума\n" +
      "2.1;Опорядження;м2;8;120,00;960,00\n";
    const batchId = await createBatch(fx.contractId);
    await addFile(batchId, "кошторис-2.csv", new TextEncoder().encode(csv));

    const { POST: validate } = await import("../app/v1/import-batches/[batchId]/validate/route");
    await validate(jsonReq("http://x", {
      mapping: { sourceKey: "A", description: "B", unit: "C", quantity: "D",
                 unitPrice: "E", amount: "F" },
      config: { headerRow: 1 }, expectedVersion: 2,
    }), { params: Promise.resolve({ batchId }) });

    const view = await (await getBatch(batchId)).json();
    const before = await q<{ n: string }>(
      `select count(*) n from public.contract_versions where workspace_id = $1`,
      [fx.workspaceId]);

    const { POST: publish } = await import("../app/v1/import-batches/[batchId]/publish/route");
    await inParallel(3, () => publish(jsonReq("http://x", {
      expectedVersion: view.version, confirmedManifestHash: view.sourceManifestHash,
    }), { params: Promise.resolve({ batchId }) }));

    const after = await q<{ n: string }>(
      `select count(*) n from public.contract_versions where workspace_id = $1`,
      [fx.workspaceId]);
    expect(Number(after[0]!.n) - Number(before[0]!.n)).toBe(1);
  });
});

describe("the storage quota holds under contention", () => {
  it("does not let concurrent creations oversubscribe the limit", async () => {
    // Read-then-reserve is check-then-act: without a per-workspace lock all
    // callers read the same total, all find room, and all reserve.
    const bytes = JPEG.byteLength;
    await q(`update public.organizations set evidence_quota_bytes = $2 where id = $1`,
      [fx.workspaceId, bytes * 2]);

    const { POST } = await import("../app/v1/assignments/[assignmentId]/upload-intents/route");
    const results = await inParallel(5, (i) => POST(keyed({
      expectedContentHash: hashOf(JPEG), expectedByteSize: bytes,
      claimedMediaType: "image/jpeg", deviceCaptureId: `d-${i}`,
      originMethod: "native_camera",
    }, `quota-${i}`), { params: Promise.resolve({ assignmentId }) }));

    const created = fulfilled(results).filter((r) => r.status === 201).length;
    const refused = fulfilled(results).filter((r) => r.status === 422).length;
    expect(created).toBe(2);
    expect(refused).toBe(3);

    const reserved = await q<{ s: string }>(
      `select coalesce(sum(quota_reserved_bytes),0)::text s from public.upload_intents
        where workspace_id = $1 and status = 'intent_authorized'`, [fx.workspaceId]);
    expect(Number(reserved[0]!.s)).toBeLessThanOrEqual(bytes * 2);
  });
});

