import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout from "../app/layout";
import { readFileSync } from "node:fs";

describe("landing design contract", () => {
  it("ships the approved evidence-journey direction with the document", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <main />
      </RootLayout>,
    );

    expect(html).toContain('data-impeccable-contract="user-approved-evidence-journey-2026-08-25"');
    expect(html).toContain("THESIS: One evidence route");
    expect(html).toContain("FINISH: Unreviewed and undocumented is unfinished");
  });
});

describe("the landing loads Onest and nothing else for text", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  it("imports Onest and JetBrains Mono", () => {
    expect(layout).toContain('import "@fontsource-variable/onest"');
    expect(layout).toContain('import "@fontsource-variable/jetbrains-mono"');
  });
  it("no longer imports Inter or Source Serif", () => {
    expect(layout).not.toContain("@fontsource-variable/inter");
    expect(layout).not.toContain("@fontsource-variable/source-serif-4");
  });
});
