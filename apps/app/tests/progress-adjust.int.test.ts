import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq, matrixFixture, type MatrixFixture } from "./helpers/fixtures";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

/**
 * ADR-008 CHANGED WHAT THIS SUITE HAS TO SET UP, AND NOT WHAT IT ASSERTS.
 *
 * Every money case below is about a correction to quantity that ALREADY HOLDS
 * MONEY, and before ADR-008 recording was enough to make that true. It is not any
 * more: `progress.record` carves nothing and the money arrives at admission — in
 * v0.1, the stage closure. So the fixture now records AND admits, which is the
 * same state the assertions were always written against, reached the way the
 * product now reaches it. Weakening the assertions to match an unadmitted root
 * would have been the rewrite ADR-008 §Consequences forbids.
 *
 * The one genuinely NEW behaviour — a correction to quantity that was never
 * admitted moves no money, because there is none — gets its own case at the end
 * of the money block rather than being folded into an existing one.
 *
 * `stage_closures.close` is granted by hand: it is in no row of
 * responsibility-presets.csv (the M3 preset gap, migration 0045 §11 item 2).
 */
const CAPS = ["assignments.manage", "progress.record", "progress.adjust",
              "stage_closures.close"] as const;
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

/**
 * The v0.1 admission event: create the assignment's stage and close it.
 *
 * The stage is EMPTY — THIS fixture's work line carries no work type, so
 * `assignments.create` materialises no occurrence — and therefore closes
 * vacuously. That is the correct v0.1 state for a fixture about money rather
 * than about the gate; the gate itself is `m3-refusal.int.test.ts`.
 *
 * «THIS fixture's» is the correction migration 0050 forces: the sentence used to
 * say «no work line carries a work type», which was true of the whole product
 * until `public.work_items.work_type_key` existed. It is now true of untyped
 * lines only, and this fixture's line is one by choice, so the emptiness the
 * money assertions rely on is stable.
 */
async function admit(assignmentId2: string): Promise<void> {
  const { POST: createStage } = await import("../app/v1/assignments/[assignmentId]/stages/route");
  const stage = await createStage(
    jsonReq("http://x", { stageKey: "prykhovani-roboty", isConcealed: true }),
    { params: Promise.resolve({ assignmentId: assignmentId2 }) });
  if (stage.status !== 201) throw new Error(`admit/stage ${stage.status} ${await stage.text()}`);
  const stageId = (await stage.json()).workStageId as string;

  const { POST: close } = await import("../app/v1/stages/[stageId]/closures/route");
  const closed = await close(jsonReq("http://x", { expectedVersion: 1 }),
    { params: Promise.resolve({ stageId }) });
  if (closed.status !== 201) throw new Error(`admit/close ${closed.status} ${await closed.text()}`);
}

/**
 * A SECOND admission on an assignment whose first stage is already closed.
 *
 * A different stage key, because `work_stages_closable_unit_uniq` is one stage
 * per (assignment, location node, stage key). The Response is returned rather
 * than unwrapped: the failure this exists to catch is the closure transaction
 * ABORTING, which arrives as a 500 and whose body the assertion should print.
 */
async function closeSecondStage(assignmentId2: string): Promise<Response> {
  const { POST: createStage } = await import("../app/v1/assignments/[assignmentId]/stages/route");
  const stage = await createStage(
    jsonReq("http://x", { stageKey: "montazhni-roboty", isConcealed: false }),
    { params: Promise.resolve({ assignmentId: assignmentId2 }) });
  if (stage.status !== 201) throw new Error(`secondStage ${stage.status} ${await stage.text()}`);
  const stageId = (await stage.json()).workStageId as string;

  const { POST: close } = await import("../app/v1/stages/[stageId]/closures/route");
  return close(jsonReq("http://x", { expectedVersion: 1 }),
    { params: Promise.resolve({ stageId }) });
}

