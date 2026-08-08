import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor } from "./pg";
import {
  dropRulesWorkspaces, seedRuleVersion, seedRulesWorld, sqlstate,
  type RulesFixture,
} from "./m1-rules-fixture";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `vitest`, `tsc`, `psql` and `supabase` were never run against it, no
 * migration was applied, and no claim is made that any assertion below passes.
 * Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * INV-001 on the three tables migration 0041 adds: a workspace's requirement
 * library, its rule versions and its baselines' bindings are invisible and
 * unwritable from any other tenant, AND — the half migration 0014 exists
 * because M1 got wrong — a write policy asks for the CAPABILITY the command
 * checks and not merely for membership.
 *
 * EACH CASE ATTEMPTS THE READ OR THE WRITE. A count query with a WHERE clause
 * proves nothing about RLS; every isolation assertion below fetches the SAME
 * row set as the permitted actor and differs only in who is asking.
 *
 * WHICH LAYER ANSWERS IS NAMED WHERE IT IS NOT 42501. Two of the three tables
 * carry BEFORE INSERT triggers that read under the inserting role, so a
 * cross-tenant insert is refused by the trigger's own "not visible in this
 * workspace" before the policy's WITH CHECK is ever evaluated. That is still a
 * refusal and still fails closed; the tests say so rather than asserting a
 * SQLSTATE that would be right for the wrong reason.
 */

const WS_A = "fbbb1111-1111-1111-1111-111111111111";
const WS_B = "fbbb2222-2222-2222-2222-222222222222";
const USER_A = "fbbb3333-3333-3333-3333-333333333333";
const USER_B = "fbbb4444-4444-4444-4444-444444444444";
/** An active `member` of workspace A holding no project grant at all. */
const USER_M = "fbbb5555-5555-5555-5555-555555555555";

let c: Client;
let a: RulesFixture;
let b: RulesFixture;
let memberIdM: string;
let ruleVersionA: string;
let ruleRuleA: string;
let stageA: string;
let libraryItemA: string;

/** Rows of `table` this actor can actually see, asked by id and nothing else. */
async function visible(
  user: string, workspace: string, table: string, id: string,
): Promise<number> {
  const r = await asActor(user, workspace, (cl) =>
    cl.query(`select 1 from public.${table} where id = $1`, [id]));
  return r.rows.length;
}

