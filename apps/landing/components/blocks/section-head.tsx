import type { ReactNode } from "react";
import { Reveal } from "@goproceed/ui/motion";
import { TwoTone } from "./two-tone";

/**
 * A section's head. [DEV-023] The reference's: a small label, then a two-tone
 * heading — the statement in ink, its closing phrase muted — with the lead
 * beside it on wide screens. `titleAccent` is the closing phrase of `title`
 * in every block's copy, so the split needs no second string.
 *
 * `as` is `h1` where the block opens a page (DEV-022): /product, /roles and
 * /pilot each need one.
 */
/** A block's title as the two-tone pair: everything before its closing phrase, then the phrase. A `titleAccent` that is not a suffix leaves the title whole — never `slice(0, -1)`. */
export function splitTitle(title: string, titleAccent: string): { lead: string; rest: string | undefined } {
  const at = title.lastIndexOf(titleAccent);
  return at > 0 && at + titleAccent.length === title.length
    ? { lead: title.slice(0, at).trim(), rest: titleAccent }
    : { lead: title, rest: undefined };
}

export function SectionHead({
  eyebrow, title, titleAccent, lead, children, layout = "split", as = "h2",
}: {
  eyebrow: string;
  title: string;
  titleAccent: string;
  lead?: string | undefined;
  children?: ReactNode | undefined;
  layout?: "split" | "stack" | undefined;
  as?: "h1" | "h2" | undefined;
}) {
  const { lead: first, rest } = splitTitle(title, titleAccent);
  return (
    <div className={layout === "split" ? "mb-10 grid gap-6 md:mb-14 wide:grid-cols-2 wide:items-end wide:gap-10" : "mb-10 grid gap-6 md:mb-14"}>
      <div>
        <Reveal size="stately"><p className="mb-3 text-data text-ink-secondary">{eyebrow}</p></Reveal>
        <TwoTone as={as} lead={first} rest={rest} />
      </div>
      {(lead || children) && (
        <Reveal size="stately">
          {lead && <p className="measure text-mkt-lead leading-relaxed text-ink-muted">{lead}</p>}
          {children}
        </Reveal>
      )}
    </div>
  );
}
