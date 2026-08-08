import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient } from "./pg";
import {
  dropRulesWorkspaces, raised, seedRulesWorld, sqlstate, type RulesFixture,
} from "./m1-rules-fixture";
import {
  APPROVER_ROLE, EMPTY_SET_HASH, EXCEPTION_INSERT, DECISION_INSERT,
  advanceDecisionHead, advanceExceptionHead, appendMemberLater, attemptClosure,
  decisionParams, exceptionParams, frozenSetHash, insertDecision, insertException,
  openDecisionHead, openExceptionHead, recordDecision, recordException,
  resetClosureFacts, seedClosureWorld, type ClosureWorld, type FrozenMember,
} from "./m3-closure-fixture";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `vitest`, `tsc`, `psql` and `supabase` were never run against it, no
 * migration was applied, and no claim is made that any assertion below passes.
 * Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M3, storage layer: the gate as a SHAPE.
 *
 * version-0.1.md §v0.1-M3 says what has to be true — «`can_close_stage` is
 * implemented exactly as written in ADR-005 decision 7 and the closure command
 * REFUSES» — and `apps/app/tests/m3-refusal.int.test.ts` proves the command does
 * refuse, with the reason object a foreman reads. THIS suite proves the other
 * half, and it is the half that survives a rewrite of the command: every refusal
 * below is attempted from the ADMIN CONNECTION, the table owner, with RLS
 * bypassed, so what answers is a key, a CHECK or a trigger.
 *
 * WHY THAT DISTINCTION IS THE WHOLE POINT HERE. A gate enforced by a route is a
 * gate the next route can forget. INV-061's enforcement column says the
 * predicate is evaluated inside the closure transaction; migration 0045 §5 goes
 * further and makes «a closure exists ⟹ every blocking obligation of its stage
 * carries an accepting decision or a waiver» a database rule, up to head
 * currency. If that rule holds, a second command written years from now cannot
 * close a stage past an unmet hold even by accident. This suite is where that
 * claim is attacked.
 *
 * WHAT THIS SUITE CANNOT PROVE, NAMED SO IT IS NOT MISTAKEN FOR PROVED:
 *
 *   HEAD CURRENCY. `stage_closure_occurrences` pins that the relied-on fact is
 *   an ACCEPTING decision (or a waiver/accept_risk exception) ON THIS
 *   OCCURRENCE. It does not pin that the fact was the CURRENT head at closure
 *   time — migration 0045's own header says so — so a superseded acceptance is
 *   storable here. That guarantee lives in the command, and
 *   `m3-refusal.int.test.ts` is where it is asserted. No case below asserts the
 *   database's tolerance of it: an assertion that a superseded decision may be
 *   frozen would be pinning current behaviour, which is the one thing a test in
 *   this repository may not do.
 *
 *   INV-069. No constraint on `requirement_evidence_decisions` says a member may
 *   not decide their own capture — 0045's comment says why a trigger would fail
 *   open — so that refusal is the command's and is asserted through the route.
 */

const WS_A = "feee1111-1111-1111-1111-111111111111";
const WS_B = "feee2222-2222-2222-2222-222222222222";
const USER_A = "feee3333-3333-3333-3333-333333333333";
const USER_B = "feee4444-4444-4444-4444-444444444444";

let c: Client;
let a: RulesFixture;
let b: RulesFixture;
let wa: ClosureWorld;
let wb: ClosureWorld;

async function count(table: string, workspaceId: string): Promise<number> {
  const r = await c.query<{ n: number }>(
    `select count(*)::int as n from public.${table} where workspace_id = $1`, [workspaceId]);
  return r.rows[0]!.n;
}

async function stageRow(id: string): Promise<{ status: string; version: string }> {
  const r = await c.query<{ status: string; version: string }>(
    `select status, version::text from public.work_stages where id = $1`, [id]);
  return r.rows[0]!;
}

/** Both obligations accepted, and the heads opened — the satisfied precondition. */
async function acceptBoth(w: ClosureWorld): Promise<{ decisionA: string; decisionB: string }> {
  const decisionA = await recordDecision(c, w, { occurrenceId: w.blockingA, outcome: "accepted" });
  const decisionB = await recordDecision(c, w, { occurrenceId: w.blockingB, outcome: "accepted" });
  return { decisionA, decisionB };
}

beforeAll(async () => {
  c = await adminClient();
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  a = await seedRulesWorld(c, { workspaceId: WS_A, userId: USER_A, suffix: "CA" });
  b = await seedRulesWorld(c, { workspaceId: WS_B, userId: USER_B, suffix: "CB" });
  wa = await seedClosureWorld(c, a);
  wb = await seedClosureWorld(c, b);
}, 180_000);

beforeEach(async () => {
  await resetClosureFacts(c, WS_A);
  await resetClosureFacts(c, WS_B);
});

afterAll(async () => {
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  await c.end();
});

