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

/**
 * ADR-008 MOVED THE RACE, AND THIS SUITE MOVED WITH IT.
 *
 * «The work-item lock actually serializes money» was written against
 * `progress.record`, because that is where the carve was. It is not there any
 * more: recording carves nothing and admission happens inside the stage-closure
 * transaction. The property under test is unchanged — contention changes the
 * interleaving, not the answer, and the pool must close exactly — and the
 * commands racing for it are now closures. Rewriting the assertion to keep it
 * passing against `progress.record` would have made a concurrency suite that
 * proves the serialization of a code path that no longer moves money.
 *
 * `stage_closures.close` is granted by hand: it is in no row of
 * responsibility-presets.csv (the M3 preset gap, migration 0045 §11 item 2).
 */
const CAPS = ["assignments.manage", "progress.record", "progress.adjust", "evidence.record",
              "stage_closures.close"] as const;
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

async function recordOn(id: string, quantity: string, key: string): Promise<Response> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/progress/route");
  return POST(keyed({ quantity }, key), { params: Promise.resolve({ assignmentId: id }) });
}

/**
 * An empty stage on one assignment; closing it is the v0.1 admission event.
 *
 * The stage key is a parameter because two stages of ONE assignment need two
 * keys — `work_stages_closable_unit_uniq` (migration 0043) is
 * (workspace, assignment, location, stage_key) and in v0.1 every location is
 * NULL.
 *
 * WHY THE STAGE IS EMPTY, WRITTEN DOWN ON 2026-08-08 BECAUSE IT WAS NOT. This
 * helper hand-creates `prykhovani-roboty`, which is the SAME key
 * `publishBindableRuleVersion` publishes and `matrixFixture` binds to this very
 * baseline. Nothing but the line's NULL work type keeps the two apart: if
 * `assignments.create` ever materialised for this fixture it would already own
 * that closable unit, and this call would come back 409 ASSIGNMENT_CONFLICT
 * rather than a stage — the refusal `m3-refusal.int.test.ts` asserts for a
 * duplicate closable unit. That was invisible before migration 0050 because no
 * line in the product could carry a work type; it is a real dependency now, and
 * a STABLE one: `matrixFixture` publishes through the importer, ADR-006
 * decision 6 freezes import expansion so the importer writes NULL, and INV-015
 * freezes the published line — an imported baseline can never acquire a work
 * type. If this ever 409s, the cause is that the importer was taught to type
 * one, not that this suite drifted.
 */
async function stageOn(id: string, stageKey = "prykhovani-roboty"): Promise<string> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/stages/route");
  const res = await POST(jsonReq("http://x", { stageKey, isConcealed: true }),
    { params: Promise.resolve({ assignmentId: id }) });
  if (res.status !== 201) throw new Error(`stageOn ${res.status} ${await res.text()}`);
  return (await res.json()).workStageId as string;
}

async function closeStage(stageId: string, key: string): Promise<Response> {
  const { POST } = await import("../app/v1/stages/[stageId]/closures/route");
  return POST(keyed({ expectedVersion: 1 }, key), { params: Promise.resolve({ stageId }) });
}

