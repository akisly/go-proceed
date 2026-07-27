import { PROJECT, TODAY } from '../data/project'
import { daysBetween, daysUk, formatDateUk } from '../domain/format'
import { formatUah } from './MoneyCard'
import { isUnrecoverable } from '../domain/readiness'
import type { WorkItem } from '../domain/types'

/**
 * THE SIGNATURE ELEMENT, and the one thing on the landing page that could not
 * belong to any other product.
 *
 * Every SaaS landing can show a dashboard. Only this one can show why the
 * dashboard exists: in electrical subcontracting the deadline on evidence is
 * PHYSICAL, not administrative. A cable tray is photographed before the ceiling
 * closes over it or it is not photographed at all, and no amount of process
 * recovers it afterwards — only demolition does, at a price.
 *
 * So the hero does not open with a product screenshot. It opens with a window
 * closing.
 *
 * EVERY NUMBER AND DATE HERE IS COMPUTED FROM src/data/project.ts. That matters
 * more than usual: task 11 removed the previous hero mockup precisely because it
 * carried invented figures («БЦ Horizon», «45 днів пілоту»). Nothing here is
 * authored — the dates are the shipped requirement's own `capturedAt`, the
 * item's own `concealedAt`, and `TODAY`; the gaps are subtracted, not written;
 * the amounts are the item's own `valueUah` and `recoveryCostUah`. Change the
 * dataset and this rewrites itself, which is the only form of product visual
 * this project is allowed to ship.
 *
 * What the shipped data happens to say is also the sharpest possible version of
 * the argument: the quantity was recorded on the 14th, the structure closed on
 * the 15th. The window was one day wide, and the photograph did not happen.
 */

/** The first row whose evidence is already unrecoverable, or null if none is. */
function findConcealedItem(): (WorkItem & { concealedAt: string }) | null {
  for (const item of PROJECT.workItems) {
    if (isUnrecoverable(item, TODAY) && item.concealedAt !== null) {
      return { ...item, concealedAt: item.concealedAt }
    }
  }
  return null
}

const ITEM = findConcealedItem()

/** The last evidence actually captured before the structure closed. */
function lastCaptureBefore(item: WorkItem, isoLimit: string): string | null {
  const dates = item.requirements
    .map(req => req.capturedAt)
    .filter((date): date is string => date !== null && date <= isoLimit)
    .sort()
  return dates[dates.length - 1] ?? null
}

function Node({
  date,
  label,
  tone,
}: {
  date: string
  label: string
  tone: 'done' | 'closed' | 'now'
}) {
  const dot =
    tone === 'closed'
      ? 'bg-destructive'
      : tone === 'done'
        ? 'bg-readiness-ready-foreground'
        : 'bg-foreground-subtle'
  return (
    <li className="group relative flex gap-3 pb-5 last:pb-0">
      {/* The rule is drawn by the node, not by a wrapper, so it always spans
          exactly the distance between two real events and cannot drift out of
          alignment when a label wraps to two lines. `group-last:` (not `last:`)
          because it must vanish on the last LIST ITEM — `last:` here would ask
          whether the rule is the last child of its own <li>, which it never is. */}
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-[5px] top-4 w-px bg-border-strong group-last:hidden"
      />
      <span aria-hidden="true" className={`relative mt-1.5 size-2.5 shrink-0 rounded-pill ${dot}`} />
      <span className="min-w-0">
        <time dateTime={date} className="block font-semibold text-foreground">
          {formatDateUk(date)}
        </time>
        <span className="block text-foreground-muted">{label}</span>
      </span>
    </li>
  )
}

export default function EvidenceWindow() {
  // The dataset is authored to always contain this case (src/data/project.ts,
  // and /demo throws at import time without it), but the landing must not be
  // the surface that crashes if that ever changes.
  if (ITEM === null) return null
  const capturedAt = lastCaptureBefore(ITEM, ITEM.concealedAt)
  const windowDays = capturedAt === null ? null : daysBetween(capturedAt, ITEM.concealedAt)
  const sinceClosed = daysBetween(ITEM.concealedAt, TODAY)

  return (
    <figure className="rounded-panel border border-border bg-surface p-5">
      <figcaption className="mb-4">
        <span className="block text-meta font-medium uppercase tracking-[0.06em] text-foreground-muted">
          Один рядок із демонстрації
        </span>
        <span className="mt-1 block font-semibold text-foreground">{ITEM.code}</span>
        <span className="block text-foreground-secondary">{ITEM.title}</span>
      </figcaption>

      <ol className="mb-4">
        {capturedAt !== null ? <Node date={capturedAt} label="Обсяг зафіксовано" tone="done" /> : null}
        <Node date={ITEM.concealedAt} label="Конструкцію закрито" tone="closed" />
        <Node date={TODAY} label="Сьогодні" tone="now" />
      </ol>

      {/*
       * The consequence, stated once, in the frozen sheet's own compliant
       * alarm treatment — dark warning text on a tinted surface, 5.43:1. The
       * destructive red stays on the rule and the dot, where it signals without
       * having to carry text it cannot carry at AA.
       */}
      <div className="rounded-control border-l-[3px] border-destructive bg-warning-surface px-3 py-2.5 text-warning-foreground">
        {windowDays !== null ? (
          <p>
            Вікно для доказу було <b className="font-semibold">{daysUk(windowDays)}</b>. Фото траси до закриття не
            зробили — і вже {daysUk(sinceClosed)} його не існує.
          </p>
        ) : (
          <p>Конструкцію закрито {daysUk(sinceClosed)} тому. Фото траси до закриття не існує.</p>
        )}
        <p className="mt-2">
          <b data-money className="font-semibold">
            {formatUah(ITEM.valueUah)}
          </b>{' '}
          за цим рядком нічим підтвердити.
          {ITEM.recoveryCostUah !== null && ITEM.recoveryCostUah > 0 ? (
            <>
              {' '}
              Розкриття конструкції — орієнтовно{' '}
              <b data-money className="font-semibold">
                {formatUah(ITEM.recoveryCostUah)}
              </b>
              .
            </>
          ) : null}
        </p>
      </div>
    </figure>
  )
}
