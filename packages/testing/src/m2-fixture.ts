import type { Client } from "pg";

/**
 * Direct-insert fixture for M2 database-layer tests. Bypasses routes and RLS on
 * purpose: these suites test DDL and policies, so building the world through the
 * API would make a policy regression look like a fixture failure.
 *
 * Synthetic names carry the «Приклад-» prefix so no row can be mistaken for a
 * real Ukrainian company.
 */
export interface M2Fixture {
  workspaceId: string;
  userId: string;
  memberId: string;
  projectId: string;
  contractId: string;
  contractVersionId: string;
  workItemId: string;
  ownPartyId: string;
  customerPartyId: string;
  unitId: string;
}

export interface SeedOptions {
  workspaceId: string;
  userId: string;
  email: string;
  suffix: string;
  /** The single work item's description; defaults to a short labelled line. A test that needs a card too long for Telegram seeds it here, because a published version's lines are immutable (INV-015). */
  workItemDescription?: string;
  taxMode?: string;
  taxRateBps?: number | null;
  unitPriceState?: "known" | "zero" | "missing";
  valuationBasis?: "unit_price_derived" | "approved_source_amount";
  poolNet?: bigint;
  poolTax?: bigint;
  contractQuantity?: string;
}

export async function seedM2World(c: Client, o: SeedOptions): Promise<M2Fixture> {
  const taxMode = o.taxMode ?? "exclusive";
  const taxRateBps = o.taxRateBps === undefined ? 2000 : o.taxRateBps;
  const unitPriceState = o.unitPriceState ?? "known";
  const valuationBasis = o.valuationBasis ?? "unit_price_derived";
  const net = o.poolNet ?? 1_000_000n;
  const tax = o.poolTax ?? 200_000n;
  const gross = net + tax;
  const contractQuantity = o.contractQuantity ?? "100";

  // auth.users outlives a scoped workspace cleanup, and its email uniqueness is
  // partial. Deleting a colliding row is not an option — other suites' memberships
  // may still reference it — so the address is derived from the id and cannot
  // collide in the first place. SeedOptions.email stays for readability at the
  // call site; it is not what lands in the row.
  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email,
                             encrypted_password, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated',
             'authenticated', $2, '', now(), now())
     on conflict (id) do nothing`, [o.userId, `${o.userId}@fixture.test`]);
  await c.query(
    `insert into public.organizations (id, legal_name, display_name)
     values ($1, $2, $2)`, [o.workspaceId, `Приклад-Простір-${o.suffix}`]);

  const mem = await c.query(
    `insert into public.memberships (organization_id, user_id, role, status)
     values ($1,$2,'owner','active') returning id`, [o.workspaceId, o.userId]);
  const memberId: string = mem.rows[0].id;

  const proj = await c.query(
    `insert into public.projects (workspace_id, name, created_by)
     values ($1,$2,$3) returning id`,
    [o.workspaceId, `Приклад-Проєкт-${o.suffix}`, o.userId]);
  const projectId: string = proj.rows[0].id;

  const own = await c.query(
    `insert into public.parties (workspace_id, display_name, created_by)
     values ($1,$2,$3) returning id`,
    [o.workspaceId, `Приклад-Виконавець-${o.suffix}`, o.userId]);
  const customer = await c.query(
    `insert into public.parties (workspace_id, display_name, created_by)
     values ($1,$2,$3) returning id`,
    [o.workspaceId, `Приклад-Замовник-${o.suffix}`, o.userId]);

  // INV-002 is a foreign key: contracts.own_party_id resolves to an own legal
  // entity profile, not merely to a party.
  await c.query(
    `insert into public.party_legal_profiles
       (workspace_id, party_id, official_name, updated_by)
     values ($1,$2,$3,$4)`,
    [o.workspaceId, own.rows[0].id, `Приклад-Виконавець-${o.suffix} ТОВ`, o.userId]);
  await c.query(
    `insert into public.own_legal_entity_profiles (workspace_id, party_id, created_by)
     values ($1,$2,$3)`, [o.workspaceId, own.rows[0].id, o.userId]);

  const contract = await c.query(
    `insert into public.contracts
       (workspace_id, project_id, own_party_id, customer_party_id, contract_no,
        currency, tax_mode, tax_rate_bps, rounding_policy, created_by)
     values ($1,$2,$3,$4,$5,'UAH',$6,$7,
             '{"midpoint":"half_up","scope":"work_item_version_pool"}'::jsonb,$8)
     returning id`,
    [o.workspaceId, projectId, own.rows[0].id, customer.rows[0].id,
     `ПР-${o.suffix}`, taxMode, taxRateBps, o.userId]);
  const contractId: string = contract.rows[0].id;

  const batch = await c.query(
    `insert into public.import_batches (workspace_id, project_id, contract_id, created_by)
     values ($1,$2,$3,$4) returning id`, [o.workspaceId, projectId, contractId, o.userId]);
  const version = await c.query(
    `insert into public.contract_versions
       (workspace_id, project_id, contract_id, version_no,
        own_party_snapshot, customer_party_snapshot, currency, tax_mode, tax_rate_bps,
        terms, approval_policy, rounding_policy,
        source_tolerance_minor_units, source_tolerance_bps,
        import_batch_id, source_manifest_hash, published_by)
     values ($1,$2,$3,1,'{}'::jsonb,'{}'::jsonb,'UAH',$4,$5,
             '{}'::jsonb,'{}'::jsonb,'{"midpoint":"half_up"}'::jsonb,100,10,$6,
             repeat('a',64),$7)
     returning id`,
    [o.workspaceId, projectId, contractId, taxMode, taxRateBps,
     batch.rows[0].id, o.userId]);
  const contractVersionId: string = version.rows[0].id;

  const unit = await c.query(
    `insert into public.unit_definitions (workspace_id, code, unit_precision, created_by)
     values ($1,'м2',3,$2) returning id`, [o.workspaceId, o.userId]);
  const unitId: string = unit.rows[0].id;

  const priced = unitPriceState === "known";
  const wi = await c.query(
    `insert into public.work_items
       (workspace_id, project_id, contract_id, contract_version_id, position,
        description, unit_definition_id, unit_code, unit_precision,
        contract_quantity, unit_price_state, unit_price_decimal, price_basis,
        valuation_basis, currency, tax_mode, tax_rate_bps,
        source_amount_minor_units, approved_amount_minor_units,
        net_amount_minor_units, tax_amount_minor_units, gross_amount_minor_units)
     values ($1,$2,$3,$4,1,$5,$6,'м2',3,$7,$8,$9,$10,$11,'UAH',$12,$13,
             $14,$15,$16,$17,$18)
     returning id`,
    [o.workspaceId, projectId, contractId, contractVersionId,
     o.workItemDescription ?? `Приклад-позиція-${o.suffix}`, unitId, contractQuantity,
     unitPriceState, priced ? "100" : null, priced ? "net" : null,
     valuationBasis, taxMode, taxRateBps,
     valuationBasis === "approved_source_amount" ? gross.toString() : null,
     valuationBasis === "approved_source_amount" ? gross.toString() : null,
     net.toString(), tax.toString(), gross.toString()]);

  return {
    workspaceId: o.workspaceId, userId: o.userId, memberId, projectId,
    contractId, contractVersionId, workItemId: wi.rows[0].id,
    ownPartyId: own.rows[0].id, customerPartyId: customer.rows[0].id, unitId,
  };
}

/** Grants the member every project capability M2-A commands require. */
export async function grantM2Capabilities(
  c: Client, f: M2Fixture, capabilities: readonly string[] = [
    "project.view", "project.admin", "assignments.manage",
    "progress.record", "progress.adjust", "evidence.record",
  ],
): Promise<void> {
  for (const capability of capabilities) {
    await c.query(
      `insert into public.project_access_grants
         (workspace_id, project_id, member_id, capability, granted_by)
       values ($1,$2,$3,$4,$5)`,
      [f.workspaceId, f.projectId, f.memberId, capability, f.userId]);
  }
}

export async function seedAssignment(c: Client, f: M2Fixture): Promise<string> {
  const r = await c.query(
    `insert into public.work_assignments
       (workspace_id, project_id, contract_id, contract_version_id, work_item_id,
        created_by_member_id)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [f.workspaceId, f.projectId, f.contractId, f.contractVersionId,
     f.workItemId, f.memberId]);
  return r.rows[0].id;
}

