import type { ReactNode } from 'react'
import { formatUah } from './MoneyCard'
import ReadinessBadge from './ReadinessBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { MEDIA_NARROW, useMediaQuery } from '@/lib/use-media-query'
import type { WorkItem } from '../domain/types'

/**
 * The register, in the two forms it actually has.
 *
 * WHY TWO RENDERINGS AND NOT ONE WITH CSS
 * ----------------------------------------
 * The usual trick — one `<table>`, then `display: block` on its rows below a
 * breakpoint — silently strips the table roles from the accessibility tree,
 * because changing `display` on table elements removes their implicit ARIA
 * roles. You then have to hand `role="table"/"row"/"cell"` back, and you are
 * maintaining an invisible second copy of the semantics.
 *
 * More importantly, the phone view is not a reflow of the table. It is a
 * different hierarchy: RULING 6 requires each card to LEAD with the amount and
 * the state, because that is the pair a site engineer needs at arm's length,
 * while the desktop table leads with identity because that is what you scan
 * down a column. Two hierarchies, honestly expressed as two renderings, from
 * one component and one item list.
 *
 * COLUMN GEOMETRY
 * ---------------
 * `table-fixed` (see ui/table.tsx) plus the percentage widths below. This is the
 * fix for the fourteen-independent-grids defect: every row now resolves to
 * identical column widths regardless of its own content, so the money column has
 * exactly one right edge. Do not reintroduce a per-row grid.
 *
 * The three numeric columns are right-aligned. That is what makes a shortfall
 * scannable — 620/620 and 180/150 differ in shape when their digits share a
 * right edge, and require reading when they do not.
 */
/**
 * Widths measured against the real longest content at 1440px, not guessed:
 * «Секція А · підвал · електрощитова ВРУ-1» is the longest location and needs
 * ~22%, «Внутрішньо готово» is the longest status chip and needs ~16%, and the
 * quantities are never wider than «620 м». The title column absorbs the
 * remainder and truncates, because it is the one field where the first few
 * words already identify the row.
 */
/**
 * SIX COLUMNS AT `wide`, FOUR AT TABLET, CARDS ON A PHONE — the same three
 * states the shell itself has.
 *
 * Measured: at 900px the content column is 784px, the six-column table needs
 * ~860px, and the overflow put the STATUS column off screen. Scrolling to reach
 * the answer to "is this row blocked?" is not a register; it is a spreadsheet
 * someone forgot to finish. So the two quantity columns — the least load-bearing
 * pair for triage — drop out below `wide`, and the four that carry identity,
 * money and state get the space. The quantities are still one breakpoint or one
 * card away, never lost.
 *
 * `max-wide:` widths exist because `table-fixed` rescales only what is visible:
 * with two columns hidden the remaining 28/21/15/16 would resolve to a 20%
 * status column, ~130px, and «Внутрішньо готово» needs ~148px. The four visible
 * percentages therefore sum to 100 on their own.
 *
 * Widths are measured against the real longest content: «Секція А · підвал ·
 * електрощитова ВРУ-1» for location, «Внутрішньо готово» for status, «620 м»
 * for the quantities. 10% (not 9%) on the quantity columns because at 9% the
 * two uppercase headers ran together into «ЗАПЛАНОВАНОЗАФІКСОВАНО» — the
 * binding constraint there is the header, not the figure under it.
 */
const COLUMNS = [
  { key: 'work', label: 'Робота', width: 'w-[28%] max-wide:w-[30%]', align: 'text-left', tabletOnly: true },
  { key: 'location', label: 'Локація', width: 'w-[21%] max-wide:w-[24%]', align: 'text-left', tabletOnly: true },
  { key: 'planned', label: 'Заплановано', width: 'w-[10%]', align: 'text-right', tabletOnly: false },
  { key: 'captured', label: 'Зафіксовано', width: 'w-[10%]', align: 'text-right', tabletOnly: false },
  { key: 'value', label: 'Вартість', width: 'w-[15%] max-wide:w-[20%]', align: 'text-right', tabletOnly: true },
  { key: 'status', label: 'Статус', width: 'w-[16%] max-wide:w-[26%]', align: 'text-left', tabletOnly: true },
] as const

/** Applied to both the <th> and its <td>s so a column can never half-disappear. */
const WIDE_ONLY = 'hidden wide:table-cell'

function WorkTableView({ items }: { items: readonly WorkItem[] }) {
  return (
    <Table data-work-table>
      <TableHeader>
        <tr>
          {COLUMNS.map(column => (
            <TableHead
              key={column.key}
              className={`${column.width} ${column.align} ${column.tabletOnly ? '' : WIDE_ONLY}`}
            >
              {column.label}
            </TableHead>
          ))}
        </tr>
      </TableHeader>
      <TableBody>
        {items.map(item => (
          <TableRow key={item.id} data-work-row>
            <TableCell>
              {/* Code above title, not beside it. The code is how a row is
                  referenced in a conversation; the title is how it is
                  recognised. Stacking them lets the title truncate without
                  ever taking the code with it. */}
              <span className="block text-meta text-foreground-muted">{item.code}</span>
              <span className="block truncate font-semibold text-foreground" title={item.title}>
                {item.title}
              </span>
            </TableCell>
            <TableCell className="truncate text-foreground-secondary" title={item.locationId}>
              {item.locationId}
            </TableCell>
            <TableCell className={`${WIDE_ONLY} text-right text-foreground-secondary`}>
              {item.plannedQuantity} {item.unit}
            </TableCell>
            <TableCell className={`${WIDE_ONLY} text-right text-foreground-secondary`}>
              {item.capturedQuantity} {item.unit}
            </TableCell>
            <TableCell className="text-right font-semibold text-foreground" data-money>
              {formatUah(item.valueUah)}
            </TableCell>
            <TableCell>
              <ReadinessBadge state={item.readiness} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** One labelled field on a card. The label is needed here precisely because the
 *  column header that would otherwise carry it does not exist at this width. */
function CardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-meta text-foreground-muted">{label}</span>
      <span className="text-right text-foreground-secondary">{children}</span>
    </div>
  )
}

function WorkCardView({ items }: { items: readonly WorkItem[] }) {
  return (
    <ul className="flex flex-col gap-2 p-3">
      {items.map(item => (
        <li
          key={item.id}
          data-work-row
          className="rounded-panel border border-border bg-surface p-4"
        >
          {/* Leads with the amount and the state (RULING 6). Before the
              rewrite this pair was laid out with CSS `order` inside a grid
              built for a desktop row, and the amount rendered clipped behind
              the status chip at 390px. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <b data-money className="text-h2 font-semibold leading-none">
              {formatUah(item.valueUah)}
            </b>
            <ReadinessBadge state={item.readiness} />
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <span className="block text-meta text-foreground-muted">{item.code}</span>
            <span className="block font-semibold text-foreground">{item.title}</span>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <CardField label="Локація">{item.locationId}</CardField>
            <CardField label="Заплановано">
              {item.plannedQuantity} {item.unit}
            </CardField>
            <CardField label="Зафіксовано">
              {item.capturedQuantity} {item.unit}
            </CardField>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function WorkRegister({ items }: { items: readonly WorkItem[] }) {
  const isNarrow = useMediaQuery(MEDIA_NARROW)
  return (
    <div data-work-register>{isNarrow ? <WorkCardView items={items} /> : <WorkTableView items={items} />}</div>
  )
}
