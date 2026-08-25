import { ArrowDown } from "lucide-react";
import { landingContent } from "../../content/landing-content";
import { LiveDossier } from "../visuals/live-dossier";

const hero = landingContent.hero;
const [titleBeforeAccent, titleAfterAccent] = hero.title.split(hero.titleAccent);

export function Hero() {
  return (
    <section
      id="product"
      className="relative overflow-hidden px-5 pb-20 pt-28 md:px-8 md:pb-28 md:pt-36 wide:px-12"
    >
      <div
        className="landing-hero-field absolute inset-0 -z-10"
        aria-hidden="true"
        data-hero-grid-flow="true"
      />
      <div className="mx-auto max-w-content">
        <div
          className="flex flex-col items-center text-center"
          data-hero-alignment="center"
          data-hero-copy-stack="true"
        >
          <h1 className="display max-w-[40ch] text-mkt-display-2 text-ink">
            {titleBeforeAccent}
            <span className="landing-hero-accent" data-hero-accent="true">
              {hero.titleAccent}
            </span>
            {titleAfterAccent}
          </h1>

          <p
            className="measure mt-7 max-w-[68ch] text-mkt-lead leading-relaxed text-ink-muted"
            data-hero-description="true"
          >
            {hero.lead}
          </p>

          <div
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
            data-hero-actions="true"
          >
            <a
              href="#pilot"
              className="inline-flex min-h-11 items-center justify-center rounded-control bg-action-signal px-5 text-data font-semibold text-action-signal-fg transition-colors duration-fast ease-out hover:bg-action-signal-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {hero.primaryAction}
            </a>
            <a
              href="#workflow"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-data font-semibold text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-fast ease-out hover:text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {hero.secondaryAction}
              <ArrowDown aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </a>
          </div>
        </div>

        <div className="mt-12 md:mt-16">
          <LiveDossier />
        </div>
      </div>
    </section>
  );
}
