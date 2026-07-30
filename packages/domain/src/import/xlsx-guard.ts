/**
 * XLSX container guard (INV-016): the workbook is an UNTRUSTED ZIP. This scans
 * the ZIP central directory BY HAND — nothing is inflated — and rejects
 * macro containers, path traversal, declared-size bombs, encrypted/legacy CFB
 * files, and malformed archives before any parser touches the bytes.
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

export interface ZipEntrySummary { path: string; compressedSize: number; uncompressedSize: number }

function readU16(b: Uint8Array, off: number): number {
  return (b[off] ?? 0) | ((b[off + 1] ?? 0) << 8);
}
function readU32(b: Uint8Array, off: number): number {
  return ((b[off] ?? 0) | ((b[off + 1] ?? 0) << 8) | ((b[off + 2] ?? 0) << 16)) + ((b[off + 3] ?? 0) * 0x1000000);
}

/** Locate EOCD (PK\x05\x06) scanning backward over the max comment length. */
function findEocd(b: Uint8Array): number | null {
  const min = Math.max(0, b.length - 65_557);
  for (let i = b.length - 22; i >= min; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) return i;
  }
  return null;
}

export function listZipEntries(b: Uint8Array): ZipEntrySummary[] | null {
  const eocd = findEocd(b);
  if (eocd === null) return null;
  const count = readU16(b, eocd + 10);
  const cdOffset = readU32(b, eocd + 16);
  const entries: ZipEntrySummary[] = [];
  let off = cdOffset;
  for (let i = 0; i < count; i++) {
    if (off + 46 > b.length) return null;
    if (!(b[off] === 0x50 && b[off + 1] === 0x4b && b[off + 2] === 0x01 && b[off + 3] === 0x02)) return null;
    const compressedSize = readU32(b, off + 20);
    const uncompressedSize = readU32(b, off + 24);
    const nameLen = readU16(b, off + 28);
    const extraLen = readU16(b, off + 30);
    const commentLen = readU16(b, off + 32);
    if (off + 46 + nameLen > b.length) return null;
    const path = new TextDecoder("utf-8").decode(b.subarray(off + 46, off + 46 + nameLen));
    entries.push({ path, compressedSize, uncompressedSize });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
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
    totalUncompressed += e.uncompressedSize;
    if (e.compressedSize >= 64 && e.uncompressedSize / e.compressedSize > limits.maxCompressionRatio) {
      errors.add("XLSX_BOMB_RATIO");
    }
  }
  if (totalUncompressed > limits.maxTotalUncompressed) errors.add("XLSX_BOMB_SIZE");
  if (errors.size > 0) return { ok: false, errors: [...errors] };
  return { ok: true };
}
