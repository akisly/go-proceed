import type { ReactNode } from 'react'

/**
 * Every `/app` route opens the same way, and the whole design of this block is
 * "spend as little vertical space as possible".
 *
 * The measurement that drove it: before the rewrite, `/app/work` spent 357px of
 * a 900px fold on chrome before the first row — 40% of the screen, on a triage
 * surface, before any work appeared. A page header is not the product; the
 * register is. So the title, the project it belongs to, and the running figures
 * all sit on ONE row from md up, and the whole block costs ~64px.
 *
 * `stat` is the running readout — «14 з 14 позицій · 1 732 300,00 ₴». It sits
 * opposite the title rather than under it because it changes as you filter, and
 * a number that changes wants a fixed place to change in. It carries the
 * `aria-live` region, so the count is announced on every filter change without
 * anything else on the page being re-read.
 *
 * It is deliberately NOT an <h2>. It was one before, which made a running total
 * a document section heading — it appeared in the heading outline between the
 * page title and the real content sections, describing nothing.
 */
export default function PageHeader({
  title,
  meta,
  stat,
}: {
  title: string
  meta?: ReactNode
  stat?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-h1">{title}</h1>
        {meta ? <p className="mt-1 text-foreground-muted">{meta}</p> : null}
      </div>
      {stat ? (
        <p aria-live="polite" className="font-semibold text-foreground-secondary" data-numeric>
          {stat}
        </p>
      ) : null}
    </header>
  )
}
