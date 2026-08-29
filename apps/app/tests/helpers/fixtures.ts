import { Client } from "pg";
import { deflateRawSync } from "node:zlib";

export const LOCAL_ADMIN_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Integration fixtures must share the explicitly provisioned administrator
 * database with their application connections and teardown. The local URL is
 * retained only for legacy suites that intentionally run against `supabase
 * start`; the selection happens once at module load so `q()` and callers that
 * construct a client with `ADMIN_URL` cannot split one test across databases.
 */
export function adminDatabaseUrl(env: { TEST_DB_ADMIN_URL?: string } = process.env): string {
  return env.TEST_DB_ADMIN_URL?.trim() || LOCAL_ADMIN_URL;
}

export const ADMIN_URL = adminDatabaseUrl();

export async function q<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string, p: unknown[] = [],
): Promise<T[]> {
  const c = new Client({ connectionString: ADMIN_URL });
  await c.connect();
  // try/finally for the reason spelled out on truncateAll: a query that throws
  // must not leave its connection open, and every helper here opens its own.
  try {
    const r = await c.query(sql, p);
    return r.rows as T[];
  } finally {
    await c.end().catch(() => undefined);
  }
}

/**
 * Empties the world between cases.
 *
 * THE CONNECTION IS CLOSED EVEN WHEN THE TRUNCATE FAILS, and that is not
 * housekeeping. `truncate ... cascade` takes ACCESS EXCLUSIVE on organizations
 * and on everything that cascades from it. Written without a finally, a single
 * failed truncate leaked a CONNECTED client still holding — or still queued
 * for — those locks, and nothing ever closed it: the next file's truncate then
 * queued behind a client no test owned any more. That is the shape of the
 * `deadlock detected` this helper raised in m3-refusal, and of the empty
 * `memberships` lookup that crashed baselineFixture two files later, because a
 * beforeEach that throws leaves the suite running against a half-emptied
 * database.
 *
 * `lock_timeout` turns the remaining lock contention from a deadlock into a
 * named, fast failure. A test suite that cannot get the lock in five seconds
 * has a leak somewhere else, and should say so rather than hang.
 */
export async function truncateAll(): Promise<void> {
  const c = new Client({ connectionString: ADMIN_URL });
  await c.connect();
  try {
    await c.query("set lock_timeout = '5s'");
    // ONE STATEMENT, NOT TWO, and that is the other half of the deadlock. As two
    // statements this took ACCESS EXCLUSIVE on organizations and everything
    // cascading from it, COMMITTED, and only then reached for audit_events — so
    // an application transaction holding audit_events and waiting on
    // organizations closed the cycle. A single TRUNCATE acquires every one of
    // these locks together, so there is no window in which this helper holds one
    // and wants another.
    await c.query(`truncate
      public.organizations, public.audit_events,
      public.transaction_outbox, public.idempotency_records cascade`);
  } finally {
    await c.end().catch(() => undefined);
  }
}

export const jsonReq = (url: string, body: unknown, method = "POST"): Request =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });

export interface BaselineFixture {
  workspaceId: string;
  projectId: string;
  ownPartyId: string;
  customerPartyId: string;
  contractId: string;
  memberId: string; // creator's membership id
}

/**
 * Route-driven fixture: workspace → project (creator gets admin+view) →
 * contracts.edit/imports.manage/imports.publish self-grants → own party with
 * legal+own profile → customer party → contract. Caller must have mocked auth
 * as the creating user already.
 */
/**
 * Reads a route's JSON, and refuses to continue past a route that failed.
 *
 * WITHOUT THIS THE FIXTURE LIED ABOUT WHERE IT BROKE. Every step below used to
 * be `(await res.json()).someId as string`, which on a non-2xx quietly yields
 * `undefined` — so a workspace that failed to be created produced
 * `workspaceId === undefined`, the memberships lookup two lines later matched
 * nothing, and the suite died on `TypeError: Cannot read properties of
 * undefined (reading 'id')` pointing at a query that was never the problem.
 * That TypeError is what all 39 cases in m4-act reported. The real refusal —
 * with its status and its catalogued body — is what a reader needs.
 */
async function step<T = Record<string, unknown>>(
  what: string, res: Response,
): Promise<T> {
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`baselineFixture: ${what} returned ${res.status} ${await res.text()}`);
  }
  return await res.json() as T;
}

