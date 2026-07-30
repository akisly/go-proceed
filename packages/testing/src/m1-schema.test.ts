import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, resetDb } from "./pg";

const M1_WORKSPACE_TABLES = [
  "invitations", "parties", "party_legal_profiles", "own_legal_entity_profiles",
  "party_contacts", "projects", "project_parties", "project_access_grants",
  "project_responsibility_assignments",
];

let admin: Client;
beforeAll(async () => { await resetDb(); admin = await adminClient(); }, 180_000);
afterAll(async () => { await admin.end(); });

describe("M1 workspace-access schema", () => {
  it("every M1 workspace table exists with a NOT NULL workspace_id", async () => {
    for (const t of M1_WORKSPACE_TABLES) {
      const r = await admin.query(
        `select is_nullable from information_schema.columns
          where table_schema='public' and table_name=$1 and column_name='workspace_id'`, [t]);
      expect(r.rows, t).toHaveLength(1);
      expect(r.rows[0].is_nullable, t).toBe("NO");
    }
  });

  it("every M1 workspace table has unique (workspace_id, id) or equivalent PK", async () => {
    for (const t of M1_WORKSPACE_TABLES.filter((x) => x !== "own_legal_entity_profiles")) {
      const r = await admin.query(
        `select 1 from pg_constraint c join pg_class rel on rel.oid = c.conrelid
          where rel.relname = $1 and c.contype in ('u','p')
            and (select array_agg(a.attname::text order by a.attname)
                   from unnest(c.conkey) k join pg_attribute a
                     on a.attrelid = rel.oid and a.attnum = k) = array['id','workspace_id']`, [t]);
      expect(r.rows.length, t).toBeGreaterThan(0);
    }
    const pk = await admin.query(
      `select 1 from pg_constraint c join pg_class rel on rel.oid = c.conrelid
        where rel.relname = 'own_legal_entity_profiles' and c.contype = 'p'`);
    expect(pk.rows).toHaveLength(1);
  });

  it("project-scoped tables carry tenant-safe composite FKs to projects", async () => {
    for (const t of ["project_parties", "project_access_grants", "project_responsibility_assignments"]) {
      const r = await admin.query(
        `select 1 from pg_constraint c
          join pg_class rel on rel.oid = c.conrelid
          join pg_class ref on ref.oid = c.confrelid
          where rel.relname = $1 and ref.relname = 'projects' and c.contype = 'f'
            and cardinality(c.conkey) = 2`, [t]);
      expect(r.rows.length, t).toBeGreaterThan(0);
    }
  });

  it("memberships now enforces the four governance roles and canonical statuses", async () => {
    await admin.query(`insert into public.organizations (id, legal_name, display_name) values ('11111111-1111-1111-1111-111111111111','Приклад-Орг','Приклад-Орг') on conflict do nothing`);
    await expect(admin.query(
      `insert into public.memberships (organization_id, user_id, role, status)
       values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','foreman','active')`,
    )).rejects.toThrow(/memberships_role_check/);
    await expect(admin.query(
      `insert into public.memberships (organization_id, user_id, role, status)
       values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','member','invited')`,
    )).rejects.toThrow(/memberships_status_check/);
    await admin.query(`delete from public.memberships where organization_id='11111111-1111-1111-1111-111111111111'`);
    await admin.query(`delete from public.organizations where id='11111111-1111-1111-1111-111111111111'`);
  });

  it("workspace-leading index exists for every M1 workspace table FK path", async () => {
    for (const t of M1_WORKSPACE_TABLES) {
      const r = await admin.query(
        `select 1 from pg_index i
          join pg_class rel on rel.oid = i.indrelid
          join pg_attribute a on a.attrelid = rel.oid and a.attnum = i.indkey[0]
          where rel.relname = $1 and a.attname = 'workspace_id'`, [t]);
      expect(r.rows.length, t).toBeGreaterThan(0);
    }
  });
});
