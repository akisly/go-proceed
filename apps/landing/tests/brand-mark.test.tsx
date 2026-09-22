import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandMark } from "../components/brand-mark";

describe("the brand mark", () => {
  const html = renderToStaticMarkup(<BrandMark />);

  it("is an inline vector, not an image request", () => {
    expect(html).toContain("<svg");
    expect(html).toContain('data-brand-mark="true"');
    expect(html).not.toContain("<img");
  });

  it("draws the tile, the chevron and the accent dot in roles, never hex", () => {
    // The dot was `fill-signal` while the signal was the brand's mark; on 2026-09-22
    // the owner put the primary on the dot and ink on the word, so it is `fill-accent`.
    expect(html).toContain("<rect");
    expect(html).toContain("<path");
    expect(html).toContain("fill-accent");
    expect(html).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });

  it("is 28px by default and hidden from assistive tech", () => {
    expect(html).toContain("size-7");
    expect(html).toContain('aria-hidden="true"');
  });
});
