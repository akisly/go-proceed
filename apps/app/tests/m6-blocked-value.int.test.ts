import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq, baselineFixture, type BaselineFixture } from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion,
  publishVersion, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";
import { withTenantTx } from "@goproceed/database";
import {
  BOUND_RULE_VERSIONS_SQL, boundRuleVersion, planForWorkType,
} from "../src/lib/requirement-materialisation";
import { materialiseOccurrences } from "../src/lib/occurrence-writer";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No `vitest`, no `tsc`, no `psql`, no
 * `supabase`; no route was invoked, no migration applied, and no claim is made
 * that any assertion below passes. Static reading is the only check that was
 * available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M6 — THE BLOCKED MONEY.
 *
 * version-0.1.md §v0.1-M6 fixes what this suite has to prove:
 *
 *   the sum is over the work lines under a blocked stage, at the price on the
 *   published baseline, attributed ONCE PER ASSIGNMENT (INV-070), broken down by
 *   `blocked_reason.code`, summed within one baseline and never across
 *   currencies (INV-012); missing price, zero price and over-contract
 *   performance stay DISTINCT and are reported beside the sum rather than folded
 *   into it (INV-038, INV-039); every rendered sum is one tap from the specific
 *   unmet requirement; and blocked value is EXPOSURE, never a receivable.
 *
 * Plus the one thing version-0.1.md does not yet say, because ADR-008 was
 * approved after it: quantity that is performed, priced and NOT ADMITTED owes a
 * bucket of its own, and this operation owes it a line.
 *
 * WHAT THIS SUITE DELIBERATELY DOES NOT ASSERT
 *
 *   THE TWO HEADLINE MEASURES. First-time acceptance rate and days-to-signature
 *   have NO v0.1 definition — glossary.md:218-219 says so in terms and refuses
 *   to invent one — and version-0.1.md §v0.1-M6 settles that neither is computed
 *   inside the product in v0.1. There is therefore nothing in the response to
 *   assert them against, and a test that invented a ratio to check would be
 *   inventing the definition three documents decline to give. The gap is
 *   recorded in the progress document as the blocker that keeps M6 from
 *   CLOSING; it does not keep the operation from being built.
 *
 *   ANY PROJECTION STATE. `evidence_blocked`, `ready_not_packaged` and the other
 *   five are v0.2 (ADR-006 decision 5). Nothing below asserts a workflow state,
 *   because the operation produces none.
 *
 * WHY THE OCCURRENCES ARE MATERIALISED BY A HELPER AND NOT BY THE ROUTE:
 * unchanged from `m3-refusal.int.test.ts` and `m5-external.int.test.ts`. No work
 * line carries a work type, so `assignments.create` materialises nothing, and a
 * suite that used the route would sum money against an empty obligation set —
 * where the total is zero for the wrong reason.
 *
 * WHY DECISIONS ALWAYS PRECEDE RECORDED PROGRESS HERE. INV-069: a member who
 * recorded progress on an assignment may not then decide any obligation on it,
 * and one member is all a v0.1 pilot has (M4's fixture found the same ordering).
 * The order is forced, not stylistic.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

/**
 * `readiness.view` GOVERNS THIS OPERATION (capabilities.csv:31 names
 * `blocked_value.get` in terms) AND IS IN NO ROW OF
 * responsibility-presets.csv — the fifth milestone running. So a member who is
 * not a project admin cannot open the blocked-money screen this milestone exists
 * to ship without a hand-issued grant, and this suite issues one. Named rather
 * than folded into the list so the workaround stays legible.
 *
 * NARROWED 2026-08-08: it said «the pilot owner cannot open the screen», and
 * that half is fixed. `project.admin` implies `readiness.view` at the route from
 * that date, matching `rp_select`/`br_select` (migration 0045:1640-1642,
 * :1652-1654) and the intention 0045:1556-1560 states — M3 review finding 5,
 * raised to HIGH by the v0.1 final review. The preset gap itself is untouched:
 * no preset carries `readiness.view`, so every non-admin persona still needs the
 * grant this list issues.
 */
// `readiness.view` was in NO preset when this list was written; as of 2026-08-17
// it is on `pto_engineer` and `commercial_manager` — the latter's own description
// had named it as that persona's v0.1 money screen for four milestones while the
// preset withheld it. The `M6_PRESET_GAP` constant that named the gap is gone.
const CAPS = ["assignments.manage", "rule_bindings.manage", "requirements.assign",
              // `progress.adjust` is implied by nothing: IMPLIED_BY_PROJECT_ADMIN
              // (src/lib/authz.ts:84) is exactly project.view and readiness.view, so the
              // one case here that corrects a lineage was refused 403 before it could
              // assert the arithmetic ADR-008 is about.
              "progress.record", "progress.adjust", "evidence.record",
              "evidence_decisions.decide",
              "stage_closures.close", "requirement_exceptions.decide",
              "readiness.view"] as const;

const WORK_TYPE = "montazh-elektrotekhnichnykh-ustanovok";
const STAGE = "prykhovani-roboty";

interface Fx extends BaselineFixture {
  contractVersionId: string;
  workItemId: string;
  assignmentId: string;
  workStageId: string;
  occurrenceIds: string[];
}

beforeEach(async () => {
  current = A;
  await truncateAll();
});

async function grant(projectId: string, memberId: string,
                     caps: readonly string[] = CAPS): Promise<void> {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  const res = await POST(jsonReq("http://x", { memberId, capabilities: [...caps] }),
    { params: Promise.resolve({ projectId }) });
  if (res.status >= 300) throw new Error(`grant ${res.status} ${await res.text()}`);
}

interface LineSpec {
  sourceKey: string;
  description: string;
  contractQuantity: string;
  unitPriceState: "known" | "zero" | "missing";
  unitPrice?: string;
  unitCode?: string;
  /** Defaults to WORK_TYPE, which is the type the two bound rules carry. */
  workTypeKey?: string;
}

/**
 * A published, bound baseline with TWO obligations on ONE stage of ONE line.
 *
 * Two and not one for the reason `m3-refusal.int.test.ts` gives, and one more
 * that is M6's own: with a single obligation, «one assignment blocked by two
 * causes» — the case the additive partition exists for — cannot be built at all.
 */
async function baseline(lines: LineSpec[] = [{
  sourceKey: "1.1", description: "Приклад-прокладання кабелю в штробі",
  contractQuantity: "10", unitPriceState: "known", unitPrice: "100.00",
}]): Promise<Fx & { workItemIds: string[] }> {
  // `current`, not A. The auth mock resolves `current` at call time, so a case
  // that switches actors and then builds a world got a workspace owned by the new
  // actor and a membership lookup for the old one — which found nothing and threw
  // out of the fixture before the case could assert anything.
  const base = await baselineFixture(current);
  await grant(base.projectId, base.memberId);
  const library = await seedRequirementLibrary(base.workspaceId);

  const ruleIds: string[] = [];
  for (const key of ["Н.15/1", "Н.15/2"]) {
    const res = await publishRuleVersion(base.workspaceId,
      ruleVersionBody(library.get(key)!, { workTypeKey: WORK_TYPE, stageKey: STAGE }));
    if (res.status !== 201) {
      throw new Error(`publishRuleVersion ${res.status} ${await res.text()}`);
    }
    ruleIds.push((await res.json()).ruleVersionId as string);
  }

  const draft = await createDraft(base.contractId);
  const contractVersionId = (await draft.json()).contractVersionId as string;
  const workItemIds: string[] = [];
  for (const spec of lines) {
    const line = await addLine(contractVersionId, {
      sourceKey: spec.sourceKey, description: spec.description,
      // Since 0050 a line with no work type intersects no binding, so the
      // publish below would 409 RULE_BINDING_REQUIRED and every case in this
      // file would die in its fixture. The default matches the two rules bound
      // above; a spec may still override it to build a non-matching line.
      workTypeKey: spec.workTypeKey ?? WORK_TYPE,
      unitCode: spec.unitCode ?? "м", contractQuantity: spec.contractQuantity,
      unitPriceState: spec.unitPriceState,
      ...(spec.unitPrice === undefined ? {} : { unitPrice: spec.unitPrice }),
    });
    if (line.status !== 201) throw new Error(`addLine ${line.status} ${await line.text()}`);
    workItemIds.push((await line.json()).workItem.workItemId as string);
  }

  const bind = await bindRules(contractVersionId, ruleIds);
  if (bind.status !== 201) throw new Error(`bindRules ${bind.status} ${await bind.text()}`);
  const view = await (await getVersion(base.contractId, 1)).json();
  const pub = await publishVersion(contractVersionId, manifestOf(view));
  if (pub.status !== 201) throw new Error(`publishVersion ${pub.status} ${await pub.text()}`);

  const assignmentId = await assign(base.contractId, workItemIds[0]!);
  const written = await materialisedFor(base, assignmentId);

  return {
    ...base, contractVersionId, workItemId: workItemIds[0]!, workItemIds, assignmentId,
    workStageId: written.stageIds[0]!, occurrenceIds: written.occurrenceIds,
  };
}

async function assign(contractId: string, workItemId: string,
                      plannedQuantity?: string): Promise<string> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x",
    plannedQuantity === undefined ? { workItemId } : { workItemId, plannedQuantity }),
    { params: Promise.resolve({ contractId }) });
  if (res.status !== 201) throw new Error(`assignments.create ${res.status} ${await res.text()}`);
  return (await res.json()).assignmentId as string;
}

