/**
 * Wireframes for capabilities that DO NOT EXIST.
 *
 * This is the single most claim-risky component in the codebase, so its visual
 * language is a safety mechanism rather than a style choice. Three rules, and
 * none of them is negotiable:
 *
 *  1. NO NUMBERS. Not one figure, amount, date, count or percentage anywhere in
 *     a sketch. Every number the real product shows is computed from
 *     src/data/project.ts; a number here could only ever be invented, which is
 *     exactly the failure task 11 deleted the old landing hero for. Quantities
 *     are drawn as bars whose widths carry no reading.
 *
 *  2. NO PRODUCT SURFACE. Sketches sit on `surface-muted` behind a DASHED
 *     border, never on White behind a solid one. Every real panel in this
 *     product is White with a solid border, so a reader who has seen /app reads
 *     the difference before reading the label. Placeholder content is drawn as
 *     `surface-sunken` bars — recognisably a sketch, not a screenshot.
 *
 *  3. NO INTERACTIVE AFFORDANCES. Nothing that looks pressable. The whole thing
 *     is `aria-hidden`, because a screen-reader user must not be handed a
 *     description of a control that does not exist — the prose beside it is the
 *     accessible content, and it is written in the conditional.
 *
 * Colour is used once per sketch, on the one element that carries the concept's
 * point, and only from the approved palette. Everything else is grey.
 */

import type { ReactNode } from 'react'

/** A placeholder text run. Width is composition, never data. */
function Bar({ w, tone = 'muted' }: { w: string; tone?: 'muted' | 'strong' }) {
  return (
    <span
      className={`block h-2 rounded-pill ${tone === 'strong' ? 'bg-foreground-subtle' : 'bg-surface-sunken'}`}
      style={{ width: w }}
    />
  )
}

function Row({ children }: { children: ReactNode }) {
  return <span className="flex items-center gap-3 border-b border-border-strong px-3 py-2.5 last:border-0">{children}</span>
}

/**
 * Зміни та додаткові роботи — a change is a row that did not exist in the
 * estimate. The point of the sketch is the LINK between an estimate line and
 * the change hanging off it, so that is the one thing drawn in colour.
 */
function ChangeOrders() {
  return (
    <div className="rounded-control border border-border-strong bg-surface">
      <span className="flex gap-6 border-b border-border-strong bg-surface-muted px-3 py-2 text-micro font-semibold uppercase tracking-[0.06em] text-foreground-subtle">
        <span className="flex-1">Кошторисний рядок</span>
        <span className="w-24">Зміна</span>
      </span>
      {[0, 1, 2].map(i => (
        <Row key={i}>
          <span className="flex flex-1 flex-col gap-1.5">
            <Bar w="70%" tone="strong" />
            <Bar w="45%" />
          </span>
          {i === 1 ? (
            <span className="flex w-24 items-center gap-1.5">
              <span aria-hidden className="h-px w-4 bg-warning" />
              <span className="rounded-pill bg-warning-surface px-2 py-0.5 text-micro font-semibold text-warning-foreground">
                +обсяг
              </span>
            </span>
          ) : (
            <span className="w-24" />
          )}
        </Row>
      ))}
    </div>
  )
}

/**
 * Зовнішній перегляд пакета — the package on the left, a decision per line on
 * the right. The point is that a return carries a REASON attached to a specific
 * line, not a reply to an email thread.
 */
function ExternalReview() {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3">
      <div className="rounded-control border border-border-strong bg-surface p-3">
        <span className="mb-2.5 block text-micro font-semibold uppercase tracking-[0.06em] text-foreground-subtle">
          Пакет
        </span>
        <span className="flex flex-col gap-2">
          <Bar w="88%" tone="strong" />
          <Bar w="64%" />
          <Bar w="76%" />
          <Bar w="52%" />
        </span>
      </div>
      <div className="flex w-28 flex-col gap-2 rounded-control border border-border-strong bg-surface p-3">
        <span className="block text-micro font-semibold uppercase tracking-[0.06em] text-foreground-subtle">
          Рішення
        </span>
        <span className="rounded-pill bg-readiness-ready-surface px-2 py-0.5 text-micro font-semibold text-readiness-ready-foreground">
          прийнято
        </span>
        <span className="rounded-pill bg-warning-surface px-2 py-0.5 text-micro font-semibold text-warning-foreground">
          з причиною
        </span>
        <Bar w="60%" />
      </div>
    </div>
  )
}

/**
 * Дебіторська заборгованість — a signed act is not money. The point is the
 * distance between "submitted" and "paid", so the sketch is a single aging
 * track with unlabelled buckets: the shape, never a figure.
 */
function Receivables() {
  return (
    <div className="rounded-control border border-border-strong bg-surface p-4">
      <span className="mb-3 block text-micro font-semibold uppercase tracking-[0.06em] text-foreground-subtle">
        Вік заборгованості
      </span>
      <span aria-hidden className="mb-3 flex h-2.5 gap-0.5 overflow-hidden rounded-pill">
        <span className="flex-[4] bg-readiness-ready-foreground" />
        <span className="flex-[2] bg-warning" />
        <span className="flex-[1] bg-destructive" />
      </span>
      <span className="flex justify-between text-micro text-foreground-subtle">
        <span>подано</span>
        <span>прострочено</span>
      </span>
      <span className="mt-4 flex flex-col gap-2 border-t border-border-strong pt-3">
        <Bar w="72%" />
        <Bar w="55%" />
      </span>
    </div>
  )
}

const SKETCHES = {
  changes: ChangeOrders,
  review: ExternalReview,
  receivables: Receivables,
} as const

export type ConceptKind = keyof typeof SKETCHES

export default function ConceptSketch({ kind }: { kind: ConceptKind }) {
  const Sketch = SKETCHES[kind]
  return (
    /*
     * aria-hidden by design: the paragraph beside this is the accessible
     * content, and it is written in the conditional. Describing a control that
     * does not exist to a screen-reader user would be the same over-claim as
     * shipping a fake screenshot, just less visible.
     */
    <div
      aria-hidden="true"
      className="relative rounded-panel border border-dashed border-border bg-surface-muted p-4 pt-7"
    >
      {/*
       * `border-border` (Slate at 17%), not `border-border-strong` (#e9ebe7):
       * measured against `surface-muted` the latter was very nearly invisible,
       * which quietly defeated the whole point — the dashed edge IS the signal
       * that this is a sketch rather than a screenshot. The corner label makes
       * it legible even cropped out of context, e.g. in a screenshot someone
       * pastes into a chat.
       */}
      <span className="absolute left-4 top-2 text-micro font-semibold uppercase tracking-[0.08em] text-foreground-subtle">
        Ескіз
      </span>
      <Sketch />
    </div>
  )
}
