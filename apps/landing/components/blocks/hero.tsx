import { CellField, OrbitText, PixelRain } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { PillLink } from "./pill-link";

/**
 * The first screen. [DEV-025] The reference's, in our colours: it fills the
 * viewport; pixels fall from its top edge (`PixelRain`); a flat grid tips away
 * under its foot (`landing-floor`); a phrase turns on an arc over a centred
 * 54px/400 heading; one sentence of definition; two pills.
 *
 * The heading is plain text, not `LineReveal`: the reference reveals the whole
 * first screen at once, and the h1 is the LCP element — it paints on the first
 * frame. The lead and the actions keep the CSS `entrance` (no JS before paint).
 * The product itself is the second block's job now; the state board moved to
 * /product, where the reference keeps its large app view.
 *
 * [DEV-026] Watched live, not from stills: the pixel field reaches two fifths
 * of the screen and leaves the middle open for a soft light behind the heading
 * (`landing-hero-light`); and the floor answers the pointer — the cell under it
 * lights up and fades (`CellField`, on the floor's own plane, so the browser
 * resolves the perspective). The floor's grid lines stay CSS. [owner, third
 * pass] a lit cell is the accent: «при наведении квадратиков тоже сделать его
 * фиолетовым акцентом».
 */
export function Hero() {
  const h = landingContent.hero;
  return (
    <section id="hero" className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-4 pb-24 pt-32 md:px-8">
      <div aria-hidden="true" className="landing-hero-light -z-10" />
      {/* `calm`: the header (58px + its hairline) is glass over this band at the top of the page — the dots under its links stay dim (B7-01). */}
      <PixelRain calm={64} className="absolute inset-x-0 top-0 -z-10 h-[42%] w-full text-ink" />
      <div aria-hidden="true" className="landing-floor -z-10">
        <div className="landing-floor-plane">
          <CellField pitch={60} track="self" strength={0.16} className="absolute inset-0 h-full w-full text-accent" />
        </div>
      </div>
      <div className="mx-auto grid max-w-[880px] justify-items-center text-center">
        <div className="entrance grid w-full justify-items-center">
          <OrbitText text={h.orbit} className="text-body font-medium text-ink" />
        </div>
        {/* ONE WORD IN THE ACCENT, and it is «доказ» — the word the whole page is
          * about. [2026-09-22] DEV-025 took the accent phrase out of every heading
          * («the muted second line does that work»), and with it the last place the
          * brand's colour appeared above the fold: the first screen then held two
          * orange pill rims and nothing else with a hue, which is why the page read
          * as «orange leads, green structural» to the UI review. `titleAccent` was
          * already in the content and already rendered this way by the OG image;
          * only the live heading ignored it. It is mid-sentence here, so the split
          * is on the word, not on a suffix — and a title that does not contain it
          * renders whole rather than empty. */}
        <h1 className="display mt-2 max-w-[34ch] text-[clamp(42px,3.75vw,54px)] font-normal leading-none tracking-tight text-ink">
          {(() => {
            const at = h.title.indexOf(h.titleAccent);
            if (at < 0) return h.title;
            return (
              <>
                {h.title.slice(0, at)}
                <span className="text-accent">{h.titleAccent}</span>
                {h.title.slice(at + h.titleAccent.length)}
              </>
            );
          })()}
        </h1>
        <div className="entrance [--gp-entrance-delay:0.15s]"><p className="measure mt-6 text-body leading-relaxed text-ink-secondary">{h.lead}</p></div>
        <div className="entrance [--gp-entrance-delay:0.25s] mt-7 flex flex-wrap justify-center gap-3">
          <PillLink href={h.primaryHref}>{h.primaryAction}</PillLink>
          <PillLink href={h.secondaryHref} tone="paper">{h.secondaryAction}</PillLink>
        </div>
      </div>
    </section>
  );
}
