import { Step, Stepper } from "@goproceed/ui/components";
import { Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { PilotForm } from "./pilot-form";
import { SectionHead } from "./section-head";

export function Pilot() {
  const p = landingContent.pilot;
  const boxes = [p.needs, p.gets, p.terms] as const;
  return (
    <section id="pilot" className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={p.eyebrow} title={p.title} titleAccent={p.titleAccent} lead={p.lead} />
        <div className="grid gap-8 wide:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] wide:items-start wide:gap-14">
          <div>
            <Stepper>
              {p.steps.map((s, i) => <Step key={s.when} index={i} count={p.steps.length} when={s.when} title={s.title}>{s.body}</Step>)}
            </Stepper>
            <Stagger className="mt-2 grid gap-3.5 md:grid-cols-2">
              {boxes.map((box, i) => (
                <StaggerItem key={box.title} className={i === 2 ? "md:col-span-2" : ""}>
                  <div className="grid h-full gap-1.5 rounded-card border border-line-strong bg-surface px-4 py-3.5 text-data text-ink-secondary">
                    <b className="font-semibold text-ink">{box.title}</b>
                    {box.items.map((t) => <span key={t}>· {t}</span>)}
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
          <Reveal y={0} size="stately"><PilotForm /></Reveal>
        </div>
      </div>
    </section>
  );
}
