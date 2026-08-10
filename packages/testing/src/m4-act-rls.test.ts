import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, appClient } from "./pg";
import {
  dropRulesWorkspaces, seedRulesWorld, type RulesFixture,
} from "./m1-rules-fixture";
import { seedClosureWorld, type ClosureWorld } from "./m3-closure-fixture";
import {
  ACT_INSERT, FROZEN_PROJECT_NAME, QUANTITY_INSERT, SIGNATORY_INSERT, VERSION_INSERT,
  actParams, insertAct, insertVersion, quantityParams, resetActFacts, seedActWorld,
  seedDraftAct, signatoryParams, versionParams, type ActWorld,
} from "./m4-act-fixture";

/**
 * NOTHING IN THIS FILE HAS BEEN EXECUTED. No node_modules, no database, no
 * docker: `vitest`, `tsc`, `psql` and `supabase` were never run against it, no
 * migration was applied, and no claim is made that any assertion below passes.
 * Static reading is the only check that was available.
 *
 * ---------------------------------------------------------------------------
 * v0.1-M4: TENANT ISOLATION AND THE CAPABILITY THE POLICY NAMES.
 *
 * Migration 0014 exists because M1's write policies asked only for active
 * membership, so the database could not catch a command-layer mistake; 0016:90-93
 * says that must not recur. This suite is where «it did not recur» is checked for
 * the four tables 0047 adds — and it checks BOTH directions, because a policy
 * nobody can satisfy fails closed and is still broken.
 *
 * THE READ SIDE IS `statutory_acts.compose`, AND THAT IS NOT COMFORTABLE.
 * capabilities.csv:32 puts all four M4 operations — compose, freeze, get AND
 * render — behind one capability_id, so a member who may READ an act may also
 * COMPOSE one. `project.admin` is admitted alongside it so the pilot owner is
 * not locked out of the document its own workflow produces. Both halves are
 * asserted below AS THEY ARE, because the alternative — widening the policy to
 * `project.view` — would be a permissions decision taken in a migration, and
 * 0047 §11 item 6 records it as owed instead.
 */

const WS_A = "f4bb1111-1111-1111-1111-111111111111";
const WS_B = "f4bb2222-2222-2222-2222-222222222222";
const USER_A = "f4bb3333-3333-3333-3333-333333333333";
const USER_B = "f4bb4444-4444-4444-4444-444444444444";
/** A member of WS_A holding project.view and NOTHING about acts. */
const USER_VIEWER = "f4bb5555-5555-5555-5555-555555555555";
/** A member of WS_A holding project.admin — the pilot owner. */
const USER_ADMIN = "f4bb6666-6666-6666-6666-666666666666";

const ACT_TABLES = [
  "statutory_acts", "statutory_act_versions",
  "statutory_act_version_quantities", "statutory_act_version_signatories",
] as const;

let c: Client;
let fa: RulesFixture;
let fb: RulesFixture;
let wa: ClosureWorld;
let a: ActWorld;
let b: ActWorld;

/** Runs one statement as a member, reporting the SQLSTATE or null. */
async function asMember(
  userId: string, organizationId: string, sql: string, params: unknown[],
): Promise<string | null> {
  const client = appClient();
  await client.connect();
  try {
    await client.query("begin");
    await client.query("set local role aktflow_app");
    await client.query("select set_config('app.actor_user_id', $1, true)", [userId]);
    await client.query("select set_config('app.organization_id', $1, true)", [organizationId]);
    await client.query(sql, params);
    await client.query("commit");
    return null;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    return (e as { code?: string }).code ?? "unknown";
  } finally { await client.end(); }
}

/**
 * The same attempt as `asMember`, reporting the MESSAGE rather than the
 * SQLSTATE.
 *
 * Needed because two of the four act tables are refused by a trigger rather
 * than by a policy, and every trigger refusal in this schema is P0001 — a code
 * that would be satisfied by any raise at all, including one about something
 * else entirely.
 */
async function asMemberMessage(
  userId: string, organizationId: string, sql: string, params: unknown[],
): Promise<string> {
  const client = appClient();
  await client.connect();
  try {
    await client.query("begin");
    await client.query("set local role aktflow_app");
    await client.query("select set_config('app.actor_user_id', $1, true)", [userId]);
    await client.query("select set_config('app.organization_id', $1, true)", [organizationId]);
    await client.query(sql, params);
    await client.query("commit");
    return "";
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    return (e as { message?: string }).message ?? "unknown";
  } finally { await client.end(); }
}

