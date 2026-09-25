import { describe, it, expect, vi } from "vitest";
import ExcelJS from "exceljs";
import { createDeflateRaw, deflateRawSync } from "node:zlib";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
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

interface ZipEntryIn {
  name: string;
  data: Buffer;
  /** 8 deflate (default), 0 stored, anything else unsupported. */
  method?: number;
  declaredUncompressed?: number;
  /** The name written in the local header, when it differs from the central one. */
  localName?: string;
  /** Raw central-directory name bytes, overriding `name`. */
  rawName?: Buffer;
  centralExtra?: Buffer;
  flags?: number;
  /** A pre-built raw deflate stream, used instead of compressing `data`. */
  compressed?: Buffer;
  /** Zero sizes in the local header and a 16-byte data descriptor after the data (flag bit 3). */
  descriptor?: boolean;
}

interface ZipShape {
  /** Records written after the counted ones, inside the directory JSZip reads. */
  uncounted?: ZipEntryIn[];
  /** The EOCD's record count, when it differs from the entries written. */
  count?: number;
  /** Added to the EOCD's central-directory size. */
  cdSizeDelta?: number;
  comment?: Buffer;
  /** Bytes after the EOCD and its comment. */
  trailing?: Buffer;
  /** Point the second entry's local header at the first's (overlapping data). */
  overlap?: boolean;
  /** The EOCD's disk number. */
  disk?: number;
}

