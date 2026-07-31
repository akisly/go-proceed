import { describe, it, expect } from "vitest";
import {
  parseLocalizedDecimal, rescale, mulToMinorUnits, taxSplit, netFromGross, withinTolerance,
} from "./money";

describe("parseLocalizedDecimal", () => {
  it("uk-UA space groups + comma decimal", () => {
    expect(parseLocalizedDecimal("1 234,56", "uk-UA")).toEqual({ ok: true, value: { scaled: 123456n, scale: 2 } });
    expect(parseLocalizedDecimal("1 234,5", "uk-UA")).toEqual({ ok: true, value: { scaled: 12345n, scale: 1 } });
    expect(parseLocalizedDecimal("10", "uk-UA")).toEqual({ ok: true, value: { scaled: 10n, scale: 0 } });
  });
  it("uk-UA accepts NBSP and narrow NBSP groups and a bare dot decimal", () => {
    expect(parseLocalizedDecimal("1 234,5", "uk-UA")).toEqual({ ok: true, value: { scaled: 12345n, scale: 1 } });
    expect(parseLocalizedDecimal("1234.56", "uk-UA")).toEqual({ ok: true, value: { scaled: 123456n, scale: 2 } });
  });
  it("en-US comma groups + dot decimal", () => {
    expect(parseLocalizedDecimal("1,234.56", "en-US")).toEqual({ ok: true, value: { scaled: 123456n, scale: 2 } });
  });
  it("rejects garbage, ambiguity, and overflow", () => {
    expect(parseLocalizedDecimal("12,34,56", "uk-UA").ok).toBe(false);
    expect(parseLocalizedDecimal("abc", "uk-UA").ok).toBe(false);
    expect(parseLocalizedDecimal("", "uk-UA").ok).toBe(false);
    expect(parseLocalizedDecimal("1234567890123456789", "uk-UA").ok).toBe(false);
    expect(parseLocalizedDecimal("1,1234567", "uk-UA").ok).toBe(false);
  });
});

describe("rescale (midpoint rules)", () => {
  it("half_up ties away from zero; half_even to even", () => {
    expect(rescale({ scaled: 125n, scale: 2 }, 1, "half_up")).toBe(13n);
    expect(rescale({ scaled: 125n, scale: 2 }, 1, "half_even")).toBe(12n);
    expect(rescale({ scaled: 135n, scale: 2 }, 1, "half_even")).toBe(14n);
    expect(rescale({ scaled: -125n, scale: 2 }, 1, "half_up")).toBe(-13n);
  });
  it("upscales exactly", () => {
    expect(rescale({ scaled: 5n, scale: 0 }, 2, "half_up")).toBe(500n);
  });
});

describe("mulToMinorUnits", () => {
  it("2.5 × 199.99 → 49998 minor units (499,98)", () => {
    expect(mulToMinorUnits({ scaled: 25n, scale: 1 }, { scaled: 19999n, scale: 2 }, 2, "half_up")).toBe(49998n);
  });
  it("10 × 199,99 → 199990", () => {
    expect(mulToMinorUnits({ scaled: 10n, scale: 0 }, { scaled: 19999n, scale: 2 }, 2, "half_up")).toBe(199990n);
  });
});

describe("taxSplit / netFromGross", () => {
  it("exclusive 20%: net 10000 → tax 2000 gross 12000", () => {
    expect(taxSplit(10000n, 2000, "exclusive", "half_up")).toEqual({ net: 10000n, tax: 2000n, gross: 12000n });
  });
  it("netFromGross inverse: gross 12000 at 20% → net 10000", () => {
    expect(netFromGross(12000n, 2000, "half_up")).toBe(10000n);
  });
  it("exempt/out_of_scope: zero tax, gross = net", () => {
    expect(taxSplit(500n, 2000, "exempt", "half_up")).toEqual({ net: 500n, tax: 0n, gross: 500n });
    expect(taxSplit(500n, null, "out_of_scope", "half_up")).toEqual({ net: 500n, tax: 0n, gross: 500n });
  });
  it("unknown mode: zero tax + warning", () => {
    expect(taxSplit(500n, null, "unknown", "half_up").warning).toBe("TAX_MODE_UNKNOWN");
  });
});

describe("withinTolerance (strict-OR, plan decision 8)", () => {
  it("inside both tolerances → true", () => {
    expect(withinTolerance(100000n, 100050n, 100n, 10)).toBe(true); // 50 abs ≤ 100, 5 bps ≤ 10
  });
  it("abs breach blocks even when relative is tiny", () => {
    expect(withinTolerance(10_000_000n, 10_000_200n, 100n, 100)).toBe(false); // 200 > 100 abs
  });
  it("relative breach blocks even when abs is inside", () => {
    expect(withinTolerance(1000n, 1050n, 100n, 10)).toBe(false); // 50 abs ok, ~476 bps > 10
  });
  it("exact match always passes", () => {
    expect(withinTolerance(0n, 0n, 0n, 0)).toBe(true);
  });
});
