import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout from "../app/layout";

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
