/**
 * Strict, fail-closed RFC4180-style CSV parser (INV-016 discipline: content is
 * data, never executable input; any limit/format breach yields ok:false with a
 * named code and ZERO rows — no partial silent results). Values come out as
 * untrusted strings; nothing is coerced here.
 */

export interface SourceCell { raw: string; formula?: string }
export interface SourceRow {
  worksheet: string | null;
  rowNo: number; // 1-based line in the source file where the row starts
  cells: Record<string, SourceCell>; // keyed "A","B",…,"Z","AA",…
}

export interface CsvLimits {
  maxBytes: number;
  maxRows: number;
  maxCols: number;
  maxFieldChars: number;
}
export const CSV_LIMITS: CsvLimits = {
  maxBytes: 20_971_520,
  maxRows: 200_000,
  maxCols: 256,
  maxFieldChars: 32_768,
};

export type CsvDelimiter = "," | ";" | "\t";
export type CsvErrorCode =
  | "CSV_ENCODING_INVALID" | "CSV_CONTROL_CHARS" | "CSV_FIELD_TOO_LONG"
  | "CSV_TOO_MANY_ROWS" | "CSV_TOO_MANY_COLS" | "CSV_UNBALANCED_QUOTE"
  | "CSV_TOO_LARGE";

export interface CsvResult {
  ok: boolean;
  rows: SourceRow[];
  delimiter: CsvDelimiter | null;
  errors: { code: CsvErrorCode; row?: number }[];
}

export function columnLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function detectDelimiter(firstLine: string): CsvDelimiter {
  const counts: Record<CsvDelimiter, number> = { ";": 0, ",": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === ";" || ch === "," || ch === "\t")) counts[ch]++;
  }
  let best: CsvDelimiter = ";";
  for (const d of [";", ",", "\t"] as const) if (counts[d] > counts[best]) best = d;
  return best;
}

export function parseCsv(
  bytes: Uint8Array, delimiter?: CsvDelimiter, limits: CsvLimits = CSV_LIMITS,
): CsvResult {
  const fail = (code: CsvErrorCode, row?: number): CsvResult =>
    ({ ok: false, rows: [], delimiter: null, errors: [{ code, ...(row !== undefined ? { row } : {}) }] });

  if (bytes.length > limits.maxBytes) return fail("CSV_TOO_LARGE");

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return fail("CSV_ENCODING_INVALID");
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  // Reject NUL and C0 control chars other than \t \r \n before parsing.
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return fail("CSV_CONTROL_CHARS");
  }

  const firstNl = text.indexOf("\n");
  const delim = delimiter ?? detectDelimiter((firstNl === -1 ? text : text.slice(0, firstNl)).replace(/\r$/, ""));

  const rows: SourceRow[] = [];
  let field = "";
  let row: string[] = [];
  let lineNo = 1;       // current 1-based physical line
  let rowStartLine = 1; // line where the current row began
  let errorOut: CsvResult | null = null;
  type State = "field" | "quoted" | "afterQuote";
  let state: State = "field";

  const endField = (): boolean => {
    if (field.length > limits.maxFieldChars) { errorOut = fail("CSV_FIELD_TOO_LONG", rowStartLine); return false; }
    row.push(field);
    field = "";
    if (row.length > limits.maxCols) { errorOut = fail("CSV_TOO_MANY_COLS", rowStartLine); return false; }
    return true;
  };
  const endRow = (): boolean => {
    if (!endField()) return false;
    const isEmptyLine = row.length === 1 && row[0] === "";
    if (!isEmptyLine) {
      const cells: Record<string, SourceCell> = {};
      row.forEach((v, c) => { if (v !== "") cells[columnLetter(c)] = { raw: v }; });
      rows.push({ worksheet: null, rowNo: rowStartLine, cells });
      if (rows.length > limits.maxRows) { errorOut = fail("CSV_TOO_MANY_ROWS", rowStartLine); return false; }
    }
    row = [];
    rowStartLine = lineNo + 1;
    return true;
  };

  for (let i = 0; i < text.length && !errorOut; i++) {
    const ch = text[i];
    if (state === "quoted") {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else state = "afterQuote";
      } else {
        if (ch === "\n") lineNo++;
        field += ch;
      }
      continue;
    }
    if (state === "afterQuote") {
      if (ch === delim) { if (!endField()) break; state = "field"; continue; }
      if (ch === "\r") { state = "field"; continue; }
      if (ch === "\n") { state = "field"; if (!endRow()) break; lineNo++; continue; }
      errorOut = fail("CSV_UNBALANCED_QUOTE", rowStartLine);
      break;
    }
    if (ch === '"' && field === "") { state = "quoted"; continue; }
    if (ch === delim) { if (!endField()) break; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { if (!endRow()) break; lineNo++; continue; }
    field += ch;
  }
  if (errorOut) return errorOut;
  if (state === "quoted") return fail("CSV_UNBALANCED_QUOTE", rowStartLine);
  if (field !== "" || row.length > 0) {
    if (!endRow()) return errorOut ?? fail("CSV_TOO_MANY_ROWS", rowStartLine);
  }
  if (errorOut) return errorOut;

  return { ok: true, rows, delimiter: delim, errors: [] };
}
