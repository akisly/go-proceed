import { Reveal } from "@goproceed/ui/motion";
import { landingContent } from "../../content/landing-content";

/** The requirement sources: a static six-cell grid (the prototype's `.marq`, which is not a marquee). */
export function Sources() {
  const s = landingContent.sources;
  return (
    <div id="sources" aria-hidden="true" className="border-t border-line px-4 md:px-8">
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
    </div>
  );
}
