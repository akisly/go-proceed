import { Step, Stepper } from "@goproceed/ui/components";
import { Reveal, Stagger, StaggerItem, Tilt } from "@goproceed/ui/motion";
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
            {/* The three summary boxes lean toward the pointer like every other
              * card on the page. The grid supplies the perspective and each
              * `StaggerItem` keeps `preserve-3d`, because a Motion transform on
              * an ancestor without it flattens the chain and the lean silently
              * stops happening. The form beside them deliberately does not
              * tilt — a surface someone is typing into must hold still. */}
            <Stagger className="mt-2 grid gap-3.5 [perspective:1600px] md:grid-cols-2">
              {boxes.map((box, i) => (
                <StaggerItem key={box.title} size="stately" className={i === 2 ? "grid [transform-style:preserve-3d] md:col-span-2" : "grid [transform-style:preserve-3d]"}>
                  <Tilt area="section" maxX={2.5} maxY={3} className="grid h-full">
                    <div className="grid h-full gap-1.5 rounded-card border border-line-strong bg-surface px-4 py-3.5 text-data text-ink-secondary">
                      <b className="font-semibold text-ink">{box.title}</b>
                      {box.items.map((t) => <span key={t}>· {t}</span>)}
                    </div>
                  </Tilt>
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