/**
 * Removes only the workspaces a suite owns, in dependency order.
 *
 * A blanket `truncate public.organizations cascade` also destroys state other
 * suites depend on — it left packages/testing/src/foundation.test.ts failing
 * five assertions until this was scoped. A test that corrupts the shared
 * database for its neighbours is worse than a missing test.
 */
export async function dropM2Workspaces(c: Client, workspaceIds: readonly string[]): Promise<void> {
  const ids = [...workspaceIds];

  // The M2 module tables carry append-only triggers, so DELETE is refused even
  // for the table owner — correctly, that is the whole point of 0016. TRUNCATE
  // bypasses row triggers, which is why the M1 fixtures reach for it too. These
  // eight tables are written only by the M2 suites, so clearing them wholesale
  // is safe; the M1 tables below are shared and get scoped deletes instead.
  await c.query(`truncate
    public.capture_events, public.evidence_objects, public.upload_intents,
    public.valuation_allocations, public.progress_allocation_heads,
    public.progress_entries, public.work_assignments,
    public.requirement_template_versions cascade`);

  const tables = [
    "work_items", "contract_versions", "import_row_results", "import_files",
    "import_batches", "source_amount_resolutions", "contracts",
    // DEV-044 (0097): an end pins its assignment, so it goes first.
    "project_responsibility_assignment_ends",
    "project_responsibility_assignments", "project_access_grants",
    "project_parties",
    // audit_events must precede projects: 0040 gave audit_events a tenant-safe
    // composite FK to projects with NO ACTION, so deleting a project still
    // cited by audit raises 23503. The `disable trigger user` at the end of
    // this function does not help — it suppresses user triggers, not
    // referential integrity.
    "audit_events", "projects",
    "locations", "unit_definitions",
    "own_legal_entity_profiles", "party_legal_profiles", "party_contacts",
    "parties", "invitations", "memberships",
    "transaction_outbox",
  ];
  // Resolve the tenant column from the catalog rather than guessing: some M1
  // tables name it organization_id, and a guess-then-catch loop turns a missing
  // column into an unrelated failure three suites downstream.
  const cols = await c.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
      where table_schema = 'public' and table_name = any($1::text[])
        and column_name in ('workspace_id','organization_id')`, [tables]);
  const tenantColumn = new Map(cols.rows.map((r) => [r.table_name, r.column_name]));

  for (const table of tables) {
    const col = tenantColumn.get(table);
    if (!col) continue;
    await c.query(
      `alter table public.${table} disable trigger user`).catch(() => undefined);
    await c.query(`delete from public.${table} where ${col} = any($1::uuid[])`, [ids])
      .finally(async () => {
        await c.query(`alter table public.${table} enable trigger user`).catch(() => undefined);
      });
  }
  await c.query(`delete from public.organizations where id = any($1::uuid[])`, [ids]);
}
