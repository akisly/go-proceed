import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { BrandMark } from "../brand-mark";
import { PillLink } from "./pill-link";
import { TwoTone } from "./two-tone";
import { ShareLink } from "./share-link";

/**
 * The closing block of every page but /pilot. [DEV-023] The reference's: lines
 * radiating from the centre, a row of small marks either side of ours, which
 * breathes (`breathe`, named loop 7), a 60px heading, two pills. The marks are
 * the five records of one work — W, R, EV, DR, CL — not partner logos.
 *
 * [DEV-022] It is the offer: what the pilot costs, in three words, and the way
 * to the form, which lives on /pilot. «Скопіювати посилання для ПТВ» stays —
 * the payer forwards the page to the person who will run it.
 */
export function Cta() {
  const c = landingContent.cta;
  const half = Math.ceil(c.codes.length / 2);
  return (
    <section id="cta-final" tabIndex={-1} className="landing-burst relative isolate scroll-mt-20 overflow-hidden px-4 py-24 text-center md:px-8 md:py-36">
      <div className="mx-auto grid max-w-[760px] justify-items-center gap-8">
        <Reveal size="stately" className="flex items-center gap-3 font-mono text-data font-medium text-ink-secondary md:gap-4">
          {c.codes.slice(0, half).map((code) => <span key={code} aria-hidden="true" className="grid size-9 place-items-center rounded-panel border border-line bg-surface">{code}</span>)}
          <span aria-hidden="true" className="breathe grid size-[60px] place-items-center rounded-section border border-line-strong bg-surface shadow-float"><BrandMark className="size-[30px]" /></span>
          {c.codes.slice(half).map((code) => <span key={code} aria-hidden="true" className="grid size-9 place-items-center rounded-panel border border-line bg-surface">{code}</span>)}
        </Reveal>
        <TwoTone size="closing" lead={c.title} />
        <Reveal size="stately">
          <ul data-offer-points="" className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-data text-ink-secondary">
            {c.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </Reveal>
        <Reveal size="stately" className="flex flex-wrap justify-center gap-3">
          <PillLink href={c.primaryHref}>{c.primary}</PillLink>
          <ShareLink />
        </Reveal>
      </div>
    </section>
  );
}