/** n assignments on ONE work line, each with its own recorded quantity and stage. */
async function armed(f: MatrixFixture, n: number, quantity: string): Promise<string[]> {
  const stageIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = await assign(f);
    const rec = await recordOn(id, quantity, `arm-${i}-${crypto.randomUUID()}`);
    if (rec.status !== 201) throw new Error(`armed/record ${rec.status} ${await rec.text()}`);
    stageIds.push(await stageOn(id));
  }
  return stageIds;
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
  it("never admits more than the pool under parallel closures", async () => {
    // FIVE ASSIGNMENTS ON ONE LINE, each with four of the line's ten units
    // recorded and its own stage, closed in parallel with DIFFERENT idempotency
    // keys — so idempotency cannot be what saves this. The advisory lock the
    // admission takes on the work item is.
    //
    // This is the same property the pre-ADR-008 version asserted about five
    // parallel measurements; the commands moved and the arithmetic did not.
    const stageIds = await armed(fx, 5, "4");
    const results = await inParallel(5, (i) => closeStage(stageIds[i]!, `race-${i}`));
    expect(fulfilled(results).filter((r) => r.status === 201).length).toBe(5);

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
    // Contention changes the interleaving, not the answer. Comparing against a
    // hand-computed figure would re-derive the rounding rule in the test and get
    // it wrong — gross is DERIVED from independently carved net and tax.
    const stageIds = await armed(fx, 4, "2");
    const parallel = await inParallel(4, (i) => closeStage(stageIds[i]!, `slice-${i}`));
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

    // The same four admissions, sequentially, in a fresh world.
    await truncateAll();
    const serial = await matrixFixture(A, {
      taxMode: "exclusive", taxRateBps: 2000, rows: [PRICED], capabilities: CAPS,
    });
    const serialStages = await armed(serial, 4, "2");
    for (let i = 0; i < 4; i++) await closeStage(serialStages[i]!, `serial-${i}`);
    const oneAtATime = await totalsFor(serial.workspaceId, serial.bySourceKey["1.1"]!.id);

    expect(raced).toEqual(oneAtATime);
  });

  it("admits exactly once when two stages of ONE assignment close in parallel", async () => {
    // THE SHAPE THE REST OF THIS SUITE STRUCTURALLY CANNOT SEE. `armed()` builds
    // n SEPARATE assignments with one stage each, so no two closures above ever
    // ask the same assignment's question. This one does.
    //
    // The rule `src/lib/admission.ts` implements is «admit when the assignment's
    // LAST OPEN stage closes», and it is a read of rows the closing transaction
    // did not lock. Under READ COMMITTED, T1 closing stage A and T2 closing stage
    // B each see the other's stage still `open`, both answer «not the last», and
    // NEITHER ADMITS. Both stages end closed, the assignment's four units stay
    // unvalued forever, and no v0.1 route re-runs admission. The money is not
    // double-spent — `unique (workspace_id, progress_entry_id)` makes that
    // unrepresentable — it is silently lost, which on this product's own terms is
    // worse, because nothing surfaces it.
    //
    // The fix is an advisory transaction lock on the ASSIGNMENT, taken as the
    // first statement of the admission. The second transaction then re-reads
    // after the first commits, sees both stages closed, and admits.
    //
    // THIS IS A RACE AND SAYS SO. Two calls that happen not to overlap would
    // admit correctly without any lock, so a green run is not by itself proof.
    // What the case asserts is the invariant that must hold under EVERY
    // interleaving — both closures accepted, exactly one of them admitting, and
    // the recorded quantity valued exactly once — and that is a sentence the
    // unlocked implementation cannot satisfy when the two transactions do
    // overlap.
    const id = await assign(fx);
    const rec = await recordOn(id, "4", `pair-${crypto.randomUUID()}`);
    expect(rec.status, await rec.clone().text()).toBe(201);
    const stages = [await stageOn(id, "prykhovani-roboty"),
                    await stageOn(id, "montazhni-roboty")];

    const results = await inParallel(2, (i) => closeStage(stages[i]!, `last-open-${i}`));
    const ok = fulfilled(results);
    // Both close. Neither is a conflict: they are different stages, and the lock
    // orders them rather than refusing one.
    expect(ok.length).toBe(2);
    for (const r of ok) expect(r.status, await r.clone().text()).toBe(201);

    const bodies = await Promise.all(ok.map((r) => r.json()));
    const admitted = bodies.map((b) => b.admission.admittedProgressEntryCount as number);
    // EXACTLY ONE ADMISSION, COVERING EVERY ENTRY. Asserting only the sum would
    // pass on «each closure admitted half»; asserting only the count would pass
    // on «one closure admitted nothing twice».
    expect(admitted.filter((n) => n === 1).length).toBe(1);
    expect(admitted.filter((n) => n === 0).length).toBe(1);

    const stored = await q<{ n: string; funded: string; admitted_by: string }>(
      `select count(*)::text n, coalesce(sum(funded_quantity),0)::text funded,
              count(admitted_by_closure_id)::text admitted_by
         from public.valuation_allocations
        where workspace_id = $1 and admitted_work_assignment_id = $2`,
      [fx.workspaceId, id]);
    expect(stored[0]!.n).toBe("1");
    expect(Number(stored[0]!.funded)).toBe(4);
    // The allocation names the closure that carved it — an admission that lost
    // its provenance would satisfy every count above (INV-089).
    expect(stored[0]!.admitted_by).toBe("1");
  });

  it("lets exactly one of four parallel closures of ONE stage win", async () => {
    // The other half of the race, and the one INV-076 is about. Four callers
    // close the same stage with different keys; the losers must be refused with
    // the catalogued conflict, not with a 500 from a unique violation, and
    // exactly one closure must exist.
    const [stageId] = await armed(fx, 1, "3");
    const results = await inParallel(4, (i) => closeStage(stageId!, `dup-${i}`));
    const statuses = fulfilled(results).map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201).length).toBe(1);
    for (const r of fulfilled(results)) {
      expect([201, 409]).toContain(r.status);
    }

    const rows = await q<{ closures: string; allocations: string }>(
      `select (select count(*) from public.stage_closures where workspace_id = $1) closures,
              (select count(*) from public.valuation_allocations where workspace_id = $1) allocations`,
      [fx.workspaceId]);
    expect(rows[0]!.closures).toBe("1");
    expect(rows[0]!.allocations).toBe("1");
  });
});

