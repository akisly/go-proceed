import { Accordion } from "@goproceed/ui/components";
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { splitTitle } from "./section-head";
import { TwoTone } from "./two-tone";

/** [DEV-026] The reference's FAQ: a small label and a two-tone heading at left, a chevron accordion between hairlines at right.
 *
 * [2026-09-22, DEV-029] The band is the warm tint. It costs nothing — the
 * accordion is a list of hairlines either way — and it is the cheapest honest
 * break between the pilot's white form above it and the dark footer below it.
 * A page that runs paper → paper → dark ends abruptly; paper → tint → dark
 * steps down. */
export function Faq() {
  const q = landingContent.faq;
  const title = splitTitle(q.title, q.titleAccent);
  return (
    <section id="faq" tabIndex={-1} className="landing-inset scroll-mt-20 bg-tint-warm py-20 md:py-28">
      <div className="grid gap-10 wide:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] wide:gap-16">
        <div>
          <Reveal><p className="mb-3 text-data text-ink-secondary">{q.eyebrow}</p></Reveal>
          <TwoTone lead={title.lead} rest={title.rest} />
        </div>
        <Reveal y={0}><Accordion entries={[...q.entries]} marker="chevron" className="border-t border-line-warm" /></Reveal>
      </div>
    </section>
  );
}