beforeAll(async () => {
  c = await adminClient();
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  a = await seedRulesWorld(c, { workspaceId: WS_A, userId: USER_A, suffix: "RA" });
  b = await seedRulesWorld(c, { workspaceId: WS_B, userId: USER_B, suffix: "RB" });

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

  const rv = await seedRuleVersion(c, a, { stageKey: "stage-rls" });
  ruleVersionA = rv.ruleVersionId;
  ruleRuleA = rv.requirementRuleId;
  stageA = rv.stageKey;

  const lib = a.libraryItemIds.get("Н.14/1");
  if (!lib) throw new Error("m1-rules-rls: the fixture seeded no Н.14/1 library item");
  libraryItemA = lib;

  // One binding on A's DRAFT version, so the read tests have something to see
  // and the write tests have a positive control to sit beside.
  await c.query(
    `insert into public.contract_version_rule_bindings
       (workspace_id, project_id, contract_id, contract_version_id,
        requirement_rule_id, requirement_rule_version_id, stage_key, bound_by_member_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [WS_A, a.projectId, a.contractId, a.draftVersionId, ruleRuleA, ruleVersionA, stageA,
     a.memberId]);
}, 120_000);

afterAll(async () => {
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  await c.end();
});

describe("requirement_library_items — tenant isolation", () => {
  it("is readable by any ACTIVE MEMBER of its own workspace, and by nobody else", async () => {
    expect(await visible(USER_A, WS_A, "requirement_library_items", libraryItemA)).toBe(1);
    // Not merely by owner and admin. `rli_select` (0041:750-751) asks for active
    // membership, because ADR-006 step 2 has the FOREMAN reading the obligation
    // before work starts and a foreman holds the `member` governance role.
    // technical/permissions/capabilities.csv:9 files requirement_library.list
    // under requirement_rules.manage (owner/admin) and therefore disagrees with
    // the deployed policy; docs/README.md §"Source of truth" puts an applied
    // migration above the permission catalog, so THE CSV OWES A CORRECTION and
    // this assertion is what would go red if the policy were narrowed to match
    // it instead.
    expect(await visible(USER_M, WS_A, "requirement_library_items", libraryItemA)).toBe(1);
    expect(await visible(USER_B, WS_B, "requirement_library_items", libraryItemA)).toBe(0);
  });

  it("refuses an insert carrying another workspace's id", async () => {
    expect(await sqlstate(() => asActor(USER_B, WS_B, (cl) => cl.query(
      `insert into public.requirement_library_items
         (workspace_id, source_standard, position_code, position_title_uk,
          item_no, item_text_uk, verification, source_citation)
       values ($1,'ДБН А.3.1-5:2016','Н.15','Монтаж електротехнічних установок',
               7,'Приклад-текст.','VERIFIED_PRIMARY','Приклад-джерело')`,
      [WS_A])))).toBe("42501");
  });

  it("refuses an insert by a plain member of its OWN workspace", async () => {
    // Content is a repository change under hidden-works-content-rules.md, and
    // the only INSERT v0.1 performs is the per-workspace materialisation by the
    // owner or admin who provisions the workspace.
    expect(await sqlstate(() => asActor(USER_M, WS_A, (cl) => cl.query(
      `insert into public.requirement_library_items
         (workspace_id, source_standard, position_code, position_title_uk,
          item_no, item_text_uk, verification, source_citation)
       values ($1,'ДБН А.3.1-5:2016','Н.15','Монтаж електротехнічних установок',
               7,'Приклад-текст.','VERIFIED_PRIMARY','Приклад-джерело')`,
      [WS_A])))).toBe("42501");
  });
});

describe("requirement_rule_versions — tenant isolation and the publication-only write", () => {
  const insertRuleVersion = (
    user: string, actorWorkspace: string, rowWorkspace: string,
    status: string, memberId: string,
  ) => asActor(user, actorWorkspace, (cl) => cl.query(
    // allowed_media is written EXPLICITLY, and it was not before: migration 0044
    // requires the {mimeTypes, maxByteSize} object for 'photo' and 'document'
    // (requirement_rule_versions_allowed_media_check), and the column's default
    // is '[]'. Relying on the default here made every case in this describe
    // block fail with a 23514 the moment 0044 applied — including the positive
    // control, which is what would have made the failure legible.
    `insert into public.requirement_rule_versions
       (workspace_id, requirement_rule_id, version_no, ordinal, status,
        work_type_key, stage_key, intervention_type, blocking_scope, timing,
        evidence_kind, acceptance_criterion, performer_role, approver_role,
        requirement_library_item_id, allowed_media, rule_version_hash, published_at,
        published_by_member_id, created_by_member_id)
     values ($1::uuid, gen_random_uuid(), 1, 1, $2::text,
             'montazh-elektrotekhnichnykh-ustanovok','stage-policy','hold',
             'blocks_stage_closure','before_concealment','photo',
             'Приклад-критерій приймання.','foreman','technical_supervisor',
             $3::uuid,
             '{"mimeTypes":["image/jpeg"],"maxByteSize":5242880}'::jsonb,
             case when $2::text = 'draft' then null else repeat('a',64) end,
             case when $2::text = 'draft' then null else now() end,
             case when $2::text = 'draft' then null else $4::uuid end,
             $4::uuid)`,
    [rowWorkspace, status, libraryItemA, memberId]));

  it("is readable by any active member of its own workspace, and by nobody else", async () => {
    expect(await visible(USER_A, WS_A, "requirement_rule_versions", ruleVersionA)).toBe(1);
    // A baseline in any project of the workspace can bind these, so the read is
    // workspace-wide rather than project-scoped.
    expect(await visible(USER_M, WS_A, "requirement_rule_versions", ruleVersionA)).toBe(1);
    expect(await visible(USER_B, WS_B, "requirement_rule_versions", ruleVersionA)).toBe(0);
  });

  it("lets an owner publish one — the positive control the refusals need", async () => {
    expect(await sqlstate(() => insertRuleVersion(USER_A, WS_A, WS_A, "published", a.memberId)))
      .toBeNull();
  });

  it("refuses a DRAFT even from the owner", async () => {
    // v0.1 has no rule-drafting operation, there is no UPDATE grant, and the
    // guard admits only published -> retired — so a draft written here could
    // never be published and would be a permanently dead obligation. v0.2's
    // drafting slice REPLACES this policy; the CHECK vocabulary already carries
    // 'draft' so that replacement is additive.
    expect(await sqlstate(() => insertRuleVersion(USER_A, WS_A, WS_A, "draft", a.memberId)))
      .toBe("42501");
  });

  it("refuses a plain member, who holds no requirement_rules.manage", async () => {
    expect(await sqlstate(() => insertRuleVersion(USER_M, WS_A, WS_A, "published", memberIdM)))
      .toBe("42501");
  });

  it("refuses an insert carrying another workspace's id", async () => {
    expect(await sqlstate(() => insertRuleVersion(USER_B, WS_B, WS_A, "published", a.memberId)))
      .toBe("42501");
  });
});

describe("contract_version_rule_bindings — project capability, not membership", () => {
  let bindingA: string;

  beforeAll(async () => {
    const r = await c.query<{ id: string }>(
      `select id from public.contract_version_rule_bindings
        where workspace_id = $1 and contract_version_id = $2 limit 1`,
      [WS_A, a.draftVersionId]);
    bindingA = r.rows[0]!.id;
  });

  const insertBinding = (
    user: string, actorWorkspace: string, f: RulesFixture,
    ruleVersionId: string, requirementRuleId: string, stageKey: string, memberId: string,
  ) => asActor(user, actorWorkspace, (cl) => cl.query(
    `insert into public.contract_version_rule_bindings
       (workspace_id, project_id, contract_id, contract_version_id,
        requirement_rule_id, requirement_rule_version_id, stage_key, bound_by_member_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [f.workspaceId, f.projectId, f.contractId, f.draftVersionId,
     requirementRuleId, ruleVersionId, stageKey, memberId]));

  it("is readable only through a project capability, never through membership alone", async () => {
    expect(await visible(USER_A, WS_A, "contract_version_rule_bindings", bindingA)).toBe(1);
    // USER_M is an active member of the SAME workspace with no grant on the
    // project. This is the 0014 regression class: a policy that asked only "is
    // the actor an active member?" would return the row here.
    expect(await visible(USER_M, WS_A, "contract_version_rule_bindings", bindingA)).toBe(0);
    expect(await visible(USER_B, WS_B, "contract_version_rule_bindings", bindingA)).toBe(0);
  });

  it("stays hidden once the reader's project grant is revoked", async () => {
    await c.query(
      `update public.project_access_grants set revoked_at = now()
        where workspace_id = $1 and member_id = $2
          and capability in ('project.view','project.admin')`, [WS_A, a.memberId]);
    try {
      expect(await visible(USER_A, WS_A, "contract_version_rule_bindings", bindingA)).toBe(0);
    } finally {
      await c.query(
        `update public.project_access_grants set revoked_at = null
          where workspace_id = $1 and member_id = $2
            and capability in ('project.view','project.admin')`, [WS_A, a.memberId]);
    }
  });

  it("admits an insert under rule_bindings.manage", async () => {
    const rv = await seedRuleVersion(c, a, { stageKey: "stage-manage" });
    expect(await sqlstate(() => insertBinding(
      USER_A, WS_A, a, rv.ruleVersionId, rv.requirementRuleId, rv.stageKey, a.memberId)))
      .toBeNull();
  });

  it("admits an insert under imports.publish, because INV-083 binds on BOTH routes", async () => {
    // contract_versions.bind_rules runs under rule_bindings.manage and
    // import_batches.publish runs under imports.publish; a baseline published by
    // the importer must be able to pin the same set in its own transaction, or
    // the invariant holds on one route and not the other.
    await c.query(
      `update public.project_access_grants set revoked_at = now()
        where workspace_id = $1 and member_id = $2 and capability = 'rule_bindings.manage'`,
      [WS_A, a.memberId]);
    try {
      const rv = await seedRuleVersion(c, a, { stageKey: "stage-importer" });
      expect(await sqlstate(() => insertBinding(
        USER_A, WS_A, a, rv.ruleVersionId, rv.requirementRuleId, rv.stageKey, a.memberId)))
        .toBeNull();
    } finally {
      await c.query(
        `update public.project_access_grants set revoked_at = null
          where workspace_id = $1 and member_id = $2 and capability = 'rule_bindings.manage'`,
        [WS_A, a.memberId]);
    }
  });

  it("refuses an insert from a member holding neither capability", async () => {
    // project.view is granted FOR THIS TEST ONLY and taken back afterwards, so
    // the read assertions above cannot be quietly weakened by an ordering
    // change. It is granted at all because both BEFORE INSERT triggers read
    // under the inserting role: without it the refusal would come from
    // app.guard_rule_binding_window() failing to see the contract version, and
    // this test is about the policy's WITH CHECK and nothing else.
    await c.query(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,'project.view',$4) on conflict do nothing`,
      [WS_A, a.projectId, memberIdM, USER_A]);
    try {
      const rv = await seedRuleVersion(c, a, { stageKey: "stage-denied" });
      expect(await sqlstate(() => insertBinding(
        USER_M, WS_A, a, rv.ruleVersionId, rv.requirementRuleId, rv.stageKey, memberIdM)))
        .toBe("42501");

      const none = await c.query(
        `select count(*)::int n from public.contract_version_rule_bindings
          where requirement_rule_version_id = $1`, [rv.ruleVersionId]);
      expect(none.rows[0].n).toBe(0);
    } finally {
      await c.query(
        `delete from public.project_access_grants
          where workspace_id = $1 and project_id = $2 and member_id = $3`,
        [WS_A, a.projectId, memberIdM]);
    }
  });

  it("refuses an insert into another workspace's baseline", async () => {
    // Refused by a BEFORE INSERT guard rather than by the policy's WITH CHECK,
    // and the guard that answers is app.guard_rule_binding_window() — PostgreSQL
    // fires BEFORE row triggers in NAME order and
    // contract_version_rule_bindings_insert_window sorts before
    // ..._rule_version_guard ('i' precedes 'r'), which is the opposite of what
    // migration 0042:461-463 claims. Either way both guards read under the
    // inserting role and are NOT security definer, so B sees neither A's
    // contract version nor A's rule version and the insert fails closed. The
    // message names the tenant the caller already claimed and never the other
    // workspace's state, which is why it is safe to assert on.
    const rv = await seedRuleVersion(c, a, { stageKey: "stage-crosstenant" });
    let message = "";
    try {
      await insertBinding(USER_B, WS_B, a, rv.ruleVersionId, rv.requirementRuleId,
        rv.stageKey, a.memberId);
    } catch (e) { message = (e as Error).message; }
    expect(message).toMatch(/not visible in this workspace/);

    const none = await c.query(
      `select count(*)::int n from public.contract_version_rule_bindings
        where requirement_rule_version_id = $1`, [rv.ruleVersionId]);
    expect(none.rows[0].n).toBe(0);
  });

  it("keeps B's own baseline bindable, so the refusals above are about the tenant", async () => {
    const rv = await seedRuleVersion(c, b, { stageKey: "stage-b-own" });
    expect(await sqlstate(() => insertBinding(
      USER_B, WS_B, b, rv.ruleVersionId, rv.requirementRuleId, rv.stageKey, b.memberId)))
      .toBeNull();
  });
});
