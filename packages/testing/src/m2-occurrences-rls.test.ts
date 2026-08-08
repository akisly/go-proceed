import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor } from "./pg";
import {
  dropRulesWorkspaces, seedRulesWorld, sqlstate, type RulesFixture,
} from "./m1-rules-fixture";
import {
  OCCURRENCE_INSERT, occurrenceParams, seedOccurrenceWorld,
  type OccurrenceSeed, type OccurrenceWorld,
} from "./m2-occurrences-fixture";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `vitest`, `tsc`, `psql` and `supabase` were never run against it, no
 * migration was applied, and no claim is made that any assertion below passes.
 * Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * INV-001 on the two tables migration 0043 adds: one workspace's stages and
 * obligations are invisible and unwritable from any other tenant, AND — the half
 * migration 0014 exists because M1 got wrong — the write policy asks for the
 * CAPABILITY the command checks rather than for membership or for an
 * administrator's blanket grant.
 *
 * EACH CASE ATTEMPTS THE READ OR THE WRITE. A count query with a WHERE clause
 * proves nothing about RLS; every isolation assertion below fetches the SAME row
 * by the SAME id and differs only in who is asking.
 *
 * WHY project.admin IS NOT ENOUGH TO INSERT, AND WHY THAT IS THE POINT.
 * `app.has_project_capability` (0011:20-32) matches the capability literally: no
 * capability implies another. `ws_insert` and `ro_insert` name `assignments.manage`
 * because the command that inserts is `assignments.create`, and the seeded owner
 * below deliberately holds project.admin WITHOUT it — so the first insert case
 * proves the policy is a capability check and not a role check, and the second
 * proves the capability the route uses actually satisfies it. Both halves are
 * needed: a policy nobody can satisfy fails closed and is still broken.
 */

const WS_A = "fddd1111-1111-1111-1111-111111111111";
const WS_B = "fddd2222-2222-2222-2222-222222222222";
const USER_A = "fddd3333-3333-3333-3333-333333333333";
const USER_B = "fddd4444-4444-4444-4444-444444444444";
/** An active `member` of workspace A holding no project grant at all. */
const USER_M = "fddd5555-5555-5555-5555-555555555555";

let c: Client;
let a: RulesFixture;
let b: RulesFixture;
let wa: OccurrenceWorld;
let wb: OccurrenceWorld;
let memberIdM: string;
/** One occurrence of A, written by the fixture so the READ cases have a subject. */
let occurrenceA: string;

async function visible(
  user: string, workspace: string, table: string, id: string,
): Promise<number> {
  const r = await asActor(user, workspace, (cl) =>
    cl.query(`select 1 from public.${table} where id = $1`, [id]));
  return r.rows.length;
}

/** Grants one capability to one member for the duration of `fn`. */
async function withCapability<T>(
  f: RulesFixture, memberId: string, capability: string, fn: () => Promise<T>,
): Promise<T> {
  await c.query(
    `insert into public.project_access_grants
       (workspace_id, project_id, member_id, capability, granted_by)
     values ($1,$2,$3,$4,$5)`,
    [f.workspaceId, f.projectId, memberId, capability, f.userId]);
  try {
    return await fn();
  } finally {
    await c.query(
      `delete from public.project_access_grants
        where workspace_id = $1 and project_id = $2 and member_id = $3 and capability = $4`,
      [f.workspaceId, f.projectId, memberId, capability]);
  }
}

async function purgeOccurrences(workspaceId: string): Promise<void> {
  await c.query(`alter table public.requirement_occurrences disable trigger user`);
  try {
    await c.query(
      `delete from public.requirement_occurrences where workspace_id = $1
        and id <> $2`, [workspaceId, occurrenceA]);
  } finally {
    await c.query(`alter table public.requirement_occurrences enable trigger user`);
  }
}

beforeAll(async () => {
  c = await adminClient();
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  a = await seedRulesWorld(c, { workspaceId: WS_A, userId: USER_A, suffix: "PA" });
  b = await seedRulesWorld(c, { workspaceId: WS_B, userId: USER_B, suffix: "PB" });
  wa = await seedOccurrenceWorld(c, a);
  wb = await seedOccurrenceWorld(c, b);

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

  const r = await c.query<{ id: string }>(OCCURRENCE_INSERT, occurrenceParams(wa));
  occurrenceA = r.rows[0]!.id;
}, 120_000);

afterAll(async () => {
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  await c.end();
});