describe("a closure records a satisfied predicate, or it does not exist", () => {
  it("stores a closure over BOTH obligations — the positive control", async () => {
    // Without this, every refusal below could be passing because the closure row
    // is malformed in some way none of them names.
    const { decisionA, decisionB } = await acceptBoth(wa);
    const res = await attemptClosure(c, wa, {
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
        { occurrenceId: wa.blockingB, satisfiedBy: "evidence_decision", decisionId: decisionB },
      ],
    });
    expect(res.error).toBeNull();

    expect(await count("stage_closures", WS_A)).toBe(1);
    expect(await count("stage_closure_occurrences", WS_A)).toBe(2);
    expect(await stageRow(wa.stageId)).toEqual({ status: "closed", version: "2" });

    const stored = await c.query<{ n: number; hash: string }>(
      `select evaluated_occurrence_count as n, evaluated_occurrence_set_hash as hash
         from public.stage_closures where id = $1`, [res.closureId]);
    expect(stored.rows[0]!.n).toBe(2);
    // The digest PostgreSQL recomputed at COMMIT agreed with the one computed in
    // TypeScript. Two independent implementations, and the trigger is the judge.
    expect(stored.rows[0]!.hash).toBe(frozenSetHash([wa.blockingA, wa.blockingB]));
  });

  it("refuses a closure that leaves a blocking obligation OUT of its frozen set", async () => {
    // THE ASSERTION THIS WHOLE MIGRATION EXISTS FOR (INV-061). The count claimed
    // and the member rows agree with each other perfectly; what they do not agree
    // with is the stage. A closure that could omit one obligation would make the
    // gate a matter of which occurrences the command remembered to look at.
    const { decisionA } = await acceptBoth(wa);
    const res = await attemptClosure(c, wa, {
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
      ],
    });
    expect(res.error).toMatch(/INV-061/);
    expect(res.error).toMatch(/out of its frozen set/);

    // The transaction is atomic: the stage did not move either.
    expect(await count("stage_closures", WS_A)).toBe(0);
    expect(await stageRow(wa.stageId)).toEqual({ status: "open", version: "1" });
  });

  it("refuses a closure whose claimed count is not the set it froze", async () => {
    const { decisionA, decisionB } = await acceptBoth(wa);
    const res = await attemptClosure(c, wa, {
      claimedCount: 5,
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
        { occurrenceId: wa.blockingB, satisfiedBy: "evidence_decision", decisionId: decisionB },
      ],
    });
    expect(res.error).toMatch(/claims 5 evaluated occurrences and froze 2/);
    expect(await count("stage_closures", WS_A)).toBe(0);
  });

  it("refuses a closure whose hash does not describe the set it froze", async () => {
    // The hash is what lets a closure be re-defended years later without asking
    // the runtime what the requirements were. A hash nobody checks is a comment.
    const { decisionA, decisionB } = await acceptBoth(wa);
    const res = await attemptClosure(c, wa, {
      claimedHash: frozenSetHash([wa.blockingA]),
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
        { occurrenceId: wa.blockingB, satisfiedBy: "evidence_decision", decisionId: decisionB },
      ],
    });
    expect(res.error).toMatch(/hash does not describe the set that was frozen/);
    expect(await count("stage_closures", WS_A)).toBe(0);
  });

  it("cannot pad the set with an ADVISORY occurrence to make the counts agree", async () => {
    // `advisoryOccurrence` is on the same stage, is applicable, and does NOT
    // block closure. Counting it would let a closure reach the expected number
    // while one real obligation stayed unmet — so the member row's foreign key
    // carries `blocking_scope` and the advisory one has nowhere to resolve.
    const { decisionA } = await acceptBoth(wa);
    const advisoryDecision = await recordDecision(c, wa,
      { occurrenceId: wa.advisoryOccurrence, outcome: "accepted" });
    const res = await attemptClosure(c, wa, {
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
        { occurrenceId: wa.advisoryOccurrence, satisfiedBy: "evidence_decision",
          decisionId: advisoryDecision },
      ],
    });
    expect(res.sqlstate).toBe("23503");
    expect(res.error).toMatch(/stage_closure_occurrences_occurrence_fkey/);
    expect(await count("stage_closures", WS_A)).toBe(0);
  });

  it("cannot freeze an occurrence of a DIFFERENT stage", async () => {
    const { decisionA } = await acceptBoth(wa);
    const otherDecision = await recordDecision(c, wa,
      { occurrenceId: wa.otherStageOccurrence, outcome: "accepted" });
    const res = await attemptClosure(c, wa, {
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
        { occurrenceId: wa.otherStageOccurrence, satisfiedBy: "evidence_decision",
          decisionId: otherDecision },
      ],
    });
    expect(res.sqlstate).toBe("23503");
    expect(await count("stage_closures", WS_A)).toBe(0);
  });

  it("cannot freeze a RETURN as if it satisfied anything", async () => {
    const decisionA = await recordDecision(c, wa,
      { occurrenceId: wa.blockingA, outcome: "accepted" });
    const returned = await recordDecision(c, wa,
      { occurrenceId: wa.blockingB, outcome: "returned",
        reason: "Приклад-фото не показує ділянку повністю." });
    const res = await attemptClosure(c, wa, {
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
        // The row declares 'accepted' because the column is CHECK-forced to it;
        // the foreign key then asks the decision itself, and the decision says
        // 'returned'.
        { occurrenceId: wa.blockingB, satisfiedBy: "evidence_decision", decisionId: returned },
      ],
    });
    expect(res.sqlstate).toBe("23503");
    expect(res.error).toMatch(/stage_closure_occurrences_decision_fkey/);
  });

  it("cannot declare one kind of satisfaction and name the other", async () => {
    const { decisionA, decisionB } = await acceptBoth(wa);
    const res = await attemptClosure(c, wa, {
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
        // «satisfied by an exception», with a decision id in the decision column
        // and nothing in the exception column.
        { occurrenceId: wa.blockingB, satisfiedBy: "exception", decisionId: decisionB,
          decisionOutcome: "accepted" },
      ],
    });
    expect(res.sqlstate).toBe("23514");
    expect(res.error).toMatch(/stage_closure_occurrences_satisfaction_check/);
  });

  it("refuses a closure by an actor who does not hold stage_closures.close", async () => {
    // The deferred check is SECURITY DEFINER because it counts rows RLS could
    // hide from the mutating role — and a definer function that skipped
    // authorization would be an oracle for a project the caller cannot see
    // (0017's lesson). It authorizes BEFORE it counts, and this is that.
    // USER_B is an active owner of workspace B and holds nothing in A.
    const { decisionA, decisionB } = await acceptBoth(wa);
    const res = await attemptClosure(c, wa, {
      actorUserId: USER_B,
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
        { occurrenceId: wa.blockingB, satisfiedBy: "evidence_decision", decisionId: decisionB },
      ],
    });
    expect(res.error).toMatch(/not authorized to close a stage in this project/);
    expect(await count("stage_closures", WS_A)).toBe(0);
    expect(await stageRow(wa.stageId)).toEqual({ status: "open", version: "1" });
  });

  it("closes a stage with no blocking obligation, and carries the empty-set digest", async () => {
    // A vacuous closure is CORRECT behaviour and exactly why the dry run must
    // print uncovered lines (INV-072). The digest is asserted against the literal
    // migration 0045 §0 probes at migration time, so three independent
    // definitions — the migration's, PostgreSQL's recomputation, and this
    // package's — are tied together by one constant.
    expect(frozenSetHash([])).toBe(EMPTY_SET_HASH);

    const res = await attemptClosure(c, wa, {
      stageId: wa.foreignAssignmentStageId,
      assignmentId: wa.otherAssignmentId,
      members: [],
    });
    expect(res.error).toBeNull();
    const stored = await c.query<{ n: number; hash: string }>(
      `select evaluated_occurrence_count as n, evaluated_occurrence_set_hash as hash
         from public.stage_closures where id = $1`, [res.closureId]);
    expect(stored.rows[0]!.n).toBe(0);
    expect(stored.rows[0]!.hash).toBe(EMPTY_SET_HASH);
  });

  it("refuses a later occurrence joining a closure already committed", async () => {
    // The mirror of `app.guard_rule_binding_window()`: that guard asks «was this
    // parent created here?» to PERMIT an insert; this one asks it to FORBID one.
    // Without it, a closure could be completed after the fact — the frozen set
    // would be frozen only until somebody wanted it to say something else.
    const { decisionA, decisionB } = await acceptBoth(wa);
    const res = await attemptClosure(c, wa, {
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
        { occurrenceId: wa.blockingB, satisfiedBy: "evidence_decision", decisionId: decisionB },
      ],
    });
    expect(res.error).toBeNull();

    const advisoryDecision = await recordDecision(c, wa,
      { occurrenceId: wa.advisoryOccurrence, outcome: "accepted" });
    const later = await appendMemberLater(c, wa, res.closureId, {
      occurrenceId: wa.advisoryOccurrence, satisfiedBy: "evidence_decision",
      decisionId: advisoryDecision,
    });
    expect(later.error).toMatch(/fixed at the moment of closure and cannot be added to later/);
    expect(await count("stage_closure_occurrences", WS_A)).toBe(2);
  });
});

