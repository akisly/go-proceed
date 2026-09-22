import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";

/**
 * The requirement sources, in the composition the reference gives a row of
 * marks (DEV-027): a centred label over one even row of equal cells between
 * hairlines, each cell centred — the code set like a wordmark, its title under
 * it. Six cells, so every breakpoint is whole rows: 2 × 3, 3 × 2, 6 × 1. The
 * hairlines are the grid's own 1px gaps over a `line` ground, so they meet at
 * every column count and no cell needs to know whether it is first in a row.
 * A cell's content starts at a fixed top pad rather than being centred (B-04):
 * at 360px one title wraps to three lines and its neighbour to two, and
 * centring set the two codes of one row 8px apart.
 *
 * [DEV-027] Until now this was a left-aligned strip whose first cell had no
 * rule, whose cells differed in height, set in 11px over the fact band's grid.
 * The owner: «блок Джерела вимог какой-то кривой и выглядит не очень».
 *
 * NOT `aria-hidden`. These six ДБН and ПКМУ references are the norms the
 * product is built against — the footer's trust column cites one of them by
 * name and the spec lists this as a content section, not an ornament. Hiding
 * the strip removed all six codes and titles from assistive technology; the
 * `aria-label` names the group instead, so a reader can decide to skip it.
 */
export function Sources() {
  const s = landingContent.sources;
  return (
    <section id="sources" aria-label={s.label} className="relative border-t border-line-strong bg-canvas">
      <Reveal>
        <p className="index-label border-b border-line py-3.5 text-center">{s.label}</p>
        <ul className="grid grid-cols-2 gap-px bg-line md:grid-cols-3 wide:grid-cols-6">
          {s.items.map((item) => (
            <li key={item.code} className="grid min-h-[116px] content-start justify-items-center gap-1.5 bg-canvas px-4 pb-5 pt-7 text-center transition-colors duration-base ease-out hover:bg-surface">
              <b className="font-mono text-data font-medium tracking-tight text-ink">{item.code}</b>
              <span className="max-w-[24ch] text-meta leading-snug text-ink-muted">{item.title}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
