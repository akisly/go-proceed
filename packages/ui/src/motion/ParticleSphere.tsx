"use client";

import { useEffect, useRef, useState } from "react";
import { followPointer, mountCanvasLoop } from "./canvas-loop";
import { domeDisc, drawStillDome } from "./particle-sphere-model";
import { useReduced } from "./use-reduced";

/**
 * A dome of particles rising out of a block's lower edge (DEV-026): a sphere
 * of dots on a Fibonacci lattice, of which only the cap shows; it turns slowly,
 * breathes, and its dots SCATTER FROM THE POINTER and spring home. The landing
 * reference sets one under its statistics; the owner: «есть красивая анимация,
 * хочу похожую», and «Используй threejs или @react-three/fiber».
 *
 * THE ONE WEBGL SCENE THE SYSTEM HAS — `DESIGN.md`'s «Don't build a 3D scene»
 * is overruled by the owner for this word on `apps/landing`, and for nothing
 * else. Plain three.js, not @react-three/fiber: one `Points` object does not
 * need a reconciler, and the loop has to be `canvas-loop.ts`'s, not a
 * renderer's own, to keep the rules every canvas word keeps.
 *
 * TWO CANVASES, and that is the fallback design, not an accident:
 *
 *  - the STILL canvas is 2D and is drawn at once from `particle-sphere-model`:
 *    the same dome as flat discs. It is what a reader sees under reduced
 *    motion, on a browser without WebGL 2, if the chunk fails to load, and for
 *    the moment before the scene's first frame;
 *  - the SCENE canvas is WebGL, and nothing about it exists until the block
 *    comes within 600px of the viewport: only then is
 *    `particle-sphere-scene` — and three.js with it — imported. When its first
 *    frame is on screen the still canvas is hidden. So the first screen, the
 *    LCP heading and every page that has no dome never pay for three.js.
 *
 * The loop is cancelled off screen and in a hidden tab; on unmount the
 * geometry, the material and the renderer are disposed and the context is
 * released. The pointer is heard on the positioned ancestor, only under
 * `pointer: fine`. The colour is the computed `color`. Decorative:
 * `aria-hidden`, no pointer events. THE CALLER POSITIONS AND SIZES THE BOX IN
 * CSS (`absolute inset-0 …` or `relative h-…`): the two canvases fill it.
 */
export function ParticleSphere({
  className, headroom = 0,
}: {
  className?: string | undefined;
  /** Px of the box kept empty above the dome's apex, so the breath and the scatter are not cut by the canvas's top edge. The caller makes the box that much taller than the dome it wants. */
  headroom?: number | undefined;
}) {
  const reduced = useReduced();
  const box = useRef<HTMLDivElement>(null);
  const still = useRef<HTMLCanvasElement>(null);
  const live = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"still" | "loading" | "running" | "fallback">("still");

  // The still frame: always, first, and again whenever the box changes.
  useEffect(() => {
    const canvas = still.current;
    if (!canvas) return;
    // …and the dome's silhouette, published on the box as `data-disc` («cx cy r», the box's own px), for a
    // `CellField` that must stay dark under the dome and nowhere else (`exclude`). Written here because
    // this effect runs under every preference and on every resize; React does not manage the attribute.
    const paint = (): void => {
      drawStillDome(canvas, headroom);
      const host = box.current;
      if (!host) return;
      // No box, no disc (R7-02): a dome hidden by a breakpoint has no size, and the model's radius floor
      // would publish a 120px disc at the origin for a `CellField` to bar.
      if (!canvas.clientWidth || !canvas.clientHeight) { host.removeAttribute("data-disc"); return; }
      const d = domeDisc(canvas.clientWidth, canvas.clientHeight, headroom);
      host.setAttribute("data-disc", `${d.cx.toFixed(1)} ${d.cy.toFixed(1)} ${d.r.toFixed(1)}`);
    };
    paint();
    const resize = new ResizeObserver(paint);
    resize.observe(canvas);
    return () => resize.disconnect();
  }, [headroom]);

  useEffect(() => {
    const host = box.current;
    const canvas = live.current;
    if (!host || !canvas || reduced) { setState("still"); return; }

    let cancelled = false;
    let teardown = (): void => {};

    const near = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      near.disconnect();
      // WebGL 2 first, three.js second (R-10): a browser that cannot run the scene
      // keeps its still dome and never downloads the chunk.
      const context = canvas.getContext("webgl2", { alpha: true, antialias: false, powerPreference: "low-power" });
      if (!context) { setState("fallback"); return; }
      const release = (): void => { context.getExtension("WEBGL_lose_context")?.loseContext(); };
      teardown = release;
      setState("loading");
      import("./particle-sphere-scene").then(({ createSphereScene }) => {
        if (cancelled) return;
        const scene = createSphereScene(canvas, context, headroom);
        const loop = mountCanvasLoop(canvas, scene, { onState: (s) => canvas.setAttribute("data-sphere-loop", s) });
        const unfollow = followPointer(canvas, "parent", (x, y) => scene.point({ x, y }), () => scene.point(null));
        teardown = () => { unfollow(); loop.stop(); scene.dispose(); canvas.removeAttribute("data-sphere-loop"); };
        setState("running");
      }).catch(() => { if (!cancelled) { release(); setState("fallback"); } });
    }, { rootMargin: "600px 0px" });
    near.observe(host);

    return () => { cancelled = true; near.disconnect(); teardown(); };
  }, [reduced, headroom]);

  const layer = "absolute inset-0 h-full w-full";
  return (
    <div ref={box} aria-hidden="true" data-particle-sphere={state} className={className ? `pointer-events-none ${className}` : "pointer-events-none relative"}>
      <canvas ref={still} aria-hidden="true" data-sphere-layer="still" className={state === "running" ? `${layer} opacity-0` : layer} />
      {/* Keyed by the preference (R-04): a context is released on teardown, and a canvas
          whose context is lost can never give a working one again — if the preference
          flips back — or the headroom changes (R3-03), which re-runs the same effect — the
          scene needs a fresh canvas. */}
      <canvas key={`${reduced ? "still" : "scene"}-${headroom}`} ref={live} aria-hidden="true" data-sphere-layer="scene" className={layer} />
    </div>
  );
}
