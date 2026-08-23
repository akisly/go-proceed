/**
 * The one tested helper for rendering a `blockedValue`/`blockedValueTotal`
 * minor-units figure — `docs/design/02-building-ui.md`'s own binding rule:
 * "Money is minor units of a named currency. Format it as such; do not divide
 * by 100 in three places — put it in one tested helper."
 *
 * WHY NOT `Number(minorUnits) / 100`. Three reasons, each load-bearing:
 *
 *  1. `netMinorUnits`/`grossMinorUnits` are wire DECIMAL STRINGS carrying a
 *     bigint (`packages/contracts/src/readiness.ts`'s `blockedValue`), so a
 *     bare `Number()` risks silent precision loss the moment a project's
 *     total exceeds 2^53 minor units — unlikely for this pilot, but the
 *     canonical arithmetic itself refuses binary float for money
 *     (`docs/architecture/data-model.md` §"Numeric and temporal
 *     representation": "binary floating point is forbidden") and a display
 *     helper that reintroduces it at the one place a human reads the number
 *     is exactly the seam that rule exists to close.
 *  2. `/ 100` ASSUMES two decimal digits for every currency. ISO 4217 does
 *     not agree: JPY has zero, BHD has three. This pilot is Ukrainian
 *     construction (UAH, and contracts may name others per
 *     `contracts.currency`), and nothing in `supabase/migrations/` carries a
 *     currency → exponent table (checked: no `create table public.currenc`,
 *     no `minor_unit`/`currency_exponent` column anywhere under
 *     `supabase/migrations/`). `Intl.NumberFormat`'s own currency-formatting
 *     path already carries the ISO 4217 exponent table for every code it
 *     recognises, via `resolvedOptions().maximumFractionDigits` — asking it
 *     is more correct than hard-coding 2 and needs no new data file.
 *  3. Every BigInt split below (integer part, fractional remainder) is EXACT
 *     — no float touches the digits. `Intl.NumberFormat`'s grouping is then
 *     applied to the BigInt integer part directly (`format()` accepts a
 *     bigint natively), which is exact for any magnitude a JS engine can
 *     hold. The only `Number()` conversion in this module is `0`, to read a
 *     currency's own symbol — never a magnitude.
 */

const LOCALE = "uk-UA";

/**
 * ISO 4217's minor-unit exponent for `currency`, read off `Intl` rather than
 * a hand-maintained table. Falls back to 2 (the majority case, and UAH's own)
 * for a code `Intl` does not recognise — money is not withheld from the
 * screen over a display fallback for an exotic or malformed code; INV-012's
 * "no cross-currency total" and the reconciliation `superRefine` in
 * `packages/contracts/src/blocked-value.ts` are the boundaries that actually
 * protect correctness, not this cosmetic exponent.
 */
function currencyExponent(currency: string): number {
  try {
    // TypeScript's own `Intl.ResolvedNumberFormatOptions` types this field
    // `number | undefined` generically (it is optional for the `decimal`/
    // `percent` styles), even though the `currency` style this call always
    // passes guarantees a number at runtime — the `?? 2` is a type-narrowing
    // fallback for a branch this function cannot actually reach, not a second
    // guess at the real exponent.
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency })
      .resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** The currency's own symbol/short form («₴», «$», «€», …), never the bare ISO code unless `Intl` has nothing better. */
function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat(LOCALE, { style: "currency", currency }).formatToParts(0);
    const sym = parts.find((p) => p.type === "currency");
    return sym ? sym.value : currency;
  } catch {
    return currency;
  }
}

/**
 * `minorUnits` (a decimal string carrying a bigint, e.g. `blockedValueTotal.
 * netMinorUnits`) + a 3-letter ISO currency code → «1 234,56 ₴».
 *
 * uk-UA GROUPING (space) AND DECIMAL COMMA, matching the parse side this
 * product already commits to (`@goproceed/domain`'s `parseLocalizedDecimal`,
 * `packages/domain/src/money.ts`: "uk-UA — groups are space/NBSP/…, decimal
 * is comma").
 */
export function formatMoney(minorUnits: string, currency: string): string {
  const exponent = currencyExponent(currency);
  const negative = minorUnits.startsWith("-");
  const digits = negative ? minorUnits.slice(1) : minorUnits;
  const value = BigInt(digits);
  const scale = 10n ** BigInt(exponent);
  const integerPart = value / scale;
  const fractionPart = value % scale;
  const grouped = new Intl.NumberFormat(LOCALE).format(integerPart);
  const fractionStr = exponent > 0 ? `,${fractionPart.toString().padStart(exponent, "0")}` : "";
  const symbol = currencySymbol(currency);
  return `${negative ? "-" : ""}${grouped}${fractionStr} ${symbol}`;
}
