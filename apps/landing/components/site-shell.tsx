import type { ReactNode } from "react";
import type { PageKey } from "../content/landing-content";
import { pageJsonLd } from "../content/landing-jsonld";
import { SITE_ORIGIN } from "../content/site-origin";
import { Footer } from "./blocks/footer";
import { Nav } from "./blocks/nav";

/**
 * What the four pages share (DEV-022): the page's structured data, the skip
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
      <main id="main-content" tabIndex={-1} className={page === "home" ? "overflow-x-clip" : "overflow-x-clip pt-16 md:pt-10"}>
        {children}
      </main>
      <Footer />
    </>
  );
}
