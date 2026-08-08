import { describe, it, expect } from "vitest";
import {
  boundRuleVersion, lineCoverage, planForWorkType, planMaterialisation, workTypeKeyOf,
  type BoundRuleVersion, type WorkLine,
} from "./requirement-materialisation";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. It was written with no node_modules,
 * no database and no docker available: `vitest`, `tsc`, `psql` and `supabase`
 * were never run against it, and no claim is made that any assertion below
 * passes. Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * The materialisation plan — the one computation `assignments.create` and
 * `requirement_occurrences.dry_run` share. It is pure and it is tested here
 * rather than through either route, because what needs proving is arithmetic
 * over rows and not the behaviour of a transaction.
 *
 * EVERY ASSERTION BELOW IS REQUIRED BEHAVIOUR.
 *
 * WHAT CHANGED WITH MIGRATION 0050. Three assertions here used to pin the
 * absence of a carrier: `workTypeKeyOf` returned null for every row, so nothing
 * could match anywhere in the product. One of them — «it has no carrier on a
 * work line, so it resolves to null» — carried an instruction to DELETE IT in
 * the slice that lands the carrier, because a test asserting the current shape
 * of a known hole becomes a test defending that hole the moment the hole is
 * closable. This is that slice, and that test is deleted rather than adjusted.
 *
 * The two that remain are unchanged in what they require and changed in what
 * reaches them: an UNTYPED line still produces an empty plan that says
 * `work_type_unresolved`, because the column is nullable and every imported
 * line carries NULL. What is new is the case that used to be unreachable — a
 * TYPED line matching a bound rule — and it is asserted through
 * `planMaterialisation`, the real entry point, and not only through
 * `planForWorkType`.
 */

const RULE = (over: Partial<BoundRuleVersion> = {}): BoundRuleVersion => ({
  ruleVersionId: "11111111-1111-1111-1111-111111111111",
  requirementRuleId: "22222222-2222-2222-2222-222222222222",
  workTypeKey: "montazh-elektrotekhnichnykh-ustanovok",
  stageKey: "prykhovani-roboty",
  ordinal: 1,
  interventionType: "hold",
  blockingScope: "blocks_stage_closure",
  timing: "before_concealment",
  evidenceKind: "photo",
  acceptanceCriterion: "Приклад-критерій",
  performerRole: "foreman",
  approverRole: "technical_supervisor",
  approverIsExternal: false,
  minEvidenceCount: 1,
  maxEvidenceCount: null,
  normRef: "ДБН А.3.1-5:2016, Додаток Н (довідковий), позиція Н.15",
  normRefVerification: "VERIFIED_PRIMARY",
  normRefSource: "Приклад-джерело",
  ...over,
});

/** An untyped line — every imported line, and any line typed without one. */
const LINE: WorkLine = {
  workItemId: "33333333-3333-3333-3333-333333333333",
  position: 1,
  workCode: "1.1",
  description: "Приклад-позиція",
  workTypeKey: null,
};

/** The same line, classified. */
const TYPED = (key = "montazh-elektrotekhnichnykh-ustanovok"): WorkLine =>
  ({ ...LINE, workTypeKey: key });

