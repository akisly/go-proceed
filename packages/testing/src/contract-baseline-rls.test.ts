import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import type { Client } from "pg";
import { adminClient, asActor, dropWorkspaces } from "./pg";
import { seedRulesWorld } from "./m1-rules-fixture";

/**
 * READINESS GATE 11, MODULE contract_baseline (DEV-016, BL-091).
 *
 * The DEV-014 shape (workspace-access-rls.test.ts): one test per relation, cited
 * as both its positive and its negative. The owner of A reads A's rows; the
 * owner of B, holding the same grants on its own project and declaring
 * workspace A, reads only B's. Both workspaces are seeded identically by the
 * admin client from the rules world (which already holds the contract, both
 * versions, their lines, the import batch and the unit), plus one location,
 * import file, row result and source-amount resolution each. No resetDb; the
 * workspaces are dropped before and after.
 */
const WS_A = "de161a00-0000-4000-8000-000000000001";
const WS_B = "de161b00-0000-4000-8000-000000000001";
const USER_A = "de161a00-0000-4000-8000-0000000000a1";
const USER_B = "de161b00-0000-4000-8000-0000000000b1";
const BOTH = [WS_A, WS_B];

let admin: Client;

async function seedSide(ws: string, user: string, suffix: string): Promise<void> {
  const rules = await seedRulesWorld(admin, { workspaceId: ws, userId: user, suffix });
  const batch = await admin.query<{ id: string }>(
    "select id from public.import_batches where workspace_id = $1", [ws]);
  const batchId = batch.rows[0]!.id;
  const file = await admin.query<{ id: string }>(
    `insert into public.import_files
       (workspace_id, import_batch_id, filename, byte_size, content_hash, detected_format,
        storage_key, source_bytes, uploaded_by)
     values ($1, $2, 'приклад.csv', 3, $3, 'csv', $4, '\\x616263', $5) returning id`,
    [ws, batchId, createHash("sha256").update(`dev016:${ws}:file`).digest("hex"), `dev016://${randomUUID()}`, user]);
  const row = await admin.query<{ id: string }>(
    `insert into public.import_row_results
       (workspace_id, import_batch_id, import_file_id, attempt, source_row, source_cells,
        severity, parser_version, mapping_version)
     values ($1, $2, $3, 1, 1, '{}'::jsonb, 'ok', 'dev016', 1) returning id`,
    [ws, batchId, file.rows[0]!.id]);
  await admin.query(
    `insert into public.source_amount_resolutions
       (workspace_id, import_batch_id, row_result_id, chosen_basis, reason,
        source_amount_minor_units, resolved_by)
     values ($1, $2, $3, 'approved_source_amount', 'Приклад-підстава', 100, $4)`,
    [ws, batchId, row.rows[0]!.id, user]);
  await admin.query(
    "insert into public.locations (workspace_id, project_id, name, created_by) values ($1, $2, 'Приклад-ділянка', $3)",
    [ws, rules.projectId, user]);
}

/** The distinct workspaces of the rows `actor` can read, declaring workspace A. */
async function seen(actor: string, sql: string): Promise<string[]> {
  const r = await asActor<{ ws: string }>(actor, WS_A, (c) => c.query(sql, [BOTH]));
  return r.rows.map((row) => row.ws).sort();
}

beforeAll(async () => {
  admin = await adminClient();
  await dropWorkspaces(admin, BOTH);
  await seedSide(WS_A, USER_A, "DEV016-CB-A");
  await seedSide(WS_B, USER_B, "DEV016-CB-B");
}, 180_000);

afterAll(async () => {
  await dropWorkspaces(admin, BOTH);
  await admin.end();
});

describe("contract_baseline isolation — the owner of A reaches rows of A and the owner of B declaring A reaches only rows of B", () => {
  it("contract_versions: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.contract_versions where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("work_items: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.work_items where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("import_batches: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.import_batches where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("import_files: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    // if_select reaches the row through its batch's project capability.
    const sql = "select distinct workspace_id as ws from public.import_files where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("import_row_results: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.import_row_results where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("source_amount_resolutions: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.source_amount_resolutions where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("locations: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    const sql = "select distinct workspace_id as ws from public.locations where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });

  it("unit_definitions: the owner of A reads the rows of A and the owner of B reads only its own", async () => {
    // units_select is membership only, not a project capability.
    const sql = "select distinct workspace_id as ws from public.unit_definitions where workspace_id = any($1::uuid[])";
    expect(await seen(USER_A, sql)).toEqual([WS_A]);
    expect(await seen(USER_B, sql)).toEqual([WS_B]);
  });
});