/** Rows one member can SELECT from a table, by workspace. */
async function visible(
  userId: string, organizationId: string, table: string, workspaceId: string,
): Promise<number> {
  const client = appClient();
  await client.connect();
  try {
    await client.query("begin");
    await client.query("set local role aktflow_app");
    await client.query("select set_config('app.actor_user_id', $1, true)", [userId]);
    await client.query("select set_config('app.organization_id', $1, true)", [organizationId]);
    const r = await client.query<{ n: number }>(
      `select count(*)::int as n from public.${table} where workspace_id = $1`, [workspaceId]);
    await client.query("commit");
    return r.rows[0]!.n;
  } finally { await client.end(); }
}

async function addMember(
  workspaceId: string, userId: string, projectId: string, capabilities: string[],
): Promise<string> {
  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email,
                             encrypted_password, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             $2, '', now(), now())
     on conflict (id) do nothing`, [userId, `${userId}@fixture.test`]);
  const m = await c.query<{ id: string }>(
    `insert into public.memberships (organization_id, user_id, role, status)
     values ($1,$2,'member','active') returning id`, [workspaceId, userId]);
  for (const capability of capabilities) {
    await c.query(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,$4,$5)`,
      [workspaceId, projectId, m.rows[0]!.id, capability, userId]);
  }
  return m.rows[0]!.id;
}

beforeAll(async () => {
  c = await adminClient();
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  fa = await seedRulesWorld(c, { workspaceId: WS_A, userId: USER_A, suffix: "M4RA" });
  fb = await seedRulesWorld(c, { workspaceId: WS_B, userId: USER_B, suffix: "M4RB" });
  wa = await seedClosureWorld(c, fa);
  const wb = await seedClosureWorld(c, fb);
  a = await seedActWorld(c, wa);
  b = await seedActWorld(c, wb);
  await addMember(WS_A, USER_VIEWER, fa.projectId, ["project.view"]);
  await addMember(WS_A, USER_ADMIN, fa.projectId, ["project.admin", "project.view"]);
}, 120_000);

beforeEach(async () => {
  await resetActFacts(c, WS_A);
  await resetActFacts(c, WS_B);
});

afterAll(async () => {
  await dropRulesWorkspaces(c, [WS_A, WS_B]);
  await c.end();
});

