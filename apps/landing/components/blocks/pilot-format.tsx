import Image from "next/image";
import { Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { MockAction } from "../mock-action";
import { SectionShell } from "../section-shell";

const content = landingContent.pilot;

export function PilotFormat() {
  return (
    <SectionShell id="pilot" eyebrow={content.eyebrow} title={content.title} lead={content.lead} className="bg-canvas">
      <div className="grid overflow-hidden rounded-section border border-line-strong bg-surface shadow-float wide:grid-cols-[0.82fr_1.18fr]">
        <Reveal y={0} className="relative min-h-[520px] overflow-hidden border-b border-line wide:border-b-0 wide:border-r">
          <Image
            src="/images/blueprint-folio.png"
            alt="Технічний аркуш пакета робіт для пілотного контуру"
            fill
            sizes="(max-width: 1240px) 100vw, 500px"
            className="object-cover"
          />
          <div className="absolute inset-x-5 bottom-5 rounded-panel border border-line-strong bg-surface p-5 shadow-overlay md:inset-x-8 md:bottom-8">
            <p className="index-label text-ink-muted">Pilot folio · один пакет робіт</p>
            <p className="mt-3 text-h3 font-semibold text-ink">Електромонтаж · ВРУ-1 · Секція А</p>
            <p className="mt-2 text-meta text-ink-muted">Визначений контур, реальні вимоги, спільний аудит результату</p>
          </div>
        </Reveal>

        <div className="p-6 md:p-10">
          <p className="index-label text-ink-muted">Склад контуру</p>
          <Stagger className="mt-6 divide-y divide-line border-y border-line">
            {content.scope.map((item, index) => (
              <StaggerItem key={item} y={8}>
                <div className="grid grid-cols-[46px_1fr] gap-4 py-4">
                  <span className="font-mono text-meta text-ink-muted">0{index + 1}</span>
                  <span className="text-data font-medium text-ink">{item}</span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <p className="mt-7 text-data leading-relaxed text-ink-muted">{content.result}</p>
          <MockAction className="mt-8 min-w-44">{content.action}</MockAction>
        </div>
      </div>
    </SectionShell>
  );
}
