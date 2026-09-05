import { Button } from "@goproceed/ui/components";
import { Reveal, TextBlurIn } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { ShareLink } from "./share-link";

/** 21st.dev's Cta-4: a light card, copy left, actions right. The second and last TextBlurIn on the page. */
export function Cta() {
  const c = landingContent.cta;
  const at = c.title.indexOf(c.titleAccent);
  return (
    <section id="cta-final" className="px-4 pb-16 pt-8 md:px-8 md:pb-24 md:pt-12">
      <div className="mx-auto max-w-marketing">
        <div className="grid items-center gap-8 rounded-section border border-line-strong bg-surface p-7 md:grid-cols-[minmax(0,1.3fr)_auto] md:p-12">
          <div>
            <h2 className="display max-w-[18ch] text-[clamp(26px,3vw,38px)] leading-tight tracking-tight text-ink">
              <TextBlurIn text={c.title.slice(0, at)} />
              <span className="text-accent" data-accent="true">{c.titleAccent}</span>
              <TextBlurIn text={c.title.slice(at + c.titleAccent.length)} delay={0.3} />
            </h2>
            <Reveal><p className="mt-3 max-w-[48ch] text-body leading-relaxed text-ink-secondary">{c.lead}</p></Reveal>
          </div>
          <Reveal className="flex flex-wrap gap-2.5 md:justify-self-end">
            <Button asChild size="lg"><a href="#pilot">{c.primary}</a></Button>
            <ShareLink />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
