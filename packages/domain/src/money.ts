/**
 * Canonical money/quantity arithmetic in BigInt. Binary floating point is
 * forbidden for money (docs/architecture/data-model.md "Numeric and temporal
 * representation"); every value is an integer `scaled` at a decimal `scale`.
 */

export interface Decimal { scaled: bigint; scale: number } // value = scaled / 10^scale
export type TaxMode = "exclusive" | "inclusive" | "exempt" | "out_of_scope" | "unknown";
export type Midpoint = "half_up" | "half_even";

function pow10(n: number): bigint {
  let r = 1n;
  for (let i = 0; i < n; i++) r *= 10n;
  return r;
}

const MAX_INT_DIGITS = 18;
const MAX_FRAC_DIGITS = 6;

/**
 * Locale-pinned decimal text parsing. Never interprets ambiguous input:
 * uk-UA — groups are space/NBSP/narrow-NBSP/apostrophe, decimal is comma
 * (a bare dot is accepted when no comma is present — mixed real files);
 * en-US — groups are commas, decimal is dot.
 */
export function parseLocalizedDecimal(
  text: string, locale: "uk-UA" | "en-US",
): { ok: true; value: Decimal } | { ok: false; code: "NUMBER_INVALID" } {
  const fail = { ok: false as const, code: "NUMBER_INVALID" as const };
  let t = text.trim();
  if (t === "") return fail;
  if (locale === "uk-UA") {
    t = t.replace(/[   ' ]/g, "");
    const commas = (t.match(/,/g) ?? []).length;
    if (commas > 1) return fail;
    if (commas === 1) {
      if (t.includes(".")) return fail; // mixed separators are ambiguous
      t = t.replace(",", ".");
    }
  } else {
    t = t.replace(/,/g, "");
  }
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(t);
  if (!m) return fail;
  const sign = m[1] ?? "";
  const intPart = m[2] ?? "";
  const fracPart = m[3] ?? "";
  if (intPart === "" || intPart.length > MAX_INT_DIGITS || fracPart.length > MAX_FRAC_DIGITS) return fail;
  const scaled = BigInt(sign + intPart + fracPart);
  return { ok: true, value: { scaled, scale: fracPart.length } };
}

/** Round `v` to `targetScale` under the pinned midpoint rule (sign-symmetric). */
export function rescale(v: Decimal, targetScale: number, midpoint: Midpoint): bigint {
  if (v.scale <= targetScale) return v.scaled * pow10(targetScale - v.scale);
  return divRound(v.scaled, pow10(v.scale - targetScale), midpoint);
}

function divRound(num: bigint, den: bigint, midpoint: Midpoint): bigint {
  const q = num / den;
  const r = num % den;
  if (r === 0n) return q;
  const sign = (num < 0n) !== (den < 0n) ? -1n : 1n;
  const abs2r = 2n * (r < 0n ? -r : r);
  const absDen = den < 0n ? -den : den;
  if (abs2r > absDen) return q + sign;
  if (abs2r < absDen) return q;
  if (midpoint === "half_up") return q + sign;
  return q % 2n === 0n ? q : q + sign; // half_even
}

/** quantity × unit price → minor units at the currency scale. */
export function mulToMinorUnits(
  qty: Decimal, price: Decimal, minorScale: number, midpoint: Midpoint,
): bigint {
  return rescale({ scaled: qty.scaled * price.scaled, scale: qty.scale + price.scale }, minorScale, midpoint);
}

/**
 * Tax decomposition from a NET-basis minor amount (callers convert a gross
 * basis first via netFromGross). Rules per docs/domain/value-at-risk.md.
 */
export function taxSplit(
  netMinor: bigint, taxRateBps: number | null, taxMode: TaxMode, midpoint: Midpoint,
): { net: bigint; tax: bigint; gross: bigint; warning?: "TAX_MODE_UNKNOWN" } {
  if (taxMode === "exempt" || taxMode === "out_of_scope") {
    return { net: netMinor, tax: 0n, gross: netMinor };
  }
  if (taxMode === "unknown" || taxRateBps == null) {
    return { net: netMinor, tax: 0n, gross: netMinor, warning: "TAX_MODE_UNKNOWN" };
  }
  const tax = divRound(netMinor * BigInt(taxRateBps), 10000n, midpoint);
  return { net: netMinor, tax, gross: netMinor + tax };
}

/** net = round(gross × 10000 / (10000 + rate)) — inverse of the exclusive split. */
export function netFromGross(grossMinor: bigint, taxRateBps: number, midpoint: Midpoint): bigint {
  return divRound(grossMinor * 10000n, 10000n + BigInt(taxRateBps), midpoint);
}

/**
 * INV-054 core, strict-OR (plan decision 8): a mismatch is INSIDE tolerance
 * only when it passes BOTH the absolute minor-unit bound AND the relative
 * basis-point bound; being outside either requires explicit resolution.
 */
export function withinTolerance(
  sourceMinor: bigint, derivedMinor: bigint, tolAbsMinor: bigint, tolBps: number,
): boolean {
  const d = sourceMinor - derivedMinor;
  const ad = d < 0n ? -d : d;
  if (ad > tolAbsMinor) return false;
  const as = sourceMinor < 0n ? -sourceMinor : sourceMinor;
  const ar = derivedMinor < 0n ? -derivedMinor : derivedMinor;
  const base = (as > ar ? as : ar) || 1n;
  return ad * 10000n <= BigInt(tolBps) * base;
}
