import { Reveal, TextBlurIn } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { MockAction } from "../mock-action";

const content = landingContent.final;

const pilotBrief = [
  { label: "Контур", value: "Один пакет робіт" },
  { label: "Вимоги", value: "Відібрані блокуючі" },
  { label: "Розгляд", value: "Технічний нагляд" },
] as const;

export function FinalCta() {
  return (
    <section className="border-y border-line-inverse bg-inverse px-5 py-20 md:px-8 md:py-24 wide:px-12">
      <div className="mx-auto grid max-w-content items-center gap-12 wide:grid-cols-[1.08fr_0.92fr] wide:gap-24">
        <div>
          <Reveal y={0}>
            <p className="index-label mb-5 flex items-center gap-3 text-on-inverse-muted">
              <span className="inline-block size-2 rounded-pill bg-action-signal" aria-hidden="true" />
              {content.eyebrow}
            </p>
          </Reveal>
          <TextBlurIn
            as="h2"
            text={content.title}
            className="display max-w-[15ch] text-mkt-display-2 text-on-inverse"
          />
          <Reveal delay={0.12}>
            <p className="measure mt-6 text-mkt-lead leading-relaxed text-on-inverse-muted">{content.lead}</p>
          </Reveal>
        </div>

        <Reveal y={18} delay={0.16}>
          <article
            aria-label="Параметри першого пілотного контуру"
            className="overflow-hidden rounded-section border border-line-strong bg-surface shadow-modal"
          >
            <header className="flex items-center gap-3 border-b border-line px-6 py-5 md:px-8">
              <span className="grid size-9 place-items-center rounded-control bg-action text-meta font-semibold text-action-fg">
                GP
              </span>
              <div>
                <p className="text-data font-semibold text-ink">Перший пілотний контур</p>
                <p className="mt-0.5 text-meta text-ink-muted">Робочий бриф · без надсилання даних</p>
              </div>
              <span className="ml-auto rounded-pill border border-status-ready-line bg-status-ready px-2.5 py-1 text-micro font-semibold text-status-ready-fg">
                Готовий до обговорення
              </span>
            </header>

            <dl className="divide-y divide-line px-6 md:px-8">
              {pilotBrief.map((item, index) => (
                <div key={item.label} className="grid grid-cols-[32px_92px_1fr] items-center gap-3 py-4 text-data">
                  <span aria-hidden="true" className="font-mono text-micro text-ink-subtle">0{index + 1}</span>
                  <dt className="text-ink-muted">{item.label}</dt>
                  <dd className="text-right font-medium text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>

            <footer className="border-t border-line bg-subtle p-6 md:p-8">
              <p className="index-label text-ink-muted">Наступна дія</p>
              <p className="mt-2 text-data leading-relaxed text-ink">
                Узгодити межі пакета й пройти один доказовий сценарій разом із командою.
              </p>
              <MockAction className="mt-6 w-full">{content.action}</MockAction>
              <p className="mt-3 text-center text-meta text-ink-muted">{content.note}</p>
            </footer>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
