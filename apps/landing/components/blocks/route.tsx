import type { ReactNode } from "react";
import Image from "next/image";
import { ScrollStack, ScrollStackCard, ScrollStackMedia, Tilt } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import photoBlueprint from "../../public/images/photo-blueprint.jpg";
import { SectionHead } from "./section-head";
import { UiAct } from "../visuals/ui-act";
import { UiCapture } from "../visuals/ui-capture";
import { UiClosure } from "../visuals/ui-closure";
import { UiRequirement } from "../visuals/ui-requirement";
import { UiReview } from "../visuals/ui-review";

const MEDIA: ReactNode[] = [<UiRequirement key="1" />, <UiCapture key="2" />, <UiReview key="3" />, <UiClosure key="4" />, <UiAct key="5" />];

/** The prototype's five media grounds and glows (index.html l.247–253), as literal class strings per card. */
const TINT = ["media-tint-1", "media-tint-2", "media-tint-3", "media-tint-4", "media-tint-5"] as const;
const GLOW = [
  "media-glow media-glow-cobalt -right-[20%] -bottom-[30%]",
  "media-glow media-glow-sand -left-[20%] -top-[30%]",
  "media-glow media-glow-green -right-[20%] -top-[25%]",
  "media-glow media-glow-cobalt -left-[20%] -bottom-[30%]",
  "media-glow media-glow-sand -right-[15%] -bottom-[25%]",
] as const;

/**
 * Fora's sticky feature stack, as the prototype performs it: `ScrollStack`
 * pins each card under the header on wide screens, shrinks and veils it as the
 * next arrives, and drifts the UI panel inside the media half; the media half
 * is tinted and lit per card, card 1 over the blueprint photograph.
 */
export function Route() {
  const r = landingContent.route;
  return (
    <section id="stages" className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={r.eyebrow} title={r.title} titleAccent={r.titleAccent} lead={r.lead}>
          <p className="mt-4 flex flex-wrap gap-1.5">
            {r.codes.map((c) => (
              <span key={c.code} className="rounded-control border border-line bg-surface px-2.5 py-1 text-meta text-ink-muted">
                <b className="mr-1.5 font-mono font-medium text-ink">{c.code}</b>{c.label}
              </span>
            ))}
          </p>
        </SectionHead>
        <ScrollStack className="grid gap-4">
          {r.steps.map((step, i) => {
            const flip = i % 2 === 1;
            return (
              <ScrollStackCard key={step.index} index={i} count={r.steps.length}>
                <article
                  data-route-card={flip ? "flip" : "card"}
                  className="grid overflow-hidden rounded-surface border border-line-strong bg-surface shadow-float wide:min-h-[min(600px,calc(100vh-130px))] wide:grid-cols-2"
                >
                  <div className={flip ? "flex flex-col gap-4 p-6 md:p-10 wide:order-2" : "flex flex-col gap-4 p-6 md:p-10"}>
                    <p className="flex items-center gap-2.5">
                      <span className="rounded-control border border-line-strong px-1.5 py-0.5 font-mono text-meta tracking-wide text-ink-muted">{step.index}</span>
                      <span className="index-label">{step.eyebrow}</span>
                    </p>
                    <h3 className="display max-w-[16ch] text-mkt-display-3 leading-tight tracking-tight text-ink">
                      <AccentSpan text={step.title} accent={step.titleAccent} />
                    </h3>
                    <p className="max-w-[44ch] text-body leading-relaxed text-ink-secondary">{step.body}</p>
                    <p className="mt-auto flex items-center gap-2.5 border-t border-line pt-5 text-data text-ink-muted">
                      <i aria-hidden="true" className="size-3.5 rounded-control border border-line-strong" />{step.note}
                    </p>
                  </div>
                  <div className={flip
                    ? `landing-media-grid relative isolate grid place-items-center overflow-hidden border-t border-line p-5 [perspective:1200px] md:p-10 wide:order-1 wide:border-r wide:border-t-0 ${TINT[i]!}`
                    : `landing-media-grid relative isolate grid place-items-center overflow-hidden border-t border-line p-5 [perspective:1200px] md:p-10 wide:border-l wide:border-t-0 ${TINT[i]!}`}>
                    {i === 0 && <Image src={photoBlueprint} alt="" fill sizes="(min-width: 1240px) 590px, 100vw" className="-z-20 object-cover" />}
                    <i aria-hidden="true" className={GLOW[i]!} />
                    <ScrollStackMedia className="w-full max-w-[460px] [transform-style:preserve-3d]">
                      {/* The mock leans toward the pointer like the hero's board.
                        * The media half already carries `[perspective:1200px]`;
                        * `ScrollStackMedia` transforms, so it needs preserve-3d
                        * or the chain flattens between the two. */}
                      <Tilt maxX={2.5} maxY={3} className="grid">{MEDIA[i]}</Tilt>
                    </ScrollStackMedia>
                  </div>
                </article>
              </ScrollStackCard>
            );
          })}
        </ScrollStack>
      </div>
    </section>
  );
}

/** The card's h3 is NOT a `.lines` heading in the prototype (l.826): the card itself enters, the accent is static. */
function AccentSpan({ text, accent }: { text: string; accent: string }) {
  const at = text.indexOf(accent);
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<span className="text-accent" data-accent="true">{accent}</span>{text.slice(at + accent.length)}</>;
}
