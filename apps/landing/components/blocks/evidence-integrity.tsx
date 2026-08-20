import Image from "next/image";
import { NodeLock, Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionShell } from "../section-shell";

const content = landingContent.integrity;

export function EvidenceIntegrity() {
  return (
    <SectionShell eyebrow={content.eyebrow} title={content.title} lead={content.lead} className="bg-canvas">
      <Reveal y={16}>
        <article
          aria-label="Квитанція походження доказу EV-0248"
          className="relative overflow-hidden rounded-section border border-line-strong bg-surface shadow-float"
        >
          <header className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 md:px-8">
            <p className="index-label text-ink-muted">Evidence receipt · EV-0248</p>
            <span className="ml-auto rounded-pill border border-status-ready-line bg-status-ready px-3 py-1 text-meta font-semibold text-status-ready-fg">
              Доказ прийнято
            </span>
          </header>

          <div className="grid wide:grid-cols-[1fr_320px]">
            <dl className="grid md:grid-cols-2">
              {content.receipt.map((row, index) => (
                <div key={row.label} className="min-h-28 border-b border-line px-5 py-5 md:border-r md:px-8">
                  <dt className="index-label text-ink-muted">0{index + 1} · {row.label}</dt>
                  <dd className="mt-3 text-body font-medium text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="landing-paper-grid flex min-h-[420px] flex-col justify-between bg-subtle p-6 md:p-8">
              <div>
                <p className="index-label text-ink-muted">Ланцюг подій</p>
                <ol className="mt-6 space-y-5 border-l border-line-strong pl-5">
                  <li className="text-data text-ink">14:32 · матеріал додано</li>
                  <li className="text-data text-ink">14:33 · походження зафіксовано</li>
                  <li className="text-data text-ink">16:18 · рішення прийнято</li>
                  <li className="text-data text-ink">16:19 · закриття дозволено</li>
                </ol>
              </div>
              <NodeLock index={1} className="mt-10">
                <Image
                  src="/images/verified-stamp.png"
                  alt="Графічна печатка перевіреного доказу"
                  width={260}
                  height={109}
                  sizes="260px"
                  className="h-auto w-full max-w-[260px]"
                />
              </NodeLock>
            </div>
          </div>
        </article>
      </Reveal>
    </SectionShell>
  );
}
