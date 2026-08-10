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

  // ── EDITED IN THE v0.1-M1 MANUAL-BASELINE SLICE ───────────────────────────
  // This was one assertion: aktflow_app holds no UPDATE or DELETE on
  // contract_versions, work_items, import_files, import_row_results,
  // source_amount_resolutions or project_responsibility_assignments. Migration
  // 0042 grants exactly the first two, because ADR-006 decision 2 makes a
  // hand-typed baseline a draft that must reach 'published' and whose lines
  // must be correctable until it does — and 0042:59-65 schedules this edit into
  // the same slice rather than leaving the assertion to be deleted later by
  // somebody who does not know why it was written.
  //
  // IT IS NOT DELETED. An append-only table losing its guard silently is a
  // failure this repository has already had once, so the assertion splits into
  // four: the tables that are STILL append-only keep the original claim, the
  // two that changed state exactly what they gained and what they did not, and
  // the prohibition that used to live in the absent grant is asserted where it
  // now lives — in app.guard_contract_version() and app.guard_work_item().
  //
  // NOTHING BELOW HAS BEEN EXECUTED: no database was available when this edit
  // was written, so these four assertions were checked by reading 0042 and are
  // not claimed to pass.

  it("aktflow_app still has no UPDATE/DELETE on the tables that stayed append-only", async () => {
    const r = await admin.query(
      `select table_name, privilege_type from information_schema.role_table_grants
        where grantee='aktflow_app' and table_schema='public'
          and table_name in ('import_files','import_row_results','source_amount_resolutions','project_responsibility_assignments')
          and privilege_type in ('UPDATE','DELETE')`);
    expect(r.rows).toEqual([]);
  });

  it("contract_versions gained UPDATE and did NOT gain DELETE", async () => {
    // UPDATE is what the draft -> published transition needs. DELETE is not:
    // there is no contract_versions.remove row in scope-v0.1.csv, so an
    // abandoned draft keeps its version number forever — a real cost of the
    // shape, recorded rather than worked around (0042:118-121).
    const r = await admin.query<{ privilege_type: string }>(
      `select distinct privilege_type from information_schema.role_table_grants
        where grantee='aktflow_app' and table_schema='public'
          and table_name='contract_versions' and privilege_type in ('UPDATE','DELETE')`);
    expect(r.rows.map((x) => x.privilege_type)).toEqual(["UPDATE"]);
  });

  it("work_items gained UPDATE and DELETE, for a DRAFT version's lines only", async () => {
    // work_items.remove is the only DELETE in the v0.1 route set. The grant is
    // unconditional; the condition — the owning version is still a draft — is
    // app.guard_work_item()'s, and it is asserted behaviourally in
    // apps/app/tests/manual-baseline.int.test.ts, at both layers.
    const r = await admin.query<{ privilege_type: string }>(
      `select distinct privilege_type from information_schema.role_table_grants
        where grantee='aktflow_app' and table_schema='public'
          and table_name='work_items' and privilege_type in ('UPDATE','DELETE')
        order by privilege_type`);
    expect(r.rows.map((x) => x.privilege_type)).toEqual(["DELETE", "UPDATE"]);
  });

  it("the prohibition moved from the missing grant to a guard, on both tables", async () => {
    // The blanket app.reject_mutation() triggers 0013 installed are replaced,
    // not removed: if a future migration dropped the guards, the grants above
    // would leave a published baseline editable by any holder of contracts.edit.
    const r = await admin.query<{ tgname: string; relname: string }>(
      `select t.tgname, rel.relname
         from pg_trigger t
         join pg_class rel on rel.oid = t.tgrelid
         join pg_namespace n on n.oid = rel.relnamespace
        where not t.tgisinternal and n.nspname = 'public'
          and rel.relname in ('contract_versions','work_items')
        order by rel.relname, t.tgname`);
    const wired = r.rows.map((x) => `${x.relname}.${x.tgname}`);
    expect(wired).toContain("contract_versions.contract_versions_guard");
    expect(wired).toContain("work_items.work_items_guard");
    // Migration 0050's second guard on the same table, asserted here for the
    // reason the block exists: a future migration that dropped it would leave
    // public.work_items.work_type_key writable with a key naming no rule version
    // the workspace can bind, and a key that resolves to nothing produces an
    // empty obligation set, a vacuous stage closure and a PASSING constraint on
    // every row — silently. This is a schema fact and belongs in the baseline;
    // the behavioural cover (apps/app/tests/work-type-carrier.int.test.ts) needs
    // the full route stack, so it would not catch a drop on its own.
    expect(wired).toContain("work_items.work_items_work_type_guard");
    // And the triggers they replaced are gone rather than both being installed,
    // which would make every draft correction fail with the old message.
    expect(wired).not.toContain("contract_versions.contract_versions_immutable");
    expect(wired).not.toContain("work_items.work_items_immutable");
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
