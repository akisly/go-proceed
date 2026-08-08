import { describe, it, expect, vi, beforeEach } from "vitest";
import { q, truncateAll, jsonReq, baselineFixture, type BaselineFixture } from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion,
  publishVersion, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. It was written with no node_modules,
 * no database and no docker: `vitest`, `tsc`, `psql` and `supabase` were never
 * run against it, no route was invoked, no migration was applied, and no claim
 * is made that any assertion below passes or that the migration it depends on
 * applies. Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * THE END-TO-END CASE, WHICH COULD NOT BE WRITTEN BEFORE MIGRATION 0050.
 *
 * Until the work-type carrier landed, `workTypeKeyOf` returned null for every
 * row in the product: `public.work_items` had no `work_type_key`, `matchesLine`
 * was false for every bound rule, and NO ASSIGNMENT ANYWHERE MATERIALISED AN
 * OCCURRENCE. Every stage was empty, every closure vacuous, and every existing
 * assertion about coverage was NEGATIVE — `not.toBe("covered")`,
 * `not.toBe("no_bindings")`, `toBe(0)`. The M2-M6 suites reached the gate by
 * writing the obligation set themselves through `materialiseOccurrences`, with
 * a work type they supplied, because the product could not store one.
 *
 * THIS FILE DRIVES ONLY ROUTES. It imports neither `materialiseOccurrences` nor
 * `planMaterialisation`: the whole point is that the obligation set now arrives
 * through `assignments.create` from a work type stored on the line, so a suite
 * that reached for the writer would be proving the writer against itself. The
 * two claims it makes are the two the slice is answerable for:
 *
 *   1. WHAT MATERIALISES IS EXACTLY WHAT THE BINDINGS IMPLY. The expectation is
 *      computed IN SQL, from the stored line and the stored bindings, and never
 *      names a work type in TypeScript. It is the predicate restated in another
 *      language, so a planner that agreed with itself while matching the wrong
 *      rules still fails here. `m2-materialisation.int.test.ts` established that
 *      technique against a SUPPLIED work type; this runs it against a STORED one.
 *   2. THE GATE BITES. A stage carrying a real obligation REFUSES to close while
 *      the obligation is unmet, and closes once it is satisfied. No test in the
 *      tree exercised that through the route before this slice, because there
 *      was no route-materialised obligation to be blocked by: every closure in
 *      every suite succeeded on the first attempt over an empty set.
 *
 * THE COUNTERFACTUAL IS ASSERTED BESIDE IT AND IN THE SAME FIXTURE (see
 * «the same command, the same baseline, the opposite outcome»). One untyped line
 * still produces the old behaviour — no stage, and a hand-made stage that closes
 * vacuously on the first attempt. That pairing is what makes «the gate bites» a
 * claim about the carrier rather than about this fixture's luck: the two lines
 * differ in one column.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT RE-PROVE. The field-by-field copy of the
 * fifteen pinned columns (m2-materialisation), the refusal's `blocked_reason`
 * object in full (m3-refusal), and the write-path refusal of a work type that
 * resolves to nothing (work-type-carrier). Those are asserted where they live.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

/**
 * The four M3 capabilities are in NO row of
 * technical/permissions/responsibility-presets.csv (migration 0045 §11 item 2),
 * so they are granted by hand exactly as `m3-refusal.int.test.ts` grants them.
 * Named rather than folded into the list, because a fixture that silently grants
 * a capability no persona holds is the shape of gap a fixture hides.
 */
const M3_PRESET_GAP = ["stage_closures.close", "evidence_decisions.decide",
                       "requirement_exceptions.decide", "readiness.view"] as const;
const CAPS = ["assignments.manage", "rule_bindings.manage", "requirements.assign",
              "progress.record", "evidence.record", ...M3_PRESET_GAP] as const;

const ELECTRIC = "montazh-elektrotekhnichnykh-ustanovok";
const MASONRY = "muruvannia-tsehliane";

const STAGE_CONCEALED = "prykhovani-roboty";
const STAGE_OPEN = "montazhni-roboty";
const STAGE_MASONRY = "muruvannia-etap";

interface Fx extends BaselineFixture {
  contractVersionId: string;
  /** ELECTRIC / concealed stage / before_concealment. */
  electricConcealedA: string;
  /** ELECTRIC / concealed stage / before_concealment — the SECOND obligation. */
  electricConcealedB: string;
  /** ELECTRIC / open stage / before_work. */
  electricOpen: string;
  /** MASONRY / its own stage. Bound to this same baseline. */
  masonry: string;
  /** Typed ELECTRIC. Three obligations across two stages. */
  electricLineId: string;
  /** Typed MASONRY. One obligation, and it must be the masonry one. */
  masonryLineId: string;
  /** No work type at all — the frozen importer's shape, and the pre-0050 world. */
  untypedLineId: string;
}

let fx: Fx;

async function grant(projectId: string, memberId: string): Promise<void> {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  const res = await POST(jsonReq("http://x", { memberId, capabilities: [...CAPS] }),
    { params: Promise.resolve({ projectId }) });
  if (res.status >= 300) throw new Error(`grant ${res.status} ${await res.text()}`);
}

async function publishRule(
  workspaceId: string, libraryItemId: string, over: Record<string, unknown>,
): Promise<string> {
  const res = await publishRuleVersion(workspaceId, ruleVersionBody(libraryItemId, over));
  if (res.status !== 201) {
    throw new Error(`requirement_rule_versions.publish ${res.status} ${await res.text()}`);
  }
  return (await res.json()).ruleVersionId as string;
}

/**
 * A published, bound baseline of THREE lines against FOUR bound rule versions.
 *
 * THE SHAPE IS CHOSEN SO THAT EACH CLAIM HAS SOMETHING TO BE WRONG ABOUT:
 *
 *   * TWO work types, both BOUND. With one, «materialises what the bindings
 *     imply» and «materialises everything bound» are the same sentence. With
 *     the second work type merely published and not bound, the discrimination
 *     would still be untested in the direction that matters — a line whose type
 *     matches a rule the baseline DID agree to.
 *   * TWO rules on ONE stage. With one obligation per stage, «refuses while any
 *     obligation is unmet» and «refuses while THE obligation is unmet» are the
 *     same sentence, and a command that stopped at the first satisfied
 *     occurrence would close.
 *   * TWO stages on ONE line. That is what makes an assignment's stages testable
 *     as independent closable units, and it is the only shape in which
 *     `ADMISSION_RULE = "last_open_stage_of_assignment"` is distinguishable from
 *     «admit on any closure» — see the money case below.
 *   * ONE untyped line, in the same version, so the counterfactual runs against
 *     the same bindings and the same contract rather than against a second
 *     fixture that could differ in some other way.
 *
 * Everything is bound BEFORE publication: `app.guard_rule_binding_window()`
 * refuses a binding on a published version, because a rule published after the
 * baseline never enters it (INV-080).
 */
