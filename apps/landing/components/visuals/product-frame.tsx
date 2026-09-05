import { Reveal, ScrollSettle, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { demoRecords } from "../../content/demo-records";
import { landingContent } from "../../content/landing-content";
import { Board } from "./board";
import { Receipt } from "./receipt";

/** 21st.dev's Container Scroll: the board settles into the page; the receipt and two pills sit over it. */
export function ProductFrame() {
  const pills = demoRecords.receipt.pills;
  return (
    <Reveal delay={0.35} className="mt-11 md:mt-16">
      <ScrollSettle className="pb-4 md:pb-24">
        <div className="relative mx-auto max-w-[1040px]">
          <Board />
          <Receipt />
          <Stagger step="loose" className="hidden md:contents">
            <StaggerItem className="absolute -bottom-9 left-0 whitespace-nowrap rounded-pill border border-line-strong bg-surface px-3 py-1.5 text-data text-ink-secondary shadow-overlay">
              <b className="font-medium text-ink">{pills[0]!.lead}</b> {pills[0]!.text}
            </StaggerItem>
            <StaggerItem className="absolute -top-12 left-0 whitespace-nowrap rounded-pill border border-line-strong bg-surface px-3 py-1.5 text-data text-ink-secondary shadow-overlay">
              {pills[1]!.text}<b className="font-medium text-ink">{pills[1]!.lead}</b>
            </StaggerItem>
          </Stagger>
        </div>
        <p aria-hidden="true" className="mt-24 hidden items-center gap-2.5 font-mono text-micro uppercase tracking-wide text-ink-subtle md:flex">
          <span className="h-px flex-1 bg-line-strong" />
          {landingContent.hero.dimension}
          <span className="h-px flex-1 bg-line-strong" />
        </p>
      </ScrollSettle>
    </Reveal>
  );
}
