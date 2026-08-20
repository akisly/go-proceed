import { Camera, Check, FileText, LockKeyhole, MapPin, ShieldCheck } from "lucide-react";
import { LineDraw, NodeLock } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionShell } from "../section-shell";

const content = landingContent.evidence;

const scenes = [
  {
    id: "context",
    label: "Робота і вимога",
    title: "Контекст до початку",
    range: "01—02",
    steps: content.steps.slice(0, 2),
    visual: <ContextIllustration />,
  },
  {
    id: "decision",
    label: "Доказ і рішення",
    title: "Факт і рішення",
    range: "03—04",
    steps: content.steps.slice(2, 4),
    visual: <DecisionIllustration />,
  },
  {
    id: "closure",
    label: "Закриття і акт",
    title: "Контрольоване закриття",
    range: "05—06",
    steps: content.steps.slice(4, 6),
    visual: <ClosureIllustration />,
  },
] as const;

export function EvidenceChain() {
  return (
    <SectionShell
      id="workflow"
      eyebrow={content.eyebrow}
      title={content.title}
      lead={content.lead}
      className="bg-subtle"
    >
      <div
        data-evidence-timeline="true"
        className="relative overflow-hidden rounded-section border border-line-strong bg-surface"
      >
        <div aria-hidden="true" className="relative hidden h-14 border-b border-line bg-subtle wide:block">
          <LineDraw
            d="M 2 1 H 1198"
            className="absolute left-[16.666%] right-[16.666%] top-7 h-px"
          />
          <div className="relative grid h-full grid-cols-3">
            {scenes.map((scene, index) => (
              <NodeLock key={scene.id} index={index} className="grid place-items-center">
                <span className="grid size-7 place-items-center rounded-pill border border-line-strong bg-surface font-mono text-micro font-semibold text-ink shadow-overlay">
                  {index + 1}
                </span>
              </NodeLock>
            ))}
          </div>
        </div>

        <ol aria-label="Доказовий ланцюг" className="relative grid wide:grid-cols-3">
          {scenes.map((scene, index) => (
            <li
              key={scene.id}
              className="border-b border-line-strong last:border-b-0 wide:border-b-0 wide:border-r wide:last:border-r-0"
            >
              <NodeLock index={index} className="h-full">
                <figure aria-label={scene.label} className="flex h-full flex-col">
                  {scene.visual}
                  <figcaption className="flex flex-1 flex-col p-5 md:p-6 wide:p-7">
                    <p className="index-label text-ink-muted">{scene.range} · {scene.title}</p>
                    <div className="mt-6 divide-y divide-line">
                      {scene.steps.map((step) => (
                        <div
                          key={step.id}
                          className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-4 first:pt-0 last:pb-0"
                        >
                          <span className="index-label tabular pt-1 text-ink-subtle" aria-hidden="true">
                            {step.id}
                          </span>
                          <div>
                            <h3 className="text-body font-semibold text-ink">{step.label}</h3>
                            <p className="mt-1.5 text-data leading-relaxed text-ink-muted">{step.detail}</p>
                            <p className="index-label mt-3 text-ink-subtle">{step.reference}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </figcaption>
                </figure>
              </NodeLock>
            </li>
          ))}
        </ol>
      </div>
    </SectionShell>
  );
}

function ContextIllustration() {
  return (
    <div
      className="relative min-h-64 overflow-hidden border-b border-line bg-subtle p-5"
      aria-hidden="true"
    >
      <div className="absolute inset-x-5 top-5 h-36 border border-line-strong bg-surface shadow-overlay">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <MapPin className="size-3.5 text-ink-muted" strokeWidth={1.75} />
          <span className="index-label text-ink-muted">ЕОМ · Аркуш 14</span>
          <span className="ml-auto text-micro font-medium text-ink-subtle">REV 03</span>
        </div>
        <div className="relative h-[99px] overflow-hidden">
          <span className="absolute left-[12%] top-7 h-px w-[56%] bg-line-strong" />
          <span className="absolute left-[24%] top-7 h-12 w-px bg-line-strong" />
          <span className="absolute left-[24%] top-[76px] h-px w-[58%] bg-line-strong" />
          <span className="absolute left-[64%] top-7 h-[49px] w-px bg-line-strong" />
          <span className="absolute left-[45%] top-[43px] grid h-8 w-16 place-items-center border border-action-signal bg-surface font-mono text-micro font-semibold text-ink">
            ВРУ-1
          </span>
        </div>
      </div>

      <span className="absolute bottom-[67px] left-[35%] h-8 w-px bg-action-signal" />
      <div className="absolute bottom-5 right-5 w-[72%] border border-line-strong bg-surface shadow-overlay">
        <div className="flex items-center border-b border-line px-3 py-2">
          <span className="index-label text-ink-muted">R-041</span>
          <span className="ml-auto rounded-pill border border-status-blocked-line bg-status-blocked px-2 py-1 text-micro font-semibold text-status-blocked-fg">
            Обов’язкова
          </span>
        </div>
        <p className="px-3 py-3 text-data font-medium leading-relaxed text-ink">
          Фото кріплення до закриття стелі
        </p>
      </div>
    </div>
  );
}

function DecisionIllustration() {
  return (
    <div
      className="relative min-h-64 overflow-hidden border-b border-line bg-subtle p-5"
      aria-hidden="true"
    >
      <div className="absolute bottom-8 left-5 top-5 w-[58%] overflow-hidden border border-line-strong bg-surface shadow-overlay">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Camera className="size-3.5 text-ink-muted" strokeWidth={1.75} />
          <span className="index-label text-ink-muted">EV-0248</span>
        </div>
        <div className="grid h-[118px] place-items-center bg-sunken">
          <Camera className="size-8 text-ink-subtle" strokeWidth={1.25} />
        </div>
        <div className="px-3 py-2.5">
          <p className="text-meta font-medium text-ink">І. Коваленко · 10:42</p>
          <p className="mt-1 text-micro text-ink-muted">ВРУ-1 · Секція А</p>
        </div>
      </div>

      <span className="absolute bottom-[72px] left-[57%] h-px w-[17%] bg-action-signal" />
      <div className="absolute bottom-5 right-5 w-[56%] border border-status-ready-line bg-status-ready p-3 shadow-overlay">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-pill bg-status-ready-fg text-status-ready">
            <ShieldCheck className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="index-label text-status-ready-fg">DR-0091</p>
            <p className="mt-1 text-data font-semibold text-status-ready-fg">Прийнято наглядом</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClosureIllustration() {
  return (
    <div
      className="relative min-h-64 overflow-hidden border-b border-line bg-subtle p-5"
      aria-hidden="true"
    >
      <div className="absolute inset-x-5 top-5 border border-status-blocked-line bg-status-blocked px-3 py-2.5">
        <div className="flex items-center gap-2 text-status-blocked-fg">
          <LockKeyhole className="size-4" strokeWidth={1.75} />
          <span className="text-meta font-semibold">Без EV-0248 · закриття заблоковано</span>
        </div>
      </div>

      <span className="absolute left-10 top-[67px] h-8 w-px bg-line-strong" />
      <div className="absolute left-5 top-[95px] flex items-center gap-2 border border-status-ready-line bg-status-ready px-3 py-2 text-status-ready-fg shadow-overlay">
        <span className="grid size-6 place-items-center rounded-pill bg-status-ready-fg text-status-ready">
          <Check className="size-3.5" strokeWidth={2} />
        </span>
        <span className="text-meta font-semibold">CL-017 · дозволено</span>
      </div>

      <span className="absolute bottom-[74px] left-[38%] h-px w-[11%] bg-action-signal" />
      <div className="absolute bottom-5 right-5 w-[54%] border border-line-strong bg-surface p-3 shadow-overlay">
        <div className="flex items-center gap-2 border-b border-line pb-2.5">
          <FileText className="size-4 text-ink-muted" strokeWidth={1.75} />
          <span className="index-label text-ink-muted">Акт · Чернетка</span>
        </div>
        <dl className="mt-3 space-y-2 text-micro">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Робота</dt>
            <dd className="font-medium text-ink">ВРУ-1</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Доказ</dt>
            <dd className="font-medium text-ink">EV-0248</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Рішення</dt>
            <dd className="font-medium text-ink">DR-0091</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
