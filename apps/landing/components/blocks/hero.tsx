import { OrbitText, PixelRain } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { PillLink } from "./pill-link";

/**
 * The first screen. [DEV-023] The reference's, in our colours: it fills the
 * viewport; pixels fall from its top edge (`PixelRain`); a flat grid tips away
 * under its foot (`landing-floor`); a phrase turns on an arc over a centred
 * 54px/400 heading; one sentence of definition; two pills.
 *
 * The heading is plain text, not `LineReveal`: the reference reveals the whole
 * first screen at once, and the h1 is the LCP element — it paints on the first
 * frame. The lead and the actions keep the CSS `entrance` (no JS before paint).
 * The product itself is the second block's job now; the state board moved to
 * /product, where the reference keeps its large app view.
 */
export function Hero() {
  const h = landingContent.hero;
  return (
    <section id="hero" className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-4 pb-24 pt-32 md:px-8">
      <PixelRain className="absolute inset-x-0 top-0 -z-10 h-[24%] w-full text-ink" />
      <div aria-hidden="true" className="landing-floor -z-10" />
      <div className="mx-auto grid max-w-[880px] justify-items-center text-center">
        <div className="entrance grid w-full justify-items-center">
          <OrbitText text={h.orbit} className="text-body font-medium text-ink" />
        </div>
        <h1 className="display mt-2 max-w-[34ch] text-[clamp(42px,3.75vw,54px)] font-normal leading-none tracking-tight text-ink">{h.title}</h1>
        <div className="entrance [--gp-entrance-delay:0.15s]"><p className="measure mt-6 text-body leading-relaxed text-ink-secondary">{h.lead}</p></div>
        <div className="entrance [--gp-entrance-delay:0.25s] mt-7 flex flex-wrap justify-center gap-3">
          <PillLink href={h.primaryHref}>{h.primaryAction}</PillLink>
          <PillLink href={h.secondaryHref} tone="paper">{h.secondaryAction}</PillLink>
        </div>
      </div>
    </section>
  );
}
