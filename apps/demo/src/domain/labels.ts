import type { ReadinessState } from './types'

/**
 * Canonical ui_uk labels, byte-identical to technical/state-catalog.csv.
 * doc 05 §5: these may not be reworded per page. This object is the single
 * source of truth for every status string rendered anywhere in apps/demo.
 */
export const READINESS_LABEL_UK: Readonly<Record<ReadinessState, string>> = {
  not_started: 'Не розпочато',
  evidence_missing: 'Бракує доказів',
  review_pending: 'Очікує перевірки',
  ready_internal: 'Внутрішньо готово',
  overridden_ready: 'Готово з винятком',
  packaged: 'У пакеті',
  submitted: 'Подано',
} as const
