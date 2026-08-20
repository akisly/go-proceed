import { Reveal, Stagger, StaggerItem, TextBlurIn } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { MockAction } from "../mock-action";
import { DashboardSurface } from "./system-dashboard";

const hero = landingContent.hero;

export function Hero() {
  return (
    <section
      id="product"
      className="relative overflow-hidden px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-36 wide:px-12 wide:pt-40"
    >
      <div className="landing-hero-field absolute inset-x-0 top-0 -z-10 h-[68%]" aria-hidden="true" />
      <div className="mx-auto max-w-content">
        <div className="grid items-end gap-8 wide:grid-cols-[1.14fr_0.86fr] wide:gap-20">
          <div className="relative z-10">
          <Reveal y={0}>
            <p className="index-label mb-6 flex items-center gap-3 text-ink-muted">
              <span className="inline-block size-2 rounded-pill bg-action-signal" aria-hidden="true" />
              {hero.eyebrow}
            </p>
          </Reveal>

          <TextBlurIn
            as="h1"
            text={hero.title}
            className="display max-w-[13ch] text-mkt-display-1 text-ink"
          />
          </div>

          <div className="wide:pb-2">
          <Reveal delay={0.16}>
            <p className="measure text-mkt-lead leading-relaxed text-ink-muted">{hero.lead}</p>
          </Reveal>

          <Stagger className="mt-9 flex flex-wrap items-center gap-3">
            <StaggerItem y={8}>
              <MockAction className="min-w-40">{hero.primaryAction}</MockAction>
            </StaggerItem>
            <StaggerItem y={8}>
              <a
                href="#workflow"
                className="inline-flex h-(--gp-control-height-desk) items-center justify-center gap-2 rounded-control px-4 text-data font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-fast ease-out hover:text-link touch:h-(--gp-control-height-touch)"
              >
                {hero.secondaryAction}
                <span aria-hidden="true">↓</span>
              </a>
            </StaggerItem>
          </Stagger>
          </div>
        </div>

        <div className="relative mt-14 md:mt-16">
          <DashboardSurface />
        </div>
      </div>
    </section>
  );
}
