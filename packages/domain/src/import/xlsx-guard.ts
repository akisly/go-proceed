import { inflateRawSync } from "node:zlib";

/**
 * XLSX container guard (INV-016): the workbook is an UNTRUSTED ZIP. This reads
 * the ZIP structure BY HAND and rejects macro containers, path traversal, size
 * bombs, encrypted/legacy CFB files and malformed archives before any parser
 * touches the bytes.
 *
 * The guard checks the archive the parser will read, not merely one it could
 * read (DEV-087; BL-191). ExcelJS 4.4.0 loads through JSZip 3.10.1, which takes
 * the LAST end-of-central-directory signature in the file, keeps reading
 * central records while their signature matches, reads each entry's data from
 * its local header, and names an entry from a Unicode Path extra field (0x7075)
 * when one is present. So the guard requires one reading only:
 *   - the end record is the last in the file and its comment ends the file;
 *   - a single disk, no zip64, and the central directory ends exactly at the
 *     end record, so JSZip finds no record the guard did not count;
 *   - every entry's local header is where the central record says, carries the
 *     same name, and its data lies before the directory without overlapping
 *     another entry's;
 *   - no Unicode Path or zip64 extra field, and names are valid UTF-8.
 *
 * The declared sizes are then enforced, not trusted (DEV-087; BL-192): each
 * entry is inflated here with its declared size as a hard ceiling, so an entry
 * that declares 1 KiB and inflates to 200 MB stops at 1 KiB, and the parser
 * that inflates it again cannot exceed what the guard measured.
 */

export interface XlsxLimits {
  maxBytes: number;
  maxEntries: number;
  maxTotalUncompressed: number;
  maxCompressionRatio: number;
  maxRows: number;
  maxCols: number;
  maxCellChars: number;
}
export const XLSX_LIMITS: XlsxLimits = {
  maxBytes: 20_971_520,
  maxEntries: 10_000,
  maxTotalUncompressed: 104_857_600, // 100 MB
  maxCompressionRatio: 100,
  maxRows: 20_000, // see CSV_LIMITS.maxRows — synchronous-path ceiling
  maxCols: 256,
  maxCellChars: 32_768,
};

export type XlsxGuardError =
  | "XLSX_NOT_ZIP" | "XLSX_ENCRYPTED_OR_LEGACY" | "XLSX_MACROS_PRESENT"
  | "XLSX_PATH_TRAVERSAL" | "XLSX_TOO_MANY_ENTRIES" | "XLSX_BOMB_RATIO"
  | "XLSX_BOMB_SIZE" | "XLSX_TOO_LARGE" | "XLSX_MALFORMED";

