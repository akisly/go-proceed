import Image from "next/image";
import { Camera, Check, FileText, MapPin, ShieldCheck } from "lucide-react";
import { landingContent } from "../../content/landing-content";
import { BrandMark } from "../brand-mark";

const dossier = landingContent.hero.dossier;

const captures = [
  "Загальний вигляд траси",
  "Вузол кріплення крупним планом",
  "Маркування кабельної лінії",
] as const;

export function LiveDossier() {
  return (
    <figure
      aria-label="Досьє доказу EV-0248"
      className="overflow-hidden rounded-section border border-line-strong bg-surface shadow-float"
    >
      <header className="flex min-h-14 items-center gap-3 border-b border-line px-4 md:px-6">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-pill bg-status-blocked-fg" />
          <span className="size-2.5 rounded-pill bg-status-attention-fg" />
          <span className="size-2.5 rounded-pill bg-status-ready-fg" />
        </span>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        <BrandMark className="size-5" />
        <span className="text-meta font-semibold text-ink">{dossier.project}</span>
        <span className="index-label ml-auto hidden text-ink-subtle md:block">
          Demo dossier · GP-2026-014
        </span>
      </header>

      <div className="grid wide:grid-cols-[1.08fr_0.92fr]">
        <div className="min-w-0 border-b border-line wide:border-b-0 wide:border-r">
          <div className="flex flex-wrap items-start gap-5 border-b border-line px-5 py-6 md:px-8">
            <div className="min-w-0 flex-1">
              <p className="index-label text-ink-muted">{dossier.workCode} · поточна робота</p>
              <h2 className="mt-3 text-h2 font-semibold tracking-tight text-ink">{dossier.work}</h2>
              <p className="mt-2 flex items-center gap-2 text-meta text-ink-muted">
                <MapPin aria-hidden="true" className="size-4" strokeWidth={1.75} />
                {dossier.place}
              </p>
            </div>
            <span className="rounded-pill border border-status-review-line bg-status-review px-3 py-1.5 text-meta font-semibold text-status-review-fg">
              {dossier.state}
            </span>
          </div>

          <div className="grid md:grid-cols-[0.82fr_1.18fr]">
            <section aria-label="Вимога R-041" className="border-b border-line p-5 md:border-b-0 md:border-r md:p-8">
              <p className="index-label text-ink-muted">Вимога · {dossier.requirementCode}</p>
              <p className="mt-4 text-h3 font-semibold leading-snug text-ink">{dossier.requirement}</p>
              <div className="mt-7 border-t border-line pt-4">
                <p className="text-meta text-ink-muted">Момент контролю</p>
                <p className="mt-1.5 text-data font-medium text-ink">До закриття підвісної стелі</p>
              </div>
            </section>

            <section aria-label="Потрібні матеріали" className="p-5 md:p-8">
              <div className="flex items-center gap-3">
                <Camera aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={1.75} />
                <p className="text-data font-semibold text-ink">Потрібні матеріали</p>
                <span className="ml-auto text-meta font-medium text-status-ready-fg">3 з 3</span>
              </div>
              <ol className="mt-5 divide-y divide-line border-y border-line">
                {captures.map((capture) => (
                  <li key={capture} className="flex min-h-12 items-center gap-3 py-2 text-data text-ink">
                    <span className="grid size-6 shrink-0 place-items-center rounded-pill bg-status-ready text-status-ready-fg">
                      <Check aria-hidden="true" className="size-3.5" strokeWidth={2} />
                    </span>
                    {capture}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>

        <section aria-label="Доказ EV-0248" className="relative min-h-[430px] bg-sunken">
          <Image
            src="/images/cable-tray-evidence.png"
            alt="Кабельний лоток у зоні ВРУ-1"
            fill
            priority
            sizes="(max-width: 1240px) 100vw, 560px"
            className="object-cover"
          />
          <div className="absolute inset-x-4 top-4 flex items-center gap-3 rounded-control border border-line-inverse bg-inverse px-4 py-3 text-on-inverse shadow-overlay md:inset-x-6 md:top-6">
            <ShieldCheck aria-hidden="true" className="size-5 text-action-signal" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="index-label text-on-inverse-muted">{dossier.evidenceCode}</p>
              <p className="truncate text-meta font-semibold">{dossier.captured} · {dossier.place}</p>
            </div>
          </div>
          <div className="absolute inset-x-4 bottom-4 border border-line-strong bg-surface p-4 shadow-float md:inset-x-6 md:bottom-6 md:p-5">
            <div className="flex items-center gap-3">
              <FileText aria-hidden="true" className="size-5 text-ink-muted" strokeWidth={1.75} />
              <div>
                <p className="index-label text-ink-muted">Наступна подія</p>
                <p className="mt-1 text-data font-semibold text-ink">Рішення технічного нагляду</p>
              </div>
              <span className="ml-auto size-2 rounded-pill bg-status-review-fg" aria-hidden="true" />
            </div>
          </div>
        </section>
      </div>
    </figure>
  );
}