export async function baselineFixture(userId: string, over: {
  contractBody?: Record<string, unknown>;
} = {}): Promise<BaselineFixture> {
  const { POST: createW } = await import("../../app/v1/workspaces/route");
  const w = await createW(jsonReq("http://x/v1/workspaces", { displayName: "Приклад-Фікстура" }), { params: Promise.resolve({}) });
  const workspaceId = (await step<{ workspaceId: string }>("workspaces.create", w)).workspaceId;

  const { POST: createP } = await import("../../app/v1/workspaces/[workspaceId]/projects/route");
  const p = await createP(jsonReq("http://x", { name: "Приклад-Обʼєкт" }), { params: Promise.resolve({ workspaceId }) });
  const projectId = (await step<{ projectId: string }>("projects.create", p)).projectId;

  const me = await q<{ id: string }>(
    "select id from public.memberships where organization_id=$1 and user_id=$2", [workspaceId, userId]);
  if (me.length === 0) {
    throw new Error(
      `baselineFixture: no membership for user ${userId} in workspace ${workspaceId}`);
  }
  const memberId = me[0]!.id;
  const { POST: grant } = await import("../../app/v1/projects/[projectId]/access-grants/route");
  await grant(jsonReq("http://x", { memberId, capabilities: ["contracts.edit", "imports.manage", "imports.publish"] }),
    { params: Promise.resolve({ projectId }) });

  const { POST: createParty } = await import("../../app/v1/workspaces/[workspaceId]/parties/route");
  const own = await createParty(jsonReq("http://x", { displayName: "Приклад-Власна" }), { params: Promise.resolve({ workspaceId }) });
  const ownPartyId = (await step<{ partyId: string }>("parties.create (own)", own)).partyId;
  const { PUT: putLegal } = await import("../../app/v1/parties/[partyId]/legal-profile/route");
  await putLegal(jsonReq("http://x", { officialName: "ТОВ Приклад-Власна", edrpou: "12345678" }, "PUT"),
    { params: Promise.resolve({ partyId: ownPartyId }) });
  const { POST: createOwn } = await import("../../app/v1/parties/[partyId]/own-profile/route");
  await createOwn(jsonReq("http://x", {}), { params: Promise.resolve({ partyId: ownPartyId }) });

  const cust = await createParty(jsonReq("http://x", { displayName: "Приклад-Замовник" }), { params: Promise.resolve({ workspaceId }) });
  const customerPartyId =
    (await step<{ partyId: string }>("parties.create (customer)", cust)).partyId;

  const { POST: createContract } = await import("../../app/v1/projects/[projectId]/contracts/route");
  const c = await createContract(jsonReq("http://x", {
    ownPartyId, customerPartyId, contractNo: "Д-2026/Ф1",
    currency: "UAH", taxMode: "exclusive", taxRateBps: 2000,
    ...over.contractBody,
  }), { params: Promise.resolve({ projectId }) });
  const contractId = (await step<{ contractId: string }>("contracts.create", c)).contractId;

  return { workspaceId, projectId, ownPartyId, customerPartyId, contractId, memberId };
}

export async function createBatch(contractId: string): Promise<string> {
  const { POST } = await import("../../app/v1/contracts/[contractId]/import-batches/route");
  const res = await POST(jsonReq("http://x", {}), { params: Promise.resolve({ contractId }) });
  return (await res.json()).batchId as string;
}

export async function addFile(batchId: string, name: string, bytes: Uint8Array): Promise<Response> {
  const { POST } = await import("../../app/v1/import-batches/[batchId]/files/route");
  const fd = new FormData();
  fd.append("file", new File([bytes as BlobPart], name));
  return POST(new Request(`http://x/v1/import-batches/${batchId}/files`, {
    method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: fd,
  }), { params: Promise.resolve({ batchId }) });
}

export async function getBatch(batchId: string): Promise<Response> {
  const { GET } = await import("../../app/v1/import-batches/[batchId]/route");
  return GET(new Request("http://x"), { params: Promise.resolve({ batchId }) });
}