describe("work_stages — tenant isolation and the capability the command checks", () => {
  it("is readable through project.view, and not through membership alone", async () => {
    expect(await visible(USER_A, WS_A, "work_stages", wa.stageId)).toBe(1);
    // USER_M is an active member of the SAME workspace with no grant on the
    // project. This is the 0014 regression class: a policy asking only «is the
    // actor an active member?» would return the row here.
    expect(await visible(USER_M, WS_A, "work_stages", wa.stageId)).toBe(0);
    expect(await visible(USER_B, WS_B, "work_stages", wa.stageId)).toBe(0);
  });

  it("stays hidden once the reader's project grant is revoked", async () => {
    await c.query(
      `update public.project_access_grants set revoked_at = now()
        where workspace_id = $1 and member_id = $2
          and capability in ('project.view','project.admin')`, [WS_A, a.memberId]);
    try {
      expect(await visible(USER_A, WS_A, "work_stages", wa.stageId)).toBe(0);
    } finally {
      await c.query(
        `update public.project_access_grants set revoked_at = null
          where workspace_id = $1 and member_id = $2
            and capability in ('project.view','project.admin')`, [WS_A, a.memberId]);
    }
  });

  const insertStage = (
    user: string, actorWorkspace: string, f: RulesFixture, w: OccurrenceWorld,
    stageKey: string, memberId: string,
  ) => asActor(user, actorWorkspace, (cl) => cl.query(
    `insert into public.work_stages
       (workspace_id, project_id, contract_id, contract_version_id,
        work_assignment_id, stage_key, is_concealed, created_by_member_id)
     values ($1,$2,$3,$4,$5,$6,true,$7)`,
    [f.workspaceId, f.projectId, f.contractId, w.baselineVersionId,
     w.assignmentId, stageKey, memberId]));

  it("refuses an insert from the project ADMINISTRATOR, who lacks assignments.manage", async () => {
    // Not defensive pedantry: capabilities.csv:18 puts «the work stages beneath
    // them» under assignments.manage, and project.admin is a different
    // capability held by a different preset. A policy that admitted the
    // administrator would be a role check wearing a capability's name.
    expect(await sqlstate(() =>
      insertStage(USER_A, WS_A, a, wa, "stage-rls-admin", a.memberId))).toBe("42501");
  });

  it("admits an insert under assignments.manage, which is what the route holds", async () => {
    await withCapability(a, a.memberId, "assignments.manage", async () => {
      expect(await sqlstate(() =>
        insertStage(USER_A, WS_A, a, wa, "stage-rls-granted", a.memberId))).toBeNull();
    });
  });

  it("refuses an insert carrying another workspace's id", async () => {
    // B holds every capability in B and none in A. The row names A's workspace,
    // project and assignment; the WITH CHECK is evaluated for A's project and B
    // has no grant there.
    await withCapability(b, b.memberId, "assignments.manage", async () => {
      expect(await sqlstate(() =>
        insertStage(USER_B, WS_B, a, wa, "stage-rls-crosstenant", a.memberId))).toBe("42501");
    });
    const none = await c.query<{ n: number }>(
      `select count(*)::int as n from public.work_stages
        where workspace_id = $1 and stage_key = 'stage-rls-crosstenant'`, [WS_A]);
    expect(none.rows[0]!.n).toBe(0);
  });

  it("keeps B's own stages insertable, so the refusals above are about the tenant", async () => {
    await withCapability(b, b.memberId, "assignments.manage", async () => {
      expect(await sqlstate(() =>
        insertStage(USER_B, WS_B, b, wb, "stage-rls-b-own", b.memberId))).toBeNull();
    });
  });
});

