import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { q, truncateAll, jsonReq, baselineFixture, type BaselineFixture } from "./helpers/fixtures";
import {
  addLine, bindRules, createDraft, getVersion, manifestOf, publishRuleVersion,
  publishVersion, ruleVersionBody, seedRequirementLibrary,
} from "./helpers/manual-baseline";
import { withTenantTx } from "@goproceed/database";
import {
  BOUND_RULE_VERSIONS_SQL, boundRuleVersion,
} from "../src/lib/requirement-materialisation";
import { materialiseOccurrences } from "../src/lib/occurrence-writer";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. It was written with no node_modules,
 * no database and no docker available: `vitest`, `tsc`, `psql` and `supabase`
 * were never run against it, no route was invoked, no migration was applied,
 * and no claim is made that any assertion below passes. Static reading is the
 * only check that was available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M2: the obligation the phone shows before the covering.
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE TODAY, stated before the first test so a
 * reader is not misled by what is green.
 *
 * WHAT WAS TRUE WHEN THIS FILE WAS WRITTEN, AND WHAT CHANGED ON 2026-08-08.
 * The rule predicate is (work type, stage). Until migration 0050
 * `public.work_items` carried no `work_type_key` and no operation wrote one, so
 * the predicate's first argument had no left-hand side and MATCHING COULD NOT
 * RUN — for any line, anywhere in the product. 0050 adds the column,
 * `work_items.create`/`.update` write it and `workTypeKeyOf` reads it, so
 * matching now runs. The sentence that is still true is much smaller and it is
 * about THIS FIXTURE, not about the product: `LINE` below supplies no
 * `workTypeKey`, so these lines are untyped, they match nothing, and
 * `assignments.create` still materialises nothing HERE.
 *
 * That is a real and permanent population — every line the frozen importer
 * wrote carries NULL and a published version is immutable — so the fixture is
 * not stale. What is owed, and is not done here, is a sibling fixture whose line
 * IS typed, so that the copy assertions below run over rows the ROUTE chose.
 * End-to-end coverage of a typed line lives in
 * `materialisation-end-to-end.int.test.ts` until then — which drives only
 * routes, compares the stored occurrences against an SQL oracle over the
 * bindings, and closes a stage that actually refuses.
 *
 * Consequently, and unchanged by 0050:
 *
 *   * the tests below do NOT assert that «materialisation produces nothing».
 *     That was today's arithmetic, not a requirement, and pinning it would have
 *     made the test defend the gap. What they assert is the requirement that
 *     holds in every state of the world: WHATEVER materialisation produces, the
 *     command, the audit, the outbox and the read all say the same thing about
 *     it, and an empty obligation set is never silent (INV-072). That is why
 *     nothing here had to change when the carrier landed;
 *   * the field-by-field copy test that migration 0043 §4 calls «REQUIRED, not
 *     optional, because it is the only thing standing behind» the nine
 *     unverifiable copied columns is written against
 *     `materialiseOccurrences` DIRECTLY, with a plan supplied by the test. It
 *     therefore covers the INSERT — the column pairing a wrong copy would come
 *     from — and does NOT cover the matching that chooses which rule to copy.
 *     That half is now REACHABLE (it needs only a typed line) and is still owed;
 *     its blocker was the missing carrier and is now this fixture's own choice.
 */

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const CAPS = ["assignments.manage", "evidence.record", "rule_bindings.manage",
              "requirements.assign"] as const;

const LINE = {
  sourceKey: "1.1",
  // The work type is not decoration and not optional. Since migration 0050 it is
  // the LEFT-HAND SIDE of the materialisation predicate — the line's work type
  // against the bound rule version's — and `ruleVersionBody` binds
  // `montazh-elektrotekhnichnykh-ustanovok`. A line without one intersects
  // nothing, so the baseline publishes 409 RULE_BINDING_REQUIRED and every case
  // below dies in its fixture rather than at its assertion.
  workTypeKey: "montazh-elektrotekhnichnykh-ustanovok",
  description: "Приклад-улаштування прокладки кабелю",
  unitCode: "м",
  contractQuantity: "10",
  unitPriceState: "known" as const,
  unitPrice: "100.00",
};

