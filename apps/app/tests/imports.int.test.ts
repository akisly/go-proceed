import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import {
  q, truncateAll, jsonReq, baselineFixture, createBatch, addFile, getBatch, craftZip,
  type BaselineFixture,
} from "./helpers/fixtures";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
let current = A;
vi.mock("../src/lib/auth", () => ({ requireUser: async () => ({ userId: current }) }));

const enc = (s: string) => new TextEncoder().encode(s);
const CSV_OK = "Назва;Од;К-сть;Ціна\nМурування;м2;10;199,99\nШтукатурення;м2;5,5;150,00\n";

let fx: BaselineFixture;
beforeEach(async () => {
  await truncateAll();
  current = A;
  fx = await baselineFixture(A);
});

async function grantTo(userId: string, caps: string[]): Promise<string> {
  const m = await q<{ id: string }>(
    "insert into public.memberships (organization_id, user_id, role, status) values ($1,$2,'member','active') returning id",
    [fx.workspaceId, userId]);
  const { POST } = await import("../app/v1/projects/[projectId]/access-grants/route");
  await POST(jsonReq("http://x", { memberId: m[0]!.id, capabilities: caps }),
    { params: Promise.resolve({ projectId: fx.projectId }) });
  return m[0]!.id;
}

describe("import_batches.create", () => {
  it("creates a batch in status created", async () => {
    const batchId = await createBatch(fx.contractId);
    expect(batchId).toBeTruthy();
    const rows = await q<{ status: string }>("select status from public.import_batches where id=$1", [batchId]);
    expect(rows[0]?.status).toBe("created");
  });

  it("project.view alone cannot create a batch (403 SCOPE_PROJECT_DENIED)", async () => {
    await grantTo(C, ["project.view"]);
    current = C;
    const { POST } = await import("../app/v1/contracts/[contractId]/import-batches/route");
    const res = await POST(jsonReq("http://x", {}), { params: Promise.resolve({ contractId: fx.contractId }) });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SCOPE_PROJECT_DENIED");
  });

  it("foreign contract id → 404", async () => {
    const { POST } = await import("../app/v1/contracts/[contractId]/import-batches/route");
    const res = await POST(jsonReq("http://x", {}), { params: Promise.resolve({ contractId: crypto.randomUUID() }) });
    expect(res.status).toBe(404);
  });
});

describe("import_files.add", () => {
  it("stages a CSV with sha256 content hash and byte round-trip", async () => {
    const batchId = await createBatch(fx.contractId);
    const bytes = enc(CSV_OK);
    const res = await addFile(batchId, "кошторис.csv", bytes);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.detectedFormat).toBe("csv");
    expect(body.contentHash).toBe(createHash("sha256").update(bytes).digest("hex"));
    const db = await q<{ source_bytes: Buffer; storage_key: string }>(
      "select source_bytes, storage_key from public.import_files where id=$1", [body.fileId]);
    expect(new Uint8Array(db[0]!.source_bytes)).toEqual(bytes);
    expect(db[0]!.storage_key).toBe(`pg://import-sources/${fx.workspaceId}/${batchId}/${body.fileId}`);
  });

  it("rejects executable bytes and ZIP bombs with 422 IMPORT_FILE_UNSUPPORTED", async () => {
    const batchId = await createBatch(fx.contractId);
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0xff, 0xfe, 0x00, 0x01]);
    const r1 = await addFile(batchId, "тест.exe", exe);
    expect(r1.status).toBe(422);
    expect((await r1.json()).code).toBe("IMPORT_FILE_UNSUPPORTED");
    const bomb = craftZip([
      { name: "xl/worksheets/sheet1.xml", data: Buffer.alloc(4096, 0x20), declaredUncompressed: 3 * 1024 * 1024 * 1024 },
    ]);
    const r2 = await addFile(batchId, "бомба.xlsx", bomb);
    expect(r2.status).toBe(422);
    const b2 = await r2.json();
    expect(b2.code).toBe("IMPORT_FILE_UNSUPPORTED");
    expect(JSON.stringify(b2.fieldErrors)).toMatch(/XLSX_BOMB/);
  });

  it("same content twice in one batch → 409 IMPORT_JOB_CONFLICT", async () => {
    const batchId = await createBatch(fx.contractId);
    expect((await addFile(batchId, "a.csv", enc(CSV_OK))).status).toBe(201);
    const dup = await addFile(batchId, "b.csv", enc(CSV_OK));
    expect(dup.status).toBe(409);
    expect((await dup.json()).code).toBe("IMPORT_JOB_CONFLICT");
  });
});

describe("import_batches.get", () => {
  it("returns batch + files; foreign actor gets 404", async () => {
    const batchId = await createBatch(fx.contractId);
    await addFile(batchId, "кошторис.csv", enc(CSV_OK));
    const res = await getBatch(batchId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("created");
    expect(body.files).toHaveLength(1);
    current = C; // no membership in this workspace at all
    const denied = await getBatch(batchId);
    expect(denied.status).toBe(404);
  });
});
