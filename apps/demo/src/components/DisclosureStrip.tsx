/**
 * Surface 1 of the honesty contract (spec A.3.5, decision D1).
 * Carbon is doc 05's semantic colour for high-consequence chrome, so the
 * disclosure reads as designed rather than as a browser warning bar.
 * Non-dismissible, present on every route including deep links, and in the
 * accessibility tree (never aria-hidden).
 */
export default function DisclosureStrip() {
  return (
    <div className="disclosure-strip" role="note" data-testid="disclosure-strip">
      <strong>Демонстраційний прототип</strong>
      <span aria-hidden="true"> · </span>
      <span>синтетичні дані</span>
      <span aria-hidden="true"> · </span>
      <span>без клієнтів</span>
    </div>
  )
}
