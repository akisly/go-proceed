import { Step, Stepper } from "@goproceed/ui/components";
import { Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { PilotForm } from "./pilot-form";
import { SectionHead } from "./section-head";

/** `h1` on the page the block opens (DEV-022), `h2` anywhere else. */
export function Pilot({ heading = "h2" }: { heading?: "h1" | "h2" }) {
  const p = landingContent.pilot;
  const boxes = [p.needs, p.gets, p.terms] as const;
  // The level under the block's own heading: no page skips from h1 to h3 (R-02).
  const sub = heading === "h1" ? "h2" : "h3";
  return (
    <section id="pilot" tabIndex={-1} className="scroll-mt-20 landing-inset py-20 md:py-28">
      <div>
        <SectionHead as={heading} eyebrow={p.eyebrow} title={p.title} titleAccent={p.titleAccent} lead={p.lead} />
        <div className="grid gap-8 wide:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] wide:items-start wide:gap-14">
          <div>
            <Stepper>
              {p.steps.map((s, i) => <Step key={s.when} index={i} count={p.steps.length} when={s.when} title={s.title} titleAs={sub}>{s.body}</Step>)}
            </Stepper>
            <Stagger className="mt-2 grid gap-3.5 md:grid-cols-2">
              {boxes.map((box, i) => (
                <StaggerItem key={box.title} size="stately" className={i === 2 ? "md:col-span-2" : ""}>
                  <div className="grid h-full gap-1.5 rounded-card border border-line-strong bg-surface px-4 py-3.5 text-data text-ink-secondary">
                    <b className="font-semibold text-ink">{box.title}</b>
                    {box.items.map((t) => <span key={t}>· {t}</span>)}
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
          <div id="request" tabIndex={-1} className="scroll-mt-20"><Reveal y={0} size="stately"><PilotForm titleAs={sub} /></Reveal></div>
        </div>
      </div>
    </section>
  );
}
