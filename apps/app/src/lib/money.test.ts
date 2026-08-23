import { describe, it, expect } from "vitest";
import { formatMoney } from "./money";

// uk-UA groups with U+00A0 (NBSP), confirmed with `node -e` against the
// running Intl implementation before writing these assertions — not assumed.
// Written as an explicit escape, never a literal space in source, so the
// assertion cannot be silently defeated by an editor normalising NBSP to a
// plain space.
const NBSP = "\u00A0";

describe("formatMoney", () => {
  it("formats UAH minor units (kopecks) at two decimal places with the ₴ symbol", () => {
    expect(formatMoney("123456", "UAH")).toBe(`1${NBSP}234,56 ₴`);
  });

  it("groups thousands with the uk-UA separator", () => {
    expect(formatMoney("123456789", "UAH")).toBe(`1${NBSP}234${NBSP}567,89 ₴`);
  });

  it("renders zero minor units as a real zero, not blank", () => {
    expect(formatMoney("0", "UAH")).toBe("0,00 ₴");
  });

  it("falls back to the ISO code when uk-UA has no shorter symbol for the currency", () => {
    expect(formatMoney("100", "USD")).toBe("1,00 USD");
  });

  it("respects a currency with zero minor-unit digits (JPY)", () => {
    // uk-UA's own Intl data names JPY's short form "¥", not the bare ISO
    // code — confirmed with `node -e` against the running implementation,
    // matching this module's own "never the bare ISO code unless Intl has
    // nothing better" rule.
    expect(formatMoney("1234", "JPY")).toBe(`1${NBSP}234 ¥`);
  });

  it("renders a negative amount with a leading minus, never inside the digits", () => {
    expect(formatMoney("-500", "UAH")).toBe("-5,00 ₴");
  });

  it("never divides by a hard-coded 100 — a one-digit-scale amount at 2dp exponent still zero-pads", () => {
    expect(formatMoney("5", "UAH")).toBe("0,05 ₴");
  });

  it("does not throw on a malformed minor-units string — fix round 1 finding D", () => {
    // The wire type is a bare z.string(), so the contract cannot promise
    // this shape; a Server Component render must not 500 over one bad row.
    expect(formatMoney("12.5", "UAH")).toBe("сума не відображається");
    expect(formatMoney("1e3", "UAH")).toBe("сума не відображається");
    expect(formatMoney("", "UAH")).toBe("сума не відображається");
    expect(formatMoney("abc", "UAH")).toBe("сума не відображається");
  });
});
