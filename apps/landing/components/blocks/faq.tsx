import { Accordion } from "@goproceed/ui/components";
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { splitTitle } from "./section-head";
import { TwoTone } from "./two-tone";

/** [DEV-026] The reference's FAQ: a small label and a two-tone heading at left, a chevron accordion between hairlines at right. */
export function Faq() {
  const q = landingContent.faq;
  const title = splitTitle(q.title, q.titleAccent);
  return (
    <section id="faq" tabIndex={-1} className="landing-inset scroll-mt-20 py-20 md:py-24">
      <div className="grid gap-10 wide:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] wide:gap-16">
        <div>
          <Reveal><p className="mb-3 text-data text-ink-secondary">{q.eyebrow}</p></Reveal>
          <TwoTone lead={title.lead} rest={title.rest} />
        </div>
        <Reveal y={0}><Accordion entries={[...q.entries]} marker="chevron" className="border-t border-line" /></Reveal>
      </div>
    </section>
  );
}
