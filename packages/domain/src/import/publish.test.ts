import { describe, it, expect } from "vitest";
import { matchLineage, computeDiff, decimalText } from "./publish";

describe("matchLineage", () => {
  const prev = [
    { id: "p1", sourceKey: "1.1", workCode: "Е8-3", description: "Мурування стін" },
    { id: "p2", sourceKey: null, workCode: "Е8-4", description: "Штукатурення фасаду" },
    { id: "p3", sourceKey: "1.3", workCode: null, description: "Утеплення" },
  ];

  it("sourceKey match wins over workCode", () => {
    const m = matchLineage(prev, [
      { position: 1, sourceKey: "1.1", workCode: "Е8-4", description: "Штукатурення фасаду" },
    ]);
    expect(m.get(1)).toBe("p1");
  });

  it("falls back to (workCode + normalized description)", () => {
    const m = matchLineage(prev, [
      { position: 1, sourceKey: "9.9", workCode: "Е8-4", description: "  штукатурення   фасаду " },
    ]);
    expect(m.get(1)).toBe("p2");
  });

  it("unmatched rows get no predecessor; predecessors are consumed once", () => {
    const m = matchLineage(prev, [
      { position: 1, sourceKey: "1.3", workCode: null, description: "Утеплення" },
      { position: 2, sourceKey: "1.3", workCode: null, description: "Утеплення" },
      { position: 3, sourceKey: null, workCode: null, description: "Нова робота" },
    ]);
    expect(m.get(1)).toBe("p3");
    expect(m.has(2)).toBe(false);
    expect(m.has(3)).toBe(false);
  });
});

describe("computeDiff", () => {
  it("counts added, removed, changed, unchanged", () => {
    const prevById = new Map([
      ["p1", { contractQuantity: "10.000", unitCode: "м2", unitPriceDecimal: "199.99", netMinor: "199990" }],
      ["p2", { contractQuantity: "5.500", unitCode: "м2", unitPriceDecimal: "150.00", netMinor: "82500" }],
      ["p3", { contractQuantity: "1.000", unitCode: "шт", unitPriceDecimal: "50.00", netMinor: "5000" }],
    ]);
    const d = computeDiff(prevById, [
      { predecessorId: "p1", fields: { contractQuantity: "12.000", unitCode: "м2", unitPriceDecimal: "199.99", netMinor: "239988" } }, // changed
      { predecessorId: "p2", fields: { contractQuantity: "5.500", unitCode: "м2", unitPriceDecimal: "150.00", netMinor: "82500" } },   // unchanged
      { predecessorId: null, fields: { contractQuantity: "2.000", unitCode: "т", unitPriceDecimal: "900.00", netMinor: "180000" } },   // added
    ]);
    expect(d).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 1 });
  });
});

describe("decimalText", () => {
  it("renders scaled/scale pairs canonically", () => {
    expect(decimalText("10556", 3)).toBe("10.556");
    expect(decimalText("10", 0)).toBe("10");
    expect(decimalText("5", 2)).toBe("0.05");
    expect(decimalText("-125", 1)).toBe("-12.5");
  });
});
