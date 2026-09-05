import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";

/**
 * The requirement sources: a static six-cell grid (the prototype's `.marq`,
 * which is not a marquee).
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
    <section id="sources" aria-label={s.label} className="border-t border-line px-4 md:px-8">
      <Reveal className="mx-auto max-w-marketing">
        <p className="index-label pt-3.5">{s.label}</p>
        <ul className="grid grid-cols-2 gap-y-3 py-2.5 pb-4 md:grid-cols-3 wide:grid-cols-6">
          {s.items.map((item, i) => (
            <li key={item.code} className={i === 0 ? "grid gap-0.5 pr-3.5 text-meta leading-snug text-ink-muted" : "grid gap-0.5 border-l border-line pl-3 pr-3.5 text-meta leading-snug text-ink-muted"}>
              <b className="font-mono text-micro font-medium tracking-wide text-ink">{item.code}</b>
              {item.title}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