/**
 * One published rule version, for a baseline that has to be bound before it can
 * be published.
 *
 * WHY EVERY IMPORT FIXTURE NOW NEEDS THIS. `import_batches.publish` refuses a
 * publication carrying no rule-version set (INV-083) — the same refusal
 * `contract_versions.publish` has always made — so an unbound published
 * baseline is a state the product can no longer produce, and a fixture that
 * still produced one would be building a state no user can reach and testing
 * every later assertion against it.
 *
 * IT DRIVES THE PRODUCT'S OWN PATH and inserts nothing directly: the library
 * row it cites is the one `workspaces.create` seeded, and the version is
 * published by the route. A fixture that inserted either would pass on a
 * deployment where neither works, which is exactly the failure the twelve
 * missing library rows were.
 *
 * NO EXTRA GRANT. `requirement_rule_versions.publish` is governed by
 * `requirement_rules.manage`, a workspace capability that maps to the owner
 * role, and every caller of this helper created the workspace. The BINDING is
 * admitted by `cvrb_insert` under `imports.publish` (0041:785-787), which
 * `baselineFixture` already grants — so the estimator persona reaches the whole
 * path without a separate grant on this route. (On the MANUAL route it does
 * not: it needs `rule_bindings.manage` explicitly. CORRECTED 2026-08-17 — this
 * read «`rule_bindings.manage` is in no responsibility preset — M1 review
 * finding 8 — and that gap is untouched here», and had been wrong since
 * 2026-08-07, when that capability was added to BOTH `requirement_owner` and
 * `pto_engineer` precisely because INV-083 otherwise refused every publication
 * forever. The manual route still needs the grant; no persona lacks it.)
 *
 * The shape is the only one v0.1 can publish: a `hold` that blocks stage
 * closure, timed before concealment. INV-082 refuses every other intervention
 * type and every other blocking scope.
 *
 * CORRECTED BY THE v0.1-M5 SLICE: this comment used to say «naming an internal
 * approver … INV-085 refuse[s] everything else», and that half is no longer
 * true. `occurrence_grants.issue` shipped, so
 * `requirement_rule_versions.publish` accepts `approverIsExternal: true` on a
 * `hold` — pass it through `over` to build the obligation an external технагляд
 * can be granted. The default stays `false`, so every existing caller is
 * unaffected.
 */
