import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient } from "./pg";
import {
  dropRulesWorkspaces, raised, seedRuleVersion, seedRulesWorld, sqlstate,
  type RulesFixture,
} from "./m1-rules-fixture";
import {
  OCCURRENCE_INSERT, insertOccurrence, occurrenceParams, seedAssignment,
  seedOccurrenceWorld, seedStage, type OccurrenceSeed, type OccurrenceWorld,
} from "./m2-occurrences-fixture";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `vitest`, `tsc`, `psql` and `supabase` were never run against it, no
 * migration was applied, and no claim is made that any assertion below passes.
 * Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M2, storage layer: «an occurrence is materialised from a binding when an
 * assignment is created, and pins the exact rule version» (ADR-005 decision 2)
 * as a SHAPE rather than as a promise one command keeps.
 *
 * WHY THIS SUITE EXISTS SEPARATELY FROM THE ROUTE SUITE. The command that
 * materialises is one caller of these tables, and the slice that gives the work
 * type an owning fact will rewrite it. Every refusal below must survive that
 * rewrite, so each one is attempted from the ADMIN connection — the table owner,
 * bypassing RLS — and what answers is a foreign key, a CHECK or a trigger. A
 * refusal only the planner performs is not asserted here at all, because it is
 * not a property of the record.
 *
 * WHAT THIS SUITE DELIBERATELY DOES NOT RE-PROVE. That an unpublished rule
 * version cannot be BOUND, and that another workspace's cannot be either:
 * m1-rules-schema.test.ts:537 and :510 prove both, at the binding. What is
 * proved here is the second half — that an occurrence cannot reach around the
 * binding and pin one anyway — and the two halves together are what make
 * «unpublished» and «foreign» unreachable rather than merely unwritten.
 */

const WS_A = "fccc1111-1111-1111-1111-111111111111";
const WS_B = "fccc2222-2222-2222-2222-222222222222";
const USER_A = "fccc3333-3333-3333-3333-333333333333";
const USER_B = "fccc4444-4444-4444-4444-444444444444";

let c: Client;
let a: RulesFixture;
let b: RulesFixture;
let wa: OccurrenceWorld;
let wb: OccurrenceWorld;

/** Attempts one occurrence INSERT as the table owner and reports the SQLSTATE. */
const attempt = (w: OccurrenceWorld, o: OccurrenceSeed = {}): Promise<string | null> =>
  sqlstate(() => c.query(OCCURRENCE_INSERT, occurrenceParams(w, o)));

/** How many occurrence rows this workspace holds, asked without a predicate. */
async function occurrenceCount(workspaceId: string): Promise<number> {
  const r = await c.query<{ n: number }>(
    `select count(*)::int as n from public.requirement_occurrences where workspace_id = $1`,
    [workspaceId]);
  return r.rows[0]!.n;
}

/**
 * Empties an append-only table between cases, the way dropRulesWorkspaces does.
 * `disable trigger user` suppresses app.reject_mutation() and nothing else — in
 * particular it does not suppress referential integrity, so this can only remove
 * rows that are genuinely unreferenced.
 */
async function purgeOccurrences(workspaceId: string): Promise<void> {
  await c.query(`alter table public.requirement_occurrences disable trigger user`);
  try {
    await c.query(
      `delete from public.requirement_occurrences where workspace_id = $1`, [workspaceId]);
  } finally {
    await c.query(`alter table public.requirement_occurrences enable trigger user`);
  }
}

async function constraintDef(table: string, name: string): Promise<string> {
  const r = await c.query<{ def: string }>(
    `select pg_get_constraintdef(co.oid) as def
       from pg_constraint co
       join pg_class cl on cl.oid = co.conrelid
       join pg_namespace n on n.oid = cl.relnamespace
      where n.nspname = 'public' and cl.relname = $1 and co.conname = $2`,
    [table, name]);
  return r.rows[0]?.def ?? "";
}

