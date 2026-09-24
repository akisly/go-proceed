import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { Client } from "pg";
import { adminClient, appClient, asActor, asService, bypassingGuards, dropWorkspaces } from "./pg";

/**
 * READINESS GATE 11, MODULE workspace_access (DEV-014, BL-098).
 *
 * One test per exposed relation, each cited in technical/database/rls-coverage.csv
 * as BOTH its positive and its negative, so the control and the refusal run in
 * the same test over the same two rows:
 *
 *   - the owner of A reads the row of A (the positive);
 *   - the owner of B, an ACTIVE MEMBER OF ANOTHER WORKSPACE holding the same
 *     grants on its own project, reads only the row of B (the negative).
 *
 * B reading its own row is what keeps the negative from passing on a mis-seeded
 * B: zero rows of A next to one row of B cannot come from a missing membership
 * or grant (the S1-03 shape DEV-013 reclassified). Every transaction declares
 * workspace A in `app.organization_id`, B's included: member policies key off
 * `app.current_actor()` and must ignore the declaration, so a policy that
 * trusted it would hand A's row to B here.
 *
 * The fixture is this file's own: two workspaces with ids no other suite uses,
 * dropped before (a crashed earlier run) and after. auth.users rows outlive the
 * cleanup, as in every other suite (m2-fixture.ts), and their addresses derive
 * from their ids so they cannot collide. No resetDb.
 */
const WS_A = "de140a00-0000-4000-8000-000000000001";
const WS_B = "de140b00-0000-4000-8000-000000000001";
const USER_A = "de140a00-0000-4000-8000-0000000000a1";
const USER_B = "de140b00-0000-4000-8000-0000000000b1";
/** A second, grantless member of A: the one m_select_workspace alone shows to the owner. */
const MEMBER_A2 = "de140a00-0000-4000-8000-0000000000a2";
/** Holds no membership anywhere, and no auth.users row: an actor id and nothing else. */
const NOBODY = "de140c00-0000-4000-8000-0000000000c1";
const BOTH = [WS_A, WS_B];

let admin: Client;

