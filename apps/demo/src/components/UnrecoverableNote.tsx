import { ShieldAlert } from 'lucide-react'
import { isUnrecoverable, type WorkItem } from '../domain/readiness'
import { formatUah } from './MoneyCard'

/**
 * The Red annotation sits ADJACENT to the canonical chip and never replaces it
 * (spec A.3.3, decision D3). The chip keeps saying «Бракує доказів» because
 * that is what the catalog models; what makes this case unrecoverable is a
 * fact about time and the hold point, not a different status.
 *
 * The cost sentence is only ever rendered alongside a real positive
 * recoveryCostUah. Claiming «орієнтовна вартість 0,00 ₴» would understate
 * the argument this note exists to make, so a missing or non-positive cost
 * quietly drops the sentence instead of asserting a false zero. The current
 * dataset always supplies a positive cost for unrecoverable items, so this
 * branch is expected to be unreachable in practice — it exists to stay
 * correct if that ever changes.
 */
export default function UnrecoverableNote({ item, today }: { item: WorkItem; today: string }) {
  if (!isUnrecoverable(item, today)) return null
  const { recoveryCostUah, concealedAt } = item
  return (
    <p className="unrecoverable-note" role="note">
      <ShieldAlert size={16} aria-hidden="true" />
      <span>
        Конструкцію закрито {concealedAt}. Доказ уже не відновити без розкриття.
        {recoveryCostUah !== null && recoveryCostUah > 0
          ? ` Орієнтовна вартість розкриття — ${formatUah(recoveryCostUah)}.`
          : null}
      </span>
    </p>
  )
}