/** What one lineage holds: money and funded quantity, read from the rows. */
async function lineageTotals(
  workspaceId: string, rootProgressEntryId: string,
): Promise<{ gross: bigint; funded: number }> {
  const rows = await q<{ gross: string; funded: string }>(
    `select coalesce(sum(gross_minor_units),0)::text gross,
            coalesce(sum(funded_quantity),0)::text funded
       from public.valuation_allocations
      where workspace_id = $1 and root_progress_entry_id = $2`,
    [workspaceId, rootProgressEntryId]);
  return { gross: BigInt(rows[0]!.gross), funded: Number(rows[0]!.funded) };
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
  // ADR-008: recording no longer carves, so the root holds no money until a
  // closure admits it. Every money assertion below is about correcting quantity
  // that DOES hold money, which is what this line now has to produce.
  await admit(assignmentId);
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
    //
    // THIS CASE COMPARED ZERO WITH ZERO UNTIL 2026-08-08, AND ITS OWN COMMENT
    // SAID SO WHILE IT DID. It ran on the shared fixture, where the root recorded
    // in `beforeEach` measures the ten-unit line in full and therefore takes the
    // WHOLE pool (`carve` with `q >= denom`). The second root then recorded 0.001
    // against a line already fully performed — `remainingQty` 0, `sliceAllocation`
    // returns ZERO — so it held nothing, and «the other root did not lose money»
    // was true of a root that had none to lose. The comment that stood here said
    // `admit(second)` had been added «or this test would compare zero with zero
    // and pass while proving nothing»: admitting the second root was necessary
    // and it was not sufficient, because what was missing is ROOM for it to be
    // admitted into.
    //
    // So the fixture is rebuilt inside the case — 4 units on one root, 6 on the
    // other, both admitted, both holding real money on the same line. Three
    // assertions replace the one: the other root held something BEFORE (the part
    // that stops this rotting back), the corrected root actually gave its money
    // up (the part that stops a no-op correction passing), and the other root's
    // holding is unchanged (the property the case is named after).
    await truncateAll();
    const fx2 = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const item = fx2.bySourceKey["1.1"]!;

    const firstAssignment = await assign(fx2, item.id);
    const corrected = (await (await record(firstAssignment, "4")).json()).progressEntryId;
    await admit(firstAssignment);
    const secondAssignment = await assign(fx2, item.id);
    const otherRoot = (await (await record(secondAssignment, "6")).json()).progressEntryId;
    await admit(secondAssignment);

    const otherBefore = (await lineageTotals(fx2.workspaceId, otherRoot)).gross;
    const correctedBefore = (await lineageTotals(fx2.workspaceId, corrected)).gross;
    // 4 and 6 of a ten-unit line: both roots are funded, and between them they
    // hold the whole pool. Neither figure is hand-derived — the identity is what
    // is asserted, because gross is built from independently carved net and tax.
    expect(otherBefore).toBeGreaterThan(0n);
    expect(correctedBefore).toBeGreaterThan(0n);
    expect(correctedBefore + otherBefore).toBe(BigInt(item.gross));

    const back = await (await adjust(corrected, "-4")).json();
    expect(back.admitted).toBe(true);

    // The corrected root handed back everything it held...
    expect((await lineageTotals(fx2.workspaceId, corrected)).gross).toBe(0n);
    // ...and the other root is untouched, which is the whole assertion.
    expect((await lineageTotals(fx2.workspaceId, otherRoot)).gross).toBe(otherBefore);
  });

  it("leaves no root holding a negative balance", async () => {
    await adjust(rootId, "-7");
    const perRoot = await q<{ root_progress_entry_id: string; s: string }>(
      `select root_progress_entry_id, coalesce(sum(gross_minor_units),0)::text s
         from public.valuation_allocations where workspace_id = $1
        group by root_progress_entry_id`, [fx.workspaceId]);
    // The loop is over a GROUP BY and every assertion inside it is satisfied by
    // an empty result set, so a run in which no allocation was written at all
    // would pass and prove nothing. The count is asserted before the property.
    expect(perRoot.length).toBeGreaterThan(0);
    for (const r of perRoot) expect(BigInt(r.s)).toBeGreaterThanOrEqual(0n);
  });

  it("a POSITIVE correction on an admitted root carves NOTHING — it waits for the next closure", async () => {
    // THIS CASE USED TO ASSERT THE OPPOSITE, AND THAT IS THE POINT.
    //
    // It read `expect(BigInt(body.allocation.grossMinorUnits)).toBeGreaterThan(0n)`
    // — a green assertion that an unadmitted increase moves money. The v0.1
    // final review found the third route to the pool behind exactly this
    // behaviour: record a millionth of a unit, satisfy the hold honestly, close
    // the stage, then adjust upward. The lineage held money from the honest
    // closure, the old gate opened on that alone, and the increase drew
    // essentially the whole pool with `admitted_by_closure_id` NULL.
    //
    // So the assertion is MOVED, not softened. An increase is new unadmitted
    // quantity; ADR-008 says unadmitted quantity is recorded and unvalued until
    // a closure admits it. A reduction against admitted money still carves —
    // that is the question ADR-008 deliberately left open, and the next case
    // holds it.
    await truncateAll();
    const spare = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const spareAssignment = await assign(spare, spare.bySourceKey["1.1"]!.id);
    const spareRoot = (await (await record(spareAssignment, "2")).json()).progressEntryId;
    await admit(spareAssignment);

    const body = await (await adjust(spareRoot, "3")).json();
    expect(body.admitted).toBe(false);
    expect(body.allocation ?? null).toBeNull();
    expect(body.effectiveRootQuantity).toBe("5.000000");

    // And the pool did not move: no allocation exists for this lineage that no
    // closure admitted. Asserted on `admitted_by_closure_id is null` rather than
    // on a total, because a zero total is also what a written-but-zero row
    // produces, and the defect being closed here wrote a NON-zero one.
    const rows = await q<{ n: number }>(
      `select count(*)::int n from public.valuation_allocations
        where workspace_id = $1 and root_progress_entry_id = $2
          and admitted_by_closure_id is null`,
      [spare.workspaceId, spareRoot]);
    expect(rows[0]!.n).toBe(0);
  });

  it("spends a waiting increase once, at the closure that admits it", async () => {
    // WHERE THE CASE ABOVE ENDS. It stops at «the increase waits»; this one
    // carries the same lineage to the closure it waits for, which is where the
    // whole-build audit's first finding lands. It is not a leak — it is a LOCK.
    //
    // Contract quantity 10, pool P, root recorded 10 and admitted: funded 10,
    // holding all of P. Then
    //
    //   adjust +2  → no allocation; the lineage MEASURES 12 and is ADMITTED for
    //                10 (the case above asserts the row is absent).
    //   adjust −2  → until 2026-08-08 the unfunded remainder was measured against
    //                every entry of the lineage, so it read 12 − 10 = 2, the
    //                correction consumed the pending +2 as free headroom, wrote a
    //                ZERO row, and the lineage stayed funded 10.
    //   2nd stage  → the +2 is still pending, so this closure admits it as new
    //   closes       quantity: the line reads 8 performed, 2 units of contract
    //                remain, and the lineage reaches funded 12 against an
    //                effective 10. `app.assert_funded_within_lineage()`
    //                (migration 0048 §3) is DEFERRABLE INITIALLY DEFERRED, so it
    //                raises AT COMMIT: the closure rolls back — and rolls back
    //                identically on every retry. That assignment can never close
    //                another stage and its money can never be admitted, while the
    //                response says INTERNAL_ERROR with `retryable: true`.
    //
    // Three assertions, in three places, because the first two states look
    // healthy under the defect: the −2 must MOVE money (the old reading wrote a
    // zero row and reported it as an allocation), the second closure must return
    // 201 (the abort), and the settled lineage must hold the whole pool funded
    // for its effective quantity (the arithmetic that says the +2 was spent once
    // rather than twice).
    await truncateAll();
    const twice = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const item = twice.bySourceKey["1.1"]!;
    const twiceAssignment = await assign(twice, item.id);
    const twiceRoot = (await (await record(twiceAssignment, "10")).json()).progressEntryId;
    await admit(twiceAssignment);

    const admitted = await lineageTotals(twice.workspaceId, twiceRoot);
    expect(admitted.gross).toBe(BigInt(item.gross));   // the whole pool
    expect(admitted.funded).toBe(10);

    const up = await (await adjust(twiceRoot, "2")).json();
    expect(up.admitted).toBe(false);                   // waits, per the case above

    // ── the correction that used to consume the waiting increase ─────────────
    const down = await (await adjust(twiceRoot, "-2")).json();
    expect(down.admitted).toBe(true);
    // A ZERO here is the defect: it means the −2 was satisfied out of quantity
    // the pool has never been asked about, instead of out of the funding this
    // lineage actually holds.
    expect(BigInt(down.allocation.grossMinorUnits)).toBeLessThan(0n);

    const reduced = await lineageTotals(twice.workspaceId, twiceRoot);
    expect(reduced.funded).toBe(8);
    expect(reduced.gross).toBeGreaterThan(0n);
    expect(reduced.gross).toBeLessThan(BigInt(item.gross));

    // ── the second admission, which is where the abort surfaced ──────────────
    const closed = await closeSecondStage(twiceAssignment);
    expect(closed.status, await closed.clone().text()).toBe(201);
    const closure = await closed.json();
    // Exactly one entry was pending: the +2. The root and the −2 both hold
    // allocations already, and `unique (workspace_id, progress_entry_id)` means
    // neither can be admitted twice.
    expect(closure.admission.admittedProgressEntryCount).toBe(1);
    expect(closure.admission.valued).toBe(true);
    expect(BigInt(closure.admission.grossMinorUnits)).toBeGreaterThan(0n);

    // ── the settled state ────────────────────────────────────────────────────
    // Effective quantity 10 on a ten-unit line, so the lineage is funded 10 and
    // holds the pool — exactly once. Asserted as the identity `funded ===
    // head.effective_quantity` rather than against a transcribed figure, because
    // that identity is what migration 0048 §3 enforces and what the defect broke.
    const settled = await lineageTotals(twice.workspaceId, twiceRoot);
    expect(settled.funded).toBe(10);
    expect(settled.gross).toBe(BigInt(item.gross));
    const head = await q<{ effective_quantity: string }>(
      `select effective_quantity::text from public.progress_allocation_heads
        where workspace_id = $1 and root_progress_entry_id = $2`,
      [twice.workspaceId, twiceRoot]);
    expect(Number(head[0]!.effective_quantity)).toBe(settled.funded);

    // And no more of the pool than exists: the work item's allocations sum to the
    // pool and not past it, which is the over-payment half of the same finding —
    // reachable on a line whose contract quantity leaves room, and refused here
    // by arithmetic rather than by the pool running out.
    const line = await q<{ s: string }>(
      `select coalesce(sum(gross_minor_units),0)::text s
         from public.valuation_allocations where workspace_id = $1 and work_item_id = $2`,
      [twice.workspaceId, item.id]);
    expect(BigInt(line[0]!.s)).toBe(BigInt(item.gross));
  });

  it("bounds what one admission may fund by the lineage's effective quantity", async () => {
    // THE LAST CASE OF THE FAMILY ABOVE, AND IT WAS AN `it.todo` UNTIL
    // 2026-08-08. The todo said the sequence «still aborts at COMMIT» and that
    // the bound was «an ordering decision in src/lib/admission.ts». The first
    // half was true; the second was half right, and the correction is worth
    // keeping because it is why the fix is where it is. At the second admission
    // the pending list holds exactly ONE entry — the root and the −8 already hold
    // allocations — so there is no order to decide. What `admission.ts` supplies
    // is the one fact no query can: how much this admission still intends to
    // remove. The bound itself is in `sliceAllocation`.
    //
    // Contract quantity 10, pool P. THE FAMILY IS «the removal exceeds the
    // lineage's ADMITTED quantity», and this is its last member:
    //
    //   record 4  → no allocation (ADR-008).
    //   admit     → funded 4, 40 % of P.
    //   adjust +6 → an increase against an admitted root writes nothing and
    //               waits. The lineage MEASURES 10, is ADMITTED for 4.
    //   adjust −8 → removable 8, but the lineage only holds 4 funded units, so it
    //               returns exactly those: funded 0, effective 2. It commits,
    //               because 0 <= 2.
    //   2nd stage → the +6 is admitted ALONE. It used to be admitted at its own
    //               quantity: the line read 4 + (−8) = −4 admitted, so
    //               `remainingQty` came out at 14 on a ten-unit line, the entry
    //               funded 6, and the lineage reached funded 6 against an
    //               effective 2. `app.assert_funded_within_lineage()` (migration
    //               0048 §3) raised AT COMMIT — and raised identically on every
    //               retry, while the client was told `retryable: true`.
    //
    // WHY THIS IS NOT THE +2/−2 CASE ABOVE WITH DIFFERENT NUMBERS. There the
    // removal was covered by the lineage's funding, so the lineage stayed
    // consistent and the abort came from the unfunded remainder being measured
    // against unadmitted quantity — arithmetic that was fixed in the negative
    // branch. Here the removal EXCEEDS the funding, both readings of that
    // remainder reach the same place, and the −8 commits perfectly happily. The
    // defect is entirely in what the LATER admission is allowed to fund.
    //
    // 0051 DOES NOT COVER IT. That migration stops a second stage being minted
    // under a key the baseline never implied — on a COVERED line. `0051:97-113`
    // leaves an uncovered line's second stage deliberately legal, and this
    // fixture's line is uncovered, as is every line the frozen importer wrote.

    // ── the control, measured FIRST so the two never share a database ────────
    //
    // What a lineage that simply measured 2 on this line holds. The settled
    // sequence below must land on the same money, and that claim is asserted
    // rather than a transcribed figure because gross is built from
    // independently carved net and tax: re-deriving the largest-remainder
    // tie-break inside a test is how it gets derived wrongly.
    await truncateAll();
    const control = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const controlItem = control.bySourceKey["1.1"]!;
    const controlAssignment = await assign(control, controlItem.id);
    const controlRoot =
      (await (await record(controlAssignment, "2")).json()).progressEntryId;
    await admit(controlAssignment);
    const controlTotals = await lineageTotals(control.workspaceId, controlRoot);
    expect(controlTotals.funded).toBe(2);
    expect(controlTotals.gross).toBeGreaterThan(0n);

    await truncateAll();
    const over = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const item = over.bySourceKey["1.1"]!;
    const overAssignment = await assign(over, item.id);
    const overRoot = (await (await record(overAssignment, "4")).json()).progressEntryId;
    await admit(overAssignment);

    const first = await lineageTotals(over.workspaceId, overRoot);
    expect(first.funded).toBe(4);
    expect(first.gross).toBeGreaterThan(0n);
    expect(first.gross).toBeLessThan(BigInt(item.gross));

    const up = await (await adjust(overRoot, "6")).json();
    expect(up.admitted).toBe(false);

    const down = await (await adjust(overRoot, "-8")).json();
    expect(down.admitted).toBe(true);
    expect(down.effectiveRootQuantity).toBe("2.000000");

    // The correction gave back everything the lineage held and not one unit
    // more: `sliceAllocation` caps `fundedRemoved` at the funding that exists,
    // and the LOWER bound of the same deferred trigger — «a lineage cannot hand
    // back money it never received» — is what that cap is for.
    const returned = await lineageTotals(over.workspaceId, overRoot);
    expect(returned.funded).toBe(0);
    expect(returned.gross).toBe(0n);

    // ── the second admission, which used to abort at COMMIT ──────────────────
    const closed = await closeSecondStage(overAssignment);
    expect(closed.status, await closed.clone().text()).toBe(201);
    const closure = await closed.json();
    expect(closure.admission.admittedProgressEntryCount).toBe(1);
    expect(closure.admission.valued).toBe(true);

    // THE ROW IS WHERE THE BOUND IS VISIBLE, and it is asserted on the row rather
    // than only on the totals because the shape is forced rather than chosen:
    // `valuation_allocations_progress_fact_fkey` (migration 0025) pins an
    // allocation's `quantity` to its entry's, so the six units MUST be recorded
    // as six. `funded_quantity` is the separate column (migration 0022) the bound
    // lands on, and 2 of 6 satisfies
    // `valuation_allocations_funded_within_quantity_check`. The row says «six
    // units were measured, two of them drew money», which is the truth.
    const row = await q<{ quantity: string; funded_quantity: string }>(
      `select quantity::text, funded_quantity::text
         from public.valuation_allocations
        where workspace_id = $1 and progress_entry_id = $2`,
      [over.workspaceId, up.adjustmentEntryId]);
    expect(row.length).toBe(1);
    expect(row[0]!.quantity).toBe("6.000000");
    expect(Number(row[0]!.funded_quantity)).toBe(2);

    // ── the settled state ────────────────────────────────────────────────────
    const settled = await lineageTotals(over.workspaceId, overRoot);
    expect(settled.funded).toBe(2);
    const head = await q<{ effective_quantity: string }>(
      `select effective_quantity::text from public.progress_allocation_heads
        where workspace_id = $1 and root_progress_entry_id = $2`,
      [over.workspaceId, overRoot]);
    expect(Number(head[0]!.effective_quantity)).toBe(settled.funded);

    // AND THE MONEY IS THE RIGHT MONEY, NOT MERELY MONEY THAT DID NOT RAISE.
    // This is the half a funded-quantity bound does not reach on its own: the
    // line still read −4 admitted, so `remainingQty` was 14 and the two funded
    // units would have drawn 2/14 of an untouched pool instead of 2/10 — the
    // lineage short-changed and the difference left for whoever measures next.
    // `sliceAllocation` now floors a line's performed quantity at zero before
    // subtracting, on the ground that the remaining POOL and the remaining
    // QUANTITY are two sides of one figure and the pool cannot buy more units
    // than the contract has.
    //
    // The claim is the one that matters: an effective 2 is worth the same
    // whether it was measured once or reached through +6 and −8.
    expect(controlItem.gross).toBe(item.gross);   // the same line, priced the same
    expect(settled.gross).toBe(controlTotals.gross);
    expect(settled.gross).toBeGreaterThan(0n);
    expect(settled.gross).toBeLessThan(BigInt(item.gross));

    // Nothing else on the line holds anything, so the lineage's total IS the
    // line's: no second allocation was written to absorb the difference.
    const line = await q<{ s: string }>(
      `select coalesce(sum(gross_minor_units),0)::text s
         from public.valuation_allocations where workspace_id = $1 and work_item_id = $2`,
      [over.workspaceId, item.id]);
    expect(BigInt(line[0]!.s)).toBe(settled.gross);
  });

  it("writes no allocation at all when the corrected quantity was never admitted", async () => {
    // THE NEW BEHAVIOUR ADR-008 CREATES, asserted rather than inferred, AND
    // CARRIED PAST THE POINT WHERE IT USED TO STOP.
    //
    // The first version of this case ended at «the totals are still zero», which
    // is true and irrelevant: the route was writing an allocation ROW of zero
    // money against an unadmitted root, and a sum over an empty column and a sum
    // over a zero column are the same number. That row then held the one
    // allocation slot the correction will ever have — `unique (workspace_id,
    // progress_entry_id)` — and made the closure's pending set skip it, which is
    // the whole of how the corrected-then-admitted defect below arose. A passing
    // test defended it.
    //
    // So the assertion is now about the ROW, and the case runs to the admission.
    //
    // ADR-008 §"What this ADR does not decide" is the neighbouring question and
    // is NOT answered here — «whether an admitted-then-corrected quantity
    // releases its allocation, and by what command». That one still has money to
    // move; this one has none.
    await truncateAll();
    const spare = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const item = spare.bySourceKey["1.1"]!;
    const spareAssignment = await assign(spare, item.id);
    const spareRoot = (await (await record(spareAssignment, "8")).json()).progressEntryId;

    const res = await adjust(spareRoot, "-3");
    expect(res.status, await res.clone().text()).toBe(201);
    const body = await res.json();
    expect(body.effectiveRootQuantity).toBe("5.000000");
    // `admitted: false` and NO `allocation` key. A zeroed allocation object would
    // assert that money was considered and came to nothing, and a null one reads
    // as «unvalued» — the state INV-038 reserves for a line whose price is
    // unknown. This line is priced; the quantity has simply not passed the gate.
    expect(body.admitted).toBe(false);
    expect(body.allocation).toBeUndefined();

    const rows = await q<{ n: string }>(
      `select count(*)::text n from public.valuation_allocations where workspace_id = $1`,
      [spare.workspaceId]);
    expect(rows[0]!.n).toBe("0");

    // ── and now the admission, which is where the old version stopped ────────
    await admit(spareAssignment);

    const stored = await q<{
      progress_entry_id: string; quantity: string; funded_quantity: string;
      gross_minor_units: string; admitted_by_closure_id: string | null;
    }>(`select progress_entry_id, quantity::text, funded_quantity::text,
               gross_minor_units::text, admitted_by_closure_id
          from public.valuation_allocations
         where workspace_id = $1 order by created_at, id`, [spare.workspaceId]);

    // Two rows, because a lineage is admitted AS ITS ENTRIES:
    // `valuation_allocations_progress_fact_fkey` (migration 0025) pins an
    // allocation's quantity to its progress entry's, so a single row carrying the
    // effective 5 is unrepresentable. Both name the closure that carved them.
    expect(stored.map((r) => r.quantity)).toEqual(["8.000000", "-3.000000"]);
    for (const r of stored) expect(r.admitted_by_closure_id).not.toBeNull();

    // THE FIGURE THAT MATTERS. Funded quantity across the lineage is the
    // EFFECTIVE quantity — 5 — and not the recorded 8. The old path admitted the
    // root alone at 8 and left the head saying 5, with nothing comparing the two.
    const funded = stored.reduce((s, r) => s + Number(r.funded_quantity), 0);
    expect(funded).toBe(5);
    const head = await q<{ effective_quantity: string }>(
      `select effective_quantity::text from public.progress_allocation_heads
        where workspace_id = $1 and root_progress_entry_id = $2`,
      [spare.workspaceId, spareRoot]);
    expect(Number(head[0]!.effective_quantity)).toBe(funded);
    const before = stored.reduce((s, r) => s + BigInt(r.gross_minor_units), 0n);
    expect(before).toBeGreaterThan(0n);
    expect(before).toBeLessThan(BigInt(item.gross));

    // ── THE SAME CORRECTION, MADE AFTER ADMISSION ────────────────────────────
    //
    // The property the fix claims, asserted against the product rather than
    // against arithmetic transcribed into the test. Correcting 8 down to 5 must
    // land on the same money whether the correction is recorded before the
    // closure or after it — that is what «the lineage is admitted as its
    // entries, in recording order» MEANS. A hand-computed figure would re-derive
    // the rounding rule here and get it wrong: gross is derived from
    // independently carved net and tax, and 5/10 of the pool carved in one step
    // is not always 5/8 of 8/10 of it carved in two.
    await truncateAll();
    const after = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const afterAssignment = await assign(after, after.bySourceKey["1.1"]!.id);
    const afterRoot = (await (await record(afterAssignment, "8")).json()).progressEntryId;
    await admit(afterAssignment);
    const afterBody = await (await adjust(afterRoot, "-3")).json();
    expect(afterBody.admitted).toBe(true);

    const afterRows = await q<{ funded_quantity: string; gross_minor_units: string }>(
      `select funded_quantity::text, gross_minor_units::text
         from public.valuation_allocations where workspace_id = $1`, [after.workspaceId]);
    expect(afterRows.reduce((s, r) => s + Number(r.funded_quantity), 0)).toBe(funded);
    expect(afterRows.reduce((s, r) => s + BigInt(r.gross_minor_units), 0n)).toBe(before);
  });

  it("refuses to carve for a correction against a root no closure ever admitted", async () => {
    // THE EXPLOIT, IN THE SHAPE IT WAS FOUND IN. Contract quantity 10, priced
    // line, and no stage anywhere:
    //
    //   1. `progress.record 0.001` → no allocation (ADR-008, and correct).
    //   2. `progress.adjust +9.999` on that root.
    //
    // THE LITERALS ARE NOT THE REVIEW'S 0.000001 / +9.999999, AND THAT IS A
    // FINDING RATHER THAN A ROUNDING. `unit_definitions.unit_precision` defaults
    // to 3 (migration 0012:15) and `progress.record` refuses a quantity with more
    // fractional digits than its unit admits, so six-decimal dust is a 422 and
    // the review's exact call sequence is unreachable through the route. The
    // exploit is unaffected: what it needs is a first measurement small enough
    // that the correction carries essentially the whole line, and 0.001 of 10 is
    // that. Written at the precision the product actually permits, so the case
    // exercises the gate rather than the precision check.
    //
    // The route used to carve unconditionally. `work_item_performed` counts only
    // ADMITTED quantity, so step 2 saw the whole line unperformed, computed
    // remainingQty = 10 and funded ≈ 10, and handed the correction essentially
    // the entire pool — with `admitted_by_closure_id` NULL, `stage_closures`
    // empty, no occurrence decided and no stage in existence. Two calls, and
    // ADR-005's gate was irrelevant to the money.
    //
    // INV-089 is P0: «performed quantity is recorded UNVALUED until admission».
    // The assertion is therefore that NOTHING IS WRITTEN, not that a small
    // number is written.
    await truncateAll();
    const spare = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const spareAssignment = await assign(spare, spare.bySourceKey["1.1"]!.id);
    const dust = (await (await record(spareAssignment, "0.001")).json()).progressEntryId;

    const res = await adjust(dust, "9.999");
    expect(res.status, await res.clone().text()).toBe(201);
    const body = await res.json();
    expect(body.admitted).toBe(false);
    expect(body.allocation).toBeUndefined();
    expect(body.effectiveRootQuantity).toBe("10.000000");

    const census = await q<{ allocations: string; closures: string; stages: string }>(
      `select (select count(*) from public.valuation_allocations
                where workspace_id = $1)::text allocations,
              (select count(*) from public.stage_closures
                where workspace_id = $1)::text closures,
              (select count(*) from public.work_stages
                where workspace_id = $1)::text stages`,
      [spare.workspaceId]);
    expect(census[0]).toEqual({ allocations: "0", closures: "0", stages: "0" });

    // The correction itself IS recorded — INV-065 forbids readiness entering the
    // recording path, and a foreman who re-measured has re-measured. Only the
    // money waits.
    const entries = await q<{ n: string }>(
      `select count(*)::text n from public.progress_entries
        where workspace_id = $1 and entry_kind = 'adjustment'`, [spare.workspaceId]);
    expect(entries[0]!.n).toBe("1");
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
