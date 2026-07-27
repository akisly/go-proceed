import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The one content surface in the internal app: White on Paper, a 1px border, a
 * 10px radius, no shadow.
 *
 * doc 05 puts it plainly — borders carry most structure, shadows are shallow —
 * so a panel does not lift. Everything that needs to read as "above" the page
 * (the drawer, a tooltip) is chrome, and chrome is Carbon. Content stays flat.
 *
 * There is exactly one radius here and it is small on purpose. A register is
 * not a set of cards; rounding it like one makes fourteen rows of dense
 * financial data look like a marketing grid.
 */
/**
 * `as` exists for one real distinction, not for generality: a panel that frames
 * a region of the page is a `<section>`, while a panel that IS one self-contained
 * record — an evidence card, repeated down a list — is an `<article>`. Nesting a
 * `<section>` inside a `<section>` to hold a single work item says something
 * about document structure that is not true.
 */
function Panel({ as: Comp = 'section', className, ...props }: ComponentProps<'section'> & { as?: 'section' | 'article' }) {
  return (
    <Comp
      data-slot="panel"
      className={cn('overflow-hidden rounded-panel border border-border bg-surface', className)}
      {...props}
    />
  )
}

/**
 * A panel's own heading row. Padded to match the panel body, and it keeps the
 * heading and its count on one baseline so the count reads as belonging to the
 * heading rather than floating above the content.
 */
function PanelHeader({
  title,
  meta,
  children,
}: {
  title: ReactNode
  meta?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-h3">{title}</h2>
        {meta ? <span className="text-foreground-muted">{meta}</span> : null}
      </div>
      {children}
    </div>
  )
}

export { Panel, PanelHeader }