const PAYLOAD = new TextEncoder().encode("Приклад-фото");
const HASH = createHash("sha256").update(PAYLOAD).digest("hex");

interface Fx extends BaselineFixture {
  contractVersionId: string;
  workItemId: string;
  /** `photo`, allowing image/jpeg only. */
  photoRuleVersionId: string;
  /** `checkbox`, whose rule version defines no media policy at all. */
  checkboxRuleVersionId: string;
  stageKey: string;
}

async function grant(projectId: string, memberId: string): Promise<void> {
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  const res = await POST(jsonReq("http://x", { memberId, capabilities: [...CAPS] }),
    { params: Promise.resolve({ projectId }) });
  if (res.status >= 300) throw new Error(`grant ${res.status} ${await res.text()}`);
}

/**
 * A hand-typed baseline with one line and TWO bound rule versions, published.
 *
 * Both are bound BEFORE publication and that is not incidental:
 * `app.guard_rule_binding_window()` (migration 0042 §5) refuses a binding on a
 * published version, because a rule published after the baseline never enters it
 * (INV-080). A test that bound afterwards would fail at the trigger, and a test
 * that then materialised from an unbound version would fail at
 * `requirement_occurrences_from_binding_fkey`.
 */
async function boundBaseline(): Promise<Fx> {
  const fx = await baselineFixture(A);
  await grant(fx.projectId, fx.memberId);
  const library = await seedRequirementLibrary(fx.workspaceId);

  const photo = await publishRuleVersion(fx.workspaceId,
    ruleVersionBody(library.get("Н.15/1")!));
  if (photo.status !== 201) throw new Error(`publishRuleVersion ${photo.status} ${await photo.text()}`);
  const photoRuleVersionId = (await photo.json()).ruleVersionId as string;

  // `checkbox` takes no uploaded original, so allowedMedia is REFUSED by the
  // request schema and the column keeps its '[]' default. This is the rule
  // version the upload gate must refuse rather than fall back for.
  const checkbox = await publishRuleVersion(fx.workspaceId,
    ruleVersionBody(library.get("Н.15/2")!,
      { evidenceKind: "checkbox", allowedMedia: undefined }));
  if (checkbox.status !== 201) {
    throw new Error(`publishRuleVersion ${checkbox.status} ${await checkbox.text()}`);
  }
  const checkboxRuleVersionId = (await checkbox.json()).ruleVersionId as string;

  const draft = await createDraft(fx.contractId);
  const contractVersionId = (await draft.json()).contractVersionId as string;
  const line = await addLine(contractVersionId, LINE);
  const workItemId = (await line.json()).workItem.workItemId as string;

  const bind = await bindRules(contractVersionId, [photoRuleVersionId, checkboxRuleVersionId]);
  if (bind.status !== 201) throw new Error(`bindRules ${bind.status} ${await bind.text()}`);

  const view = await (await getVersion(fx.contractId, 1)).json();
  const pub = await publishVersion(contractVersionId, manifestOf(view));
  if (pub.status !== 201) throw new Error(`publishVersion ${pub.status} ${await pub.text()}`);

  return { ...fx, contractVersionId, workItemId, photoRuleVersionId, checkboxRuleVersionId,
           stageKey: "prykhovani-roboty" };
}

/**
 * Materialises ONE named rule version onto an assignment, with the plan supplied
 * by the test.
 *
 * Not `planMaterialisation`: this fixture's lines are untyped (see the header),
 * so a helper that used it would match nothing, materialise nothing, and every
 * assertion downstream of it would pass vacuously — the exact failure mode
 * INV-072 is about, reproduced in a test file. What this exercises is the
 * WRITER: the INSERT, its column pairing, the RLS insert policy and every
 * foreign key of migration 0043 §4.
 */
