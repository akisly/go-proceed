import { Check, Lock } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";
import { AccentText } from "./accent-text";

const ICON = {
  no: <i aria-hidden="true" className="size-4 rounded-pill border-[1.5px] border-line-strong bg-[linear-gradient(135deg,transparent_44%,var(--gp-border-strong)_44%_56%,transparent_56%)]" />,
  yes: <span className="grid size-4 place-items-center rounded-pill border-[1.5px] border-status-ready-fg text-status-ready-fg"><Check aria-hidden="true" strokeWidth={2} className="size-2.5" /></span>,
  lock: <span className="grid size-4 place-items-center rounded-pill border-[1.5px] border-ink-muted text-ink-secondary"><Lock aria-hidden="true" strokeWidth={1.75} className="size-2.5" /></span>,
} as const;

export function Position() {
  const p = landingContent.position;
  return (
    <section id="position" className="scroll-mt-20 px-4 pt-10 md:px-8 md:pt-20">
      <div className="mx-auto max-w-marketing">
        <div className="relative border-t border-line px-4 pb-10 pt-14 text-center md:px-15 md:pb-10 md:pt-24">
          <span aria-hidden="true" className="display pointer-events-none absolute left-2 top-5 hidden select-none text-[clamp(120px,16vw,220px)] font-bold leading-[.8] text-accent opacity-10 md:block md:left-6 md:top-10">“</span>
          <span aria-hidden="true" className="display pointer-events-none absolute right-2 top-5 hidden select-none text-[clamp(120px,16vw,220px)] font-bold leading-[.8] text-accent opacity-10 md:block md:right-6 md:top-10">”</span>
          <div className="relative mx-auto grid max-w-[860px] justify-items-center gap-5">
            <Reveal><p className="index-label">{p.eyebrow}</p></Reveal>
            <Reveal>
              <p className="display text-[clamp(24px,3vw,40px)] font-medium leading-tight tracking-tight text-ink">
                <span className="text-ink-muted">{p.quoteDim}</span>{" "}
                <span className="sr-only">{p.quote}</span>
                <span aria-hidden="true"><AccentText text={p.quote} accent={p.quoteAccent} /></span>
              </p>
            </Reveal>
            <Stagger className="flex flex-wrap justify-center gap-2">
              {p.pills.map((pill) => (
                <StaggerItem key={pill.text}>
                  <span data-position-pill={pill.kind} className="inline-flex h-(--gp-control-height-desk) items-center gap-2 rounded-pill border border-line-strong bg-surface pl-2.5 pr-3.5 text-data text-ink-secondary">
                    {ICON[pill.kind]}{pill.text}
                  </span>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </div>
    </section>
  );
}
