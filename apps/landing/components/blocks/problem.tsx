import { Reveal, ScrollTint } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { Fig01 } from "../visuals/fig-01";
import { SectionLead } from "./section-head";

export function Problem() {
  const p = landingContent.problem;
  return (
    <section id="problem" className="scroll-mt-20 landing-inset py-20 md:py-28">
      <div>
        {/* The same two columns, the same heading step and the same lead as every
          * other block's head (`SectionHead`). [2026-09-22, owner] This block used
          * to be one step larger (`mkt-display-2` against `mkt-display-3`), at a
          * different weight, over a 1.25fr/0.75fr split with a `34ch` lead in
          * another size and another colour — so on /roles it sat under the page's
          * own head looking like a different site. Only the ScrollTint stays: the
          * statement earns its animation, not its own type scale. */}
        <div className="grid gap-6 wide:grid-cols-2 wide:items-end wide:gap-10">
          <ScrollTint text={p.statement} className="display text-mkt-display-3 font-medium leading-tight tracking-tight text-ink" />
          <Reveal size="stately"><SectionLead>{p.aside}</SectionLead></Reveal>
        </div>
        <Reveal y={0}><Fig01 /></Reveal>
      </div>
    </section>
  );
}
