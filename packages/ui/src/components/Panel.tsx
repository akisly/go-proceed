import type { ReactNode } from "react";
import { cx } from "./cn";

/**
 * The one content surface: White on Paper, 1px border, and — since DEV-035 —
 * `shadow-raised`, see below. [Until 2026-09-23 this read «no shadow … Do not
 * add a shadow to a panel».]
 *
 * Everything that reads as "above the page" is chrome, and content stays
 * nearly flat. There is no elevation ladder — structure comes from the border
 * and from the lightness step between `bg-canvas` and `bg-surface`;
 * `elevation.float` is still forbidden under `/app/**` entirely.
 *
 * [2026-09-23, DEV-035, owner: «Как в Autumn» for the dashboard's cards.] A
 * panel now sits on `shadow-raised` — one pixel of seat under its hairline,
 * the reference's card and no more. Every caller of `Panel` is in the office
 * dashboard (the landing renders it only in the kitchen sink), which is why the
 * default moved instead of a prop being added. The border still draws the edge.
 */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-panel border border-line bg-surface shadow-raised", className)}>
      {children}
    </section>
  );
}

/**
 * Title and an optional count on one baseline. The count is a `<span>`, not a
 * chip: it is a fact about the panel's contents, not a state.
 */
export function PanelHeader({
  title, count, actions, className,
}: {
  title: string;
  count?: number | undefined;
  actions?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <header className={cx("flex items-baseline gap-3 border-b border-line px-4 py-3", className)}>
      <h2 className="text-h3 font-semibold text-ink">{title}</h2>
      {count !== undefined && (
        <span className="tabular text-meta text-ink-muted">{count}</span>
      )}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("px-4 py-4", className)}>{children}</div>;
}