/** A hand-built ZIP, every field under the test's control (DEV-087). */
function buildZip(entries: ZipEntryIn[], shape: ZipShape = {}): Uint8Array {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  const offsets: number[] = [];
  let offset = 0;
  const all = [...entries, ...(shape.uncounted ?? [])];
  for (const [i, e] of all.entries()) {
    const method = e.method ?? 8;
    const centralName = e.rawName ?? Buffer.from(e.name, "utf-8");
    const localName = e.localName === undefined ? centralName : Buffer.from(e.localName, "utf-8");
    const compressed = e.compressed ?? (method === 8 ? deflateRawSync(e.data) : e.data);
    const uncomp = e.declaredUncompressed ?? e.data.length;
    const flags = (e.flags ?? 0) | (e.descriptor ? 0x0008 : 0);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(e.descriptor ? 0 : compressed.length, 18);
    local.writeUInt32LE(e.descriptor ? 0 : uncomp, 22);
    local.writeUInt16LE(localName.length, 26);
    local.writeUInt16LE(0, 28);
    const localOffset = shape.overlap && i === 1 ? offsets[0]! : offset;
    offsets.push(offset);
    const descriptor = Buffer.alloc(e.descriptor ? 16 : 0);
    if (e.descriptor) {
      descriptor.writeUInt32LE(0x08074b50, 0);
      descriptor.writeUInt32LE(compressed.length, 8);
      descriptor.writeUInt32LE(uncomp, 12);
    }
    chunks.push(local, localName, compressed, descriptor);
    offset += local.length + localName.length + compressed.length + descriptor.length;

    const extra = e.centralExtra ?? Buffer.alloc(0);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(flags, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(uncomp, 24);
    cd.writeUInt16LE(centralName.length, 28);
    cd.writeUInt16LE(extra.length, 30);
    cd.writeUInt32LE(localOffset, 42);
    central.push(cd, centralName, extra);
  }
  const cdStart = offset;
  const cdBuf = Buffer.concat(central);
  const comment = shape.comment ?? Buffer.alloc(0);
  const count = shape.count ?? entries.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(shape.disk ?? 0, 4);
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(cdBuf.length + (shape.cdSizeDelta ?? 0), 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(comment.length, 20);
  return new Uint8Array(Buffer.concat([...chunks, cdBuf, eocd, comment, shape.trailing ?? Buffer.alloc(0)]));
}

const SHEET = { name: "xl/worksheets/sheet1.xml", data: Buffer.from("<worksheet/>") };
const MACROS = { name: "xl/vbaProject.bin", data: Buffer.from("macro-bytes") };

/** A raw deflate stream of `bytes` zero bytes, built without holding them in memory. */
async function deflatedZeros(bytes: number): Promise<Buffer> {
  const d = createDeflateRaw({ level: 9 });
  const out: Buffer[] = [];
  d.on("data", (c: Buffer) => out.push(c));
  const done = new Promise<void>((resolve, reject) => { d.on("end", resolve); d.on("error", reject); });
  const chunk = Buffer.alloc(1 << 20);
  for (let written = 0; written < bytes; written += chunk.length) {
    if (!d.write(chunk.subarray(0, Math.min(chunk.length, bytes - written)))) {
      await new Promise((r) => d.once("drain", r));
    }
  }
  d.end();
  await done;
  return Buffer.concat(out);
}

describe("guardXlsxContainer reads the directory JSZip reads (DEV-087, BL-191)", () => {
  const malformed = { ok: false, errors: ["XLSX_MALFORMED"] };

  it("accepts a hand-built archive with a comment, the control for every case below", () => {
    expect(guardXlsxContainer(buildZip([SHEET], { comment: Buffer.from("Приклад") }))).toEqual({ ok: true });
  });

  it("accepts what other writers emit: data descriptors, timestamp and NTFS extra fields, duplicate names", () => {
    const timestamp = Buffer.alloc(9);
    timestamp.writeUInt16LE(0x5455, 0);
    timestamp.writeUInt16LE(5, 2);
    const ntfs = Buffer.alloc(36);
    ntfs.writeUInt16LE(0x000a, 0);
    ntfs.writeUInt16LE(32, 2);
    expect(guardXlsxContainer(buildZip([
      { ...SHEET, descriptor: true },
      { name: "xl/styles.xml", data: Buffer.from("<styleSheet/>"), centralExtra: Buffer.concat([timestamp, ntfs]) },
    ]))).toEqual({ ok: true });
    expect(guardXlsxContainer(buildZip([SHEET, { ...SHEET }]))).toEqual({ ok: true });
  });

  it("accepts workbooks from writers other than JSZip, and reads their rows", async () => {
    // LibreOffice Calc 24.2.7 (data descriptors, the UTF-8 flag), openpyxl 3.1.5
    // on Python 3.11 (zipfile), and the LibreOffice file repacked by Info-ZIP
    // Zip 3.0 through a pipe (data descriptors, 0x5455 and 0x7875 extra fields,
    // stored directory entries). Built from koshtorys.csv (DEV-087, gp-reviewer R1).
    for (const name of ["libreoffice.xlsx", "openpyxl.xlsx", "infozip-streamed.xlsx"]) {
      const bytes = new Uint8Array(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)));
      expect(guardXlsxContainer(bytes), name).toEqual({ ok: true });
      const r = await parseXlsx(bytes);
      expect(r.ok, name).toBe(true);
      if (r.ok) {
        expect(r.rows.map((row) => Object.values(row.cells).map((c) => c.raw)), name).toEqual([
          ["Назва", "Од", "К-сть", "Ціна"], ["Мурування", "м2", "10", "199.99"], ["Штукатурення", "м2", "5.5", "150"],
        ]);
      }
    }
  });

  it("(a) refuses a directory holding more records than its end record counts", () => {
    // Before DEV-087 the guard checked one record; JSZip read both, the macro container included.
    expect(guardXlsxContainer(buildZip([SHEET], { uncounted: [MACROS] }))).toEqual(malformed);
  });

  it("(b) refuses an end record whose directory size does not reach it", () => {
    expect(guardXlsxContainer(buildZip([SHEET], { cdSizeDelta: -1 }))).toEqual(malformed);
    expect(guardXlsxContainer(buildZip([SHEET], { cdSizeDelta: 1 }))).toEqual(malformed);
    // The archive JSZip reads differently (gp-qa Q2): the end record points at
    // a directory naming the sheet but states the size of a second directory
    // after it. JSZip re-bases by the difference and reads only the second,
    // which names the macro container; the baseline guard read only the first.
    const local = (name: Buffer, data: Buffer) => {
      const h = Buffer.alloc(30);
      h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(8, 8);
      h.writeUInt32LE(deflateRawSync(data).length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
      return Buffer.concat([h, name, deflateRawSync(data)]);
    };
    const central = (name: Buffer, data: Buffer, at: number) => {
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50, 0); h.writeUInt16LE(8, 10);
      h.writeUInt32LE(deflateRawSync(data).length, 20); h.writeUInt32LE(data.length, 24);
      h.writeUInt16LE(name.length, 28); h.writeUInt32LE(at, 42);
      return Buffer.concat([h, name]);
    };
    const sheetName = Buffer.from(SHEET.name), macroName = Buffer.from(MACROS.name);
    const sheet = local(sheetName, SHEET.data);
    const macroAt = sheet.length + 200;
    const macro = local(macroName, MACROS.data);
    const dirA = central(sheetName, SHEET.data, 0);
    const dirB = central(macroName, MACROS.data, macroAt - dirA.length);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
    end.writeUInt32LE(dirB.length, 12); end.writeUInt32LE(macroAt + macro.length, 16);
    const rebased = new Uint8Array(Buffer.concat([sheet, Buffer.alloc(200), macro, dirA, dirB, end]));
    expect(guardXlsxContainer(rebased)).toEqual(malformed);
  });

  it("(c) refuses an entry whose local name differs from its central one", () => {
    expect(guardXlsxContainer(buildZip([{ ...SHEET, localName: "xl/vbaProject.bin" }]))).toEqual(malformed);
  });

  it("refuses a Unicode Path extra field, which JSZip would take as the name", () => {
    const upath = Buffer.from("xl/vbaProject.bin", "utf-8");
    const field = Buffer.alloc(9 + upath.length);
    field.writeUInt16LE(0x7075, 0);
    field.writeUInt16LE(5 + upath.length, 2);
    upath.copy(field, 9);
    expect(guardXlsxContainer(buildZip([{ ...SHEET, centralExtra: field }]))).toEqual(malformed);
  });

  it("refuses zip64 and multi-disk end records", () => {
    expect(guardXlsxContainer(buildZip([SHEET], { count: 0xffff }))).toEqual(malformed);
    expect(guardXlsxContainer(buildZip([SHEET], { disk: 1 }))).toEqual(malformed);
    const zip64 = Buffer.alloc(4);
    zip64.writeUInt16LE(0x0001, 0);
    expect(guardXlsxContainer(buildZip([{ ...SHEET, centralExtra: zip64 }]))).toEqual(malformed);
  });

  it("refuses an end record that is not the last, or bytes after its comment", () => {
    const eocdInComment = Buffer.alloc(22);
    eocdInComment.writeUInt32LE(0x06054b50, 0);
    expect(guardXlsxContainer(buildZip([SHEET], { comment: eocdInComment }))).toEqual(malformed);
    // A signature in the final 21 bytes: the last one, which JSZip takes and the
    // baseline guard, scanning from 22 bytes before the end, never saw (R5).
    expect(guardXlsxContainer(buildZip([SHEET], { comment: Buffer.from("PK\x05\x06abcd", "latin1") }))).toEqual(malformed);
    expect(guardXlsxContainer(buildZip([SHEET], { trailing: Buffer.from("tail") }))).toEqual(malformed);
  });

  it("refuses entries sharing data, and a name that is not UTF-8", () => {
    // Same names, so the refusal is the overlap and not a name mismatch (R2).
    expect(guardXlsxContainer(buildZip([SHEET, { ...SHEET }], { overlap: true }))).toEqual(malformed);
    expect(guardXlsxContainer(buildZip([{ ...SHEET, rawName: Buffer.from([0x78, 0xff, 0x2e]) }]))).toEqual(malformed);
    // A BOM before `xl/macros/`, which JSZip keeps in the name (gp-qa Q1).
    expect(guardXlsxContainer(buildZip([{ ...SHEET, name: "\uFEFFxl/macros/a.bin" }]))).toEqual(malformed);
  });

  it("refuses a name JSZip would rewrite before ExcelJS sees it (gp-security S2)", () => {
    for (const name of ["./xl/macros/a.bin", "xl//macros/a.bin", "xl/./macros/a.bin"]) {
      expect(guardXlsxContainer(buildZip([{ ...SHEET, name }]))).toEqual(malformed);
    }
  });

  it("was read against JSZip 3.10.1: an upgrade repeats that reading", () => {
    const fromExcelJs = createRequire(createRequire(import.meta.url).resolve("exceljs"));
    expect((fromExcelJs("jszip/package.json") as { version: string }).version).toBe("3.10.1");
  });

  it("refuses an encrypted entry and an unsupported compression method", () => {
    expect(guardXlsxContainer(buildZip([{ ...SHEET, flags: 0x0001 }])))
      .toEqual({ ok: false, errors: ["XLSX_ENCRYPTED_OR_LEGACY"] });
    // A valid deflate stream, so the method check and not the inflation refuses it (gp-qa Q3).
    expect(guardXlsxContainer(buildZip([{ ...SHEET, method: 12, compressed: deflateRawSync(SHEET.data) }]))).toEqual(malformed);
  });
});

