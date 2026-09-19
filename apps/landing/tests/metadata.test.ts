import { describe, expect, it } from "vitest";
import { landingContent } from "../content/landing-content";
import { createLandingMetadata, createPageMetadata } from "../content/landing-metadata";

const metadata = createLandingMetadata("https://goproceed.example");

describe("landing metadata", () => {
  it("describes the evidence product without unsupported commercial claims", () => {
    expect(metadata.title).toBe("GoProceed — робота готова до приймання, коли доказ на місці");
    expect(metadata.description).toContain(
      "GoProceed для підрядників, які здають приховані роботи: вимога, доказ із майданчика і рішення технагляду в одному маршруті, який закінчується чернеткою акта.",
    );
    expect(metadata.description?.toLowerCase()).not.toContain("оплат");
  });

  it("publishes one social preview asset", () => {
    expect(metadata.metadataBase?.toString()).toBe("https://goproceed.example/");
    expect(metadata.openGraph?.images).toEqual([
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "GoProceed: робота готова до приймання, коли доказ на місці",
      },
    ]);
  });

  it("names one canonical URL, so no preview host can claim the page as its own", () => {
    // metadataBase used to be built from the request host, which meant apex,
    // www, *.vercel.app and every preview deployment self-canonicalised.
    expect(metadata.alternates?.canonical).toBe("/");
  });

  it("completes the social card: url and site name were missing by omission", () => {
    expect(metadata.openGraph?.url).toBe("/");
    expect(metadata.openGraph).toMatchObject({ siteName: "GoProceed" });
  });

  it("gives the Twitter image the same alt text as the Open Graph one", () => {
    // `twitter.images` was a bare string array, so the alt declared alongside
    // the OG image did not apply to it.
    expect(metadata.twitter?.images).toEqual([
      {
        url: "/og.png",
        alt: "GoProceed: робота готова до приймання, коли доказ на місці",
      },
    ]);
  });

  it("publishes the project mark for browser and device icons", () => {
    expect(metadata.icons).toEqual({
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", type: "image/png", sizes: "512x512" },
      ],
      apple: [
        { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
      ],
    });
  });
});

describe("each page's metadata (DEV-022)", () => {
  const pages = ["home", "product", "roles", "pilot"] as const;
  const all = pages.map((page) => ({ page, meta: createPageMetadata("https://goproceed.example", page) }));

  it("gives every page its own title, description and canonical", () => {
    for (const field of ["title", "description"] as const) {
      expect(new Set(all.map(({ meta }) => meta[field])).size, field).toBe(pages.length);
    }
    for (const { page, meta } of all) {
      expect(meta.alternates?.canonical).toBe(landingContent.pages[page].path);
      expect(meta.openGraph?.url).toBe(landingContent.pages[page].path);
    }
  });

  it("keeps the whole social card on every page, because Next merges metadata shallowly", () => {
    // A page that set only `openGraph.url` would REPLACE the layout's
    // `openGraph` and lose the image, the locale and the site name.
    for (const { page, meta } of all) {
      expect(meta.openGraph?.images, page).toHaveLength(1);
      expect(meta.openGraph, page).toMatchObject({ siteName: "GoProceed", locale: "uk_UA" });
      expect(meta.twitter?.images, page).toHaveLength(1);
    }
  });

  it("speaks of no payment in any description — «передоплати» excepted", () => {
    for (const { page, meta } of all) {
      expect(String(meta.description).match(/(^|[^\p{L}''])оплат/giu), page).toBeNull();
    }
  });

  it("serves the home page's as the root layout's default", () => {
    expect(createLandingMetadata("https://goproceed.example")).toEqual(all[0]?.meta);
  });
});

describe("each page exports the metadata of its own path (R-05)", () => {
  // The factory above is right for every key; this pins that each page asks it
  // for ITS key. `app/roles/page.tsx` calling `createPageMetadata(…, "product")`
  // by copy-paste would pass every other test and canonicalise /roles to /product.
  const modules = {
    home: () => import("../app/page"),
    product: () => import("../app/product/page"),
    roles: () => import("../app/roles/page"),
    pilot: () => import("../app/pilot/page"),
  } as const;

  it.each(Object.keys(modules) as (keyof typeof modules)[])("%s", async (key) => {
    const { metadata } = await modules[key]();
    expect(metadata.alternates?.canonical).toBe(landingContent.pages[key].path);
    expect(metadata.openGraph?.url).toBe(landingContent.pages[key].path);
    expect(metadata.title).toBe(landingContent.pages[key].title);
  });
});
