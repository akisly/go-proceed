import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor, asService, bypassingGuards } from "./pg";
import {
  dropRulesWorkspaces, seedRulesWorld, sqlstate, type RulesFixture,
} from "./m1-rules-fixture";
import {
  BLOCKED_REASON_INSERT, DECISION_INSERT, EXCEPTION_INSERT,
  READINESS_PROJECTION_INSERT, blockedReasonParams, decisionParams, exceptionParams,
  frozenSetHash, insertException, readinessProjectionParams,
  recordDecision, resetClosureFacts, ruleVersionOf, seedClosureWorld,
  type ClosureWorld,
} from "./m3-closure-fixture";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `vitest`, `tsc`, `psql` and `supabase` were never run against it, no
 * migration was applied, and no claim is made that any assertion below passes.
 * Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * INV-001 on the EIGHT tables migration 0045 adds, plus the UPDATE policy it
 * puts on public.work_stages — and the half migration 0014 exists because M1 got
 * wrong: every write policy asks for the CAPABILITY the command checks rather
 * than for membership or for an administrator's blanket grant.
 *
 * EACH CASE ATTEMPTS THE READ OR THE WRITE. A count query with a WHERE clause
 * proves nothing about RLS; every isolation assertion below fetches the SAME row
 * by the SAME id and differs only in who is asking.
 *
 * WHY THE READ SIDE SPLITS IN TWO, AND WHY IT MATTERS MORE HERE THAN ANYWHERE.
 * The four FACT tables are readable under project.view: a foreman shown «не
 * готово» who cannot see which decision is missing has been shown a status word,
 * which is the thing version-0.1.md §M3 says closes nothing. The two PROJECTIONS
 * are readable under readiness.view, which is what capabilities.csv:31 puts
 * readiness.get and blocked_reasons.get behind. Those are DIFFERENT capabilities
 * and neither implies the other — `app.has_project_capability` matches literally
 * — so an actor holding readiness.view alone reads the projections and none of
 * the facts behind them. The case below asserts that split rather than papering
 * over it, because the route slice found the same coupling from the other side:
 * an actor with readiness.view and no project.view gets an EMPTY ANSWER, not a
 * denial, which is the worst of the three outcomes.
 *
 * WHY EVERY POSITIVE CONTROL ALSO HOLDS `project.view`, AND WHY THAT IS NOT
 * PADDING. A statement that READS the table it writes — `insert … returning id`,
 * or an `update` whose WHERE clause and whose `version + 1` refer to the row's own
 * columns — requires SELECT rights, and PostgreSQL then applies the SELECT
 * policies as well: as a WITH CHECK on the new row for INSERT, and as a security
 * qual on the existing row for UPDATE. An actor holding only the write capability
 * therefore does not get a clean 42501 on the write; the insert is refused for
 * READING back the row it just wrote, and the update matches NO ROWS AND REPORTS
 * NO ERROR. Both outcomes would make a passing suite say something other than what
 * it claims. Every route in this slice already requires `project.view` beside its
 * write capability — the two occurrence commands check it first so the caller is
 * told they cannot see the project rather than that they cannot decide, and
 * migration 0046 §e requires it on the closure because an invisible progress entry
 * sums to zero under RLS rather than raising. So the fixture matches the product,
 * and each pair of cases is arranged to differ by exactly the write capability
 * under test.
 *
 * THE M3 CAPABILITIES ARE IN PRESETS AS OF 2026-08-17, and this paragraph used
 * to say the opposite — «THE M3 CAPABILITIES ARE IN NO RESPONSIBILITY PRESET»,
 * naming `M3_PRESET_GAP` in m3-closure-fixture.ts as the record of it. That
 * constant is `M3_PROJECT_CAPS` now and its header carries the mapping. Every
 * grant below is still issued by hand, because a fixture builds the minimal
 * grant set it needs — but it is no longer a workaround for a gap, which is
 * exactly what the old paragraph predicted would change.
 *
 * WHAT THIS SUITE CANNOT REACH, NAMED RATHER THAN LEFT LOOKING COVERED:
 * `sco_insert` (public.stage_closure_occurrences) has no isolated negative case.
 * It names the same capability as `sc_insert`, and
 * `app.guard_closure_member_window()` is a BEFORE INSERT trigger — which fires
 * ahead of the RLS WITH CHECK — that refuses any member row whose closure was
 * not created in the same transaction. So an actor who could reach that policy
 * alone cannot exist: without stage_closures.close the closure insert fails
 * first, and with it the member row is permitted. What is asserted is the
 * positive path, the SELECT side, and the absence of UPDATE and DELETE grants.
 */