describe("double-closing one stage is unrepresentable — by a key, not by a route", () => {
  /** The first, satisfied closure. Its members, for a successor to re-freeze. */
  async function firstClosure(): Promise<{ closureId: string; members: FrozenMember[] }> {
    const { decisionA, decisionB } = await acceptBoth(wa);
    const members: FrozenMember[] = [
      { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
      { occurrenceId: wa.blockingB, satisfiedBy: "evidence_decision", decisionId: decisionB },
    ];
    const res = await attemptClosure(c, wa, { members });
    // A PRECONDITION AND NOT AN expect: «the first closure committed» is what
    // this describe block needs in order to attack the second one, and it is
    // asserted as a requirement in the block above.
    if (res.error) throw new Error(`m3-closure-schema: first closure failed — ${res.error}`);
    return { closureId: res.closureId, members };
  }

  it("refuses a SECOND ROOT closure of the same stage with 23505", async () => {
    const { members } = await firstClosure();
    const again = await attemptClosure(c, wa, { members });
    expect(again.sqlstate).toBe("23505");
    expect(again.error).toMatch(/stage_closures_lineage_key/);
    expect(await count("stage_closures", WS_A)).toBe(1);
  });

  it("refuses a successor that names no predecessor", async () => {
    const { members } = await firstClosure();
    const orphan = await attemptClosure(c, wa, { members, closureNo: 2 });
    expect(orphan.sqlstate).toBe("23514");
    expect(orphan.error).toMatch(/stage_closures_chain_check/);
  });

  it("refuses a chain with a hole", async () => {
    // `unique (workspace_id, work_stage_id, closure_no)` alone admits a successor
    // numbered 3 behind a root numbered 1 — a chain nobody can walk. The chain
    // foreign key is what closes it, and it carries the STAGE so a correction
    // cannot supersede a closure of a different stage either.
    const { closureId, members } = await firstClosure();
    const hole = await attemptClosure(c, wa, {
      members, closureNo: 3,
      predecessorClosureId: closureId, predecessorClosureNo: 2,
      correctionReason: "Приклад-виправлення.",
    });
    expect(hole.sqlstate).toBe("23503");
    expect(hole.error).toMatch(/stage_closures_chain_fkey/);
  });

  it("refuses a correction that gives no reason", async () => {
    const { closureId, members } = await firstClosure();
    const silent = await attemptClosure(c, wa, {
      members, closureNo: 2,
      predecessorClosureId: closureId, predecessorClosureNo: 1,
      correctionReason: null,
    });
    expect(silent.sqlstate).toBe("23514");
    expect(silent.error).toMatch(/stage_closures_correction_reason_check/);
  });

  it("refuses a FORK — two successors of one closure", async () => {
    const { closureId, members } = await firstClosure();
    const successor = await attemptClosure(c, wa, {
      members, closureNo: 2,
      predecessorClosureId: closureId, predecessorClosureNo: 1,
      correctionReason: "Приклад-виправлення.",
    });
    // Precondition, not a requirement: whether v0.1 permits a correction at all
    // is open (ADR-008 declines it and the route refuses `correction` by name).
    // What IS required is that two of them cannot exist.
    if (successor.error) {
      throw new Error(`m3-closure-schema: the correction lineage is unreachable — ${successor.error}`);
    }
    const fork = await attemptClosure(c, wa, {
      members, closureNo: 2,
      predecessorClosureId: closureId, predecessorClosureNo: 1,
      correctionReason: "Приклад-друге виправлення.",
    });
    expect(fork.sqlstate).toBe("23505");
    // TWO KEYS FORBID THIS AND THE TEST DOES NOT PICK ONE, because which one
    // answers is index order rather than design. `stage_closures_chain_check`
    // forces a successor's ordinal to be its predecessor's plus one, so two
    // successors of closure 1 both carry closure_no = 2 on the same stage and
    // therefore collide on `stage_closures_lineage_key` as well as on
    // `stage_closures_no_fork_key`. PostgreSQL raises on the first violated
    // unique index in creation order and `lineage_key` is declared first
    // (migration 0045:859-861), so naming `no_fork_key` here would be asserting a
    // detail of index ordering.
    //
    // THAT MAKES `stage_closures_no_fork_key` REDUNDANT ON THIS PATH, and it is
    // recorded rather than treated as covered: within one stage's lineage the
    // contiguity CHECK plus the lineage key already make a fork unrepresentable.
    // The fork key still earns its place if a later migration ever loosens the
    // ordinal rule — which is exactly when a reader would want to know it was
    // never independently exercised.
    expect(fork.error).toMatch(/stage_closures_(no_fork|lineage)_key/);
    // The requirement itself, asserted directly rather than through a name: one
    // root, one successor, and nothing else.
    expect(await count("stage_closures", WS_A)).toBe(2);
  });

  it("makes 'closed' terminal: no reopen, no delete, in either direction", async () => {
    await firstClosure();
    // ADR-005 defines no reopen, and this is what that has to mean in a schema.
    expect(await raised(() => c.query(
      `update public.work_stages set status = 'open', version = version + 1 where id = $1`,
      [wa.stageId]))).toMatch(/already closed; ADR-005 defines no reopen/);
    expect(await raised(() => c.query(
      `update public.work_stages set status = 'closed', version = version + 1 where id = $1`,
      [wa.stageId]))).toMatch(/already closed/);
    expect(await raised(() => c.query(
      `delete from public.work_stages where id = $1`, [wa.stageId])))
      .toMatch(/not deletable; a closure is a fact/);
    expect(await stageRow(wa.stageId)).toEqual({ status: "closed", version: "2" });
  });
});

describe("a stage recorded closed always has a closure fact behind it", () => {
  it("refuses `update work_stages set status = 'closed'` on its own", async () => {
    // WITHOUT THIS, THE STATUS COLUMN IS THE GATE. The foreign key runs from the
    // closure to the stage and not back, so anybody holding stage_closures.close
    // could mark a stage closed with no frozen set, no satisfying decisions and
    // no evidence the predicate was ever evaluated — and readiness would be a
    // status column, which ADR-005 decision 7 says it must never be.
    const res = await attemptClosure(c, wa, { writeClosure: false });
    expect(res.error).toMatch(/recorded closed with no stage_closures fact behind it/);
    expect(await stageRow(wa.stageId)).toEqual({ status: "open", version: "1" });
  });

  it("refuses an INSERT of a stage that is born 'closed'", async () => {
    // THE OTHER DOOR, AND THE ONE 0045 LEFT UNLOCKED. Its trigger was `after
    // update` only, while `status` carries a CHECK that admits 'closed' — so a
    // stage could be INSERTED closed and never need a closure fact at all.
    //
    // What such a row would be is worth naming, because the case above reads as
    // the whole guarantee and is not: `app.guard_work_stage()` refuses every
    // update whose old status is not 'open', so a stage born closed is TERMINAL
    // and can never acquire a closure. It carries no frozen set, it is skipped by
    // blocked_reasons.get, and `isLastOpenStage` in the admission module counts
    // it as not-open — so it RELEASES THE ASSIGNMENT'S MONEY. The whole ADR-005
    // gate, walked around by choosing a value for one column.
    //
    // Migration 0048 recreates the trigger as `after insert or update`. This is
    // attempted from the ADMIN connection like every other case in this file, so
    // what answers is the trigger and not the ws_insert policy — the policy's own
    // half of the fix is asserted in m3-closure-rls.test.ts, and either layer
    // alone would leave the other's door open.
    const born = await raised(() => c.query(
      `insert into public.work_stages
         (workspace_id, project_id, contract_id, contract_version_id,
          work_assignment_id, stage_key, is_concealed, status, created_by_member_id)
       values ($1,$2,$3,$4,$5,$6,true,'closed',$7)`,
      [a.workspaceId, a.projectId, a.contractId, wa.baselineVersionId,
       wa.assignmentId, "prykhovani-roboty-born-closed", a.memberId]));
    expect(born).toMatch(/recorded closed with no stage_closures fact behind it/);

    // THE POSITIVE CONTROL, and it is not padding: without it the assertion above
    // would also pass if the INSERT were failing for a reason that has nothing to
    // do with `status` — a foreign key, the closable-unit index, a NOT NULL. The
    // same row with the same key, differing only in the status word, must land.
    const open = await c.query<{ id: string; status: string }>(
      `insert into public.work_stages
         (workspace_id, project_id, contract_id, contract_version_id,
          work_assignment_id, stage_key, is_concealed, status, created_by_member_id)
       values ($1,$2,$3,$4,$5,$6,true,'open',$7) returning id, status`,
      [a.workspaceId, a.projectId, a.contractId, wa.baselineVersionId,
       wa.assignmentId, "prykhovani-roboty-born-closed", a.memberId]);
    expect(open.rows[0]!.status).toBe("open");

    // Left behind by this case alone — `resetClosureFacts` reopens stages and
    // does not delete them, and the world's other assertions count stages of the
    // ASSIGNMENT nowhere. Removed here so the fixture stays the one
    // `seedClosureWorld` describes.
    await c.query(`delete from public.work_stages where id = $1`, [open.rows[0]!.id]);
  });

  it("refuses a closure against a stage still recorded open", async () => {
    // The other direction: `stage_closures_stage_fkey` names status = 'closed',
    // so the fact and the state cannot disagree.
    const { decisionA, decisionB } = await acceptBoth(wa);
    const res = await attemptClosure(c, wa, {
      moveStage: false,
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
        { occurrenceId: wa.blockingB, satisfiedBy: "evidence_decision", decisionId: decisionB },
      ],
    });
    expect(res.sqlstate).toBe("23503");
    expect(res.error).toMatch(/stage_closures_stage_fkey/);
  });

  it("refuses a closing update that advances the version more than once", async () => {
    expect(await raised(() => c.query(
      `update public.work_stages set status = 'closed', version = version + 2 where id = $1`,
      [wa.stageId]))).toMatch(/must advance its version exactly once/);
  });

  it("refuses a closing update that changes anything else about the stage", async () => {
    expect(await raised(() => c.query(
      `update public.work_stages
          set status = 'closed', version = version + 1, is_concealed = false
        where id = $1`, [wa.stageId])))
      .toMatch(/must not alter anything else about it/);
  });

  it("refuses the v0.2 bypass value through the v0.1 guard", async () => {
    // 'closed_without_evidence' stays in the CHECK so v0.2 is additive and no
    // v0.1 record is reinterpreted; it is unreachable because the GUARD admits
    // one transition, and widening a guard is a `create or replace function`
    // rather than a CHECK anybody has to drop.
    expect(await raised(() => c.query(
      `update public.work_stages
          set status = 'closed_without_evidence', version = version + 1 where id = $1`,
      [wa.stageId]))).toMatch(/admits only the open -> closed transition in v0.1/);
  });
});

