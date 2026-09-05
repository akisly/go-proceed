import { landingContent } from "../../content/landing-content";

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 px-4 py-16 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <h2 className="display text-mkt-display-2 text-ink">{landingContent.faq.title}</h2>
      </div>
    </section>
  );
}
