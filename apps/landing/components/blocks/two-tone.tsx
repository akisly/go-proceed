import { Reveal } from "@goproceed/ui/motion";

/**
 * The reference's section heading (DEV-023): two lines, the first in ink and
 * the second muted — the statement and its consequence. 36px/500 there; here
 * the marketing scale's third display step at medium weight, which is 34px at
 * 1440. `as` is `h1` where the block opens a page.
 *
 * One `Reveal`, not a line-by-line rise: the reference's headings arrive with
 * their section. The muted line is `ink-muted`, which clears 4.5:1 on paper.
 *
 * AN `h1` IS NOT REVEALED (R-01). `Reveal` server-renders `opacity: 0`, so the
 * LCP heading of /product, /roles and /pilot waited for hydration, an
 * IntersectionObserver and a 900ms fade — on a phone too, where this system
 * sends no entrance at all. The page's heading paints with the HTML, as the
 * home page's does.
 */
export function TwoTone({
  lead, rest, as: As = "h2", size = "section", className,
}: {
  lead: string;
  rest?: string | undefined;
  as?: "h1" | "h2" | undefined;
  size?: "section" | "closing" | undefined;
  className?: string | undefined;
}) {
  const scale = size === "closing"
    // `max-w-[22ch]` HERE, on the element that carries the 60px size: on a wrapper
    // `ch` resolves at the body's 16px — 205px — and the heading broke into six
    // one-word lines (B2-01).
    ? "mx-auto max-w-[22ch] text-[clamp(32px,4.2vw,60px)] font-semibold leading-none tracking-tightest"
    : "text-mkt-display-3 font-medium leading-tight tracking-tight";
  const heading = (
    <As data-two-tone="" className={`display text-ink ${scale}`}>
      {/* The space is for `textContent`: two block spans read as «робота —з доказом» without it. */}
      <span className="block">{lead}</span>{rest && " "}
      {rest && <span className="block text-ink-muted">{rest}</span>}
    </As>
  );
  if (As === "h1") return <div className={className}>{heading}</div>;
  return <Reveal size="stately" className={className}>{heading}</Reveal>;
}
