import type { ReactNode } from "react";
import { Slot } from "radix-ui";
import { cx } from "./cn";

/**
 * The announcement pill — 21st.dev's «Announcement»: a dark badge, a line of
 * copy and an arrow that nudges on hover. Above a hero it says one thing («the
 * pilot is free») and links to where that thing is explained.
 *
 * Two parts on purpose. `Pill` is the shell; `PillContent` is the badge, the
 * copy and the arrow. With `asChild` the caller passes its own `<a>` and puts
 * `PillContent` inside it — Slot merges the shell's classes onto the link and
 * renders the link's own children, so the content has to travel with the
 * link, not with the shell. Never a `<div>` with an onClick.
 */
const SHELL =
  "group inline-flex items-center gap-2 rounded-pill border border-line-strong bg-surface " +
  "py-1 pl-1 pr-3 text-data text-ink-secondary transition-colors duration-fast ease-out hover:border-ink";

export function Pill({
  children, asChild = false, className,
}: {
  children: ReactNode;
  asChild?: boolean | undefined;
  className?: string | undefined;
}) {
  const classes = cx(SHELL, className);
  if (asChild) {
    return <Slot.Root data-slot="pill" className={classes}>{children}</Slot.Root>;
  }
  return <span data-slot="pill" className={classes}>{children}</span>;
}

/** The inside of a pill: badge, copy, arrow. The arrow is a glyph and aria-hidden, so the link's name is the copy. */
export function PillContent({ badge, children }: { badge?: string | undefined; children: ReactNode }) {
  return (
    <>
      {badge && (
        <span className="inline-flex items-center rounded-pill bg-action px-2.5 py-0.5 text-meta font-medium text-action-fg">
          {badge}
        </span>
      )}
      <span>{children}</span>
      <span aria-hidden="true" className="text-ink-muted transition-transform duration-fast ease-out group-hover:translate-x-0.5">→</span>
    </>
  );
}