describe("idempotency under contention", () => {
  it("creates one entry and no allocation for one repeated key", async () => {
    const key = crypto.randomUUID();
    const results = await inParallel(4, () => record("3", key));
    const ok = fulfilled(results).filter((r) => r.status === 201);
    expect(ok.length).toBe(4);   // all replays, none rejected

    const counts = await q<{ entries: string; allocations: string }>(
      `select (select count(*) from public.progress_entries where workspace_id = $1) entries,
              (select count(*) from public.valuation_allocations where workspace_id = $1) allocations`,
      [fx.workspaceId]);
    expect(counts[0]!.entries).toBe("1");
    // Was "1" before ADR-008. Recording carves nothing, so a replay of a
    // recording has nothing to duplicate.
    expect(counts[0]!.allocations).toBe("0");
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

    // One evidence object was never the whole question, and asserting only that
    // is how this stayed green over a real defect: the row lock did produce one
    // row, but the three losing calls each received its id and could not tell
    // they had not created it, so each went on to append a capture event, an
    // audit entry and an evidence.available outbox row. The outbox has no
    // uniqueness constraint, so a subscriber saw the evidence arrive four
    // times. Migration 0031 makes the command report whether it created.
    const evidenceId = bodies[0]!.evidenceObjectId;
    const events = await q<{ n: string }>(
      `select count(*) n from public.capture_events
        where workspace_id = $1 and upload_intent_id = $2
          and client_state = 'server_confirmed'`,
      [fx.workspaceId, intent.uploadIntentId]);
    expect(events[0]!.n).toBe("1");

    const outbox = await q<{ n: string }>(
      `select count(*) n from public.transaction_outbox
        where topic = 'evidence.available' and aggregate_id = $1`, [evidenceId]);
    expect(outbox[0]!.n).toBe("1");

    const audits = await q<{ n: string }>(
      `select count(*) n from public.audit_events
        where action = 'evidence.available' and object_id = $1`, [evidenceId]);
    expect(audits[0]!.n).toBe("1");
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
    // The same rule version the fixture's first baseline bound. Binding it
    // again is not a conflict: `unique (workspace_id, contract_version_id,
    // requirement_rule_id)` is per contract version, and this publication
    // creates a new one. All three racers name the same set, so what decides
    // the outcome is the contract row lock and nothing about the bindings.
    await inParallel(3, () => publish(jsonReq("http://x", {
      expectedVersion: view.version, confirmedManifestHash: view.sourceManifestHash,
      ruleVersionIds: [fx.ruleVersionId],
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

