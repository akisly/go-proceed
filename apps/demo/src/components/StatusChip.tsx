import { AlertTriangle, Check, Clock3 } from 'lucide-react'
import { READINESS_LABEL_UK } from '../domain/labels'
import { readinessTone, type ReadinessState } from '../domain/readiness'

const TONE_CLASS = { signal: 'status--ready', amber: 'status--risk', neutral: 'status--ink' } as const
const ICON = { signal: Check, amber: AlertTriangle, neutral: Clock3 } as const

/**
 * Renders the canonical ui_uk label and never a reworded one (doc 05 §5).
 * Status never relies on colour alone: icon + label + tone, always
 * (Evidence Atlas README).
 *
 * Uses the design system's real `.status` / `.status--*` classes
 * (apps/demo/src/styles.css:61-66, mirrored from the approved
 * prototype/src/components/Status.jsx) rather than an invented
 * `.status-chip` that has no matching rule anywhere in the stylesheet.
 * `size={13}` matches the prototype's chip icon size. `aria-hidden` stays
 * on the icon — the adjacent label already carries the meaning for
 * assistive tech, so the icon would otherwise be redundant noise.
 */
export default function StatusChip({ state }: { state: ReadinessState }) {
  const tone = readinessTone(state)
  const Icon = ICON[tone]
  return (
    <span className={`status ${TONE_CLASS[tone]}`} data-state={state}>
      <Icon size={13} aria-hidden="true" />
      <span>{READINESS_LABEL_UK[state]}</span>
    </span>
  )
}