const WS_A = "feff1111-1111-1111-1111-111111111111";
const WS_B = "feff2222-2222-2222-2222-222222222222";
const USER_A = "feff3333-3333-3333-3333-333333333333";
const USER_B = "feff4444-4444-4444-4444-444444444444";
/** An active `member` of workspace A holding no project grant at all. */
const USER_M = "feff5555-5555-5555-5555-555555555555";

let c: Client;
let a: RulesFixture;
let b: RulesFixture;
let wa: ClosureWorld;
let wb: ClosureWorld;
let memberIdM: string;
let ruleVersionA: string;

async function visible(
  user: string, workspace: string, table: string, column: string, id: string,
): Promise<number> {
  const r = await asActor(user, workspace, (cl) =>
    cl.query(`select 1 from public.${table} where ${column} = $1`, [id]));
  return r.rows.length;
}

/** Grants capabilities to one member for the duration of `fn`, then removes them. */
async function withCapabilities<T>(
  f: RulesFixture, memberId: string, capabilities: readonly string[], fn: () => Promise<T>,
): Promise<T> {
  for (const capability of capabilities) {
    await c.query(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,$4,$5)`,
      [f.workspaceId, f.projectId, memberId, capability, f.userId]);
  }
  try {
    return await fn();
  } finally {
    await bypassingGuards(
      `delete from public.project_access_grants
        where workspace_id = $1 and project_id = $2 and member_id = $3
          and capability = any($4::text[])`,
      [f.workspaceId, f.projectId, memberId, [...capabilities]]);
  }
}

/** Revokes the owner's read capabilities for the duration of `fn`. */
async function withoutRead<T>(f: RulesFixture, fn: () => Promise<T>): Promise<T> {
  await c.query(
    `update public.project_access_grants set revoked_at = now()
      where workspace_id = $1 and member_id = $2
        and capability in ('project.view','project.admin','readiness.view') and revoked_at is null`,
    [f.workspaceId, f.memberId]);
  try {
    return await fn();
  } finally {
    await bypassingGuards(
      `update public.project_access_grants set revoked_at = null
        where workspace_id = $1 and member_id = $2
          and capability in ('project.view','project.admin','readiness.view')`,
      [f.workspaceId, f.memberId]);
  }
}

/**
 * The whole closure, as ONE application transaction under `user`.
 *
 * It is one transaction because migration 0045's completeness check is a
 * DEFERRABLE INITIALLY DEFERRED constraint trigger: split into three statements
 * it would never fire, and the positive control would be asserting that three
 * unrelated writes were permitted rather than that a closure is.
 */
async function closeStageAs(
  user: string, workspace: string, w: ClosureWorld, closedByMemberId: string,
  members: { occurrenceId: string; decisionId: string }[],
): Promise<void> {
  const f = w.rules;
  await asActor(user, workspace, async (cl) => {
    await cl.query(
      `update public.work_stages
          set status = 'closed', version = version + 1, updated_at = now()
        where workspace_id = $1 and id = $2`, [f.workspaceId, w.stageId]);
    const closure = await cl.query<{ id: string }>(
      `insert into public.stage_closures
         (workspace_id, project_id, contract_id, work_assignment_id, work_stage_id,
          closed_by_member_id, can_close_stage_result,
          evaluated_occurrence_count, evaluated_occurrence_set_hash,
          idempotency_key, request_hash)
       values ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10) returning id`,
      [f.workspaceId, f.projectId, f.contractId, w.assignmentId, w.stageId, closedByMemberId,
       members.length, frozenSetHash(members.map((m) => m.occurrenceId)),
       crypto.randomUUID(), "a".repeat(64)]);
    for (const m of members) {
      await cl.query(
        `insert into public.stage_closure_occurrences
           (workspace_id, project_id, stage_closure_id, work_stage_id,
            requirement_occurrence_id, occurrence_blocking_scope, satisfied_by,
            relied_on_decision_id, relied_on_decision_outcome)
         values ($1,$2,$3,$4,$5,'blocks_stage_closure','evidence_decision',$6,'accepted')`,
        [f.workspaceId, f.projectId, closure.rows[0]!.id, w.stageId,
         m.occurrenceId, m.decisionId]);
    }
  });
}

beforeAll(async () => {
  c = await adminClient();
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  a = await seedRulesWorld(c, { workspaceId: WS_A, userId: USER_A, suffix: "RA" });
  b = await seedRulesWorld(c, { workspaceId: WS_B, userId: USER_B, suffix: "RB" });
  wa = await seedClosureWorld(c, a);
  wb = await seedClosureWorld(c, b);
  ruleVersionA = await ruleVersionOf(c, wa.blockingA);

  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email,
                             encrypted_password, created_at, updated_at)
     values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
             $2,'',now(),now())
     on conflict (id) do nothing`, [USER_M, `${USER_M}@fixture.test`]);
  const m = await c.query(
    `insert into public.memberships (organization_id, user_id, role, status)
     values ($1,$2,'member','active') returning id`, [WS_A, USER_M]);
  memberIdM = m.rows[0].id;
}, 180_000);

