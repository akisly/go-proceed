import type { Metadata } from "next";
import { landingContent, type PageKey } from "./landing-content";

/** The root layout's default — the home page's. Each page exports its own. */
export function createLandingMetadata(origin: string): Metadata {
  return createPageMetadata(origin, "home");
}

/**
 * [DEV-025] One complete object per page, not a patch over the layout's.
 * Next merges metadata SHALLOWLY (Next 16.3.1, generate-metadata.md §Merging):
 * a page that set only `openGraph.url` would replace the layout's whole
 * `openGraph` and drop the image, the locale and the site name with it.
 */
export function createPageMetadata(origin: string, page: PageKey): Metadata {
  const { path, title, description } = landingContent.pages[page];
  return {
    metadataBase: new URL(origin),
    title,
    description,
    applicationName: "GoProceed",
    // One canonical per page for every host that serves this app. Without it,
    // apex, www, *.vercel.app and each preview deployment claim it separately.
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "uk_UA",
      url: path,
      siteName: "GoProceed",
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: "GoProceed: робота готова до приймання, коли доказ на місці",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      // An object rather than a bare string: `images: ["/og.png"]` carries no
      // alt, so the description declared beside the Open Graph image did not
      // reach the Twitter card at all.
      images: [
        {
          url: "/og.png",
          alt: "GoProceed: робота готова до приймання, коли доказ на місці",
        },
      ],
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", type: "image/png", sizes: "512x512" },
      ],
      apple: [
        { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
      ],
    },
  };
}
