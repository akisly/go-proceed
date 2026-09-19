import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { UiAct } from "../visuals/ui-act";
import { UiCapture } from "../visuals/ui-capture";
import { UiReview } from "../visuals/ui-review";
import { SectionHead } from "./section-head";

const MEDIA = {
  capture: <UiCapture />,
  review: <UiReview />,
  act: <UiAct />,
} as const satisfies Record<(typeof landingContent.scenes.items)[number]["id"], ReactNode>;

/** One ground and one glow per scene, as literal class strings — the route cards' own (route.tsx). */
const TINT = ["media-tint-2", "media-tint-3", "media-tint-5"] as const;
const GLOW = [
  "media-glow media-glow-sand -left-[20%] -top-[30%]",
  "media-glow media-glow-green -right-[20%] -top-[25%]",
  "media-glow media-glow-cobalt -left-[20%] -bottom-[30%]",
] as const;

/**
 * The home page's product block (DEV-022): three of the route's five moments,
 * copy beside the live UI window, sides alternating. It is the short form of
 * the sticky stack on /product — the same windows, no pinning and no scroll
 * source — so the home page shows the product without walking the whole route.
 *
 * Open rows on the page's own ground, not cards: /product's stack is the card
 * composition, and two of those in a row would read as one long list.
 *
 * TWO `Reveal`s per row, the copy's and the media's (U-01). Below `wide` a row
 * is one column some 1 000px tall, and `Reveal` fires at 35 % in view: one
 * wrapper around the whole row left a blank fold under the section head until
 * a third of that height had scrolled in — under reduced motion as well.
 *
 * The scene titles carry no accent (U-05): the rows are unpinned, so two of
 * them share a fold with the section h2, and DESIGN.md rations cobalt to one
 * mark per screen's worth of attention.
 */
export function Scenes() {
  const s = landingContent.scenes;
  return (
    <section id="scenes" tabIndex={-1} className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={s.eyebrow} title={s.title} titleAccent={s.titleAccent} lead={s.lead} />
        <div className="grid gap-14 md:gap-20">
          {s.items.map((scene, i) => {
            const flip = i % 2 === 1;
            return (
              <article key={scene.id} data-scene={scene.id} className="grid items-center gap-8 wide:grid-cols-2 wide:gap-16">
                <Reveal size="stately" className={flip ? "wide:order-2" : ""}>
                  <div className="grid gap-4">
                    <p className="index-label">{scene.eyebrow}</p>
                    <h3 className="display max-w-[24ch] text-mkt-display-3 leading-tight tracking-tight text-ink">{scene.title}</h3>
                    <p className="max-w-[46ch] text-body leading-relaxed text-ink-secondary">{scene.body}</p>
                    <p className="flex items-center gap-2.5 border-t border-line pt-4 text-data text-ink-muted">
                      <i aria-hidden="true" className="size-3.5 rounded-control border border-line-strong" />{scene.note}
                    </p>
                  </div>
                </Reveal>
                <Reveal size="stately" className={flip ? "wide:order-1" : ""}>
                  <div className={`landing-media-grid relative isolate grid place-items-center overflow-hidden rounded-surface border border-line-strong p-5 md:p-10 ${TINT[i]!}`}>
                    <i aria-hidden="true" className={GLOW[i]!} />
                    {MEDIA[scene.id]}
                  </div>
                </Reveal>
              </article>
            );
          })}
        </div>
        <Reveal size="stately" className="mt-12 flex justify-center">
          <Link href={s.more.href} className="inline-flex min-h-11 items-center gap-1.5 text-data font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-fast ease-out hover:decoration-ink">
            {s.more.label}<ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.6} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
