/**
 * The one tested helper for rendering a `blockedReason.unvaluedQuantity` /
 * `unvaluedRegisterRow.quantity` figure — fix round 1, finding IMPORTANT 2.
 *
 * WHAT WAS WRONG, MEASURED, NOT GUESSED. Both fields are produced by
 * `fromScaled6` (`apps/app/src/lib/valuation-writer.ts:16-19`), which emits
 * a FIXED six-fraction-digit, DOT-separated decimal string by construction
 * — `"10.000000"`, `"1.250000"` — because it exists to round-trip
 * `numeric(20,6)` exactly, not to be read by a person. Before this fix,
 * `blocked-reasons-list.tsx` and `unvalued-register.tsx` both rendered that
 * string verbatim: six meaningless trailing zeros, and a Latin decimal
 * point sitting next to `formatMoney`'s own Ukrainian comma
 * (`money.ts`) — «1.250000» beside «1 234,56 ₴» on the same screen.
 *
 * TRIMS TRAILING ZEROS AND SWITCHES TO THE UKRAINIAN COMMA — matching the
 * parse side this product already commits to (`@goproceed/domain`'s
 * `parseLocalizedDecimal`, same reasoning `money.ts`'s own header gives).
 * `"10.000000"` → `"10"`; `"1.250000"` → `"1,25"`.
 *
 * GUARDED, NOT TRUSTED — same reasoning `money.ts`'s guard carries: the wire
 * type behind both fields is a bare `z.string()`, and — ROUND 2 CORRECTION —
 * that is true of each on a DIFFERENT file, not one: `unvaluedRegisterRow.
 * quantity` is in `packages/contracts/src/blocked-value.ts`, while
 * `blockedReason.unvaluedQuantity` is in `packages/contracts/src/
 * readiness.ts` — a file the previous version of this comment never named,
 * having generalised from the one it happened to be looking at. Neither
 * schema promises the six-decimal-dot shape `fromScaled6` happens to
 * produce today. A malformed string renders a legible marker instead of
 * throwing inside a Server Component render.
 */
const LOCALE = "uk-UA";

export function formatQuantity(value: string): string {
  const negative = value.startsWith("-");
  const digits = negative ? value.slice(1) : value;
  const m = /^(\d+)(?:\.(\d+))?$/.exec(digits);
  if (!m) return "кількість не відображається";
  const intPart = m[1]!;
  const fracPart = (m[2] ?? "").replace(/0+$/, "");
  const groupedInt = new Intl.NumberFormat(LOCALE).format(BigInt(intPart));
  const result = fracPart.length > 0 ? `${groupedInt},${fracPart}` : groupedInt;
  return `${negative ? "-" : ""}${result}`;
}
