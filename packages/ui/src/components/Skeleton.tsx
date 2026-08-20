import { cx } from "./cn";

/**
 * A loading placeholder that does NOT shimmer.
 *
 * Every shimmer is a perpetual animation, and this system permits exactly one
 * (the marquee). A register that pulses while it loads is a register that is
 * animating on the machine of someone waiting for it — and the pulse conveys
 * nothing the shape does not already convey.
 *
 * `aria-hidden` with a live region owned by the caller: a skeleton announced
 * as content is worse than one not announced at all.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("rounded-control bg-sunken", className)} />;
}