beforeAll(async () => {
  c = await adminClient();
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  a = await seedRulesWorld(c, { workspaceId: WS_A, userId: USER_A, suffix: "OA" });
  b = await seedRulesWorld(c, { workspaceId: WS_B, userId: USER_B, suffix: "OB" });
  wa = await seedOccurrenceWorld(c, a);
  wb = await seedOccurrenceWorld(c, b);
}, 120_000);

afterAll(async () => {
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  await c.end();
});

describe("an occurrence may pin only a rule version its own baseline bound", () => {
  it("stores a correct materialisation — the positive control every refusal needs", async () => {
    // Without this, every assertion below could be passing because the row is
    // malformed in some way none of them names.
    expect(await attempt(wa)).toBeNull();
    expect(await occurrenceCount(WS_A)).toBe(1);
    await purgeOccurrences(WS_A);
  });

  it("refuses a rule version this baseline never bound", async () => {
    // requirement_occurrences_from_binding_fkey. The version below is published
    // and belongs to this workspace; it is simply not in this baseline's set.
    // «Materialised FROM A BINDING» is what this key makes unrepresentable, and
    // the refusal must come from the database rather than from the planner,
    // because the planner is the thing a future slice rewrites.
    expect(await attempt(wa, { ruleVersionId: wa.unboundRuleVersionId })).toBe("23503");
    expect(await occurrenceCount(WS_A)).toBe(0);
  });

  it("refuses a rule version belonging to ANOTHER WORKSPACE", async () => {
    // Every leg of the pin carries workspace_id, so a foreign rule version has
    // no binding, no type key, no scope key and no stage key to resolve against
    // in this tenant. INV-001 here is not a policy that can be misconfigured: it
    // is the composite key's first column.
    expect(await attempt(wa, { ruleVersionId: wb.holdRuleVersionId })).toBe("23503");
    expect(await occurrenceCount(WS_A)).toBe(0);
  });

  it("refuses an UNPUBLISHED rule version, and closes the route around it too", async () => {
    // A draft rule version is reachable only from this connection: `rrv_insert`
    // (0041:774-776) admits `published` and nothing else. It cannot be bound —
    // m1-rules-schema.test.ts:537 proves that at the binding — and this is the
    // half that matters for the occurrence: with no binding to resolve against,
    // pinning it directly is refused by the same foreign key.
    expect(await attempt(wa, { ruleVersionId: wa.draftRuleVersionId })).toBe("23503");
    const bound = await c.query<{ n: number }>(
      `select count(*)::int as n from public.contract_version_rule_bindings
        where workspace_id = $1 and requirement_rule_version_id = $2`,
      [WS_A, wa.draftRuleVersionId]);
    expect(bound.rows[0]!.n).toBe(0);
    expect(await occurrenceCount(WS_A)).toBe(0);
  });

  it("refuses an occurrence whose baseline is not its assignment's own", async () => {
    // requirement_occurrences_assignment_baseline_fkey. Version 1 of this
    // contract is published and real; the assignment executes version 2. Without
    // the contract_version_id leg, the occurrence could pin a rule version bound
    // to a baseline this assignment does not execute and every other key would
    // still resolve.
    expect(await attempt(wa, { contractVersionId: a.publishedVersionId })).toBe("23503");
    expect(await occurrenceCount(WS_A)).toBe(0);
  });

  it("refuses a copy that misreports the pinned version's intervention type", async () => {
    // requirement_occurrences_pinned_type_fkey. 'witness' is STORABLE in the
    // column — the CHECK admits all three types — and is refused only because it
    // is not what the pinned version says. That is the difference between a
    // CHECK comparing the occurrence with a rule stated twice and a key
    // comparing it with the row it copied.
    expect(await attempt(wa, { interventionType: "witness" })).toBe("23503");
    expect(await occurrenceCount(WS_A)).toBe(0);
  });

  it("refuses a copy that misreports the pinned version's blocking scope", async () => {
    // requirement_occurrences_pinned_scope_fkey, INV-066.
    expect(await attempt(wa, { blockingScope: "blocks_both" })).toBe("23503");
    expect(await occurrenceCount(WS_A)).toBe(0);
  });

  it("refuses a copy that misreports the pinned version's timing", async () => {
    // The same key: (workspace_id, rule_version_id, blocking_scope, timing) is
    // one key because a wrong timing is as consequential as a wrong scope — it
    // is what the concealment CHECK reads.
    expect(await attempt(wa, {
      timing: "after", workStageId: null, stageIsConcealed: null,
    })).toBe("23503");
    expect(await occurrenceCount(WS_A)).toBe(0);
  });

  it("refuses an occurrence sitting on a stage its rule version does not name", async () => {
    // requirement_occurrences_pinned_stage_key_fkey — leg (d)'s rule side. The
    // stage below is real, concealed, and belongs to this occurrence's own
    // assignment, so the stage FK and the timing CHECK both pass: the ONLY thing
    // wrong is that the pinned rule version names a different stage.
    const assignmentId = await seedAssignment(c, a, wa.baselineVersionId, wa.workItemId);
    const stageId = await seedStage(c, a, {
      assignmentId, contractVersionId: wa.baselineVersionId,
      stageKey: wa.permissiveStageKey, isConcealed: true });
    expect(await attempt(wa, {
      assignmentId, workStageId: stageId, stageIsConcealed: true,
      stageKey: wa.permissiveStageKey,
    })).toBe("23503");
    expect(await occurrenceCount(WS_A)).toBe(0);
  });

  it("refuses an occurrence attached to a stage of ANOTHER ASSIGNMENT", async () => {
    // requirement_occurrences_stage_fkey carries work_assignment_id, which the
    // target DDL's narrower key does not. Without it the obligation would be
    // evaluated over a closable unit nobody assigned it to, and M3's closure of
    // the other assignment would be reading this one's requirements.
    const foreign = await seedStage(c, a, {
      assignmentId: wa.otherAssignmentId, contractVersionId: wa.baselineVersionId,
      stageKey: wa.stageKey, isConcealed: true });
    expect(await attempt(wa, { workStageId: foreign })).toBe("23503");
    expect(await occurrenceCount(WS_A)).toBe(0);
  });

  it("materialises once — a second run collides instead of doubling the set", async () => {
    // requirement_occurrences_materialisation_uniq. Two identical obligations on
    // one assignment cannot be told apart by the foreman reading them, and
    // nothing downstream could decide which one an evidence decision answered.
    expect(await attempt(wa)).toBeNull();
    expect(await attempt(wa)).toBe("23505");
    // Also with a different ordinal: ordinal is deliberately not in the key,
    // because nothing constrains it to be distinct (M1 review finding 6) and a
    // duplicate carrying a different one would pass a key that included it.
    expect(await attempt(wa, { ordinal: 7 })).toBe("23505");
    await purgeOccurrences(WS_A);
  });
});

