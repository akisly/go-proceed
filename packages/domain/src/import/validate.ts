import type { MappedRow } from "./mapping";
import {
  parseLocalizedDecimal, rescale, mulToMinorUnits, splitByBasis, withinTolerance,
  fitsNumeric18_6, MAX_MINOR_UNITS,
  type Decimal, type TaxMode, type Midpoint, type PriceBasis,
} from "../money";

export type RowErrorCode =
  | "DESCRIPTION_REQUIRED" | "UNIT_REQUIRED" | "UNIT_UNKNOWN"
  | "QUANTITY_INVALID" | "QUANTITY_NEGATIVE" | "QUANTITY_ROUNDED"
  | "PRICE_INVALID" | "AMOUNT_INVALID" | "AMOUNT_MISMATCH"
  | "PRICE_MISSING_AMOUNT_PRESENT" | "NUMBER_OUT_OF_RANGE"
  | "TAX_MODE_UNKNOWN" | "FORMULA_CELL";

/** Codes a human can clear with an explicit source-amount resolution. */
export const RESOLVABLE_CODES: readonly RowErrorCode[] =
  ["AMOUNT_MISMATCH", "PRICE_MISSING_AMOUNT_PRESENT"];

export type ChosenBasis = "unit_price_derived" | "approved_source_amount";

/**
 * A recorded source-amount resolution, carried forward across re-validation
 * attempts. It pins the exact amounts the human approved: if a later attempt
 * (new mapping, new parser, edited source) produces different numbers, the
 * approval no longer describes reality and must not silently unblock the row.
 */
export interface RowResolution {
  chosenBasis: ChosenBasis;
  approvedSourceMinor: bigint | null;
  approvedDerivedMinor: bigint | null;
}

export interface ContractPins {
  currency: string;
  taxMode: TaxMode;
  taxRateBps: number | null;
  midpoint: Midpoint;
  minorScale: number; // 2 for UAH
  tolAbsMinor: bigint;
  tolBps: number;
  /** Derived from taxMode via canonicalPriceBasis — never client-supplied. */
  priceBasis: PriceBasis | null;
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
  /** qty × price, stated in the contract's canonical price basis. */
  derivedMinor: bigint | null;
  /** Source "amount" column, stated in the same canonical basis. */
  sourceMinor: bigint | null;
  /** Which amount became this row's canonical value. */
  valuationBasis: ChosenBasis;
  net: bigint | null;
  tax: bigint | null;
  gross: bigint | null;
}

/**
 * Row validation (INV-054 core).
 *
 * `unit` is the resolved unit definition, or null when the code is not
 * registered in the workspace. `resolution` is the explicit source-amount
 * resolution covering this row, or null. A resolved row keeps its original
 * code as provenance but degrades from blocking to warning, and its canonical
 * value follows the basis the human chose.
 */
