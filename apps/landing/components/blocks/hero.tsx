import { ArrowRight } from "lucide-react";
import { Button, Pill, PillContent } from "@goproceed/ui/components";
import { Reveal, TextBlurIn } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { ProductFrame } from "../visuals/product-frame";

export function Hero() {
  const h = landingContent.hero;
  return (
    <section id="hero" className="px-4 pt-32 md:px-8 md:pt-36">
      <div className="mx-auto max-w-marketing">
        <div className="mx-auto grid max-w-[780px] justify-items-center text-center">
          <Reveal>
            <Pill asChild>
              <a href={h.pill.href}><PillContent badge={h.pill.badge}>{h.pill.text}</PillContent></a>
            </Pill>
          </Reveal>
          <h1 className="display mt-5 max-w-[16ch] text-mkt-display-1 tracking-tightest text-ink">
            <TextBlurIn text={h.title.slice(0, h.title.indexOf(h.titleAccent))} />
            <span className="text-accent" data-accent="true">{h.titleAccent}</span>
            <TextBlurIn text={h.title.slice(h.title.indexOf(h.titleAccent) + h.titleAccent.length)} delay={0.4} />
          </h1>
          <Reveal delay={0.15}><p className="measure mt-5 text-mkt-lead leading-relaxed text-ink-secondary">{h.lead}</p></Reveal>
          <Reveal delay={0.25} className="mt-6 flex flex-wrap justify-center gap-2.5">
            <Button asChild size="lg"><a href="#pilot">{h.primaryAction}</a></Button>
            <Button asChild size="lg" variant="outline">
              <a href={h.secondaryHref}>{h.secondaryAction}<ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.6} /></a>
            </Button>
          </Reveal>
          <Reveal delay={0.3} className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-left text-data text-ink-muted">
            {h.facts.map((f) => (
              <p key={f.value}><b className="block font-medium text-ink">{f.value}</b>{f.label}</p>
            ))}
          </Reveal>
        </div>
        <ProductFrame />
      </div>
    </section>
  );
}
