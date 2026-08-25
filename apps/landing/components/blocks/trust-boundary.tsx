import Image from "next/image";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { landingContent } from "../../content/landing-content";
import { MarkerText } from "../marker-text";

export function TrustBoundary() {
  const content = landingContent.trust;

  return (
    <section id="trust" className="scroll-mt-24 bg-subtle px-5 py-20 md:px-8 md:py-28 wide:px-12">
      <div className="mx-auto max-w-content">
        <header className="grid gap-6 wide:grid-cols-[1fr_0.72fr] wide:items-end">
          <h2
            className="display max-w-[28ch] text-mkt-display-2 text-ink"
            data-section-heading-width="wide"
          >
            <MarkerText accent={content.titleAccent} text={content.title} />
          </h2>
          <p className="measure max-w-[58ch] text-body leading-relaxed text-ink-muted wide:justify-self-end">{content.lead}</p>
        </header>

        <div className="mt-14 grid gap-8 wide:grid-cols-[1.15fr_0.85fr]">
          <article aria-label="Квитанція походження EV-0248" className="overflow-hidden border border-line-strong bg-surface shadow-float">
            <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 md:px-7">
              <ShieldCheck aria-hidden="true" className="size-5 text-status-ready-fg" strokeWidth={1.75} />
              <p className="index-label text-ink-muted">Evidence receipt · EV-0248</p>
              <span className="ml-auto rounded-pill border border-status-ready-line bg-status-ready px-3 py-1 text-micro font-semibold text-status-ready-fg">
                Доказ прийнято
              </span>
            </header>
            <div className="grid md:grid-cols-[1fr_260px]">
              <dl className="grid sm:grid-cols-2">
                {content.receipt.map((item, index) => (
                  <div key={item.label} className="min-h-24 border-b border-line px-5 py-5 sm:border-r md:px-7">
                    <dt className="index-label text-ink-muted">{String(index + 1).padStart(2, "0")} · {item.label}</dt>
                    <dd className="mt-3 text-data font-semibold text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="landing-paper-grid flex flex-col justify-between border-t border-line bg-subtle p-6 md:border-l md:border-t-0">
                <div>
                  <p className="index-label text-ink-muted">Ланцюг подій</p>
                  <ol className="mt-6 space-y-4 border-l border-line-strong pl-5">
                    {content.timeline.map((event) => (
                      <li key={event} className="text-meta text-ink">{event}</li>
                    ))}
                  </ol>
                </div>
                <Image
                  src="/images/verified-stamp.png"
                  alt="Графічна печатка перевіреного доказу"
                  width={260}
                  height={109}
                  sizes="260px"
                  className="mt-8 h-auto w-full max-w-[220px]"
                />
              </div>
            </div>
          </article>

          <div className="grid content-start border-y border-line-strong">
            <section className="py-7">
              <h3 className="text-h3 font-semibold text-ink">Працює у поточному контурі</h3>
              <ul className="mt-5 divide-y divide-line">
                {content.current.map((item) => (
                  <li key={item} className="flex gap-3 py-4 text-data text-ink">
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-status-ready-fg" strokeWidth={2} />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
            <section className="border-t border-line-strong py-7">
              <h3 className="text-h3 font-semibold text-ink">Не заявляємо</h3>
              <ul className="mt-5 divide-y divide-line">
                {content.notClaims.map((item) => (
                  <li key={item} className="flex gap-3 py-4 text-data leading-relaxed text-ink-muted">
                    <Minus aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
