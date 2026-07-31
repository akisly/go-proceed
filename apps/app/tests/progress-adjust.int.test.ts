import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq, matrixFixture, type MatrixFixture } from "./helpers/fixtures";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const CAPS = ["assignments.manage", "progress.record", "progress.adjust"] as const;
const PRICED = "1.1;Мурування;м2;10;199,99;1 999,90";

let fx: MatrixFixture;
let assignmentId: string;
let rootId: string;

async function assign(f: MatrixFixture, workItemId: string): Promise<string> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x", { workItemId }),
    { params: Promise.resolve({ contractId: f.contractId }) });
  return (await res.json()).assignmentId as string;
}

async function record(id: string, quantity: string): Promise<Response> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/progress/route");
  return POST(jsonReq("http://x", { quantity }), { params: Promise.resolve({ assignmentId: id }) });
}

async function adjust(
  entryId: string, quantity: string,
  over: { reasonCode?: string | null; key?: string } = {},
): Promise<Response> {
  const { POST } = await import("../app/v1/progress-entries/[entryId]/adjustments/route");
  const body: Record<string, unknown> = { quantity };
  if (over.reasonCode !== null) body.reasonCode = over.reasonCode ?? "measurement_error";
  const req = new Request("http://x", {
    method: "POST",
    headers: { "content-type": "application/json",
               "idempotency-key": over.key ?? crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ entryId }) });
}

async function allocationsFor(workItemId: string) {
  return q<{ gross_minor_units: string | null; root_progress_entry_id: string }>(
    `select gross_minor_units::text, root_progress_entry_id
       from public.valuation_allocations
      where workspace_id = $1 and work_item_id = $2 order by created_at, id`,
    [fx.workspaceId, workItemId]);
}

beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await matrixFixture(A, {
    taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
  });
  assignmentId = await assign(fx, fx.bySourceKey["1.1"]!.id);
  rootId = (await (await record(assignmentId, "10")).json()).progressEntryId;
});

describe("progress.adjust — money", () => {
  it("returns money to the pool on a negative correction", async () => {
    const item = fx.bySourceKey["1.1"]!;
    const body = await (await adjust(rootId, "-4")).json();

    expect(body.effectiveRootQuantity).toBe("6.000000");
    expect(BigInt(body.allocation.grossMinorUnits)).toBeLessThan(0n);

    const rows = await allocationsFor(item.id);
    const total = rows.reduce((s, r) => s + BigInt(r.gross_minor_units!), 0n);
    // 6 of 10 remains performed, so 6/10 of the pool stays allocated.
    expect(total).toBe(BigInt(item.gross) * 6n / 10n);
  });

  it("returns exactly what the root held when corrected away entirely", async () => {
    const item = fx.bySourceKey["1.1"]!;
    await adjust(rootId, "-10");
    const rows = await allocationsFor(item.id);
    const total = rows.reduce((s, r) => s + BigInt(r.gross_minor_units!), 0n);
    expect(total).toBe(0n);
  });

  it("never moves money between roots", async () => {
    // The defect the outside voice found in the first valuation design: a
    // correction on one root stripped money from a different one.
    const second = await assign(fx, fx.bySourceKey["1.1"]!.id);
    const otherRoot = (await (await record(second, "0.001")).json()).progressEntryId;

    const otherBefore = await q<{ s: string }>(
      `select coalesce(sum(gross_minor_units),0)::text s from public.valuation_allocations
        where workspace_id = $1 and root_progress_entry_id = $2`, [fx.workspaceId, otherRoot]);
    await adjust(rootId, "-10");
    const otherAfter = await q<{ s: string }>(
      `select coalesce(sum(gross_minor_units),0)::text s from public.valuation_allocations
        where workspace_id = $1 and root_progress_entry_id = $2`, [fx.workspaceId, otherRoot]);

    expect(otherAfter[0]!.s).toBe(otherBefore[0]!.s);
  });

  it("leaves no root holding a negative balance", async () => {
    await adjust(rootId, "-7");
    const perRoot = await q<{ root_progress_entry_id: string; s: string }>(
      `select root_progress_entry_id, coalesce(sum(gross_minor_units),0)::text s
         from public.valuation_allocations where workspace_id = $1
        group by root_progress_entry_id`, [fx.workspaceId]);
    for (const r of perRoot) expect(BigInt(r.s)).toBeGreaterThanOrEqual(0n);
  });

  it("allocates from the pool on a positive correction", async () => {
    // Its own fixture: the shared one has already performed the whole contract
    // quantity, so there would be nothing left to carve and the test would pass
    // or fail for the wrong reason.
    await truncateAll();
    const spare = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const spareAssignment = await assign(spare, spare.bySourceKey["1.1"]!.id);
    const spareRoot = (await (await record(spareAssignment, "2")).json()).progressEntryId;

    const body = await (await adjust(spareRoot, "3")).json();
    expect(BigInt(body.allocation.grossMinorUnits)).toBeGreaterThan(0n);
    expect(body.effectiveRootQuantity).toBe("5.000000");
  });

  it("reaches the same effective quantity in either order", async () => {
    await adjust(rootId, "-3");
    await adjust(rootId, "-2");
    const first = await q<{ s: string }>(
      `select sum(quantity)::text s from public.progress_entries
        where workspace_id = $1 and (id = $2 or root_progress_entry_id = $2)`,
      [fx.workspaceId, rootId]);

    await truncateAll();
    const fx2 = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const a2 = await assign(fx2, fx2.bySourceKey["1.1"]!.id);
    const root2 = (await (await record(a2, "10")).json()).progressEntryId;
    await adjust(root2, "-2");
    await adjust(root2, "-3");
    const second = await q<{ s: string }>(
      `select sum(quantity)::text s from public.progress_entries
        where workspace_id = $1 and (id = $2 or root_progress_entry_id = $2)`,
      [fx2.workspaceId, root2]);

    expect(Number(second[0]!.s)).toBe(Number(first[0]!.s));
  });
});

