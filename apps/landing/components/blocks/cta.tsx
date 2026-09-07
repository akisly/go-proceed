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
        {/* [2026-09-07] The measures were set for a narrower card than this one
          * ever renders. At 1240-1920 the text track is 608px while the h2 was
          * capped at 18ch — 342px — so the heading broke into FOUR lines, left
          * 280px of empty track between the copy and the actions, and made the
          * column tall enough that centring the buttons against it stranded
          * another 160px underneath. Widening the measures lets the heading sit
          * on two lines and the card close up around its own content. */}
        <div className="grid items-center gap-8 rounded-section border border-line-strong bg-surface p-7 md:grid-cols-[minmax(0,1fr)_auto] md:p-12">
          <div>
            <LineReveal as="h2" text={c.title} accent={c.titleAccent} className="display max-w-[24ch] text-[clamp(26px,3vw,38px)] leading-tight tracking-tight text-ink" />
            <Reveal size="stately"><p className="mt-5 max-w-[56ch] text-body leading-relaxed text-ink-secondary">{c.lead}</p></Reveal>
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
