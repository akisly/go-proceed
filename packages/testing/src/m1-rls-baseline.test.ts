import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Client } from "pg";
import { adminClient, asActor, resetDb } from "./pg";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const W1 = "51111111-1111-1111-1111-111111111111";
const W2 = "52222222-2222-2222-2222-222222222222";

let admin: Client;
let projectId: string; let contractId: string; let ownPartyId: string;

beforeAll(async () => {
  await resetDb();
  admin = await adminClient();
  for (const [w, u] of [[W1, A], [W2, B]] as const) {
    await admin.query(`insert into public.organizations (id, legal_name, display_name) values ($1,'Приклад-РЛС','Приклад-РЛС')`, [w]);
    await admin.query(`insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'owner','active')`, [w, u]);
  }
  const own = await admin.query(`insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-Власна',$2) returning id`, [W1, A]);
  ownPartyId = own.rows[0].id;
  const cust = await admin.query(`insert into public.parties (workspace_id, display_name, created_by) values ($1,'Приклад-Замовник',$2) returning id`, [W1, A]);
  await admin.query(`insert into public.party_legal_profiles (workspace_id, party_id, official_name, edrpou, updated_by) values ($1,$2,'ТОВ Приклад-Власна','12345678',$3)`, [W1, ownPartyId, A]);
  await admin.query(`insert into public.own_legal_entity_profiles (workspace_id, party_id, created_by) values ($1,$2,$3)`, [W1, ownPartyId, A]);
  const pr = await admin.query(`insert into public.projects (workspace_id, name, created_by) values ($1,'Приклад-Обʼєкт',$2) returning id`, [W1, A]);
  projectId = pr.rows[0].id;
  const m = await admin.query(`select id from public.memberships where organization_id=$1 and user_id=$2`, [W1, A]);
  for (const cap of ["project.view", "project.admin", "contracts.edit", "imports.manage", "imports.publish"]) {
    await admin.query(`insert into public.project_access_grants (workspace_id, project_id, member_id, capability, granted_by) values ($1,$2,$3,$4,$5)`, [W1, projectId, m.rows[0].id, cap, A]);
  }
  const c = await admin.query(
    `insert into public.contracts (workspace_id, project_id, own_party_id, customer_party_id, contract_no, currency, tax_mode, rounding_policy, created_by)
     values ($1,$2,$3,$4,'Д-РЛС/1','UAH','exclusive','{"midpoint":"half_up","scope":"work_item_version_pool"}',$5) returning id`,
    [W1, projectId, ownPartyId, cust.rows[0].id, A]);
  contractId = c.rows[0].id;
}, 180_000);
afterAll(async () => { await admin.end(); });

describe("INV-001/002 — contract-baseline isolation and immutability", () => {
  it("B cannot see W1 contracts even by id", async () => {
    const r = await asActor(B, W2, (c) => c.query(`select * from public.contracts where id=$1`, [contractId]));
    expect(r.rows).toHaveLength(0);
  });

  it("A with grants sees the contract", async () => {
    const r = await asActor(A, W1, (c) => c.query(`select * from public.contracts where id=$1`, [contractId]));
    expect(r.rows).toHaveLength(1);
  });

  it("published contract_versions reject UPDATE and DELETE (trigger, all roles)", async () => {
    const batch = await admin.query(
      `insert into public.import_batches (workspace_id, project_id, contract_id, created_by) values ($1,$2,$3,$4) returning id`,
      [W1, projectId, contractId, A]);
    const v = await admin.query(
      `insert into public.contract_versions
        (workspace_id, project_id, contract_id, version_no, own_party_snapshot, customer_party_snapshot,
         currency, tax_mode, terms, approval_policy, rounding_policy,
         source_tolerance_minor_units, source_tolerance_bps, import_batch_id, source_manifest_hash, published_by)
       values ($1,$2,$3,1,'{}','{}','UAH','exclusive','{}','{}','{"midpoint":"half_up","scope":"work_item_version_pool"}',100,10,$4,repeat('a',64),$5)
       returning id`,
      [W1, projectId, contractId, batch.rows[0].id, A]);
    await expect(admin.query(`update public.contract_versions set currency='USD' where id=$1`, [v.rows[0].id]))
      .rejects.toThrow(/immutable/i);
    await expect(admin.query(`delete from public.contract_versions where id=$1`, [v.rows[0].id]))
      .rejects.toThrow(/immutable/i);
  });

  it("append-only import_files reject UPDATE/DELETE", async () => {
    const f = await admin.query(
      `insert into public.import_files (workspace_id, import_batch_id, filename, byte_size, content_hash, detected_format, storage_key, source_bytes, uploaded_by)
       select $1, id, 'приклад.csv', 3, repeat('b',64), 'csv', 'pg://x', '\\x616263', $2 from public.import_batches where workspace_id=$1 limit 1 returning id`,
      [W1, A]);
    await expect(admin.query(`update public.import_files set filename='x' where id=$1`, [f.rows[0].id]))
      .rejects.toThrow(/immutable/i);
    await expect(admin.query(`delete from public.import_files where id=$1`, [f.rows[0].id]))
      .rejects.toThrow(/immutable/i);
  });

  it("aktflow_app has no UPDATE/DELETE grant on append-only tables", async () => {
    const r = await admin.query(
      `select table_name, privilege_type from information_schema.role_table_grants
        where grantee='aktflow_app' and table_schema='public'
          and table_name in ('contract_versions','work_items','import_files','import_row_results','source_amount_resolutions','project_responsibility_assignments')
          and privilege_type in ('UPDATE','DELETE')`);
    expect(r.rows).toEqual([]);
  });

  it("import batch is invisible to a member without a project grant (own workspace)", async () => {
    await admin.query(
      `insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'member','active')`,
      [W1, B]);
    const r = await asActor(B, W1, (c) => c.query(`select * from public.import_batches where workspace_id=$1`, [W1]));
    expect(r.rows).toHaveLength(0);
    await admin.query(`delete from public.memberships where organization_id=$1 and user_id=$2`, [W1, B]);
  });
});
