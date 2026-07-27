import { readinessTone, type ReadinessState } from '../domain/readiness'
import ReadinessBadge from './ReadinessBadge'

/**
 * How the period's rows are distributed across the readiness catalog.
 *
 * THE BAR IS THE POINT. Review 07 · B3 found this rendering three hard-coded
 * states summing to 9 beside a denominator reading «з 14 рядків» — five rows
 * unaccounted for, on a screen read by people who reconcile columns for a
 * living. Deriving it from the data fixed the arithmetic; the bar makes the
 * arithmetic *visible*, because a segmented bar that does not fill its track is
 * wrong in a way a column of numbers is not.
 *
 * The bar is `aria-hidden` and carries no information of its own. Every state
 * is named, in its canonical `ui_uk` label, in the legend beneath it — so this
 * never becomes colour-as-sole-signal. It is a supplement to a complete
 * labelled list, which is the only form in which a proportional bar is honest
 * here.
 *
 * Widths are `flex-grow` set to the count rather than a percentage, so the
 * segments always consume exactly the track: the parts cannot fail to equal the
 * whole even if a future dataset changes the counts.
 */
const TONE_FILL = {
  signal: 'bg-readiness-ready-foreground',
  amber: 'bg-readiness-attention-foreground',
  neutral: 'bg-readiness-idle-foreground',
} as const

export default function ReadinessSplit({
  distribution,
  total,
}: {
  distribution: readonly { state: ReadinessState; count: number }[]
  total: number
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-pill bg-surface-sunken">
        {distribution.map(({ state, count }) => (
          <span
            key={state}
            style={{ flexGrow: count }}
            className={`${TONE_FILL[readinessTone(state)]} first:rounded-l-pill last:rounded-r-pill`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {distribution.map(({ state, count }) => (
          <li key={state} className="flex items-center gap-1.5">
            <ReadinessBadge state={state} />
            <span data-readiness-count className="font-semibold tabular-nums">
              {count}
            </span>
          </li>
        ))}
      </ul>
      {/* «Усього рядків: N», not «N рядків» — the count-colon form is
          grammatical for any number in Ukrainian, so this cannot go wrong if
          the dataset changes. */}
      <p className="text-foreground-muted">Усього рядків: {total}</p>
    </div>
  )
}
