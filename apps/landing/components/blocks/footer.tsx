import { landingContent } from "../../content/landing-content";
import { PILOT_EMAIL } from "../../content/pilot-request";
import { BrandMark } from "../brand-mark";

export function Footer() {
  const f = landingContent.footer;
  return (
    <footer className="border-t border-line px-4 py-10 text-data text-ink-muted md:px-8">
      <div className="mx-auto max-w-marketing">
        <div className="mb-8 grid gap-8 md:grid-cols-2 wide:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="mb-2.5 flex items-center gap-2.5 text-body font-semibold text-ink"><BrandMark />{landingContent.nav.brand}</p>
            <p className="max-w-[40ch] leading-relaxed">{f.tagline}</p>
          </div>
          {f.columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h4 className="mb-3 text-meta font-semibold text-ink">{col.title}</h4>
              {col.links.map((l) => (
                <a
                  key={l.label}
                  href={l.href === "mailto" ? `mailto:${PILOT_EMAIL}` : l.href}
                  className="block py-1 transition-colors duration-fast ease-out hover:text-ink"
                >
                  {l.label}
                </a>
              ))}
            </nav>
          ))}
          <div>
            <h4 className="mb-3 text-meta font-semibold text-ink">{f.trust.title}</h4>
            {f.trust.items.map((t) => <p key={t} className="py-1">{t}</p>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <span>{f.copyright}</span>
          <p className="max-w-[70ch] text-meta text-ink-muted">{f.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