describe("a hold can never be marked not_applicable", () => {
  it("refuses not_applicable on a hold by a table CHECK", async () => {
    // INV-063, and version-0.1.md §M3 lists it as an exit gate AND a security
    // test. The command refuses it too (422, asserted through the route) — but a
    // command's refusal is one route away from being forgotten, and this holds
    // regardless of which command, role or UI affordance is involved.
    const state = await sqlstate(() => c.query(EXCEPTION_INSERT,
      exceptionParams(wa, { occurrenceId: wa.blockingA, action: "not_applicable" })));
    expect(state).toBe("23514");
    expect(await count("requirement_exceptions", WS_A)).toBe(0);

    const message = await raised(() => c.query(EXCEPTION_INSERT,
      exceptionParams(wa, { occurrenceId: wa.blockingA, action: "not_applicable" })));
    expect(message).toMatch(/requirement_exceptions_hold_not_applicable_check/);
  });

  it("cannot be dodged by misdeclaring the intervention type", async () => {
    // The type the CHECK reads is pinned FROM the occurrence by
    // requirement_exceptions_occurrence_fkey, so «call it a witness and the
    // prohibition does not apply» has nowhere to resolve. Without that pin the
    // CHECK would be reading a second opinion the caller supplied.
    const state = await sqlstate(() => c.query(EXCEPTION_INSERT,
      exceptionParams(wa, { occurrenceId: wa.blockingA, action: "not_applicable",
                            interventionType: "witness" })));
    expect(state).toBe("23503");
    expect(await count("requirement_exceptions", WS_A)).toBe(0);
  });

  it("keeps waiver and accept_risk available and stored", async () => {
    // «One attributed, visible escape exists, which is what ADR-005's argument
    // against an absolute lock actually requires.» A prohibition test with no
    // positive control beside it would pass just as well against a table that
    // refused every exception.
    expect(await sqlstate(() => c.query(EXCEPTION_INSERT,
      exceptionParams(wa, { occurrenceId: wa.blockingA, action: "waiver" })))).toBeNull();
    expect(await sqlstate(() => c.query(EXCEPTION_INSERT,
      exceptionParams(wa, { occurrenceId: wa.blockingB, action: "accept_risk" })))).toBeNull();
    expect(await count("requirement_exceptions", WS_A)).toBe(2);
  });

  it("refuses an exception with no stated reason", async () => {
    expect(await sqlstate(() => c.query(EXCEPTION_INSERT,
      exceptionParams(wa, { occurrenceId: wa.blockingA, action: "waiver", reason: "   " }))))
      .toBe("23514");
  });

  it("keeps 'revoke' storable and unable to satisfy anything", async () => {
    // 'revoke' is in the vocabulary because the head has to be able to stop
    // pointing at a live exception; scope-v0.1.csv has no revoke operation, so no
    // v0.1 route writes it. What matters here is the second half: a revoked
    // exception can never appear in a frozen closure set.
    const revoked = await insertException(c, wa,
      { occurrenceId: wa.blockingA, action: "revoke" });
    const accepted = await recordDecision(c, wa,
      { occurrenceId: wa.blockingB, outcome: "accepted" });
    const res = await attemptClosure(c, wa, {
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "exception",
          exceptionId: revoked, exceptionAction: "revoke" },
        { occurrenceId: wa.blockingB, satisfiedBy: "evidence_decision", decisionId: accepted },
      ],
    });
    expect(res.sqlstate).toBe("23514");
    expect(res.error).toMatch(/stage_closure_occurrences_relied_on_exception_action_check/);
  });

  it("admits a waiver as the fact a closure relies on", async () => {
    const waiver = await recordException(c, wa,
      { occurrenceId: wa.blockingA, action: "waiver" });
    const risk = await recordException(c, wa,
      { occurrenceId: wa.blockingB, action: "accept_risk" });
    const res = await attemptClosure(c, wa, {
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "exception",
          exceptionId: waiver, exceptionAction: "waiver" },
        { occurrenceId: wa.blockingB, satisfiedBy: "exception",
          exceptionId: risk, exceptionAction: "accept_risk" },
      ],
    });
    expect(res.error).toBeNull();
    // The obligation is IN the frozen set with its exception named beside it, not
    // absent from it: an escape that removed the obligation from the closure's
    // own record would be the exception that hides itself.
    expect(await count("stage_closure_occurrences", WS_A)).toBe(2);
  });
});

