import { describe, it, expect } from "vitest";
import { normalizeContractNo } from "./contract-number";

describe("normalizeContractNo (INV-022)", () => {
  it("trims, collapses whitespace, uppercases", () => {
    expect(normalizeContractNo("  д-2026/01 ")).toBe("Д-2026/01");
    expect(normalizeContractNo("д  -  2026\t/01")).toBe("Д - 2026 /01");
    expect(normalizeContractNo("Abc 12")).toBe("ABC 12");
  });
});