describe("the stage a timing requires", () => {
  it("refuses a before_concealment occurrence whose stage is not concealed", async () => {
    // execution-and-evidence.md §"Timing": a requirement that must precede a
    // covering that never happens is unreachable. This is contradiction 5's
    // BEHAVIOURAL claim, which the plan asks to be confirmed by a test before
    // the fix built on it is trusted.
    const assignmentId = await seedAssignment(c, a, wa.baselineVersionId, wa.workItemId);
    const open = await seedStage(c, a, {
      assignmentId, contractVersionId: wa.baselineVersionId,
      stageKey: wa.stageKey, isConcealed: false });
    expect(await attempt(wa, {
      assignmentId, workStageId: open, stageIsConcealed: false,
    })).toBe("23514");
    expect(await occurrenceCount(WS_A)).toBe(0);
  });

  it("refuses concealment claimed with no stage at all", async () => {
    // `check ((work_stage_id is null) = (stage_is_concealed is null))`. Without
    // it the flag could satisfy the timing CHECK while answering to nothing —
    // and a CHECK that evaluates to NULL PASSES, which is the lesson 0023:57-63
    // paid for.
    expect(await attempt(wa, { workStageId: null })).toBe("23514");
    expect(await attempt(wa, { stageIsConcealed: null })).toBe("23514");
    // Neither is a stage: a before_concealment occurrence with no stage row is
    // refused by the timing CHECK rather than admitted on a NULL.
    expect(await attempt(wa, { workStageId: null, stageIsConcealed: null })).toBe("23514");
    expect(await occurrenceCount(WS_A)).toBe(0);
  });

  it("admits an unconcealed stage for a timing that does not require concealment", async () => {
    // The positive control: the CHECK constrains `before_concealment` and
    // nothing else, so an `after` obligation on an open stage is legal — which
    // is what keeps the refusals above about timing rather than about stages.
    expect(await attempt(wa, {
      ruleVersionId: wa.permissiveRuleVersionId, stageKey: wa.permissiveStageKey,
      workStageId: wa.permissiveStageId, stageIsConcealed: false,
      blockingScope: "blocks_both", timing: "after",
    })).toBeNull();
    await purgeOccurrences(WS_A);
  });
});