/**
 * Reads the obligation set `assignments.create` writes for itself.
 *
 * `materialiseFor` hand-wrote it while no work line could carry a work type,
 * and guarded itself with an Error naming the remedy for the day one could:
 * delete the harness and let the route build the fixture. The lines carry
 * WORK_TYPE now, so this reads what the route wrote.
 */
async function materialisedFor(
  base: BaselineFixture, assignmentId: string,
): Promise<{ stageIds: string[]; occurrenceIds: string[] }> {
  const rows = await q<{ id: string; work_stage_id: string | null }>(
    `select id, work_stage_id from public.requirement_occurrences
      where workspace_id = $1 and work_assignment_id = $2
      order by id`, [base.workspaceId, assignmentId]);
  if (rows.length === 0) {
    throw new Error("m6-blocked-value: assignments.create materialised nothing");
  }
  const stageIds = [...new Set(rows.map((r) => r.work_stage_id).filter(
    (s): s is string => s !== null))];
  if (stageIds.length === 0) {
    throw new Error("m6-blocked-value: the materialised occurrences carry no stage");
  }
  return { stageIds, occurrenceIds: rows.map((r) => r.id) };
}

async function decide(occurrenceId: string, body: Record<string, unknown>): Promise<Response> {
  const { POST } = await import(
    "../app/v1/occurrences/[occurrenceId]/evidence-decisions/route");
  return POST(jsonReq("http://x", body), { params: Promise.resolve({ occurrenceId }) });
}

