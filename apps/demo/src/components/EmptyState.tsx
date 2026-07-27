import type { ReactNode } from 'react'
import { SearchX } from 'lucide-react'

/**
 * Empty states are features, not apologies (task 14 controller RULING 5):
 * every one names the situation in Ukrainian and offers a way forward. A
 * bare «нічого не знайдено» is a spec violation (A.4.12) — every call site
 * of this component supplies a `hint` explaining *why* the view is empty
 * and/or an `action` offering what the visitor can do next.
 *
 * `hint`/`action` are typed `| undefined` rather than a bare optional
 * (`hint?: string`) because this project builds with
 * `exactOptionalPropertyTypes` (tsconfig.json) — that flag allows a caller
 * to omit the prop entirely but rejects `hint={possiblyUndefined}` as a
 * type error even though omitting it outright is fine. Both
 * `Work.tsx` (`action`, via `clearAction`) and `Evidence.tsx` (`hint`, via
 * `gapFilterHint`) have a real call site whose value is genuinely typed
 * `| undefined` (task 14 controller RULING 4).
 *
 * The mark is `aria-hidden` and defaulted rather than required. An empty
 * result is a moment where the reader is already half-asking "is this
 * broken?", and a quiet glyph saying "this is a filter result, not a
 * failure" answers that before the sentence does.
 */
export default function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string
  hint?: string | undefined
  action?: ReactNode | undefined
  icon?: ReactNode | undefined
}) {
  return (
    <div className="flex flex-col items-start gap-2 px-6 py-10">
      <span aria-hidden="true" className="mb-1 text-foreground-subtle">
        {icon ?? <SearchX size={24} />}
      </span>
      <b className="text-h3">{title}</b>
      {hint ? <p className="max-w-[56ch] text-foreground-secondary">{hint}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap items-center gap-3">{action}</div> : null}
    </div>
  )
}
