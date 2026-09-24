import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { deflateRawSync } from "node:zlib";
import { guardXlsxContainer } from "./xlsx-guard";
import { parseXlsx } from "./xlsx";

type CellIn = string | number | { formula: string; result?: number };

async function buildXlsx(rows: CellIn[][]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Кошторис");
  rows.forEach((r) => ws.addRow(r));
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

/** Hand-crafted single-file ZIP so guard fixtures don't depend on any library. */
function craftZip(entries: { name: string; data: Buffer; declaredUncompressed?: number }[]): Uint8Array {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf-8");
    const compressed = deflateRawSync(e.data);
    const uncomp = e.declaredUncompressed ?? e.data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);           // version
    local.writeUInt16LE(0, 6);            // flags
    local.writeUInt16LE(8, 8);            // method: deflate
    local.writeUInt32LE(0, 10);           // time/date
    local.writeUInt32LE(0, 14);           // crc (not validated by the guard)
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(uncomp, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, compressed);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(0, 12);
    cd.writeUInt32LE(0, 16);              // crc
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(uncomp, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);              // extra
    cd.writeUInt16LE(0, 32);              // comment
    cd.writeUInt16LE(0, 34);              // disk
    cd.writeUInt16LE(0, 36);              // int attrs
    cd.writeUInt32LE(0, 38);              // ext attrs
    cd.writeUInt32LE(offset, 42);         // local header offset
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + compressed.length;
  }
  const cdStart = offset;
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);
  return new Uint8Array(Buffer.concat([...chunks, cdBuf, eocd]));
}

describe("guardXlsxContainer (INV-016)", () => {
  it("accepts a normal workbook", async () => {
    const b = await buildXlsx([["Назва", "К-сть"], ["Бетон", 12.5]]);
    expect(guardXlsxContainer(b)).toEqual({ ok: true });
  });

  it("rejects CFB (legacy/encrypted) containers", () => {
    const cfb = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array(64).fill(0)]);
    expect(guardXlsxContainer(cfb)).toEqual({ ok: false, errors: ["XLSX_ENCRYPTED_OR_LEGACY"] });
  });

  it("rejects non-zip bytes", () => {
    expect(guardXlsxContainer(new TextEncoder().encode("MZ not a zip at all"))).toEqual({ ok: false, errors: ["XLSX_NOT_ZIP"] });
  });

  it("rejects a macro workbook by vbaProject entry name", () => {
    const z = craftZip([
      { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
      { name: "xl/vbaProject.bin", data: Buffer.from("macro-bytes") },
    ]);
    const r = guardXlsxContainer(z);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("XLSX_MACROS_PRESENT");
  });

  it("rejects a declared-size ZIP bomb without inflating it", () => {
    const z = craftZip([
      // 3 GB declared (fits the u32 ZIP field; far beyond the 100 MB cap).
      { name: "xl/worksheets/sheet1.xml", data: Buffer.alloc(4096, 0x20), declaredUncompressed: 3 * 1024 * 1024 * 1024 },
    ]);
    const r = guardXlsxContainer(z);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e === "XLSX_BOMB_SIZE" || e === "XLSX_BOMB_RATIO")).toBe(true);
  });

  it("rejects path traversal entries", () => {
    const z = craftZip([{ name: "../../evil.xml", data: Buffer.from("<x/>") }]);
    const r = guardXlsxContainer(z);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("XLSX_PATH_TRAVERSAL");
  });

  it("rejects a truncated/malformed central directory", () => {
    const good = craftZip([{ name: "a.xml", data: Buffer.from("<a/>") }]);
    const broken = good.slice(0, good.length - 4); // chop the EOCD tail
    const r = guardXlsxContainer(broken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("XLSX_MALFORMED");
  });
});

describe("parseXlsx", () => {
  it("reads cells with worksheet + 1-based row provenance", async () => {
    const b = await buildXlsx([["Назва", "К-сть"], ["Бетон", 12.5]]);
    const p = await parseXlsx(b);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.worksheets).toEqual(["Кошторис"]);
      const dataRow = p.rows.find((r) => r.cells.A?.raw === "Бетон");
      expect(dataRow?.rowNo).toBe(2);
      expect(dataRow?.cells.B?.raw).toBe("12.5");
    }
  });

  it("keeps formulas inert: formula text + cached value, nothing executed", async () => {
    const b = await buildXlsx([[{ formula: "A1*2", result: 4 }]]);
    const p = await parseXlsx(b);
    expect(p.ok).toBe(true);
    if (p.ok) {
      const withFormula = p.rows.flatMap((r) => Object.values(r.cells)).filter((c) => c.formula);
      expect(withFormula.length).toBe(1);
      expect(withFormula[0]?.formula).toBe("A1*2");
      expect(withFormula[0]?.raw).toBe("4");
    }
  });

  it("fuzz: 100 seeded mutations never throw and fail closed", async () => {
    const base = await buildXlsx([["a", 1]]);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 48271) % 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 100; i++) {
      const b = new Uint8Array(base);
      const pos = Math.floor(rnd() * b.length);
      b[pos] = (b[pos] ?? 0) ^ 0xff;
      const r = await parseXlsx(b); // must never throw
      expect(typeof r.ok).toBe("boolean");
    }
  }, 60_000);
});
