"use client";

import { useEffect, useRef } from "react";
import { mountCanvasLoop, type CanvasScene } from "./canvas-loop";
import { useReduced } from "./use-reduced";

/**
 * The hero's pixel field (DEV-023; rebuilt in DEV-024): a halftone screen — a
 * small square in every cell of a regular grid, each brightening and dimming
 * on its own clock — across the whole top of the first screen, deep at the two
 * sides and shallow at the centre, thinning toward its foot, breathing a little.
 * It is the landing reference's first-screen texture, drawn in our ink on our
 * paper.
 *
 * [DEV-024] DEV-023 drew falling columns over a quarter of the screen, from
 * still screenshots. Watched live, the reference's field is something else:
 * nothing falls; a standing raster shimmers, it reaches two fifths of the
 * screen, and its middle is left open for the light behind the heading. The
 * owner: «она в референсе другая, её больше, и по центру светлый градиент».
 * The name stays — it is the word the hero, the kitchen sink and the harness
 * already use — and the light is the hero's own radial ground, not this canvas.
 *
 * [DEV-024, seventh pass, owner, with a crop of the reference's first screen:
 * «глянь как сделан верх в hero на референсе, он отличается от нашего, хочу
 * так же».] Three things differed, and all three are this file's or its
 * caller's: the reference's is a SCREEN — a dot in every cell of the grid, all
 * nearly one size, differing in brightness — where ours was a few large squares
 * over a nearly invisible fine grain; it runs the WHOLE WIDTH under the header,
 * deep at the two sides and shallow in the middle, an oval of open ground,
 * where ours was two corners; and it starts at the very top edge, BEHIND a
 * header that is transparent until the page scrolls (`HeaderVeil`, the
 * landing's), where ours began under an opaque bar.
 *
 * WHY IT IS A PRIMITIVE, AND A CANVAS. Several thousand cells change every
 * tick; as DOM nodes or as a CSS animation per cell that is a layout and a
 * style recalculation the first screen cannot afford. One 2D canvas is one
 * paint. It lives here rather than in a block because every motion rule the
 * system has is enforced by living in this directory, and the rules a canvas
 * keeps are `canvas-loop.ts`'s:
 *
 *  - it runs only while the field is on screen and the tab is visible;
 *  - it ticks at ~16 fps, not 60 — the texture is a shimmer, not a simulation;
 *  - under reduced motion it draws ONE still frame and never starts the loop —
 *    a different composition, not a slower one;
 *  - the colour is the element's computed `color`, so it is a token role chosen
 *    by the caller's class (`text-ink`), never a value written here;
 *  - the foot fade is `rain-mask` in `base.css`, so the audit can read it;
 *  - THE CALLER SIZES THE CANVAS IN CSS (`h-… w-full`).
 *
 * It does not follow the pointer: the reference's does not either — there the
 * pointer lights the floor's cells, which is `CellField`.
 *
 * Decorative: `aria-hidden`, no pointer events.
 */
export function PixelRain({
  className, cell = 8, calm = 0,
}: {
  className?: string | undefined;
  /** Grid pitch in CSS px. */
  cell?: number | undefined;
  /**
   * Px from the top that stay QUIET: every cell still holds its dot there, but
   * none brighter than a dim one and none swollen. The landing's header is glass
   * over this band, and on paper a bright dot is darker than the header's muted
   * links — one standing after the wordmark read as a full stop, others as
   * interpuncts between the links (B7-01). The reference has no such trouble:
   * its text is white and its dots are dim; ink on paper reverses that order.
   */
  calm?: number | undefined;
}) {
  const reduced = useReduced();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let colour = "";
    let start = 0;

    /** A stable pseudo-random number in [0, 1) per cell — the same picture on every load. */
    const hash = (x: number, y: number, salt: number): number => {
      const n = Math.imul(x * 73856093 ^ y * 19349663 ^ salt * 83492791, 2654435761) >>> 0;
      return n / 4294967296;
    };

    const scene: CanvasScene = {
      resize(w, h, ratio, c) {
        width = w; height = h; colour = c;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      },
      frame(now) {
        if (!start) start = now;
        // Seconds. The still frame is one moment of the same screen.
        const t = reduced ? 3.1 : (now - start) / 1000;
        const cols = Math.ceil(width / cell);
        const rows = Math.ceil(height / cell);
        const half = width / 2;
        const narrow = width < 1000;
        // The whole field breathes a little, 88 %…100 % of its depth on an 11 s swell.
        const swell = 0.94 + 0.06 * Math.sin(t * (Math.PI * 2 / 11) - 0.6);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = colour;
        for (let y = 0; y < rows; y++) {
          const py = y * cell;
          const v = py / height;
          for (let x = 0; x < cols; x++) {
            const px = x * cell;
            // HOW DEEP THE SCREEN REACHES AT THIS x: a quarter of the canvas at the centre line,
            // all of it at the two edges — an oval of open paper under the middle of the header.
            const u = Math.min(1, Math.abs(px + cell / 2 - half) / half);
            // On a narrow canvas the same curve is a tall parabola between two curtains
            // (B7-02): there the opening is kept wide and the sides a little shallower.
            const depth = (narrow ? 0.22 + 0.62 * Math.pow(u, 2.8) : 0.24 + 0.76 * Math.pow(u, 1.7)) * swell;
            // …and it thins toward that limit over a fifth of the canvas, rather than being cut.
            const env = Math.min(1, Math.max(0, (depth - v) / 0.2)) * (1 - 0.3 * v);
            if (env < 0.02) continue;
            // EVERY CELL HOLDS A DOT — that is what makes it a screen and not scattered
            // squares. A cell's standing brightness is its own (most are dim, a few bright),
            // and its own slow clock swells it: what shimmers is brightness, barely size.
            const rank = hash(x, y, 3);
            const standing = 0.1 + 0.9 * rank * rank * rank;
            const speed = 0.3 + hash(x, y, 1) * 0.9;
            const wave = 0.5 + 0.5 * Math.sin(t * speed * 2 + hash(x, y, 2) * Math.PI * 2);
            // Under `calm` every dot is the dimmest a dot gets (the standing floor, 0.1): no twinkle, one size,
            // alpha ≤ 0.30 — only the field's slow breath remains where it thins toward the centre. Over the
            // next 24px the field comes up to itself, so the band has no edge.
            const lift = calm ? Math.min(1, Math.max(0, (py - calm) / 24)) : 1;
            const bright = 0.1 + (standing * (0.45 + 0.55 * wave) - 0.1) * lift;
            const size = bright > 0.6 ? 3 : 2;
            ctx.globalAlpha = env * (0.22 + 0.74 * bright);
            const o = (cell - size) >> 1;
            ctx.fillRect(px + o, py + o, size, size);
          }
        }
        ctx.globalAlpha = 1;
        return true;
      },
    };

    const loop = mountCanvasLoop(canvas, scene, { run: !reduced, fps: 16 });
    return () => loop.stop();
  }, [reduced, cell, calm]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-pixel-rain={reduced ? "still" : "running"}
      className={className ? `rain-mask pointer-events-none ${className}` : "rain-mask pointer-events-none"}
    />
  );
}