async function typedBaseline(): Promise<Fx> {
  const base = await baselineFixture(A);
  await grant(base.projectId, base.memberId);
  const library = await seedRequirementLibrary(base.workspaceId);

  const item = (key: string): string => {
    const id = library.get(key);
    if (!id) throw new Error(`materialisation-end-to-end: the library seeded no ${key}`);
    return id;
  };

  const electricConcealedA = await publishRule(base.workspaceId, item("Н.15/1"), {
    workTypeKey: ELECTRIC, stageKey: STAGE_CONCEALED, timing: "before_concealment" });
  const electricConcealedB = await publishRule(base.workspaceId, item("Н.15/2"), {
    workTypeKey: ELECTRIC, stageKey: STAGE_CONCEALED, timing: "before_concealment" });
  const electricOpen = await publishRule(base.workspaceId, item("Н.15/3"), {
    workTypeKey: ELECTRIC, stageKey: STAGE_OPEN, timing: "before_work" });
  const masonry = await publishRule(base.workspaceId, item("Н.15/4"), {
    workTypeKey: MASONRY, stageKey: STAGE_MASONRY, timing: "before_concealment" });

  const draft = await createDraft(base.contractId);
  if (draft.status !== 201) {
    throw new Error(`contract_versions.create ${draft.status} ${await draft.text()}`);
  }
  const contractVersionId = (await draft.json()).contractVersionId as string;

  const add = async (body: Record<string, unknown>): Promise<string> => {
    const res = await addLine(contractVersionId, {
      unitCode: "м", contractQuantity: "10",
      unitPriceState: "known", unitPrice: "100.00", ...body,
    });
    if (res.status !== 201) throw new Error(`work_items.create ${res.status} ${await res.text()}`);
    return (await res.json()).workItem.workItemId as string;
  };

  const electricLineId = await add({
    sourceKey: "1.1", description: "Приклад-прокладання кабелю в штробі",
    workTypeKey: ELECTRIC });
  const masonryLineId = await add({
    sourceKey: "1.2", description: "Приклад-мурування перегородки",
    unitCode: "м2", workTypeKey: MASONRY });
  const untypedLineId = await add({
    sourceKey: "1.3", description: "Приклад-позиція без виду робіт" });

  const bind = await bindRules(contractVersionId,
    [electricConcealedA, electricConcealedB, electricOpen, masonry]);
  if (bind.status !== 201) throw new Error(`bind_rules ${bind.status} ${await bind.text()}`);

  const view = await (await getVersion(base.contractId, 1)).json();
  const pub = await publishVersion(contractVersionId, manifestOf(view));
  if (pub.status !== 201) {
    throw new Error(`contract_versions.publish ${pub.status} ${await pub.text()}`);
  }

  return { ...base, contractVersionId,
           electricConcealedA, electricConcealedB, electricOpen, masonry,
           electricLineId, masonryLineId, untypedLineId };
}

async function createAssignment(workItemId: string): Promise<{ status: number; body: any }> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x", { workItemId }),
    { params: Promise.resolve({ contractId: fx.contractId }) });
  return { status: res.status, body: await res.json() };
}

/** The assignment id, with the 201 checked so a failure names itself. */
async function assign(workItemId: string): Promise<string> {
  const created = await createAssignment(workItemId);
  if (created.status !== 201) {
    throw new Error(`assignments.create ${created.status} ${JSON.stringify(created.body)}`);
  }
  return created.body.assignmentId as string;
}

/**
 * THE ORACLE. What the bindings imply for one line, computed in SQL from the
 * STORED work type and the STORED bindings.
 *
 * It never mentions ELECTRIC or MASONRY: the join condition is
 * `rv.work_type_key = w.work_type_key`, so this is the rule predicate restated
 * over the rows rather than the fixture's arithmetic written down twice. A
 * planner that matched on the wrong column, matched case-insensitively, or read
 * the work type off the request instead of off the line disagrees with it.
 *
 * A NULL work type yields NO ROWS, and that is the predicate and not a special
 * case: `null = anything` is null, so an untyped line matches nothing here for
 * exactly the reason `matchesLine` returns false for it.
 */
const IMPLIED_RULE_VERSIONS_SQL = `
  select rv.id
    from public.work_items w
    join public.contract_version_rule_bindings b
      on b.workspace_id = w.workspace_id
     and b.contract_version_id = w.contract_version_id
    join public.requirement_rule_versions rv
      on rv.workspace_id = b.workspace_id
     and rv.id = b.requirement_rule_version_id
   where w.workspace_id = $1 and w.id = $2
     and rv.work_type_key = w.work_type_key
   order by rv.id`;

/**
 * Both sides of every comparison are sorted IN JAVASCRIPT and not by the
 * database, deliberately. Postgres orders `uuid` by its sixteen bytes and JS
 * orders the canonical text; the two agree, but only because the hyphens sit at
 * identical positions in every uuid — an argument a reader should not have to
 * reconstruct to believe an assertion. Sorting both sides the same way in the
 * same language removes the question.
 */
const sorted = (xs: string[]): string[] => [...xs].sort();

async function impliedRuleVersionIds(workItemId: string): Promise<string[]> {
  const rows = await q<{ id: string }>(IMPLIED_RULE_VERSIONS_SQL, [fx.workspaceId, workItemId]);
  return sorted(rows.map((r) => r.id));
}

async function storedRuleVersionIds(assignmentId: string): Promise<string[]> {
  const rows = await q<{ rule_version_id: string }>(
    `select rule_version_id from public.requirement_occurrences
      where workspace_id = $1 and work_assignment_id = $2`,
    [fx.workspaceId, assignmentId]);
  return sorted(rows.map((r) => r.rule_version_id));
}

async function stageIdOf(assignmentId: string, stageKey: string): Promise<string> {
  const rows = await q<{ id: string }>(
    `select id from public.work_stages
      where workspace_id = $1 and work_assignment_id = $2 and stage_key = $3`,
    [fx.workspaceId, assignmentId, stageKey]);
  if (rows.length !== 1) {
    throw new Error(
      `expected exactly one ${stageKey} stage on assignment ${assignmentId}, found ${rows.length}`);
  }
  return rows[0]!.id;
}

async function occurrenceIdsOfStage(stageId: string): Promise<string[]> {
  const rows = await q<{ id: string }>(
    `select id from public.requirement_occurrences
      where workspace_id = $1 and work_stage_id = $2`,
    [fx.workspaceId, stageId]);
  return sorted(rows.map((r) => r.id));
}

async function closeStage(stageId: string, expectedVersion = 1): Promise<Response> {
  const { POST } = await import("../app/v1/stages/[stageId]/closures/route");
  return POST(jsonReq("http://x", { expectedVersion }), { params: Promise.resolve({ stageId }) });
}

async function createStage(
  assignmentId: string, stageKey: string, isConcealed: boolean,
): Promise<Response> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/stages/route");
  return POST(jsonReq("http://x", { stageKey, isConcealed }),
    { params: Promise.resolve({ assignmentId }) });
}

async function decide(occurrenceId: string): Promise<Response> {
  const { POST } = await import(
    "../app/v1/occurrences/[occurrenceId]/evidence-decisions/route");
  return POST(jsonReq("http://x", { outcome: "accepted", expectedVersion: null }),
    { params: Promise.resolve({ occurrenceId }) });
}

async function acceptRisk(occurrenceId: string): Promise<Response> {
  const { POST } = await import("../app/v1/occurrences/[occurrenceId]/exceptions/route");
  return POST(jsonReq("http://x", {
    action: "accept_risk", reason: "Приклад-ризик прийнято до усунення.",
    expectedVersion: null,
  }), { params: Promise.resolve({ occurrenceId }) });
}

async function record(assignmentId: string, quantity: string): Promise<Response> {
  const { POST } = await import("../app/v1/assignments/[assignmentId]/progress/route");
  return POST(jsonReq("http://x", { quantity }),
    { params: Promise.resolve({ assignmentId }) });
}

async function listOccurrences(assignmentId: string): Promise<{ status: number; body: any }> {
  const { GET } = await import("../app/v1/assignments/[assignmentId]/requirement-occurrences/route");
  const res = await GET(new Request("http://x"), { params: Promise.resolve({ assignmentId }) });
  return { status: res.status, body: await res.json() };
}

async function dryRun(): Promise<{ status: number; body: any }> {
  const { POST } = await import(
    "../app/v1/projects/[projectId]/contract-versions/[versionId]/requirement-occurrences/dry-run/route");
  const res = await POST(jsonReq("http://x", {}),
    { params: Promise.resolve({ projectId: fx.projectId, versionId: fx.contractVersionId }) });
  return { status: res.status, body: await res.json() };
}