beforeEach(async () => {
  await resetClosureFacts(c, WS_A);
  await resetClosureFacts(c, WS_B);
});

afterAll(async () => {
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  await c.end();
});

describe("requirement_exceptions — the only escape, and who may see and record it", () => {
  it("is readable through project.view, and not through membership alone", async () => {
    const id = await insertException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    expect(await visible(USER_A, WS_A, "requirement_exceptions", "id", id)).toBe(1);
    // USER_M is an active member of the SAME workspace with no grant on the
    // project. This is the 0014 regression class: a policy asking only «is the
    // actor an active member?» would return the row here.
    expect(await visible(USER_M, WS_A, "requirement_exceptions", "id", id)).toBe(0);
    expect(await visible(USER_B, WS_B, "requirement_exceptions", "id", id)).toBe(0);
  });

  it("stays visible to the project — an exception that hides itself is worse than none", async () => {
    // ADR-005 decision 3: the escape is attributed AND visible. The read side is
    // project.view and not the deciding capability, so the foreman whose
    // obligation was waived can see who waived it.
    const id = await insertException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    await withCapabilities(a, memberIdM, ["project.view"], async () => {
      expect(await visible(USER_M, WS_A, "requirement_exceptions", "id", id)).toBe(1);
    });
  });

  it("stays hidden once the reader's project grant is revoked", async () => {
    const id = await insertException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    await withoutRead(a, async () => {
      expect(await visible(USER_A, WS_A, "requirement_exceptions", "id", id)).toBe(0);
    });
  });

  it("refuses an insert from the project ADMINISTRATOR, who lacks the deciding capability", async () => {
    // capabilities.csv:24 puts requirement_exceptions.create behind
    // requirement_exceptions.decide. project.admin is a different capability and
    // `app.has_project_capability` matches literally — no capability implies
    // another — so a policy that admitted the administrator would be a role check
    // wearing a capability's name.
    await withCapabilities(a, memberIdM, ["project.admin"], async () => {
      expect(await sqlstate(() => asActor(USER_M, WS_A, (cl) =>
        cl.query(EXCEPTION_INSERT,
          exceptionParams(wa, { occurrenceId: wa.blockingA, action: "waiver" })))))
        .toBe("42501");
    });
  });

  it("refuses an insert from a reader who can see the project and cannot decide", async () => {
    // The pair to the case below, and the reason a pair is needed at all: both
    // actors hold `project.view`, so the only difference between this refusal and
    // that admission is `requirement_exceptions.decide` itself.
    await withCapabilities(a, memberIdM, ["project.view"], async () => {
      expect(await sqlstate(() => asActor(USER_M, WS_A, (cl) =>
        cl.query(EXCEPTION_INSERT,
          exceptionParams(wa, { occurrenceId: wa.blockingA, action: "waiver",
                                authorityMemberId: memberIdM }))))).toBe("42501");
    });
  });

  it("admits an insert under requirement_exceptions.decide", async () => {
    await withCapabilities(a, memberIdM, ["project.view", "requirement_exceptions.decide"],
      async () => {
        expect(await sqlstate(() => asActor(USER_M, WS_A, (cl) =>
          cl.query(EXCEPTION_INSERT,
            exceptionParams(wa, { occurrenceId: wa.blockingA, action: "waiver",
                                  authorityMemberId: memberIdM }))))).toBeNull();
      });
  });

  it("refuses an insert carrying another workspace's ids", async () => {
    // B holds every capability in B and none in A. The row names A's workspace,
    // project and occurrence; the WITH CHECK is evaluated for A's project.
    expect(await sqlstate(() => asActor(USER_B, WS_B, (cl) =>
      cl.query(EXCEPTION_INSERT,
        exceptionParams(wa, { occurrenceId: wa.blockingA, action: "waiver" })))))
      .toBe("42501");
    const none = await c.query<{ n: number }>(
      `select count(*)::int as n from public.requirement_exceptions where workspace_id = $1`,
      [WS_A]);
    expect(none.rows[0]!.n).toBe(0);
  });

  it("keeps B's own exceptions writable, so the refusals above are about the tenant", async () => {
    expect(await sqlstate(() => asActor(USER_B, WS_B, (cl) =>
      cl.query(EXCEPTION_INSERT,
        exceptionParams(wb, { occurrenceId: wb.blockingA, action: "waiver" })))))
      .toBeNull();
  });
});