describe("an exception supersedes and never edits; the head forbids a fork", () => {
  it("is append-only: no update and no delete, by trigger", async () => {
    const id = await insertException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    expect(await raised(() => c.query(
      `update public.requirement_exceptions set reason = 'Приклад-змінено' where id = $1`, [id])))
      .toMatch(/immutable \(append-only relation\)/);
    expect(await raised(() => c.query(
      `delete from public.requirement_exceptions where id = $1`, [id])))
      .toMatch(/immutable \(append-only relation\)/);
  });

  it("refuses TWO ROOTS on one occurrence", async () => {
    // INV-035's root half is a unique constraint and not a head lock, because a
    // head enforces it only through a command that remembers to take it. Two
    // independent roots must be a 23505, never a command's oversight.
    await insertException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    const second = await sqlstate(() => c.query(EXCEPTION_INSERT,
      exceptionParams(wa, { occurrenceId: wa.blockingA, action: "accept_risk" })));
    expect(second).toBe("23505");
    const message = await raised(() => c.query(EXCEPTION_INSERT,
      exceptionParams(wa, { occurrenceId: wa.blockingA, action: "accept_risk" })));
    expect(message).toMatch(/requirement_exceptions_lineage_key/);
  });

  it("supersedes by APPENDING a successor that names the exact prior fact", async () => {
    const first = await recordException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    const second = await recordException(c, wa,
      { occurrenceId: wa.blockingA, action: "accept_risk",
        exceptionNo: 2, predecessorExceptionId: first, predecessorExceptionNo: 1 });

    const rows = await c.query<{ id: string; action: string; exception_no: number }>(
      `select id, action, exception_no from public.requirement_exceptions
        where requirement_occurrence_id = $1 order by exception_no`, [wa.blockingA]);
    // The first fact is still there, unchanged. A correction is a second row.
    expect(rows.rows.map((r) => [r.exception_no, r.action]))
      .toEqual([[1, "waiver"], [2, "accept_risk"]]);

    const head = await c.query<{ current_exception_id: string; current_action: string; version: string }>(
      `select current_exception_id, current_action, version::text
         from public.requirement_exception_heads where requirement_occurrence_id = $1`,
      [wa.blockingA]);
    expect(head.rows[0]!.current_exception_id).toBe(second);
    expect(head.rows[0]!.current_action).toBe("accept_risk");
    expect(head.rows[0]!.version).toBe("2");
    expect(first).not.toBe(second);
  });

  it("refuses a FORK — two successors of one exception", async () => {
    const first = await insertException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    await insertException(c, wa,
      { occurrenceId: wa.blockingA, action: "accept_risk",
        exceptionNo: 2, predecessorExceptionId: first, predecessorExceptionNo: 1 });
    const fork = await sqlstate(() => c.query(EXCEPTION_INSERT, exceptionParams(wa,
      { occurrenceId: wa.blockingA, action: "waiver",
        exceptionNo: 2, predecessorExceptionId: first, predecessorExceptionNo: 1 })));
    expect(fork).toBe("23505");
    // WHICH KEY ANSWERS IS NOT ASSERTED, and the reason is the same one the
    // closure lineage's fork case gives. `requirement_exceptions_chain_check`
    // forces a successor's ordinal to be its predecessor's plus one, so two
    // successors of exception 1 on one occurrence both carry exception_no = 2 and
    // collide on `requirement_exceptions_lineage_key` as well as on
    // `requirement_exceptions_no_fork_key`; the first violated unique index in
    // creation order raises, and `lineage_key` is declared first (0045:469-473).
    // `no_fork_key` is therefore redundant on this path — belt and braces, and
    // worth knowing it is never independently exercised.
    const message = await raised(() => c.query(EXCEPTION_INSERT, exceptionParams(wa,
      { occurrenceId: wa.blockingA, action: "waiver",
        exceptionNo: 2, predecessorExceptionId: first, predecessorExceptionNo: 1 })));
    expect(message).toMatch(/requirement_exceptions_(no_fork|lineage)_key/);
    // The requirement, asserted directly: the lineage is a chain of two.
    expect(await count("requirement_exceptions", WS_A)).toBe(2);
  });

  it("refuses a successor whose predecessor is on ANOTHER occurrence", async () => {
    // The chain key carries the occurrence as well as the ordinal. Without it,
    // exception #2 on occurrence A could name exception #1 on occurrence B and
    // both lineages would still look like chains.
    const onB = await insertException(c, wa, { occurrenceId: wa.blockingB, action: "waiver" });
    const crossed = await sqlstate(() => c.query(EXCEPTION_INSERT, exceptionParams(wa,
      { occurrenceId: wa.blockingA, action: "waiver",
        exceptionNo: 2, predecessorExceptionId: onB, predecessorExceptionNo: 1 })));
    expect(crossed).toBe("23503");
  });

  it("refuses a chain with a hole and a root that claims a predecessor", async () => {
    const first = await insertException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    expect(await sqlstate(() => c.query(EXCEPTION_INSERT, exceptionParams(wa,
      { occurrenceId: wa.blockingA, action: "waiver",
        exceptionNo: 4, predecessorExceptionId: first, predecessorExceptionNo: 3 }))))
      .toBe("23503");
    expect(await sqlstate(() => c.query(EXCEPTION_INSERT, exceptionParams(wa,
      { occurrenceId: wa.blockingB, action: "waiver",
        exceptionNo: 1, predecessorExceptionId: first, predecessorExceptionNo: 1 }))))
      .toBe("23514");
  });

  it("refuses a head that points at another occurrence's exception", async () => {
    const onB = await insertException(c, wa, { occurrenceId: wa.blockingB, action: "waiver" });
    expect(await sqlstate(() => openExceptionHead(c, wa, wa.blockingA, onB, "waiver")))
      .toBe("23503");
  });

  it("refuses a head that misreports the action of the fact it points at", async () => {
    const waiver = await insertException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    expect(await sqlstate(() => openExceptionHead(c, wa, wa.blockingA, waiver, "accept_risk")))
      .toBe("23503");
    // Departure 4 in one line: the head cannot say the current escape is a
    // risk-acceptance when the fact it names is a waiver, so `satisfied(o)` can
    // read the action off the head without joining for it.
    expect(await sqlstate(() => openExceptionHead(c, wa, wa.blockingA, waiver, "waiver")))
      .toBeNull();
  });

  it("advances a head exactly once, and never deletes one", async () => {
    const first = await recordException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    const second = await insertException(c, wa,
      { occurrenceId: wa.blockingA, action: "accept_risk",
        exceptionNo: 2, predecessorExceptionId: first, predecessorExceptionNo: 1 });
    // The expected-version discipline made structural: a command that read
    // version 1 and wrote 1 again — or jumped to 7 — cannot beat a concurrent
    // command that also read 1.
    expect(await raised(() => advanceExceptionHead(c, wa, wa.blockingA, second, "accept_risk",
      { version: 1 }))).toMatch(/must move its version exactly once/);
    expect(await raised(() => advanceExceptionHead(c, wa, wa.blockingA, second, "accept_risk",
      { version: 7 }))).toMatch(/must move its version exactly once/);
    expect(await raised(() => c.query(
      `delete from public.requirement_exception_heads where requirement_occurrence_id = $1`,
      [wa.blockingA]))).toMatch(/is a lineage head and is never deleted/);
  });

  it("refuses a head that changes the lineage it serialises", async () => {
    await recordException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    expect(await raised(() => c.query(
      `update public.requirement_exception_heads
          set requirement_occurrence_id = $1, version = version + 1
        where requirement_occurrence_id = $2`, [wa.blockingB, wa.blockingA])))
      .toMatch(/may not change the lineage it serialises/);
  });
});