async function readiness(): Promise<any> {
  const { GET } = await import("../app/v1/projects/[projectId]/readiness/route");
  const res = await GET(new Request("http://x"),
    { params: Promise.resolve({ projectId: fx.projectId }) });
  if (res.status !== 200) throw new Error(`readiness.get ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * The OTHER read of the same list. `blocked_reasons.get` and `readiness.get`
 * compute from one `evaluateStages` call each and are meant to hold one opinion
 * about a row; the tests at the end of this file are the ones that check they
 * do.
 */
async function blockedReasonsGet(): Promise<any> {
  const { GET } = await import("../app/v1/projects/[projectId]/blocked-reasons/route");
  const res = await GET(new Request("http://x"),
    { params: Promise.resolve({ projectId: fx.projectId }) });
  if (res.status !== 200) {
    throw new Error(`blocked_reasons.get ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** A return, which UNSATISFIES an occurrence that an acceptance satisfied. */
async function returnDecision(occurrenceId: string, expectedVersion: number): Promise<Response> {
  const { POST } = await import(
    "../app/v1/occurrences/[occurrenceId]/evidence-decisions/route");
  return POST(jsonReq("http://x", {
    outcome: "returned",
    reason: "Приклад-повернення: виконавча схема не додана.",
    expectedVersion,
  }), { params: Promise.resolve({ occurrenceId }) });
}

/** Every stage key that exists on an assignment, whoever wrote it. */
async function stageKeysOf(assignmentId: string): Promise<string[]> {
  const rows = await q<{ stage_key: string }>(
    `select stage_key from public.work_stages
      where workspace_id = $1 and work_assignment_id = $2`,
    [fx.workspaceId, assignmentId]);
  return sorted(rows.map((r) => r.stage_key));
}

/**
 * THE PREDICATE, ASKED DIRECTLY — `app.stage_key_is_admissible` (migration 0051
 * §1), the one implementation `work_stages.create` and
 * `work_stages_stage_key_guard` share.
 */
async function admissible(assignmentId: string, stageKey: string): Promise<boolean> {
  const rows = await q<{ ok: boolean }>(
    `select app.stage_key_is_admissible($1, $2, $3) as ok`,
    [fx.workspaceId, assignmentId, stageKey]);
  return rows[0]!.ok;
}

/**
 * A stage written with the ROUTE BYPASSED, on the admin connection: no
 * capability check, no `HttpProblem`, RLS not applied. It is the second threat
 * model 0051 §2 names — a job, a later route, a hand-run statement — and the
 * only way to tell a route check from a structural refusal.
 *
 * The row is built by SELECTing the assignment's own scope columns so the
 * composite foreign key resolves and the ONLY thing left to refuse the insert is
 * the trigger.
 */
async function insertStageBypassingTheRoute(
  assignmentId: string, stageKey: string,
): Promise<Error | null> {
  try {
    await q(
      `insert into public.work_stages
         (workspace_id, project_id, contract_id, contract_version_id,
          work_assignment_id, stage_key, is_concealed, created_by_member_id)
       select a.workspace_id, a.project_id, a.contract_id, a.contract_version_id,
              a.id, $3, true, $4
         from public.work_assignments a
        where a.workspace_id = $1 and a.id = $2`,
      [fx.workspaceId, assignmentId, stageKey, fx.memberId]);
    return null;
  } catch (e) {
    return e as Error;
  }
}

beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await typedBaseline();
});