export interface ZipEntrySummary {
  path: string; compressedSize: number; uncompressedSize: number;
  /** 0 stored, 8 deflate: the only methods JSZip reads. */
  method: number;
  encrypted: boolean;
  /** The entry's data, as JSZip will read it: [dataStart, dataStart + compressedSize). */
  dataStart: number;
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const EXTRA_ZIP64 = 0x0001;
const EXTRA_UNICODE_PATH = 0x7075;
const U16_MAX = 0xffff;
const U32_MAX = 0xffffffff;

function readU16(b: Uint8Array, off: number): number {
  return (b[off] ?? 0) | ((b[off + 1] ?? 0) << 8);
}
function readU32(b: Uint8Array, off: number): number {
  return ((b[off] ?? 0) | ((b[off + 1] ?? 0) << 8) | ((b[off + 2] ?? 0) << 16)) + ((b[off + 3] ?? 0) * 0x1000000);
}
function sigAt(b: Uint8Array, off: number, sig: number): boolean {
  return off >= 0 && off + 4 <= b.length && readU32(b, off) === sig;
}

/**
 * The end record JSZip takes: the LAST signature in the file. Only the final
 * 65 557 bytes can hold a valid one (22 bytes plus the longest comment), so a
 * signature there is searched from the very end, as JSZip's lastIndexOf does,
 * and one found is valid only if its comment ends the file.
 */
function findEocd(b: Uint8Array): number | null {
  const min = Math.max(0, b.length - 65_557);
  for (let i = b.length - 4; i >= min; i--) {
    if (sigAt(b, i, SIG_END)) {
      return i + 22 <= b.length && i + 22 + readU16(b, i + 20) === b.length ? i : null;
    }
  }
  return null;
}

/** True when an extra-field block is well formed and names neither zip64 nor a Unicode Path. */
function extraFieldsAcceptable(b: Uint8Array, start: number, length: number): boolean {
  let off = start;
  const end = start + length;
  while (off < end) {
    if (off + 4 > end) return false;
    const id = readU16(b, off);
    const size = readU16(b, off + 2);
    if (off + 4 + size > end) return false;
    if (id === EXTRA_ZIP64 || id === EXTRA_UNICODE_PATH) return false;
    off += 4 + size;
  }
  return true;
}

function sameBytes(b: Uint8Array, a0: number, b0: number, length: number): boolean {
  for (let i = 0; i < length; i++) if (b[a0 + i] !== b[b0 + i]) return false;
  return true;
}

export function listZipEntries(b: Uint8Array): ZipEntrySummary[] | null {
  const eocd = findEocd(b);
  if (eocd === null) return null;
  const disk = readU16(b, eocd + 4);
  const cdDisk = readU16(b, eocd + 6);
  const countOnDisk = readU16(b, eocd + 8);
  const count = readU16(b, eocd + 10);
  const cdSize = readU32(b, eocd + 12);
  const cdOffset = readU32(b, eocd + 16);
  // One disk, no zip64 sentinel, and a directory that ends at the end record:
  // JSZip then reads exactly `count` records from `cdOffset` with no prepended
  // bytes to re-base against.
  if (disk !== 0 || cdDisk !== 0 || countOnDisk !== count) return null;
  if (count === U16_MAX || cdSize === U32_MAX || cdOffset === U32_MAX) return null;
  if (cdOffset + cdSize !== eocd) return null;

  const names = new TextDecoder("utf-8", { fatal: true });
  const entries: ZipEntrySummary[] = [];
  const spans: [number, number][] = [];
  let off = cdOffset;
  for (let i = 0; i < count; i++) {
    if (off + 46 > eocd || !sigAt(b, off, SIG_CENTRAL)) return null;
    const flags = readU16(b, off + 8);
    const method = readU16(b, off + 10);
    const compressedSize = readU32(b, off + 20);
    const uncompressedSize = readU32(b, off + 24);
    const nameLen = readU16(b, off + 28);
    const extraLen = readU16(b, off + 30);
    const commentLen = readU16(b, off + 32);
    const entryDisk = readU16(b, off + 34);
    const localOffset = readU32(b, off + 42);
    const next = off + 46 + nameLen + extraLen + commentLen;
    if (next > eocd || entryDisk !== 0) return null;
    if (compressedSize === U32_MAX || uncompressedSize === U32_MAX || localOffset === U32_MAX) return null;
    if (!extraFieldsAcceptable(b, off + 46 + nameLen, extraLen)) return null;
    let path: string;
    try {
      path = names.decode(b.subarray(off + 46, off + 46 + nameLen));
    } catch {
      return null;
    }

    // The local header JSZip reads the data from: at the stated offset, with
    // the same name, and its data wholly before the central directory.
    if (localOffset + 30 > cdOffset || !sigAt(b, localOffset, SIG_LOCAL)) return null;
    const localNameLen = readU16(b, localOffset + 26);
    const localExtraLen = readU16(b, localOffset + 28);
    if (localNameLen !== nameLen || !sameBytes(b, localOffset + 30, off + 46, nameLen)) return null;
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    if (dataStart + compressedSize > cdOffset) return null;

    entries.push({
      path, compressedSize, uncompressedSize, method, encrypted: (flags & 0x0001) !== 0, dataStart,
    });
    spans.push([localOffset, dataStart + compressedSize]);
    off = next;
  }
  // The walk ends exactly at the end record: no record past `count` for
  // JSZip's signature loop to find.
  if (off !== eocd) return null;
  // No two entries share bytes: each inflation below then reads its own data.
  spans.sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < spans.length; i++) {
    if (spans[i]![0] < spans[i - 1]![1]) return null;
  }
  return entries;
}

