import { cx } from "./cn";

export type MeterSegment = { id: string; label: string; count: number; tone: keyof typeof TONE };

const TONE = {
  ready: "bg-status-ready-fg",
  attention: "bg-status-attention-fg",
  blocked: "bg-status-blocked-fg",
  review: "bg-status-review-fg",
  idle: "bg-status-idle-fg",
} as const;

/**
 * A proportional bar over a fully labelled legend.
 *
 * TWO DECISIONS THAT LOOK LIKE DETAILS AND ARE NOT:
 *
 * 1. **Segments use `flex-grow: count`, never a percentage.** With percentages
 *    the parts can fail to equal the whole — rounding, a stale total, a
 *    filtered subset — and the bar quietly lies about a number the reader is
 *    about to act on. With flex-grow the segments always consume exactly the
 *    track, because the track is what they are dividing.
 *
 * 2. **The bar is `aria-hidden` and carries no information of its own.** Every
 *    state is named in the legend below it, so this is never colour as the sole
 *    signal. Remove the bar and nothing is lost but the glance; remove the
 *    legend and the component becomes unreadable to a third of the people who
 *    will read it on a phone in sunlight.
 */
export function Meter({
  segments, className,
}: {
  segments: MeterSegment[];
  className?: string | undefined;
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  return (
    <div data-slot="meter" className={cx("flex flex-col gap-3", className)}>
      <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-pill">
        {segments.filter((s) => s.count > 0).map((s) => (
          <div key={s.id} style={{ flexGrow: s.count }} className={TONE[s.tone]} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {segments.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-meta">
            <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-pill", TONE[s.tone])} />
            <span className="text-ink-secondary">{s.label}</span>
            <span className="tabular text-ink-muted">
              {s.count}
              {total > 0 && <span className="sr-only"> з {total}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
