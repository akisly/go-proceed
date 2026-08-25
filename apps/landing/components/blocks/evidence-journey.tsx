import { landingContent } from "../../content/landing-content";
import { MarkerText } from "../marker-text";
import { EvidenceJourneyClient } from "./evidence-journey-client";

export function EvidenceJourney() {
  return (
    <section id="workflow" className="scroll-mt-24 bg-subtle px-5 py-20 md:px-8 md:py-28 wide:px-12">
      <div className="mx-auto max-w-content">
        <header className="grid gap-6 border-b border-line-strong pb-10 wide:grid-cols-[1fr_0.72fr] wide:items-end">
          <h2
            className="display max-w-[28ch] text-mkt-display-2 text-ink"
            data-section-heading-width="wide"
          >
            <MarkerText
              accent={landingContent.journey.titleAccent}
              text={landingContent.journey.title}
            />
          </h2>
          <p className="measure max-w-[58ch] text-body leading-relaxed text-ink-muted wide:justify-self-end">
            {landingContent.journey.lead}
          </p>
        </header>

        <EvidenceJourneyClient chapters={landingContent.journey.chapters} />
      </div>
    </section>
  );
}
