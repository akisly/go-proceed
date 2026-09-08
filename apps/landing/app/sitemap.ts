import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "../content/site-origin";

/**
 * One URL, because the site has one indexable page. `/og` is a noindex source
 * for the static social card and `/kitchen-sink` is the internal component
 * inventory — a sitemap that lists them contradicts the tag they carry.
 *
 * `lastModified` is a hand-set CONTENT date rather than `new Date()`: a
 * build-time clock changes the field on every deploy, including deploys that
 * changed no copy, which teaches a crawler to stop believing it. Bump it when
 * `content/landing-content.ts` changes.
 */
const CONTENT_LAST_MODIFIED = "2026-09-07";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_ORIGIN}/`,
      lastModified: new Date(CONTENT_LAST_MODIFIED),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