describe("contradiction 6 — the v0.1 hold is a command's refusal, not the table's", () => {
  it("stores a hold whose scope is blocks_both", async () => {
    // schema-v0.1.sql:1128 declares
    // `check (intervention_type <> 'hold' or blocking_scope = 'blocks_both')`,
    // which would make EVERY v0.1 occurrence unstorable, since ADR-006 decision
    // 4.4 makes a v0.1 hold `blocks_stage_closure`. Migration 0043 transcribes
    // neither direction, and this is what that buys: both scopes are storable,
    // so the v0.2 widening is an UPDATE rather than a migration that drops a
    // CHECK nobody reviews.
    expect(await attempt(wa, {
      ruleVersionId: wa.permissiveRuleVersionId, stageKey: wa.permissiveStageKey,
      workStageId: wa.permissiveStageId, stageIsConcealed: false,
      blockingScope: "blocks_both", timing: "after",
    })).toBeNull();
    await purgeOccurrences(WS_A);
  });

  it("keeps the whole vocabulary storable on both axes", async () => {
    // The v0.2 widening this repository already owes — «every hold written
    // during v0.1 with blocks_stage_closure is widened to blocks_both, with a
    // test that fails if one v0.1 row is left behind» — needs every value to be
    // storable before it runs. A CHECK narrowed to today's single legal
    // combination would turn that widening into a DDL change.
    const scopes = await constraintDef("requirement_occurrences",
      "requirement_occurrences_blocking_scope_check");
    for (const v of ["none", "blocks_stage_closure", "blocks_package_inclusion", "blocks_both"]) {
      expect(scopes).toContain(v);
    }
    const types = await constraintDef("requirement_occurrences",
      "requirement_occurrences_intervention_type_check");
    for (const v of ["hold", "witness", "review"]) expect(types).toContain(v);
  });

  it("still refuses a hold that widens its OWN scope past the version it copied", async () => {
    // The consequence 0043's header records, and the reason the permissive CHECK
    // is not a hole: the v0.2 widening must move the rule version and the
    // occurrence IN ONE STATEMENT, because
    // requirement_occurrences_pinned_scope_fkey refuses an occurrence claiming a
    // scope its pinned version does not have. Both tables being append-only
    // means that statement is a migration and never a command.
    expect(await attempt(wa, { blockingScope: "blocks_both" })).toBe("23503");
  });
});