describe("progress.adjust — invariants", () => {
  it("refuses an adjustment whose target is itself an adjustment (INV-023)", async () => {
    const adjustmentId = (await (await adjust(rootId, "-1")).json()).adjustmentEntryId;
    const res = await adjust(adjustmentId, "-1");
    // The route's lookup demands entry_kind = 'root', so an adjustment id is
    // simply not a valid target — it does not resolve at all.
    expect(res.status).toBe(404);

    const rows = await q<{ n: string }>(
      `select count(*) n from public.progress_entries
        where workspace_id = $1 and root_progress_entry_id = $2`,
      [fx.workspaceId, adjustmentId]);
    expect(rows[0]!.n).toBe("0");
  });

  it("refuses to drive effective quantity below zero (INV-024)", async () => {
    const res = await adjust(rootId, "-11");
    expect(res.status).toBe(422);
    expect((await res.json()).fieldErrors[0].path).toBe("quantity");

    const rows = await q<{ n: string }>(
      `select count(*) n from public.progress_entries
        where workspace_id = $1 and entry_kind = 'adjustment'`, [fx.workspaceId]);
    expect(rows[0]!.n).toBe("0");
  });

  it("refuses to cross reserved quantity (INV-025)", async () => {
    // Seeded directly: nothing in M2-A reserves, because claims arrive in M4.
    // Without seeding this branch would ship untested.
    await q(
      `update public.progress_allocation_heads
          set reserved_quantity = 7, current_unaccepted_reserved_quantity = 7
        where workspace_id = $1 and root_progress_entry_id = $2`,
      [fx.workspaceId, rootId]);

    const blocked = await adjust(rootId, "-4"); // 10 - 4 = 6 < 7 reserved
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).code).toBe("VERSION_CONFLICT");

    const allowed = await adjust(rootId, "-3"); // 10 - 3 = 7, exactly the reserve
    expect(allowed.status).toBe(201);
  });

  it("keeps the head in step with the entries", async () => {
    await adjust(rootId, "-4");
    const head = await q<{ effective_quantity: string; version: string }>(
      `select effective_quantity::text, version::text from public.progress_allocation_heads
        where workspace_id = $1 and root_progress_entry_id = $2`, [fx.workspaceId, rootId]);
    expect(Number(head[0]!.effective_quantity)).toBe(6);
    expect(Number(head[0]!.version)).toBeGreaterThan(1);
  });

  it("rejects a zero adjustment and a missing reason", async () => {
    expect((await adjust(rootId, "0")).status).toBe(422);
    expect((await adjust(rootId, "-1", { reasonCode: null })).status).toBe(422);
  });
});

describe("progress.adjust — access and replay", () => {
  it("replays one adjustment and one allocation under a repeated key", async () => {
    const key = crypto.randomUUID();
    const first = await (await adjust(rootId, "-2", { key })).json();
    const second = await (await adjust(rootId, "-2", { key })).json();
    expect(second.adjustmentEntryId).toBe(first.adjustmentEntryId);

    const counts = await q<{ adjustments: string; allocations: string }>(
      `select (select count(*) from public.progress_entries
                where workspace_id = $1 and entry_kind = 'adjustment') adjustments,
              (select count(*) from public.valuation_allocations
                where workspace_id = $1) allocations`, [fx.workspaceId]);
    expect(counts[0]!.adjustments).toBe("1");
    expect(counts[0]!.allocations).toBe("2"); // the root's plus the adjustment's
  });

  it("denies a caller holding only progress.record", async () => {
    const bare = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED],
      capabilities: ["assignments.manage", "progress.record"],
    });
    const bareAssignment = await assign(bare, bare.bySourceKey["1.1"]!.id);
    const bareRoot = (await (await record(bareAssignment, "5")).json()).progressEntryId;
    const res = await adjust(bareRoot, "-1");
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("hides another workspace's root", async () => {
    current = B;
    const res = await adjust(rootId, "-1");
    expect([403, 404]).toContain(res.status);
  });
});
