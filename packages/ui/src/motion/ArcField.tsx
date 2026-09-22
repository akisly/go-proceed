"use client";

import { useEffect, useRef, useState } from "react";
import { followPointer, mountCanvasLoop, type CanvasScene } from "./canvas-loop";
import { useReduced } from "./use-reduced";

/**
 * The closing block's ground (DEV-024): a fan of hairline arcs leaving the
 * centre of the block, each bending away from the horizontal as it travels, so
 * the bundle reads as field lines and not as a sunburst — and the whole fan
 * LEANS TOWARD THE POINTER, easing there and easing back when it leaves.
 *
 * DEV-023 drew this ground as straight conic rays in CSS, from a still
 * screenshot. The owner: «эти линии в этом блоке в референсе немного другие, и
 * при наведении они взаимодействуют с мышкой — сделай то же самое».
 *
 * THE GEOMETRY, which is ours. Line `k` ARRIVES at the rim at the angle `e`,
 * evenly spaced round the circle, and is pulled on its way toward the ray
 * `e − curl·sin(2e)` — squeezed toward the horizontal — by a quadratic curve
 * whose control point sits on that ray. So the bundle bows flat, left and
 * right, and sweeps up and down to an even rim, which is the reference's look.
 * IT DOES NOT START AT THE CENTRE (B-01): seventy-two hairlines leaving one
 * point are a grey sheaf there, and on a phone the block's centre falls on the
 * offer's text, where the mask's clear core is 40px wide. Each line starts on
 * an inner ellipse, a sixth of the box, at its own arrival angle — evenly
 * spaced, so nothing bunches behind the copy. `lean` is the pointer's pull on a line's
 * departure — strongest for the lines that already point its way, nothing for
 * the ones that point away — and `curl` loosens as the pointer nears the
 * centre.
 *
 * It is not a loop. The pull is eased toward its target every frame; when it
 * has arrived the scene rests with no callback pending (`canvas-loop.ts`), so
 * a block nobody is pointing at draws nothing. Under reduced motion, and on a
 * touch device, it is the still fan: one frame, no reaction.
 *
 * The pointer is heard on the positioned ancestor (the section), because the
 * fan lies under the block's heading and buttons and takes no pointer events
 * itself. The colour is the computed `color`; the fade at the centre, where
 * the heading stands, and at the rim is `arc-mask` in `base.css`. Decorative:
 * `aria-hidden`. The caller sizes it in CSS.
 */
export function ArcField({
  className, lines = 72, strength = 0.17,
}: {
  className?: string | undefined;
  /** How many arcs the fan holds. */
  lines?: number | undefined;
  /** Alpha of one hairline. */
  strength?: number | undefined;
}) {
  const reduced = useReduced();
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"still" | "idle" | "leaning">("still");

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let colour = "";
    // Eased state → its target. `pull` is 0 with no pointer over the block.
    let pull = 0, pullTo = 0;
    let angle = 0, angleTo = 0;
    let near = 0, nearTo = 0;

    const scene: CanvasScene = {
      resize(w, h, ratio, c) {
        width = w; height = h; colour = c;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      },
      frame(_now, dt) {
        // A critically damped approach: ~90 % of the way in a third of a second.
        const k = dt ? 1 - Math.exp(-dt / 140) : 0;
        pull += (pullTo - pull) * k;
        near += (nearTo - near) * k;
        // The shortest way round the circle, so the fan never swings the long way.
        let turn = angleTo - angle;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        angle += turn * k;
        // Arrived: land exactly on the target, so the fan at rest is the same
        // picture every time and not a sub-pixel away from it.
        const settled = Math.abs(pullTo - pull) <= 0.002 && Math.abs(nearTo - near) <= 0.002 && (Math.abs(turn) <= 0.002 || pullTo === 0);
        if (settled) { pull = pullTo; near = nearTo; }

        const cx = width / 2;
        const cy = height / 2;
        const rim = Math.hypot(cx, cy) * 1.05;
        const innerX = width * 0.17;
        const innerY = height * 0.17;
        const curl = 0.5 - near * 0.28;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = colour;
        ctx.globalAlpha = strength;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < lines; i++) {
          const end = (i / lines) * Math.PI * 2 + 0.049;
          const facing = Math.max(0, Math.cos(end - angle));
          const lean = pull * 0.7 * Math.sin(angle - end) * facing;
          const a = end - curl * Math.sin(2 * end) + lean;
          ctx.moveTo(cx + Math.cos(end) * innerX, cy + Math.sin(end) * innerY);
          ctx.quadraticCurveTo(cx + Math.cos(a) * rim * 0.78, cy + Math.sin(a) * rim * 0.78, cx + Math.cos(end) * rim, cy + Math.sin(end) * rim);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        return !settled;
      },
    };

    const loop = mountCanvasLoop(canvas, scene, {
      run: !reduced,
      onState: (s) => setState(s === "running" ? "leaning" : "idle"),
    });
    if (reduced) { setState("still"); return () => loop.stop(); }

    const unfollow = followPointer(canvas, "parent", (x, y) => {
      const dx = x - width / 2;
      const dy = y - height / 2;
      angleTo = Math.atan2(dy, dx);
      // Settled before the first move: start the swing from where the pointer is.
      if (pullTo === 0 && pull < 0.01) angle = angleTo;
      pullTo = 1;
      nearTo = 1 - Math.min(1, Math.hypot(dx, dy) / (Math.hypot(width, height) / 2));
      loop.wake();
    }, () => { pullTo = 0; nearTo = 0; loop.wake(); });

    return () => { unfollow(); loop.stop(); };
  }, [reduced, lines, strength]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-arc-field={state}
      className={className ? `arc-mask pointer-events-none ${className}` : "arc-mask pointer-events-none"}
    />
  );
}
