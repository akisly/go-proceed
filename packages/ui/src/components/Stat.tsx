import type { ReactNode } from "react";
import { cx } from "./cn";

/**
 * One KPI card — the reference's «Metric Anchoring» row (Uxerflow, «Autumn –
 * CRM Dashboard – Homepage», Dribbble 27537255, read 2026-09-23; structure
 * only, nothing copied). A tinted index tile and a label, a dashed rule, the
 * figure, and one line under it.
 *
 * THE TINT IS AN INDEX, NOT A MEANING. The four `chip-*` roles are decorative
 * and are bound to the ORDER of an enumeration (DESIGN.md, DEV-029): the
 * caller passes them by position in its row, never by what the figure says.
 * A figure that carries a state — blocked, ready — says so in words and does
 * not sit beside a status chip in the same card (02-building-ui.md §4.1).
 *
 * ONE FIGURE LEADS A ROW. `emphasis="secondary"` sets the value a step down
 * (`text-h3`, secondary ink) for a count that qualifies the row's main figure
 * rather than competing with it (DEV-035 UI review, U1-02: the blocked sum
 * and three counts at one size left the payer no figure to read first).
 *
 * The card lifts by `shadow-raised` and no more: owner, 2026-09-23 (DEV-035),
 * «Как в Autumn» for the dashboard's cards. The border still draws the edge.
 */
const TINT = {
  clay: "bg-chip-clay text-chip-clay-fg",
  violet: "bg-chip-violet text-chip-violet-fg",
  pine: "bg-chip-pine text-chip-pine-fg",
  stone: "bg-chip-stone text-chip-stone-fg",
} as const;

export type StatTint = keyof typeof TINT;

export function Stat({
  label, value, unit, caption, icon, tint, emphasis = "primary", className,
}: {
  label: string;
  value: ReactNode;
  unit?: string | undefined;
  caption?: ReactNode | undefined;
  icon?: ReactNode | undefined;
  tint: StatTint;
  emphasis?: "primary" | "secondary" | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      data-slot="stat"
      className={cx(
        "flex min-w-0 flex-col rounded-panel border border-line bg-surface shadow-raised",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2.5">
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-control [&_svg]:size-3.5",
            TINT[tint],
          )}
        >
          {icon}
        </span>
        <p className="min-w-0 text-meta font-medium text-ink-secondary">{label}</p>
      </div>
      <div aria-hidden="true" className="mx-4 border-t border-dashed border-line" />
      <div className="flex flex-col gap-1 px-4 pt-3 pb-4">
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span
            className={emphasis === "primary"
              ? "tabular text-h2 font-semibold text-ink"
              : "tabular text-h3 font-semibold text-ink-secondary"}
          >
            {value}
          </span>
          {unit && <span className="text-meta text-ink-muted">{unit}</span>}
        </p>
        {caption && <p className="text-meta text-ink-muted">{caption}</p>}
      </div>
    </div>
  );
}
