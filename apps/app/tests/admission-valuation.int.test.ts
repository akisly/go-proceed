import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq, matrixFixture, type MatrixFixture } from "./helpers/fixtures";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No `vitest`, no `tsc`, no `psql`, no
 * `supabase`; no route was invoked and no migration applied. Static reading is
 * the only check that was available, and no claim is made that any assertion
 * below passes.
 *
 * ---------------------------------------------------------------------------
 * THE VALUATION MATRIX, MOVED — NOT REWRITTEN.
 *
 * ADR-008 §Consequences names three files that assert the old ordering and says
 * what must happen to them: «Rewriting these to keep passing without moving the
 * assertion would freeze the inverted ordering. The matrix must be exercised
 * somewhere; that somewhere is now the admission command.» This file is that
 * somewhere. Every case below came from `progress-record.int.test.ts` §"the
 * valuation matrix" unchanged in substance — the same seven points of the
 * tax_mode × unit_price_state × valuation_basis matrix, the same expectations
 * about what is valued and what is not — and only the moment the money appears
 * has moved from `progress.record`'s 201 to `stage_closures.create`'s.
 *
 * v0.1-M1 shipped 340 green tests while inclusive tax double-counted VAT because
 * every fixture was exclusive, priced and unit-price-derived. Losing the matrix
 * in the move would re-open exactly that door, which is why it is moved rather
 * than deleted and why each case still reads the STORED row and not only the
 * receipt.
 *
 * ---------------------------------------------------------------------------
 * WHY THE STAGE HERE IS EMPTY, AND WHY THAT IS THE RIGHT FIXTURE FOR MONEY.
 *
 * `matrixFixture` publishes through the importer, so its work lines carry no
 * work type and `assignments.create` materialises no occurrence and no stage
 * (`src/lib/requirement-materialisation.ts`, `workTypeKeyOf`). The stage is
 * therefore created by `work_stages.create` and closes VACUOUSLY — `∀` over an
 * empty set is true. That is a real v0.1 state, it is the one INV-072 warns
 * about, and it is the only fixture in which the money path can be exercised
 * WITHOUT the refusal path also being under test: this file is about arithmetic,
 * and `m3-refusal.int.test.ts` is about the gate.
 *
 * Every closure below therefore asserts `vacuous: true` as a precondition rather
 * than ignoring it. A vacuous closure that stopped being vacuous would mean
 * these fixtures now carry obligations — at which point the money assertions
 * would be running behind a gate nobody told them about, and they should fail
 * loudly rather than quietly change meaning.
 *
 * WHAT WOULD MAKE THAT HAPPEN CHANGED ON 2026-08-08, and the precondition is
 * worth keeping for the NEW reason rather than the old one. Migration 0050 lands
 * `public.work_items.work_type_key`, so «no line in the product carries a work
 * type» is no longer why these stages are empty. `matrixFixture` is why: it
 * publishes through the importer, ADR-006 decision 6 freezes import expansion so
 * the importer writes NULL, and INV-015 freezes the published line — an imported
 * baseline can therefore NEVER acquire a work type. These closures are vacuous
 * permanently and by construction, not pending a slice. If one ever stops being
 * vacuous, the cause is that the importer was taught to write a work type, which
 * is the change migration 0050 §6.2 says must move the publish-time disclosure
 * to `import_batches.publish` in the same slice.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

// `stage_closures.close` is granted by hand here because it is in NO row of
// technical/permissions/responsibility-presets.csv — the M3 preset gap, recorded
// by migration 0045 §11 item 2 and unresolved at the time this file was written.
// A fixture that grants a capability no persona holds is exactly the shape of a
// gap a fixture hides (M1 review finding 8), so it is named here rather than
// slipped into a list.
const CAPS = ["assignments.manage", "progress.record", "progress.adjust",
              "stage_closures.close"] as const;

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
  return POST(new Request("http://x", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key ?? crypto.randomUUID() },
    body: JSON.stringify({ quantity }),
  }), { params: Promise.resolve({ assignmentId }) });
}

async function createStage(assignmentId: string): Promise<string> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/stages/route");
  const res = await POST(jsonReq("http://x",
    { stageKey: "prykhovani-roboty", isConcealed: true }),
    { params: Promise.resolve({ assignmentId }) });
  if (res.status !== 201) throw new Error(`createStage ${res.status} ${await res.text()}`);
  return (await res.json()).workStageId as string;
}

async function close(stageId: string, expectedVersion = 1): Promise<Response> {
  const { POST } = await import("../app/v1/stages/[stageId]/closures/route");
  return POST(jsonReq("http://x", { expectedVersion }),
    { params: Promise.resolve({ stageId }) });
}

