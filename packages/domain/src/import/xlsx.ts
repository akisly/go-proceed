import ExcelJS from "exceljs";
import type { SourceRow, SourceCell } from "./csv";
import { columnLetter } from "./csv";
import { guardXlsxContainer, XLSX_LIMITS, type XlsxLimits, type XlsxGuardError } from "./xlsx-guard";

export type XlsxParseError = XlsxGuardError | "XLSX_ROWS_LIMIT" | "XLSX_COLS_LIMIT" | "XLSX_CELL_LIMIT";

export interface XlsxParseOk { ok: true; rows: SourceRow[]; worksheets: string[] }
export interface XlsxParseFail { ok: false; errors: XlsxParseError[] }

/**
 * Safe XLSX read (INV-016): the container guard runs FIRST (fail-closed);
 * exceljs then reads cell values and formula TEXT — formulas, macros, and
 * external links are never evaluated. A formula cell surfaces as inert
 * provenance: { raw: cachedResult, formula: formulaText }.
 */
export async function parseXlsx(
  bytes: Uint8Array, limits: XlsxLimits = XLSX_LIMITS,
): Promise<XlsxParseOk | XlsxParseFail> {
  const guard = guardXlsxContainer(bytes, limits);
  if (!guard.ok) return { ok: false, errors: guard.errors };

  const wb = new ExcelJS.Workbook();
  try {
    // An exact-length copy with its own ArrayBuffer: the bytes the guard just
    // checked, and nothing else. `Buffer.from(bytes).buffer` is Node's shared
    // allocation pool (64 KiB on Node 24) for any upload under half its size,
    // so the parser used to read the workbook embedded among leftover bytes of
    // other allocations, and failed as malformed when they held a zip
    // signature (DEV-082, BL-064).
    await wb.xlsx.load(bytes.slice().buffer as ArrayBuffer);
  } catch {
    return { ok: false, errors: ["XLSX_MALFORMED"] };
  }

  const rows: SourceRow[] = [];
  const worksheets: string[] = [];
  const errors = new Set<XlsxParseError>();

  for (const ws of wb.worksheets) {
    worksheets.push(ws.name);
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rows.length >= limits.maxRows) { errors.add("XLSX_ROWS_LIMIT"); return; }
      const cells: Record<string, SourceCell> = {};
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (colNumber > limits.maxCols) { errors.add("XLSX_COLS_LIMIT"); return; }
        const v = cell.value;
        let raw: string;
        let formula: string | undefined;
        if (v !== null && typeof v === "object" && "formula" in (v as object)) {
          const fv = v as ExcelJS.CellFormulaValue;
          formula = String(fv.formula ?? "");
          raw = fv.result != null && typeof fv.result !== "object" ? String(fv.result) : "";
        } else if (v !== null && typeof v === "object" && "richText" in (v as object)) {
          raw = (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
        } else if (v instanceof Date) {
          raw = v.toISOString();
        } else {
          raw = v == null ? "" : String(v);
        }
        if (raw.length > limits.maxCellChars) { errors.add("XLSX_CELL_LIMIT"); return; }
        if (raw !== "" || formula) {
          cells[columnLetter(colNumber - 1)] = formula ? { raw, formula } : { raw };
        }
      });
      if (Object.keys(cells).length > 0) {
        rows.push({ worksheet: ws.name, rowNo: rowNumber, cells });
      }
    });
  }

  // Fail closed: any limit breach voids the whole parse rather than returning
  // a silently truncated result.
  if (errors.size > 0) return { ok: false, errors: [...errors] };
  return { ok: true, rows, worksheets };
}
