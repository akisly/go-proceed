import { Reveal, TextBlurIn } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { MockAction } from "../mock-action";

const content = landingContent.final;

export function FinalCta() {
  return (
    <section className="overflow-hidden bg-inverse px-5 py-20 md:px-8 md:py-28 wide:px-12">
      <div className="landing-blueprint relative mx-auto max-w-content overflow-hidden rounded-section border border-line-inverse px-6 py-12 md:px-12 md:py-16 wide:px-16 wide:py-20">
        <div className="absolute -right-16 -top-16 size-48 rounded-pill border border-line-inverse" aria-hidden="true" />
        <div className="absolute -bottom-24 right-24 size-56 rounded-pill border border-line-inverse" aria-hidden="true" />

        <div className="relative z-10 max-w-[920px]">
          <Reveal y={0}>
            <p className="index-label mb-5 flex items-center gap-3 text-on-inverse-muted">
              <span className="inline-block size-2 rounded-pill bg-action-signal" aria-hidden="true" />
              {content.eyebrow}
            </p>
          </Reveal>
          <TextBlurIn
            as="h2"
            text={content.title}
            className="display max-w-[16ch] text-mkt-display-2 text-on-inverse"
          />
          <Reveal delay={0.12}>
            <p className="measure mt-6 text-mkt-lead leading-relaxed text-on-inverse-muted">{content.lead}</p>
          </Reveal>
          <Reveal delay={0.18} className="mt-9 flex flex-wrap items-center gap-4">
            <MockAction className="min-w-44">{content.action}</MockAction>
            <p className="text-meta text-on-inverse-muted">{content.note}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
