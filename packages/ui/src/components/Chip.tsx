import type { ReactNode } from "react";
import { cx } from "./cn";

/**
 * A status chip. The LABEL carries the meaning; the tone only tints it.
 *
 * Seven catalog readiness states collapse to five visual tones, and colour is
 * never the sole signal — every state is named in its canonical `ui_uk` label.
 * That is not a preference: a register read by a colour-blind estimator, or
 * printed, or photographed on site in sunlight, has to stay true.
 *
 * `h-(--gp-control-height-touch)` on touch because a chip in the register's
 * segmented filter is a control, not decoration.
 */
const TONE = {
  ready: "bg-status-ready border-status-ready-line text-status-ready-fg",
  attention: "bg-status-attention border-status-attention-line text-status-attention-fg",
  blocked: "bg-status-blocked border-status-blocked-line text-status-blocked-fg",
  review: "bg-status-review border-status-review-line text-status-review-fg",
  idle: "bg-status-idle border-status-idle-line text-status-idle-fg",
  /** Not a status. The eyebrow pill above a heading, and nothing else. */
  neutral: "bg-surface border-line text-ink-muted",
} as const;

export type ChipTone = keyof typeof TONE;

export function Chip({
  tone = "idle", children, className, interactive = false, dot = false, pulse = false,
}: {
  tone?: ChipTone | undefined;
  children: ReactNode;
  className?: string | undefined;
  /** A chip inside a filter is a control and takes the touch floor. */
  interactive?: boolean | undefined;
  /** A leading dot in the chip's own colour — the landing's status tags carry one. Never the only signal: the label still names the state. */
  dot?: boolean | undefined;
  /** The dot breathes (prototype `.tag.rv::before`, index.html l.112): 1.6s, opacity .3↔1, scale .8↔1.1. One of the five named perpetual loops; the landing passes it for review-tone tags, the app never does. Needs `dot`. */
  pulse?: boolean | undefined;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-pill border px-3 text-meta font-medium",
        interactive
          ? "h-(--gp-control-height-desk-sm) touch:h-(--gp-control-height-touch)"
          : "py-1",
        TONE[tone],
        className,
      )}
    >
      {dot && <i aria-hidden="true" data-chip-dot="true" className={pulse ? "pulse-dot size-1.5 shrink-0 rounded-pill bg-current opacity-80" : "size-1.5 shrink-0 rounded-pill bg-current opacity-80"} />}
      {children}
    </span>
  );
}