/** Record, then admit by closing the assignment's only (empty) stage. */
async function recordAndAdmit(
  assignmentId: string, quantities: string[],
): Promise<{ entryIds: string[]; closure: any }> {
  const entryIds: string[] = [];
  for (const qty of quantities) {
    const res = await record(assignmentId, qty);
    if (res.status !== 201) throw new Error(`record ${res.status} ${await res.text()}`);
    entryIds.push((await res.json()).progressEntryId as string);
  }
  const stageId = await createStage(assignmentId);
  const res = await close(stageId);
  if (res.status !== 201) throw new Error(`close ${res.status} ${await res.text()}`);
  return { entryIds, closure: await res.json() };
}

beforeEach(async () => {
  await truncateAll();
  current = A;
});

describe("admission — the valuation matrix, at the stage closure", () => {
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
    it(`admits correctly for ${c.name}`, async () => {
      const fx = await matrixFixture(A, {
        taxMode: c.taxMode, taxRateBps: c.taxRateBps, rows: c.rows, capabilities: CAPS,
      });
      const assignmentId = await assign(fx, fx.bySourceKey[c.key]!.id);
      const { entryIds, closure } = await recordAndAdmit(assignmentId, ["1"]);

      expect(closure.vacuous).toBe(true);
      expect(closure.admission.admittedProgressEntryCount).toBe(1);
      expect(closure.admission.admittedProgressEntryIds).toEqual(entryIds);
      expect(closure.admission.valued).toBe(c.valued);

      if (c.valued) {
        expect(closure.admission.unvaluedReason).toBeNull();
        // gross = net + tax always holds, for every tax mode.
        expect(BigInt(closure.admission.grossMinorUnits))
          .toBe(BigInt(closure.admission.netMinorUnits)
              + BigInt(closure.admission.taxMinorUnits));
      } else {
        expect(closure.admission.unvaluedReason).toBe(c.reason);
        expect(closure.admission.netMinorUnits).toBeNull();
      }

      // The stored row agrees with the receipt AND names the admission that
      // carved it: an unvalued slice stores NULLs and a reason, never a zero
      // M6 could not tell from free work (INV-038).
      const rows = await q<{
        net_minor_units: string | null; unvalued_reason: string | null;
        admitted_by_closure_id: string | null; admitted_work_assignment_id: string | null;
      }>(`select net_minor_units::text, unvalued_reason,
                 admitted_by_closure_id, admitted_work_assignment_id
            from public.valuation_allocations
           where workspace_id = $1 and progress_entry_id = $2`,
        [fx.workspaceId, entryIds[0]]);
      expect(rows.length).toBe(1);
      expect(rows[0]!.unvalued_reason).toBe(c.valued ? null : c.reason);
      if (!c.valued) expect(rows[0]!.net_minor_units).toBeNull();
      // INV-089: the allocation names the admission that carved it.
      expect(rows[0]!.admitted_by_closure_id).toBe(closure.stageClosureId);
      expect(rows[0]!.admitted_work_assignment_id).toBe(assignmentId);
    });
  }

  it("values an approved-source-amount item even though its price is derived", async () => {
    const fx = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [MISMATCH],
      approveSourceAmounts: true, capabilities: CAPS,
    });
    const item = fx.bySourceKey["1.4"]!;
    expect(item.valuationBasis).toBe("approved_source_amount");

    const assignmentId = await assign(fx, item.id);
    const { closure } = await recordAndAdmit(assignmentId, ["1"]);
    expect(closure.admission.valued).toBe(true);
  });

  it("does not double-count tax under inclusive mode", async () => {
    // The exact defect the M1 review found. Admitting the whole quantity must
    // hand back the whole pool and no more.
    const fx = await matrixFixture(A, {
      taxMode: "inclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const item = fx.bySourceKey["1.1"]!;
    const assignmentId = await assign(fx, item.id);
    const { closure } = await recordAndAdmit(assignmentId, ["10"]);

    expect(closure.admission.grossMinorUnits).toBe(item.gross);
    expect(closure.admission.netMinorUnits).toBe(item.net);
    expect(closure.admission.taxMinorUnits).toBe(item.tax);
  });
});

