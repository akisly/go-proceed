import { LineDraw, NodeLock } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionShell } from "../section-shell";

const content = landingContent.evidence;

export function EvidenceChain() {
  return (
    <SectionShell id="workflow" eyebrow={content.eyebrow} title={content.title} lead={content.lead} className="bg-subtle">
      <div className="relative">
        <LineDraw
          d="M 4 1 H 1196"
          className="absolute left-[8%] right-[8%] top-6 hidden h-1 wide:block"
        />
        <div className="landing-paper-grid relative grid overflow-hidden rounded-section border border-line-strong bg-surface md:grid-cols-2 wide:grid-cols-6">
          {content.steps.map((step, index) => (
            <NodeLock key={step.id} index={index} className="h-full">
              <article className="flex h-full min-h-60 flex-col border-b border-line p-5 md:border-r wide:border-b-0 wide:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-pill border border-line-strong bg-canvas font-mono text-meta font-semibold text-ink">
                    {step.id}
                  </span>
                  {step.label === "Закриття" && (
                    <span className="rounded-pill border border-status-ready-line bg-status-ready px-2 py-1 text-micro font-semibold text-status-ready-fg">
                      Дозволено
                    </span>
                  )}
                </div>
                <h3 className="mt-7 text-h3 font-semibold text-ink">{step.label}</h3>
                <p className="mt-3 text-data leading-relaxed text-ink-muted">{step.detail}</p>
                <p className="index-label mt-auto pt-6 text-ink-subtle">{step.reference}</p>
              </article>
            </NodeLock>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-panel border border-status-blocked-line bg-status-blocked px-5 py-4 md:flex-row md:items-center">
        <span className="text-data font-semibold text-status-blocked-fg">Закриття заблоковано</span>
        <span className="text-data text-status-blocked-fg">
          Блокуюча вимога не дозволяє записати етап закритим, доки допустимий доказ відсутній.
        </span>
      </div>
    </SectionShell>
  );
}
