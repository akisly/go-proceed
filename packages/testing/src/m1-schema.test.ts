import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, resetDb } from "./pg";

const M1_WORKSPACE_TABLES = [
  "invitations", "parties", "party_legal_profiles", "own_legal_entity_profiles",
  "party_contacts", "projects", "project_parties", "project_access_grants",
  "project_responsibility_assignments",
  // DEV-044's end fact (0097), listed by DEV-052 (BL-144).
  "project_responsibility_assignment_ends",
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
    // audit_events joined this list in 0040. It is deliberately NOT added to
    // M1_WORKSPACE_TABLES, which requires a NOT NULL workspace_id — audit's
    // tenant column is organization_id and its project_id is nullable by
    // design (workspace-scoped commands record no project).
    for (const t of ["project_parties", "project_access_grants", "project_responsibility_assignments",
                     "project_responsibility_assignment_ends", "audit_events"]) {
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

const M1_BASELINE_TABLES = [
  "unit_definitions", "locations", "contracts", "contract_versions",
  "work_items", "import_batches", "import_files", "import_row_results",
  "source_amount_resolutions",
];

describe("M1 contract-baseline schema", () => {
  const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const W = "41111111-1111-1111-1111-111111111111";

  it("every baseline table exists with NOT NULL workspace_id", async () => {
    for (const t of M1_BASELINE_TABLES) {
      const col = await admin.query(
        `select is_nullable from information_schema.columns
          where table_schema='public' and table_name=$1 and column_name='workspace_id'`, [t]);
      expect(col.rows, t).toHaveLength(1);
      expect(col.rows[0].is_nullable, t).toBe("NO");
    }
  });

  it("INV-022: duplicate normalized contract number within (workspace, own party) is rejected", async () => {
    await admin.query(`insert into public.organizations (id, legal_name, display_name) values ($1,'Приклад-Т','Приклад-Т')`, [W]);
    const p = await admin.query(`insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-Власна',$2) returning id`, [W, A]);
    const c = await admin.query(`insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-Замовник',$2) returning id`, [W, A]);
    await admin.query(`insert into public.party_legal_profiles (workspace_id, party_id, official_name, edrpou, updated_by) values ($1,$2,'ТОВ Приклад-Власна','12345678',$3)`, [W, p.rows[0].id, A]);
    await admin.query(`insert into public.own_legal_entity_profiles (workspace_id, party_id, created_by) values ($1,$2,$3)`, [W, p.rows[0].id, A]);
    const pr = await admin.query(`insert into public.projects (workspace_id, name, created_by) values ($1,'Приклад-Обʼєкт-К',$2) returning id`, [W, A]);
    const ins = (no: string) => admin.query(
      `insert into public.contracts (workspace_id, project_id, own_party_id, customer_party_id, contract_no, currency, tax_mode, rounding_policy, created_by)
       values ($1,$2,$3,$4,$5,'UAH','exclusive','{"midpoint":"half_up","scope":"work_item_version_pool"}',$6)`,
      [W, pr.rows[0].id, p.rows[0].id, c.rows[0].id, no, A]);
    await ins("Д-2026/01");
    await expect(ins("  д-2026/01 ")).rejects.toThrow(/contracts_number_unique/);
  });

  it("INV-002 (FK layer): a contract cannot use a party without an own profile", async () => {
    const notOwn = await admin.query(`insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-НеВласна',$2) returning id`, [W, A]);
    const pr = await admin.query(`select id from public.projects where workspace_id=$1 limit 1`, [W]);
    const cust = await admin.query(`select id from public.parties where workspace_id=$1 and display_name='Приклад-Замовник'`, [W]);
    await expect(admin.query(
      `insert into public.contracts (workspace_id, project_id, own_party_id, customer_party_id, contract_no, currency, tax_mode, rounding_policy, created_by)
       values ($1,$2,$3,$4,'Д-2026/02','UAH','exclusive','{"midpoint":"half_up","scope":"work_item_version_pool"}',$5)`,
      [W, pr.rows[0].id, notOwn.rows[0].id, cust.rows[0].id, A],
    )).rejects.toThrow(/foreign key/i);
  });

  it("work_items enforces gross = net + tax", async () => {
    const r = await admin.query(
      `select pg_get_constraintdef(oid) def from pg_constraint
        where conrelid = 'public.work_items'::regclass and contype = 'c'
          and pg_get_constraintdef(oid) like '%gross_amount_minor_units%'`);
    expect(r.rows.some((x: { def: string }) => /net_amount_minor_units\s*\+\s*tax_amount_minor_units/.test(x.def))).toBe(true);
  });

  it("workspace-leading index exists for every baseline table", async () => {
    for (const t of M1_BASELINE_TABLES) {
      const r = await admin.query(
        `select 1 from pg_index i
          join pg_class rel on rel.oid = i.indrelid
          join pg_attribute a on a.attrelid = rel.oid and a.attnum = i.indkey[0]
          where rel.relname = $1 and a.attname = 'workspace_id'`, [t]);
      expect(r.rows.length, t).toBeGreaterThan(0);
    }
  });
});
