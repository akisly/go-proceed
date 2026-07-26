import { ShieldAlert } from 'lucide-react'
import { formatDateUk } from '../domain/format'
import { isUnrecoverable, type WorkItem } from '../domain/readiness'
import { formatUah } from './MoneyCard'

/**
 * The internal app's rendering of the unrecoverable-evidence case. Separate from
 * `UnrecoverableNote` for the same reason `ReadinessBadge` is separate from
 * `StatusChip`: that one is also rendered by `/demo`, which is out of scope.
 * The predicate (`isUnrecoverable`) and both formatters are shared, so the two
 * can never disagree about the facts — only about how they look.
 *
 * WHY THE ALARM COLOUR IS NOT THE TEXT COLOUR. `--color-destructive` (#e45c55)
 * measures 3.40:1 on Paper and only 3.52:1 against pure white — there is no
 * background in the approved palette that pairs with it at 4.5:1. Making the
 * sentence red would be an AA failure, and quietly greying it out would drop the
 * one argument this whole demo exists to make. So red stays exactly where it is
 * already doing the signalling — the icon and the left rule, both unmistakable
 * at a glance — while the sentence reads in warning-foreground on
 * warning-surface at 5.43:1. That is the frozen design system's own pattern for
 * compliant alarm text, not an invention.
 *
 * The cost sentence is only rendered alongside a real positive
 * `recoveryCostUah`. Claiming «орієнтовна вартість 0,00 ₴» would understate the
 * argument, so a missing or non-positive cost drops the sentence rather than
 * asserting a false zero.
 *
 * The concealment date renders through `formatDateUk` (DD.MM.YYYY, the
 * product's user-facing convention) inside a `<time>` so the ISO value stays
 * available to assistive tech while the visible text never shows a raw machine
 * format.
 */
export default function UnrecoverableCallout({ item, today }: { item: WorkItem; today: string }) {
  if (!isUnrecoverable(item, today)) return null
  const { recoveryCostUah, concealedAt } = item
  // isUnrecoverable already guarantees this is non-null; the guard exists only
  // so TypeScript narrows it without a non-null assertion.
  if (concealedAt === null) return null
  return (
    <p
      role="note"
      className="flex items-start gap-2.5 rounded-control border-l-[3px] border-destructive bg-warning-surface px-3 py-2.5 text-warning-foreground"
    >
      <ShieldAlert size={16} aria-hidden="true" className="mt-0.5 text-destructive" />
      <span>
        {'Конструкцію закрито '}
        <time dateTime={concealedAt} className="font-semibold">
          {formatDateUk(concealedAt)}
        </time>
        {'. Доказ уже не відновити без розкриття.'}
        {recoveryCostUah !== null && recoveryCostUah > 0 ? (
          <>
            {' Орієнтовна вартість розкриття — '}
            <b data-money className="font-semibold">
              {formatUah(recoveryCostUah)}
            </b>
            .
          </>
        ) : null}
      </span>
    </p>
  )
}
