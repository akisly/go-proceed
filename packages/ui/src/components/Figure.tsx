import type { ReactNode } from "react";
import { cx } from "./cn";

/**
 * The focal number, and the sentence that keeps it honest.
 *
 * THREE LEVERS AT ONCE, and they are the point of the component:
 * an eyebrow (12px, uppercase, tracked, muted), the figure itself
 * (`text-display`, semibold, ink, tabular), and a denominator in muted body.
 * A number without its denominator is a number a reader will assume is the
 * whole.
 *
 * **The qualifier is not decoration.** `src/domain/risk.ts` sets a wording rule
 * for every surface that consumes this number: it is money whose evidence is
 * currently missing, not money that will certainly go unpaid, and the phrasing
 * stays conditional. That is a legal position, not copy — so the qualifier is a
 * required prop, and a caller that has nothing to say there has to say so.
 *
 * The eyebrow is the heading. Naming the panel with `aria-label` AND adding an
 * `sr-only` heading says the same thing twice.
 */
export function Figure({
  eyebrow, value, denominator, qualifier, className,
}: {
  eyebrow: string;
  /** Already formatted. Money has a currency and a locale, and this component
   * does not decide either — `src/domain/format.ts` does. */
  value: ReactNode;
  denominator?: string | undefined;
  qualifier: string;
  className?: string | undefined;
}) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <h2 className="text-meta font-medium uppercase tracking-wide text-ink-muted">{eyebrow}</h2>
      <p className="flex items-baseline gap-2">
        <span className="tabular text-display font-semibold text-ink">{value}</span>
        {denominator && <span className="text-body text-ink-muted">{denominator}</span>}
      </p>
      <p className="measure text-meta text-ink-muted">{qualifier}</p>
    </div>
  );
}
