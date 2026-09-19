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

describe("the landing loads Onest and nothing else for text", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  // [2026-09-07] These two used to assert the @fontsource imports by name. The
  // families are unchanged; only the loader is — self-hosted through
  // `next/font/local` so the faces can be preloaded. The guarantee the pair
  // exists for is the same: two families, and neither of them the retired ones.
  it("loads Onest and JetBrains Mono", () => {
    expect(layout).toContain("./fonts/onest-cyrillic.woff2");
    expect(layout).toContain("./fonts/onest-latin.woff2");
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
    expect(layout.match(/localFont\(/g)).toHaveLength(4);
  });
});
