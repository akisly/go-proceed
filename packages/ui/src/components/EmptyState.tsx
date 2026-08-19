import type { ReactNode } from "react";
import { cx } from "./cn";

/**
 * Nothing here yet — and, crucially, WHY.
 *
 * "Немає даних" is not an empty state; it is a shrug. Every empty state in this
 * product names the condition and the next act, because an empty register
 * during a reporting close is either "nothing has been recorded" or "everything
 * is filtered out", and those need opposite responses.
 */
export function EmptyState({
  title, description, action, className,
}: {
  title: string;
  description: string;
  action?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cx("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}>
      <p className="text-h3 font-semibold text-ink">{title}</p>
      <p className="measure text-data text-ink-muted">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
