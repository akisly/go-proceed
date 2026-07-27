import { forwardRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Tone = 'success' | 'warning'

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-success-surface text-success-foreground',
  warning: 'bg-warning-surface text-warning-foreground',
}

/**
 * A persistent inline banner — never a toast. It stays mounted for as long
 * as the caller's state says the situation is unresolved; nothing in this
 * component auto-dismisses it or clears anything on the caller's behalf
 * (task 14 controller RULING 5, carried over from task 13's /pilot banners).
 *
 * `ref` is forwarded to the root `<div>` so a caller can move keyboard and
 * screen-reader focus onto the banner the instant it appears — see
 * `src/pages/Pilot.tsx`, which focuses this element on every transition
 * into `error`/`mailto` phase. `tabIndex={-1}` makes that div
 * programmatically focusable without adding it to the normal tab order.
 *
 * ── OFF `.state-banner`, AND WHY THAT WAS OVERDUE ────────────────────────────
 *
 * This used to reuse the frozen sheet's `.state-banner` classes. Those carry
 * `b { font-size: 10px }` and `span { font-size: 8px }` (src/styles.css), and
 * unlike nearly every other public-route selector they were never added to
 * task 15's >=16px type floor — because the floor was applied by walking the
 * pages as rendered, and both banners here are unreachable until the visitor
 * has already submitted the form. So /pilot's «Лист із вашими відповідями
 * готовий» body text has been shipping at 8px: the smallest type in the app,
 * on the screen that tells someone what just happened to ten minutes of their
 * answers. Nothing sets a size now, so the text inherits the page's, which is
 * the floor by construction rather than by remembering.
 *
 * `items-start`, not `items-center`: the mailto banner is several lines of
 * prose plus three buttons, and centring pushed its icon to the vertical
 * middle of the whole block, away from the title it belongs to.
 */
const InlineBanner = forwardRef<HTMLDivElement, {
  tone: Tone
  role: 'alert' | 'status'
  icon: ReactNode
  children: ReactNode
}>(function InlineBanner({ tone, role, icon, children }, ref) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={role}
      className={cn('flex items-start gap-3 rounded-panel px-4 py-3', TONE_CLASS[tone])}
    >
      {icon}
      <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
    </div>
  )
})

export default InlineBanner
