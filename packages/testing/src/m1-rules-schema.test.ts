import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor } from "./pg";
import {
  dropRulesWorkspaces, raised, seedRuleVersion, seedRulesWorld, sqlstate,
  type RulesFixture,
} from "./m1-rules-fixture";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. It was written in an environment with
 * no node_modules, no database and no docker: `vitest`, `tsc`, `psql` and
 * `supabase` were never run against it, no migration was applied, and no claim
 * is made that any assertion below passes. Static reading is the only check
 * that was available, and it is not a substitute for running the suite.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M1, the database layer of the requirement model: the three tables
 * migration 0041 builds, the immutability of a published rule version
 * (INV-067), what a baseline may and may not bind (INV-067/INV-080), and the
 * storability rules the Додаток Н content is subject to (INV-073).
 *
 * EVERY CASE ASSERTS REQUIRED BEHAVIOUR AND ATTEMPTS THE WRITE THE RULE EXISTS
 * TO STOP. A suite that only reads the catalog proves the DDL was typed, not
 * that it holds; m2-binding-hardening.test.ts:8-9 is the standing note in this
 * repository about that, and it applies here.
 *
 * WHERE A REFUSAL COMES FROM MORE THAN ONE LAYER, BOTH ARE PROBED SEPARATELY.
 * A trigger that fires first can hide a missing foreign key for years: the
 * structural half is therefore checked with the trigger temporarily disabled,
 * so deleting either one turns this file red.
 *
 * TRIGGER ORDER, MEASURED FROM THE NAMES RATHER THAN FROM A COMMENT. PostgreSQL
 * fires BEFORE row triggers in name order, and
 * `contract_version_rule_bindings_insert_window` (0042 §5) sorts BEFORE
 * `contract_version_rule_bindings_rule_version_guard` (0041 §8) — 'i' precedes
 * 'r'. Migration 0042:461-463 states the opposite. No test here depends on
 * which of the two answers first: each probe is arranged so that exactly one
 * of them can fire, which is also what keeps the assertion about the rule and
 * not about the ordering.
 */

const WS_A = "ffff1111-1111-1111-1111-111111111111";
const WS_B = "ffff2222-2222-2222-2222-222222222222";
const USER_A = "ffff3333-3333-3333-3333-333333333333";
const USER_B = "ffff4444-4444-4444-4444-444444444444";
/**
 * A workspace with a membership and NO library rows.
 *
 * The storability probes need somewhere the twelve allow-listed slots are still
 * free. Attempting them in a seeded workspace would work — CHECK and NOT NULL
 * are evaluated before index insertion, so the content refusal still wins over
 * the unique key — but the test would then be silently depending on that
 * ordering, and the positive control could not run at all.
 */
const WS_C = "ffff5555-5555-5555-5555-555555555555";
const USER_C = "ffff6666-6666-6666-6666-666666666666";

const NEW_TABLES = [
  "requirement_library_items",
  "requirement_rule_versions",
  "contract_version_rule_bindings",
] as const;

let c: Client;
let a: RulesFixture;
let b: RulesFixture;

