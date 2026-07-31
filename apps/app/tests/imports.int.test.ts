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

const MAPPING = { description: "A", unit: "B", quantity: "C", unitPrice: "D" };

async function validate(batchId: string, body: Record<string, unknown>) {
  const { POST } = await import("../app/v1/import-batches/[batchId]/validate/route");
  return POST(jsonReq(`http://x/v1/import-batches/${batchId}/validate`, body),
    { params: Promise.resolve({ batchId }) });
}

describe("import_batches.validate", () => {
  it("happy CSV → preview_ready with exact totals and auto-registered units", async () => {
    const batchId = await createBatch(fx.contractId);
    await addFile(batchId, "кошторис.csv", enc(CSV_OK));
    const res = await validate(batchId, { mapping: MAPPING, config: { headerRow: 1 }, expectedVersion: 2 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("preview_ready");
    expect(body.rowCount).toBe(2);
    expect(body.blockingCount).toBe(0);
    // 10×199,99 + 5,5×150,00 = 199990 + 82500 = 282490 minor units net
    expect(body.totals.netMinor).toBe("282490");
    expect(body.sourceManifestHash).toMatch(/^[0-9a-f]{64}$/);
    const units = await q<{ normalized_code: string }>(
      "select normalized_code from public.unit_definitions where workspace_id=$1", [fx.workspaceId]);
    expect(units.map((u) => u.normalized_code)).toEqual(["м2"]);
  });

  it("INV-054: amount mismatch beyond tolerance keeps the batch at validated", async () => {
    const batchId = await createBatch(fx.contractId);
    const csv = "Назва;Од;К-сть;Ціна;Сума\nМурування;м2;10;199,99;2 100,00\n";
    await addFile(batchId, "кошторис.csv", enc(csv));
    const res = await validate(batchId, {
      mapping: { ...MAPPING, amount: "E" }, config: { headerRow: 1 }, expectedVersion: 2,
    });
    const body = await res.json();
    expect(body.status).toBe("validated");
    expect(body.needsResolutionCount).toBe(1);
    expect(body.rowResults[0].severity).toBe("blocking");
    expect(body.rowResults[0].errorCodes).toContain("AMOUNT_MISMATCH");
  });

  it("unknown unit without units.manage blocks with UNIT_UNKNOWN", async () => {
    const batchId = await createBatch(fx.contractId);
    await addFile(batchId, "кошторис.csv", enc(CSV_OK));
    await grantTo(C, ["imports.manage"]); // C is role=member → no units.manage
    current = C;
    const res = await validate(batchId, { mapping: MAPPING, config: { headerRow: 1 }, expectedVersion: 2 });
    const body = await res.json();
    expect(body.status).toBe("validated");
    expect(body.rowResults.every((r: { errorCodes: string[] }) => r.errorCodes.includes("UNIT_UNKNOWN"))).toBe(true);
  });

  it("XLSX with a formula cell surfaces inert FORMULA_CELL warning", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Кошторис");
    ws.addRow(["Назва", "Од", "К-сть", "Ціна"]);
    ws.addRow(["Мурування", "м2", "10", "199,99"]);
    ws.addRow(["Розрахунок", "м2", "5", { formula: "C2*2", result: 20 }]);
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
    const batchId = await createBatch(fx.contractId);
    await addFile(batchId, "кошторис.xlsx", bytes);
    const res = await validate(batchId, { mapping: MAPPING, config: { headerRow: 1 }, expectedVersion: 2 });
    const body = await res.json();
    expect(body.status).toBe("preview_ready");
    const formulaRow = body.rowResults.find((r: { errorCodes: string[] }) => r.errorCodes.includes("FORMULA_CELL"));
    expect(formulaRow).toBeTruthy();
    expect(formulaRow.severity).toBe("warning");
  });

  it("corrupted xlsx inner content → batch failed with named codes (HTTP 200)", async () => {
    const bad = craftZip([{ name: "xl/workbook.xml", data: Buffer.from("<broken") }]);
    const batchId = await createBatch(fx.contractId);
    // craftZip output passes the container guard (no bomb/macros) but exceljs
    // cannot load it → XLSX_MALFORMED at validate time.
    const added = await addFile(batchId, "битий.xlsx", bad);
    expect(added.status).toBe(201);
    const res = await validate(batchId, { mapping: MAPPING, config: { headerRow: 1 }, expectedVersion: 2 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("failed");
    expect(body.failureCodes).toContain("XLSX_MALFORMED");
    expect(body.rowResults).toHaveLength(0);
  });

  it("stale expectedVersion → 409 VERSION_CONFLICT; files frozen after validate", async () => {
    const batchId = await createBatch(fx.contractId);
    await addFile(batchId, "кошторис.csv", enc(CSV_OK));
    const stale = await validate(batchId, { mapping: MAPPING, config: { headerRow: 1 }, expectedVersion: 1 });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe("VERSION_CONFLICT");
    await validate(batchId, { mapping: MAPPING, config: { headerRow: 1 }, expectedVersion: 2 });
    const late = await addFile(batchId, "пізній.csv", enc("a;b\n1;2\n"));
    expect(late.status).toBe(409);
    expect((await late.json()).code).toBe("IMPORT_JOB_CONFLICT");
  });
});
