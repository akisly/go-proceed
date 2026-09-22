import { CompareArrow, CompareCard, ComparePair } from "@goproceed/ui/components";
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionHead } from "./section-head";

/**
 * [2026-09-22, DEV-029] THE PAIR STANDS ON THE WARM PANEL — the same stage the
 * board stands on, and the site's only one.
 *
 * It was near-black for one revision, after «Autumn — UX Highlight»'s
 * «Foundation / Result» split. Two things killed that. The owner removed the
 * dark everywhere («убрать тёмное совсем»); and the critique showed why it
 * never worked HERE even when it worked on the board — the dark was a 40px
 * frame around two cards that never overlapped its edge, which is an outline,
 * not a backdrop.
 *
 * The heading and the lead stay on paper. The arrangement still settles a
 * complaint from DEV-028: the hovered row's twin-lighting «вообще выглядит
 * странно, не вписывается в палитру» is not reinstated — the two sheets are
 * already the brightest things in the block.
 */
export function Compare() {
  const c = landingContent.compare;
  return (
    <section id="compare" tabIndex={-1} className="scroll-mt-20 landing-inset py-20 md:py-28">
      <div>
        <SectionHead eyebrow={c.eyebrow} title={c.title} titleAccent={c.titleAccent} lead={c.lead} />
        <div className="landing-stage relative isolate px-4 py-10 md:px-10 md:py-14">
        <ComparePair>
          <Reveal x={-20} y={0} size="stately" className="order-1 grid">
            <CompareCard tone="was" eyebrow={c.was.eyebrow} title={c.was.title} rows={[...c.was.rows]} outcome={c.was.outcome} className="order-none" />
          </Reveal>
          <CompareArrow />
          <Reveal x={20} y={0} size="stately" delay={0.1} className="order-3 grid">
            <CompareCard tone="now" eyebrow={c.now.eyebrow} title={c.now.title} rows={c.now.rows.map((r) => ({ ...r }))} outcome={c.now.outcome} animateChecks className="order-none" />
          </Reveal>
        </ComparePair>
        </div>
      </div>
    </section>
  );
}
