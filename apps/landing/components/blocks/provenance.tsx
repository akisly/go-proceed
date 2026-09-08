import { Check, Minus } from "lucide-react";
import { Bento, BentoCell } from "@goproceed/ui/components";
import { landingContent } from "../../content/landing-content";
import { SectionHead } from "./section-head";
import { AccessMatrix } from "../visuals/access-matrix";

export function Provenance() {
  const p = landingContent.provenance;
  return (
    <section id="trust" tabIndex={-1} className="scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-marketing">
        <SectionHead eyebrow={p.eyebrow} title={p.title} titleAccent={p.titleAccent} lead={p.lead} />
        <Bento stagger>
          <BentoCell stagger span="rows-2" className="md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)] md:items-start md:gap-10">
            <div>
              <p className="index-label">{p.access.eyebrow}</p>
              <h3 className="mt-2 max-w-[20ch] text-h2 font-semibold tracking-tight text-ink">{p.access.title}</h3>
              <p className="mt-2 text-data leading-relaxed text-ink-secondary">{p.access.body}</p>
              <p className="mt-2 text-meta text-ink-muted">{p.access.small}</p>
            </div>
            <AccessMatrix />
          </BentoCell>
          <BentoCell stagger eyebrow={p.immutability.eyebrow} title={p.immutability.title}>
            <ul className="grid gap-2.5 text-data text-ink-secondary">
              {p.immutability.items.map((t) => <li key={t} className="grid grid-cols-[16px_1fr] gap-2.5"><Check aria-hidden="true" strokeWidth={2} className="mt-0.5 size-3.5 rounded-control border-[1.5px] border-ink p-px text-ink" />{t}</li>)}
            </ul>
          </BentoCell>
          {/* Seven items in a row, of which the last three INVERT the first
            * four, and the only thing that told them apart was a decorative
            * marker: an empty ring for «робить», an aria-hidden Minus for
            * «не обіцяє». Neither is announced, so a screen reader heard
            * «Записане блокування закриття» run straight into «Фізичну
            * роботу не зупиняє» with nothing marking the turn. Each half now
            * carries a heading and the list points at it.
            *
            * `h4`, not `h3`: BentoCell's own title is the h3 above these
            * two, and a sub-list of it is not its sibling. */}
          <BentoCell stagger eyebrow={p.limits.eyebrow} title={p.limits.title}>
            <div className="grid gap-3.5 md:grid-cols-2">
              <div className="grid gap-2">
                <h4 id="limits-does" className="text-meta font-semibold uppercase tracking-wide text-ink-muted">{p.limits.doesTitle}</h4>
                <ul aria-labelledby="limits-does" className="grid gap-2 text-data text-ink-secondary">
                  {p.limits.does.map((t) => <li key={t} className="grid grid-cols-[14px_1fr] gap-2"><i aria-hidden="true" className="mt-0.5 size-3 rounded-pill border-[1.5px] border-status-ready-fg" />{t}</li>)}
                </ul>
              </div>
              <div className="grid gap-2">
                <h4 id="limits-does-not" className="text-meta font-semibold uppercase tracking-wide text-ink-muted">{p.limits.doesNotTitle}</h4>
                <ul aria-labelledby="limits-does-not" className="grid gap-2 text-data text-ink-secondary">
                  {p.limits.doesNot.map((t) => <li key={t} className="grid grid-cols-[14px_1fr] gap-2"><Minus aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-3 rounded-pill border-[1.5px] border-line-strong text-ink-subtle" />{t}</li>)}
                </ul>
              </div>
            </div>
          </BentoCell>
        </Bento>
      </div>
    </section>
  );
}
