import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { q, truncateAll, jsonReq, baselineFixture, type BaselineFixture } from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion,
  publishVersion, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";
import { withTenantTx } from "@goproceed/database";
import {
  BOUND_RULE_VERSIONS_SQL, boundRuleVersion, planForWorkType,
  type MaterialisationPlan,
} from "../src/lib/requirement-materialisation";
import { materialiseOccurrences } from "../src/lib/occurrence-writer";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. It was written with no node_modules,
 * no database and no docker available: `vitest`, `tsc`, `psql` and `supabase`
 * were never run against it, no route was invoked, no migration was applied, and
 * no claim is made that any assertion below passes. Static reading is the only
 * check that was available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M2: EXACTLY the occurrences the contract-version bindings imply.
 *
 * This suite is the «exactly» half, and it is separate from
 * requirement-occurrences.int.test.ts because it needs a baseline the other
 * fixture deliberately does not build: THREE bound rule versions across TWO work
 * types. With one work type, «materialises exactly what the bindings imply» and
 * «materialises everything bound» are the same sentence and no test can tell
 * them apart.
 *
 * THIS SUITE IS NOW OWED A REWRITE, AND IT IS NOT DONE HERE — say so rather
 * than let a reader assume it still covers what it says. Migration 0050 adds
 * `public.work_items.work_type_key` and `work_items.create` writes it, so
 * matching CAN run through the route. This file's fixture still types no work
 * type on any line, so `assignments.create` still materialises nothing here and
 * `materialiseFor` below still works — the suite is therefore green about an
 * untyped world, which is a real population (every imported line) but no longer
 * the only one. The rewrite it owes is exactly what `materialiseFor`'s own
 * precondition names: type the fixture's lines, delete that harness, and assert
 * the ROUTE's rows against `planMaterialisation`. Until then the end-to-end
 * coverage of a TYPED line lives in `materialisation-end-to-end.int.test.ts`,
 * which reuses this file's technique — an SQL oracle over the bindings — with
 * the work type read from the LINE rather than supplied, so the two vacuous
 * assertions below («reports in the 201 exactly the rule versions it stored»
 * and «returns, for every line, the set creating an assignment on it
 * materialises») are asserted there with something in them.
 *
 * WHAT IT COULD PROVE WHEN IT WAS WRITTEN, AND WHERE IT STOPPED. `public
 * .work_items` carried no `work_type_key` and no operation wrote one, so the
 * rule predicate's first argument had no left-hand side and MATCHING COULD NOT
 * RUN through the route (see `workTypeKeyOf`, glossary.md:109). Two
 * consequences, both deliberate:
 *
 *   * the exactness assertions below SUPPLY the work type — `planForWorkType`
 *     exists for that — and compare the plan against an INDEPENDENT SQL query
 *     over the bindings. That comparison is real today and stays correct on the
 *     day the carrier lands;
 *   * the assertions that go through `assignments.create` are written as the
 *     requirement and are VACUOUS today, because the set on both sides is empty.
 *     Each one says so on its own line. A vacuous assertion that states the
 *     requirement is worth keeping; a vacuous assertion that states today's
 *     arithmetic is not, and none of those is written here.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const CAPS = ["assignments.manage", "evidence.record", "rule_bindings.manage",
              "requirements.assign"] as const;

/** The two work types this baseline knows about. Only the first is bound twice. */
const WT_ELECTRIC = "montazh-elektrotekhnichnykh-ustanovok";
const WT_MASONRY = "muruvannia";

const STAGE_CONCEALED = "prykhovani-roboty";
const STAGE_OPEN = "montazhni-roboty";

// The two lines carry the two work types this suite binds rules for, and they
// carry the ones their descriptions already implied. Since migration 0050 the
// work type is the LEFT-HAND SIDE of the materialisation predicate, so a line
// without one intersects no binding: the baseline publishes 409
// RULE_BINDING_REQUIRED and every case here dies in its fixture. Giving both
// lines WT_ELECTRIC would publish, and would quietly destroy the case that
// matters most in this file — «the masonry rule is bound to this very baseline
// and must not appear» has nothing to say when nothing is masonry.
const LINES = [
  { sourceKey: "1.1", workTypeKey: WT_ELECTRIC,
    description: "Приклад-прокладання кабелю в штробі",
    unitCode: "м", contractQuantity: "10", unitPriceState: "known" as const,
    unitPrice: "100.00" },
  { sourceKey: "1.2", workTypeKey: WT_MASONRY,
    description: "Приклад-мурування перегородки",
    unitCode: "м2", contractQuantity: "20", unitPriceState: "known" as const,
    unitPrice: "250.00" },
];