describe("INV-073 survives the copy", () => {
  const CITATION = "ДБН А.3.1-5:2016, Додаток Н (довідковий), позиція Н.15";

  it("refuses a citation with no verification tag and one with no source", async () => {
    expect(await attempt(wa, { normRef: CITATION })).toBe("23514");
    expect(await attempt(wa, {
      normRef: CITATION, normRefVerification: "VERIFIED_PRIMARY", normRefSource: "   ",
    })).toBe("23514");
    expect(await occurrenceCount(WS_A)).toBe(0);
  });

  it("accepts one carrying both, which is what makes the refusals mean something", async () => {
    expect(await attempt(wa, {
      normRef: CITATION, normRefVerification: "VERIFIED_PRIMARY",
      normRefSource: "Приклад-джерело",
    })).toBeNull();
    await purgeOccurrences(WS_A);
  });
});

describe("both tables are append-only", () => {
  it("refuses every UPDATE and DELETE on an occurrence, even from the owner", async () => {
    const id = await insertOccurrence(c, wa);
    expect(await raised(() => c.query(
      `update public.requirement_occurrences set ordinal = 2 where id = $1`, [id])))
      .toMatch(/immutable/);
    expect(await raised(() => c.query(
      `delete from public.requirement_occurrences where id = $1`, [id])))
      .toMatch(/immutable/);
    expect(await occurrenceCount(WS_A)).toBe(1);
    await purgeOccurrences(WS_A);
  });

  it("has had work_stages_immutable REPLACED, not dropped, and still refuses a status flip", async () => {
    // M3 HAS NOW HAPPENED, AND THIS CASE IS WHAT IT LOOKS LIKE AFTERWARDS. It
    // used to require the trigger `work_stages_immutable` to be present and the
    // refusal to say «immutable». Migration 0045 §6 drops that trigger and
    // creates `work_stages_guard` in the same statement — the replacement this
    // case was written to demand — so on the applied chain the old name is gone
    // and asserting it asserted the absence of M3.
    //
    // An append-only table quietly losing its guard is a failure this repository
    // has already had once (0042:59-65), so the pairing is still checked by
    // name: the old trigger must be ABSENT and the new one PRESENT. A drop that
    // forgets its replacement leaves both counts at zero and fails here.
    const t = await c.query<{ tgname: string }>(
      `select tg.tgname from pg_trigger tg
         join pg_class cl on cl.oid = tg.tgrelid
        where cl.relname = 'work_stages' and not tg.tgisinternal
          and tg.tgname in ('work_stages_immutable', 'work_stages_guard')`);
    expect(t.rows.map((r) => r.tgname)).toEqual(["work_stages_guard"]);

    // AND THE DOOR IS STILL SHUT, which is the part that actually matters and
    // the part the old assertion did not reach. Both halves are attempted: the
    // bare flip the guard refuses for not advancing the version, and the
    // well-formed flip that gets past the guard and is then refused by
    // `work_stages_closure_fact_required` for having no closure behind it.
    // Asserting only the first would pass against a database where a status
    // word alone closes a stage, which is the whole of the ADR-005 gate.
    expect(await raised(() => c.query(
      `update public.work_stages set status = 'closed' where id = $1`, [wa.stageId])))
      .toMatch(/must advance its version exactly once/);
    expect(await raised(() => c.query(
      `update public.work_stages set status = 'closed', version = version + 1
        where id = $1`, [wa.stageId])))
      .toMatch(/recorded closed with no stage_closures fact behind it/);
  });

  it("gives the application role SELECT and INSERT, and UPDATE on stages alone", async () => {
    // The fifth grant is M3's and is deliberate: 0045:1466 gives goproceed_app
    // UPDATE on work_stages because the closure command has to move one status
    // from open to closed. It is not a widening of what the app may DO — that
    // is `app.guard_work_stage()`, asserted above, which admits that one
    // transition and refuses every other update and every delete.
    //
    // requirement_occurrences stays at SELECT and INSERT, and DELETE appears
    // nowhere. Listing the grants exactly, rather than counting them, is what
    // makes a sixth one fail here whatever it is.
    const g = await c.query<{ table_name: string; privilege_type: string }>(
      `select distinct table_name, privilege_type
         from information_schema.role_table_grants
        where grantee = 'goproceed_app' and table_schema = 'public'
          and table_name in ('work_stages','requirement_occurrences')
        order by table_name, privilege_type`);
    expect(g.rows.map((r) => `${r.table_name}:${r.privilege_type}`)).toEqual([
      "requirement_occurrences:INSERT", "requirement_occurrences:SELECT",
      "work_stages:INSERT", "work_stages:SELECT", "work_stages:UPDATE",
    ]);
  });

  it("gives anon, authenticated and the service role nothing at all", async () => {
    // goproceed_service records server-observed facts; neither table holds one, so
    // 0035's server-only plane does not extend here.
    const g = await c.query<{ n: number }>(
      `select count(*)::int as n from information_schema.role_table_grants
        where table_schema = 'public'
          and table_name in ('work_stages','requirement_occurrences')
          and grantee in ('anon','authenticated','goproceed_service','PUBLIC')`);
    expect(g.rows[0]!.n).toBe(0);
  });
});

