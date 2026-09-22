import { Check } from "lucide-react";
import { demoRecords } from "../../content/demo-records";

/**
 * The small floating widgets of the reference's cards (DEV-026), drawn from the
 * same demonstration records the large UI windows use — no string is written
 * here. Each is a picture of a product moment, labelled for assistive
 * technology by the card's caption, so the widgets themselves are `aria-hidden`.
 *
 * [DEV-027] They answer a hover, as the reference's do: a row takes a faint
 * ground under the pointer; and when the pointer is anywhere on the card
 * (`group/scene`, set by the card) the sheet lifts and what lies under it
 * parts — the reference's stacked cards rise and brighten the same way. Hover
 * only: `hover:` compiles under `@media (hover: hover)`, so a thumb gets the
 * calm card; the transitions are transform and colour, ease-out, token
 * durations.
 *
 * EVERY MOVEMENT IS `motion-safe:` (B-02). The unlayered reduced-motion block
 * in `base.css` narrows `transition-property` to opacity; it does not undo a
 * `translate` that `:hover` sets, so without the prefix a reader who asked for
 * no motion would see the sheet jump 6px at once. Under reduced motion a hover
 * changes a ground or a border and moves nothing.
 *
 * WHY NOT `Lift` (B-07). `Lift` answers its OWN hover, by 3px in ~200ms, and
 * says why. Here the pointer is on the card and the thing that moves is the
 * widget inside it, which a parent's hover can drive only from CSS
 * (`group/scene`); and it is a picture parting its sheets, not a control
 * acknowledging a pointer, so it travels 6px over `duration-slow`.
 */
const LIFT = "transition-transform duration-slow ease-out motion-safe:group-hover/scene:-translate-y-1.5";
const ROW = "transition-colors duration-fast ease-out hover:bg-subtle";
const SHEET = "rounded-surface border border-line-strong bg-surface shadow-float";

/** The records of one work as a menu, fading toward its foot — the intro's card. */
export function MiniMenu() {
  const rows = demoRecords.route.act.rows;
  return (
    <div aria-hidden="true" className={`${SHEET} landing-fade-foot w-[240px] p-3 text-data`}>
      {rows.map((row, i) => (
        <p key={row.label} className={i === 0 ? `grid gap-0.5 rounded-control px-2 py-2 ${ROW}` : `grid gap-0.5 border-t border-line px-2 py-2 ${ROW}`}>
          <span className="text-meta text-ink-muted">{row.label}</span>
          <b className="truncate font-medium text-ink">{row.value}</b>
        </p>
      ))}
    </div>
  );
}

/** The foreman's moment: the time, the requirement, the frame to take. */
export function MiniCapture() {
  const p = demoRecords.route.capture.phone;
  return (
    <div aria-hidden="true" className="flex items-center gap-4">
      <div className={`${SHEET} ${LIFT} w-[230px] p-4`}>
        <p className="font-mono text-meta text-ink-muted">{demoRecords.route.capture.tag}</p>
        <p className="mt-1 text-data font-semibold text-ink">{p.requirement}</p>
        <p className="mt-1.5 text-data leading-relaxed text-ink-secondary">{p.shot}</p>
      </div>
      <span className="grid gap-1.5 transition-transform duration-slow ease-out motion-safe:group-hover/scene:translate-x-2">
        <i className="block h-0.5 w-8 rounded-pill bg-line-strong" /><i className="block h-0.5 w-12 rounded-pill bg-ink-muted" /><i className="block h-0.5 w-10 rounded-pill bg-line-strong" />
      </span>
    </div>
  );
}

/** The supervisor's moment: one decision on top of the sheets it answers. */
export function MiniReview() {
  const r = demoRecords.route.review;
  return (
    <div aria-hidden="true" className={`${SHEET} w-[280px] p-2.5`}>
      <div className="relative">
        <div className="relative z-20 rounded-panel border border-line bg-subtle px-3.5 py-2.5 transition-transform duration-slow ease-out motion-safe:group-hover/scene:-translate-y-1">
          <p className="text-data font-medium text-ink">{r.decision}</p>
          <p className="mt-0.5 text-meta text-ink-muted">{r.rows[1]?.value}</p>
        </div>
        <i className="relative z-10 mx-2 -mt-1 block h-3 rounded-b-panel border border-t-0 border-line bg-subtle transition-transform duration-slow ease-out motion-safe:group-hover/scene:translate-y-0.5" />
        <i className="mx-4 -mt-px block h-2.5 rounded-b-panel border border-t-0 border-line bg-subtle transition-transform duration-slow ease-out motion-safe:group-hover/scene:translate-y-1.5" />
      </div>
      <p className="mt-2.5 flex items-center gap-2 px-1 text-data text-ink-secondary">
        <span className="grid size-5 place-items-center rounded-pill bg-action text-micro font-semibold text-action-fg">1</span>{r.tag}
      </p>
    </div>
  );
}

/** The office's moment: the act's five facts, each already recorded. */
export function MiniAct() {
  const a = demoRecords.route.act;
  return (
    <div aria-hidden="true" className="grid w-[220px] gap-1.5">
      <div className={`${SHEET} p-1.5`}>
        {a.rows.map((row) => (
          <p key={row.label} className={`flex items-center justify-between gap-3 rounded-control px-2.5 py-1.5 text-data text-ink ${ROW}`}>
            {row.label}<Check className="size-3.5 text-ink-muted" strokeWidth={2} />
          </p>
        ))}
      </div>
      <p className={`${SHEET} ${LIFT} flex items-center justify-between px-3.5 py-2.5 text-data font-medium text-ink`}>
        {a.tag}<span className="rounded-control border border-status-attention-line px-1.5 py-0.5 font-mono text-micro tracking-wide text-status-attention-fg">{a.stamp}</span>
      </p>
    </div>
  );
}
