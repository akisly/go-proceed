import { describe, it, expect } from "vitest";
import { applyMapping, normalizeUnitCode, type MappedRow, type ColumnMapping } from "./mapping";
import { validateRow, buildPreview, type ContractPins } from "./validate";
import { canonicalPriceBasis } from "../money";
import type { SourceRow } from "./csv";

const pins: ContractPins = {
  currency: "UAH", taxMode: "exclusive", taxRateBps: 2000,
  midpoint: "half_up", minorScale: 2, tolAbsMinor: 100n, tolBps: 10,
  priceBasis: canonicalPriceBasis("exclusive"), locale: "uk-UA",
};
const inclusivePins: ContractPins = {
  ...pins, taxMode: "inclusive", priceBasis: canonicalPriceBasis("inclusive"),
};
const unit = { normalizedCode: "м2", precision: 3 };

const row = (over: Partial<MappedRow>): MappedRow => ({
  sourceRowNo: 2, worksheet: "Кошторис", sourceKey: "1.1", workCode: null,
  description: "Мурування", section: null, unitText: "м2", quantityText: "10",
  unitPriceText: "199,99", amountText: null, locationName: null, externalRef: null,
  formulaColumns: [], ...over,
});

describe("validateRow — exclusive tax (canonical basis net)", () => {
  it("clean row: net 199990 tax 39998 gross 239988 (10 × 199,99 at 20%)", () => {
    const v = validateRow(row({}), unit, pins, null);
    expect(v.severity).toBe("ok");
    expect(v.derivedMinor).toBe(199990n);
    expect(v.net).toBe(199990n);
    expect(v.tax).toBe(39998n);
    expect(v.gross).toBe(239988n);
    expect(v.valuationBasis).toBe("unit_price_derived");
  });
});

describe("validateRow — inclusive tax (canonical basis gross)", () => {
  it("extracts tax from the price instead of adding it on top", () => {
    const v = validateRow(row({}), unit, inclusivePins, null);
    expect(v.severity).toBe("ok");
    // 10 × 199,99 = 1 999,90 GROSS → net 1 666,58 + tax 333,32 = 1 999,90
    expect(v.gross).toBe(199990n);
    expect(v.net).toBe(166658n);
    expect(v.tax).toBe(33332n);
  });

  it("gross always equals net + tax exactly (work_items CHECK holds)", () => {
    for (const qty of ["1", "3", "7,77", "12,345"]) {
      const v = validateRow(row({ quantityText: qty }), unit, inclusivePins, null);
      expect(v.net! + v.tax!).toBe(v.gross!);
    }
  });
});

describe("canonicalPriceBasis", () => {
  it("maps each tax mode per docs/domain/value-at-risk.md", () => {
    expect(canonicalPriceBasis("exclusive")).toBe("net");
    expect(canonicalPriceBasis("inclusive")).toBe("gross");
    expect(canonicalPriceBasis("exempt")).toBe("net");
    expect(canonicalPriceBasis("out_of_scope")).toBe("net");
    expect(canonicalPriceBasis("unknown")).toBeNull();
  });
});

describe("validateRow — INV-054 source amount", () => {
  it("mismatch beyond tolerance blocks and needs resolution", () => {
    const v = validateRow(row({ amountText: "2 100,00" }), unit, pins, null);
    expect(v.severity).toBe("blocking");
    expect(v.codes).toContain("AMOUNT_MISMATCH");
    expect(v.needsResolution).toBe(true);
    expect(v.sourceMinor).toBe(210000n);
  });

  it("resolved to approved_source_amount: warning, and the SOURCE amount becomes canonical", () => {
    const v = validateRow(row({ amountText: "2 100,00" }), unit, pins,
      { chosenBasis: "approved_source_amount", approvedSourceMinor: 210000n, approvedDerivedMinor: 199990n });
    expect(v.severity).toBe("warning");
    expect(v.codes).toContain("AMOUNT_MISMATCH");
    expect(v.needsResolution).toBe(false);
    expect(v.valuationBasis).toBe("approved_source_amount");
    expect(v.net).toBe(210000n); // not the derived 199990
    expect(v.gross).toBe(252000n);
  });

  it("resolved to unit_price_derived keeps the derived amount canonical", () => {
    const v = validateRow(row({ amountText: "2 100,00" }), unit, pins,
      { chosenBasis: "unit_price_derived", approvedSourceMinor: 210000n, approvedDerivedMinor: 199990n });
    expect(v.severity).toBe("warning");
    expect(v.valuationBasis).toBe("unit_price_derived");
    expect(v.net).toBe(199990n);
  });

  it("amount within both tolerances passes without resolution", () => {
    const v = validateRow(row({ amountText: "1 999,95" }), unit, pins, null);
    expect(v.severity).toBe("ok");
    expect(v.codes).not.toContain("AMOUNT_MISMATCH");
  });

  it("a resolution approved for DIFFERENT amounts does not unblock the row", () => {
    // Approved when the source read 2 000,00; the source now reads 2 100,00.
    const stale = validateRow(row({ amountText: "2 100,00" }), unit, pins,
      { chosenBasis: "approved_source_amount", approvedSourceMinor: 200000n, approvedDerivedMinor: 199990n });
    expect(stale.severity).toBe("blocking");
    expect(stale.needsResolution).toBe(true);
    expect(stale.valuationBasis).toBe("unit_price_derived");
  });

  it("a resolution approved when the DERIVED amount differed does not unblock either", () => {
    // Same source amount, but the price column was remapped since approval.
    const stale = validateRow(row({ amountText: "2 100,00" }), unit, pins,
      { chosenBasis: "approved_source_amount", approvedSourceMinor: 210000n, approvedDerivedMinor: 150000n });
    expect(stale.severity).toBe("blocking");
    expect(stale.needsResolution).toBe(true);
  });
});

