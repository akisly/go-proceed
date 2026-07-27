import type { ComponentProps, ElementType, ReactNode } from 'react'

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
 * `as` exists for real distinctions in what the panel MEANS, not for
 * generality. A panel that frames a region of the page is a `<section>`; a
 * panel that IS one self-contained record — an evidence card, repeated down a
 * list — is an `<article>`; and a panel that is only the visual surface for
 * content whose sectioning element and heading already exist around it is a
 * `<div>`. Nesting a `<section>` inside a `<section>` to hold a single work
 * item says something about document structure that is not true.
 *
 * The `div` case is /pilot's four field groups: each is already a `<section>`
 * with its own `<h2>` and lead, and the panel inside is just the surface the
 * inputs sit on. Rendering that as a second `<section>` put an untitled region
 * in the document outline inside every titled one — caught by
 * `auditPilotForm` in qa/verify.mjs, which is why that guard checks the
 * outline rather than the pixels.
 */
function Panel({ as = 'section', className, ...props }: ComponentProps<'section'> & { as?: 'section' | 'article' | 'div' }) {
  /*
   * `section` and `article` both carry a plain `HTMLElement` ref while `div`
   * carries `HTMLDivElement`, so the union has no single assignable ref type
   * and TS rejects the spread. The public prop type stays `ComponentProps<
   * 'section'>` — the widest of the three, so callers are still checked
   * against real HTML attributes — and only the internal element reference is
   * widened. Nothing in this file reads the ref.
   */
  const Comp = as as ElementType
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
