import type { MetadataRoute } from "next";
import { landingContent } from "../content/landing-content";
import { SITE_ORIGIN } from "../content/site-origin";

/**
 * The four pages (DEV-022). `/og` is a noindex source for the static social
 * card and `/kitchen-sink` is the internal component inventory — a sitemap
 * that lists them contradicts the tag they carry.
 *
 * `lastModified` is a hand-set CONTENT date rather than `new Date()`: a
 * build-time clock changes the field on every deploy, including deploys that
 * changed no copy, which teaches a crawler to stop believing it. Bump it when
 * `content/landing-content.ts` changes.
 */
const CONTENT_LAST_MODIFIED = "2026-09-18";

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(landingContent.pages).map(({ path }) => ({
    url: `${SITE_ORIGIN}${path}`,
    lastModified: new Date(CONTENT_LAST_MODIFIED),
    changeFrequency: "monthly" as const,
    priority: path === "/" ? 1 : 0.8,
  }));
}
