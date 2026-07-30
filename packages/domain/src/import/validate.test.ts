import { describe, it, expect } from "vitest";
import { applyMapping, normalizeUnitCode, type MappedRow, type ColumnMapping } from "./mapping";
import { validateRow, buildPreview, type ContractPins } from "./validate";
import type { SourceRow } from "./csv";

const pins: ContractPins = {
  currency: "UAH", taxMode: "exclusive", taxRateBps: 2000,
  midpoint: "half_up", minorScale: 2, tolAbsMinor: 100n, tolBps: 10,
  priceBasis: "net", locale: "uk-UA",
};
const unit = { normalizedCode: "м2", precision: 3 };

const row = (over: Partial<MappedRow>): MappedRow => ({
  sourceRowNo: 2, worksheet: "Кошторис", sourceKey: "1.1", workCode: null,
  description: "Мурування", section: null, unitText: "м2", quantityText: "10",
  unitPriceText: "199,99", amountText: null, locationName: null, externalRef: null,
  formulaColumns: [], ...over,
});

describe("validateRow", () => {
  it("clean row: ok, net 199990 tax 39998 gross 239988 (10 × 199,99 at 20%)", () => {
    const v = validateRow(row({}), unit, pins, false);
    expect(v.severity).toBe("ok");
    expect(v.derivedMinor).toBe(199990n);
    expect(v.net).toBe(199990n);
    expect(v.tax).toBe(39998n);
    expect(v.gross).toBe(239988n);
    expect(v.unitPriceState).toBe("known");
  });

  it("INV-054: source 2 100,00 vs derived 1 999,90 → blocking AMOUNT_MISMATCH needsResolution", () => {
    const v = validateRow(row({ amountText: "2 100,00" }), unit, pins, false);
    expect(v.severity).toBe("blocking");
    expect(v.codes).toContain("AMOUNT_MISMATCH");
    expect(v.needsResolution).toBe(true);
    expect(v.sourceMinor).toBe(210000n);
  });

  it("INV-054: same row with resolved=true degrades to warning and keeps the code", () => {
    const v = validateRow(row({ amountText: "2 100,00" }), unit, pins, true);
    expect(v.severity).toBe("warning");
    expect(v.codes).toContain("AMOUNT_MISMATCH");
    expect(v.needsResolution).toBe(false);
  });

  it("amount within both tolerances passes without resolution", () => {
    const v = validateRow(row({ amountText: "1 999,95" }), unit, pins, false); // diff 5 ≤ 100 abs, ~0,25 bps
    expect(v.severity).toBe("ok");
    expect(v.codes).not.toContain("AMOUNT_MISMATCH");
  });

  it("unregistered unit blocks with UNIT_UNKNOWN", () => {
    const v = validateRow(row({}), null, pins, false);
    expect(v.severity).toBe("blocking");
    expect(v.codes).toContain("UNIT_UNKNOWN");
  });

  it("garbage quantity blocks with QUANTITY_INVALID", () => {
    const v = validateRow(row({ quantityText: "аби що" }), unit, pins, false);
    expect(v.severity).toBe("blocking");
    expect(v.codes).toContain("QUANTITY_INVALID");
  });

  it("missing price is a warning, not an error (unit_price_state missing)", () => {
    const v = validateRow(row({ unitPriceText: null }), unit, pins, false);
    expect(v.severity).toBe("warning");
    expect(v.unitPriceState).toBe("missing");
    expect(v.derivedMinor).toBeNull();
  });

  it("formula cell in a mapped column warns with FORMULA_CELL", () => {
    const v = validateRow(row({ formulaColumns: ["amount"] }), unit, pins, false);
    expect(v.severity).toBe("warning");
    expect(v.codes).toContain("FORMULA_CELL");
  });

  it("quantity pins to unit precision", () => {
    const v = validateRow(row({ quantityText: "10,55555" }), unit, pins, false);
    expect(v.quantity).toEqual({ scaled: 10556n, scale: 3 }); // 10,556 at precision 3
  });
});

describe("applyMapping", () => {
  const src = (rowNo: number, cells: Record<string, string>): SourceRow => ({
    worksheet: null, rowNo,
    cells: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, { raw: v }])),
  });
  const mapping: ColumnMapping = { description: "A", unit: "B", quantity: "C", unitPrice: "D" };

  it("skips header rows and fully empty rows", () => {
    const { mapped, skippedEmpty } = applyMapping([
      src(1, { A: "Назва", B: "Од", C: "К-сть", D: "Ціна" }),
      src(2, { A: "Мурування", B: "м2", C: "10", D: "199,99" }),
      src(3, {}),
    ], mapping, { locale: "uk-UA", headerRow: 1 });
    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.description).toBe("Мурування");
    expect(mapped[0]?.sourceRowNo).toBe(2);
    expect(skippedEmpty).toBe(1);
  });
});

describe("buildPreview", () => {
  it("sums non-blocking rows only and counts categories", () => {
    const ok = validateRow(row({}), unit, pins, false);
    const blocked = validateRow(row({ amountText: "2 100,00" }), unit, pins, false);
    const resolvedWarn = validateRow(row({ amountText: "2 100,00" }), unit, pins, true);
    const p = buildPreview([ok, blocked, resolvedWarn]);
    expect(p.rowCount).toBe(3);
    expect(p.blockingCount).toBe(1);
    expect(p.needsResolutionCount).toBe(1);
    expect(p.warningCount).toBe(1);
    expect(p.totals.netMinor).toBe((199990n * 2n).toString());
  });
});

describe("normalizeUnitCode", () => {
  it("mirrors the DB generated column: lower + strip all whitespace", () => {
    expect(normalizeUnitCode("М 2")).toBe("м2");
    expect(normalizeUnitCode("  м2 ")).toBe("м2");
  });
});
