import { Client } from "pg";
import { deflateRawSync } from "node:zlib";

export const ADMIN_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export async function q<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string, p: unknown[] = [],
): Promise<T[]> {
  const c = new Client({ connectionString: ADMIN_URL });
  await c.connect();
  const r = await c.query(sql, p);
  await c.end();
  return r.rows as T[];
}

export async function truncateAll(): Promise<void> {
  const c = new Client({ connectionString: ADMIN_URL });
  await c.connect();
  await c.query("truncate public.organizations cascade");
  await c.query("truncate public.audit_events, public.transaction_outbox, public.idempotency_records cascade");
  await c.end();
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
export async function baselineFixture(userId: string, over: {
  contractBody?: Record<string, unknown>;
} = {}): Promise<BaselineFixture> {
  const { POST: createW } = await import("../../app/v1/workspaces/route");
  const w = await createW(jsonReq("http://x/v1/workspaces", { displayName: "Приклад-Фікстура" }), { params: Promise.resolve({}) });
  const workspaceId = (await w.json()).workspaceId as string;

  const { POST: createP } = await import("../../app/v1/workspaces/[workspaceId]/projects/route");
  const p = await createP(jsonReq("http://x", { name: "Приклад-Обʼєкт" }), { params: Promise.resolve({ workspaceId }) });
  const projectId = (await p.json()).projectId as string;

  const me = await q<{ id: string }>(
    "select id from public.memberships where organization_id=$1 and user_id=$2", [workspaceId, userId]);
  const memberId = me[0]!.id;
  const { POST: grant } = await import("../../app/v1/projects/[projectId]/access-grants/route");
  await grant(jsonReq("http://x", { memberId, capabilities: ["contracts.edit", "imports.manage", "imports.publish"] }),
    { params: Promise.resolve({ projectId }) });

  const { POST: createParty } = await import("../../app/v1/workspaces/[workspaceId]/parties/route");
  const own = await createParty(jsonReq("http://x", { displayName: "Приклад-Власна" }), { params: Promise.resolve({ workspaceId }) });
  const ownPartyId = (await own.json()).partyId as string;
  const { PUT: putLegal } = await import("../../app/v1/parties/[partyId]/legal-profile/route");
  await putLegal(jsonReq("http://x", { officialName: "ТОВ Приклад-Власна", edrpou: "12345678" }, "PUT"),
    { params: Promise.resolve({ partyId: ownPartyId }) });
  const { POST: createOwn } = await import("../../app/v1/parties/[partyId]/own-profile/route");
  await createOwn(jsonReq("http://x", {}), { params: Promise.resolve({ partyId: ownPartyId }) });

  const cust = await createParty(jsonReq("http://x", { displayName: "Приклад-Замовник" }), { params: Promise.resolve({ workspaceId }) });
  const customerPartyId = (await cust.json()).partyId as string;

  const { POST: createContract } = await import("../../app/v1/projects/[projectId]/contracts/route");
  const c = await createContract(jsonReq("http://x", {
    ownPartyId, customerPartyId, contractNo: "Д-2026/Ф1",
    currency: "UAH", taxMode: "exclusive", taxRateBps: 2000,
    ...over.contractBody,
  }), { params: Promise.resolve({ projectId }) });
  const contractId = (await c.json()).contractId as string;

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
  const { POST: publish } = await import("../../app/v1/import-batches/[batchId]/publish/route");
  const res = await publish(jsonReq("http://x", {
    expectedVersion: view.version, confirmedManifestHash: view.sourceManifestHash,
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
    ...fx, contractVersionId,
    workItems: workItems.map((w) => ({ id: w.id, workCode: w.work_code, unitCode: w.unit_code })),
  };
}
