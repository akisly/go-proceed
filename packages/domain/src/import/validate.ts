import type { MappedRow } from "./mapping";
import {
  parseLocalizedDecimal, rescale, mulToMinorUnits, taxSplit, netFromGross, withinTolerance,
  type Decimal, type TaxMode, type Midpoint,
} from "../money";

export type RowErrorCode =
  | "DESCRIPTION_REQUIRED" | "UNIT_REQUIRED" | "UNIT_UNKNOWN"
  | "QUANTITY_INVALID" | "QUANTITY_NEGATIVE" | "PRICE_INVALID"
  | "AMOUNT_INVALID" | "AMOUNT_MISMATCH" | "TAX_MODE_UNKNOWN" | "FORMULA_CELL";

export interface ContractPins {
  currency: string;
  taxMode: TaxMode;
  taxRateBps: number | null;
  midpoint: Midpoint;
  minorScale: number; // 2 for UAH
  tolAbsMinor: bigint;
  tolBps: number;
  priceBasis: "net" | "gross";
  locale: "uk-UA" | "en-US";
}

export interface RowValidation {
  row: MappedRow;
  severity: "ok" | "warning" | "blocking";
  codes: RowErrorCode[];
  needsResolution: boolean;
  quantity: Decimal | null;
  unitPrice: Decimal | null;
  unitPriceState: "known" | "zero" | "missing";
  derivedMinor: bigint | null; // net-basis derived qty×price
  sourceMinor: bigint | null;  // net-basis source amount
  net: bigint | null;
  tax: bigint | null;
  gross: bigint | null;
}

/**
 * Row validation (INV-054 core). `unit` is the resolved unit definition or
 * null when unregistered; `resolved` marks an explicit source-amount
 * resolution covering this row (mismatch degrades to a warning but keeps its
 * code as provenance).
 */
export function validateRow(
  row: MappedRow,
  unit: { normalizedCode: string; precision: number } | null,
  pins: ContractPins,
  resolved: boolean,
): RowValidation {
  const codes: RowErrorCode[] = [];
  let blocking = false;
  let warning = false;

  if (row.description === "") { codes.push("DESCRIPTION_REQUIRED"); blocking = true; }
  if (row.unitText === "") { codes.push("UNIT_REQUIRED"); blocking = true; }
  else if (unit === null) { codes.push("UNIT_UNKNOWN"); blocking = true; }

  let quantity: Decimal | null = null;
  if (row.quantityText === "") { codes.push("QUANTITY_INVALID"); blocking = true; }
  else {
    const q = parseLocalizedDecimal(row.quantityText, pins.locale);
    if (!q.ok) { codes.push("QUANTITY_INVALID"); blocking = true; }
    else if (q.value.scaled < 0n) { codes.push("QUANTITY_NEGATIVE"); blocking = true; }
    else if (unit) {
      // Pin to unit precision (policy, not an error).
      quantity = { scaled: rescale(q.value, unit.precision, pins.midpoint), scale: unit.precision };
    } else {
      quantity = q.value;
    }
  }

  let unitPrice: Decimal | null = null;
  let unitPriceState: "known" | "zero" | "missing" = "missing";
  if (row.unitPriceText !== null && row.unitPriceText !== "") {
    const p = parseLocalizedDecimal(row.unitPriceText, pins.locale);
    if (!p.ok) { codes.push("PRICE_INVALID"); blocking = true; }
    else {
      unitPrice = p.value;
      unitPriceState = p.value.scaled === 0n ? "zero" : "known";
    }
  }

  // Derived monetary pool (net basis) from qty × price where possible.
  let derivedMinor: bigint | null = null;
  if (quantity && unitPrice && unitPriceState === "known") {
    const raw = mulToMinorUnits(quantity, unitPrice, pins.minorScale, pins.midpoint);
    derivedMinor = pins.priceBasis === "gross" && pins.taxRateBps != null && pins.taxMode === "inclusive"
      ? netFromGross(raw, pins.taxRateBps, pins.midpoint)
      : raw;
  } else if (unitPriceState === "zero" && quantity) {
    derivedMinor = 0n;
  }

  // Source amount comparison (INV-054).
  let sourceMinor: bigint | null = null;
  if (row.amountText !== null && row.amountText !== "") {
    const s = parseLocalizedDecimal(row.amountText, pins.locale);
    if (!s.ok) { codes.push("AMOUNT_INVALID"); blocking = true; }
    else {
      const rawSource = rescale(s.value, pins.minorScale, pins.midpoint);
      sourceMinor = pins.priceBasis === "gross" && pins.taxRateBps != null && pins.taxMode === "inclusive"
        ? netFromGross(rawSource, pins.taxRateBps, pins.midpoint)
        : rawSource;
    }
  }

  let needsResolution = false;
  if (sourceMinor !== null && derivedMinor !== null) {
    if (!withinTolerance(sourceMinor, derivedMinor, pins.tolAbsMinor, pins.tolBps)) {
      codes.push("AMOUNT_MISMATCH");
      needsResolution = !resolved;
      if (resolved) warning = true;
      else blocking = true;
    }
  }

  if (row.formulaColumns.length > 0) { codes.push("FORMULA_CELL"); warning = true; }

  // Tax computation on the canonical (derived) pool.
  let net: bigint | null = null;
  let tax: bigint | null = null;
  let gross: bigint | null = null;
  if (derivedMinor !== null) {
    const split = taxSplit(derivedMinor, pins.taxRateBps, pins.taxMode, pins.midpoint);
    net = split.net; tax = split.tax; gross = split.gross;
    if (split.warning) { codes.push("TAX_MODE_UNKNOWN"); warning = true; }
  }
  if (unitPriceState === "missing" && !blocking) warning = true; // legal, VaR handles it

  return {
    row,
    severity: blocking ? "blocking" : warning ? "warning" : "ok",
    codes,
    needsResolution,
    quantity,
    unitPrice,
    unitPriceState,
    derivedMinor,
    sourceMinor,
    net, tax, gross,
  };
}

export function buildPreview(rows: RowValidation[]): {
  rowCount: number;
  blockingCount: number;
  warningCount: number;
  needsResolutionCount: number;
  totals: { netMinor: string; taxMinor: string; grossMinor: string };
} {
  let net = 0n, tax = 0n, gross = 0n;
  let blockingCount = 0, warningCount = 0, needsResolutionCount = 0;
  for (const r of rows) {
    if (r.severity === "blocking") { blockingCount++; if (r.needsResolution) needsResolutionCount++; continue; }
    if (r.severity === "warning") warningCount++;
    if (r.net !== null) net += r.net;
    if (r.tax !== null) tax += r.tax;
    if (r.gross !== null) gross += r.gross;
  }
  return {
    rowCount: rows.length,
    blockingCount,
    warningCount,
    needsResolutionCount,
    totals: { netMinor: net.toString(), taxMinor: tax.toString(), grossMinor: gross.toString() },
  };
}
