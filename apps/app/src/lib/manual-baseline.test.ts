import { describe, expect, it } from "vitest";
import { validateRow, type ContractPins } from "@goproceed/domain";
import { deriveLine, type LineInput, type VersionPins } from "./manual-baseline";

/**
 * ADR-006 decision 2: a hand-typed line is indistinguishable in provenance from
 * an imported one (DEV-088, BL-022). The imported line's price basis is what
 * import_batches.publish writes — `mp.unitPrice ? priceBasis : null`, where
 * `mp.unitPrice` is validateRow's parsed price — so a zero price, which parses,
 * carries the basis and only a missing price carries none.
 */
const PINS: VersionPins = {
  currency: "UAH", taxMode: "exclusive", taxRateBps: 2000, midpoint: "half_up",
  minorScale: 2, tolAbsMinor: 100n, tolBps: 50, priceBasis: "net",
};
const IMPORT_PINS: ContractPins = { ...PINS, locale: "uk-UA" };
const UNIT = { id: "unit-m2", code: "м2", precision: 3 };

function typed(state: LineInput["unitPriceState"], price: string | null): LineInput {
  return {
    description: "Мурування", unitCode: "м2", contractQuantity: "10", unitPriceState: state,
    unitPrice: price, sourceAmountMinor: null, sourceKey: null, workCode: null, section: null,
    externalRef: null, predecessorWorkItemId: null,
  };
}

function importedBasis(unitPriceText: string | null) {
  const v = validateRow({
    sourceRowNo: 2, worksheet: null, sourceKey: null, workCode: null, description: "Мурування",
    section: null, unitText: "м2", quantityText: "10", unitPriceText, amountText: null,
    locationName: null, externalRef: null, formulaColumns: [],
  }, { normalizedCode: "м2", precision: 3 }, IMPORT_PINS, null);
  return { state: v.unitPriceState, basis: v.unitPrice ? IMPORT_PINS.priceBasis : null };
}

describe("a typed line states the price basis an imported one does (DEV-088, BL-022)", () => {
  it.each([
    ["zero", null, "0,00"],
    ["known", "199.99", "199,99"],
    ["missing", null, null],
  ] as const)("%s price", (state, typedPrice, importedText) => {
    const imported = importedBasis(importedText);
    expect(imported.state).toBe(state);
    expect(deriveLine("req", typed(state, typedPrice), UNIT, PINS).priceBasis)
      .toBe(imported.basis);
  });

  it("a zero price states the version's basis, not none", () => {
    expect(deriveLine("req", typed("zero", null), UNIT, PINS).priceBasis).toBe("net");
    const inclusive: VersionPins = { ...PINS, taxMode: "inclusive", priceBasis: "gross" };
    expect(deriveLine("req", typed("zero", null), UNIT, inclusive).priceBasis).toBe("gross");
  });
});