describe("the decision lineage carries the same guarantees", () => {
  it("is append-only and admits one root per (occurrence, role)", async () => {
    const id = await insertDecision(c, wa, { occurrenceId: wa.blockingA, outcome: "accepted" });
    expect(await raised(() => c.query(
      `update public.requirement_evidence_decisions set outcome = 'returned' where id = $1`,
      [id]))).toMatch(/immutable \(append-only relation\)/);

    const second = await raised(() => c.query(DECISION_INSERT,
      decisionParams(wa, { occurrenceId: wa.blockingA, outcome: "returned",
                           reason: "Приклад-відмова." })));
    expect(second).toMatch(/requirement_evidence_decisions_lineage_key/);
  });

  it("refuses a decision in a role the occurrence does not name", async () => {
    // satisfied(o) for a hold quantifies over «an accepting decision BY
    // o.approver_role», so a decision taken in some other role must not exist to
    // be counted. The role is pinned by foreign key, not copied on trust.
    expect(APPROVER_ROLE).not.toBe("site_engineer");
    expect(await sqlstate(() => c.query(DECISION_INSERT,
      decisionParams(wa, { occurrenceId: wa.blockingA, outcome: "accepted",
                           approverRole: "site_engineer" })))).toBe("23503");
  });

  it("refuses a return with nothing written on it", async () => {
    // «A refusal is a support surface» (ADR-005 §Consequences): a return the crew
    // cannot act on is the failure the whole reason object exists to prevent.
    expect(await sqlstate(() => c.query(DECISION_INSERT,
      decisionParams(wa, { occurrenceId: wa.blockingA, outcome: "returned", reason: null }))))
      .toBe("23514");
    expect(await sqlstate(() => c.query(DECISION_INSERT,
      decisionParams(wa, { occurrenceId: wa.blockingA, outcome: "returned", reason: "  " }))))
      .toBe("23514");
  });

  it("refuses a decision with no attributable actor at all", async () => {
    const message = await raised(() => c.query(DECISION_INSERT,
      decisionParams(wa, { occurrenceId: wa.blockingA, outcome: "accepted",
                           decidedByMemberId: null })));
    expect(message).toMatch(/requirement_evidence_decisions_authority_check/);
  });

  it("refuses an EXTERNAL decision while v0.1 has no external tables", async () => {
    // The three external columns are built and shut. Without
    // requirement_evidence_decisions_v01_internal_only_check a v0.1 decision
    // could be stored naming three invented uuids and no member — an
    // unattributable acceptance of a hidden-works obligation. M5 drops exactly
    // this constraint in the same statement that adds their foreign keys.
    const message = await raised(() => c.query(DECISION_INSERT,
      decisionParams(wa, {
        occurrenceId: wa.blockingA, outcome: "accepted", decidedByMemberId: null,
        externalSessionId: crypto.randomUUID(),
        externalAccessGrantId: crypto.randomUUID(),
        decisionBatchId: crypto.randomUUID(),
        assuranceLabel: "LINK_CONFIRMATION",
      })));
    expect(message).toMatch(/requirement_evidence_decisions_v01_internal_only_check/);
  });

  it("refuses a head that misreports the outcome it points at", async () => {
    // «No current return on o» is answered from current_outcome alone, so a head
    // that could lie about it would make the second half of satisfied(o) false
    // while every row still resolved.
    const returned = await insertDecision(c, wa,
      { occurrenceId: wa.blockingA, outcome: "returned", reason: "Приклад-відмова." });
    expect(await sqlstate(() =>
      openDecisionHead(c, wa, wa.blockingA, returned, "accepted"))).toBe("23503");
    expect(await sqlstate(() =>
      openDecisionHead(c, wa, wa.blockingA, returned, "returned"))).toBeNull();
  });

  it("advances a decision head exactly once", async () => {
    const first = await recordDecision(c, wa,
      { occurrenceId: wa.blockingA, outcome: "returned", reason: "Приклад-відмова." });
    const second = await insertDecision(c, wa,
      { occurrenceId: wa.blockingA, outcome: "accepted",
        decisionNo: 2, supersededDecisionId: first, supersededDecisionNo: 1 });
    expect(await raised(() => advanceDecisionHead(c, wa, wa.blockingA, second, "accepted",
      { version: 1 }))).toMatch(/must move its version exactly once/);
  });
});

