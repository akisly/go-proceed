import { formatUah, formatUahCompact } from './MoneyCard'

/**
 * The focal element of `/app`, and the only thing on that screen allowed to be
 * 32px.
 *
 * Hierarchy is built from three levers at once rather than size alone: the
 * label steps down to 12px uppercase muted with tracking, the figure takes
 * `text-display` at 600 in full-contrast Carbon, and the denominator drops back
 * to muted body. Squinted at, only the figure survives — which is correct, since
 * "how much money is currently unevidenced" is the entire question this screen
 * answers.
 *
 * THE QUALIFIER IS NOT DECORATION. `src/domain/risk.ts` sets a wording rule for
 * every surface that consumes this number: it is money whose evidence is
 * currently missing, not money that will certainly go unpaid, and the phrasing
 * must stay conditional. /app/evidence already did this; /app showed a bare
 * total with no qualification at all, which is the one claim this product
 * cannot afford to leave ambiguous.
 *
 * Assistive tech always receives the exact figure via `aria-label` on the
 * wrapping element, whichever of the two visual forms CSS is showing — an
 * aria-label replaces the accessible name of the whole element, so it wins over
 * both children (doc 05 §5).
 */
export default function MoneySummary({
  heading,
  value,
  denominator,
  qualifier,
}: {
  heading: string
  value: number
  denominator: string
  qualifier: string
}) {
  return (
    <div className="flex flex-col gap-1">
      {/*
       * The eyebrow IS the section heading, not a label sitting under a
       * hidden one. Naming the panel with `aria-label` and then adding an
       * `sr-only` <h2> says the same thing twice to a screen reader, while a
       * visible <h2> above the eyebrow would say it twice on screen. One
       * element, doing both jobs.
       */}
      <h2 className="font-sans text-meta font-medium uppercase tracking-[0.06em] text-foreground-muted">
        {heading}
      </h2>
      <b aria-label={formatUah(value)} data-money className="text-display font-semibold leading-tight">
        {/* Below md the compact form keeps a seven-figure total on one line at
            arm's length; from md up there is room for full precision. Both are
            derived from the same value — neither is ever a fixture. */}
        <span className="md:hidden">{formatUahCompact(value)}</span>
        <span className="hidden md:inline">{formatUah(value)}</span>
      </b>
      <span className="text-foreground-muted">{denominator}</span>
      <p className="mt-2 max-w-[52ch] text-foreground-secondary">{qualifier}</p>
    </div>
  )
}
