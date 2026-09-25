import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, dropWorkspaces, superuserClient } from "./pg";

/**
 * THE CROSS-WORKSPACE WRITE MINIMUM, MODULE workspace_access (DEV-077, BL-164).
 *
 * DEV-076 widened a `covered` row of technical/database/rls-coverage.csv: where
 * its principal can write, a test must show a member of one workspace cannot
 * write into another. One test per row of technical/database/rls-write-coverage.csv,
 * each cited there as its `negative_test`. Per privilege the row holds:
 *
 *   - INSERT carrying the other workspace's tenant key and parent ids: refused
 *     by the policy (42501), beside the same statement with the own ids
 *     succeeding (the control);
 *   - INSERT keeping the own tenant key with the other workspace's parent id:
 *     refused by the policy (42501) or the composite foreign key (23503);
 *   - UPDATE reading no column (no WHERE, a constant SET, no RETURNING): its row
 *     count equals the own rows it may change, and the other workspace's rows
 *     read back unchanged as admin in the same transaction;
 *   - where the tenant key or a parent column is updatable, moving the own
 *     rows into the other workspace, again reading no column: refused by the
 *     policy (42501), or 23503 for a parent column alone. A move-out with a
 *     WHERE is refused by the SELECT policy applied to the new row even when
 *     WITH CHECK is `true` (observed on 17.6, DEV-077), so it would mask the
 *     very policy it is meant to test.
 *
 * The actor is the owner of A throughout, declaring A. Owners hold every
 * capability these policies ask for, so a refusal of B's ids cannot come from
 * a missing grant: the control, with A's ids, succeeds.
 *
 * Every probe runs on the local superuser connection in one transaction that
 * is always rolled back: each statement runs inside a savepoint under `SET
 * LOCAL ROLE goproceed_app` with the actor's GUCs, and the admin read-back
 * runs after `RESET ROLE` in the same transaction, so the check sees what the
 * statement did before the rollback undoes it. A trigger's refusal does not
 * count (owner, 2026-09-24): the two tables whose guards fire on UPDATE have
 * their user triggers disabled inside the probe's transaction (`DISABLE
 * TRIGGER USER`, which leaves the foreign keys' internal triggers on), and the
 * rollback re-enables them; the test then asserts they are enabled.
 *
 * The fixture is this file's own (ids `de077…`), dropped before and after. No
 * resetDb.
 */
const WS_A = "de077a00-0000-4000-8000-000000000001";
const WS_B = "de077b00-0000-4000-8000-000000000001";
const USER_A = "de077a00-0000-4000-8000-0000000000a1";
const USER_B = "de077b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];

interface Side {
  ws: string; user: string; member: string;
  p1: string; p2: string; x: string; y: string; z: string;
  invitation: string; contact: string; projectParty: string; assignment: string;
}

/**
 * `reason` separates the two refusals SQLSTATE 42501 names (gp-security DEV-077 S2):
 * `policy` — «new row violates row-level security policy»; `privilege` — «permission denied».
 */
interface Outcome { rowCount: number | null; code: string | null; reason: "policy" | "privilege" | "other" | null }

let admin: Client;
let A: Side;
let B: Side;

async function one<T extends Record<string, unknown>>(sql: string, params: unknown[]): Promise<T> {
  const r = await admin.query<T>(sql, params);
  if (!r.rows[0]) throw new Error(`fixture: no row from ${sql}`);
  return r.rows[0];
}