async function seedUser(id: string): Promise<void> {
  await admin.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now())
     on conflict (id) do nothing`, [id, `${id}@fixture.test`]);
}

/** One row of every workspace_access relation, owned by `user` in `ws`. */
async function seedSide(ws: string, user: string, name: string): Promise<void> {
  await seedUser(user);
  await admin.query(
    "insert into public.organizations (id, legal_name, display_name) values ($1, $2, $2)",
    [ws, `Приклад-Простір-${name}`]);
  const member = await admin.query<{ id: string }>(
    "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'owner', 'active') returning id",
    [ws, user]);
  const memberId = member.rows[0]!.id;
  const project = await admin.query<{ id: string }>(
    "insert into public.projects (workspace_id, name, created_by) values ($1, $2, $3) returning id",
    [ws, `Приклад-Обʼєкт-${name}`, user]);
  const projectId = project.rows[0]!.id;
  for (const capability of ["project.view", "project.admin"]) {
    await admin.query(
      `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
       values ($1, $2, $3, $4, $5)`, [ws, projectId, memberId, capability, user]);
  }
  const party = await admin.query<{ id: string }>(
    "insert into public.parties (workspace_id, display_name, created_by) values ($1, $2, $3) returning id",
    [ws, `Приклад-Виконавець-${name}`, user]);
  const partyId = party.rows[0]!.id;
  await admin.query(
    "insert into public.party_contacts (workspace_id, party_id, full_name, created_by) values ($1, $2, $3, $4)",
    [ws, partyId, `Приклад-Контакт-${name}`, user]);
  await admin.query(
    "insert into public.party_legal_profiles (workspace_id, party_id, official_name, updated_by) values ($1, $2, $3, $4)",
    [ws, partyId, `Приклад-Виконавець-${name} ТОВ`, user]);
  await admin.query(
    "insert into public.own_legal_entity_profiles (workspace_id, party_id, created_by) values ($1, $2, $3)",
    [ws, partyId, user]);
  await admin.query(
    "insert into public.legal_entities (organization_id, legal_name) values ($1, $2)",
    [ws, `Приклад-Юрособа-${name}`]);
  // token_hash is unique across every workspace, so it is derived, never typed.
  await admin.query(
    `insert into public.invitations (workspace_id, email, role, token_hash, expires_at, invited_by)
     values ($1, $2, 'member', $3, now() + interval '1 day', $4)`,
    [ws, `invite-${ws}@fixture.test`, createHash("sha256").update(`dev014:${ws}:invitation`).digest("hex"), user]);
  await admin.query(
    "insert into public.project_parties (workspace_id, project_id, party_id, relationship, created_by) values ($1, $2, $3, 'customer', $4)",
    [ws, projectId, partyId, user]);
  await admin.query(
    `insert into public.project_responsibility_assignments (workspace_id, project_id, member_id, responsibility, assigned_by)
     values ($1, $2, $3, 'performer', $4)`, [ws, projectId, memberId, user]);
  await admin.query(
    "insert into public.project_field_channels (workspace_id, project_id, channel) values ($1, $2, 'telegram')",
    [ws, projectId]);
}

/** The workspace of every row `actor` can read, declaring workspace A, sorted. */
async function seen(actor: string, sql: string): Promise<string[]> {
  const r = await asActor<{ ws: string }>(actor, WS_A, (c) => c.query(sql, [BOTH]));
  return r.rows.map((row) => row.ws).sort();
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  await seedSide(WS_A, USER_A, "A");
  await seedSide(WS_B, USER_B, "B");
  await seedUser(MEMBER_A2);
  await admin.query(
    "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'member', 'active')",
    [WS_A, MEMBER_A2]);
}, 60_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("workspace_access isolation — the owner of A reads rows of A and the owner of B declaring A reads only rows of B", () => {
  it("me_context: each caller sees only its own context and a user with no membership sees none", async () => {
    // A view owned by postgres without security_invoker: RLS on memberships
    // does not apply inside it, so `m.user_id = app.current_actor()` is its only
    // fence, and this is that fence.
    const sql = "select organization_id as ws from api.me_context where organization_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
    expect(await seen(NOBODY, sql)).toEqual([]);
  });

  it("organizations: the owner of A reads workspace A and the owner of B reads only its own", async () => {
    const sql = "select id as ws from public.organizations where id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("memberships: the owner of A reads both memberships of A and the owner of B reads only its own", async () => {
    // Two policies: m_select (the actor's own row) and m_select_workspace (every
    // row of a workspace the actor is an active member of). A's second row is
    // MEMBER_A2's and reaches A only through the second.
    const sql = "select organization_id as ws from public.memberships where organization_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A, WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("legal_entities: the owner of A reads the legal entity of A and the owner of B reads only its own", async () => {
    const sql = "select organization_id as ws from public.legal_entities where organization_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("invitations: the owner of A reads the invitation of A and the owner of B reads only its own", async () => {
    const sql = "select workspace_id as ws from public.invitations where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("parties: the owner of A reads the party of A and the owner of B reads only its own", async () => {
    const sql = "select workspace_id as ws from public.parties where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("party_contacts: the owner of A reads the contact of A and the owner of B reads only its own", async () => {
    const sql = "select workspace_id as ws from public.party_contacts where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("party_legal_profiles: the owner of A reads the legal profile of A and the owner of B reads only its own", async () => {
    const sql = "select workspace_id as ws from public.party_legal_profiles where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("own_legal_entity_profiles: the owner of A reads the profile of A and the owner of B reads only its own", async () => {
    const sql = "select workspace_id as ws from public.own_legal_entity_profiles where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("project_access_grants: the owner of A reads the grants of A and the owner of B holding project.admin on its own project reads only its own", async () => {
    // pag_select admits project.admin OR the actor's own member_id. B holds
    // project.admin in B and owns B's grants, so B reads them through either
    // branch; neither branch reaches anything of A.
    const sql = "select workspace_id as ws from public.project_access_grants where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A, WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B, WS_B]);
  });

  it("project_parties: the owner of A reads the project party of A and the owner of B reads only its own", async () => {
    const sql = "select workspace_id as ws from public.project_parties where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("project_responsibility_assignments: the owner of A reads the assignment of A and the owner of B reads only its own", async () => {
    const sql = "select workspace_id as ws from public.project_responsibility_assignments where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("project_field_channels: the owner of A reads the channel of A and the owner of B reads only its own", async () => {
    const sql = "select workspace_id as ws from public.project_field_channels where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });
});

/**
 * DEV-043 / BL-021 / ADR-014 decision 4 (migration 0096): the application role
 * revokes a grant and changes nothing else about it.
 *
 * Before 0096 `goproceed_app` held UPDATE on every column of
 * project_access_grants (0011), so a defect in the BFF could move a grant to
 * another member or capability, or widen its window, on any project the actor
 * administers. The write is revoked_at and version, which is the revoke.
 *
 * The grant revoked here is seeded and removed inside the test, on MEMBER_A2,
 * so the read tests above keep their counts.
 */
describe("project_access_grants: the application role may revoke a grant and change nothing else (DEV-043)", () => {
  const COLUMNS = ["id", "workspace_id", "project_id", "member_id", "capability", "valid_from",
    "valid_until", "revoked_at", "granted_by", "version", "created_at"];

  it("goproceed_app holds UPDATE on revoked_at and version only", async () => {
    const r = await admin.query<{ column_name: string; can: boolean }>(
      `select column_name, has_column_privilege('goproceed_app', 'public.project_access_grants', column_name, 'UPDATE') as can
         from unnest($1::text[]) as column_name`, [COLUMNS]);
    expect(r.rows.filter((row) => row.can).map((row) => row.column_name).sort()).toEqual(["revoked_at", "version"]);
    const table = await admin.query<{ can: boolean }>(
      "select has_table_privilege('goproceed_app', 'public.project_access_grants', 'UPDATE') as can");
    // has_table_privilege is true only for a table-level grant, not for column grants.
    expect(table.rows[0]!.can).toBe(false);
  });

  it("the owner of A revokes a grant of A; the owner of B declaring A and a view-only member of A update no row; a member_id update is refused", async () => {
    const p = await admin.query<{ id: string }>("select id from public.projects where workspace_id = $1", [WS_A]);
    const projectId = p.rows[0]!.id;
    const m = await admin.query<{ id: string }>(
      "select id from public.memberships where organization_id = $1 and user_id = $2", [WS_A, MEMBER_A2]);
    const memberId = m.rows[0]!.id;
    const g = await admin.query<{ id: string }>(
      `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
       values ($1, $2, $3, 'project.view', $4), ($1, $2, $3, 'contracts.edit', $4) returning id, capability`,
      [WS_A, projectId, memberId, USER_A]);
    try {
      const target = g.rows[1]!.id;
      const revokeSql = (c: Client) => c.query(
        "update public.project_access_grants set revoked_at = now(), version = version + 1 where id = $1 and revoked_at is null returning id",
        [target]);

      expect((await asActor(USER_B, WS_A, revokeSql)).rowCount).toBe(0);
      expect((await asActor(MEMBER_A2, WS_A, revokeSql)).rowCount).toBe(0);
      // The column grant, not RLS (USER_A administers the project): the message names the table's privilege.
      await expect(asActor(USER_A, WS_A, (c) => c.query(
        "update public.project_access_grants set member_id = $2 where id = $1", [target, memberId])))
        .rejects.toMatchObject({ code: "42501", message: expect.stringMatching(/permission denied for table project_access_grants/) });
      await expect(asActor(USER_A, WS_A, (c) => c.query(
        "update public.project_access_grants set valid_until = now() + interval '1 day' where id = $1", [target])))
        .rejects.toMatchObject({ code: "42501", message: expect.stringMatching(/permission denied for table project_access_grants/) });
      expect((await asActor(USER_A, WS_A, revokeSql)).rowCount).toBe(1);

      const after = await admin.query<{ revoked: boolean; version: string }>(
        "select revoked_at is not null as revoked, version from public.project_access_grants where id = $1", [target]);
      expect(after.rows[0]).toEqual({ revoked: true, version: "2" });
    } finally {
      // A grant is never deleted (0099); the fixture removes its own rows past the guard.
      await bypassingGuards("delete from public.project_access_grants where id = any($1::uuid[])", [g.rows.map((row) => row.id)]);
    }
  });
});

/**
 * DEV-052 / BL-138 / INV-113 (migration 0099): a grant's `revoked_at` is written
 * once. The only change a grant accepts is the revoke — `revoked_at` from null
 * to the transaction's `now()`, `version` unchanged or up by one — and a revoked
 * grant never changes again; a grant is never deleted. The guard fires for every
 * role, the table owner and superusers included; replica mode is the bypass
 * fixtures use.
 *
 * Before 0099 RLS could not compare the old row with the new one, so the
 * application role could clear `revoked_at` on a project it administers, and a
 * superuser could rewrite or delete any grant. Seeded and removed here, on
 * MEMBER_A2, so the read tests above keep their counts.
 */
describe("project_access_grants: revoked_at is written once (DEV-052, BL-138)", () => {
  let projectId: string;
  let memberId: string;
  const made: string[] = [];

  beforeAll(async () => {
    projectId = (await admin.query<{ id: string }>("select id from public.projects where workspace_id = $1", [WS_A])).rows[0]!.id;
    memberId = (await admin.query<{ id: string }>(
      "select id from public.memberships where organization_id = $1 and user_id = $2", [WS_A, MEMBER_A2])).rows[0]!.id;
  });
  afterAll(async () => {
    await bypassingGuards("delete from public.project_access_grants where id = any($1::uuid[])", [made]);
  });

  async function grant(capability: string, revoked = false): Promise<string> {
    const r = await admin.query<{ id: string }>(
      `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by, revoked_at)
       values ($1, $2, $3, $4, $5, ${revoked ? "now()" : "null"}) returning id`,
      [WS_A, projectId, memberId, capability, USER_A]);
    made.push(r.rows[0]!.id);
    return r.rows[0]!.id;
  }
  const refused = { code: "P0001", message: expect.stringMatching(/INV-113/) };

  it("the owner of A revokes once; clearing or re-dating the revoke is refused to the application role", async () => {
    const target = await grant("contracts.edit");
    const revoke = await asActor(USER_A, WS_A, (c) => c.query(
      "update public.project_access_grants set revoked_at = now(), version = version + 1 where id = $1 and revoked_at is null", [target]));
    expect(revoke.rowCount).toBe(1);
    await expect(asActor(USER_A, WS_A, (c) => c.query(
      "update public.project_access_grants set revoked_at = null, version = version + 1 where id = $1", [target])))
      .rejects.toMatchObject(refused);
    await expect(asActor(USER_A, WS_A, (c) => c.query(
      "update public.project_access_grants set revoked_at = now() + interval '1 day' where id = $1", [target])))
      .rejects.toMatchObject(refused);
    const after = await admin.query<{ revoked: boolean; version: string }>(
      "select revoked_at is not null as revoked, version from public.project_access_grants where id = $1", [target]);
    expect(after.rows[0]).toEqual({ revoked: true, version: "2" });
  });

  it("the application role cannot backdate a revoke, bump only the version, or skip versions", async () => {
    const target = await grant("imports.manage");
    for (const set of ["revoked_at = now() - interval '1 day'", "version = version + 1", "revoked_at = now(), version = version + 2"]) {
      await expect(asActor(USER_A, WS_A, (c) => c.query(
        `update public.project_access_grants set ${set} where id = $1`, [target])), set).rejects.toMatchObject(refused);
    }
    // The owner of B declaring A and a view-only member of A reach no row, so the guard never runs for them.
    const clear = (c: Client) => c.query("update public.project_access_grants set revoked_at = null where id = $1", [target]);
    expect((await asActor(USER_B, WS_A, clear)).rowCount).toBe(0);
    expect((await asActor(MEMBER_A2, WS_A, clear)).rowCount).toBe(0);
    // Unchanged version is accepted: the revoke without a bump.
    expect((await asActor(USER_A, WS_A, (c) => c.query(
      "update public.project_access_grants set revoked_at = now() where id = $1", [target]))).rowCount).toBe(1);
  });

  it("a superuser cannot un-revoke, rewrite or delete a grant; replica mode can", async () => {
    const live = await grant("imports.publish");
    const revoked = await grant("assignments.manage", true);
    await expect(admin.query("update public.project_access_grants set revoked_at = null where id = $1", [revoked]))
      .rejects.toMatchObject(refused);
    const ownerA = (await admin.query<{ id: string }>(
      "select id from public.memberships where organization_id = $1 and user_id = $2", [WS_A, USER_A])).rows[0]!.id;
    // Each set changes a value; a revoke alongside it would otherwise be allowed.
    for (const set of [
      `member_id = '${ownerA}'`, "capability = 'progress.record'", "valid_from = now() - interval '1 day'",
      "valid_until = now() + interval '1 day'", `granted_by = '${USER_B}'`, `workspace_id = '${WS_B}'`,
    ]) {
      await expect(admin.query(`update public.project_access_grants set ${set}, revoked_at = now() where id = $1`, [live]), set)
        .rejects.toMatchObject(refused);
    }
    await expect(admin.query("update public.project_access_grants set valid_until = now() + interval '1 day' where id = $1", [live]))
      .rejects.toMatchObject(refused);
    await expect(admin.query("delete from public.project_access_grants where id = $1", [live])).rejects.toMatchObject(refused);
    expect((await bypassingGuards("delete from public.project_access_grants where id = $1", [live])).rowCount).toBe(1);
  });

  it("the guard is a BEFORE UPDATE OR DELETE row trigger, not a definer, and no application role executes its function", async () => {
    const t = await admin.query<{ enabled: string; type: number; fn: string }>(
      `select t.tgenabled as enabled, t.tgtype as type, t.tgfoid::regprocedure::text as fn
         from pg_trigger t where t.tgrelid = 'public.project_access_grants'::regclass and not t.tgisinternal`);
    expect(t.rows).toEqual([{ enabled: "O", type: 1 | 2 | 8 | 16, fn: "app.guard_project_access_grant()" }]);
    const f = await admin.query<{ definer: boolean; config: string[] | null }>(
      "select prosecdef as definer, proconfig as config from pg_proc where oid = 'app.guard_project_access_grant()'::regprocedure");
    expect(f.rows[0]).toEqual({ definer: false, config: ['search_path=""'] });
    const x = await admin.query<{ role: string; can: boolean }>(
      `select r as role, has_function_privilege(r, 'app.guard_project_access_grant()', 'EXECUTE') as can
         from unnest(array['anon', 'authenticated', 'goproceed_app', 'goproceed_service', 'service_role']) as r`);
    expect(x.rows.filter((row) => row.can)).toEqual([]);
  });

  // gp-security S1-01: the guard holds only while no product role can reach the
  // owner's bypasses — replica mode, or owning (and so disabling or truncating) the table.
  it("no product role can set session_replication_role or acts as the table's owner", async () => {
    // On Supabase the replica-mode SET comes through supautils: a member of
    // supabase_privileged_role may set the parameters it allows, which
    // has_parameter_privilege does not see (gp-qa QA-01).
    const r = await admin.query<{ role: string; can_set: boolean; owner: boolean }>(
      `select r.rolname as role,
              has_parameter_privilege(r.oid, 'session_replication_role', 'SET')
                or (exists (select 1 from pg_roles p where p.rolname = 'supabase_privileged_role')
                    and pg_has_role(r.oid, 'supabase_privileged_role', 'MEMBER')) as can_set,
              pg_has_role(r.oid, c.relowner, 'MEMBER') as owner
         from pg_roles r cross join pg_class c
        where c.oid = 'public.project_access_grants'::regclass
          and (r.rolname like 'goproceed%' or r.rolname in ('service_role', 'authenticated', 'anon', 'postgres'))
        order by 1`);
    expect(r.rows.map((row) => row.role)).toEqual(expect.arrayContaining(["goproceed_app", "goproceed_app_login", "goproceed_service", "service_role"]));
    // The positive control: the table's owner is flagged by the same query.
    expect(r.rows.find((row) => row.role === "postgres")).toMatchObject({ can_set: true, owner: true });
    expect(r.rows.filter((row) => row.role !== "postgres" && (row.can_set || row.owner))).toEqual([]);
  });
});

/**
 * DEV-044 / BL-015 / ADR-014 decision 3 (migration 0097): the end of a
 * responsibility assignment is an append-only fact of its own.
 *
 * Seeded here, not in seedSide, so the tests above keep their rows: each side's
 * assignment gets one end through the admin client, and A gets a second
 * assignment, held by MEMBER_A2 and ended too, for the holder's own read.
 */
describe("project_responsibility_assignment_ends (DEV-044)", () => {
  const assignmentOf = async (ws: string, memberFilter = "") => {
    const r = await admin.query<{ id: string; project_id: string; member_id: string }>(
      `select id, project_id, member_id from public.project_responsibility_assignments where workspace_id = $1 ${memberFilter} order by created_at`, [ws]);
    return r.rows;
  };
  let a2Assignment: string;
  let a2Member: string;
  let projectA: string;

  beforeAll(async () => {
    projectA = (await admin.query<{ id: string }>("select id from public.projects where workspace_id = $1", [WS_A])).rows[0]!.id;
    a2Member = (await admin.query<{ id: string }>(
      "select id from public.memberships where organization_id = $1 and user_id = $2", [WS_A, MEMBER_A2])).rows[0]!.id;
    a2Assignment = (await admin.query<{ id: string }>(
      `insert into public.project_responsibility_assignments (workspace_id, project_id, member_id, responsibility, assigned_by)
       values ($1, $2, $3, 'evidence_recorder', $4) returning id`, [WS_A, projectA, a2Member, USER_A])).rows[0]!.id;
    for (const [ws, user] of [[WS_A, USER_A], [WS_B, USER_B]] as const) {
      const [first] = await assignmentOf(ws);
      await admin.query(
        `insert into public.project_responsibility_assignment_ends (workspace_id, project_id, assignment_id, ended_by)
         values ($1, $2, $3, $4)`, [ws, first!.project_id, first!.id, user]);
    }
    await admin.query(
      `insert into public.project_responsibility_assignment_ends (workspace_id, project_id, assignment_id, ended_by)
       values ($1, $2, $3, $4)`, [WS_A, projectA, a2Assignment, USER_A]);
  });

  it("project_responsibility_assignment_ends: the owner of A reads the ends of A and the owner of B reads only its own; a holder with no grant reads only the end of their own assignment", async () => {
    const sql = "select workspace_id as ws from public.project_responsibility_assignment_ends where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A, WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
    const own = await asActor<{ assignment_id: string }>(MEMBER_A2, WS_A, (c) => c.query(
      "select assignment_id from public.project_responsibility_assignment_ends where workspace_id = any($1::uuid[])", [BOTH]));
    expect(own.rows.map((r) => r.assignment_id)).toEqual([a2Assignment]);
  });

  it("inserts only for a project administrator of the row's project, as the actor and at the transaction's time", async () => {
    const target = (await admin.query<{ id: string }>(
      `insert into public.project_responsibility_assignments (workspace_id, project_id, member_id, responsibility, assigned_by)
       values ($1, $2, $3, 'progress_recorder', $4) returning id`, [WS_A, projectA, a2Member, USER_A])).rows[0]!.id;
    const insert = (actor: string, endedBy: string, endedAt = "now()") => asActor(actor, WS_A, (c) => c.query(
      `insert into public.project_responsibility_assignment_ends (workspace_id, project_id, assignment_id, ended_by, ended_at)
       values ($1, $2, $3, $4, ${endedAt})`, [WS_A, projectA, target, endedBy]));
    await expect(insert(USER_B, USER_B)).rejects.toMatchObject({ code: "42501" });
    await expect(insert(MEMBER_A2, MEMBER_A2)).rejects.toMatchObject({ code: "42501" });
    await expect(insert(USER_A, USER_B)).rejects.toMatchObject({ code: "42501" });
    await expect(insert(USER_A, USER_A, "now() - interval '1 day'")).rejects.toMatchObject({ code: "42501" });
    await expect(insert(USER_A, USER_A, "now() + interval '1 day'")).rejects.toMatchObject({ code: "42501" });
    await insert(USER_A, USER_A);
    // One end per assignment.
    await expect(insert(USER_A, USER_A)).rejects.toMatchObject({ code: "23505" });
  });

  it("refuses UPDATE and DELETE even for the table owner, and an end pinned to another project's assignment", async () => {
    const e = await admin.query<{ id: string }>(
      "select id from public.project_responsibility_assignment_ends where workspace_id = $1 limit 1", [WS_A]);
    await expect(admin.query("update public.project_responsibility_assignment_ends set ended_at = now() where id = $1", [e.rows[0]!.id]))
      .rejects.toThrow(/immutable/i);
    await expect(admin.query("delete from public.project_responsibility_assignment_ends where id = $1", [e.rows[0]!.id]))
      .rejects.toThrow(/immutable/i);
    // An assignment with no end yet, so the unique key cannot answer before the foreign key.
    const unended = (await admin.query<{ id: string }>(
      `insert into public.project_responsibility_assignments (workspace_id, project_id, member_id, responsibility, assigned_by)
       values ($1, $2, $3, 'requirement_owner', $4) returning id`, [WS_A, projectA, a2Member, USER_A])).rows[0]!.id;
    const other = (await admin.query<{ id: string }>(
      "insert into public.projects (workspace_id, name, created_by) values ($1, 'Приклад-Обʼєкт-A2', $2) returning id", [WS_A, USER_A])).rows[0]!.id;
    await expect(admin.query(
      `insert into public.project_responsibility_assignment_ends (workspace_id, project_id, assignment_id, ended_by)
       values ($1, $2, $3, $4)`, [WS_A, other, unended, USER_A])).rejects.toMatchObject({ code: "23503" });
    await expect(admin.query(
      `insert into public.project_responsibility_assignment_ends (workspace_id, project_id, assignment_id, ended_by)
       values ($1, $2, $3, $4)`, [WS_B, projectA, unended, USER_A])).rejects.toMatchObject({ code: "23503" });
  });

  it("goproceed_app holds SELECT and INSERT only", async () => {
    const r = await admin.query<{ privilege_type: string }>(
      `select privilege_type from information_schema.role_table_grants
        where grantee = 'goproceed_app' and table_schema = 'public' and table_name = 'project_responsibility_assignment_ends'
        order by privilege_type`);
    expect(r.rows.map((row) => row.privilege_type)).toEqual(["INSERT", "SELECT"]);
  });
});

/**
 * DEV-047 / BL-143 (migration 0098): the three SECURITY DEFINER helpers every
 * workspace-access policy rests on — `app.active_member_id`,
 * `app.has_project_capability` and `app.project_has_grants` (0011) — pin the
 * empty search path the project's definer rule asks for, not `public`. Their
 * bodies qualify every name, so behaviour is unchanged: the isolation tests
 * above run every one of them through the policies after the change.
 */
describe("the workspace-access helpers pin an empty search_path (DEV-047)", () => {
  it("app.active_member_id, app.has_project_capability and app.project_has_grants are SECURITY DEFINER with search_path=\"\"", async () => {
    const r = await admin.query<{ fn: string; definer: boolean; config: string[] | null }>(
      `select p.oid::regprocedure::text as fn, p.prosecdef as definer, p.proconfig as config
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname = any($1::text[])
        order by 1`, [["active_member_id", "has_project_capability", "project_has_grants"]]);
    expect(r.rows).toEqual([
      { fn: "app.active_member_id(uuid)", definer: true, config: ['search_path=""'] },
      { fn: "app.has_project_capability(uuid,uuid,text[])", definer: true, config: ['search_path=""'] },
      { fn: "app.project_has_grants(uuid,uuid)", definer: true, config: ['search_path=""'] },
    ]);
  });

  it("anon and authenticated cannot execute them", async () => {
    const r = await admin.query<{ fn: string; anon: boolean; authenticated: boolean }>(
      `select f as fn, has_function_privilege('anon', f, 'EXECUTE') as anon,
              has_function_privilege('authenticated', f, 'EXECUTE') as authenticated
         from unnest($1::text[]) as f order by 1`,
      [["app.active_member_id(uuid)", "app.has_project_capability(uuid,uuid,text[])", "app.project_has_grants(uuid,uuid)"]]);
    expect(r.rows.every((row) => !row.anon && !row.authenticated)).toBe(true);
  });

  // DEV-047 late review, gp-security S1-02: the roles whose policies call them keep EXECUTE.
  it("goproceed_app and goproceed_service can execute them", async () => {
    const r = await admin.query<{ fn: string; app: boolean; service: boolean }>(
      `select f as fn, has_function_privilege('goproceed_app', f, 'EXECUTE') as app,
              has_function_privilege('goproceed_service', f, 'EXECUTE') as service
         from unnest($1::text[]) as f order by 1`,
      [["app.active_member_id(uuid)", "app.has_project_capability(uuid,uuid,text[])", "app.project_has_grants(uuid,uuid)"]]);
    expect(r.rows.every((row) => row.app && row.service)).toBe(true);
  });
});

/**
 * DEV-055 / BL-150 (migration 0100): the SQL helpers that definer functions
 * inline — `app.current_actor()`, `app.current_external_session()`,
 * `app.service_workspace()` — name `pg_catalog.uuid` and
 * `pg_catalog.current_setting`. An inlined helper is parsed under its caller's
 * search path, and PostgreSQL searches the session's temporary schema first for
 * type names even under an empty path, so a temporary object named `uuid`
 * used to shadow the cast inside the workspace-access definers.
 *
 * The regression case creates that object in a transaction it rolls back.
 */
describe("the inlined helpers name their types (DEV-055, BL-150)", () => {
  const HELPERS = ["app.current_actor()", "app.current_external_session()", "app.service_workspace()"];

  it("each stays an inlinable invoker SQL STABLE function and names pg_catalog.uuid and pg_catalog.current_setting", async () => {
    const r = await admin.query<{ fn: string; definer: boolean; config: string[] | null; volatile: string; lang: string; src: string }>(
      `select p.oid::regprocedure::text as fn, p.prosecdef as definer, p.proconfig as config,
              p.provolatile as volatile, l.lanname as lang, p.prosrc as src
         from pg_proc p join pg_language l on l.oid = p.prolang
        where p.oid = any($1::regprocedure[]) order by 1`, [HELPERS]);
    expect(r.rows).toHaveLength(3);
    for (const row of r.rows) {
      expect({ fn: row.fn, definer: row.definer, config: row.config, volatile: row.volatile, lang: row.lang })
        .toEqual({ fn: row.fn, definer: false, config: null, volatile: "s", lang: "sql" });
      expect(row.src, row.fn).toMatch(/::pg_catalog\.uuid/);
      expect(row.src, row.fn).not.toMatch(/::uuid\b/);
      // gp-security S1-03: every cast target names pg_catalog, in either spelling.
      expect(row.src, row.fn).not.toMatch(/::\s*(?!pg_catalog\.)[a-z_]/i);
      expect(row.src, row.fn).not.toMatch(/\bas\s+(?!pg_catalog\.)[a-z_]\w*\s*\)/i);
      expect(row.src, row.fn).not.toMatch(/(^|[^.])current_setting\(/);
    }
  });

  it("app.current_actor() is still inlined for the application role", async () => {
    const plan = await asActor<{ "QUERY PLAN": string }>(USER_A, WS_A, (c) =>
      c.query("explain (verbose, costs off) select app.current_actor()"));
    const text = plan.rows.map((row) => row["QUERY PLAN"]).join("\n");
    expect(text).toMatch(/current_setting/);
    expect(text).not.toMatch(/current_actor\(/);
  });

  it("a temporary object named uuid does not change what the owner of A reads", async () => {
    // The application's own connection: PUBLIC holds TEMP on the database, so it can create one.
    // Revoking TEMP from PUBLIC (BL-152) must rewrite this case.
    const c = appClient();
    await c.connect();
    try {
      await c.query("begin");
      await c.query("create temp table uuid (x int)");
      await c.query("set local role goproceed_app");
      await c.query("select set_config('app.actor_user_id', $1, true)", [USER_A]);
      await c.query("select set_config('app.organization_id', $1, true)", [WS_A]);
      const r = await c.query<{ ws: string }>("select workspace_id as ws from public.projects");
      // Review R1-03: the owner of A reads A's projects and nothing else.
      expect(r.rows.length).toBeGreaterThan(0);
      expect(new Set(r.rows.map((row) => row.ws))).toEqual(new Set([WS_A]));
    } finally {
      await c.query("rollback").catch(() => undefined);
      await c.end().catch(() => undefined);
    }
  });

  // gp-security S1-04: the service plane inlines app.service_workspace() into its policies.
  it("a temporary object named uuid does not make the service plane's policies error", async () => {
    // The table has no rows here: the case pins the error the old body raised (gp-qa), not the scoping.
    const r = await asService<{ ws: string }>(USER_A, WS_A, async (c) => {
      await c.query("create temp table uuid (x int)");
      return c.query("select workspace_id as ws from public.telegram_chat_bindings");
    });
    expect(Array.isArray(r.rows)).toBe(true);
    expect(r.rows.every((row) => row.ws === WS_A)).toBe(true);
  });
});
