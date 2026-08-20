import Image from "next/image";
import { Reveal, Stagger, StaggerItem, TextBlurIn } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { MockAction } from "../mock-action";

const hero = landingContent.hero;

export function Hero() {
  return (
    <section
      id="product"
      className="relative overflow-hidden px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-36 wide:px-12 wide:pt-40"
    >
      <div className="landing-hero-field absolute inset-x-0 top-0 -z-10 h-[78%]" aria-hidden="true" />
      <div className="mx-auto grid max-w-content items-end gap-14 wide:grid-cols-[0.92fr_1.08fr] wide:gap-8">
        <div className="relative z-10 pb-2 wide:pb-14">
          <Reveal y={0}>
            <p className="index-label mb-6 flex items-center gap-3 text-ink-muted">
              <span className="inline-block size-2 rounded-pill bg-action-signal" aria-hidden="true" />
              {hero.eyebrow}
            </p>
          </Reveal>

          <TextBlurIn
            as="h1"
            text={hero.title}
            className="display max-w-[12ch] text-mkt-display-1 text-ink"
          />

          <Reveal delay={0.16}>
            <p className="measure mt-7 text-mkt-lead leading-relaxed text-ink-muted">{hero.lead}</p>
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

        <Reveal y={24} className="relative">
          <div className="landing-folio relative mx-auto max-w-[670px] pb-6 pl-3 pt-5 md:pl-10 wide:mr-0">
            <div className="landing-blueprint absolute inset-x-10 top-0 h-[88%] rotate-2 rounded-section border border-line bg-subtle" />
            <div className="relative overflow-hidden rounded-section border border-line-strong bg-surface shadow-float">
              <div className="flex items-center justify-between border-b border-line px-4 py-3 md:px-5">
                <p className="index-label text-ink-muted">Польовий доказ · {hero.evidence.id}</p>
                <span className="rounded-pill border border-status-ready-line bg-status-ready px-2.5 py-1 text-micro font-semibold text-status-ready-fg">
                  {hero.evidence.state}
                </span>
              </div>

              <div className="grid md:grid-cols-[1.2fr_0.8fr]">
                <figure className="relative min-h-72 overflow-hidden bg-sunken md:min-h-96">
                  <Image
                    src="/images/cable-tray-evidence.png"
                    alt="Кабельний лоток на будівельному майданчику до закриття конструкції"
                    fill
                    priority
                    loading="eager"
                    sizes="(max-width: 1024px) 90vw, 430px"
                    className="object-cover"
                  />
                  <figcaption className="absolute inset-x-3 bottom-3 rounded-panel border border-line-strong bg-inverse px-3 py-2 text-meta text-on-inverse shadow-overlay">
                    {hero.evidence.place}
                  </figcaption>
                </figure>

                <div className="flex flex-col p-5 md:p-6">
                  <p className="index-label text-ink-muted">Вимога R-041</p>
                  <p className="mt-3 text-h3 font-semibold leading-snug text-ink">
                    {hero.evidence.requirement}
                  </p>
                  <div className="mt-8 space-y-4 border-t border-line pt-5 text-data">
                    <MetaRow label="Автор" value="Майстер дільниці" />
                    <MetaRow label="Час" value="14:32" />
                    <MetaRow label="Джерело" value="Польова вебпрограма" />
                  </div>
                  <p className="mt-auto pt-8 text-meta leading-relaxed text-ink-muted">
                    Рішення має автора, час і посилання на конкретну вимогу.
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-1 right-3 rotate-2 rounded-panel border border-line-strong bg-action-signal px-4 py-3 shadow-raised md:right-8">
              <p className="index-label text-action-signal-fg">Перевірено · DR-0091</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3">
      <span className="text-meta text-ink-muted">{label}</span>
      <span className="text-meta font-medium text-ink">{value}</span>
    </div>
  );
}
