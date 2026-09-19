"use client";

import { useEffect, useRef } from "react";
import { useReduced } from "./use-reduced";

/**
 * The hero's pixel-rain field (DEV-023): a grid of small squares whose
 * brightness falls down each column, dense at the top edge and gone by the foot
 * of the canvas — a quarter of the first screen, as the landing sizes it. It is the landing reference's first-screen texture, drawn in
 * our ink on our paper.
 *
 * WHY IT IS A PRIMITIVE, AND A CANVAS. Several thousand cells change every
 * tick; as DOM nodes or as a CSS animation per cell that is a layout and a
 * style recalculation the first screen cannot afford. One 2D canvas is one
 * paint. It is not a 3D scene (`DESIGN.md`): no camera, no geometry, a flat
 * bitmap. It lives here rather than in a block because every motion rule the
 * system has is enforced by living in this directory — the loop below is the
 * one `requestAnimationFrame` in the vocabulary, and the rules it keeps are:
 *
 *  - it runs only while the field is on screen and the tab is visible;
 *  - it ticks at ~14 fps, not 60 — the texture is a shimmer, not a simulation;
 *  - under reduced motion it draws ONE still frame and never starts the loop —
 *    a different composition, not a slower one;
 *  - the colour is the element's computed `color`, so it is a token role chosen
 *    by the caller's class (`text-ink`), never a value written here;
 *  - the fade is `rain-mask` in `base.css`, so the audit can read it;
 *  - THE CALLER SIZES THE CANVAS IN CSS (`h-… w-full`). The bitmap is resized
 *    to the element's box from a ResizeObserver on that same element, so a
 *    canvas left to size itself from its bitmap would grow on every pass.
 *
 * Decorative: `aria-hidden`, no pointer events.
 */
export function PixelRain({
  className, cell = 8, dot = 3,
}: {
  className?: string | undefined;
  /** Grid pitch in CSS px. */
  cell?: number | undefined;
  /** Square size in CSS px. */
  dot?: number | undefined;
}) {
  const reduced = useReduced();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let cols = 0;
    let rows = 0;
    let heads: number[] = [];
    let speeds: number[] = [];
    let lengths: number[] = [];
    let frame = 0;
    let last = 0;
    let onScreen = true;
    let colour = "";
    // Advances every eighth tick: the standing field re-seeds about twice a second.
    let beat = 0;
    let ticks = 0;

    function measure(): void {
      const el = canvas!;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = el.getBoundingClientRect();
      el.width = Math.max(1, Math.round(width * ratio));
      el.height = Math.max(1, Math.round(height * ratio));
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      cols = Math.ceil(width / cell);
      rows = Math.ceil(height / cell);
      // Deterministic per column, so the still frame under reduced motion and
      // the first animated frame are the same picture on every load.
      heads = Array.from({ length: cols }, (_, i) => ((i * 7919) % 97) / 97 * rows);
      speeds = Array.from({ length: cols }, (_, i) => 0.25 + (((i * 104729) % 89) / 89) * 0.75);
      lengths = Array.from({ length: cols }, (_, i) => 4 + ((i * 1299709) % 14));
      colour = getComputedStyle(el).color;
    }

    function draw(): void {
      const el = canvas!;
      ctx!.clearRect(0, 0, el.width, el.height);
      ctx!.fillStyle = colour;
      // THE STANDING FIELD: every cell of the grid, densest and darkest along
      // the top edge and thinning by the square of the depth — the reference's
      // first screen reads as a raster dissolving downward, with the falling
      // columns as its brighter grain. `seed` flickers a cell on and off as
      // the frame counter moves, so the field shimmers without travelling.
      for (let y = 0; y < rows; y++) {
        const depth = 1 - y / rows;
        const density = depth * depth;
        for (let x = 0; x < cols; x++) {
          const seed = ((x * 73856093) ^ (y * 19349663) ^ (beat * 83492791)) >>> 0;
          if ((seed % 1000) / 1000 > density * 0.45) continue;
          ctx!.globalAlpha = 0.18 + density * 0.5;
          ctx!.fillRect(x * cell, y * cell, dot, dot);
        }
      }
      for (let x = 0; x < cols; x++) {
        const head = heads[x]!;
        const length = lengths[x]!;
        for (let k = 0; k < length; k++) {
          const y = Math.floor(head) - k;
          if (y < 0 || y >= rows) continue;
          // Brightest at the head, thinning up the tail; every third cell is
          // skipped so a column reads as scattered squares, not a bar.
          if ((x * 31 + y * 17) % 3 === 0) continue;
          ctx!.globalAlpha = (1 - k / length) * 0.9;
          ctx!.fillRect(x * cell, y * cell, dot, dot);
        }
      }
      ctx!.globalAlpha = 1;
    }

    function tick(now: number): void {
      frame = requestAnimationFrame(tick);
      if (now - last < 70) return;
      last = now;
      ticks += 1;
      if (ticks % 8 === 0) beat += 1;
      for (let x = 0; x < cols; x++) {
        heads[x] = heads[x]! + speeds[x]!;
        if (heads[x]! - lengths[x]! > rows) heads[x] = 0;
      }
      draw();
    }

    measure();
    draw();

    const resize = new ResizeObserver(() => { measure(); draw(); });
    resize.observe(canvas);
    // Off screen or in a hidden tab the loop is CANCELLED, not idled: a rAF
    // callback that returns early still wakes the main thread sixty times a second.
    function sync(): void {
      cancelAnimationFrame(frame);
      if (!reduced && onScreen && !document.hidden) frame = requestAnimationFrame(tick);
    }
    const visible = new IntersectionObserver(([entry]) => { onScreen = entry?.isIntersecting ?? true; sync(); });
    visible.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", sync);
      resize.disconnect();
      visible.disconnect();
    };
  }, [reduced, cell, dot]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-pixel-rain={reduced ? "still" : "running"}
      className={className ? `rain-mask pointer-events-none ${className}` : "rain-mask pointer-events-none"}
    />
  );
}