beforeAll(async () => {
  c = await adminClient();
  await dropRulesWorkspaces(c, [WS_A, WS_B, WS_C]);
  a = await seedRulesWorld(c, { workspaceId: WS_A, userId: USER_A, suffix: "FA" });
  b = await seedRulesWorld(c, { workspaceId: WS_B, userId: USER_B, suffix: "FB" });

  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email,
                             encrypted_password, created_at, updated_at)
     values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
             $2,'',now(),now())
     on conflict (id) do nothing`, [USER_C, `${USER_C}@fixture.test`]);
  await c.query(
    `insert into public.organizations (id, legal_name, display_name)
     values ($1,'Приклад-Порожній','Приклад-Порожній')`, [WS_C]);
  await c.query(
    `insert into public.memberships (organization_id, user_id, role, status)
     values ($1,$2,'owner','active')`, [WS_C, USER_C]);
}, 120_000);

afterAll(async () => {
  await dropRulesWorkspaces(c, [WS_A, WS_B, WS_C]);
  await c.end();
});

// A type alias, not an interface: pg's `query<T>` constrains T to
// QueryResultRow, and only object-literal TYPES get the implicit index
// signature that satisfies it. An interface here would not compile.
type ForeignKey = {
  conname: string; def: string; first_col: string; arity: number; ref_table: string;
};

async function foreignKeys(table: string): Promise<ForeignKey[]> {
  const r = await c.query<ForeignKey>(
    `select con.conname,
            pg_get_constraintdef(con.oid) as def,
            (select att.attname from pg_attribute att
              where att.attrelid = con.conrelid and att.attnum = con.conkey[1]) as first_col,
            cardinality(con.conkey)::int as arity,
            ref.relname as ref_table
       from pg_constraint con
       join pg_class rel on rel.oid = con.conrelid
       join pg_namespace n on n.oid = rel.relnamespace
       join pg_class ref on ref.oid = con.confrelid
      where n.nspname = 'public' and rel.relname = $1 and con.contype = 'f'`, [table]);
  return r.rows;
}

/** Inserts one binding row; every column the command writes, nothing more. */
function bindingValues(f: RulesFixture, o: {
  contractVersionId: string; requirementRuleId: string; ruleVersionId: string; stageKey: string;
}): [string, unknown[]] {
  return [
    `insert into public.contract_version_rule_bindings
       (workspace_id, project_id, contract_id, contract_version_id,
        requirement_rule_id, requirement_rule_version_id, stage_key, bound_by_member_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [f.workspaceId, f.projectId, f.contractId, o.contractVersionId,
     o.requirementRuleId, o.ruleVersionId, o.stageKey, f.memberId],
  ];
}

/**
 * Runs `fn` with one named trigger off, and puts it back whatever happens.
 *
 * This is how a structural guarantee is told apart from a trigger that happens
 * to fire first. It is the same instrument m2-binding-hardening.test.ts uses on
 * the grant side, applied to the layer question instead.
 */
async function withTriggerDisabled<T>(
  table: string, trigger: string, fn: () => Promise<T>,
): Promise<T> {
  await c.query(`alter table public.${table} disable trigger ${trigger}`);
  try { return await fn(); }
  finally { await c.query(`alter table public.${table} enable trigger ${trigger}`); }
}