describe("requirement_exception_heads — the pointer satisfied(o) reads", () => {
  it("is readable through project.view and hidden from the other tenant", async () => {
    const id = await insertException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    await c.query(
      `insert into public.requirement_exception_heads
         (workspace_id, project_id, requirement_occurrence_id, exception_scope,
          current_exception_id, current_action)
       values ($1,$2,$3,'occurrence',$4,'waiver')`,
      [WS_A, a.projectId, wa.blockingA, id]);
    expect(await visible(USER_A, WS_A, "requirement_exception_heads",
      "requirement_occurrence_id", wa.blockingA)).toBe(1);
    expect(await visible(USER_M, WS_A, "requirement_exception_heads",
      "requirement_occurrence_id", wa.blockingA)).toBe(0);
    expect(await visible(USER_B, WS_B, "requirement_exception_heads",
      "requirement_occurrence_id", wa.blockingA)).toBe(0);
  });

  const insertHead = (user: string, workspace: string, w: ClosureWorld, exceptionId: string) =>
    asActor(user, workspace, (cl) => cl.query(
      `insert into public.requirement_exception_heads
         (workspace_id, project_id, requirement_occurrence_id, exception_scope,
          current_exception_id, current_action)
       values ($1,$2,$3,'occurrence',$4,'waiver')`,
      [w.rules.workspaceId, w.rules.projectId, w.blockingA, exceptionId]));

  it("opens and advances only under requirement_exceptions.decide", async () => {
    const first = await insertException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    await withCapabilities(a, memberIdM, ["project.admin"], async () => {
      expect(await sqlstate(() => insertHead(USER_M, WS_A, wa, first))).toBe("42501");
    });
    // `project.view` travels with the deciding capability here for the reason the
    // suite header gives: the ADVANCE below is an UPDATE whose WHERE clause and
    // whose `version + 1` read the head's own columns, so SELECT rights are
    // required and the SELECT policy is applied as a security qual. Without it the
    // update would match NO ROWS and report no error, and the assertions after the
    // block would fail on a head that never moved — a policy denial arriving as a
    // silent no-op is exactly the outcome this suite exists to make visible.
    await withCapabilities(
      a, memberIdM, ["project.view", "requirement_exceptions.decide"], async () => {
        expect(await sqlstate(() => insertHead(USER_M, WS_A, wa, first))).toBeNull();

        const second = await insertException(c, wa,
          { occurrenceId: wa.blockingA, action: "accept_risk",
            exceptionNo: 2, predecessorExceptionId: first, predecessorExceptionNo: 1 });
        const advanced = await asActor(USER_M, WS_A, (cl) => cl.query(
          `update public.requirement_exception_heads
              set current_exception_id = $3, current_action = 'accept_risk',
                  version = version + 1, updated_at = now()
            where workspace_id = $1 and requirement_occurrence_id = $2
              and exception_scope = 'occurrence'`,
          [WS_A, wa.blockingA, second]));
        // The row count, not only the absence of an error: an update the policy
        // filtered out succeeds and changes nothing.
        expect(advanced.rowCount).toBe(1);
      });
    const head = await c.query<{ current_action: string; version: string }>(
      `select current_action, version::text from public.requirement_exception_heads
        where requirement_occurrence_id = $1`, [wa.blockingA]);
    expect(head.rows[0]!.current_action).toBe("accept_risk");
    expect(head.rows[0]!.version).toBe("2");
  });

  it("refuses an advance from an actor who cannot decide", async () => {
    const first = await insertException(c, wa, { occurrenceId: wa.blockingA, action: "waiver" });
    await c.query(
      `insert into public.requirement_exception_heads
         (workspace_id, project_id, requirement_occurrence_id, exception_scope,
          current_exception_id, current_action)
       values ($1,$2,$3,'occurrence',$4,'waiver')`,
      [WS_A, a.projectId, wa.blockingA, first]);
    const second = await insertException(c, wa,
      { occurrenceId: wa.blockingA, action: "accept_risk",
        exceptionNo: 2, predecessorExceptionId: first, predecessorExceptionNo: 1 });

    // The UPDATE policy's USING clause hides the row, so the update matches
    // NOTHING rather than raising — which is why the head is read back.
    await withCapabilities(a, memberIdM, ["project.view"], async () => {
      const res = await asActor(USER_M, WS_A, (cl) => cl.query(
        `update public.requirement_exception_heads
            set current_exception_id = $3, current_action = 'accept_risk',
                version = version + 1
          where workspace_id = $1 and requirement_occurrence_id = $2`,
        [WS_A, wa.blockingA, second]));
      expect(res.rowCount).toBe(0);
    });
    const head = await c.query<{ current_action: string }>(
      `select current_action from public.requirement_exception_heads
        where requirement_occurrence_id = $1`, [wa.blockingA]);
    expect(head.rows[0]!.current_action).toBe("waiver");
  });
});

