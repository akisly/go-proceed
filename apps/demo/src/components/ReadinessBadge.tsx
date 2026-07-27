import { AlertTriangle, Check, Clock3 } from 'lucide-react'
import { READINESS_LABEL_UK } from '../domain/labels'
import { readinessTone, type ReadinessState } from '../domain/readiness'
import { Badge } from './ui/badge'

/**
 * The internal app's status chip.
 *
 * Separate from `StatusChip` rather than a restyle of it: that component is
 * also rendered by `/demo`, which this rewrite is explicitly told not to
 * redesign. Both read the SAME two sources — `READINESS_LABEL_UK` (byte-identical
 * to technical/state-catalog.csv) and `readinessTone` — so the thing that must
 * never diverge cannot. Only the presentation is duplicated, and only until
 * /demo is migrated.
 *
 * Status never relies on colour alone: icon + label + tone, always (Evidence
 * Atlas README). The icon is `aria-hidden` because the label beside it already
 * carries the meaning — announcing both would just be noise.
 *
 * The label is rendered verbatim and may not be reworded per page (doc 05 §5).
 */
const TONE = { signal: 'ready', amber: 'attention', neutral: 'idle' } as const
const ICON = { signal: Check, amber: AlertTriangle, neutral: Clock3 } as const

export default function ReadinessBadge({ state }: { state: ReadinessState }) {
  const tone = readinessTone(state)
  const Icon = ICON[tone]
  return (
    <Badge tone={TONE[tone]} data-state={state}>
      <Icon aria-hidden="true" />
      {READINESS_LABEL_UK[state]}
    </Badge>
  )
}
