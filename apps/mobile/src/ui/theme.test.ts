import { describe, expect, it } from "vitest";
import { fonts, nativeLength, touchHeight, typeSize } from "./theme";
describe("native token adapter", () => {
  it("converts fixed tokens without silently accepting CSS", () => {
    expect(nativeLength("0.25rem")).toBe(4);
    expect(nativeLength("15px")).toBe(15);
    expect(() => nativeLength("clamp(16px, 1vw, 20px)")).toThrow();
  });
  it("uses Cyrillic font assets, readable text and Android-sized controls", () => {
    expect(fonts.regular).toMatch(/^Commissioner/);
    expect(typeSize.meta).toBeGreaterThanOrEqual(12);
    expect(touchHeight).toBeGreaterThanOrEqual(48);
  });
});