describe("guardXlsxContainer enforces the declared sizes (DEV-087, BL-192)", () => {
  it("refuses an entry declaring 1 KiB that inflates to 200 MB, without inflating past 1 KiB", async () => {
    const compressed = await deflatedZeros(200 * 1024 * 1024);
    const bomb = buildZip([{ name: "xl/worksheets/sheet1.xml", data: Buffer.alloc(0), compressed, declaredUncompressed: 1024 }]);
    const before = process.memoryUsage().arrayBuffers;
    const started = Date.now();
    expect(guardXlsxContainer(bomb)).toEqual({ ok: false, errors: ["XLSX_BOMB_SIZE"] });
    expect(await parseXlsx(bomb)).toEqual({ ok: false, errors: ["XLSX_BOMB_SIZE"] });
    // The guard stopped at its ceiling: no 200 MB buffer, and not the time inflating one takes.
    expect(process.memoryUsage().arrayBuffers - before).toBeLessThan(32 * 1024 * 1024);
    expect(Date.now() - started).toBeLessThan(2_000);
  }, 60_000);

  it("refuses an entry that inflates to less than it declares, and a stored entry whose sizes differ", () => {
    expect(guardXlsxContainer(buildZip([{ ...SHEET, declaredUncompressed: SHEET.data.length + 1 }])))
      .toEqual({ ok: false, errors: ["XLSX_MALFORMED"] });
    expect(guardXlsxContainer(buildZip([{ ...SHEET, method: 0, declaredUncompressed: SHEET.data.length + 1 }])))
      .toEqual({ ok: false, errors: ["XLSX_MALFORMED"] });
    expect(guardXlsxContainer(buildZip([{ ...SHEET, method: 0 }]))).toEqual({ ok: true });
  });
});

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
  it("hands the parser exactly the bytes the guard checked, whatever buffer holds them (DEV-082, BL-064)", async () => {
    const bytes = await buildXlsx([["Приклад", 1]]);
    // The upload as a view into a larger buffer: before DEV-082 the parser got
    // the whole backing ArrayBuffer (on Node 24, Node's shared 64 KiB pool for
    // any upload under 32 KiB), with other allocations' bytes around the file.
    const host = new Uint8Array(bytes.length + 4096);
    host.set(bytes, 1024);
    const view = host.subarray(1024, 1024 + bytes.length);
    const xlsxProto = Object.getPrototypeOf(new ExcelJS.Workbook().xlsx) as { load: (data: unknown) => Promise<unknown> };
    const load = vi.spyOn(xlsxProto, "load");
    // Node 24's pool size on any Node, so a copy through Buffer.from lands in
    // the shared pool here too.
    const poolSize = Buffer.poolSize;
    Buffer.poolSize = 64 * 1024;
    try {
      // A view into a larger buffer, and a pooled Node Buffer (whose `slice`
      // returns a view of the pool, not a copy).
      for (const input of [view, Buffer.from(bytes)]) {
        load.mockClear();
        const r = await parseXlsx(input);
        const arg = load.mock.calls[0]![0] as ArrayBuffer;
        expect(arg.byteLength).toBe(bytes.length);
        expect(new Uint8Array(arg)).toEqual(bytes);
        expect(r.ok).toBe(true);
      }
    } finally {
      Buffer.poolSize = poolSize;
      load.mockRestore();
    }
  });

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