describe("requirement_evidence_decisions and their heads", () => {
  it("are readable through project.view and hidden from the other tenant", async () => {
    const id = await recordDecision(c, wa, { occurrenceId: wa.blockingA, outcome: "accepted" });
    expect(await visible(USER_A, WS_A, "requirement_evidence_decisions", "id", id)).toBe(1);
    expect(await visible(USER_M, WS_A, "requirement_evidence_decisions", "id", id)).toBe(0);
    expect(await visible(USER_B, WS_B, "requirement_evidence_decisions", "id", id)).toBe(0);
    expect(await visible(USER_A, WS_A, "requirement_evidence_decision_heads",
      "requirement_occurrence_id", wa.blockingA)).toBe(1);
    expect(await visible(USER_B, WS_B, "requirement_evidence_decision_heads",
      "requirement_occurrence_id", wa.blockingA)).toBe(0);
  });

  it("are written only under evidence_decisions.decide", async () => {
    // capabilities.csv:26 — «whoever holds the occurrence's approver_role». The
    // capability is what the policy can check; the role is what the composite key
    // checks (m3-closure-schema.test.ts). Both are needed and neither substitutes
    // for the other.
    await withCapabilities(a, memberIdM, ["project.admin", "requirement_exceptions.decide"],
      async () => {
        expect(await sqlstate(() => asActor(USER_M, WS_A, (cl) =>
          cl.query(DECISION_INSERT,
            decisionParams(wa, { occurrenceId: wa.blockingA, outcome: "accepted" })))))
          .toBe("42501");
      });
    await withCapabilities(a, memberIdM, ["project.view", "evidence_decisions.decide"],
      async () => {
        expect(await sqlstate(() => asActor(USER_M, WS_A, (cl) =>
          cl.query(DECISION_INSERT,
            decisionParams(wa, { occurrenceId: wa.blockingA, outcome: "accepted",
                                 decidedByMemberId: memberIdM }))))).toBeNull();
      });
    // The negative above already holds project.admin, which satisfies `red_select`
    // as surely as project.view does, so the two cases differ by exactly
    // `evidence_decisions.decide` and by nothing else.
  });

  it("refuses a decision carrying another workspace's ids", async () => {
    expect(await sqlstate(() => asActor(USER_B, WS_B, (cl) =>
      cl.query(DECISION_INSERT,
        decisionParams(wa, { occurrenceId: wa.blockingA, outcome: "accepted" })))))
      .toBe("42501");
    const none = await c.query<{ n: number }>(
      `select count(*)::int as n from public.requirement_evidence_decisions
        where workspace_id = $1`, [WS_A]);
    expect(none.rows[0]!.n).toBe(0);
  });
});