describe("what materialises is exactly what the bindings imply", () => {
  it("materialises an occurrence for a typed line — the assertion that could not exist before 0050",
    async () => {
      // The plainest assertion in the repository, and the one the whole slice is
      // for. Before migration 0050 the right-hand side was 0 for every line in
      // the product and this could only have been written as `toBe(0)`.
      const created = await createAssignment(fx.electricLineId);

      expect(created.status).toBe(201);
      expect(created.body.requirementOccurrences.coverage).toBe("covered");
      expect(created.body.requirementOccurrences.occurrenceCount).toBe(3);
      expect(created.body.requirementOccurrences.stageCount).toBe(2);

      // Read from the ROWS and not from the response: a 201 that counted
      // something it did not write is the precise shape of vacuous success this
      // slice exists against.
      const stored = await storedRuleVersionIds(created.body.assignmentId);
      expect(stored).toHaveLength(3);
    });

  it("stores exactly the rule versions the bindings imply for the line, and no others", async () => {
    const assignmentId = await assign(fx.electricLineId);

    const implied = await impliedRuleVersionIds(fx.electricLineId);
    // THE ANCHOR. Without it the comparison below could be two empty sets
    // agreeing, which is what every version of this assertion was before the
    // carrier landed. The count is the fixture's and is asserted first so a
    // change to the fixture fails here rather than looking like a matching bug.
    expect(implied).toHaveLength(3);
    expect(implied).toEqual(
      sorted([fx.electricConcealedA, fx.electricConcealedB, fx.electricOpen]));

    expect(await storedRuleVersionIds(assignmentId)).toEqual(implied);

    // The masonry rule is bound to THIS baseline and must not appear. That is
    // the entire difference between «what the bindings imply» and «everything
    // the baseline bound», and it is the difference a match-everything
    // implementation would fail.
    expect(await storedRuleVersionIds(assignmentId)).not.toContain(fx.masonry);
  });

  it("discriminates in the other direction too: the masonry line gets the masonry rule only",
    async () => {
      // Asserted separately from the electric case because «the electric line
      // does not get masonry» is satisfied by a predicate that materialises
      // nothing for masonry at all. Both lines are typed, both types are bound,
      // and each line must reach its own rule.
      const assignmentId = await assign(fx.masonryLineId);

      const implied = await impliedRuleVersionIds(fx.masonryLineId);
      expect(implied).toEqual([fx.masonry]);
      expect(await storedRuleVersionIds(assignmentId)).toEqual([fx.masonry]);
    });

  it("opens one stage per distinct stage key the matched rules name, concealed where the timing demands",
    async () => {
      // `work_stages_closable_unit_uniq` makes (assignment, location, stage key)
      // ONE closable unit, so two rules on one key must not produce two stages.
      // Concealment is DERIVED — nothing records it and no v0.1 command asks
      // anyone — and the derivation is that any rule timed before_concealment
      // conceals its stage. The oracle re-derives it with bool_or rather than
      // restating the fixture.
      const assignmentId = await assign(fx.electricLineId);

      const implied = await q<{ stage_key: string; is_concealed: boolean }>(
        `select rv.stage_key, bool_or(rv.timing = 'before_concealment') as is_concealed
           from public.work_items w
           join public.contract_version_rule_bindings b
             on b.workspace_id = w.workspace_id
            and b.contract_version_id = w.contract_version_id
           join public.requirement_rule_versions rv
             on rv.workspace_id = b.workspace_id
            and rv.id = b.requirement_rule_version_id
          where w.workspace_id = $1 and w.id = $2
            and rv.work_type_key = w.work_type_key
          group by rv.stage_key
          order by rv.stage_key`,
        [fx.workspaceId, fx.electricLineId]);
      expect(implied).toEqual([
        { stage_key: STAGE_OPEN, is_concealed: false },
        { stage_key: STAGE_CONCEALED, is_concealed: true },
      ]);

      const stages = await q<{ stage_key: string; is_concealed: boolean; status: string }>(
        `select stage_key, is_concealed, status from public.work_stages
          where workspace_id = $1 and work_assignment_id = $2 order by stage_key`,
        [fx.workspaceId, assignmentId]);
      expect(stages.map((s) => ({ stage_key: s.stage_key, is_concealed: s.is_concealed })))
        .toEqual(implied);
      // Born open. `materialiseOccurrences` writes no status and 0048 narrows
      // `ws_insert` to a stage born `open`, so a stage that arrived closed would
      // be terminal from birth with no closure fact behind it.
      expect(stages.every((s) => s.status === "open")).toBe(true);
    });

  it("materialises nothing for the untyped line, and says which of the three reasons it is",
    async () => {
      // The pre-0050 world, still reachable and still correct. `no_bindings`
      // would be the wrong owner (this baseline has four) and `no_matching_rule`
      // would send a classification problem to whoever manages the library.
      const created = await createAssignment(fx.untypedLineId);

      expect(created.status).toBe(201);
      expect(created.body.requirementOccurrences.coverage).toBe("work_type_unresolved");
      expect(created.body.requirementOccurrences.occurrenceCount).toBe(0);
      expect(created.body.requirementOccurrences.stageCount).toBe(0);
      expect(await impliedRuleVersionIds(fx.untypedLineId)).toEqual([]);

      const stages = await q<{ n: number }>(
        `select count(*)::int as n from public.work_stages
          where workspace_id = $1 and work_assignment_id = $2`,
        [fx.workspaceId, created.body.assignmentId]);
      expect(stages[0]!.n).toBe(0);
    });

  it("holds over the WHOLE workspace: every implied pair exists once, and nothing else exists",
    async () => {
      // The set claim rather than three per-assignment claims. `except all`
      // rather than `except`, so a writer that inserted an occurrence TWICE is
      // caught: set difference would swallow the duplicate.
      await assign(fx.electricLineId);
      await assign(fx.masonryLineId);
      await assign(fx.untypedLineId);

      const [row] = await q<{
        expected_n: number; actual_n: number; missing: number; extra: number;
      }>(
        `with expected as (
           select a.id as assignment_id, rv.id as rule_version_id
             from public.work_assignments a
             join public.work_items w
               on w.workspace_id = a.workspace_id and w.id = a.work_item_id
             join public.contract_version_rule_bindings b
               on b.workspace_id = a.workspace_id
              and b.contract_version_id = a.contract_version_id
             join public.requirement_rule_versions rv
               on rv.workspace_id = b.workspace_id
              and rv.id = b.requirement_rule_version_id
            where a.workspace_id = $1
              and rv.work_type_key = w.work_type_key),
         actual as (
           select o.work_assignment_id as assignment_id, o.rule_version_id
             from public.requirement_occurrences o
            where o.workspace_id = $1)
         select (select count(*)::int from expected) as expected_n,
                (select count(*)::int from actual) as actual_n,
                (select count(*)::int from
                   (select * from expected except all select * from actual) m) as missing,
                (select count(*)::int from
                   (select * from actual except all select * from expected) e) as extra`,
        [fx.workspaceId]);

      // Three for the electric assignment, one for the masonry one, none for the
      // untyped one. Anchored so the comparison can never be two empty sets.
      expect(row!.expected_n).toBe(4);
      expect(row!.missing).toBe(0);
      expect(row!.extra).toBe(0);
      expect(row!.actual_n).toBe(row!.expected_n);
    });

  it("pins every occurrence to a rule version this baseline bound", async () => {
    // Migration 0043 leg (b), asked of the stored rows rather than of the
    // command. The anti-join is over the whole workspace because an occurrence
    // that escaped through some other path would still be an occurrence pinning
    // nothing agreed.
    await assign(fx.electricLineId);
    await assign(fx.masonryLineId);

    const orphans = await q<{ n: number }>(
      `select count(*)::int as n
         from public.requirement_occurrences o
         left join public.contract_version_rule_bindings b
           on b.workspace_id = o.workspace_id
          and b.contract_version_id = o.contract_version_id
          and b.requirement_rule_version_id = o.rule_version_id
        where o.workspace_id = $1 and b.id is null`,
      [fx.workspaceId]);
    expect(orphans[0]!.n).toBe(0);
  });

  it("attaches every occurrence to a stage of its own assignment, agreeing about concealment",
    async () => {
      await assign(fx.electricLineId);
      await assign(fx.masonryLineId);

      const strays = await q<{ n: number }>(
        `select count(*)::int as n
           from public.requirement_occurrences o
           join public.work_stages s
             on s.workspace_id = o.workspace_id and s.id = o.work_stage_id
          where o.workspace_id = $1
            and (s.work_assignment_id <> o.work_assignment_id
                 or s.stage_key <> o.stage_key
                 or s.is_concealed is distinct from o.stage_is_concealed)`,
        [fx.workspaceId]);
      expect(strays[0]!.n).toBe(0);
    });

  it("reports in the 201, in the audit row and in the outbox event the set it stored", async () => {
    // Three surfaces that outlive the request in different ways, and the first
    // fixture in which they can disagree by more than zero.
    const created = await createAssignment(fx.electricLineId);
    const stored = await storedRuleVersionIds(created.body.assignmentId);
    expect(stored).toHaveLength(3);
    expect([...created.body.requirementOccurrences.ruleVersionIds].sort()).toEqual(stored);
    expect(created.body.requirementOccurrences.occurrenceCount).toBe(stored.length);

    const audit = await q<{ details: any }>(
      `select details from public.audit_events
        where organization_id = $1 and action = 'requirement_occurrences.materialized'
          and object_id = $2`,
      [fx.workspaceId, created.body.assignmentId]);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.details.coverage).toBe("covered");
    expect(audit[0]!.details.occurrenceCount).toBe(stored.length);
    expect(audit[0]!.details.boundRuleVersionCount).toBe(4);

    const outbox = await q<{ payload: any }>(
      `select payload from public.transaction_outbox
        where organization_id = $1 and topic = 'requirement_occurrence.materialized'
          and aggregate_id = $2`,
      [fx.workspaceId, created.body.assignmentId]);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.payload.occurrenceIds).toHaveLength(stored.length);
    expect(outbox[0]!.payload.coverage).toBe("covered");
  });

  it("returns the obligation set to the foreman's read, in the order the work meets it", async () => {
    // `requirement_occurrences.list` is the screen ADR-006 step 2 is about, and
    // this is the first fixture in which it returns anything at all.
    const assignmentId = await assign(fx.electricLineId);
    const listed = await listOccurrences(assignmentId);

    expect(listed.status).toBe(200);
    expect(listed.body.coverage).toBe("covered");
    expect(listed.body.occurrences).toHaveLength(3);
    // before_work sorts ahead of before_concealment: the order the work meets
    // them, not the order the strings sort in.
    expect(listed.body.occurrences.map((o: any) => o.timing))
      .toEqual(["before_work", "before_concealment", "before_concealment"]);
    expect([...listed.body.occurrences.map((o: any) => o.ruleVersionId)].sort())
      .toEqual(await storedRuleVersionIds(assignmentId));
  });

  it("previews per line exactly what creating an assignment on it materialises", async () => {
    // A preview that disagrees with the command is not a preview. The equivalent
    // assertion in m2-materialisation is VACUOUS — both sides are empty there —
    // and this is the same claim with something in it. Read from the DATABASE
    // and not from the 201, so a route that agreed with itself while writing
    // something else would still fail.
    const run = await dryRun();
    expect(run.status).toBe(200);
    expect(run.body.workLines).toHaveLength(3);
    expect(run.body.summary.boundRuleCount).toBe(4);
    expect(run.body.summary.wouldMaterialiseCount).toBe(4);
    // One typed line is covered and one untyped line is not, so neither
    // «covered» nor «no_work_line_is_typed» describes this baseline.
    expect(run.body.summary.diagnosis).toBe("partially_uncovered");

    let materialised = 0;
    for (const line of run.body.workLines) {
      const assignmentId = await assign(line.workItemId);
      const stored = await storedRuleVersionIds(assignmentId);
      expect(stored).toEqual([...line.ruleVersionIds].sort());
      // And the preview agrees with the ORACLE too, so a preview and a command
      // that were wrong together would still fail.
      expect(stored).toEqual(await impliedRuleVersionIds(line.workItemId));
      materialised += stored.length;
    }
    expect(run.body.summary.wouldMaterialiseCount).toBe(materialised);
  });
});

