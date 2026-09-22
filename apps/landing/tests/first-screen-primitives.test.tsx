import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArcField, CellField, OrbitText, ParticleSphere, PixelRain, cellIsBarred, cellIsBarredByDisc } from "@goproceed/ui/motion";

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

/**
 * [DEV-024] The three canvas words the reference's BEHAVIOUR needed — AS SERVED.
 * `renderToStaticMarkup` runs no effect, so what is pinned here is the markup
 * every reader starts from, which is also the whole of what a reduced-motion
 * reader ever gets: the resting `data-*` state, `aria-hidden`, who takes
 * pointer events, the mask. It is not evidence of behaviour (R-12). That the
 * bitmaps light, fade, lean and scatter under full motion — and do not under
 * reduced motion or on a touch device — is measured by `qa/landing.mjs`.
 */
describe("the pointer-reactive canvas words as served (DEV-024)", () => {
  it("CellField is served off: the ground's CSS grid is the whole composition, and the canvas over it is decorative", () => {
    const html = renderToStaticMarkup(<CellField pitch={62} className="h-40 w-full text-ink" />);
    expect(html).toContain('data-cell-field="off"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("pointer-events-none");
  });
  it("CellField names the boxes it must not light, for the harness to find", () => {
    const html = renderToStaticMarkup(<CellField pitch={62} exclude="[data-dome]" />);
    expect(html).toContain('data-cell-exclude="[data-dome]"');
    expect(renderToStaticMarkup(<CellField pitch={62} />)).not.toContain("data-cell-exclude");
  });
  it("bars a cell that overlaps the box by any amount, and no other (R2-02)", () => {
    // pitch 62, origin 10: column i spans [10 + 62i, 72 + 62i); row j spans [62j, 62j + 62)
    const dome = { left: 0, top: 500, right: 1378, bottom: 820 };
    expect(cellIsBarred(3, 8, 62, 10, dome), "row 8 is 496–558: it straddles the top edge by 58px").toBe(true);
    expect(cellIsBarred(3, 7, 62, 10, dome), "row 7 is 434–496: clear of it").toBe(false);
    expect(cellIsBarred(3, 10, 62, 10, dome), "inside").toBe(true);
    expect(cellIsBarred(3, 13, 62, 10, dome), "row 13 is 806–868: it straddles the bottom edge").toBe(true);
    expect(cellIsBarred(3, 14, 62, 10, dome), "below").toBe(false);
    // a cell that ABUTS the box — its bottom exactly on the box's top — is not barred: it paints up to the edge and no further
    expect(cellIsBarred(3, 7, 62, 10, { ...dome, top: 496 })).toBe(false);
    expect(cellIsBarred(3, 7, 62, 10, { ...dome, top: 495 }), "one pixel of overlap is enough").toBe(true);
    // sideways: a box that does not span the row
    expect(cellIsBarred(0, 10, 62, 10, { ...dome, left: 72 }), "column 0 is 10–72: it abuts the box's left edge").toBe(false);
    expect(cellIsBarred(1, 10, 62, 10, { ...dome, left: 72 })).toBe(true);
  });
  it("bars the cells the dome's DISC reaches, and leaves the ones beside it alive (owner, seventh pass)", async () => {
    const { domeDisc, buildDome } = await import("../../../packages/ui/src/motion/particle-sphere-model");
    // the fact band at 1440: the dome's box is 1378 × 416 with 96px of headroom
    const disc = domeDisc(1378, 416, 96);
    const dome = buildDome(1378, 416, 96);
    expect(disc.cx).toBeCloseTo(689, 6);
    expect(disc.r).toBeCloseTo(dome.radius, 6);
    expect(disc.cy - disc.r, "the apex stands at the headroom").toBeCloseTo(96, 6);
    expect(disc.cy, "the centre is below the box's foot").toBeGreaterThan(416);
    // pitch 62, origin 0. The cell under the apex is barred; the cell in the strip's far corner, level with the apex, is not.
    const under = [Math.floor(disc.cx / 62), Math.floor((disc.cy - disc.r + 30) / 62)] as const;
    expect(cellIsBarredByDisc(under[0], under[1], 62, 0, disc, 10)).toBe(true);
    expect(cellIsBarredByDisc(0, under[1], 62, 0, disc, 10), "beside the dome, in its strip").toBe(false);
    expect(cellIsBarredByDisc(Math.floor(1378 / 62) - 1, under[1], 62, 0, disc, 10)).toBe(false);
    // the margin: a cell whose nearest corner is 5px outside the disc is barred with 10px of margin and not with none
    const edge = { cx: 0, cy: 0, r: 100 };
    expect(cellIsBarredByDisc(0, 0, 62, 105, edge, 10), "nearest point (105, 0): 5px outside").toBe(true);
    expect(cellIsBarredByDisc(0, 0, 62, 105, edge, 0)).toBe(false);
    expect(cellIsBarredByDisc(0, 0, 62, 111, edge, 10), "11px outside").toBe(false);
  });
  it("CellField on a transformed plane hears the pointer itself — the one case a canvas word takes pointer events", () => {
    const html = renderToStaticMarkup(<CellField pitch={60} track="self" />);
    expect(html).toContain("pointer-events-auto");
    expect(html).toContain('aria-hidden="true"');
  });
  it("ArcField is served as the still fan: masked at the centre for the heading, decorative, no pointer events", () => {
    const html = renderToStaticMarkup(<ArcField className="h-40 w-full text-ink" />);
    expect(html).toContain('data-arc-field="still"');
    expect(html).toContain("arc-mask");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("pointer-events-none");
  });
  it("the dome's model keeps its headroom empty: the apex stands `head` px under the canvas's top (owner, third pass)", async () => {
    const { buildDome } = await import("../../../packages/ui/src/motion/particle-sphere-model");
    // canvas 1378 × 416 with 96px of headroom → the dome is the one a 320px box gives
    const tall = buildDome(1378, 416, 96);
    const flat = buildDome(1378, 320);
    expect(tall.radius).toBeCloseTo(flat.radius, 6);
    // apex y (origin at the canvas centre, y up) = centreY + radius; from the top edge: h/2 − apex
    expect(416 / 2 - (tall.centreY + tall.radius)).toBeCloseTo(96, 6);
    expect(320 / 2 - (flat.centreY + flat.radius)).toBeCloseTo(0, 6);
    expect(tall.count).toBe(flat.count);
    // [R3-04] the phone, where the WIDTH sets the radius: the same dome as the 120px box gave, its
    // apex lower than the headroom asks (never higher), and still seated on the box's foot
    const phone = buildDome(358, 216, 96);
    const phoneFlat = buildDome(358, 120);
    expect(phone.radius).toBeCloseTo(phoneFlat.radius, 6);
    expect(phone.count).toBe(phoneFlat.count);
    expect(216 / 2 - (phone.centreY + phone.radius)).toBeGreaterThanOrEqual(96);
    // the sphere's centre stands the same share of the radius below the canvas's foot, whatever the headroom
    for (const d of [tall, flat, phone, phoneFlat]) expect((-(d === tall ? 416 : d === flat ? 320 : d === phone ? 216 : 120) / 2 - d.centreY) / d.radius).toBeCloseTo(0.38, 6);
  });
  it("ParticleSphere is served as the still 2D dome, with the scene's canvas empty beside it — no WebGL in the markup", () => {
    const html = renderToStaticMarkup(<ParticleSphere className="h-40 w-full text-ink" />);
    expect(html).toContain('data-particle-sphere="still"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("pointer-events-none");
    expect(html.match(/<canvas/g)).toHaveLength(2);
    // the still layer is shown; only a running scene hides it
    expect(html).not.toContain("opacity-0");
  });
});