describe("stage_closures and their frozen set", () => {
  it("records a closure under stage_closures.close, and the stage moves with it", async () => {
    const decisionA = await recordDecision(c, wa,
      { occurrenceId: wa.blockingA, outcome: "accepted" });
    const decisionB = await recordDecision(c, wa,
      { occurrenceId: wa.blockingB, outcome: "accepted" });

    // BOTH CAPABILITIES, AND MIGRATION 0046 §e IS WHY IT IS NOT PADDING. An actor
    // who may close and may not READ the project cannot see the stage row, so
    // `ws_update`'s SELECT-side security qual filters it out, the closing update
    // matches nothing, and `stage_closures_stage_fkey` then refuses the closure
    // against a stage still recorded open. The route requires the pair for the
    // same reason plus a monetary one — under RLS an invisible progress entry sums
    // to ZERO rather than raising, so a carve by an actor who cannot read the
    // project would see an untouched pool and take all of it.
    await withCapabilities(a, memberIdM, ["project.view", "stage_closures.close"], async () => {
      await closeStageAs(USER_M, WS_A, wa, memberIdM, [
        { occurrenceId: wa.blockingA, decisionId: decisionA },
        { occurrenceId: wa.blockingB, decisionId: decisionB },
      ]);
    });

    const stage = await c.query<{ status: string }>(
      `select status from public.work_stages where id = $1`, [wa.stageId]);
    expect(stage.rows[0]!.status).toBe("closed");
    const closures = await c.query<{ n: number }>(
      `select count(*)::int as n from public.stage_closures where workspace_id = $1`, [WS_A]);
    expect(closures.rows[0]!.n).toBe(1);
  });

  it("refuses the closing UPDATE from an actor without stage_closures.close", async () => {
    // ws_update's USING clause names the capability AND the state, so the row is
    // simply not there to update — the assertion is therefore on the stage, not
    // on an error code. 0043 granted assignments.manage for creating stages;
    // closing one is a different act with a different capability and a different
    // persona, and holding the first must not imply the second.
    await withCapabilities(a, memberIdM, ["project.admin", "assignments.manage"], async () => {
      const res = await asActor(USER_M, WS_A, (cl) => cl.query(
        `update public.work_stages set status = 'closed', version = version + 1
          where workspace_id = $1 and id = $2`, [WS_A, wa.stageId]));
      expect(res.rowCount).toBe(0);
    });
    const stage = await c.query<{ status: string; version: string }>(
      `select status, version::text from public.work_stages where id = $1`, [wa.stageId]);
    expect(stage.rows[0]).toEqual({ status: "open", version: "1" });
  });

  it("refuses an INSERT of a stage born 'closed', and admits the same row born 'open'", async () => {
    // ws_insert's own half of the door migration 0048 shuts. The deferred
    // trigger (asserted in m3-closure-schema.test.ts) answers at COMMIT with a
    // message about closure facts; this answers at the statement with 42501, and
    // it says the simpler true thing: `assignments.manage` CREATES stages and
    // `stage_closures.close` CLOSES them, and 0045 §10 keeps the two capabilities
    // and the two personas apart on purpose. An INSERT that chose `status` let
    // the first do the second's work — and a stage born closed is terminal,
    // carries no frozen set, and counts as not-open when admission asks whether
    // the assignment has a stage left open, so it releases the assignment's
    // money.
    //
    // BOTH ROWS ARE ATTEMPTED BY THE SAME ACTOR WITH THE SAME CAPABILITIES AND
    // THE SAME COLUMN VALUES, differing in the status word alone. Without the
    // positive control the refusal could be the closable-unit index, a foreign
    // key or the missing SELECT right, and the case would be asserting nothing
    // about `status`.
    await withCapabilities(a, memberIdM,
      ["project.view", "assignments.manage"], async () => {
        const columns =
          `insert into public.work_stages
             (workspace_id, project_id, contract_id, contract_version_id,
              work_assignment_id, stage_key, is_concealed, status, created_by_member_id)
           values ($1,$2,$3,$4,$5,$6,true,$7,$8)`;
        const params = (status: string) => [
          WS_A, a.projectId, a.contractId, wa.baselineVersionId,
          wa.assignmentId, "prykhovani-roboty-rls-born", status, memberIdM,
        ];

        expect(await sqlstate(() => asActor(USER_M, WS_A, (cl) =>
          cl.query(columns, params("closed"))))).toBe("42501");

        await asActor(USER_M, WS_A, (cl) => cl.query(columns, params("open")));
      });

    const rows = await c.query<{ status: string }>(
      `select status from public.work_stages
        where workspace_id = $1 and stage_key = $2`,
      [WS_A, "prykhovani-roboty-rls-born"]);
    expect(rows.rows.map((r) => r.status)).toEqual(["open"]);

    // `resetClosureFacts` reopens stages rather than deleting them, so this row
    // would otherwise outlive the case that created it. `disable trigger user`
    // is not optional here: app.guard_work_stage() refuses EVERY delete on this
    // table, for the owner too, and says so — «a closure is a fact and the stage
    // is its subject». It suppresses that guard and not referential integrity,
    // so a stage something else still cites would still refuse to go.
    await c.query(`alter table public.work_stages disable trigger user`);
    try {
      await c.query(
        `delete from public.work_stages where workspace_id = $1 and stage_key = $2`,
        [WS_A, "prykhovani-roboty-rls-born"]);
    } finally {
      await c.query(`alter table public.work_stages enable trigger user`);
    }
  });

  it("refuses a closure insert carrying another workspace's ids", async () => {
    expect(await sqlstate(() => asActor(USER_B, WS_B, (cl) => cl.query(
      `insert into public.stage_closures
         (workspace_id, project_id, contract_id, work_assignment_id, work_stage_id,
          closed_by_member_id, can_close_stage_result,
          evaluated_occurrence_count, evaluated_occurrence_set_hash,
          idempotency_key, request_hash)
       values ($1,$2,$3,$4,$5,$6,true,0,$7,$8,$9)`,
      [WS_A, a.projectId, a.contractId, wa.assignmentId, wa.stageId, a.memberId,
       frozenSetHash([]), crypto.randomUUID(), "a".repeat(64)])))).toBe("42501");
  });

  it("shows the closure and its frozen set to the project, and to nobody else", async () => {
    const decisionA = await recordDecision(c, wa,
      { occurrenceId: wa.blockingA, outcome: "accepted" });
    const decisionB = await recordDecision(c, wa,
      { occurrenceId: wa.blockingB, outcome: "accepted" });
    await withCapabilities(a, memberIdM, ["project.view", "stage_closures.close"], async () => {
      await closeStageAs(USER_M, WS_A, wa, memberIdM, [
        { occurrenceId: wa.blockingA, decisionId: decisionA },
        { occurrenceId: wa.blockingB, decisionId: decisionB },
      ]);
    });
    const closureId = (await c.query<{ id: string }>(
      `select id from public.stage_closures where workspace_id = $1`, [WS_A])).rows[0]!.id;

    expect(await visible(USER_A, WS_A, "stage_closures", "id", closureId)).toBe(1);
    expect(await visible(USER_M, WS_A, "stage_closures", "id", closureId)).toBe(0);
    expect(await visible(USER_B, WS_B, "stage_closures", "id", closureId)).toBe(0);

    const set = await asActor(USER_A, WS_A, (cl) => cl.query(
      `select 1 from public.stage_closure_occurrences where stage_closure_id = $1`,
      [closureId]));
    expect(set.rows.length).toBe(2);
    const foreign = await asActor(USER_B, WS_B, (cl) => cl.query(
      `select 1 from public.stage_closure_occurrences where stage_closure_id = $1`,
      [closureId]));
    expect(foreign.rows.length).toBe(0);
  });
});

