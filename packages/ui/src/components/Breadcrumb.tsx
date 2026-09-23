import { Fragment, type ReactNode } from "react";
import { cx } from "./cn";

/**
 * «Проєкти / Об'єкт» above a page heading — the reference's top-bar trail
 * (Uxerflow, «Autumn – CRM Dashboard – Workflow Management», Dribbble
 * 27557794, read 2026-09-23; structure only). Arrived with DEV-035, the first
 * screen that needs one.
 *
 * Every item but the last is whatever the caller passes — a `next/link`, so
 * this package needs no router. The LAST item is the current page: it is
 * rendered as text and marked `aria-current="page"`, never a link to itself.
 */
export function Breadcrumb({
  items, className,
}: {
  items: ReactNode[];
  className?: string | undefined;
}) {
  const last = items.length - 1;
  return (
    <nav aria-label="Шлях" className={cx("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-meta text-ink-muted">
        {items.map((item, i) => (
          <Fragment key={i}>
            {i > 0 && <li aria-hidden="true" className="text-ink-subtle">/</li>}
            <li className="min-w-0">
              {i === last ? <span aria-current="page" className="text-ink">{item}</span> : item}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
