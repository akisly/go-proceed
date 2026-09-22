"use client";

import { useEffect, useRef, useState } from "react";
import { followPointer, mountCanvasLoop, pointerIsFine, type CanvasScene } from "./canvas-loop";
import { useReduced } from "./use-reduced";

/**
 * A grid ground whose cells light up under the pointer and fade out behind it
 * (DEV-027) — the landing reference's answer to a hover over its perspective
 * floor and over its fact band. The owner: «когда наводишь на квадратики, они
 * подсвечиваются, с плавной анимацией затухания».
 *
 * THE GRID LINES ARE NOT DRAWN HERE. They stay the caller's CSS ground
 * (`landing-floor`, `landing-gridfield`), so the page without JavaScript, the
 * touch device and the reduced-motion reader all see the same complete grid.
 * This canvas lies over it and paints only the lit cells, on the same pitch:
 * `pitch` must equal the ground's `background-size`, and `align="center"`
 * follows a ground set at `background-position: 50% 0`.
 *
 * WHY A CANVAS AND NOT A CELL PER `<i>` WITH `:hover`. The floor and the fact
 * band hold some seven hundred cells between them at 1920px; as elements they
 * would double the home page's DOM to carry an ornament. As a canvas they are
 * one element, and the trail is continuous even when the pointer crosses four
 * cells between two events — the path is walked, not sampled.
 *
 * It is not a loop. A cell is lit at full strength, then loses it over `fade`
 * ms on an ease-out curve; frames are drawn only while some cell still holds
 * light, and then the scene rests with no callback pending (`canvas-loop.ts`).
 *
 * `track` — where the pointer is heard (`followPointer`):
 *  - `"parent"` (default): on the positioned ancestor, so a ground UNDER a
 *    section's content still hears the pointer over that content; the canvas
 *    itself takes no pointer events;
 *  - `"self"`: on the canvas, read in its own coordinates through whatever
 *    transform it sits under — the floor is a plane under CSS perspective.
 *
 * `exclude` — a selector, resolved inside the canvas's parent, of boxes whose
 * cells never light: the fact band's dome stands on the grid, and the owner
 * asked that the squares under it stay dark. A cell that overlaps such a box by
 * any amount is skipped (`cellIsBarred`), so no half-lit cell shows along its
 * edge; a cell that merely abuts it lights, and paints up to the edge and no
 * further. FLAT CANVASES ONLY (`track="parent"`): under `track="self"` the
 * pointer is read in the plane's own space while a box's rect is the projected
 * one, and the wrong cells would be barred (R2-05). The boxes are looked up on
 * every pointer event, so one that mounts later is still honoured.
 * A barred element that carries `data-disc="cx cy r"` (its own px — the particle
 * dome publishes it) is barred as THAT DISC, not as its box: the owner, seventh
 * pass — «ховер на квадраты так же должен работать вокруг глобуса, но не на
 * самом глобусе». Ten px of margin keep the dome's breath and its dots' radius
 * clear of a lit cell.
 *
 * Only under `pointer: fine`; never under reduced motion, where nothing is
 * mounted and the ground is simply still. The colour is the computed `color`.
 * Decorative: `aria-hidden`. The caller sizes it in CSS.
 */
/**
 * Does the cell at column `i`, row `j` overlap the box by any amount? Pure, so
 * the edge cases are tested without a browser (R2-02): straddling → barred,
 * abutting → not, clear → not. All in the canvas's own px.
 */
export function cellIsBarred(
  i: number, j: number, pitch: number, origin: number,
  box: { left: number; top: number; right: number; bottom: number },
): boolean {
  const left = origin + i * pitch;
  const top = j * pitch;
  return left < box.right && left + pitch > box.left && top < box.bottom && top + pitch > box.top;
}

/**
 * …and the same question of a DISC (the particle dome's silhouette): does the
 * cell come within `margin` px of it? The nearest point of the cell to the
 * disc's centre decides — a cell whose corner pokes into the disc is barred, one
 * that only faces it across `margin` of paper is not.
 */
export function cellIsBarredByDisc(
  i: number, j: number, pitch: number, origin: number,
  disc: { cx: number; cy: number; r: number }, margin = 0,
): boolean {
  const left = origin + i * pitch;
  const top = j * pitch;
  const nx = Math.min(Math.max(disc.cx, left), left + pitch);
  const ny = Math.min(Math.max(disc.cy, top), top + pitch);
  return Math.hypot(nx - disc.cx, ny - disc.cy) < disc.r + margin;
}