describe("the predicate's first argument", () => {
  it("is the line's own work type, byte for byte", () => {
    // NOT normalised. `work_items_work_type_key_shape_check` (migration 0050)
    // refuses a padded key on the column so that this comparison and
    // app.work_type_key_is_bindable are both exact equality; a trim here would
    // make the two disagree about which lines match, which is the failure the
    // whole carrier exists to remove.
    expect(workTypeKeyOf(TYPED("montazh"))).toBe("montazh");
    expect(workTypeKeyOf(LINE)).toBeNull();
  });

  it("matches a bound rule version through planMaterialisation, not only planForWorkType", () => {
    // The case the product could not reach before migration 0050. It goes
    // through the real entry point deliberately: `planForWorkType` was always
    // testable and always passed, and a suite that only ever exercised it would
    // have stayed green through the entire period in which no occurrence
    // materialised anywhere.
    const plan = planMaterialisation(TYPED(), [RULE()]);
    expect(plan.occurrences).toHaveLength(1);
    expect(plan.coverage).toBe("covered");
    expect(plan.workTypeKey).toBe("montazh-elektrotekhnichnykh-ustanovok");
  });

  it("reports a typed line no bound rule names as no_matching_rule", () => {
    // The ordinary uncovered line. ADR-006 decision 4.2 requires it be named
    // rather than hidden; `contract_versions.publish` names it by position
    // while the baseline is still a draft.
    const plan = planMaterialisation(TYPED("muruvannia"), [RULE()]);
    expect(plan.occurrences).toEqual([]);
    expect(plan.coverage).toBe("no_matching_rule");
  });

  it("reports an untyped line as work_type_unresolved, never as no_matching_rule", () => {
    const plan = planMaterialisation(LINE, [RULE()]);
    expect(plan.occurrences).toEqual([]);
    // The distinction is the whole point, and 0050 changes only who owns it:
    // `no_matching_rule` is a baseline someone must finish binding,
    // `work_type_unresolved` is a line nobody has classified — and for an
    // imported line, one nobody CAN classify (ADR-006 decision 6 freezes the
    // importer; INV-015 freezes the published line). Collapsing them sends the
    // finding to the wrong owner.
    expect(plan.coverage).toBe("work_type_unresolved");
  });

  it("reports an unbound baseline as no_bindings whether or not the line is typed", () => {
    // M1 review finding 1: import_batches.publish can publish a baseline with
    // no bindings. That is a different defect from an unclassified line and
    // must not be hidden behind it — in either direction.
    expect(planMaterialisation(LINE, []).coverage).toBe("no_bindings");
    expect(planMaterialisation(TYPED(), []).coverage).toBe("no_bindings");
  });
});

describe("the plan, when a work type has been resolved", () => {
  // These supply the work type directly. They were written when the product
  // could not store one; migration 0050 lands the carrier and changes nothing
  // here, which is what the split between `planMaterialisation` and
  // `planForWorkType` was for. They stay because the stage derivation and the
  // ordering are arithmetic over rows and are worth exercising without a
  // database — the reachability of the matching is asserted above.
  const WT = "montazh-elektrotekhnichnykh-ustanovok";

  it("materialises one occurrence per matched rule and one stage per distinct stage key", () => {
    const plan = planForWorkType(WT, [
      RULE({ ruleVersionId: "aaaaaaaa-0000-0000-0000-000000000001", ordinal: 2 }),
      RULE({ ruleVersionId: "aaaaaaaa-0000-0000-0000-000000000002", ordinal: 1 }),
      RULE({ ruleVersionId: "aaaaaaaa-0000-0000-0000-000000000003",
             stageKey: "zemliani-roboty", timing: "before_work" }),
    ]);
    expect(plan.occurrences).toHaveLength(3);
    // One stage per distinct key — `work_stages_closable_unit_uniq` makes
    // (assignment, location, stage_key) one closable unit, so two rules on one
    // stage key must not produce two stages.
    expect(plan.stages.map((s) => s.stageKey))
      .toEqual(["prykhovani-roboty", "zemliani-roboty"]);
    expect(plan.coverage).toBe("covered");
  });

  it("ignores a bound rule whose work type is a different one", () => {
    const plan = planForWorkType(WT, [
      RULE({ ruleVersionId: "aaaaaaaa-0000-0000-0000-000000000004",
             workTypeKey: "muruvannia" }),
    ]);
    expect(plan.occurrences).toEqual([]);
    expect(plan.coverage).toBe("no_matching_rule");
  });

  it("conceals a stage when ANY rule on it is timed before_concealment", () => {
    // Not an inference about the building: migration 0043's CHECK makes a
    // `before_concealment` occurrence unstorable without a concealed stage, so
    // the alternative is materialisation failing inside assignment creation.
    // The stage is ONE row, so the covered reading wins over the uncovered one.
    const plan = planForWorkType(WT, [
      RULE({ ruleVersionId: "bbbbbbbb-0000-0000-0000-000000000001", timing: "during" }),
      RULE({ ruleVersionId: "bbbbbbbb-0000-0000-0000-000000000002",
             timing: "before_concealment" }),
    ]);
    expect(plan.stages).toEqual([{ stageKey: "prykhovani-roboty", isConcealed: true }]);
  });

  it("leaves a stage unconcealed when no rule on it demands concealment", () => {
    const plan = planForWorkType(WT, [
      RULE({ ruleVersionId: "bbbbbbbb-0000-0000-0000-000000000003", timing: "after" }),
    ]);
    expect(plan.stages).toEqual([{ stageKey: "prykhovani-roboty", isConcealed: false }]);
  });

  it("orders occurrences by stage, then ordinal, then id", () => {
    // Deterministic because `ordinal` is a position in an ordered set and
    // nothing constrains it to be distinct (M1 review finding 6). Without the id
    // tie-break two obligations would come back in whatever order the database
    // happened to return them, and the foreman's list would reshuffle between
    // reads.
    const plan = planForWorkType(WT, [
      RULE({ ruleVersionId: "dddddddd-0000-0000-0000-000000000002", ordinal: 1 }),
      RULE({ ruleVersionId: "dddddddd-0000-0000-0000-000000000001", ordinal: 1 }),
      RULE({ ruleVersionId: "cccccccc-0000-0000-0000-000000000001",
             stageKey: "aaa-stage", ordinal: 9 }),
    ]);
    expect(plan.occurrences.map((o) => o.rule.ruleVersionId)).toEqual([
      "cccccccc-0000-0000-0000-000000000001",
      "dddddddd-0000-0000-0000-000000000001",
      "dddddddd-0000-0000-0000-000000000002",
    ]);
  });
});

