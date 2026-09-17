import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { Client } from "pg";
import { adminClient, asActor, dropWorkspaces } from "./pg";

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
    // project.admin in B, so the admin branch is live for B and still reaches
    // nothing of A.
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
