import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, Pill, PillContent } from "@goproceed/ui/components";
import { LineReveal, Magnetic, Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { ProductFrame } from "../visuals/product-frame";

/**
 * The hero, timed as the prototype times it (index.html l.1105, l.1109–1113):
 * the h1 rises line by line from .1s; the pill, lead and actions are
 * `[data-up]` entrances at `stately`; the frame follows at .35s (product-frame).
 *
 * [DEV-022] The four role facts moved to /roles: the first viewport of a short
 * home page holds one promise, one definition and the product.
 */
export function Hero() {
  const h = landingContent.hero;
  return (
    <section id="hero" className="px-4 pt-32 md:px-8 md:pt-36">
      <div className="mx-auto max-w-marketing">
        <div className="mx-auto grid max-w-[780px] justify-items-center text-center">
          <div className="entrance">
            <Magnetic>
              <Pill asChild>
                <Link href={h.pill.href}><PillContent badge={h.pill.badge}>{h.pill.text}</PillContent></Link>
              </Pill>
            </Magnetic>
          </div>
          <LineReveal as="h1" text={h.title} accent={h.titleAccent} delay={0.1} className="display mt-5 max-w-[16ch] text-mkt-display-1 tracking-tightest text-ink" />
          <div className="entrance [--gp-entrance-delay:0.15s]"><p className="measure mt-5 text-mkt-lead leading-relaxed text-ink-secondary">{h.lead}</p></div>
          <div className="entrance [--gp-entrance-delay:0.25s] mt-6 flex flex-wrap justify-center gap-2.5">
            <Magnetic><Button asChild size="lg"><Link href={h.primaryHref}>{h.primaryAction}</Link></Button></Magnetic>
            <Magnetic>
              <Button asChild size="lg" variant="outline">
                <Link href={h.secondaryHref}>{h.secondaryAction}<ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.6} /></Link>
              </Button>
            </Magnetic>
          </div>
        </div>
        <ProductFrame />
      </div>
    </section>
  );
}
