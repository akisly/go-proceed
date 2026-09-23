import type { ReactElement, ReactNode } from "react";
import { Slot } from "radix-ui";
import { cx } from "./cn";

/**
 * Tabs that are PAGES — each one a link to its own route, the current one
 * marked `aria-current="page"`. Not Radix Tabs: those switch panels inside one
 * page, and a reader of the dashboard should be able to open «Доручення» in a
 * new tab or send its address. The reference's «Workflows / Credentials /
 * Execution» strip (Uxerflow, «Autumn – CRM Dashboard – Workflow Management»,
 * Dribbble 27557794, read 2026-09-23; structure only).
 *
 * The current tab's rule is the accent (pine), not the reference's orange:
 * ember is never a line that has to be seen (2.56:1 on the paper). The state
 * is also carried by weight and colour of the label and by `aria-current`.
 *
 * `TabLink` takes ONE child element — a `next/link` or an `<a>` — and lends it
 * its classes through Slot, so `packages/ui` needs no router.
 */
export function TabNav({
  label, children, className,
}: {
  label: string;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <nav aria-label={label} className={cx("border-b border-line", className)}>
      <ul className="-mb-px flex gap-5 overflow-x-auto">{children}</ul>
    </nav>
  );
}

export function TabLink({
  active, children, className,
}: {
  active: boolean;
  children: ReactElement;
  className?: string | undefined;
}) {
  return (
    <li className="shrink-0">
      <Slot.Root
        aria-current={active ? "page" : undefined}
        className={cx(
          "inline-flex h-(--gp-control-height-desk) touch:h-(--gp-control-height-touch) items-center justify-center",
          // A short label («Огляд») is narrower than the 44px floor on touch.
          "touch:min-w-(--gp-control-height-touch)",
          "border-b-2 text-data font-medium transition-colors duration-fast ease-out",
          active ? "border-line-accent text-ink" : "border-transparent text-ink-muted hover:text-ink",
          className,
        )}
      >
        {children}
      </Slot.Root>
    </li>
  );
}
