import { LineDraw } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { SectionShell } from "../section-shell";

const content = landingContent.evidence;

export function EvidenceChain() {
  return (
    <SectionShell id="workflow" eyebrow={content.eyebrow} title={content.title} lead={content.lead} className="bg-subtle">
      <div
        data-evidence-timeline="true"
        className="landing-paper-grid relative overflow-hidden rounded-section border border-line-strong bg-surface px-5 py-7 md:px-8 md:py-9 wide:px-0 wide:py-10"
      >
        <div aria-hidden="true" className="absolute bottom-10 left-[51px] top-10 w-px bg-line-strong wide:hidden" />
        <LineDraw
          d="M 2 1 H 1198"
          className="absolute left-[7%] right-[7%] top-[64px] hidden h-1 wide:block"
        />
        <ol aria-label="Доказовий ланцюг" className="relative grid wide:grid-cols-6">
          {content.steps.map((step, index) => (
            <li
              key={step.id}
              className="group grid grid-cols-[56px_1fr] gap-4 border-b border-line-strong py-6 first:pt-0 last:border-b-0 last:pb-0 wide:block wide:min-h-[290px] wide:border-b-0 wide:border-r wide:px-6 wide:py-0 wide:last:border-r-0"
            >
              <div className="relative z-10 grid size-12 place-items-center rounded-pill border border-line-strong bg-surface font-mono text-meta font-semibold text-ink shadow-overlay">
                {step.id}
              </div>
              <div className="min-w-0 wide:mt-8">
                <div className="flex min-h-7 flex-wrap items-center gap-2">
                  <h3 className="text-h3 font-semibold text-ink">{step.label}</h3>
                  {step.label === "Закриття" && (
                    <span className="rounded-pill border border-status-ready-line bg-status-ready px-2 py-1 text-micro font-semibold text-status-ready-fg">Дозволено</span>
                  )}
                </div>
                <p className="mt-3 text-data leading-relaxed text-ink-muted">{step.detail}</p>
                <p className="index-label mt-5 border-l-2 border-action-signal pl-3 text-ink-subtle wide:mt-8">{step.reference}</p>
              </div>
              {index < content.steps.length - 1 && (
                <span aria-hidden="true" className="absolute left-[45px] mt-[46px] size-3 rotate-45 border-r border-t border-line-strong bg-surface wide:left-auto wide:right-[-6px] wide:top-[19px] wide:mt-0" />
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 grid gap-2 rounded-panel border border-status-blocked-line bg-status-blocked px-5 py-4 md:grid-cols-[200px_1fr] md:items-center md:px-6">
        <span className="flex items-center gap-3 text-data font-semibold text-status-blocked-fg">
          <span aria-hidden="true" className="size-2 rounded-pill bg-status-blocked-fg" />
          Закриття заблоковано
        </span>
        <span className="text-data text-status-blocked-fg">
          Блокуюча вимога не дозволяє записати етап закритим, доки допустимий доказ відсутній.
        </span>
      </div>
    </SectionShell>
  );
}
