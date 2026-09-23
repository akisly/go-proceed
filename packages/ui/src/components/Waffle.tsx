import { cx } from "./cn";

/**
 * A count drawn as cells, one column per unit — the reference's «Pattern
 * Recognition» chart (Uxerflow, «Autumn – CRM Dashboard – Homepage», Dribbble
 * 27537255, read 2026-09-23; structure only). There, a column is a month and
 * its height a percentage; here a column is whatever the caller counts in —
 * a work stage, say — and every cell is one real thing, so the grid can be
 * read by counting, and a column is never scaled.
 *
 * COLOUR: filled cells are `viz-brand` (pine) and empty ones `viz-empty`
 * (owner, 2026-09-23, DEV-035: «Зелёный + акцент» — data in pine, ember only
 * for a highlighted cell; nothing here highlights yet, so there is no ember
 * in this file). The drawing is `aria-hidden`: the caller's `summary` is the
 * text a reader and a screen reader both get, and it has to carry the count.
 *
 * Wide sets scroll inside their own box rather than wrapping — a wrapped
 * column is two columns — so the page itself never scrolls sideways.
 */
export type WaffleColumn = { id: string; filled: number; total: number };

export function Waffle({
  columns, summary, className,
}: {
  columns: WaffleColumn[];
  summary: string;
  className?: string | undefined;
}) {
  return (
    <figure data-slot="waffle" className={cx("flex min-w-0 flex-col gap-3", className)}>
      <div aria-hidden="true" className="overflow-x-auto pb-1">
        <div className="flex w-max items-end gap-1">
          {columns.map((column) => (
            <div key={column.id} className="flex flex-col-reverse gap-1">
              {Array.from({ length: column.total }, (_, i) => (
                <span
                  key={i}
                  data-filled={i < column.filled ? "" : undefined}
                  className={i < column.filled ? "size-3 bg-viz-brand" : "size-3 bg-viz-empty"}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="text-meta text-ink-muted">{summary}</figcaption>
    </figure>
  );
}
