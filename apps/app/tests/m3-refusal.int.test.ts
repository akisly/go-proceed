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
 * v0.1-M3 — THE REFUSAL.
 *
 * version-0.1.md §v0.1-M3 fixes what this suite has to prove, and it is
 * deliberately not «readiness is computed»:
 *
 *   «`can_close_stage` is implemented exactly as written in ADR-005 decision 7
 *   and the closure command REFUSES; a test proves the refusal and reads its
 *   reason object. A screen that displays «не готово» closes nothing.»
 *
 * So every assertion below attempts the write the rule exists to stop, and reads
 * the object the refusal is made of. The acceptance walk of that section is one
 * test, start to finish: create a stage, be refused, read the `blocked_reason`
 * with the money behind it, record an `accept_risk` and watch the refusal lift
 * while the exception stays visible and attributed, decide the occurrence
 * internally, close.
 *
 * WHY THE OCCURRENCES ARE MATERIALISED BY A HELPER AND NOT BY THE ROUTE. A suite
 * that used the route on an untyped line would test the refusal against an empty
 * stage — where the predicate is vacuously TRUE and there is no refusal to test.
 * `materialiseFor` supplies the work type, exactly as
 * `m2-materialisation.int.test.ts` does, and throws an explicit Error rather
 * than an `expect` if the route ever starts materialising, so the harness can
 * never silently double-write.
 *
 * THE REASON THAT HELPER EXISTS CHANGED ON 2026-08-08, AND SO DID WHAT IT OWES.
 * It was written when NO work line in the product could carry a work type —
 * `public.work_items` had no `work_type_key` and no operation wrote one, so
 * `assignments.create` materialised nothing for anybody. Migration 0050 lands
 * the carrier and `workTypeKeyOf` reads it, so that is no longer true. What
 * keeps this fixture empty now is its own `addLine` call below, which supplies
 * no `workTypeKey` — a CHOICE this suite is making, not a limit of the product.
 *
 * THE REWRITE THIS SUITE NOW OWES, stated so it is not mistaken for done: type
 * the fixture's line with WORK_TYPE, let `assignments.create` build the
 * obligation set, and DELETE `materialiseFor`. It is not taken here because it
 * is a rewrite of the fixture every test below stands on, this checkout has no
 * database, and a blind rewrite of the M3 refusal harness is exactly the change
 * that must not go in unrun. Until it is taken, the refusal is proven HERE over
 * a hand-written obligation set, and proven again over a ROUTE-materialised one
 * in `materialisation-end-to-end.int.test.ts` — which closes the gap this
 * harness leaves: that suite's stage is built by `assignments.create` from a
 * work type stored on the line, so the refusal it asserts stands behind an
 * obligation no test wrote by hand.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

/**
 * NONE OF THE FOUR M3 CAPABILITIES IS IN ANY ROW OF
 * technical/permissions/responsibility-presets.csv. Migration 0045 §11 item 2
 * records it and this suite grants them by hand — which is exactly the shape of
 * a gap a fixture hides (M1 review finding 8, one milestone later and four times
 * over). Named here so the workaround is legible: on the day a preset carries
 * them, this list shrinks and nothing else in the file changes.
 *
 * `readiness.view` STAYS IN THE LIST AND IS NO LONGER THE ONLY WAY IN. Since
 * 2026-08-08 `project.admin` implies it at the route, as `rp_select` and
 * `br_select` always did (M3 review finding 5) — so the actor below would reach
 * the two money reads through the grant `baselineFixture` already gives it. The
 * hand-issued capability is kept because the preset gap is real for every
 * persona that is NOT a project admin, and the admin path is asserted on its own
 * member in «the money reads and the project admin» rather than by weakening
 * this fixture.
 */
const M3_PRESET_GAP = ["stage_closures.close", "evidence_decisions.decide",
                       "requirement_exceptions.decide", "readiness.view"] as const;
const CAPS = ["assignments.manage", "rule_bindings.manage", "requirements.assign",
              "progress.record", "evidence.record", ...M3_PRESET_GAP] as const;

const WORK_TYPE = "montazh-elektrotekhnichnykh-ustanovok";
const STAGE = "prykhovani-roboty";

interface Fx extends BaselineFixture {
  contractVersionId: string;
  workItemId: string;
  assignmentId: string;
  workStageId: string;
  /** Both occurrences of the stage, in materialisation order. */
  occurrenceIds: string[];
}

async function grant(projectId: string, memberId: string): Promise<void> {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  const res = await POST(jsonReq("http://x", { memberId, capabilities: [...CAPS] }),
    { params: Promise.resolve({ projectId }) });
  if (res.status >= 300) throw new Error(`grant ${res.status} ${await res.text()}`);
}

/**
 * A published, bound baseline with ONE work line and TWO obligations on ONE
 * stage.
 *
 * TWO AND NOT ONE, deliberately. With a single obligation, «refuses while any
 * obligation is unmet» and «refuses while THE obligation is unmet» are the same
 * sentence, and a command that stopped at the first satisfied occurrence would
 * pass. Two on one stage is the smallest fixture that can tell them apart.
 */
async function baseline(): Promise<Fx> {
  const base = await baselineFixture(A);
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
  const line = await addLine(contractVersionId, {
    sourceKey: "1.1", description: "Приклад-прокладання кабелю в штробі",
    unitCode: "м", contractQuantity: "10",
    unitPriceState: "known", unitPrice: "100.00",
  });
  if (line.status !== 201) throw new Error(`addLine ${line.status} ${await line.text()}`);
  const workItemId = (await line.json()).workItem.workItemId as string;

  const bind = await bindRules(contractVersionId, ruleIds);
  if (bind.status !== 201) throw new Error(`bindRules ${bind.status} ${await bind.text()}`);
  const view = await (await getVersion(base.contractId, 1)).json();
  const pub = await publishVersion(contractVersionId, manifestOf(view));
  if (pub.status !== 201) throw new Error(`publishVersion ${pub.status} ${await pub.text()}`);

  const { POST: createAssignment } = await import(
    "../app/v1/contracts/[contractId]/assignments/route");
  const asg = await createAssignment(jsonReq("http://x", { workItemId }),
    { params: Promise.resolve({ contractId: base.contractId }) });
  if (asg.status !== 201) throw new Error(`assignments.create ${asg.status} ${await asg.text()}`);
  const assignmentId = (await asg.json()).assignmentId as string;

  const { workStageId, occurrenceIds } = await materialiseFor(
    base, contractVersionId, assignmentId);

  return { ...base, contractVersionId, workItemId, assignmentId, workStageId, occurrenceIds };
}

