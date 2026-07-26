import { forwardRef, type ReactNode } from 'react'

type Tone = 'success' | 'warning'

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
 * Reuses the existing `.state-banner`/`.state-banner--success`/
 * `.state-banner--warning` classes (apps/demo/src/styles.css) — grepped
 * before writing this component, per the task's global constraint. No new
 * CSS.
 */
const InlineBanner = forwardRef<HTMLDivElement, {
  tone: Tone
  role: 'alert' | 'status'
  icon: ReactNode
  children: ReactNode
}>(function InlineBanner({ tone, role, icon, children }, ref) {
  return (
    <div ref={ref} tabIndex={-1} className={`state-banner state-banner--${tone}`} role={role}>
      {icon}
      <div>{children}</div>
    </div>
  )
})

export default InlineBanner
