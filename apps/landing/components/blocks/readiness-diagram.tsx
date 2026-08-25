import { landingContent } from "../../content/landing-content";
import { ReadinessMap } from "../visuals/readiness-map";

export function ReadinessDiagram() {
  const content = landingContent.readiness;

  return (
    <section id="readiness" className="scroll-mt-24 bg-canvas px-5 py-20 md:px-8 md:py-28 wide:px-12">
      <div className="mx-auto max-w-content">
        <header className="grid gap-6 wide:grid-cols-[1fr_0.7fr] wide:items-end">
          <h2 className="display max-w-[21ch] text-mkt-display-2 text-ink">{content.title}</h2>
          <p className="measure max-w-[58ch] text-body leading-relaxed text-ink-muted wide:justify-self-end">{content.lead}</p>
        </header>

        <div className="mt-14 border-y border-line-strong">
          <ReadinessMap />
        </div>
      </div>
    </section>
  );
}
