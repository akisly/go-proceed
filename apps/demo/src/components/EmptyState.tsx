import type { ReactNode } from 'react'

/**
 * Empty states are features, not apologies (task 14 controller RULING 5):
 * every one names the situation in Ukrainian and offers a way forward. A
 * bare «нічого не знайдено» is a spec violation (A.4.12) — every call site
 * of this component supplies a `hint` explaining *why* the view is empty
 * and/or an `action` offering what the visitor can do next.
 *
 * `hint`/`action` are typed `| undefined` rather than left as a bare
 * optional (`hint?: string`) because this project builds with
 * `exactOptionalPropertyTypes` (tsconfig.json) — that flag allows a caller
 * to omit the prop entirely but rejects `hint={possiblyUndefined}` as a
 * type error even though omitting it outright is fine. Both
 * `Work.tsx` (`action`, via `clearAction`) and `Evidence.tsx` (`hint`, via
 * `gapFilterHint`) have a real call site whose value is genuinely typed
 * `| undefined` (task 14 controller RULING 4).
 */
export default function EmptyState({ title, hint, action }: {
  title: string
  hint?: string | undefined
  action?: ReactNode | undefined
}) {
  return (
    <div className="empty-state">
      <b>{title}</b>
      {hint ? <p>{hint}</p> : null}
      {action}
    </div>
  )
}
