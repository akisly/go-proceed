import Link from "next/link";
import { landingContent } from "../../content/landing-content";
import { PILOT_EMAIL } from "../../content/pilot-request";
import { BrandMark } from "../brand-mark";

/**
 * [2026-09-22, DEV-029] The footer closes the page on the WARM TINT.
 *
 * It was the inverse ground for one revision, and the owner threw it out on
 * sight: «те темные блоки вообще как-то не к чему, не вписываются, они не от
 * мира сего». They were right, and the reason is in the reference itself — in
 * all five shots the near-black is never a SECTION, it is the backdrop a light
 * product is photographed against. A footer has no product on it. What is left
 * on a dark ground there is a black slab with links in it, which belongs to a
 * different page than the one above it.
 *
 * The tint does the job the dark was brought in for — the page stops being one
 * unbroken sheet of paper — at a hundredth of the cost.
 */
export function Footer() {
  const f = landingContent.footer;
  return (
    <footer className="landing-inset bg-tint-warm py-14 text-data text-ink-secondary">
      <div>
        <div className="mb-8 grid gap-8 md:grid-cols-2 wide:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="mb-2.5 flex items-center gap-2.5 text-body font-semibold text-ink"><BrandMark />{landingContent.nav.brand}</p>
            <p className="max-w-[40ch] leading-relaxed">{f.tagline}</p>
          </div>
          {f.columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="mb-3 text-meta font-semibold text-ink">{col.title}</h3>
              {col.links.map((l) => l.href === "mailto" ? (
                <a key={l.label} href={`mailto:${PILOT_EMAIL}`} className="block py-1 transition-colors duration-fast ease-out hover:text-ink">
                  {l.label}
                </a>
              ) : (
                <Link key={l.label} href={l.href} className="block py-1 transition-colors duration-fast ease-out hover:text-ink">
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
          <div>
            <h3 className="mb-3 text-meta font-semibold text-ink">{f.trust.title}</h3>
            {f.trust.items.map((t) => <p key={t} className="py-1">{t}</p>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line-warm pt-5">
          <span>{f.copyright}</span>
          <p className="max-w-[70ch] text-meta text-ink-secondary">{f.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