describe("admission — several entries admitted by one closure", () => {
  it("gives each entry the slice it would have had at recording time", async () => {
    // THE ASSERTION THIS FILE EXISTS FOR BEYOND THE MATRIX. Two measurements are
    // recorded before either is admitted, so a naive batch carve would let the
    // FIRST entry see the whole line as already performed, draw the entire pool,
    // and leave the second with nothing — an aggregate that reconciles and a
    // lineage that is wrong. `sliceAllocation`'s own header says why that is not
    // acceptable: each slice has to be meaningful on its own, because M4 package
    // lines sum per-slice amounts.
    const fx = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const item = fx.bySourceKey["1.1"]!;
    const assignmentId = await assign(fx, item.id);
    const { entryIds, closure } = await recordAndAdmit(assignmentId, ["4", "6"]);

    expect(closure.admission.admittedProgressEntryCount).toBe(2);
    expect(BigInt(closure.admission.grossMinorUnits)).toBe(BigInt(item.gross));

    const rows = await q<{ progress_entry_id: string; gross_minor_units: string }>(
      // See allocationsOf: one closure's allocations share a created_at, so the
      // entry's own recording order is the only real one.
      `select va.progress_entry_id, va.gross_minor_units::text
         from public.valuation_allocations va
         join public.progress_entries p
           on p.workspace_id = va.workspace_id and p.id = va.progress_entry_id
        where va.workspace_id = $1
        order by p.recorded_at, case p.entry_kind when 'root' then 0 else 1 end, p.id`, [fx.workspaceId]);
    expect(rows.map((r) => r.progress_entry_id)).toEqual(entryIds);
    // 4 of 10 units drew 40% of the pool and 6 drew the remaining 60%. Neither
    // took all of it, which is the whole point.
    const first = BigInt(rows[0]!.gross_minor_units);
    const second = BigInt(rows[1]!.gross_minor_units);
    expect(first).toBeGreaterThan(0n);
    expect(second).toBeGreaterThan(0n);
    expect(first + second).toBe(BigInt(item.gross));
    expect(second).toBeGreaterThan(first);
  });

  it("admits nothing beyond the contract quantity", async () => {
    const fx = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const item = fx.bySourceKey["1.1"]!;
    const assignmentId = await assign(fx, item.id);
    const { closure } = await recordAndAdmit(assignmentId, ["10", "5"]);

    expect(BigInt(closure.admission.grossMinorUnits)).toBe(BigInt(item.gross));
    const total = await q<{ s: string }>(
      `select coalesce(sum(gross_minor_units),0)::text s from public.valuation_allocations
        where workspace_id = $1 and work_item_id = $2`, [fx.workspaceId, item.id]);
    expect(total[0]!.s).toBe(item.gross);
  });

  it("admits each progress entry exactly once, however many stages close", async () => {
    // `unique (workspace_id, progress_entry_id)` makes double admission
    // unrepresentable; this asserts the COMMAND never attempts it, so the
    // guarantee is not being carried by a 23505 nobody would be able to read.
    const fx = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const assignmentId = await assign(fx, fx.bySourceKey["1.1"]!.id);
    const { entryIds } = await recordAndAdmit(assignmentId, ["2"]);

    // A second stage on the same assignment, created and closed after the money
    // was already admitted.
    const secondStage = await createStage2(assignmentId);
    const res = await close(secondStage);
    expect(res.status, await res.clone().text()).toBe(201);
    expect((await res.json()).admission.admittedProgressEntryCount).toBe(0);

    const rows = await q<{ n: string }>(
      `select count(*)::text n from public.valuation_allocations
        where workspace_id = $1 and progress_entry_id = $2`, [fx.workspaceId, entryIds[0]]);
    expect(rows[0]!.n).toBe("1");
  });
});

/** A second stage on the same assignment needs a different stage key. */
async function createStage2(assignmentId: string): Promise<string> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/stages/route");
  const res = await POST(jsonReq("http://x",
    { stageKey: "montazhni-roboty", isConcealed: false }),
    { params: Promise.resolve({ assignmentId }) });
  if (res.status !== 201) throw new Error(`createStage2 ${res.status} ${await res.text()}`);
  return (await res.json()).workStageId as string;
}

async function adjust(entryId: string, quantity: string): Promise<Response> {
  const { POST } = await import("../app/v1/progress-entries/[entryId]/adjustments/route");
  return POST(jsonReq("http://x", { quantity, reasonCode: "measurement_error" }),
    { params: Promise.resolve({ entryId }) });
}