describe("the tenant column is first on every key of both tables", () => {
  it("carries a NOT NULL workspace_id and offers unique (workspace_id, id)", async () => {
    for (const table of ["work_stages", "requirement_occurrences"]) {
      const col = await c.query<{ is_nullable: string }>(
        `select is_nullable from information_schema.columns
          where table_schema = 'public' and table_name = $1 and column_name = 'workspace_id'`,
        [table]);
      expect(col.rows[0]?.is_nullable).toBe("NO");

      const uniq = await c.query<{ n: number }>(
        `select count(*)::int as n from pg_constraint co
           join pg_class cl on cl.oid = co.conrelid
           join pg_namespace n on n.oid = cl.relnamespace
          where n.nspname = 'public' and cl.relname = $1 and co.contype = 'u'
            and pg_get_constraintdef(co.oid) = 'UNIQUE (workspace_id, id)'`,
        [table]);
      expect(uniq.rows[0]!.n).toBe(1);
    }
  });

  it("leads EVERY foreign key with workspace_id", async () => {
    // The property that makes a cross-tenant reference unrepresentable rather
    // than merely unwritten. m1-rules-schema.test.ts:173 asserts it for the
    // three M1 tables; this is the same assertion for the two M2 ones.
    const fks = await c.query<{ conname: string; def: string }>(
      `select co.conname, pg_get_constraintdef(co.oid) as def
         from pg_constraint co
         join pg_class cl on cl.oid = co.conrelid
         join pg_namespace n on n.oid = cl.relnamespace
        where n.nspname = 'public' and co.contype = 'f'
          and cl.relname in ('work_stages','requirement_occurrences')`);
    expect(fks.rows.length).toBeGreaterThan(0);
    for (const fk of fks.rows) {
      expect(`${fk.conname}: ${fk.def}`).toMatch(/FOREIGN KEY \(workspace_id/);
    }
  });

  it("enables row level security on both", async () => {
    const r = await c.query<{ relname: string; relrowsecurity: boolean }>(
      `select cl.relname, cl.relrowsecurity from pg_class cl
         join pg_namespace n on n.oid = cl.relnamespace
        where n.nspname = 'public'
          and cl.relname in ('work_stages','requirement_occurrences')`);
    expect(r.rows).toHaveLength(2);
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
  });
});

describe("the media policy the upload gate reads is constrained at its source", () => {
  /**
   * Migration 0044's `requirement_rule_versions_allowed_media_check`. From
   * v0.1-M2 the gate reads this column THROUGH the occurrence's pinned rule
   * version, in place of the retired `requirement_template_versions.allowed_media`
   * — and `0023:52-63` gave the retired model exactly this constraint. Without
   * it the new authority is weaker than the one it replaces, and the gate reads
   * a value it cannot interpret.
   *
   * The seed writes `allowed_media` explicitly for this reason; see
   * `RuleVersionSeed.allowedMedia`.
   */
  it("refuses a photo rule version relying on the column's own default", async () => {
    // '[]' is the default and means «no uploaded original», which a `photo`
    // requirement cannot mean. This is the case every fixture in the repository
    // used to produce.
    expect(await sqlstate(() =>
      seedRuleVersion(c, a, { libraryKey: "Н.15/6", allowedMedia: [] }))).toBe("23514");
  });

  it("refuses the empty object, which a CHECK written the obvious way would admit", async () => {
    // `jsonb_typeof(allowed_media -> 'mimeTypes')` is NULL for an absent key and
    // a CHECK that evaluates to NULL PASSES. The coalesce on every leg is what
    // stops `{}` — the shape most likely to reach it — from being stored.
    expect(await sqlstate(() =>
      seedRuleVersion(c, a, { libraryKey: "Н.15/6", allowedMedia: {} }))).toBe("23514");
  });

  it("refuses an empty mimeTypes list and a non-numeric size", async () => {
    expect(await sqlstate(() => seedRuleVersion(c, a, {
      libraryKey: "Н.15/6", allowedMedia: { mimeTypes: [], maxByteSize: 100 },
    }))).toBe("23514");
    expect(await sqlstate(() => seedRuleVersion(c, a, {
      libraryKey: "Н.15/6", allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: "5" },
    }))).toBe("23514");
  });

  it("admits the empty array for a kind that produces no uploaded original", async () => {
    // `checkbox` and `measurement` take no file, `publishRequirementRuleVersionRequest`
    // REFUSES allowedMedia for them, and the CHECK draws the line in the same
    // place. The upload gate's answer for such an occurrence is a refusal, not a
    // fallback — asserted through the route in
    // apps/app/tests/requirement-occurrences.int.test.ts.
    expect(await sqlstate(() => seedRuleVersion(c, a, {
      libraryKey: "Н.15/6", evidenceKind: "checkbox", allowedMedia: [],
    }))).toBeNull();
  });
});

