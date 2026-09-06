import { Accordion } from "@goproceed/ui/components";
import { LineReveal, Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";

export function Faq() {
  const q = landingContent.faq;
  return (
    <section id="faq" className="scroll-mt-20 px-4 pb-10 pt-20 md:px-8 md:pb-14 md:pt-28">
      <div className="mx-auto grid max-w-marketing gap-8 wide:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] wide:gap-10">
        <div>
          <Reveal><p className="index-label">{q.eyebrow}</p></Reveal>
          <LineReveal as="h2" text={q.title} accent={q.titleAccent} className="display mt-3.5 max-w-[12ch] text-mkt-display-2 text-ink" />
        </div>
        <Reveal y={0}><Accordion entries={[...q.entries]} marker="plus" className="border-t border-line" /></Reveal>
      </div>
    </section>
  );
}
