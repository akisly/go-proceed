import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { UiAct } from "../visuals/ui-act";
import { UiCapture } from "../visuals/ui-capture";
import { UiClosure } from "../visuals/ui-closure";
import { UiRequirement } from "../visuals/ui-requirement";
import { UiReview } from "../visuals/ui-review";
import { StickyList } from "./sticky-list";
import { splitTitle } from "./section-head";
import { TwoTone } from "./two-tone";

const MEDIA: ReactNode[] = [<UiRequirement key="1" />, <UiCapture key="2" />, <UiReview key="3" />, <UiClosure key="4" />, <UiAct key="5" />];

/** Sentences of a step's body — the reference's three short rows under each lead. */
const sentences = (text: string) => text.split(/(?<=\.)\s+/).filter(Boolean);

/**
 * The route. [DEV-023] In the reference's form: a sticky list of the five steps
 * at left that marks the one in view; beside it, for each step, a label, a lead
 * whose first clause is ink and the rest muted, short rows divided by
 * hairlines, and a large rounded card holding that step's UI window.
 *
 * Until DEV-023 this was Fora's pinned card stack (`ScrollStack`). The windows
 * and the copy are the same; only the composition changed, with the owner's
 * «1 в 1». `heading` is `h1` on /product, the page this block opens (DEV-022),
 * and the step titles sit one level under it.
 */
export function Route({ heading = "h2" }: { heading?: "h1" | "h2" }) {
  const r = landingContent.route;
  const StepTitle = heading === "h1" ? "h2" : "h3";
  const title = splitTitle(r.title, r.titleAccent);
  const items = r.steps.map((step) => ({ id: `step-${step.index}`, label: step.eyebrow }));
  return (
    <section id="stages" tabIndex={-1} className="landing-inset scroll-mt-20 py-20 md:py-24">
      <TwoTone as={heading} lead={title.lead} rest={title.rest} />
      <Reveal size="stately">
        <p className="mt-6 flex flex-wrap gap-1.5">
          {r.codes.map((c) => (
            <span key={c.code} className="rounded-pill border border-line bg-surface px-3 py-1 text-meta text-ink-muted">
              <b className="mr-1.5 font-mono font-medium text-ink">{c.code}</b>{c.label}
            </span>
          ))}
        </p>
      </Reveal>
      <div className="mt-16 grid gap-10 wide:mt-24 wide:grid-cols-[200px_minmax(0,1fr)]">
        <StickyList label={r.eyebrow} items={items} />
        <div className="grid gap-16 wide:gap-32">
          {r.steps.map((step, i) => (
            <article key={step.index} id={`step-${step.index}`} data-route-step={step.index} className="grid scroll-mt-28 gap-8 wide:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] wide:gap-12">
              <Reveal size="stately">
                <p className="text-data text-ink-muted"><span className="mr-2 font-mono text-ink-muted">{step.index}</span>{step.eyebrow}</p>
                <div className="mt-5 text-h3 leading-snug tracking-tight text-ink-muted">
                  <StepTitle className="inline font-medium text-ink">{step.title}.</StepTitle>{" "}
                  <p className="inline">{step.note}</p>
                </div>
                <ul className="mt-10 grid wide:mt-16">
                  {sentences(step.body).map((line) => (
                    <li key={line} className="flex items-start gap-3 border-t border-line py-3.5 text-body text-ink-secondary first:border-t-0">
                      <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-ink-muted" strokeWidth={1.6} />{line}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal size="stately">
                <div data-route-card="" className="grid min-h-[380px] place-items-center overflow-hidden rounded-section border border-line-strong bg-canvas p-5 md:p-10 wide:min-h-[520px]">
                  {MEDIA[i]}
                </div>
              </Reveal>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