describe("contradiction 8 — the PWA's origin token reached BOTH tables", () => {
  it("admits origin_not_distinguished on the intent and on the evidence object", async () => {
    // Widening only `upload_intents` would fail at FINALIZATION: 0035:101-108
    // copies origin_method intent -> evidence object inside a SECURITY DEFINER
    // function, so the refusal would land after the foreman was told the photo
    // was saved. That is why one migration moved both, and this assertion fails
    // if a later migration moves only one of them.
    const intent = await constraintDef("upload_intents", "upload_intents_origin_method_check");
    const object = await constraintDef("evidence_objects",
      "evidence_objects_origin_method_check");
    expect(intent).toContain("origin_not_distinguished");
    expect(object).toContain("origin_not_distinguished");
    for (const v of ["native_camera", "photo_picker", "file_picker", "form",
                     "import", "generated_derivative"]) {
      expect(intent).toContain(v);
      expect(object).toContain(v);
    }
  });

  it("keeps the column's own comment saying the value proves nothing", async () => {
    // Storability is not provenance. INV-086 says no PWA capture asserts a
    // distinguished origin; ENFORCING that is the PWA's request contract and
    // there is no PWA yet, so what this suite can assert is only that the honest
    // value is available and that the column has not quietly been redescribed as
    // evidence of where a photo came from.
    const comment = await c.query<{ d: string | null }>(
      `select col_description('public.evidence_objects'::regclass,
                (select attnum from pg_attribute
                  where attrelid = 'public.evidence_objects'::regclass
                    and attname = 'origin_method')) as d`);
    expect(comment.rows[0]!.d ?? "").toMatch(/NOT PROVENANCE/);
  });
});