export async function publishBindableRuleVersion(
  workspaceId: string, over: Record<string, unknown> = {},
): Promise<{ ruleVersionId: string; requirementRuleId: string; stageKey: string }> {
  const lib = await q<{ id: string }>(
    `select id from public.requirement_library_items
      where workspace_id = $1 and position_code = 'Н.15' and item_no = 1`, [workspaceId]);
  if (lib.length !== 1) {
    // Names the cause rather than letting the publication fail with a 422 about
    // an id the caller never chose: this is what an unseeded library looks like
    // from inside a fixture.
    throw new Error(
      `publishBindableRuleVersion: workspace ${workspaceId} holds ${lib.length} Н.15/1 library rows, not 1`
      + " — workspaces.create is what seeds them");
  }
  const { POST } = await import(
    "../../app/v1/workspaces/[workspaceId]/requirement-rule-versions/route");
  const res = await POST(jsonReq("http://x", {
    workTypeKey: "montazh-elektrotekhnichnykh-ustanovok",
    stageKey: "prykhovani-roboty",
    interventionType: "hold",
    blockingScope: "blocks_stage_closure",
    timing: "before_concealment",
    evidenceKind: "photo",
    performerRole: "foreman",
    approverRole: "technical_supervisor",
    allowedMedia: { mimeTypes: ["image/jpeg"], maxByteSize: 5 * 1024 * 1024 },
    requirementLibraryItemId: lib[0]!.id,
    ...over,
  }), { params: Promise.resolve({ workspaceId }) });
  if (res.status !== 201) {
    throw new Error(
      `publishBindableRuleVersion: publish returned ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return {
    ruleVersionId: body.ruleVersionId as string,
    requirementRuleId: body.requirementRuleId as string,
    stageKey: body.stageKey as string,
  };
}

/** Minimal hand-crafted ZIP (for IMPORT_FILE_UNSUPPORTED fixtures). */
export function craftZip(entries: { name: string; data: Buffer; declaredUncompressed?: number }[]): Uint8Array {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf-8");
    const compressed = deflateRawSync(e.data);
    const uncomp = e.declaredUncompressed ?? e.data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(uncomp, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    chunks.push(local, nameBuf, compressed);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(uncomp, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + compressed.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...chunks, cdBuf, eocd]));
}

export interface PublishedBaselineFixture extends BaselineFixture {
  contractVersionId: string;
  /** Work items of the published version, in position order. */
  workItems: { id: string; workCode: string | null; unitCode: string }[];
  /**
   * The rule version the baseline was published against. Not optional: INV-083
   * means a published baseline always has at least one, on either route.
   */
  ruleVersionId: string;
}

/**
 * Drives a clean CSV through create → stage → validate → publish so v0.1-M2
 * suites start from a real published contract version rather than hand-inserted
 * rows. Every amount reconciles, so no discrepancy resolution is needed.
 */
export async function publishedBaselineFixture(
  userId: string, extraCapabilities: readonly string[] = [],
): Promise<PublishedBaselineFixture> {
  const fx = await baselineFixture(userId);

  if (extraCapabilities.length > 0) {
    const { POST: grant } = await import("../../app/v1/projects/[projectId]/access-grants/route");
    const res = await grant(
      jsonReq("http://x", { memberId: fx.memberId, capabilities: extraCapabilities }),
      { params: Promise.resolve({ projectId: fx.projectId }) });
    // A silently swallowed grant failure shows up later as an unexplained 403
    // in every test that used this fixture.
    if (res.status >= 300) {
      throw new Error(`publishedBaselineFixture: grant returned ${res.status} ${await res.text()}`);
    }
  }

  const csv =
    "Шифр;Назва;Од;К-сть;Ціна;Сума\n" +
    "1.1;Мурування;м2;10;199,99;1 999,90\n" +
    "1.3;Утеплення;м2;5,5;150,00;825,00\n";

  const batchId = await createBatch(fx.contractId);
  await addFile(batchId, "кошторис.csv", new TextEncoder().encode(csv));

  const { POST: validate } = await import("../../app/v1/import-batches/[batchId]/validate/route");
  await validate(jsonReq("http://x", {
    mapping: { sourceKey: "A", description: "B", unit: "C", quantity: "D", unitPrice: "E", amount: "F" },
    config: { headerRow: 1 }, expectedVersion: 2,
  }), { params: Promise.resolve({ batchId }) });

  const view = await (await getBatch(batchId)).json();
  const { ruleVersionId } = await publishBindableRuleVersion(fx.workspaceId);
  const { POST: publish } = await import("../../app/v1/import-batches/[batchId]/publish/route");
  const res = await publish(jsonReq("http://x", {
    expectedVersion: view.version, confirmedManifestHash: view.sourceManifestHash,
    ruleVersionIds: [ruleVersionId],
  }), { params: Promise.resolve({ batchId }) });
  if (res.status !== 201) {
    throw new Error(`publishedBaselineFixture: publish returned ${res.status} ${await res.text()}`);
  }
  const contractVersionId = (await res.json()).contractVersionId as string;

  const workItems = await q<{ id: string; work_code: string | null; unit_code: string }>(
    `select id, work_code, unit_code from public.work_items
      where workspace_id = $1 and contract_version_id = $2 order by position`,
    [fx.workspaceId, contractVersionId]);

  return {
    ...fx, contractVersionId, ruleVersionId,
    workItems: workItems.map((w) => ({ id: w.id, workCode: w.work_code, unitCode: w.unit_code })),
  };
}

export interface MatrixFixtureOptions {
  taxMode: "exclusive" | "inclusive" | "exempt" | "out_of_scope" | "unknown";
  taxRateBps?: number;
  /** CSV data rows, without the header. */
  rows: string[];
  /** Resolve every discrepancy onto the approved source amount before publishing. */
  approveSourceAmounts?: boolean;
  capabilities?: readonly string[];
  contractNo?: string;
}

export interface MatrixFixture extends PublishedBaselineFixture {
  /** Published work items keyed by their source key (column A of the CSV). */
  bySourceKey: Record<string, {
    id: string; unitPriceState: string; valuationBasis: string;
    net: string; tax: string; gross: string; contractQuantity: string;
  }>;
}

/**
 * Publishes one contract whose work items span chosen points of the
 * tax_mode x unit_price_state x valuation_basis matrix, through the real import
 * path rather than by seeding rows — work_items are immutable, and a fixture
 * that bypassed the importer would not prove the importer produces these shapes.
 *
 * v0.1-M1 shipped 340 green tests while inclusive tax double-counted VAT,
 * because every fixture was exclusive, priced, and unit-price-derived. This
 * helper exists so the M2 money suites cannot repeat that.
 */
export async function matrixFixture(
  userId: string, o: MatrixFixtureOptions,
): Promise<MatrixFixture> {
  const fx = await baselineFixture(userId, {
    contractBody: {
      contractNo: o.contractNo ?? `Д-2026/${o.taxMode}-${Math.random().toString(36).slice(2, 8)}`,
      taxMode: o.taxMode,
      ...(o.taxRateBps === undefined ? {} : { taxRateBps: o.taxRateBps }),
    },
  });

  if (o.capabilities?.length) {
    const { POST: grant } = await import("../../app/v1/projects/[projectId]/access-grants/route");
    const res = await grant(
      jsonReq("http://x", { memberId: fx.memberId, capabilities: o.capabilities }),
      { params: Promise.resolve({ projectId: fx.projectId }) });
    if (res.status >= 300) {
      throw new Error(`matrixFixture: grant returned ${res.status} ${await res.text()}`);
    }
  }

  const csv = "Шифр;Назва;Од;К-сть;Ціна;Сума\n" + o.rows.join("\n") + "\n";
  const batchId = await createBatch(fx.contractId);
  await addFile(batchId, "кошторис.csv", new TextEncoder().encode(csv));

  const { POST: validate } = await import("../../app/v1/import-batches/[batchId]/validate/route");
  await validate(jsonReq("http://x", {
    mapping: { sourceKey: "A", description: "B", unit: "C", quantity: "D", unitPrice: "E", amount: "F" },
    config: { headerRow: 1 }, expectedVersion: 2,
  }), { params: Promise.resolve({ batchId }) });

  if (o.approveSourceAmounts) {
    const view = await (await getBatch(batchId)).json();
    const pending = (view.rowResults ?? []).filter(
      (r: { errorCodes: string[] }) => r.errorCodes.includes("AMOUNT_MISMATCH"));
    const { POST: resolve } = await import(
      "../../app/v1/import-batches/[batchId]/resolutions/route");
    for (const row of pending) {
      const res = await resolve(jsonReq("http://x", {
        rowResultId: row.rowResultId, chosenBasis: "approved_source_amount",
        reason: "Приклад-обґрунтування",
      }), { params: Promise.resolve({ batchId }) });
      if (res.status >= 300) {
        throw new Error(`matrixFixture: resolution returned ${res.status} ${await res.text()}`);
      }
    }
    // Resolving a discrepancy does not by itself make the batch publishable:
    // the batch stays in needs-resolution until it is validated again with the
    // resolutions in place.
    const revalidated = await (await getBatch(batchId)).json();
    await validate(jsonReq("http://x", {
      mapping: { sourceKey: "A", description: "B", unit: "C", quantity: "D", unitPrice: "E", amount: "F" },
      config: { headerRow: 1 }, expectedVersion: revalidated.version,
    }), { params: Promise.resolve({ batchId }) });
  }

  const view = await (await getBatch(batchId)).json();
  const { ruleVersionId } = await publishBindableRuleVersion(fx.workspaceId);
  const { POST: publish } = await import("../../app/v1/import-batches/[batchId]/publish/route");
  const res = await publish(jsonReq("http://x", {
    expectedVersion: view.version, confirmedManifestHash: view.sourceManifestHash,
    ruleVersionIds: [ruleVersionId],
  }), { params: Promise.resolve({ batchId }) });
  if (res.status !== 201) {
    throw new Error(`matrixFixture: publish returned ${res.status} ${await res.text()}`);
  }
  const contractVersionId = (await res.json()).contractVersionId as string;

  const items = await q<{
    id: string; source_key: string; work_code: string | null; unit_code: string;
    unit_price_state: string; valuation_basis: string;
    net_amount_minor_units: string; tax_amount_minor_units: string;
    gross_amount_minor_units: string; contract_quantity: string;
  }>(
    `select id, source_key, work_code, unit_code, unit_price_state, valuation_basis,
            net_amount_minor_units::text, tax_amount_minor_units::text,
            gross_amount_minor_units::text, contract_quantity::text
       from public.work_items
      where workspace_id = $1 and contract_version_id = $2 order by position`,
    [fx.workspaceId, contractVersionId]);

  return {
    ...fx,
    contractVersionId,
    ruleVersionId,
    workItems: items.map((w) => ({ id: w.id, workCode: w.work_code, unitCode: w.unit_code })),
    bySourceKey: Object.fromEntries(items.map((w) => [w.source_key, {
      id: w.id,
      unitPriceState: w.unit_price_state,
      valuationBasis: w.valuation_basis,
      net: w.net_amount_minor_units,
      tax: w.tax_amount_minor_units,
      gross: w.gross_amount_minor_units,
      contractQuantity: w.contract_quantity,
    }])),
  };
}