async function record(assignmentId: string, quantity: string): Promise<Response> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/progress/route");
  return POST(jsonReq("http://x", { quantity }),
    { params: Promise.resolve({ assignmentId }) });
}

async function closeStage(stageId: string, expectedVersion = 1): Promise<Response> {
  const { POST } = await import("../app/v1/stages/[stageId]/closures/route");
  return POST(jsonReq("http://x", { expectedVersion }), { params: Promise.resolve({ stageId }) });
}

async function blockedValueRes(projectId: string): Promise<Response> {
  const { GET } = await import("../app/v1/projects/[projectId]/blocked-value/route");
  return GET(new Request("http://x"), { params: Promise.resolve({ projectId }) });
}

async function blockedValue(projectId: string): Promise<any> {
  const res = await blockedValueRes(projectId);
  if (res.status !== 200) throw new Error(`blocked_value.get ${res.status} ${await res.text()}`);
  return res.json();
}

async function blockedReasons(projectId: string): Promise<any> {
  const { GET } = await import("../app/v1/projects/[projectId]/blocked-reasons/route");
  const res = await GET(new Request("http://x"), { params: Promise.resolve({ projectId }) });
  if (res.status !== 200) throw new Error(`blocked_reasons.get ${res.status} ${await res.text()}`);
  return res.json();
}