describe("the gate bites", () => {
  /**
   * Every test here closes, or fails to close, the CONCEALED stage of the
   * electric assignment: two obligations, one closable unit, both materialised
   * by the route from a work type stored on the line.
   */
  async function armedStage(): Promise<{
    assignmentId: string; stageId: string; occurrenceIds: string[];
  }> {
    const assignmentId = await assign(fx.electricLineId);
    const stageId = await stageIdOf(assignmentId, STAGE_CONCEALED);
    const occurrenceIds = await occurrenceIdsOfStage(stageId);
    if (occurrenceIds.length !== 2) {
      throw new Error(
        `the gate bites: expected 2 obligations on ${STAGE_CONCEALED}, found ${occurrenceIds.length}`);
    }
    return { assignmentId, stageId, occurrenceIds };
  }

  it("refuses the closure with the catalogued code, naming both unmet obligations", async () => {
    const { stageId, occurrenceIds } = await armedStage();

    const res = await closeStage(stageId);

    expect(res.status).toBe(409);
    const body = await res.json();
    // technical/error-catalog.csv:95. Not a bare 409 and not VERSION_CONFLICT.
    expect(body.code).toBe("HOLD_POINT_BLOCKED");
    expect(body.userAction).toBe("complete_or_authorize_occurrence");
    expect(body.details.blockingOccurrenceCount).toBe(2);
    expect(body.details.unsatisfiedOccurrenceCount).toBe(2);
    expect(body.details.blockedReasons.map((r: any) => r.requirementOccurrenceId).sort())
      .toEqual([...occurrenceIds].sort());
    // The money that waits is real money: this line is priced, so INV-038 makes
    // it an amount rather than a quantity.
    for (const r of body.details.blockedReasons) {
      expect(r.blockedValue).not.toBeNull();
      expect(BigInt(r.blockedValue.grossMinorUnits)).toBeGreaterThan(0n);
    }

    // The stage did not move. A refused closure writes nothing at all
    // (ADR-008), and here that is asserted over a stage that had something to
    // refuse — every earlier version of this assertion ran over an empty one.
    const stage = await q<{ status: string; version: string }>(
      `select status, version::text from public.work_stages where id = $1`, [stageId]);
    expect(stage[0]!.status).toBe("open");
    expect(stage[0]!.version).toBe("1");
    const closures = await q<{ n: number }>(
      `select count(*)::int as n from public.stage_closures where work_stage_id = $1`, [stageId]);
    expect(closures[0]!.n).toBe(0);
  });

  it("still refuses when only one of the two obligations is satisfied", async () => {
    // A command that stopped at the first satisfied occurrence closes here. Two
    // obligations on ONE stage is the smallest fixture that can tell «any» from
    // «the» — and this is the first time the tree can build one through the
    // route rather than by hand.
    const { stageId, occurrenceIds } = await armedStage();
    const first = await decide(occurrenceIds[0]!);
    expect(first.status, await first.clone().text()).toBe(201);

    const res = await closeStage(stageId);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.details.blockingOccurrenceCount).toBe(2);
    expect(body.details.unsatisfiedOccurrenceCount).toBe(1);
    expect(body.details.blockedReasons.map((r: any) => r.requirementOccurrenceId))
      .toEqual([occurrenceIds[1]]);
  });

  it("closes once both are satisfied, and the closure is NOT vacuous", async () => {
    const { stageId, occurrenceIds } = await armedStage();
    for (const occurrenceId of occurrenceIds) {
      const res = await decide(occurrenceId);
      expect(res.status, await res.clone().text()).toBe(201);
    }

    const closed = await closeStage(stageId);

    expect(closed.status, await closed.clone().text()).toBe(201);
    const body = await closed.json();
    // THE ASSERTION THE WHOLE SLICE IS ANSWERABLE FOR. Before migration 0050
    // every closure in the product was `vacuous: true`, because every stage was
    // empty; `vacuous: false` was unreachable through any route.
    expect(body.vacuous).toBe(false);
    expect(body.evaluatedOccurrenceCount).toBe(2);
    expect(body.evaluatedOccurrenceSetHash)
      .not.toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(body.frozenOccurrences.map((f: any) => f.requirementOccurrenceId).sort())
      .toEqual([...occurrenceIds].sort());
    expect(body.frozenOccurrences.every((f: any) => f.satisfiedBy === "evidence_decision"))
      .toBe(true);

    // The frozen set is ROWS, and the receipt is assembled by the same loop that
    // writes them, so it is read from the table instead.
    const members = await q<{ requirement_occurrence_id: string; relied_on_decision_id: string }>(
      `select requirement_occurrence_id, relied_on_decision_id
         from public.stage_closure_occurrences
        where workspace_id = $1 and stage_closure_id = $2`,
      [fx.workspaceId, body.stageClosureId]);
    expect(members.map((r) => r.requirement_occurrence_id).sort())
      .toEqual([...occurrenceIds].sort());
    expect(members.every((r) => r.relied_on_decision_id !== null)).toBe(true);

    const stage = await q<{ status: string; version: string }>(
      `select status, version::text from public.work_stages where id = $1`, [stageId]);
    expect(stage[0]!.status).toBe("closed");
    expect(stage[0]!.version).toBe("2");
  });

  it("the same command, the same baseline, the opposite outcome — a typed line and an untyped one",
    async () => {
      // THE COUNTERFACTUAL, AND IT IS THE POINT OF THE FILE. Both lines are in
      // the same published version, under the same four bindings, closed by the
      // same command with the same body. They differ in ONE COLUMN. Before
      // migration 0050 every line in the product was the second one.
      const typed = await armedStage();
      const refused = await closeStage(typed.stageId);
      expect(refused.status).toBe(409);
      expect((await refused.json()).code).toBe("HOLD_POINT_BLOCKED");

      const untypedAssignmentId = await assign(fx.untypedLineId);
      // Nothing materialised, so there is no stage to close: the stage has to be
      // made by hand, which is the shape every money fixture in the tree still
      // uses (`admission-valuation`, `progress-adjust`, `vertical-m2a`,
      // `concurrency`), and it is empty for the same reason.
      const created = await createStage(untypedAssignmentId, STAGE_CONCEALED, true);
      expect(created.status, await created.clone().text()).toBe(201);
      const createdBody = await created.json();
      expect(createdBody.blockingOccurrenceCount).toBe(0);

      const closed = await closeStage(createdBody.workStageId);

      // First attempt, no decision, no exception, no evidence — closed.
      expect(closed.status, await closed.clone().text()).toBe(201);
      const closure = await closed.json();
      expect(closure.vacuous).toBe(true);
      expect(closure.evaluatedOccurrenceCount).toBe(0);
      // The digest of the empty string, which migration 0045 §0 asserts at
      // migration time. It is the fingerprint of «this closure proved nothing».
      expect(closure.evaluatedOccurrenceSetHash)
        .toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

  it("treats the two stages of one assignment as two independent gates", async () => {
    // `work_stages_closable_unit_uniq` makes each (assignment, location, stage
    // key) its own closable unit. Satisfying the concealed stage's obligations
    // must not satisfy the open stage's, and closing one must not close the
    // other — a closure written per ASSIGNMENT rather than per stage would pass
    // every single-stage fixture in the tree and fail here.
    const { assignmentId, occurrenceIds } = await armedStage();
    const concealedStageId = await stageIdOf(assignmentId, STAGE_CONCEALED);
    const openStageId = await stageIdOf(assignmentId, STAGE_OPEN);
    expect(openStageId).not.toBe(concealedStageId);

    for (const occurrenceId of occurrenceIds) {
      expect((await decide(occurrenceId)).status).toBe(201);
    }
    expect((await closeStage(concealedStageId)).status).toBe(201);

    const res = await closeStage(openStageId);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("HOLD_POINT_BLOCKED");
    expect(body.details.blockingOccurrenceCount).toBe(1);
    expect(body.details.stageKey).toBe(STAGE_OPEN);

    const stages = await q<{ stage_key: string; status: string }>(
      `select stage_key, status from public.work_stages
        where workspace_id = $1 and work_assignment_id = $2 order by stage_key`,
      [fx.workspaceId, assignmentId]);
    expect(stages).toEqual([
      { stage_key: STAGE_OPEN, status: "open" },
      { stage_key: STAGE_CONCEALED, status: "closed" },
    ]);
  });

  it("holds the money until the LAST open stage closes — the rule that had no fixture before",
    async () => {
      // `ADMISSION_RULE = "last_open_stage_of_assignment"`
      // (apps/app/src/lib/admission.ts). That module's own comment says the
      // first answer («admit on any closure») and the third («admit when the
      // last stage closes») were BEHAVIOURALLY IDENTICAL in the only shape a
      // v0.1 pilot had — one assignment, one hand-made stage, materialisation
      // producing nothing — and that migration 0050 makes them diverge. This is
      // that divergence, and it is the first fixture in the tree that can see
      // it: a MULTI-STAGE assignment requires a typed line.
      const { assignmentId } = await armedStage();
      const recorded = await record(assignmentId, "4");
      expect(recorded.status, await recorded.clone().text()).toBe(201);
      const progressEntryId = (await recorded.json()).progressEntryId as string;

      const concealedStageId = await stageIdOf(assignmentId, STAGE_CONCEALED);
      const openStageId = await stageIdOf(assignmentId, STAGE_OPEN);

      // By EXCEPTION and not by decision: this member recorded the quantity, and
      // INV-069 refuses them every evidence decision on the assignment. The
      // escape is the path a single-member pilot actually has.
      for (const stageId of [concealedStageId, openStageId]) {
        for (const occurrenceId of await occurrenceIdsOfStage(stageId)) {
          const res = await acceptRisk(occurrenceId);
          expect(res.status, await res.clone().text()).toBe(201);
        }
      }

      const first = await closeStage(concealedStageId);
      expect(first.status, await first.clone().text()).toBe(201);
      const firstBody = await first.json();
      expect(firstBody.vacuous).toBe(false);
      // NOT ADMITTED. One stage of this assignment is still open, so the
      // quantity is recorded and unvalued (INV-089) and no money has moved.
      expect(firstBody.admission.admittedProgressEntryCount).toBe(0);
      expect(firstBody.admission.valued).toBe(false);
      const nothingCarved = await q<{ n: number }>(
        `select count(*)::int as n from public.valuation_allocations where workspace_id = $1`,
        [fx.workspaceId]);
      expect(nothingCarved[0]!.n).toBe(0);

      const second = await closeStage(openStageId);
      expect(second.status, await second.clone().text()).toBe(201);
      const secondBody = await second.json();
      expect(secondBody.admission.admittedProgressEntryCount).toBe(1);
      expect(secondBody.admission.admittedProgressEntryIds).toEqual([progressEntryId]);
      expect(secondBody.admission.valued).toBe(true);

      const carved = await q<{ progress_entry_id: string; admitted_by_closure_id: string }>(
        `select progress_entry_id, admitted_by_closure_id
           from public.valuation_allocations where workspace_id = $1`, [fx.workspaceId]);
      expect(carved).toHaveLength(1);
      expect(carved[0]!.progress_entry_id).toBe(progressEntryId);
      // The money names the SECOND closure — the one that closed the last open
      // stage — and not the first.
      expect(carved[0]!.admitted_by_closure_id).toBe(secondBody.stageClosureId);
    });

  it("lets readiness tell a PROVED closable stage from a merely EMPTY one", async () => {
    // `vacuouslyClosableCount` is «the number that stops «12 of 12 ready» being
    // read as twelve proved stages when it is twelve empty ones» (INV-072, and
    // the readiness route says so in terms). UNTIL THIS SLICE IT WAS ALWAYS
    // EQUAL TO `closableCount`, because every closable stage in the product was
    // empty — so the number that exists to expose the difference could never
    // show one. This test is that number finally doing its job.
    //
    // `readiness.get` and `stage_closures.create` share one predicate
    // (src/lib/readiness.ts), so this also asserts the shared function reports
    // the refusal the command enforces, over a route-materialised set.
    const { stageId, occurrenceIds } = await armedStage();
    const untypedAssignmentId = await assign(fx.untypedLineId);
    const empty = await createStage(untypedAssignmentId, STAGE_CONCEALED, true);
    const emptyStageId = (await empty.json()).workStageId as string;

    const before = await readiness();
    expect(before.source).toBe("computed");
    const blocked = before.stages.find((s: any) => s.workStageId === stageId);
    expect(blocked.canCloseStage).toBe(false);
    expect(blocked.blockingOccurrenceCount).toBe(2);
    expect(blocked.satisfiedOccurrenceCount).toBe(0);
    const vacuous = before.stages.find((s: any) => s.workStageId === emptyStageId);
    expect(vacuous.canCloseStage).toBe(true);
    expect(vacuous.blockingOccurrenceCount).toBe(0);
    // Three open stages: the electric line's two, both blocked, and the untyped
    // line's empty one. Every closable stage here is a vacuous one — the whole
    // product's shape before migration 0050, reproduced deliberately as the
    // baseline the next assertion has to differ from.
    expect(before.summary.blockedCount).toBe(2);
    expect(before.summary.closableCount).toBe(1);
    expect(before.summary.vacuouslyClosableCount).toBe(1);

    for (const occurrenceId of occurrenceIds) {
      expect((await decide(occurrenceId)).status).toBe(201);
    }

    const after = await readiness();
    const ready = after.stages.find((s: any) => s.workStageId === stageId);
    expect(ready.canCloseStage).toBe(true);
    expect(ready.blockedReasons).toEqual([]);
    // Closable WITHOUT being vacuous: the obligations are satisfied, not absent.
    expect(ready.blockingOccurrenceCount).toBe(2);
    expect(ready.satisfiedOccurrenceCount).toBe(2);
    // THE DIVERGENCE. Two stages are closable and only one of them proves
    // nothing. That inequality was unreachable before the carrier.
    expect(after.summary.closableCount).toBe(2);
    expect(after.summary.vacuouslyClosableCount).toBe(1);
    expect((await closeStage(stageId)).status).toBe(201);
  });
});

/**
 * THE STAGE NOBODY AGREED TO — migration 0051, and the whole-build audit's
 * finding 2.
 *
 * Until 2026-08-08 `work_stages.create` wrote any `stageKey` the caller typed.
 * `work_stages_closable_unit_uniq` blocks only a REPEAT of the same key, so a
 * fresh key was always available: a member holding `assignments.manage` and
 * `stage_closures.close` could make an empty stage after the real gate had
 * closed, close it vacuously, and — because it was then the assignment's last
 * open stage — have THAT closure admit every progress fact recorded since.
 *
 * WHY THESE ASSERTIONS ARE HERE AND NOT IN `m3-refusal.int.test.ts`, which is
 * where a refusal would ordinarily go: the defect needs a COVERED line, and
 * this is the only fixture in the tree that has one. Every other suite that
 * makes a stage by hand — `m3-refusal`, `progress-adjust`, `admission-valuation`,
 * `m4-act`, `concurrency` — is on an untyped line by choice, so the new rule
 * admits their keys unchanged and none of them can reach this case.
 *
 * THE FIXTURE'S THREE LINES ARE THE THREE ANSWERS. The electric line implies
 * {STAGE_CONCEALED, STAGE_OPEN}; the masonry line implies {STAGE_MASONRY} and is
 * bound to the SAME baseline; the untyped line implies nothing. So this suite
 * can tell the rule that shipped («implied for this line») from the wider one
 * that suggests itself («bound anywhere in the baseline»), which is the argument
 * 0051's header makes and the one nothing else in the tree can check.
 */
describe("the stage nobody agreed to", () => {
  const UNAGREED = "etap-yakoho-nikhto-ne-pohodzhuvav";

  async function stageCount(assignmentId: string): Promise<number> {
    const rows = await q<{ n: number }>(
      `select count(*)::int as n from public.work_stages
        where workspace_id = $1 and work_assignment_id = $2`,
      [fx.workspaceId, assignmentId]);
    return rows[0]!.n;
  }

  it("refuses a stage key the baseline did not imply for this line", async () => {
    const assignmentId = await assign(fx.electricLineId);
    const before = await stageCount(assignmentId);

    const res = await createStage(assignmentId, UNAGREED, false);

    expect(res.status, await res.clone().text()).toBe(422);
    const body = await res.json();
    // technical/error-catalog.csv:15 — the catalogued code for a field the
    // caller can correct, not a bare 400 and not the 500 the trigger's raise
    // would produce if the route had not asked first.
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.userAction).toBe("correct_fields");
    expect(body.retryable).toBe(false);
    expect(body.fieldErrors.map((f: any) => f.path)).toEqual(["stageKey"]);
    // `field_codes_no_values` is this row's log policy and the key the caller
    // typed IS the value, so the refusal must not echo it back.
    expect(JSON.stringify(body)).not.toContain(UNAGREED);

    // A refused command writes nothing.
    expect(await stageCount(assignmentId)).toBe(before);
  });

  it("refuses a key this baseline bound for ANOTHER work type — the case the wider rule misses",
    async () => {
      // THE ASSERTION THAT DISCRIMINATES BETWEEN THE TWO CANDIDATE RULES.
      // STAGE_MASONRY is bound to this very contract version, so «the key must be
      // one the baseline bound» would ADMIT it here and leave the mint fully
      // reachable — the electric assignment would get an empty masonry stage and
      // every step after that is unchanged. «Implied for THIS LINE» refuses it.
      const electric = await assign(fx.electricLineId);
      const masonry = await assign(fx.masonryLineId);

      const crossed = await createStage(electric, STAGE_MASONRY, true);
      expect(crossed.status, await crossed.clone().text()).toBe(422);
      expect((await crossed.json()).fieldErrors[0].path).toBe("stageKey");

      // And in the other direction, so this is a property of the predicate and
      // not of the order the fixture happens to bind its rules in.
      const back = await createStage(masonry, STAGE_CONCEALED, true);
      expect(back.status, await back.clone().text()).toBe(422);
      expect((await back.json()).fieldErrors[0].path).toBe("stageKey");
    });

  it("leaves the command with nothing to create on a covered line: implied keys are already taken",
    async () => {
      // The two halves together are what makes this a CLOSED door rather than a
      // narrowed one. Every implied key already holds a stage `assignments.create`
      // wrote in its own transaction and `public.work_stages` has no DELETE grant,
      // so an implied key collides; every other key is refused. There is no third
      // kind of key.
      const assignmentId = await assign(fx.electricLineId);
      expect(await stageKeysOf(assignmentId)).toEqual(sorted([STAGE_CONCEALED, STAGE_OPEN]));

      for (const implied of [STAGE_CONCEALED, STAGE_OPEN]) {
        const res = await createStage(assignmentId, implied, true);
        expect(res.status, `${implied}: ${await res.clone().text()}`).toBe(409);
        expect((await res.json()).code).toBe("ASSIGNMENT_CONFLICT");
      }

      expect(await stageCount(assignmentId)).toBe(2);
    });

  it("refuses it structurally, with the route bypassed", async () => {
    // THE REASON 0051 IS A TRIGGER AND NOT ONLY A ROUTE CHECK. `ws_insert`
    // admits every holder of `assignments.manage` to INSERT into this table, and
    // the mint needs one INSERT and one closure. This statement runs on the admin
    // connection — no capability check, no route, RLS not applied — and must
    // still be refused, or «the route checks it» is the whole guarantee.
    const assignmentId = await assign(fx.electricLineId);

    const raised = await insertStageBypassingTheRoute(assignmentId, UNAGREED);

    expect(raised).not.toBeNull();
    // The raise names the predicate, so a reader who meets this 500 in a log can
    // find the rule that produced it (0051 §2).
    expect(raised!.message).toContain("app.stage_key_is_admissible");
    expect(await stageCount(assignmentId)).toBe(2);

    // The same statement with an IMPLIED key passes the trigger and is stopped by
    // the uniqueness index instead — which is what proves the trigger refused the
    // KEY above rather than refusing every hand-written insert.
    const collided = await insertStageBypassingTheRoute(assignmentId, STAGE_CONCEALED);
    expect(collided).not.toBeNull();
    expect(collided!.message).toContain("work_stages_closable_unit_uniq");
  });

  it("agrees with the stages materialisation actually wrote", async () => {
    // THE JOINT NOTHING ELSE ENFORCES. `app.stage_key_is_admissible` is a THIRD
    // statement of a predicate that already exists in TypeScript
    // (`planForWorkType`) and in the bindings; if the SQL and the planner ever
    // disagree, a stage materialisation wrote would be refused by the trigger —
    // a failure inside the transaction that creates an assignment. This is the
    // assertion migration 0051 §1 and the route header both point at.
    for (const workItemId of [fx.electricLineId, fx.masonryLineId]) {
      const assignmentId = await assign(workItemId);
      const written = await stageKeysOf(assignmentId);
      expect(written.length).toBeGreaterThan(0);

      // Every key materialisation wrote, the function admits.
      for (const key of written) {
        expect(await admissible(assignmentId, key), key).toBe(true);
      }
      // And every OTHER key in the fixture's vocabulary — including the ones this
      // baseline bound for the other work type — it refuses.
      for (const key of [STAGE_CONCEALED, STAGE_OPEN, STAGE_MASONRY, UNAGREED]) {
        if (written.includes(key)) continue;
        expect(await admissible(assignmentId, key), key).toBe(false);
      }
    }
  });

  it("leaves the uncovered line exactly as it was: any key, an empty stage, a vacuous closure",
    async () => {
      // INV-072's DISCLOSED HOLE, AND 0051 DELIBERATELY DOES NOT CLOSE IT. An
      // untyped line implies no stage, so no key rule can shut a door: the FIRST
      // closure on such an assignment is already vacuous and already admitting.
      // Refusing spellings here would break the only shape an imported baseline's
      // money has — `admission-valuation.int.test.ts` — and shut nothing.
      const assignmentId = await assign(fx.untypedLineId);
      expect(await stageKeysOf(assignmentId)).toEqual([]);

      for (const key of [UNAGREED, STAGE_MASONRY]) {
        expect(await admissible(assignmentId, key), key).toBe(true);
      }

      const created = await createStage(assignmentId, UNAGREED, true);
      expect(created.status, await created.clone().text()).toBe(201);
      const createdBody = await created.json();
      expect(createdBody.blockingOccurrenceCount).toBe(0);

      const closed = await closeStage(createdBody.workStageId);
      expect(closed.status, await closed.clone().text()).toBe(201);
      expect((await closed.json()).vacuous).toBe(true);
    });

  it("cannot mint a SECOND admission after the last stage closes — the finding, end to end",
    async () => {
      // THE DEFECT IN FULL, in the order a member would have walked it.
      const assignmentId = await assign(fx.electricLineId);
      const concealedStageId = await stageIdOf(assignmentId, STAGE_CONCEALED);
      const openStageId = await stageIdOf(assignmentId, STAGE_OPEN);

      // 1. Quantity recorded, and the obligations discharged honestly. By
      //    exception rather than by decision because this member recorded the
      //    quantity and INV-069 refuses them every evidence decision here.
      const recorded = await record(assignmentId, "4");
      expect(recorded.status, await recorded.clone().text()).toBe(201);
      const firstEntryId = (await recorded.json()).progressEntryId as string;
      for (const stageId of [concealedStageId, openStageId]) {
        for (const occurrenceId of await occurrenceIdsOfStage(stageId)) {
          expect((await acceptRisk(occurrenceId)).status).toBe(201);
        }
      }

      // 2. Both stages close. The second is the admitting one and it carves.
      expect((await closeStage(concealedStageId)).status).toBe(201);
      const last = await closeStage(openStageId);
      expect(last.status, await last.clone().text()).toBe(201);
      const lastBody = await last.json();
      expect(lastBody.vacuous).toBe(false);
      expect(lastBody.admission.admittedProgressEntryIds).toEqual([firstEntryId]);

      // 3. MORE quantity is recorded. It is unvalued, correctly (INV-089), and
      //    it is the money the mint existed to release.
      const more = await record(assignmentId, "3");
      expect(more.status, await more.clone().text()).toBe(201);
      const secondEntryId = (await more.json()).progressEntryId as string;

      // 4. The mint. A fresh key, an empty stage, and it would be the only open
      //    stage of the assignment — so its vacuous closure would be the
      //    admitting one. It is refused, and there is no stage to close.
      const minted = await createStage(assignmentId, UNAGREED, false);
      expect(minted.status, await minted.clone().text()).toBe(422);
      expect((await minted.json()).code).toBe("VALIDATION_FAILED");

      const openStages = await q<{ n: number }>(
        `select count(*)::int as n from public.work_stages
          where workspace_id = $1 and work_assignment_id = $2 and status = 'open'`,
        [fx.workspaceId, assignmentId]);
      expect(openStages[0]!.n).toBe(0);

      // 5. THE CONSEQUENCE THAT MATTERS. One admission, one allocation, and the
      //    quantity recorded after the gate closed is still unvalued. Without the
      //    refusal there would be a second allocation here naming a closure that
      //    proved nothing — and, on an admitted root, this is also the second
      //    admission the double-spend in `valuation.ts` needs.
      const carved = await q<{ progress_entry_id: string }>(
        `select progress_entry_id from public.valuation_allocations where workspace_id = $1`,
        [fx.workspaceId]);
      expect(carved).toHaveLength(1);
      expect(carved[0]!.progress_entry_id).toBe(firstEntryId);
      const unvalued = await q<{ n: number }>(
        `select count(*)::int as n from public.valuation_allocations
          where workspace_id = $1 and progress_entry_id = $2`,
        [fx.workspaceId, secondEntryId]);
      expect(unvalued[0]!.n).toBe(0);
    });
});

