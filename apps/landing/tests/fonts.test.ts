import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const app = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(app, p), "utf8");
const layout = read("app/layout.tsx");
const globals = read("app/globals.css");

/**
 * Fonts are self-hosted through `next/font/local`, not `@fontsource`.
 *
 * The @fontsource import put every face inside the render-blocking stylesheet,
 * which meant the browser could not even learn a font file existed until that
 * stylesheet had downloaded and parsed — five files, 121 KB, all at depth three
 * of the request chain, none of them preloaded, because @fontsource's filenames
 * are hashed at build time and cannot be named in a `<link rel="preload">`.
 * Measured on the built page (Lighthouse 13.4.1, mobile profile): FCP 2.1 s,
 * LCP 3.8 s, and the whole gap between them sitting on that chain.
 *
 * `next/font/local` inlines the `@font-face` rules into the document head and
 * emits the preload links itself, which is the only way to preload a file whose
 * name the build decides.
 */
describe("the typefaces load without waiting for the stylesheet", () => {
  it("no longer pulls whole families out of the package that shipped them", () => {
    // Comments stripped first: this file's own header explains what it moved
    // away from and names it, and the trap in §8 is a scan that flags its own
    // documentation.
    const code = layout.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("@fontsource");
  });

  it("declares all three faces through next/font/local", () => {
    expect(layout).toContain('from "next/font/local"');
    expect(layout).toMatch(/localFont\(/);
  });

  it("ships only the subsets Ukrainian and the product vocabulary need", () => {
    // Latin for «GoProceed», «Telegram» and every W-/EV-/R- code; Cyrillic for
    // the copy. `cyrillic-ext`, `greek`, `vietnamese`, `math` and `symbols`
    // were being declared and, in the case of `symbols`, actually downloaded —
    // 18 KB fetched because the copy contains «→», which no other subset
    // covers.
    // [Autumn, 2026-09-22] Onest's two subsets became Hanken Grotesk's latin
    // and Commissioner's cyrillic: the brand sheet's face carries no Cyrillic
    // at all, so the pair is two families, and each ships the one subset it is
    // there for.
    for (const file of [
      "app/fonts/hanken-grotesk-latin.woff2",
      "app/fonts/commissioner-cyrillic.woff2",
      "app/fonts/jetbrains-mono-latin.woff2",
      "app/fonts/jetbrains-mono-cyrillic.woff2",
    ]) {
      expect(existsSync(join(app, file)), `${file} is missing`).toBe(true);
    }
  });

  it("preloads the body faces and not the index face", () => {
    // Hanken Grotesk and Commissioner set every heading and all body copy,
    // including the LCP element. JetBrains Mono sets index labels and evidence
    // codes — small, secondary, and not worth 52 KB of preload on a phone.
    // Sliced on the DECLARATIONS, not on the family names: the comment above
    // them names both packages in lowercase, so `indexOf("hanken")` used to
    // land in prose and the assertion below could not fail (found in review,
    // 2026-09-22 — the same collision existed in the Onest version).
    const sans = layout.slice(layout.indexOf("const hankenLatin"), layout.indexOf("const monoCyrillic"));
    expect(sans).not.toContain("preload: false");
    expect(layout.slice(layout.indexOf("const monoCyrillic"))).toContain("preload: false");
  });

  it("declares the token override UNLAYERED, or it loses to the generated sheet", () => {
    // `tokens.generated.css` declares its `:root` outside every layer, and an
    // unlayered rule beats a layered one at any specificity. Inside
    // `@layer base` this override lost silently: the old family name survived,
    // no face by that name existed any more, and the entire page rendered in
    // `system-ui` — with every test green and the build clean. Only the visual
    // pass caught it, which is precisely why this assertion exists.
    // Comments stripped: the explanation above this override says the words
    // «@layer base», and a raw scan would find its own prose first.
    const css = globals.replace(/\/\*[\s\S]*?\*\//g, "");
    const override = css.indexOf("--gp-font-sans:");
    const firstLayer = css.indexOf("@layer");
    expect(override).toBeGreaterThan(-1);
    expect(override).toBeLessThan(firstLayer);
  });

  it("keeps the token as the only name the components see", () => {
    // Components name `font-sans`/`font-mono`, never a family. The generated
    // token still resolves them; the landing only re-points it at the faces it
    // now owns. The sans is LATIN first — «GoProceed», every digit and every
    // W-/EV-/R- code must be found in the brand sheet's own face, and only
    // Cyrillic, which that face does not carry, falls through to Commissioner.
    // The mono is one family split by subset, so it stays Cyrillic first.
    expect(globals).toMatch(/--gp-font-sans:\s*var\(--font-hanken-latin\),\s*var\(--font-commissioner-cyrillic\)/);
    expect(globals).toMatch(/--gp-font-mono:\s*var\(--font-jetbrains-mono-cyrillic\)/);
    // `.display` in base.css names a THIRD token. Miss it and the h1 — the
    // element the fold is measured on — keeps the retired family name.
    // Both names, in order, exactly as the sans row above: drop Commissioner
    // from the display stack and every heading — all Cyrillic, including the h1
    // the fold is measured on — falls to `system-ui`, which is the failure the
    // comment above warns about.
    expect(globals).toMatch(/--gp-font-display:\s*var\(--font-hanken-latin\),\s*var\(--font-commissioner-cyrillic\)/);
  });
});
