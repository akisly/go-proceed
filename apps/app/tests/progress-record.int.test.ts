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

/**
 * THE VALUATION MATRIX IS NOT IN THIS FILE ANY MORE. It moved, unchanged in
 * substance, to `admission-valuation.int.test.ts`.
 *
 * ADR-008 (Approved 2026-08-07) takes the carve out of `progress.record` and
 * puts it in the stage-closure command, and names this file as one of three that
 * assert the old ordering: «Rewriting these to keep passing without moving the
 * assertion would freeze the inverted ordering. The matrix must be exercised
 * somewhere; that somewhere is now the admission command.» So the seven matrix
 * points are gone from here rather than adapted, and what is left below is what
 * `progress.record` still does.
 *
 * What replaces them here is one assertion in the opposite direction: recording
 * writes NO allocation. That is the behaviour change, and a suite that only
 * stopped checking the old figures would not notice if the carve quietly came
 * back.
 */
describe("progress.record — records, and does not value", () => {
  const CASES = [
    { name: "a priced line", rows: [PRICED], key: "1.1" },
    { name: "a zero-priced line", rows: [ZERO_PRICE], key: "1.2" },
    { name: "a line with no price at all", rows: [NO_PRICE], key: "1.3" },
    { name: "a line whose amount a human approved", rows: [MISMATCH], key: "1.4" },
  ];

  for (const c of CASES) {
    it(`records ${c.name} and carves nothing`, async () => {
      const fx = await matrixFixture(A, {
        taxMode: "exclusive", taxRateBps: 2000, rows: c.rows, capabilities: CAPS,
        approveSourceAmounts: c.key === "1.4",
      });
      const assignmentId = await assign(fx, fx.bySourceKey[c.key]!.id);

      const res = await record(assignmentId, "1");
      expect(res.status, await res.clone().text()).toBe(201);
      const body = await res.json();

      // `admitted: false` and NOT a null allocation object. A null would be read
      // as «unvalued» — the state INV-038 reserves for a line whose price is
      // unknown — and these quantities are priced perfectly well; they simply
      // have not passed the gate (INV-089).
      expect(body.admitted).toBe(false);
      expect(body.allocation).toBeUndefined();

      const rows = await q<{ n: string }>(
        `select count(*)::text n from public.valuation_allocations
          where workspace_id = $1 and progress_entry_id = $2`,
        [fx.workspaceId, body.progressEntryId]);
      expect(rows[0]!.n).toBe("0");
    });
  }
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

  it("opens the allocation head with the entry's own quantity and no allocation beside it", async () => {
    const body = await (await record(assignmentId, "3")).json();
    const head = await q<{ effective_quantity: string; reserved_quantity: string }>(
      `select effective_quantity::text, reserved_quantity::text
         from public.progress_allocation_heads
        where workspace_id = $1 and root_progress_entry_id = $2`,
      [fx.workspaceId, body.progressEntryId]);
    expect(Number(head[0]!.effective_quantity)).toBe(3);
    expect(Number(head[0]!.reserved_quantity)).toBe(0);

    // ADR-008 §Consequences: «progress_allocation_heads gains a state it did not
    // have. A head can now exist with reserved_quantity = 0 and no allocation
    // row, for an arbitrary period.» INV-089 says no projection or command may
    // read that as an error, so it is asserted as a REQUIRED state rather than
    // being left to be discovered as a surprise.
    const allocations = await q<{ n: string }>(
      `select count(*)::text n from public.valuation_allocations where workspace_id = $1`,
      [fx.workspaceId]);
    expect(allocations[0]!.n).toBe("0");
  });

  // «allocates only the incremental slice on a second measurement» and
  // «allocates nothing beyond the contract quantity» MOVED to
  // admission-valuation.int.test.ts with the carve (ADR-008). Both are about how
  // the pool is divided, and the pool is divided at admission now; keeping a
  // weakened version here would be the rewrite ADR-008 §Consequences forbids.

  it("rejects zero and a scale beyond the unit precision", async () => {
    expect((await record(assignmentId, "0")).status).toBe(422);
    // The CSV unit resolves to 3 decimal places.
    expect((await record(assignmentId, "1.0001")).status).toBe(422);
    expect((await record(assignmentId, "1.100")).status).toBe(201);
  });

  it("replays one entry and still no allocation under a repeated Idempotency-Key", async () => {
    const key = crypto.randomUUID();
    const first = await (await record(assignmentId, "2", key)).json();
    const second = await (await record(assignmentId, "2", key)).json();
    expect(second.progressEntryId).toBe(first.progressEntryId);

    const counts = await q<{ entries: string; allocations: string }>(
      `select (select count(*) from public.progress_entries where workspace_id = $1) entries,
              (select count(*) from public.valuation_allocations where workspace_id = $1) allocations`,
      [fx.workspaceId]);
    expect(counts[0]!.entries).toBe("1");
    // Was "1" before ADR-008. A replay that produced an allocation now would mean
    // the carve came back to this route.
    expect(counts[0]!.allocations).toBe("0");
  });

  it("takes the ledger idempotency class, not the 30-day default", async () => {
    // The reason changed with ADR-008 and the requirement did not. This route no
    // longer appends money lineage — but the entry it creates is what a LATER
    // admission carves against, and a replay that re-executed instead of
    // returning the original entry id would leave a second unadmitted quantity
    // for the closure to admit. The retention has to outlive the gap between
    // recording and admission, and that gap is now unbounded.
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