async function materialiseOne(assignmentId: string, ruleVersionId: string): Promise<string> {
  const written = await withTenantTx(
    { actorUserId: A, organizationId: null, requestId: crypto.randomUUID() },
    async (tx) => {
      const bound = (await tx.query(BOUND_RULE_VERSIONS_SQL,
        [fx.workspaceId, fx.contractVersionId])).rows.map(boundRuleVersion);
      const rule = bound.find((r) => r.ruleVersionId === ruleVersionId);
      if (!rule) throw new Error(`rule version ${ruleVersionId} is not bound to the baseline`);
      return materialiseOccurrences(tx, {
        workspaceId: fx.workspaceId, projectId: fx.projectId, contractId: fx.contractId,
        contractVersionId: fx.contractVersionId, assignmentId, memberId: fx.memberId,
      }, {
        // Concealed because `ruleVersionBody` times the requirement
        // `before_concealment`, and migration 0043's CHECK makes that timing
        // unstorable on a stage that is not concealed.
        stages: [{ stageKey: rule.stageKey, isConcealed: true }],
        occurrences: [{ stageKey: rule.stageKey, rule }],
        coverage: "covered", workTypeKey: rule.workTypeKey,
      });
    });
  return written.occurrenceIds[0]!;
}

async function createAssignment(fx: Fx): Promise<{ status: number; body: any }> {
  const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
  const res = await POST(jsonReq("http://x", { workItemId: fx.workItemId }),
    { params: Promise.resolve({ contractId: fx.contractId }) });
  return { status: res.status, body: await res.json() };
}

async function listOccurrences(assignmentId: string): Promise<{ status: number; body: any }> {
  const { GET } = await import(
    "../app/v1/assignments/[assignmentId]/requirement-occurrences/route");
  const res = await GET(new Request("http://x"),
    { params: Promise.resolve({ assignmentId }) });
  return { status: res.status, body: await res.json() };
}

async function dryRun(projectId: string, versionId: string): Promise<{ status: number; body: any }> {
  const { POST } = await import(
    "../app/v1/projects/[projectId]/contract-versions/[versionId]/requirement-occurrences/dry-run/route");
  const res = await POST(jsonReq("http://x", {}),
    { params: Promise.resolve({ projectId, versionId }) });
  return { status: res.status, body: await res.json() };
}

let fx: Fx;
beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await boundBaseline();
});

describe("assignments.create — the obligation set is computed in the same transaction", () => {
  it("says the same thing about coverage in the response, the audit and the outbox", async () => {
    // THE REQUIREMENT, WHATEVER MATCHING PRODUCES. An assignment whose
    // obligation set is empty is the silent non-coverage INV-072 is written
    // against, and «silent» is what these three surfaces exist to prevent. The
    // test is deliberately indifferent to the VALUE of `coverage`, so that it
    // keeps holding on the day the work type gains a carrier.
    const created = await createAssignment(fx);
    expect(created.status).toBe(201);
    const verdict = created.body.requirementOccurrences;
    expect(verdict).toBeDefined();
    expect(typeof verdict.coverage).toBe("string");

    const audit = await q<{ details: any }>(
      `select details from public.audit_events
        where organization_id = $1 and action = 'requirement_occurrences.materialized'
          and object_id = $2`,
      [fx.workspaceId, created.body.assignmentId]);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.details.coverage).toBe(verdict.coverage);
    expect(audit[0]!.details.occurrenceCount).toBe(verdict.occurrenceCount);

    const outbox = await q<{ payload: any }>(
      `select payload from public.transaction_outbox
        where organization_id = $1 and topic = 'requirement_occurrence.materialized'
          and aggregate_id = $2`,
      [fx.workspaceId, created.body.assignmentId]);
    // Emitted even when the count is zero: a suppressed event makes
    // non-coverage invisible to every consumer downstream.
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.payload.coverage).toBe(verdict.coverage);
    expect(outbox[0]!.payload.occurrenceIds).toHaveLength(verdict.occurrenceCount);
  });

  it("counts exactly the occurrence rows it says it materialised", async () => {
    const created = await createAssignment(fx);
    const rows = await q<{ n: number }>(
      `select count(*)::int as n from public.requirement_occurrences
        where workspace_id = $1 and work_assignment_id = $2`,
      [fx.workspaceId, created.body.assignmentId]);
    expect(rows[0]!.n).toBe(created.body.requirementOccurrences.occurrenceCount);
    const stages = await q<{ n: number }>(
      `select count(*)::int as n from public.work_stages
        where workspace_id = $1 and work_assignment_id = $2`,
      [fx.workspaceId, created.body.assignmentId]);
    expect(stages[0]!.n).toBe(created.body.requirementOccurrences.stageCount);
  });
});