describe("INV-001 is the first column of every composite key", () => {
  it("refuses an exception on ANOTHER workspace's occurrence", async () => {
    // Not an RLS assertion — this connection bypasses RLS. The tenant leg is in
    // the key itself, so a foreign occurrence has nothing to resolve against.
    expect(await sqlstate(() => c.query(EXCEPTION_INSERT,
      exceptionParams(wa, { occurrenceId: wb.blockingA, action: "waiver" })))).toBe("23503");
  });

  it("refuses a closure freezing another workspace's occurrence", async () => {
    const { decisionA } = await acceptBoth(wa);
    const foreign = await recordDecision(c, wb,
      { occurrenceId: wb.blockingA, outcome: "accepted" });
    const res = await attemptClosure(c, wa, {
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
        { occurrenceId: wb.blockingA, satisfiedBy: "evidence_decision", decisionId: foreign },
      ],
    });
    expect(res.sqlstate).toBe("23503");
    expect(await count("stage_closures", WS_A)).toBe(0);
    expect(await count("stage_closures", WS_B)).toBe(0);
  });

  it("refuses a closure naming a stage of a DIFFERENT assignment", async () => {
    // stage_closures_stage_fkey carries the assignment and the contract as well
    // as the project and the status: «this stage, under this assignment, on this
    // contract, and recorded closed» is one key.
    const res = await attemptClosure(c, wa, {
      stageId: wa.foreignAssignmentStageId,
      assignmentId: wa.assignmentId,       // the stage belongs to otherAssignmentId
      members: [],
    });
    expect(res.sqlstate).toBe("23503");
    expect(res.error).toMatch(/stage_closures_stage_fkey/);
  });
});

