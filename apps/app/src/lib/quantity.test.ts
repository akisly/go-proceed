import { describe, it, expect } from "vitest";
import { formatQuantity } from "./quantity";

// uk-UA groups with U+00A0 (NBSP), the same fact `money.test.ts` pins
// against the running Intl implementation — written as an explicit
// escape so an editor cannot silently normalise it to a plain space.
const NBSP = "\u00A0";

describe("formatQuantity", () => {
  it("trims fromScaled6's fixed six trailing zero digits", () => {
    expect(formatQuantity("10.000000")).toBe("10");
    expect(formatQuantity("0.000000")).toBe("0");
  });

  it("trims only the trailing zeros, keeping significant fraction digits, comma-separated", () => {
    expect(formatQuantity("1.250000")).toBe("1,25");
    expect(formatQuantity("185.500000")).toBe("185,5");
  });

  it("groups the integer part with the uk-UA thousands separator", () => {
    expect(formatQuantity("12345.000000")).toBe(`12${NBSP}345`);
  });

  it("renders a negative quantity with a leading minus", () => {
    expect(formatQuantity("-5.500000")).toBe("-5,5");
  });

  it("handles a value with no fraction part at all", () => {
    expect(formatQuantity("42")).toBe("42");
  });

  it("does not throw on a malformed string — matches formatMoney's guard", () => {
    expect(formatQuantity("abc")).toBe("кількість не відображається");
    expect(formatQuantity("1e3")).toBe("кількість не відображається");
    expect(formatQuantity("")).toBe("кількість не відображається");
  });
});