/** Every allocation of one workspace, oldest first, with the figures that matter. */
async function allocationsOf(workspaceId: string) {
  // ORDERED BY THE PROGRESS ENTRY, NOT BY THE ALLOCATION'S OWN created_at.
  // ADR-008 moved the carve INTO the closure transaction, so every allocation a
  // closure writes shares one `now()` — `created_at` defaults to it and it is
  // transaction time. `order by created_at, id` therefore fell through to a
  // random uuid, and the ordered comparisons below were being decided by chance.
  //
  // The entries are recorded in separate HTTP transactions, so THEIR order is
  // real, and it is the order `pendingEntries` walks when it carves.
  return q<{
    quantity: string; funded_quantity: string;
    net_minor_units: string; tax_minor_units: string; gross_minor_units: string;
  }>(`select va.quantity::text, va.funded_quantity::text, va.net_minor_units::text,
             va.tax_minor_units::text, va.gross_minor_units::text
        from public.valuation_allocations va
        join public.progress_entries p
          on p.workspace_id = va.workspace_id and p.id = va.progress_entry_id
       where va.workspace_id = $1
       order by p.recorded_at, case p.entry_kind when 'root' then 0 else 1 end, p.id`, [workspaceId]);
}

describe("admission — a lineage corrected before it was admitted", () => {
  // THE OTHER ORDER — a lineage corrected AFTER it was admitted, whose INCREASE
  // then waits for a SECOND closure — is asserted in
  // `apps/app/tests/progress-adjust.int.test.ts` («spends a waiting increase
  // once, at the closure that admits it»). It lives there because the sequence is
  // two `progress.adjust` calls, and it is named here because the statement it
  // defends is this module's: a lineage can be admitted more than once, and until
  // 2026-08-08 the second admission funded quantity that the intervening negative
  // correction had already consumed as headroom. `app.assert_funded_within_lineage()`
  // (migration 0048 §3) is deferred, so that arrived as a closure aborting at
  // COMMIT and aborting identically on every retry.
  it("admits the effective quantity, not the recorded one", async () => {
    // THE DEFECT, IN THE NUMBERS THE M3 REVIEW FOUND IT IN. Contract quantity 10,
    // pool P, one assignment, one empty stage:
    //
    //   `record 10`  → no allocation (ADR-008).
    //   `adjust −4`  → the route carved at once even though the root held no
    //                  money, so the CORRECTION had an allocation and its ROOT
    //                  did not.
    //   closure      → `pendingEntries` selects entries with no allocation, so
    //                  only `root(10)` was pending. `work_item_performed` counts
    //                  ADMITTED quantity, and −4 was admitted, so the denominator
    //                  became 10 − (−4) = 14 and the numerator 10:
    //                  ≈ 71 % OF P FOR A LINEAGE WHOSE EFFECTIVE QUANTITY IS 6.
    //                  `funded_quantity` was stored as 10 against a
    //                  `progress_allocation_heads.effective_quantity` of 6, and
    //                  no constraint compared the two.
    //
    // Two changes close it and neither is sufficient alone: `progress.adjust`
    // no longer carves against an unadmitted root, so the correction arrives here
    // WITH its root; and this closure admits the lineage AS ITS ENTRIES, root
    // first, which is the sequence the carve would have run in when recording
    // still carved.
    const fx = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const item = fx.bySourceKey["1.1"]!;
    const assignmentId = await assign(fx, item.id);

    const rootId = (await (await record(assignmentId, "10")).json()).progressEntryId;
    const corrected = await adjust(rootId, "-4");
    expect(corrected.status, await corrected.clone().text()).toBe(201);
    // The correction moved nothing, because there was nothing to move.
    expect((await corrected.json()).admitted).toBe(false);
    expect((await allocationsOf(fx.workspaceId)).length).toBe(0);

    const stageId = await createStage(assignmentId);
    const res = await close(stageId);
    expect(res.status, await res.clone().text()).toBe(201);
    const closure = await res.json();
    // This file's standing precondition: the stage is empty and closes VACUOUSLY,
    // so what is under test is arithmetic and not the gate. A closure that
    // stopped being vacuous would mean these fixtures now carry obligations and
    // the money assertions are running behind a gate nobody told them about.
    expect(closure.vacuous).toBe(true);

    // BOTH entries of the lineage are admitted, and the receipt says so. One row
    // carrying the effective 6 is not an option:
    // `valuation_allocations_progress_fact_fkey` (migration 0025) pins an
    // allocation's quantity to its progress entry's own.
    expect(closure.admission.admittedProgressEntryCount).toBe(2);

    const rows = await allocationsOf(fx.workspaceId);
    expect(rows.map((r) => r.quantity)).toEqual(["10.000000", "-4.000000"]);

    // 6 of the line's 10 units drew money — 60 % of the pool, not 71 %.
    const gross = rows.reduce((s, r) => s + BigInt(r.gross_minor_units), 0n);
    expect(gross).toBe(BigInt(item.gross) * 6n / 10n);
    expect(gross).toBeLessThan(BigInt(item.gross) * 7n / 10n);

    // AND THE FIGURE NO ROUTE WAS COMPARING. Funded quantity across the lineage
    // is its effective quantity, and the head agrees.
    const funded = rows.reduce((s, r) => s + Number(r.funded_quantity), 0);
    expect(funded).toBe(6);
    const head = await q<{ effective_quantity: string }>(
      `select effective_quantity::text from public.progress_allocation_heads
        where workspace_id = $1 and root_progress_entry_id = $2`,
      [fx.workspaceId, rootId]);
    expect(Number(head[0]!.effective_quantity)).toBe(funded);
  });

  it("leaves no pool stranded when a corrected lineage shares a line with another", async () => {
    // THE ORDERING HALF, which the case above cannot see because it has one
    // lineage. `pendingEntries` used to order «every root, then every
    // adjustment», and roots-before-their-own-adjustments is load-bearing — an
    // adjustment's slice is computed against its ROOT's already-allocated
    // amounts. ACROSS lineages that same ordering strands money:
    //
    //   record 10, adjust −4, record 5, then close. Roots-then-adjustments gives
    //   root1 the whole pool; root2 then sees the line fully performed and draws
    //   NOTHING; the −4 finally returns 40 %. The line ends 60 % allocated
    //   against 11 effective units performed, and that 40 % is unreachable by
    //   every later measurement — money stranded rather than overspent, and
    //   invisible either way, because every per-row constraint is satisfied and
    //   the aggregate never exceeds the pool.
    //
    // Ordering BY LINEAGE — root1, its correction, then root2 — is the recording
    // sequence, and the pool closes exactly.
    const fx = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const item = fx.bySourceKey["1.1"]!;
    const assignmentId = await assign(fx, item.id);

    const first = (await (await record(assignmentId, "10")).json()).progressEntryId;
    expect((await adjust(first, "-4")).status).toBe(201);
    await record(assignmentId, "5");

    const res = await close(await createStage(assignmentId));
    expect(res.status, await res.clone().text()).toBe(201);
    const closure = await res.json();
    expect(closure.vacuous).toBe(true);
    expect(closure.admission.admittedProgressEntryCount).toBe(3);

    const rows = await allocationsOf(fx.workspaceId);
    // The correction is carved BEFORE the second root, so the second root sees 6
    // units performed and 4 units of contract still available.
    expect(rows.map((r) => r.quantity))
      .toEqual(["10.000000", "-4.000000", "5.000000"]);

    // THE POOL CLOSES EXACTLY: 6 + 4 funded units against a ten-unit line, so
    // every minor unit of the pool is allocated and not one more. Asserted as an
    // identity rather than as a figure, because gross is derived from
    // independently carved net and tax and re-deriving the rounding rule in a
    // test is how it gets derived wrongly.
    const gross = rows.reduce((s, r) => s + BigInt(r.gross_minor_units), 0n);
    expect(gross).toBe(BigInt(item.gross));
    expect(rows.reduce((s, r) => s + Number(r.funded_quantity), 0)).toBe(10);
    // The second root drew SOMETHING, which is the sentence the old ordering
    // made false while every total above could still have looked plausible.
    expect(BigInt(rows[2]!.gross_minor_units)).toBeGreaterThan(0n);
  });
});

