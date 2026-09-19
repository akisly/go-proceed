import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const app = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(app, p), "utf8");

/**
 * The crawl surface.
 *
 * Three facts were true of this app until 2026-09-07 and each one costs the
 * page its own ranking: /robots.txt and /sitemap.xml both 404ed, no canonical
 * was emitted at all, and the design-system inventory at /kitchen-sink was
 * indexable. The first two are one dependency — a canonical needs an origin,
 * and the origin has to be known at BUILD time or the route stops being
 * static — so they are asserted together here.
 */

const ORIGIN_MODULE = "../content/site-origin";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the canonical origin", () => {
  it("prefers the explicit NEXT_PUBLIC_SITE_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://goproceed.app");
    const { SITE_ORIGIN } = await import(ORIGIN_MODULE);
    expect(SITE_ORIGIN).toBe("https://goproceed.app");
  });

  it("falls back to the Vercel production domain, which is set on previews too", async () => {
    // Verified 2026-09-07 against vercel.com/docs/environment-variables/
    // system-environment-variables: VERCEL_PROJECT_PRODUCTION_URL is "the
    // production domain name of the project, set even in preview deployments",
    // and it carries no protocol scheme. That is exactly the property a
    // canonical needs — a preview build must canonicalise to production, not
    // to itself.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "goproceed.app");
    const { SITE_ORIGIN } = await import(ORIGIN_MODULE);
    expect(SITE_ORIGIN).toBe("https://goproceed.app");
  });

  it("carries no trailing slash, so composing a path never doubles it", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://goproceed.app/");
    const { SITE_ORIGIN } = await import(ORIGIN_MODULE);
    expect(SITE_ORIGIN).toBe("https://goproceed.app");
  });
});

describe("robots.txt", () => {
  it("allows the site and points at the sitemap", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://goproceed.app");
    const robots = (await import("../app/robots")).default;
    const result = robots();
    expect(result.rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/api/"] });
    expect(result.sitemap).toBe("https://goproceed.app/sitemap.xml");
  });

  it("does NOT disallow the noindexed routes, or their noindex would never be read", async () => {
    // A Disallow blocks the fetch, so the meta robots tag on /kitchen-sink and
    // /og is never seen and the URL can still surface as a bare link. Crawl
    // and noindex is the correct pair; disallow and noindex is not.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://goproceed.app");
    const robots = (await import("../app/robots")).default;
    const disallow = JSON.stringify(robots().rules);
    expect(disallow).not.toContain("kitchen-sink");
    expect(disallow).not.toContain("/og");
  });
});

describe("sitemap.xml", () => {
  it("lists the four indexable pages and nothing else", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://goproceed.app");
    const sitemap = (await import("../app/sitemap")).default;
    const urls = sitemap().map((e) => e.url);
    expect(urls).toEqual([
      "https://goproceed.app/",
      "https://goproceed.app/product",
      "https://goproceed.app/roles",
      "https://goproceed.app/pilot",
    ]);
  });

  it("has a page file for every URL it lists", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://goproceed.app");
    const sitemap = (await import("../app/sitemap")).default;
    for (const { url } of sitemap()) {
      const path = new URL(url).pathname;
      expect(() => read(join("app", path, "page.tsx")), path).not.toThrow();
    }
  });

  it("dates the entry from the content, not from the build clock", async () => {
    // `new Date()` at build time changes lastModified on every deploy and
    // teaches a crawler to distrust the field. The date is bumped by hand when
    // the copy changes.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://goproceed.app");
    const before = (await import("../app/sitemap")).default()[0]?.lastModified;
    vi.resetModules();
    const after = (await import("../app/sitemap")).default()[0]?.lastModified;
    expect(String(before)).toBe(String(after));
    expect(new Date(String(before)).getTime()).toBeLessThan(Date.now());
  });
});

describe("the design-system inventory stays out of the index", () => {
  it("kitchen-sink carries noindex through a layout, because its pages are client components", async () => {
    // `export const metadata` is illegal in a "use client" module, so the tag
    // cannot live in the page files themselves — adding it there is a build
    // error, not a fix. One layout covers both routes.
    const { metadata } = await import("../app/kitchen-sink/layout");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe("the root layout builds its metadata statically", () => {
  const layout = read("app/layout.tsx");

  it("does not read request headers, which would make the whole route dynamic", () => {
    // Touching headers() inside generateMetadata opts `/` out of static
    // rendering — the build output flips from ○ to ƒ and every visit pays for
    // SSR on a page that has no per-request content. It also made the origin
    // whatever host asked, so every preview deployment self-canonicalised.
    const source = layout.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(source).not.toContain("next/headers");
    expect(source).not.toContain("generateMetadata");
  });

  it("keeps the internal design contract out of the production response", () => {
    // The template carried THESIS / OWN-WORLD / STORY and internal paths into
    // every response on the marketing site of a product that sells provenance.
    expect(layout).toContain("NODE_ENV");
  });
});
