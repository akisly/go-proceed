import type { ReactNode } from "react";
import { Reveal } from "@goproceed/ui/motion";
import { AccentText } from "./accent-text";

/**
 * The prototype's `.head`: eyebrow and h2 on the left, the lead on the right,
 * aligned to the bottom. `stack` puts the lead under the heading (the FAQ and
 * the problem statement do not use this component at all).
 */
export function SectionHead({
  eyebrow, title, titleAccent, lead, children, layout = "split",
}: {
  eyebrow: string;
  title: string;
  titleAccent: string;
  lead?: string | undefined;
  children?: ReactNode | undefined;
  layout?: "split" | "stack" | undefined;
}) {
  return (
    <div className={layout === "split" ? "mb-8 grid gap-6 md:mb-12 wide:grid-cols-2 wide:items-end wide:gap-10" : "mb-8 grid gap-6 md:mb-12"}>
      <div>
        <Reveal><p className="index-label">{eyebrow}</p></Reveal>
        <Reveal>
          <h2 className="display mt-3.5 max-w-[20ch] text-mkt-display-2 text-ink">
            <AccentText text={title} accent={titleAccent} />
          </h2>
        </Reveal>
      </div>
      {(lead || children) && (
        <Reveal>
          {lead && <p className="measure text-mkt-lead leading-relaxed text-ink-secondary">{lead}</p>}
          {children}
        </Reveal>
      )}
    </div>
  );
}
