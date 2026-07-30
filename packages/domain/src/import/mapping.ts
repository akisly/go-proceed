import type { SourceRow } from "./csv";

/** Column mapping: values are spreadsheet column letters ("A".."ZZ").
 * Optional members allow explicit `undefined` so zod-inferred request types
 * remain assignable under exactOptionalPropertyTypes. */
export interface ColumnMapping {
  sourceKey?: string | undefined;
  workCode?: string | undefined;
  description: string;
  section?: string | undefined;
  unit: string;
  quantity: string;
  unitPrice?: string | undefined;
  amount?: string | undefined;
  location?: string | undefined;
  externalRef?: string | undefined;
}

export interface ImportConfig {
  locale: "uk-UA" | "en-US";
  headerRow: number; // rows at or before this 1-based row are skipped (0 = none)
  worksheet?: string | undefined;
}

export interface MappedRow {
  sourceRowNo: number;
  worksheet: string | null;
  sourceKey: string | null;
  workCode: string | null;
  description: string;
  section: string | null;
  unitText: string;
  quantityText: string;
  unitPriceText: string | null;
  amountText: string | null;
  locationName: string | null;
  externalRef: string | null;
  /** Mapped columns whose source cell carried a formula (inert provenance). */
  formulaColumns: string[];
}

/** Mirrors the 0012 unit_definitions generated column: lower + strip ALL whitespace. */
export function normalizeUnitCode(text: string): string {
  return text.trim().replace(/\s+/g, "").toLowerCase();
}

export function applyMapping(
  rows: SourceRow[], mapping: ColumnMapping, config: ImportConfig,
): { mapped: MappedRow[]; skippedEmpty: number } {
  const mapped: MappedRow[] = [];
  let skippedEmpty = 0;
  const pick = (r: SourceRow, col: string | undefined): { text: string; formula: boolean } => {
    if (!col) return { text: "", formula: false };
    const cell = r.cells[col];
    return { text: (cell?.raw ?? "").trim(), formula: Boolean(cell?.formula) };
  };
  for (const r of rows) {
    if (config.worksheet && r.worksheet !== null && r.worksheet !== config.worksheet) continue;
    if (r.rowNo <= config.headerRow) continue;
    const fields = {
      sourceKey: pick(r, mapping.sourceKey),
      workCode: pick(r, mapping.workCode),
      description: pick(r, mapping.description),
      section: pick(r, mapping.section),
      unit: pick(r, mapping.unit),
      quantity: pick(r, mapping.quantity),
      unitPrice: pick(r, mapping.unitPrice),
      amount: pick(r, mapping.amount),
      location: pick(r, mapping.location),
      externalRef: pick(r, mapping.externalRef),
    };
    if (Object.values(fields).every((f) => f.text === "")) { skippedEmpty++; continue; }
    const formulaColumns = (Object.entries(fields) as [string, { text: string; formula: boolean }][])
      .filter(([, f]) => f.formula).map(([k]) => k);
    mapped.push({
      sourceRowNo: r.rowNo,
      worksheet: r.worksheet,
      sourceKey: fields.sourceKey.text || null,
      workCode: fields.workCode.text || null,
      description: fields.description.text,
      section: fields.section.text || null,
      unitText: fields.unit.text,
      quantityText: fields.quantity.text,
      unitPriceText: fields.unitPrice.text || null,
      amountText: fields.amount.text || null,
      locationName: fields.location.text || null,
      externalRef: fields.externalRef.text || null,
      formulaColumns,
    });
  }
  return { mapped, skippedEmpty };
}
