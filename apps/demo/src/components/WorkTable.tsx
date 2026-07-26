import { formatUah } from './MoneyCard'
import StatusChip from './StatusChip'
import type { WorkItem } from '../domain/types'

/**
 * Task 15: shared between the dashboard's "at risk" table (src/pages/App.tsx)
 * and the full register (src/pages/Work.tsx) — both rendered the identical
 * six-column `.work-table`/`.work-row` markup before this task, which would
 * otherwise have meant making the same <768px card-layout change twice with
 * two chances to drift apart.
 *
 * Column DOM order is unchanged from the original (title, location, planned,
 * captured, value, status) so it keeps lining up with `.work-table__head` at
 * >=768px, where the grid is unchanged; only the <768px card view visually
 * reorders it (CSS `order` in styles/demo.css leads each card with value and
 * status, per RULING 6's "each card leads with UAH and state"). Leaving DOM
 * order untouched and reordering only visually, only inside that one media
 * query, is deliberate: a `<div className="work-row">` is not interactive
 * (no focusable children reordered), so nothing about `order` here creates
 * the usual tab-order-vs-visual-order mismatch that pattern risks on
 * controls — and reading order for a screen-reader user stays the original,
 * already-sensible top-to-bottom sequence either way.
 *
 * `<b className="work-row__label">` visible field labels (Локація /
 * Заплановано / Зафіксовано) exist for the <768px card, where
 * `.work-table__head` is hidden — a value with no visible column header
 * needs its own label. They render at >=768px too (hidden there via CSS,
 * not omitted from the DOM) rather than being two different markups for two
 * breakpoints.
 */
export default function WorkTable({ items, emptyMessage }: { items: readonly WorkItem[]; emptyMessage?: string }) {
  return (
    <div className="work-table">
      <div className="work-table__head">
        <span>Робота</span>
        <span>Локація</span>
        <span>Заплановано</span>
        <span>Зафіксовано</span>
        <span>Вартість</span>
        <span>Статус</span>
      </div>
      {items.map(item => (
        <div className="work-row" key={item.id}>
          <span className="work-row__title">
            <small>{item.code}</small>
            <b>{item.title}</b>
          </span>
          <span className="work-row__location">
            <b className="work-row__label">Локація</b>
            {item.locationId}
          </span>
          <span className="work-row__planned">
            <b className="work-row__label">Заплановано</b>
            <span>
              {item.plannedQuantity} {item.unit}
            </span>
          </span>
          <span className="work-row__captured">
            <b className="work-row__label">Зафіксовано</b>
            <span>
              {item.capturedQuantity} {item.unit}
            </span>
          </span>
          <span className="work-row__value">{formatUah(item.valueUah)}</span>
          <span className="work-row__status">
            <StatusChip state={item.readiness} />
          </span>
        </div>
      ))}
      {items.length === 0 && emptyMessage !== undefined ? <p>{emptyMessage}</p> : null}
    </div>
  )
}
