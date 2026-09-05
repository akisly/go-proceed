import { CompareArrow, CompareCard, ComparePair } from "@goproceed/ui/components";
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionHead } from "./section-head";

export function Compare() {
  const c = landingContent.compare;
  return (
    <section id="compare" className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={c.eyebrow} title={c.title} titleAccent={c.titleAccent} lead={c.lead} />
        <Reveal y={0}>
          <ComparePair>
            <CompareCard tone="was" eyebrow={c.was.eyebrow} title={c.was.title} rows={[...c.was.rows]} outcome={c.was.outcome} />
            <CompareArrow />
            <CompareCard tone="now" eyebrow={c.now.eyebrow} title={c.now.title} rows={c.now.rows.map((r) => ({ ...r }))} outcome={c.now.outcome} />
          </ComparePair>
        </Reveal>
      </div>
    </section>
  );
}
