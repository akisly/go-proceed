import type { ReactNode } from "react";
import Image from "next/image";
import { ScrollStack, ScrollStackCard, ScrollStackMedia } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import photoBlueprint from "../../public/images/photo-blueprint.jpg";
import photoPlanStamped from "../../public/images/photo-plan-stamped.jpg";
import photoSchematic from "../../public/images/photo-schematic.jpg";
import photoSiteTrays from "../../public/images/photo-site-trays.jpg";
import photoTracing from "../../public/images/photo-tracing.jpg";
import { AccentSpan } from "./accent-span";
import { SectionHead } from "./section-head";
import { UiAct } from "../visuals/ui-act";
import { UiCapture } from "../visuals/ui-capture";
import { UiClosure } from "../visuals/ui-closure";
import { UiRequirement } from "../visuals/ui-requirement";
import { UiReview } from "../visuals/ui-review";

const MEDIA: ReactNode[] = [<UiRequirement key="1" />, <UiCapture key="2" />, <UiReview key="3" />, <UiClosure key="4" />, <UiAct key="5" />];

/**
 * The artefact each stage produces or consumes, as that card's ground. The
 * route runs drawing → frame → schematic → stamped plan → loose sheets, which
 * is the same sequence the copy describes, so the ground is the argument and
 * not decoration — the one test §9 of `02-building-ui.md` puts an image to.
 *
 * All five carry the same tone (mean RGB ~225/218/211, sd ~14, measured on
 * `photo-blueprint.jpg` and matched by `qa/grounds.mjs`), so the white UI
 * panel stays the brightest thing in every media half and the per-card glow,
 * which paints above the ground, keeps carrying the per-stage colour.
 */
const GROUND = [photoBlueprint, photoSiteTrays, photoSchematic, photoPlanStamped, photoTracing] as const;

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
 * is tinted and lit per card, each over its stage's artefact (`GROUND`).
 *
 * `heading` is `h1` on /product, the page this block opens (DEV-022).
 */
export function Route({ heading = "h2" }: { heading?: "h1" | "h2" }) {
  const r = landingContent.route;
  // The cards sit one level under the block's heading: no h1 → h3 skip on /product (R-02).
  const CardTitle = heading === "h1" ? "h2" : "h3";
  return (
    <section id="stages" tabIndex={-1} className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead as={heading} eyebrow={r.eyebrow} title={r.title} titleAccent={r.titleAccent} lead={r.lead}>
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
                    <CardTitle className="display max-w-[16ch] text-mkt-display-3 leading-tight tracking-tight text-ink">
                      <AccentSpan text={step.title} accent={step.titleAccent} />
                    </CardTitle>
                    <p className="max-w-[44ch] text-body leading-relaxed text-ink-secondary">{step.body}</p>
                    <p className="mt-auto flex items-center gap-2.5 border-t border-line pt-5 text-data text-ink-muted">
                      <i aria-hidden="true" className="size-3.5 rounded-control border border-line-strong" />{step.note}
                    </p>
                  </div>
                  <div className={flip
                    ? `landing-media-grid relative isolate grid place-items-center overflow-hidden border-t border-line p-5 [perspective:1200px] md:p-10 wide:order-1 wide:border-r wide:border-t-0 ${TINT[i]!}`
                    : `landing-media-grid relative isolate grid place-items-center overflow-hidden border-t border-line p-5 [perspective:1200px] md:p-10 wide:border-l wide:border-t-0 ${TINT[i]!}`}>
                    <Image src={GROUND[i]!} alt="" fill sizes="(min-width: 1240px) 590px, 100vw" className="-z-20 object-cover" />
                    <i aria-hidden="true" className={GLOW[i]!} />
                    <ScrollStackMedia className="w-full max-w-[460px]">{MEDIA[i]}</ScrollStackMedia>
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
