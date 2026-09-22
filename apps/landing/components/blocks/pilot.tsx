import { Step, Stepper } from "@goproceed/ui/components";
import { Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { PilotForm } from "./pilot-form";
import { SectionHead } from "./section-head";

/** `h1` on the page the block opens (DEV-024), `h2` anywhere else. */
export function Pilot({ heading = "h2" }: { heading?: "h1" | "h2" }) {
  const p = landingContent.pilot;
  const boxes = [p.needs, p.gets, p.terms] as const;
  // The level under the block's own heading: no page skips from h1 to h3 (R-02).
  const sub = heading === "h1" ? "h2" : "h3";
  return (
    <section id="pilot" tabIndex={-1} className="scroll-mt-20 landing-inset py-20 md:py-28">
      <div>
        <SectionHead as={heading} eyebrow={p.eyebrow} title={p.title} titleAccent={p.titleAccent} lead={p.lead} />
        {/* [2026-09-22, owner: «смысл тут уже от степов, если страница уже стоит
          * тут … нужно пересмотреть и перестроить».] The plan used to hold the whole
          * left column as a vertical timeline, opposite the form. On the page a
          * visitor has already chosen, that is the wrong order of business: what
          * stands beside the form is what the decision needs — what the pilot asks
          * for, what it gives back, and its terms. The plan is below, across the
          * block, on one rail. */}
        <div className="grid gap-10 wide:grid-cols-2 wide:items-start wide:gap-10">
          <Stagger className="grid content-start gap-px overflow-hidden rounded-surface border border-line-strong bg-line">
            {/* `y={0}` — a fade, not a rise [R2-12]: these cells sit on the container's
              * own `bg-line`, and a translated grid item leaves its area behind, so a
              * 16px band of the hairline colour would show under each white cell for
              * the length of the entrance. `sources.tsx` — the same 1px-line grid —
              * fades its group for the same reason. */}
            {boxes.map((box) => (
              <StaggerItem key={box.title} y={0} size="stately" className="grid">
                <div className="grid content-start gap-3 bg-surface px-5 py-6">
                  <p className="index-label">{box.title}</p>
                  <ul className="grid gap-2 text-data leading-relaxed text-ink-secondary">
                    {box.items.map((t) => <li key={t} className="grid grid-cols-[auto_1fr] gap-2"><span aria-hidden="true" className="text-ink-muted">·</span>{t}</li>)}
                  </ul>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <div id="request" tabIndex={-1} className="scroll-mt-20"><Reveal y={0} size="stately"><PilotForm titleAs={sub} /></Reveal></div>
        </div>
        <Stepper direction="horizontal" className="mt-16 md:mt-20">
          {p.steps.map((s, i) => <Step key={s.when} index={i} count={p.steps.length} when={s.when} title={s.title} titleAs={sub}>{s.body}</Step>)}
        </Stepper>
      </div>
    </section>
  );
}