describe("the two projections are readable under readiness.view and writable by nobody", () => {
  async function seedProjections(): Promise<void> {
    await asService(USER_A, WS_A, async (cl) => {
      await cl.query(READINESS_PROJECTION_INSERT, readinessProjectionParams(wa));
      await cl.query(BLOCKED_REASON_INSERT, blockedReasonParams(wa, ruleVersionA));
    });
  }

  it("is written by the server role and by no application actor", async () => {
    // capabilities.csv:43 service.projection_rebuild. «Readiness stays a
    // projection: no editable status column, and no manual override of a derived
    // state» is a GRANT here, not a route's restraint — goproceed_app holds SELECT
    // and nothing else, so there is no writable readiness anywhere in the schema.
    await seedProjections();
    const rows = await c.query<{ n: number }>(
      `select (select count(*) from public.readiness_projection where workspace_id = $1)
            + (select count(*) from public.blocked_reasons where workspace_id = $1) as n`,
      [WS_A]);
    expect(Number(rows.rows[0]!.n)).toBe(2);

    const grants = await c.query<{ n: number }>(
      `select count(*)::int as n from information_schema.role_table_grants
        where grantee = 'goproceed_app' and table_schema = 'public'
          and table_name in ('readiness_projection','blocked_reasons')
          and privilege_type in ('INSERT','UPDATE','DELETE')`);
    expect(grants.rows[0]!.n).toBe(0);
  });

  it("refuses a write from a project ADMINISTRATOR holding every M3 capability", async () => {
    // Not a policy refusal — a missing GRANT, which is the layer a policy change
    // cannot undo by accident.
    expect(await sqlstate(() => asActor(USER_A, WS_A, (cl) =>
      cl.query(READINESS_PROJECTION_INSERT, readinessProjectionParams(wa))))).toBe("42501");
    expect(await sqlstate(() => asActor(USER_A, WS_A, (cl) =>
      cl.query(BLOCKED_REASON_INSERT, blockedReasonParams(wa, ruleVersionA))))).toBe("42501");
  });

  it("is read under readiness.view, NOT under project.view", async () => {
    // THE SPLIT THIS SUITE'S HEADER NAMES. capabilities.csv:31 puts readiness.get
    // and blocked_reasons.get behind readiness.view; the facts they are computed
    // from sit behind project.view. Neither implies the other, so a persona
    // holding only one of them reads half the answer — which is why the route
    // slice requires both and why whatever preset carries readiness.view must
    // carry project.view with it.
    await seedProjections();
    await withCapabilities(a, memberIdM, ["project.view"], async () => {
      expect(await visible(USER_M, WS_A, "readiness_projection", "scope_ref", wa.stageId))
        .toBe(0);
      expect(await visible(USER_M, WS_A, "blocked_reasons",
        "requirement_occurrence_id", wa.blockingA)).toBe(0);
    });
    await withCapabilities(a, memberIdM, ["readiness.view"], async () => {
      expect(await visible(USER_M, WS_A, "readiness_projection", "scope_ref", wa.stageId))
        .toBe(1);
      expect(await visible(USER_M, WS_A, "blocked_reasons",
        "requirement_occurrence_id", wa.blockingA)).toBe(1);
      // …and the facts behind them stay invisible to the same actor. An owner
      // who can read «120,00 ₴ blocked» and cannot open the obligation behind it
      // has been shown a number, which is the shape of report ADR-005 decision 6
      // exists to replace.
      expect(await visible(USER_M, WS_A, "requirement_occurrences", "id", wa.blockingA))
        .toBe(0);
    });
  });

  it("hides another tenant's projections, and revoking the grant hides one's own", async () => {
    await seedProjections();
    expect(await visible(USER_A, WS_A, "blocked_reasons",
      "requirement_occurrence_id", wa.blockingA)).toBe(1);
    expect(await visible(USER_B, WS_B, "blocked_reasons",
      "requirement_occurrence_id", wa.blockingA)).toBe(0);
    expect(await visible(USER_B, WS_B, "readiness_projection", "scope_ref", wa.stageId)).toBe(0);
    await withoutRead(a, async () => {
      expect(await visible(USER_A, WS_A, "blocked_reasons",
        "requirement_occurrence_id", wa.blockingA)).toBe(0);
      expect(await visible(USER_A, WS_A, "readiness_projection", "scope_ref", wa.stageId))
        .toBe(0);
    });
  });

  it("cannot store a blocked_reason whose occurrence belongs to another workspace", async () => {
    // INV-001 at the FK layer, which is what lets the service write policy be
    // unconditional: a mis-wired rebuilder cannot write a row whose project
    // belongs to another tenant even though it authorizes against nobody.
    // [2026-09-17, DEV-015] No longer so: the FK does not stop a cross-workspace
    // read or rewrite, and 0086 confines the service policy to the declared
    // workspace (BL-100). This case still pins the FK layer.
    expect(await sqlstate(() => asService(USER_A, WS_A, (cl) =>
      cl.query(BLOCKED_REASON_INSERT, blockedReasonParams(wa, ruleVersionA,
        { occurrenceId: wb.blockingA }))))).toBe("23503");
  });
});

