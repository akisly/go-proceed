import type { ReactNode } from "react";
import { cx } from "./cn";

/**
 * The one content surface: White on Paper, 1px border, no shadow.
 *
 * Everything that reads as "above the page" is chrome, and content stays flat.
 * There is no elevation ladder — structure comes from the border and from the
 * lightness step between `bg-canvas` and `bg-surface`. Do not add a shadow to
 * a panel; `elevation.float` is forbidden under `/app/**` entirely.
 */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-panel border border-line bg-surface", className)}>
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