describe("migration 0046 — the money names the admission that carved it", () => {
  /**
   * ADR-008's SCHEMA half, attacked from the table owner with RLS bypassed.
   * `apps/app/tests/admission-valuation.int.test.ts` and
   * `apps/app/tests/m3-refusal.int.test.ts` prove the closure command writes the
   * RIGHT values; neither proves the database refuses the WRONG ones, and
   * INV-089's test column names exactly that case — «an allocation naming a
   * closure of a different assignment refused by the composite key rather than by
   * a route».
   *
   * WHAT IS DELIBERATELY NOT ASSERTED HERE. Migration 0046's header writes out the
   * CHECK that would make «no carve at recording time» a database rule —
   * `admitted_by_closure_id is not null`, NOT VALID — and says why it is withheld:
   * it would equally forbid `progress.adjust` from correcting admitted money, and
   * ADR-008 §"What this ADR does not decide" leaves that question open. So «both
   * columns null is still storable» is a RECORDED GAP and not a guarantee, and no
   * case below pins it. A test asserting it would have to be deleted by the ADR
   * that closes the gap, which is the shape of assertion this repository has been
   * bitten by once already.
   */

  /**
   * A minimal priced slice. Every figure is zero because this block is about the
   * two ADMISSION keys and not about arithmetic — `valuation_allocations_components_check`
   * needs all three components present and `gross = net + tax`, which 0 + 0 = 0
   * satisfies, and the matrix that does care about the numbers lives in
   * `apps/app/tests/admission-valuation.int.test.ts`.
   */
  const ALLOCATION_INSERT = `
    insert into public.valuation_allocations
      (workspace_id, project_id, contract_id, work_item_id, progress_entry_id,
       root_progress_entry_id, lineage_key, quantity, funded_quantity,
       net_minor_units, tax_minor_units, gross_minor_units,
       admitted_by_closure_id, admitted_work_assignment_id)
    values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::text,
            $8::numeric,$9::numeric,0,0,0,$10::uuid,$11::uuid)`;

  const allocationParams = (
    progressEntryId: string,
    admission: { closureId: string | null; assignmentId: string | null },
  ): unknown[] => [
    a.workspaceId, a.projectId, a.contractId, wa.workItemId, progressEntryId,
    // A root is its own root, which is what `effective_root_id` resolves to and
    // what `valuation_allocations_root_of_this_fact_fkey` (0030) checks.
    progressEntryId, `progress:${progressEntryId}`, "1", "0",
    admission.closureId, admission.assignmentId,
  ];

  /** One root progress fact on an assignment, the shape `progress.record` writes. */
  async function recordEntry(assignmentId: string): Promise<string> {
    const r = await c.query<{ id: string }>(
      `insert into public.progress_entries
         (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
          quantity, recorded_by_member_id)
       values ($1,$2,$3,$4,'root',1,$5) returning id`,
      [a.workspaceId, a.projectId, assignmentId, wa.workItemId, a.memberId]);
    return r.rows[0]!.id;
  }

  /**
   * `resetClosureFacts` does not reach these two tables, and it must not be left
   * to: an allocation outliving its closure would make the NEXT test's
   * `delete from public.stage_closures` fail on
   * `valuation_allocations_admitting_closure_fkey` — the very key this block is
   * about, reporting as a fixture error. Cleaning up here, before the file-level
   * beforeEach runs again, keeps that contained.
   */
  async function resetAdmissionFacts(): Promise<void> {
    for (const t of ["valuation_allocations", "progress_entries"]) {
      await c.query(`alter table public.${t} disable trigger user`);
      try {
        await c.query(`delete from public.${t} where workspace_id = $1`, [WS_A]);
      } finally {
        await c.query(`alter table public.${t} enable trigger user`);
      }
    }
  }

  let ownClosureId: string;
  let foreignClosureId: string;
  let entryId: string;

  beforeEach(async () => {
    const { decisionA, decisionB } = await acceptBoth(wa);
    const own = await attemptClosure(c, wa, {
      members: [
        { occurrenceId: wa.blockingA, satisfiedBy: "evidence_decision", decisionId: decisionA },
        { occurrenceId: wa.blockingB, satisfiedBy: "evidence_decision", decisionId: decisionB },
      ],
    });
    if (own.error) {
      throw new Error(`m3-closure-schema: the assignment's own closure failed — ${own.error}`);
    }
    ownClosureId = own.closureId;

    // A real, committed closure of a stage belonging to the OTHER assignment.
    // Vacuous, because that assignment carries no obligation — which is beside
    // the point here: what matters is that it is a closure of a different
    // assignment and that every leg but the assignment resolves.
    const foreign = await attemptClosure(c, wa, {
      stageId: wa.foreignAssignmentStageId, assignmentId: wa.otherAssignmentId, members: [],
    });
    if (foreign.error) {
      throw new Error(`m3-closure-schema: the other assignment's closure failed — ${foreign.error}`);
    }
    foreignClosureId = foreign.closureId;

    entryId = await recordEntry(wa.assignmentId);
  });

  afterEach(resetAdmissionFacts);

  it("stores an allocation carved by the closure of ITS OWN assignment", async () => {
    // The positive control. Without it every refusal below could be passing
    // because the row is malformed in a way none of them names.
    expect(await sqlstate(() => c.query(ALLOCATION_INSERT,
      allocationParams(entryId, { closureId: ownClosureId, assignmentId: wa.assignmentId }))))
      .toBeNull();
    const stored = await c.query<{ closure: string; assignment: string }>(
      `select admitted_by_closure_id as closure, admitted_work_assignment_id as assignment
         from public.valuation_allocations where progress_entry_id = $1`, [entryId]);
    expect(stored.rows[0]).toEqual({ closure: ownClosureId, assignment: wa.assignmentId });
  });

  it("refuses an allocation naming a closure of a DIFFERENT assignment", async () => {
    // INV-089's named test. With only `admitted_by_closure_id`, a carve could name
    // any closure in the workspace — including one that closed a stage of another
    // assignment on another contract — and every row would still resolve. The
    // second column is what the two keys meet on (migration 0046 §2).
    const message = await raised(() => c.query(ALLOCATION_INSERT,
      allocationParams(entryId,
        { closureId: foreignClosureId, assignmentId: wa.assignmentId })));
    expect(message).toMatch(/valuation_allocations_admitting_closure_fkey/);
    expect(await count("valuation_allocations", WS_A)).toBe(0);
  });

  it("refuses an allocation whose progress fact belongs to another assignment", async () => {
    // The other direction, and the reason the pairing is checked from BOTH sides:
    // here the closure is real and the assignment is its own, and it is the
    // PROGRESS FACT that comes from somewhere else. «This money was admitted by
    // that closure, for work recorded under the very assignment whose stage it
    // closed» is false, and the database says so.
    const message = await raised(() => c.query(ALLOCATION_INSERT,
      allocationParams(entryId,
        { closureId: foreignClosureId, assignmentId: wa.otherAssignmentId })));
    expect(message).toMatch(/valuation_allocations_admitted_entry_fkey/);
    expect(await count("valuation_allocations", WS_A)).toBe(0);
  });

  it("refuses a half-named admission, in either direction", async () => {
    // «Both null, or neither.» A closure with no assignment, or an assignment with
    // no closure, is unrepresentable — there is no third state for a reader to
    // interpret.
    expect(await raised(() => c.query(ALLOCATION_INSERT,
      allocationParams(entryId, { closureId: ownClosureId, assignmentId: null }))))
      .toMatch(/valuation_allocations_admission_pairing_check/);
    expect(await raised(() => c.query(ALLOCATION_INSERT,
      allocationParams(entryId, { closureId: null, assignmentId: wa.assignmentId }))))
      .toMatch(/valuation_allocations_admission_pairing_check/);
    expect(await count("valuation_allocations", WS_A)).toBe(0);
  });

  it("admits one allocation per progress fact, however many closures name it", async () => {
    // `unique (workspace_id, progress_entry_id)` (0015) is what makes DOUBLE
    // admission unrepresentable whatever `src/lib/admission.ts` does. The
    // exposure ADR-008 leaves open is the other direction — admitting too EARLY —
    // and that is a property of the admission rule, asserted through the route.
    expect(await sqlstate(() => c.query(ALLOCATION_INSERT,
      allocationParams(entryId, { closureId: ownClosureId, assignmentId: wa.assignmentId }))))
      .toBeNull();
    const again = await raised(() => c.query(ALLOCATION_INSERT,
      allocationParams(entryId, { closureId: ownClosureId, assignmentId: wa.assignmentId })));
    // The constraint is 0015's unnamed `unique (workspace_id, progress_entry_id)`,
    // so the name is PostgreSQL's and the match is on the column it is about
    // rather than on a string a later rename would break.
    expect(again).toMatch(/progress_entry_id/);
    expect(await count("valuation_allocations", WS_A)).toBe(1);
  });
});