export function CellField({
  className, pitch, align = "center", track = "parent", strength = 0.08, fade = 900, exclude,
}: {
  className?: string | undefined;
  /** Grid pitch in CSS px — the ground's `background-size`. */
  pitch: number;
  align?: "center" | "start" | undefined;
  track?: "parent" | "self" | undefined;
  /** Alpha of a fully lit cell. */
  strength?: number | undefined;
  /** Ms for a lit cell to go dark. */
  fade?: number | undefined;
  /** Selector (within the canvas's parent) of boxes whose cells stay dark. */
  exclude?: string | undefined;
}) {
  const reduced = useReduced();
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"off" | "idle" | "lit">("off");

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    // Nothing is mounted without a pointer to follow (R-06): on a phone the loop
    // would size a bitmap as large as the section, at twice the density, to draw nothing.
    if (!canvas || !ctx || reduced || !pointerIsFine()) { setState("off"); return; }

    let width = 0;
    let height = 0;
    let colour = "";
    let origin = 0;
    /** cell key → light in (0, 1]. */
    const light = new Map<number, number>();
    let held = -1;
    let lastX = NaN;
    let lastY = NaN;
    const key = (i: number, j: number): number => (j + 64) * 4096 + (i + 64);

    const scene: CanvasScene = {
      resize(w, h, ratio, c) {
        width = w; height = h; colour = c;
        origin = align === "center" ? (((w - pitch) / 2) % pitch + pitch) % pitch : 0;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      },
      frame(_now, dt) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = colour;
        for (const [k, value] of light) {
          const next = k === held ? 1 : value - dt / fade;
          if (next <= 0) { light.delete(k); continue; }
          light.set(k, next);
          const i = (k % 4096) - 64;
          const j = Math.floor(k / 4096) - 64;
          // Ease-out: bright at once, a long soft tail.
          ctx.globalAlpha = strength * next * next;
          ctx.fillRect(origin + i * pitch + 1, j * pitch + 1, pitch - 1, pitch - 1);
        }
        ctx.globalAlpha = 1;
        const busy = light.size > (held >= 0 && light.has(held) ? 1 : 0);
        return busy;
      },
    };

    const loop = mountCanvasLoop(canvas, scene, {
      onState: (s) => setState(s === "running" ? "lit" : "idle"),
    });

    type Zone = { box: DOMRect; disc: { cx: number; cy: number; r: number } | null };
    /** The barred zones in the canvas's own coordinates — looked up and read per event: two or three of them, and they move with the layout. */
    const zones = (): Zone[] => {
      if (!exclude) return [];
      const home = canvas.getBoundingClientRect();
      return [...(canvas.parentElement?.querySelectorAll<HTMLElement>(exclude) ?? [])].map((el) => {
        const r = el.getBoundingClientRect();
        const box = new DOMRect(r.left - home.left, r.top - home.top, r.width, r.height);
        const [cx, cy, radius] = (el.getAttribute("data-disc") ?? "").split(" ").map(Number);
        const disc = cx !== undefined && cy !== undefined && radius !== undefined && Number.isFinite(cx + cy + radius) && radius > 0
          ? { cx: box.left + cx, cy: box.top + cy, r: radius } : null;
        return { box, disc };
      });
    };
    let shut: Zone[] = [];
    function touch(x: number, y: number): number {
      const i = Math.floor((x - origin) / pitch);
      const j = Math.floor(y / pitch);
      for (const z of shut) if (z.disc ? cellIsBarredByDisc(i, j, pitch, origin, z.disc, 10) : cellIsBarred(i, j, pitch, origin, z.box)) return -1;
      const k = key(i, j);
      light.set(k, 1);
      return k;
    }
    const unfollow = followPointer(canvas, track, (x, y) => {
      if (x < 0 || y < 0 || x > width || y > height) { held = -1; lastX = NaN; loop.wake(); return; }
      shut = zones();
      // Walk the path since the last event, a third of a cell at a time.
      const before = light.size;
      if (!Number.isNaN(lastX)) {
        const steps = Math.min(64, Math.ceil(Math.hypot(x - lastX, y - lastY) / (pitch / 3)));
        for (let s = 1; s < steps; s++) touch(lastX + ((x - lastX) * s) / steps, lastY + ((y - lastY) * s) / steps);
      }
      const was = held;
      held = touch(x, y);
      lastX = x; lastY = y;
      // Still inside the cell it already holds, and nothing new lit: the picture
      // is the same, so no draw, no wake, no state change per event (R-05).
      if (held === was && light.size === before) return;
      loop.drawOnce();
      loop.wake();
    }, () => { held = -1; lastX = NaN; loop.wake(); });

    return () => { unfollow(); loop.stop(); };
  }, [reduced, pitch, align, track, strength, fade, exclude]);

  const events = track === "self" ? "pointer-events-auto" : "pointer-events-none";
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-cell-field={state}
      data-cell-exclude={exclude}
      className={className ? `${events} ${className}` : events}
    />
  );
}
