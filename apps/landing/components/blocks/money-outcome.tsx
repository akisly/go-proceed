import { Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionShell } from "../section-shell";

const content = landingContent.outcome;

export function MoneyOutcome() {
  return (
    <SectionShell eyebrow={content.eyebrow} title={content.title} lead={content.lead} className="bg-canvas">
      <Reveal y={0}>
        <div className="landing-paper-grid overflow-hidden rounded-section border border-line-strong bg-surface">
          <Stagger className="grid md:grid-cols-2 wide:grid-cols-4">
            {content.equation.map((item, index) => (
              <StaggerItem
                key={item.value}
                className="relative min-h-52 border-b border-line p-6 md:[&:nth-child(odd)]:border-r wide:border-b-0 wide:border-r wide:last:border-r-0 wide:p-8"
              >
                <p className="tabular text-mkt-display-3 font-semibold text-ink">{item.value}</p>
                <p className="mt-12 max-w-[20ch] text-body font-medium leading-relaxed text-ink">{item.label}</p>
                {index < content.equation.length - 1 && (
                  <span aria-hidden="true" className="absolute bottom-6 right-6 text-h3 text-ink-subtle wide:top-8">↘</span>
                )}
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Reveal>
    </SectionShell>
  );
}