describe("requirement_occurrences — tenant isolation and the foreman's read", () => {
  it("is readable through project.view, and not through membership alone", async () => {
    // project.view and NOT something narrower, because capabilities.csv:14 makes
    // this how the foreman reads the obligation set before work starts (ADR-006
    // step 2). A stricter policy would make the central M2 screen unreachable
    // for the persona it was built for — and the read is what the upload gate
    // performs too, so a foreman who cannot see the row here cannot capture
    // against it either.
    expect(await visible(USER_A, WS_A, "requirement_occurrences", occurrenceA)).toBe(1);
    expect(await visible(USER_M, WS_A, "requirement_occurrences", occurrenceA)).toBe(0);
    expect(await visible(USER_B, WS_B, "requirement_occurrences", occurrenceA)).toBe(0);
  });

  it("is invisible to a member of A holding project.view on a DIFFERENT project", async () => {
    // The grant is per project, not per workspace. This is the case a
    // workspace-scoped policy gets wrong while looking correct in every
    // single-project fixture, so the second project is created here rather than
    // assumed.
    const other = await c.query<{ id: string }>(
      `insert into public.projects (workspace_id, name, created_by)
       values ($1,'Приклад-Інший-проєкт',$2) returning id`, [WS_A, USER_A]);
    await c.query(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,'project.view',$4)`,
      [WS_A, other.rows[0]!.id, memberIdM, USER_A]);
    try {
      expect(await visible(USER_M, WS_A, "requirement_occurrences", occurrenceA)).toBe(0);
    } finally {
      await c.query(
        `delete from public.project_access_grants where workspace_id = $1 and project_id = $2`,
        [WS_A, other.rows[0]!.id]);
      await c.query(`delete from public.projects where id = $1`, [other.rows[0]!.id]);
    }
  });

  it("stays hidden once the reader's project grant is revoked", async () => {
    await c.query(
      `update public.project_access_grants set revoked_at = now()
        where workspace_id = $1 and member_id = $2
          and capability in ('project.view','project.admin')`, [WS_A, a.memberId]);
    try {
      expect(await visible(USER_A, WS_A, "requirement_occurrences", occurrenceA)).toBe(0);
    } finally {
      await c.query(
        `update public.project_access_grants set revoked_at = null
          where workspace_id = $1 and member_id = $2
            and capability in ('project.view','project.admin')`, [WS_A, a.memberId]);
    }
  });

  const insertOccurrenceAs = (
    user: string, actorWorkspace: string, w: OccurrenceWorld, over: OccurrenceSeed = {},
  ) => asActor(user, actorWorkspace, (cl) =>
    cl.query(OCCURRENCE_INSERT, occurrenceParams(w, over)));

  it("refuses an insert from the project ADMINISTRATOR, who lacks assignments.manage", async () => {
    // The occurrence's write policy follows the OPERATION rather than the prose:
    // capabilities.csv:23 claims materialisation for `requirements.assign` while
    // naming only the dry run, which writes nothing. The command that inserts is
    // assignments.create under assignments.manage, and naming anything else here
    // would deadlock `project_manager`, who holds project.admin and
    // assignments.manage and not requirements.assign.
    expect(await sqlstate(() => insertOccurrenceAs(USER_A, WS_A, wa,
      { ruleVersionId: wa.permissiveRuleVersionId, stageKey: wa.permissiveStageKey,
        workStageId: wa.permissiveStageId, stageIsConcealed: false,
        blockingScope: "blocks_both", timing: "after" }))).toBe("42501");
  });

  it("admits an insert under assignments.manage", async () => {
    await withCapability(a, a.memberId, "assignments.manage", async () => {
      expect(await sqlstate(() => insertOccurrenceAs(USER_A, WS_A, wa,
        { ruleVersionId: wa.permissiveRuleVersionId, stageKey: wa.permissiveStageKey,
          workStageId: wa.permissiveStageId, stageIsConcealed: false,
          blockingScope: "blocks_both", timing: "after" }))).toBeNull();
    });
    await purgeOccurrences(WS_A);
  });

  it("refuses an insert carrying another workspace's id, even with the capability at home",
    async () => {
      await withCapability(b, b.memberId, "assignments.manage", async () => {
        expect(await sqlstate(() => insertOccurrenceAs(USER_B, WS_B, wa,
          { ruleVersionId: wa.permissiveRuleVersionId, stageKey: wa.permissiveStageKey,
            workStageId: wa.permissiveStageId, stageIsConcealed: false,
            blockingScope: "blocks_both", timing: "after" }))).toBe("42501");
      });
      const rows = await c.query<{ n: number }>(
        `select count(*)::int as n from public.requirement_occurrences
          where workspace_id = $1 and rule_version_id = $2`,
        [WS_A, wa.permissiveRuleVersionId]);
      expect(rows.rows[0]!.n).toBe(0);
    });

  it("gives the app role no UPDATE and no DELETE to attempt in the first place", async () => {
    // The append-only trigger is the second layer; this is the first. A test
    // that only asserted the trigger would keep passing if a later migration
    // granted UPDATE and someone removed the trigger in the same change.
    const g = await c.query<{ n: number }>(
      `select count(*)::int as n from information_schema.role_table_grants
        where grantee = 'aktflow_app' and table_schema = 'public'
          and table_name in ('work_stages','requirement_occurrences')
          and privilege_type in ('UPDATE','DELETE')`);
    expect(g.rows[0]!.n).toBe(0);
  });
});