describe("admission — the rule this route chose, stated as a test", () => {
  it("holds an assignment's money while any of its stages is still open", async () => {
    // ADR-008 says «for the quantity the closure covers» and there is no stored
    // fact that attributes a measured quantity to a stage: `progress_entries`
    // has `work_assignment_id` and no `work_stage_id`. Migration 0046 §b lists
    // three answers and takes none; `src/lib/admission.ts` takes the third —
    // admit when the LAST OPEN stage of the assignment closes — and this is that
    // choice written down where it can be argued with.
    //
    // IF THIS TEST IS EVER CHANGED TO EXPECT AN ADMISSION HERE, the first answer
    // was chosen instead, and the consequence is that money leaves through an
    // assignment's least demanding gate. That belongs in ADR-008 or a successor
    // before a pilot sees a number, not in a diff.
    const fx = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const assignmentId = await assign(fx, fx.bySourceKey["1.1"]!.id);
    const res = await record(assignmentId, "3");
    expect(res.status).toBe(201);

    const firstStage = await createStage(assignmentId);
    await createStage2(assignmentId);      // still open

    const closed = await close(firstStage);
    expect(closed.status, await closed.clone().text()).toBe(201);
    expect((await closed.json()).admission.admittedProgressEntryCount).toBe(0);

    const none = await q<{ n: string }>(
      `select count(*)::text n from public.valuation_allocations where workspace_id = $1`,
      [fx.workspaceId]);
    expect(none[0]!.n).toBe("0");
  });
});
