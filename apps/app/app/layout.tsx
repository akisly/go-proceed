import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
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
        color: "#15161A",
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
  // question.]
  themeColor: "#15161A",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      {/*
       * `goproceed-app` on <body>, not on a per-screen root element.
       *
       * `globals.css`'s `.goproceed-app`-scoped `base` layer is where the
       * themed focus-visible ring, the `prefers-reduced-motion` override, the
       * base font-family/size, and the heading/paragraph/border resets all
       * live — none of that is optional polish for a foreman reading a phone
       * outdoors. The retired apps/demo applied the class per-page rather than on <body>,
       * because it also serves public marketing routes that must stay on the
       * frozen legacy stylesheet; apps/app has no such routes; every screen
       * here is the field client. Scoping per-screen would only recreate the
       * chance that a future screen forgets the class and silently ships
       * with no focus ring — putting it on <body> once removes that failure
       * mode entirely.
       */}
      <body className="goproceed-app">{children}</body>
    </html>
  );
}
