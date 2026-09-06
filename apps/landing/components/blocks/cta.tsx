import { Button } from "@goproceed/ui/components";
import { LineReveal, Magnetic, Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { ShareLink } from "./share-link";

/** 21st.dev's Cta-4: a light card, copy left, actions right. The h2 rises line by line like every heading; `TextBlurIn` leaves the page (its two uses were the h1 and this — both are `LineReveal` now). */
export function Cta() {
  const c = landingContent.cta;
  return (
    <section id="cta-final" className="px-4 pb-16 pt-8 md:px-8 md:pb-24 md:pt-12">
      <div className="mx-auto max-w-marketing">
        <div className="grid items-center gap-8 rounded-section border border-line-strong bg-surface p-7 md:grid-cols-[minmax(0,1.3fr)_auto] md:p-12">
          <div>
            <LineReveal as="h2" text={c.title} accent={c.titleAccent} className="display max-w-[18ch] text-[clamp(26px,3vw,38px)] leading-tight tracking-tight text-ink" />
            <Reveal size="stately"><p className="mt-3 max-w-[48ch] text-body leading-relaxed text-ink-secondary">{c.lead}</p></Reveal>
          </div>
          <Reveal size="stately" className="flex flex-wrap gap-2.5 md:justify-self-end">
            <Magnetic><Button asChild size="lg"><a href="#pilot">{c.primary}</a></Button></Magnetic>
            <Magnetic><ShareLink /></Magnetic>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