describe("the materialisation writer copies every pinned field", () => {
  /**
   * MIGRATION 0043 §4 NAMES THIS TEST AS THE ONLY GUARANTEE BEHIND NINE
   * COLUMNS. Four of the occurrence's copies — intervention_type,
   * blocking_scope, timing and stage_key — are pinned to the rule version by
   * composite foreign key and a wrong copy is unstorable. The other nine are
   * copies the schema cannot verify: «a materialisation command that copied the
   * wrong acceptance criterion would store a well-formed row».
   */
  it("stores each column equal to the pinned rule version's own value", async () => {
    const created = await createAssignment(fx);
    const occurrenceId = await materialiseOne(created.body.assignmentId, fx.photoRuleVersionId);

    const compared = await q<{ mismatches: string[] }>(
      `select array_remove(array[
                case when o.intervention_type   is distinct from rv.intervention_type   then 'intervention_type' end,
                case when o.blocking_scope      is distinct from rv.blocking_scope      then 'blocking_scope' end,
                case when o.timing              is distinct from rv.timing              then 'timing' end,
                case when o.stage_key           is distinct from rv.stage_key           then 'stage_key' end,
                case when o.evidence_kind       is distinct from rv.evidence_kind       then 'evidence_kind' end,
                case when o.acceptance_criterion is distinct from rv.acceptance_criterion then 'acceptance_criterion' end,
                case when o.performer_role      is distinct from rv.performer_role      then 'performer_role' end,
                case when o.approver_role       is distinct from rv.approver_role       then 'approver_role' end,
                case when o.approver_is_external is distinct from rv.approver_is_external then 'approver_is_external' end,
                case when o.min_evidence_count  is distinct from rv.min_evidence_count  then 'min_evidence_count' end,
                case when o.max_evidence_count  is distinct from rv.max_evidence_count  then 'max_evidence_count' end,
                case when o.norm_ref            is distinct from rv.norm_ref            then 'norm_ref' end,
                case when o.norm_ref_verification is distinct from rv.norm_ref_verification then 'norm_ref_verification' end,
                case when o.norm_ref_source     is distinct from rv.norm_ref_source     then 'norm_ref_source' end,
                case when o.ordinal             is distinct from rv.ordinal             then 'ordinal' end
              ], null) as mismatches
         from public.requirement_occurrences o
         join public.requirement_rule_versions rv
           on rv.workspace_id = o.workspace_id and rv.id = o.rule_version_id
        where o.workspace_id = $1 and o.id = $2`,
      [fx.workspaceId, occurrenceId]);
    expect(compared[0]!.mismatches).toEqual([]);
  });

  it("carries the citation with BOTH its tag and its source, or not at all", async () => {
    // INV-073 storage half, re-asserted on the copy: the occurrence's own CHECK
    // (requirement_occurrences_norm_ref_sourced_check) makes a bare norm_ref
    // unstorable, and this is the writer proving it never tries.
    const created = await createAssignment(fx);
    const occurrenceId = await materialiseOne(created.body.assignmentId, fx.photoRuleVersionId);
    const row = await q<{ norm_ref: string | null; v: string | null; s: string | null }>(
      `select norm_ref, norm_ref_verification as v, norm_ref_source as s
         from public.requirement_occurrences where workspace_id = $1 and id = $2`,
      [fx.workspaceId, occurrenceId]);
    if (row[0]!.norm_ref !== null) {
      expect(row[0]!.v).not.toBeNull();
      expect((row[0]!.s ?? "").trim().length).toBeGreaterThan(0);
    }
  });

  it("leaves the v0.2 columns at their defaults", async () => {
    // location_id and quantity_scope are v0.2 shape kept so v0.2 is additive
    // (ADR-006 decision 4.2). A v0.1 command that wrote either would make v0.2 a
    // reinterpretation of v0.1 rows rather than an addition to them.
    const created = await createAssignment(fx);
    const occurrenceId = await materialiseOne(created.body.assignmentId, fx.photoRuleVersionId);
    const rows = await q<{ location_id: string | null; quantity_scope: unknown }>(
      `select location_id, quantity_scope from public.requirement_occurrences
        where workspace_id = $1 and id = $2`, [fx.workspaceId, occurrenceId]);
    expect(rows[0]!.location_id).toBeNull();
    expect(rows[0]!.quantity_scope).toEqual({});
  });

  it("cannot materialise the same rule onto the same assignment twice", async () => {
    // requirement_occurrences_materialisation_uniq. A second run must COLLIDE
    // rather than double every requirement the foreman is shown, with no way to
    // tell the copies apart.
    const created = await createAssignment(fx);
    await materialiseOne(created.body.assignmentId, fx.photoRuleVersionId);
    await expect(materialiseOne(created.body.assignmentId, fx.photoRuleVersionId))
      .rejects.toThrow();
  });

  it("refuses an occurrence pinning a rule version this baseline never bound", async () => {
    // requirement_occurrences_from_binding_fkey — «materialised FROM A BINDING»
    // as a shape rather than as a sentence. The rule version below is published
    // and belongs to the workspace; it is simply not in this baseline's set, and
    // the refusal must come from the DATABASE and not from the planner, because
    // the planner is the thing a future slice will rewrite.
    const library = await seedRequirementLibrary(fx.workspaceId);
    const unbound = await publishRuleVersion(fx.workspaceId,
      ruleVersionBody(library.get("Н.14/1")!, { stageKey: "zemliani-roboty" }));
    const view = await unbound.json();
    const created = await createAssignment(fx);

    await expect(withTenantTx(
      { actorUserId: A, organizationId: null, requestId: crypto.randomUUID() },
      async (tx) => materialiseOccurrences(tx, {
        workspaceId: fx.workspaceId, projectId: fx.projectId, contractId: fx.contractId,
        contractVersionId: fx.contractVersionId,
        assignmentId: created.body.assignmentId, memberId: fx.memberId,
      }, {
        stages: [{ stageKey: view.stageKey, isConcealed: true }],
        occurrences: [{
          stageKey: view.stageKey,
          rule: {
            ruleVersionId: view.ruleVersionId, requirementRuleId: view.requirementRuleId,
            workTypeKey: view.workTypeKey, stageKey: view.stageKey, ordinal: view.ordinal,
            interventionType: view.interventionType, blockingScope: view.blockingScope,
            timing: view.timing, evidenceKind: view.evidenceKind,
            acceptanceCriterion: view.acceptanceCriterion,
            performerRole: view.performerRole, approverRole: view.approverRole,
            approverIsExternal: view.approverIsExternal,
            minEvidenceCount: view.minEvidenceCount, maxEvidenceCount: view.maxEvidenceCount,
            normRef: view.normRef, normRefVerification: view.normRefVerification,
            normRefSource: view.normRefSource,
          },
        }],
        coverage: "covered", workTypeKey: view.workTypeKey,
      }))).rejects.toThrow();
  });
});

