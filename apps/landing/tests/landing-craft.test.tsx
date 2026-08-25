import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "../app/page";

const html = renderToStaticMarkup(<LandingPage />);
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("landing craft contract", () => {
  it("renders one continuous evidence rail with every domain transition", () => {
    expect(html).toContain('data-evidence-rail="true"');
    expect(html).toContain("R-041");
    expect(html).toContain("EV-0248");
    expect(html).toContain("DR-0091");
    expect(html).toContain("CL-017");
  });

  it("uses the approved physical blueprint material", () => {
    expect(html).toContain("blueprint-folio.png");
  });

  it("ships a static reduced-motion journey and a reduced-motion handoff", () => {
    expect(html).toContain("landing-journey-inline-scene");
    expect(html).toContain("motion-reduce:wide:block");
    expect(html).toContain("motion-reduce:wide:hidden");
    expect(html).toContain("motion-reduce:wide:grid-cols-1");
    expect(html).toContain('data-handoff-line="true"');
    expect(html).toContain("motion-reduce:scale-x-100");
  });

  it("keeps the hero field neutral instead of repeating the signal colour", () => {
    const heroField = css.match(/\.landing-hero-field\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? "";
    expect(heroField).not.toContain("--color-action-signal");
  });
});
