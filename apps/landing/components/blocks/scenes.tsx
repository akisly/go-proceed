import type { ReactNode } from "react";
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { MiniAct, MiniCapture, MiniReview } from "../visuals/mini";
import { TwoTone } from "./two-tone";

const MEDIA = {
  capture: <MiniCapture />,
  review: <MiniReview />,
  act: <MiniAct />,
} as const satisfies Record<(typeof landingContent.scenes.items)[number]["id"], ReactNode>;

/**
 * The home page's product block. [DEV-025] In the reference's form: a two-tone
 * heading over three tall cards, each on a grid ground that fades toward its
 * foot, a small product widget floating in the middle and a caption at the
 * bottom — the title in ink, the sentence after it muted.
 *
 * Three of the route's five moments, one per argument the payer weighs
 * (DEV-024); the whole route is /product's sticky list.
 *
 * ONE `Reveal` PER CARD, not one `Stagger` round the three (R-02, and DEV-024's
 * U-01 before it). Below `wide` the cards stack into a column some 1 300px tall,
 * and an entrance keyed to a fraction of THAT leaves a blank fold under the
 * heading until a quarter of it has scrolled in — under reduced motion too.
 *
 * [DEV-026] A card answers the pointer as the reference's do: its ground
 * brightens and its border firms, its grid comes up (`landing-gridcard`), and
 * the widget inside lifts and parts (`group/scene`, read by `visuals/mini`).
 */
export function Scenes() {
  const s = landingContent.scenes;
  return (
    <section id="scenes" tabIndex={-1} className="landing-inset scroll-mt-20 py-20 md:py-24">
      <TwoTone lead={s.headLead} rest={s.headRest} className="mb-12 md:mb-16" />
      <div className="grid gap-4 wide:grid-cols-3">
        {s.items.map((scene) => (
          <Reveal key={scene.id} size="stately" className="grid">
            <article data-scene={scene.id} className="landing-gridcard group/scene relative isolate grid min-h-[420px] grid-rows-[1fr_auto] overflow-hidden rounded-section border border-line-strong bg-canvas transition-colors duration-slow ease-out hover:border-ink-muted hover:bg-surface wide:min-h-[520px]">
              <div className="grid place-items-center overflow-hidden px-4 py-10">{MEDIA[scene.id]}</div>
              <div className="px-5 pb-6">
                <p className="index-label mb-2">{scene.eyebrow}</p>
                <div className="text-body leading-relaxed text-ink-muted">
                  <h3 className="inline font-medium text-ink">{scene.title}.</h3>{" "}
                  <p className="inline">{scene.body}</p>
                </div>
                <p className="mt-3 border-t border-line pt-3 text-data text-ink-muted">{scene.note}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