describe("0041 builds three tenant-safe tables", () => {
  it("every one of them carries a NOT NULL workspace_id", async () => {
    for (const t of NEW_TABLES) {
      const r = await c.query(
        `select is_nullable from information_schema.columns
          where table_schema = 'public' and table_name = $1 and column_name = 'workspace_id'`,
        [t]);
      expect(r.rows, t).toHaveLength(1);
      expect(r.rows[0].is_nullable, t).toBe("NO");
    }
  });

  it("every one of them offers unique (workspace_id, id) as a composite FK target", async () => {
    // Without it no other table can point at these rows tenant-safely, which is
    // how INV-001 stops being a WHERE clause and becomes a key.
    for (const t of NEW_TABLES) {
      const r = await c.query(
        `select 1 from pg_constraint con
           join pg_class rel on rel.oid = con.conrelid
          where rel.relname = $1 and con.contype in ('u','p')
            and (select array_agg(att.attname::text order by att.attname)
                   from unnest(con.conkey) k
                   join pg_attribute att on att.attrelid = rel.oid and att.attnum = k)
                = array['id','workspace_id']`, [t]);
      expect(r.rows.length, t).toBeGreaterThan(0);
    }
  });

  it("EVERY foreign key on them leads with workspace_id", async () => {
    // Stated generically rather than constraint by constraint, so a foreign key
    // ADDED LATER without the tenant column fails here. A single-column key
    // that reached another tenant's row is the whole of INV-001's failure mode,
    // and the only single-column key permitted is the tenancy anchor itself.
    for (const t of NEW_TABLES) {
      const fks = await foreignKeys(t);
      expect(fks.length, t).toBeGreaterThan(0);
      for (const fk of fks) {
        expect(fk.first_col, `${t}.${fk.conname}`).toBe("workspace_id");
        if (fk.ref_table !== "organizations") {
          expect(fk.arity, `${t}.${fk.conname}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("a rule version cites a library item of its OWN workspace", async () => {
    const fks = await foreignKeys("requirement_rule_versions");
    expect(fks.some((f) => /REFERENCES requirement_library_items\(workspace_id, id\)/.test(f.def)))
      .toBe(true);
  });

  it("a binding pins the contract version, the rule, the stage and the publication", async () => {
    const fks = await foreignKeys("contract_version_rule_bindings");
    const defs = fks.map((f) => f.def);
    // The baseline it belongs to, down to project and contract.
    expect(defs.some((d) =>
      /REFERENCES contract_versions\(workspace_id, project_id, contract_id, id\)/.test(d))).toBe(true);
    // The version must belong to the rule the binding names.
    expect(defs.some((d) =>
      /REFERENCES requirement_rule_versions\(workspace_id, requirement_rule_id, id\)/.test(d))).toBe(true);
    // It cannot misreport the stage its rule version names — the set of stage
    // keys bound to a version IS that version's stage vocabulary, so a binding
    // free to invent one would make M2 materialise stages nobody agreed.
    expect(defs.some((d) =>
      /REFERENCES requirement_rule_versions\(workspace_id, id, stage_key\)/.test(d))).toBe(true);
    // The literal discriminator: only a version whose generated
    // has_been_published is true can satisfy it, so binding a draft is
    // unrepresentable rather than refused in one route.
    expect(defs.some((d) =>
      /REFERENCES requirement_rule_versions\(workspace_id, id, has_been_published\)/.test(d))).toBe(true);
  });

  it("row level security is enabled on all three", async () => {
    for (const t of NEW_TABLES) {
      const r = await c.query<{ rls: boolean; forced: boolean }>(
        `select relrowsecurity as rls, relforcerowsecurity as forced
           from pg_class where oid = ('public.' || $1)::regclass`, [t]);
      expect(r.rows[0]!.rls, t).toBe(true);
    }
  });

  it("requirement_rule_versions is NOT force-RLS, because retirement writes as the owner", async () => {
    // app.retire_requirement_rule_version is SECURITY DEFINER (0041 §7) and is
    // the ONLY write path retirement has — there is no UPDATE grant. With FORCE
    // on, the definer's own UPDATE would be subject to RLS, there is no UPDATE
    // policy on this table, and the command would silently update zero rows and
    // then be reported as a retirement that did not happen.
    const r = await c.query<{ forced: boolean }>(
      `select relforcerowsecurity as forced
         from pg_class where oid = 'public.requirement_rule_versions'::regclass`);
    expect(r.rows[0]!.forced).toBe(false);
  });

  it("each table is indexed workspace-first", async () => {
    for (const t of NEW_TABLES) {
      const r = await c.query(
        `select 1 from pg_index i
           join pg_class rel on rel.oid = i.indrelid
           join pg_attribute att on att.attrelid = rel.oid and att.attnum = i.indkey[0]
          where rel.relname = $1 and att.attname = 'workspace_id'`, [t]);
      expect(r.rows.length, t).toBeGreaterThan(0);
    }
  });

  it("the app role may read and append and nothing else; anon and authenticated may do nothing", async () => {
    for (const t of NEW_TABLES) {
      const r = await c.query<{ privilege_type: string }>(
        `select distinct privilege_type from information_schema.role_table_grants
          where grantee = 'goproceed_app' and table_schema = 'public' and table_name = $1
          order by privilege_type`, [t]);
      // Not "does not contain UPDATE": the whole grant is stated, so a grant
      // added later is visible here rather than passing a negative check.
      expect(r.rows.map((x) => x.privilege_type), t).toEqual(["INSERT", "SELECT"]);
    }
    const exposed = await c.query(
      `select grantee, table_name from information_schema.role_table_grants
        where grantee in ('anon','authenticated') and table_schema = 'public'
          and table_name = any($1::text[])`, [[...NEW_TABLES]]);
    expect(exposed.rows).toEqual([]);
  });
});

/**
 * One library insert into the EMPTY workspace, with `over` replacing whatever
 * the probe is about. The base row is the real Н.14 item 1 wording, because a
 * fixture that invented a normative string would itself be a content defect.
 */
function insertLibrary(over: Record<string, unknown>): Promise<unknown> {
  const v: Record<string, unknown> = {
    workspace_id: WS_C,
    source_standard: "ДБН А.3.1-5:2016",
    position_code: "Н.14",
    position_title_uk: "Внутрішні санітарно-технічні роботи",
    item_no: 1,
    item_text_uk: "Підготовка ніш, каналів та борозен для прокладання в них "
      + "трубопроводів та встановлення санітарно-технічних приладів.",
    verification: "VERIFIED_PRIMARY",
    source_citation: "ДБН А.3.1-5:2016 Додаток Н",
    ...over,
  };
  const cols = Object.keys(v);
  return c.query(
    `insert into public.requirement_library_items (${cols.join(",")})
     values (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
    cols.map((k) => v[k]));
}

describe("a library item with no verification tag or no source cannot be stored (INV-073)", () => {
  it("refuses a NULL tag and a NULL source", async () => {
    expect(await sqlstate(() => insertLibrary({ verification: null }))).toBe("23502");
    expect(await sqlstate(() => insertLibrary({ source_citation: null }))).toBe("23502");
  });

  it("refuses UNVERIFIED as a storable tag", async () => {
    // Deliberately not in the CHECK's list. An unverified string must never be
    // shown as normative, and the cheapest guarantee is that it cannot be
    // written rather than that a renderer remembers to filter it.
    expect(await sqlstate(() => insertLibrary({ verification: "UNVERIFIED" }))).toBe("23514");
  });

  it("refuses a blank source, which NOT NULL alone would admit", async () => {
    // 0041:212-216 is explicit that NOT NULL is not INV-073: '' and '   ' carry
    // no source while satisfying the column.
    for (const blank of ["", "   ", "\t\n"]) {
      expect(await sqlstate(() => insertLibrary({ source_citation: blank })),
        JSON.stringify(blank)).toBe("23514");
    }
  });

  it("refuses text with no wording, and a standard with no name", async () => {
    expect(await sqlstate(() => insertLibrary({ item_text_uk: "  " }))).toBe("23514");
    expect(await sqlstate(() => insertLibrary({ source_standard: "" }))).toBe("23514");
  });

  it("accepts a row carrying both, which is what makes every refusal above mean something", async () => {
    // Without a positive control the whole describe would pass against a table
    // that rejects everything.
    expect(await sqlstate(() => insertLibrary({}))).toBeNull();
    const stored = await c.query<{ verification: string; source_citation: string }>(
      `select verification, source_citation from public.requirement_library_items
        where workspace_id = $1 and position_code = 'Н.14' and item_no = 1`, [WS_C]);
    expect(stored.rows[0]!.verification).toBe("VERIFIED_PRIMARY");
    expect(stored.rows[0]!.source_citation.trim().length).toBeGreaterThan(0);
  });
});

describe("the Додаток Н allow-list is structural, not editorial", () => {
  it("cannot hold a position outside Н.14 and Н.15", async () => {
    // «Н.1–Н.13» is not an allow-listed range and there is no value here that
    // could hold one.
    for (const code of ["Н.13", "Н.16", "Н.1"]) {
      expect(await sqlstate(() => insertLibrary({ position_code: code, item_no: 2 })), code)
        .toBe("23514");
    }
  });

  it("cannot hold a sixth Н.14 item or an eighth Н.15 item (prohibition A)", async () => {
    // Unrepresentable, not forbidden by review. Anything the product recommends
    // beyond Додаток Н belongs to a separate block labelled «Додатково
    // рекомендуємо (не з Додатка Н)» with no normative citation, and that block
    // is not this table.
    expect(await sqlstate(() => insertLibrary({ position_code: "Н.14", item_no: 6 }))).toBe("23514");
    expect(await sqlstate(() => insertLibrary({ position_code: "Н.15", item_no: 8 }))).toBe("23514");
  });

  it("cannot call Додаток Н anything but довідковий (prohibitions B and C)", async () => {
    for (const character of ["orientovnyi", "obovyazkovyi", "recommended"]) {
      expect(await sqlstate(() => insertLibrary({
        normative_character: character, item_no: 2,
      })), character).toBe("23514");
    }
  });

  it("records the act form only ever as the product's own assumption (prohibition G)", async () => {
    // Neither ДБН А.3.1-5:2016 nor ДСТУ 9258:2023 says which position takes
    // which act form, so a mapping must be unable to claim a source.
    expect(await sqlstate(() => insertLibrary({
      item_no: 2, act_form_assumption: "dodatok_v", act_form_basis: "standard",
    }))).toBe("23514");
    expect(await sqlstate(() => insertLibrary({
      item_no: 2, act_form_assumption: "dodatok_d",
    }))).toBe("23514");
  });

  it("is append-only: a stored item is neither edited nor deleted", async () => {
    const id = a.libraryItemIds.get("Н.14/1");
    expect(id).toBeTruthy();
    // app.reject_mutation() (0013:5-9) raises
    // '<table> is immutable (append-only relation)'.
    expect(await raised(() => c.query(
      `update public.requirement_library_items set item_text_uk = 'змінено' where id = $1`,
      [id]))).toMatch(/is immutable \(append-only relation\)/);
    expect(await raised(() => c.query(
      `delete from public.requirement_library_items where id = $1`, [id])))
      .toMatch(/is immutable \(append-only relation\)/);
  });
});

describe("a published rule version is immutable (INV-067)", () => {
  it("refuses every content UPDATE, even from the table owner", async () => {
    const rv = await seedRuleVersion(c, a);
    const message = await raised(() => c.query(
      `update public.requirement_rule_versions set acceptance_criterion = 'змінено' where id = $1`,
      [rv.ruleVersionId]));
    expect(message).toMatch(/INV-067/);

    const after = await c.query<{ acceptance_criterion: string }>(
      `select acceptance_criterion from public.requirement_rule_versions where id = $1`,
      [rv.ruleVersionId]);
    expect(after.rows[0]!.acceptance_criterion).not.toBe("змінено");
  });

  it("refuses DELETE", async () => {
    const rv = await seedRuleVersion(c, a);
    expect(await raised(() => c.query(
      `delete from public.requirement_rule_versions where id = $1`, [rv.ruleVersionId])))
      .toMatch(/not deletable/i);
    const still = await c.query(
      `select 1 from public.requirement_rule_versions where id = $1`, [rv.ruleVersionId]);
    expect(still.rows).toHaveLength(1);
  });

  it("gives the application role no UPDATE and no DELETE to use", async () => {
    // The grant is the first layer and the guard is the second. Asserted
    // separately because a guard whose grant was quietly restored would still
    // look fine from the message of a single failed statement.
    const rv = await seedRuleVersion(c, a);
    expect(await sqlstate(() => asActor(USER_A, WS_A, (cl) => cl.query(
      `update public.requirement_rule_versions set ordinal = 9 where id = $1`,
      [rv.ruleVersionId])))).toBe("42501");
    expect(await sqlstate(() => asActor(USER_A, WS_A, (cl) => cl.query(
      `delete from public.requirement_rule_versions where id = $1`, [rv.ruleVersionId]))))
      .toBe("42501");
  });

  it("admits exactly one transition, and it does not touch frozen content", async () => {
    const rv = await seedRuleVersion(c, a);
    const before = await c.query<{ rule_version_hash: string; acceptance_criterion: string; published_at: Date }>(
      `select rule_version_hash, acceptance_criterion, published_at
         from public.requirement_rule_versions where id = $1`, [rv.ruleVersionId]);

    await asActor(USER_A, WS_A, (cl) =>
      cl.query(`select app.retire_requirement_rule_version($1,$2)`, [WS_A, rv.ruleVersionId]));

    const after = await c.query<{
      status: string; retired_at: Date | null; retired_by_member_id: string | null;
      rule_version_hash: string; acceptance_criterion: string; published_at: Date;
      has_been_published: boolean;
    }>(`select status, retired_at, retired_by_member_id, rule_version_hash,
               acceptance_criterion, published_at, has_been_published
          from public.requirement_rule_versions where id = $1`, [rv.ruleVersionId]);
    const row = after.rows[0]!;
    expect(row.status).toBe("retired");
    expect(row.retired_at).not.toBeNull();
    expect(row.retired_by_member_id).toBe(a.memberId);
    // The frozen content is untouched, and published_at in particular: retiring
    // a version must leave every baseline that already bound it able to keep
    // resolving the same key, which is what has_been_published is for.
    expect(row.rule_version_hash).toBe(before.rows[0]!.rule_version_hash);
    expect(row.acceptance_criterion).toBe(before.rows[0]!.acceptance_criterion);
    expect(row.published_at.toISOString()).toBe(before.rows[0]!.published_at.toISOString());
    expect(row.has_been_published).toBe(true);
  });

  it("answers a second retirement with the ORIGINAL timestamp rather than a fresh one", async () => {
    // scope-v0.1.csv:30 makes retirement idempotency-required, and re-stamping
    // it would rewrite when future binding stopped.
    const rv = await seedRuleVersion(c, a);
    await asActor(USER_A, WS_A, (cl) =>
      cl.query(`select app.retire_requirement_rule_version($1,$2)`, [WS_A, rv.ruleVersionId]));
    const first = await c.query<{ retired_at: Date }>(
      `select retired_at from public.requirement_rule_versions where id = $1`, [rv.ruleVersionId]);
    await asActor(USER_A, WS_A, (cl) =>
      cl.query(`select app.retire_requirement_rule_version($1,$2)`, [WS_A, rv.ruleVersionId]));
    const second = await c.query<{ retired_at: Date }>(
      `select retired_at from public.requirement_rule_versions where id = $1`, [rv.ruleVersionId]);
    expect(second.rows[0]!.retired_at.toISOString())
      .toBe(first.rows[0]!.retired_at.toISOString());
  });

  it("refuses a retirement that also alters content, and one that records no retiree", async () => {
    const rv = await seedRuleVersion(c, a);
    expect(await raised(() => c.query(
      `update public.requirement_rule_versions
          set status = 'retired', retired_at = now(), retired_by_member_id = $2,
              acceptance_criterion = 'змінено'
        where id = $1`, [rv.ruleVersionId, a.memberId])))
      .toMatch(/must not alter frozen rule-version content/);

    expect(await raised(() => c.query(
      `update public.requirement_rule_versions set status = 'retired' where id = $1`,
      [rv.ruleVersionId]))).toMatch(/must record retired_at/);

    const untouched = await c.query<{ status: string }>(
      `select status from public.requirement_rule_versions where id = $1`, [rv.ruleVersionId]);
    expect(untouched.rows[0]!.status).toBe("published");
  });

  it("refuses a workspace outsider's retirement before it reads anything", async () => {
    // The authorization runs first so a raise cannot become a cross-tenant
    // oracle: B is told they are not authorized, never whether the id exists.
    const rv = await seedRuleVersion(c, a);
    expect(await raised(() => asActor(USER_B, WS_B, (cl) =>
      cl.query(`select app.retire_requirement_rule_version($1,$2)`, [WS_A, rv.ruleVersionId]))))
      .toMatch(/not authorized/);
    const still = await c.query<{ status: string }>(
      `select status from public.requirement_rule_versions where id = $1`, [rv.ruleVersionId]);
    expect(still.rows[0]!.status).toBe("published");
  });
});

describe("what a baseline may bind", () => {
  it("binds a published rule version to a DRAFT contract version", async () => {
    // The positive case first: without it every refusal below would also hold
    // for a table that refuses everything.
    const rv = await seedRuleVersion(c, a, { stageKey: "stage-ok" });
    const [sql, params] = bindingValues(a, {
      contractVersionId: a.draftVersionId,
      requirementRuleId: rv.requirementRuleId,
      ruleVersionId: rv.ruleVersionId,
      stageKey: rv.stageKey,
    });
    expect(await sqlstate(() => c.query(sql, params))).toBeNull();
  });

  it("refuses a rule version belonging to another workspace — trigger AND foreign key", async () => {
    const foreign = await seedRuleVersion(c, b, { stageKey: "stage-foreign" });
    const [sql, params] = bindingValues(a, {
      contractVersionId: a.draftVersionId,
      requirementRuleId: foreign.requirementRuleId,
      ruleVersionId: foreign.ruleVersionId,
      stageKey: foreign.stageKey,
    });
    // The trigger reads under the inserting role and finds nothing in this
    // workspace, so it names the tenant and never the other workspace's state.
    expect(await raised(() => c.query(sql, params)))
      .toMatch(/not visible in this workspace/);

    // And with the trigger off, the composite key still refuses it. This is the
    // half that survives somebody deleting the trigger.
    await withTriggerDisabled(
      "contract_version_rule_bindings", "contract_version_rule_bindings_rule_version_guard",
      async () => {
        expect(await sqlstate(() => c.query(sql, params))).toBe("23503");
      });

    const none = await c.query(
      `select count(*)::int n from public.contract_version_rule_bindings
        where requirement_rule_version_id = $1`, [foreign.ruleVersionId]);
    expect(none.rows[0].n).toBe(0);
  });

  it("refuses an UNPUBLISHED rule version — trigger AND the has_been_published key", async () => {
    // A draft rule version is unreachable through the application role
    // (`rrv_insert` admits status = 'published' only), so it is seeded here from
    // the owner connection precisely so the refusal can be attempted at all.
    const draft = await seedRuleVersion(c, a, { status: "draft", stageKey: "stage-draft" });
    const [sql, params] = bindingValues(a, {
      contractVersionId: a.draftVersionId,
      requirementRuleId: draft.requirementRuleId,
      ruleVersionId: draft.ruleVersionId,
      stageKey: draft.stageKey,
    });
    expect(await raised(() => c.query(sql, params))).toMatch(/cannot be bound to a baseline/);

    await withTriggerDisabled(
      "contract_version_rule_bindings", "contract_version_rule_bindings_rule_version_guard",
      async () => {
        // The literal discriminator: bound_rule_version_is_published defaults to
        // true and is CHECK-forced true, and the draft's generated
        // has_been_published is false, so no row satisfies the key.
        expect(await sqlstate(() => c.query(sql, params))).toBe("23503");
      });
  });

  it("refuses a RETIRED rule version, because retirement stops FUTURE binding", async () => {
    const rv = await seedRuleVersion(c, a, { stageKey: "stage-retired" });
    await asActor(USER_A, WS_A, (cl) =>
      cl.query(`select app.retire_requirement_rule_version($1,$2)`, [WS_A, rv.ruleVersionId]));
    const [sql, params] = bindingValues(a, {
      contractVersionId: a.draftVersionId,
      requirementRuleId: rv.requirementRuleId,
      ruleVersionId: rv.ruleVersionId,
      stageKey: rv.stageKey,
    });
    const message = await raised(() => c.query(sql, params));
    expect(message).toMatch(/retired/);
    expect(message).toMatch(/INV-067/);
  });

  it("keeps a binding made BEFORE the retirement resolvable", async () => {
    // The other half of INV-067, and the reason retirement is a trigger on the
    // binding rather than a foreign key: a copied 'published' literal would be
    // re-validated on retirement and would make it fail for every version a
    // baseline had bound.
    const rv = await seedRuleVersion(c, a, { stageKey: "stage-bound-then-retired" });
    const [sql, params] = bindingValues(a, {
      contractVersionId: a.draftVersionId,
      requirementRuleId: rv.requirementRuleId,
      ruleVersionId: rv.ruleVersionId,
      stageKey: rv.stageKey,
    });
    expect(await sqlstate(() => c.query(sql, params))).toBeNull();

    // Retiring a BOUND version must still succeed. It is asserted by letting
    // the call throw rather than by catching it: a swallowed failure here would
    // leave the row published and the next assertion would pass for the wrong
    // reason.
    await asActor(USER_A, WS_A, (cl) =>
      cl.query(`select app.retire_requirement_rule_version($1,$2)`, [WS_A, rv.ruleVersionId]));

    const still = await c.query(
      `select 1 from public.contract_version_rule_bindings
        where workspace_id = $1 and requirement_rule_version_id = $2`,
      [WS_A, rv.ruleVersionId]);
    expect(still.rows).toHaveLength(1);
  });

  it("refuses a binding that misreports the stage its rule version names", async () => {
    const rv = await seedRuleVersion(c, a, { stageKey: "stage-true" });
    const [sql, params] = bindingValues(a, {
      contractVersionId: a.draftVersionId,
      requirementRuleId: rv.requirementRuleId,
      ruleVersionId: rv.ruleVersionId,
      stageKey: "stage-invented",
    });
    expect(await sqlstate(() => c.query(sql, params))).toBe("23503");
  });

  it("lets one rule contribute at most one version to a baseline", async () => {
    const lineage = (await c.query<{ id: string }>("select gen_random_uuid() as id")).rows[0]!.id;
    const v1 = await seedRuleVersion(c, a,
      { requirementRuleId: lineage, versionNo: 1, stageKey: "stage-lineage" });
    const v2 = await seedRuleVersion(c, a,
      { requirementRuleId: lineage, versionNo: 2, stageKey: "stage-lineage" });

    const bind = (ruleVersionId: string) => {
      const [sql, params] = bindingValues(a, {
        contractVersionId: a.draftVersionId, requirementRuleId: lineage,
        ruleVersionId, stageKey: "stage-lineage",
      });
      return c.query(sql, params);
    };
    expect(await sqlstate(() => bind(v1.ruleVersionId))).toBeNull();
    // Two versions of one rule inside one published baseline would make "what
    // was agreed" ambiguous, and reproducibility is the whole point.
    expect(await sqlstate(() => bind(v2.ruleVersionId))).toBe("23505");
  });

  it("refuses a binding added AFTER the contract version was published (INV-080)", async () => {
    // The insert window is: the version is still a draft, or the version was
    // created by THIS transaction. Neither holds here, and a rule published
    // after a baseline must never retroactively enter it.
    const rv = await seedRuleVersion(c, a, { stageKey: "stage-late" });
    const [sql, params] = bindingValues(a, {
      contractVersionId: a.publishedVersionId,
      requirementRuleId: rv.requirementRuleId,
      ruleVersionId: rv.ruleVersionId,
      stageKey: rv.stageKey,
    });
    expect(await raised(() => c.query(sql, params))).toMatch(/INV-080/);

    const none = await c.query(
      `select count(*)::int n from public.contract_version_rule_bindings
        where workspace_id = $1 and contract_version_id = $2`, [WS_A, a.publishedVersionId]);
    expect(none.rows[0].n).toBe(0);
  });

  it("is append-only: a binding is neither edited nor deleted", async () => {
    const one = await c.query<{ id: string }>(
      `select id from public.contract_version_rule_bindings
        where workspace_id = $1 and contract_version_id = $2 limit 1`,
      [WS_A, a.draftVersionId]);
    const id = one.rows[0]!.id;
    // There is no unbind operation in v0.1. A caller that bound the wrong rule
    // while the version is still a draft starts a new draft; that is a real
    // cost of append-only and it is asserted rather than papered over.
    expect(await raised(() => c.query(
      `update public.contract_version_rule_bindings set stage_key = 'інша' where id = $1`, [id])))
      .toMatch(/is immutable \(append-only relation\)/);
    expect(await raised(() => c.query(
      `delete from public.contract_version_rule_bindings where id = $1`, [id])))
      .toMatch(/is immutable \(append-only relation\)/);
  });
});
