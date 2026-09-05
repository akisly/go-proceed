import type { ReactNode } from "react";
import { Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { AccentText } from "./accent-text";
import { SectionHead } from "./section-head";
import { UiAct } from "../visuals/ui-act";
import { UiCapture } from "../visuals/ui-capture";
import { UiClosure } from "../visuals/ui-closure";
import { UiRequirement } from "../visuals/ui-requirement";
import { UiReview } from "../visuals/ui-review";

const MEDIA: ReactNode[] = [<UiRequirement key="1" />, <UiCapture key="2" />, <UiReview key="3" />, <UiClosure key="4" />, <UiAct key="5" />];

/** Fora's sticky feature stack: five cards, sides alternating, each pinned under the header on wide screens (CSS only). */
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
        <Stagger className="grid gap-4">
          {r.steps.map((step, i) => {
            const flip = i % 2 === 1;
            return (
              <StaggerItem key={step.index}>
                <article
                  data-route-card={flip ? "flip" : "card"}
                  className="landing-route-card grid overflow-hidden rounded-surface border border-line-strong bg-surface shadow-float wide:min-h-[min(600px,calc(100vh-130px))] wide:grid-cols-2"
                >
                  <div className={flip ? "flex flex-col gap-4 p-6 md:p-10 wide:order-2" : "flex flex-col gap-4 p-6 md:p-10"}>
                    <p className="flex items-center gap-2.5">
                      <span className="rounded-control border border-line-strong px-1.5 py-0.5 font-mono text-meta tracking-wide text-ink-muted">{step.index}</span>
                      <span className="index-label">{step.eyebrow}</span>
                    </p>
                    <h3 className="display max-w-[16ch] text-mkt-display-3 leading-tight tracking-tight text-ink">
                      <AccentText text={step.title} accent={step.titleAccent} />
                    </h3>
                    <p className="max-w-[44ch] text-body leading-relaxed text-ink-secondary">{step.body}</p>
                    <p className="mt-auto flex items-center gap-2.5 border-t border-line pt-5 text-data text-ink-muted">
                      <i aria-hidden="true" className="size-3.5 rounded-control border border-line-strong" />{step.note}
                    </p>
                  </div>
                  <div className={flip
                    ? "landing-media-grid relative isolate grid place-items-center border-t border-line bg-subtle p-5 md:p-10 wide:order-1 wide:border-r wide:border-t-0"
                    : "landing-media-grid relative isolate grid place-items-center border-t border-line bg-subtle p-5 md:p-10 wide:border-l wide:border-t-0"}>
                    {MEDIA[i]}
                  </div>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
