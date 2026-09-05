import { landingContent } from "../../content/landing-content";

export function Route() {
  return (
    <section id="stages" className="scroll-mt-20 px-4 py-16 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <h2 className="display text-mkt-display-2 text-ink">{landingContent.route.title}</h2>
      </div>
    </section>
  );
}
