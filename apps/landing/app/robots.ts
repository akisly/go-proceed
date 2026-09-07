import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "../content/site-origin";

/**
 * `/kitchen-sink` and `/og` are deliberately NOT disallowed here.
 *
 * A `Disallow` blocks the fetch, so the `noindex` those routes carry is never
 * read and the URL can still surface in results as a bare link with no title.
 * Crawl-and-noindex is the pair that actually removes a page from the index;
 * disallow-and-noindex is the pair that looks right and does nothing.
 *
 * AI crawlers are not blocked either. This is a pre-revenue pilot offer that
 * wants to be cited, not protected.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