async function seedSide(ws: string, user: string, name: string): Promise<Side> {
  await admin.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now())
     on conflict (id) do nothing`, [user, `${user}@fixture.test`]);
  await admin.query("insert into public.organizations (id, legal_name, display_name) values ($1, $2, $2)",
    [ws, `Приклад-Простір-${name}`]);
  const member = (await one<{ id: string }>(
    "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'owner', 'active') returning id",
    [ws, user])).id;
  const project = async (label: string) => (await one<{ id: string }>(
    "insert into public.projects (workspace_id, name, created_by) values ($1, $2, $3) returning id",
    [ws, `Приклад-Обʼєкт-${name}-${label}`, user])).id;
  const p1 = await project("1");
  const p2 = await project("2");
  for (const projectId of [p1, p2]) {
    for (const capability of ["project.view", "project.admin"]) {
      await admin.query(
        `insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by)
         values ($1, $2, $3, $4, $5)`, [ws, projectId, member, capability, user]);
    }
  }
  const party = async (label: string) => (await one<{ id: string }>(
    "insert into public.parties (workspace_id, display_name, created_by) values ($1, $2, $3) returning id",
    [ws, `Приклад-Сторона-${name}-${label}`, user])).id;
  const x = await party("X");
  const y = await party("Y");
  const z = await party("Z");
  for (const p of [x, y]) {
    await admin.query(
      "insert into public.party_legal_profiles (workspace_id, party_id, official_name, updated_by) values ($1, $2, $3, $4)",
      [ws, p, `Приклад-Сторона-${name} ТОВ`, user]);
  }
  await admin.query("insert into public.own_legal_entity_profiles (workspace_id, party_id, created_by) values ($1, $2, $3)",
    [ws, x, user]);
  const contact = (await one<{ id: string }>(
    "insert into public.party_contacts (workspace_id, party_id, full_name, created_by) values ($1, $2, $3, $4) returning id",
    [ws, x, `Приклад-Контакт-${name}`, user])).id;
  await admin.query("insert into public.legal_entities (organization_id, legal_name) values ($1, $2)",
    [ws, `Приклад-Юрособа-${name}`]);
  const invitation = (await one<{ id: string }>(
    `insert into public.invitations (workspace_id, email, role, token_hash, expires_at, invited_by)
     values ($1, $2, 'member', $3, now() + interval '1 day', $4) returning id`,
    [ws, `invite-${ws}@fixture.test`, createHash("sha256").update(`dev077:${ws}:invitation`).digest("hex"), user])).id;
  const projectParty = (await one<{ id: string }>(
    "insert into public.project_parties (workspace_id, project_id, party_id, relationship, created_by) values ($1, $2, $3, 'customer', $4) returning id",
    [ws, p1, x, user])).id;
  const assignment = (await one<{ id: string }>(
    `insert into public.project_responsibility_assignments (workspace_id, project_id, member_id, responsibility, assigned_by)
     values ($1, $2, $3, 'performer', $4) returning id`, [ws, p1, member, user])).id;
  await admin.query("insert into public.project_field_channels (workspace_id, project_id, channel) values ($1, $2, 'telegram')",
    [ws, p1]);
  return { ws, user, member, p1, p2, x, y, z, invitation, contact, projectParty, assignment };
}

/** One probe: a transaction on the superuser connection, always rolled back. */
interface Probe {
  /** A statement as `actor` under goproceed_app, declaring `org`; its row count, or its SQLSTATE if refused. */
  as(sql: string, params?: unknown[], actor?: string, org?: string): Promise<Outcome>;
  /** A statement as the superuser, in the same transaction. */
  admin<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

async function probe(body: (p: Probe) => Promise<void>, disableTriggersOn?: string): Promise<void> {
  const c = superuserClient();
  await c.connect();
  try {
    await c.query("begin");
    if (disableTriggersOn) await c.query(`alter table public.${disableTriggersOn} disable trigger user`);
    const p: Probe = {
      async as(sql, params = [], actor = USER_A, org = WS_A) {
        await c.query("savepoint probe");
        await c.query("set local role goproceed_app");
        await c.query("select set_config('app.actor_user_id', $1, true), set_config('app.organization_id', $2, true)", [actor, org]);
        try {
          const r = await c.query(sql, params);
          await c.query("release savepoint probe");
          await c.query("reset role");
          return { rowCount: r.rowCount, code: null, reason: null };
        } catch (e) {
          await c.query("rollback to savepoint probe");
          await c.query("reset role");
          const { code, message } = e as { code?: string; message?: string };
          const reason = /row-level security policy/.test(message ?? "") ? "policy"
            : /permission denied/.test(message ?? "") ? "privilege" : "other";
          return { rowCount: null, code: code ?? "unknown", reason };
        }
      },
      async admin(sql, params = []) {
        return (await c.query(sql, params)).rows;
      },
    };
    await body(p);
  } finally {
    await c.query("rollback").catch(() => undefined);
    await c.end().catch(() => undefined);
  }
}

/** Every row of `table` in workspace `ws` as JSON text, sorted: the read-back that must not change. */
async function snapshot(p: Probe, table: string, tenant: string, ws: string): Promise<string[]> {
  const rows = await p.admin<{ j: string }>(
    `select to_jsonb(t)::text as j from public.${table} t where t.${tenant} = $1 order by 1`, [ws]);
  return rows.map((r) => r.j);
}

async function countOf(p: Probe, table: string, tenant: string, ws: string): Promise<number> {
  const rows = await p.admin<{ n: string }>(`select count(*) as n from public.${table} where ${tenant} = $1`, [ws]);
  return Number(rows[0]?.n ?? 0);
}

/** The UPDATE probe: no WHERE, a constant SET; changes every own row it may, and none of B's. */
async function updateReadsNoColumn(
  table: string, set: string, tenant = "workspace_id", disable?: string,
): Promise<{ outcome: Outcome; own: number; before: string[]; after: string[] }> {
  let result = { outcome: { rowCount: null, code: null, reason: null } as Outcome, own: -1, before: [] as string[], after: [] as string[] };
  await probe(async (p) => {
    const own = await countOf(p, table, tenant, WS_A);
    const before = await snapshot(p, table, tenant, WS_B);
    const outcome = await p.as(`update public.${table} set ${set}`);
    const after = await snapshot(p, table, tenant, WS_B);
    result = { outcome, own, before, after };
  }, disable);
  return result;
}

async function triggersEnabled(table: string): Promise<string[]> {
  const r = await admin.query<{ s: string }>(
    `select tgenabled::text as s from pg_trigger where tgrelid = ('public.' || $1)::regclass and not tgisinternal`, [table]);
  return r.rows.map((row) => row.s);
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  A = await seedSide(WS_A, USER_A, "A");
  B = await seedSide(WS_B, USER_B, "B");
  // Premise: each owner holds project.view and project.admin on every project of its side.
  const held = await admin.query<{ n: string }>(
    `select count(*) as n from public.project_access_grants g join public.memberships m on m.id = g.member_id
      where g.workspace_id = any($1) and g.revoked_at is null`, [BOTH]);
  expect(Number(held.rows[0]?.n)).toBe(8);
}, 60_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("workspace_access cross-workspace write denial", () => {
  it("invitations: an owner of A cannot insert or update an invitation of B", async () => {
    await probe(async (p) => {
      const hash = (tag: string) => createHash("sha256").update(`dev077:probe:${tag}`).digest("hex");
      const insert = "insert into public.invitations (workspace_id, email, role, token_hash, expires_at, invited_by, accepted_membership_id) values ($1, $2, 'member', $3, now() + interval '1 day', $4, $5)";
      expect(await p.as(insert, [WS_B, "probe-b@fixture.test", hash("b"), USER_A, null])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as(insert, [WS_A, "probe-mixed@fixture.test", hash("mixed"), USER_A, B.member]))
        .toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
      expect(await p.as(insert, [WS_A, "probe-a@fixture.test", hash("a"), USER_A, null])).toEqual({ rowCount: 1, code: null, reason: null });
      expect(await p.as("update public.invitations set workspace_id = $1", [WS_B]))
        .toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as("update public.invitations set accepted_membership_id = $1", [B.member]))
        .toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
    });
    const u = await updateReadsNoColumn("invitations", "updated_at = now()");
    expect(u.own).toBeGreaterThanOrEqual(1);
    expect(u.outcome).toEqual({ rowCount: u.own, code: null, reason: null });
    expect(u.after).toEqual(u.before);
  });

  it("legal_entities: an owner of A cannot insert a legal entity into B", async () => {
    await probe(async (p) => {
      const insert = "insert into public.legal_entities (organization_id, legal_name) values ($1, 'Приклад-Юрособа-проба')";
      expect(await p.as(insert, [WS_B])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as(insert, [WS_A])).toEqual({ rowCount: 1, code: null, reason: null });
    });
  });

  it("memberships: an owner of A cannot join B, and no member can update a membership", async () => {
    await probe(async (p) => {
      const insert = "insert into public.memberships (organization_id, user_id, role, status) values ($1, $2, 'owner', 'active')";
      expect(await p.as(insert, [WS_B, USER_A])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      // The control: the bootstrap membership of a workspace the actor has just created (m_insert
      // admits an owner row only where the workspace has no members yet; A already has one).
      const fresh = randomUUID();
      expect(await p.as("insert into public.organizations (id, legal_name, display_name) values ($1, 'Приклад-C', 'Приклад-C')", [fresh]))
        .toEqual({ rowCount: 1, code: null, reason: null });
      expect(await p.as(insert, [fresh, USER_A])).toEqual({ rowCount: 1, code: null, reason: null });
      // 0103: the UPDATE grant is gone, so an UPDATE is refused at the privilege, own rows included.
      expect(await p.as("update public.memberships set role = 'owner'")).toEqual({ rowCount: null, code: "42501", reason: "privilege" });
    });
  });

  it("organizations: an owner of A cannot take B's id or point a new workspace at B's party", async () => {
    // Owner, 2026-09-25: org_insert admits any signed-in actor by design, so the refusals are B's primary
    // key, the absent UPDATE grant behind ON CONFLICT DO UPDATE, and the composite foreign key.
    await probe(async (p) => {
      const insert = "insert into public.organizations (id, legal_name, display_name, default_own_party_id) values ($1, 'Приклад-проба', 'Приклад-проба', $2)";
      expect(await p.as(insert, [WS_B, null])).toEqual({ rowCount: null, code: "23505", reason: "other" });
      expect(await p.as(`${insert} on conflict (id) do update set display_name = 'Приклад-захоплено'`, [WS_B, null]))
        .toEqual({ rowCount: null, code: "42501", reason: "privilege" });
      expect(await p.as(insert, [randomUUID(), B.x])).toEqual({ rowCount: null, code: "23503", reason: "other" });
      expect(await p.as(insert, [randomUUID(), null])).toEqual({ rowCount: 1, code: null, reason: null });
      // The policy's own refusal: with no actor (an empty actor GUC makes app.current_actor() NULL) nobody may create one.
      expect(await p.as(insert, [randomUUID(), null], "")).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.admin<{ d: string }>("select display_name as d from public.organizations where id = $1", [WS_B]))
        .toEqual([{ d: "Приклад-Простір-B" }]);
    });
  });

  it("own_legal_entity_profiles: an owner of A cannot insert B's own legal entity", async () => {
    await probe(async (p) => {
      const insert = "insert into public.own_legal_entity_profiles (workspace_id, party_id, created_by) values ($1, $2, $3)";
      expect(await p.as(insert, [WS_B, B.y, USER_A])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as(insert, [WS_A, B.y, USER_A])).toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
      expect(await p.as(insert, [WS_A, A.y, USER_A])).toEqual({ rowCount: 1, code: null, reason: null });
    });
  });

  it("parties: an owner of A cannot insert, update or move a party into B", async () => {
    await probe(async (p) => {
      const insert = "insert into public.parties (workspace_id, display_name, created_by) values ($1, 'Приклад-проба', $2)";
      expect(await p.as(insert, [WS_B, USER_A])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as(insert, [WS_A, USER_A])).toEqual({ rowCount: 1, code: null, reason: null });
      expect(await p.as("update public.parties set workspace_id = $1", [WS_B]))
        .toEqual({ rowCount: null, code: "42501", reason: "policy" });
    });
    const u = await updateReadsNoColumn("parties", "display_name = 'Приклад-проба'");
    expect(u.own).toBeGreaterThanOrEqual(1);
    expect(u.outcome).toEqual({ rowCount: u.own, code: null, reason: null });
    expect(u.after).toEqual(u.before);
  });

  it("party_contacts: an owner of A cannot insert, update or move a contact into B", async () => {
    await probe(async (p) => {
      const insert = "insert into public.party_contacts (workspace_id, party_id, full_name, created_by) values ($1, $2, 'Приклад-проба', $3)";
      expect(await p.as(insert, [WS_B, B.x, USER_A])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as(insert, [WS_A, B.x, USER_A])).toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
      expect(await p.as(insert, [WS_A, A.x, USER_A])).toEqual({ rowCount: 1, code: null, reason: null });
      expect(await p.as("update public.party_contacts set workspace_id = $1, party_id = $2", [WS_B, B.x]))
        .toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as("update public.party_contacts set party_id = $1", [B.x]))
        .toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
    });
    const u = await updateReadsNoColumn("party_contacts", "role_title = 'Приклад-проба'");
    expect(u.own).toBeGreaterThanOrEqual(1);
    expect(u.outcome).toEqual({ rowCount: u.own, code: null, reason: null });
    expect(u.after).toEqual(u.before);
  });

  it("party_legal_profiles: an owner of A cannot insert, update or move a legal profile into B", async () => {
    await probe(async (p) => {
      const insert = "insert into public.party_legal_profiles (workspace_id, party_id, official_name, updated_by) values ($1, $2, 'Приклад-проба ТОВ', $3)";
      expect(await p.as(insert, [WS_B, B.z, USER_A])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as(insert, [WS_A, B.z, USER_A])).toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
      expect(await p.as(insert, [WS_A, A.z, USER_A])).toEqual({ rowCount: 1, code: null, reason: null });
      // Both profiles, the own legal entity's (the CASE's owner branch) and Y's (its ELSE branch).
      expect(await p.as("update public.party_legal_profiles set workspace_id = $1, party_id = $2", [WS_B, B.z]))
        .toEqual({ rowCount: null, code: "42501", reason: "policy" });
      // A parent column alone is the composite foreign key's to refuse; one row, so the unique key cannot answer first.
      expect(await p.as("update public.party_legal_profiles set party_id = $1 where party_id = $2", [B.z, A.y]))
        .toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
    });
    const u = await updateReadsNoColumn("party_legal_profiles", "tax_status = 'Приклад-проба'");
    expect(u.own).toBeGreaterThanOrEqual(1);
    expect(u.outcome).toEqual({ rowCount: u.own, code: null, reason: null });
    expect(u.after).toEqual(u.before);
  });

  it("project_access_grants: an owner of A cannot grant on B's project or change B's grants", async () => {
    await probe(async (p) => {
      const insert = "insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by) values ($1, $2, $3, 'contracts.edit', $4)";
      expect(await p.as(insert, [WS_B, B.p1, B.member, USER_A])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      // The bootstrap branch (a project with no grants yet) admits only the actor's own membership in that workspace.
      const p3 = await p.admin<{ id: string }>(
        "insert into public.projects (workspace_id, name, created_by) values ($1, 'Приклад-Обʼєкт-B-3', $2) returning id", [WS_B, USER_B]);
      expect(await p.as(insert, [WS_B, p3[0]!.id, B.member, USER_A])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as(insert, [WS_A, A.p1, B.member, USER_A])).toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
      expect(await p.as(insert, [WS_A, B.p1, A.member, USER_A])).toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
      expect(await p.as(insert, [WS_A, A.p1, A.member, USER_A])).toEqual({ rowCount: 1, code: null, reason: null });
    });
    // UPDATE is granted on (revoked_at, version) only, neither of which carries a key: no move-out.
    const u = await updateReadsNoColumn("project_access_grants", "version = 424242", "workspace_id", "project_access_grants");
    expect(u.own).toBe(4);
    expect(u.outcome).toEqual({ rowCount: u.own, code: null, reason: null });
    expect(u.after).toEqual(u.before);
    expect(await triggersEnabled("project_access_grants")).toEqual(["O"]);
  });

  it("project_field_channels: an owner of A cannot open, update, move or lock a channel into B", async () => {
    await probe(async (p) => {
      const insert = "insert into public.project_field_channels (workspace_id, project_id, channel, locked_at, locked_by_member_id) values ($1, $2, 'telegram', $3, $4)";
      expect(await p.as(insert, [WS_B, B.p2, null, null])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as(insert, [WS_A, A.p2, new Date(), B.member])).toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
      expect(await p.as(insert, [WS_A, A.p2, null, null])).toEqual({ rowCount: 1, code: null, reason: null });
    });
    await probe(async (p) => {
      expect(await p.as("update public.project_field_channels set workspace_id = $1, project_id = $2", [WS_B, B.p2]))
        .toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as("update public.project_field_channels set locked_at = now(), locked_by_member_id = $1", [B.member]))
        .toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
      expect(await p.as("update public.project_field_channels set project_id = $1", [B.p2]))
        .toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
    }, "project_field_channels");
    const u = await updateReadsNoColumn("project_field_channels", "version = 424242", "workspace_id", "project_field_channels");
    expect(u.own).toBeGreaterThanOrEqual(1);
    expect(u.outcome).toEqual({ rowCount: u.own, code: null, reason: null });
    expect(u.after).toEqual(u.before);
    expect(await triggersEnabled("project_field_channels")).toEqual(["O"]);
  });

  it("project_parties: an owner of A cannot insert, update or move a project party into B", async () => {
    await probe(async (p) => {
      const insert = "insert into public.project_parties (workspace_id, project_id, party_id, relationship, created_by) values ($1, $2, $3, 'designer', $4)";
      expect(await p.as(insert, [WS_B, B.p1, B.x, USER_A])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as(insert, [WS_A, A.p1, B.x, USER_A])).toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
      expect(await p.as(insert, [WS_A, A.p1, A.x, USER_A])).toEqual({ rowCount: 1, code: null, reason: null });
      expect(await p.as("update public.project_parties set workspace_id = $1, project_id = $2, party_id = $3", [WS_B, B.p1, B.x]))
        .toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as("update public.project_parties set party_id = $1", [B.x]))
        .toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
      expect(await p.as("update public.project_parties set project_id = $1", [B.p1]))
        .toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
    });
    const u = await updateReadsNoColumn("project_parties", "note = 'Приклад-проба'");
    expect(u.own).toBeGreaterThanOrEqual(1);
    expect(u.outcome).toEqual({ rowCount: u.own, code: null, reason: null });
    expect(u.after).toEqual(u.before);
  });

  it("project_responsibility_assignment_ends: an owner of A cannot end B's assignment", async () => {
    await probe(async (p) => {
      const insert = "insert into public.project_responsibility_assignment_ends (workspace_id, project_id, assignment_id, ended_by) values ($1, $2, $3, $4)";
      expect(await p.as(insert, [WS_B, B.p1, B.assignment, USER_A])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as(insert, [WS_A, A.p1, B.assignment, USER_A])).toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
      expect(await p.as(insert, [WS_A, A.p1, A.assignment, USER_A])).toEqual({ rowCount: 1, code: null, reason: null });
    });
  });

  it("project_responsibility_assignments: an owner of A cannot assign on B's project or to B's member", async () => {
    await probe(async (p) => {
      const insert = "insert into public.project_responsibility_assignments (workspace_id, project_id, member_id, responsibility, assigned_by) values ($1, $2, $3, 'evidence_recorder', $4)";
      expect(await p.as(insert, [WS_B, B.p1, B.member, USER_A])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as(insert, [WS_A, A.p1, B.member, USER_A])).toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
      expect(await p.as(insert, [WS_A, A.p1, A.member, USER_A])).toEqual({ rowCount: 1, code: null, reason: null });
    });
  });

  it("projects: an owner of A cannot insert, update or move a project into B", async () => {
    await probe(async (p) => {
      const insert = "insert into public.projects (workspace_id, name, created_by) values ($1, 'Приклад-Обʼєкт-проба', $2)";
      expect(await p.as(insert, [WS_B, USER_A])).toEqual({ rowCount: null, code: "42501", reason: "policy" });
      expect(await p.as(insert, [WS_A, USER_A])).toEqual({ rowCount: 1, code: null, reason: null });
      expect(await p.as("update public.projects set workspace_id = $1", [WS_B]))
        .toEqual({ rowCount: null, code: "42501", reason: "policy" });
    });
    const u = await updateReadsNoColumn("projects", "description = 'Приклад-проба'");
    expect(u.own).toBe(2);
    expect(u.outcome).toEqual({ rowCount: u.own, code: null, reason: null });
    expect(u.after).toEqual(u.before);
  });
});
