"use client";

import { useEffect, useState } from "react";

/**
 * The two capability gates the pointer and depth words share.
 *
 * Both return `false` on the server and on the first client paint, and the
 * real answer after an effect — the same conservative shape `useReduced()`
 * has, for the same reason: the server cannot read a media query, and a word
 * that rendered one tree on the server and another on the client would
 * remount on hydration (the `ScrollSettle` lesson, 2026-09-05). Every word
 * that consumes these keeps ONE DOM shape and switches its MotionValues off,
 * never its tree.
 *
 * The breakpoint is read from the token (`--breakpoint-md`, `--breakpoint-wide`
 * in theme.generated.css), so the number is typed nowhere here.
 */
export function useBelowBreakpoint(name: "md" | "wide"): boolean {
  const [below, setBelow] = useState(false);
  useEffect(() => {
    const fallback = name === "md" ? "768px" : "1240px";
    const value = getComputedStyle(document.documentElement).getPropertyValue(`--breakpoint-${name}`).trim() || fallback;
    const query = window.matchMedia(`(max-width: calc(${value} - 1px))`);
    const update = () => setBelow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [name]);
  return below;
}

/** `(pointer: fine)` — a mouse or trackpad. Tilt and magnetism follow a pointer; a thumb has nothing to follow. */
export function usePointerFine(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: fine)");
    const update = () => setFine(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return fine;
}

/**
 * The RESOLVED `prefers-reduced-motion: reduce` preference, read directly —
 * not through `useReduced()`, whose pre-hydration default (`true`) exists to
 * pick the same branch the server picked, not to answer "does this visitor
 * actually prefer reduced motion". `null` on the server and at first paint,
 * then the real answer, live-updated on `change`. A word that must act the
 * moment the answer is known reads this: `ScrollSettle`'s latch, and every
 * entrance `on="load"` (`Reveal`, `Stagger`, `CountUp`), which rests hidden
 * while it is `null` and starts its timeline the render it resolves.
 */
export function useResolvedReduce(): boolean | null {
  const [resolved, setResolved] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") { setResolved(false); return; }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setResolved(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return resolved;
}
