import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "../app/page";

const html = renderToStaticMarkup(<LandingPage />);

describe("landing semantic frame", () => {
  it("publishes one main heading and the first narrative landmarks", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);

    for (const id of ["product", "proof"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("keeps every pilot action inert", () => {
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("disabled");
    expect(html).not.toContain('href="/pilot');
    expect(html).not.toContain("<form");
  });
});
