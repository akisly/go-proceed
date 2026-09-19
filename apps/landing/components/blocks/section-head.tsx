import type { ReactNode } from "react";
import { LineReveal, Reveal } from "@goproceed/ui/motion";

/**
 * The prototype's `.head`: eyebrow and h2 on the left, the lead on the right,
 * aligned to the bottom. `stack` puts the lead under the heading (the FAQ and
 * the problem statement do not use this component at all).
 */
export function SectionHead({
  eyebrow, title, titleAccent, lead, children, layout = "split", as = "h2",
}: {
  eyebrow: string;
  title: string;
  titleAccent: string;
  lead?: string | undefined;
  children?: ReactNode | undefined;
  layout?: "split" | "stack" | undefined;
  /** `h1` where the block opens a page (DEV-022): /product, /roles and /pilot each need one. */
  as?: "h1" | "h2" | undefined;
}) {
  return (
    <div className={layout === "split" ? "mb-8 grid gap-6 md:mb-12 wide:grid-cols-2 wide:items-end wide:gap-10" : "mb-8 grid gap-6 md:mb-12"}>
      <div>
        <Reveal size="stately"><p className="index-label">{eyebrow}</p></Reveal>
        <LineReveal as={as} text={title} accent={titleAccent} className="display mt-3.5 max-w-[20ch] text-mkt-display-2 text-ink" />
      </div>
      {(lead || children) && (
        <Reveal size="stately">
          {lead && <p className="measure text-mkt-lead leading-relaxed text-ink-secondary">{lead}</p>}
          {children}
        </Reveal>
      )}
    </div>
  );
}
