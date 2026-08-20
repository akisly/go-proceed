import Image from "next/image";
import { Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionShell } from "../section-shell";

const content = landingContent.field;

export function FieldMobile() {
  return (
    <SectionShell
      eyebrow={content.eyebrow}
      title={content.title}
      lead={content.lead}
      inverse
      className="relative overflow-hidden bg-inverse"
    >
      <div className="grid items-center gap-14 wide:grid-cols-[0.82fr_1.18fr]">
        <div>
          <div className="rounded-panel border border-line-inverse bg-inverse p-5">
            <p className="index-label text-on-inverse-muted">Умова поточного контуру</p>
            <p className="mt-3 text-data leading-relaxed text-on-inverse">{content.connectionNote}</p>
          </div>
          <Stagger className="mt-8 space-y-3">
            {content.checklist.map((item, index) => (
              <StaggerItem key={item} y={8}>
                <div className="flex items-center gap-4 border-t border-line-inverse py-4 text-on-inverse">
                  <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-action-signal font-mono text-micro font-semibold text-action-signal-fg">
                    0{index + 1}
                  </span>
                  <span className="text-data font-medium">{item}</span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <Reveal y={20} className="relative mx-auto w-full max-w-[700px]">
          <div className="landing-blueprint absolute inset-8 rotate-2 rounded-section border border-line-inverse bg-inverse" />
          <div role="region" aria-label="Польовий застосунок" className="relative mx-auto max-w-[390px] overflow-hidden rounded-section border border-line-inverse bg-surface shadow-modal">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span className="grid size-8 place-items-center rounded-control bg-action text-micro font-semibold text-action-fg">GP</span>
              <span>
                <span className="block text-meta font-semibold text-ink">Польовий застосунок</span>
                <span className="block text-micro text-ink-muted">ВРУ-1 · Секція А</span>
              </span>
              <span className="ml-auto size-2 rounded-pill bg-action-signal" aria-label="З’єднання активне" />
            </div>
            <div className="relative aspect-[4/5] overflow-hidden bg-sunken">
              <Image
                src="/images/cable-tray-evidence.png"
                alt="Кадр кабельної траси у мобільному сценарії фіксації"
                fill
                sizes="390px"
                className="object-cover"
              />
              <div className="absolute inset-x-4 bottom-4 rounded-panel border border-line-strong bg-surface p-4 shadow-overlay">
                <p className="index-label text-ink-muted">Вимога R-041</p>
                <p className="mt-2 text-data font-semibold text-ink">Вузол кріплення крупним планом</p>
                <div className="mt-4 h-2 overflow-hidden rounded-pill bg-sunken">
                  <div className="h-full w-2/3 rounded-pill bg-action-signal" />
                </div>
                <p className="mt-2 text-meta text-ink-muted">2 з 3 матеріалів додано</p>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                  <span className="text-meta font-medium text-ink">Камера готова</span>
                  <span aria-hidden="true" className="grid size-11 place-items-center rounded-pill border-4 border-action bg-surface">
                    <span className="size-5 rounded-pill bg-action" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  );
}
