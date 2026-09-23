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
          * statement earns its animation, not its own type scale. [DEV-029] And the
          * same gap under it as `SectionHead` leaves — without it the stage below
          * touched the lead. */}
        <div className="mb-10 grid gap-6 md:mb-14 wide:grid-cols-2 wide:items-end wide:gap-10">
          <ScrollTint text={p.statement} className="display text-mkt-display-3 font-medium leading-tight tracking-tight text-ink" />
          <Reveal size="stately"><SectionLead>{p.aside}</SectionLead></Reveal>
        </div>
        {/* [DEV-029] The figure stands on a warm panel, the same arrangement the
          * route's media cards use: it is an exhibit, and an exhibit on the same
          * paper as the argument around it is just more paper. The plan named
          * this and the first implementation pass missed it. */}
        <Reveal y={0}>
          <div className="landing-stage p-3 md:p-6"><Fig01 /></div>
        </Reveal>
      </div>
    </section>
  );
}
