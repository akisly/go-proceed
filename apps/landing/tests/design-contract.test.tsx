import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// `next/font/local` is a build-time transform, not a runtime function: outside
// the Next compiler the import resolves to a stub that throws when called. The
// layout calls it four times at module scope, so this mock has to exist before
// the layout is imported — hence the dynamic import below.
vi.mock("next/font/local", () => ({
  default: (options: { variable?: string }) => ({
    variable: options.variable ?? "--font-test",
    className: "",
    style: { fontFamily: "test" },
  }),
}));

const { default: RootLayout } = await import("../app/layout");

describe("landing design contract", () => {
  it("ships the approved direction with the document — the owner's reference form, 2026-09-19", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <main />
      </RootLayout>,
    );

    expect(html).toContain('data-impeccable-contract="user-approved-reference-form-2026-09-19"');
    expect(html).toContain("THESIS: The work is ready");
    expect(html).toContain("FORM: The owner's reference");
    expect(html).toContain("FINISH: Unreviewed and undocumented is unfinished");
  });
});

describe("the landing loads the brand sheet's faces and nothing else for text", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  // [2026-09-07] These two used to assert the @fontsource imports by name. Only
  // the loader changed then — self-hosted through `next/font/local` so the
  // faces can be preloaded. [2026-09-22] The families changed too: Onest gave
  // way to the brand sheet's Hanken Grotesk, which has no Cyrillic, so
  // Commissioner stands behind it for the copy. The guarantee is the same:
  // these faces, and none of the retired ones.
  it("loads Hanken Grotesk, Commissioner and JetBrains Mono", () => {
    expect(layout).toContain("./fonts/hanken-grotesk-latin.woff2");
    expect(layout).toContain("./fonts/commissioner-cyrillic.woff2");
    expect(layout).toContain("./fonts/jetbrains-mono-cyrillic.woff2");
    expect(layout).toContain("./fonts/jetbrains-mono-latin.woff2");
  });
  it("loads no third family, and neither of the retired ones", () => {
    // Word-bounded, and comments stripped. A bare `toContain("inter")` matches
    // «pointer» in the design contract above and «internal» in the comment
    // beside it — the §8 trap where an audit flags its own prose.
    const code = layout.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").toLowerCase();
    expect(code).not.toMatch(/\binter\b/);
    expect(code).not.toContain("source-serif");
    expect(code).not.toContain("onest");
    expect(layout.match(/localFont\(/g)).toHaveLength(4);
  });
});