const PAYLOAD = new TextEncoder().encode("Приклад-фото");
const HASH = createHash("sha256").update(PAYLOAD).digest("hex");
const MB = 1024 * 1024;

interface Fx extends BaselineFixture {
  contractVersionId: string;
  workItemIds: string[];
  /** WT_ELECTRIC, concealed stage, before_concealment, image/jpeg only, 5 MB. */
  electricConcealedRuleId: string;
  /** WT_ELECTRIC, open stage, before_work. */
  electricOpenRuleId: string;
  /** WT_MASONRY — bound to the same baseline and matching no electric line. */
  masonryRuleId: string;
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
    throw new Error(`publishRuleVersion ${res.status} ${await res.text()}`);
  }
  return (await res.json()).ruleVersionId as string;
}

/**
 * A published baseline with two lines and three bound rule versions.
 *
 * All three are bound BEFORE publication, because
 * `app.guard_rule_binding_window()` refuses a binding on a published version: a
 * rule published after the baseline never enters it (INV-080).
 */
async function twoWorkTypeBaseline(): Promise<Fx> {
  const base = await baselineFixture(A);
  await grant(base.projectId, base.memberId);
  const library = await seedRequirementLibrary(base.workspaceId);

  const electricConcealedRuleId = await publishRule(base.workspaceId, library.get("Н.15/1")!, {
    workTypeKey: WT_ELECTRIC, stageKey: STAGE_CONCEALED, timing: "before_concealment",
    allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 5 * MB },
  });
  const electricOpenRuleId = await publishRule(base.workspaceId, library.get("Н.15/2")!, {
    workTypeKey: WT_ELECTRIC, stageKey: STAGE_OPEN, timing: "before_work",
    allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 5 * MB },
  });
  const masonryRuleId = await publishRule(base.workspaceId, library.get("Н.15/3")!, {
    workTypeKey: WT_MASONRY, stageKey: STAGE_CONCEALED, timing: "before_concealment",
    allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 5 * MB },
  });

  const draft = await createDraft(base.contractId);
  const contractVersionId = (await draft.json()).contractVersionId as string;
  const workItemIds: string[] = [];
  for (const line of LINES) {
    const res = await addLine(contractVersionId, line);
    if (res.status !== 201) throw new Error(`addLine ${res.status} ${await res.text()}`);
    workItemIds.push((await res.json()).workItem.workItemId as string);
  }

  const bind = await bindRules(contractVersionId,
    [electricConcealedRuleId, electricOpenRuleId, masonryRuleId]);
  if (bind.status !== 201) throw new Error(`bindRules ${bind.status} ${await bind.text()}`);

  const view = await (await getVersion(base.contractId, 1)).json();
  const pub = await publishVersion(contractVersionId, manifestOf(view));
  if (pub.status !== 201) throw new Error(`publishVersion ${pub.status} ${await pub.text()}`);

  return { ...base, contractVersionId, workItemIds,
           electricConcealedRuleId, electricOpenRuleId, masonryRuleId };
}

async function createAssignment(workItemId: string): Promise<{ status: number; body: any }> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x", { workItemId }),
    { params: Promise.resolve({ contractId: fx.contractId }) });
  return { status: res.status, body: await res.json() };
}

async function dryRun(): Promise<{ status: number; body: any }> {
  const { POST } = await import(
    "../app/v1/projects/[projectId]/contract-versions/[versionId]/requirement-occurrences/dry-run/route");
  const res = await POST(jsonReq("http://x", {}),
    { params: Promise.resolve({ projectId: fx.projectId, versionId: fx.contractVersionId }) });
  return { status: res.status, body: await res.json() };
}

