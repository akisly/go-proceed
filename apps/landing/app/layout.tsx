import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { createLandingMetadata } from "../content/landing-metadata";
import { color } from "@goproceed/tokens";
import { SITE_ORIGIN } from "../content/site-origin";

// Three faces, self-hosted as variable fonts, in two families that read as one:
//   Hanken Grotesk — the brand sheet's typeface. Every Latin glyph, every
//                    digit, the wordmark, the W-/EV-/R- codes
//   Commissioner   — Cyrillic, which is nearly all of the public copy
//   JetBrains Mono — index labels, evidence IDs, figure captions
//
// [Autumn, 2026-09-22, DEV-025] The owner's brand sheet sets the product in
// Hanken Grotesk. That face has NO Cyrillic — verified on the family's own v12
// file: of the 66 Ukrainian letters it carries none, and of the whole Cyrillic
// block only ₴ — and this site is written in Ukrainian, so Hanken alone would
// render every word of it in system-ui. Commissioner stands behind it: full
// Ukrainian coverage, and the closest metric match to Hanken among the
// Cyrillic-capable faces measured (x-height/cap 0.701 against 0.707, stem
// 0.413 em against 0.409), so the seam inside a mixed line is not a step.
// Files taken from @fontsource-variable/hanken-grotesk 5.3.0 (latin subset)
// and @fontsource-variable/commissioner 5.3.0 (cyrillic subset), both
// wght 100–900, and jetbrains-mono 5.3.0.
//
// [2026-09-07] These were `import "@fontsource-variable/onest"`, which puts
// every face inside the render-blocking stylesheet. The browser therefore
// could not learn a font file existed until that sheet had parsed — five
// files, 121 KB, at depth three of the request chain, none preloadable
// because @fontsource's filenames are hashed by the build. `next/font/local`
// inlines the @font-face rules into the head and emits the preload links
// itself, which is the only way to preload a name the build decides.
//
// One call per file, because `localFont` has no per-file `unicode-range`.
// Ordering the faces in the stack does that job instead, and here the order is
// load-bearing in a way it was not under one family: LATIN FIRST. A Latin
// glyph must be found in Hanken — it is the brand's own face and the reason
// for the change — and only a Cyrillic one, which Hanken does not have, falls
// through to Commissioner. Reversing them would hand «GoProceed» and every
// digit to Commissioner and leave the sheet's typeface unused.
// `adjustFontFallback` is off so Next does not insert its Arial metric-match
// BETWEEN them, which would end the search early.
import localFont from "next/font/local";
import "./globals.css";

const hankenLatin = localFont({
  src: "./fonts/hanken-grotesk-latin.woff2",
  variable: "--font-hanken-latin",
  display: "swap",
  adjustFontFallback: false,
  weight: "100 900",
});

const commissionerCyrillic = localFont({
  src: "./fonts/commissioner-cyrillic.woff2",
  variable: "--font-commissioner-cyrillic",
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

const fontVariables = [hankenLatin, commissionerCyrillic, monoCyrillic, monoLatin]
  .map((f) => f.variable)
  .join(" ");

const DESIGN_CONTRACT = `<!--
THESIS: The work is ready for acceptance when the proof is in place; the page shows one work package travelling from requirement to draft act.
OWN-WORLD: Warm paper, warm ink, one ember mark and one pine word; Hanken Grotesk with Commissioner for Cyrillic, and JetBrains Mono; the owner's reference reimplemented in token roles and the motion vocabulary, nothing of it copied; no 3D scene — the floor is one flat grid under a CSS perspective, the rain a 2D canvas.
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