describe("requirement_occurrences.list", () => {
  it("explains an empty set instead of returning a bare empty array", async () => {
    const created = await createAssignment(fx);
    const listed = await listOccurrences(created.body.assignmentId);
    expect(listed.status).toBe(200);
    expect(listed.body.coverage).toBeDefined();
    if (listed.body.occurrences.length === 0) {
      expect(listed.body.coverage).not.toBe("covered");
    }
  });

  it("returns the obligation with its acceptance criterion and its attributed citation", async () => {
    // ADR-006 step 2: the foreman sees what must be photographed «in the
    // standard's own wording». The response is re-parsed by
    // listRequirementOccurrencesResponse at the boundary, so a citation without
    // its tag and source would have thrown before reaching here.
    const created = await createAssignment(fx);
    await materialiseOne(created.body.assignmentId, fx.photoRuleVersionId);
    const listed = await listOccurrences(created.body.assignmentId);
    expect(listed.status).toBe(200);
    expect(listed.body.occurrences).toHaveLength(1);
    const o = listed.body.occurrences[0];
    expect(o.acceptanceCriterion.length).toBeGreaterThan(0);
    expect(o.blockingScope).toBe("blocks_stage_closure");
    expect(o.stage.isConcealed).toBe(true);
    // Read through the pin, not copied onto the occurrence.
    expect(o.allowedMedia.mimeTypes).toEqual(["image/jpeg"]);
    if (o.normRef !== null) {
      expect(o.normRef.verification).toMatch(/^VERIFIED_(PRIMARY|SECONDARY)$/);
      expect(o.normRef.source.trim().length).toBeGreaterThan(0);
    }
    // No satisfaction and no status: both are M3 projections and a nullable
    // field here would be read as «not yet satisfied».
    expect(o.satisfied).toBeUndefined();
    expect(o.status).toBeUndefined();
  });

  it("refuses a reader with no project access", async () => {
    const created = await createAssignment(fx);
    current = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const listed = await listOccurrences(created.body.assignmentId);
    expect(listed.status).toBeGreaterThanOrEqual(400);
    current = A;
  });
});

