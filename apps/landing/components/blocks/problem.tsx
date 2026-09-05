import { Reveal, ScrollTint } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { Fig01 } from "../visuals/fig-01";

export function Problem() {
  const p = landingContent.problem;
  return (
    <section id="problem" className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <div className="grid gap-8 wide:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] wide:items-end wide:gap-16">
          <ScrollTint text={p.statement} className="display max-w-[20ch] text-mkt-display-2 leading-tight text-ink" />
          <Reveal><p className="max-w-[34ch] text-body leading-relaxed text-ink-secondary">{p.aside}</p></Reveal>
        </div>
        <Reveal y={0}><Fig01 /></Reveal>
      </div>
    </section>
  );
}