export function validateRow(
  row: MappedRow,
  unit: { normalizedCode: string; precision: number } | null,
  pins: ContractPins,
  recordedResolution: RowResolution | null,
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
    else if (!fitsNumeric18_6(q.value)) { codes.push("NUMBER_OUT_OF_RANGE"); blocking = true; }
    else if (unit) {
      const scaled = rescale(q.value, unit.precision, pins.midpoint);
      const pinned: Decimal = { scaled, scale: unit.precision };
      // Rescaling to unit precision CHANGES the contractual quantity — that is
      // provenance the reviewer must see, not a silent policy adjustment.
      if (rescale(pinned, q.value.scale, pins.midpoint) !== q.value.scaled) {
        codes.push("QUANTITY_ROUNDED"); warning = true;
      }
      quantity = pinned;
    } else {
      quantity = q.value;
    }
  }

  let unitPrice: Decimal | null = null;
  let unitPriceState: "known" | "zero" | "missing" = "missing";
  if (row.unitPriceText !== null && row.unitPriceText !== "") {
    const p = parseLocalizedDecimal(row.unitPriceText, pins.locale);
    if (!p.ok) { codes.push("PRICE_INVALID"); blocking = true; }
    else if (!fitsNumeric18_6(p.value)) { codes.push("NUMBER_OUT_OF_RANGE"); blocking = true; }
    else {
      unitPrice = p.value;
      unitPriceState = p.value.scaled === 0n ? "zero" : "known";
    }
  }

  // qty × price is already stated in the contract's canonical basis: an
  // inclusive-tax contract carries gross unit prices, an exclusive one net.
  let derivedMinor: bigint | null = null;
  if (quantity && unitPrice && unitPriceState === "known") {
    derivedMinor = mulToMinorUnits(quantity, unitPrice, pins.minorScale, pins.midpoint);
  } else if (unitPriceState === "zero" && quantity) {
    derivedMinor = 0n;
  }

  let sourceMinor: bigint | null = null;
  if (row.amountText !== null && row.amountText !== "") {
    const s = parseLocalizedDecimal(row.amountText, pins.locale);
    if (!s.ok) { codes.push("AMOUNT_INVALID"); blocking = true; }
    else if (!fitsNumeric18_6(s.value)) { codes.push("NUMBER_OUT_OF_RANGE"); blocking = true; }
    else sourceMinor = rescale(s.value, pins.minorScale, pins.midpoint);
  }

  // A resolution only counts when it still describes THESE numbers. A remap,
  // a parser change, or an edited source silently invalidates the approval.
  const resolution: RowResolution | null =
    recordedResolution !== null
      && recordedResolution.approvedSourceMinor === sourceMinor
      && recordedResolution.approvedDerivedMinor === derivedMinor
      ? recordedResolution : null;

  // INV-054: an unexplained material mismatch blocks publication.
  let needsResolution = false;
  if (sourceMinor !== null && derivedMinor !== null
    && !withinTolerance(sourceMinor, derivedMinor, pins.tolAbsMinor, pins.tolBps)) {
    codes.push("AMOUNT_MISMATCH");
    if (resolution) warning = true;
    else { blocking = true; needsResolution = true; }
  }

  // A lump-sum line (amount stated, no unit price) has no derived amount to
  // compare against. Valuing it silently would hide an unapproved source
  // amount, so it takes the same explicit-resolution path as a mismatch.
  if (sourceMinor !== null && derivedMinor === null) {
    codes.push("PRICE_MISSING_AMOUNT_PRESENT");
    if (resolution?.chosenBasis === "approved_source_amount") warning = true;
    else { blocking = true; needsResolution = true; }
  }

  if (row.formulaColumns.length > 0) { codes.push("FORMULA_CELL"); warning = true; }

  // Canonical value: the resolved basis when a human chose one, otherwise the
  // unit-price-derived amount.
  const valuationBasis: ChosenBasis =
    resolution?.chosenBasis === "approved_source_amount" ? "approved_source_amount" : "unit_price_derived";
  const canonicalMinor = valuationBasis === "approved_source_amount" ? sourceMinor : derivedMinor;

  let net: bigint | null = null;
  let tax: bigint | null = null;
  let gross: bigint | null = null;
  if (canonicalMinor !== null) {
    const split = splitByBasis(canonicalMinor, pins.priceBasis, pins.taxRateBps, pins.taxMode, pins.midpoint);
    net = split.net; tax = split.tax; gross = split.gross;
    if (split.warning) { codes.push("TAX_MODE_UNKNOWN"); warning = true; }
    const overflow = [net, tax, gross].some((v) => (v < 0n ? -v : v) > MAX_MINOR_UNITS);
    if (overflow) { codes.push("NUMBER_OUT_OF_RANGE"); blocking = true; }
  }
  // A missing price with no stated amount is legal — the item is simply
  // unpriced, and the value-at-risk projection reports it as such.
  if (unitPriceState === "missing" && sourceMinor === null && !blocking) warning = true;

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
    valuationBasis,
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