/**
 * THREE READS, ONE OPINION ABOUT A STAGE THAT IS NOT OPEN — the audit's finding
 * 7 and the M3 pre-landing review's finding 8, deferred twice.
 *
 * `readiness.get` reported `canCloseStage` and filled `blockedReasons` for a
 * stage of ANY status, while `liveBlockedReasons` dropped non-open stages and
 * both money reads inherited that. So a CLOSED stage — the ordinary end state of
 * every satisfied stage in the product — read `canCloseStage: true` on the M3
 * screen, and could carry blocked reasons that `blocked_reasons.get` and
 * `blocked_value.get` said did not exist.
 *
 * BOTH HEADS ARE ASSERTED HERE BECAUSE THEY ARE REACHED DIFFERENTLY. The
 * `canCloseStage` half shows on any honest closure. The `blockedReasons` half
 * needs an occurrence to become UNSATISFIED after its stage closed, which v0.1
 * permits: no route refuses a decision on an occurrence whose stage is closed,
 * and a `returned` decision supersedes an acceptance. That is a real sequence, it
 * is the only one that reaches the second half, and a test that asserted only the
 * first would leave the divergence the money reads actually disagree about
 * uncovered.
 */
describe("three reads, one opinion about a stage that is not open", () => {
  async function closedStage(): Promise<{ stageId: string; occurrenceIds: string[] }> {
    const assignmentId = await assign(fx.electricLineId);
    const stageId = await stageIdOf(assignmentId, STAGE_CONCEALED);
    const occurrenceIds = await occurrenceIdsOfStage(stageId);
    for (const occurrenceId of occurrenceIds) {
      const res = await decide(occurrenceId);
      if (res.status !== 201) throw new Error(`decide ${res.status} ${await res.text()}`);
    }
    const closed = await closeStage(stageId);
    if (closed.status !== 201) throw new Error(`close ${closed.status} ${await closed.text()}`);
    return { stageId, occurrenceIds };
  }

  it("does not call a closed stage closable", async () => {
    const { stageId } = await closedStage();

    const view = (await readiness()).stages.find((s: any) => s.workStageId === stageId);

    expect(view.status).toBe("closed");
    // The ∀ over the frozen set is still true — that is WHY the stage closed —
    // and reporting it as «can close» for a stage that already did is the answer
    // to a question nobody asked. `stage_closures.create` keeps the raw
    // predicate; the gate is applied in the view (src/lib/readiness.ts).
    expect(view.canCloseStage).toBe(false);
    expect(view.blockedReasons).toEqual([]);
    // NOT gated, and deliberately: these are facts about what the stage carried,
    // and they are what an act and an audit are read against afterwards.
    expect(view.blockingOccurrenceCount).toBe(2);
    expect(view.satisfiedOccurrenceCount).toBe(2);
  });

  it("agrees with the summary it is printed under", async () => {
    // The summary has counted over OPEN stages only since it was written. Until
    // this change the rows beneath it did not, so a reader could count two
    // `canCloseStage: true` rows under a `closableCount` of one.
    const { stageId } = await closedStage();

    const body = await readiness();
    const rows = body.stages.filter((s: any) => s.canCloseStage).length;

    expect(body.summary.closableCount).toBe(rows);
    expect(body.summary.closedCount).toBe(1);
    expect(body.stages.find((s: any) => s.workStageId === stageId).canCloseStage).toBe(false);
  });

  it("drops a block that appears on a stage after it closed, in all three reads", async () => {
    const { stageId, occurrenceIds } = await closedStage();
    const target = occurrenceIds[0]!;

    // The head version is read from the acceptance's own receipt rather than
    // assumed to be 1: the decision head is per (occurrence, approver role) and
    // a literal here would be this fixture's arithmetic written down twice.
    const head = await q<{ version: string }>(
      `select version::text from public.requirement_evidence_decision_heads
        where workspace_id = $1 and requirement_occurrence_id = $2`,
      [fx.workspaceId, target]);
    expect(head).toHaveLength(1);

    const returned = await returnDecision(target, Number(head[0]!.version));
    expect(returned.status, await returned.clone().text()).toBe(201);

    // The occurrence IS now unsatisfied — the precondition of the whole case, and
    // asserted so this test cannot quietly become a comparison of two empty
    // lists if a later slice refuses decisions on closed stages.
    const view = (await readiness()).stages.find((s: any) => s.workStageId === stageId);
    const occurrence = view.occurrences.find((o: any) => o.occurrenceId === target);
    expect(occurrence.satisfied).toBe(false);
    expect(view.satisfiedOccurrenceCount).toBe(1);

    // AND ALL THREE READS SAY THE SAME THING ABOUT IT: the stage is closed, so
    // the block is not live. `readiness.get` used to be the one that disagreed.
    expect(view.blockedReasons).toEqual([]);
    expect(view.canCloseStage).toBe(false);
    const blocked = await blockedReasonsGet();
    expect(blocked.blockedReasons
      .filter((r: any) => r.workStageId === stageId)).toEqual([]);
    expect(blocked.blockedReasons
      .filter((r: any) => r.requirementOccurrenceId === target)).toEqual([]);
  });

  it("still reports an OPEN stage's blocks, so the gate above is a status rule and not a mute",
    async () => {
      // The counterfactual, in the same fixture and the same read. Without it
      // «blockedReasons is empty» would pass over a route that had stopped
      // producing blocked reasons at all.
      const assignmentId = await assign(fx.electricLineId);
      const openStage = await stageIdOf(assignmentId, STAGE_OPEN);

      const view = (await readiness()).stages.find((s: any) => s.workStageId === openStage);

      expect(view.status).toBe("open");
      expect(view.canCloseStage).toBe(false);
      expect(view.blockedReasons.length).toBeGreaterThan(0);
      const blocked = await blockedReasonsGet();
      expect(blocked.blockedReasons.filter((r: any) => r.workStageId === openStage).length)
        .toBeGreaterThan(0);
    });
});