/**
 * Writes the obligation set `assignments.create` cannot write yet.
 *
 * THE PRECONDITION IS AN Error AND NOT AN expect, for the reason
 * `m2-materialisation.int.test.ts` gives about its own copy: «the route
 * materialised nothing» is a precondition of this harness and never a
 * requirement of the product.
 */
async function materialiseFor(
  base: BaselineFixture, contractVersionId: string, assignmentId: string,
): Promise<{ workStageId: string; occurrenceIds: string[] }> {
  return withTenantTx({ actorUserId: A, organizationId: null, requestId: crypto.randomUUID() },
    async (tx) => {
      const existing = await tx.query(
        `select count(*)::int as n from public.requirement_occurrences
          where workspace_id = $1 and work_assignment_id = $2`,
        [base.workspaceId, assignmentId]);
      if (existing.rows[0].n > 0) {
        throw new Error(
          "m3-refusal: assignments.create has already materialised this assignment's "
          + "obligation set, so this harness would double-write it. The carrier has "
          + "existed since migration 0050; reaching this means the fixture's line "
          + "acquired a work type. That is the rewrite the header names: delete "
          + "materialiseFor and let the route build the fixture.");
      }
      const bound = (await tx.query(BOUND_RULE_VERSIONS_SQL,
        [base.workspaceId, contractVersionId])).rows.map(boundRuleVersion);
      const plan = planForWorkType(WORK_TYPE, bound);
      if (plan.occurrences.length !== 2) {
        throw new Error(`m3-refusal: expected 2 planned occurrences, got ${plan.occurrences.length}`);
      }
      const written = await materialiseOccurrences(tx, {
        workspaceId: base.workspaceId, projectId: base.projectId, contractId: base.contractId,
        contractVersionId, assignmentId, memberId: base.memberId,
      }, plan);
      return { workStageId: written.stageIds[0]!, occurrenceIds: written.occurrenceIds };
    });
}

async function closeStage(stageId: string, expectedVersion = 1): Promise<Response> {
  const { POST } = await import("../app/v1/stages/[stageId]/closures/route");
  return POST(jsonReq("http://x", { expectedVersion }), { params: Promise.resolve({ stageId }) });
}

async function decide(
  occurrenceId: string, body: Record<string, unknown>,
): Promise<Response> {
  const { POST } = await import(
    "../app/v1/occurrences/[occurrenceId]/evidence-decisions/route");
  return POST(jsonReq("http://x", body), { params: Promise.resolve({ occurrenceId }) });
}

async function except(
  occurrenceId: string, body: Record<string, unknown>,
): Promise<Response> {
  const { POST } = await import("../app/v1/occurrences/[occurrenceId]/exceptions/route");
  return POST(jsonReq("http://x", body), { params: Promise.resolve({ occurrenceId }) });
}

async function readiness(projectId: string): Promise<any> {
  const { GET } = await import("../app/v1/projects/[projectId]/readiness/route");
  const res = await GET(new Request("http://x"), { params: Promise.resolve({ projectId }) });
  if (res.status !== 200) throw new Error(`readiness.get ${res.status} ${await res.text()}`);
  return res.json();
}

async function blockedReasons(projectId: string): Promise<any> {
  const { GET } = await import("../app/v1/projects/[projectId]/blocked-reasons/route");
  const res = await GET(new Request("http://x"), { params: Promise.resolve({ projectId }) });
  if (res.status !== 200) throw new Error(`blocked_reasons.get ${res.status} ${await res.text()}`);
  return res.json();
}