describe("validateRow — lump-sum line (amount, no unit price)", () => {
  it("blocks with PRICE_MISSING_AMOUNT_PRESENT instead of publishing zero value", () => {
    const v = validateRow(row({ unitPriceText: null, amountText: "5 000,00" }), unit, pins, null);
    expect(v.severity).toBe("blocking");
    expect(v.codes).toContain("PRICE_MISSING_AMOUNT_PRESENT");
    expect(v.needsResolution).toBe(true);
    expect(v.net).toBeNull();
  });

  it("after approving the source amount it carries real value, not zero", () => {
    const v = validateRow(row({ unitPriceText: null, amountText: "5 000,00" }), unit, pins,
      { chosenBasis: "approved_source_amount", approvedSourceMinor: 500000n, approvedDerivedMinor: null });
    expect(v.severity).toBe("warning");
    expect(v.valuationBasis).toBe("approved_source_amount");
    expect(v.net).toBe(500000n);
    expect(v.gross).toBe(600000n);
  });
});

describe("validateRow — bounds and precision provenance", () => {
  it("rejects magnitudes that would overflow numeric(18,6)", () => {
    const v = validateRow(row({ unitPriceText: "1234567890123,00" }), unit, pins, null);
    expect(v.severity).toBe("blocking");
    expect(v.codes).toContain("NUMBER_OUT_OF_RANGE");
  });

  it("flags QUANTITY_ROUNDED when unit precision changes the stated quantity", () => {
    const v = validateRow(row({ quantityText: "10,5555" }), unit, pins, null);
    expect(v.codes).toContain("QUANTITY_ROUNDED");
    expect(v.severity).toBe("warning");
    expect(v.quantity).toEqual({ scaled: 10556n, scale: 3 });
  });

  it("does not flag rounding when the quantity already fits the precision", () => {
    const v = validateRow(row({ quantityText: "10,5" }), unit, pins, null);
    expect(v.codes).not.toContain("QUANTITY_ROUNDED");
  });
});

describe("validateRow — other row errors", () => {
  it("unregistered unit blocks with UNIT_UNKNOWN", () => {
    const v = validateRow(row({}), null, pins, null);
    expect(v.severity).toBe("blocking");
    expect(v.codes).toContain("UNIT_UNKNOWN");
  });

  it("garbage quantity blocks with QUANTITY_INVALID", () => {
    const v = validateRow(row({ quantityText: "аби що" }), unit, pins, null);
    expect(v.severity).toBe("blocking");
    expect(v.codes).toContain("QUANTITY_INVALID");
  });

  it("missing price with no stated amount is a warning, not an error", () => {
    const v = validateRow(row({ unitPriceText: null }), unit, pins, null);
    expect(v.severity).toBe("warning");
    expect(v.unitPriceState).toBe("missing");
    expect(v.derivedMinor).toBeNull();
  });

  it("formula cell in a mapped column warns with FORMULA_CELL", () => {
    const v = validateRow(row({ formulaColumns: ["amount"] }), unit, pins, null);
    expect(v.severity).toBe("warning");
    expect(v.codes).toContain("FORMULA_CELL");
  });

  it("unknown tax mode leaves the slice unvalued for tax and warns", () => {
    const v = validateRow(row({}), unit,
      { ...pins, taxMode: "unknown", taxRateBps: null, priceBasis: canonicalPriceBasis("unknown") }, null);
    expect(v.codes).toContain("TAX_MODE_UNKNOWN");
    expect(v.tax).toBe(0n);
    expect(v.net).toBe(v.gross);
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
    const ok = validateRow(row({}), unit, pins, null);
    const blocked = validateRow(row({ amountText: "2 100,00" }), unit, pins, null);
    const resolvedWarn = validateRow(row({ amountText: "2 100,00" }), unit, pins,
      { chosenBasis: "unit_price_derived", approvedSourceMinor: 210000n, approvedDerivedMinor: 199990n });
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