describe("requirement_occurrences.dry_run", () => {
  it("writes no occurrence and no stage", async () => {
    // The claim the operation's name makes. Asserted over the whole workspace,
    // not over one assignment, because a dry run that materialised somewhere
    // else would still be a dry run that materialised.
    const before = await q<{ o: number; s: number }>(
      `select (select count(*) from public.requirement_occurrences where workspace_id = $1)::int as o,
              (select count(*) from public.work_stages where workspace_id = $1)::int as s`,
      [fx.workspaceId]);
    const run = await dryRun(fx.projectId, fx.contractVersionId);
    expect(run.status).toBe(200);
    const after = await q<{ o: number; s: number }>(
      `select (select count(*) from public.requirement_occurrences where workspace_id = $1)::int as o,
              (select count(*) from public.work_stages where workspace_id = $1)::int as s`,
      [fx.workspaceId]);
    expect(after[0]).toEqual(before[0]);
  });

  it("records the run in the audit, counts only, never the lines", async () => {
    await dryRun(fx.projectId, fx.contractVersionId);
    const audit = await q<{ details: any }>(
      `select details from public.audit_events
        where organization_id = $1 and action = 'requirement_occurrences.dry_run'
          and object_id = $2`,
      [fx.workspaceId, fx.contractVersionId]);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.details.diagnosis).toBeDefined();
    // A coverage report copied into the audit log would put a baseline's own
    // line content in a record that outlives the request.
    expect(JSON.stringify(audit[0]!.details)).not.toContain(LINE.description);
  });

  it("prints every uncovered line in the command's own output", async () => {
    // INV-072: «the dry run prints an explicit list of uncovered lines as part
    // of the command's own output, not as a report someone may choose to run».
    const run = await dryRun(fx.projectId, fx.contractVersionId);
    expect(run.body.summary.workLineCount).toBe(run.body.workLines.length);
    const uncovered = run.body.workLines.filter((l: any) => l.coverage !== "covered");
    expect(run.body.uncoveredLines).toHaveLength(uncovered.length);
    expect(run.body.summary.uncoveredLineCount).toBe(uncovered.length);
    for (const line of run.body.uncoveredLines) {
      // Each one names itself well enough to be found and fixed.
      expect(line.workItemId).toBeDefined();
      expect(line.description.length).toBeGreaterThan(0);
      expect(["no_matching_rule", "work_type_unresolved"]).toContain(line.coverage);
    }
  });

  it("gives one machine-readable diagnosis that cannot be read as «all fine»", async () => {
    const run = await dryRun(fx.projectId, fx.contractVersionId);
    if (run.body.summary.wouldMaterialiseCount === 0) {
      expect(run.body.summary.diagnosis).not.toBe("covered");
    }
  });

  it("reports the bound set and a match count for every rule in it", async () => {
    const run = await dryRun(fx.projectId, fx.contractVersionId);
    expect(run.body.summary.boundRuleCount).toBe(2);
    expect(run.body.boundRules.map((r: any) => r.ruleVersionId).sort())
      .toEqual([fx.photoRuleVersionId, fx.checkboxRuleVersionId].sort());
    for (const r of run.body.boundRules) {
      expect(typeof r.matchedWorkLineCount).toBe("number");
    }
  });

  it("agrees with what assignments.create actually materialises", async () => {
    // A preview that disagrees with the command is not a preview. Both call the
    // same planner; this is the assertion that keeps it that way.
    const run = await dryRun(fx.projectId, fx.contractVersionId);
    const line = run.body.workLines.find((l: any) => l.workItemId === fx.workItemId);
    const created = await createAssignment(fx);
    expect(created.body.requirementOccurrences.ruleVersionIds).toEqual(line.ruleVersionIds);
  });

  it("refuses a draft baseline", async () => {
    const draft = await createDraft(fx.contractId);
    const draftId = (await draft.json()).contractVersionId as string;
    const run = await dryRun(fx.projectId, draftId);
    expect(run.status).toBe(422);
  });

  it("404s when the project and the version in the path name different rows", async () => {
    // Both identifiers are in the path so this cross-check is possible; with a
    // version-only path it would have been a cross-project read that passed
    // every capability check the route can make.
    const other = await q<{ id: string }>(
      `insert into public.projects (workspace_id, name) values ($1, 'Приклад-Інший')
       returning id`, [fx.workspaceId]);
    const run = await dryRun(other[0]!.id, fx.contractVersionId);
    expect(run.status).toBe(404);
  });
});

