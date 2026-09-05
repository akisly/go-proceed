import { landingContent } from "../../content/landing-content";

export function Hero() {
  return (
    <section id="hero" className="scroll-mt-20 px-4 py-16 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <h1 className="display text-mkt-display-2 text-ink">{landingContent.hero.title}</h1>
      </div>
    </section>
  );
}