describe("the append-only layer beneath the policies", () => {
  it("gives the app role no UPDATE and no DELETE on any M3 fact table", async () => {
    // The append-only trigger is the second layer; this is the first. A test that
    // only asserted the trigger would keep passing if a later migration granted
    // UPDATE and someone removed the trigger in the same change.
    const g = await c.query<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type from information_schema.role_table_grants
        where grantee = 'goproceed_app' and table_schema = 'public'
          and table_name in ('requirement_exceptions','requirement_evidence_decisions',
                             'stage_closures','stage_closure_occurrences')
          and privilege_type in ('UPDATE','DELETE')`);
    expect(g.rows).toEqual([]);
  });

  it("gives the app role UPDATE on the two heads and DELETE on neither", async () => {
    // A head is a pointer and advancing it IS its only mutation; a lineage that
    // has ever had a head keeps one.
    const g = await c.query<{ privilege_type: string }>(
      `select distinct privilege_type from information_schema.role_table_grants
        where grantee = 'goproceed_app' and table_schema = 'public'
          and table_name in ('requirement_exception_heads',
                             'requirement_evidence_decision_heads')
        order by privilege_type`);
    expect(g.rows.map((r) => r.privilege_type)).toEqual(["INSERT", "SELECT", "UPDATE"]);
  });

  it("gives the app role UPDATE on work_stages and no DELETE", async () => {
    const g = await c.query<{ privilege_type: string }>(
      `select distinct privilege_type from information_schema.role_table_grants
        where grantee = 'goproceed_app' and table_schema = 'public'
          and table_name = 'work_stages' order by privilege_type`);
    expect(g.rows.map((r) => r.privilege_type)).toEqual(["INSERT", "SELECT", "UPDATE"]);
  });

  it("leaves nothing readable to anon or authenticated", async () => {
    const g = await c.query<{ n: number }>(
      `select count(*)::int as n from information_schema.role_table_grants
        where grantee in ('anon','authenticated','PUBLIC') and table_schema = 'public'
          and table_name in ('requirement_exceptions','requirement_exception_heads',
                             'requirement_evidence_decisions',
                             'requirement_evidence_decision_heads',
                             'stage_closures','stage_closure_occurrences',
                             'readiness_projection','blocked_reasons')`);
    expect(g.rows[0]!.n).toBe(0);
  });
});