/**
 * Inflates one entry with its declared size as the ceiling. `ok` when it
 * inflates to exactly that size; `overrun` when it would exceed it; otherwise
 * `malformed` (a truncated stream, a short one, or a stored entry whose two
 * sizes differ).
 */
function inflateCapped(b: Uint8Array, e: ZipEntrySummary): "ok" | "overrun" | "malformed" {
  const data = b.subarray(e.dataStart, e.dataStart + e.compressedSize);
  if (e.method === 0) return e.compressedSize === e.uncompressedSize ? "ok" : "malformed";
  try {
    const out = inflateRawSync(data, { maxOutputLength: Math.max(1, e.uncompressedSize) });
    return out.length === e.uncompressedSize ? "ok" : "malformed";
  } catch (err) {
    return (err as { code?: string }).code === "ERR_BUFFER_TOO_LARGE" ? "overrun" : "malformed";
  }
}

export function guardXlsxContainer(
  bytes: Uint8Array, limits: XlsxLimits = XLSX_LIMITS,
): { ok: true } | { ok: false; errors: XlsxGuardError[] } {
  if (bytes.length > limits.maxBytes) return { ok: false, errors: ["XLSX_TOO_LARGE"] };
  if (bytes.length >= 8
    && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
    && bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1) {
    // CFB container: legacy .xls or an encrypted OOXML workbook.
    return { ok: false, errors: ["XLSX_ENCRYPTED_OR_LEGACY"] };
  }
  if (!(bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    return { ok: false, errors: ["XLSX_NOT_ZIP"] };
  }
  const entries = listZipEntries(bytes);
  if (entries === null) return { ok: false, errors: ["XLSX_MALFORMED"] };
  if (entries.length > limits.maxEntries) return { ok: false, errors: ["XLSX_TOO_MANY_ENTRIES"] };

  const errors = new Set<XlsxGuardError>();
  let totalUncompressed = 0;
  for (const e of entries) {
    if (e.path.startsWith("/") || e.path.includes("\\") || e.path.split("/").includes("..")) {
      errors.add("XLSX_PATH_TRAVERSAL");
    }
    if (/vbaProject/i.test(e.path) || /^xl\/macros\//i.test(e.path)) {
      errors.add("XLSX_MACROS_PRESENT");
    }
    if (e.encrypted) errors.add("XLSX_ENCRYPTED_OR_LEGACY");
    if (e.method !== 0 && e.method !== 8) errors.add("XLSX_MALFORMED");
    totalUncompressed += e.uncompressedSize;
    if (e.compressedSize >= 64 && e.uncompressedSize / e.compressedSize > limits.maxCompressionRatio) {
      errors.add("XLSX_BOMB_RATIO");
    }
  }
  if (totalUncompressed > limits.maxTotalUncompressed) errors.add("XLSX_BOMB_SIZE");
  if (errors.size > 0) return { ok: false, errors: [...errors] };

  // Only now, with every declared size within the limits, is anything
  // inflated, and never past what an entry declared.
  for (const e of entries) {
    const r = inflateCapped(bytes, e);
    if (r === "overrun") return { ok: false, errors: ["XLSX_BOMB_SIZE"] };
    if (r === "malformed") return { ok: false, errors: ["XLSX_MALFORMED"] };
  }
  return { ok: true };
}