/** The identity value-at-risk.md §"Reconciliation of the decomposition" states. */
function sums(rows: any[]): Map<string, [bigint, bigint, bigint, number]> {
  const out = new Map<string, [bigint, bigint, bigint, number]>();
  for (const r of rows) {
    const a = out.get(r.currency) ?? [0n, 0n, 0n, 0];
    a[0] += BigInt(r.netMinorUnits);
    a[1] += BigInt(r.taxMinorUnits);
    a[2] += BigInt(r.grossMinorUnits);
    a[3] += r.assignmentCount;
    out.set(r.currency, a);
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// 1. The by-cause breakdown reconciles to the sum
// ───────────────────────────────────────────────────────────────────────────

describe("the by-cause breakdown reconciles to the sum", () => {
  it("over one assignment blocked by TWO different causes", async () => {
    const fx = await baseline();

    // A RETURN on one obligation and nothing on the other: two live blocks on
    // one assignment carrying two DIFFERENT codes — `CUSTOMER_MOTIVATED_REFUSAL`
    // and `SUPERVISION_SIGNATURE_MISSING`. This is the only fixture shape in
    // which a per-cause table can double-count, and therefore the only one in
    // which the partition is doing any work.
    const returned = await decide(fx.occurrenceIds[0]!, {
      outcome: "returned", expectedVersion: null,
      reason: "Приклад-фото не показує ділянку повністю.",
    });
    expect(returned.status, await returned.clone().text()).toBe(201);

    const body = await blockedValue(fx.projectId);
    expect(body.source).toBe("computed");
    expect(body.blockedReasons).toHaveLength(2);

    const codes = new Set(body.blockedReasons.map((r: any) => r.code));
    expect(codes).toEqual(new Set(["CUSTOMER_MOTIVATED_REFUSAL",
                                   "SUPERVISION_SIGNATURE_MISSING"]));

    const total = sums(body.totalsByCurrency);
    const partition = sums(body.byCause.flatMap((r: any) => r.totalsByCurrency));
    expect([...partition.keys()].sort()).toEqual([...total.keys()].sort());
    for (const [currency, want] of total) expect(partition.get(currency)).toEqual(want);

    // ONE assignment, ONE amount, whatever the number is — INV-070. The
    // assertion is on the COUNT and on the identity above, never on a hardcoded
    // figure: pinning today's minor units would make this test defend the
    // attribution rule instead of the deduplication.
    expect(total.get("UAH")![3]).toBe(1);
    const holders = body.byCause.filter((r: any) => r.assignmentCount > 0);
    expect(holders).toHaveLength(1);
    expect(holders[0].code).toBe("CUSTOMER_MOTIVATED_REFUSAL");

    // And the non-additive view carries it under both, which is why it is
    // labelled unsummable on the wire.
    expect(body.affectedByCause).toHaveLength(2);
    expect(body.affectedByCauseIsAdditive).toBe(false);
    expect(body.byCauseIsAdditive).toBe(true);
    for (const row of body.affectedByCause) expect(row.assignmentCount).toBe(1);
  });

  it("reconciles by baseline as well, so «within one baseline» is a fact", async () => {
    const fx = await baseline();
    const body = await blockedValue(fx.projectId);

    expect(body.byBaseline).toHaveLength(1);
    expect(body.byBaseline[0].contractVersionId).toBe(fx.contractVersionId);
    expect(body.byBaseline[0].contractVersionNo).toBe(1);
    const total = sums(body.totalsByCurrency);
    const perBaseline = sums(body.byBaseline.flatMap((b: any) => b.totalsByCurrency));
    for (const [currency, want] of total) expect(perBaseline.get(currency)).toEqual(want);
  });

  it("sums the SAME objects blocked_reasons.get renders — one list, two counts", async () => {
    const fx = await baseline();
    const [value, reasons] = await Promise.all([
      blockedValue(fx.projectId), blockedReasons(fx.projectId),
    ]);
    // Not «the same shape» — the same list, because both routes call
    // `liveBlockedReasons`. A screen that showed a total the list underneath it
    // did not add up to is the failure this rules out.
    expect(value.blockedReasons).toEqual(reasons.blockedReasons);
    expect(sums(value.totalsByCurrency)).toEqual(sums(reasons.totalsByCurrency));
  });

  it("drops a CLOSED stage from the sum, and the money moves to admitted", async () => {
    const fx = await baseline();
    const before = await blockedValue(fx.projectId);
    expect(before.totalsByCurrency).toHaveLength(1);

    for (const occurrenceId of fx.occurrenceIds) {
      const res = await decide(occurrenceId, { outcome: "accepted", expectedVersion: null });
      expect(res.status, await res.clone().text()).toBe(201);
    }
    const rec = await record(fx.assignmentId, "10");
    expect(rec.status, await rec.clone().text()).toBe(201);
    const closed = await closeStage(fx.workStageId);
    expect(closed.status, await closed.clone().text()).toBe(201);

    const after = await blockedValue(fx.projectId);
    expect(after.blockedReasons).toEqual([]);
    expect(after.totalsByCurrency).toEqual([]);
    expect(after.byCause).toEqual([]);
    // And the not-admitted bucket empties with it: the closure IS admission
    // (ADR-008), so the quantity that was waiting now carries an allocation.
    expect(after.performedNotAdmitted.lines).toEqual([]);
    expect(after.performedNotAdmitted.totalsByCurrency).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2. The not-admitted bucket appears
// ───────────────────────────────────────────────────────────────────────────

describe("performed, priced and NOT ADMITTED gets its own bucket — ADR-008", () => {
  it("appears for quantity nobody has tried to close a stage for", async () => {
    const fx = await baseline();
    const rec = await record(fx.assignmentId, "4");
    expect(rec.status, await rec.clone().text()).toBe(201);
    // The 201 says so itself, and that is where the bucket's necessity comes
    // from: after ADR-008 the receipt carries no allocation figures at all.
    expect((await rec.json()).admitted).toBe(false);

    const body = await blockedValue(fx.projectId);
    const bucket = body.performedNotAdmitted;
    expect(bucket.bucket).toBe("performed_not_admitted");
    expect(bucket.lines).toHaveLength(1);

    const line = bucket.lines[0];
    expect(line.workItemId).toBe(fx.workItemId);
    expect(Number(line.quantity)).toBe(4);
    expect(Number(line.fundedQuantity)).toBe(4);
    expect(Number(line.overContractQuantity)).toBe(0);
    expect(line.workAssignmentIds).toEqual([fx.assignmentId]);
    // Priced, so it carries money — and the money is what admission would carve,
    // computed by the allocator itself. 4 of 10 units of a 1000.00 net pool.
    expect(line.value.currency).toBe("UAH");
    expect(line.value.netMinorUnits).toBe("40000");
    expect(line.value.taxMinorUnits).toBe("8000");
    expect(line.value.grossMinorUnits).toBe("48000");
    expect(line.unvaluedReason).toBeNull();

    expect(bucket.totalsByCurrency).toEqual([{
      currency: "UAH", netMinorUnits: "40000", taxMinorUnits: "8000",
      grossMinorUnits: "48000", lineCount: 1,
    }]);
  });

  it("is NOT a summand of blocked value, and says so on the wire", async () => {
    const fx = await baseline();
    expect((await record(fx.assignmentId, "4")).status).toBe(201);
    const body = await blockedValue(fx.projectId);

    expect(body.performedNotAdmitted.isSummandOfBlockedValue).toBe(false);
    // The same work is BOTH blocked and unadmitted — the stage carries two unmet
    // holds and nothing has been closed — so the two figures overlap and adding
    // them would count it twice. The blocked total is the whole line's pool
    // under the whole-line attribution; the bucket is 4 units of it. Asserted as
    // «different», because equality here would mean one of them was computed
    // from the other.
    const blocked = BigInt(body.totalsByCurrency[0].netMinorUnits);
    const waiting = BigInt(body.performedNotAdmitted.totalsByCurrency[0].netMinorUnits);
    expect(blocked).toBe(100000n);
    expect(waiting).toBe(40000n);
  });

  it("names the money admission would carve, not an independent estimate", async () => {
    // Two assignments on one line, one closed and one not: the second's waiting
    // quantity must be priced against the pool the FIRST already took. A bucket
    // that ignored the admitted share would report the full proportional value
    // of money that is no longer there.
    const fx = await baseline();
    for (const occurrenceId of fx.occurrenceIds) {
      expect((await decide(occurrenceId, { outcome: "accepted", expectedVersion: null })).status)
        .toBe(201);
    }
    expect((await record(fx.assignmentId, "6")).status).toBe(201);
    expect((await closeStage(fx.workStageId)).status).toBe(201);

    const second = await assign(fx.contractId, fx.workItemId);
    expect((await record(second, "4")).status).toBe(201);

    const body = await blockedValue(fx.projectId);
    const line = body.performedNotAdmitted.lines.find((l: any) => l.workItemId === fx.workItemId);
    expect(Number(line.quantity)).toBe(4);
    // The line's pool is 1000.00 net; 6 units were admitted and drew 600.00, so
    // 400.00 remains and the last 4 units draw all of it.
    expect(line.value.netMinorUnits).toBe("40000");

    const allocated = await q<{ net: string }>(
      `select coalesce(sum(net_minor_units), 0)::text as net
         from public.valuation_allocations where work_item_id = $1`, [fx.workItemId]);
    expect(BigInt(allocated[0]!.net)).toBe(60000n);
  });

  it("reports an UNPRICED line's waiting quantity with no money at all — INV-038", async () => {
    const fx = await baseline([{
      sourceKey: "1.1", description: "Приклад-лінія без ціни",
      contractQuantity: "10", unitPriceState: "missing",
    }]);
    expect((await record(fx.assignmentId, "3")).status).toBe(201);

    const body = await blockedValue(fx.projectId);
    const line = body.performedNotAdmitted.lines[0];
    expect(Number(line.quantity)).toBe(3);
    expect(line.value).toBeNull();
    expect(line.unvaluedReason).toBe("missing_unit_price");
    expect(body.performedNotAdmitted.unvaluedLineCount).toBe(1);
    // NOT a zero row. The bucket's per-currency totals stay empty, because there
    // is no currency figure to report.
    expect(body.performedNotAdmitted.totalsByCurrency).toEqual([]);
  });

  it("splits over-contract quantity out of the bucket and values none of it — INV-039", async () => {
    const fx = await baseline();
    // 14 recorded against a contract quantity of 10.
    expect((await record(fx.assignmentId, "14")).status).toBe(201);

    const body = await blockedValue(fx.projectId);
    const line = body.performedNotAdmitted.lines[0];
    expect(Number(line.quantity)).toBe(14);
    expect(Number(line.fundedQuantity)).toBe(10);
    expect(Number(line.overContractQuantity)).toBe(4);
    // The whole pool and not a unit more: over-contract performance is never
    // silently valued at the contract rate.
    expect(line.value.netMinorUnits).toBe("100000");
    expect(body.performedNotAdmitted.overContractLineCount).toBe(1);

    expect(body.overContract).toHaveLength(1);
    expect(body.overContract[0]).toMatchObject({
      workItemId: fx.workItemId, unitCode: "м",
      disposition: "unapproved_unvalued_exposure",
    });
    expect(Number(body.overContract[0].overContractQuantity)).toBe(4);
    // A quantity and a disposition, and NO money field on the row at all.
    expect(Object.keys(body.overContract[0]).sort()).toEqual([
      "contractId", "contractQuantity", "disposition", "overContractQuantity",
      "performedQuantity", "unitCode", "workItemId",
    ]);
  });

  it("carries the effective quantity of a corrected lineage, not the root's", async () => {
    const fx = await baseline();
    const rec = await record(fx.assignmentId, "10");
    const entryId = (await rec.json()).progressEntryId as string;

    const { POST: adjust } = await import(
      "../app/v1/progress-entries/[entryId]/adjustments/route");
    const adj = await adjust(jsonReq("http://x", {
      quantity: "-4", reasonCode: "measurement_correction",
    }), { params: Promise.resolve({ entryId }) });
    expect(adj.status, await adj.clone().text()).toBe(201);

    const body = await blockedValue(fx.projectId);
    const line = body.performedNotAdmitted.lines[0];
    // 10 recorded, 4 corrected away, NEITHER admitted — so the bucket reports 6.
    // Reporting 10 would be the root's quantity, and reporting two lines would
    // be the entries'.
    expect(Number(line.quantity)).toBe(6);
    expect(line.value.netMinorUnits).toBe("60000");
    expect(line.workAssignmentIds).toEqual([fx.assignmentId]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3. A blocked row resolves to its specific missing requirement
// ───────────────────────────────────────────────────────────────────────────

describe("every sum is one tap from the requirement that produced it", () => {
  it("resolves each cause row's ids to reason objects naming the obligation", async () => {
    const fx = await baseline();
    const body = await blockedValue(fx.projectId);

    const reachable = new Map<string, any>(
      body.blockedReasons.map((r: any) => [r.requirementOccurrenceId, r]));
    expect([...reachable.keys()].sort()).toEqual([...fx.occurrenceIds].sort());

    for (const row of [...body.byCause, ...body.affectedByCause]) {
      expect(row.requirementOccurrenceIds.length).toBeGreaterThan(0);
      for (const id of row.requirementOccurrenceIds) {
        const reason = reachable.get(id);
        expect(reason, `${row.code} names ${id}, which is in no reason object`).toBeDefined();
        // The tap has to land on something a foreman can act on: the exact
        // contract, work line, stage and blocking occurrence, plus what is
        // missing and who owes it (value-at-risk.md §"Drill-down contract").
        expect(reason.workStageId).toBe(fx.workStageId);
        expect(reason.workItemId).toBe(fx.workItemId);
        expect(reason.workAssignmentId).toBe(fx.assignmentId);
        expect(reason.ruleVersionId).toBeTruthy();
        expect(reason.awaitingApproverRole).toBeTruthy();
        expect(typeof reason.since).toBe("string");
        // And the obligation in the standard's own wording, which is what makes
        // the row readable rather than a status word (INV-073).
        expect(reason.acceptanceCriterion.length).toBeGreaterThan(0);
      }
    }

    // The obligation named on the wire is the one the DATABASE stored, not a
    // label assembled in TypeScript.
    const stored = await q<{ id: string; acceptance_criterion: string }>(
      `select id, acceptance_criterion from public.requirement_occurrences
        where work_stage_id = $1 order by ordinal`, [fx.workStageId]);
    for (const row of stored) {
      expect(reachable.get(row.id).acceptanceCriterion).toBe(row.acceptance_criterion);
    }
  });

  it("keeps the drill-down when a cause holds no money at all", async () => {
    const fx = await baseline();
    expect((await decide(fx.occurrenceIds[0]!, {
      outcome: "returned", expectedVersion: null,
      reason: "Приклад-фото не показує ділянку повністю.",
    })).status).toBe(201);

    const body = await blockedValue(fx.projectId);
    const loser = body.byCause.find((r: any) => r.code === "SUPERVISION_SIGNATURE_MISSING");
    // The code lost the precedence, so it holds no assignment and no money —
    // and it keeps its occurrence, because dropping the row would delete the
    // only route from «this obligation is unmet» to the screen.
    expect(loser.assignmentCount).toBe(0);
    expect(loser.totalsByCurrency).toEqual([]);
    expect(loser.requirementOccurrenceIds).toEqual([fx.occurrenceIds[1]]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4. INV-070, INV-012, INV-038 through the routes
// ───────────────────────────────────────────────────────────────────────────

describe("the money rules, end to end", () => {
  it("attributes TWO unmet obligations on one work as ONE amount — INV-070", async () => {
    const fx = await baseline();
    const body = await blockedValue(fx.projectId);
    // Two is the smallest number that can be inflated. «Several unmet
    // occurrences on one work reference the same assignment-scoped value and are
    // deduplicated by assignment when summed» — so two reason objects, one
    // amount, and the multiplier below is what would show if the dedupe were
    // dropped.
    expect(body.blockedReasons.length).toBe(2);
    expect(body.totalsByCurrency[0].assignmentCount).toBe(1);

    const perOccurrence = body.blockedReasons
      .map((r: any) => BigInt(r.blockedValue.netMinorUnits))
      .reduce((a: bigint, b: bigint) => a + b, 0n);
    const total = BigInt(body.totalsByCurrency[0].netMinorUnits);
    // Every reason object carries the assignment's amount; summing the OBJECTS
    // would double it. The total does not.
    expect(perOccurrence).toBe(total * 2n);
  });

  it("never combines two currencies, and offers no field that could", async () => {
    const fx = await baseline();
    // A second contract in EUR, its own baseline, its own blocked stage.
    const { POST: createContract } = await import(
      "../app/v1/projects/[projectId]/contracts/route");
    const c = await createContract(jsonReq("http://x", {
      ownPartyId: fx.ownPartyId, customerPartyId: fx.customerPartyId,
      contractNo: "Д-2026/Ф2", currency: "EUR", taxMode: "exclusive", taxRateBps: 2000,
    }), { params: Promise.resolve({ projectId: fx.projectId }) });
    expect(c.status, await c.clone().text()).toBe(201);
    const contractId = (await c.json()).contractId as string;

    const draft = await createDraft(contractId);
    const cvId = (await draft.json()).contractVersionId as string;
    const line = await addLine(cvId, {
      // The shared `baseline()` helper types its lines; this second-currency
      // contract is built inline and was missed. Untyped, it intersects no bound
      // rule and the publish below answers 409 RULE_BINDING_REQUIRED, not 201.
      sourceKey: "2.1", workTypeKey: WORK_TYPE,
      description: "Приклад-друга лінія", unitCode: "м",
      contractQuantity: "10", unitPriceState: "known", unitPrice: "50.00",
    });
    expect(line.status, await line.clone().text()).toBe(201);
    const workItemId = (await line.json()).workItem.workItemId as string;

    const rules = await q<{ id: string }>(
      `select id from public.requirement_rule_versions where workspace_id = $1
        order by created_at`, [fx.workspaceId]);
    const bind = await bindRules(cvId, rules.map((r) => r.id));
    expect(bind.status, await bind.clone().text()).toBe(201);
    const view = await (await getVersion(contractId, 1)).json();
    expect((await publishVersion(cvId, manifestOf(view))).status).toBe(201);

    const assignmentId = await assign(contractId, workItemId);
    await materialisedFor(fx, assignmentId);

    const body = await blockedValue(fx.projectId);
    expect(body.totalsByCurrency.map((t: any) => t.currency)).toEqual(["EUR", "UAH"]);
    expect(body.byBaseline).toHaveLength(2);
    for (const row of body.byCause) {
      expect(row.totalsByCurrency.map((t: any) => t.currency)).toEqual(["EUR", "UAH"]);
    }
    // Two baselines in two currencies, and there is no key anywhere in the
    // payload holding a figure that spans them. Enumerated, so a later slice
    // adding `grandTotal` fails here.
    expect(Object.keys(body).sort()).toEqual([
      "affectedByCause", "affectedByCauseIsAdditive", "algorithmVersion", "blockedReasons",
      "byBaseline", "byCause", "byCauseIsAdditive", "calculatedAt", "codeVocabularyVersion",
      "overContract", "performedNotAdmitted", "primaryCausePrecedence", "projectId", "source",
      "totalsByCurrency", "unvaluedAssignmentCount", "unvaluedRegister",
      "zeroPricedAssignmentCount",
    ]);
  });

  it("keeps a MISSING price out of every total and reports its quantity — INV-038", async () => {
    const fx = await baseline([{
      sourceKey: "1.1", description: "Приклад-лінія без ціни",
      contractQuantity: "10", unitPriceState: "missing",
    }]);
    const body = await blockedValue(fx.projectId);

    expect(body.blockedReasons.length).toBe(2);
    for (const r of body.blockedReasons) {
      expect(r.blockedValue).toBeNull();
      expect(r.valueAttribution).toBe("unvalued");
      expect(r.unvaluedQuantity).not.toBeNull();
    }
    expect(body.totalsByCurrency).toEqual([]);
    expect(body.unvaluedAssignmentCount).toBe(1);
    expect(body.unvaluedRegister).toHaveLength(1);
    expect(body.unvaluedRegister[0].reason).toBe("missing_unit_price");
    expect(body.unvaluedRegister[0].unitCode).toBe("м");
    expect(body.unvaluedRegister[0].assignmentCount).toBe(1);
    // No zero appears anywhere: not in the totals, not on the register row.
    expect(JSON.stringify(body.unvaluedRegister[0])).not.toContain("MinorUnits");
  });

  it("keeps a ZERO price INSIDE the total and counts it apart", async () => {
    const fx = await baseline([{
      sourceKey: "1.1", description: "Приклад-безоплатна позиція",
      contractQuantity: "10", unitPriceState: "zero",
    }]);
    const body = await blockedValue(fx.projectId);

    expect(body.zeroPricedAssignmentCount).toBe(1);
    expect(body.unvaluedAssignmentCount).toBe(0);
    expect(body.unvaluedRegister).toEqual([]);
    expect(body.totalsByCurrency).toHaveLength(1);
    expect(body.totalsByCurrency[0].netMinorUnits).toBe("0");
    expect(body.totalsByCurrency[0].assignmentCount).toBe(1);
  });

  it("is exposure and never a receivable — no accounting vocabulary on the wire", async () => {
    const fx = await baseline();
    const body = await blockedValue(fx.projectId);
    const raw = JSON.stringify(body);
    for (const banned of ["receivable", "invoice", "payable", "amountDue", "owed",
                          "payment", "balance", "exchangeRate", "fxRate"]) {
      expect(raw.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5. Authorization and tenant isolation
// ───────────────────────────────────────────────────────────────────────────

describe("who may read the blocked money", () => {
  it("refuses a member holding project.view but not readiness.view", async () => {
    const fx = await baseline();
    const members = await q<{ id: string }>(
      `select id from public.memberships where organization_id = $1`, [fx.workspaceId]);
    expect(members.length).toBe(1);

    // Re-grant WITHOUT readiness.view. The grant route is additive, so the
    // capability is revoked directly — the point of the case is the route's
    // check, not the grant command's.
    //
    // `project.admin` GOES WITH IT SINCE 2026-08-08, and the case is unchanged
    // by that: `project.admin` now implies `readiness.view` at the route as
    // `rp_select`/`br_select` always did in the database (M3 review finding 5),
    // so an actor keeping the admin grant would be admitted — correctly. What is
    // under test here is the member who holds ONLY `project.view`, which is
    // still a refusal, and revoking both is what leaves that actor behind.
    // Before this date the fixture's member kept `project.admin` and was refused
    // anyway; the assertion passed for a reason that was a defect.
    await q(`update public.project_access_grants set revoked_at = now()
              where project_id = $1 and capability in ('readiness.view', 'project.admin')`,
      [fx.projectId]);
    const res = await blockedValueRes(fx.projectId);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("refuses a member holding readiness.view but not project.view", async () => {
    const fx = await baseline();
    await q(`update public.project_access_grants set revoked_at = now()
              where project_id = $1 and capability in ('project.view', 'project.admin')`,
      [fx.projectId]);
    const res = await blockedValueRes(fx.projectId);
    // NOT AN EMPTY SCREEN, AND NOT A TOTAL OF ZERO — which is the whole of what
    // this case defends. It asserted 403, and the refusal is a 404: the route's
    // first statement is `select workspace_id from public.projects where id = $1`
    // (blocked-value/route.ts:68-70), `projects_select` (0011:121-122) admits
    // only project.view/project.admin, and goproceed_app does not bypass RLS. With
    // both revoked the project row is invisible, so the route answers «not
    // found» and never reaches its own `project.view` check.
    //
    // The asymmetry with the case above is real and coherent: an actor who can
    // SEE the project but lacks the specific capability gets 403
    // SCOPE_PROJECT_DENIED; an actor who cannot see it at all gets 404. Both
    // refuse, and neither hands back a zero.
    //
    // The alternative — reading the project through a definer path so the route
    // could 403 — would widen a read to obtain a nicer status code, and the RLS
    // is not QA's to change (CLAUDE.md).
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("RESOURCE_NOT_FOUND");
  });

  it("is invisible to another workspace's owner — no oracle", async () => {
    const fx = await baseline();
    current = B;
    const res = await blockedValueRes(fx.projectId);
    // 404 AND NOT 403: `projects` is behind RLS, so the lookup at the top of the
    // route returns no row and the answer is «no such project» rather than «that
    // project is not yours», which would confirm it exists (INV-001/INV-002).
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("RESOURCE_NOT_FOUND");
    expect(JSON.stringify(body)).not.toContain(fx.workItemId);
    expect(JSON.stringify(body)).not.toContain(fx.assignmentId);

    // BYTE-IDENTICAL to the answer for an id that exists nowhere — the response
    // must not be an oracle for the project's existence.
    const absent = await blockedValueRes("00000000-0000-4000-8000-0000000000ff");
    expect(absent.status).toBe(404);
    const a = await absent.json();
    expect({ ...a, requestId: null }).toEqual({ ...body, requestId: null });
  });

  it("sums only its own project's blocked money", async () => {
    const one = await baseline();
    current = B;
    const two = await baseline();
    current = A;

    const body = await blockedValue(one.projectId);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(two.workItemId);
    expect(raw).not.toContain(two.assignmentId);
    for (const id of two.occurrenceIds) expect(raw).not.toContain(id);
    expect(body.blockedReasons).toHaveLength(2);
  });

  it("answers 404 for a project id that does not exist", async () => {
    await baseline();
    const res = await blockedValueRes("00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("RESOURCE_NOT_FOUND");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 6. What M6 cannot close, asserted as a gap rather than skipped
// ───────────────────────────────────────────────────────────────────────────

describe("the two headline measures", () => {
  /**
   * NOT `it.todo`, AND NOT AN INVENTED RATIO. The requirement — «blocked value
   * is reported beside first-time acceptance rate and days-to-signature and
   * never as the hero number» — cannot be met by this operation, because neither
   * measure has a v0.1 definition (glossary.md:218-219) and version-0.1.md
   * §v0.1-M6 settles that neither is computed inside the product in v0.1.
   *
   * What CAN be asserted is that the product does not pretend otherwise: no key
   * on this payload claims either measure, so a client cannot render a hero
   * number the definitions do not support. On the day the glossary carries a
   * v0.1 definition and an operation computes it, this assertion fails and is
   * the thing to rewrite.
   */
  it("are absent from the payload, because v0.1 has no definition of either", async () => {
    const fx = await baseline();
    const raw = JSON.stringify(await blockedValue(fx.projectId)).toLowerCase();
    for (const key of ["firsttimeacceptance", "acceptancerate", "daystosignature",
                       "timetosignature", "heronumber"]) {
      expect(raw).not.toContain(key);
    }
  });
});
