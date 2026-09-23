import type { ReactNode } from "react";
import type { PageKey } from "../content/landing-content";
import { pageJsonLd } from "../content/landing-jsonld";
import { SITE_ORIGIN } from "../content/site-origin";
import { Band } from "./blocks/band";
import { Footer } from "./blocks/footer";
import { Nav } from "./blocks/nav";

/**
 * What the four pages share (DEV-025): the page's structured data, the skip
 * link, the header, `<main>` and the footer. A component rather than a route
 * group layout, because `/og` and `/kitchen-sink` take none of it and a page
 * rendered on its own — which is how the render tests read it — is then the
 * whole page.
 *
 * `page` also tells the header which link is current, so `Nav` needs no router
 * hook and stays a server component.
 */
export function SiteShell({ page, children }: { page: PageKey; children: ReactNode }) {
  return (
    <>
      {/* One graph per page, server-rendered. See content/landing-jsonld.ts for
        * what is deliberately absent and why FAQPage is not a promise of rich
        * results. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd(SITE_ORIGIN, page)) }}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-5 focus:top-3 focus:z-50 focus:rounded-control focus:bg-action focus:px-4 focus:py-3 focus:text-data focus:font-semibold focus:text-action-fg"
      >
        Перейти до основного вмісту
      </a>
      <Nav current={page} />
      {/* The hero clears the fixed header itself. A sub-page opens on an
        * ordinary section, so `<main>` reserves the header — and, below `md`,
        * the link strip under it. */}
      {/* [DEV-026] The reference's frame: every page lives in one column between
        * the inner guide lines; the outer pair are drawn by `.landing-body`. */}
      <div className="landing-frame">
        {/* `relative` is load-bearing, not tidiness. `overflow-x: clip` only clips
          * a descendant whose containing block is inside the clipping box, and an
          * absolutely positioned one — every `sr-only` label in the access
          * matrix — takes the nearest POSITIONED ancestor. Until DEV-026 that was
          * `<main>` by a `body > main` rule; inside the frame the rule stopped
          * matching, the labels' containing block became the frame, and /product
          * gained 48px of sideways scroll on a phone. The harness caught it. */}
        <main id="main-content" tabIndex={-1} className={page === "home" ? "relative overflow-x-clip" : "relative overflow-x-clip pt-16 md:pt-10"}>
          {children}
        </main>
        {/* [DEV-029] On /pilot the FAQ above this band is already the warm
          * tint and the footer below it is too, so the band takes that ground
          * rather than cutting a paper slot between two identical ones. */}
        <Band tone={page === "pilot" ? "tint" : "paper"} />
        <Footer />
      </div>
    </>
  );
}
