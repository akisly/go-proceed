import type { ReadinessState, WorkItem } from './types'

export type { ReadinessState, Requirement, Unit, WorkItem } from './types'

/**
 * Concealment is NOT a domain state — technical/state-catalog.csv has 262 rows
 * and no such value. It is a DERIVED VIEW FACT. The status chip still renders
 * the canonical 'Бракує доказів'; this predicate only drives the adjacent Red
 * annotation (spec A.3.3, decision D3).
 */
export function isUnrecoverable(item: WorkItem, today: string): boolean {
  return (
    item.readiness === 'evidence_missing' &&
    item.concealmentHoldPoint &&
    item.concealedAt !== null &&
    item.concealedAt <= today
  )
}

/** Visual tone for a chip. Never the sole signal — always paired with icon + label. */
export function readinessTone(state: ReadinessState): 'signal' | 'amber' | 'neutral' {
  switch (state) {
    case 'ready_internal':
    case 'overridden_ready':
    case 'packaged':
    case 'submitted':
      return 'signal'
    case 'evidence_missing':
    case 'review_pending':
      return 'amber'
    case 'not_started':
      return 'neutral'
  }
}
