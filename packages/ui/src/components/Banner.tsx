import type { ReactNode } from "react";
import { cx } from "./cn";

/**
 * An inline statement about the surface it sits on — a refusal, a qualifier, a
 * consequence. Not a toast: it does not appear, does not dismiss itself, and
 * does not float. Something the reader has to be able to re-read is not
 * something that should be able to disappear.
 *
 * The tone maps to the same five status roles as a chip, and for the same
 * reason: a blocked banner and a blocked chip on one screen must be the same
 * colour or one of them is lying.
 */
const TONE = {
  ready: "bg-status-ready border-status-ready-line text-status-ready-fg",
  attention: "bg-status-attention border-status-attention-line text-status-attention-fg",
  blocked: "bg-status-blocked border-status-blocked-line text-status-blocked-fg",
  review: "bg-status-review border-status-review-line text-status-review-fg",
  idle: "bg-status-idle border-status-idle-line text-status-idle-fg",
} as const;

export function Banner({
  tone = "idle", title, children, className,
}: {
  tone?: keyof typeof TONE | undefined;
  title: string;
  children?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    // `role="status"` and not `role="alert"`: alert interrupts whatever the
    // screen reader is saying, and a refusal the user just caused by pressing
    // a button is not an interruption — it is the answer.
    <div role="status" className={cx("rounded-panel border px-4 py-3", TONE[tone], className)}>
      <p className="text-data font-medium">{title}</p>
      {children && <div className="mt-1 text-data opacity-90">{children}</div>}
    </div>
  );
}
