import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrbitText, PixelRain } from "@goproceed/ui/motion";

/**
 * The two first-screen words DEV-023 added, in the state a reader who asked for
 * no motion gets (R-11). `useReduced()` is deliberately NOT mocked here: it is
 * true on the server and on the first client render, which is exactly the
 * reduced branch — the same technique `motion-parity-reduced.test.tsx` uses.
 *
 * What a label cannot prove — that the canvas is painted, and that it changes
 * under full motion and does not under reduced — is measured in a real browser
 * by `qa/landing.mjs` (two `toDataURL()` reads, 600ms apart).
 */
describe("first-screen primitives under reduced motion", () => {
  it("OrbitText stands still: the same arc, no spin class, hidden from assistive technology", () => {
    const html = renderToStaticMarkup(<OrbitText text="Доказовий контур" />);
    expect(html).toContain('data-orbit="still"');
    expect(html).not.toContain("orbit-spin");
    expect(html).toContain('aria-hidden="true"');
    // glyph by glyph, each on its own rotation — and deterministic, so SSR and hydration agree
    expect(html.match(/class="orbit-glyph"/g)?.length).toBeGreaterThan(30);
    expect(html).toBe(renderToStaticMarkup(<OrbitText text="Доказовий контур" />));
  });

  it("PixelRain is one still frame: a decorative canvas that never starts its loop", () => {
    const html = renderToStaticMarkup(<PixelRain className="h-40 w-full text-ink" />);
    expect(html).toContain('data-pixel-rain="still"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("rain-mask");
    expect(html).toContain("pointer-events-none");
  });
});