describe("INV-001/INV-002 — an act is invisible across a tenant boundary", () => {
  it("shows A's act to A and none of it to B, on all four tables", async () => {
    await seedDraftAct(c, a);
    await seedDraftAct(c, b);
    for (const table of ACT_TABLES) {
      expect(await visible(USER_A, WS_A, table, WS_A), `${table} to its own tenant`)
        .toBeGreaterThan(0);
      // B is a real member of a real workspace, so this is a tenant boundary and
      // not an unauthenticated caller being refused.
      expect(await visible(USER_B, WS_B, table, WS_A), `${table} across the boundary`).toBe(0);
    }
  });

  it("refuses B an INSERT into A's workspace on every act table", async () => {
    // The `with check` half. Without it a foreign tenant could write rows they
    // could never read — which is worse than reading them, because it is a
    // forgery nobody can see.
    //
    // WHICH LAYER ANSWERS IS NAMED WHERE IT IS NOT 42501, the convention
    // m1-rules-schema.test.ts:27-31 sets for exactly this shape. The two content
    // tables carry `app.guard_statutory_act_content()` as a BEFORE INSERT
    // trigger, and it reads `statutory_act_versions` under the INSERTING role —
    // so RLS hides A's version from B, the guard finds no row, and it raises
    // «not visible in this workspace» before the policy's WITH CHECK is ever
    // evaluated. That is still a refusal and still fails closed; asserting
    // 42501 there asserted an ordering the schema does not have.
    expect(await asMember(USER_B, WS_B, ACT_INSERT, actParams(a))).toBe("42501");

    const actId = await insertAct(c, a);
    expect(await asMember(USER_B, WS_B, VERSION_INSERT,
      versionParams(a, { statutoryActId: actId }))).toBe("42501");

    const versionId = await insertVersion(c, a, { statutoryActId: actId });
    expect(await asMemberMessage(USER_B, WS_B, QUANTITY_INSERT,
      quantityParams(a, { versionId })), "quantities")
      .toMatch(/is not visible in this workspace/);
    expect(await asMemberMessage(USER_B, WS_B, SIGNATORY_INSERT,
      signatoryParams(a, { versionId, slot: "builder" })), "signatories")
      .toMatch(/is not visible in this workspace/);
  });

  it("refuses B those same two inserts by POLICY, with the trigger out of the way", async () => {
    // THE HALF THE CASE ABOVE CANNOT REACH. A trigger that answers first can
    // hide a missing policy for years — m1-rules-schema.test.ts:28-30 says so in
    // terms — and here it would hide the `with check` on the two tables where a
    // forged quantity or a forged signatory is the actual damage.
    //
    // So the guard is suspended and the same two inserts are attempted again.
    // What answers now can only be the policy, and it must still be 42501.
    const actId = await insertAct(c, a);
    const versionId = await insertVersion(c, a, { statutoryActId: actId });
    const guarded = ["statutory_act_version_quantities",
                     "statutory_act_version_signatories"] as const;
    for (const t of guarded) {
      await c.query(`alter table public.${t} disable trigger user`);
    }
    try {
      expect(await asMember(USER_B, WS_B, QUANTITY_INSERT,
        quantityParams(a, { versionId })), "quantities, policy only").toBe("42501");
      expect(await asMember(USER_B, WS_B, SIGNATORY_INSERT,
        signatoryParams(a, { versionId, slot: "builder" })), "signatories, policy only")
        .toBe("42501");
    } finally {
      for (const t of guarded) {
        await c.query(`alter table public.${t} enable trigger user`);
      }
    }
  });

  it("refuses B an UPDATE of A's draft version", async () => {
    const { versionId } = await seedDraftAct(c, a);
    // `sav_update`'s USING clause hides the row, so the UPDATE matches nothing
    // rather than raising — which is why the assertion reads the row afterwards
    // instead of trusting a SQLSTATE.
    expect(await asMember(USER_B, WS_B,
      `update public.statutory_act_versions
          set correction_reason = 'Приклад-чуже', draft_version = draft_version + 1
        where id = $1`, [versionId])).toBeNull();
    const row = await c.query<{ correction_reason: string | null; draft_version: string }>(
      `select correction_reason, draft_version::text from public.statutory_act_versions
        where id = $1`, [versionId]);
    expect(row.rows[0]!.correction_reason).toBeNull();
    expect(row.rows[0]!.draft_version).toBe("1");
  });
});

describe("the policy asks for a capability, not for a membership", () => {
  it("hides the act from a member who holds project.view and nothing else", async () => {
    // THE COST, ASSERTED RATHER THAN DISCOVERED. `sav_select` admits
    // `statutory_acts.compose` and `project.admin` and NOT `project.view`, so a
    // member of the right workspace who merely holds the read capability of the
    // project sees no act at all — and the route above it therefore answers 404
    // where a 403 would be more useful.
    await seedDraftAct(c, a);
    for (const table of ACT_TABLES) {
      expect(await visible(USER_VIEWER, WS_A, table, WS_A), table).toBe(0);
    }
  });

  it("shows the act to a project.admin, and still refuses them the INSERT", async () => {
    // Both halves of 0047 §10's decision. The owner of a pilot must be able to
    // READ the document its own workflow produced; composing one is a different
    // act and `sa_insert` names only `statutory_acts.compose`.
    await seedDraftAct(c, a);
    for (const table of ACT_TABLES) {
      expect(await visible(USER_ADMIN, WS_A, table, WS_A), table).toBeGreaterThan(0);
    }
    await resetActFacts(c, WS_A);
    expect(await asMember(USER_ADMIN, WS_A, ACT_INSERT, actParams(a))).toBe("42501");
  });

  it("admits the holder of statutory_acts.compose — the policy is satisfiable", async () => {
    // A policy nobody can satisfy fails closed and is still broken. The owner
    // holds the capability because `seedActWorld` granted it BY HAND:
    // `statutory_acts.compose` is in no responsibility preset (0047 §11 item 6).
    expect(await asMember(USER_A, WS_A, ACT_INSERT, actParams(a))).toBeNull();
    const actId = await c.query<{ id: string }>(
      `select id from public.statutory_acts where workspace_id = $1`, [WS_A]);
    expect(await asMember(USER_A, WS_A, VERSION_INSERT,
      versionParams(a, { statutoryActId: actId.rows[0]!.id }))).toBeNull();
  });

  it("refuses every act table to a member of no workspace at all", async () => {
    // `app.current_actor()` resolves nothing, so `has_project_capability` is
    // false everywhere and the row set is empty rather than the query erroring.
    const stranger = "f4bb7777-7777-7777-7777-777777777777";
    await c.query(
      `insert into auth.users (id, instance_id, aud, role, email,
                               encrypted_password, created_at, updated_at)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated',
               'authenticated', $2, '', now(), now())
       on conflict (id) do nothing`, [stranger, `${stranger}@fixture.test`]);
    await seedDraftAct(c, a);
    for (const table of ACT_TABLES) {
      expect(await visible(stranger, WS_A, table, WS_A), table).toBe(0);
    }
    expect(await asMember(stranger, WS_A, ACT_INSERT, actParams(a))).toBe("42501");
  });
});

