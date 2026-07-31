import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "./pg";
import type { Client } from "pg";

// Structural assertions, not existence checks: a table that exists with the
// wrong foreign key is the failure mode this file is for.

let c: Client;
beforeAll(async () => { c = await adminClient(); });
afterAll(async () => { await c.end(); });

async function columns(table: string): Promise<Record<string, string>> {
  const r = await c.query(
    `select column_name, data_type from information_schema.columns
      where table_schema = 'public' and table_name = $1`, [table]);
  return Object.fromEntries(r.rows.map((x) => [x.column_name, x.data_type]));
}

async function constraintSrc(name: string): Promise<string | undefined> {
  const r = await c.query(
    `select pg_get_constraintdef(oid) as src from pg_constraint where conname = $1`, [name]);
  return r.rows[0]?.src;
}

const M2_TABLES = [
  "requirement_template_versions", "work_assignments", "progress_entries",
  "progress_allocation_heads", "valuation_allocations", "upload_intents",
  "capture_events", "evidence_objects",
] as const;

describe("0015 module DDL", () => {
  it("creates all eight M2 tables", async () => {
    const r = await c.query(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_name = any($1::text[])`,
      [[...M2_TABLES]]);
    expect(r.rows.map((x) => x.table_name).sort()).toEqual([...M2_TABLES].sort());
  });

  it("stores money as bigint and quantity as numeric", async () => {
    const va = await columns("valuation_allocations");
    expect(va.net_minor_units).toBe("bigint");
    expect(va.tax_minor_units).toBe("bigint");
    expect(va.gross_minor_units).toBe("bigint");
    expect(va.quantity).toBe("numeric");
    expect(va.progress_entry_id).toBe("uuid");
  });

  it("uses text+check for state columns, matching the realized database", async () => {
    const ui = await columns("upload_intents");
    expect(ui.status).toBe("text");
    expect(ui.expected_content_hash).toBe("text");
    const eo = await columns("evidence_objects");
    expect(eo.content_hash).toBe("text");
    expect(eo.inspection_status).toBe("text");
    // No enum types were introduced by this slice.
    const enums = await c.query(
      `select typname from pg_type where typtype = 'e'
        and typname = any($1::text[])`,
      [["assignment_status", "progress_entry_kind", "upload_intent_status",
        "capture_origin", "evidence_relation", "capture_time_trust",
        "inspection_status", "requirement_severity"]]);
    expect(enums.rows).toEqual([]);
  });

  it("makes an adjustment chain structurally unrepresentable (INV-023)", async () => {
    const src = await constraintSrc("progress_entries_root_is_root_fkey");
    expect(src).toMatch(/\(workspace_id, root_progress_entry_id, root_is_root\)/);
    expect(src).toMatch(/REFERENCES progress_entries\(workspace_id, id, is_root\)/);
  });

  it("keeps gross = net + tax, or all three null with a reason", async () => {
    const src = await constraintSrc("valuation_allocations_components_check");
    expect(src).toMatch(/gross_minor_units = \(net_minor_units \+ tax_minor_units\)/);
    expect(src).toMatch(/unvalued_reason IS NOT NULL/);
  });

  it("adds the composite uniques the M2 foreign keys need", async () => {
    const r = await c.query(
      `select conname from pg_constraint
        where conname = any($1::text[]) and contype = 'u'`,
      [["memberships_org_id_key", "work_items_version_scope_key",
        "work_items_contract_scope_key"]]);
    expect(r.rows.map((x) => x.conname).sort()).toEqual([
      "memberships_org_id_key", "work_items_contract_scope_key",
      "work_items_version_scope_key",
    ]);
  });

  it("binds one valuation allocation to one progress fact", async () => {
    const r = await c.query(
      `select pg_get_constraintdef(oid) as src from pg_constraint
        where conrelid = 'public.valuation_allocations'::regclass and contype = 'u'`);
    expect(r.rows.map((x) => x.src)).toContain("UNIQUE (workspace_id, progress_entry_id)");
  });
});

describe("0015 INV-023 enforcement is the database's, not a route's", () => {
  const ws = "11111111-1111-1111-1111-111111111111";
  const user = "22222222-2222-2222-2222-222222222222";
  let assignmentId: string;
  let workItemId: string;
  let projectId: string;
  let rootId: string;
  let adjustmentId: string;

  beforeAll(async () => {
    // Direct inserts: this file tests DDL, so it bypasses routes and RLS.
    await c.query(`truncate public.organizations cascade`);
    await c.query(
      `insert into auth.users (id, instance_id, aud, role, email,
                               encrypted_password, created_at, updated_at)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated',
               'authenticated', 'inv023@example.test', '', now(), now())
       on conflict (id) do nothing`, [user]);
    await c.query(
      `insert into public.organizations (id, legal_name, display_name)
       values ($1, 'Приклад-INV023', 'Приклад-INV023')`, [ws]);
    const mem = await c.query(
      `insert into public.memberships (organization_id, user_id, role, status)
       values ($1,$2,'owner','active') returning id`, [ws, user]);
    const memberId = mem.rows[0].id;
    const proj = await c.query(
      `insert into public.projects (workspace_id, name, created_by)
       values ($1,'Приклад-Проєкт',$2) returning id`, [ws, user]);
    projectId = proj.rows[0].id;

    const own = await c.query(
      `insert into public.parties (workspace_id, display_name, created_by)
       values ($1,'Приклад-Виконавець',$2) returning id`, [ws, user]);
    const customer = await c.query(
      `insert into public.parties (workspace_id, display_name, created_by)
       values ($1,'Приклад-Замовник',$2) returning id`, [ws, user]);
    // INV-002 is a foreign key: contracts.own_party_id must resolve to an own
    // legal entity profile, not merely to a party.
    await c.query(
      `insert into public.party_legal_profiles
         (workspace_id, party_id, official_name, updated_by)
       values ($1,$2,'Приклад-Виконавець ТОВ',$3)`, [ws, own.rows[0].id, user]);
    await c.query(
      `insert into public.own_legal_entity_profiles (workspace_id, party_id, created_by)
       values ($1,$2,$3)`, [ws, own.rows[0].id, user]);
    const contract = await c.query(
      `insert into public.contracts
         (workspace_id, project_id, own_party_id, customer_party_id, contract_no,
          currency, tax_mode, tax_rate_bps, rounding_policy, created_by)
       values ($1,$2,$3,$4,'ПР-INV023','UAH','exclusive',2000,
               '{"midpoint":"half_up","scope":"work_item_version_pool"}'::jsonb,$5)
       returning id`,
      [ws, projectId, own.rows[0].id, customer.rows[0].id, user]);
    const contractId = contract.rows[0].id;
    const batch = await c.query(
      `insert into public.import_batches (workspace_id, project_id, contract_id, created_by)
       values ($1,$2,$3,$4) returning id`, [ws, projectId, contractId, user]);
    const version = await c.query(
      `insert into public.contract_versions
         (workspace_id, project_id, contract_id, version_no,
          own_party_snapshot, customer_party_snapshot, currency, tax_mode, tax_rate_bps,
          terms, approval_policy, rounding_policy,
          source_tolerance_minor_units, source_tolerance_bps,
          import_batch_id, source_manifest_hash, published_by)
       values ($1,$2,$3,1,'{}'::jsonb,'{}'::jsonb,'UAH','exclusive',2000,
               '{}'::jsonb,'{}'::jsonb,'{"midpoint":"half_up"}'::jsonb,100,10,$4,
               repeat('a',64),$5)
       returning id`, [ws, projectId, contractId, batch.rows[0].id, user]);
    const versionId = version.rows[0].id;
    const unit = await c.query(
      `insert into public.unit_definitions (workspace_id, code, unit_precision, created_by)
       values ($1,'м2',3,$2) returning id`, [ws, user]);
    const wi = await c.query(
      `insert into public.work_items
         (workspace_id, project_id, contract_id, contract_version_id, position,
          description, unit_definition_id, unit_code, unit_precision,
          contract_quantity, unit_price_state, unit_price_decimal, price_basis,
          valuation_basis, currency, tax_mode, tax_rate_bps,
          net_amount_minor_units, tax_amount_minor_units, gross_amount_minor_units)
       values ($1,$2,$3,$4,1,'Приклад-позиція',$5,'м2',3,
               100,'known',100,'net','unit_price_derived','UAH','exclusive',2000,
               1000000,200000,1200000)
       returning id`, [ws, projectId, contractId, versionId, unit.rows[0].id]);
    workItemId = wi.rows[0].id;

    const asg = await c.query(
      `insert into public.work_assignments
         (workspace_id, project_id, contract_id, contract_version_id, work_item_id,
          created_by_member_id)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [ws, projectId, contractId, versionId, workItemId, memberId]);
    assignmentId = asg.rows[0].id;

    const root = await c.query(
      `insert into public.progress_entries
         (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
          quantity, recorded_by_member_id)
       values ($1,$2,$3,$4,'root',10,$5) returning id`,
      [ws, projectId, assignmentId, workItemId, memberId]);
    rootId = root.rows[0].id;

    const adj = await c.query(
      `insert into public.progress_entries
         (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
          quantity, root_progress_entry_id, root_is_root, reason_code,
          recorded_by_member_id)
       values ($1,$2,$3,$4,'adjustment',-2,$5,true,'measurement_error',$6)
       returning id`,
      [ws, projectId, assignmentId, workItemId, rootId, memberId]);
    adjustmentId = adj.rows[0].id;
  });

  afterAll(async () => {
    await c.query(`truncate public.organizations cascade`);
  });

  it("accepts an adjustment on a root", () => {
    expect(adjustmentId).toBeTruthy();
  });

  it("rejects an adjustment referencing another adjustment with a FK violation", async () => {
    const memberId = (await c.query(
      `select id from public.memberships where organization_id = $1`, [ws])).rows[0].id;
    let code: string | undefined;
    try {
      await c.query(
        `insert into public.progress_entries
           (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
            quantity, root_progress_entry_id, root_is_root, reason_code,
            recorded_by_member_id)
         values ($1,$2,$3,$4,'adjustment',-1,$5,true,'offset',$6)`,
        [ws, projectId, assignmentId, workItemId, adjustmentId, memberId]);
    } catch (e) {
      code = (e as { code?: string }).code;
    }
    // 23503 (foreign key), not 23514 (check): the FK is what makes a chain
    // unrepresentable, so a check-constraint rejection would mean the
    // structural guarantee is missing and only a route-level rule remains.
    expect(code).toBe("23503");
  });

  it("rejects a root that carries a root reference", async () => {
    const memberId = (await c.query(
      `select id from public.memberships where organization_id = $1`, [ws])).rows[0].id;
    let code: string | undefined;
    try {
      await c.query(
        `insert into public.progress_entries
           (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
            quantity, root_progress_entry_id, root_is_root, recorded_by_member_id)
         values ($1,$2,$3,$4,'root',5,$5,true,$6)`,
        [ws, projectId, assignmentId, workItemId, rootId, memberId]);
    } catch (e) { code = (e as { code?: string }).code; }
    expect(code).toBe("23514");
  });

  it("rejects an adjustment with no reason code", async () => {
    const memberId = (await c.query(
      `select id from public.memberships where organization_id = $1`, [ws])).rows[0].id;
    let code: string | undefined;
    try {
      await c.query(
        `insert into public.progress_entries
           (workspace_id, project_id, work_assignment_id, work_item_id, entry_kind,
            quantity, root_progress_entry_id, root_is_root, recorded_by_member_id)
         values ($1,$2,$3,$4,'adjustment',-1,$5,true,$6)`,
        [ws, projectId, assignmentId, workItemId, rootId, memberId]);
    } catch (e) { code = (e as { code?: string }).code; }
    expect(code).toBe("23514");
  });
});