describe("the upload gate reads the occurrence, and never widens when it cannot", () => {
  async function intent(assignmentId: string, body: Record<string, unknown>): Promise<Response> {
    const { POST } = await import("../app/v1/assignments/[assignmentId]/upload-intents/route");
    return POST(new Request("http://x", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ assignmentId }) });
  }

  const VALID = {
    expectedContentHash: HASH,
    expectedByteSize: PAYLOAD.byteLength,
    claimedMediaType: "image/jpeg",
    deviceCaptureId: "device-capture-1",
    originMethod: "photo_picker" as const,
  };

  it("refuses a type the pinned rule version does not allow, though the fallback would", async () => {
    // `ruleVersionBody` allows image/jpeg only; FALLBACK_MEDIA also allows
    // image/png, image/heic and application/pdf. This is the whole difference
    // between a gate specific to the requirement and 50 MB of anything.
    const created = await createAssignment(fx);
    const occurrenceId = await materialiseOne(created.body.assignmentId, fx.photoRuleVersionId);
    const res = await intent(created.body.assignmentId, {
      ...VALID, claimedMediaType: "application/pdf", requirementOccurrenceId: occurrenceId,
    });
    expect(res.status).toBe(422);
  });

  it("accepts the type the pinned rule version allows and stores the binding", async () => {
    const created = await createAssignment(fx);
    const occurrenceId = await materialiseOne(created.body.assignmentId, fx.photoRuleVersionId);
    const res = await intent(created.body.assignmentId,
      { ...VALID, requirementOccurrenceId: occurrenceId });
    expect(res.status).toBe(201);
    const stored = await q<{ requirement_occurrence_id: string | null }>(
      `select requirement_occurrence_id from public.upload_intents
        where workspace_id = $1 and work_assignment_id = $2`,
      [fx.workspaceId, created.body.assignmentId]);
    // The binding between a captured original and the obligation it was
    // captured against — the FK 0015:251 deferred and 0043 §5 activated.
    expect(stored[0]!.requirement_occurrence_id).toBe(occurrenceId);
  });

  it("records which of the three sources decided the policy", async () => {
    // «The gate was the fallback» must be provable after the fact; it is the one
    // thing about this route worth being able to reconstruct later.
    const created = await createAssignment(fx);
    const occurrenceId = await materialiseOne(created.body.assignmentId, fx.photoRuleVersionId);
    await intent(created.body.assignmentId, { ...VALID, requirementOccurrenceId: occurrenceId });
    const audit = await q<{ details: any }>(
      `select details from public.audit_events
        where organization_id = $1 and action = 'upload_intent.authorized'`,
      [fx.workspaceId]);
    expect(audit[0]!.details.mediaPolicySource).toBe("requirement_occurrence");
  });

  it("refuses an occurrence belonging to another assignment", async () => {
    const first = await createAssignment(fx);
    const second = await createAssignment(fx);
    const occurrenceId = await materialiseOne(first.body.assignmentId, fx.photoRuleVersionId);
    const res = await intent(second.body.assignmentId,
      { ...VALID, requirementOccurrenceId: occurrenceId });
    // Refused in the route with a field error rather than at INSERT with a
    // 23503 the caller cannot act on.
    expect(res.status).toBe(422);
  });

  it("refuses an occurrence whose rule version defines no media policy", async () => {
    // A `checkbox` requirement produces no uploaded original, so the column
    // keeps its '[]' default. The gate must REFUSE rather than fall back to
    // 50 MB — a gate that opens when its policy cannot be read is not a gate.
    const created = await createAssignment(fx);
    const occurrenceId = await materialiseOne(
      created.body.assignmentId, fx.checkboxRuleVersionId);
    const res = await intent(created.body.assignmentId,
      { ...VALID, requirementOccurrenceId: occurrenceId });
    expect(res.status).toBe(422);
  });

  it("keeps the retired template pin working for an assignment that carries one", async () => {
    // The ordering contradiction 3 requires: add the occurrence source FIRST,
    // and do not remove the pin until the occurrence can replace it. An
    // assignment pinning a published template must still get that template's
    // policy and not the fallback.
    const { POST: createT } = await import(
      "../app/v1/workspaces/[workspaceId]/requirement-templates/route");
    const t = await createT(jsonReq("http://x", {
      templateKey: "pryklad-shablon", evidenceType: "photo",
      allowedMedia: { mimeTypes: ["image/png"], maxByteSize: 1024 * 1024 },
    }), { params: Promise.resolve({ workspaceId: fx.workspaceId }) });
    const templateVersionId = (await t.json()).templateVersionId as string;
    const { POST: publishT } = await import(
      "../app/v1/requirement-templates/[templateVersionId]/publish/route");
    await publishT(jsonReq("http://x", {}),
      { params: Promise.resolve({ templateVersionId }) });

    const { POST } = await import("../app/v1/contracts/[contractId]/assignments/route");
    const res = await POST(jsonReq("http://x",
      { workItemId: fx.workItemId, requirementTemplateVersionId: templateVersionId }),
      { params: Promise.resolve({ contractId: fx.contractId }) });
    const created = await res.json();
    expect(created.requirementOccurrences.usedRetiredTemplatePin).toBe(true);

    // image/jpeg is in FALLBACK_MEDIA and NOT in this template, so a pass here
    // would mean the pin had been silently replaced by the fallback.
    const refused = await intent(created.assignmentId, VALID);
    expect(refused.status).toBe(422);
    const accepted = await intent(created.assignmentId,
      { ...VALID, claimedMediaType: "image/png" });
    expect(accepted.status).toBe(201);
  });

  it("still falls back for an intent that names neither an occurrence nor a template", async () => {
    // The fallback's one remaining legitimate door, kept explicit so that its
    // disappearance — or its spread — is visible in this file.
    const created = await createAssignment(fx);
    const res = await intent(created.body.assignmentId, VALID);
    expect(res.status).toBe(201);
    const audit = await q<{ details: any }>(
      `select details from public.audit_events
        where organization_id = $1 and action = 'upload_intent.authorized'`,
      [fx.workspaceId]);
    expect(audit[0]!.details.mediaPolicySource).toBe("fallback");
  });
});
