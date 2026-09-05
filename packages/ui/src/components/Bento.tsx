import type { ReactNode } from "react";
import { cx } from "./cn";

/**
 * 21st.dev's «Bento Grid», reduced to the one arrangement the product uses: a
 * wide cell that spans two rows beside two stacked cells. Cells are surfaces
 * with a strong line and the marketing radius; there is no shadow — structure
 * is the border.
 */
export function Bento({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <div className={cx("grid gap-3.5 md:grid-cols-[1.25fr_1fr]", className)}>{children}</div>;
}

const SPAN = { "rows-2": "md:row-span-2" } as const;

export function BentoCell({
  eyebrow, title, span, children, className,
}: {
  eyebrow?: string | undefined;
  title?: string | undefined;
  span?: keyof typeof SPAN | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <article
      data-slot="bento-cell"
      className={cx("grid content-start gap-3.5 rounded-surface border border-line-strong bg-surface p-6 md:p-7", span && SPAN[span], className)}
    >
      {eyebrow && <p className="index-label">{eyebrow}</p>}
      {title && <h3 className="text-h2 font-semibold tracking-tight text-ink">{title}</h3>}
      {children}
    </article>
  );
}