describe("the dry run and the command agree by construction", () => {
  it("derives the per-line verdict from the same plan the command would use", () => {
    const rules = [RULE()];
    // Both populations, because they take different branches of `lineCoverage`:
    // a covered line returns its matched rule versions, an untyped one returns
    // an empty list and a reason. A dry run that agreed with the command on one
    // and not the other would be worse than no dry run.
    for (const line of [LINE, TYPED(), TYPED("muruvannia")]) {
      const fromPlan = planMaterialisation(line, rules);
      const fromDryRun = lineCoverage(rules, line);
      expect(fromDryRun.ruleVersionIds)
        .toEqual(fromPlan.occurrences.map((o) => o.rule.ruleVersionId));
      expect(fromDryRun.workTypeKey).toBe(fromPlan.workTypeKey);
      expect(fromDryRun.coverage).toBe(fromPlan.coverage);
    }
  });
});

describe("the row mapper", () => {
  it("carries every field the occurrence copies, and the numeric ones as numbers", () => {
    // pg returns integer columns as JS numbers but numeric/bigint as strings,
    // and min/max_evidence_count are integers today. Number() on both is the
    // cheap guard against the day one of them changes type: an occurrence
    // written with "1" instead of 1 would still satisfy the column and would
    // compare unequal to the rule version in the field-by-field test.
    const v = boundRuleVersion({
      rule_version_id: "cccccccc-0000-0000-0000-000000000001",
      requirement_rule_id: "dddddddd-0000-0000-0000-000000000001",
      work_type_key: "montazh", stage_key: "prykhovani-roboty", ordinal: "3",
      intervention_type: "hold", blocking_scope: "blocks_stage_closure",
      timing: "before_concealment", evidence_kind: "photo",
      acceptance_criterion: "Приклад-критерій", performer_role: "foreman",
      approver_role: "technical_supervisor", approver_is_external: false,
      min_evidence_count: "2", max_evidence_count: "4",
      norm_ref: null, norm_ref_verification: null, norm_ref_source: null,
    });
    expect(v.ordinal).toBe(3);
    expect(v.minEvidenceCount).toBe(2);
    expect(v.maxEvidenceCount).toBe(4);
    expect(v.approverIsExternal).toBe(false);
    expect(v.normRef).toBeNull();
  });

  it("keeps a null max_evidence_count null rather than coercing it to zero", () => {
    // Number(null) is 0, and 0 would mean «no evidence may be attached» on a
    // column whose null means «no upper bound». The two are opposites.
    const v = boundRuleVersion({
      rule_version_id: "c", requirement_rule_id: "d", work_type_key: "w",
      stage_key: "s", ordinal: 1, intervention_type: "hold",
      blocking_scope: "blocks_stage_closure", timing: "after", evidence_kind: "photo",
      acceptance_criterion: "x", performer_role: "p", approver_role: "a",
      approver_is_external: true, min_evidence_count: 1, max_evidence_count: null,
      norm_ref: null, norm_ref_verification: null, norm_ref_source: null,
    });
    expect(v.maxEvidenceCount).toBeNull();
  });
});
