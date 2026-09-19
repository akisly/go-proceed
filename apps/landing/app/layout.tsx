import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { createLandingMetadata } from "../content/landing-metadata";
import { color } from "@goproceed/tokens";
import { SITE_ORIGIN } from "../content/site-origin";

// Two families, self-hosted as variable fonts:
//   Onest          — every heading, all body copy, all UI, every figure
//   JetBrains Mono — index labels, evidence IDs, figure captions
// Daylight (2026-09-05): the serif display face and Inter are gone; the
// prototype sets everything in Onest. Files taken from
// @fontsource-variable/onest 5.3.1 and jetbrains-mono 5.3.0: wght 100–900,
// `tnum`, Іі Її Єє Ґґ.
//
// [2026-09-07] These were `import "@fontsource-variable/onest"`, which puts
// every face inside the render-blocking stylesheet. The browser therefore
// could not learn a font file existed until that sheet had parsed — five
// files, 121 KB, at depth three of the request chain, none preloadable
// because @fontsource's filenames are hashed by the build. `next/font/local`
// inlines the @font-face rules into the head and emits the preload links
// itself, which is the only way to preload a name the build decides.
//
// Two calls per family, one per subset, because `localFont` has no
// per-file `unicode-range`. Ordering the two families in the stack does the
// same job: a Cyrillic glyph is found in the first face, a Latin one falls
// through to the second. `adjustFontFallback` is off so Next does not insert
// its Arial metric-match BETWEEN them, which would end the search early.
import localFont from "next/font/local";
import "./globals.css";

const onestCyrillic = localFont({
  src: "./fonts/onest-cyrillic.woff2",
  variable: "--font-onest-cyrillic",
  display: "swap",
  adjustFontFallback: false,
  weight: "100 900",
});

const onestLatin = localFont({
  src: "./fonts/onest-latin.woff2",
  variable: "--font-onest-latin",
  display: "swap",
  adjustFontFallback: false,
  weight: "100 900",
});

// Not preloaded: the mono sets index labels and evidence codes — secondary
// text, and 52 KB is not worth spending on a phone before the copy is up.
const monoCyrillic = localFont({
  src: "./fonts/jetbrains-mono-cyrillic.woff2",
  variable: "--font-jetbrains-mono-cyrillic",
  display: "swap",
  adjustFontFallback: false,
  preload: false,
  weight: "100 800",
});

const monoLatin = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  variable: "--font-jetbrains-mono-latin",
  display: "swap",
  adjustFontFallback: false,
  preload: false,
  weight: "100 800",
});

const fontVariables = [onestCyrillic, onestLatin, monoCyrillic, monoLatin]
  .map((f) => f.variable)
  .join(" ");

const DESIGN_CONTRACT = `<!--
THESIS: The work is ready for acceptance when the proof is in place; the page shows one work package travelling from requirement to draft act.
OWN-WORLD: Warm paper, cool ink, one cobalt mark; Onest and JetBrains Mono; the owner's reference reimplemented in token roles and the motion vocabulary, nothing of it copied; no 3D scene — the floor is one flat grid under a CSS perspective, the rain a 2D canvas.
STORY: Four pages (DEV-022) in the reference's form (DEV-023). Home: the full-viewport first screen → what it is, beside the records of one work → the four roles 01–04 → three cards on a grid → the pilot's terms as the fact band, over the requirement sources → the radial closing offer. /product: the sticky list of five steps → the application view → capture channels → provenance → position. /roles: roles, the payer first → Рис. 01 → було і стало. /pilot: the plan, the one form, the questions.
FIRST VIEWPORT: One promise and one definition of the product, centred over a perspective floor and under a pixel-rain field, the product's name turning on an arc above the heading, two pills.
FORM: The owner's reference, https://parlo-black.vercel.app/, «1 в 1» in our colours — owner, 2026-09-19 (DEV-023). Until then: Daylight parity with design-references/contest-2026-09/daylight/index.html (2026-09-06).
FINISH: Unreviewed and undocumented is unfinished; the build ends with the seven-width QA pass and DESIGN.md.
-->`;

// Static, not `generateMetadata`. Reading request headers here is what made
// the whole `/` route dynamic (ƒ rather than ○ in the build output) and what
// let every preview host canonicalise the page to itself. The origin now comes
// from the environment at build time — see content/site-origin.ts.
//
// [DEV-022] This is the default, and it is the home page's. Each of the four
// pages exports its own complete object (`createPageMetadata`), because Next
// merges metadata shallowly.
export const metadata: Metadata = createLandingMetadata(SITE_ORIGIN);

/**
 * The mobile browser's own chrome. `canvas` is the page's ground, so the bar
 * above the page stops being a different colour from the page.
 *
 * Read from the token rather than typed as a hex: this is the one place a
 * colour has to be a literal string (a meta tag cannot hold a CSS variable),
 * and a hand-copied `#F6F5F1` is exactly the value that goes stale the day the
 * ramp moves. One entry, not a light/dark pair — D6 ships light only, which is
 * what `data-theme` below says.
 */
export const viewport: Viewport = { themeColor: color.light["bg-canvas"] };

export default function RootLayout({ children }: { children: ReactNode }) {
  // data-theme is set explicitly rather than left to the OS. D6 ships light
  // only; the dark block in tokens.generated.css is authored and inert, and
  // this attribute is the switch that turns it on when that decision is taken.
  return (
    // [DEV-022 R-01] `data-scroll-behavior`: globals.css sets `scroll-behavior:
    // smooth` for in-page anchors, and since Next 16 the router no longer
    // suspends it during a route transition unless this attribute asks
    // (next/dist/docs/01-app/02-guides/upgrading/version-16.md §«Scroll Behavior
    // Override»). Without it, following a link at the foot of one page animated
    // the viewport up through the whole of the next. Hash links stay smooth.
    <html lang="uk" data-theme="light" data-scroll-behavior="smooth" className={fontVariables}>
      <body className="landing-body">
        {/* Development only. The contract names internal paths, internal
          * process and internal vocabulary, and it shipped as the first node
          * of every production response on the marketing site of a product
          * whose pitch is provenance. It still does its job in dev. */}
        {process.env.NODE_ENV !== "production" && (
          <template
            data-impeccable-contract="user-approved-reference-form-2026-09-19"
            dangerouslySetInnerHTML={{ __html: DESIGN_CONTRACT }}
          />
        )}
        {children}
      </body>
    </html>
  );
}
