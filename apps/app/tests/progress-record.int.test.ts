import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq, matrixFixture, type MatrixFixture } from "./helpers/fixtures";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const CAPS = ["assignments.manage", "progress.record", "progress.adjust"] as const;

// Column A is the source key the fixture indexes by.
const PRICED = "1.1;Мурування;м2;10;199,99;1 999,90";
const ZERO_PRICE = "1.2;Демонтаж;м2;4;0,00;0,00";
const NO_PRICE = "1.3;Резерв;м2;5;;";
const MISMATCH = "1.4;Утеплення;м2;10;100,00;1 500,00";

async function assign(fx: MatrixFixture, workItemId: string): Promise<string> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x", { workItemId }),
    { params: Promise.resolve({ contractId: fx.contractId }) });
  if (res.status !== 201) throw new Error(`assign failed ${res.status} ${await res.text()}`);
  return (await res.json()).assignmentId as string;
}

async function record(assignmentId: string, quantity: string, key?: string): Promise<Response> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/progress/route");
  const req = new Request("http://x", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key ?? crypto.randomUUID() },
    body: JSON.stringify({ quantity }),
  });
  return POST(req, { params: Promise.resolve({ assignmentId }) });
}

beforeEach(async () => {
  await truncateAll();
  current = A;
});

describe("progress.record — the valuation matrix", () => {
  // v0.1-M1 passed 340 tests while inclusive tax double-counted VAT, because
  // every fixture was exclusive, priced and unit-price-derived. Each row here is
  // a point the old suite never reached.
  const CASES = [
    { name: "exclusive / known price", taxMode: "exclusive" as const, taxRateBps: 2000,
      rows: [PRICED], key: "1.1", valued: true },
    { name: "inclusive / known price", taxMode: "inclusive" as const, taxRateBps: 2000,
      rows: [PRICED], key: "1.1", valued: true },
    { name: "exempt / known price", taxMode: "exempt" as const,
      rows: [PRICED], key: "1.1", valued: true },
    { name: "out_of_scope / known price", taxMode: "out_of_scope" as const,
      rows: [PRICED], key: "1.1", valued: true },
    { name: "unknown tax basis", taxMode: "unknown" as const,
      rows: [PRICED], key: "1.1", valued: false, reason: "unknown_tax_basis" },
    { name: "exclusive / zero price is genuinely free", taxMode: "exclusive" as const,
      taxRateBps: 2000, rows: [ZERO_PRICE], key: "1.2", valued: true },
    { name: "exclusive / missing price is unknown, not free", taxMode: "exclusive" as const,
      taxRateBps: 2000, rows: [NO_PRICE], key: "1.3", valued: false,
      reason: "missing_unit_price" },
  ];

  for (const c of CASES) {
    it(`allocates correctly for ${c.name}`, async () => {
      const fx = await matrixFixture(A, {
        taxMode: c.taxMode, taxRateBps: c.taxRateBps, rows: c.rows, capabilities: CAPS,
      });
      const item = fx.bySourceKey[c.key]!;
      const assignmentId = await assign(fx, item.id);

      const res = await record(assignmentId, "1");
      expect(res.status, await res.clone().text()).toBe(201);
      const body = await res.json();

      expect(body.allocation.valued).toBe(c.valued);
      if (c.valued) {
        expect(body.allocation.unvaluedReason).toBeNull();
        expect(body.allocation.netMinorUnits).not.toBeNull();
        // gross = net + tax always holds, for every tax mode.
        expect(BigInt(body.allocation.grossMinorUnits))
          .toBe(BigInt(body.allocation.netMinorUnits) + BigInt(body.allocation.taxMinorUnits));
      } else {
        expect(body.allocation.unvaluedReason).toBe(c.reason);
        expect(body.allocation.netMinorUnits).toBeNull();
        expect(body.allocation.taxMinorUnits).toBeNull();
        expect(body.allocation.grossMinorUnits).toBeNull();
      }

      // The stored row agrees with the receipt: an unvalued slice stores NULLs
      // and a reason, never a zero that M6 could not tell from free work.
      const rows = await q<{
        net_minor_units: string | null; unvalued_reason: string | null;
      }>(`select net_minor_units::text, unvalued_reason from public.valuation_allocations
           where workspace_id = $1 and progress_entry_id = $2`,
        [fx.workspaceId, body.progressEntryId]);
      expect(rows.length).toBe(1);
      expect(rows[0]!.unvalued_reason).toBe(c.valued ? null : c.reason);
      if (!c.valued) expect(rows[0]!.net_minor_units).toBeNull();
    });
  }

  it("values an approved-source-amount item even though its price is derived", async () => {
    // The resolution path: a human approved the stated amount over the derived
    // one, so the basis is authoritative regardless of the unit price.
    const fx = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [MISMATCH],
      approveSourceAmounts: true, capabilities: CAPS,
    });
    const item = fx.bySourceKey["1.4"]!;
    expect(item.valuationBasis).toBe("approved_source_amount");

    const assignmentId = await assign(fx, item.id);
    const body = await (await record(assignmentId, "1")).json();
    expect(body.allocation.valued).toBe(true);
  });

  it("does not double-count tax under inclusive mode", async () => {
    // The exact defect the M1 review found. Allocating the whole quantity must
    // hand back the whole pool and no more.
    const fx = await matrixFixture(A, {
      taxMode: "inclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const item = fx.bySourceKey["1.1"]!;
    const assignmentId = await assign(fx, item.id);
    const body = await (await record(assignmentId, "10")).json();

    expect(body.allocation.grossMinorUnits).toBe(item.gross);
    expect(body.allocation.netMinorUnits).toBe(item.net);
    expect(body.allocation.taxMinorUnits).toBe(item.tax);
  });
});