describe("sav_update names the state it may act on", () => {
  it("refuses the holder of the capability an UPDATE of a FROZEN version", async () => {
    // «A guard is the last defence and should not be the only one» (0045:1552-1557,
    // the same line drawn on public.work_stages). The policy's USING clause says
    // `status = 'draft'`, so a frozen row is invisible to an UPDATE even before
    // `app.guard_statutory_act_version()` is reached — and the guard is what
    // answers when a superuser bypasses the policy, which the schema suite
    // asserts separately.
    const { versionId } = await seedDraftAct(c, a);
    await c.query("begin");
    await c.query("select set_config('app.actor_user_id', $1, true)", [fa.userId]);
    await c.query(
      `update public.statutory_act_versions
          set status = 'frozen', frozen_at = now(), frozen_by_member_id = $2,
              content_hash = $3, renderer_version = 'statutory-act-render/1',
              form_template_hash = $3, draft_version = draft_version + 1,
              frozen_project_name = $4, source_project_version = 1
        where id = $1 and status = 'draft'`,
      [versionId, fa.memberId, "a".repeat(64), FROZEN_PROJECT_NAME]);
    await c.query("commit");

    expect(await asMember(USER_A, WS_A,
      `update public.statutory_act_versions
          set correction_reason = 'Приклад-після заморозки',
              draft_version = draft_version + 1
        where id = $1`, [versionId])).toBeNull();
    const row = await c.query<{ correction_reason: string | null; draft_version: string }>(
      `select correction_reason, draft_version::text from public.statutory_act_versions
        where id = $1`, [versionId]);
    // Nothing moved: the policy matched no row, so the guard never had to fire.
    expect(row.rows[0]!.correction_reason).toBeNull();
    expect(row.rows[0]!.draft_version).toBe("2");
  });

  it("admits the freeze itself — draft to frozen is the one legal transition", async () => {
    const { versionId } = await seedDraftAct(c, a);
    expect(await asMember(USER_A, WS_A,
      `update public.statutory_act_versions
          set status = 'frozen', frozen_at = now(), frozen_by_member_id = $2,
              content_hash = $3, renderer_version = 'statutory-act-render/1',
              form_template_hash = $3, draft_version = draft_version + 1,
              frozen_project_name = $4, source_project_version = 1
        where id = $1 and status = 'draft' and draft_version = 1`,
      [versionId, fa.memberId, "b".repeat(64), FROZEN_PROJECT_NAME])).toBeNull();
    const row = await c.query<{ status: string }>(
      `select status from public.statutory_act_versions where id = $1`, [versionId]);
    expect(row.rows[0]!.status).toBe("frozen");
  });
});

describe("the content tables inherit the act's answer and give no second one", () => {
  it("is not separately readable by a member the act itself is hidden from", async () => {
    // A quantity line is part of the act, not a thing of its own; a second
    // capability on it would be a second answer to «who may see this document».
    await seedDraftAct(c, a);
    expect(await visible(USER_VIEWER, WS_A, "statutory_act_version_quantities", WS_A)).toBe(0);
    expect(await visible(USER_VIEWER, WS_A, "statutory_act_version_signatories", WS_A)).toBe(0);
    expect(await visible(USER_ADMIN, WS_A, "statutory_act_version_quantities", WS_A))
      .toBeGreaterThan(0);
  });

  it("refuses a project.admin the write the act capability governs", async () => {
    const { versionId } = await seedDraftAct(c, a);
    await c.query(
      `delete from public.statutory_act_version_quantities
        where statutory_act_version_id = $1`, [versionId]);
    expect(await asMember(USER_ADMIN, WS_A, QUANTITY_INSERT,
      quantityParams(a, { versionId }))).toBe("42501");
    expect(await asMember(USER_A, WS_A, QUANTITY_INSERT,
      quantityParams(a, { versionId }))).toBeNull();
  });
});
