/** Canonical readiness projection. Source: technical/state-catalog.csv, domain=readiness. */
export type ReadinessState =
  | 'not_started'
  | 'evidence_missing'
  | 'review_pending'
  | 'ready_internal'
  | 'overridden_ready'
  | 'packaged'
  | 'submitted'
// The catalog's two GA-gated states — external acceptance and external
// return — are deliberately absent from this union: showing them would
// over-claim (spec A.4.7). tests/claims.test.ts (task 11) guards against
// ever writing their raw identifiers anywhere under src, comments included,
// so this note deliberately avoids spelling them out verbatim.

export type EvidenceKind = 'photo' | 'file' | 'voice_note' | 'quantity' | 'typed_form'
export type RequirementStatus = 'pending' | 'satisfied'
export type Unit = 'м' | 'м²' | 'м³' | 'шт' | 'компл' | 'т'

export interface Requirement {
  readonly id: string
  readonly kind: EvidenceKind
  readonly label: string
  readonly status: RequirementStatus
  readonly capturedAt: string | null
  readonly blocksSubmission: boolean
}

export interface WorkItem {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly locationId: string
  readonly plannedQuantity: number
  readonly capturedQuantity: number
  readonly unit: Unit
  readonly valueUah: number
  readonly readiness: ReadinessState
  readonly concealmentHoldPoint: boolean
  /** ISO 8601 date the structure was closed, or null if still open. */
  readonly concealedAt: string | null
  /** Cost to reopen the structure; drives the Red annotation. */
  readonly recoveryCostUah: number | null
  readonly requirements: readonly Requirement[]
}