describe("progress.record — behaviour", () => {
  let fx: MatrixFixture;
  let assignmentId: string;

  beforeEach(async () => {
    fx = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    assignmentId = await assign(fx, fx.bySourceKey["1.1"]!.id);
  });

  it("opens the allocation head with the entry's own quantity", async () => {
    const body = await (await record(assignmentId, "3")).json();
    const head = await q<{ effective_quantity: string; reserved_quantity: string }>(
      `select effective_quantity::text, reserved_quantity::text
         from public.progress_allocation_heads
        where workspace_id = $1 and root_progress_entry_id = $2`,
      [fx.workspaceId, body.progressEntryId]);
    expect(Number(head[0]!.effective_quantity)).toBe(3);
    expect(Number(head[0]!.reserved_quantity)).toBe(0);
  });

  it("allocates only the incremental slice on a second measurement", async () => {
    const first = await (await record(assignmentId, "4")).json();
    const second = await (await record(assignmentId, "6")).json();
    const item = fx.bySourceKey["1.1"]!;
    // Together they consume the whole within-contract pool, once.
    expect(BigInt(first.allocation.grossMinorUnits) + BigInt(second.allocation.grossMinorUnits))
      .toBe(BigInt(item.gross));
  });

  it("allocates nothing beyond the contract quantity", async () => {
    await record(assignmentId, "10");
    const over = await (await record(assignmentId, "5")).json();
    expect(BigInt(over.allocation.grossMinorUnits)).toBe(0n);

    const total = await q<{ s: string }>(
      `select coalesce(sum(gross_minor_units),0)::text s from public.valuation_allocations
        where workspace_id = $1 and work_item_id = $2`,
      [fx.workspaceId, fx.bySourceKey["1.1"]!.id]);
    expect(total[0]!.s).toBe(fx.bySourceKey["1.1"]!.gross);
  });

  it("rejects zero and a scale beyond the unit precision", async () => {
    expect((await record(assignmentId, "0")).status).toBe(422);
    // The CSV unit resolves to 3 decimal places.
    expect((await record(assignmentId, "1.0001")).status).toBe(422);
    expect((await record(assignmentId, "1.100")).status).toBe(201);
  });

  it("replays one entry and one allocation under a repeated Idempotency-Key", async () => {
    const key = crypto.randomUUID();
    const first = await (await record(assignmentId, "2", key)).json();
    const second = await (await record(assignmentId, "2", key)).json();
    expect(second.progressEntryId).toBe(first.progressEntryId);

    const counts = await q<{ entries: string; allocations: string }>(
      `select (select count(*) from public.progress_entries where workspace_id = $1) entries,
              (select count(*) from public.valuation_allocations where workspace_id = $1) allocations`,
      [fx.workspaceId]);
    expect(counts[0]!.entries).toBe("1");
    expect(counts[0]!.allocations).toBe("1");
  });

  it("takes the ledger idempotency class, not the 30-day default", async () => {
    // Progress appends money lineage, so the record must stay replayable for the
    // audit retention window (TODOS.md carried this as a deferred M1 finding).
    await record(assignmentId, "1");
    const rows = await q<{ expires_at: string; created_at: string }>(
      `select expires_at::text, created_at::text from public.idempotency_records
        where operation_id = 'progress.record'`);
    const days = (new Date(rows[0]!.expires_at).getTime()
      - new Date(rows[0]!.created_at).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(400);
  });

  it("denies a caller without progress.record", async () => {
    const bare = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED],
      capabilities: ["assignments.manage"],
    });
    const bareAssignment = await assign(bare, bare.bySourceKey["1.1"]!.id);
    const res = await record(bareAssignment, "1");
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("hides another workspace's assignment", async () => {
    current = B;
    const res = await record(assignmentId, "1");
    expect([403, 404]).toContain(res.status);
  });
});