/** The bound set as the product reads it, mapped the way both routes map it. */
async function boundRules() {
  return withTenantTx({ actorUserId: A, organizationId: null, requestId: crypto.randomUUID() },
    async (tx) => (await tx.query(BOUND_RULE_VERSIONS_SQL,
      [fx.workspaceId, fx.contractVersionId])).rows.map(boundRuleVersion));
}

/**
 * The plan `assignments.create` materialised from, computed WITHOUT writing.
 *
 * The harness that stood here wrote the occurrences itself and returned the
 * plan it used, because no work line could carry a work type. It named its own
 * deletion: on the day the route materialises, writing again would collide on
 * `requirement_occurrences_materialisation_uniq`, and what the suite should do
 * instead is assert the ROUTE's rows against the plan. The lines carry their
 * work types now, so that is what this does — it plans, and the caller compares
 * the plan with what the route actually stored.
 */
async function planFor(workTypeKey: string): Promise<MaterialisationPlan> {
  return withTenantTx({ actorUserId: A, organizationId: null, requestId: crypto.randomUUID() },
    async (tx) => {
      const bound = (await tx.query(BOUND_RULE_VERSIONS_SQL,
        [fx.workspaceId, fx.contractVersionId])).rows.map(boundRuleVersion);
      return planForWorkType(workTypeKey, bound);
    });
}

