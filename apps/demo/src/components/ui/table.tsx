import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * shadcn's Table, restyled — and the point of it here is structural, not visual.
 *
 * The register used to be fourteen independent CSS grids: `.work-table__head`
 * and `.work-row` each declared `display: grid`, so `1.4fr 1fr .7fr …` resolved
 * per row against that row's own content. A long location string pushed its
 * column wider than a short one, and the money column measured six different
 * right edges at 1440px. It looked like a table only while the content happened
 * to cooperate.
 *
 * A real `<table>` has shared column geometry as a property of the element, not
 * as something to maintain. `table-fixed` goes further and stops content
 * influencing width at all, so a long title truncates instead of stealing space
 * from the figure beside it.
 *
 * `min-w-[640px]` is a floor, not a scroll strategy. WorkRegister sheds its two
 * quantity columns below `wide`, so four columns fit the ~650px content width a
 * tablet actually has and nothing scrolls. The wrapper keeps `overflow-x-auto`
 * anyway, as the failure mode of last resort: if a future column pushes past
 * the floor, the table scrolls inside its own panel instead of widening the
 * page and pushing the whole layout sideways.
 */
function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="w-full overflow-x-auto">
      {/*
       * `text-data` (13px) is the one deliberate step down from the app's 15px
       * prose base. Fourteen rows of six columns is the only place in this
       * product where density beats comfort — and it is what lets a whole
       * reporting period fit in one 900px fold.
       */}
      <table data-slot="table" className={cn('w-full min-w-[640px] table-fixed text-data', className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        'border-b border-border bg-surface-muted text-meta font-semibold text-foreground-muted uppercase tracking-[0.04em]',
        className,
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={className} {...props} />
}

function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-border-strong transition-colors duration-150 ease-out-strong last:border-0 hover:bg-surface-muted/60',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: ComponentProps<'th'>) {
  // `truncate` is a safety net, not the plan: the widths are sized to the real
  // headers. It is here so that a future copy change degrades to an ellipsis
  // instead of two uppercase labels running together into one word.
  return (
    <th data-slot="table-head" className={cn('h-9 truncate px-3 text-left align-middle', className)} {...props} />
  )
}

function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td data-slot="table-cell" className={cn('px-3 py-2.5 align-middle', className)} {...props} />
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }
