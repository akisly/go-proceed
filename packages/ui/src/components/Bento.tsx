import type { ReactNode } from "react";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { Tilt } from "../motion/Tilt";
import { cx } from "./cn";

/**
 * 21st.dev's «Bento Grid», reduced to the one arrangement the product uses: a
 * wide cell that spans two rows beside two stacked cells. Cells are surfaces
 * with a strong line and the marketing radius; there is no shadow — structure
 * is the border.
 */
export function Bento({
  children, className, stagger,
}: {
  children: ReactNode;
  className?: string | undefined;
  /**
   * Staggers the cells in on scroll. The grid container itself becomes the
   * `Stagger` (rather than nesting one with `display:contents` inside it):
   * `whileInView`'s `IntersectionObserver` never fires on a boxless element,
   * so a `contents` wrapper would leave the cells permanently at their
   * hidden opacity (confirmed against the live page, 2026-09-06) — the
   * container's own box is real, so the observer fires normally, and its
   * children slot in as ordinary grid items. Off by default so every
   * non-landing caller is unchanged.
   */
  stagger?: boolean | undefined;
}) {
  const grid = cx("grid gap-3.5 [perspective:2000px] md:grid-cols-[1.25fr_1fr]", className);
  return stagger ? <Stagger step="loose" className={grid}>{children}</Stagger> : <div className={grid}>{children}</div>;
}

const SPAN = { "rows-2": "md:row-span-2" } as const;

export function BentoCell({
  eyebrow, title, span, children, className, stagger,
}: {
  eyebrow?: string | undefined;
  title?: string | undefined;
  span?: keyof typeof SPAN | undefined;
  children: ReactNode;
  className?: string | undefined;
  /** Wraps the article in a `StaggerItem`, carrying the row span onto the
   * wrapper since the article drops it; off by default. */
  stagger?: boolean | undefined;
}) {
  const article = (
    /* 2°/2.5°, the wide-surface lean — a Bento cell is a panel, not a chip.
     * The `Tilt` sits between the grid's perspective and the article so the
     * article's own padding and borders ride the rotation as one plane. */
    <Tilt area="section" maxX={2} maxY={2.5} className={cx("grid h-full", !stagger && span && SPAN[span])}>
      <article
        data-slot="bento-cell"
        className={cx("grid h-full content-start gap-3.5 rounded-surface border border-line-strong bg-surface p-6 md:p-7", className)}
      >
        {eyebrow && <p className="index-label">{eyebrow}</p>}
        {title && <h3 className="text-h2 font-semibold tracking-tight text-ink">{title}</h3>}
        {children}
      </article>
    </Tilt>
  );
  return stagger
    ? <StaggerItem y={30} size="stately" className={cx("grid [transform-style:preserve-3d]", span === "rows-2" && "md:row-span-2")}>{article}</StaggerItem>
    : article;
}
