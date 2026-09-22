import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
// The brand sheet's typeface, with Commissioner behind it for Cyrillic.
// Hanken Grotesk carries no Cyrillic at all, and the whole interface is
// Ukrainian, so the two are imported together and ordered in the token stack
// (`font.sans`): Latin resolves in Hanken, Cyrillic falls through to
// Commissioner, and Commissioner's own Latin faces are never used and so
// never fetched. Two costs of importing whole packages, both accepted: the
// browser fetches Hanken's `cyrillic-ext` file (Ґ and ґ fall in its range),
// finds no glyph and falls through correctly, one wasted request; and ₴
// (U+20B4) IS in that file, so the hryvnia on a money figure renders in Hanken
// beside Ukrainian words in Commissioner. fontsource ships no per-subset CSS
// entry for either family, so the fix is hand-written @font-face rules — filed
// with the dashboard's visual pass (BL-117) rather than done blind. [Autumn, 2026-09-22, DEV-028; was @fontsource-variable/onest]
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/commissioner";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoProceed",
  description: "Фіксація прихованих робіт на об'єкті.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        // Ink. [Corrected 2026-09-05: this was `#B9F33D`, the v1 lime. Safari
        // TINTS the pinned-tab SVG with this value, so the Daylight mark the
        // brand pipeline draws into that file was still being painted in a
        // colour DESIGN.md now says exists nowhere in the system.]
        // [Autumn, 2026-09-22: was `#15161A`; the brand sheet's black.]
        color: "#0C0C0A",
      },
    ],
  },
};

/**
 * NO SERVICE WORKER, AND THE MANIFEST IS NOT ONE.
 *
 * The manifest buys a home-screen icon and nothing else. `system-overview.md`
 * forbids a service worker from caching an authenticated domain response or an
 * evidence original, and ADR-007 decision 7 ships no push in v0.1 — so a service
 * worker would have nothing it is allowed to do. Adding one "for offline" would
 * be building the durable local tier ADR-007 decision 6 and Cost 2 refuse.
 *
 * `maximumScale` is deliberately absent: capping zoom on a page a foreman reads
 * in daylight is an accessibility failure, and it is not needed for layout.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // [Corrected 2026-09-05: was `#191A1A`. `public/manifest.webmanifest` moved
  // to `#15161A` with the Daylight palette, and a meta `theme-color` that names
  // a different ink from the manifest's `theme_color` is two answers to one
  // question. 2026-09-22: both moved again, to the brand sheet's black.]
  themeColor: "#0C0C0A",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      {/*
       * No scope class on <body> since 2026-09-05. The base rules — focus
       * ring, reduced motion, the face, the resets — come from
       * `@goproceed/ui/base.css` through `./globals.css`, and they are global
       * by design: every route in this app is on the one system.
       */}
      <body>{children}</body>
    </html>
  );
}