/** Row counts for every base table in `public`, in one round trip. */
async function census(): Promise<Record<string, number>> {
  const tables = await q<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`);
  const rows = await q<{ t: string; n: number }>(
    tables.map((t) => `select '${t.table_name}' as t, count(*)::int as n from public."${t.table_name}"`)
      .join(" union all "));
  return Object.fromEntries(rows.map((r) => [r.t, r.n]));
}

function changedTables(before: Record<string, number>, after: Record<string, number>): string[] {
  return Object.keys(after).filter((t) => after[t] !== before[t]).sort();
}

let fx: Fx;
beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await baseline();
});

describe("stage_closures.create — the refusal", () => {
  it("refuses with the catalogued code and names every unmet requirement", async () => {
    const res = await closeStage(fx.workStageId);
    expect(res.status).toBe(409);
    const body = await res.json();

    // technical/error-catalog.csv:95 — not a generic 409 and not VERSION_CONFLICT.
    expect(body.code).toBe("HOLD_POINT_BLOCKED");
    expect(body.userAction).toBe("complete_or_authorize_occurrence");

    // «Every refusal names the requirement, the missing evidence, the role that
    // owes the decision, and the money that waits» (version-0.1.md §M3).
    expect(body.details.blockingOccurrenceCount).toBe(2);
    expect(body.details.unsatisfiedOccurrenceCount).toBe(2);
    const named = body.details.blockedReasons.map((r: any) => r.requirementOccurrenceId).sort();
    expect(named).toEqual([...fx.occurrenceIds].sort());

    for (const r of body.details.blockedReasons) {
      expect(r.code).toBe("SUPERVISION_SIGNATURE_MISSING");
      expect(r.awaitingApproverRole).toBe("technical_supervisor");
      expect(r.ruleVersionId).toBeTruthy();
      // The obligation in the standard's own wording, and its citation carried
      // with its verification tag and its source or not at all (INV-073).
      expect(r.acceptanceCriterion.length).toBeGreaterThan(0);
      if (r.normRef !== null) {
        expect(r.normRef.verification).toMatch(/^VERIFIED_(PRIMARY|SECONDARY)$/);
        expect(r.normRef.source.length).toBeGreaterThan(0);
      }
      // No evidence was captured, so the missing-evidence list is not empty and
      // says what kind and against which criterion.
      expect(r.missingEvidence).toHaveLength(1);
      expect(r.missingEvidence[0].evidenceKind).toBe("photo");
      expect(r.missingEvidence[0].availableCount).toBe(0);
      expect(r.missingEvidence[0].requiredCount).toBeGreaterThanOrEqual(1);
      // The money that waits. This line is priced, so it is money and not a
      // quantity (INV-038 draws that line the other way round).
      expect(r.blockedValue).not.toBeNull();
      expect(BigInt(r.blockedValue.grossMinorUnits)).toBeGreaterThan(0n);
      expect(BigInt(r.blockedValue.grossMinorUnits))
        .toBe(BigInt(r.blockedValue.netMinorUnits) + BigInt(r.blockedValue.taxMinorUnits));
    }
  });

  it("writes nothing at all", async () => {
    // A refusal is not a partial closure and not an audit trail of an attempt.
    // ADR-008 depends on this being literally true for the money: «a refused
    // closure carves nothing, because a refused closure writes nothing at all».
    const before = await census();
    const res = await closeStage(fx.workStageId);
    expect(res.status).toBe(409);
    const after = await census();

    // The idempotency record is written by `withIdempotency` only on success, so
    // nothing at all should have changed.
    expect(changedTables(before, after)).toEqual([]);

    const stage = await q<{ status: string; version: string }>(
      `select status, version::text from public.work_stages where id = $1`, [fx.workStageId]);
    expect(stage[0]!.status).toBe("open");
    expect(stage[0]!.version).toBe("1");
  });

  it("still refuses when only one of the two obligations is satisfied", async () => {
    const first = await decide(fx.occurrenceIds[0]!,
      { outcome: "accepted", expectedVersion: null });
    expect(first.status, await first.clone().text()).toBe(201);

    const res = await closeStage(fx.workStageId);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.details.blockingOccurrenceCount).toBe(2);
    expect(body.details.unsatisfiedOccurrenceCount).toBe(1);
    expect(body.details.blockedReasons[0].requirementOccurrenceId).toBe(fx.occurrenceIds[1]);
  });

  it("names a returned decision as a motivated refusal, since the moment it was taken", async () => {
    const returned = await decide(fx.occurrenceIds[0]!, {
      outcome: "returned", expectedVersion: null,
      reason: "Приклад-фото не показує ділянку повністю.",
    });
    expect(returned.status, await returned.clone().text()).toBe(201);
    const decidedAt = (await returned.json()).decidedAt as string;

    const res = await closeStage(fx.workStageId);
    const body = await res.json();
    const forReturned = body.details.blockedReasons
      .find((r: any) => r.requirementOccurrenceId === fx.occurrenceIds[0]);
    // state-catalog.csv:116 defines the code as exactly this case.
    expect(forReturned.code).toBe("CUSTOMER_MOTIVATED_REFUSAL");
    // `since` is when the block began, not when somebody asked.
    expect(forReturned.since).toBe(decidedAt);
  });
});

describe("the escape, and the one that is never available", () => {
  it("rejects not_applicable on a hold, by the command itself", async () => {
    // INV-063 and version-0.1.md §M3's exit gate AND security test. 422 and not
    // 403: the action is refused for every actor and every role, so it is a fact
    // about the request rather than about this caller.
    const res = await except(fx.occurrenceIds[0]!,
      { action: "not_applicable", reason: "Приклад-обґрунтування", expectedVersion: null });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fieldErrors[0].path).toBe("action");

    const rows = await q<{ n: string }>(
      `select count(*)::text n from public.requirement_exceptions where workspace_id = $1`,
      [fx.workspaceId]);
    expect(rows[0]!.n).toBe("0");
  });

  it("lifts the refusal on accept_risk and keeps the exception visible and attributed", async () => {
    for (const occurrenceId of fx.occurrenceIds) {
      const res = await except(occurrenceId, {
        action: "accept_risk", reason: "Приклад-ризик прийнято до усунення.",
        expectedVersion: null,
      });
      expect(res.status, await res.clone().text()).toBe(201);
      const body = await res.json();
      // Visible AND attributed: who took it and why are on the receipt, not only
      // in the audit row (ADR-005 decision 3).
      expect(body.authorityMemberId).toBe(fx.memberId);
      expect(body.reason).toBe("Приклад-ризик прийнято до усунення.");
      expect(body.occurrenceSatisfied).toBe(true);
    }

    const closed = await closeStage(fx.workStageId);
    expect(closed.status, await closed.clone().text()).toBe(201);
    const body = await closed.json();
    // The obligation is IN the frozen set with its exception named beside it, not
    // absent from it — «an escape that removed the obligation from the closure's
    // own record would be the exception that hides itself» (migration 0045 §5).
    expect(body.evaluatedOccurrenceCount).toBe(2);
    expect(body.frozenOccurrences.every((f: any) => f.satisfiedBy === "exception")).toBe(true);
    expect(body.frozenOccurrences.every((f: any) => f.reliedOnExceptionAction === "accept_risk"))
      .toBe(true);
  });

  it("keeps waiver available and supersedes through the head", async () => {
    const first = await except(fx.occurrenceIds[0]!,
      { action: "waiver", reason: "Приклад-відмова від вимоги.", expectedVersion: null });
    expect(first.status, await first.clone().text()).toBe(201);
    expect((await first.json()).headVersion).toBe(1);

    // A correction is a SUCCESSOR naming the exact prior fact, never an edit.
    const second = await except(fx.occurrenceIds[0]!,
      { action: "accept_risk", reason: "Приклад-перегляд рішення.", expectedVersion: 1 });
    expect(second.status, await second.clone().text()).toBe(201);
    const body = await second.json();
    expect(body.exceptionNo).toBe(2);
    expect(body.headVersion).toBe(2);
    expect(body.predecessorExceptionId).toBeTruthy();

    // A stale expected version is a refusal and never a second root (INV-035).
    const stale = await except(fx.occurrenceIds[0]!,
      { action: "waiver", reason: "Приклад-застаріла версія.", expectedVersion: 1 });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe("OCCURRENCE_CONFLICT");
  });
});

describe("the decision, and who may not take it", () => {
  it("closes on two accepting decisions and freezes the exact set", async () => {
    for (const occurrenceId of fx.occurrenceIds) {
      const res = await decide(occurrenceId, { outcome: "accepted", expectedVersion: null });
      expect(res.status, await res.clone().text()).toBe(201);
    }
    const closed = await closeStage(fx.workStageId);
    expect(closed.status, await closed.clone().text()).toBe(201);
    const body = await closed.json();

    expect(body.vacuous).toBe(false);
    expect(body.evaluatedOccurrenceCount).toBe(2);
    expect(body.frozenOccurrences.every((f: any) => f.satisfiedBy === "evidence_decision"))
      .toBe(true);

    // The frozen set is ROWS, and each row names the exact accepting decision.
    const members = await q<{ requirement_occurrence_id: string; relied_on_decision_id: string }>(
      `select requirement_occurrence_id, relied_on_decision_id
         from public.stage_closure_occurrences
        where workspace_id = $1 and stage_closure_id = $2`,
      [fx.workspaceId, body.stageClosureId]);
    expect(members.length).toBe(2);
    expect(members.every((r) => r.relied_on_decision_id !== null)).toBe(true);

    const stage = await q<{ status: string; version: string }>(
      `select status, version::text from public.work_stages where id = $1`, [fx.workStageId]);
    expect(stage[0]!.status).toBe("closed");
    expect(stage[0]!.version).toBe("2");
  });

  it("closes on one accepting decision and one waiver — the disjunction, not two of a kind", async () => {
    // `satisfied(o)` is a DISJUNCTION (execution-and-evidence.md §Satisfaction),
    // and every other closing case in this file satisfies BOTH obligations THE
    // SAME WAY: two decisions, or two exceptions. A command that built the frozen
    // set from one branch — walk the decision heads, or walk the exception heads —
    // would close both of those and fail only here, so the mixed stage is its own
    // case rather than a variation of one of them.
    const waived = await except(fx.occurrenceIds[0]!,
      { action: "waiver", reason: "Приклад-відмова від вимоги.", expectedVersion: null });
    expect(waived.status, await waived.clone().text()).toBe(201);
    const exceptionId = (await waived.json()).exceptionId as string;

    // INV-069 permits this member to decide the OTHER obligation: no evidence has
    // been captured against it and no progress has been recorded on the
    // assignment in this test. The case that records progress first is asserted
    // above, and is why the money case below satisfies by exception instead.
    const accepted = await decide(fx.occurrenceIds[1]!,
      { outcome: "accepted", expectedVersion: null });
    expect(accepted.status, await accepted.clone().text()).toBe(201);
    const decisionId = (await accepted.json()).decisionId as string;

    const closed = await closeStage(fx.workStageId);
    expect(closed.status, await closed.clone().text()).toBe(201);
    const body = await closed.json();
    expect(body.evaluatedOccurrenceCount).toBe(2);

    // Read from the TABLE and not from the receipt: the receipt is assembled by
    // the same loop that writes these rows, so asserting it against itself would
    // prove only that the loop is self-consistent.
    const members = await q<{
      requirement_occurrence_id: string; satisfied_by: string;
      relied_on_decision_id: string | null; relied_on_exception_id: string | null;
      relied_on_exception_action: string | null;
    }>(`select requirement_occurrence_id, satisfied_by, relied_on_decision_id,
               relied_on_exception_id, relied_on_exception_action
          from public.stage_closure_occurrences
         where workspace_id = $1 and stage_closure_id = $2`,
      [fx.workspaceId, body.stageClosureId]);
    expect(members).toHaveLength(2);
    const byOccurrence = new Map(members.map((r) => [r.requirement_occurrence_id, r]));

    const waivedRow = byOccurrence.get(fx.occurrenceIds[0]!)!;
    expect(waivedRow.satisfied_by).toBe("exception");
    expect(waivedRow.relied_on_exception_id).toBe(exceptionId);
    expect(waivedRow.relied_on_exception_action).toBe("waiver");
    expect(waivedRow.relied_on_decision_id).toBeNull();

    const decidedRow = byOccurrence.get(fx.occurrenceIds[1]!)!;
    expect(decidedRow.satisfied_by).toBe("evidence_decision");
    expect(decidedRow.relied_on_decision_id).toBe(decisionId);
    expect(decidedRow.relied_on_exception_id).toBeNull();
  });

  it("refuses a second closure of the same stage", async () => {
    for (const occurrenceId of fx.occurrenceIds) {
      await decide(occurrenceId, { outcome: "accepted", expectedVersion: null });
    }
    expect((await closeStage(fx.workStageId)).status).toBe(201);

    // INV-076. ADR-005 defines no reopen, so the second attempt is refused before
    // the guard or the lineage key is reached — and either way there is exactly
    // one closure.
    const again = await closeStage(fx.workStageId, 2);
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe("VERSION_CONFLICT");
    const rows = await q<{ n: string }>(
      `select count(*)::text n from public.stage_closures where work_stage_id = $1`,
      [fx.workStageId]);
    expect(rows[0]!.n).toBe("1");
  });

  it("denies a decision by the member who recorded the progress (INV-069)", async () => {
    const { POST: rec } = await import("../app/v1/assignments/[assignmentId]/progress/route");
    const recorded = await rec(jsonReq("http://x", { quantity: "4" }),
      { params: Promise.resolve({ assignmentId: fx.assignmentId }) });
    expect(recorded.status, await recorded.clone().text()).toBe(201);

    const res = await decide(fx.occurrenceIds[0]!,
      { outcome: "accepted", expectedVersion: null });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("READINESS_OVERRIDE_DENIED");

    const rows = await q<{ n: string }>(
      `select count(*)::text n from public.requirement_evidence_decisions where workspace_id = $1`,
      [fx.workspaceId]);
    expect(rows[0]!.n).toBe("0");
  });

  it("permits the same member to record the exception (INV-069 is about deciding)", async () => {
    // The escape is not the obligation being met — it is a named actor stating on
    // the record that it will not be met and accepting the consequence. Applying
    // the self-decision rule here would mean a foreman could never record the
    // risk he is the one taking, which converts the escape into an escalation.
    const { POST: rec } = await import("../app/v1/assignments/[assignmentId]/progress/route");
    await rec(jsonReq("http://x", { quantity: "4" }),
      { params: Promise.resolve({ assignmentId: fx.assignmentId }) });

    const res = await except(fx.occurrenceIds[0]!,
      { action: "accept_risk", reason: "Приклад-ризик прийнято.", expectedVersion: null });
    expect(res.status, await res.clone().text()).toBe(201);
  });
});

describe("INV-065 — the gate never refuses to record a fact", () => {
  it("records performed quantity while the stage is blocked", async () => {
    expect((await closeStage(fx.workStageId)).status).toBe(409);

    const { POST } = await import("../app/v1/assignments/[assignmentId]/progress/route");
    const res = await POST(jsonReq("http://x", { quantity: "2.5" }),
      { params: Promise.resolve({ assignmentId: fx.assignmentId }) });
    expect(res.status, await res.clone().text()).toBe(201);
    // ADR-008: recorded and UNVALUED. The quantity is a fact; the money waits for
    // admission and there is no allocation row yet.
    expect((await res.json()).admitted).toBe(false);

    const allocations = await q<{ n: string }>(
      `select count(*)::text n from public.valuation_allocations where workspace_id = $1`,
      [fx.workspaceId]);
    expect(allocations[0]!.n).toBe("0");
  });

  it("has no v0.1 carrier for the third clause, and that is recorded rather than tested", () => {
    // INV-065 also says «recording that a stage was in fact covered is always
    // permitted», and version-0.1.md §M3 lists it as an exit gate AND a security
    // test. Its carrier is `public.unevidenced_closures`, which ADR-006 decision
    // 4 puts in v0.2 — so after migration 0045 a stage reaches `closed` only
    // through a satisfied closure and a crew that covered work without its
    // evidence has NOWHERE to say so.
    //
    // No assertion is written for it. A test that passed here would have to
    // assert something other than the invariant, and a skipped test that claimed
    // to cover it would be worse. Either INV-065 gains a v0.1 qualifier the way
    // INV-061, INV-062 and INV-071 already carry one, or version-0.1.md §M3 stops
    // listing an exit gate no v0.1 route can meet. Neither is a test's to decide.
    expect(true).toBe(true);
  });
});

describe("readiness.get and blocked_reasons.get agree with the command", () => {
  it("reports the same verdict the closure enforces, before and after", async () => {
    const before = await readiness(fx.projectId);
    expect(before.source).toBe("computed");
    const stage = before.stages.find((s: any) => s.workStageId === fx.workStageId);
    expect(stage.canCloseStage).toBe(false);
    expect(stage.blockingOccurrenceCount).toBe(2);
    expect(stage.satisfiedOccurrenceCount).toBe(0);
    expect(before.summary.blockedCount).toBe(1);
    expect(before.summary.vacuouslyClosableCount).toBe(0);
    expect((await closeStage(fx.workStageId)).status).toBe(409);

    for (const occurrenceId of fx.occurrenceIds) {
      await decide(occurrenceId, { outcome: "accepted", expectedVersion: null });
    }

    const after = await readiness(fx.projectId);
    const ready = after.stages.find((s: any) => s.workStageId === fx.workStageId);
    expect(ready.canCloseStage).toBe(true);
    expect(ready.blockedReasons).toEqual([]);
    expect(after.summary.closableCount).toBe(1);
    expect((await closeStage(fx.workStageId)).status).toBe(201);

    // A closed stage is not «closable»: it is closed.
    const done = await readiness(fx.projectId);
    expect(done.summary.closedCount).toBe(1);
    expect(done.summary.closableCount).toBe(0);
  });

  it("hands the owner the same objects the foreman was refused with", async () => {
    const refusal = await (await closeStage(fx.workStageId)).json();
    const list = await blockedReasons(fx.projectId);

    const fromRefusal = refusal.details.blockedReasons
      .map((r: any) => `${r.requirementOccurrenceId}|${r.code}`).sort();
    const fromRead = list.blockedReasons
      .map((r: any) => `${r.requirementOccurrenceId}|${r.code}`).sort();
    expect(fromRead).toEqual(fromRefusal);

    // INV-070: two unmet requirements on ONE assignment are one amount, not two.
    expect(list.blockedReasons).toHaveLength(2);
    expect(list.totalsByCurrency).toHaveLength(1);
    expect(list.totalsByCurrency[0].assignmentCount).toBe(1);
    expect(BigInt(list.totalsByCurrency[0].grossMinorUnits))
      .toBe(BigInt(list.blockedReasons[0].blockedValue.grossMinorUnits));
    expect(list.byCode).toEqual([{ code: "SUPERVISION_SIGNATURE_MISSING", occurrenceCount: 2 }]);
  });

  it("drops a stage's reasons once it is closed", async () => {
    for (const occurrenceId of fx.occurrenceIds) {
      await decide(occurrenceId, { outcome: "accepted", expectedVersion: null });
    }
    expect((await closeStage(fx.workStageId)).status).toBe(201);
    const list = await blockedReasons(fx.projectId);
    expect(list.blockedReasons).toEqual([]);
    expect(list.totalsByCurrency).toEqual([]);
  });
});

/**
 * M3 PRE-LANDING REVIEW FINDING 5, raised to HIGH by the v0.1 final review once
 * `blocked_value.get` became the third route demanding the same grant.
 *
 * `rp_select` and `br_select` (migration 0045:1640-1642, :1652-1654) both read
 * `array['readiness.view','project.admin']` and 0045:1556-1560 says why in
 * terms: «project.admin is admitted alongside it so the pilot is not locked out
 * of its own money screen». The routes asked for a LITERAL `readiness.view`
 * grant, because `requireProjectCapability` implied `project.admin` for
 * `project.view` alone — so the database would have answered and the command
 * layer refused.
 *
 * NOTHING ELSE IN THIS FILE COULD SEE IT: `CAPS` above grants `readiness.view`
 * by hand to every actor, which is the shape of a gap a fixture hides. These two
 * cases use a member who holds NO hand-issued capability at all.
 */
describe("the money reads and the project admin", () => {
  const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  async function joinAs(user: string, capabilities: string[]): Promise<void> {
    await q(`insert into public.memberships (organization_id, user_id, role, status)
             values ($1,$2,'member','active')`, [fx.workspaceId, user]);
    const member = await q<{ id: string }>(
      `select id from public.memberships where organization_id=$1 and user_id=$2`,
      [fx.workspaceId, user]);
    if (capabilities.length > 0) {
      const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
      const res = await POST(jsonReq("http://x", { memberId: member[0]!.id, capabilities }),
        { params: Promise.resolve({ projectId: fx.projectId }) });
      if (res.status >= 300) throw new Error(`grant ${res.status} ${await res.text()}`);
    }
  }

  it("answers a project.admin who holds no hand-issued readiness.view", async () => {
    // ONE capability, and it is the one `responsibility-presets.csv` actually
    // ships (`project_manager` → `project.admin assignments.manage`). Before
    // 2026-08-08 both calls below were 403 SCOPE_PROJECT_DENIED.
    await joinAs(C, ["project.admin"]);
    current = C;

    const view = await readiness(fx.projectId);
    const blocked = await blockedReasons(fx.projectId);

    // NOT AN EMPTY ANSWER — the distinction the readiness route's header is
    // built around. A 200 carrying `{stages: []}` would mean the capability
    // check passed and RLS then hid every fact, which is the outcome that route
    // calls the worst of the three.
    expect(view.summary.stageCount).toBe(1);
    expect(view.summary.blockedCount).toBe(1);
    expect(blocked.blockedReasons).toHaveLength(2);
    expect(blocked.totalsByCurrency).toHaveLength(1);
    expect(BigInt(blocked.totalsByCurrency[0].grossMinorUnits)).toBeGreaterThan(0n);
  });

  it("still refuses a member of the workspace who holds no project capability", async () => {
    // The implication is `project.admin` and nothing else. Active membership in
    // the workspace is not a project grant, and the money read is not something
    // every member of the pilot's workspace may open — which is the property the
    // other candidate fix for finding 5 (widening the route to `project.view`)
    // would have started eroding.
    await joinAs(C, []);
    current = C;

    const { GET } = await import("../app/v1/projects/[projectId]/readiness/route");
    const res = await GET(new Request("http://x"),
      { params: Promise.resolve({ projectId: fx.projectId }) });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("does not let a project.admin close a stage", async () => {
    // `project.admin` implies the two READS and never the actions. An admin who
    // can hand out access is not thereby the person who signs off a hold point,
    // and `ws_update` (0045:1634-1638) asks `stage_closures.close` of the
    // database as well.
    await joinAs(C, ["project.admin"]);
    current = C;
    const res = await closeStage(fx.workStageId);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });
});

/**
 * M3 PRE-LANDING REVIEW FINDINGS 7 AND 13.
 *
 * Three commands act on one work assignment and two of them refused a
 * non-`active` one. The third is the one that moves the money.
 */
describe("the closure and the assignment behind it", () => {
  async function satisfyByException(): Promise<void> {
    for (const occurrenceId of fx.occurrenceIds) {
      const res = await except(occurrenceId,
        { action: "accept_risk", reason: "Приклад-ризик прийнято.", expectedVersion: null });
      expect(res.status, await res.clone().text()).toBe(201);
    }
  }

  it("refuses a cancelled assignment, and admits none of its money", async () => {
    // Recorded and escaped WHILE ACTIVE, so the only thing standing between this
    // closure and the pool at the end is the check under test: the gate itself
    // is open, a real quantity is waiting on a priced line, and ADR-008 makes
    // this command the admission event.
    const { POST: rec } = await import("../app/v1/assignments/[assignmentId]/progress/route");
    const recorded = await rec(jsonReq("http://x", { quantity: "4" }),
      { params: Promise.resolve({ assignmentId: fx.assignmentId }) });
    expect(recorded.status, await recorded.clone().text()).toBe(201);
    await satisfyByException();

    // No v0.1 operation cancels an assignment (scope-v0.1.csv carries
    // `assignments.create` and `assignments.list` and nothing else), so the
    // state is reached the only way it can be reached today — directly. That is
    // also why the route does not re-read this status under a lock.
    await q(`update public.work_assignments set status = 'cancelled' where id = $1`,
      [fx.assignmentId]);

    const res = await closeStage(fx.workStageId);
    expect(res.status).toBe(409);
    const body = await res.json();
    // NOT `HOLD_POINT_BLOCKED`: the hold points are satisfied. The refusal is
    // about the assignment, and it is the sibling commands' refusal verbatim.
    expect(body.code).toBe("VERSION_CONFLICT");
    // technical/error-catalog.csv:13 — 409, retryable TRUE,
    // refresh_compare_retry. Finding 13: this route said `false`.
    expect(body.retryable).toBe(true);
    expect(body.userAction).toBe("refresh_compare_retry");

    // A REFUSAL WRITES NOTHING, including no money.
    const after = await q<{ status: string; closures: string; allocations: string }>(
      `select (select status from public.work_stages where id = $1) as status,
              (select count(*)::text from public.stage_closures where work_stage_id = $1) as closures,
              (select count(*)::text from public.valuation_allocations
                where workspace_id = $2) as allocations`,
      [fx.workStageId, fx.workspaceId]);
    expect(after[0]!.status).toBe("open");
    expect(after[0]!.closures).toBe("0");
    expect(after[0]!.allocations).toBe("0");
  });

  it("agrees with progress.record and work_stages.create about a completed assignment", async () => {
    await satisfyByException();
    await q(`update public.work_assignments set status = 'completed' where id = $1`,
      [fx.assignmentId]);

    const { POST: rec } = await import("../app/v1/assignments/[assignmentId]/progress/route");
    const { POST: stage } = await import("../app/v1/assignments/[assignmentId]/stages/route");
    const params = { params: Promise.resolve({ assignmentId: fx.assignmentId }) };

    const measured = await rec(jsonReq("http://x", { quantity: "1" }), params);
    const created = await stage(jsonReq("http://x",
      { stageKey: "prykhovani-roboty-2", isConcealed: true }), params);
    const closed = await closeStage(fx.workStageId);

    // THREE COMMANDS, ONE OPINION. `completed` is not `active` either, and the
    // status vocabulary (0015:86-87) has three more values that are not.
    expect([measured.status, created.status, closed.status]).toEqual([409, 409, 409]);
    for (const res of [measured, created, closed]) {
      expect((await res.json()).code).toBe("VERSION_CONFLICT");
    }
  });

  it("carries the catalogued retryable value on a stale expectedVersion too", async () => {
    // The same helper raises every conflict this route makes, so the catalog
    // value is asserted on a second one — a caller that reads `retryable` to
    // decide whether to offer «оновити і повторити» was being told not to.
    const res = await closeStage(fx.workStageId, 99);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("VERSION_CONFLICT");
    expect(body.retryable).toBe(true);
    expect(body.userAction).toBe("refresh_compare_retry");
  });
});

/**
 * M3 PRE-LANDING REVIEW FINDING 9. ADR-005 decision 3: «the escape stays
 * visible». It was visible only in `stage_closure_occurrences`; the audit row
 * and the durable event said a stage closed and not that it closed on a waiver.
 */
describe("the closure records how many obligations were escaped rather than met", () => {
  it("counts decisions and exceptions in the audit row and in the outbox payload", async () => {
    const waived = await except(fx.occurrenceIds[0]!,
      { action: "waiver", reason: "Приклад-відмова від вимоги.", expectedVersion: null });
    expect(waived.status, await waived.clone().text()).toBe(201);
    const accepted = await decide(fx.occurrenceIds[1]!,
      { outcome: "accepted", expectedVersion: null });
    expect(accepted.status, await accepted.clone().text()).toBe(201);

    const closed = await closeStage(fx.workStageId);
    expect(closed.status, await closed.clone().text()).toBe(201);
    const closureId = (await closed.json()).stageClosureId as string;

    const audit = await q<{ details: any }>(
      `select details from public.audit_events
        where organization_id = $1 and action = 'work_stage.closed'`, [fx.workspaceId]);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.details.stageClosureId).toBe(closureId);
    expect(audit[0]!.details.satisfiedByExceptionCount).toBe(1);
    expect(audit[0]!.details.satisfiedByDecisionCount).toBe(1);
    // The two are the whole of the evaluated set on any closure that happened:
    // an unsatisfied occurrence would have been a 409.
    expect(audit[0]!.details.satisfiedByExceptionCount
           + audit[0]!.details.satisfiedByDecisionCount)
      .toBe(audit[0]!.details.evaluatedOccurrenceCount);

    // AND ON THE DURABLE EVENT, because that is what a projection rebuilder and
    // a notification creator will replay from; neither is deployed, and neither
    // should have to re-read the frozen set to say a stage closed on a waiver.
    const event = await q<{ payload: any; payload_version: number }>(
      `select payload, payload_version from public.transaction_outbox
        where topic = 'work_stage.closed'`, []);
    expect(event).toHaveLength(1);
    expect(event[0]!.payload.satisfiedByExceptionCount).toBe(1);
    expect(event[0]!.payload.satisfiedByDecisionCount).toBe(1);
    // Two added scalars on a topic no consumer reads is not a compatibility
    // event, and bumping the version would claim one that did not happen.
    expect(event[0]!.payload_version).toBe(1);
  });

  it("records zero escapes when every obligation was actually met", async () => {
    // The counts must be the SET's composition and not a flag: a closure with no
    // escape has to say so, or «closed on two waivers» and «closed properly»
    // are the same audit row with one field missing.
    for (const occurrenceId of fx.occurrenceIds) {
      const res = await decide(occurrenceId, { outcome: "accepted", expectedVersion: null });
      expect(res.status, await res.clone().text()).toBe(201);
    }
    expect((await closeStage(fx.workStageId)).status).toBe(201);

    const audit = await q<{ details: any }>(
      `select details from public.audit_events
        where organization_id = $1 and action = 'work_stage.closed'`, [fx.workspaceId]);
    expect(audit[0]!.details.satisfiedByExceptionCount).toBe(0);
    expect(audit[0]!.details.satisfiedByDecisionCount).toBe(2);
  });
});

describe("ADR-008 — the carve happens at admission, and a refusal carves nothing", () => {
  /**
   * `admission-valuation.int.test.ts` carries the price/tax/basis matrix, and it
   * runs over a VACUOUS stage — one with no obligation at all, which is the only
   * fixture in which the arithmetic can be read without the gate also being under
   * test. That leaves the sentence ADR-008 is actually about unasserted: «A
   * closure that is refused carves nothing, because a refused closure writes
   * nothing at all.»
   *
   * A refusal over an EMPTY POOL carves nothing whatever the command does, so
   * «writes nothing at all» in the refusal suite above proves nothing about money.
   * The case has to be run with a real quantity recorded, a priced line behind it,
   * and a gate that is genuinely shut — which is this fixture and no other in the
   * repository.
   */
  it("carves nothing while the hold is unmet, and only the covered quantity once it lifts", async () => {
    const { POST: rec } = await import("../app/v1/assignments/[assignmentId]/progress/route");
    const recorded = await rec(jsonReq("http://x", { quantity: "4" }),
      { params: Promise.resolve({ assignmentId: fx.assignmentId }) });
    expect(recorded.status, await recorded.clone().text()).toBe(201);
    const progressEntryId = (await recorded.json()).progressEntryId as string;

    // THE ORACLE IS THE LINE, NOT THE WRITER. Every figure the carve is checked
    // against below is read from `public.work_items` — the pool the baseline
    // published — so nothing here restates `sliceAllocation`'s arithmetic back at
    // itself. The fixture's line is 10 units at a known price, and 4 of them were
    // recorded; that division is exact, so the proportion can be asserted without
    // encoding a rounding rule.
    const line = await q<{ gross: string; qty: string }>(
      `select gross_amount_minor_units::text gross, contract_quantity::text qty
         from public.work_items where id = $1`, [fx.workItemId]);
    const poolGross = BigInt(line[0]!.gross);
    expect(poolGross).toBeGreaterThan(0n);
    expect(Number(line[0]!.qty)).toBe(10);

    // ── the gate is shut, and there IS money on the table ────────────────────
    const refused = await closeStage(fx.workStageId);
    expect(refused.status).toBe(409);
    expect((await refused.json()).code).toBe("HOLD_POINT_BLOCKED");

    const carvedNothing = await q<{ n: string }>(
      `select count(*)::text n from public.valuation_allocations where workspace_id = $1`,
      [fx.workspaceId]);
    expect(carvedNothing[0]!.n).toBe("0");

    // INV-089: the head is open, carries the whole recorded quantity, and has
    // reserved nothing. After ADR-008 that is a REQUIRED state and not a tolerated
    // one — no projection or command may read it as an error.
    const head = await q<{ effective_quantity: string; reserved_quantity: string }>(
      `select effective_quantity::text, reserved_quantity::text
         from public.progress_allocation_heads
        where workspace_id = $1 and root_progress_entry_id = $2`,
      [fx.workspaceId, progressEntryId]);
    expect(Number(head[0]!.effective_quantity)).toBe(4);
    expect(Number(head[0]!.reserved_quantity)).toBe(0);

    // ── the gate lifts ───────────────────────────────────────────────────────
    // By EXCEPTION and not by decision, and the reason is INV-069 rather than
    // convenience: this member recorded the quantity, so the decision route
    // refuses them every obligation of the assignment. The escape is the path a
    // single-member pilot actually has, and responsibility-presets.csv says «one
    // member may combine responsibilities in v0.1».
    for (const occurrenceId of fx.occurrenceIds) {
      const res = await except(occurrenceId, {
        action: "accept_risk", reason: "Приклад-ризик прийнято до усунення.",
        expectedVersion: null,
      });
      expect(res.status, await res.clone().text()).toBe(201);
    }

    const closed = await closeStage(fx.workStageId);
    expect(closed.status, await closed.clone().text()).toBe(201);
    const closure = await closed.json();
    expect(closure.admission.admittedProgressEntryCount).toBe(1);
    expect(closure.admission.admittedProgressEntryIds).toEqual([progressEntryId]);
    expect(closure.admission.valued).toBe(true);

    const rows = await q<{
      progress_entry_id: string; quantity: string; funded_quantity: string;
      net: string | null; tax: string | null; gross: string | null;
      unvalued_reason: string | null;
      admitted_by_closure_id: string | null; admitted_work_assignment_id: string | null;
    }>(`select progress_entry_id, quantity::text, funded_quantity::text,
               net_minor_units::text net, tax_minor_units::text tax,
               gross_minor_units::text gross, unvalued_reason,
               admitted_by_closure_id, admitted_work_assignment_id
          from public.valuation_allocations where workspace_id = $1`, [fx.workspaceId]);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.progress_entry_id).toBe(progressEntryId);
    expect(row.unvalued_reason).toBeNull();

    // ONLY THE COVERED QUANTITY. The slice values the 4 units that were recorded
    // and not the 10 the line was agreed for: a closure that admitted the line
    // would reconcile in aggregate and be wrong per lineage.
    expect(Number(row.quantity)).toBe(4);
    expect(Number(row.funded_quantity)).toBe(4);
    expect(BigInt(row.gross!)).toBeLessThan(poolGross);
    expect(BigInt(row.gross!)).toBe(BigInt(row.net!) + BigInt(row.tax!));
    // The proportion, from the pool rather than from the writer. The exactness of
    // the division is asserted FIRST, so a change to the fixture's pricing fails
    // on the precondition rather than looking like a money bug — no rounding rule
    // is being restated here, and none should be.
    expect((poolGross * 4n) % 10n).toBe(0n);
    expect(BigInt(row.gross!)).toBe((poolGross * 4n) / 10n);

    // INV-089: the money names the admission that carved it and the assignment
    // whose stage was closed. Without the second column the first could name any
    // closure in the workspace and every row would still resolve (migration 0046
    // §2).
    expect(row.admitted_by_closure_id).toBe(closure.stageClosureId);
    expect(row.admitted_work_assignment_id).toBe(fx.assignmentId);
  });
});

describe("work_stages.create", () => {
  it("creates an EMPTY stage and says so", async () => {
    const { POST } = await import("../app/v1/assignments/[assignmentId]/stages/route");
    const res = await POST(jsonReq("http://x",
      { stageKey: "montazhni-roboty", isConcealed: false }),
      { params: Promise.resolve({ assignmentId: fx.assignmentId }) });
    expect(res.status, await res.clone().text()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("open");
    // No v0.1 route materialises an occurrence outside `assignments.create`, so a
    // hand-created stage carries none and CLOSES VACUOUSLY. The count is on the
    // receipt so nobody has to discover that after closing it (INV-072).
    expect(body.blockingOccurrenceCount).toBe(0);

    const closed = await closeStage(body.workStageId);
    expect(closed.status, await closed.clone().text()).toBe(201);
    const closure = await closed.json();
    expect(closure.vacuous).toBe(true);
    expect(closure.evaluatedOccurrenceCount).toBe(0);
    // The digest of the empty string — the constant migration 0045 §0 asserts at
    // migration time precisely so a TypeScript caller's disagreement surfaces
    // here rather than as a deferred-trigger failure at COMMIT.
    expect(closure.evaluatedOccurrenceSetHash)
      .toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("refuses a duplicate closable unit", async () => {
    const { POST } = await import("../app/v1/assignments/[assignmentId]/stages/route");
    const body = { stageKey: STAGE, isConcealed: true };
    // The materialised stage already holds this key on this assignment.
    const res = await POST(jsonReq("http://x", body),
      { params: Promise.resolve({ assignmentId: fx.assignmentId }) });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ASSIGNMENT_CONFLICT");
  });
});
