"use client";

import { useCallback, type PointerEvent, type ReactNode } from "react";
import { Tilt } from "../motion/Tilt";
import { cx } from "./cn";

/**
 * 21st.dev's «Grid Feature Cards»: one bordered container, cells separated by
 * a 1px gap that shows the container's line colour, and a dot-pattern
 * spotlight that follows the pointer inside a cell. The spotlight is a
 * pointer-driven CSS variable and an opacity transition — no Motion, no
 * transform, and it costs nothing when the pointer is elsewhere.
 *
 * The columns prop is a closed set so each value is a literal class: Tailwind
 * scans source text and a template literal emits no CSS.
 *
 * [2026-09-06] Each cell leans toward the pointer through `Tilt` (rotateX
 * ±2.5°, rotateY ±3°, the prototype's `[data-spot]` tilt, index.html l.1159);
 * the grid supplies the perspective (`.cards3{perspective:1600px}`). The
 * cell's `bg-surface` stays on the article; the `Tilt` wrapper is transparent,
 * so the 1px gaps still show the container's line.
 */
const COLUMNS = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 wide:grid-cols-3",
  4: "md:grid-cols-2 wide:grid-cols-4",
} as const;

export function FeatureGrid({
  children, columns = 4, className,
}: {
  children: ReactNode;
  columns?: keyof typeof COLUMNS | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cx("grid gap-px overflow-hidden rounded-surface border border-line-strong bg-line-strong [perspective:1600px]", COLUMNS[columns], className)}>
      {children}
    </div>
  );
}

export function FeatureCell({
  icon, title, subtitle, children, footer, className,
}: {
  icon?: ReactNode | undefined;
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  className?: string | undefined;
}) {
  const onMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--gp-spot-x", `${((event.clientX - r.left) / r.width) * 100}%`);
    event.currentTarget.style.setProperty("--gp-spot-y", `${((event.clientY - r.top) / r.height) * 100}%`);
  }, []);
  return (
    <Tilt maxX={2.5} maxY={3} className="grid">
      <article
        data-slot="feature-cell"
        onPointerMove={onMove}
        className={cx("group relative isolate grid content-start gap-3.5 bg-surface px-6 py-6", className)}
      >
        <i aria-hidden="true" data-spotlight="true" className="spotlight -z-10 opacity-0 transition-opacity duration-slow ease-out group-hover:opacity-100" />
        {icon && (
          <span className="grid size-(--gp-control-height-touch) place-items-center rounded-panel border border-line-strong bg-surface text-ink [&_svg]:size-4.5">
            {icon}
          </span>
        )}
        <h3 className="grid gap-0.5 text-body font-semibold tracking-tight text-ink">
          {title}
          {subtitle && <span className="text-meta font-normal text-ink-muted">{subtitle}</span>}
        </h3>
        <div className="text-data leading-relaxed text-ink-secondary">{children}</div>
        {footer && <div className="mt-1 grid gap-1.5 border-t border-line pt-3 text-data text-ink-secondary">{footer}</div>}
      </article>
    </Tilt>
  );
}