/** Row counts for every base table in `public`, in one round trip. */
async function census(): Promise<Record<string, number>> {
  const tables = await q<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name`);
  const rows = await q<{ t: string; n: number }>(
    tables.map((t) =>
      `select '${t.table_name}' as t, count(*)::int as n from public."${t.table_name}"`)
      .join(" union all "));
  return Object.fromEntries(rows.map((r) => [r.t, r.n]));
}

function changedTables(before: Record<string, number>, after: Record<string, number>): string[] {
  return Object.keys(after).filter((t) => after[t] !== before[t]).sort();
}

beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await twoWorkTypeBaseline();
});

describe("the obligation set is exactly what the bindings imply", () => {
  it("plans exactly the bound rule versions whose work type matches, and no others", async () => {
    // THE ORACLE IS SQL, NOT THE SAME FILTER RUN TWICE. The right-hand side is
    // computed by a query over the bindings; the left-hand side is the planner.
    // What that compares is the MATCHING; it shares the join with
    // BOUND_RULE_VERSIONS_SQL and therefore does not independently check the
    // read.
    const expected = await q<{ id: string }>(
      `select rv.id from public.contract_version_rule_bindings b
         join public.requirement_rule_versions rv
           on rv.workspace_id = b.workspace_id and rv.id = b.requirement_rule_version_id
        where b.workspace_id = $1 and b.contract_version_id = $2 and rv.work_type_key = $3
        order by rv.id`,
      [fx.workspaceId, fx.contractVersionId, WT_ELECTRIC]);
    expect(expected.map((r) => r.id).sort())
      .toEqual([fx.electricConcealedRuleId, fx.electricOpenRuleId].sort());

    const plan = planForWorkType(WT_ELECTRIC, await boundRules());
    expect(plan.occurrences.map((o) => o.rule.ruleVersionId).sort())
      .toEqual(expected.map((r) => r.id).sort());
    // The masonry rule is bound to this very baseline and must not appear. That
    // is the whole difference between «what the bindings imply» and «everything
    // the baseline bound».
    expect(plan.occurrences.map((o) => o.rule.ruleVersionId))
      .not.toContain(fx.masonryRuleId);
    expect(plan.coverage).toBe("covered");
  });

  it("writes one row per planned occurrence and not one more", async () => {
    const created = await createAssignment(fx.workItemIds[0]!);
    expect(created.status).toBe(201);
    const plan = await planFor(WT_ELECTRIC);

    const stored = await q<{ rule_version_id: string }>(
      `select rule_version_id from public.requirement_occurrences
        where workspace_id = $1 and work_assignment_id = $2
        order by stage_key, ordinal, rule_version_id`,
      [fx.workspaceId, created.body.assignmentId]);
    expect(stored.map((r) => r.rule_version_id))
      .toEqual(plan.occurrences.map((o) => o.rule.ruleVersionId));
    expect(stored).toHaveLength(2);
  });

  it("pins each occurrence to a rule version THIS baseline bound", async () => {
    // The structural claim of migration 0043 leg (b), asked of the stored rows
    // rather than of the command: an occurrence whose (contract version, rule
    // version) pair is not a binding must not exist. The anti-join is over the
    // whole workspace, because an occurrence that escaped through some other
    // command would still be an occurrence pinning nothing agreed.
    const created = await createAssignment(fx.workItemIds[0]!);
    await planFor(WT_ELECTRIC);

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

  it("copies every pinned field of EVERY occurrence, not merely of one", async () => {
    // Migration 0043 §4 names this test as the only guarantee behind nine
    // columns no key can check. requirement-occurrences.int.test.ts asserts it
    // for a single row; this asserts it for the whole materialised set, because
    // a writer that paired columns correctly for the first occurrence and
    // shifted them for the second would pass the narrower test.
    const created = await createAssignment(fx.workItemIds[0]!);
    await planFor(WT_ELECTRIC);

    const mismatches = await q<{ mismatch: string }>(
      `select unnest(array_remove(array[
                case when o.intervention_type    is distinct from rv.intervention_type    then 'intervention_type' end,
                case when o.blocking_scope       is distinct from rv.blocking_scope       then 'blocking_scope' end,
                case when o.timing               is distinct from rv.timing               then 'timing' end,
                case when o.stage_key            is distinct from rv.stage_key            then 'stage_key' end,
                case when o.ordinal              is distinct from rv.ordinal              then 'ordinal' end,
                case when o.evidence_kind        is distinct from rv.evidence_kind        then 'evidence_kind' end,
                case when o.acceptance_criterion is distinct from rv.acceptance_criterion then 'acceptance_criterion' end,
                case when o.performer_role       is distinct from rv.performer_role       then 'performer_role' end,
                case when o.approver_role        is distinct from rv.approver_role        then 'approver_role' end,
                case when o.approver_is_external is distinct from rv.approver_is_external then 'approver_is_external' end,
                case when o.min_evidence_count   is distinct from rv.min_evidence_count   then 'min_evidence_count' end,
                case when o.max_evidence_count   is distinct from rv.max_evidence_count   then 'max_evidence_count' end,
                case when o.norm_ref             is distinct from rv.norm_ref             then 'norm_ref' end,
                case when o.norm_ref_verification is distinct from rv.norm_ref_verification then 'norm_ref_verification' end,
                case when o.norm_ref_source      is distinct from rv.norm_ref_source      then 'norm_ref_source' end
              ], null)) as mismatch
         from public.requirement_occurrences o
         join public.requirement_rule_versions rv
           on rv.workspace_id = o.workspace_id and rv.id = o.rule_version_id
        where o.workspace_id = $1`,
      [fx.workspaceId]);
    expect(mismatches.map((r) => r.mismatch)).toEqual([]);
  });

  it("opens one stage per distinct stage key, concealed only where the timing demands it",
    async () => {
      // `work_stages_closable_unit_uniq` makes (assignment, location, stage key)
      // ONE closable unit, so two rules on one stage key must not produce two
      // stages. The concealment is derived — nothing records it and no v0.1
      // command asks anyone — and the derivation is that any rule timed
      // before_concealment conceals its stage.
      const created = await createAssignment(fx.workItemIds[0]!);
      await planFor(WT_ELECTRIC);

      const stages = await q<{ stage_key: string; is_concealed: boolean }>(
        `select stage_key, is_concealed from public.work_stages
          where workspace_id = $1 and work_assignment_id = $2 order by stage_key`,
        [fx.workspaceId, created.body.assignmentId]);
      // Ordered by stage_key: "montazhni-roboty" sorts before "prykhovani-roboty".
      expect(stages).toEqual([
        { stage_key: STAGE_OPEN, is_concealed: false },
        { stage_key: STAGE_CONCEALED, is_concealed: true },
      ]);
    });

  it("attaches every occurrence to a stage of its OWN assignment", async () => {
    const created = await createAssignment(fx.workItemIds[0]!);
    await planFor(WT_ELECTRIC);
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

  it("reports in the 201 exactly the rule versions it stored", async () => {
    // REQUIRED, AND VACUOUS IN THIS FIXTURE: both sides are empty, because this
    // fixture's lines are untyped and so match nothing. It is written as the
    // requirement rather than as the fixture's arithmetic, which is why it went
    // on holding unchanged when migration 0050 landed the carrier — and why it
    // will keep holding when this suite's owed rewrite types the lines.
    const created = await createAssignment(fx.workItemIds[0]!);
    const stored = await q<{ rule_version_id: string }>(
      `select rule_version_id from public.requirement_occurrences
        where workspace_id = $1 and work_assignment_id = $2
        order by stage_key, ordinal, rule_version_id`,
      [fx.workspaceId, created.body.assignmentId]);
    expect(created.body.requirementOccurrences.ruleVersionIds)
      .toEqual(stored.map((r) => r.rule_version_id));
    expect(created.body.requirementOccurrences.occurrenceCount).toBe(stored.length);
  });

  it("cannot pin a rule version bound to a DIFFERENT baseline of the same contract", async () => {
    // The obligation set follows the BASELINE and not the contract: superseding
    // a version must not change what an assignment under the old one owes, and
    // an assignment under the new one must not inherit obligations nobody bound
    // to it. A second published baseline binding ONLY the masonry rule is the
    // sharpest form of that — the electric rules are still published, still in
    // this workspace and still bound to a baseline of this very contract.
    const draft = await createDraft(fx.contractId);
    const secondVersionId = (await draft.json()).contractVersionId as string;
    const line = await addLine(secondVersionId, LINES[1]!);
    const secondWorkItemId = (await line.json()).workItem.workItemId as string;
    const bind = await bindRules(secondVersionId, [fx.masonryRuleId]);
    expect(bind.status).toBe(201);
    const view = await (await getVersion(fx.contractId, 2)).json();
    const pub = await publishVersion(secondVersionId, manifestOf(view));
    expect(pub.status).toBe(201);

    // The route takes the CURRENT published version, so this assignment
    // executes the second baseline.
    const created = await createAssignment(secondWorkItemId);
    expect(created.status).toBe(201);

    // Masonry is what THIS baseline bound, and it materialises.
    const plan = await planFor(WT_MASONRY);
    expect(plan.occurrences.map((o) => o.rule.ruleVersionId)).toEqual([fx.masonryRuleId]);

    // The electric rule is bound to baseline 1 and not to this one. Writing it
    // here is refused by requirement_occurrences_from_binding_fkey — by the
    // DATABASE, so it stays refused for a command that has not been written yet.
    const second = await createAssignment(secondWorkItemId);
    await expect(withTenantTx(
      { actorUserId: A, organizationId: null, requestId: crypto.randomUUID() },
      async (tx) => {
        const boundToFirst = (await tx.query(BOUND_RULE_VERSIONS_SQL,
          [fx.workspaceId, fx.contractVersionId])).rows.map(boundRuleVersion);
        return materialiseOccurrences(tx, {
          workspaceId: fx.workspaceId, projectId: fx.projectId, contractId: fx.contractId,
          contractVersionId: secondVersionId,
          assignmentId: second.body.assignmentId, memberId: fx.memberId,
        }, planForWorkType(WT_ELECTRIC, boundToFirst));
      })).rejects.toThrow();

    const leaked = await q<{ n: number }>(
      `select count(*)::int as n from public.requirement_occurrences
        where workspace_id = $1 and contract_version_id = $2
          and rule_version_id in ($3, $4)`,
      [fx.workspaceId, secondVersionId, fx.electricConcealedRuleId, fx.electricOpenRuleId]);
    expect(leaked[0]!.n).toBe(0);
  });
});

describe("requirement_occurrences.dry_run writes nothing", () => {
  it("changes the row count of exactly two tables: its audit row and its idempotency record",
    async () => {
      // Asserted over EVERY base table in the schema rather than over the two
      // the operation is about. «The dry run stores no occurrence» is the claim
      // its name makes; «the dry run stores nothing else either» is the claim
      // nobody would notice being broken.
      const before = await census();
      const run = await dryRun();
      expect(run.status).toBe(200);
      const after = await census();
      expect(changedTables(before, after)).toEqual(["audit_events", "idempotency_records"]);
    });

  it("writes nothing at all when it refuses a draft baseline", async () => {
    const draft = await createDraft(fx.contractId);
    const draftId = (await draft.json()).contractVersionId as string;
    const before = await census();
    const { POST } = await import(
      "../app/v1/projects/[projectId]/contract-versions/[versionId]/requirement-occurrences/dry-run/route");
    const res = await POST(jsonReq("http://x", {}),
      { params: Promise.resolve({ projectId: fx.projectId, versionId: draftId }) });
    expect(res.status).toBe(422);
    // The refusal is inside the idempotency callback and the record is written
    // after the callback returns, so a refused run leaves no claim behind and
    // the same key may be retried once the baseline is published.
    expect(changedTables(before, await census())).toEqual([]);
  });

  it("replays under the same key without running a second time", async () => {
    const { POST } = await import(
      "../app/v1/projects/[projectId]/contract-versions/[versionId]/requirement-occurrences/dry-run/route");
    const key = crypto.randomUUID();
    const send = () => POST(new Request("http://x", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify({}),
    }), { params: Promise.resolve({ projectId: fx.projectId, versionId: fx.contractVersionId }) });

    const first = await send();
    const second = await send();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    const audit = await q<{ n: number }>(
      `select count(*)::int as n from public.audit_events
        where organization_id = $1 and action = 'requirement_occurrences.dry_run'`,
      [fx.workspaceId]);
    expect(audit[0]!.n).toBe(1);
  });

  it("reports the bound set exactly, with a match count for each of its rules", async () => {
    const run = await dryRun();
    const bound = await q<{ id: string }>(
      `select requirement_rule_version_id as id from public.contract_version_rule_bindings
        where workspace_id = $1 and contract_version_id = $2 order by id`,
      [fx.workspaceId, fx.contractVersionId]);
    expect(run.body.boundRules.map((r: any) => r.ruleVersionId).sort())
      .toEqual(bound.map((r) => r.id).sort());
    expect(run.body.summary.boundRuleCount).toBe(3);
    // Per-rule and per-line counts come from the same plan, so «this rule
    // matches nothing» and «this line matches nothing» can never disagree.
    for (const rule of run.body.boundRules) {
      const linesNaming = run.body.workLines
        .filter((l: any) => l.ruleVersionIds.includes(rule.ruleVersionId)).length;
      expect(rule.matchedWorkLineCount).toBe(linesNaming);
    }
  });

  it("returns, for every line, the set creating an assignment on it materialises", async () => {
    // REQUIRED, AND VACUOUS TODAY on both sides. A preview that disagrees with
    // the command is not a preview; the two call one planner, and this is the
    // assertion that keeps it that way when someone gives one of them a second
    // opinion. Read from the DATABASE and not from the 201 body, so a route that
    // agreed with itself while writing something else would still fail.
    const run = await dryRun();
    expect(run.body.workLines).toHaveLength(LINES.length);
    let materialised = 0;
    for (const line of run.body.workLines) {
      const created = await createAssignment(line.workItemId);
      expect(created.status).toBe(201);
      const stored = await q<{ rule_version_id: string }>(
        `select rule_version_id from public.requirement_occurrences
          where workspace_id = $1 and work_assignment_id = $2 order by rule_version_id`,
        [fx.workspaceId, created.body.assignmentId]);
      expect(stored.map((r) => r.rule_version_id).sort())
        .toEqual([...line.ruleVersionIds].sort());
      materialised += stored.length;
    }
    expect(run.body.summary.wouldMaterialiseCount).toBe(materialised);
  });

  it("names every uncovered line and gives a diagnosis that cannot be read as «all fine»",
    async () => {
      // INV-072: the uncovered list is part of the command's own output, not a
      // report someone may choose to run.
      const run = await dryRun();
      const uncovered = run.body.workLines.filter((l: any) => l.coverage !== "covered");
      expect(run.body.uncoveredLines.map((l: any) => l.workItemId))
        .toEqual(uncovered.map((l: any) => l.workItemId));
      expect(run.body.summary.uncoveredLineCount).toBe(uncovered.length);
      if (run.body.summary.wouldMaterialiseCount === 0) {
        expect(run.body.summary.diagnosis).not.toBe("covered");
      }
      // The bindings exist, so «no_bindings» would send the finding to the wrong
      // owner: it is M1 review finding 1 and it is a different defect.
      expect(run.body.summary.diagnosis).not.toBe("no_bindings");
    });
});

describe("the v0.1 hold, and the command that refuses every other shape", () => {
  it("refuses a hold whose blocking scope is not blocks_stage_closure", async () => {
    // INV-082 / ADR-006 decision 4.4, at the ROUTE. m1-baseline-and-rules.test.ts
    // asserts the request schema refuses it; this asserts the deployed command
    // does, which is what makes «every v0.1 occurrence carries
    // blocks_stage_closure» true of the record rather than of a zod object.
    const library = await seedRequirementLibrary(fx.workspaceId);
    const res = await publishRuleVersion(fx.workspaceId,
      ruleVersionBody(library.get("Н.15/4")!, { blockingScope: "blocks_both" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(JSON.stringify(body.fieldErrors ?? body)).toContain("blockingScope");
  });

  it("refuses an intervention type other than hold", async () => {
    const library = await seedRequirementLibrary(fx.workspaceId);
    const res = await publishRuleVersion(fx.workspaceId,
      ruleVersionBody(library.get("Н.15/5")!, { interventionType: "witness" }));
    expect(res.status).toBe(422);
  });

  it("leaves every stored occurrence carrying hold and blocks_stage_closure", async () => {
    // The consequence, asserted over the record. It holds because publication is
    // the only door: the CHECK on the table admits all three types and all four
    // scopes on purpose (contradiction 6), so this assertion is about the
    // command's refusal and not about the column's vocabulary.
    const created = await createAssignment(fx.workItemIds[0]!);
    await planFor(WT_ELECTRIC);
    const shapes = await q<{ intervention_type: string; blocking_scope: string }>(
      `select distinct intervention_type, blocking_scope
         from public.requirement_occurrences where workspace_id = $1`,
      [fx.workspaceId]);
    expect(shapes).toEqual([
      { intervention_type: "hold", blocking_scope: "blocks_stage_closure" },
    ]);
  });
});

describe("the upload gate reads the occurrence and never widens when it has one", () => {
  const VALID = {
    expectedContentHash: HASH,
    expectedByteSize: PAYLOAD.byteLength,
    claimedMediaType: "image/jpeg",
    deviceCaptureId: "device-capture-1",
    originMethod: "photo_picker" as const,
  };

  async function intent(assignmentId: string, body: Record<string, unknown>): Promise<Response> {
    const { POST } = await import("../app/v1/assignments/[assignmentId]/upload-intents/route");
    return POST(new Request("http://x", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ assignmentId }) });
  }

  /** The occurrence of the concealed, jpeg-only, 5 MB rule. */
  async function occurrenceOf(assignmentId: string): Promise<string> {
    const rows = await q<{ id: string }>(
      `select id from public.requirement_occurrences
        where workspace_id = $1 and work_assignment_id = $2 and rule_version_id = $3`,
      [fx.workspaceId, assignmentId, fx.electricConcealedRuleId]);
    if (rows.length !== 1) {
      throw new Error(`expected one occurrence of the concealed rule, found ${rows.length}`);
    }
    return rows[0]!.id;
  }

  it("takes the SIZE limit from the occurrence, not only the media type", async () => {
    // The rule version allows 5 MB; FALLBACK_MEDIA allows 50. A gate that read
    // only the MIME list from the occurrence and kept the fallback's ceiling
    // would pass every media-type test ever written and still accept ten times
    // what the requirement permits.
    const created = await createAssignment(fx.workItemIds[0]!);
    await planFor(WT_ELECTRIC);
    const occurrenceId = await occurrenceOf(created.body.assignmentId);

    const tooBig = await intent(created.body.assignmentId, {
      ...VALID, expectedByteSize: 10 * MB, requirementOccurrenceId: occurrenceId });
    expect(tooBig.status).toBe(422);
    // The same size with no occurrence named is admitted by the fallback, which
    // is what makes the refusal above the occurrence's doing and not the
    // request's.
    const fallback = await intent(created.body.assignmentId,
      { ...VALID, expectedByteSize: 10 * MB });
    expect(fallback.status).toBe(201);
  });

  it("lets the occurrence override a retired template pin that would allow more", async () => {
    // Contradiction 3's ordering, asserted rather than described: the occurrence
    // is source 1 and the pinned template is source 2. If the order were the
    // other way round, an assignment that still carries a template would keep
    // being gated by a retired model even after its obligation set exists.
    const { POST: createT } = await import(
      "../app/v1/workspaces/[workspaceId]/requirement-templates/route");
    const t = await createT(jsonReq("http://x", {
      templateKey: "pryklad-shablon-shyrshyi", evidenceType: "photo",
      allowedMedia: { mimeTypes: ["image/png"], maxByteSize: 20 * MB },
    }), { params: Promise.resolve({ workspaceId: fx.workspaceId }) });
    const templateVersionId = (await t.json()).templateVersionId as string;
    const { POST: publishT } = await import(
      "../app/v1/requirement-templates/[templateVersionId]/publish/route");
    await publishT(jsonReq("http://x", {}),
      { params: Promise.resolve({ templateVersionId }) });

    const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
    const res = await POST(jsonReq("http://x",
      { workItemId: fx.workItemIds[0], requirementTemplateVersionId: templateVersionId }),
      { params: Promise.resolve({ contractId: fx.contractId }) });
    const created = await res.json();
    expect(created.requirementOccurrences.usedRetiredTemplatePin).toBe(true);
    await planFor(WT_ELECTRIC);
    const occurrenceId = await occurrenceOf(created.assignmentId);

    // image/png is what the TEMPLATE allows and what the occurrence does not.
    const png = await intent(created.assignmentId,
      { ...VALID, claimedMediaType: "image/png", requirementOccurrenceId: occurrenceId });
    expect(png.status).toBe(422);
    const jpeg = await intent(created.assignmentId,
      { ...VALID, requirementOccurrenceId: occurrenceId });
    expect(jpeg.status).toBe(201);
  });

  it("never records the fallback as the policy of an intent that named an occurrence",
    async () => {
      // The cross-cutting form of «no silent widening»: whatever else changes
      // about this route, an intent that named an obligation was never gated by
      // 50 MB of anything. Asserted over the audit rows, because that is where
      // «the gate was the fallback» is provable after the fact.
      const created = await createAssignment(fx.workItemIds[0]!);
      await planFor(WT_ELECTRIC);
      const occurrenceId = await occurrenceOf(created.body.assignmentId);
      await intent(created.body.assignmentId, { ...VALID, requirementOccurrenceId: occurrenceId });
      await intent(created.body.assignmentId, VALID);

      const audit = await q<{ details: any }>(
        // `occurred_at`, not `created_at`: public.audit_events has never had a
        // created_at column, so this query raised rather than ordering anything.
        `select details from public.audit_events
          where organization_id = $1 and action = 'upload_intent.authorized'
          order by occurred_at`, [fx.workspaceId]);
      expect(audit.length).toBeGreaterThanOrEqual(2);
      for (const row of audit) {
        if (row.details.requirementOccurrenceId) {
          expect(row.details.mediaPolicySource).toBe("requirement_occurrence");
        }
      }
    });

  it("binds the stored intent to the obligation it was captured against", async () => {
    const created = await createAssignment(fx.workItemIds[0]!);
    await planFor(WT_ELECTRIC);
    const occurrenceId = await occurrenceOf(created.body.assignmentId);
    const res = await intent(created.body.assignmentId,
      { ...VALID, requirementOccurrenceId: occurrenceId });
    expect(res.status).toBe(201);
    const stored = await q<{ requirement_occurrence_id: string | null }>(
      `select requirement_occurrence_id from public.upload_intents
        where workspace_id = $1 and work_assignment_id = $2`,
      [fx.workspaceId, created.body.assignmentId]);
    expect(stored[0]!.requirement_occurrence_id).toBe(occurrenceId);
  });
});
